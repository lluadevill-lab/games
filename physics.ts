import { AnchorNode, Obstacle, Collectible, LevelData } from '../types/game';

export class EndlessGenerator {
  private highestYGenerated: number = 200;
  private nodeIdCounter: number = 0;
  private obsIdCounter: number = 0;
  private colIdCounter: number = 0;
  private sectionCount: number = 0;

  constructor() {
    this.reset();
  }

  public reset() {
    this.highestYGenerated = 200;
    this.nodeIdCounter = 0;
    this.obsIdCounter = 0;
    this.colIdCounter = 0;
    this.sectionCount = 0;
  }

  public getInitialLevel(): {
    level: LevelData;
    plasmaY: number;
  } {
    this.reset();
    
    const nodes: AnchorNode[] = [
      { id: 'start_n1', x: 250, y: 550, radius: 16, type: 'normal' },
      { id: 'start_n2', x: 550, y: 350, radius: 16, type: 'normal' },
      { id: 'start_n3', x: 300, y: 150, radius: 16, type: 'normal' }
    ];

    const obstacles: Obstacle[] = [
      { id: 'wall_left', type: 'wall', x: 0, y: -50000, width: 40, height: 52000 },
      { id: 'wall_right', type: 'wall', x: 760, y: -50000, width: 40, height: 52000 },
      { id: 'floor', type: 'wall', x: 0, y: 700, width: 800, height: 50 }
    ];

    const collectibles: Collectible[] = [
      { id: 'start_c1', type: 'coin', x: 400, y: 250, radius: 16 }
    ];

    const level: LevelData = {
      id: 999,
      title: 'Escalada Infinita',
      world: 4,
      startX: 250,
      startY: 550,
      goalX: 400,
      goalY: -1000000,
      goalRadius: 10,
      bounds: { width: 800, height: 1000000 },
      nodes,
      obstacles,
      collectibles,
      targetTime: 999
    };

    return {
      level,
      plasmaY: 850
    };
  }

  public generateMore(playerY: number, nodes: AnchorNode[], obstacles: Obstacle[], collectibles: Collectible[]) {
    // Generate new content when player gets within 800px of the highest generated point
    while (playerY < this.highestYGenerated + 800) {
      this.sectionCount++;
      const sectionHeight = 350;
      const topY = this.highestYGenerated - sectionHeight;

      // Determine difficulty scaling
      const difficulty = Math.min(10, Math.floor(this.sectionCount / 3));

      // Generate 2 or 3 anchor nodes in this section
      const nodeCount = 2 + (Math.random() > 0.4 ? 1 : 0);
      for (let i = 0; i < nodeCount; i++) {
        const x = 120 + Math.random() * 560;
        const y = topY + (i / nodeCount) * sectionHeight + (Math.random() * 60 - 30);
        
        let type: 'normal' | 'moving' | 'fragile' = 'normal';
        const rand = Math.random();
        if (difficulty >= 2 && rand < 0.25) {
          type = 'fragile';
        } else if (difficulty >= 3 && rand > 0.7) {
          type = 'moving';
        }

        const node: AnchorNode = {
          id: `endless_node_${this.nodeIdCounter++}`,
          x,
          y,
          radius: 16,
          type
        };

        if (type === 'moving') {
          const moveRange = 80 + Math.random() * 120;
          node.movePath = [
            { x: Math.max(80, x - moveRange), y },
            { x: Math.min(720, x + moveRange), y }
          ];
          node.moveSpeed = 100 + difficulty * 15;
        } else if (type === 'fragile') {
          node.maxTimer = Math.max(1.0, 1.8 - difficulty * 0.1);
        }

        nodes.push(node);
      }

      // Generate hazards (Sawblades or Lasers) based on difficulty
      if (difficulty >= 1 && Math.random() < 0.7) {
        const obsType = (difficulty >= 2 && Math.random() > 0.5) ? 'laser' : 'sawblade';
        const obsX = 150 + Math.random() * 500;
        const obsY = topY + sectionHeight * 0.5;

        if (obsType === 'sawblade') {
          const isMoving = difficulty >= 4 && Math.random() < 0.4;
          const saw: Obstacle = {
            id: `endless_obs_${this.obsIdCounter++}`,
            type: 'sawblade',
            x: obsX,
            y: obsY,
            radius: 35 + Math.random() * 20
          };
          if (isMoving) {
            saw.movePath = [
              { x: obsX - 100, y: obsY },
              { x: obsX + 100, y: obsY }
            ];
            saw.moveSpeed = 120;
          }
          obstacles.push(saw);
        } else {
          // Laser beam
          const laser: Obstacle = {
            id: `endless_obs_${this.obsIdCounter++}`,
            type: 'laser',
            x: obsX - 120,
            y: obsY,
            endX: obsX + 120,
            endY: obsY
          };
          obstacles.push(laser);
        }
      }

      // Generate coins / collectibles
      if (Math.random() < 0.65) {
        collectibles.push({
          id: `endless_col_${this.colIdCounter++}`,
          type: 'coin',
          x: 140 + Math.random() * 520,
          y: topY + Math.random() * sectionHeight,
          radius: 16
        });
      }

      this.highestYGenerated = topY;
    }

    // Clean up nodes and obstacles that are far below the camera to save memory
    const cleanupThreshold = playerY + 1400;
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].y > cleanupThreshold && !nodes[i].id.startsWith('start_')) {
        nodes.splice(i, 1);
      }
    }
    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (obstacles[i].y > cleanupThreshold && obstacles[i].id !== 'wall_left' && obstacles[i].id !== 'wall_right') {
        obstacles.splice(i, 1);
      }
    }
    for (let i = collectibles.length - 1; i >= 0; i--) {
      if (collectibles[i].y > cleanupThreshold) {
        collectibles.splice(i, 1);
      }
    }
  }
}

export const endlessGenerator = new EndlessGenerator();
