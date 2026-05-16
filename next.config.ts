import type { NextConfig } from "next";
// @ts-expect-error - next-pwa doesn't have TypeScript definitions
import withPWA from 'next-pwa';

const nextConfig: NextConfig = {
  /* config options here */

  // ===================================
  // 프로덕션 빌드 보안 설정
  // ===================================
  compiler: {
    // 프로덕션에서 console.* 제거
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"], // error와 warn은 유지
    } : false,
  },

  // Webpack 설정 (난독화 및 최적화)
  webpack: (config, { dev, isServer }) => {
    // 프로덕션 환경에서만 난독화 적용
    if (!dev && !isServer) {
      // TerserPlugin 설정으로 코드 난독화
      config.optimization = {
        ...config.optimization,
        minimize: true,
        minimizer: [
          ...((config.optimization?.minimizer as unknown[]) || []),
        ],
      };

      // 프로덕션에서 소스맵 제거
      config.devtool = false;
    }

    // 디지털 워터마크 플러그인
    if (!dev) {
      config.plugins = config.plugins || [];
      config.plugins.push({
        apply: (compiler: unknown) => {
          const typedCompiler = compiler as { hooks: { emit: { tapAsync: (name: string, callback: (compilation: unknown, cb: () => void) => void) => void } } };
          typedCompiler.hooks.emit.tapAsync(
            'WatermarkPlugin',
            (compilation: unknown, callback: () => void) => {
              const typedCompilation = compilation as { assets: Record<string, { source: () => string; size: () => number }> };
              const watermark = `/*! © ${new Date().getFullYear()} Onsia Corp. All Rights Reserved. BuildID: ${Date.now().toString(36)} */`;

              // 모든 JS 파일에 워터마크 추가
              Object.keys(typedCompilation.assets)
                .filter((filename: string) => filename.endsWith('.js'))
                .forEach((filename: string) => {
                  const asset = typedCompilation.assets[filename];
                  const source = asset.source();
                  typedCompilation.assets[filename] = {
                    source: () => watermark + '\n' + source,
                    size: () => watermark.length + source.length,
                  };
                });

              callback();
            }
          );
        },
      } as unknown);
    }

    return config;
  },

  // 프로덕션 빌드 최적화
  productionBrowserSourceMaps: false, // 소스맵 비활성화

  // 보안 헤더 설정
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
        ],
      },
    ];
  },
};

// PWA 설정
const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true, // 즉시 업데이트 (iOS 호환성)
  disable: process.env.NODE_ENV === 'development', // 개발 환경에서는 비활성화
  // 자동 생성된 sw.js 첫 줄에 importScripts('/sw-push.js') 삽입
  // → /sw-push.js의 push/notificationclick 이벤트 핸들러가 SW에 통합됨
  importScripts: ['/sw-push.js'],
  runtimeCaching: [
    // Google Fonts
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
    // 정적 폰트
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 7 * 24 * 60 * 60
        }
      }
    },
    // 이미지
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
    // Next.js 이미지
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60
        }
      }
    },
    // JavaScript
    {
      urlPattern: /\.(?:js)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-js-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60
        }
      }
    },
    // CSS
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-style-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60
        }
      }
    },
    // Next.js 데이터
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60
        }
      }
    },
    // API 요청 — 캐시 금지(NetworkOnly)
    // 과거 NetworkFirst + 5분 캐시 사용 시 발생한 문제들:
    //   - 출근 누른 후 GET /api/daily-reports 응답이 어제 캐시본으로 폴백 → "어제께 그대로 적용됨"
    //   - /api/customers?page=N 페이지네이션 시 5초 타임아웃 후 다른 페이지 캐시본이 잘못 반환 → "1페이지 사람만 계속 나옴"
    // CRM 사용 특성상 오프라인 사용은 거의 없고, 데이터 정합성이 훨씬 중요.
    {
      urlPattern: /\/api\/.*$/i,
      handler: 'NetworkOnly',
      options: { cacheName: 'apis-disabled' }
    },
    // 기타 모든 요청
    {
      urlPattern: /.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'others',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60
        },
        networkTimeoutSeconds: 10
      }
    }
  ]
});

export default pwaConfig(nextConfig);
