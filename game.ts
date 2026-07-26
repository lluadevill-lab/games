import { PlayerState, AnchorNode, Vector2D } from '../types/game';

export const GRAVITY = 850; // pixels per second^2
export const AIR_RESISTANCE = 0.998;
export const WALL_RESTITUTION = 0.72;
export const SPRING_CONSTANT = 35.0; // Hooke's law k
export const DAMPING = 0.985;
export const MAX_SLINGSHOT_PULL = 220;
export const MAX_LAUNCH_SPEED = 1800;

export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function circleVsCircle(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
  return getDistance(x1, y1, x2, y2) < r1 + r2;
}

export function circleVsAABB(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number): {
  collision: boolean;
  normalX: number;
  normalY: number;
  penetration: number;
} {
  // Find closest point on AABB to circle center
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));

  const distanceX = cx - closestX;
  const distanceY = cy - closestY;
  const distanceSq = distanceX * distanceX + distanceY * distanceY;

  if (distanceSq >= cr * cr && (distanceSq > 0 || cx < rx || cx > rx + rw || cy < ry || cy > ry + rh)) {
    // If circle center is inside AABB, distanceSq is 0
    if (cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh) {
      // Find shortest exit direction
      const dLeft = cx - rx;
      const dRight = rx + rw - cx;
      const dTop = cy - ry;
      const dBottom = ry + rh - cy;
      const minD = Math.min(dLeft, dRight, dTop, dBottom);
      if (minD === dLeft) return { collision: true, normalX: -1, normalY: 0, penetration: cr + dLeft };
      if (minD === dRight) return { collision: true, normalX: 1, normalY: 0, penetration: cr + dRight };
      if (minD === dTop) return { collision: true, normalX: 0, normalY: -1, penetration: cr + dTop };
      return { collision: true, normalX: 0, normalY: 1, penetration: cr + dBottom };
    }
    return { collision: false, normalX: 0, normalY: 0, penetration: 0 };
  }

  const distance = Math.sqrt(distanceSq);
  if (distance === 0) {
    return { collision: true, normalX: 0, normalY: -1, penetration: cr };
  }

  return {
    collision: true,
    normalX: distanceX / distance,
    normalY: distanceY / distance,
    penetration: cr - distance
  };
}

export function circleVsLineSegment(
  cx: number,
  cy: number,
  cr: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return getDistance(cx, cy, x1, y1) < cr;

  // Consider the line extending the segment, parameterized as x1 + t (x2 - x1), y1 + t (y2 - y1)
  // We find projection of point (cx, cy) onto the line
  let t = ((cx - x1) * (x2 - x1) + (cy - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t)); // clamp to segment bounds

  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);

  return getDistance(cx, cy, projX, projY) < cr;
}

export function findNearestNode(
  player: PlayerState,
  nodes: AnchorNode[],
  maxRange: number = 450
): AnchorNode | null {
  let nearest: AnchorNode | null = null;
  let minDist = maxRange;

  for (const node of nodes) {
    if (node.broken) continue;
    const dist = getDistance(player.x, player.y, node.x, node.y);
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }

  return nearest;
}

export function updatePendulumPhysics(
  player: PlayerState,
  node: AnchorNode,
  dt: number,
  isPumping: boolean
) {
  // Vector from node to ball
  const dx = player.x - node.x;
  const dy = player.y - node.y;
  const currentDist = Math.hypot(dx, dy);

  if (currentDist === 0) return;

  // Normalized direction vector from node to ball
  const nx = dx / currentDist;
  const ny = dy / currentDist;

  // If pumping (holding down/space while swinging), we pull the rest length in slightly or add tangential acceleration
  let targetRestLength = player.restLength;
  if (isPumping && currentDist > 50) {
    targetRestLength = Math.max(40, player.restLength * 0.92);
    // Add small tangential boost in direction of motion for Spider-Man swing feel!
    const tanX = -ny;
    const tanY = nx;
    const dot = player.vx * tanX + player.vy * tanY;
    if (Math.abs(dot) > 10) {
      const boost = Math.sign(dot) * 180 * dt;
      player.vx += tanX * boost;
      player.vy += tanY * boost;
    }
  } else {
    // Slowly return rest length to natural distance if not pumping
    player.restLength += (currentDist - player.restLength) * 2.0 * dt;
  }

  // Hooke's Law: Spring Force F = -k * (x - rest_length)
  const stretch = currentDist - targetRestLength;
  
  if (stretch > 0) {
    // Elastic pull toward anchor node
    const forceMagnitude = SPRING_CONSTANT * stretch;
    const fx = -nx * forceMagnitude;
    const fy = -ny * forceMagnitude;

    player.vx += fx * dt * 15;
    player.vy += fy * dt * 15;
  }

  // Apply gravity
  player.vy += GRAVITY * dt;

  // Damping / air resistance
  player.vx *= Math.pow(DAMPING, dt * 60);
  player.vy *= Math.pow(DAMPING, dt * 60);

  // Integrate position
  player.x += player.vx * dt;
  player.y += player.vy * dt;
}

export function calculateSlingshotTrajectory(
  startX: number,
  startY: number,
  aimX: number,
  aimY: number,
  gravity: number,
  steps: number = 18,
  stepTime: number = 0.04
): Vector2D[] {
  const dx = startX - aimX;
  const dy = startY - aimY;
  const pullDist = Math.min(MAX_SLINGSHOT_PULL, Math.hypot(dx, dy));
  
  if (pullDist < 10) return [];

  const angle = Math.atan2(dy, dx);
  const power = (pullDist / MAX_SLINGSHOT_PULL) * MAX_LAUNCH_SPEED;
  
  let vx = Math.cos(angle) * power;
  let vy = Math.sin(angle) * power;
  let x = startX;
  let y = startY;

  const points: Vector2D[] = [];
  for (let i = 0; i < steps; i++) {
    points.push({ x, y });
    x += vx * stepTime;
    y += vy * stepTime;
    vy += gravity * stepTime;
  }

  return points;
}
