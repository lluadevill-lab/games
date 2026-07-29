class_name GameHUD
extends CanvasLayer
## HUD: placar, relógio, boost, velocidade, banners.

signal resume_pressed
signal restart_pressed
signal menu_pressed
signal mute_pressed

var score_blue: Label
var score_orange: Label
var clock_label: Label
var boost_value: Label
var boost_bar: ProgressBar
var speed_label: Label
var banner: Label
var toast: Label
var fps_label: Label
var pause_panel: Control
var game_over_panel: Control
var go_title: Label
var go_sub: Label

var _banner_t := 0.0
var _toast_t := 0.0
var _wired := false


func _ready() -> void:
	_wire_if_needed()


func _wire_if_needed() -> void:
	if _wired:
		return
	if not has_node("Root"):
		return
	score_blue = $Root/Top/Score/Blue
	score_orange = $Root/Top/Score/Orange
	clock_label = $Root/Top/Score/Clock
	boost_value = $Root/Bottom/BoostBox/BoostValue
	boost_bar = $Root/Bottom/BoostBox/BoostBar
	speed_label = $Root/Bottom/SpeedBox/Speed
	banner = $Root/Banner
	toast = $Root/Toast
	fps_label = $Root/Fps
	pause_panel = $Root/Pause
	game_over_panel = $Root/GameOver
	go_title = $Root/GameOver/Card/Title
	go_sub = $Root/GameOver/Card/Sub

	banner.modulate.a = 0.0
	toast.modulate.a = 0.0
	pause_panel.visible = false
	game_over_panel.visible = false

	$Root/Pause/Card/Resume.pressed.connect(func(): resume_pressed.emit())
	$Root/Pause/Card/Restart.pressed.connect(func(): restart_pressed.emit())
	$Root/Pause/Card/Mute.pressed.connect(func(): mute_pressed.emit())
	$Root/Pause/Card/Menu.pressed.connect(func(): menu_pressed.emit())
	$Root/GameOver/Card/Again.pressed.connect(func(): restart_pressed.emit())
	$Root/GameOver/Card/MenuBtn.pressed.connect(func(): menu_pressed.emit())
	_wired = true


func _process(dt: float) -> void:
	if banner == null:
		return
	if _banner_t > 0.0:
		_banner_t -= dt
		banner.modulate.a = clampf(_banner_t * 4.0, 0.0, 1.0) if _banner_t < 0.25 else 1.0
		if _banner_t <= 0.0:
			banner.modulate.a = 0.0
	if _toast_t > 0.0:
		_toast_t -= dt
		toast.modulate.a = clampf(_toast_t * 4.0, 0.0, 1.0) if _toast_t < 0.25 else 1.0
		if _toast_t <= 0.0:
			toast.modulate.a = 0.0


func update_hud(world: RLTypes.WorldState, car_index: int, fps: float) -> void:
	_wire_if_needed()
	if score_blue == null:
		return
	score_blue.text = str(world.score[0])
	score_orange.text = str(world.score[1])

	var t := maxf(0.0, world.clock)
	if world.overtime:
		clock_label.text = "PRORROGAÇÃO"
		clock_label.add_theme_color_override("font_color", Color(1.0, 0.75, 0.3))
	else:
		var mm := int(t) / 60
		var ss := int(t) % 60
		clock_label.text = "%d:%02d" % [mm, ss]
		if t < 30.0 and t > 0.0:
			clock_label.add_theme_color_override("font_color", Color(1.0, 0.35, 0.35))
		else:
			clock_label.add_theme_color_override("font_color", Color(0.9, 0.93, 1.0))

	if car_index < world.cars.size():
		var car: RLTypes.CarState = world.cars[car_index]
		var b := int(round(car.boost))
		boost_value.text = str(b)
		boost_bar.value = car.boost
		var kmh := car.vel.length() * RLConstants.UU_TO_KMH
		speed_label.text = str(int(round(kmh)))
		if car.supersonic:
			speed_label.add_theme_color_override("font_color", Color(0.4, 0.9, 1.0))
		else:
			speed_label.add_theme_color_override("font_color", Color(0.95, 0.97, 1.0))

	fps_label.text = "%d fps" % int(round(fps))


func show_banner(text: String, ms: float = 1.8, color: Color = Color.WHITE) -> void:
	_wire_if_needed()
	if banner == null:
		return
	banner.text = text
	banner.add_theme_color_override("font_color", color)
	banner.modulate.a = 1.0
	_banner_t = ms


func show_toast(text: String, ms: float = 1.2) -> void:
	_wire_if_needed()
	if toast == null:
		return
	toast.text = text
	toast.modulate.a = 1.0
	_toast_t = ms


func show_pause(v: bool) -> void:
	_wire_if_needed()
	if pause_panel:
		pause_panel.visible = v


func show_game_over(title: String, sub: String) -> void:
	_wire_if_needed()
	if go_title == null:
		return
	go_title.text = title
	go_sub.text = sub
	game_over_panel.visible = true


func hide_game_over() -> void:
	_wire_if_needed()
	if game_over_panel:
		game_over_panel.visible = false


func is_pause_visible() -> bool:
	_wire_if_needed()
	return pause_panel != null and pause_panel.visible
