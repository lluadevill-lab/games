class_name CarPhysics
extends RefCounted
## Física do carro: suspensão, chão, aéreo, pulo, flip.
## Port 1:1 de rocket/src/sim/car.ts

const WHEELS := [
	[RLConstants.WHEEL_FRONT_X, RLConstants.WHEEL_Y],
	[RLConstants.WHEEL_FRONT_X, -RLConstants.WHEEL_Y],
	[RLConstants.WHEEL_REAR_X, RLConstants.WHEEL_Y],
	[RLConstants.WHEEL_REAR_X, -RLConstants.WHEEL_Y],
]

static var _corners: Array = []


static func _ensure_corners() -> void:
	if _corners.size() > 0:
		return
	var hx := RLConstants.HITBOX_L * 0.5
	var hy := RLConstants.HITBOX_W * 0.5
	var hz := RLConstants.HITBOX_H * 0.5
	for sx in [-1.0, 1.0]:
		for sy in [-1.0, 1.0]:
			for sz in [-1.0, 1.0]:
				_corners.append(Vector3(sx * hx, sy * hy, sz * hz + RLConstants.HITBOX_OFFSET_Z))


static func sample_suspension(car: RLTypes.CarState) -> float:
	for i in range(4):
		car.wheel_compression[i] = 0.0
		car.wheel_contact[i] = false

	if car.ground_suppress > 0.0:
		car.on_ground = false
		return INF

	var contacts := 0
	var compressed := 0
	var nx := 0.0
	var ny := 0.0
	var nz := 0.0
	var min_dist := INF

	for i in range(4):
		var lx: float = WHEELS[i][0]
		var ly: float = WHEELS[i][1]
		var local := Vector3(lx, ly, RLConstants.WHEEL_Z)
		var wheel_pos: Vector3 = car.pos + car.rot * local
		var hit: Dictionary = Arena.arena_distance(wheel_pos)
		var d: float = hit.d
		var n: Vector3 = hit.n
		if d < min_dist:
			min_dist = d
		if d < RLConstants.WHEEL_RADIUS + RLConstants.SUSPENSION_TRAVEL:
			contacts += 1
			nx += n.x
			ny += n.y
			nz += n.z
			car.wheel_contact[i] = true
			car.wheel_compression[i] = clampf(
				(RLConstants.WHEEL_RADIUS - d) / RLConstants.SUSPENSION_TRAVEL, 0.0, 1.0
			)
			if d < RLConstants.WHEEL_RADIUS + RLConstants.SUSPENSION_TRAVEL * 0.7:
				compressed += 1

	if contacts > 0:
		car.ground_normal = Vector3(nx / contacts, ny / contacts, nz / contacts).normalized()
	car.on_ground = contacts >= 3 and compressed >= 3
	return min_dist


static func apply_suspension(car: RLTypes.CarState, dt: float) -> void:
	if car.ground_suppress > 0.0:
		return

	for i in range(4):
		if not car.wheel_contact[i]:
			continue
		var lx: float = WHEELS[i][0]
		var ly: float = WHEELS[i][1]
		var local := Vector3(lx, ly, RLConstants.WHEEL_Z)
		var lever: Vector3 = car.rot * local
		var wheel_pos: Vector3 = car.pos + lever
		var hit: Dictionary = Arena.arena_distance(wheel_pos)
		var d: float = hit.d
		var n: Vector3 = hit.n
		if d >= RLConstants.WHEEL_RADIUS:
			continue

		var wheel_vel: Vector3 = car.vel + car.ang.cross(lever)
		var compression := RLConstants.WHEEL_RADIUS - d
		var vn := wheel_vel.dot(n)
		var target_vn := clampf(compression * RLConstants.SUSPENSION_STIFFNESS, 0.0, 160.0)
		var dv := (target_vn - vn * RLConstants.SUSPENSION_DAMPING) * 0.25
		var push := clampf(dv, 0.0, RLConstants.SUSPENSION_MAX_PUSH * dt)
		if push <= 0.0:
			continue

		var impulse: Vector3 = n * push
		car.vel += impulse
		var torque: Vector3 = lever.cross(impulse)
		car.ang += torque * RLConstants.SUSPENSION_TORQUE_RESPONSE

	if car.on_ground:
		car.vel += car.ground_normal * (-RLConstants.STICKY_ACCEL * dt)


static func align_to_surface(car: RLTypes.CarState, dt: float) -> void:
	var up := car.up()
	var n := car.ground_normal
	var axis := up.cross(n)
	var s := axis.length()
	if s < 1e-5:
		return
	var angle := asin(clampf(s, -1.0, 1.0))
	axis = axis * ((1.0 / s) * minf(angle * 25.0, 25.0))
	car.ang.x += axis.x * dt * 12.0
	car.ang.y += axis.y * dt * 12.0
	car.ang.z += axis.z * dt * 12.0


static func ground_drive(car: RLTypes.CarState, inp: RLTypes.CarInput, dt: float) -> void:
	var fwd := car.forward()
	var right := car.right()
	var n := car.ground_normal

	fwd = (fwd - n * fwd.dot(n)).normalized()
	right = (right - n * right.dot(n)).normalized()

	var v_fwd := car.vel.dot(fwd)
	var v_right := car.vel.dot(right)
	var speed := car.vel.length()

	var t := inp.throttle
	if absf(t) > 0.01:
		if v_fwd * t < -10.0:
			car.vel += fwd * (RLConstants.sign1(t) * RLConstants.BRAKE_ACCEL * dt)
		else:
			var accel := RLConstants.curve_lookup(RLConstants.THROTTLE_CURVE, absf(v_fwd)) * t
			car.vel += fwd * (accel * dt)
	elif absf(v_fwd) > 1.0:
		var dec := minf(RLConstants.COAST_DECEL * dt, absf(v_fwd))
		car.vel += fwd * (-RLConstants.sign1(v_fwd) * dec)

	# steer: +1 = direita → sinal negativo (sistema destro, +yaw = esquerda)
	var steer := clampf(inp.steer, -1.0, 1.0)
	if absf(steer) > 0.01:
		var curvature := RLConstants.curve_lookup(RLConstants.STEER_CURVE, minf(speed, 2300.0))
		var yaw_rate := -curvature * maxf(speed, 10.0) * steer * RLConstants.sign1(v_fwd if absf(v_fwd) > 1e-6 else 1.0)
		if inp.handbrake:
			yaw_rate *= 1.6
		car.ang += n * (yaw_rate - car.ang.dot(n))
	else:
		car.ang += n * (-car.ang.dot(n) * minf(1.0, dt * 12.0))

	var grip := RLConstants.LATERAL_GRIP_SLIDE if inp.handbrake else RLConstants.LATERAL_GRIP
	var max_lat := grip * dt
	var corr := clampf(-v_right, -max_lat, max_lat)
	car.vel += right * corr


static func air_control(car: RLTypes.CarState, inp: RLTypes.CarInput, dt: float) -> void:
	var fwd := car.forward()
	var right := car.right()
	var up := car.up()

	var wx := car.ang.dot(fwd)  # roll
	var wy := car.ang.dot(right)  # pitch
	var wz := car.ang.dot(up)  # yaw

	var pitch_in := clampf(inp.pitch, -1.0, 1.0)
	var yaw_in := clampf(inp.yaw, -1.0, 1.0)
	var roll_in := clampf(inp.roll, -1.0, 1.0)

	if inp.handbrake:
		roll_in = clampf(roll_in + inp.steer, -1.0, 1.0)
		yaw_in = 0.0

	var t_roll := RLConstants.AIR_ROLL * roll_in - (RLConstants.DAMP_ROLL * wx if roll_in == 0.0 else 0.0)
	var t_pitch := RLConstants.AIR_PITCH * pitch_in - (RLConstants.DAMP_PITCH * wy if pitch_in == 0.0 else 0.0)
	var t_yaw := -RLConstants.AIR_YAW * yaw_in - (RLConstants.DAMP_YAW * wz if yaw_in == 0.0 else 0.0)

	car.ang += fwd * (t_roll * dt)
	car.ang += right * (t_pitch * dt)
	car.ang += up * (t_yaw * dt)


static func handle_jump(car: RLTypes.CarState, inp: RLTypes.CarInput, dt: float, events: Array) -> void:
	var pressed := inp.jump and not car.jump_held

	if car.dodge_timer > 0.0:
		car.dodge_timer -= dt
		if not car.dodge_cancelled:
			var opp := -car.dodge_dir.x * inp.pitch - car.dodge_dir.y * inp.yaw
			if opp > 0.5 and car.dodge_timer < RLConstants.DODGE_TIME - 0.08:
				car.dodge_cancelled = true
				car.ang = Vector3.ZERO
		if not car.dodge_cancelled:
			var fwd := car.forward()
			var right := car.right()
			var axis := fwd * car.dodge_dir.y + right * (-car.dodge_dir.x)
			if axis.length() > 1e-6:
				axis = axis.normalized() * RLConstants.DODGE_TORQUE
			car.ang = axis
		if car.dodge_timer <= 0.0:
			car.dodge_cancelled = false

	if car.ground_suppress > 0.0:
		car.ground_suppress -= dt

	if car.on_ground:
		car.has_jump = true
		car.has_flip = true
		car.since_jump = 0.0
	else:
		car.since_jump += dt
		if car.since_jump > RLConstants.FLIP_WINDOW:
			car.has_flip = false

	if pressed:
		if car.on_ground and car.has_jump:
			car.vel += car.ground_normal * RLConstants.JUMP_IMPULSE
			car.has_jump = false
			car.has_flip = true
			car.since_jump = 0.0
			car.jump_timer = 0.0
			car.on_ground = false
			car.ground_suppress = 0.06
			events.append({"type": "jump", "car_id": car.id})
		elif car.has_flip and car.dodge_timer <= 0.0:
			var dx := clampf(-inp.pitch, -1.0, 1.0)
			var dy := clampf(inp.yaw + inp.steer, -1.0, 1.0)
			var mag := sqrt(dx * dx + dy * dy)
			if mag > 0.2:
				var ux := dx / mag
				var uy := dy / mag
				car.dodge_dir = Vector2(ux, uy)
				car.dodge_timer = RLConstants.DODGE_TIME
				car.dodge_cancelled = false

				var fwd2 := car.forward()
				var right2 := car.right()
				fwd2.z = 0.0
				right2.z = 0.0
				if fwd2.length() < 1e-4:
					fwd2 = Vector3(1, 0, 0)
				else:
					fwd2 = fwd2.normalized()
				if right2.length() < 1e-4:
					right2 = Vector3(fwd2.y, -fwd2.x, 0)
				else:
					right2 = right2.normalized()

				var dir := fwd2 * ux + right2 * uy
				if dir.length() < 1e-4:
					dir = fwd2
				dir = dir.normalized()

				var impulse := RLConstants.DODGE_IMPULSE
				if absf(ux) <= 0.75 and absf(uy) <= 0.75:
					impulse *= 0.92
				car.vel.z += RLConstants.DODGE_BACK_UP_IMPULSE if ux < -0.3 else RLConstants.DODGE_UP_IMPULSE
				car.vel += dir * impulse
				events.append({"type": "flip", "car_id": car.id})
			else:
				car.vel += Vector3(0, 0, 1) * RLConstants.JUMP_IMPULSE
				events.append({"type": "jump", "car_id": car.id})
			car.has_flip = false

	if inp.jump and not car.on_ground and car.jump_timer < RLConstants.JUMP_HOLD_TIME and car.since_jump < 0.25:
		car.jump_timer += dt
		car.vel += car.ground_normal * (RLConstants.JUMP_HOLD_ACCEL * dt)

	car.jump_held = inp.jump


static func step_car(car: RLTypes.CarState, dt: float, events: Array) -> void:
	if car.demo_timer > 0.0:
		car.demo_timer -= dt
		return

	var inp := car.input
	var was_ground := car.on_ground
	sample_suspension(car)

	if car.dodge_timer > 0.0:
		car.on_ground = false

	if car.on_ground and not was_ground:
		events.append({"type": "landing", "car_id": car.id, "speed": absf(car.vel.z)})

	handle_jump(car, inp, dt, events)

	var gravity_scale := RLConstants.DODGE_GRAVITY_SCALE if car.dodge_timer > 0.0 else 1.0
	car.vel.z -= RLConstants.GRAVITY * gravity_scale * dt

	if car.on_ground:
		apply_suspension(car, dt)
		align_to_surface(car, dt)
		ground_drive(car, inp, dt)
		car.air_time = 0.0
	else:
		car.air_time += dt
		if car.dodge_timer <= 0.0:
			air_control(car, inp, dt)

	if inp.boost and car.boost > 0.0:
		car.vel += car.forward() * (RLConstants.BOOST_ACCEL * dt)
		car.boost = maxf(0.0, car.boost - RLConstants.BOOST_USE * dt)

	car.vel = RLTypes.clamp_len(car.vel, RLConstants.CAR_MAX_SPEED)
	car.ang = RLTypes.clamp_len(car.ang, RLConstants.MAX_ANG_SPEED)
	car.supersonic = car.vel.length() >= RLConstants.SUPERSONIC_SPEED

	car.pos += car.vel * dt
	car.rot = RLTypes.quat_integrate(car.rot, car.ang, dt)

	if car.hit_ball_timer > 0.0:
		car.hit_ball_timer -= dt


static func resolve_car_arena(car: RLTypes.CarState) -> void:
	if car.demo_timer > 0.0:
		return
	_ensure_corners()

	var push := Vector3.ZERO
	var worst := 0.0

	for local in _corners:
		var world: Vector3 = car.pos + car.rot * local
		var hit: Dictionary = Arena.arena_distance(world)
		var d: float = hit.d
		var n: Vector3 = hit.n
		if d < 0.0:
			var pen := -d
			if pen > worst:
				worst = pen
			push += n * pen

	if worst <= 0.0:
		return

	var n2 := push.normalized()
	car.pos += n2 * worst

	var vn := car.vel.dot(n2)
	if vn < 0.0:
		car.vel += n2 * (-vn * 1.15)

	car.ang *= maxf(0.0, 1.0 - worst * 0.12)

	var up := car.up()
	var axis := up.cross(n2)
	var s2 := axis.length()
	if s2 > 1e-4:
		var angle := asin(clampf(s2, -1.0, 1.0))
		var flipped := up.dot(n2) < 0.0
		var mag := (PI - angle) if flipped else angle
		axis = axis * ((1.0 / s2) * mag * 6.0)
		car.ang += axis * 0.14
		car.ang = RLTypes.clamp_len(car.ang, RLConstants.MAX_ANG_SPEED)
