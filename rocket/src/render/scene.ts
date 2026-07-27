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
  ballCam = true;

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality.pixelRatio > 1.2,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatio));
    this.renderer.setClearColor(0x070b12, 1);

    this.scene.fog = new THREE.Fog(0x070b12, 6000, 16000);
    this.camera = new THREE.PerspectiveCamera(100, 1, 20, 30000);
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
      this.cars.push(buildCar(this.scene, world.cars[idx].team));
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

      // rodas girando
      const speed = Math.hypot(car.vel.x, car.vel.y, car.vel.z);
      const spin = (speed / K.WHEEL_RADIUS) * dt * (car.onGround ? 1 : 0.25);
      for (const wm of vis.wheels) wm.rotation.y += spin;

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

    // Ball cam: a câmera fica atrás do carro no eixo carro→bola.
    // Cam padrão: atrás do nariz do carro.
    let dirX: number, dirY: number;
    if (this.ballCam) {
      dirX = ball.pos.x - car.pos.x;
      dirY = ball.pos.y - car.pos.y;
      const l = Math.hypot(dirX, dirY) || 1;
      dirX /= l;
      dirY /= l;
    } else {
      const q = car.rot;
      // eixo X local rotacionado, componente horizontal
      const fx = 1 - 2 * (q.y * q.y + q.z * q.z);
      const fy = 2 * (q.x * q.y + q.z * q.w);
      const l = Math.hypot(fx, fy) || 1;
      dirX = fx / l;
      dirY = fy / l;
    }

    const speed = Math.hypot(car.vel.x, car.vel.y, car.vel.z);
    const dist = 270 * 1.35 + speed * 0.08;
    const height = 110 * 1.6 + Math.max(0, car.pos.z) * 0.55;

    const tx = car.pos.x - dirX * dist;
    const ty = car.pos.y - dirY * dist;
    const tz = car.pos.z + height;

    const k = 6.5;
    this.camPos.x = damp(this.camPos.x, tx, k, dt);
    this.camPos.y = damp(this.camPos.y, ty, k, dt);
    this.camPos.z = damp(this.camPos.z, Math.max(tz, 60), k * 1.3, dt);

    // olha para a bola em ball cam, senão à frente do carro
    const lx = this.ballCam ? ball.pos.x : car.pos.x + dirX * 900;
    const ly = this.ballCam ? ball.pos.y : car.pos.y + dirY * 900;
    const lz = this.ballCam ? ball.pos.z + 60 : car.pos.z + 120;
    this.camLook.x = damp(this.camLook.x, lx, k * 1.4, dt);
    this.camLook.y = damp(this.camLook.y, ly, k * 1.4, dt);
    this.camLook.z = damp(this.camLook.z, lz, k * 1.4, dt);

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
    // a câmera do RL nunca rola: up sempre no eixo Z do mundo
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
