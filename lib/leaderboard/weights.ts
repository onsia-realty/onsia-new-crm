// 경쟁 리더보드 종합 점수 가중치
// 운영 중 조정이 필요하면 이 파일 한 곳만 수정하면 됨
export const LEADERBOARD_WEIGHTS = {
  call: 1, // 통화 1건당
  absence: 0.3, // 부재 콜 1건당 (전화 시도 의지)
  publicClaim: 5, // 공개DB에서 클레임한 고객 1명당
  newCustomer: 3, // 신규 고객 등록 1명당
  contract: 50, // 계약 성사 1건당 (InterestCard.status=COMPLETED)
} as const;

export type LeaderboardWeights = typeof LEADERBOARD_WEIGHTS;

export interface LeaderboardMetrics {
  callCount: number;
  absenceCallCount: number;
  publicClaimCount: number;
  newCustomerCount: number;
  contractCount: number;
}

export function calculateTotalScore(m: LeaderboardMetrics): number {
  const score =
    m.callCount * LEADERBOARD_WEIGHTS.call +
    m.absenceCallCount * LEADERBOARD_WEIGHTS.absence +
    m.publicClaimCount * LEADERBOARD_WEIGHTS.publicClaim +
    m.newCustomerCount * LEADERBOARD_WEIGHTS.newCustomer +
    m.contractCount * LEADERBOARD_WEIGHTS.contract;
  return Math.round(score * 10) / 10;
}
