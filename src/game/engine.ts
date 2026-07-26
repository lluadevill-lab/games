import {
  PlayerState,
  AnchorNode,
  Particle,
  LevelData,
  LevelRules,
  GameSettings,
  RunResources
} from '../types/game';
import {
  GRAVITY,
  WALL_RESTITUTION,
  DEFAULT_HOOK_RANGE,
  circleVsCircle,
  circleVsAABB,
  circleVsLineSegment,
  findNearestNode,
  isNodeAvailable,
  updatePendulumPhysics,
  calculateSlingshotTrajectory,
  MAX_SLINGSHOT_PULL,
  MAX_LAUNCH_SPEED
} from './physics';
import { soundManager } from '../utils/sound';
import { endlessGenerator } from './endless';

export interface EngineCallbacks {
  onScoreChange: (score: number, coins: number, combo: number) => void;
  onHeightChange?: (height: number) => void;
  onLevelWin: (stars: number, timeSpent: number, stats: RunStats) => void;
  onGameOver: (reason: string, finalScore?: number, heightReached?: number) => void;
  /** Pushes the live resource budget to the HUD. */
  onResourcesChange?: (res: RunResources) => void;
}

/** End-of-run statistics used for star/medal awarding. */
export interface RunStats {
  hooksUsed: number;
  launchesUsed: number;
  wallHits: number;
  maxCombo: number;
  coins: number;
  totalCoins: number;
  score: number;
  /** No wall contact and no damage taken for the entire run. */
  flawless: boolean;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private level: LevelData;
  private player: PlayerState;
  private camera: { x: number; y: number } = { x: 0, y: 0 };
  private shake: number = 0;
  private particles: Particle[] = [];
  private ambientStars: { x: number; y: number; size: number; alpha: number; speed: number }[] = [];
  private isRunning: boolean = false;
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private timeSpent: number = 0;
  private score: number = 0;
  private coinsCollected: number = 0;
  private isEndless: boolean = false;
  private plasmaY: number = 1000;
  private highestYReached: number = 500;
  private settings: GameSettings;
  private callbacks: EngineCallbacks;

  /** Active difficulty budget for this level. */
  private rules: LevelRules = {};
  private gravityScale: number = 1;
  private hookRange: number = DEFAULT_HOOK_RANGE;
  /** Rising urgency in endless mode; also drives hazard density. */
  private endlessIntensity: number = 0;
  private lastResourceSignature: string = '';
  private lastCountdownTick: number = -1;

  // Input state
  private isMouseDown: boolean = false;
  private isSpaceDown: boolean = false;
  private isDownKey: boolean = false;
  private isLeftKey: boolean = false;
  private isRightKey: boolean = false;
  private touchId: number | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    level: LevelData,
    settings: GameSettings,
    isEndless: boolean,
    callbacks: EngineCallbacks
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.level = JSON.parse(JSON.stringify(level)); // deep copy
    this.settings = settings;
    this.isEndless = isEndless;
    this.callbacks = callbacks;

    // Resolve the difficulty budget for this run.
    this.rules = this.level.rules ?? {};
    this.gravityScale = this.rules.gravityScale ?? 1;
    this.hookRange = this.rules.hookRange ?? DEFAULT_HOOK_RANGE;

    // Initialize per-node use limits declared by the level.
    for (const node of this.level.nodes) {
      if (node.maxUses !== undefined) node.usesLeft = node.maxUses;
      if (node.cooldown !== undefined) node.cooldownLeft = 0;
    }

    // Initialize player
    this.player = this.createInitialPlayerState();

    if (this.isEndless) {
      this.plasmaY = this.level.startY + 300;
      this.highestYReached = this.level.startY;
    }

    // Generate ambient background stars
    for (let i = 0; i < 80; i++) {
      this.ambientStars.push({
        x: Math.random() * 2000 - 500,
        y: Math.random() * 3000 - 1500,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.7 + 0.2,
        speed: Math.random() * 15 + 5
      });
    }

    this.setupEventListeners();
  }

  private createInitialPlayerState(): PlayerState {
    // Check if we start near a node, if so attach to first normal node
    const firstNode = this.level.nodes[0] || null;
    let initialRest = 140;
    if (firstNode) {
      const dist = Math.hypot(this.level.startX - firstNode.x, this.level.startY - firstNode.y);
      if (dist < 300) {
        initialRest = dist;
      }
    }

    return {
      x: this.level.startX,
      y: this.level.startY,
      vx: 0,
      vy: 0,
      radius: 16,
      state: firstNode ? 'hooked' : 'flying',
      hookedNodeId: firstNode ? firstNode.id : null,
      ropeLength: initialRest,
      restLength: initialRest,
      aimStartX: 0,
      aimStartY: 0,
      aimCurrX: 0,
      aimCurrY: 0,
      trail: [],
      combo: 0,
      hooksUsed: 0,
      launchesUsed: 0,
      wallHits: 0,
      maxCombo: 0
    };
  }

  // =================== RESOURCE BUDGET ===================

  /** Remaining rope attachments, or null when unlimited. */
  private hooksLeft(): number | null {
    if (this.rules.maxHooks === undefined) return null;
    return Math.max(0, this.rules.maxHooks - this.player.hooksUsed);
  }

  /** Remaining slingshot launches, or null when unlimited. */
  private launchesLeft(): number | null {
    if (this.rules.maxLaunches === undefined) return null;
    return Math.max(0, this.rules.maxLaunches - this.player.launchesUsed);
  }

  /** Remaining tolerated wall bounces, or null when unlimited. */
  private wallHitsLeft(): number | null {
    if (this.rules.maxWallHits === undefined) return null;
    return Math.max(0, this.rules.maxWallHits - this.player.wallHits);
  }

  private timeLeft(): number | null {
    if (this.rules.timeLimit === undefined) return null;
    return Math.max(0, this.rules.timeLimit - this.timeSpent);
  }

  /** Pushes resources to the HUD, but only when a displayed value changed. */
  private emitResources(force = false) {
    if (!this.callbacks.onResourcesChange) return;
    const timeLeft = this.timeLeft();
    const res: RunResources = {
      hooksLeft: this.hooksLeft(),
      launchesLeft: this.launchesLeft(),
      wallHitsLeft: this.wallHitsLeft(),
      timeLeft
    };
    // Throttle: time is rendered with one decimal, so key on that precision.
    const sig = `${res.hooksLeft}|${res.launchesLeft}|${res.wallHitsLeft}|${
      timeLeft === null ? 'x' : timeLeft.toFixed(1)
    }`;
    if (!force && sig === this.lastResourceSignature) return;
    this.lastResourceSignature = sig;
    this.callbacks.onResourcesChange(res);
  }

  /** Floating warning text + audio cue when a resource is spent. */
  private warnResource(label: string, left: number) {
    const color = left === 0 ? '#f43f5e' : left <= 1 ? '#fb923c' : '#fbbf24';
    this.addParticle(this.player.x, this.player.y - 34, 0, -46, 15, color, 'text', `${label}: ${left}`);
    if (left <= 1) soundManager.playWarning();
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    soundManager.setSoundEnabled(this.settings.soundEnabled);
    soundManager.setMusicEnabled(this.settings.musicEnabled);
    if (this.settings.musicEnabled) {
      soundManager.startMusic();
    }
    this.emitResources(true);
    this.loop(this.lastTime);
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    soundManager.stopStretchSound();
  }

  public destroy() {
    this.stop();
    this.removeEventListeners();
  }

  public updateSettings(settings: GameSettings) {
    this.settings = settings;
    soundManager.setSoundEnabled(settings.soundEnabled);
    soundManager.setMusicEnabled(settings.musicEnabled);
  }

  private addShake(amount: number) {
    if (this.settings.screenShake) {
      this.shake = Math.min(30, this.shake + amount);
    }
  }

  private addParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    color: string,
    type: Particle['type'] = 'spark',
    text?: string
  ) {
    this.particles.push({
      x,
      y,
      vx,
      vy,
      size,
      color,
      alpha: 1,
      decay: Math.random() * 1.5 + 1.2,
      type,
      text
    });
  }

  private createExplosion(x: number, y: number, color: string, count: number = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 250 + 50;
      this.addParticle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        Math.random() * 5 + 2,
        color,
        'spark'
      );
    }
  }

  // =================== INPUT HANDLING ===================
  private setupEventListeners() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: false });
  }

  private removeEventListeners() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
  }

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const cx = (sx - rect.left) * scaleX;
    const cy = (sy - rect.top) * scaleY;
    return {
      x: cx + this.camera.x,
      y: cy + this.camera.y
    };
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.isRunning) return;
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (!this.isSpaceDown) {
        this.isSpaceDown = true;
        this.handleActionPress();
      }
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      this.isDownKey = true;
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      this.isLeftKey = true;
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      this.isRightKey = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
      if (this.isSpaceDown) {
        this.isSpaceDown = false;
        this.handleActionRelease();
      }
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      this.isDownKey = false;
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      this.isLeftKey = false;
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      this.isRightKey = false;
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.isRunning) return;
    e.preventDefault();
    this.isMouseDown = true;
    const pos = this.screenToWorld(e.clientX, e.clientY);
    this.handlePointerDown(pos.x, pos.y);
  };

  private onMouseMove = (e: MouseEvent) => {
    const pos = this.screenToWorld(e.clientX, e.clientY);
    if (this.isMouseDown) {
      this.handlePointerMove(pos.x, pos.y);
    }
  };

  private onMouseUp = () => {
    if (this.isMouseDown) {
      this.isMouseDown = false;
      this.handlePointerUp();
    }
  };

  private onTouchStart = (e: TouchEvent) => {
    if (!this.isRunning) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (this.touchId === null && touch) {
      this.touchId = touch.identifier;
      this.isMouseDown = true;
      const pos = this.screenToWorld(touch.clientX, touch.clientY);
      this.handlePointerDown(pos.x, pos.y);
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (this.touchId !== null) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchId) {
          const pos = this.screenToWorld(touch.clientX, touch.clientY);
          this.handlePointerMove(pos.x, pos.y);
          break;
        }
      }
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    if (this.touchId !== null) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchId) {
          this.touchId = null;
          this.isMouseDown = false;
          this.handlePointerUp();
          break;
        }
      }
    }
  };

  private handleActionPress() {
    if (this.player.state === 'flying') {
      // Spider-Man Hook mid-air!
      const nearest = findNearestNode(this.player, this.level.nodes, this.hookRange);
      if (nearest) {
        this.attachToNode(nearest);
      } else {
        this.reportMissedHook();
      }
    } else if (this.player.state === 'hooked') {
      // Release from hook
      this.detachFromNode();
    }
  }

  private handleActionRelease() {
    if (this.player.state === 'hooked' && !this.isMouseDown) {
      this.detachFromNode();
    }
  }

  private handlePointerDown(worldX: number, worldY: number) {
    if (this.player.state === 'hooked' || this.player.state === 'idle') {
      // Start slingshot aiming from current ball position!
      this.player.state = 'aiming';
      this.player.aimStartX = worldX;
      this.player.aimStartY = worldY;
      this.player.aimCurrX = worldX;
      this.player.aimCurrY = worldY;
      soundManager.startStretchSound();
    } else if (this.player.state === 'flying') {
      // Check if clicked near an anchor node or just click anywhere to grapple nearest
      const nearest = findNearestNode(this.player, this.level.nodes, this.hookRange);
      if (nearest) {
        this.attachToNode(nearest);
        // Also immediately allow slingshot aim if user keeps holding!
        this.player.state = 'aiming';
        this.player.aimStartX = worldX;
        this.player.aimStartY = worldY;
        this.player.aimCurrX = worldX;
        this.player.aimCurrY = worldY;
        soundManager.startStretchSound();
      }
    }
  }

  private handlePointerMove(worldX: number, worldY: number) {
    if (this.player.state === 'aiming') {
      this.player.aimCurrX = worldX;
      this.player.aimCurrY = worldY;
      const dist = Math.hypot(worldX - this.player.aimStartX, worldY - this.player.aimStartY);
      const ratio = Math.min(1.0, dist / MAX_SLINGSHOT_PULL);
      soundManager.updateStretchSound(ratio);
    }
  }

  private handlePointerUp() {
    if (this.player.state === 'aiming') {
      soundManager.stopStretchSound();
      const dx = this.player.aimStartX - this.player.aimCurrX;
      const dy = this.player.aimStartY - this.player.aimCurrY;
      const pullDist = Math.hypot(dx, dy);

      if (pullDist > 15) {
        // Enforce the run-wide launch budget.
        const launchesAvailable = this.launchesLeft();
        if (launchesAvailable !== null && launchesAvailable <= 0) {
          soundManager.playFail();
          this.addParticle(this.player.x, this.player.y - 28, 0, -44, 15, '#f43f5e', 'text', 'SEM IMPULSOS!');
          this.player.state = this.player.hookedNodeId ? 'hooked' : 'flying';
          return;
        }

        // Launch slingshot!
        const angle = Math.atan2(dy, dx);
        const powerRatio = Math.min(1.0, pullDist / MAX_SLINGSHOT_PULL);
        const speed = powerRatio * MAX_LAUNCH_SPEED;

        this.player.vx = Math.cos(angle) * speed;
        this.player.vy = Math.sin(angle) * speed;
        this.player.state = 'flying';

        // Releasing into a launch also puts the anchor on cooldown.
        const src = this.level.nodes.find(n => n.id === this.player.hookedNodeId);
        if (src && src.cooldown !== undefined) src.cooldownLeft = src.cooldown;
        this.player.hookedNodeId = null;

        this.player.launchesUsed++;
        const remaining = this.launchesLeft();
        if (remaining !== null && remaining <= 2) {
          this.warnResource('IMPULSOS', remaining);
        }
        this.emitResources();

        soundManager.playLaunch(powerRatio);
        this.addShake(8 * powerRatio);
        this.createExplosion(this.player.x, this.player.y, '#38bdf8', 15);

        // Add flying text if max power
        if (powerRatio > 0.9) {
          this.addParticle(this.player.x, this.player.y - 20, 0, -40, 16, '#f43f5e', 'text', 'PERFECT SLING!');
        }
      } else {
        // Cancel aim, return to hooked if we had a hook
        if (this.player.hookedNodeId) {
          this.player.state = 'hooked';
        } else {
          this.player.state = 'flying';
        }
      }
    } else if (this.player.state === 'hooked') {
      this.detachFromNode();
    }
  }

  /** Feedback when the player fires the rope with nothing in range. */
  private reportMissedHook() {
    soundManager.playFail();
    this.addParticle(this.player.x, this.player.y - 28, 0, -40, 14, '#94a3b8', 'text', 'FORA DE ALCANCE');
  }

  private attachToNode(node: AnchorNode) {
    // Enforce the run-wide hook budget before committing the grab.
    const left = this.hooksLeft();
    if (left !== null && left <= 0) {
      soundManager.playFail();
      this.addParticle(this.player.x, this.player.y - 28, 0, -44, 15, '#f43f5e', 'text', 'SEM GANCHOS!');
      return;
    }
    if (!isNodeAvailable(node)) {
      this.reportMissedHook();
      return;
    }

    this.player.hookedNodeId = node.id;
    this.player.state = 'hooked';
    const dist = Math.hypot(this.player.x - node.x, this.player.y - node.y);
    this.player.restLength = Math.max(60, dist);
    this.player.ropeLength = dist;
    this.player.combo++;
    this.player.maxCombo = Math.max(this.player.maxCombo, this.player.combo);

    // Consume resources: the global hook budget and the node's own durability.
    this.player.hooksUsed++;
    if (node.usesLeft !== undefined) {
      node.usesLeft--;
      if (node.usesLeft <= 0) {
        this.addParticle(node.x, node.y - 24, 0, -30, 13, '#f97316', 'text', 'GASTO');
      }
    }

    soundManager.playHook();
    this.addShake(3);
    this.createExplosion(node.x, node.y, '#a855f7', 12);

    const remaining = this.hooksLeft();
    if (remaining !== null && remaining <= 3) {
      this.warnResource('GANCHOS', remaining);
    }
    this.emitResources();

    if (this.player.combo >= 2) {
      const bonus = 50 * this.player.combo;
      this.score += bonus;
      this.addParticle(this.player.x, this.player.y - 30, 0, -50, 18, '#fbbf24', 'text', `COMBO x${this.player.combo}! +${bonus}`);
      this.callbacks.onScoreChange(this.score, this.coinsCollected, this.player.combo);
    }
  }

  private detachFromNode() {
    if (this.player.state === 'hooked' || this.player.state === 'aiming') {
      // Start the anchor's cooldown so it can't be immediately re-grabbed.
      const prev = this.level.nodes.find(n => n.id === this.player.hookedNodeId);
      if (prev && prev.cooldown !== undefined) {
        prev.cooldownLeft = prev.cooldown;
      }
      this.player.state = 'flying';
      this.player.hookedNodeId = null;
      soundManager.playRelease();
      this.createExplosion(this.player.x, this.player.y, '#6366f1', 8);
    }
  }

  // =================== GAME LOOP ===================
  private loop = (timestamp: number) => {
    if (!this.isRunning) return;
    const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.timeSpent += dt;

    // Hard time limit: running out of clock ends the run.
    const remainingTime = this.timeLeft();
    if (remainingTime !== null) {
      if (remainingTime <= 0) {
        this.triggerGameOver('O tempo acabou!');
        return;
      }
      // Audible countdown over the last 3 seconds.
      if (remainingTime <= 3) {
        const tick = Math.ceil(remainingTime);
        if (tick !== this.lastCountdownTick) {
          this.lastCountdownTick = tick;
          soundManager.playWarning();
        }
      }
    }
    this.emitResources();

    // Decay screen shake
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 45);
    }

    // Update moving anchor nodes and fragile nodes
    for (const node of this.level.nodes) {
      // Tick anchor re-grab cooldowns.
      if (node.cooldownLeft !== undefined && node.cooldownLeft > 0) {
        node.cooldownLeft = Math.max(0, node.cooldownLeft - dt);
      }
      if (node.type === 'moving' && node.movePath && node.movePath.length >= 2) {
        node.moveProgress = (node.moveProgress || 0) + (node.moveSpeed || 100) * dt;
        const p1 = node.movePath[0];
        const p2 = node.movePath[1];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const t = (Math.sin(node.moveProgress / (dist / 2)) + 1) / 2;
        node.x = p1.x + (p2.x - p1.x) * t;
        node.y = p1.y + (p2.y - p1.y) * t;
      }

      if (node.type === 'fragile' && this.player.hookedNodeId === node.id && !node.broken) {
        node.timer = (node.timer || 0) + dt;
        if (node.timer >= (node.maxTimer || 1.5)) {
          node.broken = true;
          this.createExplosion(node.x, node.y, '#ef4444', 25);
          soundManager.playDeath();
          this.addShake(8);
          if (this.player.hookedNodeId === node.id) {
            this.detachFromNode();
          }
        }
      }
    }

    // Update obstacles (sawblades moving)
    for (const obs of this.level.obstacles) {
      if (obs.type === 'sawblade' && obs.movePath && obs.movePath.length >= 2) {
        obs.moveProgress = (obs.moveProgress || 0) + (obs.moveSpeed || 120) * dt;
        const p1 = obs.movePath[0];
        const p2 = obs.movePath[1];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const t = (Math.sin(obs.moveProgress / (dist / 2)) + 1) / 2;
        obs.x = p1.x + (p2.x - p1.x) * t;
        obs.y = p1.y + (p2.y - p1.y) * t;
      }
    }

    // Update Player Physics
    if (this.player.state === 'hooked' || this.player.state === 'aiming') {
      const node = this.level.nodes.find(n => n.id === this.player.hookedNodeId);
      if (node && !node.broken) {
        updatePendulumPhysics(
          this.player,
          node,
          dt,
          this.isDownKey || (this.isSpaceDown && this.player.state === 'hooked'),
          this.gravityScale
        );
      } else {
        this.detachFromNode();
      }
    } else if (this.player.state === 'flying') {
      // Air control
      if (this.isLeftKey) this.player.vx -= 350 * dt;
      if (this.isRightKey) this.player.vx += 350 * dt;

      // Gravity
      this.player.vy += GRAVITY * this.gravityScale * dt;
      this.player.vx *= 0.999;
      this.player.vy *= 0.999;

      this.player.x += this.player.vx * dt;
      this.player.y += this.player.vy * dt;
    }

    // Endless Mode generator and Rising Plasma Grid
    if (this.isEndless) {
      if (this.player.y < this.highestYReached) {
        this.highestYReached = this.player.y;
        const heightMeters = Math.floor((this.level.startY - this.highestYReached) / 10);
        this.score = Math.max(this.score, heightMeters * 10 + this.coinsCollected * 100);
        this.callbacks.onScoreChange(this.score, this.coinsCollected, this.player.combo);
        if (this.callbacks.onHeightChange) {
          this.callbacks.onHeightChange(heightMeters);
        }
      }

      endlessGenerator.generateMore(
        this.player.y,
        this.level.nodes,
        this.level.obstacles,
        this.level.collectibles
      );

      /*
       * The plasma wall is the pacing engine of endless mode. It now scales
       * with BOTH height and elapsed time, so camping in a safe pocket is no
       * longer viable — the wall eventually catches any stationary player.
       */
      const heightM = Math.max(0, (this.level.startY - this.player.y) / 10);
      this.endlessIntensity = heightM / 100 + this.timeSpent / 45;

      const plasmaSpeed =
        95 + // faster baseline (was 50)
        Math.min(210, heightM * 0.55) + // height pressure
        Math.min(120, this.timeSpent * 1.6); // anti-camping time pressure

      // Catch-up: if the player pulls far ahead, the wall accelerates to keep
      // the screen tense instead of letting the run go on cruise control.
      const gap = this.plasmaY - (this.player.y + this.canvas.height * 0.45);
      const catchUp = gap > 0 ? Math.min(260, gap * 0.55) : 0;

      this.plasmaY -= (plasmaSpeed + catchUp) * dt;

      // If ball touches rising plasma -> Game Over!
      if (this.player.y + this.player.radius >= this.plasmaY) {
        this.triggerGameOver('O laser de plasma alcançou você!');
        return;
      }

      // If ball falls too far below camera -> Game Over
      if (this.player.y > this.camera.y + this.canvas.height + 200) {
        this.triggerGameOver('Você caiu no abismo!');
        return;
      }
    } else {
      // Adventure mode pit check
      if (this.player.y > this.level.bounds.height + 200) {
        this.triggerGameOver('Você caiu do nível!');
        return;
      }
    }

    // Collisions with Obstacles
    for (const obs of this.level.obstacles) {
      if (obs.type === 'wall') {
        const res = circleVsAABB(
          this.player.x,
          this.player.y,
          this.player.radius,
          obs.x,
          obs.y,
          obs.width || 10,
          obs.height || 10
        );
        if (res.collision && res.penetration > 0) {
          // Electrified / lethal surfaces kill instantly. Levels mark their
          // floor as lethal so the ground is a hazard, not a safety net.
          const isFloorContact = res.normalY < -0.5;
          if (obs.lethal || (this.rules.floorIsLethal && isFloorContact)) {
            this.triggerGameOver('Você tocou o solo eletrificado!');
            return;
          }

          this.player.x += res.normalX * res.penetration;
          this.player.y += res.normalY * res.penetration;

          // Reflect velocity
          const dot = this.player.vx * res.normalX + this.player.vy * res.normalY;
          if (dot < 0) {
            this.player.vx -= (1 + WALL_RESTITUTION) * dot * res.normalX;
            this.player.vy -= (1 + WALL_RESTITUTION) * dot * res.normalY;
            soundManager.playBounce();
            this.addShake(4);
            this.createExplosion(this.player.x, this.player.y, '#93c5fd', 8);

            // Wall contact costs a strike when the level limits bounces.
            this.player.wallHits++;
            const hitsLeft = this.wallHitsLeft();
            if (hitsLeft !== null) {
              if (hitsLeft <= 0) {
                this.triggerGameOver('Impactos na parede demais!');
                return;
              }
              this.warnResource('BATIDAS', hitsLeft);
              this.emitResources();
            }

            // Touch wall resets combo!
            if (this.player.combo > 0) {
              this.player.combo = 0;
              this.callbacks.onScoreChange(this.score, this.coinsCollected, 0);
            }
          }
        }
      } else if (obs.type === 'sawblade') {
        if (circleVsCircle(this.player.x, this.player.y, this.player.radius, obs.x, obs.y, obs.radius || 30)) {
          this.triggerGameOver('Destruído pela serra giratória!');
          return;
        }
      } else if (obs.type === 'laser') {
        if (
          obs.endX !== undefined &&
          obs.endY !== undefined &&
          circleVsLineSegment(
            this.player.x,
            this.player.y,
            this.player.radius,
            obs.x,
            obs.y,
            obs.endX,
            obs.endY
          )
        ) {
          this.triggerGameOver('Eletrocutado pelo laser!');
          return;
        }
      } else if (obs.type === 'wind' && obs.width && obs.height && obs.windDirection) {
        // Check if inside wind tunnel
        if (
          this.player.x >= obs.x &&
          this.player.x <= obs.x + obs.width &&
          this.player.y >= obs.y &&
          this.player.y <= obs.y + obs.height
        ) {
          const strength = obs.windStrength || 500;
          const mag = Math.hypot(obs.windDirection.x, obs.windDirection.y) || 1;
          this.player.vx += (obs.windDirection.x / mag) * strength * dt;
          this.player.vy += (obs.windDirection.y / mag) * strength * dt;
          if (Math.random() < 0.3) {
            this.addParticle(
              this.player.x + (Math.random() * 40 - 20),
              this.player.y + (Math.random() * 40 - 20),
              obs.windDirection.x * 0.5,
              obs.windDirection.y * 0.5,
              3,
              '#38bdf8',
              'spark'
            );
          }
        }
      } else if (obs.type === 'portal' && obs.portalTargetX !== undefined && obs.portalTargetY !== undefined) {
        if (circleVsCircle(this.player.x, this.player.y, this.player.radius, obs.x, obs.y, obs.radius || 35)) {
          // Teleport!
          this.player.x = obs.portalTargetX;
          this.player.y = obs.portalTargetY;
          soundManager.playPortal();
          this.createExplosion(obs.x, obs.y, obs.portalColor || '#ec4899', 20);
          this.createExplosion(obs.portalTargetX, obs.portalTargetY, obs.portalColor || '#ec4899', 20);
          this.addShake(6);
          // Small cooldown push away from target portal so we don't immediately re-trigger
          const speed = Math.hypot(this.player.vx, this.player.vy) || 300;
          if (speed < 200) {
            this.player.vy = -350;
          }
        }
      }
    }

    // Check Collectibles
    for (const col of this.level.collectibles) {
      if (!col.collected && circleVsCircle(this.player.x, this.player.y, this.player.radius, col.x, col.y, col.radius)) {
        col.collected = true;
        this.coinsCollected++;
        this.score += 100;
        soundManager.playCoin();
        this.createExplosion(col.x, col.y, '#facc15', 18);
        this.addParticle(col.x, col.y - 10, 0, -40, 16, '#facc15', 'text', '+100');
        this.callbacks.onScoreChange(this.score, this.coinsCollected, this.player.combo);
      }
    }

    // Check Goal Portal (Adventure Mode only)
    if (!this.isEndless) {
      if (
        circleVsCircle(
          this.player.x,
          this.player.y,
          this.player.radius,
          this.level.goalX,
          this.level.goalY,
          this.level.goalRadius
        )
      ) {
        this.triggerWin();
        return;
      }
    }

    // Update Player Trail
    this.player.trail.push({ x: this.player.x, y: this.player.y });
    if (this.player.trail.length > 18) {
      this.player.trail.shift();
    }
    if (Math.random() < 0.5) {
      this.addParticle(
        this.player.x + (Math.random() * 10 - 5),
        this.player.y + (Math.random() * 10 - 5),
        -this.player.vx * 0.1,
        -this.player.vy * 0.1,
        Math.random() * 4 + 2,
        this.getSkinColor(),
        'trail'
      );
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.type === 'spark' || p.type === 'trail') {
        p.size *= 0.96;
      }
      if (p.alpha <= 0 || p.size <= 0.2) {
        this.particles.splice(i, 1);
      }
    }

    // Update Ambient Stars
    for (const star of this.ambientStars) {
      star.y -= star.speed * dt;
      if (star.y < this.camera.y - 500) {
        star.y = this.camera.y + this.canvas.height + 500;
        star.x = this.camera.x + Math.random() * this.canvas.width;
      }
    }

    // Camera Tracking (Smooth Lerp)
    const targetCamX = this.player.x - this.canvas.width / 2;
    const targetCamY = this.player.y - this.canvas.height / 2;
    this.camera.x += (targetCamX - this.camera.x) * 8 * dt;
    this.camera.y += (targetCamY - this.camera.y) * 8 * dt;
  }

  private triggerGameOver(reason: string) {
    if (this.player.state === 'dead') return;
    this.player.state = 'dead';
    soundManager.playDeath();
    this.addShake(20);
    this.createExplosion(this.player.x, this.player.y, '#f43f5e', 40);
    
    const finalScore = this.score;
    const heightReached = Math.floor((this.level.startY - this.highestYReached) / 10);
    
    setTimeout(() => {
      this.stop();
      this.callbacks.onGameOver(reason, finalScore, heightReached);
    }, 800);
  }

  private triggerWin() {
    if (this.player.state === 'winning') return;
    this.player.state = 'winning';
    soundManager.playWin();
    this.addShake(12);
    this.createExplosion(this.level.goalX, this.level.goalY, '#facc15', 50);

    /*
     * Star awarding is deliberately demanding: finishing the level is the
     * entry ticket, not a 3-star result. The 2nd star requires full collection
     * AND a clean run (no wall impacts); the 3rd requires beating target time.
     */
    let stars = 1;
    const totalCoins = this.level.collectibles.length;
    const allCollected = totalCoins === 0 || this.coinsCollected >= totalCoins;
    const flawless = this.player.wallHits === 0;

    if (allCollected && flawless) stars++;
    if (this.timeSpent <= this.level.targetTime && allCollected) stars++;

    if (flawless && stars >= 2) {
      soundManager.playPerfect();
      this.addParticle(this.player.x, this.player.y - 40, 0, -50, 20, '#22d3ee', 'text', 'IMPECÁVEL!');
    }

    const stats: RunStats = {
      hooksUsed: this.player.hooksUsed,
      launchesUsed: this.player.launchesUsed,
      wallHits: this.player.wallHits,
      maxCombo: this.player.maxCombo,
      coins: this.coinsCollected,
      totalCoins,
      score: this.score,
      flawless
    };

    setTimeout(() => {
      this.stop();
      this.callbacks.onLevelWin(stars, this.timeSpent, stats);
    }, 900);
  }

  private getSkinColor(): string {
    const skin = this.settings.equippedBall;
    if (skin === 'cyber-ninja') return '#f43f5e';
    if (skin === 'dragon-egg') return '#10b981';
    if (skin === 'gold-sun') return '#facc15';
    if (skin === 'void-eye') return '#a855f7';
    if (skin === 'retro-8bit') return '#ec4899';
    return '#38bdf8'; // default plasma
  }

  // =================== RENDERING ===================
  private render() {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Screen Shake offset
    let offsetX = 0;
    let offsetY = 0;
    if (this.shake > 0) {
      offsetX = (Math.random() - 0.5) * this.shake * 2;
      offsetY = (Math.random() - 0.5) * this.shake * 2;
    }
    this.ctx.translate(-this.camera.x + offsetX, -this.camera.y + offsetY);

    // Draw Ambient Stars
    for (const star of this.ambientStars) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Draw Wind Tunnels
    for (const obs of this.level.obstacles) {
      if (obs.type === 'wind' && obs.width && obs.height) {
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        this.ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

        // Draw upward arrows inside wind tunnel
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        const arrowSpacing = 60;
        const offset = (performance.now() / 15) % arrowSpacing;
        for (let py = obs.y + obs.height - offset; py > obs.y; py -= arrowSpacing) {
          this.ctx.beginPath();
          this.ctx.moveTo(obs.x + obs.width / 2, py - 15);
          this.ctx.lineTo(obs.x + obs.width / 2 - 15, py + 5);
          this.ctx.lineTo(obs.x + obs.width / 2 + 15, py + 5);
          this.ctx.closePath();
          this.ctx.fill();
        }
      }
    }

    // Draw Portals
    for (const obs of this.level.obstacles) {
      if (obs.type === 'portal') {
        const angle = performance.now() / 200;
        const color = obs.portalColor || '#ec4899';
        this.ctx.save();
        this.ctx.translate(obs.x, obs.y);
        this.ctx.rotate(angle);
        
        // Swirling rings
        for (let r = (obs.radius || 35); r > 5; r -= 10) {
          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = 3;
          this.ctx.setLineDash([12, 6]);
          this.ctx.beginPath();
          this.ctx.arc(0, 0, r, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.rotate(-0.5);
        }
        this.ctx.restore();
      }
    }

    // Draw Goal Portal (Adventure Mode)
    if (!this.isEndless) {
      const angle = performance.now() / 300;
      this.ctx.save();
      this.ctx.translate(this.level.goalX, this.level.goalY);
      this.ctx.rotate(angle);
      
      // Outer glow
      const grad = this.ctx.createRadialGradient(0, 0, 10, 0, 0, this.level.goalRadius * 1.5);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.9)');
      grad.addColorStop(0.6, 'rgba(168, 85, 247, 0.5)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.level.goalRadius * 1.5, 0, Math.PI * 2);
      this.ctx.fill();

      // Swirling vortex lines
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 4;
      this.ctx.setLineDash([15, 10]);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.level.goalRadius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Draw Walls and Bumpers
    for (const obs of this.level.obstacles) {
      if (obs.type === 'wall') {
        // Lethal surfaces are tinted red and marked with an energy crackle so
        // the player can always tell a killer floor from a safe wall.
        const deadly = obs.lethal === true;
        this.ctx.fillStyle = deadly ? '#3b0d18' : '#1e293b';
        this.ctx.strokeStyle = deadly ? '#f43f5e' : '#3b82f6';
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(obs.x, obs.y, obs.width || 10, obs.height || 10);
        this.ctx.strokeRect(obs.x, obs.y, obs.width || 10, obs.height || 10);

        if (deadly) {
          this.ctx.save();
          this.ctx.strokeStyle = '#fb7185';
          this.ctx.lineWidth = 2;
          this.ctx.shadowColor = '#f43f5e';
          this.ctx.shadowBlur = 12;
          this.ctx.beginPath();
          const step = 22;
          const t = performance.now() / 120;
          for (let sx = obs.x; sx < obs.x + (obs.width || 10); sx += step) {
            const y1 = obs.y + 5 + Math.sin(sx / 30 + t) * 4;
            this.ctx.lineTo(sx, y1);
            this.ctx.lineTo(sx + step / 2, y1 + 7);
          }
          this.ctx.stroke();
          this.ctx.restore();
        }

        // Grid pattern on walls
        this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
        this.ctx.lineWidth = 1;
        for (let wx = obs.x; wx < obs.x + (obs.width || 10); wx += 30) {
          this.ctx.beginPath();
          this.ctx.moveTo(wx, obs.y);
          this.ctx.lineTo(wx, obs.y + (obs.height || 10));
          this.ctx.stroke();
        }
      }
    }

    // Draw Lasers
    for (const obs of this.level.obstacles) {
      if (obs.type === 'laser' && obs.endX !== undefined && obs.endY !== undefined) {
        // Pulse glow
        const alpha = 0.6 + Math.sin(performance.now() / 100) * 0.4;
        this.ctx.strokeStyle = `rgba(244, 63, 94, ${alpha})`;
        this.ctx.lineWidth = 6;
        this.ctx.shadowColor = '#f43f5e';
        this.ctx.shadowBlur = 15;
        this.ctx.beginPath();
        this.ctx.moveTo(obs.x, obs.y);
        this.ctx.lineTo(obs.endX, obs.endY);
        this.ctx.stroke();

        // Inner white laser core
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 0;
        this.ctx.beginPath();
        this.ctx.moveTo(obs.x, obs.y);
        this.ctx.lineTo(obs.endX, obs.endY);
        this.ctx.stroke();
      }
    }

    // Draw Sawblades
    for (const obs of this.level.obstacles) {
      if (obs.type === 'sawblade') {
        const rot = performance.now() / 50;
        const r = obs.radius || 35;
        this.ctx.save();
        this.ctx.translate(obs.x, obs.y);
        this.ctx.rotate(rot);

        // Outer teeth
        this.ctx.fillStyle = '#ef4444';
        this.ctx.shadowColor = '#ef4444';
        this.ctx.shadowBlur = 12;
        const teeth = 12;
        for (let i = 0; i < teeth; i++) {
          const angle = (i / teeth) * Math.PI * 2;
          this.ctx.beginPath();
          this.ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
          this.ctx.lineTo(Math.cos(angle + 0.2) * (r + 10), Math.sin(angle + 0.2) * (r + 10));
          this.ctx.lineTo(Math.cos(angle + 0.4) * r, Math.sin(angle + 0.4) * r);
          this.ctx.closePath();
          this.ctx.fill();
        }

        // Inner metallic disc
        this.ctx.fillStyle = '#334155';
        this.ctx.shadowBlur = 0;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
        this.ctx.fill();

        // Core glow
        this.ctx.fillStyle = '#f87171';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }

    // Draw Collectibles
    for (const col of this.level.collectibles) {
      if (!col.collected) {
        const hover = Math.sin(performance.now() / 200 + col.x) * 6;
        this.ctx.save();
        this.ctx.translate(col.x, col.y + hover);
        
        this.ctx.shadowColor = '#facc15';
        this.ctx.shadowBlur = 15;
        this.ctx.fillStyle = '#facc15';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, col.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Star / Coin inner shape
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, col.radius * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }

    // Draw Anchor Nodes
    for (const node of this.level.nodes) {
      if (node.broken) continue;

      const isHooked = this.player.hookedNodeId === node.id;
      let color = '#38bdf8'; // default cyan
      if (node.type === 'moving') color = '#a855f7';
      if (node.type === 'fragile') color = '#f97316';

      // Spent or cooling anchors are dimmed so the player can read the board.
      const available = isNodeAvailable(node);
      const isSpent = node.usesLeft !== undefined && node.usesLeft <= 0;

      this.ctx.save();
      this.ctx.translate(node.x, node.y);
      if (!available) this.ctx.globalAlpha = 0.32;

      // Grab-range indicator on the nearest reachable anchor while airborne.
      if (this.player.state === 'flying' && available) {
        const d = Math.hypot(this.player.x - node.x, this.player.y - node.y);
        if (d < this.hookRange) {
          this.ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([4, 6]);
          this.ctx.beginPath();
          this.ctx.arc(0, 0, node.radius * 2.1, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.setLineDash([]);
        }
      }

      // Pulse ring
      const pulse = 1 + Math.sin(performance.now() / 150) * 0.15;
      this.ctx.strokeStyle = isHooked ? '#ffffff' : color;
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = isHooked ? 20 : 10;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, node.radius * pulse * 1.4, 0, Math.PI * 2);
      this.ctx.stroke();

      // Node core
      this.ctx.fillStyle = isHooked ? '#ffffff' : color;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, node.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Remaining uses as orbiting pips around limited anchors.
      if (node.maxUses !== undefined && !isSpent) {
        const left = node.usesLeft ?? node.maxUses;
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#fbbf24';
        for (let u = 0; u < left; u++) {
          const a = -Math.PI / 2 + (u / Math.max(1, node.maxUses)) * Math.PI * 2;
          this.ctx.beginPath();
          this.ctx.arc(Math.cos(a) * (node.radius + 11), Math.sin(a) * (node.radius + 11), 3, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      // Cooldown sweep on anchors waiting to recharge.
      if (node.cooldown && node.cooldownLeft && node.cooldownLeft > 0) {
        const prog = node.cooldownLeft / node.cooldown;
        this.ctx.strokeStyle = '#64748b';
        this.ctx.lineWidth = 3;
        this.ctx.shadowBlur = 0;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, node.radius + 6, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        this.ctx.stroke();
      }

      // Burnt-out anchors get a clear "X".
      if (isSpent) {
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 3;
        this.ctx.shadowBlur = 0;
        const s = node.radius * 0.6;
        this.ctx.beginPath();
        this.ctx.moveTo(-s, -s);
        this.ctx.lineTo(s, s);
        this.ctx.moveTo(s, -s);
        this.ctx.lineTo(-s, s);
        this.ctx.stroke();
      }

      // If fragile, draw timer arc if active
      if (node.type === 'fragile' && isHooked && node.timer !== undefined && node.maxTimer) {
        const progress = node.timer / node.maxTimer;
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, node.radius + 8, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.restore();
    }

    // Draw Elastic Rope (Corda Elástica)
    if (this.player.state === 'hooked' || (this.player.state === 'aiming' && this.player.hookedNodeId)) {
      const node = this.level.nodes.find(n => n.id === this.player.hookedNodeId);
      if (node && !node.broken) {
        const dist = Math.hypot(this.player.x - node.x, this.player.y - node.y);
        const stretchRatio = Math.max(0, (dist - this.player.restLength) / 100);

        // Color shifts from cyan to neon pink/white when stretched high!
        let ropeColor = '#38bdf8';
        if (stretchRatio > 0.5) ropeColor = '#a855f7';
        if (stretchRatio > 1.0) ropeColor = '#f43f5e';

        this.ctx.save();
        this.ctx.strokeStyle = ropeColor;
        this.ctx.lineWidth = Math.max(2, 5 - stretchRatio * 1.5);
        this.ctx.shadowColor = ropeColor;
        this.ctx.shadowBlur = 15;
        this.ctx.beginPath();
        this.ctx.moveTo(node.x, node.y);
        this.ctx.lineTo(this.player.x, this.player.y);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    // Draw Slingshot Trajectory Prediction & Vector Line
    if (this.player.state === 'aiming') {
      const dx = this.player.aimStartX - this.player.aimCurrX;
      const dy = this.player.aimStartY - this.player.aimCurrY;
      const pullDist = Math.hypot(dx, dy);

      if (pullDist > 15) {
        // Draw stretch vector line behind ball
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(244, 63, 94, 0.8)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([6, 6]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.player.aimStartX, this.player.aimStartY);
        this.ctx.lineTo(this.player.aimCurrX, this.player.aimCurrY);
        this.ctx.stroke();

        // Draw trajectory dots
        if (this.settings.showTrajectory) {
          const aimX = this.player.x - dx;
          const aimY = this.player.y - dy;
          const trajectory = calculateSlingshotTrajectory(
            this.player.x,
            this.player.y,
            aimX,
            aimY,
            GRAVITY
          );

          this.ctx.fillStyle = '#38bdf8';
          this.ctx.shadowColor = '#38bdf8';
          this.ctx.shadowBlur = 8;
          for (let i = 0; i < trajectory.length; i++) {
            const pt = trajectory[i];
            const size = Math.max(1.5, 5 * (1 - i / trajectory.length));
            this.ctx.beginPath();
            this.ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
        this.ctx.restore();
      }
    }

    // Draw Player Trail
    if (this.player.trail.length > 1 && this.player.state !== 'dead') {
      this.ctx.save();
      for (let i = 0; i < this.player.trail.length - 1; i++) {
        const pt1 = this.player.trail[i];
        const pt2 = this.player.trail[i + 1];
        const alpha = (i / this.player.trail.length) * 0.6;
        this.ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
        this.ctx.lineWidth = Math.max(1, (i / this.player.trail.length) * this.player.radius * 1.2);
        this.ctx.beginPath();
        this.ctx.moveTo(pt1.x, pt1.y);
        this.ctx.lineTo(pt2.x, pt2.y);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // Draw Particles
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      if (p.type === 'text' && p.text) {
        this.ctx.font = '800 16px Orbitron, sans-serif';
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 8;
        this.ctx.fillText(p.text, p.x, p.y);
      } else {
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 6;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    // Draw Player Ball
    if (this.player.state !== 'dead') {
      const skinColor = this.getSkinColor();
      this.ctx.save();
      this.ctx.translate(this.player.x, this.player.y);

      // Dynamic squash & stretch based on velocity
      const speed = Math.hypot(this.player.vx, this.player.vy);
      if (speed > 200 && (this.player.state === 'flying' || this.player.state === 'hooked')) {
        const angle = Math.atan2(this.player.vy, this.player.vx);
        this.ctx.rotate(angle);
        const stretch = Math.min(1.4, 1 + speed / 3000);
        const squash = 1 / Math.sqrt(stretch);
        this.ctx.scale(stretch, squash);
        this.ctx.rotate(-angle);
      }

      // Outer glow bloom
      this.ctx.shadowColor = skinColor;
      this.ctx.shadowBlur = 20;
      this.ctx.fillStyle = skinColor;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, this.player.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Inner white specular core
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowBlur = 0;
      this.ctx.beginPath();
      this.ctx.arc(-4, -4, this.player.radius * 0.35, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    }

    // Draw Rising Plasma Grid (Endless Mode)
    if (this.isEndless) {
      this.ctx.save();
      const plasmaGrad = this.ctx.createLinearGradient(0, this.plasmaY, 0, this.plasmaY + 300);
      plasmaGrad.addColorStop(0, 'rgba(244, 63, 94, 0.9)');
      plasmaGrad.addColorStop(0.2, 'rgba(236, 72, 153, 0.6)');
      plasmaGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
      
      this.ctx.fillStyle = plasmaGrad;
      this.ctx.fillRect(this.camera.x - 500, this.plasmaY, this.canvas.width + 1000, 1500);

      // Plasma wave top border
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 4;
      this.ctx.shadowColor = '#f43f5e';
      this.ctx.shadowBlur = 15;
      this.ctx.beginPath();
      this.ctx.moveTo(this.camera.x - 500, this.plasmaY);
      for (let x = this.camera.x - 500; x < this.camera.x + this.canvas.width + 500; x += 30) {
        const waveY = this.plasmaY + Math.sin(x / 40 + performance.now() / 150) * 8;
        this.ctx.lineTo(x, waveY);
      }
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.ctx.restore();
  }
}
