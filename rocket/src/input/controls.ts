/**
 * Entradas: teclado, gamepad e touch. Todos produzem o mesmo CarInput —
 * exatamente como no jogo original, onde o "skill" está nos mesmos 8 canais.
 */
import { deadzone, clamp } from "../core/mathx";
import type { CarInput } from "../sim/types";

export type Binding = keyof typeof DEFAULT_KEYS;

export const DEFAULT_KEYS = {
  throttle: ["KeyW", "ArrowUp"],
  reverse: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  jump: ["Space"],
  boost: ["ShiftLeft", "ShiftRight", "KeyL"],
  handbrake: ["KeyK", "AltLeft"],
  pitchUp: ["KeyI"],
  pitchDown: ["KeyO"],
  ballcam: ["KeyC"],
  reset: ["KeyR"],
};

export class Controls {
  private keys = new Set<string>();
  private pressedOnce = new Set<string>();
  gamepadIndex: number | null = null;
  touch = {
    active: false,
    steer: 0,
    throttle: 0,
    pitch: 0,
    jump: false,
    boost: false,
    handbrake: false,
  };

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedOnce.add(e.code);
      if (
        [
          "Space",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Tab",
        ].includes(e.code)
      )
        e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    window.addEventListener("gamepadconnected", (e) => {
      this.gamepadIndex = (e as GamepadEvent).gamepad.index;
    });
    window.addEventListener("gamepaddisconnected", () => {
      this.gamepadIndex = null;
    });
  }

  private any(codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  /** true apenas no frame em que a tecla foi pressionada. */
  tapped(codes: string[]): boolean {
    for (const c of codes) if (this.pressedOnce.has(c)) return true;
    return false;
  }

  endFrame(): void {
    this.pressedOnce.clear();
  }

  private gamepad(): Gamepad | null {
    if (this.gamepadIndex === null) return null;
    const pads = navigator.getGamepads?.() ?? [];
    return pads[this.gamepadIndex] ?? null;
  }

  /** Preenche `out` com o estado atual das entradas. */
  poll(out: CarInput): CarInput {
    let throttle = 0;
    let steer = 0;
    let pitch = 0;
    let yaw = 0;
    let roll = 0;
    let jump = false;
    let boost = false;
    let handbrake = false;

    // ---- teclado
    if (this.any(DEFAULT_KEYS.throttle)) throttle += 1;
    if (this.any(DEFAULT_KEYS.reverse)) throttle -= 1;
    if (this.any(DEFAULT_KEYS.right)) steer += 1;
    if (this.any(DEFAULT_KEYS.left)) steer -= 1;
    if (this.any(DEFAULT_KEYS.jump)) jump = true;
    if (this.any(DEFAULT_KEYS.boost)) boost = true;
    if (this.any(DEFAULT_KEYS.handbrake)) handbrake = true;
    // No ar, W/S viram pitch e A/D viram yaw (padrão do RL no teclado).
    pitch = -throttle;
    yaw = steer;
    if (this.any(DEFAULT_KEYS.pitchUp)) pitch = 1;
    if (this.any(DEFAULT_KEYS.pitchDown)) pitch = -1;
    roll = handbrake ? steer : 0;

    // ---- gamepad (layout padrão do RL)
    const gp = this.gamepad();
    if (gp) {
      const lx = deadzone(gp.axes[0] ?? 0);
      const ly = deadzone(gp.axes[1] ?? 0);
      const rt = gp.buttons[7]?.value ?? 0;
      const lt = gp.buttons[6]?.value ?? 0;
      if (Math.abs(lx) > 0) {
        steer = lx;
        yaw = lx;
      }
      if (Math.abs(ly) > 0) pitch = ly;
      const t = rt - lt;
      if (Math.abs(t) > 0.05) throttle = t;
      if (gp.buttons[0]?.pressed) jump = true; // A
      if (gp.buttons[1]?.pressed) boost = true; // B
      if (gp.buttons[2]?.pressed) handbrake = true; // X
      if (handbrake) roll = lx;
    }

    // ---- touch
    if (this.touch.active) {
      if (this.touch.throttle !== 0) throttle = this.touch.throttle;
      if (this.touch.steer !== 0) {
        steer = this.touch.steer;
        yaw = this.touch.steer;
      }
      if (this.touch.pitch !== 0) pitch = this.touch.pitch;
      jump = jump || this.touch.jump;
      boost = boost || this.touch.boost;
      handbrake = handbrake || this.touch.handbrake;
      if (handbrake) roll = steer;
    }

    out.throttle = clamp(throttle, -1, 1);
    out.steer = clamp(steer, -1, 1);
    out.pitch = clamp(pitch, -1, 1);
    out.yaw = clamp(handbrake ? 0 : yaw, -1, 1);
    out.roll = clamp(roll, -1, 1);
    out.jump = jump;
    out.boost = boost;
    out.handbrake = handbrake;
    return out;
  }
}
