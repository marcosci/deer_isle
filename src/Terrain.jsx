import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Dynamically fetch terrain data for a given resolution
function useTerrainBinary(resolution) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [binResp, metaResp] = await Promise.all([
        fetch(`/terrain-${resolution}.bin`),
        fetch('/terrain-meta.json'),
      ]);
      const [buffer, metaJson] = await Promise.all([
        binResp.arrayBuffer(),
        metaResp.json(),
      ]);

      if (!cancelled) {
        setData({
          heights: new Float32Array(buffer),
          meta: { ...metaJson, width: resolution, height: resolution },
        });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [resolution]);

  return data;
}

// ── Convert sun azimuth/elevation to Three.js light position ─────
function sunToLightPosition(azimuthDeg, elevationDeg, distance = 800) {
  const azRad = (azimuthDeg * Math.PI) / 180;
  const elRad = (elevationDeg * Math.PI) / 180;
  // Geographic: 0°=North(−Z), 90°=East(+X), CW
  const x = distance * Math.cos(elRad) * Math.sin(azRad);
  const y = distance * Math.sin(elRad);
  const z = -distance * Math.cos(elRad) * Math.cos(azRad);
  return [x, y, z];
}

// ── Color ramps ──────────────────────────────────────────────────
function getHypsometricColor(elevation, minElev, maxElev) {
  // Use absolute elevation thresholds so the seabed contrasts with water
  // and above-sea-level terrain gets proper natural colors.
  const stops = [
    { e: -42,  r: 0.28, g: 0.22, b: 0.16 }, // deep seabed — dark mud/silt
    { e: -20,  r: 0.38, g: 0.30, b: 0.20 }, // mid seabed — brown sediment
    { e: -5,   r: 0.52, g: 0.42, b: 0.28 }, // shallow seabed — sandy mud
    { e: -1,   r: 0.60, g: 0.52, b: 0.35 }, // tidal zone — wet sand
    { e:  0,   r: 0.76, g: 0.70, b: 0.50 }, // shoreline — dry sand/beach
    { e:  3,   r: 0.68, g: 0.72, b: 0.40 }, // coastal scrub
    { e: 10,   r: 0.40, g: 0.58, b: 0.22 }, // lowland grass
    { e: 40,   r: 0.28, g: 0.50, b: 0.18 }, // meadow
    { e: 100,  r: 0.18, g: 0.42, b: 0.14 }, // forest
    { e: 200,  r: 0.14, g: 0.34, b: 0.12 }, // dense forest
    { e: 350,  r: 0.32, g: 0.32, b: 0.25 }, // treeline / rock
    { e: 500,  r: 0.50, g: 0.48, b: 0.42 }, // exposed rock
    { e: 650,  r: 0.72, g: 0.70, b: 0.68 }, // high alpine
    { e: 710,  r: 0.92, g: 0.92, b: 0.94 }, // snow/peak
  ];

  // Find segment by elevation
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1].e < elevation) i++;
  if (i >= stops.length - 1) i = stops.length - 2;

  const s0 = stops[i];
  const s1 = stops[i + 1];
  const localT = Math.max(0, Math.min(1, (elevation - s0.e) / (s1.e - s0.e)));

  return {
    r: s0.r + (s1.r - s0.r) * localT,
    g: s0.g + (s1.g - s0.g) * localT,
    b: s0.b + (s1.b - s0.b) * localT,
  };
}

function createFoamTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  // Short white streaks to mimic tiny wave crests
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 3 + Math.random() * 10;
    const ang = (Math.random() * 0.9 - 0.45); // mostly horizontal
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;

    const alpha = 0.05 + Math.random() * 0.2;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export default function Terrain({ waterLevel, verticalScale, colorMode, showWater, wireframe, resolution = 1024, sunAzimuth = 315, sunElevation = 35 }) {
  const terrainData = useTerrainBinary(resolution);
  const waterRef = useRef();
  const foamRef = useRef();
  const meshRef = useRef();
  const sunRef = useRef();
  const foamTex = useMemo(() => createFoamTexture(), []);

  // Load satellite texture
  const satelliteTex = useMemo(() => {
    const tex = new THREE.TextureLoader().load('/satellite.jpg');
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const heights = terrainData?.heights ?? null;
  const meta = terrainData?.meta ?? null;

  // Compute sun light position from azimuth/elevation
  const sunPos = useMemo(() => sunToLightPosition(sunAzimuth, sunElevation), [sunAzimuth, sunElevation]);

  const { geometry, waterGeometry } = useMemo(() => {
    if (!heights || !meta) return { geometry: null, waterGeometry: null };

    const w = meta.width;
    const h = meta.height;
    const worldSize = meta.worldSize / 32; // Scale down for Three.js scene units

    const geo = new THREE.PlaneGeometry(worldSize, worldSize, w - 1, h - 1);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position.array;
    const colors = new Float32Array(positions.length);

    // Set Y (elevation) and UV values
    const uvs = new Float32Array(w * h * 2);
    for (let iy = 0; iy < h; iy++) {
      for (let ix = 0; ix < w; ix++) {
        const vertIdx = iy * w + ix;
        const elev = heights[vertIdx];
        positions[vertIdx * 3 + 1] = (elev * verticalScale) / 32;
        // UV: map grid position to 0–1 (flip V so top-left of image = top of map)
        uvs[vertIdx * 2]     = ix / (w - 1);
        uvs[vertIdx * 2 + 1] = 1 - iy / (h - 1);
      }
    }

    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    // Compute normals for Three.js lighting
    geo.computeVertexNormals();

    // Apply base colors
    for (let iy = 0; iy < h; iy++) {
      for (let ix = 0; ix < w; ix++) {
        const vertIdx = iy * w + ix;
        const elev = heights[vertIdx];
        let color;

        if (colorMode === 'hypsometric') {
          color = getHypsometricColor(elev, meta.minElevation, meta.maxElevation);
        } else if (colorMode === 'gray') {
          color = { r: 0.6, g: 0.6, b: 0.6 };
        } else {
          color = { r: 0.6, g: 0.6, b: 0.6 };
        }

        colors[vertIdx * 3] = color.r;
        colors[vertIdx * 3 + 1] = color.g;
        colors[vertIdx * 3 + 2] = color.b;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Water plane (subdivided so we can animate soft waves)
    const waterGeo = new THREE.PlaneGeometry(worldSize * 1.2, worldSize * 1.2, 96, 96);
    waterGeo.rotateX(-Math.PI / 2);

    return { geometry: geo, waterGeometry: waterGeo };
  }, [heights, meta, verticalScale, colorMode]);

  // Animate water + update sun light position in real-time
  useFrame((state) => {
    if (waterRef.current) {
      const t = state.clock.elapsedTime;
      waterRef.current.position.y = (waterLevel * verticalScale) / 32;
      if (foamRef.current) {
        foamRef.current.position.y = waterRef.current.position.y + 0.015;
      }

      // Flowing foam streak pattern
      foamTex.offset.x = (t * 0.01) % 1;
      foamTex.offset.y = (t * 0.006) % 1;
    }
    if (sunRef.current) {
      sunRef.current.position.set(sunPos[0], sunPos[1], sunPos[2]);
    }
    // Keep underwater tint uniform in sync with water level
    if (meshRef.current?.userData?.shader) {
      meshRef.current.userData.shader.uniforms.uWaterY.value = (waterLevel * verticalScale) / 32;
    }
  });

  // All hooks called — safe to bail out now
  if (!geometry) return null;

  return (
    <group position={[0, 0, 0]}>
      {/* Sun directional light — driven by azimuth/elevation sliders */}
      <directionalLight
        ref={sunRef}
        position={sunPos}
        intensity={1.8}
        castShadow
      />

      {/* Terrain mesh — Three.js lighting provides live hillshade */}
      <mesh ref={meshRef} geometry={geometry} receiveShadow castShadow>
        {colorMode === 'satellite' ? (
          <meshStandardMaterial
            map={satelliteTex}
            wireframe={wireframe}
            side={THREE.DoubleSide}
            roughness={0.92}
            metalness={0.0}
            flatShading={false}
            onBeforeCompile={(shader) => {
              shader.uniforms.uWaterY = { value: (waterLevel * verticalScale) / 32 };
              // Inject uniform declaration
              shader.fragmentShader = shader.fragmentShader.replace(
                'void main() {',
                `uniform float uWaterY;\nvoid main() {`
              );
              // After map_fragment (where diffuseColor has the satellite texture),
              // tint pixels below water level with a depth-dependent blue-green
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `#include <map_fragment>
{
  // vWorldPosition.y is in scene units (world elevation * vScale / 32)
  float depth = uWaterY - vWorldPosition.y;
  if (depth > 0.0) {
    float t = clamp(depth / 4.0, 0.0, 1.0); // 0→1 over ~128m world depth
    vec3 shallowTint = vec3(0.25, 0.55, 0.65);
    vec3 deepTint    = vec3(0.08, 0.18, 0.30);
    vec3 waterColor  = mix(shallowTint, deepTint, t);
    diffuseColor.rgb = mix(diffuseColor.rgb, waterColor, 0.45 + 0.45 * t);
  }
}`
              );
              // We need vWorldPosition in the fragment shader
              shader.vertexShader = shader.vertexShader.replace(
                'void main() {',
                `varying vec3 vWorldPosition;\nvoid main() {`
              );
              shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
              );
              shader.fragmentShader = shader.fragmentShader.replace(
                'void main() {',
                `varying vec3 vWorldPosition;\nvoid main() {`
              );
              // Store ref so we can update waterY uniform each frame
              meshRef.current.userData.shader = shader;
            }}
          />
        ) : (
          <meshStandardMaterial
            vertexColors
            wireframe={wireframe}
            side={THREE.DoubleSide}
            roughness={0.9}
            metalness={0.0}
            flatShading={false}
          />
        )}
      </mesh>

      {/* Water plane */}
      {showWater && (
        <>
          <mesh ref={waterRef} geometry={waterGeometry}>
            <MeshReflectorMaterial
              color="#3c8fb3"
              resolution={512}
              mirror={0.62}
              mixStrength={1.15}
              blur={[140, 36]}
              transparent
              opacity={0.78}
              roughness={0.18}
              metalness={0.85}
              depthScale={0.22}
              minDepthThreshold={0.28}
              maxDepthThreshold={1.3}
              side={THREE.DoubleSide}
            />
          </mesh>

          <mesh ref={foamRef} geometry={waterGeometry}>
            <meshBasicMaterial
              map={foamTex}
              transparent
              opacity={0.24}
              color="#ffffff"
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}

      {/* Grid helper */}
      <gridHelper args={[meta.worldSize / 32, 16, '#333355', '#222244']} position={[0, -2, 0]} />
    </group>
  );
}
