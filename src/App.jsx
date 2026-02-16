import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Terrain from './Terrain';
import HUD from './HUD';
import Objects from './Objects';
import LocationLabels from './LocationLabels';
import CameraControls from './CameraControls';
import FpsReporter from './FpsReporter';

export default function App() {
  const [waterLevel, setWaterLevel] = useState(0);
  const [verticalScale, setVerticalScale] = useState(1.5);
  const [colorMode, setColorMode] = useState('hypsometric');
  const [showWater, setShowWater] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [resolution, setResolution] = useState(1024);
  const [sunAzimuth, setSunAzimuth] = useState(315);
  const [sunElevation, setSunElevation] = useState(35);
  const [visibleCategories, setVisibleCategories] = useState({});
  const [showLabels, setShowLabels] = useState(true);
  const [objectsMeta, setObjectsMeta] = useState(null);
  const [fps, setFps] = useState(0);

  // Load objects metadata on mount
  useEffect(() => {
    fetch('/objects-meta.json')
      .then(r => r.json())
      .then(meta => {
        setObjectsMeta(meta);
        // Initialize all categories as hidden
        const initial = {};
        for (const cat of Object.keys(meta.categories)) {
          initial[cat] = false;
        }
        setVisibleCategories(initial);
      })
      .catch(err => console.warn('No objects-meta.json found:', err));
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [400, 300, 400], fov: 50, near: 1, far: 5000 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0a0a1a']} />
        <ambientLight intensity={0.25} />
        <hemisphereLight args={['#87ceeb', '#3d5c3a', 0.2]} />

        <Suspense fallback={<Html center><div style={{ color: 'white', fontSize: 24 }}>Loading terrain...</div></Html>}>
          <Terrain
            waterLevel={waterLevel}
            verticalScale={verticalScale}
            colorMode={colorMode}
            showWater={showWater}
            wireframe={wireframe}
            resolution={resolution}
            sunAzimuth={sunAzimuth}
            sunElevation={sunElevation}
          />
          <Objects
            visibleCategories={visibleCategories}
            verticalScale={verticalScale}
            objectsMeta={objectsMeta}
          />
          <LocationLabels
            visible={showLabels}
            verticalScale={verticalScale}
          />
        </Suspense>

        <CameraControls />
        <FpsReporter onFps={setFps} />
      </Canvas>

      <HUD
        waterLevel={waterLevel}
        setWaterLevel={setWaterLevel}
        verticalScale={verticalScale}
        setVerticalScale={setVerticalScale}
        colorMode={colorMode}
        setColorMode={setColorMode}
        showWater={showWater}
        setShowWater={setShowWater}
        wireframe={wireframe}
        setWireframe={setWireframe}
        resolution={resolution}
        setResolution={setResolution}
        sunAzimuth={sunAzimuth}
        setSunAzimuth={setSunAzimuth}
        sunElevation={sunElevation}
        setSunElevation={setSunElevation}
        visibleCategories={visibleCategories}
        setVisibleCategories={setVisibleCategories}
        objectsMeta={objectsMeta}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
        fps={fps}
      />
    </div>
  );
}
