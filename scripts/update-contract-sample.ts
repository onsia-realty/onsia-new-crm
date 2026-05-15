// 기존 샘플 ContractActivity를 새 분리 컬럼으로 마이그레이션
// 추재현 / 야목역 서희스타힐스 / 이남주 / 109동 2002호 / 84m² / 400만원
// 실행: pnpm tsx scripts/update-contract-sample.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1) 추재현의 이남주 109동 2002호 시드를 새 컬럼으로 보강 (idempotent)
  const updated = await prisma.contractActivity.updateMany({
    where: {
      OR: [
        { customerName: '이남주', unitNumber: '109동 2002호' },
        { customerInfo: '이남주 · 109동 2002호' },
        { customerInfo: '109동 2002호' },
      ],
    },
    data: {
      customerName: '이남주',
      unitNumber: '109동 2002호',
      unitType: '84m²',
      source: 'AD', // 광고
      commission: 400,
      siteName: '야목역 서희스타힐스',
      customerInfo: null,
    },
  })
  console.log(`✅ 마이그레이션: ${updated.count}건`)

  const list = await prisma.contractActivity.findMany({
    orderBy: { contractDate: 'desc' },
    include: { employee: { select: { name: true } } },
  })
  list.forEach((c) => {
    console.log(
      `- ${c.contractDate.toISOString().slice(0, 10)} | ${c.employee?.name} | ${c.siteName ?? '-'} | ${c.customerName ?? '-'} | ${c.unitNumber ?? '-'} | ${c.unitType ?? '-'} | ${c.source ?? '-'} | ${c.commission != null ? c.commission + '만원' : '-'}`
    )
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
