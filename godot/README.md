# Rocket Lite — Godot 4

Réplica **1:1** do [Rocket Lite web](../rocket/) em **Godot 4.3+**, com física a **120 Hz** fiel aos valores do Rocket League (RLBot / RocketSim).

Projeto de faculdade (Games Lab) — uso de IA na criação de jogos.

> Jogo **inspirado** em futebol com carros. Sem logos, assets ou trade dress do Rocket League oficial.

---

## Como abrir

1. Instale [Godot 4.3+](https://godotengine.org/download) (Standard, não precisa .NET).
2. Abra o Godot → **Import** → selecione a pasta `godot/` deste repositório.
3. Pressione **F5** (ou Play).

```
godot/
├── project.godot          # projeto Godot 4
├── scenes/main.tscn       # cena principal
├── scenes/main.gd         # laço do jogo
├── sim/                   # física 120 Hz (port do TypeScript)
│   ├── constants.gd
│   ├── arena.gd           # SDF da arena
│   ├── car.gd             # suspensão, flip, boost
│   ├── ball.gd            # bola + impulso Psyonix
│   ├── world.gd           # partida, kickoff, pads
│   ├── bot.gd             # IA
│   ├── predict.gd
│   ├── boost_pads.gd
│   ├── types.gd
│   └── rng.gd             # mulberry32 determinístico
├── render/                # meshes low-poly + câmera
├── input/controls.gd
├── audio/sfx.gd           # SFX procedural (sem arquivos)
└── ui/                    # HUD + menu
```

---

## Controles

| Ação | Teclado | Gamepad |
|------|---------|---------|
| Acelerar / Ré | `W` / `S` | RT / LT |
| Virar | `A` / `D` | Stick esquerdo |
| Pular / Flip | `Espaço` | A / ✕ |
| Boost | `Shift` | B / ○ |
| Powerslide / Air roll | `K` | X / □ |
| Air roll E/D | `Q` / `E` | LB / RB |
| Ball cam | `C` | Y / △ |
| Reiniciar | `R` | Select |
| Pausa | `P` / `Esc` | Start |

No ar, `W/S` controlam pitch (nariz) e `A/D` controlam yaw — igual ao original web.

### Manobras

- **Front flip**: pule e toque de novo com W (ganha velocidade)
- **Half-flip**: pule, S + espaço, segure K para rolar 180°
- **Aéreo**: pule, aponte o nariz na bola e segure boost
- **Parede**: chegue com velocidade e continue acelerando (sticky force)
- **Demolição**: acima de 2200 uu/s você destrói o adversário

---

## Física (1:1 com o HTML)

| Parâmetro | Valor |
|-----------|-------|
| Tick rate | 120 Hz (`dt = 1/120`) |
| Gravidade | 650 uu/s² |
| Massa carro / bola | 180 / 30 |
| Vel. máx. (sem / com boost) | 1410 / 2300 uu/s |
| Supersônico | ≥ 2200 uu/s |
| Boost | 991.67 uu/s², 33.3/s, tanque 100 |
| Jump | 291.67 uu/s + hold 1400 por 0.2 s |
| Flip window | 1.25 s · dodge 620 uu/s · 0.65 s |
| Torques aéreos | pitch 12.46 / yaw 9.11 / roll 38.34 |
| Arena | 8192 × 10240 × 2044, cantos R=1152, fillet 256 |
| Pads | 6 grandes (100/10s) + 28 pequenos (12/4s) |

Detalhes completos: [`rocket/MECANICAS.md`](../rocket/MECANICAS.md).

### Convenção de eixos

A simulação usa o sistema do Rocket League (**X = frente, Z = cima, Y = esquerda**).  
O renderer converte para o Godot (**Y = cima, −Z = frente**) só na hora de desenhar — a física nunca sabe do Godot.

---

## Melhorias em relação ao HTML

1. **Motor nativo 3D** — iluminação, glow, fog e sombras reais (Forward+).
2. **Carros com silhueta** — 3 estilos (Vector / Comet / Bison), cabine, spoiler, aros.
3. **Áudio procedural** no Godot (`AudioStreamGenerator`) — motor + boost contínuos.
4. **Correção de bugs do port**:
   - depenetração bola×OBB quando o centro fica *dentro* da hitbox
   - bot sem o typo `} else if (state === "rotate")` repetido
   - RNG 32-bit com wrap correto (mulberry32)
5. **Estrutura modular** pronta para expandir (garagem, replay, online).
6. **Export** nativo: Windows, Linux, macOS, Android, Web (HTML5).

---

## Modos

- **Partida 1v1** — você (azul) × bot (laranja), 1/3/5 min, prorrogação morte súbita
- **Treino livre** — sem bot, sem relógio; `R` reposiciona bola e carro

Dificuldade do bot: Fácil / Médio / Difícil (reação, aerial, speed cap, erro).

---

## Exportar

No Godot: **Project → Export**.

| Alvo | Template |
|------|----------|
| Windows | Desktop |
| Linux | Desktop |
| Web | Web (WASM) — ótimo para GitHub Pages |
| Android | Android |

Para web, após exportar, publique a pasta gerada (ex.: em `docs/rocket-godot/`).

---

## Relação com o projeto web

| | Web (`rocket/`) | Godot (`godot/`) |
|--|-----------------|------------------|
| Linguagem | TypeScript | GDScript |
| Render | Three.js | Godot 4 Forward+ |
| Física | idêntica | idêntica (port linha a linha) |
| Deploy | single-file HTML | executável / WASM |
| Fonte da verdade | `rocket/src/sim/*` | `godot/sim/*` |

Se alterar números de física, atualize **os dois** (ou regenere um a partir do outro).

---

## Créditos

- Física baseada em engenharia reversa da comunidade (**RLBot**, **RocketSim**)
- Design original do Rocket Lite web: Games Lab / lluadevill-lab
- Port Godot + melhorias: conversão assistida por IA (projeto de faculdade)
