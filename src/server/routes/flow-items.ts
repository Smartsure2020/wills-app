import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, asc, eq, isNull } from "drizzle-orm"
import { db } from "../../db/index.js"
import { flowItem } from "../../db/schema.js"
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

// GET /api/flow-items — list all active items (any authed user can read)
flowItemsRoute.get("/", async (c) => {
  const items = await db
    .select({
      id: flowItem.id,
      name: flowItem.name,
      description: flowItem.description,
      sectionName: flowItem.sectionName,
      sortOrder: flowItem.sortOrder,
      createdAt: flowItem.createdAt,
    })
    .from(flowItem)
    .where(isNull(flowItem.deletedAt))
    .orderBy(asc(flowItem.sortOrder), asc(flowItem.name))

  return c.json({ items })
})

// POST /api/flow-items — create new item (admin only)
flowItemsRoute.post("/", zValidator("json", createSchema), async (c) => {
  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  const input = c.req.valid("json")
  const [created] = await db
    .insert(flowItem)
    .values(input)
    .returning({
      id: flowItem.id,
      name: flowItem.name,
      sectionName: flowItem.sectionName,
      sortOrder: flowItem.sortOrder,
    })

  return c.json(created, 201)
})

// POST /api/flow-items/:id — update (admin only)
flowItemsRoute.post("/:id", zValidator("json", updateSchema), async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  const input = c.req.valid("json")

  await db
    .update(flowItem)
    .set(input)
    .where(and(eq(flowItem.id, id), isNull(flowItem.deletedAt)))

  return c.json({ ok: true })
})

// DELETE /api/flow-items/:id — soft delete (admin only)
flowItemsRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  await db
    .update(flowItem)
    .set({ deletedAt: new Date() })
    .where(eq(flowItem.id, id))

  return c.json({ ok: true })
})