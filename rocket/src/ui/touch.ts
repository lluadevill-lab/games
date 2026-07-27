/** Controles touch: joystick esquerdo (direção/pitch) + botões à direita. */
import type { Controls } from "../input/controls";

export function buildTouchControls(parent: HTMLElement, controls: Controls): HTMLElement {
  const root = document.createElement("div");
  root.className = "touch";
  root.innerHTML = `
    <div class="stick" id="stick"><div class="knob" id="knob"></div></div>
    <div class="tbuttons">
      <button class="tbtn slide" id="t-slide">DRIFT</button>
      <button class="tbtn boost" id="t-boost">BOOST</button>
      <button class="tbtn jump" id="t-jump">PULO</button>
    </div>
    <div class="tthrottle">
      <button class="tbtn small" id="t-rev">▼</button>
      <button class="tbtn small acc" id="t-acc">▲</button>
    </div>
  `;
  parent.appendChild(root);

  const stick = root.querySelector("#stick") as HTMLElement;
  const knob = root.querySelector("#knob") as HTMLElement;
  let stickId: number | null = null;
  let cx = 0,
    cy = 0;

  const R = 58;

  const setStick = (x: number, y: number) => {
    let dx = x - cx;
    let dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    controls.touch.steer = dx / R;
    controls.touch.pitch = dy / R; // no ar: puxar pra baixo = nariz pra cima
  };

  stick.addEventListener(
    "touchstart",
    (e) => {
      const t = e.changedTouches[0];
      stickId = t.identifier;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      controls.touch.active = true;
      setStick(t.clientX, t.clientY);
      e.preventDefault();
    },
    { passive: false },
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      if (stickId === null) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === stickId) setStick(t.clientX, t.clientY);
      }
    },
    { passive: false },
  );
  const endStick = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === stickId) {
        stickId = null;
        knob.style.transform = "translate(0,0)";
        controls.touch.steer = 0;
        controls.touch.pitch = 0;
      }
    }
  };
  window.addEventListener("touchend", endStick);
  window.addEventListener("touchcancel", endStick);

  const hold = (id: string, on: () => void, off: () => void) => {
    const el = root.querySelector(id) as HTMLElement;
    const down = (e: Event) => {
      controls.touch.active = true;
      el.classList.add("down");
      on();
      e.preventDefault();
    };
    const up = (e: Event) => {
      el.classList.remove("down");
      off();
      e.preventDefault();
    };
    el.addEventListener("touchstart", down, { passive: false });
    el.addEventListener("touchend", up, { passive: false });
    el.addEventListener("touchcancel", up, { passive: false });
  };

  hold(
    "#t-jump",
    () => (controls.touch.jump = true),
    () => (controls.touch.jump = false),
  );
  hold(
    "#t-boost",
    () => (controls.touch.boost = true),
    () => (controls.touch.boost = false),
  );
  hold(
    "#t-slide",
    () => (controls.touch.handbrake = true),
    () => (controls.touch.handbrake = false),
  );
  hold(
    "#t-acc",
    () => (controls.touch.throttle = 1),
    () => (controls.touch.throttle = 0),
  );
  hold(
    "#t-rev",
    () => (controls.touch.throttle = -1),
    () => (controls.touch.throttle = 0),
  );

  return root;
}

export function isTouchDevice(): boolean {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}
