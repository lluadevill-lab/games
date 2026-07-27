// Vetores 3D e quaternions mutáveis, sem alocação nos hot paths.

export interface V3 {
  x: number;
  y: number;
  z: number;
}
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
export const quat = (x = 0, y = 0, z = 0, w = 1): Quat => ({ x, y, z, w });

export const set = (a: V3, x: number, y: number, z: number): V3 => {
  a.x = x;
  a.y = y;
  a.z = z;
  return a;
};
export const copy = (a: V3, b: V3): V3 => set(a, b.x, b.y, b.z);
export const add = (a: V3, b: V3): V3 => set(a, a.x + b.x, a.y + b.y, a.z + b.z);
export const addScaled = (a: V3, b: V3, s: number): V3 =>
  set(a, a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
export const sub = (a: V3, b: V3): V3 => set(a, a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: V3, s: number): V3 => set(a, a.x * s, a.y * s, a.z * s);
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);
export const len2 = (a: V3): number => a.x * a.x + a.y * a.y + a.z * a.z;

export const cross = (out: V3, a: V3, b: V3): V3 =>
  set(out, a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export function normalize(a: V3): V3 {
  const l = len(a);
  return l > 1e-9 ? scale(a, 1 / l) : a;
}

export function clampLen(a: V3, max: number): V3 {
  const l = len(a);
  if (l > max && l > 1e-9) scale(a, max / l);
  return a;
}

export const subVec = (out: V3, a: V3, b: V3): V3 => set(out, a.x - b.x, a.y - b.y, a.z - b.z);
export const addVec = (out: V3, a: V3, b: V3): V3 => set(out, a.x + b.x, a.y + b.y, a.z + b.z);
export const scaleVec = (out: V3, a: V3, s: number): V3 => set(out, a.x * s, a.y * s, a.z * s);

// ------------------------------------------------------------------ quaternions

export function qNormalize(q: Quat): Quat {
  const l = Math.hypot(q.x, q.y, q.z, q.w);
  if (l > 1e-9) {
    q.x /= l;
    q.y /= l;
    q.z /= l;
    q.w /= l;
  }
  return q;
}

/** Rotaciona o vetor v pelo quaternion q, escrevendo em out. */
export function qRotate(out: V3, q: Quat, v: V3): V3 {
  const { x, y, z, w } = q;
  // t = 2 * (q_vec x v)
  const tx = 2 * (y * v.z - z * v.y);
  const ty = 2 * (z * v.x - x * v.z);
  const tz = 2 * (x * v.y - y * v.x);
  return set(
    out,
    v.x + w * tx + (y * tz - z * ty),
    v.y + w * ty + (z * tx - x * tz),
    v.z + w * tz + (x * ty - y * tx),
  );
}

/** Rotação inversa (q é unitário). */
export function qRotateInv(out: V3, q: Quat, v: V3): V3 {
  const inv = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  return qRotate(out, inv, v);
}

export function qMul(out: Quat, a: Quat, b: Quat): Quat {
  const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y;
  const y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
  const z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w;
  const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
  out.x = x;
  out.y = y;
  out.z = z;
  out.w = w;
  return out;
}

/** Integra o quaternion com velocidade angular (rad/s) no mundo, por dt. */
const _dq: Quat = { x: 0, y: 0, z: 0, w: 0 };
export function qIntegrate(q: Quat, omega: V3, dt: number): Quat {
  _dq.x = omega.x * dt * 0.5;
  _dq.y = omega.y * dt * 0.5;
  _dq.z = omega.z * dt * 0.5;
  _dq.w = 0;
  const x = q.x + (_dq.w * q.x + _dq.x * q.w + _dq.y * q.z - _dq.z * q.y);
  const y = q.y + (_dq.w * q.y - _dq.x * q.z + _dq.y * q.w + _dq.z * q.x);
  const z = q.z + (_dq.w * q.z + _dq.x * q.y - _dq.y * q.x + _dq.z * q.w);
  const w = q.w + (_dq.w * q.w - _dq.x * q.x - _dq.y * q.y - _dq.z * q.z);
  q.x = x;
  q.y = y;
  q.z = z;
  q.w = w;
  return qNormalize(q);
}

export function qFromAxisAngle(out: Quat, axis: V3, angle: number): Quat {
  const h = angle * 0.5;
  const s = Math.sin(h);
  const l = len(axis) || 1;
  out.x = (axis.x / l) * s;
  out.y = (axis.y / l) * s;
  out.z = (axis.z / l) * s;
  out.w = Math.cos(h);
  return out;
}

/** Quaternion a partir de yaw (Z), pitch (Y), roll (X) — ordem RL. */
export function qFromEuler(out: Quat, yaw: number, pitch: number, roll: number): Quat {
  const cy = Math.cos(yaw * 0.5),
    sy = Math.sin(yaw * 0.5);
  const cp = Math.cos(pitch * 0.5),
    sp = Math.sin(pitch * 0.5);
  const cr = Math.cos(roll * 0.5),
    sr = Math.sin(roll * 0.5);
  out.w = cr * cp * cy + sr * sp * sy;
  out.x = sr * cp * cy - cr * sp * sy;
  out.y = cr * sp * cy + sr * cp * sy;
  out.z = cr * cp * sy - sr * sp * cy;
  return qNormalize(out);
}

export const qCopy = (a: Quat, b: Quat): Quat => {
  a.x = b.x;
  a.y = b.y;
  a.z = b.z;
  a.w = b.w;
  return a;
};

/** Eixos locais do corpo no espaço do mundo. */
const _ex: V3 = v3(1, 0, 0);
const _ey: V3 = v3(0, 1, 0);
const _ez: V3 = v3(0, 0, 1);
export const forwardOf = (out: V3, q: Quat): V3 => qRotate(out, q, _ex);
export const rightOf = (out: V3, q: Quat): V3 => qRotate(out, q, _ey);
export const upOf = (out: V3, q: Quat): V3 => qRotate(out, q, _ez);
