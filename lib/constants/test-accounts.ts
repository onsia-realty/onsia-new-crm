/**
 * 테스트/비실사용 계정 목록.
 *
 * 이 계정들은 DB상 일반 직원(role=EMPLOYEE, isActive=true)과 구분되지 않으므로
 * 리더보드·시상 보드·통계 등 "실제 직원" 집계에서 제외할 때 ID로 명시 관리한다.
 * 새 테스트 계정이 생기면 이 배열에 추가하면 된다.
 */
export const TEST_ACCOUNT_USER_IDS: string[] = [
  'cmh313nlb0000jp04qvs2sodz', // 테스트 11 (username: Test01)
];

/** 주어진 userId가 테스트 계정인지 여부 */
export function isTestAccount(userId: string): boolean {
  return TEST_ACCOUNT_USER_IDS.includes(userId);
}
