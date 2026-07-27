/**
 * Controles touch com layout customizável.
 *
 * Cada item (stick e botões) é posicionado em coordenadas relativas (0..1) da
 * tela, então o layout funciona igual em qualquer resolução e orientação.
 * No modo de edição os itens viram arrastáveis e ganham controle de tamanho.
 */
import type { Controls } from "../input/controls";
import {
  TOUCH_ITEMS,
  type TouchId,
  type ControlSettings,
  type TouchSteerMode,
} from "../input/settings";

export interface TouchUI {
  root: HTMLElement;
  /** aplica o layout salvo (posição, escala, visibilidade, modo) */
  refresh: () => void;
  setEditing: (on: boolean) => void;
  setVisible: (on: boolean) => void;
}

export function isTouchDevice(): boolean {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

export function buildTouchControls(
  parent: HTMLElement,
  controls: Controls,
  getSettings: () => ControlSettings,
  onLayoutChange: () => void,
): TouchUI {
  const root = document.createElement("div");
  root.className = "touch";
  parent.appendChild(root);

  const els = new Map<TouchId, HTMLElement>();
  let editing = false;

  // ------------------------------------------------------------ criação
  for (const meta of TOUCH_ITEMS) {
    const el = document.createElement("div");
    el.className = `titem titem-${meta.id}`;
    el.dataset.id = meta.id;

    if (meta.id === "stick") {
      el.innerHTML = `
        <div class="stick-ring"></div>
        <div class="knob"></div>
        <div class="dpad">
          <span class="dp up">▲</span><span class="dp down">▼</span>
          <span class="dp left">◀</span><span class="dp right">▶</span>
        </div>`;
    } else {
      el.innerHTML = `<span class="tlabel">${meta.label}</span>`;
    }
    root.appendChild(el);
    els.set(meta.id, el);
  }

  // ------------------------------------------------------------ layout
  function refresh(): void {
    const s = getSettings();
    root.classList.toggle("dpad-mode", s.touchMode === "dpad");
    for (const meta of TOUCH_ITEMS) {
      const item = s.touch[meta.id];
      const el = els.get(meta.id)!;
      const size = meta.size * item.scale;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.left = `${item.x * 100}%`;
      el.style.top = `${item.y * 100}%`;
      el.style.display = item.visible || editing ? "" : "none";
      el.classList.toggle("hidden-item", !item.visible);
      el.style.fontSize = `${Math.max(10, 12 * item.scale)}px`;
    }
  }

  // ------------------------------------------------------------ stick
  const stickEl = els.get("stick")!;
  const knob = stickEl.querySelector(".knob") as HTMLElement;
  let stickTouch: number | null = null;
  let stickCx = 0;
  let stickCy = 0;
  let stickR = 60;

  function beginStick(id: number, x: number, y: number): void {
    const r = stickEl.getBoundingClientRect();
    stickCx = r.left + r.width / 2;
    stickCy = r.top + r.height / 2;
    stickR = r.width * 0.42;
    stickTouch = id;
    controls.touch.active = true;
    moveStick(x, y);
  }

  function moveStick(x: number, y: number): void {
    let dx = x - stickCx;
    let dy = y - stickCy;
    const d = Math.hypot(dx, dy);
    if (d > stickR) {
      dx = (dx / d) * stickR;
      dy = (dy / d) * stickR;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;

    const s = getSettings();
    if (s.touchMode === "dpad") {
      // D-pad: 8 direções discretas, tipo WASD
      const t = 0.38;
      const nx = dx / stickR;
      const ny = dy / stickR;
      controls.touch.steer = Math.abs(nx) > t ? Math.sign(nx) : 0;
      controls.touch.pitch = Math.abs(ny) > t ? Math.sign(ny) : 0;
    } else {
      controls.touch.steer = dx / stickR;
      controls.touch.pitch = dy / stickR;
    }
  }

  function endStick(): void {
    stickTouch = null;
    knob.style.transform = "translate(0,0)";
    controls.touch.steer = 0;
    controls.touch.pitch = 0;
  }

  stickEl.addEventListener(
    "touchstart",
    (e) => {
      if (editing) return;
      const t = e.changedTouches[0];
      beginStick(t.identifier, t.clientX, t.clientY);
      e.preventDefault();
    },
    { passive: false },
  );

  // ------------------------------------------------------------ botões
  const BUTTON_ACTIONS: Record<string, { on: () => void; off: () => void }> = {
    jump: {
      on: () => (controls.touch.jump = true),
      off: () => (controls.touch.jump = false),
    },
    boost: {
      on: () => (controls.touch.boost = true),
      off: () => (controls.touch.boost = false),
    },
    handbrake: {
      on: () => (controls.touch.handbrake = true),
      off: () => (controls.touch.handbrake = false),
    },
    throttle: {
      on: () => (controls.touch.throttle = 1),
      off: () => (controls.touch.throttle = 0),
    },
    reverse: {
      on: () => (controls.touch.throttle = -1),
      off: () => (controls.touch.throttle = 0),
    },
    ballcam: {
      on: () => (controls.touch.ballcamTap = true),
      off: () => {},
    },
  };

  /** touchId -> item que ele está pressionando */
  const activeButtons = new Map<number, TouchId>();

  for (const meta of TOUCH_ITEMS) {
    if (meta.id === "stick") continue;
    const el = els.get(meta.id)!;
    el.addEventListener(
      "touchstart",
      (e) => {
        if (editing) return;
        const t = e.changedTouches[0];
        activeButtons.set(t.identifier, meta.id);
        el.classList.add("down");
        controls.touch.active = true;
        BUTTON_ACTIONS[meta.id]?.on();
        e.preventDefault();
      },
      { passive: false },
    );
  }

  // ------------------------------------------------------------ eventos globais
  // Um único par de listeners cuida de todos os toques: é mais robusto que
  // listeners por elemento quando o dedo escorrega para fora do botão.
  window.addEventListener(
    "touchmove",
    (e) => {
      if (editing) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === stickTouch) moveStick(t.clientX, t.clientY);
      }
    },
    { passive: false },
  );

  const releaseTouch = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === stickTouch) endStick();
      const btn = activeButtons.get(t.identifier);
      if (btn) {
        activeButtons.delete(t.identifier);
        els.get(btn)?.classList.remove("down");
        // só solta a ação se nenhum outro dedo estiver no mesmo botão
        if (![...activeButtons.values()].includes(btn)) {
          BUTTON_ACTIONS[btn]?.off();
        }
      }
    }
  };
  window.addEventListener("touchend", releaseTouch);
  window.addEventListener("touchcancel", releaseTouch);

  // ------------------------------------------------------------ modo edição
  let dragId: TouchId | null = null;
  let dragTouch: number | null = null;
  let dragOff = { x: 0, y: 0 };

  function startDrag(id: TouchId, touchId: number, cx: number, cy: number): void {
    const el = els.get(id)!;
    const r = el.getBoundingClientRect();
    dragId = id;
    dragTouch = touchId;
    dragOff = { x: cx - r.left, y: cy - r.top };
    el.classList.add("dragging");
  }

  function doDrag(cx: number, cy: number): void {
    if (!dragId) return;
    const s = getSettings();
    const el = els.get(dragId)!;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = (cx - dragOff.x) / w;
    const y = (cy - dragOff.y) / h;
    // mantém o item dentro da tela
    const maxX = 1 - el.offsetWidth / w;
    const maxY = 1 - el.offsetHeight / h;
    s.touch[dragId].x = Math.max(0, Math.min(maxX, x));
    s.touch[dragId].y = Math.max(0, Math.min(maxY, y));
    refresh();
  }

  function endDrag(): void {
    if (!dragId) return;
    els.get(dragId)?.classList.remove("dragging");
    dragId = null;
    dragTouch = null;
    onLayoutChange();
  }

  // arrastar funciona com toque E com mouse (para configurar no PC)
  root.addEventListener(
    "touchstart",
    (e) => {
      if (!editing) return;
      const target = (e.target as HTMLElement).closest(".titem") as HTMLElement | null;
      if (!target) return;
      const t = e.changedTouches[0];
      startDrag(target.dataset.id as TouchId, t.identifier, t.clientX, t.clientY);
      e.preventDefault();
    },
    { passive: false },
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (!editing || dragTouch === null) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === dragTouch) {
          doDrag(t.clientX, t.clientY);
          e.preventDefault();
        }
      }
    },
    { passive: false },
  );
  window.addEventListener("touchend", () => {
    if (editing) endDrag();
  });

  root.addEventListener("mousedown", (e) => {
    if (!editing) return;
    const target = (e.target as HTMLElement).closest(".titem") as HTMLElement | null;
    if (!target) return;
    startDrag(target.dataset.id as TouchId, -1, e.clientX, e.clientY);
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (editing && dragId) doDrag(e.clientX, e.clientY);
  });
  window.addEventListener("mouseup", () => {
    if (editing) endDrag();
  });

  function setEditing(on: boolean): void {
    editing = on;
    root.classList.toggle("editing", on);
    if (on) {
      // solta tudo ao entrar em edição
      endStick();
      controls.touch.jump = false;
      controls.touch.boost = false;
      controls.touch.handbrake = false;
      controls.touch.throttle = 0;
      activeButtons.clear();
      for (const el of els.values()) el.classList.remove("down");
    }
    refresh();
  }

  refresh();
  window.addEventListener("resize", refresh);

  return {
    root,
    refresh,
    setEditing,
    setVisible: (on: boolean) => root.classList.toggle("on", on),
  };
}

/** Muda o modo do direcional e devolve o novo valor. */
export function cycleTouchMode(m: TouchSteerMode): TouchSteerMode {
  return m === "analog" ? "dpad" : "analog";
}
