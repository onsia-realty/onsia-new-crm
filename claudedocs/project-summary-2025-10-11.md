# 온시아 CRM 프로젝트 완료 보고서

## 📅 작성일
2025-10-11

---

## 🎯 프로젝트 개요

**프로젝트명:** 온시아 고객관리카드 CRM 시스템
**기술 스택:** Next.js 14 + TypeScript + Prisma + NextAuth v5 + shadcn/ui
**데이터베이스:** SQLite (개발), PostgreSQL (프로덕션 예정)
**배포 플랫폼:** Vercel (예정)
**개발 서버:** http://localhost:3001

---

## ✅ 완료된 핵심 기능

### 1. 인증 시스템
- [x] NextAuth v5 통합
- [x] 이메일/비밀번호 로그인
- [x] 직원 가입 및 관리자 승인 시스템
- [x] 역할 기반 접근 제어 (RBAC)
  - EMPLOYEE (직원)
  - LEADER (팀장)
  - HEAD (본부장)
  - ADMIN (관리자)

### 2. 고객 관리
- [x] 온시아 고객관리카드 전체 필드 구현
  - 개인 정보: 성별, 나이대, 거주지역, 가족관계, 직업
  - 영업 정보: 분류(광고/TM/필드/소개), 투자성향, 예상투자금액, 보유현황, 최근 방문 모델하우스
- [x] 고객 등록/수정/삭제
- [x] 전화번호 정규화 및 검증 (지역번호 지원: 02, 031, 064 등)
- [x] 중복 전화번호 탐지
- [x] 엑셀 대량 업로드 (bulk-import)
- [x] 고객 검색 및 필터링

### 3. 영업 활동
- [x] 통화 기록 간소화 (빠른 메모)
  - content: 통화 내용
  - note: 비고 (선택사항)
- [x] 방문 일정 관리
  - FullCalendar 월뷰
  - 방문 상태: SCHEDULED, CHECKED, NO_SHOW
  - 통계 대시보드 (완료율, 노쇼율)
- [x] 관심 카드 (Interest Cards)

### 4. 문서화
- [x] 배포 및 보안 가이드 (`서버.md`)
- [x] 작업 가이드 (단계별, `작업가이드.md`)
- [x] 에러 해결 가이드
- [x] 세션 요약 문서

---

## 🐛 해결된 주요 버그

### 버그 #1: 로그인 실패
**증상:** "admin" / "Admin!234"로 로그인 불가

**원인:**
1. signup API 버그
   - `password` → `passwordHash` 필드명 불일치
   - 존재하지 않는 `username`, `phone` 필드 사용
   - `role: 'PENDING'` → 존재하지 않는 enum 값

2. DB 시드 데이터 불일치
   - DB: name = "관리자"
   - 로그인 페이지: username = "admin"
   - auth.config.ts는 `email` 또는 `name`으로 매칭하므로 불일치 발생

**해결:**
```typescript
// app/api/auth/signup/route.ts:37-43
const user = await prisma.user.create({
  data: {
    email,
    name,
    passwordHash: hashedPassword,  // password → passwordHash
    role: 'EMPLOYEE',                // PENDING → EMPLOYEE
    approved: false,                 // 승인 대기
  },
})
```

```typescript
// prisma/seed.ts:29
const admin = await prisma.user.create({
  data: {
    email: 'admin@onsia.local',
    name: 'admin',  // '관리자' → 'admin'
    passwordHash: adminPassword,
    role: Role.ADMIN,
    approved: true,
  },
})
```

**관련 커밋:**
- signup API 수정
- seed 스크립트 수정
- DB 리셋 및 재시드

---

### 버그 #2: 무한 렌더링 루프 (방문 일정 페이지)
**증상:**
```
Maximum update depth exceeded.
This can happen when a component calls setState inside useEffect,
but useEffect either doesn't have a dependency array,
or one of the dependencies changes on every render.
```

**원인:**
```typescript
// components/calendar/VisitCalendar.tsx
export function VisitCalendar({
  visits = [],  // ❌ 매 렌더링마다 새로운 [] 참조 생성
  ...
}: VisitCalendarProps) {
  useEffect(() => {
    // ...
  }, [visits]);  // ❌ 매번 다른 참조로 인식 → 무한 루프
}
```

**해결:**
```typescript
// 1. 더미 데이터를 컴포넌트 외부로 이동
const DUMMY_VISITS: Visit[] = [ /* ... */ ];

// 2. 기본값 제거 + useMemo 메모이제이션
export function VisitCalendar({ visits, ... }: VisitCalendarProps) {
  const safeVisits = useMemo(() => visits || [], [visits]);

  useEffect(() => {
    const eventsToShow = safeVisits.length > 0 ? safeVisits : DUMMY_VISITS;
    // ...
  }, [safeVisits]);  // ✅ 메모이제이션된 참조 사용
}
```

**관련 파일:**
- `components/calendar/VisitCalendar.tsx:3,113-124`

---

## 📊 데이터베이스 스키마

### 핵심 모델

#### User (사용자)
- id, email, passwordHash, name, role, approved
- 팀 관계: teamId → Team
- 생성한 고객: customers (1:N)
- 방문 일정: visits (1:N)
- 고객 배분: allocations (1:N)

#### Customer (고객)
- 기본 정보: name, phone (unique, 숫자만)
- 개인 정보: gender, ageRange, residenceArea, familyRelation, occupation
- 영업 정보: source, investmentStyle (JSON), expectedBudget, ownedProperties (JSON), recentVisitedMH
- 생성자: createdById → User
- 관계: visits, allocations, interestCards

#### Visit (방문 일정)
- customerId → Customer
- assigneeId → User
- date, status (SCHEDULED/CHECKED/NO_SHOW), note

#### InterestCard (관심 카드)
- customerId → Customer
- propertyType (아파트, 오피스텔, 상가 등)
- transactionType (매매, 전세, 월세, 단기임대)
- priority (HIGH/MEDIUM/LOW)
- status (ACTIVE/INACTIVE/CLOSED/COMPLETED)

#### Announcement (공지사항)
- authorId → User
- title, content (Markdown), pinned

---

## 🔐 테스트 계정

```
관리자: admin / Admin!234
직원(승인됨): employee2@onsia.local / Test!234
팀장: leader@onsia.local / Test!234
직원(승인대기): employee1@onsia.local / Test!234
```

---

## 📁 프로젝트 구조

```
onsia_CRM/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts    # NextAuth 핸들러
│   │   │   └── signup/route.ts            # 회원가입 API ✅ 수정됨
│   │   ├── customers/
│   │   │   ├── route.ts                   # 고객 CRUD
│   │   │   ├── [id]/route.ts              # 고객 상세
│   │   │   └── bulk-import/route.ts       # 엑셀 업로드
│   │   ├── call-logs/route.ts             # 통화 기록 (간소화)
│   │   ├── visit-schedules/route.ts       # 방문 일정
│   │   └── statistics/route.ts            # 통계 데이터
│   ├── auth/
│   │   └── signin/page.tsx                # 로그인 페이지
│   ├── dashboard/
│   │   ├── page.tsx                       # 대시보드 메인
│   │   ├── customers/                     # 고객 관리
│   │   ├── schedules/page.tsx             # 방문 일정 (캘린더)
│   │   └── cards/                         # 관심 카드
│   └── admin/
│       └── approvals/                     # 사용자 승인 관리
├── components/
│   └── calendar/
│       └── VisitCalendar.tsx              # 방문 일정 캘린더 ✅ 수정됨
├── lib/
│   ├── auth.ts                            # NextAuth 설정
│   ├── auth.config.ts                     # 인증 설정 ✅ 수정됨
│   ├── prisma.ts                          # Prisma 클라이언트
│   ├── utils/
│   │   ├── phone.ts                       # 전화번호 정규화 ✅ 개선됨
│   │   └── audit.ts                       # 감사 로그
│   └── validations/
│       ├── auth.ts                        # 인증 스키마
│       ├── customer.ts                    # 고객 스키마 ✅ 확장됨
│       └── call-log.ts                    # 통화 기록 스키마
├── prisma/
│   ├── schema.prisma                      # DB 스키마
│   ├── seed.ts                            # 시드 스크립트 ✅ 수정됨
│   └── migrations/                        # 마이그레이션 파일
├── claudedocs/
│   ├── session-summary-2025-10-11.md      # 세션 요약
│   └── project-summary-2025-10-11.md      # 프로젝트 완료 보고서 (이 파일)
├── 서버.md                                 # 배포 및 보안 가이드
└── 작업가이드.md                           # 구현 작업 가이드
```

---

## 🚀 로컬 개발 환경 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
```env
# .env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="your-secret-key-32-chars-minimum"
NEXTAUTH_URL="http://localhost:3001"
```

### 3. 데이터베이스 초기화
```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

### 4. 개발 서버 실행
```bash
npm run dev
```

서버: http://localhost:3001

---

## 📦 배포 가이드

### Vercel + Supabase 배포 전략

#### 1단계: 준비 (2-3일)
- [ ] Supabase 프로젝트 생성
- [ ] SQLite → PostgreSQL 마이그레이션
- [ ] 환경 변수 설정

#### 2단계: 보안 강화 (1-2일)
- [ ] Rate Limiting 구현 (@upstash/ratelimit)
- [ ] 보안 헤더 추가 (CSP, X-Frame-Options)
- [ ] IP 화이트리스트 설정

#### 3단계: Vercel 배포 (1일)
- [ ] GitHub 연동
- [ ] 환경 변수 입력
- [ ] 빌드 및 배포

#### 4단계: 모니터링 (1일)
- [ ] Vercel Analytics 활성화
- [ ] AuditLog 대시보드 구현
- [ ] 백업 복원 절차 테스트

**상세 내용:** `서버.md` 참고

---

## 🎨 UI/UX 특징

### 디자인 시스템
- **컴포넌트:** shadcn/ui + Radix UI
- **스타일링:** TailwindCSS
- **캘린더:** FullCalendar (월뷰, 주뷰, 일뷰)
- **차트:** Recharts (예정)
- **폼:** React Hook Form + Zod 검증

### 주요 화면
1. **로그인 페이지** (`/auth/signin`)
   - 깔끔한 카드 UI
   - 테스트 계정 안내

2. **대시보드** (`/dashboard`)
   - 통계 카드 (오늘 일정, 이번 달 완료율, 노쇼율)
   - 고정 공지사항
   - 최근 활동

3. **고객 관리** (`/dashboard/customers`)
   - 검색 및 필터
   - 페이지네이션
   - 엑셀 대량 업로드

4. **방문 일정** (`/dashboard/schedules`)
   - FullCalendar 월뷰
   - 일정 클릭 → 사이드 패널 상세 보기
   - 상태 변경 (예정 → 완료 → 노쇼)
   - 통계 대시보드

5. **관심 카드** (`/dashboard/cards`)
   - 부동산 유형별 필터
   - 우선순위 관리

---

## 📈 코드 품질 지표

### 타입 안전성
- [x] TypeScript 100%
- [x] Zod 스키마 검증 (폼 + API)
- [x] Prisma Client 타입 자동 생성

### 보안
- [x] RBAC (역할 기반 접근 제어)
- [x] AuditLog (모든 중요 액션 기록)
- [x] 전화번호 정규화 (숫자만 저장)
- [x] SQL Injection 방어 (Prisma)
- [ ] Rate Limiting (배포 시 추가 예정)

### 테스트
- [ ] Vitest 유닛 테스트 (예정)
- [ ] Playwright E2E 테스트 (예정)

---

## 🔧 기술적 결정 사항

### 1. 전화번호 저장 방식
- **저장:** 숫자만 (01012345678)
- **표시:** 포맷팅 (010-1234-5678)
- **검증:** 휴대폰 + 지역번호 지원

### 2. JSON 필드 활용
- `investmentStyle`: 투자성향 (시세차익/월수익/실거주)
- `ownedProperties`: 보유현황 (APT/오피스텔/상가/건물)
- 이유: 유연한 체크박스 옵션 관리

### 3. CallLog 간소화
- 기존: type, duration, direction 등 복잡한 필드
- 변경: content (통화 내용), note (비고)만 유지
- 이유: 빠른 메모 입력 우선

### 4. nullable 필드 전략
- 새 필드는 모두 optional
- 이유: 기존 데이터 보존, 점진적 입력

---

## 📝 다음 단계 (우선순위)

### 긴급 (배포 전 필수)
- [ ] SQLite → PostgreSQL 마이그레이션
- [ ] Supabase 프로젝트 생성
- [ ] 환경 변수 안전한 설정
- [ ] Vercel 배포 및 테스트

### 보안 강화 (1-2일)
- [ ] Rate Limiting 구현
- [ ] 보안 헤더 추가
- [ ] IP 화이트리스트 설정
- [ ] 전화번호 마스킹 UI

### 테스트 및 QA (1일)
- [ ] 전체 기능 테스트
- [ ] 엑셀 업로드 테스트 (지역번호 포함)
- [ ] 방문 일정 체크 기능 검증
- [ ] 모바일 반응형 테스트

### 모니터링 (1일)
- [ ] Vercel Analytics 활성화
- [ ] AuditLog 대시보드 구현
- [ ] 백업 복원 절차 테스트
- [ ] 에러 추적 (Sentry 선택사항)

### 기능 개선 (백로그)
- [ ] 엑셀 다운로드 (고객 리스트)
- [ ] 고급 검색 필터
- [ ] 방문 일정 알림
- [ ] 차트 및 분석 대시보드 (Recharts)
- [ ] 모바일 앱 (PWA)

---

## 💡 교훈 및 개선 사항

### 성공 요인
1. **타입 안전성:** TypeScript + Zod로 런타임 에러 사전 방지
2. **단순화:** 복잡한 CallLog 모델을 간단한 메모로 전환
3. **점진적 마이그레이션:** nullable 필드로 기존 데이터 보존
4. **문서화:** 단계별 가이드로 작업 효율성 향상

### 주의할 점
1. **기본값 참조 문제:** 컴포넌트 props 기본값은 항상 메모이제이션
2. **DB 필드명 일치:** Prisma 스키마와 API 필드명 일치 확인
3. **전화번호 검증:** 지역번호 패턴 고려 필요
4. **시드 데이터:** 로그인 테스트 시 실제 사용 데이터와 일치시킬 것

---

## 📞 문의 및 지원

### 문서
- 배포 가이드: `서버.md`
- 작업 가이드: `작업가이드.md`
- 세션 요약: `claudedocs/session-summary-2025-10-11.md`

### 주요 파일
- DB 스키마: `prisma/schema.prisma`
- 인증 설정: `lib/auth.config.ts`
- 전화번호 유틸: `lib/utils/phone.ts`

---

**작성자:** Claude Code
**프로젝트:** 온시아 CRM (onsia_crm2)
**버전:** 1.0.0
**최종 업데이트:** 2025-10-11

---

## 🎉 결론

온시아 CRM 시스템의 **기본 틀이 완성**되었습니다!

- ✅ 인증 및 권한 관리
- ✅ 고객 관리카드 (전체 필드)
- ✅ 방문 일정 (캘린더 + 통계)
- ✅ 통화 기록 (간소화)
- ✅ 관심 카드
- ✅ 엑셀 업로드

다음은 **배포 및 보안 강화** 단계입니다.
Vercel + Supabase 조합으로 안전하고 확장 가능한 시스템을 구축할 수 있습니다.

**현재 개발 서버:** http://localhost:3001
**로그인:** admin / Admin!234
