/**
 * VAPID 환경변수 검증 + 노출.
 * 서버 코드(API/lib)에서만 사용. 클라이언트는 NEXT_PUBLIC_VAPID_PUBLIC_KEY를
 * 직접 process.env에서 읽으면 됨 (Next.js가 빌드 타임에 인라인).
 */
export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let cached: VapidKeys | null = null;

/**
 * 모든 키가 설정되어 있는지 검증 후 반환.
 * 누락 시 throw — 호출 측이 fallback 로직 처리하기 좋음.
 */
export function getVapidKeys(): VapidKeys {
  if (cached) return cached;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      'VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in .env.local and Vercel env.'
    );
  }

  cached = { publicKey, privateKey, subject };
  return cached;
}

/**
 * VAPID 설정 여부만 확인 (throw 없이). UI에서 푸시 기능 활성/비활성 판단용.
 */
export function isVapidConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}
