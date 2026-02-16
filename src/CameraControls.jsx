import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Enhanced orbit controls with WASD / QE keyboard movement.
 *
 * WASD  — strafe in the camera's local XZ plane
 * Q / E — move up / down
 * Shift — hold to move faster
 *
 * All movement shifts the orbit target (and camera) together so the
 * orbit "anchor" follows the player around the map.
 */
export default function CameraControls({ characterActive = false }) {
  const controlsRef = useRef();
  const keys = useRef({});
  const { camera, gl } = useThree();

  // Register keyboard listeners once
  useEffect(() => {
    const onDown = (e) => {
      // Don't capture keys when typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      keys.current[e.code] = true;
    };
    const onUp = (e) => {
      keys.current[e.code] = false;
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const k = keys.current;
    const fast = k['ShiftLeft'] || k['ShiftRight'];
    const speed = (fast ? 400 : 100) * delta; // scene-units/sec

    // Build movement vector in camera's local space
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, camera.up).normalize();

    const move = new THREE.Vector3();

    if (k['KeyW'])    move.add(forward.clone().multiplyScalar(speed));
    if (k['KeyS'])    move.add(forward.clone().multiplyScalar(-speed));
    if (k['KeyD'])    move.add(right.clone().multiplyScalar(speed));
    if (k['KeyA'])    move.add(right.clone().multiplyScalar(-speed));
    // Arrow keys only move camera when character is NOT active
    if (!characterActive) {
      if (k['ArrowUp'])    move.add(forward.clone().multiplyScalar(speed));
      if (k['ArrowDown'])  move.add(forward.clone().multiplyScalar(-speed));
      if (k['ArrowRight']) move.add(right.clone().multiplyScalar(speed));
      if (k['ArrowLeft'])  move.add(right.clone().multiplyScalar(-speed));
    }
    if (k['KeyE'] || k['Space'])      move.y += speed;
    if (k['KeyQ'] || k['KeyC'])       move.y -= speed;

    if (move.lengthSq() === 0) return;

    // Shift both camera and orbit target so the orbit pivot follows
    camera.position.add(move);
    controls.target.add(move);
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={!characterActive}
      enableDamping
      dampingFactor={0.1}
      minDistance={5}
      maxDistance={2000}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}
