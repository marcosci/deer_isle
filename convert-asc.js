/**
 * Converts the Deer Isle ASC heightmap to a downsampled binary file
 * that the browser can load efficiently.
 * 
 * Output: public/terrain.bin (Float32 array) + public/terrain-meta.json
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INPUT = path.resolve(process.env.USERPROFILE, 'Desktop', 'deer_isle_dem.asc');
const OUTPUT_DIR = path.join(__dirname, 'public');
const RESOLUTIONS = [1024, 2048, 4096]; // Multiple LODs

async function convert() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT),
    crlfDelay: Infinity,
  });

  let ncols, nrows, xllcorner, yllcorner, cellsize, nodata;
  let headerLines = 0;
  const rows = [];
  let currentRow = [];

  console.log('Reading ASC file...');

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Parse header
    if (trimmed.startsWith('ncols')) { ncols = parseInt(trimmed.split(/\s+/)[1]); headerLines++; continue; }
    if (trimmed.startsWith('nrows')) { nrows = parseInt(trimmed.split(/\s+/)[1]); headerLines++; continue; }
    if (trimmed.startsWith('xllcorner')) { xllcorner = parseFloat(trimmed.split(/\s+/)[1]); headerLines++; continue; }
    if (trimmed.startsWith('yllcorner')) { yllcorner = parseFloat(trimmed.split(/\s+/)[1]); headerLines++; continue; }
    if (trimmed.startsWith('cellsize')) { cellsize = parseFloat(trimmed.split(/\s+/)[1]); headerLines++; continue; }
    if (trimmed.startsWith('NODATA')) { nodata = parseFloat(trimmed.split(/\s+/)[1]); headerLines++; continue; }

    // Data line
    const vals = trimmed.split(/\s+/).map(Number);
    currentRow.push(...vals);

    // When we have a full row
    while (currentRow.length >= ncols) {
      rows.push(currentRow.splice(0, ncols));
      if (rows.length % 500 === 0) {
        console.log(`  Read ${rows.length}/${nrows} rows...`);
      }
    }
  }

  console.log(`Grid: ${ncols}x${nrows}, cellsize: ${cellsize}m, nodata: ${nodata}`);
  console.log(`Total rows read: ${rows.length}`);

  let globalMin = Infinity, globalMax = -Infinity;

  // Generate each resolution
  for (const size of RESOLUTIONS) {
    console.log(`\nGenerating ${size}x${size}...`);
    const step = ncols / size;
    const output = new Float32Array(size * size);

    let minElev = Infinity, maxElev = -Infinity;

    for (let ty = 0; ty < size; ty++) {
      for (let tx = 0; tx < size; tx++) {
        let sum = 0, count = 0;
        const sy = Math.floor(ty * step);
        const sx = Math.floor(tx * step);
        const ey = Math.min(Math.floor((ty + 1) * step), nrows);
        const ex = Math.min(Math.floor((tx + 1) * step), ncols);

        for (let y = sy; y < ey; y++) {
          for (let x = sx; x < ex; x++) {
            const v = rows[y][x];
            if (v !== nodata) {
              sum += v;
              count++;
            }
          }
        }

        const val = count > 0 ? sum / count : 0;
        output[ty * size + tx] = val;
        if (val < minElev) minElev = val;
        if (val > maxElev) maxElev = val;
      }
    }

    if (minElev < globalMin) globalMin = minElev;
    if (maxElev > globalMax) globalMax = maxElev;

    const binPath = path.join(OUTPUT_DIR, `terrain-${size}.bin`);
    fs.writeFileSync(binPath, Buffer.from(output.buffer));
    console.log(`  Written: ${binPath} (${(output.byteLength / 1024).toFixed(0)} KB)`);
    console.log(`  Elevation range: ${minElev.toFixed(2)} to ${maxElev.toFixed(2)}`);
  }

  // Write metadata (shared across all resolutions)
  const meta = {
    resolutions: RESOLUTIONS,
    originalWidth: ncols,
    originalHeight: nrows,
    cellSize: cellsize,
    worldSize: ncols * cellsize,
    minElevation: globalMin,
    maxElevation: globalMax,
    nodata,
    xllcorner,
    yllcorner,
  };
  const metaPath = path.join(OUTPUT_DIR, 'terrain-meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  console.log(`\nWritten: ${metaPath}`);
  console.log('Done!');
}

convert().catch(console.error);
