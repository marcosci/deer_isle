// Visual debug: render 3x3 tiles centered on (20,20) at FULL resolution
// with numbered labels and red gridlines. Output separate versions:
//   1) No flip (original)  
//   2) Vertically flipped tiles
//   3) Horizontally flipped tiles
//   4) Both flipped
// Also: output each individual tile as a separate PNG for manual inspection

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const LAYERS_DIR = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';
const TILE_PX = 512;
const CENTER = { col: 20, row: 20 };

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');

  function readTileRaw(col, row) {
    const f = path.join(LAYERS_DIR,
      `s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`);
    const buf = fs.readFileSync(f);
    const paa = new Paa(); paa.read(buf);
    return paa.getArgb32PixelData(buf, 0); // BGRA
  }

  function bgraToRgb(argb, vFlip, hFlip) {
    const rgb = Buffer.alloc(TILE_PX * TILE_PX * 3);
    for (let y = 0; y < TILE_PX; y++) {
      const srcY = vFlip ? (TILE_PX - 1 - y) : y;
      for (let x = 0; x < TILE_PX; x++) {
        const srcX = hFlip ? (TILE_PX - 1 - x) : x;
        const si = (srcY * TILE_PX + srcX) * 4;
        const di = (y * TILE_PX + x) * 3;
        rgb[di + 0] = argb[si + 2]; // R
        rgb[di + 1] = argb[si + 1]; // G
        rgb[di + 2] = argb[si + 0]; // B
      }
    }
    return rgb;
  }

  // Read 3x3 tiles
  const tiles = {};
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = CENTER.col + dc;
      const r = CENTER.row + dr;
      tiles[`${dc},${dr}`] = readTileRaw(c, r);
    }
  }

  const configs = [
    { name: 'noflip',   vFlip: false, hFlip: false },
    { name: 'vflip',    vFlip: true,  hFlip: false },
    { name: 'hflip',    vFlip: false, hFlip: true },
    { name: 'bothflip', vFlip: true,  hFlip: true },
  ];

  for (const cfg of configs) {
    const outW = 3 * TILE_PX;
    const outH = 3 * TILE_PX;
    const outBuf = Buffer.alloc(outW * outH * 3);

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rgb = bgraToRgb(tiles[`${dc},${dr}`], cfg.vFlip, cfg.hFlip);
        const dstX = (dc + 1) * TILE_PX;
        const dstY = (dr + 1) * TILE_PX;
        for (let y = 0; y < TILE_PX; y++) {
          const srcOff = y * TILE_PX * 3;
          const dstOff = ((dstY + y) * outW + dstX) * 3;
          rgb.copy(outBuf, dstOff, srcOff, srcOff + TILE_PX * 3);
        }
      }
    }

    // Draw red gridlines
    for (let g = 1; g <= 2; g++) {
      // Vertical lines
      const vx = g * TILE_PX;
      for (let y = 0; y < outH; y++) {
        const off = (y * outW + vx) * 3;
        outBuf[off] = 255; outBuf[off+1] = 0; outBuf[off+2] = 0;
        if (vx > 0) {
          const off2 = (y * outW + vx - 1) * 3;
          outBuf[off2] = 255; outBuf[off2+1] = 0; outBuf[off2+2] = 0;
        }
      }
      // Horizontal lines
      const hy = g * TILE_PX;
      for (let x = 0; x < outW; x++) {
        const off = (hy * outW + x) * 3;
        outBuf[off] = 255; outBuf[off+1] = 0; outBuf[off+2] = 0;
        if (hy > 0) {
          const off2 = ((hy - 1) * outW + x) * 3;
          outBuf[off2] = 255; outBuf[off2+1] = 0; outBuf[off2+2] = 0;
        }
      }
    }

    const outFile = path.join(__dirname, `debug_3x3_${cfg.name}.png`);
    await sharp(outBuf, { raw: { width: outW, height: outH, channels: 3 } })
      .png()
      .toFile(outFile);
    console.log(`Saved: ${outFile}`);
  }

  // Also save individual tiles from row 20 (cols 19,20,21) and row 21 (col 20)
  // as separate PNGs so the user can manually see if a single tile is correct
  const singles = [
    [19, 20, 'left'], [20, 20, 'center'], [21, 20, 'right'],
    [20, 19, 'above'], [20, 21, 'below'],
  ];
  for (const [c, r, label] of singles) {
    const raw = readTileRaw(c, r);
    const rgb = bgraToRgb(raw, false, false);
    const outFile = path.join(__dirname, `debug_tile_${label}_c${c}_r${r}_noflip.png`);
    await sharp(rgb, { raw: { width: TILE_PX, height: TILE_PX, channels: 3 } })
      .png()
      .toFile(outFile);
    console.log(`Saved: ${outFile}`);
  }

  console.log('\nDone! Open the 3x3 images and check which flip makes roads connect across the red gridlines.');
}

main().catch(console.error);
