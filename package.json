export type GameMode = 'menu' | 'level-select' | 'adventure' | 'endless' | 'editor' | 'shop' | 'high-scores' | 'how-to-play';

export type NodeType = 'normal' | 'moving' | 'fragile' | 'bumper';
export type ObstacleType = 'wall' | 'laser' | 'sawblade' | 'wind' | 'portal';

export interface Vector2D {
  x: number;
  y: number;
}

export interface AnchorNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: NodeType;
  // For moving nodes
  movePath?: { x: number; y: number }[];
  moveSpeed?: number;
  moveProgress?: number;
  // For fragile nodes
  timer?: number;
  maxTimer?: number;
  broken?: boolean;
}

export interface Obstacle {
  id: string;
  type: ObstacleType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  // For lasers
  endX?: number;
  endY?: number;
  // For moving sawblades
  movePath?: { x: number; y: number }[];
  moveSpeed?: number;
  moveProgress?: number;
  // For wind tunnels
  windDirection?: Vector2D;
  windStrength?: number;
  // For portals
  portalTargetX?: number;
  portalTargetY?: number;
  portalColor?: string;
}

export interface Collectible {
  id: string;
  type: 'star' | 'coin';
  x: number;
  y: number;
  radius: number;
  collected?: boolean;
}

export interface LevelData {
  id: number;
  title: string;
  world: number;
  description?: string;
  startX: number;
  startY: number;
  goalX: number;
  goalY: number;
  goalRadius: number;
  bounds: {
    width: number;
    height: number;
  };
  nodes: AnchorNode[];
  obstacles: Obstacle[];
  collectibles: Collectible[];
  targetTime: number; // in seconds for gold medal
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  type?: 'spark' | 'smoke' | 'star' | 'ring' | 'trail' | 'text';
  text?: string;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  state: 'idle' | 'aiming' | 'flying' | 'hooked' | 'dead' | 'winning';
  hookedNodeId: string | null;
  ropeLength: number;
  restLength: number;
  aimStartX: number;
  aimStartY: number;
  aimCurrX: number;
  aimCurrY: number;
  trail: Vector2D[];
  combo: number;
}

export interface SkinItem {
  id: string;
  name: string;
  type: 'ball' | 'trail' | 'rope';
  price: number;
  unlocked: boolean;
  color: string;
  secondaryColor?: string;
  previewUrl?: string;
  description: string;
}

export interface HighScoreEntry {
  id: string;
  name: string;
  score: number;
  height: number;
  date: string;
  mode: 'endless' | 'adventure';
}

export interface LevelProgress {
  levelId: number;
  completed: boolean;
  stars: number; // 0, 1, 2, 3
  bestTime?: number;
  medal?: 'gold' | 'silver' | 'bronze' | 'none';
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  screenShake: boolean;
  showTrajectory: boolean;
  equippedBall: string;
  equippedTrail: string;
  equippedRope: string;
}
