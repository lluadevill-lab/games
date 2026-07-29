class_name Controls
extends RefCounted
## Teclado + gamepad → CarInput (mesmos 8 canais do original web).

var deadzone: float = 0.15
var steer_sens: float = 1.0
var air_sens: float = 1.0
var gamma: float = 1.0

var _prev_ballcam := false
var _prev_reset := false
var _prev_pause := false
var ballcam_tapped := false
var reset_tapped := false
var pause_tapped := false


func _shape(v: float) -> float:
	var a := absf(v)
	if a <= deadzone:
		return 0.0
	var t := (a - deadzone) / (1.0 - deadzone if deadzone < 1.0 else 1.0)
	var shaped := t if is_equal_approx(gamma, 1.0) else pow(t, gamma)
	return (-1.0 if v < 0.0 else 1.0) * clampf(shaped, 0.0, 1.0)


func poll(inp: RLTypes.CarInput) -> void:
	var throttle := 0.0
	var steer := 0.0
	var pitch := 0.0
	var yaw := 0.0
	var roll := 0.0
	var jump := false
	var boost := false
	var handbrake := false

	# ---- teclado / actions
	if Input.is_action_pressed("throttle"):
		throttle += Input.get_action_strength("throttle")
	if Input.is_action_pressed("reverse"):
		throttle -= Input.get_action_strength("reverse")
	if Input.is_action_pressed("steer_right"):
		steer += Input.get_action_strength("steer_right")
	if Input.is_action_pressed("steer_left"):
		steer -= Input.get_action_strength("steer_left")
	if Input.is_action_pressed("jump"):
		jump = true
	if Input.is_action_pressed("boost"):
		boost = true
	if Input.is_action_pressed("handbrake"):
		handbrake = true

	# No ar, acelerar/ré viram pitch e virar vira guinada (padrão RL / HTML).
	# A física só consome pitch/yaw/roll quando !on_ground, então é seguro
	# preencher sempre.
	pitch = -throttle
	yaw = steer
	if Input.is_action_pressed("pitch_up"):
		pitch = Input.get_action_strength("pitch_up")
	if Input.is_action_pressed("pitch_down"):
		pitch = -Input.get_action_strength("pitch_down")
	if Input.is_action_pressed("roll_right"):
		roll += 1.0
	if Input.is_action_pressed("roll_left"):
		roll -= 1.0
	# com powerslide, virar rola o carro (air roll clássico)
	if handbrake and is_zero_approx(roll):
		roll = steer

	# ---- gamepad (override se houver eixo ativo)
	# Godot mapeia sticks/triggers via InputMap; também lemos joy direto.
	var pads := Input.get_connected_joypads()
	if pads.size() > 0:
		var id: int = pads[0]
		var lx := _shape(Input.get_joy_axis(id, JOY_AXIS_LEFT_X))
		var ly := _shape(Input.get_joy_axis(id, JOY_AXIS_LEFT_Y))
		var rt := Input.get_joy_axis(id, JOY_AXIS_TRIGGER_RIGHT)
		var lt := Input.get_joy_axis(id, JOY_AXIS_TRIGGER_LEFT)
		# triggers em alguns pads vão de -1..1
		if rt < 0.0:
			rt = (rt + 1.0) * 0.5
		if lt < 0.0:
			lt = (lt + 1.0) * 0.5

		if not is_zero_approx(lx):
			steer = lx
			yaw = lx
		if not is_zero_approx(ly):
			pitch = ly  # stick direito/esquerdo Y: para baixo = pitch+

		var t := rt - lt
		if absf(t) > 0.04:
			throttle = t
			if is_zero_approx(ly):
				pitch = 0.0

		if Input.is_joy_button_pressed(id, JOY_BUTTON_A):
			jump = true
		if Input.is_joy_button_pressed(id, JOY_BUTTON_B):
			boost = true
		if Input.is_joy_button_pressed(id, JOY_BUTTON_X):
			handbrake = true
		if handbrake:
			roll = lx

	steer = _shape(steer) if absf(steer) <= 1.0 else clampf(steer, -1.0, 1.0)

	inp.throttle = clampf(throttle, -1.0, 1.0)
	inp.steer = clampf(steer * steer_sens, -1.0, 1.0)
	inp.pitch = clampf(pitch * air_sens, -1.0, 1.0)
	inp.yaw = clampf((0.0 if handbrake else yaw) * air_sens, -1.0, 1.0)
	inp.roll = clampf(roll * air_sens, -1.0, 1.0)
	inp.jump = jump
	inp.boost = boost
	inp.handbrake = handbrake

	# taps de sistema
	var bc := Input.is_action_pressed("ballcam")
	ballcam_tapped = bc and not _prev_ballcam
	_prev_ballcam = bc

	var rs := Input.is_action_pressed("reset")
	reset_tapped = rs and not _prev_reset
	_prev_reset = rs

	var ps := Input.is_action_pressed("pause")
	pause_tapped = ps and not _prev_pause
	_prev_pause = ps


func end_frame() -> void:
	ballcam_tapped = false
	reset_tapped = false
	pause_tapped = false
