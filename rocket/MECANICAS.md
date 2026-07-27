# Rocket League por dentro — as mecânicas de verdade

Documento de referência que usei para construir o **Rocket Lite**. Aqui não tem
"aperte X para chutar": é o que o motor faz por baixo, com os números que a
comunidade extraiu (RLBot / RocketSim) do jogo original.

---

## 1. O modelo básico

Rocket League **não é um jogo de futebol com carros**. É um simulador de corpos
rígidos (Psyonix usa uma Bullet Physics modificada) onde:

- Tudo roda a **120 ticks por segundo**, com passo fixo (`dt = 1/120`). O render
  é desacoplado. Física determinística → replays e o netcode funcionam.
- Existem **exatamente 3 tipos de corpo**: a arena (estática), a bola (esfera) e
  os carros (caixa orientada = OBB, com 4 rodas com suspensão).
- Unidade de medida: **uu** (Unreal Unit). 1 uu ≈ 1,9 cm. Gravidade = **650 uu/s²**.

Tudo o que parece "habilidade" (aéreo, flip reset, air dribble) é consequência
emergente de umas 15 regras. Nenhuma delas é uma mecânica scriptada.

---

## 2. Arena (soccar padrão)

| Elemento | Valor |
|---|---|
| Campo (X) | −4096 … +4096 (largura 8192) |
| Campo (Y) | −5120 … +5120 (comprimento 10240) |
| Teto (Z) | 2044 |
| Cantos | plano a 45°: `|x| + |y| ≤ 8064` |
| Boca do gol | largura 1786 (±892.75), altura 642.775, profundidade 880 |
| Arredondamento parede/chão | raio ~256 uu (a "rampa" que permite subir na parede) |

O ponto-chave: **a arena é fechada e contínua**. Não existe "chão" e "parede"
como categorias diferentes — o carro trata qualquer superfície igual. É por isso
que dá pra dirigir na parede, no teto e nos cantos: a mesma rotina de suspensão
+ atrito roda com uma normal diferente.

Gol validado quando a bola **cruza inteira** a linha: `|y| > 5120 + raio`.

---

## 3. A bola

| Propriedade | Valor |
|---|---|
| Raio | 91.25 uu |
| Massa | 30 (carro = 180 → o carro é 6× mais pesado) |
| Restituição (quique) | 0.6 |
| Atrito | 0.35 |
| Arrasto do ar | ~0.0305 /s (é linear na velocidade, não quadrático) |
| Velocidade máxima | 6000 uu/s |
| Rotação máxima | 6 rad/s |

Detalhes que mudam o jogo:

- **A bola tem spin e o spin é conservado**, mas **não há efeito Magnus**: a bola
  não curva no ar. O spin só importa quando ela toca uma superfície (atrito
  converte rotação em translação e vice-versa) — é isso que faz uma bola com
  backspin "morrer" ao quicar e permite dribbles no capô.
- O arrasto linear é o motivo de a bola nunca passar de ~6000 e de chutes longos
  perderem velocidade de forma previsível (a "ball prediction" dos bots é uma
  integração desse modelo — o próprio jogo mostra isso na linha de mira).

---

## 4. O carro

Hitbox padrão (Octane): **118.01 × 84.2 × 36.16 uu**, massa 180.
A hitbox é uma caixa — **não** o modelo visual. Por isso "hitbox" é escolha de
gameplay, não estética.

### 4.1 Aceleração no chão (curva de throttle)

Aceleração depende da velocidade atual — é uma curva, não um valor:

| Velocidade | Aceleração |
|---|---|
| 0 | 1600 uu/s² |
| 1400 | 160 uu/s² |
| 1410+ | 0 |

- **Velocidade máxima sem boost: 1410 uu/s.**
- Freio: 3500 uu/s². Desacelerar solto ("coast"): 525 uu/s².
- Marcha à ré: máx. 1410 também, mas com curva pior.

### 4.2 Boost

- Aceleração extra: **991.67 uu/s²** na direção do nariz do carro (funciona no ar
  e no chão, e é a mesma no chão e no ar).
- Consumo: **33.3 boost/s** (tanque = 100 → 3 s de boost cheio).
- Velocidade máxima com boost: **2300 uu/s**. Acima de **2200** o carro está
  **supersônico** (rastro, som, e pode demolir).
- Detalhe cruel: boost aponta pro **nariz**, não pra direção do movimento. Um
  carro derrapando com boost desperdiça energia — a base do "wave dash" e do
  controle de velocidade em aéreos.

### 4.3 Direção (curva de raio de curva)

O raio de curva também é uma curva em função da velocidade:

| Velocidade | Curvatura (1/raio) |
|---|---|
| 0 | 0.0069 |
| 500 | 0.00398 |
| 1000 | 0.00235 |
| 1500 | 0.001375 |
| 1750 | 0.0011 |
| 2300 | 0.00088 |

Taxa de guinada = `curvatura × velocidade`. Ou seja: **quanto mais rápido, maior
o raio** — supersônico você quase não vira. Isso é o que obriga o uso de
powerslide e half-flips.

**Powerslide**: reduz o atrito lateral (a aderência que segura o carro na curva).
Não é "virar mais": é deixar deslizar, preservando a velocidade e permitindo
apontar o nariz para outro lado (drift).

### 4.4 Suspensão e "grude"

Cada roda faz um raycast pra baixo e aplica uma mola + amortecedor. Além disso o
carro sofre uma **sticky force de ~325 uu/s²** em direção à superfície em que
está apoiado. Essa força é o motivo de:

- dar pra dirigir na parede e no teto sem cair,
- o carro "grudar" ao pousar em vez de quicar,
- e de existir o **wall dash / ceiling shuffle**.

Ao sair da superfície, a sticky force some após alguns ticks.

---

## 5. Pulo, flip e air roll — o coração do jogo

### 5.1 Pulo

- Impulso instantâneo: **291.67 uu/s** ao longo da **normal da superfície** (não
  do mundo!) — por isso pular numa parede te lança horizontalmente.
- Enquanto segura o botão, mais **1400 uu/s² por até 0.2 s** (pulo curto vs longo).

### 5.2 Segundo pulo (dentro de 1.25 s)

Depois do primeiro pulo você tem uma janela de **1.25 s** e um "flip" guardado:

- **Sem input direcional** → *double jump*: outro impulso de 291.67 pra cima.
- **Com input direcional** → *dodge/flip*: impulso horizontal de ~500 uu/s na
  direção do input + rotação forçada de ~1 volta em 0.65 s.
  - **Front flip**: ganha velocidade — é o método padrão de se locomover.
  - **Back flip**: freia e ganha altura.
  - **Diagonal (45°)**: o famoso *speed flip / diagonal flip*.
  - **Flip cancel**: puxar o nariz pro lado oposto logo após iniciar o flip
    **cancela a rotação mas mantém o impulso**. É a base de speed flip, musty
    flick, half-flip.
- **Half-flip**: back flip + flip cancel + air roll 180° = meia-volta rápida.

Depois de flipar você fica **sem flip** até tocar o chão de novo (é o que "flip
reset" devolve: encostar as 4 rodas em algo no ar recarrega o flip).

Durante o flip o carro é **imune a torque** e sua velocidade é redirecionada
parcialmente — por isso flips são também uma ferramenta de força no toque
(um toque com flip bate muito mais forte que um toque normal).

### 5.3 Controle aéreo

No ar você não controla velocidade — controla **torque angular** (rad/s²):

| Eixo | Aceleração | Amortecimento (quando sem input) |
|---|---|---|
| Pitch (nariz cima/baixo) | 12.46 | −2.798 |
| Yaw (girar) | 9.11 | −1.886 |
| Roll (rolar) | 38.34 | −4.589 |

Velocidade angular máxima: **5.5 rad/s**.

Repare: **roll é 3× mais forte que pitch e 4× mais que yaw**. É exatamente por
isso que jogadores avançados usam **air roll direcional**: girar no roll e
corrigir com pitch é muito mais rápido do que usar yaw. Também é por isso que o
amortecimento existe: soltar o controle estabiliza o carro sozinho.

Toda a "mágica" de aéreo é: apontar o nariz (torque) + boost (aceleração linear).
Não há empuxo lateral. Você é um foguete que só empurra pra frente.

---

## 6. Colisão carro × bola (a parte "não física")

Aqui está o segredo mal conhecido: o toque na bola **não é** só uma colisão
rígida. O motor faz duas coisas:

1. **Colisão rígida normal** (esfera × OBB) com restituição e atrito, usando as
   massas 30 e 180.
2. **Um impulso extra artificial ("Psyonix impulse")** aplicado na direção
   `bola − carro`, com o componente Z comprimido (×0.35) e o componente
   para frente amplificado (×0.65), escalado pela **velocidade relativa** e
   limitado a 4600 uu/s.

Consequências práticas:

- **Onde você bate importa mais do que a física real sugeriria.** Bater com o
  canto do carro joga a bola pro lado com mais força do que uma colisão elástica
  faria. Isso é design deliberado, pra dar controle ao jogador.
- Esse impulso extra é o que permite **flicks** e chutes fortes com pouca
  velocidade.
- A bola nunca "atravessa" o carro porque a colisão é resolvida por depenetração
  posicional antes do impulso.

---

## 7. Boost pads (economia do jogo)

34 pads no mapa:

- **6 pads grandes** (nos cantos e nos meios das laterais): **100 de boost**,
  respawn em **10 s**.
- **28 pads pequenos**: **12 de boost**, respawn em **4 s**.

Gerenciar boost é metade do jogo competitivo: é um recurso com posição
geográfica fixa, o que transforma o mapa em um problema de rotação.

---

## 8. Demolições

Carro **supersônico** (≥2200 uu/s) que encosta em um adversário o **demole**:
respawn em 3 s no próprio lado do campo. Não causa dano parcial — é binário.

---

## 9. Câmera (é uma mecânica, não um enfeite)

Parâmetros padrão: distância 270, altura 110, ângulo −3°, FOV 110, rigidez 0.5.

- **Ball cam**: a câmera não olha o carro — ela se posiciona **atrás do carro no
  eixo carro→bola**. Isso significa que ball cam também muda o significado dos
  seus inputs em relação ao que você vê.
- A câmera **nunca rola (roll)**: mantém o up do mundo. É por isso que dirigir no
  teto é desorientador.

---

## 10. Regras de partida

- 5 min, gol dá 1 ponto, empate → **prorrogação em morte súbita** (sem tempo).
- Kickoff: 5 posições fixas (2 diagonais, 2 quase-centro, 1 centro), contagem de
  3 s onde os carros ficam travados, bola no centro parada.
- Após gol: 3 s de replay/comemoração e novo kickoff.

---

## 11. O que isso significa pra implementação

Ordem de execução de cada tick (a que eu segui no Rocket Lite):

```
para cada tick (1/120 s):
  1. ler inputs (jogador + bots)
  2. para cada carro:
       a. contatos das rodas (SDF da arena) → grounded?
       b. chão: throttle/curva, atrito lateral, sticky force, alinhar à superfície
          ar:   torques pitch/yaw/roll + amortecimento
       c. boost (aceleração + consumo)
       d. pulo / double jump / flip / flip cancel
       e. integrar velocidade e quaternion, clamp 2300 e 5.5 rad/s
  3. bola: gravidade + arrasto + integração
  4. colisões: bola×arena, carro×arena (8 vértices da hitbox), carro×bola
     (rígida + impulso Psyonix), carro×carro (+ demolição se supersônico)
  5. boost pads (coleta/respawn)
  6. regras: gol, relógio, kickoff, prorrogação
```

O render lê o estado depois e não influencia nada — é por isso que dá pra trocar
gráficos pesados por low-poly sem alterar uma vírgula do gameplay.
