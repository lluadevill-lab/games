class_name GameCamera
extends Camera3D
## Câmera estilo RL: ball cam / car cam, sem roll, com shake.

var ball_cam := true
var _cam_pos := Vector3(0, 800, 3000)
var _cam_look := Vector3.ZERO
var _shake_time := 0.0
var _shake_mag := 0.0


func _ready() -> void:
	fov = 100.0
	near = 2.0
	far = 30000.0
	current = true


func shake(time: float, mag: float) -> void:
	_shake_time = maxf(_shake_time, time)
	_shake_mag = maxf(_shake_mag, mag)


func update_cam(world: RLTypes.WorldState, dt: float, focus_id: int = 0) -> void:
	if focus_id >= world.cars.size():
		return
	var car: RLTypes.CarState = world.cars[focus_id]
	var ball := world.ball

	var dir := Vector2.ZERO
	if ball_cam:
		dir = Vector2(ball.pos.x - car.pos.x, ball.pos.y - car.pos.y)
		var l := dir.length()
		if l < 1e-4:
			l = 1.0
		dir /= l
	else:
		var fwd := car.forward()
		var fx := fwd.x
		var fy := fwd.y
		var l2 := sqrt(fx * fx + fy * fy)
		if l2 < 1e-4:
			l2 = 1.0
		dir = Vector2(fx / l2, fy / l2)

	var speed := car.vel.length()
	var dist := 270.0 * 1.35 + speed * 0.08
	var height := 110.0 * 1.6 + maxf(0.0, car.pos.z) * 0.55

	# alvo no espaço sim
	var tx := car.pos.x - dir.x * dist
	var ty := car.pos.y - dir.y * dist
	var tz := car.pos.z + height

	var target_pos := CarMesh._to_godot(Vector3(tx, ty, tz))
	var k := 6.5
	_cam_pos.x = RLConstants.damp(_cam_pos.x, target_pos.x, k, dt)
	_cam_pos.y = RLConstants.damp(_cam_pos.y, maxf(target_pos.y, 60.0), k * 1.3, dt)
	_cam_pos.z = RLConstants.damp(_cam_pos.z, target_pos.z, k, dt)

	var lx: float
	var ly: float
	var lz: float
	if ball_cam:
		lx = ball.pos.x
		ly = ball.pos.y
		lz = ball.pos.z + 60.0
	else:
		lx = car.pos.x + dir.x * 900.0
		ly = car.pos.y + dir.y * 900.0
		lz = car.pos.z + 120.0
	var look_t := CarMesh._to_godot(Vector3(lx, ly, lz))
	_cam_look.x = RLConstants.damp(_cam_look.x, look_t.x, k * 1.4, dt)
	_cam_look.y = RLConstants.damp(_cam_look.y, look_t.y, k * 1.4, dt)
	_cam_look.z = RLConstants.damp(_cam_look.z, look_t.z, k * 1.4, dt)

	var sx := 0.0
	var sy := 0.0
	var sz := 0.0
	if _shake_time > 0.0:
		_shake_time -= dt
		var m := _shake_mag * maxf(0.0, _shake_time)
		sx = (randf() * 2.0 - 1.0) * m
		sy = (randf() * 2.0 - 1.0) * m
		sz = (randf() * 2.0 - 1.0) * m
		if _shake_time <= 0.0:
			_shake_mag = 0.0

	global_position = _cam_pos + Vector3(sx, sy, sz)
	# up sempre Y do mundo Godot (= Z da sim) — nunca rola
	look_at(_cam_look, Vector3.UP)
