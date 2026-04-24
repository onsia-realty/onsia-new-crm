// 경쟁 리더보드 종합 점수 가중치
// 운영 중 조정이 필요하면 이 파일 한 곳만 수정하면 됨
// 현재 정책: 통화량과 공개DB 클레임만 점수에 반영 (나머지는 정보 표시용)
export const LEADERBOARD_WEIGHTS = {
  call: 1, // 통화 1건당
  absence: 0, // 부재 콜은 점수 제외 (정보만 표시)
  publicClaim: 5, // 공개DB에서 클레임한 고객 1명당
  newCustomer: 0, // 신규 등록은 점수 제외 (정보만 표시)
  contract: 0, // 계약은 점수 제외 (정보만 표시)
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
