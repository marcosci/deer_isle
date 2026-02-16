import React, { useState, useEffect } from 'react';
import { CATEGORY_CONFIG } from './Objects';

const panelStyle = {
  position: 'absolute',
  top: 16,
  left: 16,
  background: 'rgba(10, 10, 30, 0.85)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(100, 140, 200, 0.3)',
  borderRadius: 12,
  padding: '16px 20px',
  color: '#c8d8e8',
  fontSize: 13,
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  minWidth: 240,
  maxHeight: 'calc(100vh - 32px)',
  overflowY: 'auto',
  userSelect: 'none',
  zIndex: 100,
};

const titleStyle = {
  fontSize: 16,
  fontWeight: 700,
  color: '#e8f0ff',
  marginBottom: 4,
  letterSpacing: '0.5px',
};

const subtitleStyle = {
  fontSize: 11,
  color: '#7890a8',
  marginBottom: 14,
};

const labelStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 4,
  fontSize: 12,
};

const sliderStyle = {
  width: '100%',
  marginBottom: 12,
  accentColor: '#4488cc',
};

const selectStyle = {
  width: '100%',
  padding: '4px 8px',
  marginBottom: 12,
  background: 'rgba(20, 25, 50, 0.8)',
  color: '#c8d8e8',
  border: '1px solid rgba(100, 140, 200, 0.3)',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};

const checkboxRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
  fontSize: 12,
  cursor: 'pointer',
};

function formatScale(v) {
  // Display as ×1.5, ×2, ×2.5 etc — drop the decimal when it's .0
  return v % 1 === 0 ? `×${v.toFixed(0)}` : `×${v.toFixed(1)}`;
}

export default function HUD({
  waterLevel, setWaterLevel,
  verticalScale, setVerticalScale,
  colorMode, setColorMode,
  showWater, setShowWater,
  wireframe, setWireframe,
  resolution, setResolution,
  sunAzimuth, setSunAzimuth,
  sunElevation, setSunElevation,
  visibleCategories, setVisibleCategories,
  objectsMeta,
  showLabels, setShowLabels,
  fps,
  onScreenshot,
}) {
  const [objectsExpanded, setObjectsExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // ── Collapsed state: show only the mountain toggle button ──
  if (collapsed) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'rgba(10, 10, 30, 0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(100, 140, 200, 0.3)',
          borderRadius: 12,
          padding: '8px 12px',
          color: '#e8f0ff',
          fontSize: 20,
          cursor: 'pointer',
          userSelect: 'none',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
        onClick={() => setCollapsed(false)}
        title="Open controls"
      >
        🏔️
        <span style={{ fontSize: 11, color: '#88aacc' }}>{fps} fps</span>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* Title row with collapse button on the left icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ ...titleStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{ cursor: 'pointer', lineHeight: 1 }}
              onClick={() => setCollapsed(true)}
              title="Collapse panel"
            >
              🏔️
            </span>
            <span>Deer Isle</span>
          </div>
          <div style={subtitleStyle}>3D Terrain Viewer • 16.384km² DayZ Map</div>
        </div>
      </div>

      {/* FPS display */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        padding: '4px 8px',
        background: 'rgba(20, 30, 60, 0.5)',
        borderRadius: 6,
        fontSize: 11,
      }}>
        <span style={{ color: '#7890a8' }}>Performance</span>
        <span style={{
          color: fps >= 50 ? '#66cc66' : fps >= 30 ? '#ccaa44' : '#cc4444',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}>{fps} FPS</span>
      </div>

      <div style={labelStyle}>
        <span>Vertical Exaggeration</span>
        <span style={{ color: '#88aacc' }}>{formatScale(verticalScale)}</span>
      </div>
      <input
        type="range"
        min="1"
        max="5"
        step="0.1"
        value={verticalScale}
        onChange={(e) => setVerticalScale(parseFloat(e.target.value))}
        style={sliderStyle}
      />

      <div style={labelStyle}>
        <span>Water Level</span>
        <span style={{ color: '#88aacc' }}>{waterLevel.toFixed(1)}m</span>
      </div>
      <input
        type="range"
        min="-42"
        max="100"
        step="0.5"
        value={waterLevel}
        onChange={(e) => setWaterLevel(parseFloat(e.target.value))}
        style={sliderStyle}
      />

      <div style={labelStyle}>
        <span>Resolution</span>
        <span style={{ color: '#88aacc' }}>{resolution}×{resolution}</span>
      </div>
      <select
        value={resolution}
        onChange={(e) => setResolution(parseInt(e.target.value))}
        style={selectStyle}
      >
        <option value={1024}>1024×1024 — High</option>
        <option value={2048}>2048×2048 — Ultra</option>
        <option value={4096}>4096×4096 — Native</option>
      </select>

      <div style={labelStyle}>
        <span>Color Mode</span>
      </div>
      <select
        value={colorMode}
        onChange={(e) => setColorMode(e.target.value)}
        style={selectStyle}
      >
        <option value="hypsometric">Hypsometric</option>
        <option value="gray">Monochromatic Gray</option>
        <option value="satellite">Satellite</option>
      </select>

      <div style={labelStyle}>
        <span>☀ Sun Azimuth</span>
        <span style={{ color: '#88aacc' }}>{sunAzimuth}°</span>
      </div>
      <input
        type="range"
        min="0"
        max="360"
        step="1"
        value={sunAzimuth}
        onChange={(e) => setSunAzimuth(parseInt(e.target.value))}
        style={sliderStyle}
      />

      <div style={labelStyle}>
        <span>☀ Sun Elevation</span>
        <span style={{ color: '#88aacc' }}>{sunElevation}°</span>
      </div>
      <input
        type="range"
        min="5"
        max="90"
        step="1"
        value={sunElevation}
        onChange={(e) => setSunElevation(parseInt(e.target.value))}
        style={sliderStyle}
      />

      <label style={checkboxRow}>
        <input
          type="checkbox"
          checked={showWater}
          onChange={(e) => setShowWater(e.target.checked)}
        />
        Show Water
      </label>

      <label style={checkboxRow}>
        <input
          type="checkbox"
          checked={wireframe}
          onChange={(e) => setWireframe(e.target.checked)}
        />
        Wireframe
      </label>

      <label style={checkboxRow}>
        <input
          type="checkbox"
          checked={showLabels}
          onChange={(e) => setShowLabels(e.target.checked)}
        />
        📍 Location Labels
      </label>

      {/* ── Object Layers ── */}
      <div style={{ marginTop: 12, borderTop: '1px solid rgba(100,140,200,0.15)', paddingTop: 10 }}>
        <div
          style={{ ...labelStyle, cursor: 'pointer', marginBottom: 8 }}
          onClick={() => setObjectsExpanded(!objectsExpanded)}
        >
          <span style={{ fontWeight: 600 }}>
            {objectsExpanded ? '▼' : '▶'} Object Layers
          </span>
          <span style={{ color: '#88aacc', fontSize: 11 }}>
            {objectsMeta ? `${(objectsMeta.totalObjects / 1000).toFixed(0)}k` : '…'}
          </span>
        </div>

        {objectsExpanded && objectsMeta && (
          <div style={{ marginLeft: 4 }}>
            {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => {
              const meta = objectsMeta.categories?.[cat];
              if (!meta) return null;
              return (
                <label key={cat} style={{ ...checkboxRow, marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={!!visibleCategories[cat]}
                    onChange={(e) => {
                      setVisibleCategories(prev => ({
                        ...prev,
                        [cat]: e.target.checked,
                      }));
                    }}
                  />
                  <span>{cfg.label}</span>
                  <span style={{ marginLeft: 'auto', color: '#6a8aaa', fontSize: 10 }}>
                    {meta.count.toLocaleString()}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, borderTop: '1px solid rgba(100,140,200,0.15)', paddingTop: 10 }}>
        <button
          onClick={onScreenshot}
          style={{
            width: '100%',
            padding: '8px 0',
            background: 'rgba(68, 136, 204, 0.25)',
            color: '#c8ddf0',
            border: '1px solid rgba(100, 160, 220, 0.4)',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(68, 136, 204, 0.45)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(68, 136, 204, 0.25)'}
          title="Save current view as PNG"
        >
          📸 Screenshot
        </button>
      </div>

      <div style={{ marginTop: 12, borderTop: '1px solid rgba(100,140,200,0.15)', paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: '#5a7090', lineHeight: 1.5 }}>
          🖱️ Left-drag to orbit<br />
          🖱️ Right-drag to pan<br />
          🖱️ Scroll to zoom<br />
          ⌨️ WASD move • QE up/down<br />
          ⌨️ Shift = faster
        </div>
      </div>
    </div>
  );
}
