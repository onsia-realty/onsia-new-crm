# 관리 오더 잠금(Lock) 기능 설계

작성일: 2026-07-16

## 배경 / 목적

부재(마지막 통화가 '부재')인 고객이라도 직원이 실제로 관리 중인 "관리 오더"가 있다.
부재 DB를 공개DB로 대량 회수할 때, 이런 관리 오더까지 딸려 가면 직원이 관리하던
고객을 잃는다. 직원(또는 관리자)이 개별 오더를 **잠가서 공개DB 회수 대상에서
제외**할 수 있게 한다.

부재 판정 정의(앱 기준, `app/api/customers/route.ts` `showAbsenceOnly`):
`isDeleted=false` + `assignedUserId` 있음 + 가장 최근 `CallLog.content` 에 '부재' 포함.

## 범위 (확정된 요구사항)

- **잠금/해제 권한**: 담당 직원 본인 + 관리자(ADMIN/CEO). 그 외 직원은 남의 오더 잠금/해제 불가.
- **잠금이 막는 것**: **공개DB 회수만**. 현장이동·LMS광고·담당이관·일괄삭제 등 다른 이동은 막지 않는다.
- **잠금 UI**: 고객 상세 페이지의 개별 토글만. (목록에서 일괄 잠금은 하지 않음)
- **목록 표시**: 목록 행에 읽기 전용 🔒 배지 노출(관리자가 회수 전 잠긴 건 식별용).
- **비범위**: 관리자 수동 `mark-public` 공개전환에는 잠금 가드를 넣지 않는다(회수 경로만 enforce).

## 데이터 모델

`Customer` 모델에 필드 3개 추가:

```prisma
locked      Boolean   @default(false)  // 관리 오더 잠금 — 공개DB 회수 차단
lockedAt    DateTime?                   // 잠근 시각
lockedById  String?                     // 잠근 사람 ID (감사용)
```

- 기본값 `false` → 기존 레코드 안전. 인덱스는 추가하지 않음(회수 쿼리는 이미 `assignedUserId`로 필터).
- 마이그레이션: `prisma migrate`로 컬럼 추가. 프로덕션(Neon)에도 동일 적용.

## 토글 API

`PATCH /api/customers/[id]/lock`

- 요청 body: `{ locked: boolean }` (Zod 검증).
- 인증: 세션 필수.
- 인가: `customer.assignedUserId === session.user.id` **또는** `role ∈ {ADMIN, CEO}`. 아니면 403.
- 동작: `locked` 갱신, `locked=true`면 `lockedAt=now, lockedById=userId`, `locked=false`면 둘 다 `null`.
- 감사: `AuditLog` action `LOCK` / `UNLOCK`, entity `Customer`, entityId=고객ID.
- 응답: `{ success, locked, lockedAt }`.
- 구현 참고: 기존 `app/api/customers/[id]/mark-disconnected/route.ts` 와 동일한 구조를 따른다.

## UI

### 고객 상세 페이지 (`app/dashboard/customers/[id]/page.tsx`)

- 기존 `togglingMaterial`(자료발송 토글) 패턴을 복제한 `togglingLock` 상태 + 핸들러.
- 액션 영역에 🔒 버튼:
  - 잠금 안 됨 → "관리 오더 잠금" (자물쇠 열림 아이콘)
  - 잠김 → "잠금 해제" + 잠근 사람/시각 표시 (자물쇠 닫힘)
- 노출 조건: 담당 직원 본인 또는 관리자. 그 외에는 잠김 상태 배지만(토글 없음).

### 고객 목록 (`app/dashboard/customers/page.tsx`)

- 각 행에 읽기 전용 🔒 배지(잠긴 경우). 토글 아님.
- 목록 API 응답(`app/api/customers/route.ts`)의 각 고객 객체에 `locked` 포함
  (select에 필드 추가; 이미 반환되는 필드 옆에 추가).

## 차단 지점 (공개DB 회수)

### 1. `app/api/admin/reclaim-customers/route.ts`

- `whereClause` 에 `locked: false` 추가 → 잠긴 고객은 회수에서 제외.
- 회수 대상 조회 시 전체 대상 수와 잠금 제외 수를 계산해 응답 메시지에 "잠금 제외 N건" 포함.

### 2. 부재 → 공개DB 일괄 스크립트 (`scripts/`)

- 회수 대상 쿼리에 `AND c."locked" = false` 추가.
- LMS 수기등록(`lmsEligible OR lmsAd OR assignedSite='LMS 수기DB'`) 제외 조건과 함께 적용.

## 테스트

- Vitest (`app/api/customers/[id]/lock`):
  - 담당 본인 → 200, locked 토글됨.
  - 남의 오더(비관리자) → 403.
  - 관리자 → 200.
- 회수 쿼리 단위 검증: `locked=true` 고객이 회수 대상에서 빠지는지(정의된 where 필터 확인).

## 롤아웃 순서

1. 스키마 필드 + 마이그레이션.
2. 토글 API + 상세 페이지 토글 UI.
3. 목록 API `locked` 반환 + 목록 🔒 배지.
4. `reclaim-customers` 잠금 제외 + 일괄 스크립트 잠금 제외.
5. 프로덕션 마이그레이션 후 배포.
