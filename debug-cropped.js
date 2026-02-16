/**
 * Quick visual verification that 64px border cropping fixes tile alignment.
 * Generates a 3×3 debug grid from tiles (10,10)-(12,12) with border-cropped tiles.
 */
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

const LAYERS_DIR = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';
const TILE_PX = 512;
const BORDER  = 64;
const CROP_PX = TILE_PX - 2 * BORDER; // 384

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');

  const startCol = 10, startRow = 10;
  const N = 3;
  const gridPx = N * CROP_PX; // 3 × 384 = 1152

  const out = Buffer.alloc(gridPx * gridPx * 3);

  for (let gr = 0; gr < N; gr++) {
    for (let gc = 0; gc < N; gc++) {
      const col = startCol + gc;
      const row = startRow + gr;
      const f = path.join(LAYERS_DIR,
        `s_${String(col).padStart(3,'0')}_${String(row).padStart(3,'0')}_lco.paa`);
      
      const buf = fs.readFileSync(f);
      const paa = new Paa(); paa.read(buf);
      const argb = paa.getArgb32PixelData(buf, 0);

      // Copy cropped center (skip 64px border on each side)
      for (let y = 0; y < CROP_PX; y++) {
        const srcY = y + BORDER;
        for (let x = 0; x < CROP_PX; x++) {
          const srcX = x + BORDER;
          const si = (srcY * TILE_PX + srcX) * 4;
          const dstX = gc * CROP_PX + x;
          const dstY = gr * CROP_PX + y;
          const di = (dstY * gridPx + dstX) * 3;
          out[di + 0] = argb[si + 2]; // R
          out[di + 1] = argb[si + 1]; // G
          out[di + 2] = argb[si + 0]; // B
        }
      }
    }
  }

  // Draw red gridlines at tile boundaries
  for (let i = 1; i < N; i++) {
    const pos = i * CROP_PX;
    for (let p = 0; p < gridPx; p++) {
      // vertical line
      const vi = (p * gridPx + pos) * 3;
      out[vi] = 255; out[vi+1] = 0; out[vi+2] = 0;
      if (pos > 0) { const vi2 = (p * gridPx + pos - 1) * 3; out[vi2] = 255; out[vi2+1] = 0; out[vi2+2] = 0; }
      // horizontal line
      const hi = (pos * gridPx + p) * 3;
      out[hi] = 255; out[hi+1] = 0; out[hi+2] = 0;
      if (pos > 0) { const hi2 = ((pos-1) * gridPx + p) * 3; out[hi2] = 255; out[hi2+1] = 0; out[hi2+2] = 0; }
    }
  }

  const outPath = path.join(__dirname, 'debug_cropped_3x3.png');
  await sharp(out, { raw: { width: gridPx, height: gridPx, channels: 3 } })
    .png()
    .toFile(outPath);

  console.log(`Saved ${outPath} (${gridPx}×${gridPx})`);
}

main().catch(console.error);
