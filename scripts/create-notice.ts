import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createNotice() {
  try {
    // 관리자 계정 찾기
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!admin) {
      console.error('❌ 관리자 계정을 찾을 수 없습니다.');
      return;
    }

    const notice = await prisma.notice.create({
      data: {
        title: '[2024.11.02] 고객 보안 및 사용성 개선 업데이트',
        content: `안녕하세요. 온시아 CRM 시스템이 다음과 같이 개선되었습니다.

## 주요 업데이트

### 1. 고객 정보 보안 강화
- 전화번호 마스킹 적용: 010-3377-6922 → 010-**77-6922
- 중간 번호 앞 2자리 자동 숨김 처리
- 스크린샷 유출 시에도 전체 번호 보호

### 2. 대량 등록 한도 확대
- 고객 대량 등록: 500명 → 1,000명으로 확대
- 배분 관리 페이지: 최대 50,000명까지 처리 가능

### 3. 사용성 개선
- 고객 카드 전체 영역 클릭 가능 (여백 클릭 시에도 상세 페이지 이동)
- 전화번호는 독립적으로 동작 (클릭 시 바로 전화 걸기)

보다 안전하고 편리한 시스템을 위해 지속적으로 개선하겠습니다.
감사합니다.`,
        category: 'SYSTEM',
        isPinned: true,
        authorId: admin.id
      }
    });

    console.log('✅ 공지사항이 성공적으로 생성되었습니다!');
    console.log('제목:', notice.title);
    console.log('작성자:', admin.name);
    console.log('고정:', notice.isPinned ? '예' : '아니오');
  } catch (error) {
    console.error('❌ 공지사항 생성 실패:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createNotice();
