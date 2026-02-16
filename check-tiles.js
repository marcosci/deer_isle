const fs = require('fs');
const dir = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');
  const sizes = new Map();
  let checked = 0;
  const odd = [];

  for (let row = 0; row < 43; row++) {
    for (let col = 0; col < 43; col++) {
      const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
      if (!fs.existsSync(f)) continue;
      const buf = fs.readFileSync(f);
      const p = new Paa();
      p.read(buf);
      const w = p.mipmaps[0].width;
      const h = p.mipmaps[0].height;
      const k = `${w}x${h}`;
      sizes.set(k, (sizes.get(k) || 0) + 1);
      if (w !== 512 || h !== 512) odd.push({ col, row, w, h });

      // also check pixel data length
      const argb = p.getArgb32PixelData(buf, 0);
      if (argb.length !== w * h * 4) {
        console.log(`PIXEL LEN MISMATCH: col=${col} row=${row} expected=${w*h*4} got=${argb.length}`);
      }
      checked++;
    }
  }

  console.log('Checked:', checked);
  for (const [k, v] of sizes) console.log(`  ${k}: ${v} tiles`);
  if (odd.length) {
    console.log('\nNon-512 tiles:');
    odd.forEach(o => console.log(`  col=${o.col} row=${o.row} → ${o.w}x${o.h}`));
  } else {
    console.log('\nAll tiles are 512x512 ✓');
  }
}

main().catch(console.error);
