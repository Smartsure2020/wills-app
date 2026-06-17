import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "../../db/index.js"
import { flowControlItem, flowItem, flowItemDocument, flowType } from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import type { AppEnv, AppUser } from "../types.js"

const createSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(2000).default(""),
  sectionName: z.string().max(200).default(""),
  sortOrder: z.coerce.number().int().default(0),
})

const updateSchema = createSchema

export const flowItemsRoute = new Hono<AppEnv>()
flowItemsRoute.use("*", auth)

function assertAdmin(user: AppUser): { ok: boolean; error?: string } {
  if (user.accountTypeId !== 1 && !user.manageAll) {
    return { ok: false, error: "Admin access required" }
  }
  return { ok: true }
}

// GET /api/flow-items - list all master checklist items (any authed user can read)
flowItemsRoute.get("/", async (c) => {
  const items = await db
    .select({
      id: flowControlItem.id,
      name: flowControlItem.abbreviation,
      description: flowControlItem.description,
      sectionName: flowType.description,
      sortOrder: flowControlItem.orderBy,
    })
    .from(flowControlItem)
    .innerJoin(flowType, eq(flowControlItem.flowTypeId, flowType.id))
    .orderBy(asc(flowControlItem.orderBy), asc(flowControlItem.abbreviation))

  return c.json({ items })
})

// POST /api/flow-items - create new master checklist item (admin only)
flowItemsRoute.post("/", zValidator("json", createSchema), async (c) => {
  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  const input = c.req.valid("json")
  const [created] = await db
    .insert(flowControlItem)
    .values({
      flowTypeId: 1,
      abbreviation: input.name,
      description: input.description,
      orderBy: input.sortOrder,
    })
    .returning({
      id: flowControlItem.id,
      name: flowControlItem.abbreviation,
      sortOrder: flowControlItem.orderBy,
    })

  return c.json(created, 201)
})

// POST /api/flow-items/:id - update master checklist item (admin only)
flowItemsRoute.post("/:id", zValidator("json", updateSchema), async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  const input = c.req.valid("json")

  await db
    .update(flowControlItem)
    .set({
      abbreviation: input.name,
      description: input.description,
      orderBy: input.sortOrder,
    })
    .where(and(eq(flowControlItem.id, id), eq(flowControlItem.flowTypeId, 1)))

  return c.json({ ok: true })
})

// DELETE /api/flow-items/:id - delete master checklist item (admin only)
flowItemsRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: flowItem.id })
      .from(flowItem)
      .where(eq(flowItem.flowControlItemId, id))

    const flowItemIds = rows.map((row) => row.id)
    if (flowItemIds.length > 0) {
      await tx.delete(flowItemDocument).where(inArray(flowItemDocument.flowItemId, flowItemIds))
      await tx.delete(flowItem).where(inArray(flowItem.id, flowItemIds))
    }

    await tx
      .delete(flowControlItem)
      .where(and(eq(flowControlItem.id, id), eq(flowControlItem.flowTypeId, 1)))
  })

  return c.json({ ok: true })
})
