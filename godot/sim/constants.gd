class_name RLConstants
extends RefCounted
## Constantes da física — valores do Rocket League original (uu, uu/s).
## Fontes: RLBot / RocketSim. Ver rocket/MECANICAS.md.

# ---------------------------------------------------------------- mundo
const TICK_RATE := 120
const TICK_DT := 1.0 / 120.0
const GRAVITY := 650.0  # uu/s²

# ---------------------------------------------------------------- arena
const FIELD_X := 4096.0  # meia-largura
const FIELD_Y := 5120.0  # meio-comprimento
const CEILING_Z := 2044.0
const CORNER_D := 8064.0
const GOAL_HALF_W := 892.755
const GOAL_H := 642.775
const GOAL_DEPTH := 880.0
const WALL_FILLET := 256.0
const CORNER_RADIUS := 1152.0

# ---------------------------------------------------------------- bola
const BALL_RADIUS := 91.25
const BALL_MASS := 30.0
const BALL_RESTITUTION := 0.6
const BALL_FRICTION := 0.35
const BALL_DRAG := 0.0305
const BALL_MAX_SPEED := 6000.0
const BALL_MAX_ANG := 6.0

# ---------------------------------------------------------------- carro
const CAR_MASS := 180.0
const HITBOX_L := 118.01
const HITBOX_W := 84.2
const HITBOX_H := 36.16
const HITBOX_OFFSET_Z := 3.0

const WHEEL_RADIUS := 15.0
const WHEEL_FRONT_X := 51.25
const WHEEL_REAR_X := -33.75
const WHEEL_Y := 29.5
const WHEEL_Z := -2.0
const REST_HEIGHT := 17.0
const SUSPENSION_TRAVEL := 18.0
const SUSPENSION_STIFFNESS := 22.0
const SUSPENSION_DAMPING := 0.82
const SUSPENSION_MAX_PUSH := 5200.0
const SUSPENSION_TORQUE_RESPONSE := 0.0016

const CAR_MAX_SPEED := 2300.0
const DRIVE_MAX_SPEED := 1410.0
const SUPERSONIC_SPEED := 2200.0
const MAX_ANG_SPEED := 5.5

const BRAKE_ACCEL := 3500.0
const COAST_DECEL := 525.0
const STICKY_ACCEL := 325.0

# aceleração de throttle em função da velocidade à frente [speed, accel]
const THROTTLE_CURVE := [
	[0.0, 1600.0],
	[1400.0, 160.0],
	[1410.0, 0.0],
]

# curvatura (1/raio) em função da velocidade
const STEER_CURVE := [
	[0.0, 0.0069],
	[500.0, 0.00398],
	[1000.0, 0.00235],
	[1500.0, 0.001375],
	[1750.0, 0.0011],
	[2300.0, 0.00088],
]

const LATERAL_GRIP := 4700.0
const LATERAL_GRIP_SLIDE := 900.0

# ---------------------------------------------------------------- boost
const BOOST_ACCEL := 991.667
const BOOST_USE := 33.3
const BOOST_MAX := 100.0
const BOOST_START := 33.4

# ---------------------------------------------------------------- pulo/flip
const JUMP_IMPULSE := 291.667
const JUMP_HOLD_ACCEL := 1400.0
const JUMP_HOLD_TIME := 0.2
const FLIP_WINDOW := 1.25
const DODGE_IMPULSE := 620.0
const DODGE_UP_IMPULSE := 82.0
const DODGE_BACK_UP_IMPULSE := 120.0
const DODGE_GRAVITY_SCALE := 0.42
const DODGE_TIME := 0.65
const DODGE_TORQUE := 9.0

const AIR_PITCH := 12.46
const AIR_YAW := 9.11
const AIR_ROLL := 38.34
const DAMP_PITCH := 2.798
const DAMP_YAW := 1.886
const DAMP_ROLL := 4.589

# ---------------------------------------------------------------- carro x bola
const CAR_BALL_RESTITUTION := 0.05
const IMPULSE_Z_SCALE := 0.35
const IMPULSE_FWD_SCALE := 0.65
const IMPULSE_MAX_REL := 4600.0
const IMPULSE_CURVE := [
	[0.0, 0.65],
	[500.0, 0.65],
	[2300.0, 0.55],
	[4600.0, 0.3],
]

# ---------------------------------------------------------------- demolições / partida
const DEMO_RESPAWN := 3.0
const MATCH_TIME := 300.0
const KICKOFF_COUNTDOWN := 3.0
const GOAL_REPLAY_TIME := 3.2

# Conversão uu → km/h (1 uu ≈ 1.9 cm)
const UU_TO_KMH := 0.0684


static func curve_lookup(pts: Array, x: float) -> float:
	if x <= pts[0][0]:
		return pts[0][1]
	var last: Array = pts[pts.size() - 1]
	if x >= last[0]:
		return last[1]
	for i in range(1, pts.size()):
		var x1: float = pts[i][0]
		if x <= x1:
			var x0: float = pts[i - 1][0]
			var y0: float = pts[i - 1][1]
			var y1: float = pts[i][1]
			var t := (x - x0) / (x1 - x0 if x1 != x0 else 1.0)
			return y0 + (y1 - y0) * t
	return last[1]


static func clamp_f(v: float, lo: float, hi: float) -> float:
	return clampf(v, lo, hi)


static func damp(a: float, b: float, lambda: float, dt: float) -> float:
	return lerpf(a, b, 1.0 - exp(-lambda * dt))


static func sign1(v: float) -> float:
	return -1.0 if v < 0.0 else 1.0
