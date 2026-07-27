/**
 * Bot: máquina de estados simples (atacar / defender / recuperar / pegar boost)
 * que produz o MESMO CarInput de um humano. Ele não trapaceia — usa a predição
 * da bola e os mesmos limites de física.
 */
import {
  v3,
  set,
  len,
  dot,
  cross,
  add,
  normalize,
  copy,
  addScaled,
  scale,
  forwardOf,
  rightOf,
  upOf,
  qRotateInv,
} from "../core/vec";
import { clamp, sign1 } from "../core/mathx";
import * as K from "./constants";
import { PADS } from "./boostPads";
import { predictBall, type PredSlice } from "./predict";
import type { Car, CarInput, World } from "./types";

export type BotSkill = "facil" | "medio" | "dificil";

interface BotMemory {
  pred: PredSlice[];
  predAge: number;
  target: { x: number; y: number; z: number };
  state: string;
  stateTimer: number;
  flipCooldown: number;
  reaction: number;
  lastYawErr: number;
  lastPitchErr: number;
}

const memories = new Map<number, BotMemory>();

const fwd = v3();
const right = v3();
const up = v3();
const local = v3();
const tmp = v3();
const toTarget = v3();

const SKILL = {
  facil: { reaction: 0.28, boostUse: 0.3, aerial: false, speedCap: 1250, err: 260 },
  medio: { reaction: 0.14, boostUse: 0.65, aerial: true, speedCap: 1900, err: 110 },
  dificil: { reaction: 0.05, boostUse: 0.95, aerial: true, speedCap: 2300, err: 25 },
} as const;

export function resetBots(): void {
  memories.clear();
}

const _aimLocal = v3();
const _dFwd = v3();
const _dUp = v3();
const _dRight = v3();
const _axis = v3();

/**
 * Controlador de atitude no ar.
 *
 * Em vez de mirar só o nariz (o que faz o carro pousar de bico), calcula o
 * ERRO DE ROTAÇÃO COMPLETO entre a orientação atual e a desejada (nariz +
 * "para cima"), converte em eixo-ângulo no referencial do carro e aplica um
 * PD em pitch/yaw/roll. É o mesmo princípio de um controlador de atitude
 * de drone — e é o que um jogador faz intuitivamente ao recuperar.
 */
function aimOrientation(
  car: Car,
  inp: CarInput,
  desiredFwd: { x: number; y: number; z: number },
  desiredUp: { x: number; y: number; z: number },
): { yawErr: number; pitchErr: number } {
  // base desejada ortonormal
  copy(_dFwd, desiredFwd as any);
  normalize(_dFwd);
  copy(_dUp, desiredUp as any);
  // remove de "up" a componente ao longo do nariz
  addScaled(_dUp, _dFwd, -dot(_dUp, _dFwd));
  if (len(_dUp) < 1e-4) set(_dUp, 0, 0, 1);
  normalize(_dUp);
  cross(_dRight, _dUp, _dFwd);
  normalize(_dRight);

  // base atual
  forwardOf(fwd, car.rot);
  rightOf(right, car.rot);
  upOf(up, car.rot);

  // Erro de rotação: eixo = ½ Σ (atual_i × desejado_i)  (aprox. de 1ª ordem)
  set(_axis, 0, 0, 0);
  cross(tmp, fwd, _dFwd);
  add(_axis, tmp);
  cross(tmp, right, _dRight);
  add(_axis, tmp);
  cross(tmp, up, _dUp);
  add(_axis, tmp);
  scale(_axis, 0.5);

  // erro no referencial do carro
  const eRoll = dot(_axis, fwd);
  const ePitch = dot(_axis, right);
  const eYaw = dot(_axis, up);

  const wRoll = dot(car.ang, fwd);
  const wPitch = dot(car.ang, right);
  const wYaw = dot(car.ang, up);

  // Ganhos proporcionais à autoridade real de cada eixo
  // (roll 38.34 > pitch 12.46 > yaw 9.11 rad/s²).
  //
  // Sinal do yaw: a entrada yaw = +1 gira para a DIREITA, o que corresponde
  // a uma rotação NEGATIVA em torno do eixo "cima" (regra da mão direita).
  // Por isso o erro e o amortecimento entram invertidos neste eixo.
  inp.roll = clamp(eRoll * 5.5 - wRoll * 0.42, -1, 1);
  inp.pitch = clamp(ePitch * 4.0 - wPitch * 0.58, -1, 1);
  inp.yaw = clamp(-eYaw * 3.2 + wYaw * 0.62, -1, 1);

  const yawErr = Math.atan2(dot(_dFwd, right), dot(_dFwd, fwd));
  const pitchErr = Math.asin(clamp(dot(_dFwd, up), -1, 1));
  const mem = memories.get(car.id);
  if (mem) {
    mem.lastYawErr = yawErr;
    mem.lastPitchErr = pitchErr;
  }
  return { yawErr, pitchErr };
}

export function driveBot(car: Car, world: World, dt: number, skill: BotSkill = "medio"): void {
  const cfg = SKILL[skill];
  let mem = memories.get(car.id);
  if (!mem) {
    mem = {
      pred: [],
      predAge: 99,
      target: { x: 0, y: 0, z: 0 },
      state: "chase",
      stateTimer: 0,
      flipCooldown: 0,
      reaction: 0,
      lastYawErr: 0,
      lastPitchErr: 0,
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

  mem.flipCooldown -= dt;
  mem.stateTimer += dt;
  mem.predAge += dt;
  mem.reaction -= dt;

  // recalcula a predição a cada ~100 ms
  if (mem.predAge > 0.1) {
    mem.pred = predictBall(world.ball, 70, 1 / 25);
    mem.predAge = 0;
  }

  const ball = world.ball;
  const mySign = car.team === 0 ? -1 : 1; // meu gol está em mySign * FIELD_Y
  const ownGoalY = mySign * K.FIELD_Y;
  const enemyGoalY = -mySign * K.FIELD_Y;

  // ------------------------------------------------ escolha do ponto de ataque
  const carSpeed = Math.max(len(car.vel), 600);
  const reach = Math.min(carSpeed + (car.boost > 20 ? 900 : 350), 2300);
  let aim = { x: ball.pos.x, y: ball.pos.y, z: ball.pos.z };
  for (const s of mem.pred) {
    // só considera pontos que ele consegue atacar pelo lado certo
    if (s.pos.z > 260 && !cfg.aerial) continue;
    const d = Math.hypot(s.pos.x - car.pos.x, s.pos.y - car.pos.y, s.pos.z - car.pos.z);
    if (d / reach <= s.t) {
      aim = { x: s.pos.x, y: s.pos.y, z: s.pos.z };
      break;
    }
  }

  // erro proposital por dificuldade (some quando está em cima da bola)
  if (cfg.err > 0) {
    const dNow = Math.hypot(ball.pos.x - car.pos.x, ball.pos.y - car.pos.y);
    const e = cfg.err * clamp(dNow / 2000, 0, 1);
    aim.x += Math.sin(world.time * 1.7 + car.id) * e;
    aim.y += Math.cos(world.time * 1.3 + car.id * 2) * e * 0.5;
  }

  // ------------------------------------------------ estado
  const ballTowardOwnGoal = (ball.pos.y - car.pos.y) * mySign > 0;
  const behindBall = (car.pos.y - aim.y) * mySign > 0;
  const distToBall = Math.hypot(ball.pos.x - car.pos.x, ball.pos.y - car.pos.y);
  const ballInOwnHalf = ball.pos.y * mySign > 500;
  const lowBoost = car.boost < 20;

  // "atrás da bola" com margem: não precisa estar perfeito para atacar
  const behindMargin = (car.pos.y - aim.y) * mySign > -350;

  let state = "chase";
  if (!behindMargin && distToBall > 1100) state = "rotate";
  else if (ballInOwnHalf && Math.abs(ball.pos.y) > 3400 && !behindMargin) state = "defend";
  else if (lowBoost && distToBall > 2600 && !ballInOwnHalf) state = "boost";
  if (world.phase === "kickoff") state = "kickoff";

  mem.state = state;

  // ------------------------------------------------ alvo de direção
  let tx = aim.x;
  let ty = aim.y;
  let tz = aim.z;

  if (state === "kickoff") {
    tx = 0;
    ty = 0;
    tz = K.BALL_RADIUS;
    inp.boost = true;
  } else if (state === "chase") {
    // ---- para onde chutar?
    // Mira num dos cantos do gol, escolhendo o mais distante do goleiro.
    // Chutar no meio é o erro que faz o bot acertar o adversário parado.
    let goalX = 0;
    const keeper = world.cars.find((c) => c.team !== car.team && c.demoTimer <= 0);
    const post = K.GOAL_HALF_W * 0.62;
    if (keeper && Math.abs(keeper.pos.y - enemyGoalY) < 2600) {
      goalX = keeper.pos.x > 0 ? -post : post; // canto oposto ao goleiro
    } else {
      goalX = clamp(aim.x * 0.3, -post, post);
    }

    let dx = aim.x - goalX;
    let dy = aim.y - enemyGoalY;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;

    // quão bem posicionado o carro já está (1 = exatamente atrás da bola)
    const cbx = car.pos.x - aim.x;
    const cby = car.pos.y - aim.y;
    const cbl = Math.hypot(cbx, cby) || 1;
    const alignment = (cbx * dx + cby * dy) / cbl;

    // Offset base = raio da bola + meio carro: é onde o nariz encosta.
    // Mal posicionado → afasta o ponto para contornar antes de atacar.
    const base = K.BALL_RADIUS + K.HITBOX_L * 0.5;
    const detour = alignment > 0.6 ? 0 : (0.6 - alignment) * 900;

    tx = aim.x + dx * (base + detour);
    ty = aim.y + dy * (base + detour);
    tz = aim.z;
  } else if (state === "rotate") {  } else if (state === "rotate") {  } else if (state === "rotate") {  } else if (state === "rotate") {
    // volta para trás da bola pelo lado
    const side = sign1(car.pos.x - ball.pos.x || 1);
    tx = clamp(ball.pos.x + side * 1100, -3300, 3300);
    ty = ball.pos.y + mySign * 1250;
    tz = 0;
  } else if (state === "defend") {
    tx = clamp(ball.pos.x * 0.5, -K.GOAL_HALF_W, K.GOAL_HALF_W);
    ty = ownGoalY * 0.86;
    tz = 0;
    if (distToBall < 900 && behindBall) {
      tx = aim.x;
      ty = aim.y + mySign * (K.BALL_RADIUS + 40);
      tz = aim.z;
    }
  } else if (state === "boost") {
    let best = Infinity;
    let bx = car.pos.x,
      by = car.pos.y;
    for (let i = 0; i < PADS.length; i++) {
      if (!world.pads[i].active) continue;
      const p = PADS[i];
      // só considera pads que não me afastam demais do meu gol
      const d =
        Math.hypot(p.x - car.pos.x, p.y - car.pos.y) + (p.big ? 0 : 1400) +
        Math.abs(p.y - ownGoalY) * 0.25;
      if (d < best) {
        best = d;
        bx = p.x;
        by = p.y;
      }
    }
    tx = bx;
    ty = by;
    tz = 0;
  }

  mem.target = { x: tx, y: ty, z: tz };

  // ------------------------------------------------ conversão alvo → input
  set(toTarget, tx - car.pos.x, ty - car.pos.y, tz - car.pos.z);
  const distTarget = len(toTarget);

  if (car.onGround) {
    forwardOf(fwd, car.rot);
    rightOf(right, car.rot);
    const ahead = dot(toTarget, fwd);
    const side = dot(toTarget, right);
    const angle = Math.atan2(side, ahead);
    const speed = len(car.vel);

    inp.steer = clamp(angle * 2.6, -1, 1);

    // ---- controle de velocidade
    // Chegar rápido demais é o erro nº1: o bot passa da bola, bate na parede
    // e sobe nela. A velocidade desejada respeita a distância que falta e o
    // quanto o carro precisa virar.
    const turnPenalty = 1 - Math.min(Math.abs(angle) / 2.2, 0.8);
    let desired = Math.min(cfg.speedCap, 500 + distTarget * 1.4) * turnPenalty;

    // perto do alvo com a bola logo à frente: manter velocidade de ataque
    if (state === "chase" && distToBall < 900) {
      desired = Math.max(desired, Math.min(cfg.speedCap, 1300));
    }
    // não acelerar contra a parede
    const wallDist = Math.min(
      K.FIELD_X - Math.abs(car.pos.x),
      K.FIELD_Y - Math.abs(car.pos.y),
    );
    if (wallDist < 700 && Math.abs(angle) < 0.6) {
      desired = Math.min(desired, 400 + wallDist * 1.5);
    }

    if (ahead < 0 && distTarget < 900) {
      // alvo atrás e perto: dar ré em vez de fazer a volta
      inp.throttle = -1;
      inp.steer = -inp.steer;
    } else if (speed > desired + 120) {
      inp.throttle = -0.6; // freia
    } else if (speed < desired) {
      inp.throttle = 1;
    } else {
      inp.throttle = 0.35;
    }

    // powerslide em curvas fechadas em velocidade
    inp.handbrake = Math.abs(angle) > 1.2 && speed > 900;

    // boost só quando alinhado, abaixo do desejado e longe o suficiente
    inp.boost =
      inp.boost ||
      (Math.abs(angle) < 0.28 &&
        speed < desired - 150 &&
        speed < cfg.speedCap &&
        car.boost > 6 &&
        Math.random() < cfg.boostUse &&
        distTarget > 700);

    // front flip para ganhar velocidade em trechos longos
    if (
      distTarget > 2600 &&
      Math.abs(angle) < 0.15 &&
      speed > 1100 &&
      car.boost < 10 &&
      mem.flipCooldown <= 0
    ) {
      inp.jump = true;
      inp.pitch = -1;
      mem.flipCooldown = 1.5;
    }

    // Pulo só para bola genuinamente alta. Pular numa bola no chão faz o
    // carro passar por baixo/por cima e perde a jogada — erro clássico de bot.
    const ballZ = ball.pos.z;
    if (
      cfg.aerial &&
      ballZ > 320 &&
      ballZ < 900 &&
      distToBall < 700 &&
      distToBall > 180 &&
      Math.abs(angle) < 0.4 &&
      behindMargin &&
      mem.flipCooldown <= 0
    ) {
      inp.jump = true;
      mem.flipCooldown = 1.0;
    }
  } else {
    // ---- no ar
    // Sempre segurar throttle: o carro precisa estar acelerando no instante
    // em que as rodas tocam o chão, senão desperdiça a recuperação.
    inp.throttle = 1;

    const ballHigh = ball.pos.z > 300;
    const goingForBall = cfg.aerial && ballHigh && distToBall < 1700 && behindMargin;

    if (goingForBall) {
      // ---- aéreo: nariz na bola, rodas viradas para o chão
      set(tmp, ball.pos.x - car.pos.x, ball.pos.y - car.pos.y, ball.pos.z - car.pos.z);
      normalize(tmp);
      const { yawErr, pitchErr } = aimOrientation(car, inp, tmp, { x: 0, y: 0, z: 1 });
      inp.boost = Math.abs(yawErr) < 0.3 && Math.abs(pitchErr) < 0.4 && car.boost > 4;

      if (car.hasFlip && distToBall < 300 && Math.abs(yawErr) < 0.4 && car.airTime > 0.15) {
        inp.jump = true;
        inp.pitch = -1;
      }
    } else {
      // ---- recuperação: RODAS PARA BAIXO é a prioridade.
      // O nariz vai na direção do movimento horizontal — nunca para o chão,
      // senão o carro pousa de bico e fica preso em pé.
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
  }

  // segurança: nunca dirigir para dentro do próprio gol com a bola atrás
  if (Math.abs(car.pos.y) > K.FIELD_Y - 200 && Math.abs(car.pos.x) < K.GOAL_HALF_W) {
    if ((car.pos.y - ball.pos.y) * mySign > 0) inp.throttle = 1;
  }
}

export function botState(carId: number): string {
  return memories.get(carId)?.state ?? "-";
}
