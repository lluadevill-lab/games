class_name PredictionLine
extends MeshInstance3D
## Linha tracejada da predição da bola.


func _ready() -> void:
	var imm := ImmediateMesh.new()
	mesh = imm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.5, 0.83, 1.0, 0.55)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.emission_enabled = true
	mat.emission = Color(0.4, 0.75, 1.0)
	mat.emission_energy_multiplier = 0.6
	material_override = mat


func set_points(points: Array) -> void:
	var imm := ImmediateMesh.new()
	if points.size() < 2:
		mesh = imm
		return
	imm.surface_begin(Mesh.PRIMITIVE_LINE_STRIP)
	for p in points:
		var gp: Vector3 = CarMesh._to_godot(p.pos if p is Dictionary else p)
		imm.surface_add_vertex(gp)
	imm.surface_end()
	mesh = imm
