# 📱 온시아 CRM PWA 구현 가이드

## 📌 목차
1. [PWA란 무엇인가?](#pwa란-무엇인가)
2. [왜 PWA를 선택했는가?](#왜-pwa를-선택했는가)
3. [구현 방법 비교](#구현-방법-비교)
4. [단계별 구현 가이드](#단계별-구현-가이드)
5. [사용자 설치 가이드](#사용자-설치-가이드)
6. [향후 업그레이드 옵션](#향후-업그레이드-옵션)

---

## PWA란 무엇인가?

**Progressive Web App (PWA)** = 웹 기술로 만든 앱 같은 웹사이트

### 특징
- 🏠 **홈 화면 추가**: 일반 앱처럼 아이콘으로 실행
- 📱 **전체 화면**: 브라우저 UI 없이 앱처럼 실행
- ⚡ **빠른 로딩**: 캐시로 속도 향상
- 📴 **오프라인 동작**: 인터넷 없이도 기본 기능 사용
- 🔔 **푸시 알림**: 중요 공지 알림 가능 (선택사항)
- 🔄 **자동 업데이트**: 앱스토어 없이 즉시 업데이트

---

## 왜 PWA를 선택했는가?

### ✅ 회사 내부용으로 최적인 이유

| 항목 | PWA | 네이티브 앱 |
|------|-----|------------|
| 개발 비용 | **무료** | $5,000 ~ $50,000 |
| 개발 시간 | **3-4시간** | 2-3개월 |
| 앱스토어 등록 | **불필요** | iOS $99/년, Android $25 |
| 배포 방법 | **URL 공유** | 앱스토어 심사 대기 |
| 업데이트 | **즉시 반영** | 심사 후 반영 (1-7일) |
| 유지보수 | **웹과 동일** | 별도 관리 필요 |
| 내부 배포 | **매우 쉬움** | 엔터프라이즈 계정 필요 |

### ❌ PWA의 한계 (참고용)

<details>
<summary>PWA가 어려운 기능들 (클릭하여 펼치기)</summary>

- 블루투스 연결
- NFC 태그 읽기/쓰기
- 백그라운드 위치 추적
- iOS 네이티브 푸시 알림 (제한적)
- 고급 카메라 제어 (RAW 촬영 등)
- 파일 시스템 직접 접근

**현재 CRM 시스템에는 이러한 기능이 필요하지 않으므로 PWA가 최적입니다.**
</details>

---

## 구현 방법 비교

### 1️⃣ PWA (Progressive Web App) ⭐⭐⭐⭐⭐ **[추천]**

```
개발 시간: 3-4시간
비용: $0
난이도: ⭐ (매우 쉬움)
유지보수: ⭐ (웹과 동일)
```

**장점:**
- ✅ 기존 Next.js 코드 거의 그대로 사용
- ✅ 앱스토어 등록 불필요
- ✅ URL만 공유하면 배포 완료
- ✅ 자동 업데이트
- ✅ 크로스 플랫폼 (iOS/Android 동시 지원)

**단점:**
- ❌ 앱스토어에서 검색 불가 (내부용이므로 문제없음)
- ❌ 일부 네이티브 기능 제한 (현재 불필요)

**추천 대상:**
- ✅ 회사 내부용 앱
- ✅ 빠른 배포 필요
- ✅ 비용 절감 중요
- ✅ 웹앱이 이미 존재

---

### 2️⃣ Capacitor.js ⭐⭐⭐⭐

```
개발 시간: 1-2주
비용: $99/년 (iOS) + $25 (Android)
난이도: ⭐⭐⭐ (중간)
유지보수: ⭐⭐⭐ (웹 + 네이티브 빌드)
```

**장점:**
- ✅ 기존 코드 90% 재사용
- ✅ 모든 네이티브 기능 접근 가능
- ✅ 앱스토어 정식 등록 가능
- ✅ PWA에서 쉽게 마이그레이션

**단점:**
- ❌ iOS 엔터프라이즈 계정 필요 ($299/년)
- ❌ Xcode/Android Studio 환경 설정 필요
- ❌ 앱 빌드/배포 과정 추가

**추천 시점:**
- 고급 카메라 기능 필요
- iOS 네이티브 푸시 알림 필수
- 앱스토어 정식 등록 요구

---

### 3️⃣ React Native + WebView ⭐ **[비추천]**

```
개발 시간: 2-3주
비용: $5,000 ~ $10,000
난이도: ⭐⭐⭐⭐ (어려움)
유지보수: ⭐⭐⭐⭐ (복잡함)
```

**단점:**
- ❌ 성능 저하 (WebView는 느림)
- ❌ OAuth 로그인 문제 (구글 등이 WebView 차단)
- ❌ 플랫폼별 WebView 버그
- ❌ 네이티브 ↔ 웹 통신 복잡

**비추천 이유:**
이미 웹앱이 있는 경우 효율성이 매우 낮음

---

### 4️⃣ Expo (React Native) ⭐⭐

```
개발 시간: 2-3개월
비용: $20,000 ~ $50,000
난이도: ⭐⭐⭐⭐⭐ (매우 어려움)
유지보수: ⭐⭐⭐⭐ (웹과 모바일 별도 관리)
```

**단점:**
- ❌ 처음부터 완전 재개발
- ❌ React Native 학습 필요
- ❌ 웹과 모바일 코드 이중 관리

**비추천 이유:**
이미 완성된 웹앱이 있으므로 매우 비효율적

---

## 단계별 구현 가이드

### Phase 1: PWA 기본 구현 (3-4시간)

#### Step 1: 패키지 설치 (5분)

```bash
cd D:\claude\onsia_crm2
pnpm add next-pwa
pnpm add -D @types/serviceworker
```

---

#### Step 2: Next.js 설정 수정 (10분)

**파일: `next.config.mjs`**

```javascript
import withPWA from 'next-pwa';

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 1년
        }
      }
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60 // 1주일
        }
      }
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60 // 1주일
        }
      }
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60 // 24시간
        }
      }
    },
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60 // 24시간
        }
      }
    },
    {
      urlPattern: /\.(?:js)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-js-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60 // 24시간
        }
      }
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-style-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60 // 24시간
        }
      }
    },
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60 // 24시간
        }
      }
    },
    {
      urlPattern: /\/api\/.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'apis',
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 24 * 60 * 60 // 24시간
        },
        networkTimeoutSeconds: 10 // 10초 후 캐시 사용
      }
    },
    {
      urlPattern: /.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'others',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60 // 24시간
        },
        networkTimeoutSeconds: 10
      }
    }
  ]
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 기존 설정 유지
};

export default pwaConfig(nextConfig);
```

---

#### Step 3: 매니페스트 파일 생성 (15분)

**파일: `public/manifest.json`**

```json
{
  "name": "온시아 CRM - 고객관리 시스템",
  "short_name": "온시아 CRM",
  "description": "온시아 부동산 고객관리 시스템",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-256x256.png",
      "sizes": "256x256",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["business", "productivity"],
  "shortcuts": [
    {
      "name": "고객 등록",
      "short_name": "신규 고객",
      "description": "새로운 고객 등록",
      "url": "/dashboard/customers/new",
      "icons": [{ "src": "/icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "고객 목록",
      "short_name": "고객 목록",
      "description": "고객 목록 보기",
      "url": "/dashboard/customers",
      "icons": [{ "src": "/icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "방문 일정",
      "short_name": "일정",
      "description": "방문 일정 확인",
      "url": "/dashboard/schedules",
      "icons": [{ "src": "/icon-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "OCR 등록",
      "short_name": "OCR",
      "description": "이미지로 고객 등록",
      "url": "/dashboard/ocr",
      "icons": [{ "src": "/icon-192x192.png", "sizes": "192x192" }]
    }
  ]
}
```

---

#### Step 4: 아이콘 생성 (20분)

**필요한 아이콘 크기:**
- 192x192px
- 256x256px
- 384x384px
- 512x512px
- 180x180px (Apple Touch Icon)

**아이콘 생성 방법:**

1. **온라인 도구 사용 (추천)**
   - https://www.pwabuilder.com/imageGenerator
   - 로고 업로드 → 모든 크기 자동 생성
   - 다운로드 → `public/` 폴더에 저장

2. **직접 생성**
   ```bash
   # 기존 로고를 다양한 크기로 변환
   # Photoshop, GIMP, 또는 온라인 도구 사용
   ```

**파일 배치:**
```
public/
  ├── icon-192x192.png
  ├── icon-256x256.png
  ├── icon-384x384.png
  ├── icon-512x512.png
  └── apple-touch-icon.png (180x180)
```

---

#### Step 5: 메타데이터 추가 (15분)

**파일: `app/layout.tsx`**

```typescript
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '온시아 CRM',
  description: '온시아 부동산 고객관리 시스템',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '온시아 CRM',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icon-192x192.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* Apple 메타 태그 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="온시아 CRM" />

        {/* Microsoft 타일 */}
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* PWA 최적화 */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="온시아 CRM" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

#### Step 6: 오프라인 폴백 페이지 생성 (30분)

**파일: `app/offline/page.tsx`**

```typescript
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          오프라인 상태입니다
        </h1>
        <p className="text-gray-600 mb-6">
          인터넷 연결을 확인하고 다시 시도해주세요.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
```

---

#### Step 7: 빌드 및 테스트 (15분)

```bash
# 1. 빌드
pnpm run build

# 2. 로컬에서 프로덕션 모드 실행
pnpm start

# 3. PWA 확인
# Chrome DevTools > Application > Manifest 탭
# Service Worker 탭에서 등록 확인
```

**테스트 체크리스트:**
- [ ] manifest.json 로드 확인
- [ ] Service Worker 등록 확인
- [ ] 아이콘 표시 확인
- [ ] 오프라인 모드 테스트 (DevTools > Network > Offline)
- [ ] 캐시 동작 확인

---

#### Step 8: Vercel 배포 (15분)

```bash
# Git 커밋
git add .
git commit -m "feat: PWA 구현 - 모바일 앱으로 사용 가능"

# Vercel 배포
vercel --prod
```

**배포 후 확인:**
1. 스마트폰으로 사이트 접속
2. iOS: Safari에서 "홈 화면에 추가"
3. Android: Chrome에서 "앱 설치" 또는 "홈 화면에 추가"
4. 홈 화면 아이콘으로 실행 테스트

---

### Phase 2: 고급 기능 추가 (선택사항)

<details>
<summary>푸시 알림 구현 (클릭하여 펼치기)</summary>

#### 웹 푸시 알림 설정

**파일: `public/sw.js` (Service Worker 커스터마이징)**

```javascript
self.addEventListener('push', function(event) {
  const data = event.data.json();

  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '확인하기',
        icon: '/check.png'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/close.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
```

**백엔드 푸시 알림 발송 (선택사항)**

```typescript
// app/api/notifications/send/route.ts
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@onsia.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
  const { subscription, title, body } = await request.json();

  const payload = JSON.stringify({ title, body });

  try {
    await webpush.sendNotification(subscription, payload);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
```

**주의: iOS는 웹 푸시 알림 지원 제한적 (iOS 16.4+만 지원)**

</details>

<details>
<summary>앱 업데이트 알림 (클릭하여 펼치기)</summary>

**파일: `components/UpdatePrompt.tsx`**

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function UpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;

          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setShowPrompt(true);
            }
          });
        });
      });
    }
  }, []);

  const handleUpdate = () => {
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">새로운 버전이 있습니다</p>
          <p className="text-sm">업데이트하여 최신 기능을 사용하세요</p>
        </div>
        <button
          onClick={handleUpdate}
          className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
        >
          업데이트
        </button>
      </div>
    </div>
  );
}
```

</details>

---

## 사용자 설치 가이드

### 📱 iOS (iPhone/iPad)

#### 1단계: Safari로 접속
```
https://onsia-8hw8i9vok-realtors77-7871s-projects.vercel.app
```

#### 2단계: 공유 버튼 클릭
- 화면 하단 중앙의 **공유 아이콘** (상자에서 화살표 나가는 모양) 클릭

#### 3단계: 홈 화면에 추가
- 스크롤하여 **"홈 화면에 추가"** 선택
- 앱 이름 확인 (온시아 CRM)
- 우측 상단 **"추가"** 클릭

#### 4단계: 앱 실행
- 홈 화면에서 **"온시아 CRM"** 아이콘 터치
- 일반 앱처럼 전체 화면으로 실행됨

---

### 🤖 Android

#### 방법 1: 자동 설치 프롬프트 (권장)

1. **Chrome으로 접속**
   ```
   https://onsia-8hw8i9vok-realtors77-7871s-projects.vercel.app
   ```

2. **"앱 설치" 배너 확인**
   - 하단에 "온시아 CRM 설치" 팝업 표시
   - **"설치"** 버튼 클릭

3. **앱 서랍에서 실행**
   - 앱 서랍 또는 홈 화면에서 "온시아 CRM" 아이콘 찾기
   - 일반 앱처럼 실행

#### 방법 2: 수동 설치

1. **Chrome 메뉴 열기**
   - 우측 상단 ⋮ (점 3개) 클릭

2. **"홈 화면에 추가" 선택**
   - 앱 이름 확인
   - **"추가"** 클릭

3. **앱 실행**
   - 홈 화면에서 아이콘 터치

---

### 🖥️ PC (선택사항)

#### Windows / Mac / Linux

1. **Chrome 또는 Edge로 접속**
2. **주소창 우측 설치 아이콘** 클릭 (⊕ 또는 ⬇️)
3. **"설치"** 클릭
4. **데스크톱 앱처럼 실행**

---

## 향후 업그레이드 옵션

### 🔄 Capacitor로 전환 (필요시)

**언제 전환해야 하나?**
- iOS 네이티브 푸시 알림 필수
- 고급 카메라 기능 (RAW 촬영, 줌 제어 등)
- 백그라운드 위치 추적
- NFC 태그 읽기/쓰기
- 앱스토어 정식 등록 필요

**전환 소요 시간:** 1-2주
**전환 비용:** iOS $99/년 + Android $25

<details>
<summary>Capacitor 전환 가이드 (클릭하여 펼치기)</summary>

#### 1. Capacitor 설치

```bash
pnpm add @capacitor/core @capacitor/cli
npx cap init "온시아 CRM" "com.onsia.crm" --web-dir=out
npx cap add ios
npx cap add android
```

#### 2. Next.js Static Export 설정

**파일: `next.config.mjs`**

```javascript
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true
  },
  trailingSlash: true
};
```

#### 3. 빌드 및 동기화

```bash
pnpm run build
npx cap sync
```

#### 4. 네이티브 IDE에서 열기

```bash
# iOS (Mac만 가능)
npx cap open ios

# Android
npx cap open android
```

#### 5. 네이티브 플러그인 추가

```bash
# 카메라
pnpm add @capacitor/camera

# 위치
pnpm add @capacitor/geolocation

# 푸시 알림
pnpm add @capacitor/push-notifications
```

#### 6. 사용 예시

```typescript
import { Camera, CameraResultType } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

// 카메라
const takePicture = async () => {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: true,
    resultType: CameraResultType.Uri
  });

  return image.webPath;
};

// 위치
const getCurrentPosition = async () => {
  const coordinates = await Geolocation.getCurrentPosition();

  return {
    lat: coordinates.coords.latitude,
    lng: coordinates.coords.longitude
  };
};
```

#### 7. 앱 배포

**iOS (엔터프라이즈):**
```bash
# Xcode에서 Archive
# IPA 파일 생성
# 웹 서버에 업로드 (.ipa + manifest.plist)
# 직원들에게 설치 URL 공유
```

**Android:**
```bash
# Android Studio에서 Build
# APK 파일 생성
# 직원들에게 APK 파일 공유
# "알 수 없는 출처 허용" 후 설치
```

</details>

---

## 💡 자주 묻는 질문 (FAQ)

<details>
<summary><strong>Q: PWA와 네이티브 앱의 차이는?</strong></summary>

**PWA:**
- 웹 기술로 만든 앱 같은 웹사이트
- 앱스토어 불필요
- 즉시 업데이트
- 크로스 플랫폼 (한 번 개발)

**네이티브 앱:**
- iOS/Android 각각 개발
- 앱스토어 등록 필요
- 업데이트 시 심사 필요
- 모든 네이티브 기능 접근

**회사 내부용은 PWA가 최적입니다.**
</details>

<details>
<summary><strong>Q: 앱스토어에 등록 가능한가요?</strong></summary>

- **PWA 자체**: 앱스토어 등록 불가
- **Capacitor로 래핑**: 앱스토어 정식 등록 가능
- **회사 내부용**: 앱스토어 불필요 (URL만 공유)

필요시 Capacitor로 전환하면 앱스토어 등록 가능
</details>

<details>
<summary><strong>Q: 오프라인에서도 사용 가능한가요?</strong></summary>

**가능:**
- 이미 방문한 페이지
- 캐시된 이미지/스타일
- 기본 UI 표시

**불가능:**
- 새로운 데이터 로드
- API 호출 (서버 필요)
- 실시간 업데이트

**해결책:** 인터넷 연결 필요 (CRM 특성상 당연함)
</details>

<details>
<summary><strong>Q: 자동 업데이트되나요?</strong></summary>

**네, 자동 업데이트됩니다!**

1. 서버에 새 버전 배포
2. 사용자가 앱 실행 시 자동 감지
3. 백그라운드에서 다운로드
4. "업데이트 알림" 표시
5. 사용자가 "업데이트" 클릭 → 즉시 적용

앱스토어 심사 없이 즉시 배포 가능!
</details>

<details>
<summary><strong>Q: iOS와 Android 모두 지원되나요?</strong></summary>

**네, 완벽히 지원됩니다!**

- iOS 11.3 이상
- Android 5.0 이상
- 한 번 개발로 모든 플랫폼 동작
</details>

<details>
<summary><strong>Q: 비용은 얼마나 드나요?</strong></summary>

**PWA 단계:**
- 개발 비용: $0 (기존 코드 활용)
- 호스팅: Vercel 무료 티어 또는 기존 비용
- 유지보수: 웹과 동일

**Capacitor 전환 시:**
- 개발: 1-2주 인건비
- iOS: $99/년 (개인) 또는 $299/년 (엔터프라이즈)
- Android: $25 (일회성)

**회사 내부용은 PWA로 충분 → 비용 $0**
</details>

<details>
<summary><strong>Q: 직원들이 설치하기 어렵지 않나요?</strong></summary>

**매우 쉽습니다!**

**iOS:** 3단계
1. Safari 접속
2. 공유 버튼 → 홈 화면에 추가
3. 완료

**Android:** 1단계
1. Chrome 접속 → "앱 설치" 팝업 클릭

**교육 자료:**
- 스크린샷 가이드 제공
- 영상 가이드 제공 (선택)
- IT 담당자가 직접 설치 지원
</details>

---

## 📊 성과 측정

### PWA 설치 및 사용 통계

**파일: `app/api/analytics/pwa/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  const { event, userId } = await request.json();

  // PWA 설치 추적
  if (event === 'pwa_install') {
    await prisma.analyticsEvent.create({
      data: {
        event: 'PWA_INSTALL',
        userId,
        timestamp: new Date()
      }
    });
  }

  return NextResponse.json({ success: true });
}
```

**클라이언트 추적:**

```typescript
// app/layout.tsx
useEffect(() => {
  // PWA 설치 감지
  window.addEventListener('appinstalled', () => {
    fetch('/api/analytics/pwa', {
      method: 'POST',
      body: JSON.stringify({ event: 'pwa_install', userId: session?.user?.id })
    });
  });
}, []);
```

---

## 🎯 체크리스트

### 구현 전 체크리스트
- [ ] Node.js 18+ 설치 확인
- [ ] pnpm 설치 확인
- [ ] 로고/아이콘 파일 준비
- [ ] Vercel 계정 확인

### 구현 중 체크리스트
- [ ] next-pwa 패키지 설치
- [ ] next.config.mjs 수정
- [ ] manifest.json 생성
- [ ] 아이콘 파일 (192, 256, 384, 512px) 생성
- [ ] app/layout.tsx 메타데이터 추가
- [ ] 오프라인 페이지 생성
- [ ] 로컬 빌드 및 테스트
- [ ] Service Worker 등록 확인

### 배포 전 체크리스트
- [ ] Chrome DevTools에서 PWA 검증
- [ ] Lighthouse PWA 점수 확인 (90점 이상)
- [ ] 모바일 실제 기기 테스트
- [ ] 오프라인 모드 테스트
- [ ] 캐시 동작 확인

### 배포 후 체크리스트
- [ ] Vercel 배포 성공 확인
- [ ] iOS Safari 테스트
- [ ] Android Chrome 테스트
- [ ] "홈 화면에 추가" 동작 확인
- [ ] 앱 아이콘 표시 확인
- [ ] 전체 화면 모드 확인
- [ ] 사용자 가이드 배포
- [ ] 직원 교육 실시

---

## 📞 지원

### 문제 발생 시
1. Chrome DevTools > Console 확인
2. Application > Service Workers 상태 확인
3. manifest.json 로드 확인
4. 개발팀에 문의

### 추가 개발 필요 시
- Capacitor 전환 (네이티브 기능 필요)
- 푸시 알림 고도화
- 오프라인 데이터 동기화
- 백그라운드 작업

---

**작성일**: 2025.11.04
**버전**: 1.0
**문서 상태**: 구현 준비 완료

---

## 다음 단계

1. ✅ **이 가이드 검토**
2. 🔧 **PWA 구현 시작** (3-4시간)
3. 🚀 **배포 및 테스트**
4. 📱 **직원 배포 및 교육**
5. 📊 **사용 현황 모니터링**
6. 🔄 **필요시 Capacitor 전환 검토**

준비되면 구현을 시작하겠습니다! 👍
