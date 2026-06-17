import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm"
import { db } from "../../db/index.js"
import {
  customer,
  flowControl,
  flowControlItem,
  flowItem,
  account,
} from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import type { AppEnv, AppUser } from "../types.js"

const FLOW_STATES = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  AWAITING_CUSTOMER: 2,
  COMPLETED: 3,
  SKIPPED: 4,
} as const

const listSchema = z.object({
  customerId: z.coerce.number().int().min(1),
})

const updateItemSchema = z.object({
  state: z.number().int().min(0).max(4),
  notes: z.string().max(5000).optional(),
})

export const flowControlRoute = new Hono<AppEnv>()
flowControlRoute.use("*", auth)

async function assertCustomerAccess(
  customerId: number,
  user: AppUser
): Promise<{ ok: boolean; error?: string; status?: 403 | 404 }> {
  const [row] = await db
    .select({ id: customer.id, assignedTo: customer.assignedTo, deletedAt: customer.deletedAt })
    .from(customer)
    .where(eq(customer.id, customerId))
    .limit(1)

  if (!row || row.deletedAt) return { ok: false, error: "Customer not found", status: 404 }
  if (!user.manageAll && row.assignedTo !== user.id)
    return { ok: false, error: "Forbidden", status: 403 }
  return { ok: true }
}

// Lazy-sync: ensure this customer has a FlowControlItem row for every active FlowItem.
// Idempotent. Cheap (one select + one bulk insert when missing).
async function syncFlowControlItems(flowControlId: number) {
  const allActiveItems = await db
    .select({ id: flowItem.id })
    .from(flowItem)
    .where(isNull(flowItem.deletedAt))

  if (allActiveItems.length === 0) return

  const existing = await db
    .select({ flowItemId: flowControlItem.flowItemId })
    .from(flowControlItem)
    .where(eq(flowControlItem.flowControlId, flowControlId))

  const existingIds = new Set(existing.map((e) => Number(e.flowItemId)))
  const missing = allActiveItems
    .map((i) => Number(i.id))
    .filter((id) => !existingIds.has(id))

  if (missing.length === 0) return

  await db.insert(flowControlItem).values(
    missing.map((flowItemId) => ({
      flowControlId,
      flowItemId,
      state: FLOW_STATES.NOT_STARTED,
      notes: "",
    }))
  )
}

// ─────────────────────────────────────────────────────────
// GET /api/flow-control?customerId=X — checklist for a customer
// ─────────────────────────────────────────────────────────

flowControlRoute.get("/", zValidator("query", listSchema), async (c) => {
  const { customerId } = c.req.valid("query")
  const user = c.get("user")

  const access = await assertCustomerAccess(customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  // Find the customer's FlowControl row (should exist from customer-create)
  const [fc] = await db
    .select({ id: flowControl.id })
    .from(flowControl)
    .where(eq(flowControl.customerId, customerId))
    .limit(1)

  if (!fc) {
    return c.json({ error: "FlowControl not found for customer" }, 404)
  }

  // Ensure all active items have a corresponding row for this customer
  await syncFlowControlItems(Number(fc.id))

  // Now fetch the full checklist with master data + completion info
  const items = await db
    .select({
      id: flowControlItem.id,
      flowItemId: flowControlItem.flowItemId,
      name: flowItem.name,
      description: flowItem.description,
      sectionName: flowItem.sectionName,
      sortOrder: flowItem.sortOrder,
      state: flowControlItem.state,
      notes: flowControlItem.notes,
      completedAt: flowControlItem.completedAt,
      completedByFirstName: account.firstName,
      completedByLastName: account.lastName,
    })
    .from(flowControlItem)
    .innerJoin(flowItem, eq(flowControlItem.flowItemId, flowItem.id))
    .leftJoin(account, eq(flowControlItem.completedBy, account.id))
    .where(
      and(
        eq(flowControlItem.flowControlId, fc.id),
        isNull(flowItem.deletedAt)
      )
    )
    .orderBy(asc(flowItem.sectionName), asc(flowItem.sortOrder), asc(flowItem.name))

  return c.json({
    flowControlId: Number(fc.id),
    items: items.map((item) => ({
      ...item,
      id: Number(item.id),
      flowItemId: Number(item.flowItemId),
    })),
  })
})

// ─────────────────────────────────────────────────────────
// POST /api/flow-control/items/:id — update state and/or notes
// ─────────────────────────────────────────────────────────

flowControlRoute.post("/items/:id", zValidator("json", updateItemSchema), async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const input = c.req.valid("json")
  const user = c.get("user")

  // Get the item with its FlowControl + customer for access check
  const [row] = await db
    .select({
      itemId: flowControlItem.id,
      flowControlId: flowControlItem.flowControlId,
      customerId: flowControl.customerId,
    })
    .from(flowControlItem)
    .innerJoin(flowControl, eq(flowControlItem.flowControlId, flowControl.id))
    .where(eq(flowControlItem.id, id))
    .limit(1)

  if (!row) return c.json({ error: "Item not found" }, 404)

  const access = await assertCustomerAccess(row.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  // Track completion: when moving INTO completed, set completedAt + completedBy
  // When moving OUT of completed, clear them
  const updates: Record<string, unknown> = {
    state: input.state,
  }

  if (input.notes !== undefined) {
    updates.notes = input.notes
  }

  if (input.state === FLOW_STATES.COMPLETED) {
    updates.completedAt = new Date()
    updates.completedBy = user.id
  } else {
    updates.completedAt = null
    updates.completedBy = null
  }

  await db.update(flowControlItem).set(updates).where(eq(flowControlItem.id, id))

  return c.json({ ok: true })
})