/**
 * Física do carro: suspensão, dirigibilidade no chão, controle aéreo,
 * pulo, double jump e flips. Ver MECANICAS.md seções 4 e 5.
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
  qIntegrate,
  qFromAxisAngle,
  qMul,
  forwardOf,
  rightOf,
  upOf,
  quat,
} from "../core/vec";
import { clamp, curveLookup, sign1 } from "../core/mathx";
import * as K from "./constants";
import { arenaDistance } from "./arena";
import type { Car, CarInput, SimEvent } from "./types";

// buffers
const fwd = v3();
const right = v3();
const up = v3();
const tmp = v3();
const tmp2 = v3();
const contactN = v3();
const wheelPos = v3();
const wheelVel = v3();
const wheelImpulse = v3();
const lever = v3();
const localWheel = v3();
const _q = quat();

/** Posições locais das 4 rodas. */
const WHEELS: readonly [number, number][] = [
  [K.WHEEL_FRONT_X, K.WHEEL_Y],
  [K.WHEEL_FRONT_X, -K.WHEEL_Y],
  [K.WHEEL_REAR_X, K.WHEEL_Y],
  [K.WHEEL_REAR_X, -K.WHEEL_Y],
];

/**
 * Amostra as 4 rodas contra o SDF da arena.
 * Define car.onGround e car.groundNormal (média das normais em contato).
 */
export function sampleSuspension(car: Car): number {
  // Limpa a telemetria visual/física a cada amostra.
  for (let i = 0; i < 4; i++) {
    car.wheelCompression[i] = 0;
    car.wheelContact[i] = false;
  }

  if (car.groundSuppress > 0) {
    car.onGround = false;
    return Infinity;
  }

  let contacts = 0;
  let compressedContacts = 0;
  let nx = 0,
    ny = 0,
    nz = 0;
  let minDist = Infinity;

  for (let i = 0; i < WHEELS.length; i++) {
    const [lx, ly] = WHEELS[i];
    set(localWheel, lx, ly, K.WHEEL_Z);
    qRotate(wheelPos, car.rot, localWheel);
    wheelPos.x += car.pos.x;
    wheelPos.y += car.pos.y;
    wheelPos.z += car.pos.z;
    const d = arenaDistance(wheelPos.x, wheelPos.y, wheelPos.z, contactN);
    if (d < minDist) minDist = d;

    if (d < K.WHEEL_RADIUS + K.SUSPENSION_TRAVEL) {
      contacts++;
      nx += contactN.x;
      ny += contactN.y;
      nz += contactN.z;
      car.wheelContact[i] = true;
      // 0 = roda só encostando; 1 = suspensão bem comprimida.
      car.wheelCompression[i] = clamp((K.WHEEL_RADIUS - d) / K.SUSPENSION_TRAVEL, 0, 1);
      if (d < K.WHEEL_RADIUS + K.SUSPENSION_TRAVEL * 0.7) compressedContacts++;
    }
  }

  if (contacts > 0) {
    set(car.groundNormal, nx / contacts, ny / contacts, nz / contacts);
    normalize(car.groundNormal);
  }
  // Precisa de 3 rodas apoiadas E a suspensão razoavelmente comprimida.
  // Com as rodas quase estendidas o carro já está "no ar" para o gameplay.
  car.onGround = contacts >= 3 && compressedContacts >= 3;
  return minDist;
}

/**
 * Suspensão: mola + amortecedor.
 *
 * Cuidado clássico: NÃO aplique a mola e zere a velocidade normal ao mesmo
 * tempo — isso conta o impacto duas vezes e o carro sai quicando pelo campo.
 * Aqui a mola devolve no máximo a velocidade necessária para assentar.
 */
function applySuspension(car: Car, _minDist: number, dt: number): void {
  if (car.groundSuppress > 0) return;

  // Modelo por roda: cada contato mede a velocidade no ponto da roda
  // (velocidade linear + angular), aplica mola/amortecedor na normal e
  // transforma parte do impulso em torque. É bem mais estável/legível que
  // uma correção única pelo menor ponto da hitbox e dá sensação de mola real.
  for (let i = 0; i < WHEELS.length; i++) {
    if (!car.wheelContact[i]) continue;
    const [lx, ly] = WHEELS[i];
    set(localWheel, lx, ly, K.WHEEL_Z);
    qRotate(lever, car.rot, localWheel);
    set(wheelPos, car.pos.x + lever.x, car.pos.y + lever.y, car.pos.z + lever.z);
    const d = arenaDistance(wheelPos.x, wheelPos.y, wheelPos.z, contactN);
    if (d >= K.WHEEL_RADIUS) continue;

    // velocidade do ponto: v + ω × r
    cross(wheelVel, car.ang, lever);
    wheelVel.x += car.vel.x;
    wheelVel.y += car.vel.y;
    wheelVel.z += car.vel.z;

    const compression = K.WHEEL_RADIUS - d;
    const vn = dot(wheelVel, contactN);
    const targetVn = clamp(compression * K.SUSPENSION_STIFFNESS, 0, 160);
    const dv = (targetVn - vn * K.SUSPENSION_DAMPING) * 0.25;
    const push = clamp(dv, 0, K.SUSPENSION_MAX_PUSH * dt);
    if (push <= 0) continue;

    copy(wheelImpulse, contactN);
    scale(wheelImpulse, push);
    addScaled(car.vel, wheelImpulse, 1);

    // Torque aproximado pela alavanca da roda. O fator pequeno substitui uma
    // matriz de inércia completa e evita quicar/virar o carro em PCs fracos.
    cross(tmp2, lever, wheelImpulse);
    addScaled(car.ang, tmp2, K.SUSPENSION_TORQUE_RESPONSE);
  }

  // sticky force: só perto da superfície. É o que permite parede e teto.
  if (car.onGround) {
    addScaled(car.vel, car.groundNormal, -K.STICKY_ACCEL * dt);
  }
}

/** Alinha o carro à superfície onde está apoiado (torque de "assentar"). */
function alignToSurface(car: Car, dt: number): void {
  upOf(up, car.rot);
  const n = car.groundNormal;
  cross(tmp, up, n); // eixo de rotação
  const s = len(tmp);
  if (s < 1e-5) return;
  const angle = Math.asin(clamp(s, -1, 1));
  scale(tmp, (1 / s) * Math.min(angle * 25, 25) );
  // aplica como velocidade angular direta (o chão manda no carro)
  car.ang.x += (tmp.x - dot(car.ang, n) * 0) * dt * 12;
  car.ang.y += tmp.y * dt * 12;
  car.ang.z += tmp.z * dt * 12;
}

/** Dinâmica no chão: throttle, freio, esterço e aderência lateral. */
function groundDrive(car: Car, inp: CarInput, dt: number): void {
  forwardOf(fwd, car.rot);
  rightOf(right, car.rot);
  const n = car.groundNormal;

  // projeta os eixos no plano da superfície
  addScaled(fwd, n, -dot(fwd, n));
  normalize(fwd);
  addScaled(right, n, -dot(right, n));
  normalize(right);

  const vFwd = dot(car.vel, fwd);
  const vRight = dot(car.vel, right);
  const speed = len(car.vel);

  // ---- throttle / freio / coast
  const t = inp.throttle;
  if (Math.abs(t) > 0.01) {
    if (vFwd * t < -10) {
      // input contrário ao movimento = freio
      addScaled(car.vel, fwd, sign1(t) * K.BRAKE_ACCEL * dt);
    } else {
      const accel = curveLookup(K.THROTTLE_CURVE, Math.abs(vFwd)) * t;
      addScaled(car.vel, fwd, accel * dt);
    }
  } else if (Math.abs(vFwd) > 1) {
    // coast
    const dec = Math.min(K.COAST_DECEL * dt, Math.abs(vFwd));
    addScaled(car.vel, fwd, -sign1(vFwd) * dec);
  }

  // ---- esterço: taxa de guinada = curvatura(v) * v
  // Sinal: a rotação é em torno da normal (que aponta para CIMA) e, num
  // sistema destro, giro positivo é anti-horário = para a ESQUERDA.
  // Como steer = +1 significa direita, entra o sinal negativo.
  const steer = clamp(inp.steer, -1, 1);
  if (Math.abs(steer) > 0.01) {
    const curvature = curveLookup(K.STEER_CURVE, Math.min(speed, 2300));
    let yawRate = -curvature * Math.max(speed, 10) * steer * sign1(vFwd || 1);
    if (inp.handbrake) yawRate *= 1.6; // powerslide gira mais o nariz
    addScaled(car.ang, n, yawRate - dot(car.ang, n));
  } else {
    // sem input o carro para de girar em torno da normal
    addScaled(car.ang, n, -dot(car.ang, n) * Math.min(1, dt * 12));
  }

  // ---- aderência lateral (powerslide reduz)
  const grip = inp.handbrake ? K.LATERAL_GRIP_SLIDE : K.LATERAL_GRIP;
  const maxLat = grip * dt;
  const corr = clamp(-vRight, -maxLat, maxLat);
  addScaled(car.vel, right, corr);
}

/** Controle aéreo: torques de pitch/yaw/roll com amortecimento. */
function airControl(car: Car, inp: CarInput, dt: number): void {
  forwardOf(fwd, car.rot);
  rightOf(right, car.rot);
  upOf(up, car.rot);

  // velocidade angular no espaço local
  const wx = dot(car.ang, fwd); // roll
  const wy = dot(car.ang, right); // pitch
  const wz = dot(car.ang, up); // yaw

  let pitchIn = clamp(inp.pitch, -1, 1);
  let yawIn = clamp(inp.yaw, -1, 1);
  let rollIn = clamp(inp.roll, -1, 1);

  // handbrake no ar = air roll (o "air roll" clássico usa o mesmo botão)
  if (inp.handbrake) {
    rollIn = clamp(rollIn + inp.steer, -1, 1);
    yawIn = 0;
  }

  // Sinais das rotações (regra da mão direita nos eixos do carro):
  //  - roll  em torno de "frente": positivo já inclina para a direita  -> +
  //  - pitch em torno de "direita": positivo já levanta o nariz        -> +
  //  - yaw   em torno de "cima": positivo gira para a ESQUERDA         -> -
  const tRoll = K.AIR_ROLL * rollIn - (rollIn === 0 ? K.DAMP_ROLL * wx : 0);
  const tPitch = K.AIR_PITCH * pitchIn - (pitchIn === 0 ? K.DAMP_PITCH * wy : 0);
  const tYaw = -K.AIR_YAW * yawIn - (yawIn === 0 ? K.DAMP_YAW * wz : 0);

  addScaled(car.ang, fwd, tRoll * dt);
  addScaled(car.ang, right, tPitch * dt);
  addScaled(car.ang, up, tYaw * dt);
}

/** Pulo, double jump e flips. */
function handleJump(car: Car, inp: CarInput, dt: number, events: SimEvent[]): void {
  const pressed = inp.jump && !car.jumpHeld;

  // flip em andamento: rotação forçada
  if (car.dodgeTimer > 0) {
    car.dodgeTimer -= dt;
    if (!car.dodgeCancelled) {
      // cancelar o flip: input oposto à direção do dodge
      const opp = -car.dodgeDir.x * inp.pitch - car.dodgeDir.y * inp.yaw;
      if (opp > 0.5 && car.dodgeTimer < K.DODGE_TIME - 0.08) {
        car.dodgeCancelled = true;
        set(car.ang, 0, 0, 0);
      }
    }
    if (!car.dodgeCancelled) {
      forwardOf(fwd, car.rot);
      rightOf(right, car.rot);
      // Eixo perpendicular à direção do flip (regra da mão direita):
      //  - flip para FRENTE (dir.x=+1) => nariz mergulha => giro em -direita
      //  - flip para a DIREITA (dir.y=+1) => rola à direita => giro em +frente
      set(tmp, 0, 0, 0);
      addScaled(tmp, fwd, car.dodgeDir.y);
      addScaled(tmp, right, -car.dodgeDir.x);
      normalize(tmp);
      scale(tmp, K.DODGE_TORQUE);
      copy(car.ang, tmp);
    }
    if (car.dodgeTimer <= 0) car.dodgeCancelled = false;
  }

  if (car.groundSuppress > 0) car.groundSuppress -= dt;

  if (car.onGround) {
    car.hasJump = true;
    car.hasFlip = true;
    car.sinceJump = 0;
  } else {
    car.sinceJump += dt;
    if (car.sinceJump > K.FLIP_WINDOW) car.hasFlip = false;
  }

  if (pressed) {
    if (car.onGround && car.hasJump) {
      // primeiro pulo: impulso ao longo da NORMAL da superfície
      addScaled(car.vel, car.groundNormal, K.JUMP_IMPULSE);
      car.hasJump = false;
      car.hasFlip = true;
      car.sinceJump = 0;
      car.jumpTimer = 0;
      car.onGround = false;
      car.groundSuppress = 0.06; // evita a suspensão comer o impulso
      events.push({ type: "jump", carId: car.id });
    } else if (car.hasFlip && car.dodgeTimer <= 0) {
      const dx = clamp(-inp.pitch, -1, 1);
      const dy = clamp(inp.yaw + inp.steer, -1, 1);
      const mag = Math.hypot(dx, dy);
      if (mag > 0.2) {
        // dodge/flip direcional
        const ux = dx / mag;
        const uy = dy / mag;
        car.dodgeDir.x = ux;
        car.dodgeDir.y = uy;
        car.dodgeTimer = K.DODGE_TIME;
        car.dodgeCancelled = false;

        forwardOf(fwd, car.rot);
        rightOf(right, car.rot);
        // Impulso direcional no plano horizontal do mundo. Antes o vetor
        // podia ficar fraco quando o carro estava muito inclinado; agora
        // projetamos os eixos e temos fallback robusto.
        set(tmp, 0, 0, 0);
        fwd.z = 0;
        right.z = 0;
        if (len(fwd) < 1e-4) set(fwd, Math.cos(0), Math.sin(0), 0);
        else normalize(fwd);
        if (len(right) < 1e-4) set(right, fwd.y, -fwd.x, 0);
        else normalize(right);
        addScaled(tmp, fwd, ux);
        addScaled(tmp, right, uy);
        if (len(tmp) < 1e-4) copy(tmp, fwd);
        normalize(tmp);

        // O dodge do RL tem um "pop" vertical e uma janela de gravidade
        // suavizada; sem isso front/back/side flip parecem só uma rotação.
        const impulse = K.DODGE_IMPULSE * (Math.abs(ux) > 0.75 || Math.abs(uy) > 0.75 ? 1 : 0.92);
        car.vel.z += ux < -0.3 ? K.DODGE_BACK_UP_IMPULSE : K.DODGE_UP_IMPULSE;
        addScaled(car.vel, tmp, impulse);
        events.push({ type: "flip", carId: car.id });
      } else {
        // double jump
        set(tmp, 0, 0, 1);
        addScaled(car.vel, tmp, K.JUMP_IMPULSE);
        events.push({ type: "jump", carId: car.id });
      }
      car.hasFlip = false;
    }
  }

  // segurar o pulo dá mais altura, por até 0.2s
  if (inp.jump && !car.onGround && car.jumpTimer < K.JUMP_HOLD_TIME && car.sinceJump < 0.25) {
    car.jumpTimer += dt;
    addScaled(car.vel, car.groundNormal, K.JUMP_HOLD_ACCEL * dt);
  }

  car.jumpHeld = inp.jump;
}

/** Um passo de física para um carro. */
export function stepCar(car: Car, dt: number, events: SimEvent[]): void {
  if (car.demoTimer > 0) {
    car.demoTimer -= dt;
    return;
  }
  const inp = car.input;

  const wasGround = car.onGround;
  const minDist = sampleSuspension(car);

  if (car.dodgeTimer > 0) car.onGround = false;

  if (car.onGround && !wasGround) {
    events.push({ type: "landing", carId: car.id, speed: Math.abs(car.vel.z) });
  }

  handleJump(car, inp, dt, events);

  // A gravidade age sempre; no chão a suspensão compensa. Durante o
  // dodge/flip ela é reduzida por alguns frames para o impulso direcional
  // aparecer de verdade em front/back/side flips.
  const gravityScale = car.dodgeTimer > 0 ? K.DODGE_GRAVITY_SCALE : 1;
  car.vel.z -= K.GRAVITY * gravityScale * dt;

  if (car.onGround) {
    applySuspension(car, minDist, dt);
    alignToSurface(car, dt);
    groundDrive(car, inp, dt);
    car.airTime = 0;
  } else {
    car.airTime += dt;
    if (car.dodgeTimer <= 0) airControl(car, inp, dt);
  }

  // ---- boost (na direção do nariz, no chão e no ar)
  if (inp.boost && car.boost > 0) {
    forwardOf(fwd, car.rot);
    addScaled(car.vel, fwd, K.BOOST_ACCEL * dt);
    car.boost = Math.max(0, car.boost - K.BOOST_USE * dt);
  }

  // ---- limites
  clampLen(car.vel, K.CAR_MAX_SPEED);
  clampLen(car.ang, K.MAX_ANG_SPEED);
  car.supersonic = len(car.vel) >= K.SUPERSONIC_SPEED;

  // ---- integração
  addScaled(car.pos, car.vel, dt);
  qIntegrate(car.rot, car.ang, dt);

  if (car.hitBallTimer > 0) car.hitBallTimer -= dt;
}

/** Colisão da hitbox (OBB) com a arena, aproximada pelos 8 vértices. */
const CORNERS: readonly [number, number, number][] = (() => {
  const hx = K.HITBOX_L / 2,
    hy = K.HITBOX_W / 2,
    hz = K.HITBOX_H / 2;
  const out: [number, number, number][] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push([sx * hx, sy * hy, sz * hz + K.HITBOX_OFFSET_Z]);
  return out;
})();

export function resolveCarArena(car: Car): void {
  if (car.demoTimer > 0) return;
  let pushX = 0,
    pushY = 0,
    pushZ = 0;
  let worst = 0;

  for (const [lx, ly, lz] of CORNERS) {
    set(localWheel, lx, ly, lz);
    qRotate(tmp2, car.rot, localWheel);
    const px = car.pos.x + tmp2.x;
    const py = car.pos.y + tmp2.y;
    const pz = car.pos.z + tmp2.z;
    const d = arenaDistance(px, py, pz, contactN);
    if (d < 0) {
      const pen = -d;
      if (pen > worst) worst = pen;
      pushX += contactN.x * pen;
      pushY += contactN.y * pen;
      pushZ += contactN.z * pen;
    }
  }

  if (worst <= 0) return;

  set(tmp, pushX, pushY, pushZ);
  normalize(tmp);
  addScaled(car.pos, tmp, worst);

  const vn = dot(car.vel, tmp);
  if (vn < 0) {
    // pouco quique, muita absorção (como no jogo)
    addScaled(car.vel, tmp, -vn * 1.15);
  }

  // Atrito de contato: raspar a carroceria no chão MATA a rotação.
  // Sem isto o carro fica girando eternamente equilibrado numa quina.
  scale(car.ang, Math.max(0, 1 - worst * 0.12));

  // E o contato também endireita o carro: a componente da rotação que não
  // é em torno da normal decai depressa (a quina "engancha" no chão).
  upOf(up, car.rot);
  cross(tmp2, up, tmp);
  const s2 = len(tmp2);
  if (s2 > 1e-4) {
    const angle = Math.asin(clamp(s2, -1, 1));
    // se está de cabeça para baixo, atan2 dá o lado certo
    const flipped = dot(up, tmp) < 0;
    const mag = flipped ? Math.PI - angle : angle;
    scale(tmp2, (1 / s2) * mag * 6);
    addScaled(car.ang, tmp2, 0.14);
    clampLen(car.ang, K.MAX_ANG_SPEED);
  }
}

export function makeCar(id: number, team: 0 | 1, isBot: boolean): Car {
  return {
    id,
    team,
    isBot,
    pos: v3(0, 0, K.REST_HEIGHT),
    vel: v3(),
    ang: v3(),
    rot: quat(),
    boost: K.BOOST_START,
    onGround: true,
    groundNormal: v3(0, 0, 1),
    airTime: 0,
    wheelCompression: [0, 0, 0, 0],
    wheelContact: [false, false, false, false],
    jumpHeld: false,
    jumpTimer: 0,
    hasJump: true,
    hasFlip: true,
    sinceJump: 0,
    groundSuppress: 0,
    dodgeTimer: 0,
    dodgeDir: { x: 0, y: 0 },
    dodgeCancelled: false,
    supersonic: false,
    demoTimer: 0,
    input: {
      throttle: 0,
      steer: 0,
      pitch: 0,
      yaw: 0,
      roll: 0,
      jump: false,
      boost: false,
      handbrake: false,
    },
    lastImpactSpeed: 0,
    hitBallTimer: 0,
  };
}

export { fwd as _fwd, right as _right, up as _up, _q };
