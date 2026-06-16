import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, asc, eq, isNull } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { db } from "../../db/index.js"
import { customer, document } from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import { supabaseAdmin, DOCUMENTS_BUCKET } from "../lib/supabase.js"
import type { AppEnv, AppUser } from "../types.js"

// ─────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────

const listSchema = z.object({
  customerId: z.coerce.number().int().min(1),
})

const uploadUrlSchema = z.object({
  customerId: z.number().int().min(1),
  documentName: z.string().min(1).max(500),
  contentType: z.string().min(1).max(100),
})

// ─────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────

export const documentsRoute = new Hono<AppEnv>()
documentsRoute.use("*", auth)

// ─────────────────────────────────────────────────────────
// Helper: confirm the user can access this customer
// ─────────────────────────────────────────────────────────

async function assertCustomerAccess(customerId: number, user: AppUser): Promise<{ ok: boolean; error?: string }> {
  const [row] = await db
    .select({ id: customer.id, assignedTo: customer.assignedTo, deletedAt: customer.deletedAt })
    .from(customer)
    .where(eq(customer.id, customerId))
    .limit(1)

  if (!row || row.deletedAt) return { ok: false, error: "Customer not found" }
  if (!user.manageAll && row.assignedTo !== user.id) return { ok: false, error: "Forbidden" }
  return { ok: true }
}

// ─────────────────────────────────────────────────────────
// GET /api/documents?customerId=X — list documents for a customer (root level, Phase 3.1)
// ─────────────────────────────────────────────────────────

documentsRoute.get("/", zValidator("query", listSchema), async (c) => {
  const { customerId } = c.req.valid("query")
  const user = c.get("user")

  const access = await assertCustomerAccess(customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.error === "Customer not found" ? 404 : 403)

  const items = await db
    .select({
      id: document.id,
      parentId: document.parentId,
      customerId: document.customerId,
      documentName: document.documentName,
      isFolder: document.isFolder,
      contentType: document.contentType,
      createdAt: document.createdAt,
      createdBy: document.createdBy,
    })
    .from(document)
    .where(
      and(
        eq(document.customerId, customerId),
        isNull(document.deletedAt)
      )
    )
    .orderBy(asc(document.isFolder), asc(document.documentName))

  return c.json({ items })
})

// ─────────────────────────────────────────────────────────
// POST /api/documents/upload-url — create DB row + signed upload URL
// Client uploads the actual file directly to Supabase Storage using this URL
// ─────────────────────────────────────────────────────────

documentsRoute.post("/upload-url", zValidator("json", uploadUrlSchema), async (c) => {
  const input = c.req.valid("json")
  const user = c.get("user")

  const access = await assertCustomerAccess(input.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.error === "Customer not found" ? 404 : 403)

  const internalName = randomUUID()
  const path = `customers/${input.customerId}/${internalName}`

  // Create the DB row first
  const [doc] = await db
    .insert(document)
    .values({
      parentId: 0,
      customerId: input.customerId,
      documentName: input.documentName,
      internalName,
      path,
      isFolder: false,
      inVault: false,
      contentType: input.contentType,
      password: "",
      createdBy: user.id,
    })
    .returning()

  // Generate signed upload URL
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    // Rollback: delete the orphaned document row
    await db.delete(document).where(eq(document.id, doc.id))
    return c.json({ error: `Failed to create upload URL: ${error?.message ?? "unknown"}` }, 500)
  }

  return c.json({
    documentId: Number(doc.id),
    documentName: doc.documentName,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  })
})

// ─────────────────────────────────────────────────────────
// GET /api/documents/:id/download-url — signed download URL
// ─────────────────────────────────────────────────────────

documentsRoute.get("/:id/download-url", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")

  const [doc] = await db
    .select()
    .from(document)
    .where(and(eq(document.id, id), isNull(document.deletedAt)))
    .limit(1)

  if (!doc) return c.json({ error: "Document not found" }, 404)
  if (doc.isFolder) return c.json({ error: "Cannot download a folder" }, 400)

  const access = await assertCustomerAccess(doc.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, 403)

  // Generate signed URL with download parameter to force download with the original filename
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.path, 60 * 60, { // 1 hour expiry
      download: doc.documentName,
    })

  if (error || !data) {
    return c.json({ error: `Failed to create download URL: ${error?.message ?? "unknown"}` }, 500)
  }

  return c.json({
    signedUrl: data.signedUrl,
    documentName: doc.documentName,
    contentType: doc.contentType,
  })
})

// ─────────────────────────────────────────────────────────
// DELETE /api/documents/:id — soft delete (Storage object stays)
// ─────────────────────────────────────────────────────────

documentsRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")

  const [doc] = await db
    .select({ customerId: document.customerId, deletedAt: document.deletedAt })
    .from(document)
    .where(eq(document.id, id))
    .limit(1)

  if (!doc || doc.deletedAt) return c.json({ error: "Document not found" }, 404)

  const access = await assertCustomerAccess(doc.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, 403)

  await db
    .update(document)
    .set({ deletedAt: new Date() })
    .where(eq(document.id, id))

  return c.json({ ok: true })
})