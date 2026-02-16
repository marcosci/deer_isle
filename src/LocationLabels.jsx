import React, { useState, useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';

const WORLD_HALF = 8192;
const WORLD_SCALE = 32;

// Location type → visual style
const TYPE_STYLES = {
  NameCityCapital:  { emoji: '🏛️', fontSize: 15, color: '#ffe066', fontWeight: 800 },
  NameCity:         { emoji: '🏙️', fontSize: 13, color: '#ffd480', fontWeight: 700 },
  NameVillage:      { emoji: '🏘️', fontSize: 11, color: '#e0d8c8', fontWeight: 600 },
  NameLocal:        { emoji: '📍', fontSize: 10, color: '#b8c8d8', fontWeight: 500 },
  Airport:          { emoji: '✈️', fontSize: 12, color: '#88bbee', fontWeight: 600 },
  StrongpointArea:  { emoji: '⚔️', fontSize: 11, color: '#ee8866', fontWeight: 600 },
  Hill:             { emoji: '⛰️', fontSize: 10, color: '#a8b8a0', fontWeight: 500 },
  ViewPoint:        { emoji: '🏰', fontSize: 11, color: '#d8b870', fontWeight: 600 },
  NameMarine:       { emoji: '⚓', fontSize: 11, color: '#66aadd', fontWeight: 600 },
  RockArea:         { emoji: '🗿', fontSize: 10, color: '#b0a898', fontWeight: 500 },
};

const DEFAULT_STYLE = { emoji: '📍', fontSize: 10, color: '#c0c0c0', fontWeight: 500 };

function LocationLabel({ loc, verticalScale }) {
  const style = TYPE_STYLES[loc.type] || DEFAULT_STYLE;

  // World coords → Three.js scene coords
  const sceneX =  (loc.x - WORLD_HALF) / WORLD_SCALE;
  const sceneZ = -(loc.z - WORLD_HALF) / WORLD_SCALE;
  // Float labels above terrain — use a fixed height per type
  const baseY = loc.type === 'NameCityCapital' ? 18 :
                loc.type === 'NameCity' ? 14 :
                loc.type === 'Hill' ? 16 : 10;
  const sceneY = (baseY * verticalScale) / WORLD_SCALE + 2;

  return (
    <group position={[sceneX, sceneY, sceneZ]}>
      <Html
        center
        distanceFactor={80}
        style={{
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
        zIndexRange={[50, 0]}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
        }}>
          <span style={{ fontSize: style.fontSize + 4 }}>{style.emoji}</span>
          <span style={{
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            color: style.color,
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)',
            letterSpacing: '0.3px',
          }}>
            {loc.name}
          </span>
        </div>
      </Html>
    </group>
  );
}

export default function LocationLabels({ visible, verticalScale }) {
  const [locations, setLocations] = useState(null);

  useEffect(() => {
    fetch('/locations.json')
      .then(r => r.json())
      .then(setLocations)
      .catch(err => console.warn('No locations.json found:', err));
  }, []);

  if (!visible || !locations) return null;

  return (
    <group>
      {locations.map((loc, i) => (
        <LocationLabel key={i} loc={loc} verticalScale={verticalScale} />
      ))}
    </group>
  );
}
