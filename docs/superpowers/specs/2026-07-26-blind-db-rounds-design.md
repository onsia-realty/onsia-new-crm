# 블라인드DB 차수제 + 참여도 게이트 설계

작성일: 2026-07-26

## 배경

블라인드DB는 사장된 DB를 익명 풀에 모아 다른 직원이 가져가는 기능이다. 1차 운영에서
직원 5명이 각 300건씩 총 1,500건을 등록했고, 풀은 이미 오픈된 상태다.

현재 구조에는 두 가지가 빠져 있다.

1. **참여도 강제가 없다.** 한 건도 내놓지 않은 직원도 풀 전체를 가져갈 수 있다.
   실제로 테스트 계정(Test01, 등록 0건)이 1,500건 전체를 열람하는 것이 확인됐다
   (제외 로직 자체는 정상 — 뺄 대상이 없었을 뿐).
2. **차수 개념이 없다.** "다 소진되면 다시 300건씩 모아 새로 시작"하는 운영을
   표현할 수 없다. LMS광고의 1차·2차와 같은 구조가 필요하다.

## 목표

- 현재 차수에 300건을 등록하지 않은 직원은 **가져갈 수 없다**.
- 1인당 **정확히 300건**까지만 등록된다 (301건 같은 초과 상태가 생기지 않는다).
- 풀이 전부 소진되면 관리자가 다음 차수를 시작하고, 참여도는 차수마다 리셋된다.
- 관리자(ADMIN/CEO)는 게이트·상한 모두 면제한다 (CS·중복정리 목적).

## 비목표 (YAGNI)

- 차수 강제 시작(잔여가 남은 상태에서 넘기기) — 관리자가 잔여를 회수하면 잔여 0이 되어
  버튼이 열리므로 별도 기능을 만들지 않는다.
- 이월 횟수 제한, 차수별 시상/집계 리포트.
- 상한 검사의 완전한 동시성 차단(아래 "알려진 한계" 참조).

## 데이터 모델

### Customer

```prisma
blindRound Int? // 올라간 차수. 전환 시 기록, 클레임돼도 유지, 회수 시 null
@@index([blindById, blindRound]) // 차수별 참여도 집계
```

`blindById`와 생애주기를 완전히 공유한다.

| 사건 | isBlind | blindById | blindRound |
|---|---|---|---|
| 전환(직원이 내놓음) | true | 본인 | 현재 차수 |
| 클레임(남이 가져감) | false | **유지** | **유지** |
| 회수(원 소유자 복귀) | false | null | **null** |

이 규칙 덕분에 참여도는 "남이 많이 가져가도 줄지 않고, 내가 회수하면 줄어드는" 값이 된다.
좋은 DB를 내놓은 직원이 불이익을 받지 않는 것이 이 설계의 핵심이다.

### AppConfig `blindDb.state`

```ts
type BlindDbState = {
  open: boolean
  openedAt: string | null
  shuffleSeed: string | null
  openedById: string | null
  round: number // 신규. 현재 차수 (1부터)
}
```

`parseState`는 Json 필드이므로 형태를 보장할 수 없다. `round`가 숫자가 아니거나 1보다
작으면 **1로 폴백**한다 (기존 폴백 정책과 동일하게 fail-safe).

### 백필

기존 데이터를 1차로 귀속시킨다.

```sql
UPDATE "Customer" SET "blindRound" = 1 WHERE "blindById" IS NOT NULL;
```

`isBlind = false`인 행(이미 클레임된 건)도 포함해야 한다 — 참여도는 `blindById` 기준이므로
빠뜨리면 1차 기여가 0으로 집계된다. AppConfig의 `round`도 1로 초기화한다.

## 참여도 판정

```
현재 차수 기여 = count(Customer where blindById = 나 AND blindRound = 현재차수 AND isDeleted = false)
```

순수 함수로 분리해 단위 테스트 대상으로 삼는다.

```ts
// lib/blind-db/quota.ts
export function canClaim(opts: { contributed: number; isAdmin: boolean }): boolean
export function checkQuotaBeforeAdd(opts: {
  contributed: number
  adding: number
  isAdmin: boolean
}): { ok: true } | { ok: false; allowed: number; message: string }
```

정원 상수는 `BLIND_DB_TARGET_PER_USER`(=300)를 그대로 쓴다. 지금까지 "표시용 목표"였던
값이 이제 **강제 기준**이 되므로 상수 주석을 그에 맞게 고친다. 조정이 필요하면 여전히
`lib/constants/blind-db.ts` 한 곳만 수정하면 된다.

## 서버 변경

### 1. 클레임 게이트 — `POST /api/customers/[id]/blind-claim`

기존 검사(오픈 게이트 → 본인 등록건 여부 → blindAt 유효성 → 통화 기록)에 이어,
관리자가 아니면 참여도를 검사한다.

```
403 "2차는 300건 등록 후 가져갈 수 있습니다. (현재 240/300)"
```

서버가 최종 판정자다. UI 비활성화는 보조 수단일 뿐이다.

### 2. 상한 300 — `PATCH /api/customers/mark-blind` (isBlind=true 분기)

`eligible` 계산 직후, 실제 `updateMany` **이전**에 검사한다. 초과면 **한 건도 등록하지
않고** 거부한다.

```
400 "1인 300건까지만 등록할 수 있습니다. 현재 290건 등록됨 — 10건만 선택해주세요."
```

등록 시 `blindRound: 현재차수`를 함께 기록한다. 응답의 진행률(`progress`)도 현재 차수
기준으로 계산한다.

### 3. 차수 전환 — `POST /api/blind-db/open` 에 `nextRound` 액션 추가

```ts
const openSchema = z.object({
  open: z.boolean().optional(),
  reshuffle: z.boolean().optional(),
  nextRound: z.boolean().optional(),
}).refine(적어도 하나 지정)
```

- 권한: ADMIN/CEO (기존과 동일)
- **조건: 현재 풀 잔여(`isBlind = true, isDeleted = false`)가 0이어야 한다.**
  남아 있으면 `409`로 거부하고 잔여 수를 알린다:
  `"잔여 37건이 남아 있습니다. 전부 소진되거나 회수된 뒤에 다음 차수를 시작할 수 있습니다."`
- 실행: `round += 1`, `shuffleSeed` 재발급, `openedAt` 갱신, `open`은 true 유지
- 감사 로그: `action: 'OPEN_BLIND_DB'`, `changes.action = 'next_round'`, before/after round 기록

잔여가 0이므로 이월 대상이 없다 — 미소진 건 처리 로직이 따로 필요하지 않다.

### 4. 통계 — `GET /api/blind-db/stats`

추가 필드:

| 필드 | 의미 |
|---|---|
| `round` | 현재 차수 |
| `myContributed` | **현재 차수** 기여 수 (게이트 기준). 기존의 "체류 기준"에서 의미 변경 |
| `myResident` | 내가 올린 건 중 아직 풀에 남은 수 (안내 카드 문구 계산용) |
| `canClaim` | 게이트 통과 여부 (관리자는 항상 true) |
| `poolRemaining` | 풀 잔여 — 관리자 "다음 차수 시작" 버튼 활성 판정용 |

`byUser` 그리드도 현재 차수 기준으로 집계한다 (`blindRound = round`).

진행률(`percent`)을 체류 기준에서 차수 기여 기준으로 바꾸는 것이 이번 변경의 핵심 중
하나다. 기존 방식은 남이 내 DB를 가져갈수록 내 진행률이 내려가 참여도와 어긋났다.

## UI 변경 — `app/dashboard/customers/page.tsx`

1. **안내 카드 문구 통합.** 지금은 카드에 `전체 1,500명`, 좌측 상단에 `잔여`가 따로 떠서
   같은 화면의 두 숫자가 달라 혼동을 준다. 한 줄로 합친다:
   `2차 진행 중 · 전체 1,500명 · 내가 올린 300건 제외 → 가져갈 수 있는 1,200명`
2. **미달 직원.** 목록과 전화번호는 그대로 노출하고 **가져가기 버튼만 비활성**한다.
   상단에 배너: `2차는 300건 등록 후 가져갈 수 있습니다 (현재 240/300)`.
3. **관리자 전용 "다음 차수 시작" 버튼.** `poolRemaining === 0`일 때만 활성.
   비활성 시 사유를 함께 표시: `잔여 37건 — 전부 소진되어야 시작 가능`.
   실행 전 확인 다이얼로그로 차수 증가를 명시한다.

## 테스트

- `tests/blind-db-quota.test.ts` (신규): `canClaim`, `checkQuotaBeforeAdd`의 경계값
  — 299/300/301, `adding`이 남은 정원을 넘는 경우, 관리자 면제, 음수·0 입력 방어
- `tests/blind-db-mask.test.ts` (기존): 응답 화이트리스트에 `blindRound`가 새지 않는지
  확인 — 차수는 마스킹 대상이 아니지만 허용 키 목록은 명시적으로 유지한다

## 알려진 한계

상한 검사와 등록 사이가 단일 트랜잭션이 아니다 (기존 `mark-blind`가 500건 배치 루프
구조). 같은 직원이 두 창에서 동시에 전송하면 이론상 300을 살짝 넘길 수 있다. 실사용
위험이 낮아 이번에는 검사 1회로 두고, 초과 사례가 관측되면 트랜잭션화한다.

## 마이그레이션 순서

1. `schema.prisma`에 `blindRound` + 인덱스 추가 → `prisma generate` → `db push`
   (dev 서버 종료 상태에서, 프로덕션 DB에 직접 반영됨)
2. 백필 스크립트 실행 (`blindRound = 1`, AppConfig `round = 1`)
3. 서버 코드 배포
4. UI 배포

`blindRound`가 nullable이므로 1~2 사이에 코드가 먼저 돌아도 게이트가 fail-closed로
동작한다(기여 0으로 집계 → 클레임 차단). 데이터 손상은 없고, 백필 즉시 정상화된다.
