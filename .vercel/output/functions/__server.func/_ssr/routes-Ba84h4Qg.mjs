import { r as __toESM } from "../_runtime.mjs";
import { M as require_react, h as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as ChevronLeft, n as VolumeX, r as Volume2, t as Zap } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Ba84h4Qg.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Soft procedural pad + light SFX via Web Audio. Unlock on first gesture. */
var DriftAudio = class {
	ctx = null;
	master = null;
	padGain = null;
	sfxGain = null;
	oscillators = [];
	muted = false;
	started = false;
	setMuted(m) {
		this.muted = m;
		if (this.master) this.master.gain.setTargetAtTime(m ? 0 : .55, this.ctx.currentTime, .04);
	}
	isMuted() {
		return this.muted;
	}
	unlock() {
		if (typeof window === "undefined") return;
		if (!this.ctx) {
			const AC = window.AudioContext || window.webkitAudioContext;
			this.ctx = new AC();
			this.master = this.ctx.createGain();
			this.padGain = this.ctx.createGain();
			this.sfxGain = this.ctx.createGain();
			this.padGain.gain.value = .12;
			this.sfxGain.gain.value = .35;
			this.master.gain.value = this.muted ? 0 : .55;
			this.padGain.connect(this.master);
			this.sfxGain.connect(this.master);
			this.master.connect(this.ctx.destination);
		}
		if (this.ctx.state === "suspended") this.ctx.resume();
		if (!this.started) {
			this.started = true;
			this.startPad();
		}
	}
	startPad() {
		if (!this.ctx || !this.padGain) return;
		for (const f of [
			110,
			164.81,
			220,
			329.63
		]) {
			const osc = this.ctx.createOscillator();
			const g = this.ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = f;
			g.gain.value = .18;
			const lfo = this.ctx.createOscillator();
			const lfoG = this.ctx.createGain();
			lfo.frequency.value = .05 + Math.random() * .04;
			lfoG.gain.value = 4;
			lfo.connect(lfoG);
			lfoG.connect(osc.detune);
			osc.connect(g);
			g.connect(this.padGain);
			osc.start();
			lfo.start();
			this.oscillators.push(osc, lfo);
		}
	}
	blip(freq, dur, type = "sine", vol = .4) {
		if (!this.ctx || !this.sfxGain || this.muted) return;
		const t = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const g = this.ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t);
		osc.frequency.exponentialRampToValueAtTime(freq * .7, t + dur);
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(.001, t + dur);
		osc.connect(g);
		g.connect(this.sfxGain);
		osc.start(t);
		osc.stop(t + dur + .02);
	}
	eat() {
		this.blip(520 + Math.random() * 80, .12, "sine", .28);
	}
	boost() {
		this.blip(180, .2, "triangle", .22);
	}
	dive() {
		this.blip(90, .35, "sine", .3);
	}
	surface() {
		this.blip(240, .28, "sine", .26);
	}
	hurt() {
		this.blip(70, .25, "sawtooth", .15);
	}
	unlockForm() {
		this.blip(330, .15, "sine", .3);
		setTimeout(() => this.blip(440, .18, "sine", .28), 120);
		setTimeout(() => this.blip(554, .35, "sine", .32), 260);
	}
	dispose() {
		for (const o of this.oscillators) try {
			o.stop();
		} catch {}
		this.oscillators = [];
		if (this.ctx) this.ctx.close();
		this.ctx = null;
		this.started = false;
	}
};
var FORM_ORDER = [
	"worm",
	"jellyfish",
	"manta",
	"seaslug"
];
var FORM_META = {
	worm: {
		name: "Worm",
		blurb: "Quick turns · dash boost · grows intricate frills",
		color: "#5dffb0"
	},
	jellyfish: {
		name: "Jellyfish",
		blurb: "Umbrella bell · vortex boost · tentacles lengthen",
		color: "#c79bff"
	},
	manta: {
		name: "Manta",
		blurb: "Slow glide · coast boost · wings undulate",
		color: "#3de0ff"
	},
	seaslug: {
		name: "Sea slug",
		blurb: "Ribbon fins · poison trail boost",
		color: "#ff6bcb"
	}
};
var KEY = "drift-save-v1";
function defaultSave() {
	return {
		version: 1,
		unlocked: ["worm"],
		lastForm: "worm",
		mute: false,
		bestDepth: 0,
		seenTip: false
	};
}
function loadSave() {
	if (typeof window === "undefined") return defaultSave();
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return defaultSave();
		const parsed = JSON.parse(raw);
		const base = defaultSave();
		const unlocked = Array.isArray(parsed.unlocked) ? parsed.unlocked.filter((f) => FORM_ORDER.includes(f)) : base.unlocked;
		if (!unlocked.includes("worm")) unlocked.unshift("worm");
		return {
			version: 1,
			unlocked: [...new Set(unlocked)],
			lastForm: parsed.lastForm && FORM_ORDER.includes(parsed.lastForm) ? parsed.lastForm : "worm",
			mute: Boolean(parsed.mute),
			bestDepth: Math.max(0, Math.min(7, Number(parsed.bestDepth) || 0)),
			seenTip: Boolean(parsed.seenTip)
		};
	} catch {
		return defaultSave();
	}
}
function writeSave(data) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(KEY, JSON.stringify(data));
	} catch {}
}
function nextForm(current) {
	const i = FORM_ORDER.indexOf(current);
	if (i < 0 || i >= FORM_ORDER.length - 1) return null;
	return FORM_ORDER[i + 1];
}
var WORLD = 2200;
var MAX_DEPTH = 7;
/** Global calm tempo — all baseline motion scaled down. */
var TEMPO = .48;
var PREY_COLORS = {
	cyan: "#3de0ff",
	amber: "#ffc857",
	magenta: "#ff6bcb",
	mint: "#5dffb0",
	gold: "#ffe08a"
};
var PREY_KINDS = [
	"cyan",
	"amber",
	"magenta",
	"mint"
];
var _id = 1;
var nid = () => _id++;
function clamp(v, a, b) {
	return Math.max(a, Math.min(b, v));
}
function dist(ax, ay, bx, by) {
	return Math.hypot(ax - bx, ay - by);
}
function softBound(x, y) {
	const m = 80;
	let nx = x;
	let ny = y;
	if (x < m) nx += (m - x) * .08;
	if (y < m) ny += (m - y) * .08;
	if (x > WORLD - m) nx -= (x - (WORLD - m)) * .08;
	if (y > WORLD - m) ny -= (y - (WORLD - m)) * .08;
	return {
		x: clamp(nx, 20, WORLD - 20),
		y: clamp(ny, 20, WORLD - 20)
	};
}
function depthBg(depth) {
	const t = depth / MAX_DEPTH;
	const r1 = Math.round(4 + t * 20);
	const g1 = Math.round(10 + (1 - t) * 30);
	const b1 = Math.round(20 + t * 40);
	const r2 = Math.round(8 + t * 40);
	const g2 = Math.round(18 + (1 - t) * 40);
	const b2 = Math.round(40 + t * 60);
	return [`rgb(${r1},${g1},${b1})`, `rgb(${r2},${g2},${b2})`];
}
var DriftEngine = class {
	canvas;
	ctx;
	audio = new DriftAudio();
	save;
	phase = "menu";
	form = "worm";
	depth = 0;
	segs = [];
	angle = 0;
	x = WORLD / 2;
	y = WORLD / 2;
	speed = 0;
	preyEaten = 0;
	energy = 0;
	boostT = 0;
	boostCd = 0;
	invuln = 0;
	tipT = 0;
	celebrateT = 0;
	unlockedThisRun = null;
	prey = [];
	orbs = [];
	predators = [];
	particles = [];
	trails = [];
	egg = null;
	pointer = null;
	touchIds = /* @__PURE__ */ new Set();
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
	cbs;
	onKeyDown;
	onKeyUp;
	onBlur;
	constructor(canvas, cbs = {}) {
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
	resize(cssW, cssH) {
		this.dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.w = cssW;
		this.h = cssH;
		this.canvas.width = Math.floor(cssW * this.dpr);
		this.canvas.height = Math.floor(cssH * this.dpr);
		this.canvas.style.width = `${cssW}px`;
		this.canvas.style.height = `${cssH}px`;
		this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
	}
	setPointer(world) {
		this.pointer = world;
	}
	setUiBoost(v) {
		this.uiBoost = v;
	}
	screenToWorld(clientX, clientY) {
		const rect = this.canvas.getBoundingClientRect();
		return {
			x: this.camX + (clientX - rect.left),
			y: this.camY + (clientY - rect.top)
		};
	}
	toggleMute() {
		this.save.mute = !this.save.mute;
		this.audio.setMuted(this.save.mute);
		writeSave(this.save);
		this.cbs.onSave?.(this.save);
	}
	selectForm(f) {
		if (!this.save.unlocked.includes(f)) return;
		this.form = f;
		this.save.lastForm = f;
		writeSave(this.save);
		this.cbs.onSave?.(this.save);
	}
	startRun(form) {
		this.audio.unlock();
		if (form) this.selectForm(form);
		this.phase = "playing";
		this.cbs.onPhase?.("playing");
		this.depth = 0;
		this.preyEaten = 0;
		this.energy = 0;
		this.boostT = 0;
		this.boostCd = 0;
		this.invuln = 0;
		this.celebrateT = 0;
		this.unlockedThisRun = null;
		this.x = WORLD / 2;
		this.y = WORLD / 2;
		this.angle = -Math.PI / 2;
		this.speed = 0;
		this.segs = this.seedSegs(3);
		this.prey = [];
		this.orbs = [];
		this.predators = [];
		this.particles = [];
		this.trails = [];
		this.egg = null;
		this.tipT = this.save.seenTip ? 0 : 8;
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
	seedSegs(n) {
		const segs = [];
		for (let i = 0; i < n; i++) segs.push({
			x: this.x - Math.cos(this.angle) * i * 14,
			y: this.y - Math.sin(this.angle) * i * 14,
			r: 10 - i * .4,
			evolved: false
		});
		return segs;
	}
	formStats() {
		switch (this.form) {
			case "worm": return {
				baseSpeed: 95,
				turn: 3.4,
				boostMul: 1.9,
				size: 1
			};
			case "jellyfish": return {
				baseSpeed: 78,
				turn: 1.9,
				boostMul: 1.35,
				size: 1.35
			};
			case "manta": return {
				baseSpeed: 62,
				turn: 2.2,
				boostMul: 1.7,
				size: 1.2
			};
			case "seaslug": return {
				baseSpeed: 80,
				turn: 2.6,
				boostMul: 1.45,
				size: 1.1
			};
		}
	}
	populateDepth() {
		const d = this.depth;
		const preyN = 28 + d * 4;
		const goldN = 2 + Math.floor(d / 2);
		this.prey = [];
		for (let i = 0; i < preyN; i++) this.spawnPrey(false);
		for (let i = 0; i < goldN; i++) this.spawnPrey(true);
		this.orbs = [];
		if (d < MAX_DEPTH) {
			this.spawnOrb("red");
			if (d >= 1) this.spawnOrb("red");
		}
		if (d > 0) {
			this.spawnOrb("blue");
			if (d >= 3) this.spawnOrb("blue");
		}
		this.predators = [];
		if (d >= 2) {
			const n = 1 + Math.floor((d - 1) / 2);
			for (let i = 0; i < n; i++) this.spawnPredator();
		}
		if (d === MAX_DEPTH) this.egg = {
			x: WORLD * .5 + (Math.random() - .5) * 200,
			y: WORLD * .5 + (Math.random() - .5) * 200,
			pulse: 0,
			alive: true
		};
		else this.egg = null;
	}
	spawnPrey(gold) {
		const kind = gold ? "gold" : PREY_KINDS[Math.floor(Math.random() * PREY_KINDS.length)];
		const ang = Math.random() * Math.PI * 2;
		const spd = (8 + Math.random() * 14) * TEMPO;
		this.prey.push({
			id: nid(),
			x: 80 + Math.random() * (WORLD - 160),
			y: 80 + Math.random() * (WORLD - 160),
			vx: Math.cos(ang) * spd,
			vy: Math.sin(ang) * spd,
			kind,
			r: kind === "gold" ? 9 : 5 + Math.random() * 3,
			pulse: Math.random() * Math.PI * 2
		});
	}
	spawnOrb(kind) {
		this.orbs.push({
			id: nid(),
			x: 120 + Math.random() * (WORLD - 240),
			y: 120 + Math.random() * (WORLD - 240),
			kind,
			pulse: Math.random() * Math.PI * 2
		});
	}
	spawnPredator() {
		const n = 4 + Math.floor(this.depth / 2) + Math.floor(Math.random() * 3);
		const sx = 100 + Math.random() * (WORLD - 200);
		const sy = 100 + Math.random() * (WORLD - 200);
		const segs = [];
		for (let i = 0; i < n; i++) segs.push({
			x: sx - i * 16,
			y: sy,
			r: 11 - i * .3,
			evolved: false
		});
		this.predators.push({
			id: nid(),
			segs,
			angle: Math.random() * Math.PI * 2,
			speed: (40 + this.depth * 6) * TEMPO,
			turn: 1.2 + this.depth * .08,
			biteCd: 0
		});
	}
	burst(x, y, color, n = 8) {
		for (let i = 0; i < n; i++) {
			const a = Math.random() * Math.PI * 2;
			const s = 20 + Math.random() * 60;
			this.particles.push({
				x,
				y,
				vx: Math.cos(a) * s,
				vy: Math.sin(a) * s,
				life: .4 + Math.random() * .5,
				maxLife: .9,
				color,
				r: 1.5 + Math.random() * 2.5
			});
		}
	}
	startLoop() {
		if (this.running) return;
		this.running = true;
		this.lastTs = performance.now();
		const tick = (ts) => {
			if (!this.running) return;
			let dt = (ts - this.lastTs) / 1e3;
			this.lastTs = ts;
			dt = Math.min(dt, .1);
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
	heldBoost() {
		return this.touchIds.size >= 2 || this.spaceHeld || this.uiBoost;
	}
	isBoosting() {
		return this.boostT > 0 || this.heldBoost();
	}
	update(dt) {
		this.time += dt;
		if (this.phase === "menu") {
			this.drawMenuAmbient(dt);
			return;
		}
		if (this.phase === "celebrate") {
			this.celebrateT -= dt;
			this.updateParticles(dt);
			this.x += Math.cos(this.angle) * 20 * TEMPO * dt;
			this.y += Math.sin(this.angle) * 20 * TEMPO * dt;
			if (this.celebrateT <= 0) this.toMenu();
			return;
		}
		if (this.tipT > 0) this.tipT -= dt;
		if (this.invuln > 0) this.invuln -= dt;
		if (this.boostCd > 0) this.boostCd -= dt;
		if (this.boostT > 0) this.boostT -= dt;
		const stats = this.formStats();
		const held = this.heldBoost();
		if (held && this.boostT <= 0 && this.boostCd <= 0) {
			this.boostT = this.form === "manta" ? 1.4 : .55;
			this.boostCd = this.form === "manta" ? .15 : .75;
			this.audio.boost();
		}
		const wantBoost = this.boostT > 0 || held;
		const speedMul = wantBoost ? stats.boostMul : 1;
		const targetSpeed = stats.baseSpeed * TEMPO * speedMul;
		if (this.pointer) {
			const dx = this.pointer.x - this.x;
			const dy = this.pointer.y - this.y;
			let diff = Math.atan2(dy, dx) - this.angle;
			while (diff > Math.PI) diff -= Math.PI * 2;
			while (diff < -Math.PI) diff += Math.PI * 2;
			const turnRate = stats.turn * (wantBoost && this.form === "worm" ? 1.25 : 1);
			this.angle += clamp(diff, -turnRate * dt, turnRate * dt);
			const approach = clamp(Math.hypot(dx, dy) / 90, .15, 1);
			this.speed += (targetSpeed * approach - this.speed) * (1 - Math.exp(-4 * dt));
		} else this.speed += (0 - this.speed) * (1 - Math.exp(-2 * dt));
		if (this.form === "manta" && this.boostT > 0) this.speed = Math.max(this.speed, targetSpeed * .85);
		this.x += Math.cos(this.angle) * this.speed * dt;
		this.y += Math.sin(this.angle) * this.speed * dt;
		const b = softBound(this.x, this.y);
		this.x = b.x;
		this.y = b.y;
		const spacing = 12 * stats.size;
		if (this.segs.length === 0) this.segs = this.seedSegs(3);
		this.segs[0].x = this.x;
		this.segs[0].y = this.y;
		this.segs[0].r = 11 * stats.size;
		for (let i = 1; i < this.segs.length; i++) {
			const prev = this.segs[i - 1];
			const cur = this.segs[i];
			const dx = prev.x - cur.x;
			const dy = prev.y - cur.y;
			const d = Math.hypot(dx, dy) || 1;
			const target = spacing * (.85 + cur.r / 14 * .2);
			if (d > target) {
				const t = (d - target) / d;
				cur.x += dx * t;
				cur.y += dy * t;
			}
		}
		if (wantBoost) {
			if (this.form === "jellyfish") this.vortexPull(dt);
			if (this.form === "seaslug") this.trails.push({
				x: this.x,
				y: this.y,
				life: 1.2,
				r: 14
			});
		}
		this.updatePrey(dt);
		this.updateOrbs(dt);
		this.updatePredators(dt);
		this.updateTrails(dt);
		this.updateParticles(dt);
		this.updateEgg(dt);
		const tx = this.x - this.w / 2;
		const ty = this.y - this.h / 2;
		this.camX += (tx - this.camX) * (1 - Math.exp(-5 * dt));
		this.camY += (ty - this.camY) * (1 - Math.exp(-5 * dt));
		this.camX = clamp(this.camX, 0, Math.max(0, WORLD - this.w));
		this.camY = clamp(this.camY, 0, Math.max(0, WORLD - this.h));
	}
	vortexPull(dt) {
		const R = 160;
		for (const p of this.prey) {
			const d = dist(p.x, p.y, this.x, this.y);
			if (d < R && d > 1) {
				const f = (1 - d / R) * 90 * TEMPO * dt;
				p.x += (this.x - p.x) / d * f;
				p.y += (this.y - p.y) / d * f;
			}
		}
	}
	updatePrey(dt) {
		for (const p of this.prey) {
			p.pulse += dt * 2;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			if (p.x < 40 || p.x > WORLD - 40) p.vx *= -1;
			if (p.y < 40 || p.y > WORLD - 40) p.vy *= -1;
			p.vx += (Math.random() - .5) * 8 * dt;
			p.vy += (Math.random() - .5) * 8 * dt;
			const sp = Math.hypot(p.vx, p.vy);
			const max = 22 * TEMPO;
			if (sp > max) {
				p.vx = p.vx / sp * max;
				p.vy = p.vy / sp * max;
			}
		}
		const headR = (this.segs[0]?.r ?? 10) + 4;
		for (let i = this.prey.length - 1; i >= 0; i--) {
			const p = this.prey[i];
			if (dist(p.x, p.y, this.x, this.y) < headR + p.r) {
				this.eatPrey(p);
				this.prey.splice(i, 1);
				if (this.prey.filter((q) => q.kind !== "gold").length < 18 + this.depth * 2) this.spawnPrey(false);
			}
		}
	}
	eatPrey(p) {
		this.audio.eat();
		this.preyEaten++;
		this.energy += p.kind === "gold" ? 2.2 : 1;
		this.burst(p.x, p.y, PREY_COLORS[p.kind], p.kind === "gold" ? 14 : 8);
		while (this.energy >= 1) {
			this.energy -= 1;
			const last = this.segs[this.segs.length - 1];
			this.segs.push({
				x: last.x,
				y: last.y,
				r: Math.max(5, 10 - this.segs.length * .15),
				evolved: p.kind === "gold"
			});
			if (this.segs.length > 48) this.segs.pop();
		}
		if (p.kind === "gold") {
			const idx = 1 + Math.floor(Math.random() * Math.max(1, this.segs.length - 1));
			if (this.segs[idx]) this.segs[idx].evolved = true;
		}
	}
	updateOrbs(dt) {
		for (const o of this.orbs) o.pulse += dt * 2.5;
		const headR = (this.segs[0]?.r ?? 10) + 6;
		for (let i = this.orbs.length - 1; i >= 0; i--) {
			const o = this.orbs[i];
			if (dist(o.x, o.y, this.x, this.y) < headR + 14) {
				if (o.kind === "red" && this.depth < MAX_DEPTH) {
					this.changeDepth(this.depth + 1);
					this.audio.dive();
				} else if (o.kind === "blue" && this.depth > 0) {
					this.changeDepth(this.depth - 1);
					this.audio.surface();
				}
				this.orbs.splice(i, 1);
				this.burst(o.x, o.y, o.kind === "red" ? "#ff4d6d" : "#4db8ff", 16);
			}
		}
	}
	changeDepth(d) {
		this.depth = clamp(d, 0, MAX_DEPTH);
		if (this.depth > this.save.bestDepth) {
			this.save.bestDepth = this.depth;
			writeSave(this.save);
			this.cbs.onSave?.(this.save);
		}
		this.populateDepth();
		this.burst(this.x, this.y, "#ffffff", 20);
	}
	updatePredators(dt) {
		for (let pi = this.predators.length - 1; pi >= 0; pi--) {
			const pred = this.predators[pi];
			if (pred.segs.length === 0) {
				this.predators.splice(pi, 1);
				continue;
			}
			pred.biteCd = Math.max(0, pred.biteCd - dt);
			const head = pred.segs[0];
			const dx = this.x - head.x;
			const dy = this.y - head.y;
			let diff = Math.atan2(dy, dx) - pred.angle;
			while (diff > Math.PI) diff -= Math.PI * 2;
			while (diff < -Math.PI) diff += Math.PI * 2;
			pred.angle += clamp(diff, -pred.turn * dt, pred.turn * dt);
			head.x += Math.cos(pred.angle) * pred.speed * dt;
			head.y += Math.sin(pred.angle) * pred.speed * dt;
			const bb = softBound(head.x, head.y);
			head.x = bb.x;
			head.y = bb.y;
			for (let i = 1; i < pred.segs.length; i++) {
				const prev = pred.segs[i - 1];
				const cur = pred.segs[i];
				const ddx = prev.x - cur.x;
				const ddy = prev.y - cur.y;
				const d = Math.hypot(ddx, ddy) || 1;
				const spacing = 14;
				if (d > spacing) {
					const t = (d - spacing) / d;
					cur.x += ddx * t;
					cur.y += ddy * t;
				}
			}
			for (const t of this.trails) if (dist(t.x, t.y, head.x, head.y) < t.r + head.r) {
				pred.segs.pop();
				this.burst(head.x, head.y, "#ff6bcb", 6);
				break;
			}
			for (let si = 1; si < pred.segs.length; si++) {
				const s = pred.segs[si];
				if (dist(s.x, s.y, this.x, this.y) < s.r + (this.segs[0]?.r ?? 10)) {
					pred.segs.splice(si, 1);
					this.burst(s.x, s.y, "#ff5a6a", 10);
					this.energy += .4;
					break;
				}
			}
			if (this.invuln <= 0 && pred.biteCd <= 0) for (let si = 0; si < this.segs.length; si++) {
				const s = this.segs[si];
				if (dist(s.x, s.y, head.x, head.y) < s.r + head.r - 2) {
					this.takeHit(si);
					pred.biteCd = .8;
					break;
				}
			}
		}
	}
	takeHit(segIndex) {
		this.audio.hurt();
		this.invuln = 1.1;
		const remove = Math.max(1, Math.min(2, this.segs.length - 1));
		if (this.segs.length <= 2) {
			this.softFail();
			return;
		}
		this.segs.splice(Math.max(1, segIndex), remove);
		this.burst(this.x, this.y, "#ff5a6a", 12);
		if (this.segs.length < 2) this.softFail();
	}
	softFail() {
		this.audio.hurt();
		this.depth = this.depth > 0 ? this.depth - 1 : 0;
		this.segs = this.seedSegs(3);
		this.invuln = 2;
		this.energy = 0;
		this.populateDepth();
		this.burst(this.x, this.y, "#ffffff", 24);
	}
	updateTrails(dt) {
		for (let i = this.trails.length - 1; i >= 0; i--) {
			const t = this.trails[i];
			t.life -= dt;
			if (t.life <= 0) this.trails.splice(i, 1);
		}
		if (this.trails.length > 80) this.trails.splice(0, this.trails.length - 80);
	}
	updateParticles(dt) {
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			p.life -= dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vx *= .96;
			p.vy *= .96;
			if (p.life <= 0) this.particles.splice(i, 1);
		}
		if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
	}
	updateEgg(dt) {
		if (!this.egg || !this.egg.alive) return;
		this.egg.pulse += dt * 2;
		if (dist(this.egg.x, this.egg.y, this.x, this.y) < 28 + (this.segs[0]?.r ?? 10)) this.completeRun();
	}
	completeRun() {
		if (this.egg) this.egg.alive = false;
		this.burst(this.x, this.y, "#ffe08a", 40);
		this.audio.unlockForm();
		const nf = nextForm(this.form);
		if (nf && !this.save.unlocked.includes(nf)) {
			this.save.unlocked.push(nf);
			this.unlockedThisRun = nf;
			writeSave(this.save);
			this.cbs.onSave?.(this.save);
		} else this.unlockedThisRun = null;
		this.phase = "celebrate";
		this.celebrateT = 3.2;
		this.cbs.onPhase?.("celebrate");
	}
	drawMenuAmbient(dt) {
		if (Math.random() < .25) this.particles.push({
			x: this.camX + Math.random() * this.w,
			y: this.camY + Math.random() * this.h,
			vx: (Math.random() - .5) * 10,
			vy: (Math.random() - .5) * 10,
			life: 2,
			maxLife: 2,
			color: "rgba(61,224,255,0.4)",
			r: 1 + Math.random() * 2
		});
		this.updateParticles(dt);
	}
	draw() {
		const c = this.ctx;
		const [c0, c1] = depthBg(this.phase === "menu" ? 0 : this.depth);
		const g = c.createLinearGradient(0, 0, 0, this.h);
		g.addColorStop(0, c0);
		g.addColorStop(1, c1);
		c.fillStyle = g;
		c.fillRect(0, 0, this.w, this.h);
		c.save();
		c.translate(-this.camX, -this.camY);
		c.globalAlpha = .25;
		for (let i = 0; i < 40; i++) {
			const mx = (i * 137 + this.time * 8) % WORLD;
			const my = (i * 97 + this.time * 5) % WORLD;
			c.fillStyle = i % 3 === 0 ? "#3de0ff" : "#7a9bb8";
			c.beginPath();
			c.arc(mx, my, 1.2, 0, Math.PI * 2);
			c.fill();
		}
		c.globalAlpha = 1;
		if (this.phase !== "menu") {
			for (const t of this.trails) {
				c.globalAlpha = clamp(t.life, 0, 1) * .35;
				c.fillStyle = "#ff6bcb";
				c.beginPath();
				c.arc(t.x, t.y, t.r * (.6 + .4 * t.life), 0, Math.PI * 2);
				c.fill();
			}
			c.globalAlpha = 1;
			for (const p of this.prey) this.drawPrey(p);
			for (const o of this.orbs) this.drawOrb(o);
			for (const pred of this.predators) this.drawPredator(pred);
			if (this.egg?.alive) this.drawEgg(this.egg);
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
		const vg = c.createRadialGradient(this.w / 2, this.h / 2, this.h * .2, this.w / 2, this.h / 2, this.h * .75);
		vg.addColorStop(0, "rgba(0,0,0,0)");
		vg.addColorStop(1, "rgba(0,0,0,0.45)");
		c.fillStyle = vg;
		c.fillRect(0, 0, this.w, this.h);
	}
	drawPrey(p) {
		const c = this.ctx;
		const pulse = 1 + Math.sin(p.pulse) * .12;
		const col = PREY_COLORS[p.kind];
		c.save();
		c.shadowColor = col;
		c.shadowBlur = p.kind === "gold" ? 16 : 10;
		c.fillStyle = col;
		c.globalAlpha = .9;
		c.beginPath();
		c.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
		c.fill();
		if (p.kind === "gold") {
			c.strokeStyle = "#fff6c8";
			c.lineWidth = 1.5;
			c.stroke();
		}
		c.restore();
	}
	drawOrb(o) {
		const c = this.ctx;
		const col = o.kind === "red" ? "#ff4d6d" : "#4db8ff";
		const pulse = 14 + Math.sin(o.pulse) * 3;
		c.save();
		c.shadowColor = col;
		c.shadowBlur = 22;
		c.fillStyle = col;
		c.globalAlpha = .85;
		c.beginPath();
		c.arc(o.x, o.y, pulse, 0, Math.PI * 2);
		c.fill();
		c.globalAlpha = .35;
		c.beginPath();
		c.arc(o.x, o.y, pulse + 10, 0, Math.PI * 2);
		c.fill();
		c.restore();
	}
	drawEgg(e) {
		const c = this.ctx;
		const pulse = 22 + Math.sin(e.pulse) * 4;
		c.save();
		c.shadowColor = "#ffe08a";
		c.shadowBlur = 28;
		const g = c.createRadialGradient(e.x, e.y, 4, e.x, e.y, pulse);
		g.addColorStop(0, "#fff6c8");
		g.addColorStop(.5, "#ffe08a");
		g.addColorStop(1, "rgba(255,200,80,0.1)");
		c.fillStyle = g;
		c.beginPath();
		c.ellipse(e.x, e.y, pulse * .75, pulse, 0, 0, Math.PI * 2);
		c.fill();
		c.restore();
	}
	drawPredator(pred) {
		const c = this.ctx;
		c.save();
		c.shadowColor = "#ff5a6a";
		c.shadowBlur = 12;
		for (let i = pred.segs.length - 1; i >= 0; i--) {
			const s = pred.segs[i];
			const t = i / Math.max(1, pred.segs.length - 1);
			c.fillStyle = `rgba(255,${60 + t * 40},${70 + t * 20},0.9)`;
			c.beginPath();
			c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
			c.fill();
		}
		const h = pred.segs[0];
		c.fillStyle = "#fff";
		c.beginPath();
		c.arc(h.x + Math.cos(pred.angle) * 4, h.y + Math.sin(pred.angle) * 4, 3, 0, Math.PI * 2);
		c.fill();
		c.restore();
	}
	drawPlayer() {
		if (this.invuln > 0 && Math.floor(this.time * 12) % 2 === 0) return;
		switch (this.form) {
			case "worm":
				this.drawWorm();
				break;
			case "jellyfish":
				this.drawJelly();
				break;
			case "manta":
				this.drawManta();
				break;
			case "seaslug":
				this.drawSlug();
				break;
		}
	}
	drawWorm() {
		const c = this.ctx;
		const n = this.segs.length;
		c.save();
		for (let i = n - 1; i >= 0; i--) {
			const s = this.segs[i];
			const t = i / Math.max(1, n - 1);
			const col = s.evolved ? "#ffe08a" : `hsl(${160 + t * 40}, 80%, ${55 + (1 - t) * 15}%)`;
			c.shadowColor = col;
			c.shadowBlur = 14;
			c.fillStyle = col;
			c.beginPath();
			c.arc(s.x, s.y, s.r * (1 + (1 - t) * .15), 0, Math.PI * 2);
			c.fill();
			if (n >= 5 && i > 0 && i < n - 1) {
				const prev = this.segs[i - 1];
				const ang = Math.atan2(s.y - prev.y, s.x - prev.x);
				const side = Math.sin(this.time * 3 + i) * .4;
				const frill = 6 + Math.min(10, n * .25);
				c.globalAlpha = .55;
				c.strokeStyle = col;
				c.lineWidth = 2;
				for (const sign of [-1, 1]) {
					c.beginPath();
					c.moveTo(s.x, s.y);
					c.quadraticCurveTo(s.x + Math.cos(ang + Math.PI / 2 * sign) * frill, s.y + Math.sin(ang + Math.PI / 2 * sign) * frill + side * 4, s.x + Math.cos(ang) * -4 + Math.cos(ang + Math.PI / 2 * sign) * frill * .8, s.y + Math.sin(ang) * -4 + Math.sin(ang + Math.PI / 2 * sign) * frill * .8);
					c.stroke();
				}
				if (n >= 8 && i % 2 === 0) {
					c.globalAlpha = .35;
					c.strokeStyle = "#ffffff";
					c.lineWidth = 1;
					c.beginPath();
					c.arc(s.x, s.y, s.r * .7, 0, Math.PI * 2);
					c.stroke();
				}
				c.globalAlpha = 1;
			}
		}
		const h = this.segs[0];
		c.fillStyle = "#e8fff4";
		c.beginPath();
		c.arc(h.x + Math.cos(this.angle) * 5, h.y + Math.sin(this.angle) * 5, 3, 0, Math.PI * 2);
		c.fill();
		c.restore();
	}
	drawJelly() {
		const c = this.ctx;
		const h = this.segs[0];
		const size = 1.35 + Math.min(.8, this.preyEaten * .012);
		const bellW = 28 * size;
		const bellH = 18 * size;
		const tentLen = 40 + this.preyEaten * 2.2 + this.segs.length * 3;
		const tentN = Math.min(12, 5 + Math.floor(this.segs.length / 3));
		c.save();
		c.translate(h.x, h.y);
		c.rotate(this.angle + Math.PI / 2);
		for (let i = 0; i < tentN; i++) {
			const u = tentN <= 1 ? 0 : (i / (tentN - 1) - .5) * bellW * .85;
			const wave = Math.sin(this.time * 2.2 + i * .7) * 6;
			c.strokeStyle = i % 2 === 0 ? "rgba(199,155,255,0.75)" : "rgba(180,220,255,0.65)";
			c.lineWidth = 2.2;
			c.lineCap = "round";
			c.beginPath();
			c.moveTo(u, 4);
			c.bezierCurveTo(u + wave, tentLen * .35, u - wave, tentLen * .65, u + wave * .5, tentLen);
			c.stroke();
		}
		c.shadowColor = "#c79bff";
		c.shadowBlur = 20;
		const grd = c.createRadialGradient(0, -bellH * .2, 4, 0, 0, bellW);
		grd.addColorStop(0, "rgba(255,240,255,0.95)");
		grd.addColorStop(.45, "rgba(199,155,255,0.9)");
		grd.addColorStop(1, "rgba(100,80,180,0.25)");
		c.fillStyle = grd;
		c.beginPath();
		c.moveTo(-bellW, 0);
		c.quadraticCurveTo(-bellW * .9, -bellH * 1.15, 0, -bellH * 1.25);
		c.quadraticCurveTo(bellW * .9, -bellH * 1.15, bellW, 0);
		c.quadraticCurveTo(0, bellH * .35, -bellW, 0);
		c.fill();
		c.strokeStyle = "rgba(255,255,255,0.35)";
		c.lineWidth = 1.5;
		c.stroke();
		c.restore();
	}
	drawManta() {
		const c = this.ctx;
		const h = this.segs[0];
		const flap = Math.sin(this.time * 2.4 + this.speed * .02) * (10 + this.speed * .04);
		const wing = 38 + this.segs.length * .8;
		c.save();
		c.translate(h.x, h.y);
		c.rotate(this.angle);
		c.shadowColor = "#3de0ff";
		c.shadowBlur = 18;
		c.fillStyle = "rgba(61,224,255,0.85)";
		c.beginPath();
		c.moveTo(8, 0);
		c.quadraticCurveTo(wing * .4, -wing * .55 + flap, wing, -flap * .3);
		c.quadraticCurveTo(wing * .5, 8 + flap * .2, 4, 10);
		c.closePath();
		c.fill();
		c.beginPath();
		c.moveTo(8, 0);
		c.quadraticCurveTo(wing * .4, wing * .55 - flap, wing, flap * .3);
		c.quadraticCurveTo(wing * .5, -8 - flap * .2, 4, -10);
		c.closePath();
		c.fill();
		c.fillStyle = "rgba(180,240,255,0.95)";
		c.beginPath();
		c.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
		c.fill();
		c.restore();
		for (let i = 1; i < Math.min(this.segs.length, 10); i++) {
			const s = this.segs[i];
			c.fillStyle = `rgba(61,224,255,${.7 - i * .05})`;
			c.beginPath();
			c.arc(s.x, s.y, Math.max(3, 8 - i * .5), 0, Math.PI * 2);
			c.fill();
		}
	}
	drawSlug() {
		const c = this.ctx;
		const n = this.segs.length;
		c.save();
		for (let i = n - 1; i >= 0; i--) {
			const s = this.segs[i];
			const t = i / Math.max(1, n - 1);
			const col = s.evolved ? "#ffe08a" : `hsl(${320 - t * 40}, 85%, ${58 + (1 - t) * 10}%)`;
			c.shadowColor = col;
			c.shadowBlur = 12;
			c.fillStyle = col;
			c.beginPath();
			c.arc(s.x, s.y, s.r * 1.05, 0, Math.PI * 2);
			c.fill();
			if (i > 0 && i < n - 1) {
				const prev = this.segs[i - 1];
				const ang = Math.atan2(s.y - prev.y, s.x - prev.x);
				const frill = 10 + Math.sin(this.time * 3 + i) * 3;
				c.globalAlpha = .65;
				for (const sign of [-1, 1]) {
					c.fillStyle = col;
					c.beginPath();
					c.ellipse(s.x + Math.cos(ang + Math.PI / 2 * sign) * frill, s.y + Math.sin(ang + Math.PI / 2 * sign) * frill, 4, 7, ang, 0, Math.PI * 2);
					c.fill();
				}
				c.globalAlpha = 1;
			}
		}
		c.restore();
	}
	getHud() {
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
			segs: this.segs.length,
			boosting: this.isBoosting()
		};
	}
};
var emptyHud = () => ({
	phase: "menu",
	form: "worm",
	formName: "Worm",
	depth: 0,
	mute: false,
	tip: false,
	tipAlpha: 0,
	unlocked: ["worm"],
	bestDepth: 0,
	unlockedThisRun: null,
	preyEaten: 0,
	segs: 0,
	boosting: false
});
function DriftGame() {
	const wrapRef = (0, import_react.useRef)(null);
	const canvasRef = (0, import_react.useRef)(null);
	const engRef = (0, import_react.useRef)(null);
	const primaryPtr = (0, import_react.useRef)(null);
	const [hud, setHud] = (0, import_react.useState)(() => {
		const s = loadSave();
		return {
			...emptyHud(),
			form: s.lastForm,
			formName: FORM_META[s.lastForm].name,
			mute: s.mute,
			unlocked: s.unlocked,
			bestDepth: s.bestDepth
		};
	});
	const [selected, setSelected] = (0, import_react.useState)(() => loadSave().lastForm);
	const syncSave = (0, import_react.useCallback)((s) => {
		setHud((h) => ({
			...h,
			mute: s.mute,
			unlocked: s.unlocked,
			bestDepth: s.bestDepth,
			form: s.lastForm,
			formName: FORM_META[s.lastForm].name
		}));
	}, []);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		const wrap = wrapRef.current;
		if (!canvas || !wrap) return;
		const eng = new DriftEngine(canvas, {
			onSave: syncSave,
			onPhase: (p) => setHud((h) => ({
				...h,
				phase: p
			}))
		});
		engRef.current = eng;
		const resize = () => {
			const r = wrap.getBoundingClientRect();
			eng.resize(Math.max(1, r.width), Math.max(1, r.height));
		};
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(wrap);
		eng.startLoop();
		const hudTimer = window.setInterval(() => {
			const h = eng.getHud();
			setHud((prev) => {
				if (prev.phase === h.phase && prev.depth === h.depth && prev.mute === h.mute && prev.tip === h.tip && prev.form === h.form && prev.boosting === h.boosting && prev.segs === h.segs && prev.unlockedThisRun === h.unlockedThisRun && Math.abs(prev.tipAlpha - h.tipAlpha) < .05) return prev;
				return h;
			});
		}, 100);
		return () => {
			clearInterval(hudTimer);
			ro.disconnect();
			eng.dispose();
			engRef.current = null;
		};
	}, [syncSave]);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const onDown = (e) => {
			const eng = engRef.current;
			if (!eng || eng.phase === "menu") return;
			canvas.setPointerCapture(e.pointerId);
			eng.touchIds.add(e.pointerId);
			if (primaryPtr.current === null) {
				primaryPtr.current = e.pointerId;
				eng.setPointer(eng.screenToWorld(e.clientX, e.clientY));
			}
			eng.audio.unlock();
		};
		const onMove = (e) => {
			const eng = engRef.current;
			if (!eng || eng.phase === "menu") return;
			if (primaryPtr.current === e.pointerId || primaryPtr.current === null) {
				if (primaryPtr.current === null && eng.touchIds.has(e.pointerId)) primaryPtr.current = e.pointerId;
				if (primaryPtr.current === e.pointerId) eng.setPointer(eng.screenToWorld(e.clientX, e.clientY));
			}
			if (e.pointerType === "mouse" && eng.phase === "playing") eng.setPointer(eng.screenToWorld(e.clientX, e.clientY));
		};
		const onUp = (e) => {
			const eng = engRef.current;
			if (!eng) return;
			eng.touchIds.delete(e.pointerId);
			if (primaryPtr.current === e.pointerId) {
				primaryPtr.current = null;
				const next = eng.touchIds.values().next();
				if (!next.done) primaryPtr.current = next.value;
			}
		};
		canvas.addEventListener("pointerdown", onDown);
		canvas.addEventListener("pointermove", onMove);
		canvas.addEventListener("pointerup", onUp);
		canvas.addEventListener("pointercancel", onUp);
		return () => {
			canvas.removeEventListener("pointerdown", onDown);
			canvas.removeEventListener("pointermove", onMove);
			canvas.removeEventListener("pointerup", onUp);
			canvas.removeEventListener("pointercancel", onUp);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const wrap = wrapRef.current;
		if (!wrap) return;
		const onMove = (e) => {
			const eng = engRef.current;
			if (!eng || eng.phase !== "playing") return;
			eng.setPointer(eng.screenToWorld(e.clientX, e.clientY));
		};
		wrap.addEventListener("mousemove", onMove);
		return () => wrap.removeEventListener("mousemove", onMove);
	}, []);
	const play = (f) => {
		const eng = engRef.current;
		if (!eng) return;
		eng.audio.unlock();
		setSelected(f);
		eng.startRun(f);
		setHud(eng.getHud());
	};
	const muteToggle = () => {
		engRef.current?.audio.unlock();
		engRef.current?.toggleMute();
	};
	const menuBack = () => {
		engRef.current?.toMenu();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: wrapRef,
		className: "relative h-[100dvh] w-full overflow-hidden bg-abyss select-none",
		style: { touchAction: "none" },
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
			ref: canvasRef,
			className: "absolute inset-0 h-full w-full",
			style: { touchAction: "none" }
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "drift-overlay absolute inset-0 flex flex-col",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "min-w-0",
						children: hud.phase !== "menu" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-2xl bg-deep/70 px-3 py-2 backdrop-blur-md ring-1 ring-cyan/15",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[11px] uppercase tracking-[0.2em] text-muted",
									children: "Depth"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "font-display text-lg font-semibold text-fg tabular-nums",
									children: [hud.depth, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted text-sm font-normal",
										children: " / 7"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm text-cyan",
									children: hud.formName
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "px-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "font-display text-3xl font-light tracking-[0.35em] text-fg",
								children: "DRIFT"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 max-w-[16rem] text-sm text-muted",
								children: "Swim · eat · grow · dive · evolve"
							})]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [hud.phase === "playing" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: menuBack,
							className: "flex h-11 w-11 items-center justify-center rounded-full bg-deep/70 text-fg ring-1 ring-cyan/20 backdrop-blur-md",
							"aria-label": "Menu",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "h-5 w-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: muteToggle,
							className: "flex h-11 w-11 items-center justify-center rounded-full bg-deep/70 text-fg ring-1 ring-cyan/20 backdrop-blur-md",
							"aria-label": hud.mute ? "Unmute" : "Mute",
							children: hud.mute ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "h-5 w-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "h-5 w-5" })
						})]
					})]
				}),
				hud.phase === "playing" && hud.tip && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto mt-2 max-w-sm rounded-2xl bg-deep/75 px-4 py-3 text-center text-sm text-fg ring-1 ring-cyan/20 backdrop-blur-md transition-opacity",
					style: { opacity: Math.min(1, hud.tipAlpha) },
					children: [
						"Move follows your finger or mouse.",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						"Two fingers or ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-cyan",
							children: "Boost"
						}),
						" to surge.",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-orb-red",
							children: "Red"
						}),
						" dives ·",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-orb-blue",
							children: "Blue"
						}),
						" surfaces."
					]
				}),
				hud.phase === "celebrate" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "pointer-events-none absolute inset-0 flex items-center justify-center p-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-3xl bg-deep/85 px-6 py-8 text-center ring-1 ring-gold/30 backdrop-blur-md",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs uppercase tracking-[0.3em] text-gold",
								children: "Depth complete"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2 font-display text-2xl text-fg",
								children: "You found the egg"
							}),
							hud.unlockedThisRun ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3 text-cyan",
								children: ["Unlocked ", FORM_META[hud.unlockedThisRun].name]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 text-muted",
								children: "Beautiful dive. Try another form."
							})
						]
					})
				}),
				hud.phase === "menu" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-auto flex flex-col gap-4 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mx-auto w-full max-w-md space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-2 flex items-end justify-between px-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs uppercase tracking-[0.2em] text-muted",
									children: "Choose form"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs text-muted",
									children: ["Best depth ", hud.bestDepth]
								})]
							}), FORM_ORDER.map((id) => {
								const meta = FORM_META[id];
								const open = hud.unlocked.includes(id);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									disabled: !open,
									onClick: () => {
										if (!open) return;
										setSelected(id);
										engRef.current?.selectForm(id);
									},
									className: `flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition ${open ? selected === id ? "bg-surface/90 ring-cyan/50" : "bg-deep/70 ring-cyan/15 hover:ring-cyan/30" : "cursor-not-allowed bg-deep/40 opacity-45 ring-white/5"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "h-10 w-10 shrink-0 rounded-full",
										style: {
											background: `radial-gradient(circle at 35% 30%, #fff8, ${meta.color})`,
											boxShadow: open ? `0 0 18px ${meta.color}66` : "none"
										}
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "min-w-0 flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "block font-medium text-fg",
											children: [meta.name, !open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "ml-2 text-xs font-normal text-muted",
												children: "Locked"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "block truncate text-xs text-muted",
											children: meta.blurb
										})]
									})]
								}, id);
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => play(selected),
							className: "mx-auto flex h-14 w-full max-w-md items-center justify-center rounded-full bg-cyan text-abyss text-base font-semibold tracking-wide shadow-[0_0_28px_rgba(61,224,255,0.35)]",
							children: "Enter the deep"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mx-auto max-w-md text-center text-[11px] leading-relaxed text-muted",
							children: "Phone: finger steers · two fingers boost. Desktop: mouse steers · Space boosts."
						})
					]
				}),
				hud.phase === "playing" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-auto flex justify-end p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "Boost",
						onPointerDown: (e) => {
							e.preventDefault();
							e.stopPropagation();
							engRef.current?.audio.unlock();
							engRef.current?.setUiBoost(true);
						},
						onPointerUp: () => engRef.current?.setUiBoost(false),
						onPointerLeave: () => engRef.current?.setUiBoost(false),
						onPointerCancel: () => engRef.current?.setUiBoost(false),
						className: `flex h-16 w-16 items-center justify-center rounded-full ring-2 backdrop-blur-md transition ${hud.boosting ? "bg-cyan/30 text-cyan ring-cyan shadow-[0_0_24px_rgba(61,224,255,0.45)]" : "bg-deep/70 text-fg ring-cyan/25"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, {
							className: "h-7 w-7",
							fill: hud.boosting ? "currentColor" : "none"
						})
					})
				})
			]
		})]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DriftGame, {});
}
//#endregion
export { Home as component };
