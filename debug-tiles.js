// Debug: Save corner tiles and a small 4×4 grid snippet to verify col/row mapping
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

  // Save individual corner tiles
  const corners = [
    [0, 0, 'topleft'],
    [42, 0, 'topright'],
    [0, 42, 'bottomleft'],
    [42, 42, 'bottomright'],
    [20, 20, 'center'],
  ];
  for (const [col, row, name] of corners) {
    const rgb = decodeTile(col, row);
    await sharp(rgb, { raw: { width: 512, height: 512, channels: 3 } })
      .png()
      .toFile(`debug_tile_${name}_c${col}_r${row}.png`);
    console.log(`Saved debug_tile_${name}_c${col}_r${row}.png`);
  }

  // Build a small 4x4 grid from top-left corner to check alignment
  const G = 4;
  const sz = G * 512;
  const buf = Buffer.alloc(sz * sz * 3);
  for (let row = 0; row < G; row++) {
    for (let col = 0; col < G; col++) {
      const rgb = decodeTile(col, row);
      for (let y = 0; y < 512; y++) {
        const dstOff = ((row * 512 + y) * sz + col * 512) * 3;
        const srcOff = y * 512 * 3;
        rgb.copy(buf, dstOff, srcOff, srcOff + 512 * 3);
      }
    }
  }
  await sharp(buf, { raw: { width: sz, height: sz, channels: 3 } })
    .png()
    .toFile('debug_grid_4x4.png');
  console.log('Saved debug_grid_4x4.png (top-left 4x4 tiles)');

  // Build a small 4x4 grid but with SWAPPED col/row to test
  const buf2 = Buffer.alloc(sz * sz * 3);
  for (let row = 0; row < G; row++) {
    for (let col = 0; col < G; col++) {
      const rgb = decodeTile(row, col); // SWAPPED!
      for (let y = 0; y < 512; y++) {
        const dstOff = ((row * 512 + y) * sz + col * 512) * 3;
        const srcOff = y * 512 * 3;
        rgb.copy(buf2, dstOff, srcOff, srcOff + 512 * 3);
      }
    }
  }
  await sharp(buf2, { raw: { width: sz, height: sz, channels: 3 } })
    .png()
    .toFile('debug_grid_4x4_swapped.png');
  console.log('Saved debug_grid_4x4_swapped.png (col/row swapped)');
}

main().catch(console.error);
