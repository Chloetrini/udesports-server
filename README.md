# UDESport Server

REST API for **UDESport**, a football scouting and player placement academy site. Built solo for a client.

**Live site:** https://udesportsmgt.com
**API:** https://udesports-server.vercel.app
**Client:** [udesports-client](https://github.com/Chloetrini/udesports-client)

## Highlights

- **PostgreSQL with Prisma**, hosted on Neon
- Versioned **Memcachier caching** so cached lists are invalidated cleanly after changes
- Structured logging with Pino
- Rate limiting, plus admin auth with a JWT in an httpOnly cookie and `express-session` backed by a Postgres session store
- Image uploads with Cloudinary
- Email through Brevo, with a daily Vercel cron job for scheduled sends
- 13 controllers (players, staff, news, gallery, awards, testimonials, newsletter and more) wrapped in a shared `tryCatchWrapper` for consistent error handling

## Tech stack

Node.js · TypeScript · Express 5 · PostgreSQL · Prisma 7 · Neon · Memcachier · Pino · Cloudinary · Brevo · Vercel

## Run it locally

Requires Node 20.19+ (or 22.12+) and a PostgreSQL database (Neon works).

```bash
git clone https://github.com/Chloetrini/udesports-server.git
cd udesports-server
npm install        # also runs prisma generate
```

Create a `.env`. The server refuses to start unless these are set:

```
DATABASE_URL  NODE_ENV  PORT  LOG_LEVEL  CLIENT_URL
JWT_SECRET  SESSION_SECRET  SESSION_MAX_AGE
CLOUDINARY_CLOUD_NAME  CLOUDINARY_API_KEY  CLOUDINARY_API_SECRET
BREVO_API_KEY  EMAIL_FROM  EMAIL_OWNER
MEMCACHIER_SERVERS  MEMCACHIER_USERNAME  MEMCACHIER_PASSWORD
ADMIN_EMAIL  ADMIN_PASSWORD  CRON_SECRET
```

Prisma migrations read `DIRECT_URL` (a direct, non-pooled connection string), so set that too. Then:

```bash
npx prisma migrate deploy   # apply migrations
npm run dev                 # start with hot reload (tsx watch)
npm run seed                # create the admin account
npm run build               # compile TypeScript
npm start                   # run the compiled server
```

## Structure

```
api/       Vercel entry
prisma/    schema and migrations
src/       config, controllers, routes, middlewares, services
```
