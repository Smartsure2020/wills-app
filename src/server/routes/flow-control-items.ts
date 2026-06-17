import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { asc, eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { flowControlItem, flowType } from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import type { AppEnv, AppUser } from "../types.js"

const createSchema = z.object({
  flowTypeId: z.coerce.number().int().min(1),
  abbreviation: z.string().min(1).max(50),
  description: z.string().min(1).max(2000),
  orderBy: z.coerce.number().int().default(0),
})

export const flowControlItemsRoute = new Hono<AppEnv>()
flowControlItemsRoute.use("*", auth)

function assertAdmin(user: AppUser): { ok: boolean; error?: string } {
  if (user.accountTypeId !== 1 && !user.manageAll) {
    return { ok: false, error: "Admin access required" }
  }
  return { ok: true }
}

// GET /api/flow-control-items — list all items + flow types
flowControlItemsRoute.get("/", async (c) => {
  const [items, types] = await Promise.all([
    db
      .select({
        id: flowControlItem.id,
        flowTypeId: flowControlItem.flowTypeId,
        abbreviation: flowControlItem.abbreviation,
        description: flowControlItem.description,
        orderBy: flowControlItem.orderBy,
      })
      .from(flowControlItem)
      .orderBy(asc(flowControlItem.flowTypeId), asc(flowControlItem.orderBy)),
    db.select().from(flowType).orderBy(asc(flowType.id)),
  ])

  return c.json({ items, flowTypes: types })
})

// POST /api/flow-control-items — create
flowControlItemsRoute.post("/", zValidator("json", createSchema), async (c) => {
  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  const input = c.req.valid("json")
  const [created] = await db
    .insert(flowControlItem)
    .values(input)
    .returning({ id: flowControlItem.id })

  return c.json(created, 201)
})

// POST /api/flow-control-items/:id — update
flowControlItemsRoute.post("/:id", zValidator("json", createSchema), async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  const input = c.req.valid("json")
  await db.update(flowControlItem).set(input).where(eq(flowControlItem.id, id))

  return c.json({ ok: true })
})

// DELETE /api/flow-control-items/:id — hard delete (no soft-delete column on schema)
flowControlItemsRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  await db.delete(flowControlItem).where(eq(flowControlItem.id, id))

  return c.json({ ok: true })
})