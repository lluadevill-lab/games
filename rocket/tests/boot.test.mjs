/**
 * Teste de boot: carrega o bundle real num DOM simulado com WebGL falso.
 * Pega erros de inicialização (o clássico "tela preta") sem precisar de GPU.
 */
import { JSDOM } from "jsdom";
import { readFileSync } from "fs";

let html = readFileSync(new URL("../../docs/rocket/index.html", import.meta.url), "utf8");
// jsdom não executa <script type="module">; o bundle do Vite não usa
// import/export no topo, então roda igual como script clássico.
html = html.replace('<script type="module"', "<script");

const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  // localStorage exige uma origem "real"; sem url o jsdom lança DOMException
  url: "https://lluadevill-lab.github.io/games/rocket/",
  resources: undefined,
  beforeParse(win) {
    // --- stub de WebGL2 suficiente para o Three.js inicializar de verdade
    const GL_STRINGS = {
      7936: "stub", // VENDOR
      7937: "stub-renderer", // RENDERER
      7938: "WebGL 2.0", // VERSION
      35724: "WebGL GLSL ES 3.00", // SHADING_LANGUAGE_VERSION
    };
    const gl = new Proxy(
      {},
      {
        get(_t, prop) {
          switch (prop) {
            case "getExtension":
              return () => ({ loseContext() {}, MAX_TEXTURE_MAX_ANISOTROPY_EXT: 1 });
            case "getSupportedExtensions":
              return () => [
                "EXT_color_buffer_float",
                "OES_texture_float_linear",
                "WEBGL_debug_renderer_info",
              ];
            case "getParameter":
              return (p) => {
                if (GL_STRINGS[p] !== undefined) return GL_STRINGS[p];
                if (p === 33901 || p === 33902) return new Float32Array([1, 1024]);
                if (p === 34921 || p === 35660 || p === 35661) return 16;
                return 8192;
              };
            case "getShaderPrecisionFormat":
              return () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
            case "getProgramParameter":
            case "getShaderParameter":
              return () => true;
            case "getProgramInfoLog":
            case "getShaderInfoLog":
              return () => "";
            case "getContextAttributes":
              return () => ({ alpha: false, antialias: true, depth: true, stencil: false });
            case "getActiveUniform":
            case "getActiveAttrib":
              return () => ({ name: "u", type: 5126, size: 1 });
            case "getUniformLocation":
              return () => ({});
            case "getAttribLocation":
              return () => 0;
            case "createTexture":
            case "createBuffer":
            case "createProgram":
            case "createShader":
            case "createFramebuffer":
            case "createRenderbuffer":
            case "createVertexArray":
              return () => ({});
            case "isContextLost":
              return () => false;
            default:
              if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 1;
              return () => 0;
          }
        },
      },
    );
    win.HTMLCanvasElement.prototype.getContext = function (type) {
      if (type === "webgl2" || type === "webgl") return gl;
      return null;
    };
    win.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
    win.cancelAnimationFrame = (id) => clearTimeout(id);
    win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    win.AudioContext = class {
      constructor() { this.sampleRate = 48000; this.currentTime = 0; this.destination = {}; }
      createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n }; }
      createOscillator() { return { type: "", frequency: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n, start() {}, stop() {} }; }
      createBiquadFilter() { return { type: "", frequency: { value: 0 }, Q: { value: 0 }, connect: (n) => n }; }
      createBufferSource() { return { buffer: null, loop: false, connect: (n) => n, start() {}, stop() {} }; }
      createBuffer(_c, len) { return { getChannelData: () => new Float32Array(len) }; }
      resume() {}
    };
    win.addEventListener("error", (e) => errors.push("error: " + (e.error?.stack || e.message)));
    win.addEventListener("unhandledrejection", (e) => errors.push("rejection: " + e.reason));
    const origErr = win.console.error;
    win.console.error = (...a) => { errors.push("console.error: " + a.join(" ")); origErr(...a); };
  },
});

await new Promise((r) => setTimeout(r, 1200));

const doc = dom.window.document;
let pass = 0, fail = 0;
const check = (cond, name, extra = "") => {
  if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else { fail++; console.log(`  \x1b[31m✗ ${name}\x1b[0m ${extra}`); }
};

console.log("\n\x1b[1mBoot do jogo (DOM simulado)\x1b[0m");
check(errors.length === 0, "sem erros de JavaScript", errors.slice(0, 3).join(" | "));
check(!!doc.querySelector("canvas"), "canvas criado");
check(!!doc.querySelector(".menu"), "menu inicial renderizado");
check(!!doc.querySelector("#play"), "botão JOGAR existe");
check(!!doc.querySelector(".hud"), "HUD montado");
check(!!doc.querySelector("#boost-value"), "medidor de boost existe");
check(doc.querySelectorAll(".seg").length >= 5, "opções do menu presentes");

// clicar em JOGAR não pode quebrar
const before = errors.length;
doc.querySelector("#play").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 600));
check(errors.length === before, "clicar em JOGAR não gera erro", errors.slice(before, before + 2).join(" | "));
check(doc.querySelector(".menu").classList.contains("hidden"), "menu some ao iniciar");
const clock = doc.querySelector("#clock").textContent;
check(/^\d:\d\d$|PRORROG/.test(clock), `relógio inicializado (${clock})`);

// ---------------------------------------------------------------- controles
console.log("\n\x1b[1mTela de controles\x1b[0m");
{
  // volta ao menu e abre a tela de controles
  const before2 = errors.length;
  doc.querySelector("#p-menu")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 120));
  const openBtn = doc.querySelector("#open-controls");
  check(!!openBtn, "botão de controles existe no menu");
  openBtn?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));

  const panel = doc.querySelector(".menu.settings");
  check(panel && !panel.classList.contains("hidden"), "tela de controles abre");
  check(errors.length === before2, "abrir controles não gera erro", errors.slice(before2, before2 + 2).join(" | "));

  // todas as ações listadas
  const binds = doc.querySelectorAll("#keylist .kbind[data-slot='0']");
  check(binds.length >= 12, `todas as ações aparecem (${binds.length})`);

  // remapear uma tecla de verdade
  const jumpBtn = [...doc.querySelectorAll("#keylist .kbind[data-slot='0']")]
    .find((b) => b.dataset.a === "jump");
  check(!!jumpBtn, "ação 'Pular' está na lista");
  const labelBefore = jumpBtn.textContent.trim();
  jumpBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  check(jumpBtn.classList.contains("capturing"), "clicar entra em modo de captura");
  dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { code: "KeyZ", bubbles: true }));
  await new Promise((r) => setTimeout(r, 120));
  const jumpAfter = [...doc.querySelectorAll("#keylist .kbind[data-slot='0']")]
    .find((b) => b.dataset.a === "jump");
  check(jumpAfter.textContent.trim() === "Z", `tecla remapeada para Z (era ${labelBefore})`);

  // persistiu?
  const saved = JSON.parse(dom.window.localStorage.getItem("rocketlite.controls.v1") || "{}");
  check(saved.keys?.jump?.includes("KeyZ"), "remapeamento é salvo no localStorage");

  // abas
  const padTab = [...doc.querySelectorAll(".tab")].find((t) => t.dataset.tab === "gamepad");
  padTab?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  check(doc.querySelector('.tabpane[data-pane="gamepad"]').classList.contains("on"), "aba de gamepad abre");
  const touchTab = [...doc.querySelectorAll(".tab")].find((t) => t.dataset.tab === "touch");
  touchTab?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  check(doc.querySelectorAll("#touchlist .trow").length >= 6, "lista de botões touch aparece");

  // editor de layout
  doc.querySelector("#edit-layout")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 100));
  check(doc.querySelector(".touch").classList.contains("editing"), "modo de edição do layout ativa");
  check(doc.querySelectorAll(".touch .titem").length >= 6, "itens arrastáveis existem");
  doc.querySelector("#edit-done")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  check(!doc.querySelector(".touch").classList.contains("editing"), "modo de edição encerra");

  // sensibilidade
  const sensTab = [...doc.querySelectorAll(".tab")].find((t) => t.dataset.tab === "sens");
  sensTab?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  const slider = doc.querySelector('#sliders input[data-s="air"]');
  check(!!slider, "slider de controle aéreo existe");
  slider.value = "1.75";
  slider.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 80));
  const saved2 = JSON.parse(dom.window.localStorage.getItem("rocketlite.controls.v1") || "{}");
  check(Math.abs((saved2.sens?.air ?? 0) - 1.75) < 1e-6, "sensibilidade é salva");

  // restaurar padrão
  doc.querySelector("#reset-controls")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 100));
  const jumpReset = [...doc.querySelectorAll("#keylist .kbind[data-slot='0']")]
    .find((b) => b.dataset.a === "jump");
  check(jumpReset.textContent.trim() === "Espaço", "restaurar padrão volta o Pular para Espaço");

  doc.querySelector("#close-settings")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 100));
  check(doc.querySelector(".menu.settings").classList.contains("hidden"), "tela de controles fecha");
  check(errors.length === before2, "nenhum erro em toda a interação", errors.slice(before2, before2 + 3).join(" | "));
}

console.log(`\n\x1b[1m${pass} passaram, ${fail} falharam\x1b[0m\n`);
dom.window.close();
process.exit(fail > 0 ? 1 : 0);
