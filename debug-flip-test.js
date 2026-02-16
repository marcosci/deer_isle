// Test: flip each tile vertically (bottom-up → top-down) before stitching
const fs = require('fs');
const sharp = require('sharp');
const dir = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');

  const BLK = 5;
  const startCol = 19, startRow = 19;
  const SIZE = BLK * 512;

  const buf = Buffer.alloc(SIZE * SIZE * 3);

  for (let dr = 0; dr < BLK; dr++) {
    for (let dc = 0; dc < BLK; dc++) {
      const col = startCol + dc;
      const row = startRow + dr;
      const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
      const raw = fs.readFileSync(f);
      const p = new Paa();
      p.read(raw);
      const argb = p.getArgb32PixelData(raw, 0);

      for (let y = 0; y < 512; y++) {
        const flippedY = 511 - y; // FLIP: read from bottom
        for (let x = 0; x < 512; x++) {
          const si = (flippedY * 512 + x) * 4;
          const di = ((dr * 512 + y) * SIZE + dc * 512 + x) * 3;
          buf[di + 0] = argb[si + 2]; // R
          buf[di + 1] = argb[si + 1]; // G
          buf[di + 2] = argb[si + 0]; // B
        }
      }
    }
  }

  // Draw red grid lines at tile boundaries
  for (let i = 1; i < BLK; i++) {
    const pos = i * 512;
    for (let y = 0; y < SIZE; y++) {
      const di = (y * SIZE + pos) * 3;
      buf[di] = 255; buf[di + 1] = 0; buf[di + 2] = 0;
      const di2 = (y * SIZE + pos - 1) * 3;
      buf[di2] = 255; buf[di2 + 1] = 0; buf[di2 + 2] = 0;
    }
    for (let x = 0; x < SIZE; x++) {
      const di = (pos * SIZE + x) * 3;
      buf[di] = 255; buf[di + 1] = 0; buf[di + 2] = 0;
      const di2 = ((pos - 1) * SIZE + x) * 3;
      buf[di2] = 255; buf[di2 + 1] = 0; buf[di2 + 2] = 0;
    }
  }

  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .png()
    .toFile('debug_5x5_FLIPPED.png');
  console.log('Saved debug_5x5_FLIPPED.png — each tile vertically flipped');
}

main().catch(console.error);
