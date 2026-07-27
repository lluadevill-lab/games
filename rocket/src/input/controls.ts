/**
 * Entradas: teclado, gamepad e touch. Todos produzem o mesmo CarInput —
 * exatamente como no jogo original, onde o "skill" está nos mesmos 8 canais.
 *
 * As teclas, botões e a sensibilidade vêm de ControlSettings (customizável).
 */
import { clamp } from "../core/mathx";
import type { CarInput } from "../sim/types";
import {
  type ActionId,
  type ControlSettings,
  defaultSettings,
} from "./settings";

/** Zona morta radial + curva de resposta. */
export function shapeAxis(v: number, dz: number, gamma: number): number {
  const a = Math.abs(v);
  if (a <= dz) return 0;
  const t = (a - dz) / (1 - dz || 1);
  const shaped = gamma === 1 ? t : Math.pow(t, gamma);
  return (v < 0 ? -1 : 1) * clamp(shaped, 0, 1);
}

export interface TouchState {
  active: boolean;
  steer: number;
  pitch: number;
  throttle: number;
  jump: boolean;
  boost: boolean;
  handbrake: boolean;
  /** disparo único de ball cam pelo botão touch */
  ballcamTap: boolean;
}

export class Controls {
  private keys = new Set<string>();
  private pressedOnce = new Set<string>();
  private padPrev = new Map<number, boolean>();
  private padTapped = new Set<number>();

  settings: ControlSettings = defaultSettings();
  gamepadIndex: number | null = null;
  lastGamepadName = "";

  touch: TouchState = {
    active: false,
    steer: 0,
    pitch: 0,
    throttle: 0,
    jump: false,
    boost: false,
    handbrake: false,
    ballcamTap: false,
  };

  /** Quando true, o jogo está capturando uma tecla para remapear. */
  capturing = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedOnce.add(e.code);
      // não sequestrar teclas enquanto o usuário digita/remapeia
      if (this.capturing) return;
      if (this.isBound(e.code)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    window.addEventListener("gamepadconnected", (e) => {
      const gp = (e as GamepadEvent).gamepad;
      this.gamepadIndex = gp.index;
      this.lastGamepadName = gp.id;
    });
    window.addEventListener("gamepaddisconnected", () => {
      this.gamepadIndex = null;
    });
  }

  /** A tecla está associada a alguma ação do jogo? */
  private isBound(code: string): boolean {
    const k = this.settings.keys;
    for (const id of Object.keys(k) as ActionId[]) {
      if (k[id].includes(code)) return true;
    }
    return false;
  }

  private held(action: ActionId): boolean {
    const codes = this.settings.keys[action];
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  /** true apenas no frame em que a ação foi acionada. */
  tapped(action: ActionId): boolean {
    for (const c of this.settings.keys[action]) {
      if (this.pressedOnce.has(c)) return true;
    }
    // botões de gamepad mapeados para ações de sistema
    const padIdx = (this.settings.pad as Record<string, number>)[action];
    if (padIdx !== undefined && this.padTapped.has(padIdx)) return true;
    if (action === "ballcam" && this.touch.ballcamTap) return true;
    return false;
  }

  endFrame(): void {
    this.pressedOnce.clear();
    this.padTapped.clear();
    this.touch.ballcamTap = false;
  }

  gamepad(): Gamepad | null {
    const pads = navigator.getGamepads?.() ?? [];
    if (this.gamepadIndex !== null && pads[this.gamepadIndex]) {
      return pads[this.gamepadIndex];
    }
    // fallback: primeiro gamepad conectado
    for (const p of pads) {
      if (p) {
        this.gamepadIndex = p.index;
        this.lastGamepadName = p.id;
        return p;
      }
    }
    return null;
  }

  hasGamepad(): boolean {
    return this.gamepad() !== null;
  }

  /** Vibração (se suportada). */
  rumble(strength: number, ms: number): void {
    if (!this.settings.rumble) return;
    const gp = this.gamepad() as (Gamepad & { vibrationActuator?: any }) | null;
    const act = gp?.vibrationActuator;
    if (!act?.playEffect) return;
    try {
      act.playEffect("dual-rumble", {
        duration: ms,
        strongMagnitude: clamp(strength, 0, 1),
        weakMagnitude: clamp(strength * 0.6, 0, 1),
      });
    } catch {
      /* alguns navegadores rejeitam; ignorar */
    }
  }

  /** Preenche `out` com o estado atual das entradas. */
  poll(out: CarInput): CarInput {
    const { sens } = this.settings;
    let throttle = 0;
    let steer = 0;
    let pitch = 0;
    let yaw = 0;
    let roll = 0;
    let jump = false;
    let boost = false;
    let handbrake = false;

    // ---------------------------------------------------------- teclado
    if (this.held("throttle")) throttle += 1;
    if (this.held("reverse")) throttle -= 1;
    if (this.held("right")) steer += 1;
    if (this.held("left")) steer -= 1;
    if (this.held("jump")) jump = true;
    if (this.held("boost")) boost = true;
    if (this.held("handbrake")) handbrake = true;

    // No ar, acelerar/ré viram pitch e virar vira guinada (padrão do RL).
    pitch = -throttle;
    yaw = steer;
    if (this.held("pitchUp")) pitch = 1;
    if (this.held("pitchDown")) pitch = -1;
    // air roll dedicado (não precisa segurar powerslide)
    if (this.held("rollRight")) roll += 1;
    if (this.held("rollLeft")) roll -= 1;
    // com powerslide segurado, virar rola o carro
    if (handbrake && roll === 0) roll = steer;

    // ---------------------------------------------------------- gamepad
    const gp = this.gamepad();
    if (gp) {
      const lx = shapeAxis(gp.axes[0] ?? 0, sens.deadzone, sens.gamma);
      const ly = shapeAxis(gp.axes[1] ?? 0, sens.deadzone, sens.gamma);
      const rt = gp.buttons[7]?.value ?? 0;
      const lt = gp.buttons[6]?.value ?? 0;

      if (lx !== 0) {
        steer = lx;
        yaw = lx;
      }
      if (ly !== 0) pitch = ly;

      const t = rt - lt;
      if (Math.abs(t) > 0.04) {
        throttle = t;
        // no ar o gatilho não deve mexer no nariz
        if (ly === 0) pitch = 0;
      }

      const p = this.settings.pad;
      if (gp.buttons[p.jump]?.pressed) jump = true;
      if (gp.buttons[p.boost]?.pressed) boost = true;
      if (gp.buttons[p.handbrake]?.pressed) handbrake = true;
      if (handbrake) roll = lx;

      // detecta toques únicos (para ball cam, pausa, reset)
      for (let i = 0; i < gp.buttons.length; i++) {
        const now = gp.buttons[i].pressed;
        if (now && !this.padPrev.get(i)) this.padTapped.add(i);
        this.padPrev.set(i, now);
      }
    }

    // ---------------------------------------------------------- touch
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

    if (this.settings.invertPitch) pitch = -pitch;

    // ---------------------------------------------------------- sensibilidade
    // Multiplica e satura: manter no chão é preciso, no ar é mais solto.
    out.throttle = clamp(throttle, -1, 1);
    out.steer = clamp(steer * sens.steer, -1, 1);
    out.pitch = clamp(pitch * sens.air, -1, 1);
    out.yaw = clamp((handbrake ? 0 : yaw) * sens.air, -1, 1);
    out.roll = clamp(roll * sens.air, -1, 1);
    out.jump = jump;
    out.boost = boost;
    out.handbrake = handbrake;
    return out;
  }
}
