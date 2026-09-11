export const degToRad = (deg: number): number => (deg * Math.PI) / 180;
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Interpolates between two angles (radians) via the shortest path, so e.g.
 * lerpAngle(-3.13, 3.13, 0.5) goes through π (the short way round) instead of
 * sweeping the long way through 0.
 */
export const lerpAngle = (a: number, b: number, t: number): number => {
  const twoPi = Math.PI * 2;
  let diff = (b - a) % twoPi;
  if (diff > Math.PI) diff -= twoPi;
  if (diff < -Math.PI) diff += twoPi;
  return a + diff * t;
};

/**
 * Returns an angle equivalent to `to` (i.e. `to + n·2π` for some integer n)
 * that is as close as possible to `from`. Use this before feeding a sequence
 * of absolute target rotations into GSAP tweens one after another — GSAP
 * interpolates raw numbers linearly, so without this, going from e.g. 3.13
 * rad to -3.13 rad would spin the LONG way around through 0 instead of the
 * short way through π, which reads as the camera doing a wild spin (and can
 * momentarily point it away from the subject entirely).
 */
export const unwrapAngleTowards = (from: number, to: number): number => {
  const twoPi = Math.PI * 2;
  let diff = (to - from) % twoPi;
  if (diff > Math.PI) diff -= twoPi;
  if (diff < -Math.PI) diff += twoPi;
  return from + diff;
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Yaw/pitch (no roll) Euler rotation, in radians, that points a camera at
 * `position` toward `target` — matches Spline/three.js's convention (Y-up,
 * default forward -Z, Euler order XYZ). Verified by direct derivation, not a
 * guess: yaw = atan2(-dx, -dz), pitch = atan2(dy, hypot(dx, dz)), roll = 0.
 */
export const lookAtEuler = (position: Vec3, target: Vec3): Vec3 => {
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const dz = target.z - position.z;
  const distXZ = Math.hypot(dx, dz);
  return {
    x: Math.atan2(dy, distXZ), // pitch — negative looks down, positive looks up
    y: Math.atan2(-dx, -dz), // yaw
    z: 0,
  };
};

/**
 * The forward direction (unit vector) a camera faces given its yaw/pitch —
 * the exact inverse of `lookAtEuler`. Used to dolly a camera closer to its
 * subject while keeping its rotation completely untouched: move `distance`
 * units along this vector from the camera's current position, and it's
 * still looking exactly the same direction, just closer.
 */
export const forwardFromEuler = (rotation: Vec3): Vec3 => {
  const cosPitch = Math.cos(rotation.x);
  return {
    x: -Math.sin(rotation.y) * cosPitch,
    y: Math.sin(rotation.x),
    z: -Math.cos(rotation.y) * cosPitch,
  };
};

export const vecSub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const vecAdd = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const vecScale = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
export const vecMidpoint = (a: Vec3, b: Vec3): Vec3 => vecScale(vecAdd(a, b), 0.5);
export const vecLength = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
export const vecNormalize = (v: Vec3): Vec3 => vecScale(v, 1 / (vecLength(v) || 1));
export const vecCross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export interface Pose {
  position: Vec3;
  rotation: Vec3;
}

/** Blends two poses — position linearly, rotation via the shortest-path angle lerp. */
export const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({
  position: {
    x: lerp(a.position.x, b.position.x, t),
    y: lerp(a.position.y, b.position.y, t),
    z: lerp(a.position.z, b.position.z, t),
  },
  rotation: {
    x: lerpAngle(a.rotation.x, b.rotation.x, t),
    y: lerpAngle(a.rotation.y, b.rotation.y, t),
    z: lerpAngle(a.rotation.z, b.rotation.z, t),
  },
});
