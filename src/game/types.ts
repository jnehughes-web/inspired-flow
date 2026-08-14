export type FormId = "worm";

export const FORM_ORDER: FormId[] = ["worm"];

export const FORM_META: Record<
  FormId,
  { name: string; blurb: string; color: string }
> = {
  worm: {
    name: "Worm",
    blurb: "Oval links · sensor wands that branch as you grow",
    color: "#8ef0ff",
  },
};

export type PreyKind = "cyan" | "amber" | "magenta" | "mint" | "gold";

/** Depths 0..7. Index = depth, value = min body segments to stay there. */
export const MAX_DEPTH = 7;

export const DEPTH_MIN_SEGS: readonly number[] = [0, 8, 14, 22, 32, 44, 58, 74];

/** Hard cap must stay above the deepest depth threshold. */
export const MAX_BODY_SEGS = Math.max(...DEPTH_MIN_SEGS) + 16;

/**
 * Growth cycle (then repeat):
 * 1 outer oval · 2 inner oval · 3 colored core · 4 unbranched wand
 * 5 first branch on previous oval · 6 second branch two back
 * 7 third branch three back · 8 prey-color tips four back
 */
export const GROWTH_CYCLE = 8;
/** Own-oval fill max (steps 1–4) before later ticks decorate older links. */
export const OVAL_OWN_MAX = 4;

export interface SaveData {
  version: 1;
  unlocked: FormId[];
  lastForm: FormId;
  mute: boolean;
  bestDepth: number;
  seenTip: boolean;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Segment {
  x: number;
  y: number;
  r: number;
  /** Own-oval fill 1–4 (outer, inner, core, unbranched wand). */
  stage: number;
  maxStage: number;
  /** Core color from the prey that completed stage 3. */
  dotColor?: string;
  /** Tip color from the prey that completed the tips step. */
  armColor?: string;
  /** Unbranched sensor wand present. */
  wand: boolean;
  /** 0–3 forks applied by later growth ticks on this older oval. */
  branches: number;
  /** Prey-color dots on branch tips. */
  tips: boolean;
  /** Sensors replaced by two extra oval tails (yellow split). */
  split: boolean;
  /** Two extra tails growing from this oval after a yellow split. */
  forks: Segment[][] | null;
}

export interface Prey {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: PreyKind;
  r: number;
  pulse: number;
  tier: number;
  angle: number;
  /** Simple plankton vs mini-worm (depth 4+). */
  style: "simple" | "segmented";
  /** Trailing body nodes (head is x/y). Empty for simple prey. */
  chain: Vec2[];
}

export interface Predator {
  id: number;
  segs: Segment[];
  angle: number;
  speed: number;
  turn: number;
  biteCd: number;
}

export interface TrailDot {
  x: number;
  y: number;
  life: number;
  r: number;
  color: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  r: number;
}

export interface Egg {
  x: number;
  y: number;
  pulse: number;
  alive: boolean;
}

export interface BossTail {
  nodes: Vec2[];
}

export interface Boss {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  pulse: number;
  tails: BossTail[];
  tailMax: number;
  eyeR0: number;
  biteCd: number;
  alive: boolean;
}

export type Phase = "menu" | "playing" | "celebrate";
