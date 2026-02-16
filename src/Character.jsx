import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * First-person character controller (no 3D model).
 *
 * Inspired by https://github.com/malted/charactercontroller
 *
 * • Click the canvas to enter pointer-lock (mouse-look).
 * • WASD / Arrow keys to move.  Shift to sprint.
 * • Space to jump.  Gravity pulls you down.
 * • Camera sits at EYE_HEIGHT above the terrain surface.
 * • Press Escape or toggle Walk Mode off to release the pointer.
 */

// ── World / scene constants ─────────────────────────────────────
const WORLD_SIZE = 16384;
const SCALE = 32;
const HALF = WORLD_SIZE / 2;

// ── Player constants ────────────────────────────────────────────
const EYE_HEIGHT   = 1.8 / SCALE;          // 1.8 m  → scene units
const WALK_SPEED   = 120 / SCALE;           // ~3.75 scene-units/s ≈ jogging
const SPRINT_SPEED = 300 / SCALE;           // ~9.4  scene-units/s
const GRAVITY      = -9.81 / SCALE;         // scene-units/s²
const JUMP_POWER   = 5 / SCALE;             // scene-units/s
const MOUSE_SENS_X = 0.002;                 // radians per pixel
const MOUSE_SENS_Y = 0.002;

// ── Terrain raycaster ───────────────────────────────────────────
function useGroundHeight(scene) {
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const down = useMemo(() => new THREE.Vector3(0, -1, 0), []);

  return useCallback(
    (x, z) => {
      raycaster.set(new THREE.Vector3(x, 500, z), down);
      raycaster.far = 1000;

      const candidates = [];
      scene.traverse((child) => {
        if (
          child.isMesh &&
          child.material?.vertexColors &&
          child.geometry?.attributes?.color
        ) {
          candidates.push(child);
        }
      });

      const hits = raycaster.intersectObjects(candidates, false);
      return hits.length > 0 ? hits[0].point.y : 0;
    },
    [raycaster, down, scene],
  );
}

// ── Component ───────────────────────────────────────────────────
export default function Character({ active }) {
  const { camera, gl } = useThree();
  const scene = useThree((s) => s.scene);
  const getGround = useGroundHeight(scene);

  // Persistent state across frames
  const state = useRef({
    // World-space position (scene coords)
    x: 0,
    y: 0,
    z: 0,
    // Look angles
    yaw: 0,   // horizontal rotation (radians)
    pitch: 0, // vertical   rotation (radians)
    // Physics
    velocityY: 0,
    isGrounded: false,
    // Input
    keys: {},
    mouseDX: 0,
    mouseDY: 0,
    // Lifecycle
    wasActive: false,
    savedCamPos: null,
    savedCamRot: null,
  });

  // ── Pointer lock ──────────────────────────────────────────────
  useEffect(() => {
    if (!active) {
      // Exit pointer lock when walk mode is turned off
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock();
      }
      return;
    }

    const canvas = gl.domElement;

    // Click to enter pointer lock
    const onClick = () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    };

    // Collect mouse deltas
    const onMouseMove = (e) => {
      if (document.pointerLockElement !== canvas) return;
      state.current.mouseDX += e.movementX;
      state.current.mouseDY += e.movementY;
    };

    canvas.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMouseMove);

    return () => {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, [active, gl]);

  // ── Keyboard ──────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;

    const onDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      state.current.keys[e.code] = true;

      // Prevent page scroll on space / arrows
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const onUp = (e) => {
      state.current.keys[e.code] = false;
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      state.current.keys = {};
    };
  }, [active]);

  // ── Activation / deactivation — save & restore camera ─────────
  useEffect(() => {
    const s = state.current;

    if (active && !s.wasActive) {
      // Save current camera transform so we can restore it later
      s.savedCamPos = camera.position.clone();
      s.savedCamRot = camera.quaternion.clone();

      // Place player at the camera's current XZ, on the ground
      s.x = camera.position.x;
      s.z = camera.position.z;
      const ground = getGround(s.x, s.z);
      s.y = ground + EYE_HEIGHT;
      s.velocityY = 0;

      // Extract yaw from camera direction
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      s.yaw = Math.atan2(dir.x, dir.z);
      s.pitch = 0;

      console.log('[FPS] Walk mode ON — click canvas for mouse-look');
    }

    if (!active && s.wasActive) {
      // Restore camera
      if (s.savedCamPos) {
        camera.position.copy(s.savedCamPos);
        camera.quaternion.copy(s.savedCamRot);
      }
      console.log('[FPS] Walk mode OFF');
    }

    s.wasActive = active;
  }, [active, camera, getGround]);

  // ── Frame loop ────────────────────────────────────────────────
  useFrame(() => {
    if (!active) return;

    const s = state.current;
    const k = s.keys;

    // Clamp delta
    const dt = Math.min(0.05, 1 / 60); // fixed-ish step to keep physics stable

    // ── Mouse look ──────────────────────────────────────────────
    s.yaw   -= s.mouseDX * MOUSE_SENS_X;
    s.pitch -= s.mouseDY * MOUSE_SENS_Y;
    s.pitch  = THREE.MathUtils.clamp(s.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    s.mouseDX = 0;
    s.mouseDY = 0;

    // ── Movement input ──────────────────────────────────────────
    let moveX = 0;
    let moveZ = 0;

    if (k['KeyW'] || k['ArrowUp'])    moveZ -= 1;
    if (k['KeyS'] || k['ArrowDown'])  moveZ += 1;
    if (k['KeyA'] || k['ArrowLeft'])  moveX -= 1;
    if (k['KeyD'] || k['ArrowRight']) moveX += 1;

    // Normalize diagonal
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) { moveX /= len; moveZ /= len; }

    const sprint = k['ShiftLeft'] || k['ShiftRight'];
    const speed = (sprint ? SPRINT_SPEED : WALK_SPEED) * dt;

    // Forward/right vectors in XZ plane based on yaw
    const sinY = Math.sin(s.yaw);
    const cosY = Math.cos(s.yaw);

    // forward  = (sinY, 0, cosY)
    // right    = (cosY, 0, -sinY)
    s.x += (sinY * (-moveZ) + cosY * moveX) * speed;
    s.z += (cosY * (-moveZ) - sinY * moveX) * speed;

    // ── Clamp to world bounds (scene coords) ────────────────────
    const minScene = (-HALF + 100) / SCALE;
    const maxScene = (HALF - 100) / SCALE;
    s.x = THREE.MathUtils.clamp(s.x, minScene, maxScene);
    s.z = THREE.MathUtils.clamp(s.z, -maxScene, -minScene);

    // ── Gravity + jump ──────────────────────────────────────────
    const ground = getGround(s.x, s.z) + EYE_HEIGHT;

    s.velocityY += GRAVITY * dt;
    s.y += s.velocityY * dt;

    if (s.y <= ground) {
      s.y = ground;
      s.velocityY = 0;
      s.isGrounded = true;
    } else {
      s.isGrounded = false;
    }

    if (k['Space'] && s.isGrounded) {
      s.velocityY = JUMP_POWER;
    }

    // ── Apply to camera ─────────────────────────────────────────
    camera.position.set(s.x, s.y, s.z);

    // Build rotation from yaw + pitch (Euler YXZ order)
    const euler = new THREE.Euler(s.pitch, s.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  });

  // No visible geometry — it's first-person
  return null;
}
