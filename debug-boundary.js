// Generate a full-resolution crop around a tile boundary to inspect alignment
const fs = require('fs');
const sharp = require('sharp');
const dir = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');

  function decodeTile(col, row) {
    const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
    const buf = fs.readFileSync(f);
    const p = new Paa();
    p.read(buf);
    const argb = p.getArgb32PixelData(buf, 0);
    const rgb = Buffer.alloc(512 * 512 * 3);
    for (let i = 0; i < 512 * 512; i++) {
      rgb[i * 3 + 0] = argb[i * 4 + 2];
      rgb[i * 3 + 1] = argb[i * 4 + 1];
      rgb[i * 3 + 2] = argb[i * 4 + 0];
    }
    return rgb;
  }

  // Stitch a 3x3 block around tile (20,20) at full resolution = 1536x1536
  const BLK = 3;
  const SIZE = BLK * 512;
  const startCol = 20, startRow = 20;
  
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  for (let dr = 0; dr < BLK; dr++) {
    for (let dc = 0; dc < BLK; dc++) {
      const rgb = decodeTile(startCol + dc, startRow + dr);
      for (let y = 0; y < 512; y++) {
        const srcOff = y * 512 * 3;
        const dstOff = ((dr * 512 + y) * SIZE + dc * 512) * 3;
        rgb.copy(buf, dstOff, srcOff, srcOff + 512 * 3);
      }
    }
  }
  
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .png()
    .toFile('debug_3x3_fullres.png');
  console.log(`Saved debug_3x3_fullres.png (${SIZE}x${SIZE}) — tiles (${startCol}-${startCol+2}, ${startRow}-${startRow+2})`);
  
  // Now crop a 200px strip across a horizontal boundary
  // boundary between col 20 and col 21, centered
  const cropX = 512 - 100;  // 100px from right of tile 20
  const cropW = 200;
  const cropH = 512;
  
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .extract({ left: cropX, top: 0, width: cropW, height: cropH })
    .png()
    .toFile('debug_hboundary_zoom.png');
  console.log('Saved debug_hboundary_zoom.png — zoom on horizontal tile boundary');
  
  // Vertical boundary between row 20 and row 21
  const cropY = 512 - 100;
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .extract({ left: 0, top: cropY, width: 512, height: 200 })
    .png()
    .toFile('debug_vboundary_zoom.png');
  console.log('Saved debug_vboundary_zoom.png — zoom on vertical tile boundary');

  // Also test: what does a single tile look like when decoded?
  // Save tile (20,20) by itself
  const single = decodeTile(20, 20);
  await sharp(single, { raw: { width: 512, height: 512, channels: 3 } })
    .png()
    .toFile('debug_single_tile_20_20.png');
  console.log('Saved debug_single_tile_20_20.png');

  // Save tile (20,20) with a red grid overlay showing 4x4 quadrants
  const overlay = Buffer.from(single);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      // Draw red lines at x=128,256,384 and y=128,256,384
      if (x === 128 || x === 256 || x === 384 || y === 128 || y === 256 || y === 384) {
        const i = (y * 512 + x) * 3;
        overlay[i] = 255; overlay[i+1] = 0; overlay[i+2] = 0;
      }
    }
  }
  await sharp(overlay, { raw: { width: 512, height: 512, channels: 3 } })
    .png()
    .toFile('debug_single_tile_grid.png');
  console.log('Saved debug_single_tile_grid.png — with quadrant grid overlay');

  // KEY TEST: Check if the top-left quadrant matches the other quadrants
  // (would explain "quadrupled" features)
  function quadrantAvg(rgb, qx, qy, w) {
    let r=0, g=0, b=0, n=0;
    for (let y = qy; y < qy + 256 && y < w; y += 8) {
      for (let x = qx; x < qx + 256 && x < w; x += 8) {
        const i = (y * w + x) * 3;
        r += rgb[i]; g += rgb[i+1]; b += rgb[i+2];
        n++;
      }
    }
    return { r: (r/n).toFixed(0), g: (g/n).toFixed(0), b: (b/n).toFixed(0) };
  }

  console.log('\nQuadrant averages for tile (20,20):');
  console.log('  TL:', quadrantAvg(single, 0, 0, 512));
  console.log('  TR:', quadrantAvg(single, 256, 0, 512));
  console.log('  BL:', quadrantAvg(single, 0, 256, 512));
  console.log('  BR:', quadrantAvg(single, 256, 256, 512));

  // Cross-correlate quadrants to check for repetition
  function quadrantDiff(rgb, q1x, q1y, q2x, q2y, w) {
    let diff = 0, n = 0;
    for (let dy = 0; dy < 256; dy += 4) {
      for (let dx = 0; dx < 256; dx += 4) {
        const i1 = ((q1y + dy) * w + q1x + dx) * 3;
        const i2 = ((q2y + dy) * w + q2x + dx) * 3;
        diff += Math.abs(rgb[i1] - rgb[i2]) + Math.abs(rgb[i1+1] - rgb[i2+1]) + Math.abs(rgb[i1+2] - rgb[i2+2]);
        n++;
      }
    }
    return (diff / n).toFixed(1);
  }

  console.log('\nQuadrant pair diffs (lower = more similar):');
  console.log('  TL vs TR:', quadrantDiff(single, 0,0, 256,0, 512));
  console.log('  TL vs BL:', quadrantDiff(single, 0,0, 0,256, 512));
  console.log('  TL vs BR:', quadrantDiff(single, 0,0, 256,256, 512));
  console.log('  TR vs BL:', quadrantDiff(single, 256,0, 0,256, 512));
}

main().catch(console.error);
