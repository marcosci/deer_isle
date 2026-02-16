// Build a full-resolution PNG crop of tiles 19-23 × 19-23 (5×5 region, 2560×2560)
// This lets us verify the stitching is correct at native resolution
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const dir = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');
  
  const BLK = 5;
  const startCol = 19, startRow = 19;
  const SIZE = BLK * 512;
  
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  
  for (let dr = 0; dr < BLK; dr++) {
    for (let dc = 0; dc < BLK; dc++) {
      const col = startCol + dc;
      const row = startRow + dr;
      const f = `${dir}\\s_${String(col).padStart(3, '0')}_${String(row).padStart(3, '0')}_lco.paa`;
      
      const raw = fs.readFileSync(f);
      const p = new Paa();
      p.read(raw);
      const argb = p.getArgb32PixelData(raw, 0);
      
      for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
          const si = (y * 512 + x) * 4;
          const di = ((dr * 512 + y) * SIZE + dc * 512 + x) * 3;
          buf[di + 0] = argb[si + 2]; // R
          buf[di + 1] = argb[si + 1]; // G
          buf[di + 2] = argb[si + 0]; // B
        }
      }
    }
  }
  
  // Save full res
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .png()
    .toFile('debug_5x5_fullres.png');
  console.log(`Saved debug_5x5_fullres.png (${SIZE}x${SIZE})`);
  
  // Also draw red lines at tile boundaries for visual clarity
  const lined = Buffer.from(buf);
  for (let i = 1; i < BLK; i++) {
    const pos = i * 512;
    // Vertical line
    for (let y = 0; y < SIZE; y++) {
      const di = (y * SIZE + pos) * 3;
      lined[di] = 255; lined[di+1] = 0; lined[di+2] = 0;
      if (pos > 0) {
        const di2 = (y * SIZE + pos - 1) * 3;
        lined[di2] = 255; lined[di2+1] = 0; lined[di2+2] = 0;
      }
    }
    // Horizontal line
    for (let x = 0; x < SIZE; x++) {
      const di = (pos * SIZE + x) * 3;
      lined[di] = 255; lined[di+1] = 0; lined[di+2] = 0;
      if (pos > 0) {
        const di2 = ((pos-1) * SIZE + x) * 3;
        lined[di2] = 255; lined[di2+1] = 0; lined[di2+2] = 0;
      }
    }
  }
  
  await sharp(lined, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .png()
    .toFile('debug_5x5_gridlines.png');
  console.log('Saved debug_5x5_gridlines.png (with red tile boundaries)');
  
  console.log('\nPlease open these files and check if:');
  console.log('1. Features continue smoothly across the red grid lines');
  console.log('2. There is no obvious misalignment or doubling at boundaries');
}

main().catch(console.error);
