/**
 * 기존 고객 → lmsEligible 표식 소급 적용 (1회성)
 *
 * 배경:
 *   LMS광고 자격을 가변값 assignedSite('LMS 수기DB')에서 불변 표식 lmsEligible 로 전환했다.
 *   전환 시점에 이미 존재하던 고객 중 "정당한 신규 LMS 오더"는 자격을 잃으면 안 되므로 백필한다.
 *
 * 대상 (사용자 확정 — 그랜드파더링):
 *   - assignedSite = 'LMS 수기DB' (수기등록되어 LMS 풀에 대기 중)  OR
 *   - lmsAd = true                 (이미 LMS광고에 올라간 고객)
 *   위 조건의 고객을 lmsEligible = true 로 설정한다. (그 외 기존 DB는 false 유지)
 *
 * 사용법:
 *   pnpm tsx scripts/backfill-lms-eligible.ts            # 미리보기(대상 수만 출력)
 *   pnpm tsx scripts/backfill-lms-eligible.ts --execute  # 실제 반영
 *
 * 선행 조건: prisma db push 로 lmsEligible 컬럼이 DB에 반영된 상태여야 한다.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const LMS_SITE = 'LMS 수기DB'

async function main() {
  const execute = process.argv.includes('--execute')

  const where = {
    isDeleted: false,
    lmsEligible: false, // 아직 표식 없는 것만
    OR: [{ assignedSite: LMS_SITE }, { lmsAd: true }],
  }

  const target = await prisma.customer.count({ where })
  const bySite = await prisma.customer.count({
    where: { isDeleted: false, lmsEligible: false, assignedSite: LMS_SITE },
  })
  const byLmsAd = await prisma.customer.count({
    where: { isDeleted: false, lmsEligible: false, lmsAd: true },
  })

  console.log('=== lmsEligible 백필 대상 ===')
  console.log(`  'LMS 수기DB' 현장: ${bySite}명`)
  console.log(`  이미 LMS광고에 올림(lmsAd=true): ${byLmsAd}명`)
  console.log(`  중복 제외 총 대상: ${target}명`)

  if (!execute) {
    console.log('\n[미리보기] 실제 반영하려면 --execute 플래그를 붙여 다시 실행하세요.')
    return
  }

  const result = await prisma.customer.updateMany({
    where,
    data: { lmsEligible: true },
  })
  console.log(`\n✅ ${result.count}명에게 lmsEligible=true 적용 완료.`)
}

main()
  .catch((e) => {
    console.error('백필 실패:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
