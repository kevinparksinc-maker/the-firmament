# Deploying The Firmament (Railway)

The Firmament is a single Node process (Express + tRPC serving the built React
client) backed by **MySQL**. Railway is used because it offers managed MySQL
(Render is Postgres-only, which this app's `mysql2`/Drizzle layer can't use).

## Build & run contract

- Build: `pnpm build` → client to `dist/public`, server bundle to `dist/index.js`
- Start: `pnpm start` → `NODE_ENV=production node dist/index.js`
- The server binds `process.env.PORT` (Railway injects this). No code change needed.

These are pinned in `railway.json`.

## One-time setup

1. **Create the project** — In the Railway dashboard: *New Project → Deploy from
   GitHub repo* → select `kevinparksinc-maker/the-firmament`, branch `master`.
   Railway reads `railway.json` and uses Nixpacks with the commands above.
2. **Add MySQL** — In the project: *New → Database → MySQL*. Railway provisions it
   and exposes connection vars.
3. **Set service variables** — On the app service, *Variables* tab. Reference the
   MySQL plugin var for the URL:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{ MySQL.MYSQL_URL }}` (Railway reference) |
   | `ANTHROPIC_API_KEY` | your Anthropic key |
   | `JWT_SECRET` | a long random string (session/cookie signing) |
   | `VITE_APP_ID` | OAuth app id |
   | `OAUTH_SERVER_URL` | OAuth server base URL |
   | `OWNER_OPEN_ID` | owner's OAuth openId |
   | `NODE_ENV` | `production` (also set by the start script) |

   `VITE_*` vars are baked in at build time, so they must be set **before** the
   first build.
4. **Run migrations** — After the DB is up, from the service shell (or a one-off):
   `pnpm db:push` (drizzle-kit generate + migrate). Do this once before first real use.
5. **Generate a domain** — *Settings → Networking → Generate Domain*.

## Redeploys

Push to `master`; Railway auto-deploys. Migrations only re-run when you invoke
`pnpm db:push` (not part of the start command, to avoid destructive auto-migrates).
