# Environment Variables

Do not commit real values. Store local values in `.env.local`, and configure preview/production values in Vercel.

| Variable | Required in | Used by | What it does | Source |
|---|---|---|---|---|
| `DATABASE_URL` | Dev, Preview, Production | Server / Drizzle | Postgres connection string used by `src/db/index.ts`. | Supabase project database connection string. Use the pooler URL for Vercel/serverless. |
| `SUPABASE_URL` | Dev, Preview, Production | Server | Supabase project URL for privileged server-side Supabase client. | Supabase dashboard: Project Settings -> API -> Project URL. |
| `SUPABASE_ANON_KEY` | Dev, Preview, Production | Server tooling/compatibility | Public anon key. Keep available for server-side code that needs anon context, though the current privileged server client uses the service role key. | Supabase dashboard: Project Settings -> API -> anon/public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev, Preview, Production | Server only | Privileged Supabase key used for admin auth invites and private Storage signed URLs. Never expose to the browser. | Supabase dashboard: Project Settings -> API -> service_role key. |
| `SUPABASE_JWT_SECRET` | Dev, Preview, Production | Server auth middleware | HMAC secret used by `jose` to verify Supabase Auth JWTs server-side. | Supabase dashboard: Project Settings -> API -> JWT secret. |
| `VITE_SUPABASE_URL` | Dev, Preview, Production | Browser | Supabase URL bundled into the Vite app for client-side auth. | Same value as `SUPABASE_URL`. |
| `VITE_SUPABASE_ANON_KEY` | Dev, Preview, Production | Browser | Public key bundled into the Vite app for client-side Supabase Auth. This must be the anon/public key, never the service role key. | Supabase dashboard: Project Settings -> API -> anon/public key. |
| `RESEND_API_KEY` | Dev if sending mail, Preview, Production | Server mail outbox | API key used by the cron mail sender. Without it, mail sending cannot start. | Resend dashboard: API Keys. |
| `RESEND_FROM_EMAIL` | Dev if sending mail, Preview, Production | Server mail outbox | Sender address for transactional email. Must be a verified Resend sender/domain for production. | Resend dashboard: Domains/Sender identity. |
| `CRON_SECRET` | Preview if cron tested, Production | `/api/cron/send-mail` | Shared secret expected in `Authorization: Bearer <CRON_SECRET>` for the mail cron endpoint. | Generate a long random secret and store it in Vercel. |
| `APP_URL` | Dev, Preview, Production | API CORS and auth redirects | Canonical app origin. Used for CORS allowlisting and Supabase invite redirect URLs. | Deployment URL, e.g. Vercel production domain. For local-only testing use `http://localhost:5173`. |

## Notes

- Vite only exposes browser variables prefixed with `VITE_`.
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, and `CRON_SECRET` are server-only secrets.
- The local Vite proxy currently forwards `/api` to the deployed Vercel API, so local UI testing can affect remote data.
- Rotate any value that has been shared outside the intended environment.
