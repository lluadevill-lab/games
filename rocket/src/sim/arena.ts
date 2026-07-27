/**
 * Geometria da arena como campo de distância (SDF).
 *
 * A arena do Rocket League não é uma caixa: os quatro cantos são CURVAS
 * amplas no plano XY, e a junção entre o piso/teto e as paredes também é
 * arredondada. É isso que permite entrar no canto em velocidade e sair
 * dirigindo pela parede sem uma quina que mate o momento.
 *
 * Representar tudo como um campo de distância (SDF) faz chão, parede, teto e
 * canto serem exatamente a mesma coisa para o motor — que é justamente o que
 * dá o "dirigir em qualquer superfície" do original.
 *
 * A silhueta em XY é um retângulo de cantos arredondados (raio CORNER_RADIUS),
 * e o perfil vertical arredonda contra piso e teto com raio WALL_FILLET.
 */
import { V3, v3, set, normalize } from "../core/vec";
import {
  FIELD_X,
  FIELD_Y,
  CEILING_Z,
  CORNER_RADIUS,
  GOAL_HALF_W,
  GOAL_H,
  GOAL_DEPTH,
  WALL_FILLET,
} from "./constants";

export interface Contact {
  depth: number; // profundidade de penetração (>0 = penetrando)
  n: V3; // normal apontando para dentro do campo
}

// buffers reaproveitados (sem alocação no hot path)
const _n = v3();

/**
 * Distância horizontal até a parede e a normal dessa parede (no plano XY).
 *
 * O contorno é um retângulo de cantos arredondados. Fora da região dos
 * cantos a distância é a da parede reta; dentro dela, a distância até o
 * arco de raio CORNER_RADIUS.
 *
 * Retorna a distância; escreve a normal (apontando para dentro) em nx/ny.
 */
let _wnx = 0;
let _wny = 0;

function wallDistanceXY(x: number, y: number): number {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const sx = x >= 0 ? 1 : -1;
  const sy = y >= 0 ? 1 : -1;

  // centro do arco do canto
  const cx = FIELD_X - CORNER_RADIUS;
  const cy = FIELD_Y - CORNER_RADIUS;

  if (ax > cx && ay > cy) {
    // ---- região do canto: distância ao arco
    const dx = ax - cx;
    const dy = ay - cy;
    const r = Math.hypot(dx, dy) || 1e-6;
    _wnx = (-sx * dx) / r;
    _wny = (-sy * dy) / r;
    return CORNER_RADIUS - r;
  }

  // ---- paredes retas: a mais próxima entre a lateral (X) e o fundo (Y)
  const dX = FIELD_X - ax;
  const dY = FIELD_Y - ay;
  if (dX < dY) {
    _wnx = -sx;
    _wny = 0;
    return dX;
  }
  _wnx = 0;
  _wny = -sy;
  return dY;
}

/**
 * Distância assinada até a superfície da arena.
 * Positivo = dentro do campo; a normal fica em `out`.
 */
export function arenaDistance(x: number, y: number, z: number, out?: V3): number {
  const n = out ?? _n;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const sy = y >= 0 ? 1 : -1;

  // ---------------------------------------------------------- baliza
  // Dentro da boca do gol o volume é uma caixa simples que avança GOAL_DEPTH.
  const inMouthXZ = ax < GOAL_HALF_W && z < GOAL_H;
  if (inMouthXZ && ay > FIELD_Y - 1) {
    let best = GOAL_HALF_W - ax;
    let bx = x >= 0 ? -1 : 1;
    let by = 0;
    let bz = 0;

    const dBack = FIELD_Y + GOAL_DEPTH - ay;
    if (dBack < best) {
      best = dBack;
      bx = 0;
      by = -sy;
      bz = 0;
    }
    if (z < best) {
      best = z;
      bx = 0;
      by = 0;
      bz = 1;
    }
    const dTop = GOAL_H - z;
    if (dTop < best) {
      best = dTop;
      bx = 0;
      by = 0;
      bz = -1;
    }
    set(n, bx, by, bz);
    return best;
  }

  // ---------------------------------------------------------- campo
  const dWall = wallDistanceXY(x, y);
  const wnx = _wnx;
  const wny = _wny;

  // Perto da boca do gol a parede do fundo "abre": não deve haver superfície
  // ali, senão a bola bate numa parede invisível na entrada da baliza.
  const nearMouth = inMouthXZ && ay > FIELD_Y - WALL_FILLET;

  const dFloor = z;
  const dCeil = CEILING_Z - z;

  // ---- arredondamento entre parede e piso/teto (quarto de toro)
  // Dentro da faixa de fillet a superfície é um arco no plano (parede, altura).
  if (!nearMouth && dWall < WALL_FILLET) {
    if (dFloor < WALL_FILLET) {
      const a = WALL_FILLET - dWall;
      const b = WALL_FILLET - dFloor;
      const r = Math.hypot(a, b) || 1e-6;
      if (r > 1e-6) {
        set(n, (wnx * a) / r, (wny * a) / r, b / r);
        normalize(n);
        return WALL_FILLET - r;
      }
    }
    if (dCeil < WALL_FILLET) {
      const a = WALL_FILLET - dWall;
      const b = WALL_FILLET - dCeil;
      const r = Math.hypot(a, b) || 1e-6;
      if (r > 1e-6) {
        set(n, (wnx * a) / r, (wny * a) / r, -b / r);
        normalize(n);
        return WALL_FILLET - r;
      }
    }
  }

  // ---- superfície mais próxima entre piso, teto e parede
  let best = dFloor;
  let bx = 0;
  let by = 0;
  let bz = 1;

  if (dCeil < best) {
    best = dCeil;
    bx = 0;
    by = 0;
    bz = -1;
  }
  if (!nearMouth && dWall < best) {
    best = dWall;
    bx = wnx;
    by = wny;
    bz = 0;
  }

  set(n, bx, by, bz);
  return best;
}

/** Colisão de uma esfera de raio `radius` centrada em `p`. */
export function pointContact(p: V3, radius: number, out: Contact): Contact | null {
  const d = arenaDistance(p.x, p.y, p.z, out.n);
  if (d >= radius) return null;
  out.depth = radius - d;
  return out;
}

/**
 * A bola cruzou a linha inteira?
 * Retorna +1 (gol na baliza +Y), -1 (baliza -Y) ou 0.
 */
export function ballInGoal(p: V3, radius: number): 0 | 1 | -1 {
  if (Math.abs(p.x) > GOAL_HALF_W) return 0;
  if (p.z > GOAL_H) return 0;
  if (p.y > FIELD_Y + radius) return 1;
  if (p.y < -FIELD_Y - radius) return -1;
  return 0;
}

/**
 * Contorno do campo em XY (para o renderer desenhar o mesmo formato que a
 * física usa). `segsPerCorner` controla quantos segmentos aproximam cada arco.
 */
export function fieldOutline(segsPerCorner = 12): [number, number][] {
  const pts: [number, number][] = [];
  const cx = FIELD_X - CORNER_RADIUS;
  const cy = FIELD_Y - CORNER_RADIUS;
  // quatro cantos, sentido anti-horário a partir de (+X, +Y)
  const corners: [number, number, number][] = [
    [cx, cy, 0], // +X +Y  -> ângulos 0..90
    [-cx, cy, 90],
    [-cx, -cy, 180],
    [cx, -cy, 270],
  ];
  for (const [ox, oy, a0] of corners) {
    for (let i = 0; i <= segsPerCorner; i++) {
      const a = ((a0 + (i / segsPerCorner) * 90) * Math.PI) / 180;
      pts.push([ox + Math.cos(a) * CORNER_RADIUS, oy + Math.sin(a) * CORNER_RADIUS]);
    }
  }
  pts.push(pts[0]);
  return pts;
}
