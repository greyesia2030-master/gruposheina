import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Placeholder branding. Reemplazar SOURCE_SVG con logo real cuando esté disponible.
const SOURCE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#D4622B"/>
  <text
    x="50%"
    y="50%"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="700"
    font-size="240"
    fill="#ffffff"
  >GS</text>
</svg>
`;

const OUT_DIR = resolve('public/icons');
await mkdir(OUT_DIR, { recursive: true });

const sizes = [192, 512];
for (const size of sizes) {
  const outPath = resolve(OUT_DIR, `icon-${size}.png`);
  await sharp(Buffer.from(SOURCE_SVG))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`✓ ${outPath}`);
}

console.log('Done. Replace SOURCE_SVG with real branding when available.');
