# ⚙️ ONSIA CRM PWA 실전 구축 매뉴얼

이 문서는 **온시아 CRM(Next.js 기반)** 을 모바일 앱 형태로 배포하기 위한
완전한 PWA 실무 가이드입니다.  
설치 → 설정 → 배포 → 오프라인 대응까지 전 과정을 포함하며,  
실제 Vercel 및 iOS/Android 환경에서 그대로 적용 가능합니다.

---

## ✅ 1. Vercel 환경에서 Service Worker 동작 확인

`next-pwa`는 `NODE_ENV === 'production'`일 때만 작동합니다.  
따라서 **Vercel Preview 배포에서는 비활성화**될 수 있습니다.

다음 설정을 반드시 확인하세요:

```js
disable: process.env.NODE_ENV === 'development',
```

👉 **`vercel --prod`** 명령어로 프로덕션 배포 시에만
PWA 기능(캐싱, 오프라인 동작)이 활성화됩니다.

---

## ✅ 2. iOS “홈 화면 추가” 실행 시 주의점

Safari 기반 iOS는 초기 로딩 시 캐시를 다시 받아야
업데이트가 반영됩니다.

이를 위해 반드시 다음 옵션을 설정해야 합니다:

```js
skipWaiting: true
```

이 설정은 새로운 Service Worker가 업데이트될 때
자동으로 활성화되어 최신 버전을 즉시 반영합니다.

⚠️ 단, 오래된 캐시를 가진 사용자가 있을 수 있으므로  
“앱 업데이트가 있습니다” 안내 배너를 추가하는 것을 권장합니다.  
(→ 아래 “UpdateWatcher.tsx” 참고)

---

## ✅ 3. HTTPS 필수 조건

PWA는 **HTTPS 환경에서만 정상 작동**합니다.

- Vercel은 기본적으로 SSL 인증서를 자동 발급하므로 문제 없음.
- 단, **별도 도메인 연결 시**  
  → `https://onsia.co.kr` 형태로 SSL 인증 활성화 필요.

---

## ✅ 4. 오프라인 캐시 범위 조정 팁

CRM 내부에서 실시간 데이터(고객 정보, 일정 등)가 자주 변경된다면,  
`/api/` 요청을 `NetworkFirst` 방식으로 유지해야 합니다.

```js
{
  urlPattern: /\/api\/.*$/i,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'apis',
    expiration: {
      maxEntries: 16,
      maxAgeSeconds: 5 * 60 // 5분
    },
    networkTimeoutSeconds: 5
  }
}
```

👉 이렇게 하면 데이터는 최신 상태로 유지하면서도  
오프라인 시엔 캐시된 응답으로 임시 표시가 가능합니다.

---

## ✅ 5. 로고 및 아이콘 디자인 가이드

| 항목 | 권장 크기 | 설명 |
|------|------------|------|
| app-icon.png | 512x512 | maskable 지원, 파란계열 추천 |
| apple-touch-icon.png | 180x180 | iOS 전용, 중앙 정렬된 심볼형 로고 |
| favicon.ico | 48x48 | 웹 브라우저 기본 아이콘 |

**디자인 팁**
- 배경이 흰색이므로 로고는 파란색 계열 추천  
- Android: maskable 옵션 자동 원형 크롭  
- iOS: maskable 미지원 → 중앙 심볼형 유지

---

## ✅ 6. iOS 전용 “앱 설치 안내 배너” 추가

iOS는 자동 설치 배너가 없기 때문에  
직접 설치 안내 모달을 띄워야 합니다.

```tsx
// app/components/InstallPrompt.tsx
'use client';
import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    const standalone = (window.navigator as any).standalone === true;
    setIsIos(ios);
    setIsStandalone(standalone);
  }, []);

  if (!isIos || isStandalone) return null;

  return (
    <div className="fixed bottom-4 inset-x-0 mx-auto max-w-sm bg-white shadow-xl rounded-xl border p-4 text-center">
      <p className="text-sm text-gray-700 mb-2">
        온시아 CRM을 홈 화면에 추가하려면
      </p>
      <p className="text-sm font-semibold text-blue-600">
        공유 버튼 → “홈 화면에 추가”를 눌러주세요.
      </p>
    </div>
  );
}
```

📍 이렇게 하면 iOS 사용자는  
홈 화면 추가 기능을 직관적으로 이해할 수 있습니다.

---

## ✅ 7. 업데이트 알림 자동화 (Phase 2 확장)

새로운 Service Worker가 감지될 때  
“앱 업데이트가 있습니다” 배너를 표시하여 자동 새로고침을 유도합니다.

```tsx
// app/components/UpdateWatcher.tsx
'use client';
import { useEffect, useState } from 'react';

export default function UpdateWatcher() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) setUpdateAvailable(true);

        reg?.addEventListener('updatefound', () => {
          if (reg.installing) {
            reg.installing.addEventListener('statechange', () => {
              if (reg.waiting) setUpdateAvailable(true);
            });
          }
        });
      });
    }
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 inset-x-0 mx-auto max-w-sm bg-blue-600 text-white p-3 rounded-xl shadow-xl text-center">
      <p className="text-sm">새로운 버전이 있습니다</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-1 px-3 py-1 bg-white text-blue-600 text-xs rounded-md"
      >
        새로고침
      </button>
    </div>
  );
}
```

---

## ✅ 8. 배포 전 최종 점검 리스트

| 항목 | 확인 |
|------|------|
| manifest.json의 start_url 설정 | ✅ |
| service-worker.js 빌드 후 존재 여부 | ✅ |
| HTTPS 인증서 활성화 | ✅ |
| favicon 및 아이콘 경로 정상 등록 | ✅ |
| PWA Lighthouse 점수 90점 이상 | ✅ |
| 오프라인 동작 확인 (`chrome://inspect`) | ✅ |

---

## 🚀 결론

이 매뉴얼은 온시아 CRM을 **App Store에 등록하지 않고도**  
사용자 기기에 설치 가능한 PWA 앱으로 전환하는 **완성형 가이드**입니다.  

- **배포 명령어:**  
  ```bash
  vercel --prod
  ```
- **테스트 디바이스:**  
  - Android: Chrome 최신 버전  
  - iOS: Safari 17+  
  - Desktop: Chrome/Edge PWA 지원 브라우저

---

📌 **추가 제안**
- 향후 Phase 3에서 Firebase Messaging을 결합하면  
  **푸시 알림 기능**까지 통합 가능.
- Supabase와 연결된 오프라인 Sync 로직 추가 시  
  CRM 데이터를 완전한 하이브리드 앱처럼 운용 가능.
