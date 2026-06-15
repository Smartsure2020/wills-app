import { Hono } from "hono"
import { asc } from "drizzle-orm"
import { db } from "../../db/index.js"
import {
  accountType,
  calculationItemType,
  country,
  flowType,
  maritalStatus,
  relationType,
  wishes,
} from "../../db/schema.js"
import { auth } from "../middleware/auth.js"
import type { AppEnv } from "../types.js"

export const dataRoute = new Hono<AppEnv>()

dataRoute.use("*", auth)

// ─────────────────────────────────────────────────────────
// GET /api/data/dropdowns — all lookup tables in one call
// 
// Returns every lookup the frontend needs for forms and filters.
// Total payload is small (~few KB even with 250 countries),
// so a single fetch on app load is cleaner than N separate ones.
//
// CDN-cached for an hour at the edge, with 5-minute stale-while-revalidate
// in the browser. Update lookup data → users see new values within 5 min.
// ─────────────────────────────────────────────────────────

dataRoute.get("/dropdowns", async (c) => {
  const [
    accountTypes,
    calculationItemTypes,
    countries,
    flowTypes,
    maritalStatuses,
    relationTypes,
    wishesData,
  ] = await Promise.all([
    db.select().from(accountType).orderBy(asc(accountType.id)),
    db.select().from(calculationItemType).orderBy(asc(calculationItemType.id)),
    db.select().from(country).orderBy(asc(country.description)),
    db.select().from(flowType).orderBy(asc(flowType.id)),
    db.select().from(maritalStatus).orderBy(asc(maritalStatus.id)),
    db.select().from(relationType).orderBy(asc(relationType.id)),
    db.select().from(wishes).orderBy(asc(wishes.id)),
  ])

  c.header("Cache-Control", "public, max-age=300, s-maxage=3600")

  return c.json({
    accountTypes,
    calculationItemTypes,
    countries,
    flowTypes,
    maritalStatuses,
    relationTypes,
    wishes: wishesData,
  })
})