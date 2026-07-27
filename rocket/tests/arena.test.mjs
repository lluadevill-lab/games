/**
 * Testes da geometria da arena — foco nos CANTOS ARREDONDADOS.
 *
 * O que queremos garantir:
 *  - o contorno em XY é um retângulo de cantos curvos (sem quinas);
 *  - a normal gira suavemente ao percorrer o canto (é isso que permite
 *    entrar no canto em velocidade sem "bater numa quina");
 *  - a boca do gol continua aberta e nada escapa da arena.
 */
import { arenaDistance, ballInGoal, fieldOutline } from "../src/sim/arena.ts";
import * as K from "../src/sim/constants.ts";
import { createWorld, stepWorld } from "../src/sim/world.ts";
import { set, v3 } from "../src/core/vec.ts";

let pass = 0, fail = 0;
const check = (cond, name, detail = "") => {
  if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}${detail ? ` \x1b[90m(${detail})\x1b[0m` : ""}`); }
  else { fail++; console.log(`  \x1b[31m✗ ${name}\x1b[0m ${detail}`); }
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const n = v3();

// ==================================================================
section("Paredes retas e piso/teto");
{
  check(Math.abs(arenaDistance(0, 0, 100, n) - 100) < 1e-6, "centro: distância = altura");
  check(Math.abs(arenaDistance(0, 0, K.CEILING_Z - 50, n) - 50) < 1e-6, "teto a 2044");
  arenaDistance(K.FIELD_X - 300, 0, 1000, n);
  check(n.x === -1 && n.y === 0, "normal da parede lateral aponta para dentro");
  arenaDistance(0, K.FIELD_Y - 300, 1000, n);
  check(n.y === -1, "normal da parede de fundo aponta para dentro");
  check(arenaDistance(0, 0, -10, n) < 0, "abaixo do piso = fora");
}

// ==================================================================
section("Cantos arredondados");
{
  // no vértice teórico da caixa, o canto curvo deve estar BEM mais perto
  const d = arenaDistance(K.FIELD_X - 20, K.FIELD_Y - 20, 500, n);
  check(d < 0, "o vértice quadrado da caixa fica FORA da arena curva", `d=${d.toFixed(0)}`);
}
{
  // ponto sobre o arco: distância deve ser ~0
  const cx = K.FIELD_X - K.CORNER_RADIUS;
  const cy = K.FIELD_Y - K.CORNER_RADIUS;
  const a = Math.PI / 4;
  const px = cx + Math.cos(a) * K.CORNER_RADIUS;
  const py = cy + Math.sin(a) * K.CORNER_RADIUS;
  const d = arenaDistance(px, py, 700, n);
  check(Math.abs(d) < 1, "ponto sobre o arco tem distância ~0", `d=${d.toFixed(3)}`);
  // normal aponta para o centro do arco
  const expNx = -Math.cos(a), expNy = -Math.sin(a);
  check(Math.hypot(n.x - expNx, n.y - expNy) < 0.02, "normal do canto aponta para o centro do arco");
}
{
  // continuidade: a normal gira suavemente ao longo do canto
  let maxJump = 0;
  let prev = null;
  const cx = K.FIELD_X - K.CORNER_RADIUS;
  const cy = K.FIELD_Y - K.CORNER_RADIUS;
  for (let i = 0; i <= 200; i++) {
    const a = (i / 200) * (Math.PI / 2);
    const px = cx + Math.cos(a) * (K.CORNER_RADIUS - 40);
    const py = cy + Math.sin(a) * (K.CORNER_RADIUS - 40);
    arenaDistance(px, py, 700, n);
    if (prev) maxJump = Math.max(maxJump, Math.hypot(n.x - prev[0], n.y - prev[1]));
    prev = [n.x, n.y];
  }
  check(maxJump < 0.05, "normal gira suavemente pelo canto (sem quina)", `salto máx ${maxJump.toFixed(4)}`);
}
{
  // e também na TRANSIÇÃO parede reta -> arco
  let maxJump = 0, prev = null;
  for (let px = K.FIELD_X - 300; px >= K.FIELD_X - K.CORNER_RADIUS - 600; px -= 10) {
    // caminha ao longo de y perto da parede de fundo
    arenaDistance(px, K.FIELD_Y - 200, 700, n);
    if (prev) maxJump = Math.max(maxJump, Math.hypot(n.x - prev[0], n.y - prev[1]));
    prev = [n.x, n.y];
  }
  check(maxJump < 0.25, "transição parede→canto é contínua", `salto máx ${maxJump.toFixed(3)}`);
}
{
  // o contorno exportado bate com o SDF
  const outline = fieldOutline(16);
  let worst = 0;
  for (const [x, y] of outline) worst = Math.max(worst, Math.abs(arenaDistance(x, y, 600, n)));
  check(worst < 12, "contorno do renderer coincide com a física", `erro máx ${worst.toFixed(1)} uu`);
}

// ==================================================================
section("Arredondamento piso/parede (permite subir na parede)");
{
  // dentro da faixa de fillet a normal tem componente vertical E horizontal
  arenaDistance(K.FIELD_X - 100, 0, 100, n);
  check(n.z > 0.1 && Math.abs(n.x) > 0.1, "junção piso/parede é uma curva", `n=(${n.x.toFixed(2)},${n.z.toFixed(2)})`);
  check(Math.abs(Math.hypot(n.x, n.y, n.z) - 1) < 1e-6, "normal é unitária");
}

// ==================================================================
section("Baliza");
{
  // dentro da boca não há parede de fundo em FIELD_Y
  const d = arenaDistance(0, K.FIELD_Y + 200, 100, n);
  check(d > 0, "interior da baliza é espaço livre", `d=${d.toFixed(0)}`);
  check(ballInGoal({ x: 0, y: K.FIELD_Y + 200, z: 100 }, K.BALL_RADIUS) === 1, "gol detectado em +Y");
  check(ballInGoal({ x: 0, y: -K.FIELD_Y - 200, z: 100 }, K.BALL_RADIUS) === -1, "gol detectado em -Y");
  check(ballInGoal({ x: 1500, y: K.FIELD_Y + 200, z: 100 }, K.BALL_RADIUS) === 0, "fora da boca não é gol");
  check(ballInGoal({ x: 0, y: K.FIELD_Y + 200, z: 900 }, K.BALL_RADIUS) === 0, "acima do travessão não é gol");
}
{
  // bola rolando para o gol não pode bater em parede invisível
  const w = createWorld({ botCount: 0, matchTime: 1e6 });
  w.phase = "play";
  set(w.ball.pos, -150, 4000, K.BALL_RADIUS);
  set(w.ball.vel, 0, 2500, 0);
  let scored = false;
  for (let i = 0; i < 120 * 2; i++) {
    stepWorld(w, K.TICK_DT);
    if (w.score[0] > 0) { scored = true; break; }
  }
  check(scored, "bola entra no gol sem obstrução");
}

// ==================================================================
section("Contenção (nada escapa da arena curva)");
{
  const w = createWorld({ botCount: 0, matchTime: 1e6, freePlay: true });
  w.phase = "play";
  let escaped = null;
  for (let k = 0; k < 40; k++) {
    set(w.ball.pos, (Math.random() * 2 - 1) * 3000, (Math.random() * 2 - 1) * 4000, 100 + Math.random() * 1500);
    set(w.ball.vel, (Math.random() * 2 - 1) * 5500, (Math.random() * 2 - 1) * 5500, (Math.random() * 2 - 1) * 3000);
    for (let i = 0; i < 120 * 3; i++) {
      stepWorld(w, K.TICK_DT);
      const p = w.ball.pos;
      const inGoalBox = Math.abs(p.x) < K.GOAL_HALF_W + 60 && p.z < K.GOAL_H + 60;
      const maxY = inGoalBox ? K.FIELD_Y + K.GOAL_DEPTH + 120 : K.FIELD_Y + 120;
      if (Math.abs(p.x) > K.FIELD_X + 120 || Math.abs(p.y) > maxY || p.z > K.CEILING_Z + 120 || p.z < -120) {
        escaped = `(${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)})`;
        break;
      }
      // o canto curvo também precisa conter
      const cx = K.FIELD_X - K.CORNER_RADIUS, cy = K.FIELD_Y - K.CORNER_RADIUS;
      if (Math.abs(p.x) > cx && Math.abs(p.y) > cy && !inGoalBox) {
        const r = Math.hypot(Math.abs(p.x) - cx, Math.abs(p.y) - cy);
        if (r > K.CORNER_RADIUS + 120) { escaped = `canto r=${r.toFixed(0)}`; break; }
      }
    }
    if (escaped) break;
  }
  check(!escaped, "40 lançamentos aleatórios: bola sempre contida", escaped || "");
}
{
  // carro em alta velocidade contra o canto
  const w = createWorld({ botCount: 0, matchTime: 1e6, freePlay: true });
  w.phase = "play";
  const c = w.cars[0];
  set(c.pos, 2500, 3500, K.REST_HEIGHT);
  set(c.vel, 0, 0, 0);
  const yaw = Math.PI / 4;
  c.rot = { x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) };
  c.boost = 100;
  let ok = true;
  for (let i = 0; i < 120 * 4; i++) {
    const inp = c.input;
    inp.throttle = 1; inp.boost = c.boost > 0; inp.steer = 0;
    inp.jump = false; inp.pitch = 0; inp.yaw = 0; inp.roll = 0; inp.handbrake = false;
    stepWorld(w, K.TICK_DT);
    w.events.length = 0;
    if (!Number.isFinite(c.pos.x + c.pos.y + c.pos.z)) { ok = false; break; }
    const cx = K.FIELD_X - K.CORNER_RADIUS, cy = K.FIELD_Y - K.CORNER_RADIUS;
    if (Math.abs(c.pos.x) > cx && Math.abs(c.pos.y) > cy) {
      const r = Math.hypot(Math.abs(c.pos.x) - cx, Math.abs(c.pos.y) - cy);
      if (r > K.CORNER_RADIUS + 150) { ok = false; break; }
    }
  }
  check(ok, "carro em alta velocidade não atravessa o canto curvo");
}
{
  // dirigir na parede continua funcionando (o fillet é o que permite subir)
  const w = createWorld({ botCount: 0, matchTime: 1e6, freePlay: true });
  w.phase = "play";
  const c = w.cars[0];
  set(c.pos, 0, 0, K.REST_HEIGHT);
  set(c.vel, 0, 0, 0);
  c.rot = { x: 0, y: 0, z: 0, w: 1 }; // nariz para +X (parede lateral)
  c.boost = 100;
  let maxZ = 0;
  for (let i = 0; i < 120 * 5; i++) {
    const inp = c.input;
    inp.throttle = 1; inp.boost = c.boost > 0; inp.steer = 0;
    inp.jump = false; inp.pitch = 0; inp.yaw = 0; inp.roll = 0; inp.handbrake = false;
    stepWorld(w, K.TICK_DT);
    w.events.length = 0;
    maxZ = Math.max(maxZ, c.pos.z);
  }
  check(maxZ > 300, "carro sobe na parede lateral", `altura ${maxZ.toFixed(0)} uu`);
}

console.log(`\n\x1b[1m${pass} passaram, ${fail} falharam\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
