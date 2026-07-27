/**
 * Geometria da arena como campo de distância (SDF).
 *
 * A arena é uma caixa com cantos chanfrados a 45°, arredondamento entre
 * chão/teto e paredes, e duas bocas de gol. Representar tudo como SDF é o que
 * permite tratar chão, parede, teto e canto exatamente igual — que é
 * justamente o que dá o "dirigir na parede" do jogo original.
 */
import { V3, v3, set, normalize } from "../core/vec";
import {
  FIELD_X,
  FIELD_Y,
  CEILING_Z,
  CORNER_D,
  GOAL_HALF_W,
  GOAL_H,
  GOAL_DEPTH,
  WALL_FILLET,
} from "./constants";

export interface Contact {
  depth: number; // profundidade de penetração (>0 = penetrando)
  n: V3; // normal apontando para dentro do campo
}

const SQ = Math.SQRT1_2;

// buffers reaproveitados (sem alocação no hot path)
const _n = v3();
let _bestD = 0;
let _bnx = 0,
  _bny = 0,
  _bnz = 0;

function consider(d: number, nx: number, ny: number, nz: number): void {
  if (d < _bestD) {
    _bestD = d;
    _bnx = nx;
    _bny = ny;
    _bnz = nz;
  }
}

/**
 * Distância assinada até a superfície da arena.
 * Positivo = dentro do campo; a normal fica em `out`.
 */
export function arenaDistance(x: number, y: number, z: number, out?: V3): number {
  const n = out ?? _n;
  _bestD = Infinity;
  _bnx = 0;
  _bny = 0;
  _bnz = 1;

  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const sx = x >= 0 ? 1 : -1;
  const sy = y >= 0 ? 1 : -1;

  const insideMouth = ax < GOAL_HALF_W && z < GOAL_H && ay > FIELD_Y - WALL_FILLET;

  // ---- paredes candidatas: [distância, normal]
  const wallX = FIELD_X - ax;
  const wallDiag = (CORNER_D - (ax + ay)) * SQ;
  const wallY = (insideMouth ? FIELD_Y + GOAL_DEPTH : FIELD_Y) - ay;

  // ---- chão e teto (com arredondamento contra a parede mais próxima)
  // parede lateral mais próxima entre X e diagonal
  let dw = wallX,
    wnx = -sx,
    wny = 0;
  if (wallDiag < dw) {
    dw = wallDiag;
    wnx = -sx * SQ;
    wny = -sy * SQ;
  }
  if (!insideMouth && wallY < dw) {
    dw = wallY;
    wnx = 0;
    wny = -sy;
  }

  // chão: se perto de uma parede, a superfície vira um quarto de cilindro
  if (dw < WALL_FILLET && z < WALL_FILLET) {
    const cx = WALL_FILLET - dw;
    const cz = WALL_FILLET - z;
    const r = Math.hypot(cx, cz) || 1e-6;
    consider(WALL_FILLET - r, (wnx * cx) / r, (wny * cx) / r, cz / r);
  } else {
    consider(z, 0, 0, 1);
  }

  // teto: idem
  const zt = CEILING_Z - z;
  if (dw < WALL_FILLET && zt < WALL_FILLET) {
    const cx = WALL_FILLET - dw;
    const cz = WALL_FILLET - zt;
    const r = Math.hypot(cx, cz) || 1e-6;
    consider(WALL_FILLET - r, (wnx * cx) / r, (wny * cx) / r, -cz / r);
  } else {
    consider(zt, 0, 0, -1);
  }

  // paredes planas (fora da faixa de fillet elas já dominam sozinhas)
  consider(wallX, -sx, 0, 0);
  consider(wallDiag, -sx * SQ, -sy * SQ, 0);
  consider(wallY, 0, -sy, 0);

  // interior do gol: laterais e travessão
  if (insideMouth) {
    consider(GOAL_HALF_W - ax, -sx, 0, 0);
    if (ay > FIELD_Y) consider(GOAL_H - z, 0, 0, -1);
  } else if (ay > FIELD_Y - WALL_FILLET) {
    // postes e travessão vistos de fora (caixa sólida ao redor da boca)
    // trata o contorno da boca como parede normal — já coberto por wallY
  }

  set(n, _bnx, _bny, _bnz);
  normalize(n);
  return _bestD;
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
