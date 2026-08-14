import type {
  Egg,
  FormId,
  Particle,
  Phase,
  Predator,
  Prey,
  PreyKind,
  Segment,
  TrailDot,
  Vec2,
  SaveData,
  Boss,
} from "./types";
import { DriftAudio } from "./audio";
import { loadSave, nextForm, writeSave } from "./storage";
import {
  DEPTH_MIN_SEGS,
  FORM_META,
  GROWTH_CYCLE,
  MAX_BODY_SEGS,
  MAX_DEPTH,
  OVAL_OWN_MAX,
} from "./types";

const WORLD = 2200;
const TEMPO = 0.52;

const PREY_COLORS: Record<PreyKind, string> = {
  cyan: "#7af0ff",
  amber: "#ffc857",
  magenta: "#ff8ad4",
  mint: "#7dffe0",
  gold: "#ffe08a",
};
const PREY_KINDS: PreyKind[] = ["cyan", "magenta", "mint", "cyan", "magenta", "mint"];

function isYellow(kind: PreyKind) {
  return kind === "gold" || kind === "amber";
}

function isGreen(kind: PreyKind) {
  return kind === "mint";
}

let _id = 1;
const nid = () => _id++;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function softBound(x: number, y: number): Vec2 {
  const m = 80;
  let nx = x;
  let ny = y;
  if (x < m) nx += (m - x) * 0.08;
  if (y < m) ny += (m - y) * 0.08;
  if (x > WORLD - m) nx -= (x - (WORLD - m)) * 0.08;
  if (y > WORLD - m) ny -= (y - (WORLD - m)) * 0.08;
  return { x: clamp(nx, 20, WORLD - 20), y: clamp(ny, 20, WORLD - 20) };
}

function depthBg(depth: number): [string, string] {
  const t = depth / MAX_DEPTH;
  const r1 = Math.round(4 + t * 12);
  const g1 = Math.round(40 + (1 - t) * 70 + t * 20);
  const b1 = Math.round(90 + t * 40);
  const r2 = Math.round(6 + t * 18);
  const g2 = Math.round(70 + (1 - t) * 50);
  const b2 = Math.round(120 + t * 50);
  return [`rgb(${r1},${g1},${b1})`, `rgb(${r2},${g2},${b2})`];
}

export function maxDepthForSegs(segs: number): number {
  let d = 0;
  for (let i = 1; i <= MAX_DEPTH; i++) {
    if (segs >= (DEPTH_MIN_SEGS[i] ?? 999)) d = i;
    else break;
  }
  return d;
}

export interface EngineCallbacks {
  onSave?: (s: SaveData) => void;
  onPhase?: (p: Phase) => void;
}

export class DriftEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  audio = new DriftAudio();
  save: SaveData;

  phase: Phase = "menu";
  form: FormId = "worm";
  depth = 0;
  segs: Segment[] = [];
  /** Current position in the 8-step growth cycle (1–8). */
  cycleStep = 1;
  angle = 0;
  prevAngle = 0;
  turnVel = 0;
  x = WORLD / 2;
  y = WORLD / 2;
  speed = 0;
  preyEaten = 0;
  greenEaten = 0;
  energy = 0;
  boostT = 0;
  boostCd = 0;
  invuln = 0;
  biteCd = 0;
  tipT = 0;
  celebrateT = 0;
  unlockedThisRun: FormId | null = null;
  depthFlash = 0;

  prey: Prey[] = [];
  predators: Predator[] = [];
  particles: Particle[] = [];
  trails: TrailDot[] = [];
  egg: Egg | null = null;
  boss: Boss | null = null;

  /** Color for the current boost trail activation (Noticord). */
  trailColor = "#ff6bcb";
  private trailColorIdx = 0;

  currentAng = 0;
  currentSpd = 18;

  pointer: Vec2 | null = null;
  touchIds = new Set<number>();
  spaceHeld = false;
  uiBoost = false;

  camX = 0;
  camY = 0;
  w = 390;
  h = 844;
  dpr = 1;
  time = 0;
  acc = 0;
  running = false;
  raf = 0;
  lastTs = 0;

  private cbs: EngineCallbacks;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur: () => void;

  constructor(canvas: HTMLCanvasElement, cbs: EngineCallbacks = {}) {
    this.canvas = canvas;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("2d context unavailable");
    this.ctx = c;
    this.cbs = cbs;
    this.save = loadSave();
    this.form = this.save.lastForm;
    this.audio.setMuted(this.save.mute);

    this.onKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        this.spaceHeld = true;
      }
      if (e.code === "Escape" && this.phase === "playing") this.toMenu();
      if (e.code === "KeyM") this.toggleMute();
    };
    this.onKeyUp = (e) => {
      if (e.code === "Space") this.spaceHeld = false;
    };
    this.onBlur = () => {
      this.spaceHeld = false;
      this.touchIds.clear();
      this.uiBoost = false;
    };

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.audio.dispose();
  }

  resize(cssW: number, cssH: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = cssW;
    this.h = cssH;
    this.canvas.width = Math.floor(cssW * this.dpr);
    this.canvas.height = Math.floor(cssH * this.dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  setPointer(world: Vec2 | null) {
    this.pointer = world;
  }

  setUiBoost(v: boolean) {
    this.uiBoost = v;
  }

  screenToWorld(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: this.camX + (clientX - rect.left),
      y: this.camY + (clientY - rect.top),
    };
  }

  toggleMute() {
    this.save.mute = !this.save.mute;
    this.audio.setMuted(this.save.mute);
    writeSave(this.save);
    this.cbs.onSave?.(this.save);
  }

  selectForm(f: FormId) {
    if (!this.save.unlocked.includes(f)) return;
    this.form = f;
    this.save.lastForm = f;
    writeSave(this.save);
    this.cbs.onSave?.(this.save);
  }

  startRun(form?: FormId) {
    this.audio.unlock();
    if (form) this.selectForm(form);
    this.phase = "playing";
    this.cbs.onPhase?.("playing");
    this.depth = 0;
    this.preyEaten = 0;
    this.greenEaten = 0;
    this.energy = 0;
    this.boostT = 0;
    this.boostCd = 0;
    this.invuln = 0;
    this.biteCd = 0;
    this.celebrateT = 0;
    this.depthFlash = 0;
    this.unlockedThisRun = null;
    this.x = WORLD / 2;
    this.y = WORLD / 2;
    this.angle = -Math.PI / 2;
    this.prevAngle = this.angle;
    this.turnVel = 0;
    this.speed = 0;
    this.cycleStep = OVAL_OWN_MAX;
    // Head + one oval (wand ready); later ticks decorate older links
    this.segs = this.seedSegs(2, true);
    this.prey = [];
    this.predators = [];
    this.particles = [];
    this.trails = [];
    this.egg = null;
    this.boss = null;
    this.currentAng = Math.random() * Math.PI * 2;
    this.currentSpd = 16 + Math.random() * 10;
    this.tipT = this.save.seenTip ? 0 : 10;
    if (!this.save.seenTip) {
      this.save.seenTip = true;
      writeSave(this.save);
      this.cbs.onSave?.(this.save);
    }
    this.populateDepth();
    this.camX = this.x - this.w / 2;
    this.camY = this.y - this.h / 2;
  }

  toMenu() {
    this.phase = "menu";
    this.cbs.onPhase?.("menu");
    this.pointer = null;
    this.touchIds.clear();
    this.uiBoost = false;
  }

  private makeSeg(
    x: number,
    y: number,
    r: number,
    opts: Partial<Segment> = {},
  ): Segment {
    return {
      x,
      y,
      r,
      stage: opts.stage ?? 1,
      maxStage: OVAL_OWN_MAX,
      dotColor: opts.dotColor,
      armColor: opts.armColor,
      wand: opts.wand ?? false,
      branches: opts.branches ?? 0,
      tips: opts.tips ?? false,
      split: opts.split ?? false,
      forks: opts.forks ?? null,
    };
  }

  private seedSegs(n: number, complete = false): Segment[] {
    const segs: Segment[] = [];
    for (let i = 0; i < n; i++) {
      segs.push(
        this.makeSeg(
          this.x - Math.cos(this.angle) * i * 18,
          this.y - Math.sin(this.angle) * i * 18,
          11 - i * 0.35,
          complete
            ? {
                stage: OVAL_OWN_MAX,
                wand: true,
                dotColor: "#9ef6ff",
              }
            : { stage: 1 },
        ),
      );
    }
    return segs;
  }

  private formStats() {
    // Noticord-as-worm: quick dash, sensor body, poison trail boost
    return { baseSpeed: 260, turn: 3.4, boostMul: 1.72, size: 1.05 };
  }

  private greenSpeedMul() {
    return 1 + Math.min(0.9, this.greenEaten * 0.055);
  }

  private bodyCount() {
    let n = this.segs.length;
    const walk = (s: Segment) => {
      if (!s.forks) return;
      for (const chain of s.forks) {
        n += chain.length;
        for (const node of chain) walk(node);
      }
    };
    for (const s of this.segs) walk(s);
    return n;
  }

  private extraTailCount() {
    let n = 0;
    const walk = (s: Segment) => {
      if (s.split && s.forks) n += s.forks.length;
      if (!s.forks) return;
      for (const chain of s.forks) for (const node of chain) walk(node);
    };
    for (const s of this.segs) walk(s);
    return n;
  }

  private populateDepth() {
    const d = this.depth;
    // Heavier field on early planes so the first dive isn't empty
    const preyN = 52 + d * 3;
    this.prey = [];
    for (let i = 0; i < preyN; i++) this.spawnPrey(false);
    const mintN = 6 + d;
    for (let i = 0; i < mintN; i++) {
      this.spawnColoredNear("mint", 140 + Math.random() * 240);
    }
    const nearN = d <= 2 ? 20 : 12;
    for (let i = 0; i < nearN; i++) this.spawnPreyNear(false, 120 + Math.random() * 220);

    // Yellow snitches: guaranteed 1 from depth 2; extras more likely at 5–7
    let yellowN = 0;
    if (d >= 2) yellowN = 1;
    if (d >= 5 && Math.random() < 0.38 + (d - 5) * 0.2) yellowN += 1;
    if (d >= 6 && Math.random() < 0.22 + (d - 6) * 0.18) yellowN += 1;
    for (let i = 0; i < yellowN; i++) {
      const kind: PreyKind = Math.random() < 0.55 ? "gold" : "amber";
      this.spawnColoredNear(kind, 200 + Math.random() * 360);
    }

    if (d >= 4) {
      const extra = 3 + Math.floor((d - 4) * 1.5);
      for (let i = 0; i < extra; i++) this.spawnSegmentedAway();
    }

    this.predators = [];
    if (d >= 1) {
      // About half the old hunter slots stay predators; the rest become prey
      const slots = d + Math.floor(d / 4);
      const predN = Math.max(1, Math.floor(slots / 2));
      const extraPrey = slots - predN;
      for (let i = 0; i < predN; i++) this.spawnPredator();
      for (let i = 0; i < extraPrey; i++) {
        if (d >= 4) this.spawnSegmentedAway();
        else this.spawnPreyNear(false, 280 + Math.random() * 200);
      }
    }

    if (d === MAX_DEPTH) {
      this.egg = null;
      this.spawnBoss();
    } else {
      this.egg = null;
      this.boss = null;
    }
  }

  private preyTierForDepth(): number {
    return clamp(Math.floor(this.depth / 2) + (Math.random() < 0.35 ? 1 : 0), 0, 3);
  }

  /** Depth 4+: mix in segmented avoidant prey; share rises with depth. */
  private wantSegmented(gold: boolean): boolean {
    if (gold || this.depth < 4) return false;
    const chance = 0.18 + (this.depth - 4) * 0.07;
    return Math.random() < clamp(chance, 0.18, 0.55);
  }

  private makePrey(opts: {
    gold: boolean;
    x: number;
    y: number;
    segmented?: boolean;
    kind?: PreyKind;
  }): Prey {
    const kind: PreyKind =
      opts.kind ??
      (opts.gold ? "gold" : PREY_KINDS[Math.floor(Math.random() * PREY_KINDS.length)]!);
    const isGold = kind === "gold";
    const segmented = Boolean(opts.segmented);
    const ang = Math.random() * Math.PI * 2;
    const d = this.depth;
    const simpleTier = this.preyTierForDepth();
    const tier = isGold ? 3 : segmented ? d : simpleTier;
    // Deeper tailed prey: longer chains, bigger heads, quicker darts
    const chainN = segmented
      ? 3 + Math.max(0, d - 3) + (d >= 6 ? 1 : 0)
      : 0;
    const mobility = isYellow(kind)
      ? 3.4
      : segmented
        ? 1.35 + d * 0.32
        : 1.55 + (3 - simpleTier) * 0.35;
    const base = (12 + Math.random() * 18) * TEMPO * mobility;
    const chain: Vec2[] = [];
    const gap = segmented ? 8.4 + d * 1.15 : 8;
    for (let i = 0; i < chainN; i++) {
      chain.push({
        x: opts.x - Math.cos(ang) * (i + 1) * gap,
        y: opts.y - Math.sin(ang) * (i + 1) * gap,
      });
    }
    const r = segmented
      ? 4.8 + d * 0.85
      : isYellow(kind)
        ? 5.4
        : 3.5 + tier * 0.9 + d * 0.25 + Math.random() * 1.5;
    return {
      id: nid(),
      x: opts.x,
      y: opts.y,
      vx: Math.cos(ang) * base,
      vy: Math.sin(ang) * base,
      kind,
      r,
      pulse: Math.random() * Math.PI * 2,
      tier,
      angle: ang,
      style: segmented ? "segmented" : "simple",
      chain,
    };
  }

  private spawnPrey(gold: boolean) {
    this.prey.push(
      this.makePrey({
        gold,
        x: 80 + Math.random() * (WORLD - 160),
        y: 80 + Math.random() * (WORLD - 160),
        segmented: this.wantSegmented(gold),
      }),
    );
  }

  private spawnPreyNear(gold: boolean, radius: number) {
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * radius;
    this.prey.push(
      this.makePrey({
        gold,
        x: clamp(this.x + Math.cos(a) * r, 40, WORLD - 40),
        y: clamp(this.y + Math.sin(a) * r, 40, WORLD - 40),
        segmented: this.wantSegmented(gold),
      }),
    );
  }

  private spawnSegmentedAway() {
    // Keep a few extra segmented hunters-of-distance on mid/deep planes
    const a = Math.random() * Math.PI * 2;
    const r = 220 + Math.random() * 380;
    this.prey.push(
      this.makePrey({
        gold: false,
        x: clamp(this.x + Math.cos(a) * r, 60, WORLD - 60),
        y: clamp(this.y + Math.sin(a) * r, 60, WORLD - 60),
        segmented: true,
      }),
    );
  }

  private spawnColoredNear(kind: PreyKind, radius: number) {
    const a = Math.random() * Math.PI * 2;
    const r = 50 + Math.random() * radius;
    this.prey.push(
      this.makePrey({
        gold: kind === "gold",
        kind,
        x: clamp(this.x + Math.cos(a) * r, 40, WORLD - 40),
        y: clamp(this.y + Math.sin(a) * r, 40, WORLD - 40),
        segmented: false,
      }),
    );
  }

  private spawnPredator() {
    const n = 4 + Math.floor(this.depth / 2) + Math.floor(Math.random() * 3);
    let sx = 100 + Math.random() * (WORLD - 200);
    let sy = 100 + Math.random() * (WORLD - 200);
    for (let tries = 0; tries < 8 && dist(sx, sy, this.x, this.y) < 300; tries++) {
      sx = 100 + Math.random() * (WORLD - 200);
      sy = 100 + Math.random() * (WORLD - 200);
    }
    const segs: Segment[] = [];
    for (let i = 0; i < n; i++) {
      segs.push(
        this.makeSeg(sx - i * 16, sy, 10 - i * 0.25, {
          stage: 3,
          dotColor: "#ff8a96",
        }),
      );
    }
    this.predators.push({
      id: nid(),
      segs,
      angle: Math.random() * Math.PI * 2,
      speed: (48 + this.depth * 7) * TEMPO,
      turn: 1.35 + this.depth * 0.1,
      biteCd: 0,
    });
  }

  private burst(x: number, y: number, color: string, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 20 + Math.random() * 60;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        color,
        r: 1.5 + Math.random() * 2.5,
      });
    }
  }

  startLoop() {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    const tick = (ts: number) => {
      if (!this.running) return;
      let dt = (ts - this.lastTs) / 1000;
      this.lastTs = ts;
      dt = Math.min(dt, 0.1);
      this.acc += dt;
      const step = 1 / 60;
      while (this.acc >= step) {
        this.update(step);
        this.acc -= step;
      }
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private heldBoost(): boolean {
    return this.touchIds.size >= 2 || this.spaceHeld || this.uiBoost;
  }

  private static readonly BOOST_TRAIL_COLORS = [
    "#ff6bcb", // pink
    "#7af0ff", // cyan
    "#c79bff", // violet
    "#ffc857", // amber
    "#7dffe0", // mint
    "#ffe08a", // gold
    "#a8b4ff", // periwinkle
    "#ff8a96", // coral
    "#9ef6ff", // ice
    "#e0a0ff", // orchid
  ];

  private cycleBoostTrailColor() {
    this.trailColorIdx =
      (this.trailColorIdx + 1) % DriftEngine.BOOST_TRAIL_COLORS.length;
    this.trailColor = DriftEngine.BOOST_TRAIL_COLORS[this.trailColorIdx]!;
  }

  isBoosting(): boolean {
    return this.boostT > 0 || this.heldBoost();
  }

  private update(dt: number) {
    this.time += dt;
    this.currentAng += Math.sin(this.time * 0.17) * 0.35 * dt;
    this.currentSpd = 14 + 8 * Math.sin(this.time * 0.11 + 1.2);

    if (this.phase === "menu") {
      this.drawMenuAmbient(dt);
      return;
    }
    if (this.phase === "celebrate") {
      this.celebrateT -= dt;
      this.updateParticles(dt);
      this.x += Math.cos(this.angle) * 28 * TEMPO * dt;
      this.y += Math.sin(this.angle) * 28 * TEMPO * dt;
      if (this.celebrateT <= 0) this.toMenu();
      return;
    }

    if (this.tipT > 0) this.tipT -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.boostCd > 0) this.boostCd -= dt;
    if (this.boostT > 0) this.boostT -= dt;
    if (this.biteCd > 0) this.biteCd -= dt;
    if (this.depthFlash > 0) this.depthFlash -= dt;

    const stats = this.formStats();
    const held = this.heldBoost();
    if (held && this.boostT <= 0 && this.boostCd <= 0) {
      this.boostT = 0.55;
      this.boostCd = 0.7;
      this.cycleBoostTrailColor();
      this.audio.boost();
    }

    const wantBoost = this.boostT > 0 || held;
    const speedMul = (wantBoost ? stats.boostMul : 1) * this.greenSpeedMul();
    const targetSpeed = stats.baseSpeed * TEMPO * speedMul;

    this.prevAngle = this.angle;
    if (this.pointer) {
      const dx = this.pointer.x - this.x;
      const dy = this.pointer.y - this.y;
      const target = Math.atan2(dy, dx);
      let diff = target - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = stats.turn * (wantBoost ? 1.2 : 1);
      this.angle += clamp(diff, -turnRate * dt, turnRate * dt);
      const d = Math.hypot(dx, dy);
      const approach = clamp(d / 80, 0.2, 1);
      this.speed += (targetSpeed * approach - this.speed) * (1 - Math.exp(-5 * dt));
    } else {
      this.speed += (0 - this.speed) * (1 - Math.exp(-2 * dt));
    }
    let tDiff = this.angle - this.prevAngle;
    while (tDiff > Math.PI) tDiff -= Math.PI * 2;
    while (tDiff < -Math.PI) tDiff += Math.PI * 2;
    this.turnVel = this.turnVel * 0.85 + tDiff * 0.15;

    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    const b = softBound(this.x, this.y);
    this.x = b.x;
    this.y = b.y;

    const spacing = 15 * stats.size;
    if (this.segs.length === 0) this.segs = this.seedSegs(2, true);
    this.segs[0]!.x = this.x;
    this.segs[0]!.y = this.y;
    this.segs[0]!.r = 10 * stats.size;
    for (let i = 1; i < this.segs.length; i++) {
      const prev = this.segs[i - 1]!;
      const cur = this.segs[i]!;
      const dx = prev.x - cur.x;
      const dy = prev.y - cur.y;
      const d = Math.hypot(dx, dy) || 1;
      const target = spacing * (0.88 + (cur.r / 14) * 0.15);
      if (d > target) {
        const t = (d - target) / d;
        cur.x += dx * t;
        cur.y += dy * t;
      }
    }
    this.followForkTails(spacing);

    if (wantBoost) {
      this.trails.push({
        x: this.x,
        y: this.y,
        life: 1.2,
        r: 14,
        color: this.trailColor,
      });
    }

    this.updatePrey(dt);
    this.updatePredators(dt);
    this.updateTrails(dt);
    this.updateParticles(dt);
    this.updateEgg(dt);
    this.updateBoss(dt);
    this.syncDepthToSegments();

    const tx = this.x - this.w / 2;
    const ty = this.y - this.h / 2;
    this.camX += (tx - this.camX) * (1 - Math.exp(-5 * dt));
    this.camY += (ty - this.camY) * (1 - Math.exp(-5 * dt));
    this.camX = clamp(this.camX, 0, Math.max(0, WORLD - this.w));
    this.camY = clamp(this.camY, 0, Math.max(0, WORLD - this.h));
  }

  private syncDepthToSegments() {
    if (this.phase !== "playing") return;
    const n = this.bodyCount();
    const allowed = maxDepthForSegs(n);
    if (allowed > this.depth) {
      this.changeDepth(this.depth + 1, "down");
    } else if (n < (DEPTH_MIN_SEGS[this.depth] ?? 0)) {
      this.changeDepth(allowed, "up");
    }
  }

  private updatePrey(dt: number) {
    const cx = Math.cos(this.currentAng) * this.currentSpd;
    const cy = Math.sin(this.currentAng) * this.currentSpd;

    for (const p of this.prey) {
      p.pulse += dt * 2.8;
      if (p.style === "segmented") {
        this.updateSegmentedPrey(p, dt);
        continue;
      }
      if (isYellow(p.kind)) {
        this.updateSnitch(p, dt);
        continue;
      }
      // Small prey (low tier) ride currents less and dart more
      const dart = 1.4 + (3 - p.tier) * 0.45;
      const currentPull = 0.22 + p.tier * 0.08;
      p.vx += (cx - p.vx) * currentPull * dt;
      p.vy += (cy - p.vy) * currentPull * dt;
      p.vx += Math.sin(this.time * (1.8 + p.id * 0.13) + p.id) * 22 * dart * dt;
      p.vy += Math.cos(this.time * (1.5 + p.id * 0.11) + p.id * 0.7) * 22 * dart * dt;
      if (Math.random() < 0.012 * dart) {
        const j = Math.random() * Math.PI * 2;
        const juke = (40 + Math.random() * 50) * dart;
        p.vx += Math.cos(j) * juke;
        p.vy += Math.sin(j) * juke;
      }
      {
        const dPlayer = dist(p.x, p.y, this.x, this.y);
        if (dPlayer < 90 && dPlayer > 1) {
          const flee = (1 - dPlayer / 90) * 55 * dart * dt;
          p.vx -= ((this.x - p.x) / dPlayer) * flee;
          p.vy -= ((this.y - p.y) / dPlayer) * flee;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 40 || p.x > WORLD - 40) p.vx *= -1;
      if (p.y < 40 || p.y > WORLD - 40) p.vy *= -1;
      const sp = Math.hypot(p.vx, p.vy);
      const max = (34 + (3 - p.tier) * 10) * TEMPO + this.currentSpd * 0.25;
      if (sp > max) {
        p.vx = (p.vx / sp) * max;
        p.vy = (p.vy / sp) * max;
      }
      if (sp > 0.1) p.angle = Math.atan2(p.vy, p.vx);
    }

    const headR = (this.segs[0]?.r ?? 10) + 5;
    for (let i = this.prey.length - 1; i >= 0; i--) {
      const p = this.prey[i]!;
      let hit = dist(p.x, p.y, this.x, this.y) < headR + p.r;
      if (!hit && p.style === "segmented") {
        for (const n of p.chain) {
          if (dist(n.x, n.y, this.x, this.y) < headR + p.r * 0.7) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        this.eatPrey(p);
        this.prey.splice(i, 1);
        const simples = this.prey.filter((q) => !isYellow(q.kind) && q.style !== "segmented").length;
        if (simples < 32 + this.depth) this.spawnPrey(false);
        if (
          this.depth >= 2 &&
          this.prey.filter((q) => isYellow(q.kind)).length < 1
        ) {
          this.spawnColoredNear(Math.random() < 0.55 ? "gold" : "amber", 260 + Math.random() * 280);
        }
        if (
          this.depth >= 4 &&
          this.prey.filter((q) => q.style === "segmented").length < 3 + (this.depth - 4)
        ) {
          this.spawnSegmentedAway();
        }
      }
    }
  }

  /** Amber / gold — golden-snitch dart: faster than cruise, catchable on a boost. */
  private updateSnitch(p: Prey, dt: number) {
    const dPlayer = dist(p.x, p.y, this.x, this.y) || 1;
    const sense = 280;
    let targetAng = p.angle;
    if (dPlayer < sense) {
      targetAng = Math.atan2(p.y - this.y, p.x - this.x);
      targetAng += Math.sin(this.time * 13 + p.id * 1.7) * 1.05;
    } else {
      targetAng += Math.sin(this.time * 3.6 + p.id) * 3.2 * dt;
    }
    if (Math.random() < 0.045) {
      targetAng += (Math.random() - 0.5) * 2.2;
    }
    let diff = targetAng - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.angle += clamp(diff, -10 * dt, 10 * dt);

    const sprint = dPlayer < 150 ? 1.28 : dPlayer < sense ? 1.12 : 1;
    const cruise = 172 * sprint;
    p.vx = Math.cos(p.angle) * cruise;
    p.vy = Math.sin(p.angle) * cruise;
    if (dPlayer < 130) {
      const shove = (1 - dPlayer / 130) * 80;
      p.vx += ((p.x - this.x) / dPlayer) * shove;
      p.vy += ((p.y - this.y) / dPlayer) * shove;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < 50 || p.x > WORLD - 50) {
      p.vx *= -1;
      p.angle = Math.atan2(p.vy, p.vx);
    }
    if (p.y < 50 || p.y > WORLD - 50) {
      p.vy *= -1;
      p.angle = Math.atan2(p.vy, p.vx);
    }
    const b = softBound(p.x, p.y);
    p.x = b.x;
    p.y = b.y;
  }

  /** Mini-worm prey: active swim + strong flee from the player body. */
  private updateSegmentedPrey(p: Prey, dt: number) {
    // Closest threat on the worm (head weighted, but body also scares)
    let nearestX = this.x;
    let nearestY = this.y;
    let nearestD = dist(p.x, p.y, this.x, this.y);
    for (let i = 1; i < this.segs.length; i += 2) {
      const s = this.segs[i]!;
      const d = dist(p.x, p.y, s.x, s.y);
      if (d < nearestD) {
        nearestD = d;
        nearestX = s.x;
        nearestY = s.y;
      }
    }

    const sense = 180 + p.tier * 18;
    let targetAng = p.angle;
    if (nearestD < sense && nearestD > 1) {
      targetAng = Math.atan2(p.y - nearestY, p.x - nearestX);
      if (nearestD < 90 + p.r) {
        targetAng += Math.sin(this.time * 14 + p.id) * 0.7;
      }
    } else {
      targetAng = p.angle + Math.sin(this.time * 1.3 + p.id) * 0.9 * dt * 6;
    }

    let diff = targetAng - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = nearestD < sense ? 7.2 + p.tier * 0.15 : 2.4;
    p.angle += clamp(diff, -turn * dt, turn * dt);

    const panic = nearestD < sense ? 1.2 + (1 - nearestD / sense) * 1.15 : 1;
    const cruise = (36 + p.tier * 12) * TEMPO * panic;
    p.vx = Math.cos(p.angle) * cruise;
    p.vy = Math.sin(p.angle) * cruise;
    if (nearestD < 110 + p.r && nearestD > 1) {
      const shove = (1 - nearestD / (110 + p.r)) * (70 + p.tier * 8) * TEMPO;
      p.vx += ((p.x - nearestX) / nearestD) * shove;
      p.vy += ((p.y - nearestY) / nearestD) * shove;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const b = softBound(p.x, p.y);
    if (b.x !== p.x || b.y !== p.y) {
      p.x = b.x;
      p.y = b.y;
      p.angle += Math.PI * 0.6;
    }

    const spacing = 8.8 + p.r * 0.72;
    let px = p.x;
    let py = p.y;
    for (let i = 0; i < p.chain.length; i++) {
      const node = p.chain[i]!;
      const dx = px - node.x;
      const dy = py - node.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > spacing) {
        const t = (d - spacing) / d;
        node.x += dx * t;
        node.y += dy * t;
      } else if (d < spacing * 0.72 && d > 0.01) {
        // Keep links from stacking except in a tight turn
        const push = (spacing * 0.72 - d) / d;
        node.x -= dx * push;
        node.y -= dy * push;
      }
      px = node.x;
      py = node.y;
    }
  }

  /**
   * Green = speed. Yellow = split / extra tails. Other = cores & sensors on all eligible.
   */
  private eatPrey(p: Prey) {
    this.audio.eat();
    this.preyEaten++;
    const color = PREY_COLORS[p.kind];
    this.burst(p.x, p.y, color, p.kind === "gold" ? 14 : p.style === "segmented" ? 12 : 8);

    if (isGreen(p.kind)) this.greenEaten += 1;

    if (isYellow(p.kind)) {
      this.applyYellowGrowth(color);
      return;
    }
    this.applyNonYellowGrowth(color);
  }

  private allBodyOvals(): Segment[] {
    const out: Segment[] = [];
    const walk = (s: Segment) => {
      out.push(s);
      if (!s.forks) return;
      for (const chain of s.forks) for (const n of chain) walk(n);
    };
    for (let i = 1; i < this.segs.length; i++) walk(this.segs[i]!);
    return out;
  }

  private splitIsActive() {
    return this.allBodyOvals().some((s) => s.tips || s.split);
  }

  private canSplit(s: Segment) {
    return !s.split && s.wand && s.tips;
  }

  private ovalIncomplete(s: Segment) {
    if (s.split) return false;
    if (s.stage < 4) return true;
    if (!s.wand) return true;
    if (s.branches < 3) return true;
    if (!s.tips) return true;
    return false;
  }

  private sensorOrCoreEligible(s: Segment) {
    if (s.split) return false;
    if (s.stage === 2) return true;
    if (s.stage >= 3 && !s.wand) return true;
    if (s.wand && s.branches < 3) return true;
    if (s.wand && s.branches >= 3 && !s.tips) return true;
    return false;
  }

  private advanceSensorOrCore(s: Segment, color: string) {
    if (s.stage === 2) {
      s.stage = 3;
      s.dotColor = color;
      return;
    }
    if (s.stage >= 3 && !s.wand) {
      s.stage = 4;
      s.wand = true;
      return;
    }
    if (s.wand && s.branches < 3) {
      s.branches += 1;
      return;
    }
    if (s.wand && s.branches >= 3 && !s.tips) {
      s.tips = true;
      s.armColor = color;
    }
  }

  /** One full-cycle step on a single oval. Returns true if already complete. */
  private advanceOval(s: Segment, color: string, yellow: boolean): boolean {
    if (s.split) return true;
    if (s.stage < 2) {
      s.stage = 2;
      return false;
    }
    if (s.stage === 2) {
      s.stage = 3;
      s.dotColor = color;
      return false;
    }
    if (!s.wand) {
      s.stage = 4;
      s.wand = true;
      return false;
    }
    if (s.branches < 3) {
      s.branches += 1;
      return false;
    }
    if (!s.tips) {
      if (yellow && this.splitIsActive()) {
        this.splitSegment(s);
      } else {
        s.tips = true;
        s.armColor = color;
      }
      return false;
    }
    return true;
  }

  private splitSegment(s: Segment) {
    s.split = true;
    s.wand = false;
    s.tips = false;
    s.branches = 0;
    const r = Math.max(4.5, s.r * 0.78);
    s.forks = [
      [this.makeSeg(s.x, s.y, r, { stage: 1 })],
      [this.makeSeg(s.x, s.y, r, { stage: 1 })],
    ];
    this.burst(s.x, s.y, "#ffe08a", 10);
  }

  private growForkChains(color: string) {
    for (const s of this.segs) {
      if (!s.forks) continue;
      for (const chain of s.forks) {
        if (chain.length === 0) {
          chain.push(this.makeSeg(s.x, s.y, Math.max(4.5, s.r * 0.75), { stage: 1 }));
          continue;
        }
        const last = chain[chain.length - 1]!;
        const done = this.advanceOval(last, color, true);
        if (done && chain.length < 10 && this.bodyCount() < MAX_BODY_SEGS) {
          chain.push(
            this.makeSeg(last.x, last.y, Math.max(4.2, last.r * 0.94), { stage: 1 }),
          );
        }
      }
    }
  }

  private applyYellowGrowth(color: string) {
    const ovals = this.allBodyOvals();
    if (this.splitIsActive()) {
      const splitters = ovals.filter((s) => this.canSplit(s));
      if (splitters.length) {
        // This yellow replaces sensor-tip steps with two new ovals — that's the tick
        for (const s of splitters) this.splitSegment(s);
        return;
      }
    }

    let progressed = 0;
    for (const s of this.allBodyOvals()) {
      if (s.split) continue;
      if (this.ovalIncomplete(s)) {
        this.advanceOval(s, color, true);
        progressed++;
      }
    }

    // Extra tails only grow from yellow, including nested second splits
    const growVisit = (host: Segment) => {
      if (!host.forks) return;
      for (const chain of host.forks) {
        const last = chain[chain.length - 1];
        if (!last) {
          chain.push(this.makeSeg(host.x, host.y, Math.max(4.5, host.r * 0.75), { stage: 1 }));
          progressed++;
        } else if (
          !last.split &&
          !this.ovalIncomplete(last) &&
          chain.length < 10 &&
          this.bodyCount() < MAX_BODY_SEGS
        ) {
          chain.push(
            this.makeSeg(last.x, last.y, Math.max(4.2, last.r * 0.94), { stage: 1 }),
          );
          progressed++;
        }
        for (const n of chain) growVisit(n);
      }
    };
    for (const s of this.segs) growVisit(s);

    if (progressed === 0 && this.segs.length < MAX_BODY_SEGS) {
      const last = this.segs[this.segs.length - 1]!;
      this.segs.push(
        this.makeSeg(last.x, last.y, Math.max(4.5, 9.5 - this.segs.length * 0.1), { stage: 1 }),
      );
      this.cycleStep = 1;
    }
  }

  private applyNonYellowGrowth(color: string) {
    const fill = this.allBodyOvals().filter((s) => this.sensorOrCoreEligible(s));
    if (fill.length) {
      for (const s of fill) this.advanceSensorOrCore(s, color);
      return;
    }
    this.applyGrowthTick(color);
  }

  private applyGrowthTick(color: string) {
    if (this.segs.length === 0) {
      this.segs = this.seedSegs(1, false);
      this.cycleStep = 1;
      return;
    }

    const last = this.segs[this.segs.length - 1]!;

    if (this.cycleStep < OVAL_OWN_MAX) {
      this.cycleStep += 1;
      last.stage = this.cycleStep;
      last.maxStage = OVAL_OWN_MAX;
      if (this.cycleStep === 3) last.dotColor = color;
      if (this.cycleStep === 4) last.wand = true;
      return;
    }

    if (this.cycleStep === 4) {
      this.cycleStep = 5;
      this.decoratePrior(1, "branch", 1, color);
      return;
    }
    if (this.cycleStep === 5) {
      this.cycleStep = 6;
      this.decoratePrior(2, "branch", 2, color);
      return;
    }
    if (this.cycleStep === 6) {
      this.cycleStep = 7;
      this.decoratePrior(3, "branch", 3, color);
      return;
    }
    if (this.cycleStep === 7) {
      this.cycleStep = 8;
      this.decoratePrior(4, "tips", 0, color);
      return;
    }

    // cycleStep === 8 → new oval at stage 1
    if (this.segs.length >= MAX_BODY_SEGS) return;
    this.segs.push(
      this.makeSeg(
        last.x,
        last.y,
        Math.max(4.5, 9.5 - this.segs.length * 0.1),
        { stage: 1 },
      ),
    );
    this.cycleStep = 1;
  }

  /** Apply a later-cycle decoration to the oval `back` links behind the newest. */
  private decoratePrior(
    back: number,
    kind: "branch" | "tips",
    branches: number,
    color: string,
  ) {
    const idx = this.segs.length - 1 - back;
    if (idx < 1) return; // never decorate the head
    const s = this.segs[idx]!;
    if (s.split) return;
    s.wand = true;
    if (kind === "branch") {
      s.branches = Math.max(s.branches, branches);
    } else {
      s.tips = true;
      s.armColor = color;
    }
  }

  private followForkTails(spacing: number) {
    for (let i = 1; i < this.segs.length; i++) {
      const s = this.segs[i]!;
      if (!s.forks) continue;
      const prev = this.segs[i - 1]!;
      const toHead = Math.atan2(prev.y - s.y, prev.x - s.x);
      this.followForkChains(s, toHead + Math.PI, spacing);
    }
  }

  /** Follow every extra-tail chain, including nested second splits. */
  private followForkChains(parent: Segment, tailAng: number, spacing: number) {
    if (!parent.forks) return;
    const gap = spacing * 1.18;
    for (let fi = 0; fi < parent.forks.length; fi++) {
      const chain = parent.forks[fi]!;
      const side = fi === 0 ? -1 : 1;
      // Wide fan (~70°) so sibling tails stay apart unless the body hooks
      const ang = tailAng + side * (Math.PI * 0.39);
      let px = parent.x + Math.cos(ang) * parent.r * 1.55;
      let py = parent.y + Math.sin(ang) * parent.r * 1.55;
      let prevNode = parent;
      for (const node of chain) {
        const dx = px - node.x;
        const dy = py - node.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > gap) {
          const t = (d - gap) / d;
          node.x += dx * t;
          node.y += dy * t;
        } else if (d < gap * 0.7 && d > 0.01) {
          const push = (gap * 0.7 - d) / d;
          node.x -= dx * push;
          node.y -= dy * push;
        }
        if (node.forks) {
          const nestedHead = Math.atan2(prevNode.y - node.y, prevNode.x - node.x);
          this.followForkChains(node, nestedHead + Math.PI, spacing);
        }
        px = node.x;
        py = node.y;
        prevNode = node;
      }
    }
  }

  private changeDepth(d: number, dir: "up" | "down" | "none" = "none") {
    const next = clamp(d, 0, MAX_DEPTH);
    if (next === this.depth) return;
    this.depth = next;
    this.depthFlash = 0.55;
    if (this.depth > this.save.bestDepth) {
      this.save.bestDepth = this.depth;
      writeSave(this.save);
      this.cbs.onSave?.(this.save);
    }
    if (dir === "down") this.audio.dive();
    else if (dir === "up") this.audio.surface();
    this.populateDepth();
    this.burst(this.x, this.y, dir === "up" ? "#a8d4ff" : "#7af0ff", 22);
  }

  private updatePredators(dt: number) {
    const tailSeg = this.segs[this.segs.length - 1] ?? this.segs[0];
    const targetX = tailSeg?.x ?? this.x;
    const targetY = tailSeg?.y ?? this.y;

    for (let pi = this.predators.length - 1; pi >= 0; pi--) {
      const pred = this.predators[pi]!;
      if (pred.segs.length === 0) {
        this.predators.splice(pi, 1);
        continue;
      }
      pred.biteCd = Math.max(0, pred.biteCd - dt);
      const head = pred.segs[0]!;
      const dx = targetX - head.x;
      const dy = targetY - head.y;
      const target = Math.atan2(dy, dx);
      let diff = target - pred.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      pred.angle += clamp(diff, -pred.turn * dt, pred.turn * dt);
      head.x += Math.cos(pred.angle) * pred.speed * dt;
      head.y += Math.sin(pred.angle) * pred.speed * dt;
      const bb = softBound(head.x, head.y);
      head.x = bb.x;
      head.y = bb.y;
      for (let i = 1; i < pred.segs.length; i++) {
        const prev = pred.segs[i - 1]!;
        const cur = pred.segs[i]!;
        const ddx = prev.x - cur.x;
        const ddy = prev.y - cur.y;
        const d = Math.hypot(ddx, ddy) || 1;
        if (d > 14) {
          const t = (d - 14) / d;
          cur.x += ddx * t;
          cur.y += ddy * t;
        }
      }

      for (const t of this.trails) {
        if (pred.segs.length === 0) break;
        const th = pred.segs[0]!;
        if (dist(t.x, t.y, th.x, th.y) < t.r + th.r) {
          pred.segs.pop();
          this.burst(th.x, th.y, "#ff6bcb", 6);
          break;
        }
      }

      let nibbledThis = false;
      if (this.biteCd <= 0 && pred.segs.length > 0) {
        const playerR = (this.segs[0]?.r ?? 10) + 3;
        const tail = pred.segs[pred.segs.length - 1]!;
        if (dist(tail.x, tail.y, this.x, this.y) < tail.r + playerR) {
          const wasLast = pred.segs.length === 1;
          const eaten = pred.segs.pop()!;
          this.burst(eaten.x, eaten.y, "#ff8a96", 10);
          this.applyGrowthTick("#ff8a96");
          this.audio.eat();
          this.biteCd = 0.22;
          nibbledThis = true;
          this.invuln = Math.max(this.invuln, wasLast ? 0.55 : 0.28);
        }
      }

      if (pred.segs.length === 0) {
        this.predators.splice(pi, 1);
        continue;
      }

      if (
        !nibbledThis &&
        this.invuln <= 0 &&
        pred.biteCd <= 0 &&
        pred.segs.length > 0
      ) {
        const ph = pred.segs[0]!;
        const pTail = pred.segs[pred.segs.length - 1]!;
        const nearTheirTail =
          pred.segs.length > 1 &&
          dist(pTail.x, pTail.y, this.x, this.y) <
            pTail.r + (this.segs[0]?.r ?? 10) + 6;
        if (!nearTheirTail) {
          for (let si = 0; si < this.segs.length; si++) {
            const s = this.segs[si]!;
            if (dist(s.x, s.y, ph.x, ph.y) < s.r + ph.r - 2) {
              this.takeHit(si);
              pred.biteCd = 0.9;
              break;
            }
          }
        }
      }
    }
  }

  private takeHit(segIndex: number) {
    this.audio.hurt();
    this.invuln = 1.25;
    if (this.segs.length <= 1) {
      this.softFail();
      return;
    }
    // Prefer peeling an extra tail (deepest nested first), then last stage
    const peelForks = (s: Segment): boolean => {
      if (!s.forks) return false;
      for (let fi = s.forks.length - 1; fi >= 0; fi--) {
        const chain = s.forks[fi]!;
        for (let ci = chain.length - 1; ci >= 0; ci--) {
          if (peelForks(chain[ci]!)) return true;
        }
        if (chain.length > 0) {
          const gone = chain.pop();
          if (gone) this.burst(gone.x, gone.y, "#ff8a96", 8);
          if (chain.length === 0) s.forks.splice(fi, 1);
          if (s.forks.length === 0) {
            s.forks = null;
            s.split = false;
          }
          return true;
        }
      }
      return false;
    };
    for (let i = this.segs.length - 1; i >= 1; i--) {
      if (peelForks(this.segs[i]!)) return;
    }
    const last = this.segs[this.segs.length - 1]!;
    if (last && this.cycleStep > 1 && segIndex !== 0) {
      this.cycleStep -= 1;
      if (this.cycleStep <= OVAL_OWN_MAX) {
        last.stage = Math.max(1, this.cycleStep);
        last.wand = this.cycleStep >= 4;
        if (last.stage < 3) last.dotColor = undefined;
      }
      this.burst(last.x, last.y, "#ff8a96", 8);
      return;
    }
    const idx = Math.min(Math.max(1, segIndex), this.segs.length - 1);
    const removed = this.segs.splice(idx, 1)[0];
    if (removed) this.burst(removed.x, removed.y, "#ff8a96", 10);
    const remain = this.segs[this.segs.length - 1];
    this.cycleStep = remain ? Math.max(1, remain.stage) : 1;
    if (this.segs.length < 1) this.softFail();
  }

  private softFail() {
    this.audio.hurt();
    this.segs = this.seedSegs(2, true);
    this.cycleStep = OVAL_OWN_MAX;
    this.invuln = 2.4;
    this.energy = 0;
    this.biteCd = 0.4;
    this.predators = this.predators.filter((p) => {
      const h = p.segs[0];
      if (!h) return false;
      return dist(h.x, h.y, this.x, this.y) > 280;
    });
    this.burst(this.x, this.y, "#a8d4ff", 18);
    const allowed = maxDepthForSegs(this.segs.length);
    if (allowed < this.depth) this.changeDepth(allowed, "up");
  }

  private updateTrails(dt: number) {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i]!;
      t.life -= dt;
      if (t.life <= 0) this.trails.splice(i, 1);
    }
    if (this.trails.length > 80) this.trails.splice(0, this.trails.length - 80);
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
  }

  private updateEgg(dt: number) {
    if (!this.egg || !this.egg.alive) return;
    this.egg.pulse += dt * 2;
    if (dist(this.egg.x, this.egg.y, this.x, this.y) < 28 + (this.segs[0]?.r ?? 10)) {
      this.completeRun();
    }
  }

  private spawnBoss() {
    const a = Math.random() * Math.PI * 2;
    const r = 380 + Math.random() * 180;
    const x = clamp(this.x + Math.cos(a) * r, 220, WORLD - 220);
    const y = clamp(this.y + Math.sin(a) * r, 220, WORLD - 220);
    const tailN = 6;
    const nodesEach = 6;
    const span = Math.PI * 1.5; // 75% of the circle
    const tails: { nodes: Vec2[] }[] = [];
    const start = -span / 2;
    for (let i = 0; i < tailN; i++) {
      const ang = start + (i / Math.max(1, tailN - 1)) * span;
      const nodes: Vec2[] = [];
      for (let k = 0; k < nodesEach; k++) {
        const d = 36 + k * 16;
        nodes.push({
          x: x + Math.cos(ang) * d,
          y: y + Math.sin(ang) * d,
        });
      }
      tails.push({ nodes });
    }
    this.boss = {
      x,
      y,
      vx: 0,
      vy: 0,
      angle: a + Math.PI,
      pulse: 0,
      tails,
      tailMax: tailN * nodesEach,
      eyeR0: 30,
      biteCd: 0,
      alive: true,
    };
  }

  private bossTailNodesLeft() {
    if (!this.boss) return 0;
    let n = 0;
    for (const t of this.boss.tails) n += t.nodes.length;
    return n;
  }

  private bossEyeR() {
    if (!this.boss) return 12;
    const left = this.bossTailNodesLeft();
    const gone = 1 - left / Math.max(1, this.boss.tailMax);
    return this.boss.eyeR0 * (1 - gone * 0.68);
  }

  private playerTailTargets(): { x: number; y: number }[] {
    const tips: { x: number; y: number }[] = [];
    if (this.segs.length > 1) {
      const last = this.segs[this.segs.length - 1]!;
      tips.push({ x: last.x, y: last.y });
    }
    const walk = (s: Segment) => {
      if (!s.forks) return;
      for (const chain of s.forks) {
        if (chain.length) {
          const n = chain[chain.length - 1]!;
          tips.push({ x: n.x, y: n.y });
        }
        for (const n of chain) walk(n);
      }
    };
    for (const s of this.segs) walk(s);
    if (tips.length === 0 && this.segs[0]) {
      tips.push({ x: this.segs[0].x, y: this.segs[0].y });
    }
    return tips;
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b || !b.alive) return;
    b.pulse += dt * 2.2;
    b.biteCd = Math.max(0, b.biteCd - dt);

    const left = this.bossTailNodesLeft();
    const gone = 1 - left / Math.max(1, b.tailMax);
    const exposed = left === 0;
    const cruise = (108 + gone * 48 + (exposed ? 22 : 0)) * TEMPO;


    const preyTips = this.playerTailTargets();
    let hx = this.x;
    let hy = this.y;
    let best = dist(b.x, b.y, this.x, this.y);
    for (const t of preyTips) {
      const d = dist(b.x, b.y, t.x, t.y);
      if (d < best) {
        best = d;
        hx = t.x;
        hy = t.y;
      }
    }
    const chase = Math.atan2(hy - b.y, hx - b.x);
    // Hunt the player — slight weave so it isn't a laser
    const target = chase + Math.sin(this.time * 2.1) * 0.18;

    let diff = target - b.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = exposed ? 3.2 : 3.0 + gone * 0.35;

    b.angle += clamp(diff, -turn * dt, turn * dt);
    b.vx = Math.cos(b.angle) * cruise;
    b.vy = Math.sin(b.angle) * cruise;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const bb = softBound(b.x, b.y);
    if (bb.x !== b.x || bb.y !== b.y) {
      b.x = bb.x;
      b.y = bb.y;
      b.angle += 0.55;
    }

    // Tails fan across 75% of the circle, attached to the eye — wider gaps
    const span = Math.PI * 1.5;
    const start = b.angle + Math.PI - span / 2;
    const live = b.tails.filter((t) => t.nodes.length > 0);
    for (let i = 0; i < live.length; i++) {
      const tail = live[i]!;
      const ang = start + (i / Math.max(1, live.length - 1)) * span;
      let px = b.x + Math.cos(ang) * (this.bossEyeR() + 18);
      let py = b.y + Math.sin(ang) * (this.bossEyeR() + 18);
      const gap = 20;
      for (const node of tail.nodes) {
        const ddx = px - node.x;
        const ddy = py - node.y;
        const d = Math.hypot(ddx, ddy) || 1;
        if (d > gap) {
          const t = (d - gap) / d;
          node.x += ddx * t;
          node.y += ddy * t;
        } else if (d < gap * 0.7 && d > 0.01) {
          const push = (gap * 0.7 - d) / d;
          node.x -= ddx * push;
          node.y -= ddy * push;
        }
        px = node.x;
        py = node.y;
      }
    }

    const headR = (this.segs[0]?.r ?? 10) + 6;

    // Guardian bites the player's extra / rear tails
    if (b.biteCd <= 0 && this.invuln <= 0 && this.segs.length > 1) {
      const biteR = this.bossEyeR() + 8;
      let hit = dist(b.x, b.y, this.segs[this.segs.length - 1]!.x, this.segs[this.segs.length - 1]!.y) < biteR + 10;
      if (!hit) {
        for (const t of preyTips) {
          if (dist(b.x, b.y, t.x, t.y) < biteR + 8) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        this.takeHit(this.segs.length - 1);
        this.burst(b.x, b.y, "#ff8ad4", 12);
        b.biteCd = 0.55;
      }
    }

    if (exposed) {
      if (dist(this.x, this.y, b.x, b.y) < headR + this.bossEyeR() * 0.85) {
        b.alive = false;
        this.burst(b.x, b.y, "#ffe08a", 48);
        this.completeRun();
      }
      return;
    }

    // Player eats only the outermost node of each guardian tail
    if (this.biteCd <= 0) {
      for (const tail of b.tails) {
        if (tail.nodes.length === 0) continue;
        const tip = tail.nodes[tail.nodes.length - 1]!;
        if (dist(this.x, this.y, tip.x, tip.y) < headR + 7) {
          tail.nodes.pop();
          this.audio.eat();
          this.burst(tip.x, tip.y, "#ff8ad4", 10);
          this.biteCd = 0.14;
          break;
        }
      }
    }
  }

  private drawBoss() {
    const b = this.boss;
    if (!b || !b.alive) return;
    const c = this.ctx;
    const eyeR = this.bossEyeR();
    const left = this.bossTailNodesLeft();

    c.save();
    for (const tail of b.tails) {
      if (tail.nodes.length === 0) continue;
      c.strokeStyle = "rgba(255,170,210,0.5)";
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(b.x, b.y);
      for (const n of tail.nodes) c.lineTo(n.x, n.y);
      c.stroke();
      for (let i = 0; i < tail.nodes.length; i++) {
        const n = tail.nodes[i]!;
        const tip = i === tail.nodes.length - 1;
        const rr = tip ? 6.2 : 5;
        c.shadowColor = "#ff8ad4";
        c.shadowBlur = tip ? 12 : 6;
        c.strokeStyle = tip ? "#ffe0f0" : "rgba(255,180,210,0.85)";
        c.lineWidth = tip ? 2.2 : 1.5;
        c.beginPath();
        c.arc(n.x, n.y, rr, 0, Math.PI * 2);
        c.stroke();
        if (tip) {
          c.fillStyle = "rgba(255,140,190,0.55)";
          c.beginPath();
          c.arc(n.x, n.y, 2.2, 0, Math.PI * 2);
          c.fill();
        }
      }
    }

    const pulse = 1 + Math.sin(b.pulse) * 0.06;
    c.shadowColor = left === 0 ? "#ffe08a" : "#ff9ad0";
    c.shadowBlur = 22;
    c.strokeStyle = left === 0 ? "#fff6c8" : "#ffd0e8";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(b.x, b.y, eyeR * pulse, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = left === 0 ? "rgba(255,224,138,0.35)" : "rgba(255,120,170,0.22)";
    c.fill();
    // pupil — only edible once tails are gone
    const pr = Math.max(3.2, eyeR * (left === 0 ? 0.32 : 0.42));
    c.fillStyle = left === 0 ? "#fff6c8" : "#1a1020";
    c.beginPath();
    c.arc(b.x, b.y, pr, 0, Math.PI * 2);
    c.fill();
    if (left === 0) {
      c.fillStyle = "#1a1020";
      c.beginPath();
      c.arc(b.x + 2, b.y - 1, pr * 0.45, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  private completeRun() {
    if (this.egg) this.egg.alive = false;
    if (this.boss) this.boss.alive = false;
    this.burst(this.x, this.y, "#ffe08a", 40);
    this.audio.unlockForm();
    const nf = nextForm(this.form);
    if (nf && !this.save.unlocked.includes(nf)) {
      this.save.unlocked.push(nf);
      this.unlockedThisRun = nf;
      writeSave(this.save);
      this.cbs.onSave?.(this.save);
    } else {
      this.unlockedThisRun = null;
    }
    this.phase = "celebrate";
    this.celebrateT = 3.2;
    this.cbs.onPhase?.("celebrate");
  }

  private drawMenuAmbient(dt: number) {
    if (Math.random() < 0.25) {
      this.particles.push({
        x: this.camX + Math.random() * this.w,
        y: this.camY + Math.random() * this.h,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 2,
        maxLife: 2,
        color: "rgba(122,240,255,0.45)",
        r: 1 + Math.random() * 2,
      });
    }
    this.updateParticles(dt);
  }

  private draw() {
    const c = this.ctx;
    const [c0, c1] = depthBg(this.phase === "menu" ? 0 : this.depth);
    const g = c.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);

    c.save();
    c.translate(-this.camX, -this.camY);

    c.globalAlpha = 0.4;
    for (let i = 0; i < 55; i++) {
      const mx = (i * 137 + this.time * 6) % WORLD;
      const my = (i * 97 + this.time * 4) % WORLD;
      c.fillStyle = i % 3 === 0 ? "#b8ffff" : "#8ec8e8";
      c.beginPath();
      c.arc(mx, my, 1.2, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    if (this.phase !== "menu") {
      for (const t of this.trails) {
        c.globalAlpha = clamp(t.life, 0, 1) * 0.4;
        c.fillStyle = t.color;
        c.beginPath();
        c.arc(t.x, t.y, t.r * (0.6 + 0.4 * t.life), 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;

      for (const p of this.prey) this.drawPrey(p);
      for (const pred of this.predators) this.drawPredator(pred);
      if (this.egg?.alive) this.drawEgg(this.egg);
      this.drawBoss();
      this.drawPlayer();
    }

    for (const p of this.particles) {
      c.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    c.restore();

    const vg = c.createRadialGradient(
      this.w / 2,
      this.h / 2,
      this.h * 0.25,
      this.w / 2,
      this.h / 2,
      this.h * 0.8,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,20,40,0.35)");
    c.fillStyle = vg;
    c.fillRect(0, 0, this.w, this.h);

    if (this.depthFlash > 0) {
      c.globalAlpha = this.depthFlash * 0.35;
      c.fillStyle = "#9ef6ff";
      c.fillRect(0, 0, this.w, this.h);
      c.globalAlpha = 1;
    }
  }

  private drawPrey(p: Prey) {
    if (p.style === "segmented") {
      this.drawSegmentedPrey(p);
      return;
    }
    const c = this.ctx;
    const col = PREY_COLORS[p.kind];
    const pulse = 1 + Math.sin(p.pulse) * 0.08;
    const r = p.r * pulse;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.angle);

    const tailLen = 6 + p.tier * 4 + (p.kind === "gold" ? 4 : 0);
    c.strokeStyle = col;
    c.globalAlpha = 0.55;
    c.lineWidth = 1.2;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-r * 0.6, 0);
    c.quadraticCurveTo(
      -r - tailLen * 0.45,
      Math.sin(p.pulse * 2) * 2,
      -r - tailLen,
      Math.sin(p.pulse * 2.2) * 3,
    );
    c.stroke();
    for (let i = 1; i <= 1 + p.tier; i++) {
      const t = i / (2 + p.tier);
      const tx = -r - tailLen * t;
      const ty = Math.sin(p.pulse * 2 + i) * 2 * t;
      c.globalAlpha = 0.5;
      c.beginPath();
      c.arc(tx, ty, 1.2 + (1 - t), 0, Math.PI * 2);
      c.stroke();
    }

    c.globalAlpha = 0.95;
    c.shadowColor = col;
    c.shadowBlur = 10 + p.tier * 2;
    c.strokeStyle = "#eaffff";
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
    if (p.tier >= 1) {
      c.globalAlpha = 0.5;
      c.beginPath();
      c.arc(0, 0, r * 1.35, 0, Math.PI * 2);
      c.stroke();
    }
    if (p.tier >= 2) {
      c.globalAlpha = 0.7;
      for (const s of [-1, 1] as const) {
        c.beginPath();
        c.arc(r * 0.15, s * r * 1.1, r * 0.35, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = col;
        c.globalAlpha = 0.85;
        c.beginPath();
        c.arc(r * 0.15, s * r * 1.1, r * 0.14, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 0.7;
      }
    }

    c.globalAlpha = 1;
    c.shadowBlur = 8;
    c.fillStyle = col;
    c.beginPath();
    c.arc(0, 0, Math.max(1.4, r * 0.35), 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.beginPath();
    c.arc(-r * 0.2, -r * 0.2, Math.max(0.7, r * 0.12), 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  private drawSegmentedPrey(p: Prey) {
    const c = this.ctx;
    const col = PREY_COLORS[p.kind];
    const pulse = 1 + Math.sin(p.pulse) * 0.06;

    // Spine
    c.save();
    c.strokeStyle = col;
    c.globalAlpha = 0.45;
    c.lineWidth = 1.2 + p.r * 0.08;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(p.x, p.y);
    for (const n of p.chain) c.lineTo(n.x, n.y);
    c.stroke();

    // Body rings, tail first — scale with head size / depth
    for (let i = p.chain.length - 1; i >= 0; i--) {
      const n = p.chain[i]!;
      const fade = 1 - i / (p.chain.length + 1);
      const rr = p.r * (0.42 + fade * 0.22) * pulse;
      c.globalAlpha = 0.85;
      c.shadowColor = col;
      c.shadowBlur = 6 + p.r * 0.3;
      c.strokeStyle = "#eaffff";
      c.lineWidth = 1.2 + p.r * 0.05;
      c.beginPath();
      c.arc(n.x, n.y, Math.max(1.8, rr), 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = col;
      c.globalAlpha = 0.7;
      c.beginPath();
      c.arc(n.x, n.y, Math.max(0.9, rr * 0.35), 0, Math.PI * 2);
      c.fill();
    }

    // Head + tiny eye (avoidant creature, not a predator)
    c.globalAlpha = 1;
    c.shadowColor = col;
    c.shadowBlur = 12;
    c.strokeStyle = "#f4ffff";
    c.lineWidth = 1.8;
    c.beginPath();
    c.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = col;
    c.beginPath();
    c.arc(p.x, p.y, p.r * 0.32, 0, Math.PI * 2);
    c.fill();
    const ex = p.x + Math.cos(p.angle) * p.r * 0.45;
    const ey = p.y + Math.sin(p.angle) * p.r * 0.45;
    c.fillStyle = "#fff";
    c.shadowBlur = 4;
    c.beginPath();
    c.arc(ex, ey, 2.1, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#1a2030";
    c.beginPath();
    c.arc(
      ex + Math.cos(p.angle) * 0.6,
      ey + Math.sin(p.angle) * 0.6,
      0.9,
      0,
      Math.PI * 2,
    );
    c.fill();
    c.restore();
  }

  private drawEgg(e: Egg) {
    const c = this.ctx;
    const pulse = 22 + Math.sin(e.pulse) * 4;
    c.save();
    c.shadowColor = "#ffe08a";
    c.shadowBlur = 28;
    c.strokeStyle = "#fff6c8";
    c.lineWidth = 2.5;
    c.beginPath();
    c.ellipse(e.x, e.y, pulse * 0.75, pulse, 0, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "rgba(255,224,138,0.25)";
    c.fill();
    c.restore();
  }

  private drawPredator(pred: Predator) {
    if (pred.segs.length === 0) return;
    const c = this.ctx;
    c.save();
    c.strokeStyle = "rgba(255,160,170,0.55)";
    c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 0; i < pred.segs.length; i++) {
      const s = pred.segs[i]!;
      if (i === 0) c.moveTo(s.x, s.y);
      else c.lineTo(s.x, s.y);
    }
    c.stroke();

    for (let i = pred.segs.length - 1; i >= 0; i--) {
      const s = pred.segs[i]!;
      const isTail = i === pred.segs.length - 1;
      c.shadowColor = "#ff7a88";
      c.shadowBlur = 12;
      c.strokeStyle = isTail ? "rgba(255,210,210,0.95)" : "rgba(255,150,160,0.85)";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(s.x, s.y, s.r * (isTail ? 1.06 : 1), 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = isTail ? "rgba(255,120,130,0.55)" : "rgba(255,90,100,0.4)";
      c.beginPath();
      c.arc(s.x, s.y, s.r * 0.35, 0, Math.PI * 2);
      c.fill();
    }
    const h = pred.segs[0];
    if (h) {
      c.fillStyle = "#fff";
      c.shadowBlur = 6;
      c.beginPath();
      c.arc(h.x + Math.cos(pred.angle) * 4, h.y + Math.sin(pred.angle) * 4, 2.8, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#1a2030";
      c.beginPath();
      c.arc(h.x + Math.cos(pred.angle) * 5, h.y + Math.sin(pred.angle) * 5, 1.2, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  private drawPlayer() {
    const c = this.ctx;
    if (this.invuln > 0) {
      c.save();
      c.globalAlpha = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(this.time * 14));
    }
    this.drawWorm();
    if (this.invuln > 0) c.restore();
  }

  /**
   * Oval body links. Own fill is stages 1–4; branches/tips come from later ticks
   * applied onto older ovals.
   */
  private drawOvalLink(s: Segment, index: number, prevOverride?: Segment) {
    const c = this.ctx;
    const st = s.stage;
    const prev =
      prevOverride ??
      this.segs[Math.max(0, index - 1)] ??
      s;
    // Toward the head: from this oval to the previous (closer to head)
    const toHead = Math.atan2(prev.y - s.y, prev.x - s.x);
    // Tailward axis (away from head)
    const tailAng = toHead + Math.PI;
    const rx = s.r * 1.35;
    const ry = s.r * 0.72;

    c.save();
    c.translate(s.x, s.y);
    c.rotate(tailAng);
    c.shadowColor = "#b8ffff";
    c.shadowBlur = 12;

    if (st >= 1) {
      c.strokeStyle = st >= 3 ? "rgba(255,255,255,0.95)" : "rgba(200,250,255,0.88)";
      c.lineWidth = st >= 3 ? 2.3 : 2;
      c.beginPath();
      c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      c.stroke();
    }
    if (st >= 2) {
      c.strokeStyle = st >= 3 ? "rgba(255,255,255,0.88)" : "rgba(180,240,255,0.72)";
      c.lineWidth = 1.4;
      c.beginPath();
      c.ellipse(0, 0, rx * 0.52, ry * 0.52, 0, 0, Math.PI * 2);
      c.stroke();
    }
    if (st >= 3) {
      const col = s.dotColor ?? "#9ef6ff";
      c.shadowColor = col;
      c.shadowBlur = 10;
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(0, 0, Math.max(1.6, rx * 0.22), Math.max(1.2, ry * 0.28), 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    if (s.split && s.forks) {
      this.drawForkTails(s, tailAng);
    } else if (s.wand || st >= 4) {
      this.drawSensorWands(s, tailAng, ry);
    }
  }

  private drawForkTails(parent: Segment, _tailAng: number) {
    if (!parent.forks) return;
    const c = this.ctx;
    for (let fi = 0; fi < parent.forks.length; fi++) {
      const chain = parent.forks[fi]!;
      if (chain.length === 0) continue;
      c.strokeStyle = "rgba(255,224,138,0.45)";
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(parent.x, parent.y);
      for (const n of chain) c.lineTo(n.x, n.y);
      c.stroke();
      for (let i = chain.length - 1; i >= 0; i--) {
        const prev = i === 0 ? parent : chain[i - 1]!;
        this.drawOvalLink(chain[i]!, -1, prev);
      }
    }
  }

  /**
   * Sensor wands sit 45° away from the head (tailward ± 45°).
   * Unbranched stem first; later ticks add 1–3 forks; then prey-color tips.
   */
  private drawSensorWands(s: Segment, tailAng: number, ry: number) {
    const c = this.ctx;
    const tipCol = s.armColor ?? s.dotColor ?? "#7dffe0";
    const branches = s.branches;
    const withTips = s.tips;
    c.lineCap = "round";
    c.lineJoin = "round";

    for (const side of [-1, 1] as const) {
      // 45° off the tail axis, pointing away from the head
      const baseAng =
        tailAng + side * (Math.PI / 4) + Math.sin(this.time * 2.4 + side + s.x * 0.02) * 0.08;
      const rootX = s.x + Math.cos(baseAng) * ry * 0.85;
      const rootY = s.y + Math.sin(baseAng) * ry * 0.85;
      const stemLen = 16 + Math.sin(this.time * 2 + side) * 2;
      const jointX = rootX + Math.cos(baseAng) * stemLen;
      const jointY = rootY + Math.sin(baseAng) * stemLen;

      c.strokeStyle = "rgba(210,240,255,0.82)";
      c.lineWidth = 1.55;
      c.shadowColor = "#a8e8ff";
      c.shadowBlur = 6;
      c.beginPath();
      c.moveTo(rootX, rootY);
      c.lineTo(jointX, jointY);
      c.stroke();

      // Branch forks from the stem tip (0 = unbranched)
      const forkCount = branches;
      if (forkCount <= 0) {
        if (withTips) {
          c.fillStyle = tipCol;
          c.shadowColor = tipCol;
          c.shadowBlur = 10;
          c.beginPath();
          c.arc(jointX, jointY, 2.5, 0, Math.PI * 2);
          c.fill();
        }
        continue;
      }

      // 1 / 2 / 3 forks fanning further away from the head
      const spreads =
        forkCount === 1
          ? [0.38 * side]
          : forkCount === 2
            ? [-0.42, 0.42]
            : [-0.55, 0.0, 0.55];

      for (let fi = 0; fi < spreads.length; fi++) {
        const spread = spreads[fi]!;
        const bAng =
          baseAng + spread + Math.sin(this.time * 3.0 + fi + side) * 0.1;
        const bLen = 10 + (withTips ? 2 : 0);
        const tipX = jointX + Math.cos(bAng) * bLen;
        const tipY = jointY + Math.sin(bAng) * bLen;
        c.strokeStyle = "rgba(200,235,255,0.75)";
        c.lineWidth = 1.15;
        c.beginPath();
        c.moveTo(jointX, jointY);
        c.lineTo(tipX, tipY);
        c.stroke();
        if (withTips) {
          c.fillStyle = tipCol;
          c.shadowColor = tipCol;
          c.shadowBlur = 10;
          c.beginPath();
          c.arc(tipX, tipY, 2.5, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = "rgba(255,255,255,0.7)";
          c.shadowBlur = 0;
          c.beginPath();
          c.arc(tipX - 0.6, tipY - 0.6, 0.8, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  }

  private drawWorm() {
    const c = this.ctx;
    const n = this.segs.length;
    if (n === 0) return;
    c.save();

    // Soft spine between oval centers
    c.strokeStyle = "rgba(180,240,255,0.4)";
    c.lineWidth = 1.4;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const s = this.segs[i]!;
      if (i === 0) c.moveTo(s.x, s.y);
      else c.lineTo(s.x, s.y);
    }
    c.stroke();

    for (let i = n - 1; i >= 1; i--) {
      this.drawOvalLink(this.segs[i]!, i);
    }

    // Crescent head (cyan worm)
    const h = this.segs[0]!;
    c.save();
    c.translate(h.x, h.y);
    c.rotate(this.angle);
    c.shadowColor = "#e8ffff";
    c.shadowBlur = 18;
    c.strokeStyle = "#f2ffff";
    c.lineWidth = 3.2;
    c.lineCap = "round";
    c.beginPath();
    c.arc(-1, 0, 13, -Math.PI * 0.72, Math.PI * 0.72);
    c.stroke();
    c.lineWidth = 1.4;
    c.globalAlpha = 0.55;
    c.beginPath();
    c.arc(-1, 0, 9, -Math.PI * 0.65, Math.PI * 0.65);
    c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = "#cffffa";
    c.beginPath();
    c.arc(2, 0, 2.2, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.restore();
  }

  getHud() {
    const segs = this.bodyCount();
    const nextReq =
      this.depth < MAX_DEPTH ? (DEPTH_MIN_SEGS[this.depth + 1] ?? segs) : segs;
    const boss = this.boss?.alive ? this.boss : null;
    return {
      phase: this.phase,
      form: this.form,
      formName: FORM_META[this.form].name,
      depth: this.depth,
      mute: this.save.mute,
      tip: this.tipT > 0,
      tipAlpha: clamp(this.tipT, 0, 1),
      unlocked: [...this.save.unlocked],
      bestDepth: this.save.bestDepth,
      unlockedThisRun: this.unlockedThisRun,
      preyEaten: this.preyEaten,
      segs,
      nextSegReq: nextReq,
      growthStage: this.cycleStep,
      growthMax: GROWTH_CYCLE,
      boosting: this.isBoosting(),
      greenEaten: this.greenEaten,
      extraTails: this.extraTailCount(),
      bossTails: boss ? this.bossTailNodesLeft() : 0,
      bossExposed: Boolean(boss && this.bossTailNodesLeft() === 0),
      bossAlive: Boolean(boss),
    };
  }
}
