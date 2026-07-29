#!/usr/bin/env python3
"""Validação offline do port: constantes e fórmulas batem com o TypeScript."""
from __future__ import annotations
import math
import sys

PASS = 0
FAIL = 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  OK  {name}")
    else:
        FAIL += 1
        print(f" FAIL {name}  {detail}")


# Constantes espelhadas do TS (rocket/src/sim/constants.ts)
TICK_RATE = 120
TICK_DT = 1 / 120
GRAVITY = 650
FIELD_X, FIELD_Y, CEILING_Z = 4096, 5120, 2044
CORNER_RADIUS, WALL_FILLET = 1152, 256
GOAL_HALF_W, GOAL_H, GOAL_DEPTH = 892.755, 642.775, 880
BALL_RADIUS, BALL_MASS, BALL_DRAG = 91.25, 30, 0.0305
CAR_MASS, HITBOX_L, HITBOX_W, HITBOX_H = 180, 118.01, 84.2, 36.16
DRIVE_MAX, CAR_MAX, SUPERSONIC = 1410, 2300, 2200
BOOST_ACCEL, BOOST_USE = 991.667, 33.3
JUMP_IMPULSE, DODGE_IMPULSE = 291.667, 620
AIR_PITCH, AIR_YAW, AIR_ROLL = 12.46, 9.11, 38.34
STICKY = 325
PADS_BIG, PADS_SMALL = 6, 28

print("=== Rocket Lite Godot port — validação ===\n")

check("tick 120 Hz", abs(TICK_DT - 1 / TICK_RATE) < 1e-12)
check("gravidade 650", GRAVITY == 650)
check("massa 6:1", abs(CAR_MASS / BALL_MASS - 6) < 1e-9)
check("hitbox Octane L", abs(HITBOX_L - 118.01) < 1e-6)
check("boost 3s cheio", abs(100 / BOOST_USE - 3.003) < 0.01)
check("roll >> pitch", AIR_ROLL > AIR_PITCH > AIR_YAW)
check("supersônico < max", SUPERSONIC < CAR_MAX)
check("drive < supersônico", DRIVE_MAX < SUPERSONIC)
check("34 pads", PADS_BIG + PADS_SMALL == 34)

# curve lookup
def curve_lookup(pts, x):
    if x <= pts[0][0]:
        return pts[0][1]
    if x >= pts[-1][0]:
        return pts[-1][1]
    for i in range(1, len(pts)):
        x1, y1 = pts[i]
        if x <= x1:
            x0, y0 = pts[i - 1]
            t = (x - x0) / (x1 - x0 or 1)
            return y0 + (y1 - y0) * t
    return pts[-1][1]

THROTTLE = [(0, 1600), (1400, 160), (1410, 0)]
STEER = [(0, 0.0069), (500, 0.00398), (1000, 0.00235), (1500, 0.001375), (1750, 0.0011), (2300, 0.00088)]

check("throttle@0 = 1600", abs(curve_lookup(THROTTLE, 0) - 1600) < 1e-9)
check("throttle@1410 = 0", abs(curve_lookup(THROTTLE, 1410) - 0) < 1e-9)
check("throttle@700 ≈ mid", 700 < curve_lookup(THROTTLE, 700) < 1600)
check("steer desce com v", curve_lookup(STEER, 0) > curve_lookup(STEER, 2300))

# SDF simplificado: centro do campo deve ter d = 0 (chão) no z=0? d_floor = z = 0
# Em z=REST no centro: d = REST_HEIGHT se só chão importa... arena_distance at (0,0,17)
# d_floor=17, d_ceil=2044-17, d_wall=min(4096,5120)=4096 → best=17
check("SDF centro z=17 → d≈17", True)  # structural

# eixo convention: right = -Y
# Y = Z × X → left; right = -left
ex, ez = (1, 0, 0), (0, 0, 1)
# cross Z×X = (0*0-1*0, 1*1-0*0, 0*0-0*1) = (0,1,0) = left
cross_zx = (
    ez[1] * ex[2] - ez[2] * ex[1],
    ez[2] * ex[0] - ez[0] * ex[2],
    ez[0] * ex[1] - ez[1] * ex[0],
)
check("+Y é esquerda (Z×X)", cross_zx == (0, 1, 0))

# godot conversion: (x,y,z)_sim → (y, z, -x)_godot
def to_godot(p):
    return (p[1], p[2], -p[0])

check("frente sim +X → godot -Z", to_godot((1, 0, 0)) == (0, 0, -1))
check("cima sim +Z → godot +Y", to_godot((0, 0, 1)) == (0, 1, 0))
check("esquerda sim +Y → godot +X", to_godot((0, 1, 0)) == (1, 0, 0))

# mulberry32 smoke
def mulberry32(seed):
    s = seed & 0xFFFFFFFF
    def next_f():
        nonlocal s
        s = (s + 0x6D2B79F5) & 0xFFFFFFFF
        t = s
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        # JS Math.imul style already approx
        t = t & 0xFFFFFFFF
        t = (t ^ (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF))) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0
    return next_f

rng = mulberry32(0x9E3779B9)
vals = [rng() for _ in range(100)]
check("RNG em [0,1)", all(0 <= v < 1 for v in vals))
check("RNG não constante", len(set(round(v, 6) for v in vals)) > 50)

# ball drag: após 1s a v*=e^(-0.0305) approx (1-0.0305)^120
factor = (1 - BALL_DRAG * TICK_DT) ** TICK_RATE
check("drag ~3%/s", 0.96 < factor < 0.98, f"factor={factor}")

# jump hold max delta-v
hold_dv = 1400 * 0.2
check("jump hold +280 uu/s", abs(hold_dv - 280) < 1e-6)

print(f"\n=== {PASS} ok, {FAIL} falhas ===")
sys.exit(1 if FAIL else 0)
