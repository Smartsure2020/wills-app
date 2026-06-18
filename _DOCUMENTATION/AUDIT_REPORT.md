# Wills App Audit Report

Date: 2026-06-18  
Scope audited: `C:/Users/renault/Documents/AI/WILLS-APP`, plus targeted reference checks against `Smartsure2020/will-server` and `Smartsure2020/willap-client`.  
Mode: discovery and written audit only. No application code was changed.

## Executive Summary

The rewrite has the main product skeleton in place: Supabase JWT auth, customer creation, broker/account invites, document storage with signed URLs, workflow checklist, mail outbox, and estate calculator UI. The architecture matches the chosen React + Hono + Supabase stack.

The app is not production-ready yet. The highest-risk launch blockers are:

1. TypeScript currently fails, so the app does not meet the launch gate.
2. `/api/db-health` is public and returns database/version details.
3. CORS is explicitly wide open in `api/[...route].ts`.
4. Authenticated non-admin users can call account list/detail endpoints and enumerate account data. Product decision: brokers must not see other brokers.
5. Checklist email queueing is not idempotent.
6. Lazy workflow item sync has a race window.
7. The old `OPEN_QUESTIONS.md` list should not be restored. It was a chat snapshot. Generate a fresh issue list from the cloned .NET source and the rewrite instead.

Verification performed:

- `npx.cmd tsc -b` failed.
- `npm.cmd run lint` failed.
- Direct RLS metadata query succeeded: all 20 public tables reported `RLS_ON` with at least one policy.
- Live cron/db-health HTTP checks could not complete through the default Windows Schannel TLS path. GitHub reference clones worked after switching Git to OpenSSL.

## 1. Feature Parity Check

Important context: `_DOCUMENTATION/WILLS_TOOL.md`, `_DOCUMENTATION/SHARED_PATTERNS.md`, `_DOCUMENTATION/OPEN_QUESTIONS.md`, and `_DOCUMENTATION/BROKER_TOOL.md` were not present in this checkout. The old 18+8 list is not sacred and should not be restored. The better path is a fresh issue-generation pass against the now-cloned .NET source and the rewrite.

| Area | Status | Notes |
|---|---:|---|
| Customer lifecycle | Different by design | Customer creation is transactional and creates customer, relations, flow control, checklist rows, and cloned document folders. There is no visible edit customer flow or delete customer route. |
| Document management | Equivalent or better | Private Supabase Storage, signed upload/download URLs, folders, move, delete, and folder template cloning are implemented. |
| Document templates | Equivalent to confirmed original clone path | Original `AddCustomerCommand` cloned every `DocumentTemplate` as `Document` with `IsFolder = true`. Decision: folder-only templates are acceptable for launch. No change needed. |
| Workflow stages | Partial, deferred by design | `flow_type` and `flow_control_item` support multiple flow types, but new customers only get `flowTypeId = 1`. Decision: leave `flow` lifecycle timestamp columns as-is for launch. Do not wire or drop them unless reporting needs stage duration metrics. |
| Email triggers | Improved by design | Keep rewrite emails for `DRFT`, `SIGN`, and `FILE`. Original source mostly confirmed account-created mails plus a FlowTypeId 2 update-request mail. Verify whether Supabase Auth invite email adequately replaces the original broker account-created email. Put FlowTypeId 2 update-request on post-launch backlog. |
| Calculator math | Equivalent or better | Original Blazor formulas match the rewrite: executor `0.035 * 1.15 * estate`, conveyance `0.025 * property * 1.15`, admin `(0.02 * estate) + 0.01 * termsOfTrust * estate`. Decision: keep Property / Asset / Liability. Original Vehicle and Investment categories were only non-property asset sub-buckets. |
| Account management | Functional but overexposed | Supabase invite flow exists. However account list/detail endpoints are not admin-gated. Brokers should not see other brokers. |
| Invite flow | Mostly present | Account creation uses `supabaseAdmin.auth.admin.inviteUserByEmail`. Setup/reset/forgot/settings password routes exist, but current TanStack route typing is broken. |
| Audit trail | Missing | There is no general audit/event log for account changes, documents, workflow completion, mail retry, or document downloads. |
| Admin reports/exports | Not present | Dashboard, accounts, templates, workflow item admin, and mail outbox exist. I did not find reports/exports in the rewrite. |

## 2. Fresh Issue Regeneration

Do not restore `_DOCUMENTATION/OPEN_QUESTIONS.md`. It was drafted in chat and never persisted. The correct next step is to regenerate a fresh issues list from:

- `will-server`
- `willap-client`
- current rewrite code

This fresh pass should replace the old 18 bugs / 8 security issues snapshot.

## 3. Code Quality Issues

### Critical

**C1. TypeScript build fails.**

Evidence from `npx.cmd tsc -b`:

- `src/routes/auth/forgot-password.tsx(20,38)`: route path not in generated route tree.
- `src/routes/auth/reset-password.tsx(21,38)` and `(99,43)`: route path/link not in generated route tree.
- `src/routes/settings/index.tsx(23,38)`: uses `"/settings/"`, while route tree likely expects `"/settings"`.
- `src/routes/login.tsx(2,10)` and `(20,10)`: duplicate `createFileRoute` imports.
- `src/routes/auth/setup-password.tsx(1,20)`: unused `useEffect`.
- `src/server/middleware/auth.ts(1,15)`: unused `Context`.
- `src/server/routes/calculations.ts(4,10)`: unused `and`.

Impact: production build is not clean and auth/password routes may not navigate as intended.

**C2. Fresh .NET issue regeneration is needed.**

The old 18+8 list is not a source of truth. Targeted checks resolved several product questions, but a fresh current-state issue list should be generated before selecting Phase C work.

### High

**H1. Public `/api/db-health` leaks database metadata.**

`api/[...route].ts` exposes `/api/db-health` without auth and returns `current_database()` and `version()`. Remove before launch, or require admin auth and return only a minimal health response.

**H2. CORS is wide open.**

`api/[...route].ts` uses `origin: "*"`. Lock this to the production app origin and local dev origin before launch.

**H3. Account list/detail endpoints are authenticated but not admin-gated.**

`GET /api/accounts` and `GET /api/accounts/:id` do not call `canManage`. Any active account can enumerate account data by calling the API directly. This conflicts with the confirmed requirement that brokers should not see other brokers.

**H4. Email trigger behavior needs cleanup, but should not regress.**

Keep the new customer-facing `DRFT`, `SIGN`, and `FILE` emails. Verify Supabase's built-in invite email sufficiently covers broker onboarding. Put FlowTypeId 2 “request update from customer” on the post-launch backlog unless v1 scope changes.

**H5. Checklist email queueing is not idempotent.**

`flow-checklist.ts` queues mail whenever `input.checked === true`, even if the item was already checked. Double-clicks, retries, or toggles can create duplicate mail rows.

**H6. Lazy flow item sync has a race window.**

`syncFlowItems()` reads existing item IDs, computes missing, then inserts. Concurrent `GET /flow-checklist` calls can insert duplicates unless a unique constraint exists. No unique constraint is defined on `(flow_control_id, flow_control_item_id)`.

**H7. Customer reassignment updates rows without confirming the customer exists and is active.**

`POST /api/customers/:id/assign-broker` updates `customer` and `flow_control` by id, but does not first check `customer.deletedAt` or whether the update matched a row.

**H8. Calculator business logic is client-only.**

The formulas match the original and the 3-category model is approved. Remaining issue: formulas live only in React while the server stores line items. This creates drift risk for future reporting/export.

### Medium

**M1. `as any` exists in server document queries.**

`src/server/routes/documents.ts` casts recursive CTE output and cycle-check results with `any`.

**M2. `name: any` exists in the customer form helper.**

`src/routes/customers/new.tsx` uses `name: any` in `DropdownField`.

**M3. Lint currently fails.**

`npm.cmd run lint` reports 56 errors and 2 warnings. Some are real issues, while many are Fast Refresh rules not tuned for TanStack file routes and shadcn files.

**M4. Server error responses sometimes expose raw messages.**

The global API handler and some route catches return raw `String(err)` messages.

**M5. Stale generated `.js` files exist under `src/`.**

The repo ignores `src/**/*.js`, but compiled JS files exist beside TS files locally. They are untracked but can confuse inspection and tooling.

**M6. Missing indexes on some foreign keys.**

Potential index candidates: `flow_item.flow_control_item_id`, `flow_item_document.flow_item_id`, `flow_item_document.document_id`, `calculation_item.calculation_item_type_id`, `customer_relation.relation_id`, `mail.customer_id`, and `document_template.parent_id`.

**M7. Flow lifecycle timestamp columns are deferred.**

Original `UpdateFlowCommand` mapped the 9-stage `FlowEnum` to the timestamp columns, but its controller route was commented out. Decision: leave columns as-is for launch, do not wire, do not drop, and do not report from them until wired.

### Low

**L1. Health endpoint still says `phase: "2a"`.**

`/api/health` reports stale phase metadata.

**L2. No automated test suite.**

Out of scope to add now, but launch risk remains.

## 4. Security Findings

This is not a substitute for a professional security audit. It is a code-assisted first pass.

| Severity | Finding | Recommendation |
|---|---|---|
| High | Public database metadata endpoint | Remove `/api/db-health` before launch or require admin auth. |
| High | Wide-open CORS | Lock origins to production and local dev. |
| High | Account enumeration | Gate account list/detail to admin/ManageAll or return only self for non-managers. |
| Medium | Raw error detail leakage | Return generic client errors, log detailed errors server-side. |
| Medium | Missing audit trail | Add before serious production use for account, document, workflow, mail, and auth-sensitive events. |
| Medium | Email template HTML interpolates DB fields without escaping | Escape template variables or render through a safe template helper. |
| Low | Cron endpoint not live-verified from shell | Re-test from Vercel logs or a clean PowerShell environment. Code check requires `Authorization: Bearer ${CRON_SECRET}`. |
| Low | RLS policy semantics not reviewed | Metadata shows RLS on, but actual policy SQL still deserves review. |

RLS metadata result: all public tables returned `RLS_ON` with at least one policy.

## 5. UX Gaps

- Loading states exist on many list/detail pages, but several component-level states are text-only rather than skeletons.
- Empty states exist, but most are plain text.
- Error states are inline/local. Sonner is not wired globally.
- Customer form validation is decent, but phone and SA ID validation can be stricter later.
- Destructive confirmation is inconsistent: templates/workflow use dialogs, documents/calculator use native `confirm()`.
- Mobile layout is weak: fixed sidebar, desktop table layouts, and desktop spacing.

## 6. UI Polish Opportunities

Small:

- Apply HRS/Smartsure teal (`#1e6363`) as primary accent.
- Replace text-only full-page loading with branded skeleton/loading treatment.
- Replace native confirms with shadcn dialogs.
- Add Sonner toast feedback across mutations.
- Improve favicon/page title/brand signal.

Medium:

- Redesign customer profile hierarchy around customer status, broker/contact actions, workflow, and documents.
- Add restrained status colors for workflow states.
- Make dashboard more broker-useful.
- Make tables responsive for mobile.

Large:

- Add dark-mode toggle only after verifying all surfaces.
- Add a focused app-frame polish pass: teal sidebar accent, clearer active nav, tighter content widths, better card density.

## 7. Operational Readiness Flags

- Build fails today.
- Lint fails today.
- Env var documentation is incomplete.
- `vite.config.ts` proxies local `/api` to deployed Vercel, which can confuse local testing.
- No monitoring/error tracking beyond `console.error`.
- No migration tool yet, by design, so schema drift needs a manual checklist.
- No backup/restore/runbook notes.
- No seed verification for lookup tables, flow types, or template tree.
- `package.json` build and `vercel.json` build are not equivalent.

## Prioritized Action List

### Critical, must fix before launch

1. Fix TypeScript route/build failures and run `npx.cmd tsc -b` clean.
2. Remove or protect public `/api/db-health`.
3. Tighten production CORS.
4. Gate account list/detail so brokers cannot see other brokers.
5. Generate a fresh cross-codebase issues list from `will-server`, `willap-client`, and the rewrite.

### Recommended, should fix

1. Verify Supabase Auth invite email adequately covers original broker account-created notification.
2. Put FlowTypeId 2 “request update from customer” on the post-launch backlog unless v1 scope changes.
3. Make checklist email queueing idempotent.
4. Add a uniqueness guard for flow item lazy sync.
5. Replace raw error detail in production API responses.
6. Clean up lint so it is a useful gate.
7. Document required environment variables and launch checks.

### Nice-to-have polish

1. Add Sonner toast feedback across mutations.
2. Replace native confirms with shadcn dialogs.
3. Apply HRS teal brand accent and improve dashboard/customer-profile hierarchy.
4. Add mobile navigation and responsive table behavior.
5. Add a dark-mode toggle only after visual verification.

## Open Questions

1. Should the fresh issue-generation pass be appended here or created as `_DOCUMENTATION/FRESH_ISSUES.md`?
2. Is Supabase's built-in invite email enough for broker onboarding, or should a separate welcome email be added later?
3. Should FlowTypeId 2 update-request be explicitly listed in a separate backlog document?
