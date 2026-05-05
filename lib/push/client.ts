/**
 * 클라이언트 사이드 푸시 구독 헬퍼.
 * /calls 등 클라이언트 컴포넌트에서 사용.
 */

/**
 * VAPID base64url 공개키를 PushManager.subscribe가 요구하는 형태로 변환.
 * Uint8Array<ArrayBuffer> 형태가 되도록 ArrayBuffer를 명시적으로 할당.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushPermissionState =
  | 'unsupported' // 브라우저가 PushManager 미지원
  | 'denied' // 사용자가 권한 거부 (OS/브라우저 설정에서 풀어야)
  | 'default' // 아직 권한 요청 안 했음
  | 'granted-not-subscribed' // 권한은 OK인데 구독 객체 없음 (구독 갱신 필요)
  | 'subscribed'; // 정상 구독 중

/**
 * 현재 단말의 푸시 권한/구독 상태 진단.
 */
export async function getPushState(): Promise<PushPermissionState> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return 'unsupported';
  }

  const perm = Notification.permission;
  if (perm === 'denied') return 'denied';
  if (perm === 'default') return 'default';

  // permission === 'granted'
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'granted-not-subscribed';
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'subscribed' : 'granted-not-subscribed';
}

/**
 * 권한 요청 → 구독 → 서버 등록까지 전체 플로우.
 * 반드시 user gesture(클릭 등)에서 호출해야 함 (Notification.requestPermission 제약).
 */
export async function enablePush(scope: 'calls' | 'crm' = 'calls'): Promise<{
  ok: boolean;
  state: PushPermissionState;
  error?: string;
}> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return { ok: false, state: 'unsupported', error: '이 브라우저는 푸시를 지원하지 않습니다.' };
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return {
      ok: false,
      state: 'unsupported',
      error: '서버에 VAPID 키가 설정되지 않았습니다.',
    };
  }

  // 1) 권한 요청
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    return {
      ok: false,
      state: perm === 'denied' ? 'denied' : 'default',
      error: '알림 권한이 거부되었습니다. 브라우저 설정에서 허용으로 바꿔주세요.',
    };
  }

  // 2) Service Worker 준비 대기
  const reg = await navigator.serviceWorker.ready;

  // 3) 기존 구독이 있으면 재사용, 없으면 새로 만들기
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true, // 모든 푸시는 가시적 알림 표시 (Chrome 강제)
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  // 4) 서버에 등록
  const json = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, state: 'granted-not-subscribed', error: '구독 객체가 손상되었습니다.' };
  }

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint,
      keys: { p256dh, auth },
      userAgent: navigator.userAgent,
      scope,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      state: 'granted-not-subscribed',
      error: `서버 등록 실패: ${res.status} ${text.slice(0, 100)}`,
    };
  }

  return { ok: true, state: 'subscribed' };
}

/**
 * 단말에서 구독 해지 + 서버 row 삭제.
 */
export async function disablePush(): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: true };
  }
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { ok: true };

  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: true };

  // 단말에서 unsubscribe 먼저 (실패해도 서버에선 지움)
  try {
    await sub.unsubscribe();
  } catch (err) {
    console.warn('[push] PushSubscription.unsubscribe failed:', err);
  }

  const res = await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });

  if (!res.ok) {
    return { ok: false, error: `서버 해지 실패: ${res.status}` };
  }
  return { ok: true };
}
