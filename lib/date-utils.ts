/**
 * 한국 시간대(KST) 기준으로 오늘 자정 Date 객체 반환
 * DB에 저장할 때 사용 (Date 타입 필드용)
 */
export function getKoreaToday(): Date {
  const now = new Date();
  // 한국 시간으로 변환
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  koreaTime.setHours(0, 0, 0, 0);
  return koreaTime;
}

/**
 * 한국 시간대 기준 오늘 시작 시간 (00:00:00)
 */
export function getKoreaTodayStart(): Date {
  const today = getKoreaToday();
  return today;
}

/**
 * 한국 시간대 기준 오늘 종료 시간 (23:59:59.999)
 */
export function getKoreaTodayEnd(): Date {
  const today = getKoreaToday();
  return new Date(today.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * 한국 시간대 기준 현재 시간
 */
export function getKoreaNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}
