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

console.log(`\n\x1b[1m${pass} passaram, ${fail} falharam\x1b[0m\n`);
dom.window.close();
process.exit(fail > 0 ? 1 : 0);
