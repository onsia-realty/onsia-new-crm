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
        title: '[2024.11.19] 고객 배분 및 상세 페이지 대규모 개선',
        content: `안녕하세요. 온시아 CRM 시스템이 다음과 같이 개선되었습니다.

## 주요 업데이트

### 1. 고객 배분 관리 페이지 개선
- **현장명 필터 추가**: 직원별 + 현장별 복합 필터링 지원
- **현장명 컬럼 표시**: 이메일 대신 고객의 현장명을 표시
- **고객명 클릭 기능**: 고객명을 클릭하면 상세 페이지로 이동
- **배분 시 현장 지정**: 고객 배분 시 현장명을 함께 지정 가능

### 2. 고객 상세 페이지 개선
- **담당자 변경 이력 추가**: 고객 담당자 변경 이력을 타임라인 형태로 표시
- **헤더 UI 개선**: 더 깔끔하고 직관적인 디자인으로 변경
- **계약 대장 바로가기**: 해당 고객의 계약 대장으로 바로 이동하는 버튼 추가
- **현장명 옵션 추가**: 왕십리 어반홈스 등 모든 현장명 선택 가능

### 3. 고객 목록 페이지 개선
- **직원별 필터 카드**: 대시보드처럼 직원별 고객 건수를 카드로 표시
- **카드 클릭 필터링**: 직원 카드를 클릭하면 해당 직원의 고객만 표시

### 4. 기타 개선사항
- 서버사이드 필터링 적용으로 성능 개선
- 사이트 필터 오류 수정 (전체/all 처리)
- 엑셀 대량 등록 시 현장명 지정 기능 개선

보다 효율적인 고객 관리를 위해 지속적으로 개선하겠습니다.
문의사항은 시스템 관리자에게 연락해 주세요.`,
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
