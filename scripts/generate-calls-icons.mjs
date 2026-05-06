/**
 * Generates PWA icons for the /calls mini-app.
 * Run: node scripts/generate-calls-icons.mjs
 *
 * Output:
 *   public/calls-icon-192.png
 *   public/calls-icon-512.png
 *   public/calls-icon-192-maskable.png
 *   public/calls-icon-512-maskable.png
 *   public/calls-apple-touch-icon.png   (180x180)
 *
 * Design: 하늘색 그라디언트 + 핸드셋 + "온시아콜" 한글
 */
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const OUT_DIR = resolve(process.cwd(), 'public');

const PRIMARY = '#0EA5E9';
const PRIMARY_DARK = '#0369A1';
const TEXT = '#FFFFFF';

/**
 * @param {number} size - canvas size
 * @param {number} pad - inner padding
 * @param {boolean} maskable - if true, use full bleed (no rounded corners visible)
 */
function makeSvg(size, pad, maskable = false) {
  const r = maskable ? 0 : size * 0.22;
  const inner = size - pad * 2;

  // 핸드셋: 위쪽 1/3 정도. 작아도 충분히 보임.
  const phoneSize = inner * 0.36;
  const phoneX = size / 2 - phoneSize / 2;
  const phoneY = size * 0.16;

  // "온시아" — 핸드셋 아래 작은 글자
  const subY = size * 0.61;
  const subFont = inner * 0.13;

  // "콜" — 가장 크게 강조
  const mainY = size * 0.86;
  const mainFont = inner * 0.32;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${PRIMARY}"/>
      <stop offset="100%" stop-color="${PRIMARY_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>

  <!-- 핸드셋 아이콘 -->
  <g transform="translate(${phoneX} ${phoneY})">
    <svg width="${phoneSize}" height="${phoneSize}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="${TEXT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${TEXT}"/>
    </svg>
  </g>

  <!-- "온시아" 작은 글자 -->
  <text x="50%" y="${subY}" text-anchor="middle"
        font-family="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif"
        font-size="${subFont}" font-weight="700" fill="${TEXT}" letter-spacing="-0.5"
        opacity="0.95">온시아</text>

  <!-- "콜" 큰 글자 -->
  <text x="50%" y="${mainY}" text-anchor="middle"
        font-family="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif"
        font-size="${mainFont}" font-weight="900" fill="${TEXT}" letter-spacing="-2">콜</text>
</svg>`;
}

async function writePng(svg, filename, size) {
  const out = resolve(OUT_DIR, filename);
  await mkdir(dirname(out), { recursive: true });
  const buf = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(out, buf);
  console.log(`✓ ${filename} (${size}x${size}, ${buf.length} bytes)`);
}

async function main() {
  // 일반 (any) — 둥근 모서리
  await writePng(makeSvg(192, 18, false), 'calls-icon-192.png', 192);
  await writePng(makeSvg(512, 48, false), 'calls-icon-512.png', 512);
  // Maskable — 안전 영역 80% 채움 (launcher가 모서리 자름)
  await writePng(makeSvg(192, 4, true), 'calls-icon-192-maskable.png', 192);
  await writePng(makeSvg(512, 12, true), 'calls-icon-512-maskable.png', 512);
  // Apple touch icon
  await writePng(makeSvg(180, 16, false), 'calls-apple-touch-icon.png', 180);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
