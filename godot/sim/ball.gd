class_name BallPhysics
extends RefCounted
## Física da bola + colisão carro×bola (impulso Psyonix) e carro×carro.


static func step_ball(ball: RLTypes.BallState, dt: float) -> void:
	ball.vel.z -= RLConstants.GRAVITY * dt
	var drag := 1.0 - RLConstants.BALL_DRAG * dt
	ball.vel *= drag
	ball.vel = RLTypes.clamp_len(ball.vel, RLConstants.BALL_MAX_SPEED)
	ball.ang = RLTypes.clamp_len(ball.ang, RLConstants.BALL_MAX_ANG)
	ball.pos += ball.vel * dt


static func resolve_ball_arena(ball: RLTypes.BallState, events: Array) -> void:
	var hit: Dictionary = Arena.arena_distance(ball.pos)
	var d: float = hit.d
	var n: Vector3 = hit.n
	if d >= RLConstants.BALL_RADIUS:
		return

	var pen := RLConstants.BALL_RADIUS - d
	ball.pos += n * pen

	var vn := ball.vel.dot(n)
	if vn >= 0.0:
		return

	var impact_speed := -vn
	ball.vel += n * (-vn * (1.0 + RLConstants.BALL_RESTITUTION))

	# spin ↔ atrito tangencial
	var r_vec := n * (-RLConstants.BALL_RADIUS)
	var contact_vel: Vector3 = ball.vel + ball.ang.cross(r_vec)
	contact_vel -= n * contact_vel.dot(n)

	var slip := contact_vel.length()
	if slip > 1e-4:
		var slip_dir := contact_vel.normalized()
		var j := minf(RLConstants.BALL_FRICTION * impact_speed * 2.0, slip) * 0.4
		ball.vel -= slip_dir * j
		var j_vec := slip_dir * (-j)
		var torque: Vector3 = r_vec.cross(j_vec)
		ball.ang += torque * (2.5 / RLConstants.BALL_RADIUS)
		ball.ang = RLTypes.clamp_len(ball.ang, RLConstants.BALL_MAX_ANG)

	if impact_speed > 150.0:
		events.append({"type": "bounce", "speed": impact_speed, "pos": ball.pos})


static func resolve_car_ball(car: RLTypes.CarState, ball: RLTypes.BallState, events: Array) -> bool:
	if car.demo_timer > 0.0:
		return false

	var delta: Vector3 = ball.pos - car.pos
	var dist_sq := delta.length_squared()
	var reach := RLConstants.BALL_RADIUS + RLConstants.HITBOX_L
	if dist_sq > reach * reach:
		return false

	# bola no espaço local do carro
	var local_p: Vector3 = car.rot.inverse() * delta
	local_p.z -= RLConstants.HITBOX_OFFSET_Z

	var hx := RLConstants.HITBOX_L * 0.5
	var hy := RLConstants.HITBOX_W * 0.5
	var hz := RLConstants.HITBOX_H * 0.5
	var closest := Vector3(
		clampf(local_p.x, -hx, hx),
		clampf(local_p.y, -hy, hy),
		clampf(local_p.z, -hz, hz)
	)

	var diff: Vector3 = local_p - closest
	var dist := diff.length()
	if dist >= RLConstants.BALL_RADIUS or dist < 1e-8:
		# se o centro está dentro do OBB, força depenetração pelo eixo mais raso
		if dist < 1e-8:
			var dx := hx - absf(local_p.x)
			var dy := hy - absf(local_p.y)
			var dz := hz - absf(local_p.z)
			if dx <= dy and dx <= dz:
				closest.x = hx if local_p.x > 0.0 else -hx
			elif dy <= dz:
				closest.y = hy if local_p.y > 0.0 else -hy
			else:
				closest.z = hz if local_p.z > 0.0 else -hz
			diff = local_p - closest
			dist = diff.length()
			if dist < 1e-8:
				return false
		else:
			return false

	var n_local := diff.normalized()
	var n: Vector3 = car.rot * n_local
	var world_closest: Vector3 = car.pos + car.rot * (closest + Vector3(0, 0, RLConstants.HITBOX_OFFSET_Z))

	# depenetração
	var pen := RLConstants.BALL_RADIUS - dist
	ball.pos += n * pen

	# velocidade relativa no ponto
	var rel_pt: Vector3 = world_closest - car.pos
	var contact_vel: Vector3 = car.vel + car.ang.cross(rel_pt)
	var rel: Vector3 = ball.vel - contact_vel
	var rel_speed := rel.length()
	var vn := rel.dot(n)

	# 1) impulso rígido (quase inelástico)
	if vn < 0.0:
		var inv_mb := 1.0 / RLConstants.BALL_MASS
		var inv_mc := 1.0 / RLConstants.CAR_MASS
		var jr := (-(1.0 + RLConstants.CAR_BALL_RESTITUTION) * vn) / (inv_mb + inv_mc)
		ball.vel += n * (jr * inv_mb)
		car.vel -= n * (jr * inv_mc)

		# atrito tangencial → spin (dribble)
		var tan: Vector3 = rel - n * vn
		var tan_speed := tan.length()
		if tan_speed > 1e-4:
			tan = tan.normalized()
			var jt := minf(0.35 * absf(jr), tan_speed * RLConstants.BALL_MASS * 0.4)
			ball.vel -= tan * (jt * inv_mb * 0.5)
			var r_ball: Vector3 = world_closest - ball.pos
			var j_vec := tan * (-jt)
			var torque: Vector3 = r_ball.cross(j_vec)
			ball.ang += torque * (2.5 / (RLConstants.BALL_MASS * RLConstants.BALL_RADIUS * RLConstants.BALL_RADIUS))
			ball.ang = RLTypes.clamp_len(ball.ang, RLConstants.BALL_MAX_ANG)

	# 2) impulso extra "Psyonix"
	var dir: Vector3 = (ball.pos - car.pos).normalized()
	var fwd := car.forward()
	dir.z *= RLConstants.IMPULSE_Z_SCALE
	var along := dir.dot(fwd)
	dir += fwd * (along * RLConstants.IMPULSE_FWD_SCALE)
	if dir.length() > 1e-6:
		dir = dir.normalized()

	var rel_clamped := minf(rel_speed, RLConstants.IMPULSE_MAX_REL)
	var scale_f := RLConstants.curve_lookup(RLConstants.IMPULSE_CURVE, rel_clamped)
	var extra := rel_clamped * scale_f
	if vn < 0.0:
		ball.vel += dir * (extra * 0.55)

	ball.vel = RLTypes.clamp_len(ball.vel, RLConstants.BALL_MAX_SPEED)

	var hit_speed := ball.vel.length()
	if car.hit_ball_timer <= 0.0:
		events.append({"type": "ball_hit", "car_id": car.id, "speed": hit_speed, "pos": ball.pos})
	car.hit_ball_timer = 0.08
	car.last_impact_speed = hit_speed
	return true


static func resolve_car_car(a: RLTypes.CarState, b: RLTypes.CarState, events: Array) -> void:
	if a.demo_timer > 0.0 or b.demo_timer > 0.0:
		return
	var delta: Vector3 = b.pos - a.pos
	var d := delta.length()
	var min_d := RLConstants.HITBOX_L * 0.72
	if d > min_d or d < 1e-5:
		return

	if a.team != b.team:
		if a.supersonic:
			b.demo_timer = RLConstants.DEMO_RESPAWN
			events.append({"type": "demo", "car_id": b.id, "by_id": a.id})
			return
		if b.supersonic:
			a.demo_timer = RLConstants.DEMO_RESPAWN
			events.append({"type": "demo", "car_id": a.id, "by_id": b.id})
			return

	var n := delta / d
	var overlap := min_d - d
	a.pos -= n * (overlap * 0.5)
	b.pos += n * (overlap * 0.5)

	var rel: Vector3 = b.vel - a.vel
	var vn := rel.dot(n)
	if vn < 0.0:
		var j := -vn * 0.5
		a.vel -= n * j
		b.vel += n * j
