// Find the exact pixel overlap between adjacent tiles
const fs = require('fs');
const dir = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');

  function getTileRow(col, row, y) {
    const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
    const buf = fs.readFileSync(f);
    const p = new Paa(); p.read(buf);
    const argb = p.getArgb32PixelData(buf, 0);
    const pixels = [];
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      pixels.push([argb[i + 2], argb[i + 1], argb[i + 0]]); // RGB
    }
    return pixels;
  }

  function getTileCol(col, row, x) {
    const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
    const buf = fs.readFileSync(f);
    const p = new Paa(); p.read(buf);
    const argb = p.getArgb32PixelData(buf, 0);
    const pixels = [];
    for (let y = 0; y < 512; y++) {
      const i = (y * 512 + x) * 4;
      pixels.push([argb[i + 2], argb[i + 1], argb[i + 0]]); // RGB
    }
    return pixels;
  }

  function rowDiff(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      sum += Math.abs(a[i][0] - b[i][0]) + Math.abs(a[i][1] - b[i][1]) + Math.abs(a[i][2] - b[i][2]);
    }
    return sum / len;
  }

  // HORIZONTAL overlap: compare rightmost columns of tile(20,20) with leftmost columns of tile(21,20)
  console.log('=== Horizontal overlap: tile(20,20) right vs tile(21,20) left ===');
  console.log('Checking if column N from the right of A matches column N from the left of B\n');

  // For each potential overlap from 1 to 32, check if the last N cols of A match first N cols of B
  for (let overlap = 1; overlap <= 32; overlap++) {
    let totalDiff = 0;
    let samples = 0;
    for (let dy = 0; dy < overlap; dy++) {
      // Compare A's column (512 - overlap + dy) with B's column (dy)
      const aCol = getTileCol(20, 20, 512 - overlap + dy);
      const bCol = getTileCol(21, 20, dy);
      totalDiff += rowDiff(aCol, bCol);
      samples++;
    }
    const avg = (totalDiff / samples).toFixed(1);
    const marker = parseFloat(avg) < 10 ? ' ◄◄◄ MATCH' : parseFloat(avg) < 20 ? ' ◄' : '';
    console.log(`  overlap=${String(overlap).padStart(2)}: avg diff = ${avg}${marker}`);
  }

  // VERTICAL overlap: compare bottom rows of tile(20,20) with top rows of tile(20,21)
  console.log('\n=== Vertical overlap: tile(20,20) bottom vs tile(20,21) top ===\n');

  for (let overlap = 1; overlap <= 32; overlap++) {
    let totalDiff = 0;
    let samples = 0;
    for (let dy = 0; dy < overlap; dy++) {
      const aRow = getTileRow(20, 20, 512 - overlap + dy);
      const bRow = getTileRow(20, 21, dy);
      totalDiff += rowDiff(aRow, bRow);
      samples++;
    }
    const avg = (totalDiff / samples).toFixed(1);
    const marker = parseFloat(avg) < 10 ? ' ◄◄◄ MATCH' : parseFloat(avg) < 20 ? ' ◄' : '';
    console.log(`  overlap=${String(overlap).padStart(2)}: avg diff = ${avg}${marker}`);
  }

  // Also try: does a specific ROW of A match a specific ROW of B?
  // Maybe the last row of A = first row of B (1px overlap)
  console.log('\n=== Single-line checks (horizontal neighbor) ===');
  console.log('A = tile(20,20), B = tile(21,20)\n');
  
  // Check: does A's last column match B's first column?
  const aLastCol = getTileCol(20, 20, 511);
  const bFirstCol = getTileCol(21, 20, 0);
  console.log(`  A col 511 vs B col 0: diff = ${rowDiff(aLastCol, bFirstCol).toFixed(1)}`);
  
  const aCol510 = getTileCol(20, 20, 510);
  console.log(`  A col 510 vs B col 0: diff = ${rowDiff(aCol510, bFirstCol).toFixed(1)}`);
  
  const bCol1 = getTileCol(21, 20, 1);
  console.log(`  A col 511 vs B col 1: diff = ${rowDiff(aLastCol, bCol1).toFixed(1)}`);

  // Check vertical
  console.log('\n=== Single-line checks (vertical neighbor) ===');
  console.log('A = tile(20,20), C = tile(20,21)\n');
  
  const aLastRow = getTileRow(20, 20, 511);
  const cFirstRow = getTileRow(20, 21, 0);
  console.log(`  A row 511 vs C row 0: diff = ${rowDiff(aLastRow, cFirstRow).toFixed(1)}`);
  
  const aRow510 = getTileRow(20, 20, 510);
  console.log(`  A row 510 vs C row 0: diff = ${rowDiff(aRow510, cFirstRow).toFixed(1)}`);
  
  const cRow1 = getTileRow(20, 21, 1);
  console.log(`  A row 511 vs C row 1: diff = ${rowDiff(aLastRow, cRow1).toFixed(1)}`);

  // Try different tile pairs to make sure it's not just this one pair
  console.log('\n=== Cross-check with tile pair (10,10) / (11,10) ===');
  const a2LastCol = getTileCol(10, 10, 511);
  const b2FirstCol = getTileCol(11, 10, 0);
  const a2Col510 = getTileCol(10, 10, 510);
  const b2Col1 = getTileCol(11, 10, 1);
  console.log(`  A col 511 vs B col 0: diff = ${rowDiff(a2LastCol, b2FirstCol).toFixed(1)}`);
  console.log(`  A col 510 vs B col 0: diff = ${rowDiff(a2Col510, b2FirstCol).toFixed(1)}`);
  console.log(`  A col 511 vs B col 1: diff = ${rowDiff(a2LastCol, b2Col1).toFixed(1)}`);

  // Maybe the tiles represent world areas that DON'T overlap, and the issue is elsewhere
  // Let me check what % of the tile is "unique" by looking at auto-correlation  
  // Check: does the CONTENT of A's rightmost 4px look like the beginning of B?
  console.log('\n=== Pixel content comparison at boundary (y=256) ===');
  const aMid = getTileRow(20, 20, 256);
  const bMid = getTileRow(21, 20, 256);
  console.log('Last 8px of A:', aMid.slice(-8).map(p => `(${p})`).join(' '));
  console.log('First 8px of B:', bMid.slice(0, 8).map(p => `(${p})`).join(' '));
}

main().catch(console.error);
