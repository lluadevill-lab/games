class_name RLTypes
extends RefCounted
## Tipos e fábricas de estado da simulação.


class CarInput:
	var throttle: float = 0.0  # -1..1
	var steer: float = 0.0  # -1..1
	var pitch: float = 0.0  # -1..1
	var yaw: float = 0.0  # -1..1
	var roll: float = 0.0  # -1..1
	var jump: bool = false
	var boost: bool = false
	var handbrake: bool = false

	func clear() -> void:
		throttle = 0.0
		steer = 0.0
		pitch = 0.0
		yaw = 0.0
		roll = 0.0
		jump = false
		boost = false
		handbrake = false

	func duplicate_input() -> CarInput:
		var c := CarInput.new()
		c.throttle = throttle
		c.steer = steer
		c.pitch = pitch
		c.yaw = yaw
		c.roll = roll
		c.jump = jump
		c.boost = boost
		c.handbrake = handbrake
		return c


class CarState:
	var id: int = 0
	var team: int = 0  # 0 = azul (defende -Y), 1 = laranja (defende +Y)
	var is_bot: bool = false

	var pos: Vector3 = Vector3(0, 0, RLConstants.REST_HEIGHT)
	var vel: Vector3 = Vector3.ZERO
	var ang: Vector3 = Vector3.ZERO  # rad/s no mundo
	var rot: Quaternion = Quaternion.IDENTITY

	var boost: float = RLConstants.BOOST_START

	var on_ground: bool = true
	var ground_normal: Vector3 = Vector3.UP
	var air_time: float = 0.0

	var wheel_compression: Array = [0.0, 0.0, 0.0, 0.0]
	var wheel_contact: Array = [false, false, false, false]

	var jump_held: bool = false
	var jump_timer: float = 0.0
	var has_jump: bool = true
	var has_flip: bool = true
	var since_jump: float = 0.0
	var ground_suppress: float = 0.0
	var dodge_timer: float = 0.0
	var dodge_dir: Vector2 = Vector2.ZERO
	var dodge_cancelled: bool = false

	var supersonic: bool = false
	var demo_timer: float = 0.0

	var input: CarInput = CarInput.new()
	var last_impact_speed: float = 0.0
	var hit_ball_timer: float = 0.0

	func forward() -> Vector3:
		return rot * Vector3(1, 0, 0)

	func right() -> Vector3:
		## Direita do carro = -Y local (sistema destro X-frente Z-cima).
		return rot * Vector3(0, -1, 0)

	func left() -> Vector3:
		return rot * Vector3(0, 1, 0)

	func up() -> Vector3:
		return rot * Vector3(0, 0, 1)

	func speed() -> float:
		return vel.length()


class BallState:
	var pos: Vector3 = Vector3(0, 0, RLConstants.BALL_RADIUS)
	var vel: Vector3 = Vector3.ZERO
	var ang: Vector3 = Vector3.ZERO


class PadState:
	var active: bool = true
	var timer: float = 0.0


class WorldState:
	var time: float = 0.0
	var cars: Array = []  # Array[CarState]
	var ball: BallState = BallState.new()
	var pads: Array = []  # Array[PadState]
	var score: Array = [0, 0]  # [azul, laranja]
	var clock: float = RLConstants.MATCH_TIME
	var phase: String = "kickoff"  # kickoff | play | goal | over | warmup
	var phase_timer: float = RLConstants.KICKOFF_COUNTDOWN
	var overtime: bool = false
	var last_touch: Dictionary = {}  # {car_id, team}
	var events: Array = []  # Array[Dictionary]


static func make_car(id: int, team: int, is_bot: bool) -> CarState:
	var c := CarState.new()
	c.id = id
	c.team = team
	c.is_bot = is_bot
	c.pos = Vector3(0, 0, RLConstants.REST_HEIGHT)
	c.boost = RLConstants.BOOST_START
	c.ground_normal = Vector3.UP
	c.input = CarInput.new()
	return c


static func make_ball() -> BallState:
	var b := BallState.new()
	b.pos = Vector3(0, 0, RLConstants.BALL_RADIUS)
	return b


static func quat_from_euler_yaw_pitch_roll(yaw: float, pitch: float, roll: float) -> Quaternion:
	## Ordem RL: yaw (Z), pitch (Y), roll (X).
	var cy := cos(yaw * 0.5)
	var sy := sin(yaw * 0.5)
	var cp := cos(pitch * 0.5)
	var sp := sin(pitch * 0.5)
	var cr := cos(roll * 0.5)
	var sr := sin(roll * 0.5)
	var q := Quaternion()
	q.w = cr * cp * cy + sr * sp * sy
	q.x = sr * cp * cy - cr * sp * sy
	q.y = cr * sp * cy + sr * cp * sy
	q.z = cr * cp * sy - sr * sp * cy
	return q.normalized()


static func quat_integrate(q: Quaternion, omega: Vector3, dt: float) -> Quaternion:
	## Integra quaternion com velocidade angular no mundo.
	var half := omega * (dt * 0.5)
	var dq := Quaternion(half.x, half.y, half.z, 0.0)
	# q' = q + 0.5 * omega_quat * q
	var added := dq * q
	var out := Quaternion(q.x + added.x, q.y + added.y, q.z + added.z, q.w + added.w)
	return out.normalized()


static func clamp_len(v: Vector3, max_len: float) -> Vector3:
	var l := v.length()
	if l > max_len and l > 1e-9:
		return v * (max_len / l)
	return v
