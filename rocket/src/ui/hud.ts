/** HUD em DOM/CSS puro (mais leve e mais nítido que desenhar no canvas). */
import type { World } from "../sim/types";

export interface HudRefs {
  root: HTMLElement;
  scoreBlue: HTMLElement;
  scoreOrange: HTMLElement;
  clock: HTMLElement;
  boostValue: HTMLElement;
  boostArc: SVGCircleElement;
  speed: HTMLElement;
  banner: HTMLElement;
  toast: HTMLElement;
  fps: HTMLElement;
}

export function buildHud(parent: HTMLElement): HudRefs {
  const root = document.createElement("div");
  root.className = "hud";
  root.innerHTML = `
    <div class="hud-top">
      <div class="score">
        <span class="team blue" id="score-blue">0</span>
        <span class="clock" id="clock">5:00</span>
        <span class="team orange" id="score-orange">0</span>
      </div>
    </div>
    <div class="hud-banner" id="banner"></div>
    <div class="hud-toast" id="toast"></div>
    <div class="hud-bottom">
      <div class="speed"><b id="speed">0</b><small>km/h</small></div>
      <div class="boost">
        <svg viewBox="0 0 100 100" width="104" height="104">
          <circle cx="50" cy="50" r="42" class="boost-bg"></circle>
          <circle cx="50" cy="50" r="42" class="boost-arc" id="boost-arc"></circle>
        </svg>
        <span id="boost-value">33</span>
      </div>
    </div>
    <div class="fps" id="fps"></div>
  `;
  parent.appendChild(root);

  const $ = <T extends Element>(id: string) => root.querySelector(id) as unknown as T;
  return {
    root,
    scoreBlue: $("#score-blue"),
    scoreOrange: $("#score-orange"),
    clock: $("#clock"),
    boostValue: $("#boost-value"),
    boostArc: $("#boost-arc") as unknown as SVGCircleElement,
    speed: $("#speed"),
    banner: $("#banner"),
    toast: $("#toast"),
    fps: $("#fps"),
  };
}

const CIRC = 2 * Math.PI * 42;

export function updateHud(h: HudRefs, world: World, carIndex: number, fps: number): void {
  const car = world.cars[carIndex];
  h.scoreBlue.textContent = String(world.score[0]);
  h.scoreOrange.textContent = String(world.score[1]);

  const t = Math.max(0, world.clock);
  const mm = Math.floor(t / 60);
  const ss = Math.floor(t % 60);
  h.clock.textContent = world.overtime
    ? "PRORROGAÇÃO"
    : `${mm}:${ss.toString().padStart(2, "0")}`;
  h.clock.classList.toggle("urgent", t < 30 && t > 0 && !world.overtime);

  if (car) {
    const b = Math.round(car.boost);
    h.boostValue.textContent = String(b);
    h.boostArc.style.strokeDasharray = `${(b / 100) * CIRC} ${CIRC}`;
    // 1 uu/s ≈ 0.0684 km/h (1 uu ≈ 1.9 cm)
    const kmh = Math.hypot(car.vel.x, car.vel.y, car.vel.z) * 0.0684;
    h.speed.textContent = String(Math.round(kmh));
    h.root.classList.toggle("supersonic", car.supersonic);
  }
  h.fps.textContent = `${Math.round(fps)} fps`;
}

let bannerTimer: number | null = null;
export function showBanner(h: HudRefs, text: string, ms = 1800, cls = ""): void {
  h.banner.textContent = text;
  h.banner.className = `hud-banner show ${cls}`;
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => {
    h.banner.className = "hud-banner";
  }, ms);
}

let toastTimer: number | null = null;
export function showToast(h: HudRefs, text: string, ms = 1200): void {
  h.toast.textContent = text;
  h.toast.className = "hud-toast show";
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    h.toast.className = "hud-toast";
  }, ms);
}
