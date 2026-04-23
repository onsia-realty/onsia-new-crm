import { getKoreaTodayStart, getKoreaNow } from '@/lib/date-utils';

export type LeaderboardPeriod = 'today' | 'week' | 'month';

export function parsePeriod(value: string | null | undefined): LeaderboardPeriod {
  if (value === 'today' || value === 'week' || value === 'month') return value;
  return 'week';
}

/**
 * KST 기준 기간 범위 계산
 * - today: 오늘 00:00 ~ 내일 00:00
 * - week: 이번 주 월요일 00:00 ~ 내일 00:00 (월요일 시작 기준)
 * - month: 이번 달 1일 00:00 ~ 내일 00:00
 */
export function getPeriodRange(period: LeaderboardPeriod): { from: Date; to: Date } {
  const todayStart = getKoreaTodayStart();
  const to = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  if (period === 'today') {
    return { from: todayStart, to };
  }

  if (period === 'week') {
    const now = getKoreaNow();
    const dayOfWeek = now.getDay(); // 일=0, 월=1, ..., 토=6
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const from = new Date(todayStart.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  // month
  const koreaNow = getKoreaNow();
  const firstOfMonth = new Date(koreaNow);
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);
  return { from: firstOfMonth, to };
}
