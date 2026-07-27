/**
 * Gerador de números pseudoaleatórios semeado (mulberry32).
 *
 * A simulação NUNCA deve chamar Math.random(): determinismo é o que permite
 * replays, netcode e testes reprodutíveis — é assim no Rocket League e é
 * assim aqui. Toda aleatoriedade da física/IA passa por este RNG.
 */
export interface Rng {
  /** float em [0, 1) */
  next(): number;
  /** float em [min, max) */
  range(min: number, max: number): number;
  /** inteiro em [0, n) */
  int(n: number): number;
  /** semeia novamente (reinicia a sequência) */
  reseed(seed: number): void;
  /** estado atual, para salvar/restaurar */
  state(): number;
}

export function makeRng(seed = 0x9e3779b9): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (n) => Math.floor(next() * n),
    reseed: (v: number) => {
      s = v >>> 0;
    },
    state: () => s,
  };
}

/** RNG global da simulação. Semeie no início da partida. */
export const simRng = makeRng();
