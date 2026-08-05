# 온시아 CRM 초창기 기록 (2025-09)

현재 프로젝트(`D:\claude\onsia_crm2`)의 출발점이 된 구 폴더 `D:\claude\onsia_CRM`의 기록입니다.
구 폴더는 정리(삭제)했으며, 내용은 전부 현재 저장소 git 히스토리와 GitHub 원격에 남아 있습니다.

## 1. 정체

`onsia_CRM`은 별개 프로젝트가 아니라 **현재 프로젝트의 조상(ancestor)**이었습니다.

- 구 폴더 HEAD: `14008b0` (2025-09-12) — 이 커밋이 현재 저장소 히스토리 안에 그대로 존재
- 구 폴더는 초기 2커밋에서 멈췄고, 현재 저장소는 그 위에 300커밋 이상을 쌓음
- 두 시점 차이: 376개 파일, +69,292 / −4,489줄

```
e5ecedc  2025-09-11  feat: 온시아 CRM 시스템 초기 구현
14008b0  2025-09-12  fix: 포트 설정 및 Claude Code 설정 업데이트   ← 구 폴더가 멈춘 지점
8cac74d  2025-09-12  🔥 온시아 CRM 고객관리 시스템 완성            ← 현재 저장소가 이어감
...
```

## 2. 두 갈래 계보

구 폴더에는 서로 이어지지 않는 두 계보가 있었습니다.

| 계보 | 커밋 | 시기 | 현재 저장소 포함 여부 |
|---|---|---|---|
| `master` | `e5ecedc` → `14008b0` | 2025-09-11~12 | **포함됨** (현재 히스토리의 뿌리) |
| `origin/main` | `440c9cd` → `30dd1fa` | 2025-09-08~09 | 미포함 (폐기된 초기 프로토타입) |

`origin/main` 계보는 `master`로 대체된 더 오래된 시도였고, 현재 코드에 있는
`components/ui/alert.tsx`, `switch.tsx`, `lib/auth.config.edge.ts` 등이 **오히려 없는**
구버전이었습니다. 고유 파일은 두 개뿐이었습니다.

- `prisma/dev.db` (196KB SQLite) — **실데이터 0건**. 전화번호·이메일 문자열 검색 결과 0건, 스키마만 있는 빈 파일
- `prisma/migrations/*/migration.sql` — SQLite용 초기 마이그레이션. 현재는 Postgres라 무용

## 3. 초기 기술 스택 (2025-09 기준)

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 15.5.2 (App Router), React 19.1.0, TypeScript |
| 인증 | NextAuth v5 beta + `@auth/prisma-adapter`, bcryptjs |
| DB | Prisma 6.15 (초기엔 SQLite dev.db → 이후 Postgres) |
| UI | Tailwind v4, shadcn/ui, Radix, lucide-react, sonner |
| 상태 | TanStack Query v5, zustand |
| 폼/검증 | react-hook-form + zod v4 |
| 캘린더/차트 | FullCalendar 6.1, recharts 3.1 |
| 엑셀 | xlsx (SheetJS) 0.18 |
| 테스트 | Playwright 1.55, Testing Library |

## 4. 초기 DB 스키마 (모델 9개)

`User`, `Customer`, `InterestCard`, `VisitSchedule`, `Notice`, `AuditLog`,
`CallLog`, `CustomerAllocation`, `Permission`

Role enum: `PENDING` / `EMPLOYEE` / `TEAM_LEADER` / `HEAD` / `ADMIN`

초기 시드: 관리자 계정 `admin` (`admin@onsia.local`, 부서 경영지원팀) + role×resource×action
매트릭스 형태의 `Permission` 레코드 일괄 생성.

> 현재 스키마는 모델 26개 이상으로 확장됨 — `TransferRequest`, `DailyTodo`, `Prize`/`PrizeWinner`,
> `AdCallNumber`/`AdCallAward`, `Blacklist`, `DailyReport`, `Discussion` 등이 이후 추가되었습니다.

## 5. 원본 기획 명세

구 폴더의 `claude.md`에 담겨 있던 최초 기획 명세(0~10번 항목: 목표/제약, 기술 스택 고정,
RBAC, Prisma 스키마 초안, 페이지 구조, UX 사양, API 명세, 보안, 수용 기준)는
**현재 저장소 루트의 `CLAUDE.md`에 그대로 살아 있습니다.** 별도 보존이 필요 없습니다.

참고로 명세 초안의 스키마(`Team`, `Allocation`, `Visit`, `Announcement`)는 실제 구현에서
`CustomerAllocation`, `VisitSchedule`, `Notice` 등으로 이름이 바뀌었습니다.

`README.md`는 `create-next-app` 기본 보일러플레이트였습니다.

## 6. 복구 방법

구 폴더를 지웠어도 전부 되살릴 수 있습니다.

```bash
# master 계보 (= 현재 프로젝트의 뿌리) — 현재 저장소에서 바로 열람
git show 14008b0:claude.md
git show 14008b0:prisma/schema.prisma
git ls-tree -r --name-only 14008b0

# 구 폴더 전체 (두 계보·5개 ref 모두) — 로컬 번들로 보존
# D:\claude\_archive\onsia_CRM_2025-09.bundle  (265KB, "complete history" 검증 완료)
git clone D:/claude/_archive/onsia_CRM_2025-09.bundle 복구할경로

# origin/main 폐기 계보는 GitHub에도 남아 있음
# https://github.com/onsia-realty/onsia_CRM  (branch: main, commit 30dd1fa)
```

현재 저장소 원격은 별도입니다: `https://github.com/onsia-realty/onsia-new-crm`
