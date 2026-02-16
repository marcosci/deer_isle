// Build a debug version with tile labels so we can see the grid layout
const fs = require('fs');
const sharp = require('sharp');
const dir = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');
  
  // Build a small version: just use mipmap level 3 (64x64) for speed
  // 43 * 64 = 2752
  const TILE = 64;
  const GRID = 43;
  const SIZE = GRID * TILE;
  
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
      if (!fs.existsSync(f)) continue;
      
      const raw = fs.readFileSync(f);
      const p = new Paa();
      p.read(raw);
      
      // Use mipmap 3 = 64x64
      const argb = p.getArgb32PixelData(raw, 3);
      const mw = p.mipmaps[3].width;
      const mh = p.mipmaps[3].height;
      
      const dstX = col * TILE;
      const dstY = row * TILE;  // row 0 = top
      
      for (let y = 0; y < TILE && y < mh; y++) {
        for (let x = 0; x < TILE && x < mw; x++) {
          const si = (y * mw + x) * 4;
          const di = ((dstY + y) * SIZE + dstX + x) * 3;
          buf[di + 0] = argb[si + 2]; // R
          buf[di + 1] = argb[si + 1]; // G
          buf[di + 2] = argb[si + 0]; // B
        }
      }
    }
  }
  
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .png()
    .toFile('debug_satellite_normal.png');
  console.log('Saved debug_satellite_normal.png (row 0 = top)');
  
  // Now try flipped: row 0 at the BOTTOM
  const buf2 = Buffer.alloc(SIZE * SIZE * 3);
  
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
      if (!fs.existsSync(f)) continue;
      
      const raw = fs.readFileSync(f);
      const p = new Paa();
      p.read(raw);
      
      const argb = p.getArgb32PixelData(raw, 3);
      const mw = p.mipmaps[3].width;
      const mh = p.mipmaps[3].height;
      
      const dstX = col * TILE;
      const dstY = (GRID - 1 - row) * TILE;  // row 0 = bottom (Y-up)
      
      for (let y = 0; y < TILE && y < mh; y++) {
        for (let x = 0; x < TILE && x < mw; x++) {
          const si = (y * mw + x) * 4;
          const di = ((dstY + y) * SIZE + dstX + x) * 3;
          buf2[di + 0] = argb[si + 2];
          buf2[di + 1] = argb[si + 1];
          buf2[di + 2] = argb[si + 0];
        }
      }
    }
  }
  
  await sharp(buf2, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .png()
    .toFile('debug_satellite_flipped.png');
  console.log('Saved debug_satellite_flipped.png (row 0 = bottom, Y-up)');

  // Also try: each individual tile might be Y-flipped internally
  const buf3 = Buffer.alloc(SIZE * SIZE * 3);
  
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
      if (!fs.existsSync(f)) continue;
      
      const raw = fs.readFileSync(f);
      const p = new Paa();
      p.read(raw);
      
      const argb = p.getArgb32PixelData(raw, 3);
      const mw = p.mipmaps[3].width;
      const mh = p.mipmaps[3].height;
      
      const dstX = col * TILE;
      const dstY = row * TILE;
      
      for (let y = 0; y < TILE && y < mh; y++) {
        const flippedY = (TILE - 1 - y);  // flip each tile vertically
        for (let x = 0; x < TILE && x < mw; x++) {
          const si = (y * mw + x) * 4;
          const di = ((dstY + flippedY) * SIZE + dstX + x) * 3;
          buf3[di + 0] = argb[si + 2];
          buf3[di + 1] = argb[si + 1];
          buf3[di + 2] = argb[si + 0];
        }
      }
    }
  }
  
  await sharp(buf3, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .png()
    .toFile('debug_satellite_tileflip.png');
  console.log('Saved debug_satellite_tileflip.png (each tile Y-flipped)');

  // Try both: grid flipped AND each tile flipped
  const buf4 = Buffer.alloc(SIZE * SIZE * 3);
  
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
      if (!fs.existsSync(f)) continue;
      
      const raw = fs.readFileSync(f);
      const p = new Paa();
      p.read(raw);
      
      const argb = p.getArgb32PixelData(raw, 3);
      const mw = p.mipmaps[3].width;
      const mh = p.mipmaps[3].height;
      
      const dstX = col * TILE;
      const dstY = (GRID - 1 - row) * TILE;
      
      for (let y = 0; y < TILE && y < mh; y++) {
        const flippedY = (TILE - 1 - y);
        for (let x = 0; x < TILE && x < mw; x++) {
          const si = (y * mw + x) * 4;
          const di = ((dstY + flippedY) * SIZE + dstX + x) * 3;
          buf4[di + 0] = argb[si + 2];
          buf4[di + 1] = argb[si + 1];
          buf4[di + 2] = argb[si + 0];
        }
      }
    }
  }
  
  await sharp(buf4, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .png()
    .toFile('debug_satellite_bothflip.png');
  console.log('Saved debug_satellite_bothflip.png (grid AND tile Y-flipped)');
}

main().catch(console.error);
