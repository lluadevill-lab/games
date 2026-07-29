class_name SimRng
extends RefCounted
## Gerador mulberry32 semeado — a simulação NUNCA usa randf() nativo.
## Determinismo = replays, testes e netcode.

var _s: int = 0x9E3779B9


func reseed(seed: int) -> void:
	_s = seed & 0xFFFFFFFF


func state() -> int:
	return _s


func next() -> float:
	_s = (_s + 0x6D2B79F5) & 0xFFFFFFFF
	var t: int = _s
	t = _imul(t ^ (t >> 15), t | 1)
	t = t ^ (t + _imul(t ^ (t >> 7), t | 61))
	return float((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0


func range(min_v: float, max_v: float) -> float:
	return min_v + next() * (max_v - min_v)


func rand_int(n: int) -> int:
	if n <= 0:
		return 0
	return int(floor(next() * float(n)))


func _imul(a: int, b: int) -> int:
	## Multiplicação 32-bit com wrap (equivalente a Math.imul do JS).
	var a32 := a & 0xFFFFFFFF
	var b32 := b & 0xFFFFFFFF
	var ah := (a32 >> 16) & 0xFFFF
	var al := a32 & 0xFFFF
	var bh := (b32 >> 16) & 0xFFFF
	var bl := b32 & 0xFFFF
	var high := ((ah * bl + al * bh) & 0xFFFF) << 16
	return (high + al * bl) & 0xFFFFFFFF
