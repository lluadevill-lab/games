/**
 * Testes headless da simulação (sem DOM, sem Three.js).
 * Rode com: npm test
 *
 * Valida os números que definem a "sensação" do jogo: velocidade máxima,
 * tempo de boost, altura de pulo, quique da bola, gol, boost pads, etc.
 */
import { createWorld, stepWorld, resetKickoff } from "../src/sim/world.ts";
import { driveBot, resetBots } from "../src/sim/bot.ts";
import { predictBall } from "../src/sim/predict.ts";
import * as K from "../src/sim/constants.ts";
import { arenaDistance } from "../src/sim/arena.ts";
import { set, len } from "../src/core/vec.ts";

let pass = 0;
let fail = 0;

function check(cond, name, detail = "") {
  if (cond) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}${detail ? ` \x1b[90m(${detail})\x1b[0m` : ""}`);
  } else {
    fail++;
    console.log(`  \x1b[31m✗ ${name}\x1b[0m ${detail}`);
  }
}

function near(a, b, tol, name) {
  check(Math.abs(a - b) <= tol, name, `${a.toFixed(1)} ~ ${b} ±${tol}`);
}

function section(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

/** Mundo de teste: sem bots, sem relógio. */
function freshWorld() {
  const w = createWorld({ botCount: 0, matchTime: 99999, freePlay: true });
  w.phase = "play";
  return w;
}

/**
 * Pista de teste: carro no fundo do campo apontando para +Y, bola guardada
 * longe e boost pads desativados — assim medimos só o que queremos.
 */
function testTrack(boost = 0) {
  const w = freshWorld();
  const c = w.cars[0];
  set(c.pos, 0, -4600, K.REST_HEIGHT);
  set(c.vel, 0, 0, 0);
  set(c.ang, 0, 0, 0);
  const yaw = Math.PI / 2; // aponta para +Y
  c.rot = { x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) };
  c.boost = boost;
  w.pads.forEach((p) => {
    p.active = false;
    p.timer = 1e9;
  });
  set(w.ball.pos, 3800, 4800, 91.25);
  set(w.ball.vel, 0, 0, 0);
  return w;
}

function run(w, seconds, inputFn) {
  const steps = Math.round(seconds / K.TICK_DT);
  for (let i = 0; i < steps; i++) {
    if (inputFn) inputFn(w.cars[0].input, i * K.TICK_DT, w);
    stepWorld(w, K.TICK_DT);
  }
}

const idle = (i) => {
  i.throttle = 0;
  i.steer = 0;
  i.pitch = 0;
  i.yaw = 0;
  i.roll = 0;
  i.jump = false;
  i.boost = false;
  i.handbrake = false;
};

// ==================================================================
section("Arena (SDF)");
{
  check(arenaDistance(0, 0, 100) === 100, "centro do campo: distância = altura");
  check(Math.abs(arenaDistance(0, 0, K.CEILING_Z - 50) - 50) < 1, "teto a 2044");
  const n = { x: 0, y: 0, z: 0 };
  arenaDistance(K.FIELD_X - 100, 0, 1000, n);
  check(n.x === -1, "normal da parede lateral aponta para dentro");
  check(arenaDistance(0, 0, -10) < 0, "abaixo do chão = fora da arena");
  // canto diagonal
  const dCorner = arenaDistance(3900, 4100, 1000);
  check(dCorner < 200 && dCorner > 0, "chanfro de 45° nos cantos", `d=${dCorner.toFixed(0)}`);
}

// ==================================================================
section("Carro — velocidade e boost");
{
  const w = testTrack();
  let peak = 0;
  const steps = Math.round(5 / K.TICK_DT);
  for (let i = 0; i < steps; i++) {
    const inp = w.cars[0].input;
    idle(inp);
    inp.throttle = 1;
    stepWorld(w, K.TICK_DT);
    peak = Math.max(peak, len(w.cars[0].vel));
  }
  near(peak, K.DRIVE_MAX_SPEED, 60, "velocidade máxima sem boost ≈ 1410");
}
{
  const w = testTrack(100);
  let peak = 0;
  let wentSupersonic = false;
  const steps = Math.round(4 / K.TICK_DT);
  for (let i = 0; i < steps; i++) {
    const inp = w.cars[0].input;
    idle(inp);
    inp.throttle = 1;
    inp.boost = true;
    stepWorld(w, K.TICK_DT);
    peak = Math.max(peak, len(w.cars[0].vel));
    if (w.cars[0].supersonic) wentSupersonic = true;
  }
  near(peak, K.CAR_MAX_SPEED, 80, "velocidade máxima com boost ≈ 2300");
  check(wentSupersonic, "fica supersônico acima de 2200");
  near(w.cars[0].boost, 0, 1, "tanque esvazia");
}
{
  const w = testTrack(100);
  let t = 0;
  const steps = Math.round(4 / K.TICK_DT);
  for (let i = 0; i < steps; i++) {
    const inp = w.cars[0].input;
    idle(inp);
    inp.boost = true;
    if (w.cars[0].boost > 0) t += K.TICK_DT;
    stepWorld(w, K.TICK_DT);
  }
  near(t, 3.0, 0.12, "100 de boost dura ~3 s (33.3/s)");
}
{
  const w = testTrack();
  run(w, 3, (i) => {
    idle(i);
    i.throttle = 1;
  });
  const v0 = len(w.cars[0].vel);
  run(w, 0.35, (i) => {
    idle(i);
    i.throttle = -1;
  });
  const v1 = len(w.cars[0].vel);
  check(v1 < v0 * 0.35, "freio desacelera forte (3500 uu/s²)", `${v0.toFixed(0)} → ${v1.toFixed(0)}`);
}

// ==================================================================
section("Carro — pulo e flip");
function jumpPeak(pattern, dur = 2.2) {
  const w = testTrack();
  let maxZ = 0;
  const steps = Math.round(dur / K.TICK_DT);
  for (let i = 0; i < steps; i++) {
    const t = i * K.TICK_DT;
    const inp = w.cars[0].input;
    idle(inp);
    pattern(inp, t);
    stepWorld(w, K.TICK_DT);
    maxZ = Math.max(maxZ, w.cars[0].pos.z);
  }
  return maxZ - K.REST_HEIGHT;
}
{
  // Pulo curto no RL: impulso de 291.67 uu/s → h = v²/(2g) ≈ 65 uu
  const h = jumpPeak((i, t) => {
    i.jump = t < 0.02;
  });
  const theoretical = (K.JUMP_IMPULSE * K.JUMP_IMPULSE) / (2 * K.GRAVITY);
  near(h, theoretical, 18, "pulo curto ≈ v²/2g (~65 uu)");
}
{
  const short = jumpPeak((i, t) => {
    i.jump = t < 0.02;
  });
  const long = jumpPeak((i, t) => {
    i.jump = t < 0.25;
  });
  check(long > short * 1.5, "segurar o pulo sobe bem mais", `${short.toFixed(0)} → ${long.toFixed(0)} uu`);
}
{
  const single = jumpPeak((i, t) => {
    i.jump = t < 0.2;
  });
  const dbl = jumpPeak((i, t) => {
    i.jump = t < 0.2 || (t > 0.35 && t < 0.42);
  });
  check(dbl > single * 1.4, "double jump sobe bem mais que um pulo só", `${single.toFixed(0)} → ${dbl.toFixed(0)} uu`);
  check(dbl > 200, "double jump passa de 200 uu", `${dbl.toFixed(0)}`);
}
{
  // front flip acelera
  const w = testTrack();
  run(w, 2.5, (i) => {
    idle(i);
    i.throttle = 1;
  });
  const before = len(w.cars[0].vel);
  const steps = Math.round(0.5 / K.TICK_DT);
  let peak = before;
  for (let i = 0; i < steps; i++) {
    const t = i * K.TICK_DT;
    const inp = w.cars[0].input;
    idle(inp);
    inp.throttle = 1;
    inp.jump = t < 0.02 || (t > 0.1 && t < 0.13);
    inp.pitch = t > 0.08 ? -1 : 0;
    stepWorld(w, K.TICK_DT);
    peak = Math.max(peak, len(w.cars[0].vel));
  }
  check(peak > before + 100, "front flip ganha velocidade", `${before.toFixed(0)} → ${peak.toFixed(0)}`);
}
{
  // flip consome o flip disponível
  const w = testTrack();
  const steps = Math.round(0.4 / K.TICK_DT);
  for (let i = 0; i < steps; i++) {
    const t = i * K.TICK_DT;
    const inp = w.cars[0].input;
    idle(inp);
    inp.jump = t < 0.02 || (t > 0.1 && t < 0.13);
    inp.pitch = t > 0.08 ? -1 : 0;
    stepWorld(w, K.TICK_DT);
  }
  check(!w.cars[0].hasFlip, "após flipar fica sem flip até pousar");
}

// ==================================================================
section("Carro — controle aéreo");
{
  const w = freshWorld();
  w.cars[0].pos.z = 1200;
  w.cars[0].onGround = false;
  const before = { ...w.cars[0].rot };
  run(w, 0.5, (i) => {
    idle(i);
    i.roll = 1;
  });
  const rolled = Math.abs(w.cars[0].rot.x - before.x) > 0.1;
  check(rolled, "air roll gira o carro");
  const angRoll = len(w.cars[0].ang);
  check(angRoll <= K.MAX_ANG_SPEED + 0.01, "velocidade angular limitada a 5.5 rad/s", angRoll.toFixed(2));
}
{
  // roll é mais rápido que yaw (38.34 vs 9.11)
  const a = freshWorld();
  a.cars[0].pos.z = 1200;
  a.cars[0].onGround = false;
  run(a, 0.25, (i) => {
    idle(i);
    i.roll = 1;
  });
  const b = freshWorld();
  b.cars[0].pos.z = 1200;
  b.cars[0].onGround = false;
  run(b, 0.25, (i) => {
    idle(i);
    i.yaw = 1;
  });
  check(len(a.cars[0].ang) > len(b.cars[0].ang) * 2, "roll acelera bem mais que yaw");
}
{
  // gravidade: queda livre
  const w = freshWorld();
  w.cars[0].pos.z = 1500;
  w.cars[0].onGround = false;
  run(w, 1, idle);
  near(-w.cars[0].vel.z, K.GRAVITY, 20, "queda livre: 650 uu/s após 1 s");
}

// ==================================================================
section("Bola");
{
  const w = freshWorld();
  set(w.ball.pos, 0, 0, 1000);
  set(w.ball.vel, 0, 0, 0);
  run(w, 1, idle);
  near(-w.ball.vel.z, K.GRAVITY, 25, "bola cai a 650 uu/s²");
}
{
  const w = freshWorld();
  set(w.ball.pos, 0, 0, 1000);
  set(w.ball.vel, 0, 0, -1000);
  let bounced = 0;
  let vAfter = 0;
  const steps = Math.round(1.2 / K.TICK_DT);
  for (let i = 0; i < steps; i++) {
    const before = w.ball.vel.z;
    stepWorld(w, K.TICK_DT);
    if (before < 0 && w.ball.vel.z > 0 && bounced === 0) {
      bounced = 1;
      vAfter = w.ball.vel.z;
      var vBefore = -before;
    }
  }
  check(bounced === 1, "bola quica no chão");
  if (bounced) near(vAfter / vBefore, K.BALL_RESTITUTION, 0.08, "restituição ≈ 0.6");
}
{
  const w = freshWorld();
  set(w.ball.pos, 0, 0, 500);
  set(w.ball.vel, 6000, 0, 0);
  run(w, 0.5, idle);
  check(len(w.ball.vel) <= K.BALL_MAX_SPEED + 1, "velocidade da bola limitada a 6000");
}
{
  // arrasto reduz a velocidade horizontal ~3%/s, sem quicar
  const w = freshWorld();
  set(w.ball.pos, 0, 0, 1900);
  set(w.ball.vel, 3000, 0, 0);
  run(w, 1, idle);
  const vx = w.ball.vel.x;
  const expected = 3000 * (1 - K.BALL_DRAG);
  near(vx, expected, 20, "arrasto linear tira ~3% da velocidade por segundo");
}
{
  // a bola nunca escapa da arena
  const w = freshWorld();
  set(w.ball.pos, 0, 0, 500);
  let escaped = false;
  for (let k = 0; k < 12; k++) {
    set(w.ball.vel, (Math.random() * 2 - 1) * 5000, (Math.random() * 2 - 1) * 5000, (Math.random() * 2 - 1) * 3000);
    run(w, 2, idle);
    const p = w.ball.pos;
    const outside =
      Math.abs(p.x) > K.FIELD_X + 60 ||
      Math.abs(p.y) > K.FIELD_Y + K.GOAL_DEPTH + 100 ||
      p.z > K.CEILING_Z + 60 ||
      p.z < -60;
    if (outside) escaped = true;
  }
  check(!escaped, "bola nunca atravessa a arena (12 lançamentos aleatórios)");
}

// ==================================================================
section("Carro × bola");
{
  const w = freshWorld();
  set(w.cars[0].pos, 0, -400, K.REST_HEIGHT);
  set(w.ball.pos, 0, 0, K.BALL_RADIUS);
  set(w.ball.vel, 0, 0, 0);
  // aponta para +Y
  const c = w.cars[0];
  const yaw = Math.PI / 2;
  c.rot = { x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) };
  c.boost = 100;
  run(w, 1.6, (i) => {
    idle(i);
    i.throttle = 1;
    i.boost = true;
  });
  check(w.ball.vel.y > 900, "chute forte manda a bola para frente", `${w.ball.vel.y.toFixed(0)} uu/s`);
}
{
  // toque lateral joga a bola para o lado (impulso Psyonix)
  const w = freshWorld();
  set(w.cars[0].pos, -300, -90, K.REST_HEIGHT);
  set(w.ball.pos, 0, 0, K.BALL_RADIUS);
  set(w.ball.vel, 0, 0, 0);
  w.cars[0].rot = { x: 0, y: 0, z: 0, w: 1 }; // aponta para +X
  run(w, 1.5, (i) => {
    idle(i);
    i.throttle = 1;
  });
  check(w.ball.vel.x > 200, "acerto descentrado ainda empurra a bola", `vx=${w.ball.vel.x.toFixed(0)}`);
  check(Math.abs(w.ball.vel.y) > 20, "acerto descentrado desvia lateralmente", `vy=${w.ball.vel.y.toFixed(0)}`);
}
{
  // carro não atravessa a bola
  const w = freshWorld();
  set(w.cars[0].pos, 0, -700, K.REST_HEIGHT);
  set(w.ball.pos, 0, 0, K.BALL_RADIUS);
  const yaw = Math.PI / 2;
  w.cars[0].rot = { x: 0, y: 0, z: Math.sin(yaw / 2), w: Math.cos(yaw / 2) };
  w.cars[0].boost = 100;
  let overlapped = false;
  const steps = Math.round(2 / K.TICK_DT);
  for (let i = 0; i < steps; i++) {
    const inp = w.cars[0].input;
    idle(inp);
    inp.throttle = 1;
    inp.boost = true;
    stepWorld(w, K.TICK_DT);
    const d = Math.hypot(
      w.ball.pos.x - w.cars[0].pos.x,
      w.ball.pos.y - w.cars[0].pos.y,
      w.ball.pos.z - w.cars[0].pos.z,
    );
    if (d < 40) overlapped = true;
  }
  check(!overlapped, "carro nunca fica dentro da bola");
}

// ==================================================================
section("Regras da partida");
{
  const w = createWorld({ botCount: 1, matchTime: 300 });
  w.phase = "play";
  set(w.ball.pos, 0, K.FIELD_Y - 200, 200);
  set(w.ball.vel, 0, 3000, 0);
  run(w, 0.6, idle);
  check(w.score[0] === 1, "gol na baliza +Y conta para o time azul", `${w.score[0]}×${w.score[1]}`);
  check(w.phase === "goal", "entra em estado de comemoração");
}
{
  const w = createWorld({ botCount: 1, matchTime: 300 });
  w.phase = "play";
  set(w.ball.pos, 0, -(K.FIELD_Y - 200), 200);
  set(w.ball.vel, 0, -3000, 0);
  run(w, 0.6, idle);
  check(w.score[1] === 1, "gol na baliza -Y conta para o laranja");
}
{
  // bola na trave lateral não é gol
  const w = createWorld({ botCount: 0, matchTime: 300 });
  w.phase = "play";
  set(w.ball.pos, K.GOAL_HALF_W + 400, K.FIELD_Y - 300, 200);
  set(w.ball.vel, 0, 4000, 0);
  run(w, 1, idle);
  check(w.score[0] === 0, "bola fora da boca não é gol");
}
{
  // kickoff coloca a bola no centro
  const w = createWorld({ botCount: 1, matchTime: 300 });
  resetKickoff(w, true);
  check(Math.abs(w.ball.pos.x) < 1 && Math.abs(w.ball.pos.y) < 1, "kickoff centraliza a bola");
  check(w.phase === "kickoff" && w.phaseTimer > 2.9, "contagem regressiva de 3 s");
  const dists = w.cars.map((c) => Math.hypot(c.pos.x, c.pos.y));
  check(dists.every((d) => d > 2500), "carros começam longe da bola");
  check(w.cars[0].boost === K.BOOST_START, "kickoff dá 33 de boost");
}
{
  // carros congelados durante o kickoff
  const w = createWorld({ botCount: 1, matchTime: 300 });
  const p0 = { ...w.cars[0].pos };
  run(w, 1, (i) => {
    idle(i);
    i.throttle = 1;
    i.boost = true;
  });
  const moved = Math.hypot(w.cars[0].pos.x - p0.x, w.cars[0].pos.y - p0.y);
  check(moved < 1, "carros travados até o apito");
}

// ==================================================================
section("Boost pads");
{
  const w = freshWorld();
  w.cars[0].boost = 0;
  set(w.cars[0].pos, 3584, 0, K.REST_HEIGHT); // pad grande
  run(w, 0.1, idle);
  check(w.cars[0].boost === 100, "pad grande enche o tanque", `${w.cars[0].boost}`);
  check(!w.pads.every((p) => p.active), "pad coletado desaparece");
}
{
  const w = freshWorld();
  w.cars[0].boost = 0;
  set(w.cars[0].pos, 0, -1024, K.REST_HEIGHT); // pad pequeno
  run(w, 0.1, idle);
  near(w.cars[0].boost, 12, 0.1, "pad pequeno dá 12");
}
{
  const w = freshWorld();
  w.cars[0].boost = 0;
  set(w.cars[0].pos, 3584, 0, K.REST_HEIGHT);
  run(w, 0.1, idle);
  set(w.cars[0].pos, 0, 0, K.REST_HEIGHT);
  w.cars[0].boost = 0;
  run(w, 9.5, idle);
  set(w.cars[0].pos, 3584, 0, K.REST_HEIGHT);
  run(w, 0.05, idle);
  check(w.cars[0].boost === 0, "pad grande ainda em respawn aos 9.6 s");
  set(w.cars[0].pos, 0, 0, K.REST_HEIGHT);
  run(w, 0.8, idle);
  set(w.cars[0].pos, 3584, 0, K.REST_HEIGHT);
  run(w, 0.05, idle);
  check(w.cars[0].boost === 100, "pad grande volta após 10 s");
}
{
  check(
    (() => {
      const w = freshWorld();
      return w.pads.length === 34;
    })(),
    "34 boost pads no mapa",
  );
}

// ==================================================================
section("Demolição");
{
  const w = createWorld({ botCount: 1, matchTime: 300 });
  w.phase = "play";
  const a = w.cars[0];
  const b = w.cars[1];
  set(a.pos, 0, -300, K.REST_HEIGHT);
  set(b.pos, 0, 0, K.REST_HEIGHT);
  set(a.vel, 0, 2400, 0);
  a.supersonic = true;
  b.input.throttle = 0;
  run(w, 0.3, (i) => {
    idle(i);
  });
  check(b.demoTimer > 0 || b.pos.y > 100, "supersônico demole ou empurra o adversário");
}

// ==================================================================
section("Predição da bola");
{
  const w = freshWorld();
  set(w.ball.pos, 0, 0, 1400);
  set(w.ball.vel, 500, 300, 0);
  const pred = predictBall(w.ball, 60, 1 / 30);
  // simula de verdade e compara
  run(w, 1.0, idle);
  const target = pred[Math.round(1.0 * 30) - 1];
  const err = Math.hypot(
    target.pos.x - w.ball.pos.x,
    target.pos.y - w.ball.pos.y,
    target.pos.z - w.ball.pos.z,
  );
  check(err < 40, "predição bate com a simulação em 1 s", `erro ${err.toFixed(1)} uu`);
}

// ==================================================================
section("Bot");
{
  resetBots();
  const w = createWorld({ botCount: 1, matchTime: 60, seed: 4242 });
  const steps = Math.round(30 / K.TICK_DT);
  let botMoved = 0;
  let ballTouched = false;
  const start = { ...w.cars[1].pos };
  for (let i = 0; i < steps; i++) {
    idle(w.cars[0].input);
    driveBot(w.cars[1], w, K.TICK_DT, "dificil");
    stepWorld(w, K.TICK_DT);
    for (const ev of w.events) if (ev.type === "ballHit" && ev.carId === 1) ballTouched = true;
    w.events.length = 0;
  }
  botMoved = Math.hypot(w.cars[1].pos.x - start.x, w.cars[1].pos.y - start.y);
  check(botMoved > 500, "bot se movimenta", `${botMoved.toFixed(0)} uu`);
  check(ballTouched, "bot alcança e toca a bola em 30 s");
  check(w.score[1] >= 1, "bot difícil faz gol sozinho em 30 s", `placar ${w.score[0]}×${w.score[1]}`);
  const inArena = w.cars.every(
    (c) =>
      Math.abs(c.pos.x) < K.FIELD_X + 200 &&
      Math.abs(c.pos.y) < K.FIELD_Y + K.GOAL_DEPTH + 200 &&
      c.pos.z > -50 &&
      c.pos.z < K.CEILING_Z + 100,
  );
  check(inArena, "nenhum carro escapou da arena");
}

// ==================================================================
section("Estabilidade");
{
  // 60 s de jogo completo sem NaN
  resetBots();
  const w = createWorld({ botCount: 1, matchTime: 60 });
  const steps = Math.round(60 / K.TICK_DT);
  let nan = false;
  for (let i = 0; i < steps; i++) {
    const inp = w.cars[0].input;
    // input pseudoaleatório
    inp.throttle = Math.sin(i * 0.01) > 0 ? 1 : -0.4;
    inp.steer = Math.sin(i * 0.017);
    inp.pitch = Math.cos(i * 0.013);
    inp.yaw = Math.sin(i * 0.021);
    inp.roll = 0;
    inp.jump = i % 97 < 3;
    inp.boost = i % 53 < 20;
    inp.handbrake = i % 211 < 40;
    driveBot(w.cars[1], w, K.TICK_DT, "medio");
    stepWorld(w, K.TICK_DT);
    w.events.length = 0;
    for (const c of w.cars) {
      if (!Number.isFinite(c.pos.x + c.pos.y + c.pos.z + c.vel.x + c.rot.w)) nan = true;
    }
    if (!Number.isFinite(w.ball.pos.x + w.ball.vel.z)) nan = true;
  }
  check(!nan, "60 s de simulação caótica sem NaN");
  // gols e kickoffs pausam o relógio, então 60 s reais consomem menos tempo
  check(w.clock < 60, "relógio corre durante a partida", `restam ${w.clock.toFixed(1)}s`);
  // Regra do RL: o tempo só acaba quando a bola toca o chão. Se ela estiver
  // no ar, a partida continua — então "over" pode ainda não ter chegado.
  check(
    w.phase === "over" || w.phase === "play" || w.phase === "kickoff" || w.phase === "goal",
    "estado de partida válido no fim do tempo",
    w.phase,
  );
}
{
  // fim de tempo: com a bola parada no chão a partida encerra
  const w = createWorld({ botCount: 0, matchTime: 1 });
  w.phase = "play";
  w.score[0] = 1;
  set(w.ball.pos, 0, 0, K.BALL_RADIUS);
  set(w.ball.vel, 0, 0, 0);
  run(w, 2.5, idle);
  check(w.phase === "over", "acaba o jogo quando o tempo zera com a bola no chão", w.phase);
}
{
  // empate no fim do tempo → prorrogação
  const w = createWorld({ botCount: 0, matchTime: 1 });
  w.phase = "play";
  set(w.ball.pos, 0, 0, K.BALL_RADIUS);
  set(w.ball.vel, 0, 0, 0);
  run(w, 2.5, idle);
  check(w.overtime, "empate leva a prorrogação (morte súbita)");
  check(w.phase !== "over", "prorrogação não encerra a partida");
}
{
  // desempenho: quantos ticks por segundo o motor aguenta
  resetBots();
  const w = createWorld({ botCount: 1, matchTime: 999 });
  const N = 20000;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    driveBot(w.cars[1], w, K.TICK_DT, "medio");
    stepWorld(w, K.TICK_DT);
    w.events.length = 0;
  }
  const ms = performance.now() - t0;
  const ticksPerSec = (N / ms) * 1000;
  check(
    ticksPerSec > 120 * 30,
    "motor roda pelo menos 30× mais rápido que tempo real",
    `${Math.round(ticksPerSec).toLocaleString()} ticks/s`,
  );
}

// ==================================================================
section("Determinismo");
{
  // A mesma semente tem de produzir exatamente a mesma partida. É o que
  // permite replays e netcode — e o que torna estes testes confiáveis.
  const play = (seed) => {
    resetBots();
    const w = createWorld({ botCount: 1, matchTime: 999, seed });
    for (let i = 0; i < 120 * 20; i++) {
      const inp = w.cars[0].input;
      inp.throttle = Math.sin(i * 0.011);
      inp.steer = Math.cos(i * 0.019);
      inp.jump = i % 89 < 2;
      inp.boost = i % 47 < 15;
      inp.pitch = 0; inp.yaw = 0; inp.roll = 0; inp.handbrake = false;
      driveBot(w.cars[1], w, K.TICK_DT, "dificil");
      stepWorld(w, K.TICK_DT);
      w.events.length = 0;
    }
    const b = w.ball.pos;
    const c = w.cars[1].pos;
    return `${b.x.toFixed(6)},${b.y.toFixed(6)},${b.z.toFixed(6)}|${c.x.toFixed(6)},${c.y.toFixed(6)}|${w.score.join("-")}`;
  };
  const a1 = play(12345);
  const a2 = play(12345);
  const b1 = play(999);
  check(a1 === a2, "mesma semente = partida idêntica");
  check(a1 !== b1, "sementes diferentes = partidas diferentes");
}
{
  // o bot marca de forma consistente em várias sementes
  let goals = 0;
  const N = 6;
  for (let k = 0; k < N; k++) {
    resetBots();
    const w = createWorld({ botCount: 1, matchTime: 999, seed: 1000 + k * 7919 });
    for (let i = 0; i < 120 * 30; i++) {
      const inp = w.cars[0].input;
      inp.throttle = 0; inp.steer = 0; inp.jump = false; inp.boost = false;
      inp.pitch = 0; inp.yaw = 0; inp.roll = 0; inp.handbrake = false;
      driveBot(w.cars[1], w, K.TICK_DT, "dificil");
      stepWorld(w, K.TICK_DT);
      w.events.length = 0;
    }
    if (w.score[1] > 0) goals++;
  }
  check(goals >= N / 2, `bot difícil marca na maioria das sementes (${goals}/${N})`);
}

console.log(
  `\n\x1b[1m${pass} passaram, ${fail} falharam\x1b[0m\n`,
);
process.exit(fail > 0 ? 1 : 0);
