// 블라인드DB 정책 상수
// 운영 중 조정이 필요하면 이 파일 한 곳만 수정하면 됨
// 취지: 이전 담당자의 판단(통화 횟수·메모·이름)을 지워서 "손 많이 탄 번호"를
//   골라내지 못하게 한다. 클레임(가져가기) 전에는 전화번호만 보인다.
export const BLIND_DB_TARGET_PER_USER = 300 // 1인당 등록 목표치 (진행률 표시용, 강제 아님)
export const BLIND_ADMIN_BYPASS = true // ADMIN/CEO 전체 열람 (CS·중복정리 목적)
export const BLIND_OWNER_SEES_OWN = true // 원 소유자는 자기 등록건 상세 열람 가능 (회수용)
export const BLIND_NAME_PLACEHOLDER = '🕶️ 블라인드'
export const BLIND_ALLOCATION_REASON = '블라인드DB로 전환'
export const BLIND_CLAIM_REASON = '블라인드DB에서 클레임'
export const BLIND_RECLAIM_REASON = '블라인드DB 회수'
