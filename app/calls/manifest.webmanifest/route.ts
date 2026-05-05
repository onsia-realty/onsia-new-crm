import { NextResponse } from 'next/server';

// /calls 전용 PWA 매니페스트.
// 같은 도메인에 두 개의 PWA를 공존시키기 위해 `id`를 명시한다.
// Chrome은 `id`로 구분, iOS는 `start_url`로 구분한다.
export function GET() {
  const manifest = {
    name: '온시아 콜',
    short_name: '온시아 콜',
    description: '광고 콜을 빠르게 처리하는 미니 앱',
    // scope에 trailing slash 없이 두면 spec상:
    // - "/calls" 정확 일치 → in scope
    // - "/calls/abc" prefix("/calls/")로 시작 → in scope
    // - "/calls-icon-*.png" → out of scope (의도대로)
    id: '/calls',
    start_url: '/calls',
    scope: '/calls',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#F9FAFB',
    theme_color: '#0EA5E9',
    icons: [
      {
        src: '/calls-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/calls-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/calls-icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/calls-icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/calls-apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    categories: ['business', 'productivity'],
    prefer_related_applications: false,
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      // 매니페스트는 가볍고 자주 바뀌지 않지만, 변경 시 즉시 반영되도록 짧게
      'Cache-Control': 'public, max-age=60, must-revalidate',
    },
  });
}
