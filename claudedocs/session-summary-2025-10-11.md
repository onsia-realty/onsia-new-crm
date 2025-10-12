# 온시아 CRM 프로젝트 작업 요약 (2일간)

## 📅 작업 기간
2025-10-08 ~ 2025-10-11

---

## 🎯 핵심 주제별 요약

### 1. 프로젝트 초기 구성 및 설정

**완료된 작업:**
- Next.js 14 (App Router) + TypeScript 기반 프로젝트 부트스트랩
- NextAuth v5 인증 시스템 구현
- Prisma ORM + PostgreSQL 데이터베이스 설정
- shadcn/ui + TailwindCSS UI 프레임워크 적용
- 포트 설정: localhost:3007
- 프로젝트 구조 정리 및 중복 프로젝트 분리

**관련 커밋:**
- `e5ecedc feat: 온시아 CRM 시스템 초기 구현`
- `14008b0 fix: 포트 설정 및 Claude Code 설정 업데이트`

---

### 2. DB 스키마 확장: 온시아 고객관리카드 시스템 구현

**추가된 필드:**

#### Customer 모델 - 개인 정보
- `gender` (Gender enum): 성별 (MALE/FEMALE)
- `ageRange` (AgeRange enum): 나이대 (20대~60대+)
- `residenceArea` (String): 거주지역
- `familyRelation` (String): 가족관계
- `occupation` (String): 직업

#### Customer 모델 - 영업 정보
- `source` (CustomerSource enum): 분류 (광고/TM/필드/소개)
- `investmentStyle` (String): 투자성향 (시세차익/월수익/실거주) - JSON 저장
- `expectedBudget` (Int): 예상투자 가능금액 (계약금 기준, 만원 단위)
- `ownedProperties` (String): 보유현황 (APT/오피스텔/상가/건물) - JSON 저장
- `recentVisitedMH` (String): 최근 방문 모델하우스

#### CallLog 모델 간소화
- 기존: `type`, `duration`, `direction` 등 복잡한 필드
- 변경: `content` (통화 내용), `note` (비고)만 유지
- CallType enum 제거

**마이그레이션 전략:**
- 모든 새 필드는 nullable로 설정하여 기존 데이터 보존
- 기존 50건 고객 데이터 무손실 마이그레이션

**관련 커밋:**
- `8cac74d 🔥 온시아 CRM 고객관리 시스템 완성`

---

### 3. 전화번호 처리 개선

**문제:**
- 기존: 휴대폰 번호(010)만 지원
- 고객이 02(서울), 031(경기) 등 지역번호 입력 시 검증 실패

**해결:**
- 전화번호 정규화 함수 개선 (`lib/utils/phone.ts`)
- 지역번호 패턴 지원:
  ```typescript
  // 지원되는 형식
  - 010-1234-5678 (휴대폰)
  - 02-1234-5678 (서울)
  - 031-123-4567 (경기)
  - 064-123-4567 (제주)
  ```
- 저장 형식: 숫자만 (하이픈 제거)
- 유효성 검사 개선: `/^(0[0-9]{1,2}|1[0-9]{3})[0-9]{6,8}$/`

**영향받은 API:**
- `bulk-import` API: 엑셀 업로드 시 전화번호 검증
- `customers` API: 고객 등록/수정 시 검증
- `visit-schedules` API: 방문 일정 등록 시 검증

**관련 커밋:**
- `4244818 fix: 지역번호(02, 031 등) 전화번호 형식 지원`
- `1a07560 fix: bulk-import API 전화번호 유효성 검사 수정 (지역번호 지원)`

---

### 4. 버그 수정: 고객 상세 페이지 undefined 에러

**문제:**
- 고객 상세 페이지에서 `interestCards`, `callLogs`, `visitSchedules` undefined 에러
- Prisma include 누락으로 관계 데이터 조회 안 됨

**해결:**
- `app/api/customers/[id]/route.ts` 수정
- Prisma include 추가:
  ```typescript
  include: {
    interestCards: true,
    callLogs: {
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    },
    visitSchedules: {
      include: { assignee: true },
      orderBy: { date: 'desc' }
    }
  }
  ```
- UI에서 옵셔널 체이닝 추가 (`customer?.callLogs?.map(...)`)

**관련 커밋:**
- `3a0ca0f fix: 고객 상세 페이지 undefined 에러 수정 (interestCards, callLogs, visitSchedules)`

---

### 5. 배포 및 보안 가이드 작성

**문서:** `서버.md`

**핵심 내용:**
1. **배포 전략**
   - SQLite → PostgreSQL 전환 필수 (Vercel 서버리스 환경)
   - 추천 조합: Vercel + Supabase
   - 무료 시작 → 트래픽 증가 시 업그레이드 ($0 → $55/월)

2. **보안 대책**
   - Rate Limiting (무차별 대입 공격 방어)
   - 환경 변수 보안 (DATABASE_URL, AUTH_SECRET)
   - DB 접근 제어 (SSL, IP 화이트리스트)
   - 네트워크 보안 (DDoS 방어, HTTPS 강제)
   - 개인정보 보호 (전화번호 마스킹, 데이터 암호화)
   - 모니터링 (AuditLog 활용)

3. **배포 프로세스 (5-7일)**
   - Phase 1: 준비 (2-3일) - Supabase 설정, 코드 수정, 마이그레이션
   - Phase 2: 보안 강화 (1-2일) - Rate Limiting, 보안 헤더
   - Phase 3: Vercel 배포 (1일)
   - Phase 4: 모니터링 (1일)

4. **보안 위협 시나리오 대응**
   - 무차별 로그인 시도
   - DB 직접 접근
   - 내부자 위협
   - DDoS 공격

**관련 커밋:**
- `b4f044f docs: 배포 및 보안 가이드 문서 추가`

---

### 6. 작업 가이드 문서화

**문서:** `작업가이드.md`

**내용:**
- Phase 1: DB 마이그레이션 (10분)
- Phase 2: Validation 스키마 업데이트 (20분)
- Phase 3: API 라우트 업데이트 (30분)
- Phase 4: UI 재설계 (1-1.5시간)
- Phase 5: 테스트 및 배포 (30분)

**특징:**
- 단계별 구체적인 명령어 제공
- 에러 발생 시 해결 방법 포함
- 코드 예시 포함 (복붙 가능)
- 총 예상 시간: 2.5-3시간

**관련 커밋:**
- `44f666a docs: 온시아 고객관리카드 시스템 구현 작업 가이드 추가`

---

## 📊 코드 변경 통계 (최근 5개 커밋)

```
14 files changed
1,065 insertions(+)
153 deletions(-)
```

**주요 변경 파일:**
- `prisma/schema.prisma`: DB 스키마 확장
- `lib/utils/phone.ts`: 전화번호 처리 개선
- `lib/validations/*.ts`: Zod 스키마 업데이트
- `app/api/**/*.ts`: API 라우트 수정
- `app/dashboard/customers/**/*.tsx`: UI 개선
- `서버.md`: 배포 가이드 (330줄)
- `작업가이드.md`: 구현 가이드 (594줄)

---

## ✅ 완료된 기능

### 인증 시스템
- [x] NextAuth v5 통합
- [x] 이메일/비밀번호 로그인
- [x] 직원 가입 및 관리자 승인 시스템
- [x] 역할 기반 접근 제어 (RBAC)

### 고객 관리
- [x] 고객 등록/수정/삭제
- [x] 온시아 고객관리카드 전체 필드 구현
- [x] 전화번호 정규화 및 검증 (지역번호 지원)
- [x] 중복 전화번호 탐지
- [x] 엑셀 대량 업로드 (bulk-import)
- [x] 고객 검색 및 필터링

### 영업 활동
- [x] 통화 기록 간소화 (빠른 메모)
- [x] 방문 일정 관리
- [x] 관심 카드 (interest cards)

### 문서화
- [x] 배포 및 보안 가이드
- [x] 작업 가이드 (단계별)
- [x] 에러 해결 가이드

---

## 🔄 현재 상태

### 개발 환경
- **포트:** localhost:3007
- **브랜치:** wsl (작업 브랜치), main (메인 브랜치)
- **DB:** PostgreSQL (Prisma)
- **인증:** NextAuth v5

### 테스트 상태
- [x] 기존 데이터 (50건) 무손실 보존
- [x] 새 고객 등록 (전체 필드)
- [x] 전화번호 검증 (휴대폰 + 지역번호)
- [x] 고객 상세 페이지 (관계 데이터 조회)
- [x] 통화 기록 추가
- [ ] 엑셀 업로드 (지역번호 포함)
- [ ] 방문 일정 체크
- [ ] 전체 E2E 테스트

### 배포 상태
- [ ] Supabase DB 설정
- [ ] Vercel 배포
- [ ] 환경 변수 설정
- [ ] Rate Limiting 구현
- [ ] 보안 헤더 추가

---

## 🎯 다음 단계 (우선순위)

### 1. 긴급 (배포 전 필수)
- [ ] SQLite → PostgreSQL 마이그레이션
- [ ] Supabase 프로젝트 생성
- [ ] 환경 변수 안전한 설정
- [ ] Vercel 배포 및 테스트

### 2. 보안 강화 (1-2일)
- [ ] Rate Limiting 구현 (@upstash/ratelimit)
- [ ] 보안 헤더 추가 (CSP, X-Frame-Options)
- [ ] IP 화이트리스트 설정
- [ ] 전화번호 마스킹 UI

### 3. 테스트 및 QA (1일)
- [ ] 전체 기능 테스트
- [ ] 엑셀 업로드 테스트 (지역번호 포함)
- [ ] 방문 일정 체크 기능 검증
- [ ] 모바일 반응형 테스트

### 4. 모니터링 (1일)
- [ ] Vercel Analytics 활성화
- [ ] AuditLog 대시보드 구현
- [ ] 백업 복원 절차 테스트
- [ ] 에러 추적 (Sentry 선택사항)

---

## 💡 주요 배운 점 및 결정 사항

### 기술 결정
1. **전화번호 저장:** 숫자만 저장, 표시 시 포맷팅
2. **JSON 필드 활용:** `investmentStyle`, `ownedProperties`는 JSON으로 저장
3. **CallLog 간소화:** 복잡한 통화 필드 → 간단한 메모 형태
4. **nullable 필드:** 기존 데이터 보존을 위해 새 필드는 optional

### 보안 원칙
1. **Rate Limiting 필수:** 무차별 공격 방어
2. **환경 변수 분리:** 절대 GitHub에 푸시 X
3. **AuditLog 활용:** 모든 중요 액션 기록
4. **RBAC 철저히:** 역할별 권한 명확히

### 배포 전략
1. **무료로 시작:** Vercel Hobby + Supabase 무료 티어
2. **점진적 업그레이드:** 트래픽 증가 시 Pro 플랜
3. **PostgreSQL 필수:** Vercel 서버리스 환경 특성

---

## 📝 참고 문서 링크

- 작업 가이드: `작업가이드.md`
- 배포 가이드: `서버.md`
- 프로젝트 명세: `CLAUDE.md`
- DB 스키마: `prisma/schema.prisma`

---

**작성일:** 2025-10-11
**작성자:** Claude Code
**프로젝트:** 온시아 CRM (onsia_crm2)
