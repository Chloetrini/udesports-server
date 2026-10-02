# AGENTS.md: UDESport Server

Loaded at the start of every AI session on this repo. Keep it true: update it when a convention or gotcha changes.

## What this is

REST API for **UDESport**, a football scouting and player placement academy site. Live API: https://udesports-server.vercel.app. Client: [udesports-client](https://github.com/Chloetrini/udesports-client).

## Stack (do not swap without asking)

Node.js · TypeScript (ESM, imports end in `.js`) · Express 5 · PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) · Memcachier (`memjs`) · Pino · Cloudinary · Brevo (email, via `axios` in `src/email/send-email.ts`) · Vercel (serverless + cron).

## Commands

```bash
npm install                 # also runs prisma generate
npx prisma migrate deploy   # apply migrations (reads DIRECT_URL)
npm run dev                 # tsx watch src/server.ts (default port 4200)
npm run seed                # create the admin account (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run build               # tsc
npm start                   # node dist/server.js
npx tsc --noEmit            # typecheck (currently clean)
```

No test script. Always run `npx tsc --noEmit` before committing.

## Environment

Copy `.env.example` to `.env`. `src/config/key.ts` **throws on start if any listed key is missing**, so a new required variable goes in both `ENV_VARS` there and `.env.example`. `DIRECT_URL` is read only by `prisma.config.ts` (migrations).

## Layout

```
api/index.ts        Vercel entry: re-exports the Express app
src/server.ts       app setup: CORS allow-list, session, rate limit, routes, error handlers
src/config/         key.ts (env), prisma.ts, session.ts, logger.ts, cloudinary.ts
src/routes/*.routes.ts        one router per resource, mounted at /api/<resource>
src/controllers/*.controller.ts   request logic
src/middlewares/    auth, cache, error, rateLimit
src/lib/            cache.ts, tryCatchWrapper.ts, responseHandler.ts, emailTemplate.ts
src/services/       email.service.ts
prisma/             schema.prisma, migrations/, seed.ts
```

## Conventions

- Every controller handler is wrapped in `tryCatchWrapper`, which forwards anything unexpected that is thrown to the error handler (`appErrorHandler`). Expected failures (bad input, not found) are answered directly with `sendTsRestError`.
- Respond with `sendTsRestSuccess` / `sendTsRestError`: `{ success, message, body? }` or `{ success: false, message, details? }`.
- Roles are `SUPER_ADMIN`, `ADMIN`, `SUB_ADMIN`. Protect admin routes with `protect` then `authorize(...roles)`.
- Auth is a JWT in an httpOnly cookie (`req.cookies.token`) plus an `express-session` stored in Postgres (`sessions` table). Routes use `/api/...` with no version prefix; updates use `PUT`.
- Public GETs use `cacheMiddleware('<namespace>', 60)`. **Every create/update/delete route on that resource must use `invalidateCache('<namespace>')`**, or the public site shows stale data.
- Imports inside `src/` use relative paths with the `.js` extension.
- Schema changes go through a Prisma migration (`npx prisma migrate dev --name <what>`). Never edit an applied migration.

## Commits

Author every commit as `Chloetrini <noreply@anthropic.com>`, never as "Claude" or "Claude with Trini". Set it before committing: `git config user.name "Chloetrini" && git config user.email noreply@anthropic.com`.

## Gotchas

- **CORS is an allow-list** in `src/server.ts` (`CLIENT_URL` plus the production domains and local ports 4001, 4002, 4003). A blocked origin looks like a client "loading forever". Add a new frontend origin there.
- The cron route `/api/cron-email` runs daily at 08:00 UTC (`vercel.json`) and is authenticated by the `x-cron-secret` header, not by session. It is mounted before CORS and session on purpose.
- `src/server.ts` only calls `listen()` when `VERCEL` is unset. On Vercel `api/index.ts` exports the app.
- `memjs` calls never throw out of `src/lib/cache.ts`; a cache failure must not break a request.
- `mongodb` is still listed in `package.json` but nothing in `src/` imports it.
