/**
 * Testes do sistema de configuração de controles.
 * Rodam em Node com um localStorage falso.
 */
globalThis.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

const {
  loadSettings, saveSettings, resetSettings, defaultSettings,
  keyLabel, padLabel, ACTIONS, TOUCH_ITEMS, DEFAULT_KEYMAP,
} = await import("../src/input/settings.ts");
const { shapeAxis } = await import("../src/input/controls.ts");

let pass = 0, fail = 0;
const check = (cond, name, detail = "") => {
  if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}${detail ? ` \x1b[90m(${detail})\x1b[0m` : ""}`); }
  else { fail++; console.log(`  \x1b[31m✗ ${name}\x1b[0m ${detail}`); }
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

// ==================================================================
section("Persistência");
{
  localStorage.clear();
  const d = loadSettings();
  check(d.keys.throttle.includes("KeyW"), "padrão tem W para acelerar");
  check(d.keys.right.includes("KeyD"), "padrão tem D para direita");
  check(d.sens.steer === 1, "sensibilidade padrão = 1");
}
{
  localStorage.clear();
  const s = defaultSettings();
  s.keys.jump = ["KeyZ"];
  s.sens.air = 1.8;
  s.touch.jump.x = 0.42;
  s.touchMode = "dpad";
  saveSettings(s);
  const back = loadSettings();
  check(back.keys.jump[0] === "KeyZ", "tecla remapeada persiste");
  check(back.sens.air === 1.8, "sensibilidade persiste");
  check(Math.abs(back.touch.jump.x - 0.42) < 1e-9, "posição do botão touch persiste");
  check(back.touchMode === "dpad", "modo do direcional persiste");
}
{
  // reset volta ao padrão e limpa o storage
  const s = resetSettings();
  check(s.keys.jump.includes("Space"), "reset restaura o padrão");
  check(localStorage.getItem("rocketlite.controls.v1") === null, "reset limpa o storage");
}

section("Robustez contra dados corrompidos");
{
  localStorage.clear();
  localStorage.setItem("rocketlite.controls.v1", "{isso não é json");
  const s = loadSettings();
  check(s.keys.throttle.includes("KeyW"), "JSON inválido cai no padrão sem quebrar");
}
{
  localStorage.setItem("rocketlite.controls.v1", JSON.stringify({ keys: "nada disso", sens: 42 }));
  const s = loadSettings();
  check(Array.isArray(s.keys.throttle), "tipos errados são ignorados");
  check(typeof s.sens.steer === "number", "sens inválido cai no padrão");
}
{
  // valores fora do intervalo são limitados
  localStorage.setItem("rocketlite.controls.v1", JSON.stringify({
    sens: { steer: 999, air: -50, deadzone: 5, gamma: 0.001 },
    touch: { jump: { x: 50, y: -3, scale: 99 } },
  }));
  const s = loadSettings();
  check(s.sens.steer <= 2.5, "sensibilidade máxima limitada", `${s.sens.steer}`);
  check(s.sens.air >= 0.3, "sensibilidade mínima limitada", `${s.sens.air}`);
  check(s.sens.deadzone <= 0.4, "zona morta limitada", `${s.sens.deadzone}`);
  check(s.touch.jump.x <= 1 && s.touch.jump.x >= 0, "posição do botão fica na tela", `x=${s.touch.jump.x}`);
  check(s.touch.jump.scale <= 1.6, "escala do botão limitada", `${s.touch.jump.scale}`);
}
{
  // configuração parcial: campos ausentes vêm do padrão
  localStorage.setItem("rocketlite.controls.v1", JSON.stringify({ keys: { jump: ["KeyM"] } }));
  const s = loadSettings();
  check(s.keys.jump[0] === "KeyM", "campo salvo é respeitado");
  check(s.keys.boost.length > 0, "campo ausente vem do padrão");
  check(s.touch.stick !== undefined, "layout touch ausente vem do padrão");
}

section("Cobertura do mapeamento");
{
  const missing = ACTIONS.filter((a) => !DEFAULT_KEYMAP[a.id]?.length);
  check(missing.length === 0, "toda ação tem tecla padrão", missing.map((m) => m.id).join(","));
  const d = defaultSettings();
  const items = TOUCH_ITEMS.filter((t) => !d.touch[t.id]);
  check(items.length === 0, "todo item touch tem posição padrão");
  // nenhuma tecla duplicada entre ações
  const seen = new Map();
  let dup = null;
  for (const a of ACTIONS) {
    for (const c of DEFAULT_KEYMAP[a.id]) {
      if (seen.has(c)) dup = `${c}: ${seen.get(c)} e ${a.id}`;
      seen.set(c, a.id);
    }
  }
  check(!dup, "nenhuma tecla padrão em conflito", dup || "");
}

section("Rótulos legíveis");
{
  check(keyLabel("KeyW") === "W", "KeyW -> W");
  check(keyLabel("Space") === "Espaço", "Space -> Espaço");
  check(keyLabel("ArrowUp") === "↑", "ArrowUp -> seta");
  check(keyLabel("ShiftLeft") === "Shift esq", "ShiftLeft legível");
  check(keyLabel("") === "—", "tecla vazia não quebra");
  check(padLabel(0).length > 0 && padLabel(99).includes("99"), "botões do gamepad têm rótulo");
}

section("Curva dos analógicos (shapeAxis)");
{
  check(shapeAxis(0.05, 0.15, 1) === 0, "dentro da zona morta = 0");
  check(shapeAxis(-0.05, 0.15, 1) === 0, "zona morta é simétrica");
  check(Math.abs(shapeAxis(1, 0.15, 1) - 1) < 1e-9, "máximo continua 1");
  check(Math.abs(shapeAxis(-1, 0.15, 1) + 1) < 1e-9, "mínimo continua -1");
  // logo acima da zona morta o valor começa perto de zero (sem salto)
  check(shapeAxis(0.16, 0.15, 1) < 0.05, "sem salto ao sair da zona morta");
  // gamma>1 dá mais precisão no centro
  const lin = shapeAxis(0.5, 0, 1);
  const gam = shapeAxis(0.5, 0, 2);
  check(gam < lin, "gamma alto reduz a resposta no meio do curso", `${gam.toFixed(2)} < ${lin.toFixed(2)}`);
  // monotônico
  let mono = true, prev = -Infinity;
  for (let v = 0; v <= 1; v += 0.02) {
    const o = shapeAxis(v, 0.12, 1.6);
    if (o < prev - 1e-9) mono = false;
    prev = o;
  }
  check(mono, "a curva é monotônica (sem inversões)");
  check(shapeAxis(0.5, 0, 1) === 0.5, "sem zona morta e gamma 1 é identidade");
}

console.log(`\n\x1b[1m${pass} passaram, ${fail} falharam\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
