// Check edge continuity between adjacent tiles
const fs = require('fs');
const dir = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');

  function decodeTileRGB(col, row) {
    const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
    const buf = fs.readFileSync(f);
    const p = new Paa();
    p.read(buf);
    const argb = p.getArgb32PixelData(buf, 0);
    // Return as 2D array [y][x] = {r,g,b}
    const pixels = [];
    for (let y = 0; y < 512; y++) {
      const row = [];
      for (let x = 0; x < 512; x++) {
        const i = (y * 512 + x) * 4;
        row.push({ r: argb[i + 2], g: argb[i + 1], b: argb[i + 0] });
      }
      pixels.push(row);
    }
    return pixels;
  }

  // Check horizontal continuity: right edge of (10,10) vs left edge of (11,10)
  console.log('=== Horizontal: tile(10,10) right edge vs tile(11,10) left edge ===');
  const a = decodeTileRGB(10, 10);
  const b = decodeTileRGB(11, 10);
  let hDiff = 0;
  for (let y = 0; y < 512; y += 32) {
    const ar = a[y][511], bl = b[y][0];
    const diff = Math.abs(ar.r - bl.r) + Math.abs(ar.g - bl.g) + Math.abs(ar.b - bl.b);
    hDiff += diff;
    if (y < 256) {
      console.log(`  y=${y}: (${ar.r},${ar.g},${ar.b}) | (${bl.r},${bl.g},${bl.b})  diff=${diff}`);
    }
  }
  console.log(`  Total horizontal diff (sampled): ${hDiff}`);

  // Check vertical continuity: bottom edge of (10,10) vs top edge of (10,11)
  console.log('\n=== Vertical: tile(10,10) bottom edge vs tile(10,11) top edge ===');
  const c = decodeTileRGB(10, 11);
  let vDiff = 0;
  for (let x = 0; x < 512; x += 32) {
    const ab = a[511][x], ct = c[0][x];
    const diff = Math.abs(ab.r - ct.r) + Math.abs(ab.g - ct.g) + Math.abs(ab.b - ct.b);
    vDiff += diff;
    if (x < 256) {
      console.log(`  x=${x}: (${ab.r},${ab.g},${ab.b}) | (${ct.r},${ct.g},${ct.b})  diff=${diff}`);
    }
  }
  console.log(`  Total vertical diff (sampled): ${vDiff}`);

  // Now check with SWAPPED convention to see which is smoother
  console.log('\n=== SWAPPED Horizontal: tile(10,10) right vs tile(10,11) left (treating first num as row) ===');
  // If the naming is s_ROW_COL, then tile(10,10).right should match tile(10,11).left
  const d = decodeTileRGB(10, 11); // was our "vertical" neighbor
  let hDiff2 = 0;
  for (let y = 0; y < 512; y += 32) {
    const ar2 = a[y][511], dl = d[y][0];
    const diff = Math.abs(ar2.r - dl.r) + Math.abs(ar2.g - dl.g) + Math.abs(ar2.b - dl.b);
    hDiff2 += diff;
  }
  console.log(`  Total swapped horizontal diff (sampled): ${hDiff2}`);
  
  console.log('\n=== SWAPPED Vertical: tile(10,10) bottom vs tile(11,10) top (treating first num as row) ===');
  let vDiff2 = 0;
  for (let x = 0; x < 512; x += 32) {
    const ab2 = a[511][x], bt = b[0][x];
    const diff = Math.abs(ab2.r - bt.r) + Math.abs(ab2.g - bt.g) + Math.abs(ab2.b - bt.b);
    vDiff2 += diff;
  }
  console.log(`  Total swapped vertical diff (sampled): ${vDiff2}`);

  console.log('\n--- Summary ---');
  console.log(`Original (first=col): H=${hDiff}, V=${vDiff}`);
  console.log(`Swapped  (first=row): H=${hDiff2}, V=${vDiff2}`);
  console.log(`Lower is better (smoother edge transitions)`);
}

main().catch(console.error);
