import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { db } from '../src/db/index.js'
import { sql } from 'drizzle-orm'

export const config = { runtime: 'nodejs' }

const app = new Hono().basePath('/api')

app.get('/health', (c) =>
  c.json({
    ok: true,
    ts: Date.now(),
    runtime: 'edge',
    app: 'wills-app',
  })
)

app.get('/db-health', async (c) => {
  try {
    const result = await db.execute(sql`SELECT current_database() as db, version() as version`)
    return c.json({ ok: true, result: result[0] })
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500)
  }
})

export default handle(app)
