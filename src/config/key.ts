import { config } from 'dotenv'

//load env file
if (!process.env.VERCEL) {
  if (process.env.NODE_ENV !== 'production') {
    config()
  }
}

interface EnvSpec {
  key: string
  required?: boolean
}

const ENV_VARS: EnvSpec[] = [
  { key: 'DATABASE_URL', required: true },
  { key: 'NODE_ENV', required: true },
  { key: 'CLOUDINARY_CLOUD_NAME', required: true },
  { key: 'CLOUDINARY_API_KEY', required: true },
  { key: 'CLOUDINARY_API_SECRET', required: true },
  { key: 'ADMIN_EMAIL', required: true },
  { key: 'ADMIN_PASSWORD', required: true },
  { key: 'JWT_SECRET', required: true },
  { key: 'SESSION_SECRET', required: true },
  { key: 'SESSION_MAX_AGE', required: true },
  { key: 'BREVO_API_KEY', required: true },
  { key: 'EMAIL_FROM', required: true },
  { key: 'EMAIL_OWNER', required: true },
  { key: 'CLIENT_URL', required: true },
  { key: 'LOG_LEVEL', required: true },
  {key: 'PORT', required: true},
  {key: 'MEMCACHIER_SERVERS', required: true},
  {key:'MEMCACHIER_USERNAME', required: true},
  {key:'MEMCACHIER_PASSWORD', required: true},
  {key:'CRON_SECRET', required: true},


]

interface Env {
  readonly [key: string]: string
}

const env: Env = process.env as Env

//check required keys
const requiredKeys = ENV_VARS.filter(k => k.required)
const missingKeys = requiredKeys.filter(k => !env[k.key])

if (missingKeys.length > 0) {
  throw new Error(`Missing required env key: ${missingKeys.map(k => k.key).join(',')}`)
}

export { env }