# UDESport Server

REST API for **UDESport**, a football scouting and player placement academy site. Built solo for a client.

**Live site:** https://udesportsmgt.com
**API:** https://udesports-server.vercel.app (health check: `/api/health`)
**Client:** [udesports-client](https://github.com/Chloetrini/udesports-client)

## Highlights

- **PostgreSQL with Prisma**, hosted on Neon, with versioned migrations
- Versioned **Memcachier caching**: public lists are cached for 60 seconds and invalidated cleanly after every change
- Admin auth with a JWT in an httpOnly cookie and `express-session` backed by a Postgres session store, with three roles (`SUPER_ADMIN`, `ADMIN`, `SUB_ADMIN`)
- Rate limiting, a CORS allow-list and structured logging with Pino
- Image uploads with Cloudinary
- Email through Brevo, with a daily Vercel cron job for scheduled newsletter sends
- 13 controllers (players, staff, news, gallery, awards, testimonials, newsletter and more) wrapped in a shared `tryCatchWrapper` for consistent error handling

## Tech stack

Node.js · TypeScript · Express 5 · PostgreSQL · Prisma 7 · Neon · Memcachier · Pino · Cloudinary · Brevo · Vercel

## API at a glance

All routes live under `/api`. Public `GET` routes serve the website; everything that changes data needs an admin login.

| Area | Routes |
|---|---|
| Auth and admins | `/api/auth` |
| Players | `/api/players` |
| News, gallery, headlines, quick updates | `/api/news`, `/api/gallery`, `/api/headlines`, `/api/quick-updates` |
| Staff, awards, testimonials | `/api/staff`, `/api/awards`, `/api/testimonials` |
| Newsletter and notifications | `/api/newsletter`, `/api/notifications` |
| Settings | `/api/settings` |

Responses are `{ success, message, body? }` on success and `{ success: false, message, details? }` on error.

## Run it locally

Requires Node 20.19+ (or 22.12+) and a PostgreSQL database (Neon works).

```bash
git clone https://github.com/Chloetrini/udesports-server.git
cd udesports-server
npm install                  # also runs prisma generate
cp .env.example .env         # fill in every value
npx prisma migrate deploy    # apply migrations
npm run seed                 # create the admin account
npm run dev                  # http://localhost:4200
```

The server refuses to start if any variable in `.env.example` is missing. `DIRECT_URL` is only used by Prisma migrations and should be a direct (non-pooled) connection string.

| Script | What it does |
|---|---|
| `npm run dev` | Start with hot reload (`tsx watch`) |
| `npm run seed` | Create the admin account from `ADMIN_EMAIL` and `ADMIN_PASSWORD` |
| `npm run build` | Compile TypeScript |
| `npm start` | Run the compiled server |

## Project structure

```
api/        Vercel entry
prisma/     schema, migrations, seed
src/        config, routes, controllers, middlewares, services, lib
```

Conventions for contributors and AI assistants are in [AGENTS.md](AGENTS.md).
