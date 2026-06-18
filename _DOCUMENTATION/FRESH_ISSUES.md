# Fresh Issues Register

Regenerated from the current React/Hono rewrite and the cloned .NET reference repos after the product decisions were locked.

## Launch blockers addressed in this pass

1. Public database metadata endpoint existed at `/api/db-health`.
   - Rewrite action: removed the endpoint and kept `/api/health` as a plain liveness check.

2. CORS allowed every origin while also allowing credentials.
   - Rewrite action: restricted API CORS to `CORS_ORIGINS` or `APP_URL`, with localhost only outside production.

3. Broker account enumeration was possible through `/api/accounts`.
   - Rewrite action: account listing and cross-account reads are now admin-only. `/api/accounts/me` and self-update still work.

4. Regular brokers could submit a crafted customer-create request assigning the customer to another broker.
   - Rewrite action: non-admin customer creation can only assign to the authenticated broker.

5. Production build was failing.
   - Rewrite action: refreshed the typed route tree for forgot/reset/settings pages, removed duplicate/unused imports, and restored `npm run build`.

6. Lint was not a useful gate.
   - Rewrite action: scoped the Fast Refresh rule away from TanStack route files and shadcn-style UI helpers, then fixed the remaining real lint errors.

## Product decisions closed

1. Calculator categories stay as Property / Asset / Liability.
   - Original categories were Property / Vehicle / Investment / Credit, but the fee math treats Vehicle and Investment as ordinary assets. No launch change.

2. Customer-facing DRFT / SIGN / FILE emails stay.
   - Original only clearly sent the FlowTypeId 2 update-request customer email. The rewrite's progress emails are an intentional improvement.

3. Document templates stay folder-only.
   - Original `AddCustomerCommand` cloned `DocumentTemplate` rows into folder documents only. Rewrite matches.

4. Flow lifecycle timestamp columns stay deferred.
   - Original `UpdateFlowCommand` had timestamp wiring, but the controller route was commented out. Do not wire/drop for launch.

5. FlowTypeId 2 update-request stays post-launch.
   - Original `CreateFlowController` sent the update-request email when `FlowTypeId == 2`; the rewrite does not expose a request-update flow yet.

## Remaining recommended issues

1. Confirm Supabase invite email content.
   - Original account creation sent bespoke account/broker-created emails. Supabase invite likely covers the launch need, but copy/branding should be reviewed.

2. Make workflow item completion email enqueueing idempotent.
   - Original refused to re-check an already checked item. The rewrite should avoid duplicate outbox rows if a completion action is retried.

3. Add a database uniqueness guard for flow item/document attachment pairs.
   - The original used a composite key for `DocumentId + FlowItemId`. The rewrite has a code-level duplicate check, but a concurrent double-click can still race.

4. Add indexes for common foreign-key filters before significant data volume.
   - Prioritize customer assignment, flow checklist, documents by customer/parent, calculation items by customer, and mail outbox send status.

5. Replace server error payloads that expose raw exception text.
   - Some routes still include `message: String(err)` in 500 responses. Log internally and return a generic user-safe message.

6. Add operational docs for production environment variables.
   - Minimum: Supabase URL/keys/JWT secret, Resend key/from address, cron secret, app URL/CORS origins, storage bucket name.

7. Add a real monitoring/error-reporting target.
   - Current launch observability is mostly console output and Vercel logs.

8. Post-launch: implement the FlowTypeId 2 request-update action if HRS wants customer data-refresh workflows.
