/**
 * Rocket Lite — laço principal.
 *
 * Arquitetura (igual à do jogo original em espírito):
 *   simulação em passo fixo de 1/120 s  ->  estado  ->  renderer burro
 * O renderer nunca escreve no estado; a física nunca sabe do renderer.
 */
import "./style.css";
import * as K from "./sim/constants";
import { createWorld, stepWorld, resetKickoff } from "./sim/world";
import { driveBot, resetBots, type BotSkill } from "./sim/bot";
import { predictBall } from "./sim/predict";
import { Renderer, type Quality } from "./render/scene";
import { Controls } from "./input/controls";
import { buildHud, updateHud, showBanner, showToast } from "./ui/hud";
import { buildMenu, buildPause, buildGameOver, type GameConfig } from "./ui/menu";
import { buildTouchControls, isTouchDevice } from "./ui/touch";
import { buildSettingsMenu } from "./ui/settingsMenu";
import { loadSettings, saveSettings } from "./input/settings";
import { initAudio, resumeAudio, updateEngine, sfx, setMuted, isMuted } from "./audio/sfx";
import type { World } from "./sim/types";
import { v3, set, qFromEuler, len } from "./core/vec";

/**
 * O bundle é injetado no <head>. Com type="module" o navegador adia a
 * execução até o DOM existir, mas não dependemos disso: se o body ainda
 * não estiver pronto, esperamos. Assim o jogo funciona mesmo se o script
 * for carregado de forma síncrona (WebView antiga, injeção manual, etc.).
 */
function getAppRoot(): HTMLElement {
  let el = document.getElementById("app");
  if (!el) {
    el = document.createElement("div");
    el.id = "app";
    document.body.appendChild(el);
  }
  return el;
}

function boot(): void {
  const app = getAppRoot();
  const canvas = document.createElement("canvas");
  app.appendChild(canvas);
  start(app, canvas);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

/** Mensagem amigável em vez de tela preta quando o WebGL não sobe. */
function showFatal(app: HTMLElement, err: unknown): void {
  const msg = document.createElement("div");
  msg.className = "menu";
  msg.innerHTML = `
    <div class="menu-card small">
      <h2>OPS</h2>
      <p style="color:#8ea3c0;font-size:14px;line-height:1.6">
        Não consegui iniciar os gráficos 3D neste navegador.<br>
        Verifique se a aceleração de hardware (WebGL) está ativada.
      </p>
      <p style="color:#55657d;font-size:11px;word-break:break-word">${String(err)}</p>
    </div>`;
  app.appendChild(msg);
}

function start(app: HTMLElement, canvas: HTMLCanvasElement): void {

const QUALITIES: Record<string, Quality> = {
  baixa: { shadows: false, trails: false, pixelRatio: 0.75 },
  media: { shadows: false, trails: true, pixelRatio: 1 },
  alta: { shadows: true, trails: true, pixelRatio: 2 },
};

// A UI é montada ANTES do renderer: o menu precisa aparecer mesmo que a
// inicialização do WebGL demore ou falhe.
let quality = QUALITIES.media;
const controls = new Controls();
controls.settings = loadSettings();
const hud = buildHud(app);
const touchUI = buildTouchControls(
  app,
  controls,
  () => controls.settings,
  () => saveSettings(controls.settings),
);

let renderer: Renderer | null = null;

let world: World = createWorld({ botCount: 1, matchTime: 180 });
let config: GameConfig | null = null;
let running = false;
let accumulator = 0;
let lastTime = performance.now();
let fps = 60;
let lastCountdownSecond = -1;
let predTimer = 0;

// ------------------------------------------------------------------ telas
const gameOver = buildGameOver(app, {
  again: () => {
    gameOver.hide();
    if (config) startGame(config);
  },
  menu: () => {
    gameOver.hide();
    running = false;
    menu.show();
  },
});

const pause = buildPause(app, {
  resume: () => {
    pause.hide();
    running = true;
    lastTime = performance.now();
  },
  restart: () => {
    pause.hide();
    if (config) startGame(config);
  },
  menu: () => {
    pause.hide();
    running = false;
    menu.show();
  },
  toggleMute: () => setMuted(!isMuted()),
  controls: () => {
    pause.hide();
    settings.show();
  },
});

const menu = buildMenu(
  app,
  (cfg) => {
    initAudio();
    resumeAudio();
    menu.hide();
    startGame(cfg);
  },
  () => settings.show(),
);

// Tela de controles: acessível do menu e da pausa.
const settings = buildSettingsMenu(
  app,
  controls,
  touchUI,
  () => {
    // ao fechar, volta para onde o jogador estava
    if (config && !running) pause.show();
    else if (!config) menu.show();
  },
  () => {
    /* mudanças aplicam na hora: o poll já lê controls.settings */
  },
);

// Só agora o WebGL. Se falhar, o jogador vê um aviso em vez de tela preta.
try {
  renderer = new Renderer(canvas, quality);
} catch (err) {
  showFatal(app, err);
  return;
}
renderer.syncCars(world);

function startGame(cfg: GameConfig): void {
  if (!renderer) return; // WebGL indisponível: nada a fazer
  config = cfg;
  quality = QUALITIES[cfg.quality];
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setPredictionVisible(cfg.showPrediction);

  resetBots();
  world = createWorld({
    botCount: cfg.mode === "training" ? 0 : 1,
    matchTime: cfg.mode === "training" ? 99999 : cfg.matchMinutes * 60,
    freePlay: cfg.mode === "training",
  });
  renderer.syncCars(world);
  gameOver.hide();
  pause.hide();
  running = true;
  accumulator = 0;
  lastTime = performance.now();
  lastCountdownSecond = -1;
  touchUI.setVisible(isTouchDevice());
  if (cfg.mode === "training") showToast(hud, "Treino livre · R reposiciona a bola", 2600);
}

// ------------------------------------------------------------------ eventos
function handleEvents(): void {
  for (const ev of world.events) {
    switch (ev.type) {
      case "ballHit": {
        sfx.ballHit(ev.speed);
        if (ev.speed > 2600) renderer?.shake(0.18, 9);
        break;
      }
      case "bounce":
        sfx.bounce(ev.speed);
        break;
      case "jump":
        if (ev.carId === 0) sfx.jump();
        break;
      case "flip":
        if (ev.carId === 0) sfx.flip();
        break;
      case "pad":
        if (ev.carId === 0) sfx.pad(ev.big);
        break;
      case "landing":
        if (ev.carId === 0 && ev.speed > 400) sfx.landing(ev.speed);
        break;
      case "demo": {
        sfx.demo();
        renderer?.shake(0.35, 20);
        showBanner(hud, ev.carId === 0 ? "DEMOLIDO!" : "DEMOLIÇÃO!", 1200);
        break;
      }
      case "goal": {
        sfx.goal();
        const mine = ev.team === 0;
        renderer?.triggerGoal(world.ball.pos, mine ? 0x3d8bff : 0xff8a2b);
        const kmh = Math.round(ev.speed * 0.0684);
        showBanner(hud, mine ? "GOOOL!" : "TOMOU GOL", 2600, mine ? "blue" : "orange");
        showToast(hud, `${kmh} km/h`, 2400);
        break;
      }
      case "kickoff":
        lastCountdownSecond = -1;
        break;
      case "matchEnd": {
        sfx.whistle();
        const [a, b] = world.score;
        const title = a > b ? "VOCÊ VENCEU!" : a < b ? "DERROTA" : "EMPATE";
        gameOver.show(title, `Placar final ${a} × ${b}`);
        running = false;
        break;
      }
    }
  }
  world.events.length = 0;
}

// ------------------------------------------------------------------ loop
function frame(now: number): void {
  requestAnimationFrame(frame);
  if (!renderer) return;
  const rawDt = Math.min((now - lastTime) / 1000, 0.25);
  lastTime = now;
  fps += (1 / Math.max(rawDt, 1e-4) - fps) * 0.08;

  // ---- teclas de sistema (funcionam mesmo pausado)
  if (settings.visible()) {
    controls.endFrame();
    if (renderer) renderer.render(world, rawDt, 0, quality);
    return;
  }

  if (controls.tapped("pause") && config) {
    if (pause.visible()) {
      pause.hide();
      running = true;
      lastTime = performance.now();
    } else if (running) {
      pause.show();
      running = false;
    }
  }
  if (controls.tapped("ballcam")) {
    renderer.ballCam = !renderer.ballCam;
    showToast(hud, renderer.ballCam ? "Ball cam: ligada" : "Ball cam: desligada", 900);
  }
  if (controls.tapped("reset") && running) {
    if (config?.mode === "training") {
      set(world.ball.pos, 0, 0, K.BALL_RADIUS + 400);
      set(world.ball.vel, 0, 0, 0);
      set(world.ball.ang, 0, 0, 0);
      const c = world.cars[0];
      set(c.pos, 0, -2200, K.REST_HEIGHT);
      set(c.vel, 0, 0, 0);
      set(c.ang, 0, 0, 0);
      qFromEuler(c.rot, Math.PI / 2, 0, 0);
      c.boost = 100;
    } else {
      resetKickoff(world, true);
    }
  }

  if (running) {
    // ---- inputs
    controls.poll(world.cars[0].input);
    if (config?.mode !== "training") {
      for (let i = 1; i < world.cars.length; i++) {
        driveBot(world.cars[i], world, rawDt, (config?.skill ?? "medio") as BotSkill);
      }
    }

    // ---- simulação em passo fixo (o que garante física consistente)
    accumulator += rawDt;
    let steps = 0;
    while (accumulator >= K.TICK_DT && steps < 16) {
      stepWorld(world, K.TICK_DT);
      accumulator -= K.TICK_DT;
      steps++;
    }
    if (steps >= 16) accumulator = 0; // evita espiral da morte

    handleEvents();

    // contagem do kickoff
    if (world.phase === "kickoff") {
      const s = Math.ceil(world.phaseTimer);
      if (s !== lastCountdownSecond) {
        lastCountdownSecond = s;
        if (s > 0) {
          showBanner(hud, String(s), 700);
          sfx.countdown(s);
        }
      }
    } else if (lastCountdownSecond > 0) {
      lastCountdownSecond = 0;
      showBanner(hud, "VAI!", 800);
      sfx.countdown(0);
    }

    // predição da bola (a cada 100 ms, não todo frame)
    predTimer -= rawDt;
    if (config?.showPrediction && predTimer <= 0) {
      predTimer = 0.1;
      renderer.setPrediction(predictBall(world.ball, 55, 1 / 22).map((s) => s.pos));
    }

    const me = world.cars[0];
    updateEngine(len(me.vel), me.input.throttle, me.input.boost && me.boost > 0);
  }

  renderer.render(world, rawDt, 0, quality);
  updateHud(hud, world, 0, fps);
  controls.endFrame();
}

window.addEventListener("resize", () => renderer?.resize());
window.addEventListener("orientationchange", () => setTimeout(() => renderer?.resize(), 200));
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running && config) {
    pause.show();
    running = false;
  }
});
window.addEventListener("pointerdown", () => resumeAudio(), { once: true });

requestAnimationFrame(frame);
}
