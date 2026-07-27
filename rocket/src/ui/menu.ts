/** Menu inicial, pausa e telas de fim de jogo. */
import type { BotSkill } from "../sim/bot";

export interface GameConfig {
  mode: "match" | "training";
  skill: BotSkill;
  matchMinutes: number;
  quality: "baixa" | "media" | "alta";
  showPrediction: boolean;
}

export const defaultConfig: GameConfig = {
  mode: "match",
  skill: "medio",
  matchMinutes: 3,
  quality: "media",
  showPrediction: true,
};

export function buildMenu(
  parent: HTMLElement,
  onStart: (cfg: GameConfig) => void,
  onOpenControls: () => void,
): { show: () => void; hide: () => void; el: HTMLElement } {
  const cfg: GameConfig = { ...defaultConfig };
  const el = document.createElement("div");
  el.className = "menu";
  el.innerHTML = `
    <div class="menu-card">
      <h1>ROCKET <span>LITE</span></h1>
      <p class="tag">Futebol com carros-foguete · física de verdade, gráficos leves</p>

      <div class="row">
        <label>Modo</label>
        <div class="seg" data-key="mode">
          <button data-v="match" class="on">Partida 1v1</button>
          <button data-v="training">Treino livre</button>
        </div>
      </div>

      <div class="row">
        <label>Bot</label>
        <div class="seg" data-key="skill">
          <button data-v="facil">Fácil</button>
          <button data-v="medio" class="on">Médio</button>
          <button data-v="dificil">Difícil</button>
        </div>
      </div>

      <div class="row">
        <label>Duração</label>
        <div class="seg" data-key="matchMinutes">
          <button data-v="1">1 min</button>
          <button data-v="3" class="on">3 min</button>
          <button data-v="5">5 min</button>
        </div>
      </div>

      <div class="row">
        <label>Gráficos</label>
        <div class="seg" data-key="quality">
          <button data-v="baixa">Baixo</button>
          <button data-v="media" class="on">Médio</button>
          <button data-v="alta">Alto</button>
        </div>
      </div>

      <div class="row">
        <label>Linha da bola</label>
        <div class="seg" data-key="showPrediction">
          <button data-v="true" class="on">Ligada</button>
          <button data-v="false">Desligada</button>
        </div>
      </div>

      <button class="play" id="play">JOGAR</button>
      <button class="ghost" id="open-controls">⚙ Controles &amp; sensibilidade</button>

      <details class="help">
        <summary>Controles &amp; manobras</summary>
        <div class="cols">
          <div>
            <h4>Teclado</h4>
            <ul>
              <li><b>W / S</b> acelerar / ré · no ar: nariz p/ baixo e p/ cima</li>
              <li><b>A / D</b> virar · no ar: guinada</li>
              <li><b>Espaço</b> pular · 2º toque = flip/double jump</li>
              <li><b>Shift</b> boost</li>
              <li><b>K</b> powerslide · no ar: air roll</li>
              <li><b>Q / E</b> air roll esquerda / direita</li>
              <li><b>C</b> ball cam · <b>R</b> reiniciar · <b>P</b> pausa</li>
              <li>Tudo remapeável em <b>⚙ Controles</b></li>
            </ul>
          </div>
          <div>
            <h4>Manobras</h4>
            <ul>
              <li><b>Front flip</b>: pule e toque de novo com W (ganha velocidade)</li>
              <li><b>Half-flip</b>: pule, S + espaço, e segure K para rolar 180°</li>
              <li><b>Aéreo</b>: pule, aponte o nariz na bola e segure boost</li>
              <li><b>Parede</b>: chegue com velocidade e continue acelerando</li>
              <li><b>Demolição</b>: acima de 2200 uu/s você destrói o adversário</li>
            </ul>
          </div>
        </div>
      </details>
      <p class="foot">Gamepad e touch também funcionam.</p>
    </div>
  `;
  parent.appendChild(el);

  el.querySelectorAll<HTMLElement>(".seg").forEach((seg) => {
    seg.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (!btn) return;
      seg.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      const key = seg.dataset.key as keyof GameConfig;
      const v = btn.dataset.v!;
      if (key === "matchMinutes") cfg.matchMinutes = Number(v);
      else if (key === "showPrediction") cfg.showPrediction = v === "true";
      else (cfg as any)[key] = v;
    });
  });

  (el.querySelector("#play") as HTMLElement).addEventListener("click", () => {
    onStart({ ...cfg });
  });
  (el.querySelector("#open-controls") as HTMLElement).addEventListener(
    "click",
    onOpenControls,
  );

  return {
    el,
    show: () => el.classList.remove("hidden"),
    hide: () => el.classList.add("hidden"),
  };
}

export function buildPause(
  parent: HTMLElement,
  handlers: {
    resume: () => void;
    restart: () => void;
    menu: () => void;
    toggleMute: () => void;
    controls: () => void;
  },
): { show: () => void; hide: () => void; visible: () => boolean } {
  const el = document.createElement("div");
  el.className = "menu pause hidden";
  el.innerHTML = `
    <div class="menu-card small">
      <h2>PAUSA</h2>
      <button class="play" id="p-resume">Continuar</button>
      <button class="ghost" id="p-restart">Reiniciar partida</button>
      <button class="ghost" id="p-controls">⚙ Controles</button>
      <button class="ghost" id="p-mute">Som ligado/desligado</button>
      <button class="ghost" id="p-menu">Menu principal</button>
    </div>
  `;
  parent.appendChild(el);
  (el.querySelector("#p-resume") as HTMLElement).onclick = handlers.resume;
  (el.querySelector("#p-restart") as HTMLElement).onclick = handlers.restart;
  (el.querySelector("#p-menu") as HTMLElement).onclick = handlers.menu;
  (el.querySelector("#p-controls") as HTMLElement).onclick = handlers.controls;
  (el.querySelector("#p-mute") as HTMLElement).onclick = handlers.toggleMute;
  return {
    show: () => el.classList.remove("hidden"),
    hide: () => el.classList.add("hidden"),
    visible: () => !el.classList.contains("hidden"),
  };
}

export function buildGameOver(
  parent: HTMLElement,
  handlers: { again: () => void; menu: () => void },
): { show: (title: string, sub: string) => void; hide: () => void } {
  const el = document.createElement("div");
  el.className = "menu over hidden";
  el.innerHTML = `
    <div class="menu-card small">
      <h2 id="o-title">FIM DE JOGO</h2>
      <p id="o-sub"></p>
      <button class="play" id="o-again">Jogar de novo</button>
      <button class="ghost" id="o-menu">Menu principal</button>
    </div>
  `;
  parent.appendChild(el);
  (el.querySelector("#o-again") as HTMLElement).onclick = handlers.again;
  (el.querySelector("#o-menu") as HTMLElement).onclick = handlers.menu;
  const title = el.querySelector("#o-title") as HTMLElement;
  const sub = el.querySelector("#o-sub") as HTMLElement;
  return {
    show: (t, s) => {
      title.textContent = t;
      sub.textContent = s;
      el.classList.remove("hidden");
    },
    hide: () => el.classList.add("hidden"),
  };
}
