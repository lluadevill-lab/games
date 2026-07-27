/**
 * Configuração de controles: teclas, sensibilidade, gamepad e layout touch.
 * Tudo persiste em localStorage e tem migração por versão.
 */

export type ActionId =
  | "throttle"
  | "reverse"
  | "left"
  | "right"
  | "jump"
  | "boost"
  | "handbrake"
  | "pitchUp"
  | "pitchDown"
  | "rollLeft"
  | "rollRight"
  | "ballcam"
  | "reset"
  | "pause";

export interface ActionMeta {
  id: ActionId;
  label: string;
  group: "Dirigir" | "Ar" | "Sistema";
}

export const ACTIONS: ActionMeta[] = [
  { id: "throttle", label: "Acelerar", group: "Dirigir" },
  { id: "reverse", label: "Ré / Freio", group: "Dirigir" },
  { id: "left", label: "Esquerda", group: "Dirigir" },
  { id: "right", label: "Direita", group: "Dirigir" },
  { id: "jump", label: "Pular / Flip", group: "Dirigir" },
  { id: "boost", label: "Boost", group: "Dirigir" },
  { id: "handbrake", label: "Powerslide / Air roll", group: "Dirigir" },
  { id: "pitchUp", label: "Nariz para cima", group: "Ar" },
  { id: "pitchDown", label: "Nariz para baixo", group: "Ar" },
  { id: "rollLeft", label: "Air roll esquerda", group: "Ar" },
  { id: "rollRight", label: "Air roll direita", group: "Ar" },
  { id: "ballcam", label: "Ball cam", group: "Sistema" },
  { id: "reset", label: "Reiniciar", group: "Sistema" },
  { id: "pause", label: "Pausa", group: "Sistema" },
];

export type KeyMap = Record<ActionId, string[]>;

export const DEFAULT_KEYMAP: KeyMap = {
  throttle: ["KeyW", "ArrowUp"],
  reverse: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  jump: ["Space"],
  boost: ["ShiftLeft", "ShiftRight"],
  handbrake: ["KeyK", "AltLeft"],
  pitchUp: ["KeyI"],
  pitchDown: ["KeyO"],
  rollLeft: ["KeyQ"],
  rollRight: ["KeyE"],
  ballcam: ["KeyC"],
  reset: ["KeyR"],
  pause: ["KeyP", "Escape"],
};

/** Botões de gamepad no layout padrão (índices da Gamepad API). */
export type PadMap = Record<
  "jump" | "boost" | "handbrake" | "ballcam" | "reset" | "pause",
  number
>;

export const DEFAULT_PADMAP: PadMap = {
  jump: 0, // A / X
  boost: 1, // B / O
  handbrake: 2, // X / □
  ballcam: 3, // Y / △
  reset: 8, // Select
  pause: 9, // Start
};

export interface Sensitivity {
  /** multiplicador do esterço no chão */
  steer: number;
  /** multiplicador do controle aéreo (pitch/yaw/roll) */
  air: number;
  /** zona morta dos analógicos */
  deadzone: number;
  /** curva de resposta: 1 = linear, >1 = mais preciso no centro */
  gamma: number;
}

export const DEFAULT_SENSITIVITY: Sensitivity = {
  steer: 1,
  air: 1,
  deadzone: 0.15,
  gamma: 1,
};

/** Um botão/stick da HUD touch, posicionado em % da tela. */
export interface TouchItem {
  id: TouchId;
  /** 0..1 relativo à largura/altura da tela (canto superior esquerdo do item) */
  x: number;
  y: number;
  /** escala do item (0.6 a 1.6) */
  scale: number;
  visible: boolean;
}

export type TouchId =
  | "stick"
  | "jump"
  | "boost"
  | "handbrake"
  | "throttle"
  | "reverse"
  | "ballcam";

export interface TouchMeta {
  id: TouchId;
  label: string;
  /** tamanho base em px (antes da escala) */
  size: number;
}

export const TOUCH_ITEMS: TouchMeta[] = [
  { id: "stick", label: "Direção", size: 132 },
  { id: "throttle", label: "Acelerar", size: 74 },
  { id: "reverse", label: "Ré", size: 62 },
  { id: "jump", label: "Pular", size: 78 },
  { id: "boost", label: "Boost", size: 78 },
  { id: "handbrake", label: "Drift", size: 66 },
  { id: "ballcam", label: "Cam", size: 56 },
];

/** Layout padrão: mão esquerda dirige, direita age. */
export const DEFAULT_TOUCH_LAYOUT: Record<TouchId, TouchItem> = {
  stick: { id: "stick", x: 0.035, y: 0.6, scale: 1, visible: true },
  throttle: { id: "throttle", x: 0.87, y: 0.72, scale: 1, visible: true },
  reverse: { id: "reverse", x: 0.75, y: 0.78, scale: 1, visible: true },
  jump: { id: "jump", x: 0.87, y: 0.45, scale: 1, visible: true },
  boost: { id: "boost", x: 0.73, y: 0.5, scale: 1, visible: true },
  handbrake: { id: "handbrake", x: 0.62, y: 0.66, scale: 1, visible: true },
  ballcam: { id: "ballcam", x: 0.03, y: 0.16, scale: 1, visible: true },
};

/** Modo do controle direcional no touch. */
export type TouchSteerMode = "analog" | "dpad";

export interface ControlSettings {
  version: number;
  keys: KeyMap;
  pad: PadMap;
  sens: Sensitivity;
  touch: Record<TouchId, TouchItem>;
  touchMode: TouchSteerMode;
  /** vibração do gamepad ao bater na bola / levar demo */
  rumble: boolean;
  /** inverte o eixo de pitch (estilo simulador de voo) */
  invertPitch: boolean;
}

const STORAGE_KEY = "rocketlite.controls.v1";
const VERSION = 1;

export function defaultSettings(): ControlSettings {
  return {
    version: VERSION,
    keys: structuredCloneSafe(DEFAULT_KEYMAP),
    pad: { ...DEFAULT_PADMAP },
    sens: { ...DEFAULT_SENSITIVITY },
    touch: structuredCloneSafe(DEFAULT_TOUCH_LAYOUT),
    touchMode: "analog",
    rumble: true,
    invertPitch: false,
  };
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Carrega do localStorage, completando campos ausentes com o padrão. */
export function loadSettings(): ControlSettings {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<ControlSettings>;
    if (!saved || typeof saved !== "object") return base;

    // merge defensivo: nunca confiar cegamente no que está salvo
    if (saved.keys) {
      for (const a of ACTIONS) {
        const v = (saved.keys as KeyMap)[a.id];
        if (Array.isArray(v) && v.every((k) => typeof k === "string")) base.keys[a.id] = v;
      }
    }
    if (saved.pad) Object.assign(base.pad, saved.pad);
    if (saved.sens) Object.assign(base.sens, saved.sens);
    if (saved.touch) {
      for (const t of TOUCH_ITEMS) {
        const v = saved.touch[t.id];
        if (v && typeof v.x === "number" && typeof v.y === "number") {
          base.touch[t.id] = {
            id: t.id,
            x: clamp01(v.x),
            y: clamp01(v.y),
            scale: Math.min(1.6, Math.max(0.6, v.scale ?? 1)),
            visible: v.visible !== false,
          };
        }
      }
    }
    if (saved.touchMode === "dpad" || saved.touchMode === "analog")
      base.touchMode = saved.touchMode;
    if (typeof saved.rumble === "boolean") base.rumble = saved.rumble;
    if (typeof saved.invertPitch === "boolean") base.invertPitch = saved.invertPitch;

    // clamps de segurança
    base.sens.steer = clampRange(base.sens.steer, 0.3, 2.5);
    base.sens.air = clampRange(base.sens.air, 0.3, 2.5);
    base.sens.deadzone = clampRange(base.sens.deadzone, 0, 0.4);
    base.sens.gamma = clampRange(base.sens.gamma, 1, 3);
    return base;
  } catch {
    return base;
  }
}

export function saveSettings(s: ControlSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* localStorage indisponível (modo privado) — segue sem persistir */
  }
}

export function resetSettings(): ControlSettings {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return defaultSettings();
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampRange = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? (v < lo ? lo : v > hi ? hi : v) : lo;

/** Nome amigável de um código de tecla (KeyboardEvent.code). */
export function keyLabel(code: string): string {
  if (!code) return "—";
  const map: Record<string, string> = {
    Space: "Espaço",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    ShiftLeft: "Shift esq",
    ShiftRight: "Shift dir",
    ControlLeft: "Ctrl esq",
    ControlRight: "Ctrl dir",
    AltLeft: "Alt esq",
    AltRight: "Alt dir",
    Escape: "Esc",
    Enter: "Enter",
    Tab: "Tab",
    Backspace: "Backspace",
  };
  if (map[code]) return map[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  return code;
}

/** Nome amigável de um botão de gamepad. */
export function padLabel(index: number): string {
  const names: Record<number, string> = {
    0: "A / X",
    1: "B / ○",
    2: "X / □",
    3: "Y / △",
    4: "LB / L1",
    5: "RB / R1",
    6: "LT / L2",
    7: "RT / R2",
    8: "Select",
    9: "Start",
    10: "L3",
    11: "R3",
    12: "D-pad ↑",
    13: "D-pad ↓",
    14: "D-pad ←",
    15: "D-pad →",
  };
  return names[index] ?? `Botão ${index}`;
}
