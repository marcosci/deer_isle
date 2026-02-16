// Check if adjacent tiles share overlapping border pixels
const fs = require('fs');
const dir = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');

  function getTilePixels(col, row) {
    const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
    const buf = fs.readFileSync(f);
    const p = new Paa();
    p.read(buf);
    const argb = p.getArgb32PixelData(buf, 0);
    return { argb, w: 512 };
  }

  function getPixel(argb, x, y, w) {
    const i = (y * w + x) * 4;
    return { r: argb[i + 2], g: argb[i + 1], b: argb[i + 0] };
  }

  // Compare the RIGHT edge of tile(10,10) with the LEFT edge of tile(11,10)
  const a = getTilePixels(10, 10);
  const b = getTilePixels(11, 10);

  console.log('=== Horizontal overlap check: tile(10,10) right vs tile(11,10) left ===');
  console.log('Checking if the last N cols of tile A match the first N cols of tile B\n');

  // Check overlap of 1, 2, 4, 8 pixels
  for (const overlap of [1, 2, 4, 8, 16]) {
    let totalDiff = 0;
    let samples = 0;
    for (let y = 0; y < 512; y += 4) {
      for (let dx = 0; dx < overlap; dx++) {
        const pa = getPixel(a.argb, 512 - overlap + dx, y, 512);
        const pb = getPixel(b.argb, dx, y, 512);
        totalDiff += Math.abs(pa.r - pb.r) + Math.abs(pa.g - pb.g) + Math.abs(pa.b - pb.b);
        samples++;
      }
    }
    const avgDiff = (totalDiff / samples).toFixed(1);
    console.log(`  overlap=${overlap}: avg pixel diff = ${avgDiff}`);
  }

  // Also check: does the LAST col of A match the FIRST col of B?
  console.log('\nPixel-by-pixel comparison for first few rows:');
  console.log('  A[511,y] vs B[0,y]:');
  for (let y = 0; y < 8; y++) {
    const pa = getPixel(a.argb, 511, y, 512);
    const pb = getPixel(b.argb, 0, y, 512);
    console.log(`    y=${y}: A=(${pa.r},${pa.g},${pa.b}) B=(${pb.r},${pb.g},${pb.b}) diff=${Math.abs(pa.r-pb.r)+Math.abs(pa.g-pb.g)+Math.abs(pa.b-pb.b)}`);
  }

  // Check if last 2 cols of A match first 2 cols of B
  console.log('\n  A[510..511,y] vs B[0..1,y]:');
  for (let y = 0; y < 4; y++) {
    for (let dx = 0; dx < 2; dx++) {
      const pa = getPixel(a.argb, 510 + dx, y, 512);
      const pb = getPixel(b.argb, dx, y, 512);
      console.log(`    y=${y} dx=${dx}: A[${510+dx}]=(${pa.r},${pa.g},${pa.b}) B[${dx}]=(${pb.r},${pb.g},${pb.b}) diff=${Math.abs(pa.r-pb.r)+Math.abs(pa.g-pb.g)+Math.abs(pa.b-pb.b)}`);
    }
  }

  // Now check VERTICAL overlap
  console.log('\n=== Vertical overlap check: tile(10,10) bottom vs tile(10,11) top ===');
  const c = getTilePixels(10, 11);
  for (const overlap of [1, 2, 4, 8, 16]) {
    let totalDiff = 0;
    let samples = 0;
    for (let x = 0; x < 512; x += 4) {
      for (let dy = 0; dy < overlap; dy++) {
        const pa = getPixel(a.argb, x, 512 - overlap + dy, 512);
        const pc = getPixel(c.argb, x, dy, 512);
        totalDiff += Math.abs(pa.r - pc.r) + Math.abs(pa.g - pc.g) + Math.abs(pa.b - pc.b);
        samples++;
      }
    }
    const avgDiff = (totalDiff / samples).toFixed(1);
    console.log(`  overlap=${overlap}: avg pixel diff = ${avgDiff}`);
  }

  // Now try matching A's right side vs B's left side with different offsets
  console.log('\n=== Cross-correlation: slide A right edge over B left edge ===');
  for (let shift = 0; shift <= 16; shift++) {
    let totalDiff = 0;
    let samples = 0;
    for (let y = 0; y < 512; y += 2) {
      // Compare A's column (511-shift) with B's column 0
      const pa = getPixel(a.argb, 511 - shift, y, 512);
      const pb = getPixel(b.argb, 0, y, 512);
      totalDiff += Math.abs(pa.r - pb.r) + Math.abs(pa.g - pb.g) + Math.abs(pa.b - pb.b);
      samples++;
    }
    const avgDiff = (totalDiff / samples).toFixed(1);
    console.log(`  A[${511-shift}] vs B[0]: avg diff = ${avgDiff} ${avgDiff < 5 ? '◄◄◄' : ''}`);
  }
}

main().catch(console.error);
