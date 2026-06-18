import { Hono } from "hono"
import { and, isNull, lt, eq, sql, asc } from "drizzle-orm"
import { db } from "../../db/index.js"
import { mail } from "../../db/schema.js"
import { sendEmail } from "../lib/resend.js"
import type { AppEnv } from "../types.js"

const MAX_ATTEMPTS = 5
const BATCH_SIZE = 50

export const cronRoute = new Hono<AppEnv>()

cronRoute.get("/send-mail", async (c) => {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = c.req.header("Authorization")
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const pending = await db
    .select()
    .from(mail)
    .where(and(isNull(mail.sentAt), lt(mail.attempts, MAX_ATTEMPTS)))
    .orderBy(asc(mail.createdAt))
    .limit(BATCH_SIZE)

  let sent = 0
  let failed = 0

  for (const m of pending) {
    try {
      await sendEmail({
        to: m.address,
        subject: m.subject,
        htmlBody: m.body,
      })

      await db
        .update(mail)
        .set({ sentAt: new Date(), lastError: null })
        .where(eq(mail.id, m.id))

      sent++
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      console.error("[cron.send-mail]", `mail ${m.id}: ${message}`)

      await db
        .update(mail)
        .set({
          attempts: sql`${mail.attempts} + 1`,
          lastError: message,
        })
        .where(eq(mail.id, m.id))

      failed++
    }
  }

  return c.json({
    processed: pending.length,
    sent,
    failed,
  })
})
