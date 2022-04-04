import { PrismaClient } from '@prisma/client'
import { log } from '../src/lib/log'

const prisma = new PrismaClient()

async function main() {
  const i = await prisma.signature.deleteMany()
  log(i)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
