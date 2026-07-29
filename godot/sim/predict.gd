class_name BallPredict
extends RefCounted
## Predição da trajetória da bola (mesma ideia da linha de mira do jogo).


static func predict_ball(ball: RLTypes.BallState, steps: int = 90, dt: float = 1.0 / 30.0) -> Array:
	var out: Array = []
	var p := ball.pos
	var v := ball.vel
	var sub := 4
	var h := dt / float(sub)

	for i in range(steps):
		for _s in range(sub):
			v.z -= RLConstants.GRAVITY * h
			v *= (1.0 - RLConstants.BALL_DRAG * h)
			v = RLTypes.clamp_len(v, RLConstants.BALL_MAX_SPEED)
			p += v * h

			var hit: Dictionary = Arena.arena_distance(p)
			var d: float = hit.d
			var n: Vector3 = hit.n
			if d < RLConstants.BALL_RADIUS:
				p += n * (RLConstants.BALL_RADIUS - d)
				var vn := v.dot(n)
				if vn < 0.0:
					v += n * (-vn * (1.0 + RLConstants.BALL_RESTITUTION))
					var tan: Vector3 = v - n * v.dot(n)
					v -= tan * 0.08

		out.append({"pos": p, "vel": v, "t": float(i + 1) * dt})
		if Arena.ball_in_goal(p, RLConstants.BALL_RADIUS) != 0:
			break
	return out


static func find_ground_touch(pred: Array, max_z: float = 200.0) -> Dictionary:
	for s in pred:
		if s.pos.z <= max_z:
			return s
	return {}
