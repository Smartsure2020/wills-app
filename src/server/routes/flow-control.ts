import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, asc, eq } from "drizzle-orm"
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

// Lazy-sync: ensure this customer has a FlowItem row for every master FlowControlItem.
// Idempotent. Cheap (one select + one bulk insert when missing).
async function syncFlowControlItems(flowControlId: number, flowTypeId: number) {
  const allTemplates = await db
    .select({ id: flowControlItem.id, orderBy: flowControlItem.orderBy })
    .from(flowControlItem)
    .where(eq(flowControlItem.flowTypeId, flowTypeId))

  if (allTemplates.length === 0) return

  const existing = await db
    .select({ flowControlItemId: flowItem.flowControlItemId })
    .from(flowItem)
    .where(eq(flowItem.flowControlId, flowControlId))

  const existingIds = new Set(existing.map((e) => Number(e.flowControlItemId)))
  const missing = allTemplates.filter((item) => !existingIds.has(Number(item.id)))

  if (missing.length === 0) return

  await db.insert(flowItem).values(
    missing.map((item) => ({
      flowControlId,
      flowControlItemId: item.id,
      applicable: true,
      orderBy: item.orderBy,
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
    .select({ id: flowControl.id, flowTypeId: flowControl.flowTypeId })
    .from(flowControl)
    .where(eq(flowControl.customerId, customerId))
    .limit(1)

  if (!fc) {
    return c.json({ error: "FlowControl not found for customer" }, 404)
  }

  // Ensure all active items have a corresponding row for this customer
  await syncFlowControlItems(Number(fc.id), Number(fc.flowTypeId))

  // Now fetch the full checklist with master data + completion info
  const items = await db
    .select({
      id: flowItem.id,
      flowItemId: flowItem.id,
      name: flowControlItem.abbreviation,
      description: flowControlItem.description,
      sectionName: flowControlItem.abbreviation,
      sortOrder: flowControlItem.orderBy,
      checkedDate: flowItem.checkedDate,
      checkedBy: flowItem.checkedBy,
      applicable: flowItem.applicable,
      completedByFirstName: account.firstName,
      completedByLastName: account.lastName,
    })
    .from(flowItem)
    .innerJoin(flowControlItem, eq(flowItem.flowControlItemId, flowControlItem.id))
    .leftJoin(account, eq(flowItem.checkedBy, account.id))
    .where(
      and(
        eq(flowItem.flowControlId, fc.id),
        eq(flowControlItem.flowTypeId, fc.flowTypeId)
      )
    )
    .orderBy(asc(flowControlItem.orderBy), asc(flowControlItem.abbreviation))

  return c.json({
    flowControlId: Number(fc.id),
    items: items.map((item) => ({
      id: Number(item.id),
      flowItemId: Number(item.flowItemId),
      name: item.name,
      description: item.description,
      sectionName: "General",
      sortOrder: item.sortOrder,
      state: !item.applicable
        ? FLOW_STATES.SKIPPED
        : item.checkedDate
          ? FLOW_STATES.COMPLETED
          : FLOW_STATES.NOT_STARTED,
      notes: "",
      completedAt: item.checkedDate,
      completedByFirstName: item.completedByFirstName,
      completedByLastName: item.completedByLastName,
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
      itemId: flowItem.id,
      flowControlId: flowItem.flowControlId,
      customerId: flowControl.customerId,
    })
    .from(flowItem)
    .innerJoin(flowControl, eq(flowItem.flowControlId, flowControl.id))
    .where(eq(flowItem.id, id))
    .limit(1)

  if (!row) return c.json({ error: "Item not found" }, 404)

  const access = await assertCustomerAccess(row.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  await db
    .update(flowItem)
    .set({
      applicable: input.state !== FLOW_STATES.SKIPPED,
      checkedDate: input.state === FLOW_STATES.COMPLETED ? new Date() : null,
      checkedBy: input.state === FLOW_STATES.COMPLETED ? user.id : null,
    })
    .where(eq(flowItem.id, id))

  return c.json({ ok: true })
})
