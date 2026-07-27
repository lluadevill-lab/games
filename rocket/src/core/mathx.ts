// Utilitários matemáticos usados pela simulação.

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const sign1 = (v: number): number => (v < 0 ? -1 : 1);

/** Interpolação exponencial independente de framerate. */
export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Curva linear por partes, definida por pontos [x, y] em x crescente. */
export function curveLookup(pts: readonly (readonly [number, number])[], x: number): number {
  if (x <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (x <= x1) {
      const [x0, y0] = pts[i - 1];
      const t = (x - x0) / (x1 - x0 || 1);
      return y0 + (y1 - y0) * t;
    }
  }
  return last[1];
}

// Nada de Math.random() aqui: a simulação usa o RNG semeado em core/rng.ts
// para permanecer determinística (replays, netcode e testes reprodutíveis).

/** Zona morta para eixos analógicos. */
export function deadzone(v: number, dz = 0.15): number {
  if (Math.abs(v) < dz) return 0;
  return sign1(v) * ((Math.abs(v) - dz) / (1 - dz));
}
