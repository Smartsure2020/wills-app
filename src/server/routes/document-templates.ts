import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, asc, eq, isNull, sql } from "drizzle-orm"
import { db } from "../../db/index.js"
import { documentTemplate } from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import type { AppEnv, AppUser } from "../types.js"

const createSchema = z.object({
  parentId: z.number().int().min(0).default(0),
  folderName: z.string().min(1).max(500),
})

export const documentTemplatesRoute = new Hono<AppEnv>()
documentTemplatesRoute.use("*", auth)

// ─────────────────────────────────────────────────────────
// Admin gate — only admins can manage templates
// ─────────────────────────────────────────────────────────

function assertAdmin(user: AppUser): { ok: boolean; error?: string } {
  if (user.accountTypeId !== 1 && !user.manageAll) {
    return { ok: false, error: "Admin access required" }
  }
  return { ok: true }
}

// ─────────────────────────────────────────────────────────
// GET /api/document-templates — flat list, client builds the tree
// ─────────────────────────────────────────────────────────

documentTemplatesRoute.get("/", async (c) => {
  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  const items = await db
    .select({
      id: documentTemplate.id,
      parentId: documentTemplate.parentId,
      documentName: documentTemplate.documentName,
      isFolder: documentTemplate.isFolder,
      createdAt: documentTemplate.createdAt,
    })
    .from(documentTemplate)
    .where(isNull(documentTemplate.deletedAt))
    .orderBy(asc(documentTemplate.parentId), asc(documentTemplate.documentName))

  return c.json({ items })
})

// ─────────────────────────────────────────────────────────
// POST /api/document-templates — create folder
// ─────────────────────────────────────────────────────────

documentTemplatesRoute.post("/", zValidator("json", createSchema), async (c) => {
  const input = c.req.valid("json")
  const user = c.get("user")

  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  if (input.parentId > 0) {
    const [parent] = await db
      .select({ id: documentTemplate.id, isFolder: documentTemplate.isFolder })
      .from(documentTemplate)
      .where(
        and(eq(documentTemplate.id, input.parentId), isNull(documentTemplate.deletedAt))
      )
      .limit(1)

    if (!parent) return c.json({ error: "Parent template not found" }, 404)
    if (!parent.isFolder) return c.json({ error: "Parent must be a folder" }, 400)
  }

  const [created] = await db
    .insert(documentTemplate)
    .values({
      parentId: input.parentId,
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
      id: documentTemplate.id,
      parentId: documentTemplate.parentId,
      documentName: documentTemplate.documentName,
      isFolder: documentTemplate.isFolder,
    })

  return c.json(created, 201)
})

// ─────────────────────────────────────────────────────────
// DELETE /api/document-templates/:id — cascade soft delete
// ─────────────────────────────────────────────────────────

documentTemplatesRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400)

  const user = c.get("user")
  const admin = assertAdmin(user)
  if (!admin.ok) return c.json({ error: admin.error }, 403)

  const [tmpl] = await db
    .select({
      id: documentTemplate.id,
      deletedAt: documentTemplate.deletedAt,
      isFolder: documentTemplate.isFolder,
    })
    .from(documentTemplate)
    .where(eq(documentTemplate.id, id))
    .limit(1)

  if (!tmpl || tmpl.deletedAt) return c.json({ error: "Template not found" }, 404)

  if (tmpl.isFolder) {
    await db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM "document_template" WHERE id = ${id}
        UNION ALL
        SELECT d.id FROM "document_template" d
        INNER JOIN descendants des ON d.parent_id = des.id
        WHERE d.deleted_at IS NULL
      )
      UPDATE "document_template"
      SET deleted_at = NOW()
      WHERE id IN (SELECT id FROM descendants)
    `)
  } else {
    await db.update(documentTemplate)
      .set({ deletedAt: new Date() })
      .where(eq(documentTemplate.id, id))
  }

  return c.json({ ok: true })
})