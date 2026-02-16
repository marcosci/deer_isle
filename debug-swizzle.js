// Check if PAA decoder has a swizzle or scan-order issue
const fs = require('fs');
const sharp = require('sharp');
const dir = 'C:\\Users\\marco\\Downloads\\deerisle\\data\\layers';

async function main() {
  const { Paa } = await import('@bis-toolkit/paa');
  
  const buf = fs.readFileSync(`${dir}\\s_020_020_lco.paa`);
  const p = new Paa();
  p.read(buf);
  
  console.log('channelSwizzle:', p.channelSwizzle);
  console.log('procedure:', p.procedure);
  console.log('mipmap 0 format:', p.mipmaps[0].format);
  console.log('mipmap 0 isLzss:', p.mipmaps[0].isLzss);
  console.log('mipmap 0 isLzo:', p.mipmaps[0].isLzo);
  
  const argb = p.getArgb32PixelData(buf, 0);
  
  // Check if the image is tiled in 4x4 DXT blocks 
  // DXT1 works in 4x4 blocks. Let's see if pixel pattern repeats within blocks
  console.log('\n=== First 8x8 pixel block (should show natural variation) ===');
  for (let y = 0; y < 8; y++) {
    let row = '';
    for (let x = 0; x < 8; x++) {
      const i = (y * 512 + x) * 4;
      row += `(${argb[i+2]},${argb[i+1]},${argb[i]}) `;
    }
    console.log(`  y=${y}: ${row}`);
  }

  // Check diagonal: does pixel[x][y] == pixel[y][x]? (would indicate transpose)
  console.log('\n=== Transpose check: pixel[x,y] vs pixel[y,x] ===');
  let transposeMatches = 0, total = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = y + 1; x < 64; x++) {
      const i1 = (y * 512 + x) * 4;
      const i2 = (x * 512 + y) * 4;
      if (argb[i1] === argb[i2] && argb[i1+1] === argb[i2+1] && argb[i1+2] === argb[i2+2]) {
        transposeMatches++;
      }
      total++;
    }
  }
  console.log(`  Matches: ${transposeMatches}/${total} (${(transposeMatches/total*100).toFixed(1)}%)`);
  
  // Save the image as-is and also transposed
  const rgb = Buffer.alloc(512 * 512 * 3);
  const rgbT = Buffer.alloc(512 * 512 * 3);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const si = (y * 512 + x) * 4;
      const di = (y * 512 + x) * 3;
      const ti = (x * 512 + y) * 3; // transposed
      rgb[di] = argb[si + 2]; rgb[di+1] = argb[si + 1]; rgb[di+2] = argb[si + 0];
      rgbT[ti] = argb[si + 2]; rgbT[ti+1] = argb[si + 1]; rgbT[ti+2] = argb[si + 0];
    }
  }
  
  await sharp(rgb, { raw: { width: 512, height: 512, channels: 3 } })
    .png().toFile('debug_tile_normal.png');
  await sharp(rgbT, { raw: { width: 512, height: 512, channels: 3 } })
    .png().toFile('debug_tile_transposed.png');
  console.log('\nSaved debug_tile_normal.png and debug_tile_transposed.png');
  
  // Check if rows and cols have different data (i.e. not a symmetric image)
  console.log('\n=== Row vs Column check at y=100,x=100 ===');
  console.log('Row 100, cols 0-7:');
  for (let x = 0; x < 8; x++) {
    const i = (100 * 512 + x) * 4;
    process.stdout.write(`(${argb[i+2]},${argb[i+1]},${argb[i]}) `);
  }
  console.log('\nCol 100, rows 0-7:');
  for (let y = 0; y < 8; y++) {
    const i = (y * 512 + 100) * 4;
    process.stdout.write(`(${argb[i+2]},${argb[i+1]},${argb[i]}) `);
  }
  console.log('');
}

main().catch(console.error);
