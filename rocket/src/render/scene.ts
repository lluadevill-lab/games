/**
 * Renderer: só lê o estado da simulação. Trocar isso por gráficos pesados
 * não muda nada no gameplay (é essa separação que o RL também tem).
 */
import * as THREE from "three";
import * as K from "../sim/constants";
import { buildArena, type ArenaVisuals } from "./arenaMesh";
import { buildCar, type CarVisual } from "./carMesh";
import { PADS } from "../sim/boostPads";
import type { World } from "../sim/types";
import { damp } from "../core/mathx";

export interface Quality {
  shadows: boolean;
  trails: boolean;
  pixelRatio: number;
}

export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  private arena!: ArenaVisuals;
  private cars: CarVisual[] = [];
  private ball!: THREE.Mesh;
  private ballShadow!: THREE.Mesh;
  private carShadows: THREE.Mesh[] = [];
  private predLine!: THREE.Line;
  private predPositions!: Float32Array;
  private goalExplosion!: THREE.Points;
  private explosionVel!: Float32Array;
  private explosionLife = 0;
  private shakeTime = 0;
  private shakeMag = 0;

  // estado da câmera (suavizado)
  private camPos = new THREE.Vector3(0, -3000, 800);
  private camLook = new THREE.Vector3();
  private camVel = new THREE.Vector3();
  private camFov = 110;
  ballCam = true;

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality.pixelRatio > 1.2,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatio));
    this.renderer.setClearColor(0x070b12, 1);

    this.scene.fog = new THREE.Fog(0x070b12, 6500, 19000);
    // FOV 110° = padrão do Rocket League. near baixo evita que o carro
    // desapareça perto da câmera em aéreos/front-flips; far longe evita
    // clipping do teto.
    this.camera = new THREE.PerspectiveCamera(110, 1, 5, 32000);
    this.camera.up.set(0, 0, 1);

    this.buildLights();
    this.arena = buildArena(this.scene);
    this.buildBall();
    this.buildPrediction();
    this.buildExplosion();
    this.resize();
  }

  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight(0x9ec4ff, 0x0d1219, 1.25));
    const dir = new THREE.DirectionalLight(0xffffff, 0.75);
    dir.position.set(0.4, -0.6, 1);
    this.scene.add(dir);
  }

  private buildBall(): void {
    // icosaedro: cara de bola de futebol facetada, super barato
    const geo = new THREE.IcosahedronGeometry(K.BALL_RADIUS, 1);
    this.ball = new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({ color: 0xf2f5f8, flatShading: true }),
    );
    this.scene.add(this.ball);

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x2a3240, transparent: true, opacity: 0.6 }),
    );
    this.ball.add(wire);

    // sombra falsa: um disco escuro no chão (mais barato que shadow map)
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
    });
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(K.BALL_RADIUS, 16), shadowMat);
    this.ballShadow.position.z = 6;
    this.scene.add(this.ballShadow);
  }

  private buildPrediction(): void {
    const N = 60;
    this.predPositions = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.predPositions, 3));
    this.predLine = new THREE.Line(
      geo,
      new THREE.LineDashedMaterial({
        color: 0x7fd4ff,
        transparent: true,
        opacity: 0.5,
        dashSize: 60,
        gapSize: 40,
      }),
    );
    this.predLine.frustumCulled = false;
    this.scene.add(this.predLine);
  }

  private buildExplosion(): void {
    const N = 160;
    const pos = new Float32Array(N * 3);
    this.explosionVel = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.goalExplosion = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 46, transparent: true, opacity: 0 }),
    );
    this.goalExplosion.frustumCulled = false;
    this.scene.add(this.goalExplosion);
  }

  syncCars(world: World): void {
    while (this.cars.length < world.cars.length) {
      const idx = this.cars.length;
      this.cars.push(buildCar(this.scene, world.cars[idx].team, world.cars[idx].id));
      const sh = new THREE.Mesh(
        new THREE.CircleGeometry(K.HITBOX_L * 0.5, 10),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
      );
      sh.position.z = 5;
      this.scene.add(sh);
      this.carShadows.push(sh);
    }
  }

  triggerGoal(pos: { x: number; y: number; z: number }, color: number): void {
    const attr = this.goalExplosion.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3] = pos.x;
      arr[i * 3 + 1] = pos.y;
      arr[i * 3 + 2] = pos.z;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      const s = 400 + Math.random() * 1600;
      this.explosionVel[i * 3] = Math.sin(ph) * Math.cos(th) * s;
      this.explosionVel[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * s;
      this.explosionVel[i * 3 + 2] = Math.cos(ph) * s + 400;
    }
    attr.needsUpdate = true;
    (this.goalExplosion.material as THREE.PointsMaterial).color.setHex(color);
    this.explosionLife = 1.6;
    this.shake(0.6, 34);
  }

  shake(time: number, mag: number): void {
    this.shakeTime = Math.max(this.shakeTime, time);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  private updateExplosion(dt: number): void {
    const mat = this.goalExplosion.material as THREE.PointsMaterial;
    if (this.explosionLife <= 0) {
      mat.opacity = 0;
      return;
    }
    this.explosionLife -= dt;
    const attr = this.goalExplosion.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3] += this.explosionVel[i * 3] * dt;
      arr[i * 3 + 1] += this.explosionVel[i * 3 + 1] * dt;
      arr[i * 3 + 2] += this.explosionVel[i * 3 + 2] * dt;
      this.explosionVel[i * 3 + 2] -= 900 * dt;
    }
    attr.needsUpdate = true;
    mat.opacity = Math.max(0, this.explosionLife / 1.6) * 0.9;
    mat.size = 30 + (1.6 - this.explosionLife) * 30;
  }

  /** Atualiza a linha de predição da bola. */
  setPrediction(points: { x: number; y: number; z: number }[]): void {
    const arr = this.predPositions;
    const n = Math.min(points.length, arr.length / 3);
    for (let i = 0; i < arr.length / 3; i++) {
      const p = points[Math.min(i, n - 1)] ?? { x: 0, y: 0, z: 0 };
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    const attr = this.predLine.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.needsUpdate = true;
    this.predLine.computeLineDistances();
  }

  setPredictionVisible(v: boolean): void {
    this.predLine.visible = v;
  }

  /** Sincroniza os objetos e desenha. */
  render(world: World, dt: number, focusCarId: number, quality: Quality): void {
    const ball = world.ball;
    this.ball.position.set(ball.pos.x, ball.pos.y, ball.pos.z);
    // rotação visual da bola pelo spin
    const w = ball.ang;
    const wl = Math.hypot(w.x, w.y, w.z);
    if (wl > 1e-4) {
      this.ball.rotateOnWorldAxis(
        new THREE.Vector3(w.x / wl, w.y / wl, w.z / wl),
        wl * dt,
      );
    }
    this.ballShadow.position.set(ball.pos.x, ball.pos.y, 6);
    const bs = Math.max(0.35, 1 - ball.pos.z / 2200);
    this.ballShadow.scale.setScalar(bs);
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = 0.32 * bs;

    // carros
    for (let i = 0; i < world.cars.length; i++) {
      const car = world.cars[i];
      const vis = this.cars[i];
      if (!vis) continue;
      const hidden = car.demoTimer > 0;
      vis.group.visible = !hidden;
      vis.trail.visible = !hidden && quality.trails && car.supersonic;
      this.carShadows[i].visible = !hidden;
      if (hidden) continue;

      vis.group.position.set(car.pos.x, car.pos.y, car.pos.z);
      vis.group.quaternion.set(car.rot.x, car.rot.y, car.rot.z, car.rot.w);

      const boosting = car.input.boost && car.boost > 0;
      vis.flame.visible = boosting;
      if (boosting) {
        const f = 0.7 + Math.random() * 0.6;
        vis.flame.scale.set(f, 1, f);
      }
      vis.supersonicRing.visible = car.supersonic;

      this.carShadows[i].position.set(car.pos.x, car.pos.y, 5);
      const cs = Math.max(0.3, 1 - car.pos.z / 1800);
      this.carShadows[i].scale.setScalar(cs);

      // rodas: eixo correto no Y, giro visual, esterço dianteiro e curso da mola.
      const speed = Math.hypot(car.vel.x, car.vel.y, car.vel.z);
      const spin = (speed / K.WHEEL_RADIUS) * dt * (car.onGround ? 1 : 0.25);
      const steerVis = car.onGround ? -car.input.steer * 0.42 : 0;
      for (let wi = 0; wi < vis.wheels.length; wi++) {
        const wm = vis.wheels[wi];
        wm.rotation.y += spin;
        wm.rotation.z = wi < 2 ? steerVis : 0;
        const compression = car.wheelCompression[wi] ?? 0;
        const droop = car.wheelContact[wi] ? 0 : -K.SUSPENSION_TRAVEL * 0.22;
        wm.position.z = K.WHEEL_Z + compression * K.SUSPENSION_TRAVEL * 0.45 + droop;
      }

      if (quality.trails && car.supersonic) {
        vis.trailPos[vis.trailIdx * 3] = car.pos.x;
        vis.trailPos[vis.trailIdx * 3 + 1] = car.pos.y;
        vis.trailPos[vis.trailIdx * 3 + 2] = car.pos.z;
        vis.trailIdx = (vis.trailIdx + 1) % (vis.trailPos.length / 3);
        (vis.trail.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      }
    }

    // boost pads
    for (let i = 0; i < PADS.length; i++) {
      const st = world.pads[i];
      const m = this.arena.padMeshes[i];
      const r = this.arena.padRings[i];
      m.visible = st.active;
      r.visible = st.active;
      if (st.active) {
        m.rotation.y += dt * 1.6;
        const bob = Math.sin(world.time * 3 + i) * 6;
        m.position.z = (PADS[i].big ? 80 : 40) + bob;
      }
    }

    this.updateExplosion(dt);
    this.updateCamera(world, dt, focusCarId);
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(world: World, dt: number, focusCarId: number): void {
    const car = world.cars[focusCarId];
    if (!car) return;
    const ball = world.ball;

    // Direção horizontal da câmera. Na ballcam é o vetor carro→bola; no
    // carro cam é a projeção do nariz no plano XY.
    let dirX: number, dirY: number;
    if (this.ballCam) {
      dirX = ball.pos.x - car.pos.x;
      dirY = ball.pos.y - car.pos.y;
      const l = Math.hypot(dirX, dirY) || 1;
      dirX /= l;
      dirY /= l;
    } else {
      const q = car.rot;
      const fx = 1 - 2 * (q.y * q.y + q.z * q.z);
      const fy = 2 * (q.x * q.y + q.z * q.w);
      const l = Math.hypot(fx, fy) || 1;
      dirX = fx / l;
      dirY = fy / l;
    }

    // Parâmetros estilo Rocket League (dist 270, height 110, angle -3°,
    // stiffness 0.5, swivel speed ~5). Em aéreo afastamos e subimos um
    // pouco para que a bola NUNCA saia do quadro.
    const inAir = !car.onGround;
    const ballZ = ball.pos.z;
    const carZ = car.pos.z;
    const dist2D = Math.hypot(ball.pos.x - car.pos.x, ball.pos.y - car.pos.y);
    const ballHeightAngle = Math.atan2(ballZ - carZ, dist2D);

    const speed = Math.hypot(car.vel.x, car.vel.y, car.vel.z);
    const speedFactor = Math.min(speed / 2300, 1);

    const BASE_DIST = 400;
    const BASE_HEIGHT = 280;
    const ANGLE_DEG = -4;
    const angleRad = (-ANGLE_DEG * Math.PI) / 180;

    // Correções dinâmicas:
    //  - subida: quando a bola está MUITO ALTA (ângulo > 20°), a câmera
    //    sobe e recua junto;
    //  - parede/defesa: perto da parede do próprio gol, recua mais para
    //    mostrar o carro e a baliza;
    //  - aéreo: zoom out suave (fov sobe) para não cortar o teto.
    const highBoost = Math.max(0, ballHeightAngle - 0.32) * 1.6;
    // sinal do gol do jogador focado (time 0 = azul em -Y, time 1 = laranja em +Y)
    const ownGoalSign = focusCarId === 0 ? -1 : 1;
    const nearOwnWall =
      car.pos.y * ownGoalSign < -(K.FIELD_Y - 1100) ? 1 : 0;
    const nearAnyWall =
      Math.min(K.FIELD_X - Math.abs(car.pos.x), K.FIELD_Y - Math.abs(car.pos.y)) < 900
        ? 1
        : 0;

    const dist =
      BASE_DIST +
      speedFactor * 220 +
      highBoost * 520 +
      nearOwnWall * 520 +
      (inAir ? 180 : 0);
    const height =
      BASE_HEIGHT +
      speedFactor * 90 +
      highBoost * 650 +
      Math.max(0, carZ) * 0.55 +
      nearOwnWall * 260;
    // inclinação para trás em aéreo/alto para ver a bola mais acima
    const pitchBack = angleRad - highBoost * 0.55 - nearOwnWall * 0.08;

    const tx = car.pos.x - dirX * Math.cos(pitchBack) * dist;
    const ty = car.pos.y - dirY * Math.cos(pitchBack) * dist;
    const tz = Math.max(80, car.pos.z + Math.sin(pitchBack) * dist + height);

    // Suavização: câmera mais ágil que antes mas sem trepidação.
    // Quando está na parede/aéreo a câmera é mais macia para não doer a vista.
    const stiff = 10 - nearAnyWall * 2 - (inAir ? 1.5 : 0);
    const k = Math.max(3.5, stiff);
    const smoothDamp = (a: number, b: number, kk: number): number => damp(a, b, kk, dt);
    this.camPos.x = smoothDamp(this.camPos.x, tx, k);
    this.camPos.y = smoothDamp(this.camPos.y, ty, k);
    this.camPos.z = smoothDamp(this.camPos.z, tz, k * 0.9);

    // Ponto de foco: interpola entre "à frente do carro" e "bola" baseado
    // em quão desalinhados eles estão. Isso é o que impede a bola de
    // escapar pelo topo da tela quando está alta ou perto da parede.
    let lx: number, ly: number, lz: number;
    if (this.ballCam) {
      // olha num ponto ENTRE o nariz do carro e a bola, ponderado pela
      // distância/altura: a bola entra com mais peso quando está longe
      // ou alta, senão a câmera olha "muito no pé" do carro.
      const aheadX = car.pos.x + dirX * 700;
      const aheadY = car.pos.y + dirY * 700;
      const aheadZ = car.pos.z + 120;
      const ballW = Math.min(
        0.85,
        0.35 + dist2D / 3500 * 0.35 + Math.max(0, ballHeightAngle) * 0.8,
      );
      const carW = 1 - ballW;
      lx = aheadX * carW + ball.pos.x * ballW;
      ly = aheadY * carW + ball.pos.y * ballW;
      lz = aheadZ * carW + (ball.pos.z + 80) * ballW;
    } else {
      lx = car.pos.x + dirX * 900;
      ly = car.pos.y + dirY * 900;
      lz = car.pos.z + 120;
    }
    this.camLook.x = smoothDamp(this.camLook.x, lx, k * 1.4);
    this.camLook.y = smoothDamp(this.camLook.y, ly, k * 1.4);
    this.camLook.z = smoothDamp(this.camLook.z, lz, k * 1.2);

    // FOV dinâmico: em aéreo ou a bola muito alta, abre um pouco para
    // enquadrar melhor; em velocidade máxima um leve boost de sensação.
    const targetFov = 110 + (inAir ? 6 : 0) + highBoost * 10 + speedFactor * 3;
    this.camFov = smoothDamp(this.camFov, targetFov, 5);
    this.camera.fov = this.camFov;
    this.camera.updateProjectionMatrix();

    // Shake.
    let sx = 0,
      sy = 0,
      sz = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const m = this.shakeMag * Math.max(0, this.shakeTime);
      sx = (Math.random() * 2 - 1) * m;
      sy = (Math.random() * 2 - 1) * m;
      sz = (Math.random() * 2 - 1) * m;
      if (this.shakeTime <= 0) this.shakeMag = 0;
    }

    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z + sz);
    this.camera.lookAt(this.camLook);
    // a câmera do RL nunca rola: up sempre no eixo Z do mundo.
    this.camera.up.set(0, 0, 1);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setPixelRatio(r: number): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, r));
    this.resize();
  }
}
