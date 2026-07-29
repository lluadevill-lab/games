class_name MainMenu
extends CanvasLayer
## Menu principal: modo, bot, duração, gráficos.

signal start_game(config: Dictionary)
signal open_controls

var config := {
	"mode": "match",
	"skill": "medio",
	"match_minutes": 3,
	"quality": "media",
	"show_prediction": true,
}

var _wired := false


func _ready() -> void:
	call_deferred("_wire")


func _wire() -> void:
	if _wired or not has_node("Root/Card/VBox/Play"):
		return
	$Root/Card/VBox/Play.pressed.connect(_on_play)
	$Root/Card/VBox/ControlsBtn.pressed.connect(func(): open_controls.emit())

	_wire_seg($Root/Card/VBox/ModeRow/Seg, "mode", {"Partida 1v1": "match", "Treino livre": "training"})
	_wire_seg($Root/Card/VBox/SkillRow/Seg, "skill", {"Fácil": "facil", "Médio": "medio", "Difícil": "dificil"})
	_wire_seg($Root/Card/VBox/TimeRow/Seg, "match_minutes", {"1 min": 1, "3 min": 3, "5 min": 5})
	_wire_seg($Root/Card/VBox/QualityRow/Seg, "quality", {"Baixo": "baixa", "Médio": "media", "Alto": "alta"})
	_wire_seg($Root/Card/VBox/PredRow/Seg, "show_prediction", {"Ligada": true, "Desligada": false})
	_wired = true


func _wire_seg(container: HBoxContainer, key: String, options: Dictionary) -> void:
	for child in container.get_children():
		child.queue_free()
	var first := true
	for label in options.keys():
		var btn := Button.new()
		btn.text = label
		btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		btn.toggle_mode = true
		btn.button_pressed = first
		if first:
			first = false
		var val = options[label]
		btn.pressed.connect(func():
			for c in container.get_children():
				if c is Button:
					c.button_pressed = (c == btn)
			config[key] = val
		)
		container.add_child(btn)


func _on_play() -> void:
	start_game.emit(config.duplicate())


func show_menu() -> void:
	visible = true


func hide_menu() -> void:
	visible = false
