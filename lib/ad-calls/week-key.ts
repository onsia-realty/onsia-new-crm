import { getKoreaNow } from '@/lib/date-utils';

/**
 * 광고콜 시상 주간 인덱스 유틸 (월요일 시작 기준)
 *
 * weekKey 포맷: "YYYY-Www" (예: "2026-W18")
 * - 주의 시작: 월요일 00:00 KST
 * - 주의 끝: 다음 월요일 00:00 KST (exclusive)
 * - ISO 8601 주차 번호 사용 (1주 = 그 해 첫 목요일이 속한 주)
 */

/**
 * Date → ISO 주차 번호 계산 (월요일 시작)
 */
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO 주: 목요일이 속한 해의 주차
  const dayNum = d.getUTCDay() || 7; // 일요일=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 목요일로 이동
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNum };
}

/**
 * 한국 현재 시각의 주간 키 ("YYYY-Www")
 */
export function getCurrentWeekKey(): string {
  const now = getKoreaNow();
  const { year, week } = getISOWeek(now);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * 임의 Date의 주간 키
 */
export function getWeekKey(date: Date): string {
  const { year, week } = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * weekKey 검증: "YYYY-Www" 형식인지
 */
export function isValidWeekKey(key: string): boolean {
  return /^\d{4}-W\d{2}$/.test(key);
}

/**
 * weekKey → 해당 주의 시작/끝 Date (KST 기준 월요일 00:00 ~ 다음 월요일 00:00)
 */
export function getWeekRange(weekKey: string): { from: Date; to: Date } {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) throw new Error(`Invalid weekKey: ${weekKey}`);
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // ISO 8601: 1월 4일이 속한 주가 1주차
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // 일=7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  const from = new Date(week1Monday);
  from.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + 7);

  return { from, to };
}

/**
 * 주간 키 N주 전/후 (offset: -1 = 지난주, +1 = 다음주)
 */
export function shiftWeekKey(weekKey: string, offset: number): string {
  const { from } = getWeekRange(weekKey);
  const shifted = new Date(from);
  shifted.setUTCDate(from.getUTCDate() + offset * 7);
  return getWeekKey(shifted);
}

/**
 * 주간 라벨 (UI 표시용): "이번 주" / "지난주" / "지지난주" / "YYYY-MM-DD ~ MM-DD"
 */
export function getWeekLabel(weekKey: string): string {
  const current = getCurrentWeekKey();
  if (weekKey === current) return '이번 주';
  if (weekKey === shiftWeekKey(current, -1)) return '지난주';
  if (weekKey === shiftWeekKey(current, -2)) return '지지난주';
  const { from, to } = getWeekRange(weekKey);
  const end = new Date(to);
  end.setUTCDate(end.getUTCDate() - 1);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return `${fmt(from)} ~ ${fmt(end).slice(5)}`;
}
