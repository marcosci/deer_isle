#!/usr/bin/env node
/**
 * parse-wrp.js — Deer Isle WRP (OPRW v28) parser
 *
 * Extracts every placed object from the WRP file, classifies them into
 * categories, and writes compact binary files + a small JSON manifest
 * for the 3D terrain viewer.
 *
 * Output:
 *   public/objects-meta.json      — category list, counts, metadata
 *   public/objects-<cat>.bin      — Float32Array [x, y, z, yaw, ...] per category
 *                                  tree category uses [x, y, z, yaw, speciesId]
 *
 * OPRW format based on: gruppe-adler/grad_aff (wrp.cpp / wrp.h)
 * Each Object record is 60 bytes:
 *   uint32 objectId, uint32 modelIndex,
 *   float32[12] transformMatrix (4 × XYZ),
 *   uint32 static0x02
 */

const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────
const WRP_PATH = process.argv[2] || 'C:\\Users\\marco\\Downloads\\deerisle\\world\\deerisle.wrp';
const OUT_DIR = path.join(__dirname, 'public');
const OBJECT_SIZE = 60; // bytes per object entry

// ── Binary reader ───────────────────────────────────────────────
class BinaryReader {
  constructor(buffer) { this.buf = buffer; this.pos = 0; }
  tell()    { return this.pos; }
  seek(p)   { this.pos = p; }
  skip(n)   { this.pos += n; }

  u8()  { return this.buf[this.pos++]; }
  u32() { const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
  f32() { const v = this.buf.readFloatLE(this.pos);  this.pos += 4; return v; }
  xyz() { return [this.f32(), this.f32(), this.f32()]; }

  asciiz() {
    const start = this.pos;
    while (this.pos < this.buf.length && this.buf[this.pos] !== 0) this.pos++;
    const s = this.buf.toString('ascii', start, this.pos);
    this.pos++;
    return s;
  }

  str(n) {
    const s = this.buf.toString('ascii', this.pos, this.pos + n);
    this.pos += n;
    return s;
  }
}

// ── Category classification ─────────────────────────────────────
// Order matters — first match wins. We exclude "clutter" from output.
const CATEGORY_RULES = [
  { cat: 'tree',     patterns: [/plants.*tree/i, /plants.*\\bt_/i, /\\btree/i, /picea/i, /spruce/i, /pinus/i, /birch/i, /betula/i, /oak/i, /quercus/i, /beech/i, /fagus/i, /alder/i, /alnus/i, /willow/i, /poplar/i, /linden/i, /tilia/i, /maple/i, /ash_tree/i, /cherry_t/i, /fir/i, /cedar/i, /larch/i, /larix/i, /abies/i, /sorbus/i, /fraxinus/i] },
  { cat: 'bush',     patterns: [/plants.*bush/i, /plants.*\\bb_/i, /\\bbush/i, /shrub/i, /bramble/i, /rhamnus/i, /hazel/i, /juniper/i, /cornus/i, /prunus/i, /sambucus/i, /buxus/i, /caragana/i, /corylus/i, /rosa[^_]/i] },
  { cat: 'clutter',  patterns: [/clutter/i, /\\bc_/i, /\\bl_/i, /\\bp_/i, /grass/i, /weed/i, /flower/i, /ivy/i, /fern/i, /moss/i, /mushroom/i, /nettle/i, /lichen/i, /stubble/i, /stump/i, /fallen/i, /debris/i, /leaf/i, /dead_/i, /hay/i, /helianthus/i, /streambed/i, /pond/i, /waterclear/i, /waterseagreen/i] },
  { cat: 'rock',     patterns: [/rock/i, /\\bstone/i, /boulder/i, /cliff/i, /bluff/i, /\\brocks\\/i] },
  { cat: 'building', patterns: [/structures/i, /house/i, /barn/i, /church/i, /castle/i, /tower/i, /hospital/i, /school/i, /shop/i, /store/i, /garage/i, /hangar/i, /factory/i, /warehouse/i, /shed/i, /cottage/i, /cabin/i, /hut/i, /building/i, /office/i, /hotel/i, /pub_/i, /station/i, /barrack/i, /bunker/i, /prison/i, /police/i, /lighthouse/i, /chapel/i, /power_?plant/i, /land_/i, /floor/i, /ruin/i, /fort/i, /dungeon/i, /skeleton/i, /tomb/i, /cemetery/i, /altar/i, /mine_/i, /pier/i, /dock/i, /jail/i, /cave/i] },
  { cat: 'wall',     patterns: [/wall/i, /fence/i, /gate(?!way)/i, /hedgehog/i, /barrier/i, /railing/i] },
  { cat: 'vehicle',  patterns: [/wreck/i, /vehicle/i, /\\bcar_/i, /truck/i, /boat(?!_r)/i, /ship/i, /heli(?!anthus)/i, /\\bplane(?!t)/i, /xplane/i, /uaz/i, /lada/i, /datsun/i, /ural/i, /v3s/i, /bmp/i, /t72/i, /\\bbus_/i, /bilboard/i] },
  { cat: 'road',     patterns: [/road/i, /bridge/i, /runway/i, /helipad/i, /sidewalk/i, /crossing/i] },
  { cat: 'infrastructure', patterns: [/pole/i, /\\bpipe/i, /sign/i, /lamp/i, /light_?post/i, /antenna/i, /transformer/i, /pump/i, /\\btank_/i, /silo/i, /crane/i, /container/i, /pallet/i, /barrel/i, /basement/i] },
];

// Categories to SKIP — too numerous and not useful to render
const SKIP_CATEGORIES = new Set(['clutter']);

const TREE_SPECIES = {
  CONIFER: 0,
  BROADLEAF: 1,
  OTHER: 2,
};

function classifyTreeSpecies(modelPath) {
  const m = path.basename(modelPath).toLowerCase();

  // Coniferous types
  if (/(picea|pinus|abies|larix|fir|spruce|larch|cedar)/i.test(m)) {
    return TREE_SPECIES.CONIFER;
  }

  // Broadleaf deciduous
  if (/(betula|fagus|quercus|alnus|poplar|willow|tilia|maple|fraxinus|prunus|sorbus|cherry|oak|beech|birch)/i.test(m)) {
    return TREE_SPECIES.BROADLEAF;
  }

  return TREE_SPECIES.OTHER;
}

// Pre-classify all model paths for faster lookup
function buildModelCategoryMap(models) {
  const map = new Array(models.length);
  for (let i = 0; i < models.length; i++) {
    const lower = models[i].toLowerCase();
    let found = 'other';
    for (const rule of CATEGORY_RULES) {
      for (const pat of rule.patterns) {
        if (pat.test(lower)) { found = rule.cat; break; }
      }
      if (found !== 'other') break;
    }
    map[i] = found;
  }
  return map;
}

// ── Find model table by scanning for .p3d strings ───────────────
function findModelTable(buf) {
  let firstP3D = -1;
  for (let i = 0; i < buf.length - 4; i++) {
    if (buf[i] === 0x2E && buf[i+1] === 0x70 && buf[i+2] === 0x33 && buf[i+3] === 0x64) {
      firstP3D = i; break;
    }
  }
  if (firstP3D === -1) throw new Error('No .p3d strings found');
  console.log(`  First .p3d at offset ${firstP3D}`);

  let strStart = firstP3D;
  while (strStart > 0 && buf[strStart - 1] !== 0) strStart--;
  
  const nModels = buf.readUInt32LE(strStart - 4);
  console.log(`  nModels = ${nModels} (table starts at ${strStart - 4})`);
  
  if (nModels <= 0 || nModels > 100000) throw new Error('Invalid model count');
  return strStart - 4;
}

// ── Find object table by scanning for 60-byte record patterns ───
function findObjectTable(buf, searchFrom) {
  let bestOff = -1, bestCnt = 0;
  
  for (let base = searchFrom; base < searchFrom + 60; base++) {
    for (let start = base; start < buf.length - 3600; start += 60) {
      if (buf.readUInt32LE(start + 56) !== 0x02) continue;
      let cnt = 0, goodPos = 0;
      for (let p = start; p + 60 <= buf.length; p += 60) {
        if (buf.readUInt32LE(p + 56) !== 0x02) break;
        cnt++;
        const px = buf.readFloatLE(p + 44);
        const pz = buf.readFloatLE(p + 52);
        if (isFinite(px) && px > -2000 && px < 20000 && isFinite(pz) && pz > -2000 && pz < 20000) goodPos++;
      }
      if (cnt > bestCnt && goodPos > cnt * 0.5) {
        bestCnt = cnt; bestOff = start;
        if (cnt > 10000) break;
      }
      start += cnt * 60 - 60;
    }
    if (bestCnt > 10000) break;
  }
  return { offset: bestOff, count: bestCnt };
}

// ── Main parser ─────────────────────────────────────────────────
function parseWRP(filePath) {
  console.log(`\n  Reading ${filePath} ...`);
  const buf = fs.readFileSync(filePath);
  console.log(`  File size: ${(buf.length / 1024 / 1024).toFixed(1)} MB`);

  const r = new BinaryReader(buf);

  // ─ Header ─
  const magic = r.str(4);
  if (magic !== 'OPRW') throw new Error(`Not OPRW (got "${magic}")`);
  const version = r.u32();
  const appId = r.u32();
  console.log(`  OPRW v${version}`);

  // Read dimension fields (v28 has extra field at offset 12)
  const f12 = r.u32(), f16 = r.u32(), f20 = r.u32(), f24 = r.u32(), f28 = r.u32();
  const f32 = r.f32();

  let layerSizeX, layerSizeY;
  if (f12 === 0 && f16 > 0 && f20 > 0 && f32 > 1.0) {
    layerSizeX = f16; layerSizeY = f20;
  } else {
    layerSizeX = f12; layerSizeY = f16;
  }

  const worldSize = layerSizeX * f32 || 16384;
  console.log(`  Grid: ${layerSizeX}×${layerSizeY}, Cell: ${f32}m, World: ${worldSize}m`);

  // ─ Find model table ─
  console.log('\n  ── Locating model path table ──');
  const modelTableOffset = findModelTable(buf);
  r.seek(modelTableOffset);
  const nModels = r.u32();
  const models = new Array(nModels);
  for (let i = 0; i < nModels; i++) models[i] = r.asciiz();
  
  console.log(`  Read ${nModels} models. Samples:`);
  for (let i = 0; i < Math.min(5, nModels); i++) console.log(`    [${i}] ${models[i]}`);

  // Pre-classify all models
  const modelCatMap = buildModelCategoryMap(models);

  // ─ Find object table ─
  console.log('\n  ── Locating object table ──');
  const objTable = findObjectTable(buf, r.tell());
  if (objTable.offset === -1) throw new Error('Object table not found');
  console.log(`  Found ${objTable.count.toLocaleString()} objects at offset ${objTable.offset}`);

  // ─ Read objects, skip clutter ─
  console.log('\n  ── Reading objects ──');
  r.seek(objTable.offset);

  // Collect positions per category: { cat: Float32Array-ready arrays }
  const categoryPositions = {};
  const categoryCounts = {};
  let skippedNoModel = 0, skippedClutter = 0;

  for (let i = 0; i < objTable.count; i++) {
    r.u32(); // objectId — skip
    const modelIndex = r.u32();
    const m0 = r.xyz(); // right vector
    r.xyz();            // up vector
    r.xyz();            // forward vector
    const pos = r.xyz(); // position (row 3)
    r.u32();            // static 0x02

    if (modelIndex === 0 || modelIndex >= nModels) { skippedNoModel++; continue; }

    const cat = modelCatMap[modelIndex];
    if (SKIP_CATEGORIES.has(cat)) { skippedClutter++; continue; }

    if (!categoryPositions[cat]) { categoryPositions[cat] = []; categoryCounts[cat] = 0; }
    categoryPositions[cat].push(pos[0], pos[1], pos[2]);
    // yaw from right vector
    categoryPositions[cat].push(Math.atan2(m0[0], m0[2]) * (180 / Math.PI));
    if (cat === 'tree') {
      categoryPositions[cat].push(classifyTreeSpecies(models[modelIndex]));
    }
    categoryCounts[cat]++;
  }

  console.log(`  Skipped: ${skippedNoModel} (no model), ${skippedClutter} (clutter)`);

  // ─ Summary ─
  const catList = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  let totalKept = 0;
  console.log('\n  ── Category Summary ──');
  for (const [cat, cnt] of catList) {
    const uniqueModels = new Set();
    for (let mi = 0; mi < nModels; mi++) {
      if (modelCatMap[mi] === cat) uniqueModels.add(path.basename(models[mi]));
    }
    console.log(`    ${cat.padEnd(18)} ${cnt.toLocaleString().padStart(10)} objects  (${uniqueModels.size} models)`);
    totalKept += cnt;
  }
  console.log(`    ${'TOTAL'.padEnd(18)} ${totalKept.toLocaleString().padStart(10)} objects\n`);

  // ─ Write output files ─
  const meta = {
    worldSize,
    totalObjects: totalKept,
    categories: {},
  };

  for (const [cat, cnt] of catList) {
    const data = categoryPositions[cat];
    const floatArr = new Float32Array(data);
    const binPath = path.join(OUT_DIR, `objects-${cat}.bin`);
    fs.writeFileSync(binPath, Buffer.from(floatArr.buffer));
    const sizeMB = (floatArr.byteLength / 1024 / 1024).toFixed(2);
    console.log(`  📦 objects-${cat}.bin — ${cnt.toLocaleString()} objects (${sizeMB} MB)`);

    // Collect unique model basenames for the category
    const uniqueModels = new Set();
    for (let mi = 0; mi < nModels; mi++) {
      if (modelCatMap[mi] === cat) uniqueModels.add(path.basename(models[mi]));
    }

    meta.categories[cat] = {
      count: cnt,
      file: `objects-${cat}.bin`,
      stride: cat === 'tree' ? 5 : 4,
      models: [...uniqueModels].slice(0, 30),
    };

    if (cat === 'tree') {
      meta.categories[cat].species = {
        0: 'conifer',
        1: 'broadleaf',
        2: 'other',
      };
    }
  }

  const metaPath = path.join(OUT_DIR, 'objects-meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  console.log(`  📄 objects-meta.json`);
  console.log(`\n  ✅ Done — ${totalKept.toLocaleString()} objects in ${catList.length} categories\n`);
}

// ── Run ─────────────────────────────────────────────────────────
try {
  parseWRP(WRP_PATH);
} catch (err) {
  console.error(`\n  ❌ Error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
}
