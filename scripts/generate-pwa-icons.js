/**
 * 온시아 PWA 아이콘 생성 스크립트
 * Sharp 라이브러리를 사용하여 브랜드 아이콘 자동 생성
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const LOGO_PATH = path.join(PUBLIC_DIR, '온시아로고.png');

// 온시아 브랜드 컬러
const COLORS = {
  orange: '#F18B5E',
  teal: '#3DBDB4',
  gradientMid: '#6BA87C',
  white: '#FFFFFF',
};

/**
 * 그라데이션 배경 SVG 생성
 */
function createGradientBackground(width, height, rounded = true) {
  const rx = rounded ? Math.round(width * 0.18) : 0; // 18% 둥근 모서리

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="onsiaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${COLORS.orange};stop-opacity:1" />
          <stop offset="50%" style="stop-color:${COLORS.gradientMid};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${COLORS.teal};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="${rx}" fill="url(#onsiaGrad)"/>
    </svg>
  `);
}

/**
 * 512x512 메인 아이콘 생성
 */
async function generateIcon512() {
  console.log('📱 512x512 아이콘 생성 중...');

  const background = createGradientBackground(512, 512, true);

  // 로고 리사이즈 (배경의 약 75% 크기)
  const logo = await sharp(LOGO_PATH)
    .resize(380, null, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  await sharp(background)
    .composite([
      {
        input: logo,
        gravity: 'center',
        blend: 'over'
      }
    ])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon-512x512.png'));

  console.log('✅ icon-512x512.png 생성 완료');
}

/**
 * 192x192 표준 아이콘 생성
 */
async function generateIcon192() {
  console.log('📱 192x192 아이콘 생성 중...');

  const background = createGradientBackground(192, 192, true);

  const logo = await sharp(LOGO_PATH)
    .resize(142, null, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  await sharp(background)
    .composite([
      {
        input: logo,
        gravity: 'center',
        blend: 'over'
      }
    ])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon-192x192.png'));

  console.log('✅ icon-192x192.png 생성 완료');
}

/**
 * 512x512 Maskable 아이콘 생성 (Safe Area)
 */
async function generateMaskable512() {
  console.log('🎭 512x512 Maskable 아이콘 생성 중...');

  const background = createGradientBackground(512, 512, true);

  // Safe Area: 중앙 60%만 사용
  const logo = await sharp(LOGO_PATH)
    .resize(300, null, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  await sharp(background)
    .composite([
      {
        input: logo,
        gravity: 'center',
        blend: 'over'
      }
    ])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon-512x512-maskable.png'));

  console.log('✅ icon-512x512-maskable.png 생성 완료');
}

/**
 * 192x192 Maskable 아이콘 생성
 */
async function generateMaskable192() {
  console.log('🎭 192x192 Maskable 아이콘 생성 중...');

  const background = createGradientBackground(192, 192, true);

  const logo = await sharp(LOGO_PATH)
    .resize(115, null, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  await sharp(background)
    .composite([
      {
        input: logo,
        gravity: 'center',
        blend: 'over'
      }
    ])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon-192x192-maskable.png'));

  console.log('✅ icon-192x192-maskable.png 생성 완료');
}

/**
 * 180x180 Apple Touch Icon 생성
 */
async function generateAppleTouchIcon() {
  console.log('🍎 180x180 Apple Touch Icon 생성 중...');

  const background = createGradientBackground(180, 180, true);

  const logo = await sharp(LOGO_PATH)
    .resize(133, null, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  await sharp(background)
    .composite([
      {
        input: logo,
        gravity: 'center',
        blend: 'over'
      }
    ])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));

  console.log('✅ apple-touch-icon.png 생성 완료');
}

/**
 * Favicon (32x32, 16x16) 생성
 */
async function generateFavicons() {
  console.log('🔖 Favicon 생성 중...');

  // 32x32
  const bg32 = createGradientBackground(32, 32, true);
  const logo32 = await sharp(LOGO_PATH)
    .resize(24, null, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(bg32)
    .composite([{ input: logo32, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon-32x32.png'));

  // 16x16
  const bg16 = createGradientBackground(16, 16, true);
  const logo16 = await sharp(LOGO_PATH)
    .resize(12, null, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp(bg16)
    .composite([{ input: logo16, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon-16x16.png'));

  console.log('✅ favicon-32x32.png, favicon-16x16.png 생성 완료');
}

/**
 * 스플래시 스크린 생성 (2048x2732 - iPad Pro)
 */
async function generateSplash() {
  console.log('🌅 스플래시 스크린 생성 중...');

  // 매우 연한 그라데이션 배경
  const background = Buffer.from(`
    <svg width="2048" height="2732" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="splashGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${COLORS.orange};stop-opacity:0.05" />
          <stop offset="100%" style="stop-color:${COLORS.teal};stop-opacity:0.05" />
        </linearGradient>
      </defs>
      <rect width="2048" height="2732" fill="url(#splashGrad)"/>
      <text x="1024" y="1550" text-anchor="middle"
            font-family="Arial, sans-serif" font-size="52" fill="#95A5A6" font-weight="300">
        AI 부동산 CRM
      </text>
    </svg>
  `);

  const logo = await sharp(LOGO_PATH)
    .resize(700, null, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  await sharp(background)
    .composite([
      {
        input: logo,
        top: 900,
        left: 674 // 중앙 배치
      }
    ])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'splash-2048x2732.png'));

  console.log('✅ splash-2048x2732.png 생성 완료');
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🎨 온시아 PWA 아이콘 생성 시작...\n');

  try {
    // 로고 파일 존재 확인
    try {
      readFileSync(LOGO_PATH);
    } catch (error) {
      console.error('❌ 온시아 로고 파일을 찾을 수 없습니다:', LOGO_PATH);
      process.exit(1);
    }

    // 모든 아이콘 생성
    await generateIcon512();
    await generateIcon192();
    await generateMaskable512();
    await generateMaskable192();
    await generateAppleTouchIcon();
    await generateFavicons();
    await generateSplash();

    console.log('\n✨ 모든 PWA 아이콘이 성공적으로 생성되었습니다!');
    console.log('\n📁 생성된 파일 목록:');
    console.log('  - icon-512x512.png');
    console.log('  - icon-192x192.png');
    console.log('  - icon-512x512-maskable.png');
    console.log('  - icon-192x192-maskable.png');
    console.log('  - apple-touch-icon.png');
    console.log('  - favicon-32x32.png');
    console.log('  - favicon-16x16.png');
    console.log('  - splash-2048x2732.png');
    console.log('\n🎯 다음 단계: manifest.json 업데이트');

  } catch (error) {
    console.error('❌ 아이콘 생성 중 오류 발생:', error);
    process.exit(1);
  }
}

main();
