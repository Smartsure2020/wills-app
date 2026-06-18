import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { db } from "../../db/index.js"
import { customer, document } from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import { supabaseAdmin, DOCUMENTS_BUCKET } from "../lib/supabase.js"
import type { AppEnv, AppUser } from "../types.js"

type BreadcrumbRow = {
  id: number | string
  parent_id: number | string
  document_name: string
}

// ─────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────

const listSchema = z.object({
  customerId: z.coerce.number().int().min(1),
  parentId: z.coerce.number().int().min(0).default(0),
})

const allFoldersSchema = z.object({
  customerId: z.coerce.number().int().min(1),
})

const allFilesSchema = z.object({
  customerId: z.coerce.number().int().min(1),
})

const uploadUrlSchema = z.object({
  customerId: z.number().int().min(1),
  parentId: z.number().int().min(0).default(0),
  documentName: z.string().min(1).max(500),
  contentType: z.string().min(1).max(100),
})

const folderSchema = z.object({
  customerId: z.number().int().min(1),
  parentId: z.number().int().min(0).default(0),
  folderName: z.string().min(1).max(500),
})

const moveSchema = z.object({
  newParentId: z.number().int().min(0),
})

// ─────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────

export const documentsRoute = new Hono<AppEnv>()
documentsRoute.use("*", auth)

// ─────────────────────────────────────────────────────────
// Access helper
// ─────────────────────────────────────────────────────────

async function assertCustomerAccess(
  customerId: number,
  user: AppUser
): Promise<{ ok: boolean; error?: string; status?: 403 | 404 }> {
  const [row] = await db
    .select({ id: customer.id, assignedTo: customer.assignedTo, deletedAt: customer.deletedAt })
    .from(customer)
    .where(eq(customer.id, customerId))
    .limit(1)

  if (!row || row.deletedAt) return { ok: false, error: "Customer not found", status: 404 }
  if (!user.manageAll && row.assignedTo !== user.id)
    return { ok: false, error: "Forbidden", status: 403 }
  return { ok: true }
}

// ─────────────────────────────────────────────────────────
// GET /api/documents/folders?customerId=X — all folders (for move dialog)
// ─────────────────────────────────────────────────────────

documentsRoute.get("/folders", zValidator("query", allFoldersSchema), async (c) => {
  const { customerId } = c.req.valid("query")
  const user = c.get("user")

  const access = await assertCustomerAccess(customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  const folders = await db
    .select({
      id: document.id,
      parentId: document.parentId,
      documentName: document.documentName,
    })
    .from(document)
    .where(
      and(
        eq(document.customerId, customerId),
        eq(document.isFolder, true),
        isNull(document.deletedAt)
      )
    )
    .orderBy(asc(document.documentName))

  return c.json({ folders })
})

// ─────────────────────────────────────────────────────────
// GET /api/documents/files?customerId=X — all files (for attach dialog)
// ─────────────────────────────────────────────────────────

documentsRoute.get("/files", zValidator("query", allFilesSchema), async (c) => {
  const { customerId } = c.req.valid("query")
  const user = c.get("user")

  const access = await assertCustomerAccess(customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  const items = await db
    .select({
      id: document.id,
      documentName: document.documentName,
      contentType: document.contentType,
      createdAt: document.createdAt,
    })
    .from(document)
    .where(
      and(
        eq(document.customerId, customerId),
        eq(document.isFolder, false),
        isNull(document.deletedAt)
      )
    )
    .orderBy(asc(document.documentName))

  return c.json({ items })
})

// GET /api/documents?customerId=X&parentId=Y — list current folder + breadcrumb

documentsRoute.get("/", zValidator("query", listSchema), async (c) => {
  const { customerId, parentId } = c.req.valid("query")
  const user = c.get("user")

  const access = await assertCustomerAccess(customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  // Current folder contents (folders first, then files, both alphabetical)
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
        eq(document.parentId, parentId),
        isNull(document.deletedAt)
      )
    )
    .orderBy(desc(document.isFolder), asc(document.documentName))

  // Breadcrumb — walk up from current folder to root via recursive CTE
  let breadcrumbs: { id: number; parentId: number; documentName: string }[] = []
  if (parentId > 0) {
    const result = await db.execute(sql`
      WITH RECURSIVE folder_path AS (
        SELECT id, parent_id, document_name, 0 AS depth
        FROM "document"
        WHERE id = ${parentId} AND deleted_at IS NULL AND is_folder = true
        UNION ALL
        SELECT d.id, d.parent_id, d.document_name, fp.depth + 1
        FROM "document" d
        INNER JOIN folder_path fp ON d.id = fp.parent_id
        WHERE d.deleted_at IS NULL AND d.is_folder = true
      )
      SELECT id, parent_id, document_name
      FROM folder_path
      ORDER BY depth DESC
    `)
    breadcrumbs = (result as unknown as BreadcrumbRow[]).map((row) => ({
      id: Number(row.id),
      parentId: Number(row.parent_id),
      documentName: row.document_name,
    }))
  }

  return c.json({ items, breadcrumbs })
})

// ─────────────────────────────────────────────────────────
// POST /api/documents/folder — create a folder
// ─────────────────────────────────────────────────────────

documentsRoute.post("/folder", zValidator("json", folderSchema), async (c) => {
  const input = c.req.valid("json")
  const user = c.get("user")

  const access = await assertCustomerAccess(input.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  // Validate parent if not root
  if (input.parentId > 0) {
    const [parent] = await db
      .select({ id: document.id, customerId: document.customerId, isFolder: document.isFolder })
      .from(document)
      .where(and(eq(document.id, input.parentId), isNull(document.deletedAt)))
      .limit(1)

    if (!parent) return c.json({ error: "Parent folder not found" }, 404)
    if (parent.customerId !== input.customerId)
      return c.json({ error: "Parent belongs to a different customer" }, 400)
    if (!parent.isFolder) return c.json({ error: "Parent must be a folder" }, 400)
  }

  const [folder] = await db
    .insert(document)
    .values({
      parentId: input.parentId,
      customerId: input.customerId,
      documentName: input.folderName,
      internalName: "",
      path: "",
      isFolder: true,
      inVault: false,
      contentType: "",
      password: "",
      createdBy: user.id,
    })
    .returning({
      id: document.id,
      parentId: document.parentId,
      documentName: document.documentName,
      isFolder: document.isFolder,
    })

  return c.json(folder, 201)
})

// ─────────────────────────────────────────────────────────
// POST /api/documents/upload-url
// ─────────────────────────────────────────────────────────

documentsRoute.post("/upload-url", zValidator("json", uploadUrlSchema), async (c) => {
  const input = c.req.valid("json")
  const user = c.get("user")

  const access = await assertCustomerAccess(input.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  // If parentId set, validate it's a folder for this customer
  if (input.parentId > 0) {
    const [parent] = await db
      .select({ customerId: document.customerId, isFolder: document.isFolder })
      .from(document)
      .where(and(eq(document.id, input.parentId), isNull(document.deletedAt)))
      .limit(1)
    if (!parent) return c.json({ error: "Parent folder not found" }, 404)
    if (parent.customerId !== input.customerId)
      return c.json({ error: "Parent belongs to different customer" }, 400)
    if (!parent.isFolder) return c.json({ error: "Parent must be a folder" }, 400)
  }

  const internalName = randomUUID()
  const path = `customers/${input.customerId}/${internalName}`

  const [doc] = await db
    .insert(document)
    .values({
      parentId: input.parentId,
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

  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    await db.delete(document).where(eq(document.id, doc.id))
    console.error("[documents.upload-url]", error)
    return c.json({ error: "Internal error" }, 500)
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
// GET /api/documents/:id/download-url
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
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.path, 60 * 60, { download: doc.documentName })

  if (error || !data) {
    console.error("[documents.download-url]", error)
    return c.json({ error: "Internal error" }, 500)
  }

  return c.json({
    signedUrl: data.signedUrl,
    documentName: doc.documentName,
    contentType: doc.contentType,
  })
})

// ─────────────────────────────────────────────────────────
// POST /api/documents/:id/move — move to new parent folder
// ─────────────────────────────────────────────────────────

documentsRoute.post("/:id/move", zValidator("json", moveSchema), async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const { newParentId } = c.req.valid("json")
  const user = c.get("user")

  const [doc] = await db
    .select()
    .from(document)
    .where(and(eq(document.id, id), isNull(document.deletedAt)))
    .limit(1)

  if (!doc) return c.json({ error: "Document not found" }, 404)
  if (newParentId === id) return c.json({ error: "Cannot move into itself" }, 400)

  const access = await assertCustomerAccess(doc.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  if (newParentId > 0) {
    const [newParent] = await db
      .select({
        id: document.id,
        customerId: document.customerId,
        isFolder: document.isFolder,
      })
      .from(document)
      .where(and(eq(document.id, newParentId), isNull(document.deletedAt)))
      .limit(1)

    if (!newParent) return c.json({ error: "Destination folder not found" }, 404)
    if (newParent.customerId !== doc.customerId)
      return c.json({ error: "Cannot move across customers" }, 400)
    if (!newParent.isFolder)
      return c.json({ error: "Destination must be a folder" }, 400)

    // Prevent cycles: if doc is a folder, newParent can't be a descendant of doc
    if (doc.isFolder) {
      const cycleCheck = await db.execute(sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM "document" WHERE id = ${id}
          UNION ALL
          SELECT d.id FROM "document" d
          INNER JOIN descendants des ON d.parent_id = des.id
          WHERE d.deleted_at IS NULL AND d.is_folder = true
        )
        SELECT 1 FROM descendants WHERE id = ${newParentId} LIMIT 1
      `)
      if ((cycleCheck as unknown[]).length > 0) {
        return c.json({ error: "Cannot move a folder into its own descendant" }, 400)
      }
    }
  }

  await db.update(document).set({ parentId: newParentId }).where(eq(document.id, id))

  return c.json({ ok: true })
})

// ─────────────────────────────────────────────────────────
// DELETE /api/documents/:id — soft delete (cascades for folders)
// ─────────────────────────────────────────────────────────

documentsRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")

  const [doc] = await db
    .select({ customerId: document.customerId, deletedAt: document.deletedAt, isFolder: document.isFolder })
    .from(document)
    .where(eq(document.id, id))
    .limit(1)

  if (!doc || doc.deletedAt) return c.json({ error: "Document not found" }, 404)

  const access = await assertCustomerAccess(doc.customerId, user)
  if (!access.ok) return c.json({ error: access.error }, access.status!)

  if (doc.isFolder) {
    // Cascade soft delete to all descendants in one operation
    await db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM "document" WHERE id = ${id}
        UNION ALL
        SELECT d.id FROM "document" d
        INNER JOIN descendants des ON d.parent_id = des.id
        WHERE d.deleted_at IS NULL
      )
      UPDATE "document"
      SET deleted_at = NOW()
      WHERE id IN (SELECT id FROM descendants)
    `)
  } else {
    await db.update(document).set({ deletedAt: new Date() }).where(eq(document.id, id))
  }

  return c.json({ ok: true })
})
