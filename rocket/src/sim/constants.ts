/**
 * Constantes da física — valores do Rocket League original (unidades uu, uu/s).
 * Fontes: documentação do RLBot e do RocketSim (engenharia reversa da comunidade).
 * Ver MECANICAS.md para o contexto de cada número.
 */

// ---------------------------------------------------------------- mundo
export const TICK_RATE = 120;
export const TICK_DT = 1 / TICK_RATE;
export const GRAVITY = 650; // uu/s²

// ---------------------------------------------------------------- arena
export const FIELD_X = 4096; // meia-largura
export const FIELD_Y = 5120; // meio-comprimento
export const CEILING_Z = 2044;
export const CORNER_D = 8064; // |x| + |y| <= CORNER_D
export const GOAL_HALF_W = 892.755;
export const GOAL_H = 642.775;
export const GOAL_DEPTH = 880;
export const WALL_FILLET = 256; // arredondamento chão/parede e teto/parede
// Raio do arredondamento dos cantos no plano XY. No jogo original os cantos
// não são chanfros retos: são curvas amplas que permitem "correr no canto"
// sem perder velocidade.
export const CORNER_RADIUS = 1152;

// ---------------------------------------------------------------- bola
export const BALL_RADIUS = 91.25;
export const BALL_MASS = 30;
export const BALL_RESTITUTION = 0.6;
export const BALL_FRICTION = 0.35;
export const BALL_DRAG = 0.0305; // linear, por segundo
export const BALL_MAX_SPEED = 6000;
export const BALL_MAX_ANG = 6; // rad/s

// ---------------------------------------------------------------- carro
export const CAR_MASS = 180;
// hitbox Octane
export const HITBOX_L = 118.01;
export const HITBOX_W = 84.2;
export const HITBOX_H = 36.16;
export const HITBOX_OFFSET_Z = 3.0; // centro da caixa em relação ao centro de massa

export const WHEEL_RADIUS = 15;
export const WHEEL_FRONT_X = 51.25;
export const WHEEL_REAR_X = -33.75;
export const WHEEL_Y = 29.5;
export const WHEEL_Z = -2; // centro da roda no espaço local
export const REST_HEIGHT = 17; // altura do centro de massa em repouso
export const SUSPENSION_TRAVEL = 18;
// Resposta da suspensão por roda. O modelo continua barato (sem solver rígido),
// mas cada roda agora contribui com mola, amortecimento e torque no chassi.
export const SUSPENSION_STIFFNESS = 22; // converte compressão em velocidade alvo
export const SUSPENSION_DAMPING = 0.82;
export const SUSPENSION_MAX_PUSH = 5200; // uu/s² equivalente por roda
export const SUSPENSION_TORQUE_RESPONSE = 0.0016;

export const CAR_MAX_SPEED = 2300;
export const DRIVE_MAX_SPEED = 1410; // sem boost
export const SUPERSONIC_SPEED = 2200;
export const MAX_ANG_SPEED = 5.5; // rad/s

export const BRAKE_ACCEL = 3500;
export const COAST_DECEL = 525;
export const STICKY_ACCEL = 325; // "cola" o carro na superfície

// aceleração de throttle em função da velocidade à frente
export const THROTTLE_CURVE = [
  [0, 1600],
  [1400, 160],
  [1410, 0],
] as const;

// curvatura (1/raio) em função da velocidade
export const STEER_CURVE = [
  [0, 0.0069],
  [500, 0.00398],
  [1000, 0.00235],
  [1500, 0.001375],
  [1750, 0.0011],
  [2300, 0.00088],
] as const;

// atrito lateral máximo (aderência). Com powerslide a aderência cai.
export const LATERAL_GRIP = 4700;
export const LATERAL_GRIP_SLIDE = 900;

// ---------------------------------------------------------------- boost
export const BOOST_ACCEL = 991.667; // uu/s²
export const BOOST_USE = 33.3; // por segundo
export const BOOST_MAX = 100;
export const BOOST_START = 33.4;

// ---------------------------------------------------------------- pulo/flip
export const JUMP_IMPULSE = 291.667;
export const JUMP_HOLD_ACCEL = 1400;
export const JUMP_HOLD_TIME = 0.2;
export const FLIP_WINDOW = 1.25; // tempo para usar o segundo pulo
export const DODGE_IMPULSE = 620;
export const DODGE_UP_IMPULSE = 82; // lift curto para o flip não ser "engolido" pela gravidade
export const DODGE_BACK_UP_IMPULSE = 120;
export const DODGE_GRAVITY_SCALE = 0.42; // gravidade reduzida enquanto o dodge está ativo
export const DODGE_TIME = 0.65;
export const DODGE_TORQUE = 9.0; // rad/s durante o flip (~1 volta em 0.65s)

// torques do controle aéreo (rad/s²) e amortecimento
export const AIR_PITCH = 12.46;
export const AIR_YAW = 9.11;
export const AIR_ROLL = 38.34;
export const DAMP_PITCH = 2.798;
export const DAMP_YAW = 1.886;
export const DAMP_ROLL = 4.589;

// ---------------------------------------------------------------- carro x bola
// O contato carro-bola é quase inelástico; o "chute" vem do impulso extra.
export const CAR_BALL_RESTITUTION = 0.05;
// Impulso extra "Psyonix" — não é física real, é design.
export const IMPULSE_Z_SCALE = 0.35;
export const IMPULSE_FWD_SCALE = 0.65;
export const IMPULSE_MAX_REL = 4600;
// escala do impulso extra em função da velocidade relativa
export const IMPULSE_CURVE = [
  [0, 0.65],
  [500, 0.65],
  [2300, 0.55],
  [4600, 0.3],
] as const;

// ---------------------------------------------------------------- demolições
export const DEMO_RESPAWN = 3; // segundos

// ---------------------------------------------------------------- partida
export const MATCH_TIME = 300; // 5 minutos
export const KICKOFF_COUNTDOWN = 3;
export const GOAL_REPLAY_TIME = 3.2;
