// 순위 표시용 유틸 — 메달 이모지 + 숫자 fallback
export const MEDAL_EMOJI = ['🥇', '🥈', '🥉'] as const

/**
 * 1·2·3위는 메달 이모지, 그 이외는 숫자.
 * rank는 1부터 시작.
 */
export function rankLabel(rank: number): string {
  return MEDAL_EMOJI[rank - 1] ?? String(rank)
}
