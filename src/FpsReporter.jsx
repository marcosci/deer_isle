import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * Invisible component that lives inside the Canvas and reports
 * FPS to a parent callback every ~0.5 s.
 */
export default function FpsReporter({ onFps }) {
  const frames = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame(() => {
    frames.current++;
    const now = performance.now();
    const elapsed = now - lastTime.current;

    if (elapsed >= 500) {
      const fps = Math.round((frames.current * 1000) / elapsed);
      onFps(fps);
      frames.current = 0;
      lastTime.current = now;
    }
  });

  return null;
}
