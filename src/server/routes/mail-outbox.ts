import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { desc, eq, sql } from "drizzle-orm"
import { db } from "../../db/index.js"
import { mail } from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import type { AppEnv, AppUser } from "../types.js"

const listSchema = z.object({
  status: z.enum(["all", "pending", "sent", "failed"]).default("all"),
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export const mailOutboxRoute = new Hono<AppEnv>()
mailOutboxRoute.use("*", auth)

function assertAdmin(user: AppUser) {
  if (user.accountTypeId !== 1 && !user.manageAll) {
    return { ok: false, error: "Admin access required" }
  }
  return { ok: true }
}

mailOutboxRoute.get("/", zValidator("query", listSchema), async (c) => {
  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  const { status, pageNumber, pageSize } = c.req.valid("query")

  const conditions =
    status === "pending"
      ? sql`sent_at IS NULL AND attempts < 5`
      : status === "sent"
      ? sql`sent_at IS NOT NULL`
      : status === "failed"
      ? sql`sent_at IS NULL AND attempts >= 5`
      : sql`1 = 1`

  const items = await db
    .select()
    .from(mail)
    .where(conditions)
    .orderBy(desc(mail.createdAt))
    .limit(pageSize)
    .offset((pageNumber - 1) * pageSize)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mail)
    .where(conditions)

  return c.json({
    items,
    pageNumber,
    pageSize,
    totalCount: count,
    totalPages: Math.ceil(count / pageSize),
  })
})

// POST /api/mail-outbox/:id/retry — reset attempts so cron picks it up again
mailOutboxRoute.post("/:id/retry", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  await db
    .update(mail)
    .set({ attempts: 0, lastError: null })
    .where(eq(mail.id, id))

  return c.json({ ok: true })
})