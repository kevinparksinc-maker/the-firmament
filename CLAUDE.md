# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**The Firmament** (package name `arcana-state`) is a sidereal-astrology reading web app. It computes topocentric planetary positions, detects patterns/aspects, and synthesizes long-form readings via the Anthropic Claude API. The domain worldview is fixed throughout the code: **sidereal** (real observed sky, not tropical), **traditional Vedic planetary rulers**, fixed stars / nakshatras / decans / Sabian symbols / Kabbalah layers, plus a horary (question-based) flow. This worldview is encoded verbatim in `COSMOLOGY_PREAMBLE` in `server/routers.ts` and must be respected in any prompt or copy changes (no heliocentric language, no precession, all outer planets valid).

## Commands

Package manager is **pnpm** (see `packageManager` in package.json). Both a `pnpm-lock.yaml` and a stale `package-lock.json` exist — use pnpm.

- `pnpm dev` — dev server. Runs `tsx watch server/_core/index.ts`; Vite runs in `middlewareMode` **inside** the same Express process (single server, default port 3000, auto-increments if busy). Do **not** run `vite` standalone — the `server.port: 5173` block in `vite.config.ts` is unused by the scripts.
- `pnpm build` — `vite build` (client → `dist/public`) + `esbuild` bundle of `server/_core/index.ts` → `dist/index.js`.
- `pnpm start` — production: `node dist/index.js`.
- `pnpm check` — `tsc --noEmit` typecheck (the only "lint" gate that matters; eslint config exists but has no script).
- `pnpm test` — `vitest run`. Single file: `pnpm vitest run server/aspectMotion.test.ts`. Watch: `pnpm vitest`. Tests are `*.test.ts`/`*.spec.ts` under `server/` and `client/`, node environment.
- `pnpm db:push` — `drizzle-kit generate && drizzle-kit migrate` (MySQL).

Required env (`.env`, loaded via `dotenv/config`): `ANTHROPIC_API_KEY`, `DATABASE_URL` (MySQL), `JWT_SECRET`. OAuth/app vars: `VITE_APP_ID`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`.

## Architecture

**Stack:** React 19 + Vite + wouter + TanStack Query on the client; Express + tRPC v11 + Drizzle/MySQL on the server; Anthropic Claude for readings. End-to-end type safety flows through tRPC: the client imports `AppRouter` as a *type* from `server/routers.ts`.

### `_core/` is boilerplate; domain code lives outside it
`server/_core/`, `client/src/_core/`, and `shared/_core/` hold the reusable framework layer — auth (`sdk.ts`, JWT via `jose`, `authRouter.ts`), tRPC setup (`trpc.ts`: `publicProcedure` / `protectedProcedure` / `adminProcedure`), context, OAuth, storage proxy, the LLM wrapper, and Vite integration. Treat `_core/` as vendored infrastructure — the astrology product lives in the top-level `server/*.ts` and `client/src/lib/*.ts` files.

### tRPC surface
`server/routers.ts` composes `appRouter` from sub-routers: `auth`, `system`, `ocr`, `ai`, `charts`, `ephemeris`, `synthesize`, `natalPlacement`, `horary`. Most procedures are `publicProcedure` (readings don't require login); `charts.save/load/delete` are `protectedProcedure`. The `synthesize` router has its own file (`server/SynthesizeRouter.ts`, mirrored in `server/_core/`).

> Known bug to be aware of: `appRouter` currently declares the `auth` key twice — `auth: authRouter` then `auth: router({ me, logout })`. The second wins, so `authRouter`'s procedures are shadowed. Reconcile before relying on either.

### The reading pipeline (server, layered)
Positions → patterns → knowledge → synthesis → Claude:
1. **`ephemeris.ts`** — topocentric positions via `astronomy-engine` (full parallax, alt/az for the dome renderer). `astroEngine.ts` holds the sign/planet/house semantic dictionaries (`HOUSE_TOPICS`, `PLANET_CORE`, glyphs, Vedic rulers) and `runAstroReading`.
2. **`patternEngine.ts`** — the "truth layer": raw aspects/patterns/tensions with no interpretation, applying/separating motion from `aspectMotion.ts`.
3. **Knowledge layers** — `firmamentKnowledge.ts` (dignities, fixed stars, Kabbalah — isomorphic, imported by both client and server), `fixedStars.ts`, `nakshatra.ts`, `decan.ts`, `sabianSymbols.ts`, `wisdomLayer.ts` (dignity vocabulary), `summarizePillarRich.ts` (pillar scoring).
4. **Synthesis** — `SynthesizeRouter.ts` and `horary.ts` build a plain-text semantic block from the engine dictionaries and feed it to Claude so the model reasons from the app's own vocabulary rather than inventing its own. `readingEngine4.ts` is the nakshatra-first synthesis engine.

### Two Anthropic call paths (intentional, different)
- `server/_core/llm.ts` — `invokeLLM()`, a hand-rolled OpenAI-style→Anthropic adapter over `fetch`. **Hardcodes `model: "claude-sonnet-4-6"`.** Used by `horary.ts`.
- Direct `@anthropic-ai/sdk` `Anthropic` client — used in `routers.ts` and `SynthesizeRouter.ts`.

Both read the key from `ANTHROPIC_API_KEY` (aliased confusingly as `ENV.forgeApiKey`/`forgeApiUrl` in `server/_core/env.ts`).

### Client/server engine duplication — keep in sync
Several engines exist as **two parallel copies**: `server/*.ts` and `client/src/lib/*.ts` (`astroEngine`, `patternEngine`, `horary`, `fixedStars`, `sabianSymbols`, `nakshatra`, `decan`, `readingEngine4`, `summarizePillarRich`, `kstar-planets`, `planetInHouse`). `firmamentKnowledge.ts` documents this explicitly: dignity/fixed-star/Kabbalah data is duplicated from `client/src/components/FirmamentEngine.tsx` and must be mirrored by hand until refactored. **When you change domain logic, check whether the twin copy needs the same edit.**

### Client
Single-page: `client/src/App.tsx` routes with `wouter` (essentially just `Home`). `client/src/main.tsx` wires the tRPC client (`httpBatchLink` → `/api/trpc`, `superjson` transformer, `credentials: "include"`) and a global QueryCache subscriber that redirects to login on `UNAUTHED_ERR_MSG`. UI is Radix + shadcn-style components under `client/src/components/ui`, Tailwind v4, dark theme default. Path aliases: `@/*` → `client/src`, `@shared/*` → `shared`.

### Data
Drizzle schema is `drizzle/schema.ts` (note: `drizzle.config.ts` points here, not `shared/`). Tables: `users` (OAuth `openId` + optional email/password auth via `bcryptjs`, `role` enum) and `savedCharts` (chart placements stored as JSON `text`). Migrations in `drizzle/`.

## Repo hygiene notes

- **`.bak` / `.bak.<timestamp>` files are everywhere** and are committed clutter, not sources — ignore `*.bak*`, `Home1.tsx`, `astroEngine (1).ts`, etc. Edit the canonical unsuffixed file.
- **Root `*.py` scripts** (`wire_aspect_motion.py`, `apply_firmament_upgrades.py`, `upgrade_*.py`, `_local_fix_scripts/`) are one-off, idempotent codemods the author used to patch `.ts` files; they back up each target as `.bak.<timestamp>` before editing. They are historical tooling, not part of the build — prefer editing TypeScript directly over adding more of these.
- `server/index.ts` is a bare static-file server and is **not** the entry point — the real one is `server/_core/index.ts`.
