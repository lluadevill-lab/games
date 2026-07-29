class_name BoostPads
extends RefCounted
## 34 boost pads do mapa soccar: 6 grandes (100/10s) + 28 pequenos (12/4s).

const BIG_PAD_AMOUNT := 100.0
const SMALL_PAD_AMOUNT := 12.0
const BIG_PAD_RESPAWN := 10.0
const SMALL_PAD_RESPAWN := 4.0
const BIG_PAD_RADIUS := 208.0
const SMALL_PAD_RADIUS := 144.0
const PAD_HEIGHT_BIG := 168.0
const PAD_HEIGHT_SMALL := 165.0

## Cada pad: {x, y, big}
static var PADS: Array = [
	# 6 grandes
	{"x": -3072.0, "y": -4096.0, "big": true},
	{"x": 3072.0, "y": -4096.0, "big": true},
	{"x": -3584.0, "y": 0.0, "big": true},
	{"x": 3584.0, "y": 0.0, "big": true},
	{"x": -3072.0, "y": 4096.0, "big": true},
	{"x": 3072.0, "y": 4096.0, "big": true},
	# 28 pequenos
	{"x": 0.0, "y": -4240.0, "big": false},
	{"x": -1792.0, "y": -4184.0, "big": false},
	{"x": 1792.0, "y": -4184.0, "big": false},
	{"x": -940.0, "y": -3308.0, "big": false},
	{"x": 940.0, "y": -3308.0, "big": false},
	{"x": 0.0, "y": -2816.0, "big": false},
	{"x": -3584.0, "y": -2484.0, "big": false},
	{"x": 3584.0, "y": -2484.0, "big": false},
	{"x": -1788.0, "y": -2300.0, "big": false},
	{"x": 1788.0, "y": -2300.0, "big": false},
	{"x": -2048.0, "y": -1036.0, "big": false},
	{"x": 0.0, "y": -1024.0, "big": false},
	{"x": 2048.0, "y": -1036.0, "big": false},
	{"x": -1024.0, "y": 0.0, "big": false},
	{"x": 1024.0, "y": 0.0, "big": false},
	{"x": -2048.0, "y": 1036.0, "big": false},
	{"x": 0.0, "y": 1024.0, "big": false},
	{"x": 2048.0, "y": 1036.0, "big": false},
	{"x": -1788.0, "y": 2300.0, "big": false},
	{"x": 1788.0, "y": 2300.0, "big": false},
	{"x": -3584.0, "y": 2484.0, "big": false},
	{"x": 3584.0, "y": 2484.0, "big": false},
	{"x": 0.0, "y": 2816.0, "big": false},
	{"x": -940.0, "y": 3308.0, "big": false},
	{"x": 940.0, "y": 3308.0, "big": false},
	{"x": -1792.0, "y": 4184.0, "big": false},
	{"x": 1792.0, "y": 4184.0, "big": false},
	{"x": 0.0, "y": 4240.0, "big": false},
]


static func make_pad_states() -> Array:
	var out: Array = []
	for _i in PADS.size():
		var p := RLTypes.PadState.new()
		p.active = true
		p.timer = 0.0
		out.append(p)
	return out
