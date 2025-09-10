당신은 시니어 풀스택 리드 엔지니어이자 제품/보안 아키텍트입니다. 아래 명세대로 “온시아 고객관리카드”를 중심으로 한 부동산 CRM(회사 공지 + 고객관리) 웹앱을 PC 우선으로 설계·구현하세요. 결과물은 에러 없이 로컬에서 즉시 구동되고, Vercel에 무중단 배포 가능해야 합니다.

0) 목표/제약

목표: 로그인(직원/관리자), 관리자의 가입 승인, 고객 관심카드 저장·검색, 공지 메인 노출, 방문일정 월별 표/그래프 체크, 엑셀로 고객번호 배분 관리.

1차 타깃: PC 화면 최적화(모바일은 후순위).

배포: Vercel. DB는 Vercel Postgres(또는 Supabase Postgres 선택 옵션).

필수: 타입세이프(Typescript), 폼/DTO 스키마 검증(Zod), 권한체크 미들웨어, 감사로그(Audit Log), 중복 고객/전화번호 탐지, 전화번호 표준화(숫자만 저장).

UI는 안정성 우선(예쁘되 과하지 않게). 컴포넌트는 shadcn/ui + TailwindCSS. 캘린더는 FullCalendar, 엑셀 파서는 SheetJS(xlsx). 차트는 Recharts.

코드 품질: ESLint/Prettier, Vitest/Playwright(기본 스펙 테스트 2~3개), GitHub Actions(빌드/리ント/테스트).

1) 기술 스택(고정)

Next.js 14(App Router) + TypeScript

Auth: NextAuth v5(Email OTP + Credentials), RLS는 앱단 권한 가드로 보완

DB: Prisma + Postgres(기본: Vercel Postgres; 대안: Supabase)

UI: Tailwind + shadcn/ui, Radix

State/서버: Server Actions + React Query(선택), Edge 호환 고려

파일/엑셀: SheetJS로 CSV/XLSX 파싱(클라이언트 업로드 → 서버 액션에 전달)

캘린더/차트: FullCalendar(월뷰), Recharts(월간 집계)

유효성: Zod 스키마 단일소스(폼/서버 공유)

로그/모니터링: audit_log 테이블 + 브라우저 콘솔 억제(프로덕션)

2) 도메인 & RBAC

역할(Role)

EMPLOYEE(직원), LEADER(팀장), HEAD(본부장), ADMIN(관리자)

상위 역할은 하위 권한 포함. 승인(Approve)은 ADMIN만.

핵심 규칙

회원가입은 누구나 가능 ➜ pending=true로 생성 ➜ ADMIN이 승인 시 활성화.

고객번호는 회사 엑셀 업로드로 배분: 엑셀에 있는 번호 블록을 팀/직원에게 할당.

전화번호는 숫자만 저장(010-1234-5678 → 01012345678) 및 유니크 제약(soft): 중복 시 경고와 병합 플로우 제공.

고객카드(“온시아 고객관리카드”)는 아래 스키마 참고.

3) DB 스키마(Prisma)

다음 Prisma 스키마를 생성하세요. (필드명은 영문, 한국어 라벨은 UI에서 매핑)

// prisma/schema.prisma
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String?
  name          String
  role          Role     @default(EMPLOYEE)
  teamId        String?
  team          Team?    @relation(fields: [teamId], references: [id])
  approved      Boolean  @default(false) // 관리자 승인 여부
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  // 관계
  announcements Announcement[] @relation("AuthorAnnouncements")
  visits        Visit[]
  allocations   Allocation[]   // 고객번호 배분 기록
  auditLogs     AuditLog[]
}

model Team {
  id        String  @id @default(cuid())
  name      String  @unique
  leaderId  String?
  leader    User?   @relation(fields: [leaderId], references: [id])
  users     User[]
}

enum Role { EMPLOYEE LEADER HEAD ADMIN }

model Customer {
  id             String   @id @default(cuid())
  name           String?
  phone          String   @db.VarChar(20) // 숫자만
  gender         String?  // 성별
  ageRange       String?  // 나이대
  residenceArea  String?  // 거주지역
  familyRelation String?  // 가족관계
  occupation     String?
  investHabit    String?  // 투자성향(시세차익/월수익/실거주)
  expectedBudget Int?     // 예상투자 가능금액(계약금 기준)
  ownAssets      String?  // 보유한 부동산(옵션 체크)
  lastVisitMH    String?  // 최근 방문 모델하우스
  notes          String?  // 특이사항
  source         String?  // 광고/TM/필드/소개 등
  createdById    String
  createdBy      User     @relation(fields: [createdById], references: [id])
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // 관계
  visits         Visit[]
  allocations    Allocation[]
  @unique(fields: [phone])
}

model Allocation {
  id          String   @id @default(cuid())
  customerId  String
  customer    Customer @relation(fields: [customerId], references: [id])
  assignedToId String
  assignedTo   User    @relation(fields: [assignedToId], references: [id])
  assignedById String
  assignedBy   User    @relation("AssignedBy", fields: [assignedById], references: [id])
  memo        String?
  createdAt   DateTime @default(now())
}

model Visit {
  id          String   @id @default(cuid())
  customerId  String
  customer    Customer @relation(fields: [customerId], references: [id])
  assigneeId  String
  assignee    User     @relation(fields: [assigneeId], references: [id])
  date        DateTime // 방문 예정일
  status      VisitStatus @default(SCHEDULED) // SCHEDULED/CHECKED/NO_SHOW
  note        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum VisitStatus { SCHEDULED CHECKED NO_SHOW }

model Announcement {
  id        String   @id @default(cuid())
  title     String
  content   String   // md 허용
  pinned    Boolean  @default(true)
  authorId  String
  author    User     @relation("AuthorAnnouncements", fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  action    String   // e.g., "LOGIN", "CREATE_CUSTOMER", "APPROVE_USER"
  targetId  String?
  meta      Json?
  ip        String?
  createdAt DateTime @default(now())
}

시드(필수)

Admin 계정 1개(admin@onsia.local, 비번 Admin!234)

기본 팀 1개(“1본부-1팀”).

더미 공지 1~2개.

4) 페이지/라우팅 구조

/login : 이메일+비밀번호 로그인, 이메일 OTP(선택)

/register : 직원 가입폼 → approved=false로 생성

/admin/approvals : 가입 승인/반려(ADMIN만)

/ : 메인 대시보드 — 상단 고정 공지 리스트(공지 상세 링크), 오늘 일정, 이번 달 방문 체크율, 나에게 배분된 신규 고객

/customers : 고객 리스트(검색/필터: 전화/이름/지역/투자성향/보유자산/예산 범위)

/customers/new : 온시아 고객관리카드 입력폼(이미지 참조 항목 매핑)

/customers/[id] : 상세 + 방문 이력 + 담당자/배분 내역

/calendar : 월뷰(FullCalendar) — 예방 체크 시 Visit.status=CHECKED 토글, 체크율 계산

/announcements : 공지 CRUD(작성/고정/수정/삭제: LEADER 이상, 기본 열람은 전체)

/allocations : 엑셀 업로드로 고객번호 배분(ADMIN/HEAD만)

/settings/profile : 내 프로필/비번 변경

/settings/teams : 팀/직원 관리(HEAD/ADMIN)

5) 주요 UX 사양

전화번호 입력 시 자동 숫자만 추출 저장. 중복이면 “기존 고객 열기 or 병합” 모달.

고객 리스트는 가벼운 무한스크롤 또는 서버페이지네이션.

캘린더 월뷰: 방문 건 클릭 → 사이드패널에서 체크/메모.

공지: pinned=true인 항목은 메인 상단에 카드 형태로 노출.

엑셀 업로드: 샘플 템플릿 다운로드 제공(컬럼: name, phone, region, team, assigneeEmail, memo) ➜ 서버에서 정규화+중복검사 후 고객 생성/배분 트랜잭션 처리.

6) API/액션 명세(요약)

회원가입/로그인: NextAuth, /api/auth/*

직원 승인: POST /api/admin/approve(id)

고객 CRUD: GET/POST/PATCH /api/customers

방문 일정: GET/POST/PATCH /api/visits(월 범위, 상태 토글)

공지: GET/POST/PATCH/DELETE /api/announcements

엑셀 배분: POST /api/allocations/upload(파일)

감사지표: 모든 변경 API는 AuditLog 기록(액션, 대상, IP, 메타)

각 API는 Zod DTO로 검증, 실패 시 4xx 메시지 한글화.

7) 보안/안정성

RBAC 미들웨어: 서버 액션/라우트에서 역할 검증 공통 유틸.

속도 제한: 인증/업로드 엔드포인트에 rate-limit.

에러 핸들러: 공통 오류 래퍼(토스트/다이얼로그).

트랜잭션: 고객 생성 + 배분 + 로그는 단일 트랜잭션.

백업/마이그레이션: Prisma migrate, .env.sample 제공.

8) 프로젝트 부트스트랩(자동으로 생성)

create-next-app + Tailwind + shadcn 설치 스크립트

Prisma 초기화, 스키마/마이그레이트、seed

기본 레이아웃/헤더/사이드바, ProtectedLayout

주요 페이지 스캐폴딩 + 예시 컴포넌트(고객카드 폼, 엑셀 업로드, 캘린더, 공지 리스트)

README.md에 로컬 실행 → Vercel 배포 단계 문서화

9) 수용 기준(꼭 지켜라)

pnpm dev 로 에러 없이 기동, /login 접근 가능.

관리자 계정으로 로그인 → 승인 대기 사용자 1명 승인 동작 확인.

샘플 엑셀 업로드 → 고객 10건 생성 및 팀/직원 배분 성공.

캘린더 월뷰에서 방문 체크 토글 정상 동작, 대시보드에 체크율 반영.

메인에서 공지 1개 이상 노출, 상세 진입 가능.

중복 전화번호 업로드 시 병합/열람 모달 표준 플로우 노출.

Vercel에 DATABASE_URL만 설정하면 배포 성공.

10) 지금 할 일

위 명세로 프로젝트 구조/폴더 트리와 핵심 파일을 생성.

.env.sample와 초기 마이그레이션/시드 스크립트 작성.

최소 페이지/컴포넌트를 구현하고 더미 데이터로 E2E 흐름 시연 가능하게 구성.

README.md에 다음을 문서화:

로컬: pnpm i && pnpm prisma migrate dev && pnpm prisma db seed && pnpm dev

배포: Vercel 연결 → DATABASE_URL 설정 → 빌드 → 마이그레이트

엑셀 템플릿/업로드 가이드, 중복 처리 규칙

간단한 Vitest 2~3개(전화번호 정규화, DTO 검증, RBAC 가드)와 Playwright 1개(로그인→승인→고객등록 happy path) 추가.