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
 */
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const OUT_DIR = resolve(process.cwd(), 'public');

// 핸드셋 색상: sky-500
const PRIMARY = '#0EA5E9';
const PRIMARY_DARK = '#0284C7';
const TEXT = '#FFFFFF';

/**
 * @param {number} size - canvas size
 * @param {number} pad - inner padding (for non-maskable, ~10%; maskable, ~5% to fill safe zone)
 */
function makeSvg(size, pad) {
  const r = size * 0.22; // 둥근 모서리 (non-maskable에서만 보임)
  const inner = size - pad * 2;
  // 핸드셋(전화 수화기) 픽토그램 + "콜" 한글
  const phoneSize = inner * 0.42;
  const phoneX = size / 2 - phoneSize / 2;
  const phoneY = size * 0.26;
  const labelY = size * 0.78;
  const labelFontSize = inner * 0.22;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${PRIMARY}"/>
      <stop offset="100%" stop-color="${PRIMARY_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>
  <g transform="translate(${phoneX} ${phoneY})">
    <svg width="${phoneSize}" height="${phoneSize}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="${TEXT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${TEXT}"/>
    </svg>
  </g>
  <text x="50%" y="${labelY}" text-anchor="middle" font-family="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif"
        font-size="${labelFontSize}" font-weight="800" fill="${TEXT}" letter-spacing="-1">콜</text>
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
  // 192x192 일반 (any)
  await writePng(makeSvg(192, 18), 'calls-icon-192.png', 192);
  // 512x512 일반 (any)
  await writePng(makeSvg(512, 48), 'calls-icon-512.png', 512);
  // 192x192 maskable (안전 영역 80% — pad 적게, 둥근 모서리는 launcher가 자름)
  await writePng(makeSvg(192, 8), 'calls-icon-192-maskable.png', 192);
  // 512x512 maskable
  await writePng(makeSvg(512, 22), 'calls-icon-512-maskable.png', 512);
  // 180x180 Apple touch icon
  await writePng(makeSvg(180, 16), 'calls-apple-touch-icon.png', 180);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
