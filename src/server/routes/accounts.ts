import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm"
import { db } from "../../db/index.js"
import { account, accountType } from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import { paginated, paginationOffset } from "../pagination.js"
import type { AppEnv } from "../types.js"

// ─────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────

const accountListSchema = z.object({
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  searchText: z.string().optional(),
  accountTypeId: z.coerce.number().int().optional(),
})

const accountCreateSchema = z.object({
  accountTypeId: z.number().int().min(1).max(3),
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  contactNumber: z.string().max(50).default(""),
  manageAll: z.boolean().default(false),
  customerId: z.number().int().optional(), // only when accountTypeId === 3
})

const accountUpdateSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  contactNumber: z.string().max(50).default(""),
  manageAll: z.boolean(),
})

// ─────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────

export const accountsRoute = new Hono<AppEnv>()

accountsRoute.use("*", auth)

// Helper: can this user manage other accounts?
function canManage(user: { manageAll: boolean; accountTypeId: number }): boolean {
  return user.manageAll || user.accountTypeId === 1 // Admin or ManageAll broker
}

// ─────────────────────────────────────────────────────────
// GET /api/accounts/me — current authenticated user
// ─────────────────────────────────────────────────────────

accountsRoute.get("/me", async (c) => {
  return c.json(c.get("user"))
})

// ─────────────────────────────────────────────────────────
// GET /api/accounts — paginated list with search + type filter
// ─────────────────────────────────────────────────────────

accountsRoute.get("/", zValidator("query", accountListSchema), async (c) => {
  const input = c.req.valid("query")

  const conditions: SQL[] = [eq(account.active, true), isNull(account.deletedAt)]

  if (input.accountTypeId) {
    conditions.push(eq(account.accountTypeId, input.accountTypeId))
  }

  if (input.searchText && input.searchText.trim()) {
    const term = `%${input.searchText.trim()}%`
    const search = or(
      ilike(account.firstName, term),
      ilike(account.lastName, term),
      ilike(account.email, term)
    )
    if (search) conditions.push(search)
  }

  const whereClause = and(...conditions)
  const { limit, offset } = paginationOffset(input)

  const items = await db
    .select({
      id: account.id,
      accountTypeId: account.accountTypeId,
      accountType: accountType.description,
      customerId: account.customerId,
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      contactNumber: account.contactNumber,
      manageAll: account.manageAll,
    })
    .from(account)
    .leftJoin(accountType, eq(account.accountTypeId, accountType.id))
    .where(whereClause)
    .orderBy(asc(account.firstName), asc(account.lastName))
    .limit(limit)
    .offset(offset)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(account)
    .where(whereClause)

  return c.json(paginated(items, countRow?.count ?? 0, input))
})

// ─────────────────────────────────────────────────────────
// GET /api/accounts/:id — single account
// ─────────────────────────────────────────────────────────

accountsRoute.get("/:id", async (c) => {
  const id = c.req.param("id")

  const [row] = await db
    .select({
      id: account.id,
      accountTypeId: account.accountTypeId,
      accountType: accountType.description,
      customerId: account.customerId,
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      contactNumber: account.contactNumber,
      manageAll: account.manageAll,
      active: account.active,
      createdAt: account.createdAt,
    })
    .from(account)
    .leftJoin(accountType, eq(account.accountTypeId, accountType.id))
    .where(eq(account.id, id))
    .limit(1)

  if (!row) return c.json({ error: "Account not found" }, 404)

  return c.json(row)
})

// ─────────────────────────────────────────────────────────
// POST /api/accounts — create a new account
// Placeholder: just inserts the DB row. Real Supabase Auth invite
// flow will be added in a later phase to replace the Password@123 pattern.
// ─────────────────────────────────────────────────────────

accountsRoute.post("/", zValidator("json", accountCreateSchema), async (c) => {
  const input = c.req.valid("json")
  const user = c.get("user")

  if (!canManage(user)) {
    return c.json({ error: "Forbidden" }, 403)
  }

  // Enforce: customer accounts must reference a customer
  if (input.accountTypeId === 3 && !input.customerId) {
    return c.json({ error: "customerId is required for customer accounts" }, 400)
  }

  // Email uniqueness
  const [existing] = await db
    .select({ id: account.id })
    .from(account)
    .where(eq(account.email, input.email))
    .limit(1)

  if (existing) {
    return c.json({ error: "An account with this email already exists" }, 409)
  }

  const [newAccount] = await db
    .insert(account)
    .values({
      accountTypeId: input.accountTypeId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      contactNumber: input.contactNumber,
      manageAll: input.manageAll,
      customerId: input.customerId,
      active: true,
    })
    .returning({ id: account.id })

  return c.json(newAccount, 201)
})

// ─────────────────────────────────────────────────────────
// POST /api/accounts/:id — update account details
// ─────────────────────────────────────────────────────────

accountsRoute.post("/:id", zValidator("json", accountUpdateSchema), async (c) => {
  const id = c.req.param("id")
  const input = c.req.valid("json")
  const user = c.get("user")

  // Users can update themselves; admins/ManageAll can update anyone
  if (user.id !== id && !canManage(user)) {
    return c.json({ error: "Forbidden" }, 403)
  }

  // Self-update restriction: regular users can't grant themselves manageAll
  if (user.id === id && !canManage(user) && input.manageAll) {
    return c.json({ error: "Cannot grant ManageAll to yourself" }, 403)
  }

  // Email uniqueness if email is being changed
  const [existing] = await db
    .select({ id: account.id, email: account.email })
    .from(account)
    .where(eq(account.id, id))
    .limit(1)

  if (!existing) return c.json({ error: "Account not found" }, 404)

  if (existing.email !== input.email) {
    const [emailTaken] = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.email, input.email))
      .limit(1)

    if (emailTaken) {
      return c.json({ error: "An account with this email already exists" }, 409)
    }
  }

  await db
    .update(account)
    .set({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      contactNumber: input.contactNumber,
      manageAll: input.manageAll,
    })
    .where(eq(account.id, id))

  return c.json({ ok: true })
})