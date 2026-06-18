import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { asc, eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import {
  calculationItem,
  calculationItemType,
  customer,
} from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import type { AppEnv, AppUser } from "../types.js"

// ─────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────

const listSchema = z.object({
  customerId: z.coerce.number().int().min(1),
})

const createSchema = z.object({
  customerId: z.number().int().min(1),
  calculationItemTypeId: z.number().int().min(1).max(10),
  description: z.string().max(500).default(""),
  value: z.coerce.number().default(0),
})

const updateSchema = z.object({
  description: z.string().max(500).optional(),
  value: z.coerce.number().optional(),
})

// ─────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────

export const calculationsRoute = new Hono<AppEnv>()
calculationsRoute.use("*", auth)

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

// GET /api/calculations?customerId=X — all items for customer
calculationsRoute.get("/", zValidator("query", listSchema), async (c) => {
  const { customerId } = c.req.valid("query")
  const user = c.get("user")

  const access = await assertCustomerAccess(customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  const items = await db
    .select({
      id: calculationItem.id,
      customerId: calculationItem.customerId,
      calculationItemTypeId: calculationItem.calculationItemTypeId,
      itemTypeName: calculationItemType.description,
      description: calculationItem.description,
      value: calculationItem.value,
    })
    .from(calculationItem)
    .innerJoin(
      calculationItemType,
      eq(calculationItem.calculationItemTypeId, calculationItemType.id)
    )
    .where(eq(calculationItem.customerId, customerId))
    .orderBy(asc(calculationItem.calculationItemTypeId), asc(calculationItem.id))

  return c.json({ items })
})

// POST /api/calculations — create item
calculationsRoute.post("/", zValidator("json", createSchema), async (c) => {
  const input = c.req.valid("json")
  const user = c.get("user")

  const access = await assertCustomerAccess(input.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  const [created] = await db
    .insert(calculationItem)
    .values({
      customerId: input.customerId,
      calculationItemTypeId: input.calculationItemTypeId,
      description: input.description,
      value: String(input.value),
    })
    .returning({
      id: calculationItem.id,
      customerId: calculationItem.customerId,
      calculationItemTypeId: calculationItem.calculationItemTypeId,
      description: calculationItem.description,
      value: calculationItem.value,
    })

  return c.json(created, 201)
})

// POST /api/calculations/:id — update item
calculationsRoute.post("/:id", zValidator("json", updateSchema), async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const input = c.req.valid("json")
  const user = c.get("user")

  const [row] = await db
    .select({ customerId: calculationItem.customerId })
    .from(calculationItem)
    .where(eq(calculationItem.id, id))
    .limit(1)

  if (!row) return c.json({ error: "Item not found" }, 404)

  const access = await assertCustomerAccess(row.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  const updates: Record<string, unknown> = {}
  if (input.description !== undefined) updates.description = input.description
  if (input.value !== undefined) updates.value = String(input.value)

  if (Object.keys(updates).length === 0) return c.json({ ok: true })

  await db.update(calculationItem).set(updates).where(eq(calculationItem.id, id))

  return c.json({ ok: true })
})

// DELETE /api/calculations/:id
calculationsRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")

  const [row] = await db
    .select({ customerId: calculationItem.customerId })
    .from(calculationItem)
    .where(eq(calculationItem.id, id))
    .limit(1)

  if (!row) return c.json({ error: "Item not found" }, 404)

  const access = await assertCustomerAccess(row.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  await db.delete(calculationItem).where(eq(calculationItem.id, id))

  return c.json({ ok: true })
})
