import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Zap, ChevronLeft } from "lucide-react";
import { DriftEngine } from "./engine";
import { FORM_META, type FormId, type Phase } from "./types";
import { loadSave, type SaveData } from "./storage";

interface Hud {
  phase: Phase;
  form: FormId;
  formName: string;
  depth: number;
  mute: boolean;
  tip: boolean;
  tipAlpha: number;
  unlocked: FormId[];
  bestDepth: number;
  unlockedThisRun: FormId | null;
  preyEaten: number;
  segs: number;
  nextSegReq: number;
  growthStage: number;
  growthMax: number;
  boosting: boolean;
  greenEaten: number;
  extraTails: number;
  bossTails: number;
  bossExposed: boolean;
  bossAlive: boolean;
}

const emptyHud = (): Hud => ({
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
  nextSegReq: 6,
  growthStage: 4,
  growthMax: 8,
  boosting: false,
  greenEaten: 0,
  extraTails: 0,
  bossTails: 0,
  bossExposed: false,
  bossAlive: false,
});

export function DriftGame() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engRef = useRef<DriftEngine | null>(null);
  const primaryPtr = useRef<number | null>(null);

  const [hud, setHud] = useState<Hud>(() => {
    const s = loadSave();
    return {
      ...emptyHud(),
      form: s.lastForm,
      formName: FORM_META[s.lastForm].name,
      mute: s.mute,
      unlocked: s.unlocked,
      bestDepth: s.bestDepth,
    };
  });

  const syncSave = useCallback((s: SaveData) => {
    setHud((h) => ({
      ...h,
      mute: s.mute,
      unlocked: s.unlocked,
      bestDepth: s.bestDepth,
      form: s.lastForm,
      formName: FORM_META[s.lastForm].name,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const eng = new DriftEngine(canvas, {
      onSave: syncSave,
      onPhase: (p) => setHud((h) => ({ ...h, phase: p })),
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
        if (
          prev.phase === h.phase &&
          prev.depth === h.depth &&
          prev.mute === h.mute &&
          prev.tip === h.tip &&
          prev.form === h.form &&
          prev.boosting === h.boosting &&
          prev.segs === h.segs &&
          prev.nextSegReq === h.nextSegReq &&
          prev.growthStage === h.growthStage &&
          prev.greenEaten === h.greenEaten &&
          prev.extraTails === h.extraTails &&
          prev.bossTails === h.bossTails &&
          prev.bossExposed === h.bossExposed &&
          prev.unlockedThisRun === h.unlockedThisRun &&
          Math.abs(prev.tipAlpha - h.tipAlpha) < 0.05
        ) {
          return prev;
        }
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: PointerEvent) => {
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

    const onMove = (e: PointerEvent) => {
      const eng = engRef.current;
      if (!eng || eng.phase === "menu") return;
      if (primaryPtr.current === e.pointerId || primaryPtr.current === null) {
        if (primaryPtr.current === null && eng.touchIds.has(e.pointerId)) {
          primaryPtr.current = e.pointerId;
        }
        if (primaryPtr.current === e.pointerId) {
          eng.setPointer(eng.screenToWorld(e.clientX, e.clientY));
        }
      }
      if (e.pointerType === "mouse" && eng.phase === "playing") {
        eng.setPointer(eng.screenToWorld(e.clientX, e.clientY));
      }
    };

    const onUp = (e: PointerEvent) => {
      const eng = engRef.current;
      if (!eng) return;
      eng.touchIds.delete(e.pointerId);
      if (primaryPtr.current === e.pointerId) {
        primaryPtr.current = null;
        const next = eng.touchIds.values().next();
        if (!next.done) {
          primaryPtr.current = next.value;
        }
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

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onMove = (e: MouseEvent) => {
      const eng = engRef.current;
      if (!eng || eng.phase !== "playing") return;
      eng.setPointer(eng.screenToWorld(e.clientX, e.clientY));
    };
    wrap.addEventListener("mousemove", onMove);
    return () => wrap.removeEventListener("mousemove", onMove);
  }, []);

  const play = () => {
    const eng = engRef.current;
    if (!eng) return;
    eng.audio.unlock();
    eng.startRun("worm");
    setHud(eng.getHud());
  };

  const muteToggle = () => {
    engRef.current?.audio.unlock();
    engRef.current?.toggleMute();
  };

  const menuBack = () => {
    engRef.current?.toMenu();
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-abyss select-none"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ touchAction: "none" }}
      />

      <div className="drift-overlay absolute inset-0 flex flex-col">
        <div className="flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            {hud.phase !== "menu" ? (
              <div className="rounded-2xl bg-deep/70 px-3 py-2 backdrop-blur-md ring-1 ring-cyan/15">
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Depth</div>
                <div className="font-display text-lg font-semibold text-fg tabular-nums">
                  {hud.depth}
                  <span className="text-muted text-sm font-normal"> / 7</span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted tabular-nums">
                  Body {hud.segs}
                  {hud.growthMax > 0 ? (
                    <>
                      {" "}
                      · fill {hud.growthStage}/{hud.growthMax}
                    </>
                  ) : null}
                  {hud.depth < 7 ? (
                    <>
                      {" "}
                      · dive at <span className="text-cyan">{hud.nextSegReq}</span>
                    </>
                  ) : (
                    <> · bottom</>
                  )}
                </div>
                {hud.greenEaten > 0 || hud.extraTails > 0 ? (
                  <div className="mt-0.5 text-[11px] text-muted tabular-nums">
                    {hud.greenEaten > 0 ? (
                      <span className="text-[#7dffe0]">
                        Swift {hud.greenEaten}
                      </span>
                    ) : null}
                    {hud.greenEaten > 0 && hud.extraTails > 0 ? " · " : null}
                    {hud.extraTails > 0 ? (
                      <span className="text-[#ffe08a]">Tails {hud.extraTails}</span>
                    ) : null}
                  </div>
                ) : null}
                {hud.bossAlive ? (
                  <div className="mt-0.5 text-[11px] tabular-nums text-[#ff9ad0]">
                    {hud.bossExposed ? "Eye exposed" : `Guardian hunts · tails ${hud.bossTails}`}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="px-1">
                <h1 className="font-display text-3xl font-light tracking-[0.35em] text-fg">
                  DRIFT
                </h1>
                <p className="mt-1 max-w-[16rem] text-sm text-muted">
                  Swim · eat · grow · dive · evolve
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hud.phase === "playing" && (
              <button
                type="button"
                onClick={menuBack}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-deep/70 text-fg ring-1 ring-cyan/20 backdrop-blur-md"
                aria-label="Menu"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={muteToggle}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-deep/70 text-fg ring-1 ring-cyan/20 backdrop-blur-md"
              aria-label={hud.mute ? "Unmute" : "Mute"}
            >
              {hud.mute ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {hud.phase === "playing" && hud.tip && (
          <div
            className="mx-auto mt-2 max-w-sm rounded-2xl bg-deep/75 px-4 py-3 text-center text-sm text-fg ring-1 ring-cyan/20 backdrop-blur-md transition-opacity"
            style={{ opacity: Math.min(1, hud.tipAlpha) }}
          >
            Move follows your finger or mouse.
            <br />
            Green prey makes you faster. Yellow prey is rare — it grows extra tails once sensors have colored tips.
            <br />
            At the bottom the guardian hunts your tails. Eat its tails, then the eye.
          </div>
        )}

        {hud.phase === "celebrate" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="rounded-3xl bg-deep/85 px-6 py-8 text-center ring-1 ring-gold/30 backdrop-blur-md">
              <div className="text-xs uppercase tracking-[0.3em] text-gold">The deep</div>
              <div className="mt-2 font-display text-2xl text-fg">You took the eye</div>
              <p className="mt-3 text-muted">Beautiful hunt. Enter again to drift deeper.</p>
            </div>
          </div>
        )}

        {hud.phase === "menu" && (
          <div className="mt-auto flex flex-col gap-4 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-md text-center">
              <div className="text-xs uppercase tracking-[0.2em] text-muted">Best depth</div>
              <div className="mt-1 font-display text-3xl font-light text-fg tabular-nums">
                {hud.bestDepth}
                <span className="text-lg text-muted"> / 7</span>
              </div>
            </div>
            <button
              type="button"
              onClick={play}
              className="mx-auto w-full max-w-md rounded-2xl bg-cyan/90 py-3.5 text-center text-base font-semibold text-abyss shadow-[0_0_28px_rgba(61,224,255,0.35)] transition active:scale-[0.98]"
            >
              Enter the drift
            </button>
          </div>
        )}

        {hud.phase === "playing" && (
          <div className="mt-auto flex items-end justify-between gap-3 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="text-xs text-muted/80">
              {hud.boosting ? <span className="text-cyan">Surging…</span> : null}
            </div>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                engRef.current?.audio.unlock();
                engRef.current?.setUiBoost(true);
              }}
              onPointerUp={() => engRef.current?.setUiBoost(false)}
              onPointerLeave={() => engRef.current?.setUiBoost(false)}
              onPointerCancel={() => engRef.current?.setUiBoost(false)}
              className={`flex h-14 min-w-[5.5rem] items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold ring-1 backdrop-blur-md transition active:scale-95 ${
                hud.boosting
                  ? "bg-cyan/30 text-fg ring-cyan/50"
                  : "bg-deep/75 text-fg ring-cyan/25"
              }`}
              aria-label="Boost"
            >
              <Zap className="h-5 w-5 text-cyan" />
              Boost
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
