/**
 * convert-paa.js — Convert .paa texture files to .png
 *
 * Usage:
 *   node convert-paa.js <input.paa> [output.png]
 *   node convert-paa.js <folder-of-paa-files> [output-folder]
 *
 * Optionally stitch a grid of satellite tiles into one image:
 *   node convert-paa.js --stitch <folder> <output.jpg> [--cols 4] [--quality 90]
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function convertPaa(inputPath, outputPath) {
  // Dynamic import for the ESM-only package
  const { Paa } = await import('@bis-toolkit/paa');

  const buffer = fs.readFileSync(inputPath);
  const paa = new Paa();
  paa.read(buffer);

  // Mip 0 = highest resolution
  const mip = paa.mipmaps[0];
  const width = mip.width;
  const height = mip.height;

  console.log(`  ${path.basename(inputPath)}: ${width}x${height}, type=${paa.type}, mipmaps=${paa.mipmaps.length}`);

  // getArgb32PixelData returns ARGB (4 bytes per pixel)
  const argbData = paa.getArgb32PixelData(buffer, 0);

  // Convert ARGB → RGBA for sharp
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const a = argbData[i * 4 + 0];
    const r = argbData[i * 4 + 1];
    const g = argbData[i * 4 + 2];
    const b = argbData[i * 4 + 3];
    rgba[i * 4 + 0] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = a;
  }

  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outputPath);

  console.log(`  → ${outputPath}`);
  return { width, height, outputPath };
}

async function stitchTiles(folder, outputFile, cols, quality) {
  const pngFiles = fs.readdirSync(folder)
    .filter(f => f.endsWith('.png'))
    .sort();

  if (pngFiles.length === 0) {
    console.error('No PNG files found in', folder);
    process.exit(1);
  }

  // Determine grid dimensions
  const total = pngFiles.length;
  const gridCols = cols || Math.ceil(Math.sqrt(total));
  const gridRows = Math.ceil(total / gridCols);

  // Read first tile to get tile size
  const firstMeta = await sharp(path.join(folder, pngFiles[0])).metadata();
  const tw = firstMeta.width;
  const th = firstMeta.height;
  const fullW = gridCols * tw;
  const fullH = gridRows * th;

  console.log(`\nStitching ${total} tiles (${gridCols}x${gridRows}) at ${tw}x${th} each → ${fullW}x${fullH}`);

  // Build composite operations
  const composites = pngFiles.map((f, i) => ({
    input: path.join(folder, f),
    left: (i % gridCols) * tw,
    top: Math.floor(i / gridCols) * th,
  }));

  const ext = path.extname(outputFile).toLowerCase();

  let pipeline = sharp({
    create: {
      width: fullW,
      height: fullH,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  }).composite(composites);

  if (ext === '.jpg' || ext === '.jpeg') {
    await pipeline.jpeg({ quality: quality || 90 }).toFile(outputFile);
  } else {
    await pipeline.png().toFile(outputFile);
  }

  console.log(`→ ${outputFile} (${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(1)} MB)`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  node convert-paa.js <file.paa> [output.png]
  node convert-paa.js <folder-with-paa-files> [output-folder]
  node convert-paa.js --stitch <png-folder> <output.jpg> [--cols N] [--quality Q]
`);
    process.exit(0);
  }

  // Stitch mode
  if (args[0] === '--stitch') {
    const folder = args[1];
    const output = args[2] || 'satellite.jpg';
    let cols = 0;
    let quality = 90;
    for (let i = 3; i < args.length; i++) {
      if (args[i] === '--cols' && args[i + 1]) cols = parseInt(args[++i]);
      if (args[i] === '--quality' && args[i + 1]) quality = parseInt(args[++i]);
    }
    await stitchTiles(folder, output, cols, quality);
    return;
  }

  const input = args[0];
  const stat = fs.statSync(input);

  if (stat.isFile()) {
    // Single file conversion
    const output = args[1] || input.replace(/\.paa$/i, '.png');
    await convertPaa(input, output);
  } else if (stat.isDirectory()) {
    // Batch folder conversion
    const outDir = args[1] || path.join(input, 'png');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const files = fs.readdirSync(input).filter(f => f.endsWith('.paa'));
    console.log(`Found ${files.length} .paa files in ${input}\n`);

    for (const f of files) {
      const outFile = path.join(outDir, f.replace(/\.paa$/i, '.png'));
      try {
        await convertPaa(path.join(input, f), outFile);
      } catch (err) {
        console.error(`  ✗ ${f}: ${err.message}`);
      }
    }

    console.log(`\nDone. PNGs saved to ${outDir}`);
    console.log(`\nTo stitch into a satellite image, run:`);
    console.log(`  node convert-paa.js --stitch "${outDir}" public/satellite.jpg`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
