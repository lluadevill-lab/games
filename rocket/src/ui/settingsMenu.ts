/**
 * Tela de configuração de controles: teclado, gamepad, sensibilidade e
 * editor de layout touch (arrastar e redimensionar).
 */
import type { Controls } from "../input/controls";
import {
  ACTIONS,
  TOUCH_ITEMS,
  keyLabel,
  padLabel,
  resetSettings,
  saveSettings,
  type ActionId,
  type ControlSettings,
  type TouchId,
} from "../input/settings";
import type { TouchUI } from "./touch";

export interface SettingsUI {
  show: () => void;
  hide: () => void;
  visible: () => boolean;
}

export function buildSettingsMenu(
  parent: HTMLElement,
  controls: Controls,
  touchUI: TouchUI,
  onClose: () => void,
  onChange: () => void,
): SettingsUI {
  const el = document.createElement("div");
  el.className = "menu settings hidden";
  el.innerHTML = `
    <div class="menu-card wide">
      <h2>CONTROLES</h2>

      <div class="tabs">
        <button class="tab on" data-tab="teclado">Teclado</button>
        <button class="tab" data-tab="gamepad">Gamepad</button>
        <button class="tab" data-tab="touch">Touch</button>
        <button class="tab" data-tab="sens">Sensibilidade</button>
      </div>

      <div class="tabpane on" data-pane="teclado">
        <p class="hint">Clique numa tecla e aperte a nova. <b>Esc</b> cancela.</p>
        <div id="keylist" class="keylist"></div>
      </div>

      <div class="tabpane" data-pane="gamepad">
        <p class="hint" id="gp-status">Nenhum gamepad detectado. Conecte e aperte um botão.</p>
        <div id="padlist" class="keylist"></div>
        <div class="row">
          <label>Vibração</label>
          <div class="seg" data-key="rumble">
            <button data-v="true">Ligada</button>
            <button data-v="false">Desligada</button>
          </div>
        </div>
        <p class="hint">Analógico esquerdo dirige · gatilhos aceleram e freiam.</p>
      </div>

      <div class="tabpane" data-pane="touch">
        <div class="row">
          <label>Direcional</label>
          <div class="seg" data-key="touchMode">
            <button data-v="analog">Analógico</button>
            <button data-v="dpad">D-pad (WASD)</button>
          </div>
        </div>
        <button class="ghost" id="edit-layout">Mover botões na tela</button>
        <p class="hint">
          No modo de edição, arraste cada botão para onde quiser e ajuste o
          tamanho abaixo.
        </p>
        <div id="touchlist" class="touchlist"></div>
      </div>

      <div class="tabpane" data-pane="sens">
        <div id="sliders"></div>
        <div class="row">
          <label>Inverter nariz</label>
          <div class="seg" data-key="invertPitch">
            <button data-v="false">Normal</button>
            <button data-v="true">Invertido</button>
          </div>
        </div>
      </div>

      <div class="btnrow">
        <button class="ghost danger" id="reset-controls">Restaurar padrão</button>
        <button class="play" id="close-settings">Pronto</button>
      </div>
    </div>

    <div class="edit-overlay hidden" id="edit-overlay">
      <div class="edit-bar">
        <span>Arraste os botões para posicionar</span>
        <button class="play small" id="edit-done">Concluir</button>
      </div>
    </div>
  `;
  parent.appendChild(el);

  const $ = <T extends HTMLElement>(sel: string) => el.querySelector(sel) as T;
  const s = () => controls.settings;

  // ---------------------------------------------------------------- abas
  el.querySelectorAll<HTMLElement>(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      el.querySelectorAll(".tab").forEach((t) => t.classList.remove("on"));
      el.querySelectorAll(".tabpane").forEach((p) => p.classList.remove("on"));
      tab.classList.add("on");
      $(`.tabpane[data-pane="${tab.dataset.tab}"]`).classList.add("on");
    });
  });

  // ---------------------------------------------------------------- teclado
  const keylist = $("#keylist");
  let capturingFor: { action: ActionId; slot: number } | null = null;

  function renderKeys(): void {
    keylist.innerHTML = "";
    let lastGroup = "";
    for (const a of ACTIONS) {
      if (a.group !== lastGroup) {
        lastGroup = a.group;
        const h = document.createElement("h4");
        h.textContent = a.group;
        keylist.appendChild(h);
      }
      const row = document.createElement("div");
      row.className = "keyrow";
      const binds = s().keys[a.id];
      row.innerHTML = `
        <span class="kname">${a.label}</span>
        <button class="kbind" data-a="${a.id}" data-slot="0">${keyLabel(binds[0] ?? "")}</button>
        <button class="kbind alt" data-a="${a.id}" data-slot="1">${
          binds[1] ? keyLabel(binds[1]) : "+"
        }</button>
      `;
      keylist.appendChild(row);
    }
  }

  keylist.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".kbind") as HTMLElement | null;
    if (!btn) return;
    keylist.querySelectorAll(".kbind").forEach((b) => b.classList.remove("capturing"));
    btn.classList.add("capturing");
    btn.textContent = "...";
    capturingFor = {
      action: btn.dataset.a as ActionId,
      slot: Number(btn.dataset.slot),
    };
    controls.capturing = true;
  });

  window.addEventListener(
    "keydown",
    (e) => {
      if (!capturingFor) return;
      e.preventDefault();
      e.stopPropagation();
      const { action, slot } = capturingFor;
      capturingFor = null;
      controls.capturing = false;

      if (e.code !== "Escape") {
        const binds = [...s().keys[action]];
        // remove a tecla de qualquer outra ação (evita conflito silencioso)
        for (const a of ACTIONS) {
          if (a.id === action) continue;
          s().keys[a.id] = s().keys[a.id].filter((c) => c !== e.code);
          if (s().keys[a.id].length === 0) s().keys[a.id] = [];
        }
        binds[slot] = e.code;
        s().keys[action] = binds.filter(Boolean);
        saveSettings(s());
        onChange();
      }
      renderKeys();
    },
    true,
  );

  // ---------------------------------------------------------------- gamepad
  const padlist = $("#padlist");
  const gpStatus = $("#gp-status");
  let capturingPad: string | null = null;
  const PAD_ACTIONS: [string, string][] = [
    ["jump", "Pular / Flip"],
    ["boost", "Boost"],
    ["handbrake", "Powerslide / Air roll"],
    ["ballcam", "Ball cam"],
    ["reset", "Reiniciar"],
    ["pause", "Pausa"],
  ];

  function renderPad(): void {
    padlist.innerHTML = "";
    for (const [id, label] of PAD_ACTIONS) {
      const row = document.createElement("div");
      row.className = "keyrow";
      const idx = (s().pad as Record<string, number>)[id];
      row.innerHTML = `
        <span class="kname">${label}</span>
        <button class="kbind pad" data-p="${id}">${padLabel(idx)}</button>
      `;
      padlist.appendChild(row);
    }
  }

  padlist.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".kbind") as HTMLElement | null;
    if (!btn) return;
    padlist.querySelectorAll(".kbind").forEach((b) => b.classList.remove("capturing"));
    btn.classList.add("capturing");
    btn.textContent = "aperte um botão...";
    capturingPad = btn.dataset.p!;
  });

  // ---------------------------------------------------------------- touch
  const touchlist = $("#touchlist");

  function renderTouch(): void {
    touchlist.innerHTML = "";
    for (const meta of TOUCH_ITEMS) {
      const item = s().touch[meta.id];
      const row = document.createElement("div");
      row.className = "trow";
      row.innerHTML = `
        <span class="kname">${meta.label}</span>
        <input type="range" min="0.6" max="1.6" step="0.05" value="${item.scale}"
               data-t="${meta.id}" class="tscale" />
        <button class="vis ${item.visible ? "on" : ""}" data-v="${meta.id}">
          ${item.visible ? "visível" : "oculto"}
        </button>
      `;
      touchlist.appendChild(row);
    }
  }

  touchlist.addEventListener("input", (e) => {
    const r = e.target as HTMLInputElement;
    if (!r.classList.contains("tscale")) return;
    s().touch[r.dataset.t as TouchId].scale = Number(r.value);
    touchUI.refresh();
    saveSettings(s());
  });

  touchlist.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest(".vis") as HTMLElement | null;
    if (!b) return;
    const id = b.dataset.v as TouchId;
    s().touch[id].visible = !s().touch[id].visible;
    saveSettings(s());
    renderTouch();
    touchUI.refresh();
  });

  const overlay = $("#edit-overlay");
  $("#edit-layout").addEventListener("click", () => {
    el.classList.add("editing-layout");
    overlay.classList.remove("hidden");
    touchUI.setVisible(true);
    touchUI.setEditing(true);
  });
  $("#edit-done").addEventListener("click", () => {
    el.classList.remove("editing-layout");
    overlay.classList.add("hidden");
    touchUI.setEditing(false);
    saveSettings(s());
    renderTouch();
  });

  // ---------------------------------------------------------------- sliders
  const sliders = $("#sliders");
  const SLIDERS: [keyof ControlSettings["sens"], string, number, number, number, string][] = [
    ["steer", "Direção (chão)", 0.3, 2.5, 0.05, "Quanto o carro vira com o input máximo"],
    ["air", "Controle aéreo", 0.3, 2.5, 0.05, "Velocidade de rotação no ar"],
    ["deadzone", "Zona morta", 0, 0.4, 0.01, "Ignora movimento pequeno do analógico"],
    ["gamma", "Precisão do centro", 1, 3, 0.1, "Maior = mais fino perto do centro"],
  ];

  function renderSliders(): void {
    sliders.innerHTML = "";
    for (const [key, label, min, max, step, hint] of SLIDERS) {
      const row = document.createElement("div");
      row.className = "srow";
      row.innerHTML = `
        <div class="shead">
          <span class="kname">${label}</span>
          <b class="sval" data-for="${key}">${s().sens[key].toFixed(2)}</b>
        </div>
        <input type="range" min="${min}" max="${max}" step="${step}"
               value="${s().sens[key]}" data-s="${key}" />
        <small>${hint}</small>
      `;
      sliders.appendChild(row);
    }
  }

  sliders.addEventListener("input", (e) => {
    const r = e.target as HTMLInputElement;
    const key = r.dataset.s as keyof ControlSettings["sens"];
    if (!key) return;
    s().sens[key] = Number(r.value);
    const out = sliders.querySelector(`.sval[data-for="${key}"]`);
    if (out) out.textContent = Number(r.value).toFixed(2);
    saveSettings(s());
    onChange();
  });

  // ---------------------------------------------------------------- segmentados
  function syncSegs(): void {
    el.querySelectorAll<HTMLElement>(".seg").forEach((seg) => {
      const key = seg.dataset.key!;
      let cur: string;
      if (key === "touchMode") cur = s().touchMode;
      else if (key === "rumble") cur = String(s().rumble);
      else cur = String(s().invertPitch);
      seg.querySelectorAll<HTMLElement>("button").forEach((b) => {
        b.classList.toggle("on", b.dataset.v === cur);
      });
    });
  }

  el.querySelectorAll<HTMLElement>(".seg").forEach((seg) => {
    seg.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button") as HTMLElement | null;
      if (!btn) return;
      const key = seg.dataset.key!;
      const v = btn.dataset.v!;
      if (key === "touchMode") s().touchMode = v as "analog" | "dpad";
      else if (key === "rumble") s().rumble = v === "true";
      else s().invertPitch = v === "true";
      saveSettings(s());
      syncSegs();
      touchUI.refresh();
      onChange();
    });
  });

  // ---------------------------------------------------------------- ações
  $("#reset-controls").addEventListener("click", () => {
    controls.settings = resetSettings();
    renderKeys();
    renderPad();
    renderTouch();
    renderSliders();
    syncSegs();
    touchUI.refresh();
    onChange();
  });

  $("#close-settings").addEventListener("click", () => {
    saveSettings(s());
    hide();
    onClose();
  });

  // ---------------------------------------------------------------- polling do gamepad
  // Enquanto a tela está aberta, observa botões para status e remapeamento.
  let pollTimer: number | null = null;
  const prev = new Map<number, boolean>();

  function pollPad(): void {
    const gp = controls.gamepad();
    if (gp) {
      gpStatus.textContent = `Conectado: ${gp.id.slice(0, 48)}`;
      gpStatus.classList.add("ok");
      for (let i = 0; i < gp.buttons.length; i++) {
        const now = gp.buttons[i].pressed;
        if (now && !prev.get(i) && capturingPad) {
          (s().pad as Record<string, number>)[capturingPad] = i;
          capturingPad = null;
          saveSettings(s());
          renderPad();
          onChange();
        }
        prev.set(i, now);
      }
    } else {
      gpStatus.textContent = "Nenhum gamepad detectado. Conecte e aperte um botão.";
      gpStatus.classList.remove("ok");
    }
  }

  function show(): void {
    el.classList.remove("hidden");
    renderKeys();
    renderPad();
    renderTouch();
    renderSliders();
    syncSegs();
    if (pollTimer === null) pollTimer = window.setInterval(pollPad, 120);
  }

  function hide(): void {
    el.classList.add("hidden");
    el.classList.remove("editing-layout");
    overlay.classList.add("hidden");
    touchUI.setEditing(false);
    capturingFor = null;
    capturingPad = null;
    controls.capturing = false;
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return { show, hide, visible: () => !el.classList.contains("hidden") };
}
