# Games Lab — Corda Elástica + Rocket Lite

Coleção de jogos web em **arquivo único** (single-file HTML ~350-580 kB), offline, mobile e desktop, publicada no GitHub Pages.

## Jogar agora (sem instalar nada)

**Portal oficial (hub):**
https://lluadevill-lab.github.io/games/

| Jogo | Link direto | Tamanho | Descrição curta |
|------|-------------|---------|-----------------|
| **Rocket Lite** | https://lluadevill-lab.github.io/games/rocket/ | 578 kB | Futebol com carros-foguete — física fiel ao Rocket League a 120 Hz |
| **Corda Elástica** | https://lluadevill-lab.github.io/games/corda/ | 361 kB | Pêndulo / estilingue estilo Spider-Swing, modo infinito procedural |

Ambos funcionam por `file://` — baixe o `index.html` e abra direto.

### Como o deploy funciona

O repositório usa **dois métodos compatíveis**:

1. **Legacy (atual ativo):** `docs/` commitado no repo, Pages configurado como **Deploy from a branch → Branch: `main` + pasta `/docs`**.
   - `docs/index.html` → hub / portal (11 kB)
   - `docs/rocket/index.html` → Rocket Lite build autocontido
   - `docs/corda/index.html` → Corda Elástica build autocontido
   - `docs/.nojekyll` → desativa Jekyll

2. **Moderno (recomendado):** GitHub Actions workflow `.github/workflows/pages.yml`.
   - A cada push em `main`, faz build de Corda e Rocket e publica via `actions/deploy-pages@v4`.
   - Para migrar: em https://github.com/lluadevill-lab/games/settings/pages → **Build and deployment → Source → GitHub Actions**.

> Status atual verificado: `gh api repos/lluadevill-lab/games/pages` mostra  
> `html_url: https://lluadevill-lab.github.io/games/` e source legado (pode ser `arena/019fa08a-games` ou `main` /docs). Depois do merge deste PR, troque para `main` + `/docs` ou para `GitHub Actions`.

## Rocket Lite — detalhes técnicos

Ver `rocket/MECANICAS.md` — documentação completa extraída do RLBot / RocketSim.

- **Motor:** 120 ticks/s fixos, gravidade 650 uu/s², massa carro 180 vs bola 30
- **Controles físicos:** curva de throttle, curva de steer, sticky force 325, suspensão por raycast SDF, torques aéreos pitch 12.46 / yaw 9.11 / roll 38.34
- **Mecânicas:** jump 291 uu/s + hold, flip window 1.25s, dodge impulse 500, flip-cancel, boost 991 uu/s² / 33.3/s, supersônico 2200, demolição, boost pads 100/12 com respawn 10/4 s
- **Render:** Three.js low-poly, sombras opcionais, trails, shake, goal FX, predição de bola (integração drag linear), HUD velocidade km/h
- **IA:** bot que persegue bola com interceptação, coleta boost, skill easy/medio/hard
- **Input:** teclado, gamepad (via deadzone), touch joystick duplo, settings salvos em localStorage

Rodar local:
```bash
cd rocket
npm install
npm run dev          # http://localhost:5173
npm run test:all     # typecheck + physics + controls + arena + boot
npm run build        # gera dist/index.html (single file)
cp dist/index.html ../docs/rocket/index.html
```

## Corda Elástica — detalhes

Jogo original em React + TypeScript + Vite.

```bash
npm install
npm run dev          # http://localhost:5173
npm run dev -- --host   # para celular na mesma rede
npm run build        # gera dist/index.html
cp dist/index.html docs/corda/index.html
```

### Controles Corda

| Ação | Teclado | Toque / Mouse |
| --- | --- | --- |
| Engatar / soltar corda | `Espaço`, `W`, `↑` | toque simples |
| Estilingue | — | arrastar para trás e soltar |
| Bombear o balanço | `S`, `↓` | segurar |
| Controle no ar | `A` / `D` | — |
| Pausar | `P` / `Esc` | botão no HUD |
| Reiniciar | `R` | botão no HUD |

Sistema de dificuldade por orçamento (`LevelRules` em `src/types/game.ts`): `maxHooks`, `maxLaunches`, `floorIsLethal`, `maxWallHits`, `timeLimit`, `hookRange`, `gravityScale`.

## Estrutura do repo

```
.
├── docs/                 # artefatos publicados no Pages (commitados)
│   ├── index.html        # hub portal 11 kB (Games Lab)
│   ├── .nojekyll
│   ├── rocket/index.html # Rocket Lite single-file 578 kB
│   ├── corda/index.html  # Corda Elástica single-file 361 kB
│   └── corda-elastica/index.html # alias legado
├── rocket/               # Rocket Lite (Vite + Three)
│   ├── src/sim/          # física a 120Hz
│   ├── src/core/         # vec math, rng
│   ├── src/render/       # Three low-poly meshes, scene
│   ├── src/ui/           # hud, menu, touch
│   ├── src/audio/        # WebAudio SFX procedural
│   ├── src/input/        # controls + settings
│   ├── tests/
│   └── MECANICAS.md
├── src/                  # Corda Elástica
│   ├── game/             # engine.ts, physics.ts, levels.ts, endless.ts
│   ├── components/       # GameCanvas, StartScreen, Navbar...
│   └── utils/            # sound.ts, storage.ts
├── .github/workflows/pages.yml # deploy moderno via Actions
├── vite.config.ts        # base: "./" para funcionar em subpath
└── rocket/vite.config.ts # base: "./" + singlefile
```

## Publicação manual rápida (se Pages não estiver ativo)

1. Link direto: https://github.com/lluadevill-lab/games/settings/pages
2. **Build and deployment → Source:** `Deploy from a branch`
3. **Branch:** `main` + pasta `/docs` → Save
4. Aguarde ~1 min. O site fica em `https://lluadevill-lab.github.io/games/`
5. Ou use **Source: GitHub Actions** e o workflow `pages.yml` fará o deploy automaticamente.

Offline: baixe `docs/rocket/index.html` ou `docs/corda/index.html` e abra com `file://`.
