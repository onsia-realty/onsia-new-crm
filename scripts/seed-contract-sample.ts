// 샘플 계약 활동 1건 시드 — 추재현 / 109동 2002호 / 2026-05-13
// 실행: pnpm tsx scripts/seed-contract-sample.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const employee = await prisma.user.findFirst({
    where: { name: '추재현', isActive: true },
  })
  if (!employee) {
    console.error('❌ "추재현" 직원을 찾을 수 없습니다.')
    return
  }

  const admin = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'CEO', 'HEAD'] }, isActive: true },
  })
  if (!admin) {
    console.error('❌ 관리자 계정이 없습니다.')
    return
  }

  // 2026-05-13 KST 00:00 → UTC
  const kst = new Date(2026, 4, 13, 0, 0, 0, 0) // 5월은 index 4
  const utc = new Date(kst.getTime() - 9 * 60 * 60 * 1000)

  const created = await prisma.contractActivity.create({
    data: {
      employeeId: employee.id,
      customerInfo: '109동 2002호',
      contractDate: utc,
      createdById: admin.id,
    },
  })

  console.log('✅ 등록 완료:', {
    id: created.id,
    employee: employee.name,
    customerInfo: created.customerInfo,
    contractDate: created.contractDate.toISOString(),
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
