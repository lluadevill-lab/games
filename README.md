# Corda Elástica

Jogo de pêndulo/estilingue em canvas (React + TypeScript + Vite).

## Jogar no navegador (qualquer dispositivo)

O build já está commitado em [`docs/index.html`](./docs/index.html) e é um
único arquivo HTML autocontido (~353 kB). Só falta ligar o GitHub Pages —
são ~30 segundos e **precisa ser feito por você**, porque ativar o Pages
exige permissão de administrador do repositório.

**Link direto para a configuração:**
<https://github.com/lluadevill-lab/games/settings/pages>

1. Em **Build and deployment → Source**, escolha **Deploy from a branch**
2. Em **Branch**, selecione `arena/019f9caf-games` e a pasta **`/docs`**
3. Clique em **Save** e aguarde ~1 minuto

O jogo ficará no ar em:

```
https://lluadevill-lab.github.io/games/
```

Esse link abre em celular, tablet e desktop, sem instalar nada.

> Se preferir usar `main`: dê merge no PR #1 primeiro, depois selecione
> a branch `main` + pasta `/docs` no mesmo menu.

### Alternativas sem GitHub Pages

- **Netlify Drop** — arraste o arquivo `docs/index.html` em
  <https://app.netlify.com/drop> e o link sai na hora (não precisa de conta).
- **Local pelo celular** — `npm run dev -- --host` e acesse o IP da sua
  máquina pelo celular na mesma rede Wi-Fi.
- **Offline** — baixe o `docs/index.html` e abra direto no navegador;
  ele funciona sem servidor (`file://`), porque o JS e o CSS estão embutidos.

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
