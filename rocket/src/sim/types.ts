import type { Quat, V3 } from "../core/vec";

/** Entradas de um carro num tick — mesma forma dos controles do RL. */
export interface CarInput {
  throttle: number; // -1..1
  steer: number; // -1..1
  pitch: number; // -1..1
  yaw: number; // -1..1
  roll: number; // -1..1
  jump: boolean;
  boost: boolean;
  handbrake: boolean; // powerslide / air roll quando no ar
}

export const emptyInput = (): CarInput => ({
  throttle: 0,
  steer: 0,
  pitch: 0,
  yaw: 0,
  roll: 0,
  jump: false,
  boost: false,
  handbrake: false,
});

export interface Car {
  id: number;
  team: 0 | 1; // 0 = azul (defende -Y), 1 = laranja (defende +Y)
  isBot: boolean;

  pos: V3;
  vel: V3;
  ang: V3; // velocidade angular no mundo (rad/s)
  rot: Quat;

  boost: number;

  onGround: boolean;
  groundNormal: V3;
  airTime: number;

  // pulo / flip
  jumpHeld: boolean;
  jumpTimer: number; // tempo segurando o primeiro pulo
  hasJump: boolean; // pode dar o primeiro pulo
  hasFlip: boolean; // pode dar o segundo pulo / dodge
  sinceJump: number; // tempo desde que deixou o chão pulando
  groundSuppress: number; // ignora contato com o chão logo após pular
  dodgeTimer: number; // >0 = flip em andamento
  dodgeDir: { x: number; y: number }; // direção local do flip
  dodgeCancelled: boolean;

  supersonic: boolean;
  demoTimer: number; // >0 = demolido, aguardando respawn

  input: CarInput;
  // telemetria para render/HUD
  lastImpactSpeed: number;
  hitBallTimer: number;
}

export interface Ball {
  pos: V3;
  vel: V3;
  ang: V3;
}

export interface PadState {
  active: boolean;
  timer: number;
}

export type MatchPhase = "kickoff" | "play" | "goal" | "over" | "warmup";

export interface GoalEvent {
  team: 0 | 1;
  scorerId: number;
  speed: number;
}

export interface World {
  time: number;
  cars: Car[];
  ball: Ball;
  pads: PadState[];
  score: [number, number];
  clock: number; // segundos restantes
  phase: MatchPhase;
  phaseTimer: number;
  overtime: boolean;
  lastTouch: { carId: number; team: 0 | 1 } | null;
  events: SimEvent[];
}

export type SimEvent =
  | { type: "goal"; team: 0 | 1; speed: number }
  | { type: "ballHit"; carId: number; speed: number; pos: V3 }
  | { type: "bounce"; speed: number; pos: V3 }
  | { type: "pad"; big: boolean; carId: number }
  | { type: "jump"; carId: number }
  | { type: "flip"; carId: number }
  | { type: "demo"; carId: number; byId: number }
  | { type: "landing"; carId: number; speed: number }
  | { type: "kickoff" }
  | { type: "matchEnd" };
