class_name Arena
extends RefCounted
## Geometria da arena como campo de distância (SDF).
## Chão, parede, teto e cantos arredondados — mesma superfície para o carro.

# buffers estáticos de wall distance
static var _wnx: float = 0.0
static var _wny: float = 0.0


static func wall_distance_xy(x: float, y: float) -> float:
	var ax := absf(x)
	var ay := absf(y)
	var sx := 1.0 if x >= 0.0 else -1.0
	var sy := 1.0 if y >= 0.0 else -1.0

	var cx := RLConstants.FIELD_X - RLConstants.CORNER_RADIUS
	var cy := RLConstants.FIELD_Y - RLConstants.CORNER_RADIUS

	if ax > cx and ay > cy:
		var dx := ax - cx
		var dy := ay - cy
		var r := sqrt(dx * dx + dy * dy)
		if r < 1e-6:
			r = 1e-6
		_wnx = (-sx * dx) / r
		_wny = (-sy * dy) / r
		return RLConstants.CORNER_RADIUS - r

	var dX := RLConstants.FIELD_X - ax
	var dY := RLConstants.FIELD_Y - ay
	if dX < dY:
		_wnx = -sx
		_wny = 0.0
		return dX
	_wnx = 0.0
	_wny = -sy
	return dY


## Distância assinada até a superfície. Positivo = dentro do campo.
## Retorna {d, n} onde n é a normal apontando para dentro.
static func arena_distance(p: Vector3) -> Dictionary:
	var x := p.x
	var y := p.y
	var z := p.z
	var ax := absf(x)
	var ay := absf(y)
	var sy := 1.0 if y >= 0.0 else -1.0

	# ---- baliza
	var in_mouth := ax < RLConstants.GOAL_HALF_W and z < RLConstants.GOAL_H
	if in_mouth and ay > RLConstants.FIELD_Y - 1.0:
		var best := RLConstants.GOAL_HALF_W - ax
		var n := Vector3(-1.0 if x >= 0.0 else 1.0, 0.0, 0.0)

		var d_back := RLConstants.FIELD_Y + RLConstants.GOAL_DEPTH - ay
		if d_back < best:
			best = d_back
			n = Vector3(0.0, -sy, 0.0)
		if z < best:
			best = z
			n = Vector3(0.0, 0.0, 1.0)
		var d_top := RLConstants.GOAL_H - z
		if d_top < best:
			best = d_top
			n = Vector3(0.0, 0.0, -1.0)
		return {"d": best, "n": n}

	# ---- campo
	var d_wall := wall_distance_xy(x, y)
	var wnx := _wnx
	var wny := _wny

	var near_mouth := in_mouth and ay > RLConstants.FIELD_Y - RLConstants.WALL_FILLET
	var d_floor := z
	var d_ceil := RLConstants.CEILING_Z - z

	# arredondamento parede × piso/teto
	if not near_mouth and d_wall < RLConstants.WALL_FILLET:
		if d_floor < RLConstants.WALL_FILLET:
			var a := RLConstants.WALL_FILLET - d_wall
			var b := RLConstants.WALL_FILLET - d_floor
			var r := sqrt(a * a + b * b)
			if r > 1e-6:
				var n2 := Vector3((wnx * a) / r, (wny * a) / r, b / r).normalized()
				return {"d": RLConstants.WALL_FILLET - r, "n": n2}
		if d_ceil < RLConstants.WALL_FILLET:
			var a2 := RLConstants.WALL_FILLET - d_wall
			var b2 := RLConstants.WALL_FILLET - d_ceil
			var r2 := sqrt(a2 * a2 + b2 * b2)
			if r2 > 1e-6:
				var n3 := Vector3((wnx * a2) / r2, (wny * a2) / r2, -b2 / r2).normalized()
				return {"d": RLConstants.WALL_FILLET - r2, "n": n3}

	var best2 := d_floor
	var n_out := Vector3(0.0, 0.0, 1.0)
	if d_ceil < best2:
		best2 = d_ceil
		n_out = Vector3(0.0, 0.0, -1.0)
	if not near_mouth and d_wall < best2:
		best2 = d_wall
		n_out = Vector3(wnx, wny, 0.0)
	return {"d": best2, "n": n_out}


## Gol: +1 = baliza +Y (ponto azul), -1 = baliza -Y (ponto laranja), 0 = nada.
static func ball_in_goal(p: Vector3, radius: float) -> int:
	if absf(p.x) > RLConstants.GOAL_HALF_W:
		return 0
	if p.z > RLConstants.GOAL_H:
		return 0
	if p.y > RLConstants.FIELD_Y + radius:
		return 1
	if p.y < -RLConstants.FIELD_Y - radius:
		return -1
	return 0


## Contorno XY do campo (cantos arredondados) para o renderer.
static func field_outline(segs_per_corner: int = 12) -> PackedVector2Array:
	var pts := PackedVector2Array()
	var cx := RLConstants.FIELD_X - RLConstants.CORNER_RADIUS
	var cy := RLConstants.FIELD_Y - RLConstants.CORNER_RADIUS
	var corners := [
		[cx, cy, 0.0],
		[-cx, cy, 90.0],
		[-cx, -cy, 180.0],
		[cx, -cy, 270.0],
	]
	for c in corners:
		var ox: float = c[0]
		var oy: float = c[1]
		var a0: float = c[2]
		for i in range(segs_per_corner + 1):
			var a := deg_to_rad(a0 + (float(i) / float(segs_per_corner)) * 90.0)
			pts.append(Vector2(ox + cos(a) * RLConstants.CORNER_RADIUS, oy + sin(a) * RLConstants.CORNER_RADIUS))
	if pts.size() > 0:
		pts.append(pts[0])
	return pts
