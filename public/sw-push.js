/* eslint-disable no-restricted-globals */
/**
 * Web Push 이벤트 핸들러 — next-pwa 자동생성 sw.js에 importScripts로 통합됨.
 * (next.config.ts의 withPWA 옵션에 importScripts: ['/sw-push.js'] 설정)
 *
 * 두 가지 이벤트 처리:
 *   1. push          : 서버에서 푸시 도착 → OS 알림 표시
 *   2. notificationclick : 사용자가 알림 탭 → 해당 URL로 이동/포커스
 */

self.addEventListener('push', (event) => {
  let payload = {
    title: '온시아 콜',
    body: '새 알림이 도착했습니다.',
    url: '/calls',
    tag: 'default',
    icon: '/calls-icon-192.png',
    badge: '/calls-icon-192.png',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch (err) {
    console.warn('[sw-push] payload parse failed:', err);
  }

  const showPromise = self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    data: { url: payload.url },
    // requireInteraction: 사용자가 직접 닫을 때까지 알림 유지 (Android only)
    requireInteraction: false,
    // 진동 패턴 (모바일)
    vibrate: [200, 100, 200],
    // 알림이 새로 도착할 때 소리/진동/배너를 갱신
    renotify: !!payload.tag,
  });

  event.waitUntil(showPromise);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/calls';

  // 절대 URL로 변환 (clients.openWindow 요구)
  const absoluteUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // 같은 origin에 이미 열린 탭/PWA 창이 있으면 거기로 navigate + focus
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin) {
            await client.navigate(absoluteUrl).catch(() => {});
            return client.focus();
          }
        } catch {
          // navigate 실패 시 계속
        }
      }

      // 열린 창 없으면 새로 열기
      return self.clients.openWindow(absoluteUrl);
    })()
  );
});
