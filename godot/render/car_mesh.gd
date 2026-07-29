class_name CarMesh
extends Node3D
## Carro low-poly: chassi + rodas + chama de boost + anel supersônico.

var body: MeshInstance3D
var wheels: Array = []  # MeshInstance3D
var flame: MeshInstance3D
var supersonic_ring: MeshInstance3D
var trail: MeshInstance3D
var team: int = 0
var car_id: int = 0

const STYLES := [
	{"name": "Vector", "length": 1.0, "width": 1.0, "height": 1.0, "spoiler": true},
	{"name": "Comet", "length": 0.92, "width": 1.08, "height": 0.9, "spoiler": true},
	{"name": "Bison", "length": 1.1, "width": 1.02, "height": 1.12, "spoiler": false},
]


func build(p_team: int, p_id: int) -> void:
	team = p_team
	car_id = p_id
	for c in get_children():
		c.queue_free()
	wheels.clear()

	var style: Dictionary = STYLES[p_id % STYLES.size()]
	var primary := Color(0.18, 0.49, 1.0) if team == 0 else Color(1.0, 0.48, 0.12)
	var dark := Color(0.07, 0.09, 0.15)
	var accent := Color(0.9, 0.95, 1.0) if team == 0 else Color(1.0, 0.85, 0.4)

	var l: float = (RLConstants.HITBOX_L * 0.5) * style.length
	var w: float = (RLConstants.HITBOX_W * 0.5) * style.width
	var h: float = (RLConstants.HITBOX_H * 0.5) * style.height

	# corpo principal
	body = MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(l * 2.0, w * 2.0, h * 2.0)
	body.mesh = box
	body.position = Vector3(0, 0, RLConstants.HITBOX_OFFSET_Z)
	body.material_override = _mat(primary)
	add_child(body)

	# cabine
	var cabin := MeshInstance3D.new()
	var cbox := BoxMesh.new()
	cbox.size = Vector3(l * 0.9, w * 1.4, h * 1.1)
	cabin.mesh = cbox
	cabin.position = Vector3(l * 0.05, 0, h + RLConstants.HITBOX_OFFSET_Z + 2.0)
	cabin.material_override = _mat(Color(0.15, 0.2, 0.3).lerp(primary, 0.3))
	add_child(cabin)

	# para-brisa
	var glass := MeshInstance3D.new()
	var gbox := BoxMesh.new()
	gbox.size = Vector3(l * 0.5, w * 1.2, h * 0.7)
	glass.mesh = gbox
	glass.position = Vector3(l * 0.35, 0, h * 1.4 + RLConstants.HITBOX_OFFSET_Z)
	var gm := _mat(Color(0.4, 0.7, 1.0, 0.55))
	gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.material_override = gm
	add_child(glass)

	# faixa / decal
	var stripe := MeshInstance3D.new()
	var sbox := BoxMesh.new()
	sbox.size = Vector3(l * 1.6, w * 0.35, 1.0)
	stripe.mesh = sbox
	stripe.position = Vector3(0, 0, h + RLConstants.HITBOX_OFFSET_Z + 0.5)
	stripe.material_override = _mat(accent, accent, 0.8)
	add_child(stripe)

	# spoiler
	if style.spoiler:
		var spoiler := MeshInstance3D.new()
		var sp := BoxMesh.new()
		sp.size = Vector3(l * 0.25, w * 1.8, 6.0)
		spoiler.mesh = sp
		spoiler.position = Vector3(-l * 0.85, 0, h + 10.0)
		spoiler.material_override = _mat(dark)
		add_child(spoiler)

	# nariz / bumper
	var nose := MeshInstance3D.new()
	var nb := BoxMesh.new()
	nb.size = Vector3(l * 0.35, w * 1.6, h * 0.7)
	nose.mesh = nb
	nose.position = Vector3(l * 0.9, 0, RLConstants.HITBOX_OFFSET_Z - 2.0)
	nose.material_override = _mat(dark)
	add_child(nose)

	# rodas
	var wheel_defs := [
		[RLConstants.WHEEL_FRONT_X, RLConstants.WHEEL_Y],
		[RLConstants.WHEEL_FRONT_X, -RLConstants.WHEEL_Y],
		[RLConstants.WHEEL_REAR_X, RLConstants.WHEEL_Y],
		[RLConstants.WHEEL_REAR_X, -RLConstants.WHEEL_Y],
	]
	for wd in wheel_defs:
		var wh := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = RLConstants.WHEEL_RADIUS
		cyl.bottom_radius = RLConstants.WHEEL_RADIUS
		cyl.height = 12.0
		cyl.radial_segments = 12
		wh.mesh = cyl
		# eixo Y local = lateral do carro; cilindro default é Y-up no Godot
		# rotacionamos para o eixo da roda ficar em Y local do carro
		wh.rotation_degrees = Vector3(0, 0, 90)
		wh.position = Vector3(wd[0], wd[1], RLConstants.WHEEL_Z)
		wh.material_override = _mat(Color(0.08, 0.08, 0.1))
		add_child(wh)
		# aro
		var rim := MeshInstance3D.new()
		var rc := CylinderMesh.new()
		rc.top_radius = RLConstants.WHEEL_RADIUS * 0.55
		rc.bottom_radius = RLConstants.WHEEL_RADIUS * 0.55
		rc.height = 13.0
		rim.mesh = rc
		rim.rotation_degrees = Vector3(0, 0, 90)
		rim.position = wh.position
		rim.material_override = _mat(primary.darkened(0.3), primary, 0.4)
		add_child(rim)
		wheels.append(wh)

	# chama do boost
	flame = MeshInstance3D.new()
	var fc := CylinderMesh.new()
	fc.top_radius = 0.0
	fc.bottom_radius = 18.0
	fc.height = 55.0
	fc.radial_segments = 6
	flame.mesh = fc
	flame.position = Vector3(-l - 20.0, 0, RLConstants.HITBOX_OFFSET_Z)
	flame.rotation_degrees = Vector3(0, 0, 90)
	var fm := _mat(Color(1.0, 0.55, 0.1), Color(1.0, 0.6, 0.15), 3.0)
	flame.material_override = fm
	flame.visible = false
	add_child(flame)

	# anel supersônico
	supersonic_ring = MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 40.0
	tm.outer_radius = 52.0
	tm.rings = 6
	tm.ring_segments = 16
	supersonic_ring.mesh = tm
	supersonic_ring.position = Vector3(-l * 0.3, 0, RLConstants.HITBOX_OFFSET_Z)
	supersonic_ring.rotation_degrees = Vector3(0, 0, 90)
	var sm := _mat(Color(0.5, 0.85, 1.0), Color(0.4, 0.8, 1.0), 2.0)
	sm.albedo_color.a = 0.7
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	supersonic_ring.material_override = sm
	supersonic_ring.visible = false
	add_child(supersonic_ring)

	# sombra falsa
	var shadow := MeshInstance3D.new()
	var disc := CylinderMesh.new()
	disc.top_radius = RLConstants.HITBOX_L * 0.45
	disc.bottom_radius = RLConstants.HITBOX_L * 0.45
	disc.height = 1.0
	shadow.mesh = disc
	shadow.position = Vector3(0, 0, -RLConstants.REST_HEIGHT + 2.0)
	var shm := _mat(Color(0, 0, 0, 0.3))
	shm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	shadow.material_override = shm
	shadow.name = "FakeShadow"
	add_child(shadow)


func _mat(color: Color, emission: Color = Color(0, 0, 0), emission_energy: float = 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.55
	m.metallic = 0.25
	if emission_energy > 0.0:
		m.emission_enabled = true
		m.emission = emission
		m.emission_energy_multiplier = emission_energy
	return m


func sync(car: RLTypes.CarState, dt: float) -> void:
	var hidden := car.demo_timer > 0.0
	visible = not hidden
	if hidden:
		return

	# Convenção sim: X=frente, Y=esquerda, Z=cima
	# Godot padrão: X=direita, Y=cima, Z=trás — convertemos no GameRoot
	# Aqui o Node3D já está no espaço convertido pelo parent.
	position = _to_godot(car.pos)
	quaternion = _quat_to_godot(car.rot)

	var boosting := car.input.boost and car.boost > 0.0
	flame.visible = boosting
	if boosting:
		var f := 0.7 + randf() * 0.6
		flame.scale = Vector3(f, 1.0, f)

	supersonic_ring.visible = car.supersonic
	if car.supersonic:
		supersonic_ring.rotate_object_local(Vector3.RIGHT, dt * 8.0)

	var speed := car.vel.length()
	var spin := (speed / RLConstants.WHEEL_RADIUS) * dt * (1.0 if car.on_ground else 0.25)
	var steer_vis := -car.input.steer * 0.42 if car.on_ground else 0.0
	for wi in wheels.size():
		var wm: MeshInstance3D = wheels[wi]
		# gira a roda em torno do eixo lateral (após rotation Z=90, o eixo local Y gira o pneu)
		wm.rotate_object_local(Vector3(0, 1, 0), spin)
		var compression: float = float(car.wheel_compression[wi])
		var droop := 0.0 if car.wheel_contact[wi] else -RLConstants.SUSPENSION_TRAVEL * 0.22
		var z_off := RLConstants.WHEEL_Z + compression * RLConstants.SUSPENSION_TRAVEL * 0.45 + droop
		var base_local := Vector3(
			float(CarPhysics.WHEELS[wi][0]),
			float(CarPhysics.WHEELS[wi][1]),
			z_off
		)
		wm.position = _local_sim_to_node(base_local)
		# esterço visual nas rodas dianteiras (wi 0 e 1)
		if wi < 2:
			wm.rotation.y = steer_vis


## Sim (X front, Y left, Z up) → Godot (X right, Y up, Z back):
## godot = (sim.y, sim.z, -sim.x)  NÃO — 
## Queremos: frente sim +X → -Z godot, cima sim +Z → +Y godot, esquerda sim +Y → +X godot
## godot.x = sim.y
## godot.y = sim.z  
## godot.z = -sim.x
static func _to_godot(p: Vector3) -> Vector3:
	return Vector3(p.y, p.z, -p.x)


static func _local_sim_to_node(p: Vector3) -> Vector3:
	return Vector3(p.y, p.z, -p.x)


## Converte quaternion da sim (X-front Z-up) para Godot (Y-up, -Z-forward).
static func _quat_to_godot(q: Quaternion) -> Quaternion:
	# Matriz de mudança de base B: sim → godot
	# B * (1,0,0) = (0,0,-1)  front
	# B * (0,1,0) = (1,0,0)   left
	# B * (0,0,1) = (0,1,0)   up
	# B = [[0,1,0],[0,0,1],[-1,0,0]]
	var b := Basis(
		Vector3(0, 0, -1),  # coluna 0 = imagem de ex
		Vector3(1, 0, 0),   # coluna 1 = imagem de ey
		Vector3(0, 1, 0)    # coluna 2 = imagem de ez
	)
	# R_godot = B * R_sim * B^-1
	var r_sim := Basis(q)
	var r_godot: Basis = b * r_sim * b.inverse()
	return r_godot.get_rotation_quaternion()
