/**
 * 민간임대 3억대 공개DB — 이름 공란(fallback '고객_xxxx') → '미정' 으로 보정
 *   --dry-run : 대상 건수/샘플만 출력
 *   --execute : 실제 업데이트
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SITE_NAME = '민간임대 3억대';

const args = process.argv.slice(2);
const isExecute = args.includes('--execute');

async function main() {
  const fb = await prisma.customer.findMany({
    where: { assignedSite: SITE_NAME, isDeleted: false, name: { startsWith: '고객_' } },
    select: { id: true, name: true, phone: true },
  });
  console.log(`대상(이름 공란→fallback '고객_') : ${fb.length}건`);
  fb.slice(0, 20).forEach(r => console.log(`  ${r.name}  ${r.phone}`));

  if (!isExecute) {
    console.log('\n🚫 DRY-RUN. 실제 변경하려면 --execute');
    return;
  }
  if (fb.length === 0) {
    console.log('변경 대상 없음.');
    return;
  }
  const result = await prisma.customer.updateMany({
    where: { id: { in: fb.map(r => r.id) } },
    data: { name: '미정' },
  });
  console.log(`\n✅ '미정'으로 변경: ${result.count}건`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ 오류:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
