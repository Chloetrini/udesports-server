import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcrypt'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env')
  }

  const existing = await prisma.admin.findUnique({
    where: { email: email.toLowerCase() },
  })

  if (existing) {
    console.log(`Super Admin already exists: ${email}`)
    return
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const admin = await prisma.admin.create({
    data: {
      name: 'Super Admin',
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  })

  console.log(`Super Admin created: ${admin.email}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })