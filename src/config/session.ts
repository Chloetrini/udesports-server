import pgSession from 'connect-pg-simple'
import session from 'express-session'
import { env } from './key.js'
import { pool } from './prisma.js'

// Session max age in milliseconds (default: 24 hours)
const SESSION_MAX_AGE = env.SESSION_MAX_AGE
  ? parseInt(env.SESSION_MAX_AGE, 10) || 24 * 60 * 60 * 1000
  : 24 * 60 * 60 * 1000

const PgStore = pgSession(session)

// Session middleware configuration
export const createSessionMiddleware = () => {
  return session({
    secret: env.SESSION_SECRET,
    name: '_udeSessionId', // Custom cookie name to avoid default 'connect.sid'
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    store: new PgStore({
      pool,
      tableName: 'sessions',
      createTableIfMissing: true, // auto-create the sessions table on first run
    }),
    cookie: {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true, // Prevent XSS attacks
      secure: env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection
    },
    rolling: true, // Refresh expiration on every response
  })
}

export default createSessionMiddleware