// 왕십리 현장 표기 통일: '왕십리어반홈스'(공백 없음) → '왕십리 어반홈스'(공백 있음)
//
// 공백 있는 쪽으로 맞추는 이유: lib/constants/sites.ts 의 SITES 상수가 '왕십리 어반홈스'이고,
// 다른 현장('평택 로제비앙', '파크힐 동탄')도 공백을 쓴다. 상수를 데이터에 맞추면
// 집중 현장 드롭다운 이름만 어색해진다.
//
// assignedSite 는 라벨일 뿐이라 이름을 바꿔도 고객 레코드가 병합/삭제되지 않는다.
// 두 표기에 걸친 전화번호 264건은 이미 오늘도 중복으로 잡히고 있다(중복 판정은 현장과 무관하게 전화번호 기준).
//
// 사용법:
//   node scripts/normalize_wangsimni.js          → dry-run (변경 없음)
//   node scripts/normalize_wangsimni.js --apply  → 실제 반영 + 롤백용 ID 저장
//
// 롤백: scripts/wangsimni_rollback.json 의 id 들을 다시 '왕십리어반홈스' 로 되돌리면 된다.
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const FROM = '왕십리어반홈스';
const TO = '왕십리 어반홈스';
const ROLLBACK_PATH = 'scripts/wangsimni_rollback.json';

(async () => {
  const prisma = new PrismaClient();
  const apply = process.argv.includes('--apply');
  try {
    const targets = await prisma.customer.findMany({
      where: { assignedSite: FROM },
      select: { id: true, isDeleted: true, isPublic: true, assignedUserId: true },
    });

    console.log(`대상: assignedSite='${FROM}' → '${TO}'`);
    console.log(`  총 ${targets.length}건`);
    console.log(`  - 미삭제 ${targets.filter(t => !t.isDeleted).length} / 삭제됨 ${targets.filter(t => t.isDeleted).length}`);
    console.log(`  - 공개DB ${targets.filter(t => t.isPublic).length} / 담당자 있음 ${targets.filter(t => t.assignedUserId).length}`);

    const before = await prisma.customer.count({ where: { assignedSite: TO } });
    console.log(`\n통일 대상 이름 '${TO}' 기존 보유: ${before}건`);
    console.log(`반영 후 예상: ${before + targets.length}건`);

    if (!apply) {
      console.log('\n[dry-run] 변경하지 않았습니다. 실제 반영하려면 --apply 를 붙이세요.');
      return;
    }

    // 롤백용 ID 저장 (되돌릴 때 이 id 들만 FROM 으로 복원)
    fs.writeFileSync(ROLLBACK_PATH, JSON.stringify({
      from: FROM,
      to: TO,
      ids: targets.map(t => t.id),
    }, null, 2));
    console.log(`\n롤백용 ID ${targets.length}건 저장: ${ROLLBACK_PATH}`);

    const result = await prisma.customer.updateMany({
      where: { assignedSite: FROM },
      data: { assignedSite: TO },
    });
    console.log(`반영 완료: ${result.count}건 업데이트`);

    const after = await prisma.customer.count({ where: { assignedSite: TO } });
    const leftover = await prisma.customer.count({ where: { assignedSite: FROM } });
    console.log(`\n검증: '${TO}' ${after}건 / '${FROM}' 잔여 ${leftover}건 (0이어야 정상)`);
  } finally {
    await prisma.$disconnect();
  }
})();
