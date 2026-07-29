class_name SimWorld
extends RefCounted
## Mundo: passo fixo 1/120 s, regras, kickoff, pads. Sem renderer.

const KICKOFF_SPOTS := [
	Vector2(-2048, -2560),
	Vector2(2048, -2560),
	Vector2(-256, -3840),
	Vector2(256, -3840),
	Vector2(0, -4608),
]

var state: RLTypes.WorldState
var rng: SimRng = SimRng.new()


func create(opts: Dictionary = {}) -> void:
	var seed_v: int = opts.get("seed", 0x9E3779B9)
	rng.reseed(seed_v)

	var bot_count: int = opts.get("bot_count", 1)
	var match_time: float = opts.get("match_time", RLConstants.MATCH_TIME)
	var free_play: bool = opts.get("free_play", false)

	state = RLTypes.WorldState.new()
	state.cars = [RLTypes.make_car(0, 0, false)]
	for i in range(bot_count):
		state.cars.append(RLTypes.make_car(i + 1, 1, true))
	state.ball = RLTypes.make_ball()
	state.pads = BoostPads.make_pad_states()
	state.score = [0, 0]
	state.clock = match_time
	state.phase = "play" if free_play else "kickoff"
	state.phase_timer = 0.0 if free_play else RLConstants.KICKOFF_COUNTDOWN
	state.overtime = false
	state.events = []
	reset_kickoff(not free_play)


func reset_kickoff(countdown: bool = true) -> void:
	var spot_index := rng.rand_int(KICKOFF_SPOTS.size())
	var blue: Array = []
	var orange: Array = []
	for c in state.cars:
		if c.team == 0:
			blue.append(c)
		else:
			orange.append(c)

	for i in blue.size():
		_place_kickoff(blue[i], spot_index, i, 0)
	for i in orange.size():
		_place_kickoff(orange[i], spot_index, i, 1)

	state.ball.pos = Vector3(0, 0, RLConstants.BALL_RADIUS + 2.0)
	state.ball.vel = Vector3.ZERO
	state.ball.ang = Vector3.ZERO

	for p in state.pads:
		p.active = true
		p.timer = 0.0

	state.last_touch = {}
	state.phase = "kickoff" if countdown else "play"
	state.phase_timer = RLConstants.KICKOFF_COUNTDOWN if countdown else 0.0
	state.events.append({"type": "kickoff"})


func _place_kickoff(car: RLTypes.CarState, spot_index: int, i: int, team: int) -> void:
	var idx := (spot_index + i) % KICKOFF_SPOTS.size()
	var spot: Vector2 = KICKOFF_SPOTS[idx]
	var mirror := -1.0 if team == 1 else 1.0
	car.pos = Vector3(spot.x * mirror, spot.y * mirror, RLConstants.REST_HEIGHT)
	car.vel = Vector3.ZERO
	car.ang = Vector3.ZERO
	var yaw := atan2(-car.pos.y, -car.pos.x)
	car.rot = RLTypes.quat_from_euler_yaw_pitch_roll(yaw, 0.0, 0.0)
	car.boost = RLConstants.BOOST_START
	car.on_ground = true
	car.ground_normal = Vector3.UP
	car.has_jump = true
	car.has_flip = true
	car.ground_suppress = 0.0
	car.dodge_timer = 0.0
	car.demo_timer = 0.0
	car.supersonic = false
	CarPhysics.sample_suspension(car)


func _respawn_car(car: RLTypes.CarState) -> void:
	var mirror := -1.0 if car.team == 1 else 1.0
	car.pos = Vector3(rng.range(-2000, 2000), -4300.0 * mirror, RLConstants.REST_HEIGHT)
	car.vel = Vector3.ZERO
	car.ang = Vector3.ZERO
	var yaw := PI * 0.5 if car.team == 0 else -PI * 0.5
	car.rot = RLTypes.quat_from_euler_yaw_pitch_roll(yaw, 0.0, 0.0)
	car.boost = RLConstants.BOOST_START
	car.on_ground = true
	car.ground_normal = Vector3.UP
	car.has_jump = true
	car.has_flip = true
	car.ground_suppress = 0.0
	car.dodge_timer = 0.0


func _update_pads(dt: float) -> void:
	for i in BoostPads.PADS.size():
		var def: Dictionary = BoostPads.PADS[i]
		var st: RLTypes.PadState = state.pads[i]
		if not st.active:
			st.timer -= dt
			if st.timer <= 0.0:
				st.active = true
			continue
		var r: float = BoostPads.BIG_PAD_RADIUS if def.big else BoostPads.SMALL_PAD_RADIUS
		var h: float = BoostPads.PAD_HEIGHT_BIG if def.big else BoostPads.PAD_HEIGHT_SMALL
		for car in state.cars:
			if car.demo_timer > 0.0:
				continue
			if car.boost >= RLConstants.BOOST_MAX and not def.big:
				continue
			var dx: float = car.pos.x - def.x
			var dy: float = car.pos.y - def.y
			if dx * dx + dy * dy < r * r and car.pos.z < h:
				st.active = false
				st.timer = BoostPads.BIG_PAD_RESPAWN if def.big else BoostPads.SMALL_PAD_RESPAWN
				var amount: float = BoostPads.BIG_PAD_AMOUNT if def.big else BoostPads.SMALL_PAD_AMOUNT
				car.boost = minf(RLConstants.BOOST_MAX, car.boost + amount)
				state.events.append({"type": "pad", "big": def.big, "car_id": car.id})
				break


func step(dt: float) -> void:
	var ev := state.events

	if state.phase == "kickoff":
		state.phase_timer -= dt
		if state.phase_timer <= 0.0:
			state.phase = "play"
	elif state.phase == "goal":
		state.phase_timer -= dt
		if state.phase_timer <= 0.0:
			if state.clock <= 0.0 and not _is_tied():
				state.phase = "over"
				ev.append({"type": "match_end"})
			else:
				reset_kickoff(true)
	elif state.phase == "over":
		return

	var frozen := state.phase == "kickoff" or state.phase == "goal"

	for car in state.cars:
		if car.demo_timer > 0.0:
			car.demo_timer -= dt
			if car.demo_timer <= 0.0:
				_respawn_car(car)
			continue
		if frozen:
			car.vel = Vector3.ZERO
			car.ang = Vector3.ZERO
			CarPhysics.sample_suspension(car)
			continue
		CarPhysics.step_car(car, dt, ev)
		CarPhysics.resolve_car_arena(car)

	if not frozen:
		BallPhysics.step_ball(state.ball, dt)
		BallPhysics.resolve_ball_arena(state.ball, ev)

		for car in state.cars:
			if BallPhysics.resolve_car_ball(car, state.ball, ev):
				state.last_touch = {"car_id": car.id, "team": car.team}

		for i in range(state.cars.size()):
			for j in range(i + 1, state.cars.size()):
				BallPhysics.resolve_car_car(state.cars[i], state.cars[j], ev)

		_update_pads(dt)

	if state.phase == "play":
		state.time += dt
		if state.clock > 0.0:
			state.clock = maxf(0.0, state.clock - dt)

		var g := Arena.ball_in_goal(state.ball.pos, RLConstants.BALL_RADIUS)
		if g != 0:
			# gol em +Y = ponto do azul (ataca +Y)
			var scoring: int = 0 if g == 1 else 1
			state.score[scoring] += 1
			state.phase = "goal"
			state.phase_timer = RLConstants.GOAL_REPLAY_TIME
			ev.append({"type": "goal", "team": scoring, "speed": state.ball.vel.length()})
			if state.overtime:
				state.phase = "over"
				ev.append({"type": "match_end"})
		elif state.clock <= 0.0 and _is_ball_grounded():
			if _is_tied():
				state.overtime = true
				state.clock = 0.0
				reset_kickoff(true)
			else:
				state.phase = "over"
				ev.append({"type": "match_end"})


func _is_tied() -> bool:
	return state.score[0] == state.score[1]


func _is_ball_grounded() -> bool:
	return state.ball.pos.z <= RLConstants.BALL_RADIUS + 6.0 and absf(state.ball.vel.z) < 120.0


func drain_events() -> Array:
	var out: Array = state.events.duplicate()
	state.events.clear()
	return out
