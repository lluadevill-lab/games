/**
 * Predição da trajetória da bola — a mesma ideia da linha de mira do jogo.
 * Roda uma cópia barata da física da bola (gravidade + arrasto + quiques).
 */
import { v3, set, copy, addScaled, scale, dot, clampLen, normalize, cross, len, V3 } from "../core/vec";
import * as K from "./constants";
import { arenaDistance, ballInGoal } from "./arena";
import type { Ball } from "./types";

export interface PredSlice {
  pos: V3;
  vel: V3;
  t: number;
}

const n = v3();

/**
 * @param steps número de amostras
 * @param dt intervalo entre amostras (subdividido internamente)
 */
export function predictBall(ball: Ball, steps = 90, dt = 1 / 30): PredSlice[] {
  const out: PredSlice[] = [];
  const p = v3(ball.pos.x, ball.pos.y, ball.pos.z);
  const v = v3(ball.vel.x, ball.vel.y, ball.vel.z);
  const sub = 4;
  const h = dt / sub;

  for (let i = 0; i < steps; i++) {
    for (let s = 0; s < sub; s++) {
      v.z -= K.GRAVITY * h;
      scale(v, 1 - K.BALL_DRAG * h);
      clampLen(v, K.BALL_MAX_SPEED);
      addScaled(p, v, h);

      const d = arenaDistance(p.x, p.y, p.z, n);
      if (d < K.BALL_RADIUS) {
        addScaled(p, n, K.BALL_RADIUS - d);
        const vn = dot(v, n);
        if (vn < 0) {
          addScaled(v, n, -vn * (1 + K.BALL_RESTITUTION));
          // atrito tangencial simplificado
          const tx = v.x - n.x * dot(v, n);
          const ty = v.y - n.y * dot(v, n);
          const tz = v.z - n.z * dot(v, n);
          v.x -= tx * 0.08;
          v.y -= ty * 0.08;
          v.z -= tz * 0.08;
        }
      }
    }
    out.push({ pos: { x: p.x, y: p.y, z: p.z }, vel: { x: v.x, y: v.y, z: v.z }, t: (i + 1) * dt });
    if (ballInGoal(p, K.BALL_RADIUS) !== 0) break;
  }
  return out;
}

/**
 * Primeiro instante em que a bola fica abaixo de uma certa altura
 * (útil para o bot decidir onde interceptar).
 */
export function findGroundTouch(pred: PredSlice[], maxZ = 200): PredSlice | null {
  for (const s of pred) if (s.pos.z <= maxZ) return s;
  return null;
}
