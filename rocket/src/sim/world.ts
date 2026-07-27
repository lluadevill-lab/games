/**
 * O mundo: passo fixo de 1/120 s, regras de partida, kickoff, boost pads.
 * Nada aqui sabe da existência do renderer.
 */
import { v3, set, len, copy, qFromEuler, quat } from "../core/vec";
import * as K from "./constants";
import { makeCar, stepCar, resolveCarArena, sampleSuspension } from "./car";
import { makeBall, stepBall, resolveBallArena, resolveCarBall, resolveCarCar } from "./ball";
import { ballInGoal } from "./arena";
import {
  PADS,
  BIG_PAD_AMOUNT,
  SMALL_PAD_AMOUNT,
  BIG_PAD_RESPAWN,
  SMALL_PAD_RESPAWN,
  BIG_PAD_RADIUS,
  SMALL_PAD_RADIUS,
  PAD_HEIGHT_BIG,
  PAD_HEIGHT_SMALL,
} from "./boostPads";
import type { Car, SimEvent, World } from "./types";
import { simRng } from "../core/rng";

/** As 5 posições de kickoff do jogo (espelhadas por time). */
export const KICKOFF_SPOTS: readonly [number, number][] = [
  [-2048, -2560], // canto esquerdo
  [2048, -2560], // canto direito
  [-256, -3840], // quase-centro esquerdo
  [256, -3840], // quase-centro direito
  [0, -4608], // centro
];

export interface WorldOptions {
  botCount?: number;
  matchTime?: number;
  freePlay?: boolean;
  /** semente do RNG da simulação (determinismo total) */
  seed?: number;
}

export function createWorld(opts: WorldOptions = {}): World {
  // Semeia o RNG: a mesma semente sempre produz a mesma partida.
  simRng.reseed(opts.seed ?? 0x9e3779b9);
  const botCount = opts.botCount ?? 1;
  const cars: Car[] = [makeCar(0, 0, false)];
  for (let i = 0; i < botCount; i++) cars.push(makeCar(i + 1, 1, true));

  const world: World = {
    time: 0,
    cars,
    ball: makeBall(),
    pads: PADS.map(() => ({ active: true, timer: 0 })),
    score: [0, 0],
    clock: opts.matchTime ?? K.MATCH_TIME,
    phase: opts.freePlay ? "play" : "kickoff",
    phaseTimer: opts.freePlay ? 0 : K.KICKOFF_COUNTDOWN,
    overtime: false,
    lastTouch: null,
    events: [],
  };
  resetKickoff(world, !opts.freePlay);
  return world;
}

const _q = quat();

/** Posiciona carros e bola para o kickoff. */
export function resetKickoff(world: World, countdown = true): void {
  const spotIndex = simRng.int(KICKOFF_SPOTS.length);
  const blue = world.cars.filter((c) => c.team === 0);
  const orange = world.cars.filter((c) => c.team === 1);

  const place = (car: Car, i: number, team: 0 | 1) => {
    const idx = (spotIndex + i) % KICKOFF_SPOTS.length;
    const [sx, sy] = KICKOFF_SPOTS[idx];
    const mirror = team === 1 ? -1 : 1;
    set(car.pos, sx * mirror, sy * mirror, K.REST_HEIGHT);
    set(car.vel, 0, 0, 0);
    set(car.ang, 0, 0, 0);
    const yaw = Math.atan2(-car.pos.y, -car.pos.x);
    qFromEuler(car.rot, yaw, 0, 0);
    car.boost = K.BOOST_START;
    car.onGround = true;
    set(car.groundNormal, 0, 0, 1);
    car.hasJump = true;
    car.hasFlip = true;
    car.groundSuppress = 0;
    car.dodgeTimer = 0;
    car.demoTimer = 0;
    car.supersonic = false;
    sampleSuspension(car);
  };

  blue.forEach((c, i) => place(c, i, 0));
  orange.forEach((c, i) => place(c, i, 1));

  set(world.ball.pos, 0, 0, K.BALL_RADIUS + 2);
  set(world.ball.vel, 0, 0, 0);
  set(world.ball.ang, 0, 0, 0);

  world.pads.forEach((p) => {
    p.active = true;
    p.timer = 0;
  });

  world.lastTouch = null;
  world.phase = countdown ? "kickoff" : "play";
  world.phaseTimer = countdown ? K.KICKOFF_COUNTDOWN : 0;
  world.events.push({ type: "kickoff" });
}

function respawnCar(car: Car): void {
  const mirror = car.team === 1 ? -1 : 1;
  set(car.pos, simRng.range(-2000, 2000), -4300 * mirror, K.REST_HEIGHT);
  set(car.vel, 0, 0, 0);
  set(car.ang, 0, 0, 0);
  qFromEuler(car.rot, car.team === 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0);
  car.boost = K.BOOST_START;
  car.onGround = true;
  set(car.groundNormal, 0, 0, 1);
  car.hasJump = true;
  car.hasFlip = true;
  car.groundSuppress = 0;
  car.dodgeTimer = 0;
}

function updatePads(world: World, dt: number): void {
  for (let i = 0; i < PADS.length; i++) {
    const def = PADS[i];
    const st = world.pads[i];
    if (!st.active) {
      st.timer -= dt;
      if (st.timer <= 0) st.active = true;
      continue;
    }
    const r = def.big ? BIG_PAD_RADIUS : SMALL_PAD_RADIUS;
    const h = def.big ? PAD_HEIGHT_BIG : PAD_HEIGHT_SMALL;
    for (const car of world.cars) {
      if (car.demoTimer > 0) continue;
      if (car.boost >= K.BOOST_MAX && !def.big) continue;
      const dx = car.pos.x - def.x;
      const dy = car.pos.y - def.y;
      if (dx * dx + dy * dy < r * r && car.pos.z < h) {
        st.active = false;
        st.timer = def.big ? BIG_PAD_RESPAWN : SMALL_PAD_RESPAWN;
        car.boost = Math.min(
          K.BOOST_MAX,
          car.boost + (def.big ? BIG_PAD_AMOUNT : SMALL_PAD_AMOUNT),
        );
        world.events.push({ type: "pad", big: def.big, carId: car.id });
        break;
      }
    }
  }
}

/** Um tick de 1/120 s. */
export function stepWorld(world: World, dt: number): void {
  const ev = world.events;

  // ---- máquina de estados da partida
  if (world.phase === "kickoff") {
    world.phaseTimer -= dt;
    if (world.phaseTimer <= 0) world.phase = "play";
  } else if (world.phase === "goal") {
    world.phaseTimer -= dt;
    if (world.phaseTimer <= 0) {
      if (world.clock <= 0 && !isTied(world)) {
        world.phase = "over";
        ev.push({ type: "matchEnd" });
      } else {
        resetKickoff(world, true);
      }
    }
  } else if (world.phase === "over") {
    return;
  }

  const frozen = world.phase === "kickoff" || world.phase === "goal";

  // ---- carros
  for (const car of world.cars) {
    if (car.demoTimer > 0) {
      car.demoTimer -= dt;
      if (car.demoTimer <= 0) respawnCar(car);
      continue;
    }
    if (frozen) {
      set(car.vel, 0, 0, 0);
      set(car.ang, 0, 0, 0);
      sampleSuspension(car);
      continue;
    }
    stepCar(car, dt, ev);
    resolveCarArena(car);
  }

  // ---- bola
  if (!frozen) {
    stepBall(world.ball, dt);
    resolveBallArena(world.ball, ev);

    for (const car of world.cars) {
      if (resolveCarBall(car, world.ball, ev)) {
        world.lastTouch = { carId: car.id, team: car.team };
      }
    }
    for (let i = 0; i < world.cars.length; i++)
      for (let j = i + 1; j < world.cars.length; j++)
        resolveCarCar(world.cars[i], world.cars[j], ev);

    updatePads(world, dt);
  }

  // ---- relógio e gol
  if (world.phase === "play") {
    world.time += dt;
    if (world.clock > 0) {
      world.clock = Math.max(0, world.clock - dt);
    }

    const g = ballInGoal(world.ball.pos, K.BALL_RADIUS);
    if (g !== 0) {
      // gol em +Y é ponto do time azul (que ataca +Y)
      const scoringTeam: 0 | 1 = g === 1 ? 0 : 1;
      world.score[scoringTeam]++;
      world.phase = "goal";
      world.phaseTimer = K.GOAL_REPLAY_TIME;
      ev.push({ type: "goal", team: scoringTeam, speed: len(world.ball.vel) });
      if (world.overtime) {
        world.phase = "over";
        ev.push({ type: "matchEnd" });
      }
    } else if (world.clock <= 0 && isBallGrounded(world)) {
      // fim de tempo só vale quando a bola toca o chão
      if (isTied(world)) {
        world.overtime = true;
        world.clock = 0;
        resetKickoff(world, true);
      } else {
        world.phase = "over";
        ev.push({ type: "matchEnd" });
      }
    }
  }
}

function isTied(w: World): boolean {
  return w.score[0] === w.score[1];
}

function isBallGrounded(w: World): boolean {
  return w.ball.pos.z <= K.BALL_RADIUS + 6 && Math.abs(w.ball.vel.z) < 120;
}

/** Avança o mundo por `elapsed` segundos, em passos fixos. */
export function advance(world: World, elapsed: number, maxSteps = 12): void {
  let steps = Math.min(Math.round(elapsed / K.TICK_DT), maxSteps);
  if (steps < 1) steps = 1;
  for (let i = 0; i < steps; i++) stepWorld(world, K.TICK_DT);
}
