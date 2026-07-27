/**
 * Carro low-poly: um chassi chanfrado + 4 rodas cilíndricas + chamas do boost.
 * Sem texturas, sem sombras. ~200 triângulos por carro.
 */
import * as THREE from "three";
import * as K from "../sim/constants";

export interface CarVisual {
  group: THREE.Group;
  body: THREE.Mesh;
  wheels: THREE.Mesh[];
  flame: THREE.Mesh;
  trail: THREE.Points;
  trailPos: Float32Array;
  trailIdx: number;
  supersonicRing: THREE.Mesh;
}

const TEAM_COLORS = [0x2f7dff, 0xff7a1f];
const TEAM_DARK = [0x1a4a99, 0xa04a10];

/** Chassi: caixa com o topo mais estreito (cabine), tipo Octane estilizado. */
function makeBody(color: number): THREE.BufferGeometry {
  const l = K.HITBOX_L / 2;
  const w = K.HITBOX_W / 2;
  const h = K.HITBOX_H / 2;
  const tl = l * 0.55; // topo mais curto
  const tw = w * 0.78;

  // 8 vértices base + 8 do topo estreito
  const v: number[] = [];
  const push = (x: number, y: number, z: number) => v.push(x, y, z);

  // face inferior (z = -h)
  const b = [
    [l, -w, -h],
    [l, w, -h],
    [-l, w, -h],
    [-l, -w, -h],
  ];
  // face superior (z = h) recuada
  const t = [
    [tl, -tw, h],
    [tl, tw, h],
    [-tl - 12, tw, h],
    [-tl - 12, -tw, h],
  ];

  const quad = (a: number[], bb: number[], c: number[], d: number[]) => {
    push(...(a as [number, number, number]));
    push(...(bb as [number, number, number]));
    push(...(c as [number, number, number]));
    push(...(a as [number, number, number]));
    push(...(c as [number, number, number]));
    push(...(d as [number, number, number]));
  };

  quad(b[0], b[3], b[2], b[1]); // fundo
  quad(t[0], t[1], t[2], t[3]); // topo
  quad(b[0], b[1], t[1], t[0]); // frente
  quad(b[2], b[3], t[3], t[2]); // traseira
  quad(b[1], b[2], t[2], t[1]); // lateral esquerda
  quad(b[3], b[0], t[0], t[3]); // lateral direita

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}

export function buildCar(scene: THREE.Scene, team: 0 | 1): CarVisual {
  const group = new THREE.Group();
  const color = TEAM_COLORS[team];

  const body = new THREE.Mesh(
    makeBody(color),
    new THREE.MeshLambertMaterial({ color, flatShading: true }),
  );
  body.position.z = K.HITBOX_OFFSET_Z;
  group.add(body);

  // faixa de cor mais escura (só um plano fino no topo)
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(K.HITBOX_L * 0.5, K.HITBOX_W * 0.3),
    new THREE.MeshBasicMaterial({ color: TEAM_DARK[team] }),
  );
  stripe.position.set(6, 0, K.HITBOX_H / 2 + K.HITBOX_OFFSET_Z + 0.6);
  group.add(stripe);

  // rodas
  const wheelGeo = new THREE.CylinderGeometry(K.WHEEL_RADIUS, K.WHEEL_RADIUS, 12, 7);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1b1f26, flatShading: true });
  const wheels: THREE.Mesh[] = [];
  const spots: [number, number][] = [
    [K.WHEEL_FRONT_X, K.WHEEL_Y],
    [K.WHEEL_FRONT_X, -K.WHEEL_Y],
    [K.WHEEL_REAR_X, K.WHEEL_Y],
    [K.WHEEL_REAR_X, -K.WHEEL_Y],
  ];
  for (const [x, y] of spots) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, y, K.WHEEL_Z);
    w.rotation.x = Math.PI / 2;
    group.add(w);
    wheels.push(w);
  }

  // chama do boost (cone na traseira)
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(16, 70, 6),
    new THREE.MeshBasicMaterial({ color: 0xffb340, transparent: true, opacity: 0.9 }),
  );
  flame.rotation.z = Math.PI / 2;
  flame.position.set(-K.HITBOX_L / 2 - 32, 0, 4);
  flame.visible = false;
  group.add(flame);

  // anel supersônico
  const supersonicRing = new THREE.Mesh(
    new THREE.RingGeometry(52, 66, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    }),
  );
  supersonicRing.rotation.y = Math.PI / 2;
  supersonicRing.position.x = -K.HITBOX_L / 2 - 10;
  supersonicRing.visible = false;
  group.add(supersonicRing);

  scene.add(group);

  // rastro (pontos no espaço do mundo)
  const TRAIL = 40;
  const trailPos = new Float32Array(TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Points(
    trailGeo,
    new THREE.PointsMaterial({ color, size: 22, transparent: true, opacity: 0.35 }),
  );
  trail.frustumCulled = false;
  trail.visible = false;
  scene.add(trail);

  return { group, body, wheels, flame, trail, trailPos, trailIdx: 0, supersonicRing };
}
