import type { NextConfig } from "next";

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
          ...((config.optimization?.minimizer as any[]) || []),
        ],
      };

      // 프로덕션에서 소스맵 제거
      config.devtool = false;
    }

    // 디지털 워터마크 플러그인
    if (!dev) {
      config.plugins = config.plugins || [];
      config.plugins.push({
        apply: (compiler: any) => {
          compiler.hooks.emit.tapAsync(
            'WatermarkPlugin',
            (compilation: any, callback: () => void) => {
              const watermark = `/*! © ${new Date().getFullYear()} Onsia Corp. All Rights Reserved. BuildID: ${Date.now().toString(36)} */`;

              // 모든 JS 파일에 워터마크 추가
              Object.keys(compilation.assets)
                .filter((filename: string) => filename.endsWith('.js'))
                .forEach((filename: string) => {
                  const asset = compilation.assets[filename];
                  const source = asset.source();
                  compilation.assets[filename] = {
                    source: () => watermark + '\n' + source,
                    size: () => watermark.length + source.length,
                  };
                });

              callback();
            }
          );
        },
      });
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

export default nextConfig;
