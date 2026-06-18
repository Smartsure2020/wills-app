import type { MiddlewareHandler } from "hono"
import { jwtVerify } from "jose"
import { eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { account } from "../../db/schema.js"
import type { AppEnv, AppUser } from "../types.js"

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET

if (!JWT_SECRET) {
  throw new Error("SUPABASE_JWT_SECRET must be set")
}

const secretKey = new TextEncoder().encode(JWT_SECRET)

export const auth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401)
  }

  const token = authHeader.slice("Bearer ".length).trim()

  let userId: string
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      audience: "authenticated",
    })

    if (!payload.sub) {
      return c.json({ error: "Token missing subject" }, 401)
    }

    userId = payload.sub
  } catch (err) {
    console.error("[auth.invalid-token]", err)
    return c.json({ error: "Invalid token" }, 401)
  }

  const [row] = await db
    .select({
      id: account.id,
      accountTypeId: account.accountTypeId,
      customerId: account.customerId,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      manageAll: account.manageAll,
      active: account.active,
    })
    .from(account)
    .where(eq(account.id, userId))
    .limit(1)

  if (!row || !row.active) {
    return c.json({ error: "Account not found or inactive" }, 401)
  }

  const user: AppUser = {
    id: row.id,
    accountTypeId: row.accountTypeId,
    customerId: row.customerId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    manageAll: row.manageAll,
  }

  c.set("user", user)
  await next()
}
