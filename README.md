# 🏗️ Onsia CRM Project

고객, 직원, 조직을 체계적으로 관리하기 위한 **온시아 CRM 시스템**입니다.
TypeScript, Next.js 14(App Router), Prisma, NextAuth 기반으로 설계되었으며
RBAC(역할 기반 접근 제어)와 정규화된 데이터 모델을 포함합니다.

---

## 📑 목차

- [프로젝트 개요](#-프로젝트-개요)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [로컬 실행 방법](#️-로컬-실행-방법)
- [Vercel 배포 가이드](#-vercel-배포-가이드)
- [엑셀 Import/Export](#-엑셀-importexport)
- [프로젝트 구조](#-프로젝트-구조)
- [테스트](#-테스트)
- [API 엔드포인트](#-api-엔드포인트)
- [데이터베이스 스키마](#-데이터베이스-스키마)
- [개발 워크플로우](#-개발-워크플로우)
- [트러블슈팅](#-트러블슈팅)

---

## 🚀 프로젝트 개요

온시아 CRM은 부동산 중개업 특화 고객 관리 시스템으로, 다음 핵심 가치를 제공합니다:

- **🔐 보안**: 역할 기반 접근 제어(RBAC)와 감사 로그
- **📊 효율성**: 엑셀 기반 대량 고객 배분, 방문 일정 캘린더 관리
- **🎯 정확성**: Zod 스키마 검증, 전화번호 정규화, 중복 탐지
- **🚀 확장성**: Next.js 14 App Router, Vercel Edge 배포

---

## 🧱 주요 기능

### UI/UX
- ✅ **브랜드 인트로 화면**
  → Framer Motion 애니메이션, 1.8초 최적화
  → 로고 + 타이포그래피 시퀀스, 세션 스토리지 스킵
  → 접근성 지원 (prefers-reduced-motion)
- ✅ **PWA (Progressive Web App)**
  → 홈 화면 추가, 오프라인 지원, 스플래시 스크린

### 인증 & 권한 관리
- ✅ **NextAuth v5 기반 인증**
  → Credentials Provider (아이디/비밀번호)
- ✅ **5단계 역할 계층**
  → PENDING → EMPLOYEE → TEAM_LEADER → HEAD → ADMIN
- ✅ **승인 대기 플로우**
  → 가입 시 PENDING, ADMIN 승인 후 활성화
- ✅ **세밀한 권한 제어**
  → Permission 모델 기반 resource/action 조합

### 고객 관리
- ✅ **온시아 고객관리카드**
  → 성별, 나이대, 거주지역, 투자성향, 예상예산 등 15+ 필드
- ✅ **전화번호 정규화**
  → 010-1234-5678 → 01012345678 (숫자만 저장)
- ✅ **중복 고객 탐지**
  → 전화번호 기준 중복 체크, 병합/열람 모달
- ✅ **고객 등급 관리**
  → A/B/C 등급, 관심카드 표시

### 일정 & 공지
- ✅ **FullCalendar 통합**
  → 월별 방문 일정, 체크 토글, 체크율 계산
- ✅ **공지사항 시스템**
  → 카테고리, 고정 기능, Markdown 지원

### Excel 연동
- ✅ **대량 고객 Import**
  → SheetJS 기반 엑셀 업로드, 중복 검사 후 배분
- ✅ **샘플 템플릿 다운로드**
  → name, phone, region, team, assigneeEmail, memo

---

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5.x |
| **Database** | PostgreSQL (Vercel Postgres) |
| **ORM** | Prisma 6.x |
| **Auth** | NextAuth v5 |
| **Validation** | Zod 4.x |
| **UI** | TailwindCSS 4.x, Radix UI, ShadCN/UI |
| **Calendar** | FullCalendar 6.x |
| **Charts** | Recharts 3.x |
| **Excel** | SheetJS (xlsx) |
| **Testing** | Vitest, Playwright |
| **CI/CD** | GitHub Actions |
| **Deploy** | Vercel |

---

## ⚙️ 로컬 실행 방법

### 1️⃣ 사전 요구사항
- **Node.js**: 20.x 이상
- **pnpm**: 8.x 이상 (권장)
- **PostgreSQL**: 14.x 이상

### 2️⃣ 환경 변수 설정
`.env` 파일 생성 후 아래 내용 추가:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/onsia_crm?schema=public"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
```

**NEXTAUTH_SECRET 생성 방법**:
```bash
openssl rand -base64 32
```

### 3️⃣ 설치 및 실행

```bash
# 1. 의존성 설치
pnpm install

# 2. Prisma 클라이언트 생성
pnpm prisma generate

# 3. 데이터베이스 마이그레이션
pnpm prisma migrate dev

# 4. 시드 데이터 생성 (관리자 계정 포함)
pnpm prisma db seed

# 5. 개발 서버 실행
pnpm dev
```

### 4️⃣ 로그인 정보

시드 스크립트로 생성된 관리자 계정:
- **아이디**: `admin`
- **이메일**: `admin@onsia.local`
- **비밀번호**: `Admin!234`

### 5️⃣ 접속 확인
- **로그인 페이지**: http://localhost:3000/auth/signin
- **대시보드**: http://localhost:3000/dashboard

---

## 🌐 Vercel 배포 가이드

### 1️⃣ Vercel 프로젝트 생성

```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 프로젝트 연결
vercel link
```

### 2️⃣ 데이터베이스 설정

**Option A: Vercel Postgres (권장)**
1. Vercel 대시보드 → Storage → Create Database → Postgres
2. 생성된 `DATABASE_URL` 환경 변수 자동 설정됨

**Option B: Supabase**
1. Supabase 프로젝트 생성
2. Connection String 복사
3. Vercel → Settings → Environment Variables → `DATABASE_URL` 추가

### 3️⃣ 환경 변수 설정

Vercel 대시보드 → Settings → Environment Variables에 추가:

```env
DATABASE_URL="postgresql://..." (DB에서 복사)
NEXTAUTH_SECRET="production-secret-key"
NEXTAUTH_URL="https://your-domain.vercel.app"
```

### 4️⃣ 데이터베이스 마이그레이션

**방법 1: Vercel CLI 사용**
```bash
# 로컬에서 프로덕션 DB에 마이그레이션
vercel env pull .env.production
pnpm prisma migrate deploy
pnpm prisma db seed
```

**방법 2: 자동 빌드 스크립트**
`package.json`에 추가:
```json
{
  "scripts": {
    "vercel-build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

### 5️⃣ 배포

```bash
# 프로덕션 배포
vercel --prod
```

### 6️⃣ 배포 후 확인사항
- [ ] 로그인 페이지 정상 접속
- [ ] 관리자 계정으로 로그인 성공
- [ ] 고객 생성 테스트
- [ ] 방문 일정 캘린더 로드
- [ ] 공지사항 노출 확인

---

## 📊 엑셀 Import/Export

### 샘플 템플릿 다운로드

**방법 1: UI에서 다운로드**
1. 대시보드 → 고객 관리 → 대량 등록
2. "샘플 템플릿 다운로드" 버튼 클릭

**방법 2: 수동 생성**
다음 컬럼으로 엑셀 파일 생성:

| name | phone | email | residenceArea | gender | ageRange | source | assignedUserEmail | memo |
|------|-------|-------|---------------|--------|----------|--------|-------------------|------|
| 홍길동 | 010-1234-5678 | hong@example.com | 서울시 강남구 | MALE | THIRTIES | AD | admin@onsia.local | VIP 고객 |
| 김철수 | 010-9876-5432 | kim@example.com | 경기도 성남시 | MALE | FORTIES | TM | admin@onsia.local | 재방문 의향 있음 |

### 엑셀 업로드 프로세스

1. **파일 선택**: `.xlsx` 또는 `.csv` 형식 지원
2. **자동 검증**:
   - 전화번호 정규화 (숫자만 추출)
   - 중복 전화번호 탐지
   - 필수 필드 검증 (name, phone)
3. **중복 처리 옵션**:
   - **건너뛰기**: 중복 고객은 무시
   - **병합**: 기존 고객 정보 업데이트
   - **개별 확인**: 중복 항목마다 선택
4. **배분 처리**:
   - `assignedUserEmail` 컬럼 기반 자동 배분
   - 없으면 업로드한 사용자에게 배정

### 중복 고객 처리 규칙

**중복 기준**: 전화번호 (숫자만 비교)

**처리 플로우**:
```
엑셀 업로드
  ↓
전화번호 정규화 (010-1234-5678 → 01012345678)
  ↓
중복 체크 (DB 조회)
  ↓
중복 발견 시 → 모달 표시
  ├─ 기존 고객 보기 (링크)
  ├─ 건너뛰기
  └─ 병합 (기존 데이터 업데이트)
  ↓
트랜잭션 처리
  ├─ Customer 생성
  ├─ CustomerAllocation 기록
  └─ AuditLog 기록
```

---

## 📁 프로젝트 구조

```
onsia_crm/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # NextAuth 엔드포인트
│   │   ├── customers/            # 고객 CRUD
│   │   ├── admin/                # 관리자 전용 API
│   │   └── visit-schedules/      # 방문 일정
│   ├── auth/                     # 로그인/회원가입 페이지
│   ├── dashboard/                # 대시보드 (보호된 라우트)
│   │   ├── customers/            # 고객 관리
│   │   ├── schedules/            # 방문 일정 캘린더
│   │   ├── notices/              # 공지사항
│   │   └── cards/                # 관심 카드
│   └── admin/                    # 관리자 페이지
│       ├── users/                # 사용자 관리
│       └── allocation/           # 고객 배분
├── components/                   # React 컴포넌트
│   ├── dashboard/                # 대시보드 컴포넌트
│   ├── layout/                   # 헤더, 사이드바
│   ├── ui/                       # ShadCN UI 컴포넌트
│   └── call-log/                 # 통화 기록
├── lib/                          # 유틸리티 & 설정
│   ├── auth/                     # NextAuth 설정
│   │   ├── auth-options.ts       # NextAuth 옵션
│   │   └── rbac.ts               # RBAC 로직
│   ├── validations/              # Zod 스키마
│   │   ├── auth.ts
│   │   ├── customer.ts
│   │   └── schedule.ts
│   ├── utils/                    # 헬퍼 함수
│   │   ├── phone.ts              # 전화번호 정규화
│   │   └── audit.ts              # 감사 로그
│   └── prisma.ts                 # Prisma 클라이언트
├── prisma/
│   ├── schema.prisma             # 데이터베이스 스키마
│   ├── seed.ts                   # 시드 데이터
│   └── migrations/               # 마이그레이션 히스토리
├── test/                         # Unit 테스트 (Vitest)
│   ├── utils/
│   └── validation/
├── e2e/                          # E2E 테스트 (Playwright)
│   └── auth-flow.spec.ts
├── .github/
│   └── workflows/                # GitHub Actions
│       └── ci.yml
└── public/                       # 정적 파일
```

---

## 🧪 테스트

### Unit 테스트 (Vitest)

```bash
# 모든 테스트 실행
pnpm test

# Watch 모드
pnpm test:watch

# 커버리지
pnpm test:coverage
```

**주요 테스트 파일**:
- `test/utils/phone.test.ts`: 전화번호 정규화
- `test/validation/customer.test.ts`: Zod 스키마 검증
- `test/auth/rbac.test.ts`: RBAC 권한 체크

### E2E 테스트 (Playwright)

```bash
# E2E 테스트 실행 (개발 서버 자동 시작)
pnpm test:e2e

# UI 모드
pnpm playwright test --ui

# 특정 브라우저
pnpm playwright test --project=chromium
```

**주요 시나리오**:
- `e2e/auth-flow.spec.ts`: 로그인 → 고객 등록 → 일정 생성

---

## 🔌 API 엔드포인트

### 인증
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| POST | `/api/auth/signup` | 회원가입 (PENDING 상태) | Public |
| POST | `/api/auth/[...nextauth]` | 로그인/로그아웃 | Public |

### 고객 관리
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/customers` | 고객 목록 조회 (페이지네이션) | EMPLOYEE+ |
| POST | `/api/customers` | 고객 생성 | EMPLOYEE+ |
| GET | `/api/customers/[id]` | 고객 상세 조회 | EMPLOYEE+ |
| PATCH | `/api/customers/[id]` | 고객 정보 수정 | EMPLOYEE+ |
| POST | `/api/customers/bulk-import` | 엑셀 대량 등록 | ADMIN/HEAD |
| GET | `/api/customers/check-duplicate` | 중복 체크 | EMPLOYEE+ |

### 관리자
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/admin/users` | 사용자 목록 | ADMIN |
| POST | `/api/admin/users/[id]/approve` | 사용자 승인 | ADMIN |
| POST | `/api/admin/users/[id]/reject` | 사용자 반려 | ADMIN |
| POST | `/api/admin/allocation` | 고객 배분 | ADMIN/HEAD |

### 일정 & 기타
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET/POST | `/api/visit-schedules` | 방문 일정 CRUD | EMPLOYEE+ |
| GET/POST | `/api/interest-cards` | 관심 카드 CRUD | EMPLOYEE+ |
| GET/POST | `/api/call-logs` | 통화 기록 CRUD | EMPLOYEE+ |

---

## 🗄️ 데이터베이스 스키마

### 핵심 모델

```prisma
// 사용자 (직원)
model User {
  id         String   @id @default(cuid())
  username   String   @unique
  email      String?  @unique
  name       String
  password   String?
  phone      String   @unique
  role       Role     @default(PENDING)  // PENDING → EMPLOYEE → TEAM_LEADER → HEAD → ADMIN
  isActive   Boolean  @default(true)
  approvedAt DateTime?
}

// 고객
model Customer {
  id              String        @id @default(cuid())
  name            String
  phone           String        @unique  // 숫자만 저장
  gender          Gender?
  ageRange        AgeRange?
  residenceArea   String?
  source          CustomerSource?  // AD/TM/FIELD/REFERRAL
  expectedBudget  Int?
  grade           CustomerGrade @default(C)  // A/B/C
  assignedUserId  String?
}

// 권한
model Permission {
  role       Role
  resource   String  // customers, reports, settings
  action     String  // view, create, update, delete, approve
  isAllowed  Boolean @default(true)

  @@unique([role, resource, action])
}

// 감사 로그
model AuditLog {
  userId     String
  action     String  // CREATE, UPDATE, DELETE, LOGIN
  entity     String  // Customer, Notice
  entityId   String?
  changes    Json?
  ipAddress  String?
  createdAt  DateTime @default(now())
}
```

### ERD 다이어그램
```
User (1) ─────< (N) Customer
  │                   │
  │                   │
  └─< Permission      ├─< InterestCard
  └─< AuditLog        ├─< VisitSchedule
                      └─< CustomerAllocation
```

---

## 🔄 개발 워크플로우

### Git 브랜치 전략

```
main (프로덕션)
  ↑
  └─ develop (개발)
       ↑
       ├─ feature/auth
       ├─ feature/customer-crud
       └─ hotfix/login-error
```

### 커밋 메시지 규칙
```
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 변경
style: 코드 포맷팅
refactor: 리팩토링
test: 테스트 추가/수정
chore: 빌드/설정 변경
```

**예시**:
```bash
git commit -m "feat: 고객 중복 체크 API 추가"
git commit -m "fix: 전화번호 정규화 로직 수정"
```

### Pull Request 체크리스트
- [ ] 테스트 통과 (Unit + E2E)
- [ ] 린트/타입 체크 통과
- [ ] README 업데이트 (API 변경 시)
- [ ] 마이그레이션 파일 포함 (스키마 변경 시)

---

## 🔧 트러블슈팅

### 1️⃣ Prisma 클라이언트 에러
**증상**: `@prisma/client` not found
```bash
# 해결
pnpm prisma generate
```

### 2️⃣ 마이그레이션 충돌
**증상**: Migration conflict
```bash
# 개발 환경: 마이그레이션 리셋
pnpm prisma migrate reset

# 프로덕션: 수동 해결
pnpm prisma migrate resolve --applied "migration_name"
```

### 3️⃣ NextAuth 세션 에러
**증상**: 로그인 후 바로 로그아웃됨
```bash
# .env 확인
NEXTAUTH_URL="http://localhost:3000"  # 정확한 URL 필요
NEXTAUTH_SECRET="..."  # 32자 이상
```

### 4️⃣ 빌드 에러 (Type Error)
```bash
# TypeScript 전체 체크
pnpm tsc --noEmit

# Prisma 타입 재생성
pnpm prisma generate
```

### 5️⃣ 데이터베이스 연결 실패
**증상**: Can't reach database server
```bash
# PostgreSQL 서비스 확인
# Windows
net start postgresql-x64-14

# Linux/Mac
sudo systemctl start postgresql
```

---

## 📞 문의 및 지원

- **이슈 트래킹**: GitHub Issues
- **개발 문서**: `/docs` 폴더
- **API 문서**: Swagger (개발 중)

---

## 🔒 보안 및 코드 보호

### 보안 정책

온시아 CRM은 다층 보안 전략을 적용합니다:

1. **접근 통제** (1차 방어선)
   - GitHub/Vercel 권한 관리
   - NextAuth 세션 인증
   - API Rate Limiting

2. **코드 난독화** (2차 방어선)
   - 프로덕션 빌드 자동 난독화
   - Console 로그 제거
   - 디지털 워터마크 삽입

3. **법적 보호** (3차 방어선)
   - 저작권 명시 (LICENSE)
   - 직원 NDA 계약
   - 비밀유지 의무

### 주요 보안 문서

- 📖 [`SECURITY.md`](./SECURITY.md) - 종합 보안 가이드
- 🔐 [`LICENSE`](./LICENSE) - 저작권 및 라이선스
- 👥 [`docs/GITHUB-VERCEL-PERMISSIONS.md`](./docs/GITHUB-VERCEL-PERMISSIONS.md) - 권한 관리
- 📝 [`docs/NDA-TEMPLATE.md`](./docs/NDA-TEMPLATE.md) - 직원 비밀유지계약서
- ✅ [`docs/OFFBOARDING-CHECKLIST.md`](./docs/OFFBOARDING-CHECKLIST.md) - 퇴사자 체크리스트

### 개발자 필독 사항

**⚠️ 절대 하지 말아야 할 것:**
- ❌ `.env` 파일을 Git에 커밋
- ❌ 개인 GitHub에 코드 업로드
- ❌ 코드 스크린샷 공유
- ❌ API 키를 하드코딩

**✅ 꼭 지켜야 할 것:**
- ✅ `.env.example`을 참고하여 `.env` 생성
- ✅ 회사 GitHub Repository에서만 작업
- ✅ 민감 정보는 환경변수로 관리
- ✅ 퇴사 시 `OFFBOARDING-CHECKLIST.md` 준수

### 프로덕션 빌드 보안 기능

```bash
# 프로덕션 빌드 시 자동 적용
pnpm build
```

자동으로 적용되는 보안 기능:
- ✅ 코드 난독화 (Terser)
- ✅ Console 로그 제거 (error/warn 제외)
- ✅ 소스맵 비활성화
- ✅ 디지털 워터마크 삽입
- ✅ 보안 헤더 설정

**개발 환경 (`pnpm dev`)에는 영향 없음** → 편리하게 개발하세요!

---

## 📄 라이선스

Copyright (c) 2025 Onsia Corporation. All Rights Reserved.

본 소프트웨어는 Onsia Corporation의 독점 자산이며,
무단 복제, 배포, 수정이 금지됩니다.

자세한 내용은 [`LICENSE`](./LICENSE) 파일을 참조하세요.

---

**Made with ❤️ & 🔒 by Onsia CRM Team**
