// 직원 목록 확인용 일회성 스크립트
// 실행: pnpm tsx scripts/list-employees.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true, position: true, department: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  console.log(`\n=== 활성 사용자 ${users.length}명 ===\n`)
  users.forEach((u) => {
    console.log(`${u.name.padEnd(8)} | ${u.role.padEnd(12)} | ${u.position ?? '-'}`)
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
