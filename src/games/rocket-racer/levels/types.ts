export type Pt = [number, number];

export type BlockKind = 'books' | 'toy' | 'plank' | 'box' | 'pillow';

export interface Block {
  x: number;
  /** Oberkante */
  y: number;
  w: number;
  h: number;
  kind: BlockKind;
  /** Beschriftung (Bauklötze) */
  label?: string;
}

export interface Ramp {
  x: number;
  /** Unterkante (y) */
  base: number;
  w: number;
  h: number;
  /** 1 = steigt nach rechts, -1 = fällt nach rechts */
  dir: 1 | -1;
  /** 0 = normale Rampe, sonst Jump-Boost (Abfluggeschwindigkeit px/Schritt) */
  boost: number;
  /** Abflugwinkel (rad) bei Boost */
  angle?: number;
}

export interface Ring {
  x: number;
  y: number;
}

export type DecorKind = 'window' | 'bed' | 'shelf' | 'poster' | 'lamp' | 'clock' | 'door' | 'chest' | 'dino' | 'teddy' | 'desk';

export interface Decor {
  kind: DecorKind;
  x: number;
}

export interface Rug {
  x1: number;
  x2: number;
  color: number;
}

export interface LevelDef {
  id: string;
  name: string;
  subtitle: string;
  theme: 'kids' | 'garage' | 'living';
  wallTexture: string;
  wallTint?: number;
  floorColor: number;
  floorY: number;
  startX: number;
  finishX: number;
  endX: number;
  ground: Pt[];
  rugs: Rug[];
  blocks: Block[];
  ramps: Ramp[];
  rings: Ring[];
  coins: Pt[];
  decor: Decor[];
}
