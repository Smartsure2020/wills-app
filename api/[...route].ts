import { Hono } from "hono"
import { handle } from "hono/vercel"
import { cors } from "hono/cors"
import type { AppEnv } from "../src/server/types.js"
import { customersRoute } from "../src/server/routes/customers.js"
import { accountsRoute } from "../src/server/routes/accounts.js"
import { dataRoute } from "../src/server/routes/data.js"
import { documentsRoute } from "../src/server/routes/documents.js"
import { documentTemplatesRoute } from "../src/server/routes/document-templates.js"
import { flowControlItemsRoute } from "../src/server/routes/flow-control-items.js"
import { flowChecklistRoute } from "../src/server/routes/flow-checklist.js"
import { cronRoute } from "../src/server/routes/cron.js"
import { mailOutboxRoute } from "../src/server/routes/mail-outbox.js"
import { calculationsRoute } from "../src/server/routes/calculations.js"

export const config = { runtime: "nodejs" }

const app = new Hono<AppEnv>().basePath("/api")

const configuredOrigins = process.env.APP_URL ? [process.env.APP_URL.trim()] : []

const devOrigins =
  process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:3000", "http://localhost:5173"]

const allowedOrigins = new Set([...configuredOrigins, ...devOrigins])

// CORS is restricted to configured app origins in production.
app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (allowedOrigins.size === 0) return null
      return allowedOrigins.has(origin) ? origin : null
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: false,
  })
)

// ──── Public health endpoints (no auth) ────

app.get("/health", (c) =>
  c.json({
    ok: true,
    ts: Date.now(),
    app: "wills-app",
    phase: "production",
  })
)

// ──── Authenticated routes (mounted in Phase 2b onwards) ────
app.route("/customers", customersRoute)
app.route("/accounts", accountsRoute)
app.route("/data", dataRoute)
app.route("/documents", documentsRoute)
app.route("/document-templates", documentTemplatesRoute)
app.route("/flow-control-items", flowControlItemsRoute)
app.route("/flow-checklist", flowChecklistRoute)
app.route("/cron", cronRoute)
app.route("/mail-outbox", mailOutboxRoute)
app.route("/calculations", calculationsRoute)

// ──── Catch-all 404 ────

app.notFound((c) =>
  c.json({ error: "Not found", path: c.req.path }, 404)
)

app.onError((err, c) => {
  console.error("[api]", err)
  return c.json({ error: "Internal error" }, 500)
})

const handler = handle(app)

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
export const HEAD = handler
