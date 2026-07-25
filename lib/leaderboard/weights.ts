// 경쟁 리더보드 종합 점수 가중치
// 운영 중 조정이 필요하면 이 파일 한 곳만 수정하면 됨
// 정책 (2026-04-30 회의 결정): 광고콜 시상 연동 — 일 많이 하는 사람에게 콜 베네핏
//   통화 1점 / CRM 등록 2점 / 전환(계약) 5점
//   부재/공개DB 클레임은 정보만 표시
export const LEADERBOARD_WEIGHTS = {
  call: 1, // 통화 1건당
  absence: 0, // 부재 콜은 점수 제외 (정보만 표시)
  publicClaim: 0, // 공개DB 클레임은 점수 제외 (정보만 표시)
  blindClaim: 0, // 블라인드DB 클레임 — 공개DB와 동일 정책(정보만 표시). 기존 점수·순위 불변
  newCustomer: 2, // CRM 신규 등록 1건당
  contract: 5, // 계약(InterestCard.COMPLETED) 1건당
} as const;

export type LeaderboardWeights = typeof LEADERBOARD_WEIGHTS;

export interface LeaderboardMetrics {
  callCount: number;
  absenceCallCount: number;
  publicClaimCount: number;
  blindClaimCount?: number;
  newCustomerCount: number;
  contractCount: number;
}

export function calculateTotalScore(m: LeaderboardMetrics): number {
  const score =
    m.callCount * LEADERBOARD_WEIGHTS.call +
    m.absenceCallCount * LEADERBOARD_WEIGHTS.absence +
    m.publicClaimCount * LEADERBOARD_WEIGHTS.publicClaim +
    (m.blindClaimCount ?? 0) * LEADERBOARD_WEIGHTS.blindClaim +
    m.newCustomerCount * LEADERBOARD_WEIGHTS.newCustomer +
    m.contractCount * LEADERBOARD_WEIGHTS.contract;
  return Math.round(score * 10) / 10;
}
