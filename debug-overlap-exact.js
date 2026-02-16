const fs = require('fs');
const path = require('path');

const LAYERS_DIR = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';

async function decodeTile(col, row, Paa) {
  const name = `s_${String(col).padStart(3,'0')}_${String(row).padStart(3,'0')}_lco.paa`;
  const buf = fs.readFileSync(path.join(LAYERS_DIR, name));
  const paa = new Paa(); paa.read(buf);
  const argb = paa.getArgb32PixelData(buf, 0);
  const w = 512, h = 512;

  // BGRA -> RGB (no flip for this debug)
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3]     = argb[i * 4 + 2]; // R
    rgb[i * 3 + 1] = argb[i * 4 + 1]; // G
    rgb[i * 3 + 2] = argb[i * 4 + 0]; // B
  }
  return { rgb, w, h };
}

// Compare a strip from one tile with a strip from another
// Returns average pixel difference (0 = perfect match)
function compareStrips(strip1, strip2) {
  if (strip1.length !== strip2.length) return 999;
  let sum = 0;
  for (let i = 0; i < strip1.length; i++) {
    sum += Math.abs(strip1[i] - strip2[i]);
  }
  return sum / strip1.length;
}

// Extract right N columns from tile (RGB buffer, width w, height h)
function getRightCols(rgb, w, h, n) {
  const strip = Buffer.alloc(n * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < n; x++) {
      const srcIdx = (y * w + (w - n + x)) * 3;
      const dstIdx = (y * n + x) * 3;
      strip[dstIdx]     = rgb[srcIdx];
      strip[dstIdx + 1] = rgb[srcIdx + 1];
      strip[dstIdx + 2] = rgb[srcIdx + 2];
    }
  }
  return strip;
}

// Extract left N columns
function getLeftCols(rgb, w, h, n) {
  const strip = Buffer.alloc(n * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < n; x++) {
      const srcIdx = (y * w + x) * 3;
      const dstIdx = (y * n + x) * 3;
      strip[dstIdx]     = rgb[srcIdx];
      strip[dstIdx + 1] = rgb[srcIdx + 1];
      strip[dstIdx + 2] = rgb[srcIdx + 2];
    }
  }
  return strip;
}

// Extract bottom N rows
function getBottomRows(rgb, w, h, n) {
  const strip = Buffer.alloc(n * w * 3);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = ((h - n + y) * w + x) * 3;
      const dstIdx = (y * w + x) * 3;
      strip[dstIdx]     = rgb[srcIdx];
      strip[dstIdx + 1] = rgb[srcIdx + 1];
      strip[dstIdx + 2] = rgb[srcIdx + 2];
    }
  }
  return strip;
}

// Extract top N rows
function getTopRows(rgb, w, h, n) {
  const strip = Buffer.alloc(n * w * 3);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 3;
      const dstIdx = (y * w + x) * 3;
      strip[dstIdx]     = rgb[srcIdx];
      strip[dstIdx + 1] = rgb[srcIdx + 1];
      strip[dstIdx + 2] = rgb[srcIdx + 2];
    }
  }
  return strip;
}

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');

  // Test with multiple tile pairs at different locations
  const testPairs = [
    // Horizontal pairs: left tile, right tile
    { name: 'H(20,20)-(21,20)', left: [20,20], right: [21,20], dir: 'h' },
    { name: 'H(10,10)-(11,10)', left: [10,10], right: [11,10], dir: 'h' },
    { name: 'H(0,42)-(1,42)', left: [0,42], right: [1,42], dir: 'h' },
    // Vertical pairs: top tile, bottom tile
    { name: 'V(20,20)-(20,21)', top: [20,20], bottom: [20,21], dir: 'v' },
    { name: 'V(10,10)-(10,11)', top: [10,10], bottom: [10,11], dir: 'v' },
    { name: 'V(0,41)-(0,42)', top: [0,41], bottom: [0,42], dir: 'v' },
  ];

  // Test overlaps from 1 to 256 in steps
  const overlaps = [1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256];

  for (const pair of testPairs) {
    console.log(`\n=== ${pair.name} ===`);
    
    if (pair.dir === 'h') {
      const tileL = await decodeTile(pair.left[0], pair.left[1], Paa);
      const tileR = await decodeTile(pair.right[0], pair.right[1], Paa);
      
      console.log('Overlap | RightOfLeft vs LeftOfRight | Diff');
      let bestOverlap = 0, bestDiff = 999;
      for (const ov of overlaps) {
        if (ov >= tileL.w) continue;
        const stripL = getRightCols(tileL.rgb, tileL.w, tileL.h, ov);
        const stripR = getLeftCols(tileR.rgb, tileR.w, tileR.h, ov);
        const diff = compareStrips(stripL, stripR);
        console.log(`  ${String(ov).padStart(4)} px  |  diff = ${diff.toFixed(2)}`);
        if (diff < bestDiff) { bestDiff = diff; bestOverlap = ov; }
      }
      console.log(`  BEST: ${bestOverlap} px (diff ${bestDiff.toFixed(2)})`);
    } else {
      const tileT = await decodeTile(pair.top[0], pair.top[1], Paa);
      const tileB = await decodeTile(pair.bottom[0], pair.bottom[1], Paa);
      
      console.log('Overlap | BottomOfTop vs TopOfBottom | Diff');
      let bestOverlap = 0, bestDiff = 999;
      for (const ov of overlaps) {
        if (ov >= tileT.h) continue;
        const stripT = getBottomRows(tileT.rgb, tileT.w, tileT.h, ov);
        const stripB = getTopRows(tileB.rgb, tileB.w, tileB.h, ov);
        const diff = compareStrips(stripT, stripB);
        console.log(`  ${String(ov).padStart(4)} px  |  diff = ${diff.toFixed(2)}`);
        if (diff < bestDiff) { bestDiff = diff; bestOverlap = ov; }
      }
      console.log(`  BEST: ${bestOverlap} px (diff ${bestDiff.toFixed(2)})`);
    }
  }

  // Also check: does the RIGHT side of tile match the LEFT side of tile+2?
  // (This would indicate a larger stride)
  console.log('\n=== STRIDE CHECK: Does right of tile N match left of tile N+2? ===');
  {
    const t0 = await decodeTile(20, 20, Paa);
    const t2 = await decodeTile(22, 20, Paa);
    for (const ov of [1, 4, 16, 32, 64, 128, 256]) {
      if (ov >= t0.w) continue;
      const stripL = getRightCols(t0.rgb, t0.w, t0.h, ov);
      const stripR = getLeftCols(t2.rgb, t2.w, t2.h, ov);
      const diff = compareStrips(stripL, stripR);
      console.log(`  ${String(ov).padStart(4)} px  |  diff = ${diff.toFixed(2)}`);
    }
  }

  // Check: does bottom-left CONTENT of a tile match top-left CONTENT of tile below?
  // Maybe tiles have some border on all sides
  console.log('\n=== BORDER CHECK: Interior matching with assumed border ===');
  console.log('Testing if tile(20,20) interior bottom matches tile(20,21) interior top');
  console.log('with various border widths cropped from all sides');
  {
    const tT = await decodeTile(20, 20, Paa);
    const tB = await decodeTile(20, 21, Paa);
    
    for (const border of [0, 4, 8, 12, 16, 24, 32, 48, 64]) {
      // From top tile: get row at (h - 1 - border), width adjusted by border
      // From bottom tile: get row at (border), width adjusted by border
      const innerW = tT.w - 2 * border;
      if (innerW <= 0) continue;
      
      const stripT = Buffer.alloc(innerW * 3);
      const stripB = Buffer.alloc(innerW * 3);
      const rowT = tT.h - 1 - border;
      const rowB = border;
      
      for (let x = 0; x < innerW; x++) {
        const sT = (rowT * tT.w + border + x) * 3;
        const sB = (rowB * tB.w + border + x) * 3;
        stripT[x*3]   = tT.rgb[sT];   stripT[x*3+1] = tT.rgb[sT+1]; stripT[x*3+2] = tT.rgb[sT+2];
        stripB[x*3]   = tB.rgb[sB];   stripB[x*3+1] = tB.rgb[sB+1]; stripB[x*3+2] = tB.rgb[sB+2];
      }
      const diff = compareStrips(stripT, stripB);
      console.log(`  border=${String(border).padStart(3)} -> inner row diff = ${diff.toFixed(2)}`);
    }
  }

  // Ultimate test: For each possible overlap N, crop N pixels from right of left tile,
  // and N pixels from left of right tile, and see if the remaining (512-N) pixels 
  // on the right of the left tile match the (512-N) pixels on the left of the right tile
  // This tests the "overlap border" theory: each tile extends N pixels into neighbor territory
  console.log('\n=== OVERLAP BORDER THEORY ===');
  console.log('If each tile has N px of overlap on each side,');
  console.log('then right (512-N) of left tile = left (512-N) of right tile, offset by N');
  {
    const tL = await decodeTile(10, 10, Paa);
    const tR = await decodeTile(11, 10, Paa);
    
    for (const N of [1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128]) {
      const stripW = tL.w - 2 * N;
      if (stripW <= 0) continue;
      
      // Right (stripW) pixels of left tile, starting at column N  
      // = we skip N cols on left (border), take next stripW cols
      // Actually: left tile's content without borders would be cols [N, 512-N)
      // right tile's content without borders would be cols [N, 512-N)
      // The right edge of left tile's content (col 512-N-1) should match
      // the left edge of right tile's content (col N)
      // No wait - if overlap is N, then:
      // Left tile covers world pixels [tileStart - N, tileStart + tileSize + N)
      // Right tile covers world pixels [tileStart + tileSize - N, tileStart + 2*tileSize + N)
      // Overlap region: [tileStart + tileSize - N, tileStart + tileSize + N) = 2N pixels
      // In left tile coords: cols [512 - 2N, 512) 
      // In right tile coords: cols [0, 2N)
      
      const ov2N = 2 * N;
      if (ov2N > tL.w) continue;
      const stripL = getRightCols(tL.rgb, tL.w, tL.h, ov2N);
      const stripR = getLeftCols(tR.rgb, tR.w, tR.h, ov2N);
      const diff = compareStrips(stripL, stripR);
      console.log(`  N=${String(N).padStart(3)} (overlap=2N=${String(ov2N).padStart(3)}) | diff = ${diff.toFixed(2)}`);
    }
  }

  // Maybe the overlap is asymmetric - right side of tile L maps to some offset in tile R
  // Let's do a sliding window search
  console.log('\n=== SLIDING WINDOW: Find where 32px strip from right of tileL appears in tileR ===');
  {
    const tL = await decodeTile(10, 10, Paa);
    const tR = await decodeTile(11, 10, Paa);
    const stripW = 32;
    const stripL = getRightCols(tL.rgb, tL.w, tL.h, stripW);
    
    let bestOff = 0, bestDiff = 999;
    // Slide strip across tileR
    for (let off = 0; off <= tR.w - stripW; off++) {
      // Extract stripW columns from tileR starting at column off
      const stripR = Buffer.alloc(stripW * tR.h * 3);
      for (let y = 0; y < tR.h; y++) {
        for (let x = 0; x < stripW; x++) {
          const srcIdx = (y * tR.w + off + x) * 3;
          const dstIdx = (y * stripW + x) * 3;
          stripR[dstIdx]     = tR.rgb[srcIdx];
          stripR[dstIdx + 1] = tR.rgb[srcIdx + 1];
          stripR[dstIdx + 2] = tR.rgb[srcIdx + 2];
        }
      }
      const diff = compareStrips(stripL, stripR);
      if (diff < bestDiff) { bestDiff = diff; bestOff = off; }
      if (off % 50 === 0 || diff < 15) {
        console.log(`  offset=${String(off).padStart(3)} | diff = ${diff.toFixed(2)}${diff < 15 ? ' <<<' : ''}`);
      }
    }
    console.log(`  BEST MATCH: offset=${bestOff} (diff ${bestDiff.toFixed(2)})`);
  }

  // Same but vertical
  console.log('\n=== SLIDING WINDOW VERTICAL: Find where 32px strip from bottom of tileT appears in tileB ===');
  {
    const tT = await decodeTile(10, 10, Paa);
    const tB = await decodeTile(10, 11, Paa);
    const stripH = 32;
    const stripT = getBottomRows(tT.rgb, tT.w, tT.h, stripH);
    
    let bestOff = 0, bestDiff = 999;
    for (let off = 0; off <= tB.h - stripH; off++) {
      const stripB = Buffer.alloc(stripH * tB.w * 3);
      for (let y = 0; y < stripH; y++) {
        for (let x = 0; x < tB.w; x++) {
          const srcIdx = ((off + y) * tB.w + x) * 3;
          const dstIdx = (y * tB.w + x) * 3;
          stripB[dstIdx]     = tB.rgb[srcIdx];
          stripB[dstIdx + 1] = tB.rgb[srcIdx + 1];
          stripB[dstIdx + 2] = tB.rgb[srcIdx + 2];
        }
      }
      const diff = compareStrips(stripT, stripB);
      if (diff < bestDiff) { bestDiff = diff; bestOff = off; }
      if (off % 50 === 0 || diff < 15) {
        console.log(`  offset=${String(off).padStart(3)} | diff = ${diff.toFixed(2)}${diff < 15 ? ' <<<' : ''}`);
      }
    }
    console.log(`  BEST MATCH: offset=${bestOff} (diff ${bestDiff.toFixed(2)})`);
  }
}

main().catch(console.error);
