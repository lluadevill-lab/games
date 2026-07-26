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
  /**
   * Limited-use anchors. When defined, the node can only be grabbed this many
   * times before it burns out permanently, forcing route planning instead of
   * re-grabbing the same safe anchor forever.
   */
  maxUses?: number;
  usesLeft?: number;
  /** Anchor cannot be re-grabbed until this cooldown (seconds) elapses. */
  cooldown?: number;
  cooldownLeft?: number;
}

export interface Obstacle {
  id: string;
  type: ObstacleType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  /**
   * Lethal surfaces kill on contact instead of bouncing.
   * Used to make floors/ceilings a real threat rather than a free trampoline.
   */
  lethal?: boolean;
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

/**
 * Per-level resource budget. This is the backbone of the difficulty design:
 * the player is not limited by the clock alone but by a finite number of
 * actions, so every hook and every launch has to be earned.
 */
export interface LevelRules {
  /** Max rope attachments allowed for the whole run. undefined = unlimited. */
  maxHooks?: number;
  /** Max slingshot launches allowed for the whole run. undefined = unlimited. */
  maxLaunches?: number;
  /** Touching any floor/ground surface is instant death. */
  floorIsLethal?: boolean;
  /** Number of wall bounces tolerated before dying. undefined = unlimited. */
  maxWallHits?: number;
  /** Hard time limit in seconds. Running out is a loss, not just a lost star. */
  timeLimit?: number;
  /** Gravity multiplier for this level (1 = default). */
  gravityScale?: number;
  /** Max range at which the rope can grab an anchor (px). Lower = harder. */
  hookRange?: number;
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
  /** Difficulty budget. Omitted on tutorial levels. */
  rules?: LevelRules;
  /** Star cost to unlock this level, enforcing mastery before progression. */
  starsRequired?: number;
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
  /** Resource counters consumed during the run. */
  hooksUsed: number;
  launchesUsed: number;
  wallHits: number;
  /** Best combo achieved in the run, used for scoring/ranking. */
  maxCombo: number;
}

/** Live resource snapshot pushed to the HUD each frame. */
export interface RunResources {
  hooksLeft: number | null;
  launchesLeft: number | null;
  wallHitsLeft: number | null;
  timeLeft: number | null;
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
