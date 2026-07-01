# Inherited Code Findings

Reference repos reviewed:

- `Smartsure2020/will-server`
- `Smartsure2020/willap-client`

This document captures issues found in the inherited .NET / Blazor implementation and whether the React + Hono + Supabase rewrite addresses them.

## Security Findings

| Finding | Original evidence | Rewrite status |
|---|---|---|
| Default shared account password was hardcoded and emailed to users. | `willap-client/WillApp.Client/Core/Services/IdentityService.cs` creates Keycloak users with `Password = "Password@123"`. `will-server/WillApp.Server/MailTemplates/AccountCreated.htm` and `BrokerAccountCreated.htm` email `Password: Password@123`. | Addressed in rewrite. Account creation uses Supabase invite emails in `src/server/routes/accounts.ts`, and users set their own password through `src/routes/auth/setup-password.tsx`. |
| CORS policy allowed every origin while credentials were enabled. | `will-server/WillApp.Server/Program.cs` combines explicit origins with `SetIsOriginAllowed(origin => true)` and `AllowCredentials()`. | Addressed in rewrite. `api/[...route].ts` allows only `APP_URL` in production, local Vite in dev, and drops credentials because auth uses the `Authorization` header. |
| Database connection configuration was hardcoded in code. | `will-server/WillApp.Server/Shared/Providers/ConnectionStringProvider.cs` contains `_local`, `_prod`, and always assigns `Connection = _local`. | Addressed in rewrite. `src/db/index.ts` reads `DATABASE_URL` from the environment. Required variables are documented in `_DOCUMENTATION/ENV_VARS.md`. |
| Broker/account enumeration was available to any authenticated user. | `will-server/WillApp.Server/Controllers/Accounts/Queries/GetBrokers/GetBrokersController.cs` has `[Authorize]` but no admin/manage permission gate. | Addressed in rewrite. `src/server/routes/accounts.ts` gates account list/detail while keeping `/api/accounts/me` available. |
| Missing-token failures were swallowed on the client. | `willap-client/WillApp.Client/Core/Middleware/OIDCTokenHandler.cs` catches token acquisition exceptions and still sends the request. | Addressed in rewrite. `src/lib/api.ts` attaches a Supabase bearer token when present, and `src/server/middleware/auth.ts` rejects missing/invalid tokens. |
| Raw provider/database errors could leak through operational routes. | Original code frequently returned generic strings, but some command flows swallowed exceptions entirely; the rewrite audit found analogous raw error surfaces before fixes. | Addressed in rewrite. `api/[...route].ts`, `src/server/routes/accounts.ts`, `customers.ts`, `documents.ts`, and `cron.ts` now log internally and return generic 500 responses. |
| Document password fields were stored and displayed as ordinary text. | `willap-client/WillApp.Client/Pages/CustomerProfilePage.razor` displays document password; `will-server/WillApp.Server/DataAccess/Entities/Document.cs` stores `Password`. | Mostly not applicable to current rewrite UX. The rewrite keeps a legacy `password` column in `src/db/schema.ts` for schema parity, but current document upload/download UI does not expose document password entry/display. Treat as a carried-over risk if password-protected document support is reintroduced. |

## Functional Bugs

| Finding | Original evidence | Rewrite status |
|---|---|---|
| Mail sending was non-idempotent and lossy. | `will-server/WillApp.Server/Routines/SendMailsRoutine.cs` loads every mail row, sends, removes rows, catches all exceptions, and does not track attempts or sent timestamps. | Addressed in rewrite. `src/server/routes/cron.ts` processes pending mail with attempts and `sentAt`; mail rows remain auditable in `src/db/schema.ts`. |
| Customer broker reassignment did not check soft deletion and returned a generic bad request for missing customers. | `will-server/WillApp.Server/Controllers/Customers/Commands/Assign/AssignController.cs` selects by `Id` only and updates related flows. | Addressed in rewrite. `src/server/routes/customers.ts` verifies `deletedAt IS NULL`, returns 404 for missing customers, validates the destination broker, and updates customer/flow controls in one transaction. |
| Flow item completion could not safely be retried. | `will-server/WillApp.Server/Controllers/Flows/Commands/UpdateFlowStage/UpdateFlowStageController.cs` returns `Already checked` after a checked date exists. | Addressed in rewrite. `src/server/routes/flow-checklist.ts` makes repeated checked=true requests idempotent and only queues email on a false-to-true transition. |
| Flow item lazy creation could race into duplicate rows. | Original flow creation inserted generated items without a database uniqueness guard; rewrite inherited a similar lazy-sync risk during checklist reads. | Addressed in rewrite code and pending SQL. `src/server/routes/flow-checklist.ts` uses `ON CONFLICT DO NOTHING`; `_DOCUMENTATION/PRELAUNCH_SUPABASE_INDEXES.sql` adds the required unique index. |
| Moving documents did not validate ownership, destination folder, or cycles. | `will-server/WillApp.Server/Controllers/Documents/Commands/MoveDocument/MoveDocumentController.cs` sets `ParentId` on every requested document without customer/folder/cycle checks. | Addressed in rewrite. `src/server/routes/documents.ts` validates document existence, customer access, destination folder, same-customer move, and prevents folder cycles. |
| Deleting a missing document returned a server error. | `will-server/WillApp.Server/Controllers/Documents/Commands/Delete/DeleteDocumentController.cs` returns `Problem(..., 500)` when the document is missing. | Addressed in rewrite. `src/server/routes/documents.ts` returns 404 for missing documents and soft-deletes documents/folder descendants. |
| Account creation was split across Keycloak and internal DB without robust rollback. | `willap-client/WillApp.Client/Core/Services/IdentityService.cs` creates Keycloak identity, then calls the internal account API; exceptions return null. | Addressed in rewrite. `src/server/routes/accounts.ts` sends the Supabase invite and rolls back the auth user if the DB insert fails. |
| Update-request flow existed but was a separate workflow path. | `will-server/WillApp.Server/Controllers/Flows/Commands/CreateFlow/CreateFlowController.cs` sends the FlowTypeId 2 update-request email. | Not applicable to launch scope. Product decision: FlowTypeId 2 customer update-request is deferred post-launch. |
| Flow lifecycle timestamp wiring was not reachable in production. | `will-server/WillApp.Server/DataAccess/Commands/UpdateFlowCommand.cs` maps flow stages to timestamp columns, but the relevant route was not active in the production behavior reviewed. | Not applicable to launch scope. Product decision: keep columns, do not wire/drop until reporting needs them. |
| Calculator category model used four buckets though only property/non-property/liability matter for the formulas. | `willap-client/WillApp.Client/Components/Calculator.razor.cs` calculates property conveyance separately and treats vehicle/investment as normal assets. | Addressed by design. Rewrite keeps Property / Asset / Liability in `src/components/customers/calculator-card.tsx` and `src/server/routes/calculations.ts`. |

## Carried-Over Risks

- The rewrite still carries legacy schema fields such as `document.password` and flow lifecycle timestamp columns. They are not current launch features, but future work should avoid exposing raw document passwords or half-populated reporting fields.
- Supabase RLS and server-side authorization must remain aligned. The rewrite has Hono authorization checks, but future direct Supabase Data API use must not bypass the same customer/broker access model.
- The local Vite proxy points at the deployed API. Local UI testing can mutate remote state unless the proxy is changed for local API testing.
- The flow item uniqueness fix depends on running `_DOCUMENTATION/PRELAUNCH_SUPABASE_INDEXES.sql` before deploy.
- The rewrite intentionally defers audit trail/event log support. That is not inherited directly from the old code, but it remains a launch-adjacent operational gap for a wills workflow.
