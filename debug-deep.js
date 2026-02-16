// Deep inspection of what's at the tile edges
const fs = require('fs');
const dir = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');

  function getTile(col, row) {
    const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
    const buf = fs.readFileSync(f);
    const p = new Paa();
    p.read(buf);
    const argb = p.getArgb32PixelData(buf, 0);
    return argb;
  }

  const a = getTile(20, 20);
  const b = getTile(21, 20);

  // Check how the rightmost columns of tile A compare to its center
  console.log('=== Tile A (20,20): column brightness profile ===');
  console.log('Col   | avgR  avgG  avgB');
  for (let x of [0, 1, 2, 3, 4, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 
                  505, 506, 507, 508, 509, 510, 511]) {
    let r = 0, g = 0, b = 0;
    for (let y = 0; y < 512; y++) {
      const i = (y * 512 + x) * 4;
      r += a[i + 2]; g += a[i + 1]; b += a[i + 0];
    }
    r /= 512; g /= 512; b /= 512;
    console.log(`  ${String(x).padStart(3)} | ${r.toFixed(1).padStart(5)}  ${g.toFixed(1).padStart(5)}  ${b.toFixed(1).padStart(5)}`);
  }

  console.log('\n=== Tile B (21,20): column brightness profile ===');
  for (let x of [0, 1, 2, 3, 4, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260,
                  505, 506, 507, 508, 509, 510, 511]) {
    let r = 0, g = 0, b = 0;
    for (let y = 0; y < 512; y++) {
      const i = (y * 512 + x) * 4;
      r += b[i + 2]; g += b[i + 1]; b += b[i + 0];
    }
    r /= 512; g /= 512; b /= 512;
    console.log(`  ${String(x).padStart(3)} | ${r.toFixed(1).padStart(5)}  ${g.toFixed(1).padStart(5)}  ${b.toFixed(1).padStart(5)}`);
  }

  // Row profile for tile A
  console.log('\n=== Tile A (20,20): row brightness profile ===');
  for (let y of [0, 1, 2, 3, 4, 254, 255, 256, 257, 258, 507, 508, 509, 510, 511]) {
    let r = 0, g = 0, bl = 0;
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      r += a[i + 2]; g += a[i + 1]; bl += a[i + 0];
    }
    r /= 512; g /= 512; bl /= 512;
    console.log(`  ${String(y).padStart(3)} | ${r.toFixed(1).padStart(5)}  ${g.toFixed(1).padStart(5)}  ${bl.toFixed(1).padStart(5)}`);
  }

  // Check the PAA structure more closely
  console.log('\n=== PAA file structure ===');
  const f = `${dir}\\s_020_020_lco.paa`;
  const raw = fs.readFileSync(f);
  const p = new Paa();
  p.read(raw);
  console.log('Type:', p.type);
  console.log('Mipmaps:');
  p.mipmaps.forEach((m, i) => {
    console.log(`  [${i}] ${m.width}x${m.height} offset=${m.dataOffset} len=${m.dataSize} compression=${m.compression}`);
  });

  // Check if there are any tags/metadata
  if (p.taggs) {
    console.log('Tags:', p.taggs);
  }
  if (p.averageColor) {
    console.log('Average color:', p.averageColor);
  }

  // Dump raw PAA header bytes
  console.log('\nFirst 32 bytes of PAA file:');
  console.log(raw.subarray(0, 32).toString('hex'));

  // Check the actual pixel data size from the PAA
  const argb0 = p.getArgb32PixelData(raw, 0);
  console.log(`\nMip 0 pixel data: ${argb0.length} bytes = ${argb0.length/4} pixels = ${Math.sqrt(argb0.length/4)}x${Math.sqrt(argb0.length/4)}`);
}

main().catch(console.error);
