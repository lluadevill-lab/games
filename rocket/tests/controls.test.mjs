/**
 * Testes de CONVENÇÃO DE EIXOS E CONTROLES.
 *
 * Sistema destro, X = frente, Z = cima  =>  +Y aponta para a ESQUERDA.
 * A direita verdadeira do carro é -Y. Estes testes fixam o significado de
 * cada entrada para que nunca mais inverta silenciosamente.
 *
 * Convenções fixadas aqui:
 *   steer = +1  -> vira para a DIREITA
 *   yaw   = +1  -> nariz para a DIREITA
 *   pitch = +1  -> nariz para CIMA
 *   roll  = +1  -> rola para a DIREITA (topo do carro tende à direita)
 *   tecla D -> direita   |   tecla W no ar -> nariz para BAIXO (padrão RL)
 */
import { createWorld, stepWorld } from "../src/sim/world.ts";
import * as K from "../src/sim/constants.ts";
import { set, v3, forwardOf, upOf, rightOf, leftOf } from "../src/core/vec.ts";

let pass = 0;
let fail = 0;
const check = (cond, name, detail = "") => {
  if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}${detail ? ` \x1b[90m(${detail})\x1b[0m` : ""}`); }
  else { fail++; console.log(`  \x1b[31m✗ ${name}\x1b[0m ${detail}`); }
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

const idle = (i) => {
  i.throttle = 0; i.steer = 0; i.pitch = 0; i.yaw = 0; i.roll = 0;
  i.jump = false; i.boost = false; i.handbrake = false;
};

/** Carro na origem, nariz para +X, longe da bola e sem pads. */
function rig(airborne = false) {
  const w = createWorld({ botCount: 0, matchTime: 1e6, freePlay: true });
  w.phase = "play";
  const c = w.cars[0];
  set(c.pos, 0, 0, airborne ? 900 : K.REST_HEIGHT);
  set(c.vel, 0, 0, 0);
  set(c.ang, 0, 0, 0);
  c.rot = { x: 0, y: 0, z: 0, w: 1 }; // nariz = +X, cima = +Z
  c.boost = 100;
  c.onGround = !airborne;
  w.pads.forEach((p) => { p.active = false; p.timer = 1e9; });
  set(w.ball.pos, 3900, 4900, K.BALL_RADIUS);
  set(w.ball.vel, 0, 0, 0);
  return w;
}

function run(w, secs, fn) {
  const steps = Math.round(secs / K.TICK_DT);
  for (let i = 0; i < steps; i++) {
    idle(w.cars[0].input);
    fn(w.cars[0].input, i * K.TICK_DT);
    stepWorld(w, K.TICK_DT);
    w.events.length = 0;
  }
}

const fwd = v3(), up = v3(), right = v3();

// ==================================================================
section("Base de eixos (sistema destro, X frente, Z cima)");
{
  const q = { x: 0, y: 0, z: 0, w: 1 };
  forwardOf(fwd, q); upOf(up, q); rightOf(right, q); 
  check(fwd.x === 1, "frente = +X");
  check(up.z === 1, "cima = +Z");
  check(right.y === -1, "direita = -Y (porque +Y é a esquerda num sistema destro)", `y=${right.y}`);
  const left = v3(); leftOf(left, q);
  check(left.y === 1, "esquerda = +Y");
}

// ==================================================================
section("Direção no chão");
{
  const w = rig();
  run(w, 1.2, (i) => { i.throttle = 1; i.steer = 1; });
  forwardOf(fwd, w.cars[0].rot);
  check(fwd.y < -0.15, "steer = +1 (tecla D) vira para a DIREITA", `fwd.y=${fwd.y.toFixed(2)}`);
}
{
  const w = rig();
  run(w, 1.2, (i) => { i.throttle = 1; i.steer = -1; });
  forwardOf(fwd, w.cars[0].rot);
  check(fwd.y > 0.15, "steer = -1 (tecla A) vira para a ESQUERDA", `fwd.y=${fwd.y.toFixed(2)}`);
}
{
  // o carro deve realmente SE DESLOCAR para o lado, não só girar o nariz
  const w = rig();
  run(w, 1.6, (i) => { i.throttle = 1; i.steer = 1; });
  check(w.cars[0].pos.y < -50, "virando à direita o carro se desloca para -Y", `y=${w.cars[0].pos.y.toFixed(0)}`);
}

// ==================================================================
section("Controle aéreo");
{
  const w = rig(true);
  run(w, 0.35, (i) => { i.yaw = 1; });
  forwardOf(fwd, w.cars[0].rot);
  check(fwd.y < -0.1, "yaw = +1 aponta o nariz para a DIREITA", `fwd.y=${fwd.y.toFixed(2)}`);
}
{
  const w = rig(true);
  run(w, 0.35, (i) => { i.pitch = 1; });
  forwardOf(fwd, w.cars[0].rot);
  check(fwd.z > 0.1, "pitch = +1 levanta o nariz", `fwd.z=${fwd.z.toFixed(2)}`);
}
{
  const w = rig(true);
  run(w, 0.25, (i) => { i.roll = 1; });
  upOf(up, w.cars[0].rot);
  check(up.y < -0.1, "roll = +1 rola para a DIREITA", `up.y=${up.y.toFixed(2)}`);
}

// ==================================================================
section("Mapeamento de teclas (padrão Rocket League)");
{
  // W no ar deve baixar o nariz: em controls.ts pitch = -throttle
  const w = rig(true);
  run(w, 0.35, (i) => { i.throttle = 1; i.pitch = -1; });
  forwardOf(fwd, w.cars[0].rot);
  check(fwd.z < -0.1, "W no ar baixa o nariz", `fwd.z=${fwd.z.toFixed(2)}`);
}
{
  const w = rig(true);
  run(w, 0.35, (i) => { i.throttle = -1; i.pitch = 1; });
  forwardOf(fwd, w.cars[0].rot);
  check(fwd.z > 0.1, "S no ar levanta o nariz", `fwd.z=${fwd.z.toFixed(2)}`);
}
{
  // D + powerslide no ar = air roll para a direita
  const w = rig(true);
  run(w, 0.25, (i) => { i.handbrake = true; i.steer = 1; i.roll = 1; });
  upOf(up, w.cars[0].rot);
  check(up.y < -0.1, "D + air roll rola para a DIREITA", `up.y=${up.y.toFixed(2)}`);
}

// ==================================================================
section("Flips");
{
  // front flip: nariz mergulha e o carro ganha velocidade para frente
  const w = rig();
  run(w, 2.2, (i) => { i.throttle = 1; });
  const v0 = Math.hypot(w.cars[0].vel.x, w.cars[0].vel.y);
  let dipped = false;
  const steps = Math.round(0.45 / K.TICK_DT);
  for (let i = 0; i < steps; i++) {
    const t = i * K.TICK_DT;
    const inp = w.cars[0].input;
    idle(inp);
    inp.throttle = 1;
    inp.jump = t < 0.02 || (t > 0.1 && t < 0.13);
    inp.pitch = t > 0.08 ? -1 : 0; // W = nariz para baixo = front flip
    stepWorld(w, K.TICK_DT);
    w.events.length = 0;
    forwardOf(fwd, w.cars[0].rot);
    if (fwd.z < -0.3) dipped = true;
  }
  check(dipped, "front flip mergulha o nariz (rotação para frente)");
  check(w.cars[0].vel.x > v0, "front flip ganha velocidade para frente", `${v0.toFixed(0)} → ${w.cars[0].vel.x.toFixed(0)}`);
}
{
  // dodge para a direita deve empurrar o carro para -Y
  const w = rig();
  run(w, 1.5, (i) => { i.throttle = 1; });
  const y0 = w.cars[0].vel.y;
  const steps = Math.round(0.3 / K.TICK_DT);
  for (let i = 0; i < steps; i++) {
    const t = i * K.TICK_DT;
    const inp = w.cars[0].input;
    idle(inp);
    inp.throttle = 1;
    inp.jump = t < 0.02 || (t > 0.1 && t < 0.13);
    inp.yaw = t > 0.08 ? 1 : 0; // dodge para a direita
    stepWorld(w, K.TICK_DT);
    w.events.length = 0;
  }
  check(w.cars[0].vel.y < y0 - 100, "dodge com yaw=+1 empurra para a DIREITA", `vy=${w.cars[0].vel.y.toFixed(0)}`);
}

console.log(`\n\x1b[1m${pass} passaram, ${fail} falharam\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
