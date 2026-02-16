import React, { useState, useEffect } from 'react';
import { Html } from '@react-three/drei';

const WORLD_HALF = 8192;
const WORLD_SCALE = 32;

/* ── Mapbox Maki SVG path data (CC0 license) ── */
const MAKI = {
  'town-hall':
    'M13,4H9l0-3L7.5,0L6,1v3H2L1,5v1h13V5L13,4z M7.5,1.5c0.4,0,0.7,0.3,0.7,0.8S7.9,3,7.5,3S6.7,2.7,6.7,2.2C6.7,1.8,7.1,1.5,7.5,1.5z M13,7H2v4l-1,1.5V14h13v-1.5L13,11V7z M5,12.5H4V8h1V12.5z M8,12.5H7V8h1V12.5z M11,12.5h-1V8h1V12.5z',
  city:
    'M12.6368 3.9994H10.9981V2.3608C10.998 2.16148 10.8364 1.99994 10.6371 2H10.3591C10.1598 2 9.9982 2.16158 9.9982 2.3609V3.9994H8.36C8.16068 3.9994 7.9991 4.16098 7.9991 4.3603V9.9984H4.3621C4.16168 9.9984 3.9992 10.1609 3.9992 10.3613V12.6358C3.99975 12.8358 4.16207 12.9977 4.3621 12.9977H12.6368C12.8361 12.9977 12.9977 12.8361 12.9977 12.6368V4.36C12.9977 4.16068 12.8361 3.9994 12.6368 3.9994ZM5.9989 11.9981H4.9989V10.9981H5.9989V11.9981ZM7.9989 11.9981H6.9989V10.9981H7.9989V11.9981ZM9.9989 11.9981H8.9989V10.9981H9.9989V11.9981ZM9.9989 9.9981H8.9989V8.9981H9.9989V9.9981ZM9.9989 7.9981H8.9989V6.9981H9.9989V7.9981ZM9.9989 5.9981H8.9989V4.9981H9.9989V5.9981ZM11.9989 11.9971H10.9989V10.9971H11.9989V11.9971ZM11.9989 9.9971H10.9989V8.9971H11.9989V9.9971ZM11.9989 7.9971H10.9989V6.9971H11.9989V7.9971ZM11.9989 5.9971H10.9989V4.9971H11.9989V5.9971ZM6.9987 2.3608C6.99864 2.16152 6.83708 2 6.6378 2H4.36C4.16068 2 3.9991 2.16158 3.9991 2.3609V4H2.36C2.16138 4.00049 2.00049 4.16138 2 4.36V12.6474C2 12.8407 2.1567 12.9974 2.35 12.9974H2.9994V8.9986H6.9987V2.3608ZM4 7.9981H3V6.9981H4V7.9981ZM4 5.9981H3V4.9981H4V5.9981ZM6 7.9981H5V6.9981H6V7.9981ZM6 5.9981H5V4.9981H6V5.9981ZM6 3.9981H5V3H6V4V3.9981Z',
  town:
    'm10.651 6.121c-.0445-.0357-.0999-.05516-.157-.05516s-.1125.01946-.157.05516l-2.245 1.808c-.02881.02323-.05204.05263-.06796.08603-.01593.03341-.02414.06997-.02404.10697v4.625c0 .0671.02666.1315.0741.1789.04745.0474.1118.0741.1789.0741h1.494c.0671 0 .13145-.0267.1789-.0741s.0741-.1118.0741-.1789v-1.747h1v1.747c0 .0671.0267.1315.0741.1789.0475.0474.1118.0741.1789.0741h1.494c.0671 0 .1315-.0267.1789-.0741s.0741-.1118.0741-.1789v-4.627c.0007-.03831-.0074-.07627-.0237-.11095s-.0404-.06514-.0703-.08905zm-.651 3.879h-1v-1h1zm2 0h-1v-1h1zm-6.29-9.184997c-.02299-.034654-.05419-.063081-.09083-.082746s-.07758-.029956-.11917-.029956c-.04158 0-.08252.010291-.11916.029956-.03665.019665-.06785.048092-.09084.082746l-3.248 4.120997c-.02752.0415-.04214.09021-.042.14v7.671c-.00013.0331.00626.0659.0188.0965s.031.0585.0543.082c.02331.0235.05102.0422.08154.0549.03053.0128.06327.0195.09636.0196h2.5c.06632-.0008.12964-.0277.17626-.0749.04661-.0471.07275-.1108.07274-.1771v-1.748h1v1.748c0 .0668.02655.1309.07381.1782s.11136.0738.17819.0738h.748v-6c-.00004-.07511.01684-.14926.04938-.21695.03255-.06769.07993-.12718.13862-.17405l1.812-1.609c0-.05-3.29-4.184997-3.29-4.184997zm-1.71 8.184997h-1v-1h1zm0-3h-1v-1h1zm2 3h-1v-1h1zm0-3h-1v-1h1z',
  village:
    'M6.176 1.176a.249.249 0 0 0-.352 0l-4.4 4.4A.25.25 0 0 0 1.6 6H3v6.751a.25.25 0 0 0 .249.249h3.5A.248.248 0 0 0 7 12.753v-7.43c0-.066.026-.13.073-.176L8.5 3.5 6.176 1.176ZM6 11H5v-1h1v1Zm0-2H5V8h1v1Zm0-3v1H5V6h1Z M12.75 3h-.5a.25.25 0 0 0-.25.25V5l-1.324-1.824a.249.249 0 0 0-.352 0L8.056 5.932A.246.246 0 0 0 8 6.088v6.66a.249.249 0 0 0 .246.252h1.5a.253.253 0 0 0 .254-.252V11h1v1.747a.253.253 0 0 0 .253.253h1.5a.25.25 0 0 0 .247-.249V3.25a.25.25 0 0 0-.25-.25ZM10 8H9V7h1v1Zm2 0h-1V7h1v1Zm-2 2H9V9h1v1Zm2 0h-1V9h1v1Z',
  marker:
    'M7.5 1C5.42312 1 3 2.2883 3 5.56759C3 7.79276 6.46156 12.7117 7.5 14C8.42309 12.7117 12 7.90993 12 5.56759C12 2.2883 9.57688 1 7.5 1Z',
  airport:
    'M15,6.8182L15,8.5l-6.5-1l-0.3182,4.7727L11,14v1l-3.5-0.6818L4,15v-1l2.8182-1.7273L6.5,7.5L0,8.5V6.8182L6.5,4.5v-3c0,0,0-1.5,1-1.5s1,1.5,1,1.5v2.8182L15,6.8182z',
  mountain:
    'm7.5 1c-.3 0-.4.2-.6.4l-5.8 9.5c-.1.1-.1.3-.1.4 0 .5.4.7.7.7h11.6c.4 0 .7-.2.7-.7 0-.2 0-.2-.1-.4l-5.7-9.5c-.2-.2-.4-.4-.7-.4zm0 1.5 3.3 5.5h-.8l-1.5-1.5-1 1.5-1-1.5-1.5 1.5h-.9z',
  harbor:
    'M7.5,0C5.5,0,4,1.567,4,3.5c0.0024,1.5629,1.0397,2.902,2.5,3.3379v6.0391c-0.9305-0.1647-1.8755-0.5496-2.6484-1.2695C2.7992,10.6273,2.002,9.0676,2.002,6.498c0.0077-0.5646-0.4531-1.0236-1.0176-1.0137C0.4329,5.493-0.0076,5.9465,0,6.498c0,3.0029,1.0119,5.1955,2.4902,6.5723C3.9685,14.4471,5.8379,15,7.5,15c1.6656,0,3.535-0.5596,5.0117-1.9395S14.998,9.4868,14.998,6.498c0.0648-1.3953-2.0628-1.3953-1.998,0c0,2.553-0.7997,4.1149-1.8535,5.0996C10.3731,12.3203,9.4288,12.7084,8.5,12.875V6.8418C9.9607,6.4058,10.9986,5.0642,11,3.5C11,1.567,9.5,0,7.5,0z M7.5,2C8.3284,2,9,2.6716,9,3.5S8.3284,5,7.5,5S6,4.3284,6,3.5S6.6716,2,7.5,2z',
  castle:
    'M11,4H4C3.4477,4,3,3.5523,3,3V0.5C3,0.2239,3.2239,0,3.5,0S4,0.2239,4,0.5V2h1V1c0-0.5523,0.4477-1,1-1s1,0.4477,1,1v1h1V1c0-0.5523,0.4477-1,1-1s1,0.4477,1,1v1h1V0.5C11,0.2239,11.2239,0,11.5,0S12,0.2239,12,0.5V3C12,3.5523,11.5523,4,11,4z M14,14.5c0,0.2761-0.2239,0.5-0.5,0.5h-12C1.2239,15,1,14.7761,1,14.5S1.2239,14,1.5,14H2c0.5523,0,1-0.4477,1-1c0,0,1-6,1-7c0-0.5523,0.4477-1,1-1h5c0.5523,0,1,0.4477,1,1c0,1,1,7,1,7c0,0.5523,0.4477,1,1,1h0.5c0.2723-0.0001,0.4946,0.2178,0.5,0.49V14.5z M9,10.5C9,9.6716,8.3284,9,7.5,9S6,9.6716,6,10.5V14h3V10.5z',
  viewpoint:
    'M6.02,8.425a2.3859,2.3859,0,0,0-.46.44l-4.55-3.5a7.9976,7.9976,0,0,1,1.51-1.51Zm6.46-4.56-3.5,4.55a2.3971,2.3971,0,0,1,.45.45l4.56-3.5A7.945,7.945,0,0,0,12.48,3.865ZM7.3042,10.0129a1.5,1.5,0,1,0,1.6829,1.2914h0A1.5,1.5,0,0,0,7.3042,10.0129ZM6.43,2.235a7.9329,7.9329,0,0,0-2.06.55l2.2,5.32a2.0438,2.0438,0,0,1,.61-.17Zm2.14.01-.75,5.69a2.49,2.49,0,0,1,.61.16l2.2-5.3A7.2129,7.2129,0,0,0,8.57,2.245Z',
  star:
    'M7.5,0l-2,5h-5l4,3.5l-2,6l5-3.5l5,3.5l-2-6l4-3.5h-5L7.5,0z',
  lighthouse:
    'M4.5,6L0,7V6.5l4.5-1V6z M4.5,3.5L0,2.5V3l4.5,1V3.5z M10.5,3.5V4L15,3V2.5L10.5,3.5z M10.5,6L15,7V6.5l-4.5-1V6z M8,7V2h2.5c0.2761,0.0552,0.5448-0.1239,0.6-0.4c0.0552-0.2761-0.1239-0.5448-0.4-0.6l-3-1C7.5696-0.0586,7.4204-0.0586,7.29,0l-3,1c-0.2761,0.0552-0.4552,0.3239-0.4,0.6S4.2139,2.0552,4.49,2H7v5H5l-2,7h9l-2-7H8z',
};

/* ── Inline Maki SVG icon component ── */
function MakiIcon({ name, size = 20, fill = '#ffffff' }) {
  const d = MAKI[name];
  if (!d) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 15 15"
      style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))' }}
    >
      <path d={d} fill={fill} />
    </svg>
  );
}

/* ── Location type → visual style (now using Maki icon names) ── */
const TYPE_STYLES = {
  NameCityCapital:  { icon: 'town-hall', iconSize: 22, iconColor: '#ffe066', fontSize: 15, color: '#ffe066', fontWeight: 800 },
  NameCity:         { icon: 'city',      iconSize: 20, iconColor: '#ffd480', fontSize: 13, color: '#ffd480', fontWeight: 700 },
  NameVillage:      { icon: 'village',   iconSize: 18, iconColor: '#e0d8c8', fontSize: 11, color: '#e0d8c8', fontWeight: 600 },
  NameLocal:        { icon: 'marker',    iconSize: 16, iconColor: '#b8c8d8', fontSize: 10, color: '#b8c8d8', fontWeight: 500 },
  Airport:          { icon: 'airport',   iconSize: 20, iconColor: '#88bbee', fontSize: 12, color: '#88bbee', fontWeight: 600 },
  StrongpointArea:  { icon: 'castle',    iconSize: 18, iconColor: '#ee8866', fontSize: 11, color: '#ee8866', fontWeight: 600 },
  Hill:             { icon: 'mountain',  iconSize: 18, iconColor: '#a8b8a0', fontSize: 10, color: '#a8b8a0', fontWeight: 500 },
  ViewPoint:        { icon: 'viewpoint', iconSize: 18, iconColor: '#d8b870', fontSize: 11, color: '#d8b870', fontWeight: 600 },
  NameMarine:       { icon: 'harbor',    iconSize: 18, iconColor: '#66aadd', fontSize: 11, color: '#66aadd', fontWeight: 600 },
  RockArea:         { icon: 'mountain',  iconSize: 16, iconColor: '#b0a898', fontSize: 10, color: '#b0a898', fontWeight: 500 },
};

const DEFAULT_STYLE = { icon: 'marker', iconSize: 16, iconColor: '#c0c0c0', fontSize: 10, color: '#c0c0c0', fontWeight: 500 };

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
          gap: 2,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
        }}>
          <MakiIcon name={style.icon} size={style.iconSize} fill={style.iconColor} />
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
