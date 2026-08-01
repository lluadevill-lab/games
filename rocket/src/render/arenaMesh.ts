/**
 * Malha low-poly da arena: cores chapadas, sem texturas, sem sombras caras.
 * Toda a geometria é gerada por código — o bundle não carrega nenhum asset.
 */
import * as THREE from "three";
import * as K from "../sim/constants";
import { PADS, BIG_PAD_RADIUS, SMALL_PAD_RADIUS } from "../sim/boostPads";
import { fieldOutline } from "../sim/arena";

export interface ArenaVisuals {
  group: THREE.Group;
  padMeshes: THREE.Mesh[];
  padRings: THREE.Mesh[];
}

const COL_FLOOR = 0x1b2330;
const COL_FLOOR_2 = 0x212b3a;
const COL_LINE = 0x5e7899;
const COL_WALL = 0x121822;
const COL_BLUE = 0x2f7dff;
const COL_ORANGE = 0xff8a2b;

function lineMat(color: number, opacity = 1) {
  return new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
}

/** Linha no chão a partir de pontos 2D. */
function groundLine(pts: [number, number][], color = COL_LINE, z = 3): THREE.Line {
  const g = new THREE.BufferGeometry().setFromPoints(
    pts.map(([x, y]) => new THREE.Vector3(x, y, z)),
  );
  return new THREE.Line(g, lineMat(color, 0.75));
}

function circleLine(cx: number, cy: number, r: number, seg = 48, color = COL_LINE): THREE.Line {
  const pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return groundLine(pts, color);
}

export function buildArena(scene: THREE.Scene): ArenaVisuals {
  const group = new THREE.Group();

  // ---------------------------------------------------------------- chão
  // O piso é recortado na silhueta real do campo (cantos arredondados),
  // para não aparecer chão fora das paredes.
  const outlineShape = new THREE.Shape();
  {
    const pts = fieldOutline(14);
    outlineShape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) outlineShape.lineTo(pts[i][0], pts[i][1]);
    outlineShape.closePath();
  }
  const floor = new THREE.Mesh(
    new THREE.ShapeGeometry(outlineShape),
    new THREE.MeshLambertMaterial({ color: COL_FLOOR }),
  );
  group.add(floor);

  // faixas de meio-campo (só para dar noção de profundidade, custo zero)
  for (let i = -4; i <= 4; i++) {
    if (i % 2 !== 0) continue;
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(K.FIELD_X * 2 - 1400, 1024),
      new THREE.MeshLambertMaterial({ color: COL_FLOOR_2 }),
    );
    stripe.position.set(0, i * 1024, 1);
    group.add(stripe);
  }

  // ---------------------------------------------------------------- linhas
  group.add(groundLine([[-K.FIELD_X, 0], [K.FIELD_X, 0]], 0x8fa8c8));
  group.add(circleLine(0, 0, 900));
  group.add(circleLine(0, 0, 120, 24));
  // áreas
  for (const s of [1, -1]) {
    group.add(
      groundLine([
        [-1786, s * K.FIELD_Y],
        [-1786, s * (K.FIELD_Y - 1152)],
        [1786, s * (K.FIELD_Y - 1152)],
        [1786, s * K.FIELD_Y],
      ]),
    );
    group.add(circleLine(0, s * (K.FIELD_Y - 1152), 640, 40));
  }
  // Contorno do campo: vem da MESMA função que a física usa, então o que
  // você vê é exatamente onde o carro colide (cantos arredondados incluídos).
  const outline = fieldOutline(14);
  group.add(groundLine(outline, 0x8fa8c8, 4));

  // ---------------------------------------------------------------- paredes
  const wallMat = new THREE.MeshLambertMaterial({
    color: COL_WALL,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.98,
    depthWrite: true,
  });
  // Topo/teto: um plano simples fechando em CEILING_Z. Antigamente o teto
  // era invisível e a câmera enxergava o nada quando o carro subia muito.
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(K.FIELD_X * 2 + 3000, K.FIELD_Y * 2 + 3000),
    new THREE.MeshLambertMaterial({ color: 0x161d28, side: THREE.DoubleSide }),
  );
  ceiling.position.set(0, 0, K.CEILING_Z);
  ceiling.rotation.x = Math.PI / 2;
  group.add(ceiling);
  // Um frame sutil no teto pra dar referência de profundidade.
  group.add(
    groundLine(
      [
        [-K.FIELD_X, -K.FIELD_Y],
        [K.FIELD_X, -K.FIELD_Y],
        [K.FIELD_X, K.FIELD_Y],
        [-K.FIELD_X, K.FIELD_Y],
        [-K.FIELD_X, -K.FIELD_Y],
      ],
      0x3a4a63,
      K.CEILING_Z - 2,
    ),
  );

  const addWall = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    h = K.CEILING_Z,
  ) => {
    const dx = bx - ax;
    const dy = by - ay;
    const l = Math.hypot(dx, dy);
    const geo = new THREE.PlaneGeometry(l, h);
    const m = new THREE.Mesh(geo, wallMat);
    m.position.set((ax + bx) / 2, (ay + by) / 2, h / 2);
    m.rotation.x = Math.PI / 2;
    m.rotation.y = -Math.atan2(dy, dx);
    group.add(m);
  };

  for (let i = 0; i < outline.length - 1; i++) {
    const [ax, ay] = outline[i];
    const [bx, by] = outline[i + 1];
    addWall(ax, ay, bx, by);
  }

  // grade nas paredes (wireframe barato, ajuda a julgar altura)
  const gridPts: THREE.Vector3[] = [];
  for (let z = 512; z < K.CEILING_Z; z += 512) {
    for (let i = 0; i < outline.length - 1; i++) {
      const [ax, ay] = outline[i];
      const [bx, by] = outline[i + 1];
      gridPts.push(new THREE.Vector3(ax, ay, z), new THREE.Vector3(bx, by, z));
    }
  }
  const gridGeo = new THREE.BufferGeometry().setFromPoints(gridPts);
  group.add(new THREE.LineSegments(gridGeo, lineMat(0x3a4a63, 0.4)));

  // ---------------------------------------------------------------- gols
  for (const s of [1, -1] as const) {
    const color = s === 1 ? COL_ORANGE : COL_BLUE;
    const goalGroup = new THREE.Group();

    // boca (moldura)
    const frame: THREE.Vector3[] = [
      new THREE.Vector3(-K.GOAL_HALF_W, s * K.FIELD_Y, 0),
      new THREE.Vector3(-K.GOAL_HALF_W, s * K.FIELD_Y, K.GOAL_H),
      new THREE.Vector3(K.GOAL_HALF_W, s * K.FIELD_Y, K.GOAL_H),
      new THREE.Vector3(K.GOAL_HALF_W, s * K.FIELD_Y, 0),
    ];
    goalGroup.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(frame),
        new THREE.LineBasicMaterial({ color, linewidth: 2 }),
      ),
    );

    // "rede": grade simples dentro da baliza
    const netPts: THREE.Vector3[] = [];
    const back = s * (K.FIELD_Y + K.GOAL_DEPTH);
    for (let i = 0; i <= 8; i++) {
      const x = -K.GOAL_HALF_W + (i / 8) * K.GOAL_HALF_W * 2;
      netPts.push(new THREE.Vector3(x, back, 0), new THREE.Vector3(x, back, K.GOAL_H));
    }
    for (let i = 0; i <= 4; i++) {
      const z = (i / 4) * K.GOAL_H;
      netPts.push(
        new THREE.Vector3(-K.GOAL_HALF_W, back, z),
        new THREE.Vector3(K.GOAL_HALF_W, back, z),
      );
      netPts.push(
        new THREE.Vector3(-K.GOAL_HALF_W, s * K.FIELD_Y, z),
        new THREE.Vector3(-K.GOAL_HALF_W, back, z),
      );
      netPts.push(
        new THREE.Vector3(K.GOAL_HALF_W, s * K.FIELD_Y, z),
        new THREE.Vector3(K.GOAL_HALF_W, back, z),
      );
    }
    goalGroup.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(netPts),
        lineMat(color, 0.5),
      ),
    );

    // painel luminoso atrás
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(K.GOAL_HALF_W * 2, K.GOAL_H),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14 }),
    );
    glow.position.set(0, back, K.GOAL_H / 2);
    glow.rotation.x = Math.PI / 2;
    goalGroup.add(glow);

    group.add(goalGroup);
  }

  // ---------------------------------------------------------------- boost pads
  const padMeshes: THREE.Mesh[] = [];
  const padRings: THREE.Mesh[] = [];
  const bigGeo = new THREE.CylinderGeometry(0, 90, 150, 6);
  const smallGeo = new THREE.CylinderGeometry(0, 42, 70, 5);
  const bigMat = new THREE.MeshBasicMaterial({ color: 0xffc84a });
  const smallMat = new THREE.MeshBasicMaterial({ color: 0xffd88a });
  const ringGeo = new THREE.RingGeometry(120, 150, 6);
  const ringGeoS = new THREE.RingGeometry(60, 74, 5);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffc84a,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });

  for (const p of PADS) {
    const m = new THREE.Mesh(p.big ? bigGeo : smallGeo, p.big ? bigMat : smallMat);
    m.position.set(p.x, p.y, p.big ? 80 : 40);
    m.rotation.x = Math.PI / 2;
    group.add(m);
    padMeshes.push(m);

    const r = new THREE.Mesh(p.big ? ringGeo : ringGeoS, ringMat);
    r.position.set(p.x, p.y, 5);
    group.add(r);
    padRings.push(r);
  }

  scene.add(group);
  return { group, padMeshes, padRings };
}
