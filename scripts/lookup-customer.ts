// 고객 검색 — "이남주" 또는 010-9607-4757
// 실행: pnpm tsx scripts/lookup-customer.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const list = await prisma.customer.findMany({
    where: {
      OR: [{ name: '이남주' }, { phone: '01096074757' }],
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      assignedSite: true,
      assignedUserId: true,
      isPublic: true,
      createdAt: true,
    },
    take: 10,
  })

  if (list.length === 0) {
    console.log('❌ 해당 고객을 찾을 수 없습니다.')
    return
  }

  // 담당 직원 이름 동시 조회
  const userIds = list.map((c) => c.assignedUserId).filter(Boolean) as string[]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u.name]))

  list.forEach((c) => {
    const owner = c.assignedUserId ? userMap.get(c.assignedUserId) ?? '?' : '없음'
    console.log(
      `- ${c.name ?? '(이름없음)'} | ${c.phone} | 담당: ${owner} | 현장: ${c.assignedSite ?? '-'} | 공개DB: ${c.isPublic}`
    )
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
