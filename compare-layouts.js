// Compare debug images to find which has smooth stitching
// We'll check average pixel diff at tile boundaries for each version
const fs = require('fs');
const sharp = require('sharp');

async function main() {
  const files = [
    'debug_satellite_normal.png',
    'debug_satellite_flipped.png',
    'debug_satellite_tileflip.png',
    'debug_satellite_bothflip.png',
  ];
  
  const TILE = 64;
  const GRID = 43;
  
  for (const file of files) {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const ch = info.channels;
    
    // Check horizontal seams: compare pixel at (col*TILE - 1) vs (col*TILE) for all cols 1..42
    let hDiffTotal = 0, hSamples = 0;
    for (let col = 1; col < GRID; col++) {
      const x0 = col * TILE - 1;
      const x1 = col * TILE;
      for (let y = 0; y < GRID * TILE; y += 2) {
        const i0 = (y * w + x0) * ch;
        const i1 = (y * w + x1) * ch;
        hDiffTotal += Math.abs(data[i0] - data[i1]) + Math.abs(data[i0+1] - data[i1+1]) + Math.abs(data[i0+2] - data[i1+2]);
        hSamples++;
      }
    }
    
    // Check vertical seams
    let vDiffTotal = 0, vSamples = 0;
    for (let row = 1; row < GRID; row++) {
      const y0 = row * TILE - 1;
      const y1 = row * TILE;
      for (let x = 0; x < GRID * TILE; x += 2) {
        const i0 = (y0 * w + x) * ch;
        const i1 = (y1 * w + x) * ch;
        vDiffTotal += Math.abs(data[i0] - data[i1]) + Math.abs(data[i0+1] - data[i1+1]) + Math.abs(data[i0+2] - data[i1+2]);
        vSamples++;
      }
    }
    
    // Check interior smoothness (non-boundary pixels) for comparison
    let intDiff = 0, intSamples = 0;
    for (let y = 10; y < 200; y += 4) {
      for (let x = 10; x < 200; x += 4) {
        if (x % TILE <= 1 || y % TILE <= 1) continue; // skip boundaries
        const i0 = (y * w + x) * ch;
        const i1 = (y * w + x + 1) * ch;
        intDiff += Math.abs(data[i0] - data[i1]) + Math.abs(data[i0+1] - data[i1+1]) + Math.abs(data[i0+2] - data[i1+2]);
        intSamples++;
      }
    }
    
    console.log(`${file}:`);
    console.log(`  H-seam avg diff: ${(hDiffTotal / hSamples).toFixed(2)}`);
    console.log(`  V-seam avg diff: ${(vDiffTotal / vSamples).toFixed(2)}`);
    console.log(`  Interior avg diff: ${(intDiff / intSamples).toFixed(2)}`);
    console.log(`  Seam/Interior ratio: H=${(hDiffTotal/hSamples / (intDiff/intSamples)).toFixed(2)}x  V=${(vDiffTotal/vSamples / (intDiff/intSamples)).toFixed(2)}x`);
    console.log();
  }
}

main().catch(console.error);
