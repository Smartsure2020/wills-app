import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { asc, eq, sql } from "drizzle-orm"
import { db } from "../../db/index.js"
import {
  account,
  customer,
  flowControl,
  flowControlItem,
  flowItem,
  flowType,
} from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import type { AppEnv, AppUser } from "../types.js"

const listSchema = z.object({
  customerId: z.coerce.number().int().min(1),
})

const updateItemSchema = z.object({
  checked: z.boolean().optional(),
  applicable: z.boolean().optional(),
})

export const flowChecklistRoute = new Hono<AppEnv>()
flowChecklistRoute.use("*", auth)

async function assertCustomerAccess(
  customerId: number,
  user: AppUser
): Promise<{ ok: boolean; error?: string; status?: 403 | 404 }> {
  const [row] = await db
    .select({
      id: customer.id,
      assignedTo: customer.assignedTo,
      deletedAt: customer.deletedAt,
    })
    .from(customer)
    .where(eq(customer.id, customerId))
    .limit(1)

  if (!row || row.deletedAt) return { ok: false, error: "Customer not found", status: 404 }
  if (!user.manageAll && row.assignedTo !== user.id)
    return { ok: false, error: "Forbidden", status: 403 }
  return { ok: true }
}

// Lazy-sync: ensure every flow_control_item for this flow_type has a corresponding flow_item row
async function syncFlowItems(flowControlId: number, flowTypeId: number) {
  const masterItems = await db
    .select({ id: flowControlItem.id, orderBy: flowControlItem.orderBy })
    .from(flowControlItem)
    .where(eq(flowControlItem.flowTypeId, flowTypeId))

  if (masterItems.length === 0) return

  const existing = await db
    .select({ flowControlItemId: flowItem.flowControlItemId })
    .from(flowItem)
    .where(eq(flowItem.flowControlId, flowControlId))

  const existingIds = new Set(existing.map((e) => e.flowControlItemId))
  const missing = masterItems.filter((m) => !existingIds.has(m.id))

  if (missing.length === 0) return

  await db.insert(flowItem).values(
    missing.map((m) => ({
      flowControlId,
      flowControlItemId: m.id,
      applicable: true,
      orderBy: m.orderBy,
    }))
  )
}

// GET /api/flow-checklist?customerId=X
flowChecklistRoute.get("/", zValidator("query", listSchema), async (c) => {
  const { customerId } = c.req.valid("query")
  const user = c.get("user")

  const access = await assertCustomerAccess(customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  // Fetch all flow_controls for this customer with their flow_type names
  const flowControls = await db
    .select({
      id: flowControl.id,
      flowTypeId: flowControl.flowTypeId,
      flowTypeName: flowType.description,
      completed: flowControl.completed,
      createdAt: flowControl.createdAt,
    })
    .from(flowControl)
    .innerJoin(flowType, eq(flowControl.flowTypeId, flowType.id))
    .where(eq(flowControl.customerId, customerId))

  if (flowControls.length === 0) {
    return c.json({ flowControls: [] })
  }

  // Lazy-sync items for each flow_control
  await Promise.all(
    flowControls.map((fc) => syncFlowItems(fc.id, fc.flowTypeId))
  )

  // Fetch all flow_items for these flow_controls with master + checker info
  const fcIds = flowControls.map((fc) => fc.id)
  const items = await db
    .select({
      id: flowItem.id,
      flowControlId: flowItem.flowControlId,
      flowControlItemId: flowItem.flowControlItemId,
      abbreviation: flowControlItem.abbreviation,
      description: flowControlItem.description,
      orderBy: flowItem.orderBy,
      checkedDate: flowItem.checkedDate,
      checkedBy: flowItem.checkedBy,
      checkedByFirstName: account.firstName,
      checkedByLastName: account.lastName,
      applicable: flowItem.applicable,
    })
    .from(flowItem)
    .innerJoin(flowControlItem, eq(flowItem.flowControlItemId, flowControlItem.id))
    .leftJoin(account, eq(flowItem.checkedBy, account.id))
    .where(sql`${flowItem.flowControlId} IN (${sql.join(fcIds.map((id) => sql`${id}`), sql`, `)})`)
    .orderBy(asc(flowItem.orderBy), asc(flowItem.id))

  // Group items by flow_control
  const result = flowControls.map((fc) => ({
    ...fc,
    items: items.filter((i) => i.flowControlId === fc.id),
  }))

  return c.json({ flowControls: result })
})

// POST /api/flow-checklist/items/:id — toggle checked or applicable
flowChecklistRoute.post("/items/:id", zValidator("json", updateItemSchema), async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const input = c.req.valid("json")
  const user = c.get("user")

  // Verify access via the flow_control → customer chain
  const [row] = await db
    .select({
      itemId: flowItem.id,
      customerId: flowControl.customerId,
    })
    .from(flowItem)
    .innerJoin(flowControl, eq(flowItem.flowControlId, flowControl.id))
    .where(eq(flowItem.id, id))
    .limit(1)

  if (!row) return c.json({ error: "Item not found" }, 404)

  const access = await assertCustomerAccess(row.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  const updates: Record<string, unknown> = {}

  if (input.checked === true) {
    updates.checkedDate = new Date()
    updates.checkedBy = user.id
  } else if (input.checked === false) {
    updates.checkedDate = null
    updates.checkedBy = null
  }

  if (input.applicable !== undefined) {
    updates.applicable = input.applicable
    // If marking as not applicable, also clear checked state
    if (!input.applicable) {
      updates.checkedDate = null
      updates.checkedBy = null
    }
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ ok: true })
  }

  await db.update(flowItem).set(updates).where(eq(flowItem.id, id))

  return c.json({ ok: true })
})
