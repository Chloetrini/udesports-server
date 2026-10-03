import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Requests every player photo once at the two sizes the client uses, so
// Cloudinary builds them now instead of making the first real visitor wait.
// Keep WIDTHS and the transformation string in sync with the client's
// optimizeImageUrl / PlayerImage. Safe to re-run.
const WIDTHS = [640, 960]
// f_auto builds a separate file per image format the browser accepts
const ACCEPTS = ['image/avif,image/webp,image/*,*/*', 'image/webp,image/*,*/*']

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

function variant(url: string, width: number) {
  const marker = '/upload/'
  const i = url.indexOf(marker)
  if (!url.includes('res.cloudinary.com') || i === -1) return null
  const at = i + marker.length
  return `${url.slice(0, at)}w_${width},c_limit,q_auto,f_auto/${url.slice(at)}`
}

async function main() {
  const players = await prisma.player.findMany({
    where: { playerPhoto: { not: null } },
    select: { playerName: true, playerPhoto: true },
  })
  let ok = 0
  let failed = 0
  for (const p of players) {
    for (const width of WIDTHS) {
      const url = variant(p.playerPhoto as string, width)
      if (!url) continue
      for (const accept of ACCEPTS) {
        try {
          const res = await fetch(url, { headers: { Accept: accept } })
          await res.arrayBuffer()
          res.ok ? ok++ : failed++
          if (!res.ok) console.warn(`${res.status} ${p.playerName} @${width}`)
        } catch (e) {
          failed++
          console.warn(`failed ${p.playerName} @${width}`, e)
        }
      }
    }
  }
  console.log(`Warmed ${players.length} players: ${ok} ok, ${failed} failed`)
}

main().finally(() => prisma.$disconnect())
