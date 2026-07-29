extends Node3D
## Rocket Lite — laço principal Godot.
## Simulação em passo fixo 1/120 s → estado → renderer burro.

const QUALITY_PIXEL := {"baixa": 0.75, "media": 1.0, "alta": 1.5}

var world: SimWorld = SimWorld.new()
var bot: BotAI = BotAI.new()
var controls: Controls = Controls.new()
var audio: GameAudio
var camera: GameCamera
var arena_vis: ArenaMesh
var ball_vis: BallMesh
var pred_line: PredictionLine
var car_visuals: Array = []  # CarMesh

var hud: GameHUD
var menu: MainMenu

var config: Dictionary = {}
var running := false
var accumulator := 0.0
var fps := 60.0
var last_countdown := -1
var pred_timer := 0.0
var show_prediction := true
var quality := "media"


func _ready() -> void:
	# áudio
	audio = GameAudio.new()
	audio.name = "GameAudio"
	$Audio.add_child(audio)

	# câmera
	camera = GameCamera.new()
	camera.name = "GameCam"
	# substitui a câmera placeholder
	var old_cam := $Camera
	camera.fov = old_cam.fov
	camera.near = old_cam.near
	camera.far = old_cam.far
	add_child(camera)
	old_cam.queue_free()

	# arena
	arena_vis = ArenaMesh.new()
	arena_vis.name = "ArenaMesh"
	$Arena.add_child(arena_vis)
	arena_vis.build()

	# bola
	ball_vis = BallMesh.new()
	ball_vis.name = "BallMesh"
	$Ball.add_child(ball_vis)
	ball_vis.build()

	# predição (substitui o placeholder da cena)
	pred_line = PredictionLine.new()
	pred_line.name = "PredictionLine"
	var old_pred := $Prediction
	old_pred.replace_by(pred_line)
	old_pred.free()

	# HUD
	hud = _build_hud()
	$UI.add_child(hud)
	hud.resume_pressed.connect(_on_resume)
	hud.restart_pressed.connect(_on_restart)
	hud.menu_pressed.connect(_on_menu)
	hud.mute_pressed.connect(_on_mute)

	# Menu
	menu = _build_menu()
	$Menu.add_child(menu)
	menu.start_game.connect(_on_start_game)
	menu.open_controls.connect(_on_open_controls)
	# Garante wiring dos botões após entrar na árvore
	if menu.has_method("_wire"):
		menu.call_deferred("_wire")
	if hud.has_method("_wire_if_needed"):
		hud.call_deferred("_wire_if_needed")

	# mundo inicial (só visual de fundo)
	world.create({"bot_count": 1, "match_time": 180.0, "free_play": true})
	_sync_cars()
	_sync_visuals(0.016)

	running = false
	menu.show_menu()


func _build_hud() -> GameHUD:
	var h := GameHUD.new()
	h.name = "HUD"

	var root := Control.new()
	root.name = "Root"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(root)

	# Top score
	var top := Control.new()
	top.name = "Top"
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.offset_bottom = 90
	root.add_child(top)

	var score_box := HBoxContainer.new()
	score_box.name = "Score"
	score_box.alignment = BoxContainer.ALIGNMENT_CENTER
	score_box.set_anchors_preset(Control.PRESET_CENTER_TOP)
	score_box.offset_left = -220
	score_box.offset_right = 220
	score_box.offset_top = 16
	score_box.offset_bottom = 70
	top.add_child(score_box)

	var blue := _big_label("0", 42, Color(0.35, 0.65, 1.0))
	blue.name = "Blue"
	blue.custom_minimum_size = Vector2(80, 0)
	score_box.add_child(blue)

	var clock := _big_label("5:00", 36, Color(0.9, 0.93, 1.0))
	clock.name = "Clock"
	clock.custom_minimum_size = Vector2(180, 0)
	clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	score_box.add_child(clock)

	var orange := _big_label("0", 42, Color(1.0, 0.55, 0.2))
	orange.name = "Orange"
	orange.custom_minimum_size = Vector2(80, 0)
	orange.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	score_box.add_child(orange)

	# Banner
	var banner := _big_label("", 64, Color.WHITE)
	banner.name = "Banner"
	banner.set_anchors_preset(Control.PRESET_CENTER)
	banner.offset_left = -400
	banner.offset_right = 400
	banner.offset_top = -80
	banner.offset_bottom = 20
	banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner.modulate.a = 0.0
	root.add_child(banner)

	# Toast
	var toast := _big_label("", 22, Color(0.8, 0.9, 1.0))
	toast.name = "Toast"
	toast.set_anchors_preset(Control.PRESET_CENTER)
	toast.offset_left = -300
	toast.offset_right = 300
	toast.offset_top = 30
	toast.offset_bottom = 70
	toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast.modulate.a = 0.0
	root.add_child(toast)

	# Bottom
	var bottom := Control.new()
	bottom.name = "Bottom"
	bottom.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.offset_top = -140
	root.add_child(bottom)

	var speed_box := VBoxContainer.new()
	speed_box.name = "SpeedBox"
	speed_box.position = Vector2(40, 20)
	bottom.add_child(speed_box)
	var speed := _big_label("0", 40, Color(0.95, 0.97, 1.0))
	speed.name = "Speed"
	speed_box.add_child(speed)
	var speed_u := _big_label("km/h", 14, Color(0.55, 0.65, 0.8))
	speed_u.name = "Unit"
	speed_box.add_child(speed_u)

	var boost_box := Control.new()
	boost_box.name = "BoostBox"
	boost_box.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	boost_box.offset_left = -160
	boost_box.offset_top = -120
	boost_box.offset_right = -30
	boost_box.offset_bottom = -20
	bottom.add_child(boost_box)

	var boost_bar := ProgressBar.new()
	boost_bar.name = "BoostBar"
	boost_bar.max_value = 100
	boost_bar.value = 33
	boost_bar.show_percentage = false
	boost_bar.set_anchors_preset(Control.PRESET_FULL_RECT)
	boost_bar.offset_top = 40
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.12, 0.18, 0.85)
	sb.corner_radius_top_left = 8
	sb.corner_radius_top_right = 8
	sb.corner_radius_bottom_left = 8
	sb.corner_radius_bottom_right = 8
	boost_bar.add_theme_stylebox_override("background", sb)
	var sf := StyleBoxFlat.new()
	sf.bg_color = Color(1.0, 0.78, 0.25)
	sf.corner_radius_top_left = 8
	sf.corner_radius_top_right = 8
	sf.corner_radius_bottom_left = 8
	sf.corner_radius_bottom_right = 8
	boost_bar.add_theme_stylebox_override("fill", sf)
	boost_box.add_child(boost_bar)

	var boost_val := _big_label("33", 28, Color(1.0, 0.9, 0.5))
	boost_val.name = "BoostValue"
	boost_val.set_anchors_preset(Control.PRESET_CENTER_TOP)
	boost_val.offset_left = -40
	boost_val.offset_right = 40
	boost_val.offset_bottom = 36
	boost_val.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	boost_box.add_child(boost_val)

	var fps_l := _big_label("", 12, Color(0.4, 0.5, 0.6))
	fps_l.name = "Fps"
	fps_l.set_anchors_preset(Control.PRESET_TOP_LEFT)
	fps_l.offset_left = 12
	fps_l.offset_top = 8
	fps_l.offset_right = 120
	fps_l.offset_bottom = 28
	root.add_child(fps_l)

	# Pause overlay
	var pause := _make_overlay("Pause", "PAUSA", [
		["Resume", "Continuar"],
		["Restart", "Reiniciar partida"],
		["Mute", "Som ligado/desligado"],
		["Menu", "Menu principal"],
	])
	root.add_child(pause)

	# Game over
	var go := Control.new()
	go.name = "GameOver"
	go.set_anchors_preset(Control.PRESET_FULL_RECT)
	go.visible = false
	var go_bg := ColorRect.new()
	go_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	go_bg.color = Color(0.02, 0.04, 0.08, 0.72)
	go.add_child(go_bg)
	var go_card := PanelContainer.new()
	go_card.name = "Card"
	go_card.set_anchors_preset(Control.PRESET_CENTER)
	go_card.offset_left = -200
	go_card.offset_right = 200
	go_card.offset_top = -140
	go_card.offset_bottom = 140
	var go_style := StyleBoxFlat.new()
	go_style.bg_color = Color(0.06, 0.09, 0.14, 0.95)
	go_style.corner_radius_top_left = 16
	go_style.corner_radius_top_right = 16
	go_style.corner_radius_bottom_left = 16
	go_style.corner_radius_bottom_right = 16
	go_style.content_margin_left = 24
	go_style.content_margin_right = 24
	go_style.content_margin_top = 20
	go_style.content_margin_bottom = 20
	go_card.add_theme_stylebox_override("panel", go_style)
	go.add_child(go_card)
	var go_v := VBoxContainer.new()
	go_v.add_theme_constant_override("separation", 12)
	go_card.add_child(go_v)
	var go_title := _big_label("FIM DE JOGO", 32, Color(1, 1, 1))
	go_title.name = "Title"
	go_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	go_v.add_child(go_title)
	var go_sub := _big_label("", 16, Color(0.6, 0.7, 0.85))
	go_sub.name = "Sub"
	go_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	go_v.add_child(go_sub)
	var again := Button.new()
	again.name = "Again"
	again.text = "Jogar de novo"
	go_v.add_child(again)
	var menu_btn := Button.new()
	menu_btn.name = "MenuBtn"
	menu_btn.text = "Menu principal"
	go_v.add_child(menu_btn)
	root.add_child(go)

	return h


func _make_overlay(name_s: String, title: String, buttons: Array) -> Control:
	var overlay := Control.new()
	overlay.name = name_s
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.visible = false
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.02, 0.04, 0.08, 0.72)
	overlay.add_child(bg)
	var card := PanelContainer.new()
	card.name = "Card"
	card.set_anchors_preset(Control.PRESET_CENTER)
	card.offset_left = -180
	card.offset_right = 180
	card.offset_top = -160
	card.offset_bottom = 160
	var st := StyleBoxFlat.new()
	st.bg_color = Color(0.06, 0.09, 0.14, 0.95)
	st.corner_radius_top_left = 16
	st.corner_radius_top_right = 16
	st.corner_radius_bottom_left = 16
	st.corner_radius_bottom_right = 16
	st.content_margin_left = 24
	st.content_margin_right = 24
	st.content_margin_top = 20
	st.content_margin_bottom = 20
	card.add_theme_stylebox_override("panel", st)
	overlay.add_child(card)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	card.add_child(v)
	var t := _big_label(title, 28, Color.WHITE)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	for b in buttons:
		var btn := Button.new()
		btn.name = b[0]
		btn.text = b[1]
		btn.custom_minimum_size = Vector2(0, 36)
		v.add_child(btn)
	return overlay


func _build_menu() -> MainMenu:
	var m := MainMenu.new()
	m.name = "MainMenu"

	var root := Control.new()
	root.name = "Root"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	m.add_child(root)

	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.color = Color(0.027, 0.043, 0.071, 0.88)
	root.add_child(bg)

	var card := PanelContainer.new()
	card.name = "Card"
	card.set_anchors_preset(Control.PRESET_CENTER)
	card.offset_left = -280
	card.offset_right = 280
	card.offset_top = -320
	card.offset_bottom = 320
	var st := StyleBoxFlat.new()
	st.bg_color = Color(0.05, 0.08, 0.13, 0.96)
	st.corner_radius_top_left = 20
	st.corner_radius_top_right = 20
	st.corner_radius_bottom_left = 20
	st.corner_radius_bottom_right = 20
	st.content_margin_left = 28
	st.content_margin_right = 28
	st.content_margin_top = 24
	st.content_margin_bottom = 24
	st.border_width_left = 1
	st.border_width_right = 1
	st.border_width_top = 1
	st.border_width_bottom = 1
	st.border_color = Color(0.25, 0.4, 0.7, 0.4)
	card.add_theme_stylebox_override("panel", st)
	root.add_child(card)

	var v := VBoxContainer.new()
	v.name = "VBox"
	v.add_theme_constant_override("separation", 10)
	card.add_child(v)

	var title := _big_label("ROCKET LITE", 40, Color(0.95, 0.97, 1.0))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(title)
	var tag := _big_label("Futebol com carros-foguete · física 120 Hz · Godot 4", 13, Color(0.55, 0.65, 0.8))
	tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(tag)

	v.add_child(_spacer(8))
	v.add_child(_row("ModeRow", "Modo"))
	v.add_child(_row("SkillRow", "Bot"))
	v.add_child(_row("TimeRow", "Duração"))
	v.add_child(_row("QualityRow", "Gráficos"))
	v.add_child(_row("PredRow", "Linha da bola"))
	v.add_child(_spacer(6))

	var play := Button.new()
	play.name = "Play"
	play.text = "JOGAR"
	play.custom_minimum_size = Vector2(0, 48)
	v.add_child(play)

	var ctrl := Button.new()
	ctrl.name = "ControlsBtn"
	ctrl.text = "Controles (teclado / gamepad)"
	ctrl.custom_minimum_size = Vector2(0, 36)
	v.add_child(ctrl)

	var help := _big_label(
		"W/S acelerar · A/D virar · Espaço pular/flip · Shift boost\nK powerslide/air roll · Q/E air roll · C ball cam · R reset · P pausa",
		11,
		Color(0.45, 0.55, 0.7)
	)
	help.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(help)

	return m


func _row(name_s: String, label: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.name = name_s
	row.add_theme_constant_override("separation", 8)
	var lb := Label.new()
	lb.text = label
	lb.custom_minimum_size = Vector2(100, 0)
	lb.add_theme_color_override("font_color", Color(0.7, 0.78, 0.9))
	row.add_child(lb)
	var seg := HBoxContainer.new()
	seg.name = "Seg"
	seg.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	seg.add_theme_constant_override("separation", 4)
	row.add_child(seg)
	return row


func _spacer(h: float) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, h)
	return c


func _big_label(text: String, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l


func _on_start_game(cfg: Dictionary) -> void:
	config = cfg
	quality = str(cfg.get("quality", "media"))
	show_prediction = bool(cfg.get("show_prediction", true))
	pred_line.visible = show_prediction

	audio.start_engine()
	bot.reset()

	var bot_count := 0 if cfg.get("mode") == "training" else 1
	var match_time := 99999.0 if cfg.get("mode") == "training" else float(cfg.get("match_minutes", 3)) * 60.0
	var free_play := cfg.get("mode") == "training"

	world.create({
		"bot_count": bot_count,
		"match_time": match_time,
		"free_play": free_play,
		"seed": int(Time.get_ticks_msec()),
	})
	_sync_cars()

	menu.hide_menu()
	hud.hide_game_over()
	hud.show_pause(false)
	running = true
	accumulator = 0.0
	last_countdown = -1

	if free_play:
		hud.show_toast("Treino livre · R reposiciona a bola", 2.6)


func _sync_cars() -> void:
	# remove extras
	while car_visuals.size() > world.state.cars.size():
		var last: CarMesh = car_visuals.pop_back()
		last.queue_free()
	# adiciona faltantes
	while car_visuals.size() < world.state.cars.size():
		var idx := car_visuals.size()
		var car: RLTypes.CarState = world.state.cars[idx]
		var cm := CarMesh.new()
		cm.name = "Car_%d" % idx
		$Cars.add_child(cm)
		cm.build(car.team, car.id)
		car_visuals.append(cm)


func _physics_process(dt: float) -> void:
	# usamos _process para render; simulação fixa no _process também
	pass


func _process(dt: float) -> void:
	dt = minf(dt, 0.25)
	fps = lerpf(fps, 1.0 / maxf(dt, 1e-4), 0.08)

	# Sempre lê input de sistema (pausa funciona mesmo parado)
	var dummy := RLTypes.CarInput.new()
	if running and world.state and world.state.cars.size() > 0:
		controls.poll(world.state.cars[0].input)
	else:
		controls.poll(dummy)

	if controls.pause_tapped and config.size() > 0 and not menu.visible:
		if hud.is_pause_visible():
			_on_resume()
		elif running:
			running = false
			hud.show_pause(true)

	if running:
		if config.get("mode") != "training":
			var skill := str(config.get("skill", "medio"))
			for i in range(1, world.state.cars.size()):
				bot.drive(world.state.cars[i], world.state, dt, skill)

		accumulator += dt
		var steps := 0
		while accumulator >= RLConstants.TICK_DT and steps < 16:
			world.step(RLConstants.TICK_DT)
			accumulator -= RLConstants.TICK_DT
			steps += 1
		if steps >= 16:
			accumulator = 0.0

		_handle_events()

		# countdown
		if world.state.phase == "kickoff":
			var s := int(ceil(world.state.phase_timer))
			if s != last_countdown:
				last_countdown = s
				if s > 0:
					hud.show_banner(str(s), 0.7)
					audio.countdown(s)
		elif last_countdown > 0:
			last_countdown = 0
			hud.show_banner("VAI!", 0.8)
			audio.countdown(0)

		# predição
		pred_timer -= dt
		if show_prediction and pred_timer <= 0.0:
			pred_timer = 0.1
			var pts := BallPredict.predict_ball(world.state.ball, 55, 1.0 / 22.0)
			pred_line.set_points(pts)

		var me: RLTypes.CarState = world.state.cars[0]
		audio.update_engine(me.vel.length(), me.input.throttle, me.input.boost and me.boost > 0.0)

		# ballcam / reset
		if controls.ballcam_tapped:
			camera.ball_cam = not camera.ball_cam
			hud.show_toast("Ball cam: %s" % ("ligada" if camera.ball_cam else "desligada"), 0.9)

		if controls.reset_tapped:
			if config.get("mode") == "training":
				world.state.ball.pos = Vector3(0, 0, RLConstants.BALL_RADIUS + 400.0)
				world.state.ball.vel = Vector3.ZERO
				world.state.ball.ang = Vector3.ZERO
				var c: RLTypes.CarState = world.state.cars[0]
				c.pos = Vector3(0, -2200, RLConstants.REST_HEIGHT)
				c.vel = Vector3.ZERO
				c.ang = Vector3.ZERO
				c.rot = RLTypes.quat_from_euler_yaw_pitch_roll(PI * 0.5, 0.0, 0.0)
				c.boost = 100.0
			else:
				world.reset_kickoff(true)

	controls.end_frame()
	_sync_visuals(dt)
	if world.state:
		hud.update_hud(world.state, 0, fps)


func _sync_visuals(dt: float) -> void:
	if world.state == null:
		return
	ball_vis.sync(world.state.ball, dt)
	for i in car_visuals.size():
		if i < world.state.cars.size():
			car_visuals[i].sync(world.state.cars[i], dt)
	arena_vis.sync_pads(world.state, world.state.time, dt)
	camera.update_cam(world.state, dt, 0)


func _handle_events() -> void:
	var events := world.drain_events()
	for ev in events:
		match ev.type:
			"ball_hit":
				audio.ball_hit(ev.speed)
				if ev.speed > 2600.0:
					camera.shake(0.18, 9.0)
			"bounce":
				audio.bounce(ev.speed)
			"jump":
				if ev.car_id == 0:
					audio.jump()
			"flip":
				if ev.car_id == 0:
					audio.flip()
			"pad":
				if ev.car_id == 0:
					audio.pad(ev.big)
			"landing":
				if ev.car_id == 0 and ev.speed > 400.0:
					audio.landing(ev.speed)
			"demo":
				audio.demo()
				camera.shake(0.35, 20.0)
				hud.show_banner("DEMOLIDO!" if ev.car_id == 0 else "DEMOLIÇÃO!", 1.2)
			"goal":
				audio.goal()
				var mine: bool = ev.team == 0
				var kmh := int(round(ev.speed * RLConstants.UU_TO_KMH))
				hud.show_banner("GOOOL!" if mine else "TOMOU GOL", 2.6,
					Color(0.35, 0.65, 1.0) if mine else Color(1.0, 0.55, 0.2))
				hud.show_toast("%d km/h" % kmh, 2.4)
				camera.shake(0.6, 34.0)
			"kickoff":
				last_countdown = -1
			"match_end":
				audio.whistle()
				var a: int = world.state.score[0]
				var b: int = world.state.score[1]
				var title := "VOCÊ VENCEU!" if a > b else ("DERROTA" if a < b else "EMPATE")
				hud.show_game_over(title, "Placar final %d × %d" % [a, b])
				running = false


func _on_resume() -> void:
	hud.show_pause(false)
	running = true


func _on_restart() -> void:
	hud.hide_game_over()
	hud.show_pause(false)
	if config.size() > 0:
		_on_start_game(config)


func _on_menu() -> void:
	hud.hide_game_over()
	hud.show_pause(false)
	running = false
	menu.show_menu()


func _on_mute() -> void:
	var m := audio.toggle_mute()
	hud.show_toast("Som %s" % ("desligado" if m else "ligado"), 1.0)


func _on_open_controls() -> void:
	hud.show_banner("CONTROLES", 2.2)
	hud.show_toast("W/S A/D · Espaço · Shift · K · Q/E · C · R · P  |  Gamepad OK", 3.5)
