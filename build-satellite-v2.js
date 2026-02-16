// Minimal satellite builder - simplest possible approach
// No feathering, no fancy stuff. Just stitch raw pixels and let sharp resize once.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const LAYERS_DIR = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';
const GRID = 43;
const TILE_PX = 512;
const FULL = GRID * TILE_PX; // 22016

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');

  // Strategy: process row by row, building strips of 43 tiles (22016 x 512),
  // downscale each strip to 4096 wide x proportional height,
  // then stack strips with sharp.

  const OUT_W = 4096;
  const stripH = Math.round(TILE_PX * (OUT_W / FULL)); // ~95px per strip
  console.log(`Building ${GRID} strips of ${OUT_W}x${stripH}px each...`);

  const strips = [];

  for (let row = 0; row < GRID; row++) {
    // Build a full-res strip: 22016 x 512 x 3 bytes = ~33 MB per strip
    const strip = Buffer.alloc(FULL * TILE_PX * 3);

    for (let col = 0; col < GRID; col++) {
      const filename = `s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
      const filepath = path.join(LAYERS_DIR, filename);
      if (!fs.existsSync(filepath)) continue;

      const buf = fs.readFileSync(filepath);
      const paa = new Paa();
      paa.read(buf);
      const argb = paa.getArgb32PixelData(buf, 0);

      const ox = col * TILE_PX;
      for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
          const si = (y * TILE_PX + x) * 4;
          const di = (y * FULL + ox + x) * 3;
          strip[di + 0] = argb[si + 2]; // R
          strip[di + 1] = argb[si + 1]; // G
          strip[di + 2] = argb[si + 0]; // B
        }
      }
    }

    // Downscale this strip from 22016x512 → 4096x~95
    const scaled = await sharp(strip, { raw: { width: FULL, height: TILE_PX, channels: 3 }, limitInputPixels: false })
      .resize(OUT_W, stripH, { kernel: 'lanczos3' })
      .png()
      .toBuffer();

    strips.push(scaled);
    process.stdout.write(`\r  Row ${row + 1}/${GRID}`);
  }

  console.log('\n\nStacking strips...');

  // Use sharp to vertically stack all strip PNGs
  const composites = strips.map((buf, i) => ({
    input: buf,
    left: 0,
    top: i * stripH,
  }));

  const totalH = GRID * stripH;

  await sharp({
    create: { width: OUT_W, height: totalH, channels: 3, background: { r: 0, g: 0, b: 0 } }
  })
    .composite(composites)
    .jpeg({ quality: 92 })
    .toFile(path.join(__dirname, 'public', 'satellite.jpg'));

  const sz = (fs.statSync(path.join(__dirname, 'public', 'satellite.jpg')).size / 1024 / 1024).toFixed(1);
  console.log(`✓ Saved satellite.jpg (${sz} MB, ${OUT_W}x${totalH})`);
}

main().catch(err => { console.error(err); process.exit(1); });
