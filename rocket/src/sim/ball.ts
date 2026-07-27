/**
 * Física da bola e colisão carro × bola (incluindo o impulso extra "Psyonix",
 * que é o que faz o toque responder à parte do carro que acertou — ver
 * MECANICAS.md seção 6).
 */
import {
  V3,
  v3,
  set,
  copy,
  dot,
  cross,
  len,
  normalize,
  clampLen,
  scale,
  addScaled,
  qRotate,
  qRotateInv,
  forwardOf,
  upOf,
} from "../core/vec";
import { clamp, curveLookup } from "../core/mathx";
import * as K from "./constants";
import { arenaDistance } from "./arena";
import type { Ball, Car, SimEvent } from "./types";

const n = v3();
const rel = v3();
const tmp = v3();
const tmp2 = v3();
const localP = v3();
const closest = v3();
const worldClosest = v3();
const contactVel = v3();
const fwd = v3();
const up = v3();

export function makeBall(): Ball {
  return { pos: v3(0, 0, K.BALL_RADIUS), vel: v3(), ang: v3() };
}

export function stepBall(ball: Ball, dt: number): void {
  // gravidade + arrasto linear (não quadrático)
  ball.vel.z -= K.GRAVITY * dt;
  const drag = 1 - K.BALL_DRAG * dt;
  scale(ball.vel, drag);
  clampLen(ball.vel, K.BALL_MAX_SPEED);
  clampLen(ball.ang, K.BALL_MAX_ANG);
  addScaled(ball.pos, ball.vel, dt);
}

/** Colisão bola × arena com restituição e atrito (spin ↔ translação). */
export function resolveBallArena(ball: Ball, events: SimEvent[]): void {
  const d = arenaDistance(ball.pos.x, ball.pos.y, ball.pos.z, n);
  if (d >= K.BALL_RADIUS) return;

  const pen = K.BALL_RADIUS - d;
  addScaled(ball.pos, n, pen);

  const vn = dot(ball.vel, n);
  if (vn >= 0) return;

  const impactSpeed = -vn;

  // ---- componente normal (quique)
  addScaled(ball.vel, n, -vn * (1 + K.BALL_RESTITUTION));

  // ---- componente tangencial com spin
  // velocidade do ponto de contato = v + ω × (-R n)
  scale(copy(tmp, n), -K.BALL_RADIUS);
  cross(tmp2, ball.ang, tmp);
  set(contactVel, ball.vel.x + tmp2.x, ball.vel.y + tmp2.y, ball.vel.z + tmp2.z);
  // remove a parte normal → só o deslizamento
  addScaled(contactVel, n, -dot(contactVel, n));

  const slip = len(contactVel);
  if (slip > 1e-4) {
    normalize(copy(tmp, contactVel));
    // impulso de atrito (esfera sólida: fator 2/5 na inércia)
    const j = Math.min(K.BALL_FRICTION * impactSpeed * 2, slip) * 0.4;
    addScaled(ball.vel, tmp, -j);
    // torque: Δω = (r × J) / I,  I = 2/5 m R²
    scale(copy(tmp2, tmp), -j);
    scale(copy(tmp, n), -K.BALL_RADIUS);
    cross(rel, tmp, tmp2);
    addScaled(ball.ang, rel, 2.5 / K.BALL_RADIUS);
    clampLen(ball.ang, K.BALL_MAX_ANG);
  }

  if (impactSpeed > 150) {
    events.push({ type: "bounce", speed: impactSpeed, pos: { ...ball.pos } });
  }
}

/**
 * Colisão carro × bola.
 * 1) colisão rígida esfera × OBB com massas 30/180
 * 2) impulso extra na direção (bola − carro), Z comprimido e frente amplificada
 */
export function resolveCarBall(car: Car, ball: Ball, events: SimEvent[]): boolean {
  if (car.demoTimer > 0) return false;

  // posição da bola no espaço local do carro
  set(tmp, ball.pos.x - car.pos.x, ball.pos.y - car.pos.y, ball.pos.z - car.pos.z);
  const distSq = tmp.x * tmp.x + tmp.y * tmp.y + tmp.z * tmp.z;
  const reach = K.BALL_RADIUS + K.HITBOX_L; // teste grosso
  if (distSq > reach * reach) return false;

  qRotateInv(localP, car.rot, tmp);
  localP.z -= K.HITBOX_OFFSET_Z;

  const hx = K.HITBOX_L / 2,
    hy = K.HITBOX_W / 2,
    hz = K.HITBOX_H / 2;
  set(
    closest,
    clamp(localP.x, -hx, hx),
    clamp(localP.y, -hy, hy),
    clamp(localP.z, -hz, hz),
  );

  set(tmp2, localP.x - closest.x, localP.y - closest.y, localP.z - closest.z);
  const dist = len(tmp2);
  if (dist >= K.BALL_RADIUS) return false;

  // normal de contato (do carro para a bola), no mundo
  if (dist > 1e-5) {
    scale(tmp2, 1 / dist);
  } else {
    set(tmp2, 0, 0, 1);
  }
  closest.z += K.HITBOX_OFFSET_Z;
  qRotate(n, car.rot, tmp2);
  qRotate(worldClosest, car.rot, closest);
  worldClosest.x += car.pos.x;
  worldClosest.y += car.pos.y;
  worldClosest.z += car.pos.z;

  // depenetração
  const pen = K.BALL_RADIUS - dist;
  addScaled(ball.pos, n, pen);

  // ---- velocidade relativa no ponto de contato
  set(rel, worldClosest.x - car.pos.x, worldClosest.y - car.pos.y, worldClosest.z - car.pos.z);
  cross(tmp, car.ang, rel);
  set(contactVel, car.vel.x + tmp.x, car.vel.y + tmp.y, car.vel.z + tmp.z);
  set(rel, ball.vel.x - contactVel.x, ball.vel.y - contactVel.y, ball.vel.z - contactVel.z);
  const relSpeed = len(rel);
  const vn = dot(rel, n);

  // ---- 1) impulso rígido
  // Restituição ~0: no RL o contato carro-bola é praticamente inelástico.
  // Quem dá "vida" ao toque é o impulso extra da etapa 2. Com restituição
  // alta aqui a bola sobe demais em qualquer toque rasteiro.
  if (vn < 0) {
    const invMb = 1 / K.BALL_MASS;
    const invMc = 1 / K.CAR_MASS;
    const jr = (-(1 + K.CAR_BALL_RESTITUTION) * vn) / (invMb + invMc);
    addScaled(ball.vel, n, jr * invMb);
    addScaled(car.vel, n, -jr * invMc);

    // atrito tangencial → dá spin à bola (base do dribble)
    addScaled(copy(tmp, rel), n, -vn);
    const tanSpeed = len(tmp);
    if (tanSpeed > 1e-4) {
      normalize(tmp);
      const jt = Math.min(0.35 * Math.abs(jr), tanSpeed * K.BALL_MASS * 0.4);
      addScaled(ball.vel, tmp, (-jt * invMb) * 0.5);
      set(tmp2, worldClosest.x - ball.pos.x, worldClosest.y - ball.pos.y, worldClosest.z - ball.pos.z);
      scale(copy(closest, tmp), -jt);
      cross(rel, tmp2, closest);
      addScaled(ball.ang, rel, 2.5 / (K.BALL_MASS * K.BALL_RADIUS * K.BALL_RADIUS));
      clampLen(ball.ang, K.BALL_MAX_ANG);
    }
  }

  // ---- 2) impulso extra "Psyonix": direção carro → bola, Z comprimido
  // Normaliza ANTES de comprimir: senão um contato alto (bola sobre o capô)
  // gera um vetor gigante em Z e a bola dispara para cima.
  set(tmp, ball.pos.x - car.pos.x, ball.pos.y - car.pos.y, ball.pos.z - car.pos.z);
  normalize(tmp);
  forwardOf(fwd, car.rot);
  tmp.z *= K.IMPULSE_Z_SCALE;
  const along = dot(tmp, fwd);
  addScaled(tmp, fwd, along * K.IMPULSE_FWD_SCALE);
  normalize(tmp);

  const relClamped = Math.min(relSpeed, K.IMPULSE_MAX_REL);
  const scaleFactor = curveLookup(K.IMPULSE_CURVE, relClamped);
  const extra = relClamped * scaleFactor;
  if (vn < 0) addScaled(ball.vel, tmp, extra * 0.55);

  clampLen(ball.vel, K.BALL_MAX_SPEED);

  const hitSpeed = len(ball.vel);
  if (car.hitBallTimer <= 0) {
    events.push({ type: "ballHit", carId: car.id, speed: hitSpeed, pos: { ...ball.pos } });
  }
  car.hitBallTimer = 0.08;
  car.lastImpactSpeed = hitSpeed;
  return true;
}

/** Colisão carro × carro, com demolição se algum estiver supersônico. */
export function resolveCarCar(a: Car, b: Car, events: SimEvent[]): void {
  if (a.demoTimer > 0 || b.demoTimer > 0) return;
  set(tmp, b.pos.x - a.pos.x, b.pos.y - a.pos.y, b.pos.z - a.pos.z);
  const d = len(tmp);
  const minD = K.HITBOX_L * 0.72;
  if (d > minD || d < 1e-5) return;

  // demolição: supersônico e times diferentes
  if (a.team !== b.team) {
    if (a.supersonic) {
      b.demoTimer = K.DEMO_RESPAWN;
      events.push({ type: "demo", carId: b.id, byId: a.id });
      return;
    }
    if (b.supersonic) {
      a.demoTimer = K.DEMO_RESPAWN;
      events.push({ type: "demo", carId: a.id, byId: b.id });
      return;
    }
  }

  scale(tmp, 1 / d);
  const overlap = minD - d;
  addScaled(a.pos, tmp, -overlap * 0.5);
  addScaled(b.pos, tmp, overlap * 0.5);

  set(rel, b.vel.x - a.vel.x, b.vel.y - a.vel.y, b.vel.z - a.vel.z);
  const vn = dot(rel, tmp);
  if (vn < 0) {
    const j = -vn * 0.5;
    addScaled(a.vel, tmp, -j);
    addScaled(b.vel, tmp, j);
  }
}
