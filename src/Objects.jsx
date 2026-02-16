import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ── Category visual config ──────────────────────────────────────
// Each category gets a shape (via geometry) and a color for instanced rendering.
const CATEGORY_CONFIG = {
  tree:           { color: '#1a5c1a', shape: 'cone',     scaleY: 3.0, scaleXZ: 0.8, label: '🌲 Trees' },
  bush:           { color: '#3a7a2a', shape: 'sphere',   scaleY: 0.6, scaleXZ: 0.8, label: '🌿 Bushes' },
  building:       { color: '#8a6a4a', shape: 'box',      scaleY: 2.5, scaleXZ: 2.0, label: '🏠 Buildings' },
  rock:           { color: '#7a7a7a', shape: 'dodeca',   scaleY: 1.0, scaleXZ: 1.2, label: '🪨 Rocks' },
  wall:           { color: '#9a8a6a', shape: 'box',      scaleY: 1.5, scaleXZ: 0.3, label: '🧱 Walls' },
  vehicle:        { color: '#cc4444', shape: 'box',      scaleY: 0.8, scaleXZ: 1.0, label: '🚗 Vehicles' },
  infrastructure: { color: '#6a6a8a', shape: 'cylinder', scaleY: 3.0, scaleXZ: 0.15, label: '🏗️ Infrastructure' },
  road:           { color: '#5a5a5a', shape: 'box',      scaleY: 0.1, scaleXZ: 2.0, label: '🛤️ Roads' },
  other:          { color: '#aa8855', shape: 'box',      scaleY: 1.0, scaleXZ: 0.5, label: '📦 Other' },
};

const WORLD_HALF = 8192;

// ── Geometry cache ──────────────────────────────────────────────
const geoCache = {};
function getGeometry(shape) {
  if (geoCache[shape]) return geoCache[shape];
  let geo;
  switch (shape) {
    case 'cone':     geo = new THREE.ConeGeometry(0.5, 1, 6); break;
    case 'sphere':   geo = new THREE.SphereGeometry(0.5, 6, 4); break;
    case 'box':      geo = new THREE.BoxGeometry(1, 1, 1); break;
    case 'dodeca':   geo = new THREE.DodecahedronGeometry(0.5, 0); break;
    case 'cylinder': geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6); break;
    default:         geo = new THREE.BoxGeometry(1, 1, 1);
  }
  geoCache[shape] = geo;
  return geo;
}

// ── Load category binary data ───────────────────────────────────
function useCategoryData(category, enabled) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    if (!enabled) { setData(null); return; }
    
    let cancelled = false;
    const config = CATEGORY_CONFIG[category];
    if (!config) return;
    
    fetch(`/objects-${category}.bin`)
      .then(r => r.arrayBuffer())
      .then(buf => {
        if (!cancelled) {
          setData(new Float32Array(buf)); // [x, y, z, yaw, x, y, z, yaw, ...]
        }
      })
      .catch(err => console.warn(`Failed to load objects-${category}.bin:`, err));
    
    return () => { cancelled = true; };
  }, [category, enabled]);
  
  return data;
}

function createTreeSpriteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Clear background
  ctx.clearRect(0, 0, 128, 128);

  // Trunk
  ctx.fillStyle = '#4f3722';
  ctx.fillRect(58, 86, 12, 30);

  // Canopy layers
  function tri(x, y, w, h, color) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - w / 2, y + h);
    ctx.lineTo(x + w / 2, y + h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  tri(64, 22, 66, 46, '#2a6f34');
  tri(64, 36, 78, 50, '#2f7b39');
  tri(64, 50, 88, 50, '#2a6f34');

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function useTreeSpatialIndex(data, worldScale, stride) {
  return useMemo(() => {
    if (!data) return null;

    const n = Math.floor(data.length / stride);
    const cellWorld = 256;
    const cellScene = cellWorld / worldScale;
    const grid = new Map();

    for (let i = 0; i < n; i++) {
      const idx = i * stride;
      const wx = data[idx];
      const wz = data[idx + 2];
      const sx = (wx - WORLD_HALF) / worldScale;
      const sz = -(wz - WORLD_HALF) / worldScale;
      const cx = Math.floor(sx / cellScene);
      const cz = Math.floor(sz / cellScene);
      const key = `${cx},${cz}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }

    return {
      count: n,
      grid,
      cellScene,
    };
  }, [data, worldScale, stride]);
}

function normalizeGeometryToHeight(geo, targetHeight) {
  const g = geo.clone();
  g.computeBoundingBox();
  const box = g.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  // Center X/Z and put base at Y=0
  g.translate(-center.x, -box.min.y, -center.z);

  const h = size.y || 1;
  const s = targetHeight / h;
  g.scale(s, s, s);
  g.computeVertexNormals();
  return g;
}

function extractPrimaryTreeMesh(gltfScene) {
  const meshes = [];
  gltfScene.updateMatrixWorld(true);
  gltfScene.traverse((obj) => {
    if (obj.isMesh && obj.geometry) meshes.push(obj);
  });

  if (meshes.length === 0) return null;

  // Collect all primitives (this GLB has 1 mesh with 2 primitives: Wood + Green)
  const trunkGeos = [];
  const crownGeos = [];

  for (const m of meshes) {
    // Multi-material mesh: each group maps to a material index
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const groups = m.geometry.groups;

    if (groups && groups.length > 0 && mats.length > 1) {
      for (const group of groups) {
        const mat = mats[group.materialIndex] || mats[0];
        const subGeo = m.geometry.clone();
        subGeo.applyMatrix4(m.matrixWorld);
        // Keep only positions + normals for this group
        const posOnly = new THREE.BufferGeometry();
        posOnly.setAttribute('position', subGeo.getAttribute('position'));
        if (subGeo.getAttribute('normal')) posOnly.setAttribute('normal', subGeo.getAttribute('normal'));
        if (subGeo.index) posOnly.setIndex(subGeo.index);
        posOnly.addGroup(0, group.count, 0);
        // Sort by material name — "Wood" = trunk, everything else = crown
        const name = (mat.name || '').toLowerCase();
        if (name.includes('wood') || name.includes('bark') || name.includes('trunk')) {
          trunkGeos.push(posOnly);
        } else {
          crownGeos.push(posOnly);
        }
      }
    } else {
      // Single-material mesh: guess by material color or name
      const mat = mats[0];
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      const posOnly = new THREE.BufferGeometry();
      posOnly.setAttribute('position', g.getAttribute('position'));
      if (g.getAttribute('normal')) posOnly.setAttribute('normal', g.getAttribute('normal'));
      if (g.index) posOnly.setIndex(g.index);

      const name = (mat.name || '').toLowerCase();
      const col = mat.color;
      const isTrunk = name.includes('wood') || name.includes('bark') || name.includes('trunk')
        || (col && col.r > col.g && col.g < 0.15);
      if (isTrunk) {
        trunkGeos.push(posOnly);
      } else {
        crownGeos.push(posOnly);
      }
    }
  }

  const mergeSafe = (geos) => {
    if (geos.length === 0) return null;
    if (geos.length === 1) { geos[0].computeVertexNormals(); return geos[0]; }
    const m = mergeGeometries(geos, false);
    if (m) m.computeVertexNormals();
    return m;
  };

  return {
    trunkGeo: mergeSafe(trunkGeos),
    crownGeo: mergeSafe(crownGeos),
    // Fallback: merged all if separation failed
    fullGeo: mergeSafe([...trunkGeos, ...crownGeos]),
  };
}

function makeTreeModelGeometry({ mid = false, leaves = false }) {
  if (leaves) {
    const top = new THREE.IcosahedronGeometry(mid ? 0.42 : 0.52, 0);
    top.translate(0, mid ? 1.45 : 1.8, 0);

    const midA = new THREE.IcosahedronGeometry(mid ? 0.34 : 0.44, 0);
    midA.translate(-0.14, mid ? 1.2 : 1.45, 0.08);

    const midB = new THREE.IcosahedronGeometry(mid ? 0.32 : 0.4, 0);
    midB.translate(0.16, mid ? 1.16 : 1.4, -0.1);

    const low = new THREE.ConeGeometry(mid ? 0.42 : 0.55, mid ? 0.75 : 0.95, 8);
    low.translate(0, mid ? 0.9 : 1.1, 0);

    return mergeGeometries([top, midA, midB, low], false);
  }

  const trunk = new THREE.CylinderGeometry(mid ? 0.075 : 0.09, mid ? 0.1 : 0.12, mid ? 1.0 : 1.2, 8);
  trunk.translate(0, mid ? 0.5 : 0.6, 0);

  const b1 = new THREE.CylinderGeometry(0.03, 0.05, mid ? 0.5 : 0.65, 6);
  b1.rotateZ(Math.PI * 0.28);
  b1.translate(mid ? 0.2 : 0.25, mid ? 0.88 : 1.06, 0);

  const b2 = new THREE.CylinderGeometry(0.028, 0.045, mid ? 0.45 : 0.58, 6);
  b2.rotateZ(-Math.PI * 0.33);
  b2.translate(mid ? -0.18 : -0.22, mid ? 0.84 : 1.0, 0.05);

  const b3 = new THREE.CylinderGeometry(0.022, 0.035, mid ? 0.36 : 0.48, 6);
  b3.rotateX(Math.PI * 0.28);
  b3.translate(0, mid ? 0.95 : 1.14, mid ? -0.18 : -0.22);

  return mergeGeometries([trunk, b1, b2, b3], false);
}

function TreeLayer({ verticalScale, worldScale, treeStride = 4 }) {
  const data = useCategoryData('tree', true);
  const { camera } = useThree();
  const treeGltf = useLoader(GLTFLoader, '/quaternius_cc0-common-tree-835.glb');
  const trunkRef = useRef();
  const crownRef = useRef();
  const index = useTreeSpatialIndex(data, worldScale, treeStride);

  const treeSource = useMemo(() => {
    if (!treeGltf?.scene) return null;
    return extractPrimaryTreeMesh(treeGltf.scene);
  }, [treeGltf]);

  // Separate trunk / crown geometries, normalized to same height
  const { trunkGeo, crownGeo } = useMemo(() => {
    if (!treeSource) {
      const fallback = makeTreeModelGeometry({ mid: false, leaves: true });
      return { trunkGeo: fallback, crownGeo: fallback };
    }
    // Normalize both parts together using the full bounding box
    const fullGeo = treeSource.fullGeo;
    if (!fullGeo) {
      const fallback = makeTreeModelGeometry({ mid: false, leaves: true });
      return { trunkGeo: fallback, crownGeo: fallback };
    }

    fullGeo.computeBoundingBox();
    const box = fullGeo.boundingBox;
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const targetH = 0.55;
    const h = size.y || 1;
    const s = targetH / h;
    const tx = -center.x;
    const ty = -box.min.y;
    const tz = -center.z;

    const normGeo = (g) => {
      if (!g) return null;
      const c = g.clone();
      c.translate(tx, ty, tz);
      c.scale(s, s, s);
      c.computeVertexNormals();
      return c;
    };

    return {
      trunkGeo: normGeo(treeSource.trunkGeo) || makeTreeModelGeometry({ mid: false, leaves: false }),
      crownGeo: normGeo(treeSource.crownGeo) || makeTreeModelGeometry({ mid: false, leaves: true }),
    };
  }, [treeSource]);

  const trunkMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({ color: '#b8b8b8', roughness: 0.92, metalness: 0.0 });
  }, []);

  const crownMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({ color: '#2a7d30', roughness: 0.88, metalness: 0.0 });
  }, []);

  const count = useMemo(() => {
    if (!data) return 0;
    return Math.floor(data.length / treeStride);
  }, [data, treeStride]);

  // ── All trees as point sprites with distance fade ──
  const farSprite = useMemo(() => createTreeSpriteTexture(), []);

  const farPointsMat = useMemo(() => {
    // Custom shader that fades out points when close to camera (where 3D takes over)
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: farSprite },
        uSize: { value: 0.85 },
        uFadeStart: { value: 35.0 },  // start fading at this distance
        uFadeEnd: { value: 50.0 },    // fully visible beyond this distance
        uColor: { value: new THREE.Color('#8fcf86') },
      },
      vertexShader: `
        uniform float uSize;
        uniform float uFadeStart;
        uniform float uFadeEnd;
        varying float vAlpha;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          float dist = -mvPos.z;
          // Fade: 0 when close (< uFadeStart), 1 when far (> uFadeEnd)
          vAlpha = clamp((dist - uFadeStart) / (uFadeEnd - uFadeStart), 0.0, 1.0);
          gl_PointSize = uSize * (300.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          if (vAlpha < 0.01) discard;
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a < 0.35) discard;
          gl_FragColor = vec4(uColor * tex.rgb, tex.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
  }, [farSprite]);

  const farPointsGeo = useMemo(() => {
    if (!data || count === 0) return null;

    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const idx = i * treeStride;
      positions[i * 3]     = (data[idx]     - WORLD_HALF) / worldScale;
      positions[i * 3 + 1] = (data[idx + 1] * verticalScale) / worldScale + 0.25;
      positions[i * 3 + 2] = -(data[idx + 2] - WORLD_HALF) / worldScale;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [data, count, verticalScale, worldScale, treeStride]);

  // ── Nearby 3D instanced trees (LOD upgrade) ──
  const MAX_3D = 120000;
  const [nearIds, setNearIds] = useState([]);
  const lastCamRef = useRef(new THREE.Vector3(99999, 99999, 99999));
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    if (!data || !index) return;

    elapsedRef.current += delta;
    const cam = camera.position;
    const moved = cam.distanceTo(lastCamRef.current) > 2.0;
    if (!moved && elapsedRef.current < 0.4) return;

    elapsedRef.current = 0;
    lastCamRef.current.copy(cam);

    const nearR = 50;
    const nearR2 = nearR * nearR;
    const csz = index.cellScene;
    const ccx = Math.floor(cam.x / csz);
    const ccz = Math.floor(cam.z / csz);
    const cr = Math.ceil(nearR / csz);

    const ids = [];

    for (let dz = -cr; dz <= cr; dz++) {
      for (let dx = -cr; dx <= cr; dx++) {
        const key = `${ccx + dx},${ccz + dz}`;
        const bucket = index.grid.get(key);
        if (!bucket) continue;

        for (let bi = 0; bi < bucket.length; bi++) {
          const i = bucket[bi];
          const idx4 = i * treeStride;
          const x = (data[idx4] - WORLD_HALF) / worldScale;
          const z = -(data[idx4 + 2] - WORLD_HALF) / worldScale;
          const d2 = (x - cam.x) * (x - cam.x) + (z - cam.z) * (z - cam.z);
          if (d2 <= nearR2) {
            ids.push(i);
            if (ids.length >= MAX_3D) break;
          }
        }
        if (ids.length >= MAX_3D) break;
      }
      if (ids.length >= MAX_3D) break;
    }

    setNearIds(ids);
  });

  // Write instance matrices for both trunk and crown (same transforms)
  useEffect(() => {
    if (!data || nearIds.length === 0) return;
    if (!trunkRef.current || !crownRef.current) return;

    const trunkMesh = trunkRef.current;
    const crownMesh = crownRef.current;
    const tArr = trunkMesh.instanceMatrix.array;
    const cArr = crownMesh.instanceMatrix.array;
    const deg2rad = Math.PI / 180;
    const limit = Math.min(nearIds.length, MAX_3D);

    for (let j = 0; j < limit; j++) {
      const i = nearIds[j];
      const idx = i * treeStride;
      const wx = data[idx];
      const wy = data[idx + 1];
      const wz = data[idx + 2];
      const yawRad = data[idx + 3] * deg2rad;

      const x = (wx - WORLD_HALF) / worldScale;
      const y = (wy * verticalScale) / worldScale;
      const z = -(wz - WORLD_HALF) / worldScale;

      const noise = ((i * 9301 + 49297) % 233280) / 233280;
      const sy = 0.8 + noise * 0.5;
      const sxz = 0.85 + noise * 0.3;

      const cosY = Math.cos(yawRad);
      const sinY = Math.sin(yawRad);

      const o = j * 16;
      // Same matrix written to both trunk and crown
      tArr[o + 0] = cArr[o + 0] = sxz * cosY;
      tArr[o + 1] = cArr[o + 1] = 0;
      tArr[o + 2] = cArr[o + 2] = -sxz * sinY;
      tArr[o + 3] = cArr[o + 3] = 0;
      tArr[o + 4] = cArr[o + 4] = 0;
      tArr[o + 5] = cArr[o + 5] = sy;
      tArr[o + 6] = cArr[o + 6] = 0;
      tArr[o + 7] = cArr[o + 7] = 0;
      tArr[o + 8] = cArr[o + 8] = sxz * sinY;
      tArr[o + 9] = cArr[o + 9] = 0;
      tArr[o + 10] = cArr[o + 10] = sxz * cosY;
      tArr[o + 11] = cArr[o + 11] = 0;
      tArr[o + 12] = cArr[o + 12] = x;
      tArr[o + 13] = cArr[o + 13] = y;
      tArr[o + 14] = cArr[o + 14] = z;
      tArr[o + 15] = cArr[o + 15] = 1;
    }

    trunkMesh.count = limit;
    crownMesh.count = limit;
    trunkMesh.instanceMatrix.needsUpdate = true;
    crownMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.computeBoundingSphere();
    crownMesh.computeBoundingSphere();
  }, [data, nearIds, verticalScale, worldScale, treeStride]);

  if (!data || count === 0) return null;

  return (
    <group>
      {/* All trees as point sprites — fade out near camera where 3D takes over */}
      {farPointsGeo && <points geometry={farPointsGeo} material={farPointsMat} frustumCulled={false} />}

      {/* Nearby trunk (light grey) */}
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeo, trunkMat, MAX_3D]}
        frustumCulled={false}
        castShadow
      />
      {/* Nearby crown (green) */}
      <instancedMesh
        ref={crownRef}
        args={[crownGeo, crownMat, MAX_3D]}
        frustumCulled={false}
        castShadow
      />
    </group>
  );
}

// ── Single category instanced mesh ──────────────────────────────
function CategoryLayer({ category, verticalScale, worldScale }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
  const data = useCategoryData(category, true);
  const meshRef = useRef();
  
  const { geometry, material, count } = useMemo(() => {
    if (!data) return { geometry: null, material: null, count: 0 };
    
    const n = data.length / 4; // each object = 4 floats
    const geo = getGeometry(config.shape);
    const mat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true,
    });
    
    return { geometry: geo, material: mat, count: n };
  }, [data, config.shape, config.color]);
  
  // Set instance matrices
  useEffect(() => {
    if (!meshRef.current || !data || count === 0) return;
    
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();
    const sx = config.scaleXZ;
    const sy = config.scaleY;
    
    for (let i = 0; i < count; i++) {
      const idx = i * 4;
      const wx = data[idx];     // world X
      const wy = data[idx + 1]; // world Y (elevation)
      const wz = data[idx + 2]; // world Z
      const yawDeg = data[idx + 3];
      
      // Convert world coords to Three.js scene coords
      // In our scene: X range = [-worldSize/2, worldSize/2] (÷32 scale)
      // WRP coords: X = 0..16384, Z = 0..16384
      // Our terrain is centered at origin with size worldSize/32
      const sceneX = (wx - 8192) / worldScale;
      const sceneY = (wy * verticalScale) / worldScale;
      const sceneZ = -(wz - 8192) / worldScale; // Z is flipped
      
      dummy.position.set(sceneX, sceneY, sceneZ);
      dummy.rotation.set(0, (yawDeg * Math.PI) / 180, 0);
      dummy.scale.set(sx, sy, sx);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [data, count, verticalScale, worldScale, config.scaleXZ, config.scaleY]);
  
  if (!geometry || count === 0) return null;
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  );
}

// ── Main Objects component ──────────────────────────────────────
export default function Objects({ visibleCategories, verticalScale, objectsMeta }) {
  // worldScale = 32 (terrain is divided by this factor)
  const worldScale = 32;
  const treeStride = objectsMeta?.categories?.tree?.stride || 4;
  
  return (
    <group>
      {visibleCategories.tree && (
        <TreeLayer verticalScale={verticalScale} worldScale={worldScale} treeStride={treeStride} />
      )}

      {Object.entries(visibleCategories).map(([cat, visible]) => (
        visible && cat !== 'tree' && CATEGORY_CONFIG[cat] ? (
          <CategoryLayer
            key={cat}
            category={cat}
            verticalScale={verticalScale}
            worldScale={worldScale}
          />
        ) : null
      ))}
    </group>
  );
}

// Export config for HUD
export { CATEGORY_CONFIG };
