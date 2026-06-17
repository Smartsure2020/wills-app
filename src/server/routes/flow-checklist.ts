import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, asc, eq, sql } from "drizzle-orm"
import { db } from "../../db/index.js"
import {
  account,
  customer,
  document,
  flowControl,
  flowControlItem,
  flowItem,
  flowItemDocument,
  flowType,
} from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import type { AppEnv, AppUser } from "../types.js"
import { mail } from "../../db/schema.js"
import { EMAIL_TEMPLATES } from "../lib/email-templates.js"

const listSchema = z.object({
  customerId: z.coerce.number().int().min(1),
})

const updateItemSchema = z.object({
  checked: z.boolean().optional(),
  applicable: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
})

const attachSchema = z.object({
  documentId: z.number().int().min(1),
})

export const flowChecklistRoute = new Hono<AppEnv>()
flowChecklistRoute.use("*", auth)

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

async function syncFlowItems(flowControlId: number, flowTypeId: number) {
  const masterItems = await db
    .select({ id: flowControlItem.id, orderBy: flowControlItem.orderBy })
    .from(flowControlItem)
    .where(eq(flowControlItem.flowTypeId, flowTypeId))

  if (masterItems.length === 0) return

  const existing = await db
    .select({ flowControlItemId: flowItem.flowControlItemId })
    .from(flowItem)
    .where(eq(flowItem.flowControlId, flowControlId))

  const existingIds = new Set(existing.map((e) => e.flowControlItemId))
  const missing = masterItems.filter((m) => !existingIds.has(m.id))

  if (missing.length === 0) return

  await db.insert(flowItem).values(
    missing.map((m) => ({
      flowControlId,
      flowControlItemId: m.id,
      applicable: true,
      notes: "",
      orderBy: m.orderBy,
    }))
  )
}

// When an item is checked complete, look up its abbreviation and queue an email
// if we have a template for it. Failures here are non-fatal — the item update
// still succeeds; cron will handle send retries on its own schedule.
async function queueEmailIfTemplateExists(flowItemId: number) {
  try {
    const [row] = await db
      .select({
        abbreviation: flowControlItem.abbreviation,
        customerId: flowControl.customerId,
        customerFirstName: customer.firstName,
        customerLastName: customer.lastName,
        customerEmail: customer.email,
        brokerFirstName: account.firstName,
        brokerLastName: account.lastName,
        brokerEmail: account.email,
      })
      .from(flowItem)
      .innerJoin(flowControlItem, eq(flowItem.flowControlItemId, flowControlItem.id))
      .innerJoin(flowControl, eq(flowItem.flowControlId, flowControl.id))
      .innerJoin(customer, eq(flowControl.customerId, customer.id))
      .innerJoin(account, eq(customer.assignedTo, account.id))
      .where(eq(flowItem.id, flowItemId))
      .limit(1)

    if (!row) return

    const template = EMAIL_TEMPLATES[row.abbreviation]
    if (!template) return

    if (!row.customerEmail) return // skip if no address

    await db.insert(mail).values({
      address: row.customerEmail,
      subject: template.subject,
      body: template.buildBody({
        firstName: row.customerFirstName,
        lastName: row.customerLastName,
        brokerFirstName: row.brokerFirstName,
        brokerLastName: row.brokerLastName,
        brokerEmail: row.brokerEmail,
      }),
      customerId: row.customerId,
    })
  } catch (err) {
    // Don't propagate — email queueing should never block item update
    console.error("Failed to queue email for item", flowItemId, err)
  }
}

// ─────────────────────────────────────────────────────────
// GET /api/flow-checklist?customerId=X
// ─────────────────────────────────────────────────────────

flowChecklistRoute.get("/", zValidator("query", listSchema), async (c) => {
  const { customerId } = c.req.valid("query")
  const user = c.get("user")

  const access = await assertCustomerAccess(customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  const flowControls = await db
    .select({
      id: flowControl.id,
      flowTypeId: flowControl.flowTypeId,
      flowTypeName: flowType.description,
      completed: flowControl.completed,
      createdAt: flowControl.createdAt,
    })
    .from(flowControl)
    .innerJoin(flowType, eq(flowControl.flowTypeId, flowType.id))
    .where(eq(flowControl.customerId, customerId))

  if (flowControls.length === 0) {
    return c.json({ flowControls: [] })
  }

  await Promise.all(
    flowControls.map((fc) => syncFlowItems(fc.id, fc.flowTypeId))
  )

  const fcIds = flowControls.map((fc) => fc.id)
  const items = await db
    .select({
      id: flowItem.id,
      flowControlId: flowItem.flowControlId,
      flowControlItemId: flowItem.flowControlItemId,
      abbreviation: flowControlItem.abbreviation,
      description: flowControlItem.description,
      orderBy: flowItem.orderBy,
      checkedDate: flowItem.checkedDate,
      checkedBy: flowItem.checkedBy,
      checkedByFirstName: account.firstName,
      checkedByLastName: account.lastName,
      applicable: flowItem.applicable,
      notes: flowItem.notes,
    })
    .from(flowItem)
    .innerJoin(flowControlItem, eq(flowItem.flowControlItemId, flowControlItem.id))
    .leftJoin(account, eq(flowItem.checkedBy, account.id))
    .where(sql`${flowItem.flowControlId} IN (${sql.join(fcIds.map((id) => sql`${id}`), sql`, `)})`)
    .orderBy(asc(flowItem.orderBy), asc(flowItem.id))

  // Fetch all attachments for these flow items in one go
  const flowItemIds = items.map((i) => i.id)
  const attachments =
    flowItemIds.length === 0
      ? []
      : await db
          .select({
            id: flowItemDocument.id,
            flowItemId: flowItemDocument.flowItemId,
            documentId: flowItemDocument.documentId,
            documentName: document.documentName,
          })
          .from(flowItemDocument)
          .innerJoin(document, eq(flowItemDocument.documentId, document.id))
          .where(
            sql`${flowItemDocument.flowItemId} IN (${sql.join(flowItemIds.map((id) => sql`${id}`), sql`, `)})`
          )

  // Index attachments by flowItemId
  const attachmentsByItem = new Map<number, typeof attachments>()
  for (const a of attachments) {
    const arr = attachmentsByItem.get(a.flowItemId) ?? []
    arr.push(a)
    attachmentsByItem.set(a.flowItemId, arr)
  }

  const itemsWithAttachments = items.map((item) => ({
    ...item,
    attachments: (attachmentsByItem.get(item.id) ?? []).map((a) => ({
      id: a.id,
      documentId: Number(a.documentId),
      documentName: a.documentName,
    })),
  }))

  const result = flowControls.map((fc) => ({
    ...fc,
    items: itemsWithAttachments.filter((i) => i.flowControlId === fc.id),
  }))

  return c.json({ flowControls: result })
})

// ─────────────────────────────────────────────────────────
// POST /api/flow-checklist/items/:id — checked, applicable, notes
// ─────────────────────────────────────────────────────────

flowChecklistRoute.post("/items/:id", zValidator("json", updateItemSchema), async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const input = c.req.valid("json")
  const user = c.get("user")

  const [row] = await db
    .select({
      itemId: flowItem.id,
      customerId: flowControl.customerId,
    })
    .from(flowItem)
    .innerJoin(flowControl, eq(flowItem.flowControlId, flowControl.id))
    .where(eq(flowItem.id, id))
    .limit(1)

  if (!row) return c.json({ error: "Item not found" }, 404)

  const access = await assertCustomerAccess(row.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  const updates: Record<string, unknown> = {}

  if (input.checked === true) {
    updates.checkedDate = new Date()
    updates.checkedBy = user.id
  } else if (input.checked === false) {
    updates.checkedDate = null
    updates.checkedBy = null
  }

  if (input.applicable !== undefined) {
    updates.applicable = input.applicable
    if (!input.applicable) {
      updates.checkedDate = null
      updates.checkedBy = null
    }
  }

  if (input.notes !== undefined) {
    updates.notes = input.notes
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ ok: true })
  }

  await db.update(flowItem).set(updates).where(eq(flowItem.id, id))

  return c.json({ ok: true })
})

// ─────────────────────────────────────────────────────────
// POST /api/flow-checklist/items/:id/documents — attach a document
// ─────────────────────────────────────────────────────────

flowChecklistRoute.post(
  "/items/:id/documents",
  zValidator("json", attachSchema),
  async (c) => {
    const id = Number(c.req.param("id"))
    if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

    const { documentId } = c.req.valid("json")
    const user = c.get("user")

    // Verify item exists, get its customer
    const [item] = await db
      .select({ customerId: flowControl.customerId })
      .from(flowItem)
      .innerJoin(flowControl, eq(flowItem.flowControlId, flowControl.id))
      .where(eq(flowItem.id, id))
      .limit(1)

    if (!item) return c.json({ error: "Item not found" }, 404)

    const access = await assertCustomerAccess(item.customerId, user)
    if (!access.ok) return c.json({ error: access.error }, access.status!)

    // Verify the document belongs to the same customer
    const [doc] = await db
      .select({ customerId: document.customerId, isFolder: document.isFolder })
      .from(document)
      .where(eq(document.id, documentId))
      .limit(1)

    if (!doc) return c.json({ error: "Document not found" }, 404)
    if (doc.customerId !== item.customerId)
      return c.json({ error: "Document belongs to a different customer" }, 400)
    if (doc.isFolder)
      return c.json({ error: "Cannot attach a folder" }, 400)

    // Check if already attached
    const [existing] = await db
      .select({ id: flowItemDocument.id })
      .from(flowItemDocument)
      .where(
        and(
          eq(flowItemDocument.flowItemId, id),
          eq(flowItemDocument.documentId, documentId)
        )
      )
      .limit(1)

    if (existing) return c.json({ error: "Already attached" }, 409)

    const [created] = await db
      .insert(flowItemDocument)
      .values({ flowItemId: id, documentId })
      .returning({ id: flowItemDocument.id })

    return c.json(created, 201)
  }
)

// ─────────────────────────────────────────────────────────
// DELETE /api/flow-checklist/items/:itemId/documents/:documentId
// ─────────────────────────────────────────────────────────

flowChecklistRoute.delete("/items/:itemId/documents/:documentId", async (c) => {
  const itemId = Number(c.req.param("itemId"))
  const documentId = Number(c.req.param("documentId"))
  if (!Number.isFinite(itemId) || !Number.isFinite(documentId))
    return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")

  const [item] = await db
    .select({ customerId: flowControl.customerId })
    .from(flowItem)
    .innerJoin(flowControl, eq(flowItem.flowControlId, flowControl.id))
    .where(eq(flowItem.id, itemId))
    .limit(1)

  if (!item) return c.json({ error: "Item not found" }, 404)

  const access = await assertCustomerAccess(item.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  await db
    .delete(flowItemDocument)
    .where(
      and(
        eq(flowItemDocument.flowItemId, itemId),
        eq(flowItemDocument.documentId, documentId)
      )
    )

  return c.json({ ok: true })
})