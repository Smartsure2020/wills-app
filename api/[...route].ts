import { Hono } from "hono"
import { handle } from "hono/vercel"
import { cors } from "hono/cors"
import { sql } from "drizzle-orm"
import { db } from "../src/db/index.js"
import type { AppEnv } from "../src/server/types.js"
import { customersRoute } from "../src/server/routes/customers.js"
import { accountsRoute } from "../src/server/routes/accounts.js"
import { dataRoute } from "../src/server/routes/data.js"
import { documentsRoute } from "../src/server/routes/documents.js"
import { documentTemplatesRoute } from "../src/server/routes/document-templates.js"

export const config = { runtime: "nodejs" }

const app = new Hono<AppEnv>().basePath("/api")

// CORS — wide-open for now, tighten before launch
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Dev-User-Id"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  })
)

// ──── Public health endpoints (no auth) ────

app.get("/health", (c) =>
  c.json({
    ok: true,
    ts: Date.now(),
    app: "wills-app",
    phase: "2a",
  })
)

app.get("/db-health", async (c) => {
  try {
    const result = await db.execute(sql`SELECT current_database() as db, version() as version`)
    return c.json({ ok: true, result: result[0] })
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500)
  }
})

// ──── Authenticated routes (mounted in Phase 2b onwards) ────
app.route("/customers", customersRoute)
app.route("/accounts", accountsRoute)
app.route("/data", dataRoute)
app.route("/documents", documentsRoute)
app.route("/document-templates", documentTemplatesRoute)

// ──── Catch-all 404 ────

app.notFound((c) =>
  c.json({ error: "Not found", path: c.req.path }, 404)
)

app.onError((err, c) => {
  console.error("[api]", err)
  return c.json({ error: "Internal error", message: String(err) }, 500)
})

const handler = handle(app)

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
export const HEAD = handler
