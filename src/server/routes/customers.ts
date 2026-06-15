import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm"
import { db } from "../../db/index.js"
import {
  account,
  country,
  customer,
  customerRelation,
  document,
  documentTemplate,
  flowControl,
  flowControlItem,
  flowItem,
  maritalStatus,
  relation,
  relationType,
  wishes,
} from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import { paginated, paginationOffset } from "../pagination.js"
import type { AppEnv } from "../types.js"

// ─────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────

// Zod 4's .uuid() enforces RFC version nibbles, but PostgreSQL accepts any
// 8-4-4-4-12 hex pattern (including deterministic seed IDs like 00000000-…-0002).
const pgUuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid UUID")

const relationInputSchema = z.object({
  relationTypeId: z.number().int().min(1),
  title: z.string().max(10).default(""),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().or(z.literal("")).default(""),
  contactNumber: z.string().max(50).default(""),
})

const customerCreateSchema = z.object({
  assignedTo: pgUuid,
  countryId: z.number().int().min(1),
  maritalStatusId: z.number().int().min(1),
  wishesId: z.number().int().min(1),
  title: z.string().max(10).default(""),
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  idNumber: z.string().min(1).max(20),
  contactNumber: z.string().max(50).default(""),
  occupation: z.string().max(255).default(""),
  highestEducation: z.string().max(100).default(""),
  monthlyIncome: z.number().min(0).default(0),
  isSmoker: z.boolean().default(false),
  registeredDonor: z.boolean().default(false),
  willDonate: z.boolean().default(false),
  dateOfBirth: z.string().date(), // ISO 8601 date string
  relations: z.array(relationInputSchema).default([]),
})

const customerListSchema = z.object({
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  searchText: z.string().optional(),
  countryId: z.coerce.number().int().optional(),
  maritalStatusId: z.coerce.number().int().optional(),
  wishesId: z.coerce.number().int().optional(),
  isSmoker: z.coerce.boolean().optional(),
  incomeMin: z.coerce.number().optional(),
  incomeMax: z.coerce.number().optional(),
})

const customerTypeaheadSchema = z.object({
  q: z.string().min(1).max(100),
})

const assignBrokerSchema = z.object({
  userId: pgUuid,
})

// ─────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────

export const customersRoute = new Hono<AppEnv>()

// All customer routes require an authenticated user
customersRoute.use("*", auth)

// ─────────────────────────────────────────────────────────
// GET /api/customers — paginated list with filters
// ─────────────────────────────────────────────────────────

customersRoute.get("/", zValidator("query", customerListSchema), async (c) => {
  const input = c.req.valid("query")
  const user = c.get("user")

  // Build WHERE clauses
  const conditions: SQL[] = [isNull(customer.deletedAt)]

  // ManageAll filter: brokers only see their own customers
  if (!user.manageAll) {
    conditions.push(eq(customer.assignedTo, user.id))
  }

  // Text search
  if (input.searchText && input.searchText.trim()) {
    const term = `%${input.searchText.trim()}%`
    const textSearch = or(
      ilike(customer.firstName, term),
      ilike(customer.lastName, term),
      ilike(customer.email, term)
    )
    if (textSearch) conditions.push(textSearch)
  }

  if (input.countryId) conditions.push(eq(customer.countryId, input.countryId))
  if (input.maritalStatusId) conditions.push(eq(customer.maritalStatusId, input.maritalStatusId))
  if (input.wishesId) conditions.push(eq(customer.wishesId, input.wishesId))
  if (input.isSmoker !== undefined) conditions.push(eq(customer.isSmoker, input.isSmoker))
  if (input.incomeMin !== undefined) conditions.push(gte(customer.monthlyIncome, input.incomeMin.toString()))
  if (input.incomeMax !== undefined) conditions.push(lte(customer.monthlyIncome, input.incomeMax.toString()))

  const whereClause = and(...conditions)
  const { limit, offset } = paginationOffset(input)

  // Data query with joined descriptions
  const items = await db
    .select({
      id: customer.id,
      countryId: customer.countryId,
      country: country.description,
      maritalStatusId: customer.maritalStatusId,
      maritalStatus: maritalStatus.description,
      wishesId: customer.wishesId,
      wish: wishes.description,
      title: customer.title,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      idNumber: customer.idNumber,
      contactNumber: customer.contactNumber,
      occupation: customer.occupation,
      highestEducation: customer.highestEducation,
      monthlyIncome: customer.monthlyIncome,
      isSmoker: customer.isSmoker,
      registeredDonor: customer.registeredDonor,
      willDonate: customer.willDonate,
      dateOfBirth: customer.dateOfBirth,
      createdAt: customer.createdAt,
      assignedTo: customer.assignedTo,
      brokerName: sql<string>`concat(${account.firstName}, ' ', ${account.lastName})`.as("broker_name"),
      createdBy: customer.createdBy,
    })
    .from(customer)
    .leftJoin(country, eq(customer.countryId, country.id))
    .leftJoin(maritalStatus, eq(customer.maritalStatusId, maritalStatus.id))
    .leftJoin(wishes, eq(customer.wishesId, wishes.id))
    .leftJoin(account, eq(customer.assignedTo, account.id))
    .where(whereClause)
    .orderBy(desc(customer.createdAt))
    .limit(limit)
    .offset(offset)

  // Count query (same WHERE, no joins)
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customer)
    .where(whereClause)

  return c.json(paginated(items, countRow?.count ?? 0, input))
})

// ─────────────────────────────────────────────────────────
// GET /api/customers/search?q= — typeahead
// ─────────────────────────────────────────────────────────

customersRoute.get("/search", zValidator("query", customerTypeaheadSchema), async (c) => {
  const { q } = c.req.valid("query")
  const user = c.get("user")
  const term = `%${q.trim()}%`

  const conditions: SQL[] = [
    isNull(customer.deletedAt),
    or(
      ilike(customer.firstName, term),
      ilike(customer.lastName, term),
      ilike(customer.email, term)
    )!,
  ]
  if (!user.manageAll) conditions.push(eq(customer.assignedTo, user.id))

  const items = await db
    .select({
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      idNumber: customer.idNumber,
    })
    .from(customer)
    .where(and(...conditions))
    .orderBy(customer.firstName, customer.lastName)
    .limit(15)

  return c.json({ items })
})

// ─────────────────────────────────────────────────────────
// GET /api/customers/:id — single customer with relations
// ─────────────────────────────────────────────────────────

customersRoute.get("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")

  const [row] = await db
    .select({
      id: customer.id,
      countryId: customer.countryId,
      country: country.description,
      maritalStatusId: customer.maritalStatusId,
      maritalStatus: maritalStatus.description,
      wishesId: customer.wishesId,
      wish: wishes.description,
      title: customer.title,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      idNumber: customer.idNumber,
      contactNumber: customer.contactNumber,
      occupation: customer.occupation,
      highestEducation: customer.highestEducation,
      monthlyIncome: customer.monthlyIncome,
      isSmoker: customer.isSmoker,
      registeredDonor: customer.registeredDonor,
      willDonate: customer.willDonate,
      dateOfBirth: customer.dateOfBirth,
      createdAt: customer.createdAt,
      assignedTo: customer.assignedTo,
      brokerName: sql<string>`concat(${account.firstName}, ' ', ${account.lastName})`.as("broker_name"),
      createdBy: customer.createdBy,
      deletedAt: customer.deletedAt,
    })
    .from(customer)
    .leftJoin(country, eq(customer.countryId, country.id))
    .leftJoin(maritalStatus, eq(customer.maritalStatusId, maritalStatus.id))
    .leftJoin(wishes, eq(customer.wishesId, wishes.id))
    .leftJoin(account, eq(customer.assignedTo, account.id))
    .where(and(eq(customer.id, id), isNull(customer.deletedAt)))
    .limit(1)

  if (!row) return c.json({ error: "Customer not found" }, 404)

  // ManageAll check at row level — broker can only see assigned customers
  if (!user.manageAll && row.assignedTo !== user.id) {
    return c.json({ error: "Forbidden" }, 403)
  }

  // Fetch relations
  const relations = await db
    .select({
      id: relation.id,
      relationTypeId: relation.relationTypeId,
      relationType: relationType.description,
      title: relation.title,
      firstName: relation.firstName,
      lastName: relation.lastName,
      email: relation.email,
      contactNumber: relation.contactNumber,
    })
    .from(customerRelation)
    .innerJoin(relation, eq(customerRelation.relationId, relation.id))
    .leftJoin(relationType, eq(relation.relationTypeId, relationType.id))
    .where(eq(customerRelation.customerId, id))

  return c.json({ ...row, relations })
})

// ─────────────────────────────────────────────────────────
// POST /api/customers — atomic create
// Mirrors BR-1 from WILLS_TOOL.md: 4-step transactional creation
// ─────────────────────────────────────────────────────────

customersRoute.post("/", zValidator("json", customerCreateSchema), async (c) => {
  const input = c.req.valid("json")
  const user = c.get("user")

  // Verify the assigned broker exists and is actually a broker
  const [broker] = await db
    .select({ id: account.id, accountTypeId: account.accountTypeId, active: account.active })
    .from(account)
    .where(eq(account.id, input.assignedTo))
    .limit(1)

  if (!broker || !broker.active || broker.accountTypeId !== 2) {
    return c.json({ error: "Invalid assignedTo: must reference an active broker account" }, 400)
  }

  try {
    const newCustomerId = await db.transaction(async (tx) => {
      // Step 1: insert customer
      const [newCustomer] = await tx
        .insert(customer)
        .values({
          countryId: input.countryId,
          maritalStatusId: input.maritalStatusId,
          wishesId: input.wishesId,
          assignedTo: input.assignedTo,
          title: input.title,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          idNumber: input.idNumber,
          contactNumber: input.contactNumber,
          occupation: input.occupation,
          highestEducation: input.highestEducation,
          monthlyIncome: input.monthlyIncome.toString(),
          isSmoker: input.isSmoker,
          registeredDonor: input.registeredDonor,
          willDonate: input.willDonate,
          dateOfBirth: input.dateOfBirth,
          createdBy: user.id,
        })
        .returning({ id: customer.id })

      // Step 2: insert relations + junction rows
      if (input.relations.length > 0) {
        const newRelations = await tx
          .insert(relation)
          .values(input.relations)
          .returning({ id: relation.id })

        await tx.insert(customerRelation).values(
          newRelations.map((r) => ({
            customerId: newCustomer.id,
            relationId: r.id,
          }))
        )
      }

      // Step 3: create FlowControl for FlowTypeId=1 (New Will) + checklist items
      const [newFlowControl] = await tx
        .insert(flowControl)
        .values({
          flowTypeId: 1,
          customerId: newCustomer.id,
          assignedTo: input.assignedTo,
          completed: false,
          createdBy: user.id,
        })
        .returning({ id: flowControl.id })

      const templates = await tx
        .select()
        .from(flowControlItem)
        .where(eq(flowControlItem.flowTypeId, 1))
        .orderBy(flowControlItem.orderBy)

      if (templates.length > 0) {
        await tx.insert(flowItem).values(
          templates.map((t) => ({
            flowControlId: newFlowControl.id,
            flowControlItemId: t.id,
            applicable: true,
            orderBy: t.orderBy,
          }))
        )
      }

      // Step 4: clone DocumentTemplate tree into Document tree
      const docTemplates = await tx.select().from(documentTemplate)

      if (docTemplates.length > 0) {
        // BFS from root so parents are always inserted before children
        const byParent = new Map<number, typeof docTemplates>()
        for (const t of docTemplates) {
          const list = byParent.get(t.parentId) ?? []
          list.push(t)
          byParent.set(t.parentId, list)
        }

        const idMap = new Map<number, number>()
        idMap.set(0, 0) // root

        const queue: number[] = [0]
        while (queue.length > 0) {
          const parentTemplateId = queue.shift()!
          const children = byParent.get(parentTemplateId) ?? []
          for (const t of children) {
            const newParentId = idMap.get(t.parentId) ?? 0
            const [newDoc] = await tx
              .insert(document)
              .values({
                parentId: newParentId,
                customerId: newCustomer.id,
                documentName: t.folderName,
                internalName: "",
                path: "",
                isFolder: true,
                inVault: false,
                contentType: "folder",
                password: "",
                createdBy: user.id,
              })
              .returning({ id: document.id })

            idMap.set(t.id, Number(newDoc.id))
            queue.push(t.id)
          }
        }
      }

      return newCustomer.id
    })

    return c.json({ id: newCustomerId }, 201)
  } catch (err) {
    console.error("[customers.create]", err)
    return c.json({ error: "Failed to create customer", message: String(err) }, 500)
  }
})

// ─────────────────────────────────────────────────────────
// POST /api/customers/:id/assign-broker — reassign
// ─────────────────────────────────────────────────────────

customersRoute.post("/:id/assign-broker", zValidator("json", assignBrokerSchema), async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const { userId } = c.req.valid("json")
  const user = c.get("user")

  // Permission: only admin or ManageAll broker can reassign
  if (!user.manageAll) return c.json({ error: "Forbidden" }, 403)

  // Confirm the new broker is valid
  const [newBroker] = await db
    .select({ id: account.id, accountTypeId: account.accountTypeId, active: account.active })
    .from(account)
    .where(eq(account.id, userId))
    .limit(1)

  if (!newBroker || !newBroker.active || newBroker.accountTypeId !== 2) {
    return c.json({ error: "Invalid broker" }, 400)
  }

  try {
    await db.transaction(async (tx) => {
      // Update the customer
      await tx
        .update(customer)
        .set({ assignedTo: userId })
        .where(eq(customer.id, id))

      // Cascade to all FlowControl rows for this customer
      await tx
        .update(flowControl)
        .set({ assignedTo: userId })
        .where(eq(flowControl.customerId, id))
    })

    return c.json({ ok: true })
  } catch (err) {
    console.error("[customers.assign-broker]", err)
    return c.json({ error: "Failed to reassign", message: String(err) }, 500)
  }
})