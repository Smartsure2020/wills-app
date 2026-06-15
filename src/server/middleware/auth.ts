import { createMiddleware } from "hono/factory"
import { eq } from "drizzle-orm"
import { db } from "../../db"
import { account } from "../../db/schema"
import type { AppEnv, AppUser } from "../types"

/**
 * Stub auth middleware for development.
 *
 * Reads X-Dev-User-Id header if present, otherwise falls back to the
 * default dev account. Loads the full Account row and attaches it to
 * the Hono context as `user`.
 *
 * Will be replaced with real Supabase JWT validation in a later phase —
 * the contract (c.set("user", ...)) stays identical so downstream
 * handlers don't change.
 */

const DEFAULT_DEV_USER_ID = "00000000-0000-0000-0000-000000000001"

export const auth = createMiddleware<AppEnv>(async (c, next) => {
  const userId = c.req.header("x-dev-user-id") ?? DEFAULT_DEV_USER_ID

  const [user] = await db
    .select({
      id: account.id,
      accountTypeId: account.accountTypeId,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      manageAll: account.manageAll,
      customerId: account.customerId,
    })
    .from(account)
    .where(eq(account.id, userId))
    .limit(1)

  if (!user) {
    return c.json(
      {
        error: "Unauthorized",
        message: `No account found for id ${userId}. Create the default dev account or set X-Dev-User-Id header.`,
      },
      401
    )
  }

  c.set("user", user as AppUser)
  await next()
})