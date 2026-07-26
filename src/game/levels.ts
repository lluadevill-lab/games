import { LevelData } from '../types/game';

export const WORLDS = [
  {
    id: 1,
    name: 'Laboratório Neon',
    subtitle: 'Mundo 1: Aprendendo o Lançamento e o Pêndulo',
    color: '#6366f1',
    bgGradient: 'from-indigo-950/80 via-slate-950 to-slate-950',
    description: 'Balança de ponto em ponto e domine o estilingue elástico.'
  },
  {
    id: 2,
    name: 'Indústria Cibernética',
    subtitle: 'Mundo 2: Serras Giratórias, Lasers e Rebatedores',
    color: '#f43f5e',
    bgGradient: 'from-rose-950/80 via-slate-950 to-slate-950',
    description: 'Perigos móveis, pontos frágeis e extrema velocidade.'
  },
  {
    id: 3,
    name: 'Abismo de Plasma',
    subtitle: 'Mundo 3: Portais, Túneis de Vento e Gravidade Zero',
    color: '#06b6d4',
    bgGradient: 'from-cyan-950/80 via-slate-950 to-slate-950',
    description: 'O teste supremo de acrobacias aéreas no vácuo de plasma.'
  }
];

export const CAMPAIGN_LEVELS: LevelData[] = [
  // =================== WORLD 1: LABORATÓRIO NEON (1-5) ===================
  {
    id: 1,
    title: 'O Primeiro Salto',
    world: 1,
    description: 'Toque e arraste para trás para esticar o elástico. Solte para lançar!',
    startX: 200,
    startY: 400,
    goalX: 900,
    goalY: 400,
    goalRadius: 40,
    bounds: { width: 1200, height: 700 },
    targetTime: 5,
    nodes: [
      { id: 'n1', x: 200, y: 400, radius: 16, type: 'normal' },
      { id: 'n2', x: 550, y: 250, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 650, width: 1200, height: 50 },
      { id: 'w2', type: 'wall', x: 0, y: 0, width: 1200, height: 50 },
      { id: 'w3', type: 'wall', x: 0, y: 0, width: 50, height: 700 },
      { id: 'w4', type: 'wall', x: 1150, y: 0, width: 50, height: 700 },
      { id: 'p1', type: 'wall', x: 450, y: 450, width: 200, height: 200 } // Pit block
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 350, y: 350, radius: 18 },
      { id: 'c2', type: 'star', x: 550, y: 160, radius: 18 },
      { id: 'c3', type: 'star', x: 750, y: 350, radius: 18 }
    ]
  },
  {
    id: 2,
    title: 'O Balanço do Pêndulo',
    world: 1,
    description: 'No ar, toque para engatar no próximo ponto e balançar como um pêndulo!',
    startX: 150,
    startY: 300,
    goalX: 1100,
    goalY: 300,
    goalRadius: 40,
    bounds: { width: 1300, height: 700 },
    targetTime: 6,
    nodes: [
      { id: 'n1', x: 150, y: 300, radius: 16, type: 'normal' },
      { id: 'n2', x: 450, y: 180, radius: 16, type: 'normal' },
      { id: 'n3', x: 800, y: 180, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 650, width: 1300, height: 50 },
      { id: 'l1', type: 'laser', x: 300, y: 640, endX: 950, endY: 640 }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 450, y: 380, radius: 18 },
      { id: 'c2', type: 'star', x: 625, y: 250, radius: 18 },
      { id: 'c3', type: 'star', x: 800, y: 380, radius: 18 }
    ]
  },
  {
    id: 3,
    title: 'Salto Acrobático',
    world: 1,
    description: 'Use o impulso do balanço para alcançar grandes distâncias!',
    startX: 150,
    startY: 500,
    goalX: 1250,
    goalY: 200,
    goalRadius: 40,
    bounds: { width: 1400, height: 800 },
    targetTime: 8,
    nodes: [
      { id: 'n1', x: 150, y: 500, radius: 16, type: 'normal' },
      { id: 'n2', x: 400, y: 300, radius: 16, type: 'normal' },
      { id: 'n3', x: 750, y: 200, radius: 16, type: 'normal' },
      { id: 'n4', x: 1050, y: 300, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 750, width: 1400, height: 50 },
      { id: 'l1', type: 'laser', x: 250, y: 740, endX: 1150, endY: 740 },
      { id: 'w2', type: 'wall', x: 600, y: 450, width: 50, height: 300 }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 400, y: 500, radius: 18 },
      { id: 'c2', type: 'star', x: 750, y: 380, radius: 18 },
      { id: 'c3', type: 'star', x: 1050, y: 150, radius: 18 }
    ]
  },
  {
    id: 4,
    title: 'Rebatendo na Parede',
    world: 1,
    description: 'As paredes são elásticas! Rebata nelas para mudar de direção e ganhar altura.',
    startX: 150,
    startY: 200,
    goalX: 900,
    goalY: 600,
    goalRadius: 40,
    bounds: { width: 1100, height: 800 },
    targetTime: 7,
    nodes: [
      { id: 'n1', x: 150, y: 200, radius: 16, type: 'normal' },
      { id: 'n2', x: 550, y: 200, radius: 16, type: 'normal' },
      { id: 'n3', x: 550, y: 500, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 750, width: 1100, height: 50 },
      { id: 'w2', type: 'wall', x: 350, y: 350, width: 400, height: 50 }, // middle shelf
      { id: 'w3', type: 'wall', x: 700, y: 150, width: 50, height: 250 }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 350, y: 180, radius: 18 },
      { id: 'c2', type: 'star', x: 650, y: 300, radius: 18 },
      { id: 'c3', type: 'star', x: 550, y: 650, radius: 18 }
    ]
  },
  {
    id: 5,
    title: 'O Teste do Laboratório',
    world: 1,
    description: 'Combine tudo o que aprendeu: estilingue, balanço contínuo e reflexos!',
    startX: 150,
    startY: 600,
    goalX: 1350,
    goalY: 200,
    goalRadius: 45,
    bounds: { width: 1500, height: 800 },
    targetTime: 10,
    nodes: [
      { id: 'n1', x: 150, y: 600, radius: 16, type: 'normal' },
      { id: 'n2', x: 450, y: 400, radius: 16, type: 'normal' },
      { id: 'n3', x: 800, y: 250, radius: 16, type: 'normal' },
      { id: 'n4', x: 1100, y: 400, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 750, width: 1500, height: 50 },
      { id: 'l1', type: 'laser', x: 300, y: 740, endX: 1300, endY: 740 },
      { id: 'w2', type: 'wall', x: 600, y: 0, width: 50, height: 350 },
      { id: 'w3', type: 'wall', x: 950, y: 450, width: 50, height: 300 }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 450, y: 600, radius: 18 },
      { id: 'c2', type: 'star', x: 800, y: 450, radius: 18 },
      { id: 'c3', type: 'star', x: 1100, y: 150, radius: 18 }
    ]
  },

  // =================== WORLD 2: INDÚSTRIA CIBERNÉTICA (6-10) ===================
  {
    id: 6,
    title: 'Serras Giratórias',
    world: 2,
    description: 'Evite as serras de plasma! Calcule bem o tempo de soltar a corda.',
    startX: 150,
    startY: 350,
    goalX: 1150,
    goalY: 350,
    goalRadius: 40,
    bounds: { width: 1300, height: 700 },
    targetTime: 7,
    nodes: [
      { id: 'n1', x: 150, y: 350, radius: 16, type: 'normal' },
      { id: 'n2', x: 450, y: 200, radius: 16, type: 'normal' },
      { id: 'n3', x: 850, y: 200, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 650, width: 1300, height: 50 },
      { id: 'w2', type: 'wall', x: 0, y: 0, width: 1300, height: 50 },
      { id: 's1', type: 'sawblade', x: 450, y: 480, radius: 55 },
      { id: 's2', type: 'sawblade', x: 650, y: 250, radius: 45 },
      { id: 's3', type: 'sawblade', x: 850, y: 480, radius: 55 }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 450, y: 320, radius: 18 },
      { id: 'c2', type: 'star', x: 650, y: 450, radius: 18 },
      { id: 'c3', type: 'star', x: 850, y: 320, radius: 18 }
    ]
  },
  {
    id: 7,
    title: 'Ganchos Frágeis',
    world: 2,
    description: 'Pontos vermelhos quebram depois de 1.5 segundo! Seja rápido e decisivo.',
    startX: 150,
    startY: 500,
    goalX: 1250,
    goalY: 300,
    goalRadius: 45,
    bounds: { width: 1400, height: 800 },
    targetTime: 8,
    nodes: [
      { id: 'n1', x: 150, y: 500, radius: 16, type: 'normal' },
      { id: 'n2', x: 450, y: 250, radius: 16, type: 'fragile', maxTimer: 1.5 },
      { id: 'n3', x: 750, y: 250, radius: 16, type: 'fragile', maxTimer: 1.5 },
      { id: 'n4', x: 1050, y: 250, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 750, width: 1400, height: 50 },
      { id: 'l1', type: 'laser', x: 300, y: 740, endX: 1200, endY: 740 },
      { id: 's1', type: 'sawblade', x: 600, y: 500, radius: 60 },
      { id: 's2', type: 'sawblade', x: 900, y: 500, radius: 60 }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 450, y: 420, radius: 18 },
      { id: 'c2', type: 'star', x: 750, y: 420, radius: 18 },
      { id: 'c3', type: 'star', x: 1050, y: 420, radius: 18 }
    ]
  },
  {
    id: 8,
    title: 'Corredor de Lasers',
    world: 2,
    description: 'Passe pelas aberturas entre os feixes de laser sem tocar neles.',
    startX: 150,
    startY: 400,
    goalX: 1350,
    goalY: 400,
    goalRadius: 40,
    bounds: { width: 1500, height: 800 },
    targetTime: 9,
    nodes: [
      { id: 'n1', x: 150, y: 400, radius: 16, type: 'normal' },
      { id: 'n2', x: 450, y: 200, radius: 16, type: 'normal' },
      { id: 'n3', x: 750, y: 600, radius: 16, type: 'normal' },
      { id: 'n4', x: 1050, y: 200, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 750, width: 1500, height: 50 },
      { id: 'w2', type: 'wall', x: 0, y: 0, width: 1500, height: 50 },
      { id: 'l1', type: 'laser', x: 600, y: 0, endX: 600, endY: 350 },
      { id: 'l2', type: 'laser', x: 600, y: 500, endX: 600, endY: 750 },
      { id: 'l3', type: 'laser', x: 900, y: 0, endX: 900, endY: 250 },
      { id: 'l4', type: 'laser', x: 900, y: 400, endX: 900, endY: 750 }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 600, y: 425, radius: 18 },
      { id: 'c2', type: 'star', x: 900, y: 325, radius: 18 },
      { id: 'c3', type: 'star', x: 1200, y: 400, radius: 18 }
    ]
  },
  {
    id: 9,
    title: 'Plataformas Elásticas',
    world: 2,
    description: 'Bata nas plataformas de rebote (bumpers) azuis para ganhar super impulso!',
    startX: 150,
    startY: 600,
    goalX: 1300,
    goalY: 150,
    goalRadius: 40,
    bounds: { width: 1400, height: 800 },
    targetTime: 8,
    nodes: [
      { id: 'n1', x: 150, y: 600, radius: 16, type: 'normal' },
      { id: 'n2', x: 600, y: 350, radius: 16, type: 'normal' },
      { id: 'n3', x: 1000, y: 250, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 750, width: 1400, height: 50 },
      { id: 'n_b1', type: 'sawblade', x: 350, y: 680, radius: 40 },
      // Bumpers represented as bouncing obstacles or special nodes
      { id: 'b1', type: 'wall', x: 400, y: 600, width: 160, height: 30 }, // Will act as bumper
      { id: 'b2', type: 'wall', x: 800, y: 500, width: 160, height: 30 }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 480, y: 450, radius: 18 },
      { id: 'c2', type: 'star', x: 880, y: 350, radius: 18 },
      { id: 'c3', type: 'star', x: 1150, y: 200, radius: 18 }
    ]
  },
  {
    id: 10,
    title: 'A Fábrica de Perigos',
    world: 2,
    description: 'Um desafio supremo mecânico com serras móveis e ganchos frágeis!',
    startX: 150,
    startY: 600,
    goalX: 1450,
    goalY: 300,
    goalRadius: 45,
    bounds: { width: 1600, height: 800 },
    targetTime: 12,
    nodes: [
      { id: 'n1', x: 150, y: 600, radius: 16, type: 'normal' },
      { id: 'n2', x: 450, y: 300, radius: 16, type: 'fragile', maxTimer: 1.4 },
      { id: 'n3', x: 800, y: 200, radius: 16, type: 'normal' },
      { id: 'n4', x: 1150, y: 300, radius: 16, type: 'fragile', maxTimer: 1.4 }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 750, width: 1600, height: 50 },
      { id: 'l1', type: 'laser', x: 300, y: 740, endX: 1500, endY: 740 },
      { 
        id: 's1', 
        type: 'sawblade', 
        x: 600, 
        y: 400, 
        radius: 50,
        movePath: [{ x: 600, y: 250 }, { x: 600, y: 550 }],
        moveSpeed: 150
      },
      { 
        id: 's2', 
        type: 'sawblade', 
        x: 950, 
        y: 400, 
        radius: 50,
        movePath: [{ x: 950, y: 550 }, { x: 950, y: 250 }],
        moveSpeed: 150
      }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 450, y: 500, radius: 18 },
      { id: 'c2', type: 'star', x: 800, y: 400, radius: 18 },
      { id: 'c3', type: 'star', x: 1150, y: 500, radius: 18 }
    ]
  },

  // =================== WORLD 3: ABISMO DE PLASMA (11-15) ===================
  {
    id: 11,
    title: 'Túneis de Vento',
    world: 3,
    description: 'Feixes de vento empurram sua bolinha no ar! Aproveite a aerodinâmica.',
    startX: 150,
    startY: 400,
    goalX: 1350,
    goalY: 400,
    goalRadius: 40,
    bounds: { width: 1500, height: 800 },
    targetTime: 8,
    nodes: [
      { id: 'n1', x: 150, y: 400, radius: 16, type: 'normal' },
      { id: 'n2', x: 500, y: 500, radius: 16, type: 'normal' },
      { id: 'n3', x: 950, y: 500, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 750, width: 1500, height: 50 },
      { id: 'w2', type: 'wall', x: 0, y: 0, width: 1500, height: 50 },
      // Wind tunnels
      { id: 'wind1', type: 'wind', x: 300, y: 150, width: 150, height: 500, windDirection: { x: 0, y: -600 }, windStrength: 600 },
      { id: 'wind2', type: 'wind', x: 750, y: 150, width: 150, height: 500, windDirection: { x: 0, y: -600 }, windStrength: 600 }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 375, y: 200, radius: 18 },
      { id: 'c2', type: 'star', x: 725, y: 350, radius: 18 },
      { id: 'c3', type: 'star', x: 1150, y: 400, radius: 18 }
    ]
  },
  {
    id: 12,
    title: 'Ganchos em Órbita',
    world: 3,
    description: 'Os pontos de ancoragem estão se movendo no espaço! Calcule a trajetória.',
    startX: 150,
    startY: 400,
    goalX: 1350,
    goalY: 400,
    goalRadius: 45,
    bounds: { width: 1500, height: 800 },
    targetTime: 9,
    nodes: [
      { id: 'n1', x: 150, y: 400, radius: 16, type: 'normal' },
      { 
        id: 'n2', 
        x: 450, 
        y: 250, 
        radius: 16, 
        type: 'moving',
        movePath: [{ x: 450, y: 200 }, { x: 450, y: 500 }],
        moveSpeed: 120
      },
      { 
        id: 'n3', 
        x: 800, 
        y: 400, 
        radius: 16, 
        type: 'moving',
        movePath: [{ x: 700, y: 300 }, { x: 900, y: 300 }],
        moveSpeed: 140
      },
      { 
        id: 'n4', 
        x: 1100, 
        y: 350, 
        radius: 16, 
        type: 'moving',
        movePath: [{ x: 1100, y: 500 }, { x: 1100, y: 200 }],
        moveSpeed: 120
      }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 750, width: 1500, height: 50 },
      { id: 'l1', type: 'laser', x: 300, y: 740, endX: 1300, endY: 740 }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 450, y: 350, radius: 18 },
      { id: 'c2', type: 'star', x: 800, y: 480, radius: 18 },
      { id: 'c3', type: 'star', x: 1100, y: 350, radius: 18 }
    ]
  },
  {
    id: 13,
    title: 'Portais Quânticos',
    world: 3,
    description: 'Entre em um portal para sair em outro com a mesma velocidade do lançamento!',
    startX: 150,
    startY: 600,
    goalX: 1350,
    goalY: 200,
    goalRadius: 40,
    bounds: { width: 1500, height: 800 },
    targetTime: 8,
    nodes: [
      { id: 'n1', x: 150, y: 600, radius: 16, type: 'normal' },
      { id: 'n2', x: 400, y: 400, radius: 16, type: 'normal' },
      { id: 'n3', x: 1000, y: 250, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 750, width: 1500, height: 50 },
      { id: 'w2', type: 'wall', x: 650, y: 0, width: 100, height: 800 }, // Solid dividing wall!
      // Portal pair A -> B
      { id: 'p_in', type: 'portal', x: 550, y: 550, radius: 45, portalTargetX: 800, portalTargetY: 200, portalColor: '#ec4899' },
      { id: 'p_out', type: 'portal', x: 800, y: 200, radius: 45, portalTargetX: 550, portalTargetY: 550, portalColor: '#a855f7' }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 400, y: 550, radius: 18 },
      { id: 'c2', type: 'star', x: 900, y: 200, radius: 18 },
      { id: 'c3', type: 'star', x: 1200, y: 250, radius: 18 }
    ]
  },
  {
    id: 14,
    title: 'Gravidade Zero e Vácuo',
    world: 3,
    description: 'Nesta câmara, a gravidade é 50% menor! Voe longe com seus estiramentos de elástico.',
    startX: 150,
    startY: 400,
    goalX: 1350,
    goalY: 400,
    goalRadius: 45,
    bounds: { width: 1500, height: 800 },
    targetTime: 9,
    nodes: [
      { id: 'n1', x: 150, y: 400, radius: 16, type: 'normal' },
      { id: 'n2', x: 550, y: 200, radius: 16, type: 'normal' },
      { id: 'n3', x: 550, y: 600, radius: 16, type: 'normal' },
      { id: 'n4', x: 950, y: 400, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 750, width: 1500, height: 50 },
      { id: 'w2', type: 'wall', x: 0, y: 0, width: 1500, height: 50 },
      { id: 's1', type: 'sawblade', x: 750, y: 400, radius: 70 },
      { id: 'l1', type: 'laser', x: 750, y: 0, endX: 750, endY: 300 },
      { id: 'l2', type: 'laser', x: 750, y: 500, endX: 750, endY: 750 }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 550, y: 400, radius: 18 },
      { id: 'c2', type: 'star', x: 750, y: 320, radius: 18 },
      { id: 'c3', type: 'star', x: 1150, y: 400, radius: 18 }
    ]
  },
  {
    id: 15,
    title: 'O Desafio Supremo de Plasma',
    world: 3,
    description: 'O exame final de Corda Elástica. Portais, serras móveis, ganchos orbitais e lasers!',
    startX: 150,
    startY: 600,
    goalX: 1450,
    goalY: 200,
    goalRadius: 50,
    bounds: { width: 1600, height: 800 },
    targetTime: 14,
    nodes: [
      { id: 'n1', x: 150, y: 600, radius: 16, type: 'normal' },
      { 
        id: 'n2', 
        x: 450, 
        y: 350, 
        radius: 16, 
        type: 'moving',
        movePath: [{ x: 450, y: 250 }, { x: 450, y: 550 }],
        moveSpeed: 160
      },
      { id: 'n3', x: 800, y: 250, radius: 16, type: 'fragile', maxTimer: 1.2 },
      { id: 'n4', x: 1150, y: 350, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'w1', type: 'wall', x: 0, y: 750, width: 1600, height: 50 },
      { id: 'l1', type: 'laser', x: 300, y: 740, endX: 1500, endY: 740 },
      { id: 's1', type: 'sawblade', x: 625, y: 400, radius: 55 },
      { id: 's2', type: 'sawblade', x: 975, y: 400, radius: 55 },
      // Portal short-cut
      { id: 'p1', type: 'portal', x: 800, y: 550, radius: 40, portalTargetX: 1150, portalTargetY: 200, portalColor: '#06b6d4' }
    ],
    collectibles: [
      { id: 'c1', type: 'star', x: 450, y: 400, radius: 18 },
      { id: 'c2', type: 'star', x: 800, y: 380, radius: 18 },
      { id: 'c3', type: 'star', x: 1150, y: 250, radius: 18 }
    ]
  }
];

export const COMMUNITY_LEVELS: LevelData[] = [
  {
    id: 101,
    title: 'A Caverna de Cristais (Comunidade)',
    world: 1,
    description: 'Criado no Editor! Um percurso de salto em distância com múltiplos pontos.',
    startX: 150,
    startY: 350,
    goalX: 1150,
    goalY: 350,
    goalRadius: 45,
    bounds: { width: 1300, height: 700 },
    targetTime: 7,
    nodes: [
      { id: 'c_n1', x: 150, y: 350, radius: 16, type: 'normal' },
      { id: 'c_n2', x: 450, y: 150, radius: 16, type: 'normal' },
      { id: 'c_n3', x: 750, y: 550, radius: 16, type: 'normal' },
      { id: 'c_n4', x: 950, y: 200, radius: 16, type: 'normal' }
    ],
    obstacles: [
      { id: 'c_w1', type: 'wall', x: 0, y: 650, width: 1300, height: 50 },
      { id: 'c_w2', type: 'wall', x: 600, y: 250, width: 40, height: 400 }
    ],
    collectibles: [
      { id: 'c_s1', type: 'star', x: 450, y: 350, radius: 18 },
      { id: 'c_s2', type: 'star', x: 750, y: 350, radius: 18 },
      { id: 'c_s3', type: 'star', x: 950, y: 380, radius: 18 }
    ]
  }
];
