/**
 * Carro low-poly: chassi chanfrado + 4 rodas cilíndricas + chamas do boost.
 * Mantém poucos triângulos, mas já suporta silhuetas/adesivos diferentes.
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

interface CarStyle {
  name: string;
  blue: number;
  orange: number;
  dark: number;
  length: number;
  width: number;
  height: number;
  topLength: number;
  topWidth: number;
  cabinX: number;
  spoiler: "wing" | "ducktail" | "none";
  decal: "stripe" | "chevron" | "split";
}

const CAR_STYLES: readonly CarStyle[] = [
  {
    name: "Vector",
    blue: 0x2f7dff,
    orange: 0xff7a1f,
    dark: 0x111827,
    length: 1,
    width: 1,
    height: 1,
    topLength: 0.55,
    topWidth: 0.78,
    cabinX: 6,
    spoiler: "wing",
    decal: "stripe",
  },
  {
    name: "Comet",
    blue: 0x16c7ff,
    orange: 0xff4b45,
    dark: 0x0c2636,
    length: 0.92,
    width: 1.08,
    height: 0.9,
    topLength: 0.7,
    topWidth: 0.68,
    cabinX: -2,
    spoiler: "ducktail",
    decal: "chevron",
  },
  {
    name: "Bison",
    blue: 0x7c5cff,
    orange: 0xffb02e,
    dark: 0x1f1639,
    length: 1.1,
    width: 1.02,
    height: 1.12,
    topLength: 0.48,
    topWidth: 0.88,
    cabinX: 12,
    spoiler: "none",
    decal: "split",
  },
];

/** Chassi: caixa com topo estreito. A geometria varia por estilo para mudar silhueta. */
function makeBody(style: CarStyle): THREE.BufferGeometry {
  const l = (K.HITBOX_L / 2) * style.length;
  const w = (K.HITBOX_W / 2) * style.width;
  const h = (K.HITBOX_H / 2) * style.height;
  const tl = l * style.topLength;
  const tw = w * style.topWidth;

  const v: number[] = [];
  const push = (x: number, y: number, z: number) => v.push(x, y, z);

  const b = [
    [l, -w, -h],
    [l, w, -h],
    [-l, w, -h],
    [-l, -w, -h],
  ];
  const t = [
    [tl + 10, -tw, h],
    [tl + 10, tw, h],
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

  quad(b[0], b[3], b[2], b[1]);
  quad(t[0], t[1], t[2], t[3]);
  quad(b[0], b[1], t[1], t[0]);
  quad(b[2], b[3], t[3], t[2]);
  quad(b[1], b[2], t[2], t[1]);
  quad(b[3], b[0], t[0], t[3]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}

function addDecal(group: THREE.Group, style: CarStyle, color: number): void {
  const z = (K.HITBOX_H / 2) * style.height + K.HITBOX_OFFSET_Z + 0.7;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, side: THREE.DoubleSide });

  if (style.decal === "stripe") {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(K.HITBOX_L * 0.52, K.HITBOX_W * 0.22), mat);
    stripe.position.set(style.cabinX, 0, z);
    group.add(stripe);
    return;
  }

  if (style.decal === "split") {
    for (const y of [-K.HITBOX_W * 0.18, K.HITBOX_W * 0.18]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(K.HITBOX_L * 0.45, K.HITBOX_W * 0.12), mat);
      s.position.set(style.cabinX, y, z);
      group.add(s);
    }
    return;
  }

  // chevron barato: dois retângulos inclinados no capô.
  for (const sign of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(K.HITBOX_L * 0.35, K.HITBOX_W * 0.1), mat);
    s.position.set(style.cabinX + 2, sign * K.HITBOX_W * 0.11, z);
    s.rotation.z = sign * 0.45;
    group.add(s);
  }
}

function addSpoiler(group: THREE.Group, style: CarStyle, color: number): void {
  if (style.spoiler === "none") return;
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const z = K.HITBOX_H / 2 + K.HITBOX_OFFSET_Z + (style.spoiler === "wing" ? 14 : 7);
  const x = -K.HITBOX_L * 0.48 * style.length;

  if (style.spoiler === "wing") {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(10, K.HITBOX_W * 0.9, 5), mat);
    wing.position.set(x, 0, z);
    group.add(wing);
    for (const y of [-K.HITBOX_W * 0.32, K.HITBOX_W * 0.32]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 18), mat);
      post.position.set(x + 4, y, z - 9);
      group.add(post);
    }
  } else {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(12, K.HITBOX_W * 0.82, 8), mat);
    lip.position.set(x, 0, z);
    lip.rotation.y = -0.2;
    group.add(lip);
  }
}

export function buildCar(scene: THREE.Scene, team: 0 | 1, variant = 0): CarVisual {
  const group = new THREE.Group();
  const style = CAR_STYLES[variant % CAR_STYLES.length];
  const color = team === 0 ? style.blue : style.orange;
  const accent = team === 0 ? 0x8fd5ff : 0xffd08a;

  const body = new THREE.Mesh(
    makeBody(style),
    new THREE.MeshLambertMaterial({ color, flatShading: true }),
  );
  body.position.z = K.HITBOX_OFFSET_Z;
  group.add(body);

  // cabine/vidro: dá uma leitura de frente/traseira e muda a silhueta.
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(K.HITBOX_L * 0.25, K.HITBOX_W * style.topWidth * 0.72, K.HITBOX_H * 0.34),
    new THREE.MeshLambertMaterial({ color: style.dark, flatShading: true }),
  );
  cabin.position.set(style.cabinX - 8, 0, K.HITBOX_H * 0.56 + K.HITBOX_OFFSET_Z);
  cabin.rotation.y = -0.1;
  group.add(cabin);

  addDecal(group, style, accent);
  addSpoiler(group, style, accent);

  // rodas. CylinderGeometry nasce com eixo no Y — exatamente o eixo do carro.
  // O bug visual anterior vinha de rotacionar em X, deixando a roda "em pé".
  const wheelGeo = new THREE.CylinderGeometry(K.WHEEL_RADIUS, K.WHEEL_RADIUS, 12, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x11151c, flatShading: true });
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x9aa7b8 });
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
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(K.WHEEL_RADIUS * 0.48, K.WHEEL_RADIUS * 0.48, 12.6, 8), rimMat);
    w.add(rim);
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

  const supersonicRing = new THREE.Mesh(
    new THREE.RingGeometry(52, 66, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  supersonicRing.rotation.y = Math.PI / 2;
  supersonicRing.position.x = -K.HITBOX_L / 2 - 10;
  supersonicRing.visible = false;
  group.add(supersonicRing);

  scene.add(group);

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
