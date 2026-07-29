class_name GameAudio
extends Node
## Áudio procedural (sem arquivos). Motor + SFX via AudioStreamGenerator / osciladores.

var muted := false
var _master_db := -8.0

# players one-shot reutilizáveis
var _players: Array = []
var _player_idx := 0
const POOL := 12

# motor contínuo
var _engine_player: AudioStreamPlayer
var _engine_playback: AudioStreamGeneratorPlayback
var _boost_player: AudioStreamPlayer
var _boost_playback: AudioStreamGeneratorPlayback
var _engine_phase := 0.0
var _boost_phase := 0.0
var _engine_freq := 60.0
var _engine_vol := 0.0
var _boost_vol := 0.0
var _target_engine_freq := 60.0
var _target_engine_vol := 0.0
var _target_boost_vol := 0.0
var _noise_state := 0.5


func _ready() -> void:
	for i in POOL:
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		p.volume_db = _master_db
		add_child(p)
		_players.append(p)

	_engine_player = AudioStreamPlayer.new()
	var eng := AudioStreamGenerator.new()
	eng.mix_rate = 22050.0
	eng.buffer_length = 0.1
	_engine_player.stream = eng
	_engine_player.volume_db = _master_db - 6.0
	add_child(_engine_player)

	_boost_player = AudioStreamPlayer.new()
	var bst := AudioStreamGenerator.new()
	bst.mix_rate = 22050.0
	bst.buffer_length = 0.1
	_boost_player.stream = bst
	_boost_player.volume_db = _master_db - 4.0
	add_child(_boost_player)


func start_engine() -> void:
	if not _engine_player.playing:
		_engine_player.play()
		_engine_playback = _engine_player.get_stream_playback()
	if not _boost_player.playing:
		_boost_player.play()
		_boost_playback = _boost_player.get_stream_playback()


func set_muted(m: bool) -> void:
	muted = m
	var db := -80.0 if m else _master_db
	for p in _players:
		p.volume_db = db
	if _engine_player:
		_engine_player.volume_db = (-80.0 if m else _master_db - 6.0)
	if _boost_player:
		_boost_player.volume_db = (-80.0 if m else _master_db - 4.0)


func toggle_mute() -> bool:
	set_muted(not muted)
	return muted


func update_engine(speed: float, throttle: float, boosting: bool) -> void:
	_target_engine_freq = 55.0 + (speed / 2300.0) * 150.0
	_target_engine_vol = 0.05 + absf(throttle) * 0.09
	_target_boost_vol = 0.13 if boosting else 0.0


func _process(dt: float) -> void:
	_engine_freq = lerpf(_engine_freq, _target_engine_freq, 1.0 - exp(-12.0 * dt))
	_engine_vol = lerpf(_engine_vol, _target_engine_vol, 1.0 - exp(-10.0 * dt))
	_boost_vol = lerpf(_boost_vol, _target_boost_vol, 1.0 - exp(-20.0 * dt))
	_fill_engine()
	_fill_boost()


func _fill_engine() -> void:
	if _engine_playback == null:
		return
	var rate := 22050.0
	var frames: int = _engine_playback.get_frames_available()
	if frames <= 0:
		return
	var vol := 0.0 if muted else _engine_vol
	for i in frames:
		_engine_phase += TAU * _engine_freq / rate
		if _engine_phase > TAU:
			_engine_phase -= TAU
		# sawtooth filtrado barato
		var s := (_engine_phase / PI) - 1.0
		s = s * 0.5 + sin(_engine_phase * 2.0) * 0.15
		_engine_playback.push_frame(Vector2(s, s) * vol)


func _fill_boost() -> void:
	if _boost_playback == null:
		return
	var frames: int = _boost_playback.get_frames_available()
	if frames <= 0:
		return
	var vol := 0.0 if muted else _boost_vol
	for i in frames:
		# ruído simples LCG
		_noise_state = fmod(_noise_state * 1103515245.0 + 12345.0, 65536.0)
		var n := (_noise_state / 32768.0) - 1.0
		_boost_phase += 0.08
		var s := n * (0.6 + 0.4 * sin(_boost_phase))
		_boost_playback.push_frame(Vector2(s, s) * vol)


func _next_player() -> AudioStreamPlayer:
	var p: AudioStreamPlayer = _players[_player_idx]
	_player_idx = (_player_idx + 1) % POOL
	return p


func _play_tone(freq: float, dur: float, vol: float, slide_to: float = -1.0) -> void:
	if muted:
		return
	var sample_rate := 22050.0
	var n_frames := int(sample_rate * dur)
	var data := PackedVector2Array()
	data.resize(n_frames)
	var phase := 0.0
	for i in n_frames:
		var t := float(i) / sample_rate
		var f := freq
		if slide_to > 0.0:
			f = lerpf(freq, slide_to, t / dur)
		phase += TAU * f / sample_rate
		var env := exp(-3.5 * t / maxf(dur, 0.01))
		var s := sin(phase) * vol * env
		data[i] = Vector2(s, s)
	var stream := AudioStreamWAV.new()
	stream.mix_rate = int(sample_rate)
	stream.stereo = true
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	var bytes := PackedByteArray()
	bytes.resize(n_frames * 4)
	for i in n_frames:
		var v := int(clampf(data[i].x, -1.0, 1.0) * 32767.0)
		bytes[i * 4] = v & 0xFF
		bytes[i * 4 + 1] = (v >> 8) & 0xFF
		bytes[i * 4 + 2] = v & 0xFF
		bytes[i * 4 + 3] = (v >> 8) & 0xFF
	stream.data = bytes
	var p := _next_player()
	p.stream = stream
	p.play()


func _noise_burst(dur: float, vol: float) -> void:
	if muted:
		return
	var sample_rate := 22050.0
	var n_frames := int(sample_rate * dur)
	var bytes := PackedByteArray()
	bytes.resize(n_frames * 4)
	var st := randf() * 1000.0
	for i in n_frames:
		st = fmod(st * 1103515245.0 + 12345.0, 65536.0)
		var n := ((st / 32768.0) - 1.0) * vol * (1.0 - float(i) / float(n_frames))
		var v := int(clampf(n, -1.0, 1.0) * 32767.0)
		bytes[i * 4] = v & 0xFF
		bytes[i * 4 + 1] = (v >> 8) & 0xFF
		bytes[i * 4 + 2] = v & 0xFF
		bytes[i * 4 + 3] = (v >> 8) & 0xFF
	var stream := AudioStreamWAV.new()
	stream.mix_rate = int(sample_rate)
	stream.stereo = true
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.data = bytes
	var p := _next_player()
	p.stream = stream
	p.play()


func ball_hit(speed: float) -> void:
	var v := minf(1.0, speed / 3000.0)
	_play_tone(180.0 + v * 260.0, 0.12, 0.05 + v * 0.14, 90.0)
	_noise_burst(0.1, 0.05 + v * 0.1)


func bounce(speed: float) -> void:
	var v := minf(1.0, speed / 2500.0)
	_play_tone(120.0 + v * 90.0, 0.1, 0.03 + v * 0.07, 70.0)


func jump() -> void:
	_play_tone(320.0, 0.08, 0.05, 520.0)


func flip() -> void:
	_play_tone(240.0, 0.14, 0.06, 420.0)
	_noise_burst(0.08, 0.04)


func pad(big: bool) -> void:
	if big:
		_play_tone(520.0, 0.16, 0.09, 900.0)
	else:
		_play_tone(700.0, 0.07, 0.05, 1000.0)


func landing(speed: float) -> void:
	_noise_burst(0.09, minf(0.12, speed / 6000.0))


func goal() -> void:
	var notes := [523.25, 659.25, 783.99, 1046.5]
	for i in notes.size():
		get_tree().create_timer(i * 0.11).timeout.connect(
			func(): _play_tone(notes[i], 0.4, 0.1)
		)
	_noise_burst(0.6, 0.16)


func demo() -> void:
	_noise_burst(0.35, 0.2)
	_play_tone(90.0, 0.4, 0.12, 40.0)


func countdown(n: int) -> void:
	if n == 0:
		_play_tone(880.0, 0.3, 0.07)
	else:
		_play_tone(440.0, 0.12, 0.07)


func whistle() -> void:
	_play_tone(1400.0, 0.25, 0.06, 1200.0)
