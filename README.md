# Corda Elástica

Jogo de pêndulo/estilingue em canvas (React + TypeScript + Vite).

## Jogar no navegador (qualquer dispositivo)

O build já vem pronto na pasta [`docs/`](./docs). Para publicar o link:

1. Vá em **Settings → Pages** no repositório
2. Em **Source**, escolha **Deploy from a branch**
3. Selecione a branch `arena/019f9caf-games` e a pasta **`/docs`** → **Save**

O link ficará disponível em:

```
https://lluadevill-lab.github.io/games/
```

Funciona em celular, tablet e desktop — é um único arquivo HTML autocontido
(~353 kB), sem dependência de rede depois de carregado.

> Depois de dar merge no PR, troque a branch do Pages para `main`.

## Rodar localmente

```bash
npm install
npm run dev          # http://localhost:5173
npm run dev -- --host   # para abrir pelo celular na mesma rede
```

## Build

```bash
npm run build        # gera dist/index.html (arquivo único)
cp dist/index.html docs/index.html   # atualiza a versão publicada
```

## Controles

| Ação | Teclado | Toque / Mouse |
| --- | --- | --- |
| Engatar / soltar corda | `Espaço`, `W`, `↑` | toque simples |
| Estilingue | — | arrastar para trás e soltar |
| Bombear o balanço | `S`, `↓` | segurar |
| Controle no ar | `A` / `D` | — |
| Pausar | `P` / `Esc` | botão no HUD |
| Reiniciar | `R` | botão no HUD |

## Sistema de dificuldade

A dificuldade é regida por um **orçamento de recursos por fase**
(`LevelRules` em `src/types/game.ts`), não apenas pelo tempo:

| Regra | Efeito |
| --- | --- |
| `maxHooks` | Quantas vezes pode se prender na corda (6 → 3) |
| `maxLaunches` | Quantos estilingues pode usar (5 → 2) |
| `floorIsLethal` | Tocar o chão mata (a partir do Mundo 2) |
| `maxWallHits` | Batidas em parede toleradas (6 → 1) |
| `timeLimit` | Tempo esgotado = derrota |
| `hookRange` | Alcance do gancho (340 → 280) |
| `gravityScale` | Multiplicador de gravidade da fase |

Âncoras também podem ter **usos limitados** (`maxUses`) e **cooldown** de
reengate, o que impede ficar balançando eternamente no mesmo ponto seguro.

### Estrelas

- ⭐ Concluir a fase
- ⭐⭐ Coletar tudo **e** não bater em nenhuma parede
- ⭐⭐⭐ Bater o tempo-alvo **e** coletar tudo

Os mundos são destravados por total de estrelas acumuladas (até 40).

## Estrutura

```
src/
  game/        engine.ts, physics.ts, levels.ts, endless.ts
  components/  GameCanvas, StartScreen, Navbar, ShopModal, ...
  types/       game.ts
  utils/       sound.ts (WebAudio procedural), cn.ts
docs/          build publicado (GitHub Pages)
```
