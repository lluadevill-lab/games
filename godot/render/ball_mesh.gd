class_name BallMesh
extends Node3D
## Bola low-poly com wireframe e sombra falsa.

var mesh_inst: MeshInstance3D
var shadow: MeshInstance3D
var _spin_accum := Vector3.ZERO


func build() -> void:
	for c in get_children():
		c.queue_free()

	mesh_inst = MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = RLConstants.BALL_RADIUS
	sphere.height = RLConstants.BALL_RADIUS * 2.0
	sphere.radial_segments = 16
	sphere.rings = 8
	mesh_inst.mesh = sphere
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.95, 0.96, 0.97)
	m.roughness = 0.4
	m.metallic = 0.05
	mesh_inst.material_override = m
	add_child(mesh_inst)

	# painéis escuros (icosaedro visual barato)
	var wire := MeshInstance3D.new()
	var ws := SphereMesh.new()
	ws.radius = RLConstants.BALL_RADIUS * 1.01
	ws.height = RLConstants.BALL_RADIUS * 2.02
	ws.radial_segments = 8
	ws.rings = 4
	wire.mesh = ws
	var wm := StandardMaterial3D.new()
	wm.albedo_color = Color(0.16, 0.2, 0.25, 0.35)
	wm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	wm.wireframe = true
	wire.material_override = wm
	add_child(wire)

	shadow = MeshInstance3D.new()
	var disc := CylinderMesh.new()
	disc.top_radius = RLConstants.BALL_RADIUS
	disc.bottom_radius = RLConstants.BALL_RADIUS
	disc.height = 2.0
	shadow.mesh = disc
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(0, 0, 0, 0.3)
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	shadow.material_override = sm
	add_child(shadow)


func sync(ball: RLTypes.BallState, dt: float) -> void:
	position = CarMesh._to_godot(ball.pos)
	var w := ball.ang
	var wl := w.length()
	if wl > 1e-4:
		# eixo de spin no espaço sim → godot
		var axis_sim := w / wl
		var axis_g := CarMesh._to_godot(axis_sim).normalized()
		rotate(axis_g, wl * dt)

	# sombra no chão
	var sp := CarMesh._to_godot(Vector3(ball.pos.x, ball.pos.y, 6.0))
	shadow.global_position = sp
	var bs := maxf(0.35, 1.0 - ball.pos.z / 2200.0)
	shadow.scale = Vector3(bs, 1.0, bs)
	var mat := shadow.material_override as StandardMaterial3D
	if mat:
		mat.albedo_color.a = 0.32 * bs
