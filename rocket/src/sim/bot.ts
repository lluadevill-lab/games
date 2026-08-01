/**
 * Bot v2 — inspirado nas ideias do RLBot e dos artigos do smish.dev:
 *
 *  1. Escolha de ESTADO por utilidade (atacar / defender / rotacionar / pegar
 *     boost / kickoff) em vez de ifs confusos.
 *  2. Mira sempre num PONTO DE CONTATO previsto da bola, não na posição
 *     atual dela — e leva em conta o tempo de chegada do carro.
 *  3. Controlador de direção no chão baseado na CURVATURA real do carro
 *     (steer curve), com freio, powerslide e flips usados como o jogador
 *     de verdade faz.
 *  4. No ar, usa o controlador de atitude de corpo inteiro (nariz + up).
 *  5. Não trapaceia: lê o mesmo estado que o jogador e usa os mesmos inputs.
 */
import {
  v3,
  set,
  len,
  len2,
  dot,
  cross,
  add,
  normalize,
  copy,
  addScaled,
  scale,
  sub,
  subVec,
  forwardOf,
  rightOf,
  upOf,
} from "../core/vec";
import { clamp, sign1, curveLookup } from "../core/mathx";
import * as K from "./constants";
import { PADS } from "./boostPads";
import { predictBall, findGroundTouch, type PredSlice } from "./predict";
import { simRng } from "../core/rng";
import type { Car, CarInput, World } from "./types";

export type BotSkill = "facil" | "medio" | "dificil";

interface BotMemory {
  pred: PredSlice[];
  predAge: number;
  target: { x: number; y: number; z: number };
  shotTarget: { x: number; y: number };
  state: string;
  stateTimer: number;
  flipCooldown: number;
  lastKickoffFlip: number;
  dodgeDir: { x: number; y: number };
  dodgeQueued: number;
  lastSteer: number;
  stun: number;
  /** tempo até reavaliar o papel no 1v1 */
  roleTimer: number;
  role: "attack" | "defend" | "rotate" | "boost";
}

const memories = new Map<number, BotMemory>();

// Scratch vectors (evita alocação no hot path).
const fwd = v3();
const right = v3();
const up = v3();
const tmp = v3();
const toTarget = v3();
const toBall = v3();
const vCar = v3();

const SKILL = {
  facil: {
    reaction: 0.28,
    boostUse: 0.35,
    aerial: false,
    speedCap: K.DRIVE_MAX_SPEED - 80,
    aimErr: 280,
    arrivalSlack: 0.22,
    turnSpeed: 0.9,
    flipShot: false,
    canHalfFlip: false,
  },
  medio: {
    reaction: 0.12,
    boostUse: 0.7,
    aerial: true,
    speedCap: K.CAR_MAX_SPEED - 120,
    aimErr: 110,
    arrivalSlack: 0.1,
    turnSpeed: 1.1,
    flipShot: true,
    canHalfFlip: true,
  },
  dificil: {
    reaction: 0.04,
    boostUse: 0.98,
    aerial: true,
    speedCap: K.CAR_MAX_SPEED,
    aimErr: 30,
    arrivalSlack: 0.03,
    turnSpeed: 1.25,
    flipShot: true,
    canHalfFlip: true,
  },
} as const;

export function resetBots(): void {
  memories.clear();
}

// ---------------------------------------------------- utilidades de geometria

const _dFwd = v3();
const _dUp = v3();
const _dRight = v3();
const _axis = v3();

/**
 * Controlador de atitude no ar (corpo inteiro).
 * Converte o erro entre a orientação atual e a desejada (nariz + "up") em
 * pitch/yaw/roll. Mesma ideia de um controlador de atitude de drone.
 */
function aimOrientation(
  car: Car,
  inp: CarInput,
  desiredFwd: { x: number; y: number; z: number },
  desiredUp: { x: number; y: number; z: number },
): { yawErr: number; pitchErr: number } {
  copy(_dFwd, desiredFwd as any);
  normalize(_dFwd);
  copy(_dUp, desiredUp as any);
  addScaled(_dUp, _dFwd, -dot(_dUp, _dFwd));
  if (len(_dUp) < 1e-4) set(_dUp, 0, 0, 1);
  normalize(_dUp);
  cross(_dRight, _dUp, _dFwd);
  normalize(_dRight);

  forwardOf(fwd, car.rot);
  rightOf(right, car.rot);
  upOf(up, car.rot);

  set(_axis, 0, 0, 0);
  cross(tmp, fwd, _dFwd);
  add(_axis, tmp);
  cross(tmp, right, _dRight);
  add(_axis, tmp);
  cross(tmp, up, _dUp);
  add(_axis, tmp);
  scale(_axis, 0.5);

  const eRoll = dot(_axis, fwd);
  const ePitch = dot(_axis, right);
  const eYaw = dot(_axis, up);

  const wRoll = dot(car.ang, fwd);
  const wPitch = dot(car.ang, right);
  const wYaw = dot(car.ang, up);

  inp.roll = clamp(eRoll * 5.5 - wRoll * 0.42, -1, 1);
  inp.pitch = clamp(ePitch * 4.0 - wPitch * 0.58, -1, 1);
  inp.yaw = clamp(-eYaw * 3.2 + wYaw * 0.62, -1, 1);

  // erro "fácil" de yaw/pitch no plano do nariz
  const yawErr = Math.atan2(dot(_dFwd, right), dot(_dFwd, fwd));
  const pitchErr = Math.asin(clamp(dot(_dFwd, up), -1, 1));
  return { yawErr, pitchErr };
}

/**
 * Tempo de chegada aproximado no chão. Super barato: considera a velocidade
 * atual do carro + o boost que ele tem, e limita pela velocidade máxima.
 * Não substitui um path planner, mas é suficiente para escolher em qual
 * slice da predição da bola ele consegue chegar.
 */
function estimateArrival(
  car: Car,
  x: number,
  y: number,
  cfg: (typeof SKILL)[BotSkill],
): number {
  const dx = x - car.pos.x;
  const dy = y - car.pos.y;
  const d = Math.hypot(dx, dy);
  const vx = dot(car.vel, fwd) || 0;
  // projeta a velocidade do carro na direção do alvo
  forwardOf(fwd, car.rot);
  rightOf(right, car.rot);
  const headingX = fwd.x,
    headingY = fwd.y;
  const l = Math.hypot(headingX, headingY) || 1;
  const cosA = (dx * headingX + dy * headingY) / (l * (d || 1));
  const vToward = Math.max(0, vx * cosA);
  const boostBonus = Math.min(car.boost / 33, 3) * 400; // boost dá ~991 uu/s² por até 3s
  const vMax = Math.min(cfg.speedCap, vToward + boostBonus + 800);
  return d / Math.max(350, vMax) + 0.15; // 0.15 s de tempo de reação
}

/** Seleciona o melhor slice da predição para interceptar. */
function pickIntercept(
  car: Car,
  pred: PredSlice[],
  cfg: (typeof SKILL)[BotSkill],
  aerialOk: boolean,
  aerialRange: number,
): { s: PredSlice; ok: boolean } {
  let best: PredSlice | null = null;
  let bestScore = Infinity;
  for (const s of pred) {
    if (s.pos.z > 260 && !aerialOk) continue;
    if (s.pos.z > 900) continue;
    const d = Math.hypot(s.pos.x - car.pos.x, s.pos.y - car.pos.y, s.pos.z - car.pos.z);
    const eta = d / Math.max(400, Math.min(cfg.speedCap, len(car.vel) + 600));
    if (s.pos.z > 300 && d > aerialRange) continue;
    // chegar um pouco ANTES do slice dá tempo de alinhar
    const slack = s.pos.z > 260 ? 0 : cfg.arrivalSlack;
    if (eta < s.t + slack) {
      // prefere o slice mais cedo possível e mais baixo
      const score = s.t + s.pos.z * 0.0005 + Math.abs(s.pos.y - car.pos.y) * 0.00008;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
  }
  if (best) return { s: best, ok: true };
  // fallback: última fatia
  return { s: pred[pred.length - 1], ok: false };
}

/** Melhor pad de boost pra ir buscar agora. */
function pickBoostPad(car: Car, world: World, preferBig = true): { x: number; y: number } {
  const ownSign = car.team === 0 ? -1 : 1;
  const ownGoalY = ownSign * K.FIELD_Y;
  let best = Infinity;
  let bx = 0,
    by = ownGoalY * 0.5;
  for (let i = 0; i < PADS.length; i++) {
    if (!world.pads[i].active) continue;
    const p = PADS[i];
    // prioriza pads grandes no próprio lado; pads pequenos só são úteis
    // se já estiver passando por cima (custo zero), por isso tem penalidade.
    const d =
      Math.hypot(p.x - car.pos.x, p.y - car.pos.y) +
      (p.big ? 0 : 1500) +
      // penaliza fortemente pads do lado adversário se o carro tem pouco boost
      (p.y * ownSign < -1500 ? 2200 : 0) +
      // prefere pads no mesmo lado X do carro pra não cruzar a arena
      Math.abs(p.x - car.pos.x) * 0.25;
    if (preferBig && !p.big) continue;
    // pequenos pads só valem se já estiver quase passando por cima
    if (!p.big && d > 800) continue;
    if (d < best) {
      best = d;
      bx = p.x;
      by = p.y;
    }
  }
  if (!isFinite(best)) {
    // fallback: meio-campo do próprio lado
    return { x: clamp(car.pos.x, -K.FIELD_X + 1000, K.FIELD_X - 1000), y: ownGoalY * 0.55 };
  }
  return { x: bx, y: by };
}

// ----------------------------------------------------------- controlador chão

function driveTo(
  car: Car,
  inp: CarInput,
  tx: number,
  ty: number,
  cfg: (typeof SKILL)[BotSkill],
  allowBoost = true,
  desiredSpeed?: number,
): { angle: number; dist: number; ahead: number } {
  set(toTarget, tx - car.pos.x, ty - car.pos.y, 0);
  const dist = Math.hypot(toTarget.x, toTarget.y);
  forwardOf(fwd, car.rot);
  rightOf(right, car.rot);
  // projetar fwd/right no plano do chão
  const fX = fwd.x,
    fY = fwd.y;
  const rX = right.x,
    rY = right.y;
  const fl = Math.hypot(fX, fY) || 1;
  const rl = Math.hypot(rX, rY) || 1;
  const fxn = fX / fl,
    fyn = fY / fl;
  const rxn = rX / rl,
    ryn = rY / rl;
  const ahead = (toTarget.x * fxn + toTarget.y * fyn);
  const side = (toTarget.x * rxn + toTarget.y * ryn);
  let angle = Math.atan2(side, Math.max(ahead, 0.001));
  // quando alvo está atrás usa ré + esterço invertido
  if (ahead < 0 && dist < 600) {
    angle = Math.atan2(side, ahead || 1e-3);
  }

  inp.steer = clamp(angle * 2.6 * cfg.turnSpeed, -1, 1);

  // velocidade desejada: em curva apertada, reduz para não sair de lado.
  // A relação correta vem de v = sqrt(aderência_lateral / curvatura_efetiva).
  // Curvatura efetiva = curvatura_pela_velocidade * |steer_pretendido|.
  const speed = Math.hypot(car.vel.x, car.vel.y);
  const absAngle = Math.abs(angle);
  const steerMag = Math.min(1, absAngle * 2.6 * cfg.turnSpeed);
  const curvature = curveLookup(K.STEER_CURVE, Math.min(speed, 2300)) * Math.max(steerMag, 0.05);
  const maxTurnSpeed = Math.min(cfg.speedCap, Math.sqrt(K.LATERAL_GRIP / Math.max(curvature, 1e-4)));
  let vDesired = Math.min(cfg.speedCap, desiredSpeed ?? 500 + dist * 1.3);
  vDesired = Math.min(vDesired, Math.max(600, maxTurnSpeed));

  if (ahead < 0 && dist < 500) {
    inp.throttle = -1;
    inp.steer = clamp(-angle * 2.2, -1, 1);
    inp.handbrake = false;
  } else if (speed > vDesired + 220 && ahead > 0) {
    inp.throttle = -0.7;
    inp.handbrake = false;
  } else if (speed > vDesired + 80) {
    inp.throttle = 0.1;
    inp.handbrake = false;
  } else {
    inp.throttle = 1;
  }

  // powerslide em curvas MUITO fechadas e em velocidade, pra fazer meia-volta.
  inp.handbrake = absAngle > 1.3 && speed > 800 && ahead > -200;

  // boost só quando alinhado
  inp.boost =
    allowBoost &&
    Math.abs(angle) < 0.22 &&
    ahead > 300 &&
    speed < vDesired - 150 &&
    speed < cfg.speedCap - 50 &&
    car.boost > 6 &&
    simRng.next() < cfg.boostUse;

  return { angle, dist, ahead };
}

// ----------------------------------------------------------- principal

export function driveBot(
  car: Car,
  world: World,
  _rawDt: number,
  skill: BotSkill = "medio",
): void {
  const cfg = SKILL[skill];
  let mem = memories.get(car.id);
  if (!mem) {
    mem = {
      pred: [],
      predAge: 99,
      target: { x: 0, y: 0, z: 0 },
      shotTarget: { x: 0, y: 0 },
      state: "kickoff",
      stateTimer: 0,
      flipCooldown: 0,
      lastKickoffFlip: -10,
      dodgeDir: { x: 0, y: 0 },
      dodgeQueued: 0,
      lastSteer: 0,
      stun: 0,
      roleTimer: 0,
      role: "rotate",
    };
    memories.set(car.id, mem);
  }

  const inp = car.input;
  inp.throttle = 0;
  inp.steer = 0;
  inp.pitch = 0;
  inp.yaw = 0;
  inp.roll = 0;
  inp.jump = false;
  inp.boost = false;
  inp.handbrake = false;

  if (car.demoTimer > 0) return;
  if (world.phase === "goal" || world.phase === "over") return;

  const dt = K.TICK_DT;
  mem.flipCooldown -= dt;
  mem.stateTimer += dt;
  mem.predAge += dt;
  if (mem.stun > 0) mem.stun -= dt;

  // recalcula predição da bola
  if (mem.predAge > 0.08) {
    mem.pred = predictBall(world.ball, 110, 1 / 30);
    mem.predAge = 0;
  }

  const ball = world.ball;
  const mySign = car.team === 0 ? -1 : 1;
  const ownGoalY = mySign * K.FIELD_Y;
  const enemyGoalY = -mySign * K.FIELD_Y;

  // encontra o adversário (1v1)
  const enemy = world.cars.find((c) => c.team !== car.team && c.demoTimer <= 0);

  // distâncias gerais
  set(toBall, ball.pos.x - car.pos.x, ball.pos.y - car.pos.y, ball.pos.z - car.pos.z);
  const distBall = Math.hypot(toBall.x, toBall.y);
  const distBall3 = Math.hypot(toBall.x, toBall.y, toBall.z);

  // erro de mira por habilidade: decai conforme chega perto
  const errMag = cfg.aimErr * clamp(distBall / 1800, 0, 1);

  // --------------------------------------------------- escolha de ESTADO
  let state: BotMemory["state"] = "chase";
  if (world.phase === "kickoff") {
    state = "kickoff";
  } else {
    // Quem chega primeiro na bola ataca; o outro (no 1v1 é sempre o mesmo
    // bot, mas a regra também evita que ele tente chutar toda hora mesmo
    // quando está MUITO atrás) defende ou rotaciona.
    const etaMe = estimateArrival(car, ball.pos.x, ball.pos.y, cfg);
    let etaEnemy = Infinity;
    if (enemy) {
      forwardOf(fwd, enemy.rot);
      const vx = dot(enemy.vel, fwd);
      const dE = Math.hypot(ball.pos.x - enemy.pos.x, ball.pos.y - enemy.pos.y);
      etaEnemy = dE / Math.max(350, Math.min(K.CAR_MAX_SPEED, vx + 500)) + 0.18;
    }

    const ballInMyHalf = ball.pos.y * mySign > 0;
    const ballThreatening =
      (ball.vel.y * mySign > 700 && ballInMyHalf) ||
      (Math.abs(ball.pos.y - ownGoalY) < 1200 && ballInMyHalf);
    const lowBoost = car.boost < 20;

    // "atrás da bola" com margem generosa: não precisa estar perfeitamente
    // alinhado para atacar.
    const behindBall = (car.pos.y - ball.pos.y) * mySign > -500;

    // No 1v1 o bot SEMPRE persegue a bola, a menos que:
    //  - a bola está claramente rolando para o seu próprio gol (ameaça) e
    //    ele está na frente dela, ou
    //  - ele está literalmente sem boost e a bola está longe demais.
    const ballMovingAway = ball.vel.y * -mySign > 250; // bola indo pro gol adversário
    const veryClose = distBall < 1000;
    const iAmFirstToBall = etaMe < etaEnemy + 0.35;

    if (ballThreatening && !behindBall && !veryClose && !ballMovingAway) {
      state = "defend";
    } else if (iAmFirstToBall || veryClose || behindBall) {
      state = "chase";
    } else if (lowBoost && !ballThreatening && distBall > 2500) {
      state = "boost";
    } else {
      state = "chase"; // default ofensivo: nunca fica parado "rotacionando"
    }
  }
  mem.state = state;

  // --------------------------------------------------- alvo por estado
  let tx = ball.pos.x;
  let ty = ball.pos.y;
  let tz = ball.pos.z;
  let aerialRange = 0;

  if (state === "kickoff") {
    // No kickoff: voa direto pra bola, com boost ligado, e flipa quando
    // chega perto pra ganhar o primeiro toque (kickoff flip do RL).
    tx = 0;
    ty = 0;
    tz = K.BALL_RADIUS;
    // kickoff sempre usa boost desde o começo
    inp.boost = car.boost > 0;
  } else if (state === "chase") {
    // Escolhe onde mirar o chute: canto mais aberto do gol adversário.
    const post = K.GOAL_HALF_W * 0.72;
    // escolhe canto baseado em onde o adversário NÃO está e no lado atual da bola
    const enemyBias =
      enemy && Math.abs(enemy.pos.y - enemyGoalY) < 2400 ? -sign1(enemy.pos.x) : sign1(ball.pos.x || 1);
    let goalX = clamp(ball.pos.x * 0.25 + enemyBias * post, -post, post);
    // erro de mira
    if (errMag > 0.1) {
      goalX += (simRng.next() * 2 - 1) * errMag;
      goalX = clamp(goalX, -post, post);
    }
    mem.shotTarget = { x: goalX, y: enemyGoalY };

    let dx = ball.pos.x - goalX;
    let dy = ball.pos.y - enemyGoalY;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;

    // Escolhe o slice de contato (interceptação prevista)
    const aerialOk = cfg.aerial && car.boost > 25;
    aerialRange = aerialOk ? 1500 : 0;
    const pick = pickIntercept(car, mem.pred, cfg, aerialOk, aerialRange);
    const s = pick.s;
    tz = s.pos.z;

    // Ponto de chegada: ATRÁS da bola, na direção de onde o chute vem
    // (ou seja, oposto ao vetor bola→gol). "base" = raio da bola + meio
    // carro + folga pro nariz encostar em vez de entrar.
    //
    // BUG ANTIGO: estava subtraindo dx/dy, o que punha o alvo NA FRENTE
    // da bola em direção ao gol — o bot então tentava passar pela bola
    // e acabava chutando pro próprio lado.
    const cbx = car.pos.x - s.pos.x;
    const cby = car.pos.y - s.pos.y;
    const cbl = Math.hypot(cbx, cby) || 1;
    const alignment = (cbx * dx + cby * dy) / cbl; // 1 = perfeito atrás
    const base = K.BALL_RADIUS + K.HITBOX_L * 0.5;
    const detour = alignment > 0.55 ? 0 : (0.65 - alignment) * 450;
    tx = s.pos.x + dx * (base + detour);
    ty = s.pos.y + dy * (base + detour);
  } else if (state === "defend") {
    // Shadow defense: posiciona-se entre a bola e o centro do próprio gol,
    // a uma distância que dê tempo de reagir.
    const midX = clamp(ball.pos.x * 0.45, -K.GOAL_HALF_W * 0.9, K.GOAL_HALF_W * 0.9);
    const relY = ball.pos.y - ownGoalY;
    const shadowDist = clamp(Math.hypot(ball.vel.x, ball.vel.y) * 0.25, 420, 1300);
    tx = midX + (ball.pos.x - midX) * 0.1;
    ty = ball.pos.y - (ball.pos.y - ownGoalY > 0 ? 1 : -1) * shadowDist;
    ty = ownGoalY + clamp(relY - sign1(relY) * shadowDist, -2200, 2200);
    tz = 0;
    // se a bola está MUITO perto, chuta pra longe (pra fora da área)
    if (distBall < 750) {
      tx = ball.pos.x;
      ty = ball.pos.y - mySign * (K.BALL_RADIUS + 40);
      tz = ball.pos.z;
    }
  } else if (state === "rotate") {
    // Voltar pra rotação: meio-campo do próprio lado, no lado da bola,
    // com velocidade e boost, pra reatar quando perder a bola.
    tx = clamp(ball.pos.x * 0.75, -K.FIELD_X + 800, K.FIELD_X - 800);
    ty = ball.pos.y + mySign * 1500;
    tz = 0;
  } else if (state === "boost") {
    const p = pickBoostPad(car, world, car.boost < 15);
    tx = p.x;
    ty = p.y;
    tz = 0;
  }

  // adiciona o erro de mira (aleatório e por habilidade) ao alvo, mas não
  // quando está em perseguição final (já considerado no goalX)
  if (state !== "chase" && errMag > 0.1) {
    tx += (simRng.next() * 2 - 1) * errMag * 0.7;
    ty += (simRng.next() * 2 - 1) * errMag * 0.4;
  }

  mem.target = { x: tx, y: ty, z: tz };

  // --------------------------------------------------- converte alvo → input

  if (car.onGround) {
    const drive = driveTo(car, inp, tx, ty, cfg, true);
    mem.lastSteer = inp.steer;
    if (state === "kickoff") inp.boost = car.boost > 0;

    // wall avoidance: não acelerar contra parede a baixa distância
    const wallDist = Math.min(
      K.FIELD_X - Math.abs(car.pos.x),
      K.FIELD_Y - Math.abs(car.pos.y),
    );
    if (wallDist < 500 && Math.abs(drive.angle) < 0.8) {
      inp.throttle = Math.min(inp.throttle, 0.4);
      inp.boost = false;
    }

    // ---------- flips ofensivos / velocidade
    const alignedForFlip = Math.abs(drive.angle) < 0.2 && drive.ahead > 800;
    if (
      state === "kickoff" &&
      distBall < 360 &&
      mem.flipCooldown <= 0 &&
      car.onGround &&
      distBall > 130
    ) {
      // No kickoff: pula pra iniciar um front-flip que chega com MUITA
      // velocidade na bola.
      inp.jump = true;
      inp.pitch = -1;
      mem.dodgeQueued = 0.08;
      mem.dodgeDir = { x: 1, y: 0 };
      mem.flipCooldown = 1.0;
      mem.lastKickoffFlip = world.time;
    } else if (
      cfg.flipShot &&
      state === "chase" &&
      distBall < 260 &&
      distBall > 120 &&
      Math.abs(drive.angle) < 0.35 &&
      drive.ahead > 0 &&
      car.pos.z < K.REST_HEIGHT + 20 &&
      mem.flipCooldown <= 0 &&
      ball.pos.z < K.BALL_RADIUS + 120 &&
      car.hasFlip &&
      !car.onGround === false &&
      car.sinceJump < 0.01
    ) {
      // flip-shot: pula e front-flipa na bola (só se a bola estiver na faixa
      // do capô). Espera o salto terminar no próximo tick.
      inp.jump = true;
      mem.flipCooldown = 1.1;
      mem.dodgeQueued = 0.12;
      mem.dodgeDir = { x: 1, y: 0 };
    } else if (
      drive.dist > 2600 &&
      alignedForFlip &&
      Math.hypot(car.vel.x, car.vel.y) > 1000 &&
      car.boost < 12 &&
      mem.flipCooldown <= 0 &&
      car.onGround
    ) {
      // speed flip / front flip para ganhar velocidade em retas longas
      inp.jump = true;
      inp.pitch = -1;
      mem.flipCooldown = 1.3;
      mem.dodgeQueued = 0;
    } else if (cfg.canHalfFlip && mem.flipCooldown <= 0 && car.onGround) {
      // half-flip quando o alvo está MUITO atrás e estamos parados/lentos
      if (drive.ahead < -700 && Math.hypot(car.vel.x, car.vel.y) < 600) {
        inp.throttle = 1;
        inp.steer = 0;
        inp.jump = true;
        inp.pitch = 1; // back flip
        mem.flipCooldown = 1.2;
        mem.dodgeQueued = 0;
      }
    }

    if (mem.dodgeQueued > 0) {
      mem.dodgeQueued -= dt;
      if (car.airTime > 0.08 && car.hasFlip) {
        inp.jump = true;
        inp.pitch = -mem.dodgeDir.x;
        inp.yaw = mem.dodgeDir.y;
        mem.dodgeQueued = 0;
      }
    }

    // Pulo em bola alta (aéreo) só quando está no state chase, alinhado,
    // com boost suficiente e perto.
    if (
      cfg.aerial &&
      state === "chase" &&
      car.hasFlip &&
      car.boost > 20 &&
      ball.pos.z > 260 &&
      ball.pos.z < 900 &&
      distBall < 900 &&
      Math.abs(drive.angle) < 0.35 &&
      drive.ahead > 100 &&
      mem.flipCooldown <= 0
    ) {
      inp.jump = true;
      mem.flipCooldown = 0.9;
    }
  } else {
    // ---------------------- NO AR
    inp.throttle = 1;

    // decide o que mirar
    set(tmp, tx - car.pos.x, ty - car.pos.y, tz - car.pos.z);
    const horizL = Math.hypot(tmp.x, tmp.y) || 1;
    const goingForAerial =
      cfg.aerial &&
      state === "chase" &&
      ball.pos.z > 220 &&
      distBall3 < 1900 &&
      car.boost > 15 &&
      (car.pos.y - ball.pos.y) * mySign > -400;

    if (goingForAerial) {
      set(tmp, ball.pos.x - car.pos.x, ball.pos.y - car.pos.y, ball.pos.z - car.pos.z + 30);
      normalize(tmp);
      const { yawErr, pitchErr } = aimOrientation(car, inp, tmp, { x: 0, y: 0, z: 1 });
      inp.boost =
        Math.abs(yawErr) < 0.35 &&
        Math.abs(pitchErr) < 0.45 &&
        car.boost > 5;
      // flip de finalização quando está perto e com flip guardado
      if (
        cfg.flipShot &&
        car.hasFlip &&
        car.airTime > 0.18 &&
        distBall3 < 320 &&
        Math.abs(yawErr) < 0.5
      ) {
        inp.jump = true;
        inp.pitch = -1;
      }
    } else {
      // recuperação: rodas para baixo, nariz na direção do movimento ou do alvo
      const vh = Math.hypot(car.vel.x, car.vel.y);
      if (vh > 200) {
        set(tmp, car.vel.x / vh, car.vel.y / vh, 0);
      } else {
        set(tmp, tx - car.pos.x, ty - car.pos.y, 0);
        if (len(tmp) < 1) set(tmp, 1, 0, 0);
        normalize(tmp);
      }
      aimOrientation(car, inp, tmp, { x: 0, y: 0, z: 1 });
      inp.boost = false;
    }

    if (mem.dodgeQueued > 0) {
      mem.dodgeQueued -= dt;
      if (car.airTime > 0.05 && car.hasFlip) {
        inp.jump = true;
        inp.pitch = -mem.dodgeDir.x;
        inp.yaw = mem.dodgeDir.y;
        mem.dodgeQueued = 0;
      }
    }
  }

  // ---------- segurança: não entrar no próprio gol com a bola na frente
  if (Math.abs(car.pos.y) > K.FIELD_Y - 120 && Math.abs(car.pos.x) < K.GOAL_HALF_W) {
    if ((car.pos.y - ball.pos.y) * mySign > 50) {
      inp.throttle = 1;
      inp.boost = false;
    }
  }
}

export function botState(carId: number): string {
  return memories.get(carId)?.state ?? "-";
}
