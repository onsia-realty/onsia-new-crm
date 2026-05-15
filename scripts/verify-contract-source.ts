// 계약 활동 raw row 확인 — source 필드가 실제 DB에 있는지
// 실행: pnpm tsx scripts/verify-contract-source.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const list = await prisma.contractActivity.findMany({
    orderBy: { contractDate: 'desc' },
    include: { employee: { select: { name: true } } },
  })
  list.forEach((c) => {
    console.log(JSON.stringify(c, null, 2))
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
