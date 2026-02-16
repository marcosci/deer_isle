/**
 * build-satellite.js — Convert & stitch Deer Isle satellite tiles into one JPEG
 *
 * Usage:   node build-satellite.js
 *
 * Input:   C:\Users\marco\Downloads\deerisle\data\layers\s_*_lco.paa  (43×43, 512px each)
 * Output:  public/satellite.jpg
 *
 * Each tile is 512×512 but has a 128px overlap with each neighbor (64px border
 * on each side).  The unique "stride" per tile is 384px.
 * We crop 64px off each side of every tile (keeping 384×384), then stitch.
 * Output grid: 43 × 384 = 16,512px, downscaled to a manageable size.
 */

const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

const LAYERS_DIR = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';
const OUTPUT     = path.join(__dirname, 'public', 'satellite.jpg');
const GRID       = 43;
const TILE_PX    = 512;
const BORDER     = 64;           // pixels of overlap border on each side
const CROP_PX    = TILE_PX - 2 * BORDER;  // 384 unique px per tile
const TILE_OUT   = 192;          // downscale each 384px crop to this
const OUT_SIZE   = GRID * TILE_OUT;  // 43 × 192 = 8256

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');

  console.log(`Grid ${GRID}×${GRID}  |  tile ${TILE_PX}px, border ${BORDER}px, crop ${CROP_PX}px → ${TILE_OUT}px  |  out ${OUT_SIZE}×${OUT_SIZE}\n`);

  const outBuf = Buffer.alloc(OUT_SIZE * OUT_SIZE * 3);
  let ok = 0;

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const f = path.join(LAYERS_DIR,
        `s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`);
      if (!fs.existsSync(f)) continue;

      const buf = fs.readFileSync(f);
      const paa = new Paa(); paa.read(buf);
      const argb = paa.getArgb32PixelData(buf, 0);

      // BGRA → RGB, cropping 64px border on each side (keep center 384×384)
      const rgb = Buffer.alloc(CROP_PX * CROP_PX * 3);
      for (let y = 0; y < CROP_PX; y++) {
        const srcY = y + BORDER;
        for (let x = 0; x < CROP_PX; x++) {
          const srcX = x + BORDER;
          const si = (srcY * TILE_PX + srcX) * 4;
          const di = (y * CROP_PX + x) * 3;
          rgb[di + 0] = argb[si + 2]; // R
          rgb[di + 1] = argb[si + 1]; // G
          rgb[di + 2] = argb[si + 0]; // B
        }
      }

      const scaled = await sharp(rgb, { raw: { width: CROP_PX, height: CROP_PX, channels: 3 } })
        .resize(TILE_OUT, TILE_OUT, { kernel: 'lanczos3' })
        .raw()
        .toBuffer();

      const dstX = col * TILE_OUT;
      const dstY = row * TILE_OUT;
      for (let y = 0; y < TILE_OUT; y++) {
        const srcOff = y * TILE_OUT * 3;
        const dstOff = ((dstY + y) * OUT_SIZE + dstX) * 3;
        scaled.copy(outBuf, dstOff, srcOff, srcOff + TILE_OUT * 3);
      }
      ok++;
    }
    process.stdout.write(`\r  Row ${row + 1}/${GRID} (${ok} tiles)`);
  }

  console.log('\n\nSaving JPEG...');
  await sharp(outBuf, { raw: { width: OUT_SIZE, height: OUT_SIZE, channels: 3 } })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(OUTPUT);

  const size = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1);
  console.log(`✓ Saved: ${OUTPUT} (${size} MB, ${OUT_SIZE}×${OUT_SIZE})`);
}

main().catch(err => { console.error(err); process.exit(1); });
