class_name ArenaMesh
extends Node3D
## Arena low-poly: piso, paredes, gols, linhas e boost pads.

var pad_meshes: Array = []  # MeshInstance3D
var pad_rings: Array = []


func build() -> void:
	# limpa filhos
	for c in get_children():
		c.queue_free()
	pad_meshes.clear()
	pad_rings.clear()

	_build_floor()
	_build_walls()
	_build_ceiling()
	_build_goals()
	_build_lines()
	_build_pads()
	_build_ambient()


func _mat(color: Color, emission: Color = Color(0, 0, 0, 0), emission_energy: float = 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.85
	m.metallic = 0.05
	if emission_energy > 0.0:
		m.emission_enabled = true
		m.emission = emission
		m.emission_energy_multiplier = emission_energy
	return m


func _build_floor() -> void:
	var outline := Arena.field_outline(16)
	# piso como box grande (cantos arredondados via visual das paredes)
	var floor_mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(RLConstants.FIELD_X * 2.0 + 200.0, RLConstants.FIELD_Y * 2.0 + 200.0, 4.0)
	floor_mi.mesh = box
	floor_mi.position = Vector3(0, 0, -2)
	floor_mi.material_override = _mat(Color(0.12, 0.16, 0.22))
	add_child(floor_mi)

	# faixas de grama estilizadas
	for i in range(-4, 5):
		var stripe := MeshInstance3D.new()
		var sbox := BoxMesh.new()
		sbox.size = Vector3(RLConstants.FIELD_X * 2.0, RLConstants.FIELD_Y * 0.11, 0.5)
		stripe.mesh = sbox
		stripe.position = Vector3(0, i * RLConstants.FIELD_Y * 0.22, 0.3)
		var c := Color(0.14, 0.22, 0.16) if i % 2 == 0 else Color(0.11, 0.18, 0.14)
		stripe.material_override = _mat(c)
		add_child(stripe)

	# contorno luminoso
	if outline.size() > 1:
		var imm := ImmediateMesh.new()
		imm.surface_begin(Mesh.PRIMITIVE_LINE_STRIP)
		for p in outline:
			imm.surface_add_vertex(Vector3(p.x, p.y, 8.0))
		imm.surface_end()
		var mi := MeshInstance3D.new()
		mi.mesh = imm
		mi.material_override = _mat(Color(0.4, 0.7, 1.0), Color(0.3, 0.6, 1.0), 0.8)
		add_child(mi)


func _build_walls() -> void:
	var wall_mat := _mat(Color(0.08, 0.11, 0.16))
	var h := RLConstants.CEILING_Z
	# laterais X
	for sx in [-1.0, 1.0]:
		var w := MeshInstance3D.new()
		var b := BoxMesh.new()
		b.size = Vector3(40.0, RLConstants.FIELD_Y * 2.0 - RLConstants.CORNER_RADIUS * 2.0, h)
		w.mesh = b
		w.position = Vector3(sx * RLConstants.FIELD_X, 0, h * 0.5)
		w.material_override = wall_mat
		add_child(w)
	# fundos Y (fora da boca do gol)
	for sy in [-1.0, 1.0]:
		var half_span := RLConstants.FIELD_X - RLConstants.CORNER_RADIUS
		var goal_gap := RLConstants.GOAL_HALF_W
		for side in [-1.0, 1.0]:
			var mid_x := side * (goal_gap + (half_span - goal_gap) * 0.5)
			var width := half_span - goal_gap
			if width <= 0.0:
				continue
			var w2 := MeshInstance3D.new()
			var b2 := BoxMesh.new()
			b2.size = Vector3(width, 40.0, h)
			w2.mesh = b2
			w2.position = Vector3(mid_x, sy * RLConstants.FIELD_Y, h * 0.5)
			w2.material_override = wall_mat
			add_child(w2)
		# acima do gol
		var above := MeshInstance3D.new()
		var ba := BoxMesh.new()
		ba.size = Vector3(RLConstants.GOAL_HALF_W * 2.0, 40.0, h - RLConstants.GOAL_H)
		above.mesh = ba
		above.position = Vector3(0, sy * RLConstants.FIELD_Y, RLConstants.GOAL_H + (h - RLConstants.GOAL_H) * 0.5)
		above.material_override = wall_mat
		add_child(above)

	# cantos arredondados (cilindros)
	var cr := RLConstants.CORNER_RADIUS
	var cx := RLConstants.FIELD_X - cr
	var cy := RLConstants.FIELD_Y - cr
	for sx in [-1.0, 1.0]:
		for sy in [-1.0, 1.0]:
			var corner := MeshInstance3D.new()
			var cyl := CylinderMesh.new()
			cyl.top_radius = cr
			cyl.bottom_radius = cr
			cyl.height = h
			cyl.radial_segments = 16
			corner.mesh = cyl
			corner.position = Vector3(sx * cx, sy * cy, h * 0.5)
			corner.rotation_degrees = Vector3(90, 0, 0)
			# só a casca externa — usa material e escala levemente
			corner.material_override = wall_mat
			# na verdade o cilindro sólido preenche o canto; ok visualmente low-poly
			# escondemos o interior com CSG seria caro; deixamos semi-transparente no canto
			var m := wall_mat.duplicate() as StandardMaterial3D
			m.albedo_color = Color(0.09, 0.12, 0.18)
			corner.material_override = m
			add_child(corner)


func _build_ceiling() -> void:
	var ceil := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = Vector3(RLConstants.FIELD_X * 2.2, RLConstants.FIELD_Y * 2.2, 20.0)
	ceil.mesh = b
	ceil.position = Vector3(0, 0, RLConstants.CEILING_Z + 10.0)
	var m := _mat(Color(0.05, 0.07, 0.1))
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	ceil.material_override = m
	add_child(ceil)


func _build_goals() -> void:
	for team in [0, 1]:
		var sy := -1.0 if team == 0 else 1.0  # azul defende -Y
		var color := Color(0.24, 0.55, 1.0) if team == 0 else Color(1.0, 0.54, 0.17)
		var frame_mat := _mat(color, color, 1.2)

		# postes
		for sx in [-1.0, 1.0]:
			var post := MeshInstance3D.new()
			var cyl := CylinderMesh.new()
			cyl.top_radius = 12.0
			cyl.bottom_radius = 12.0
			cyl.height = RLConstants.GOAL_H
			post.mesh = cyl
			post.position = Vector3(sx * RLConstants.GOAL_HALF_W, sy * RLConstants.FIELD_Y, RLConstants.GOAL_H * 0.5)
			post.rotation_degrees = Vector3(90, 0, 0)
			post.material_override = frame_mat
			add_child(post)

		# travessão
		var cross := MeshInstance3D.new()
		var cbox := BoxMesh.new()
		cbox.size = Vector3(RLConstants.GOAL_HALF_W * 2.0, 20.0, 20.0)
		cross.mesh = cbox
		cross.position = Vector3(0, sy * RLConstants.FIELD_Y, RLConstants.GOAL_H)
		cross.material_override = frame_mat
		add_child(cross)

		# rede (grade)
		var back_y := sy * (RLConstants.FIELD_Y + RLConstants.GOAL_DEPTH)
		var net_mat := _mat(color, color, 0.3)
		net_mat.albedo_color.a = 0.35
		net_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		for i in range(9):
			var x := -RLConstants.GOAL_HALF_W + (float(i) / 8.0) * RLConstants.GOAL_HALF_W * 2.0
			var bar := MeshInstance3D.new()
			var bb := BoxMesh.new()
			bb.size = Vector3(4.0, 4.0, RLConstants.GOAL_H)
			bar.mesh = bb
			bar.position = Vector3(x, back_y, RLConstants.GOAL_H * 0.5)
			bar.material_override = net_mat
			add_child(bar)
		# painel luminoso
		var glow := MeshInstance3D.new()
		var gp := PlaneMesh.new()
		gp.size = Vector2(RLConstants.GOAL_HALF_W * 2.0, RLConstants.GOAL_H)
		glow.mesh = gp
		glow.position = Vector3(0, back_y, RLConstants.GOAL_H * 0.5)
		glow.rotation_degrees = Vector3(90, 0, 0)
		var gm := _mat(color, color, 0.6)
		gm.albedo_color.a = 0.2
		gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		gm.cull_mode = BaseMaterial3D.CULL_DISABLED
		glow.material_override = gm
		add_child(glow)


func _build_lines() -> void:
	var line_mat := _mat(Color(0.85, 0.9, 0.95), Color(0.5, 0.7, 1.0), 0.3)
	# linha central
	var mid := MeshInstance3D.new()
	var mb := BoxMesh.new()
	mb.size = Vector3(RLConstants.FIELD_X * 2.0, 12.0, 1.0)
	mid.mesh = mb
	mid.position = Vector3(0, 0, 1.0)
	mid.material_override = line_mat
	add_child(mid)
	# círculo central
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 880.0
	tm.outer_radius = 900.0
	tm.rings = 4
	tm.ring_segments = 32
	ring.mesh = tm
	ring.position = Vector3(0, 0, 2.0)
	ring.rotation_degrees = Vector3(90, 0, 0)
	ring.material_override = line_mat
	add_child(ring)


func _build_pads() -> void:
	for p in BoostPads.PADS:
		var big: bool = p.big
		var mi := MeshInstance3D.new()
		if big:
			var cyl := CylinderMesh.new()
			cyl.top_radius = 0.0
			cyl.bottom_radius = 90.0
			cyl.height = 150.0
			cyl.radial_segments = 6
			mi.mesh = cyl
			mi.position = Vector3(p.x, p.y, 80.0)
		else:
			var cyl2 := CylinderMesh.new()
			cyl2.top_radius = 0.0
			cyl2.bottom_radius = 42.0
			cyl2.height = 70.0
			cyl2.radial_segments = 5
			mi.mesh = cyl2
			mi.position = Vector3(p.x, p.y, 40.0)
		mi.rotation_degrees = Vector3(90, 0, 0)
		var col := Color(1.0, 0.78, 0.29) if big else Color(1.0, 0.85, 0.54)
		mi.material_override = _mat(col, col, 1.5)
		add_child(mi)
		pad_meshes.append(mi)

		var ring := MeshInstance3D.new()
		var tm := TorusMesh.new()
		if big:
			tm.inner_radius = 120.0
			tm.outer_radius = 150.0
		else:
			tm.inner_radius = 60.0
			tm.outer_radius = 74.0
		tm.rings = 3
		tm.ring_segments = 12
		ring.mesh = tm
		ring.position = Vector3(p.x, p.y, 5.0)
		ring.rotation_degrees = Vector3(90, 0, 0)
		var rm := _mat(col, col, 0.8)
		rm.albedo_color.a = 0.45
		rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		ring.material_override = rm
		add_child(ring)
		pad_rings.append(ring)


func _build_ambient() -> void:
	# luzes de gol
	for team in [0, 1]:
		var sy := -1.0 if team == 0 else 1.0
		var color := Color(0.3, 0.55, 1.0) if team == 0 else Color(1.0, 0.5, 0.2)
		var light := OmniLight3D.new()
		light.light_color = color
		light.light_energy = 4.0
		light.omni_range = 2500.0
		light.position = Vector3(0, sy * (RLConstants.FIELD_Y + 200.0), 400.0)
		add_child(light)


func sync_pads(world: RLTypes.WorldState, time: float, dt: float) -> void:
	for i in pad_meshes.size():
		var st: RLTypes.PadState = world.pads[i]
		var m: MeshInstance3D = pad_meshes[i]
		var r: MeshInstance3D = pad_rings[i]
		m.visible = st.active
		r.visible = st.active
		if st.active:
			m.rotate_object_local(Vector3.FORWARD, dt * 1.6)
			var bob := sin(time * 3.0 + float(i)) * 6.0
			var base_z := 80.0 if BoostPads.PADS[i].big else 40.0
			m.position.z = base_z + bob
