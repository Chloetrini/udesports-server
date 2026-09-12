// Vercel serverless entry point. Vercel treats every file under /api as its
// own serverless function; this one just re-exports the existing Express
// app so the whole backend runs behind a single function.
//
// vercel.json rewrites every request to this function, and Express's own
// router (mounted at /api/... in src/server.ts) handles the real routing
// from there — so the frontend keeps calling the same /api/... paths it
// already uses locally.
//
// src/server.ts already guards its startServer()/app.listen() call behind
// `if (!process.env.VERCEL)`, so importing it here does not try to bind a
// port — it only connects to the database and exports the app.
import app from '../src/server'

export default app
