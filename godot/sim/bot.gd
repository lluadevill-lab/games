class_name BotAI
extends RefCounted
## Bot com máquina de estados. Produz o mesmo CarInput de um humano.

const SKILL := {
	"facil": {"reaction": 0.28, "boost_use": 0.3, "aerial": false, "speed_cap": 1250.0, "err": 260.0},
	"medio": {"reaction": 0.14, "boost_use": 0.65, "aerial": true, "speed_cap": 1900.0, "err": 110.0},
	"dificil": {"reaction": 0.05, "boost_use": 0.95, "aerial": true, "speed_cap": 2300.0, "err": 25.0},
}

var _memories: Dictionary = {}  # car_id -> Dictionary
var rng: SimRng = SimRng.new()


func reset() -> void:
	_memories.clear()


func _mem(car_id: int) -> Dictionary:
	if not _memories.has(car_id):
		_memories[car_id] = {
			"pred": [],
			"pred_age": 99.0,
			"target": Vector3.ZERO,
			"state": "chase",
			"state_timer": 0.0,
			"flip_cd": 0.0,
			"reaction": 0.0,
		}
	return _memories[car_id]


func drive(car: RLTypes.CarState, world: RLTypes.WorldState, dt: float, skill: String = "medio") -> void:
	var cfg: Dictionary = SKILL.get(skill, SKILL["medio"])
	var mem := _mem(car.id)
	var inp := car.input
	inp.clear()

	if car.demo_timer > 0.0:
		return
	if world.phase == "goal" or world.phase == "over":
		return

	mem.flip_cd -= dt
	mem.state_timer += dt
	mem.pred_age += dt
	mem.reaction -= dt

	if mem.pred_age > 0.1:
		mem.pred = BallPredict.predict_ball(world.ball, 70, 1.0 / 25.0)
		mem.pred_age = 0.0

	var ball := world.ball
	var my_sign := -1.0 if car.team == 0 else 1.0
	var own_goal_y := my_sign * RLConstants.FIELD_Y
	var enemy_goal_y := -my_sign * RLConstants.FIELD_Y

	var car_speed := maxf(car.vel.length(), 600.0)
	var reach := minf(car_speed + (900.0 if car.boost > 20.0 else 350.0), 2300.0)
	var aim := ball.pos
	for s in mem.pred:
		if s.pos.z > 260.0 and not cfg["aerial"]:
			continue
		var d: float = car.pos.distance_to(s.pos)
		if d / reach <= s.t:
			aim = s.pos
			break

	if cfg["err"] > 0.0:
		var d_now := Vector2(ball.pos.x - car.pos.x, ball.pos.y - car.pos.y).length()
		var e: float = float(cfg["err"]) * clampf(d_now / 2000.0, 0.0, 1.0)
		aim.x += sin(world.time * 1.7 + car.id) * e
		aim.y += cos(world.time * 1.3 + car.id * 2.0) * e * 0.5

	var dist_to_ball := Vector2(ball.pos.x - car.pos.x, ball.pos.y - car.pos.y).length()
	var behind_margin := (car.pos.y - aim.y) * my_sign > -350.0
	var behind_ball := (car.pos.y - aim.y) * my_sign > 0.0
	var ball_in_own := ball.pos.y * my_sign > 500.0
	var low_boost := car.boost < 20.0

	var st := "chase"
	if not behind_margin and dist_to_ball > 1100.0:
		st = "rotate"
	elif ball_in_own and absf(ball.pos.y) > 3400.0 and not behind_margin:
		st = "defend"
	elif low_boost and dist_to_ball > 2600.0 and not ball_in_own:
		st = "boost"
	if world.phase == "kickoff":
		st = "kickoff"
	mem.state = st

	var tx := aim.x
	var ty := aim.y
	var tz := aim.z

	if st == "kickoff":
		tx = 0.0
		ty = 0.0
		tz = RLConstants.BALL_RADIUS
		inp.boost = true
	elif st == "chase":
		var goal_x := 0.0
		var post := RLConstants.GOAL_HALF_W * 0.62
		var keeper: RLTypes.CarState = null
		for c in world.cars:
			if c.team != car.team and c.demo_timer <= 0.0:
				keeper = c
				break
		if keeper and absf(keeper.pos.y - enemy_goal_y) < 2600.0:
			goal_x = -post if keeper.pos.x > 0.0 else post
		else:
			goal_x = clampf(aim.x * 0.3, -post, post)

		var dx := aim.x - goal_x
		var dy := aim.y - enemy_goal_y
		var dl := sqrt(dx * dx + dy * dy)
		if dl < 1e-6:
			dl = 1.0
		dx /= dl
		dy /= dl

		var cbx := car.pos.x - aim.x
		var cby := car.pos.y - aim.y
		var cbl := sqrt(cbx * cbx + cby * cby)
		if cbl < 1e-6:
			cbl = 1.0
		var alignment := (cbx * dx + cby * dy) / cbl
		var base := RLConstants.BALL_RADIUS + RLConstants.HITBOX_L * 0.5
		var detour := 0.0 if alignment > 0.6 else (0.6 - alignment) * 900.0
		tx = aim.x + dx * (base + detour)
		ty = aim.y + dy * (base + detour)
		tz = aim.z
	elif st == "rotate":
		var side := RLConstants.sign1(car.pos.x - ball.pos.x if absf(car.pos.x - ball.pos.x) > 1e-6 else 1.0)
		tx = clampf(ball.pos.x + side * 1100.0, -3300.0, 3300.0)
		ty = ball.pos.y + my_sign * 1250.0
		tz = 0.0
	elif st == "defend":
		tx = clampf(ball.pos.x * 0.5, -RLConstants.GOAL_HALF_W, RLConstants.GOAL_HALF_W)
		ty = own_goal_y * 0.86
		tz = 0.0
		if dist_to_ball < 900.0 and behind_ball:
			tx = aim.x
			ty = aim.y + my_sign * (RLConstants.BALL_RADIUS + 40.0)
			tz = aim.z
	elif st == "boost":
		var best := INF
		var bx := car.pos.x
		var by := car.pos.y
		for i in BoostPads.PADS.size():
			if not world.pads[i].active:
				continue
			var p: Dictionary = BoostPads.PADS[i]
			var d2 := Vector2(p.x - car.pos.x, p.y - car.pos.y).length()
			d2 += 0.0 if p.big else 1400.0
			d2 += absf(p.y - own_goal_y) * 0.25
			if d2 < best:
				best = d2
				bx = p.x
				by = p.y
		tx = bx
		ty = by
		tz = 0.0

	mem.target = Vector3(tx, ty, tz)
	var to_target := Vector3(tx - car.pos.x, ty - car.pos.y, tz - car.pos.z)
	var dist_target := to_target.length()

	if car.on_ground:
		var fwd := car.forward()
		var right := car.right()
		var ahead := to_target.dot(fwd)
		var side_v := to_target.dot(right)
		var angle := atan2(side_v, ahead)
		var speed := car.vel.length()

		inp.steer = clampf(angle * 2.6, -1.0, 1.0)

		var turn_penalty := 1.0 - minf(absf(angle) / 2.2, 0.8)
		var speed_cap: float = float(cfg["speed_cap"])
		var desired: float = minf(speed_cap, 500.0 + dist_target * 1.4) * turn_penalty
		if st == "chase" and dist_to_ball < 900.0:
			desired = maxf(desired, minf(speed_cap, 1300.0))
		var wall_dist := minf(
			RLConstants.FIELD_X - absf(car.pos.x),
			RLConstants.FIELD_Y - absf(car.pos.y)
		)
		if wall_dist < 700.0 and absf(angle) < 0.6:
			desired = minf(desired, 400.0 + wall_dist * 1.5)

		if ahead < 0.0 and dist_target < 900.0:
			inp.throttle = -1.0
			inp.steer = -inp.steer
		elif speed > desired + 120.0:
			inp.throttle = -0.6
		elif speed < desired:
			inp.throttle = 1.0
		else:
			inp.throttle = 0.35

		inp.handbrake = absf(angle) > 1.2 and speed > 900.0
		inp.boost = (
			inp.boost
			or (
				absf(angle) < 0.28
				and speed < desired - 150.0
				and speed < speed_cap
				and car.boost > 6.0
				and rng.next() < float(cfg["boost_use"])
				and dist_target > 700.0
			)
		)

		if (
			dist_target > 2600.0
			and absf(angle) < 0.15
			and speed > 1100.0
			and car.boost < 10.0
			and mem.flip_cd <= 0.0
		):
			inp.jump = true
			inp.pitch = -1.0
			mem.flip_cd = 1.5

		var ball_z := ball.pos.z
		if (
			cfg["aerial"]
			and ball_z > 320.0
			and ball_z < 900.0
			and dist_to_ball < 700.0
			and dist_to_ball > 180.0
			and absf(angle) < 0.4
			and behind_margin
			and mem.flip_cd <= 0.0
		):
			inp.jump = true
			mem.flip_cd = 1.0
	else:
		inp.throttle = 1.0
		var ball_high := ball.pos.z > 300.0
		var going: bool = cfg["aerial"] and ball_high and dist_to_ball < 1700.0 and behind_margin
		if going:
			var desired_fwd: Vector3 = (ball.pos - car.pos).normalized()
			var errs := _aim_orientation(car, inp, desired_fwd, Vector3.UP)
			inp.boost = absf(errs.x) < 0.3 and absf(errs.y) < 0.4 and car.boost > 4.0
			if car.has_flip and dist_to_ball < 300.0 and absf(errs.x) < 0.4 and car.air_time > 0.15:
				inp.jump = true
				inp.pitch = -1.0
		else:
			var vh := Vector2(car.vel.x, car.vel.y).length()
			var desired_fwd2: Vector3
			if vh > 200.0:
				desired_fwd2 = Vector3(car.vel.x / vh, car.vel.y / vh, 0.0)
			else:
				desired_fwd2 = Vector3(tx - car.pos.x, ty - car.pos.y, 0.0)
				if desired_fwd2.length() < 1.0:
					desired_fwd2 = Vector3(1, 0, 0)
				desired_fwd2 = desired_fwd2.normalized()
			_aim_orientation(car, inp, desired_fwd2, Vector3.UP)
			inp.boost = false

	# segurança: não ficar dentro do próprio gol
	if absf(car.pos.y) > RLConstants.FIELD_Y - 200.0 and absf(car.pos.x) < RLConstants.GOAL_HALF_W:
		if (car.pos.y - ball.pos.y) * my_sign > 0.0:
			inp.throttle = 1.0


func _aim_orientation(
	car: RLTypes.CarState, inp: RLTypes.CarInput, desired_fwd: Vector3, desired_up: Vector3
) -> Vector2:
	var d_fwd := desired_fwd.normalized()
	var d_up := desired_up
	d_up = (d_up - d_fwd * d_up.dot(d_fwd))
	if d_up.length() < 1e-4:
		d_up = Vector3.UP
	d_up = d_up.normalized()
	var d_right := d_up.cross(d_fwd).normalized()

	var fwd := car.forward()
	var right := car.right()
	var up := car.up()

	var axis := Vector3.ZERO
	axis += fwd.cross(d_fwd)
	axis += right.cross(d_right)
	axis += up.cross(d_up)
	axis *= 0.5

	var e_roll := axis.dot(fwd)
	var e_pitch := axis.dot(right)
	var e_yaw := axis.dot(up)

	var w_roll := car.ang.dot(fwd)
	var w_pitch := car.ang.dot(right)
	var w_yaw := car.ang.dot(up)

	inp.roll = clampf(e_roll * 2.2 - w_roll * 0.35, -1.0, 1.0)
	inp.pitch = clampf(e_pitch * 2.8 - w_pitch * 0.45, -1.0, 1.0)
	# yaw positivo no input = direita, mas erro e_yaw é em torno de up (+ = esquerda)
	inp.yaw = clampf(-(e_yaw * 2.5 - w_yaw * 0.4), -1.0, 1.0)
	return Vector2(e_yaw, e_pitch)


func bot_state(car_id: int) -> String:
	if _memories.has(car_id):
		return _memories[car_id].state
	return "-"
