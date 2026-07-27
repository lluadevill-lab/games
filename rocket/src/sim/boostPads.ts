/**
 * Os 34 boost pads do mapa soccar padrão: 6 grandes (100 boost, 10 s de
 * respawn) e 28 pequenos (12 boost, 4 s). Posições reais do jogo.
 */
export interface PadDef {
  x: number;
  y: number;
  big: boolean;
}

export const BIG_PAD_AMOUNT = 100;
export const SMALL_PAD_AMOUNT = 12;
export const BIG_PAD_RESPAWN = 10;
export const SMALL_PAD_RESPAWN = 4;
export const BIG_PAD_RADIUS = 208;
export const SMALL_PAD_RADIUS = 144;
export const PAD_HEIGHT_BIG = 168;
export const PAD_HEIGHT_SMALL = 165;

export const PADS: PadDef[] = [
  // ---- 6 grandes
  { x: -3072, y: -4096, big: true },
  { x: 3072, y: -4096, big: true },
  { x: -3584, y: 0, big: true },
  { x: 3584, y: 0, big: true },
  { x: -3072, y: 4096, big: true },
  { x: 3072, y: 4096, big: true },
  // ---- 28 pequenos
  { x: 0, y: -4240, big: false },
  { x: -1792, y: -4184, big: false },
  { x: 1792, y: -4184, big: false },
  { x: -940, y: -3308, big: false },
  { x: 940, y: -3308, big: false },
  { x: 0, y: -2816, big: false },
  { x: -3584, y: -2484, big: false },
  { x: 3584, y: -2484, big: false },
  { x: -1788, y: -2300, big: false },
  { x: 1788, y: -2300, big: false },
  { x: -2048, y: -1036, big: false },
  { x: 0, y: -1024, big: false },
  { x: 2048, y: -1036, big: false },
  { x: -1024, y: 0, big: false },
  { x: 1024, y: 0, big: false },
  { x: -2048, y: 1036, big: false },
  { x: 0, y: 1024, big: false },
  { x: 2048, y: 1036, big: false },
  { x: -1788, y: 2300, big: false },
  { x: 1788, y: 2300, big: false },
  { x: -3584, y: 2484, big: false },
  { x: 3584, y: 2484, big: false },
  { x: 0, y: 2816, big: false },
  { x: -940, y: 3308, big: false },
  { x: 940, y: 3308, big: false },
  { x: -1792, y: 4184, big: false },
  { x: 1792, y: 4184, big: false },
  { x: 0, y: 4240, big: false },
];
