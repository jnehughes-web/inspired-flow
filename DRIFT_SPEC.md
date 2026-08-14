# DRI: Drift (App Builder) — Updated Spec

## Owner decision
Design is FINAL with the amendments below. Do not ask clarifying questions. Implement and ship a playable demo.

## Problem
I want to play a flOw-like zen aquatic creature game on my phone. The original (thatgamecompany flOw) is hard to buy/play now. Build a new, original game with the same *feel* (swim, eat, grow, dive, evolve) that runs in this app’s live preview.

## Product
**Name:** Drift  
**Genre:** Zen exploration / light risk-reward, top-down 2D  
**Relationship to flOw:** Spiritual homage only. Original name, art, UI, and code. No thatgamecompany trademarks, logos, assets, or character designs copied. Do not title the game “flOw” or “Flow”.

---

## Success (Definition of Done)
1. Game runs in live preview (dev server left up).
2. Real visible content on first load (not blank); console free of uncaught errors.
3. Usable on phone ~390×844: no horizontal overflow; pointer-follow steer + two-finger boost work with touch.
4. One complete short run is possible: grow → dive through depths → reach bottom egg → unlock next form.
5. `startup.sh` exists, idempotent, starts app after revive.
6. `npm run build` and `npm run typecheck` pass.
7. Brief how-to-play summary in product language (no ports/localhost talk).

## Target user & session
- Solo player on phone (primary) or desktop (secondary).
- Session length: short run ~5–15 minutes; replay to unlock forms.
- Mood: calm, hypnotic, bioluminescent — not arcade score spam.
- **Motion tempo:** deliberately slow. Player and all prey move at a reduced, drifting pace (not twitchy arcade speed).

---

## In scope (P0 — must ship)

### Core loop
- Full-screen canvas game, procedural bioluminescent art (no external sprite sheets required).
- **Pointer-follow steering (always on while playing):**
  - The player creature **always follows the mouse cursor** (desktop) or **the primary finger** (touch).
  - Steering is continuous toward the active pointer position; no separate “click to set direction” mode.
  - Soft world bounds (no hard walls that feel broken).
- **Boost:**
  - **Touch:** **two-finger contact** on the play surface triggers boost (second finger does not steal primary steer).
  - Also: on-screen Boost button (≥44px); desktop Space / secondary click-hold.
  - Multi-touch: primary finger steers; second finger (or button) boosts without breaking steering.
- **Prey (plankton / food cells) — multiple colors:**
  - At least **4 distinct prey color families** (e.g. cyan, amber, magenta, soft green), with mild depth tinting.
  - Eating prey grants energy and grows lit body structure.
  - Golden evolve cells still decorate/upgrade segments (distinct from normal multi-color prey).
- Depth planes 0–7; background shifts cyan → indigo/purple; risk/reward rises with depth.
- Red orb = dive one plane; blue orb = surface one plane.
- Multi-segment predators appear deeper; bite their segments to defeat; they can bite player segments.
- Soft fail only: lose all lit segments → float up one plane, revive a few segments (no hard game over). At depth 0, revive and stay at 0.
- Bottom-plane egg completes the run.

### Forms & progression (localStorage)
Unlock order by completing a run (eat bottom egg) with current form. Start menu picks unlocked form:

1. **Worm** (start)
   - Fast turn relative to other forms; dash boost.
   - **Gains visual complexity with growth**, in the same spirit as the sea-slug form: as segments accumulate, the body develops richer detail (extra finlets, segmented banding, cerata-like side frills) rather than a plain polyline of circles.

2. **Jellyfish**
   - Slower turn; boost = vortex that pulls food.
   - **Larger overall size** than the worm at comparable growth.
   - **Head / bell is umbrella-shaped**, clearly arching over the tentacles (not a simple circle).
   - **Tentacles lengthen as total prey consumed increases** (growth is expressed primarily as longer trailing tentacles, not only more blobs).

3. **Manta**
   - **Slower base movement** than worm/jellyfish; glide/coast boost.
   - **Wings animate:** left/right wing membranes **flow up and down** while moving (soft undulation tied to motion, not a rigid kite).

4. **Sea slug**
   - Ribbon / cerata fins; boost = poison trail that damages predators.
   - High visual complexity (reference complexity for how the worm should grow into richer detail).

Persist: unlocked forms, last form, mute, best depth.

### Motion (global)
- **All motion is slower:** player swim speed, prey drift, predator approach, and particle drift use a reduced global tempo so the game feels calm and hypnotic.
- Boost remains a noticeable temporary speed-up, but baseline swimming stays leisurely.

### Audio
- Soft procedural zen pad (Web Audio) + light SFX (eat/boost/unlock).
- Mute toggle; remember in localStorage.

### UI (minimal)
- Title “Drift”, depth indicator, form name, mute control, boost control.
- Fading first-run tip (pointer-follow + two-finger boost + red/blue orbs).
- Form select on menu; short celebration on unlock.

---

## Out of scope (do not build)
- Multiplayer, accounts, leaderboards, IAP, ads
- Exact flOw recreation / licensed assets
- Puzzle “Flow Free” style games
- External APIs, accounts, cloud save
- Level editors, story/dialogue trees
- Complex 3D/WebGL unless canvas 2D is insufficient (prefer 2D canvas)

## P1 (only if P0 is solid and time remains)
- Reduced-motion option (less particles)
- Pause (tap menu / Escape)
- Subtle depth music pitch/mood shift
- Polish: plane transition flash, boost trails, vignette

---

## User journeys (must work)
1. **First launch:** tip → play as Worm → eat/grow (body gains snail-like complexity) → find red orb → dive → survive/soft-fail ok → reach egg → unlock Jellyfish.
2. **Return visit:** menu shows unlocked forms → pick form → new run.
3. **Desktop:** mouse always followed for steer + Space boost + mute.
4. **Touch:** one finger steers (creature follows finger); two fingers boost; Boost button still works.
5. **Mute:** toggle works mid-run; state persists.

## Edge cases
- Multi-touch: primary finger steers; second finger = boost; Boost button must not break steering.
- Soft world bound (no hard walls that feel broken).
- Losing all segments at depth 0: revive, stay at 0 (don’t soft-lock).
- No egg spam if next form already unlocked (still allow complete/celebrate or re-run).
- Safe areas / large enough touch targets for Boost and Mute (≥44px).

## Non-functional
- Aim smooth motion on mid-range phones (throttle particles if needed).
- No horizontal page scroll; `touch-action` / overflow handled for game canvas.
- Works offline after load (no network required for gameplay).
- Accessible enough: visible mute control; high-contrast glowing creatures on dark water.

## Tech constraints (App Builder)
- Workspace: existing React 19 + Vite + TanStack Start + Tailwind.
- Bind **0.0.0.0:8080** (`strictPort`).
- Own **`/workspace/startup.sh`**: idempotent; background start; probe health then start only if down.
- Self-contained `vite.config.ts`: nitro `{ preset: "vercel" }` **only when `command === "build"`**; do not import vendored `vite-tanstack-config`.
- Client-only game loop (no SSR of canvas engine).
- Screenshots for QA under `/workspace/screenshots/` if you smoke-test.
- Leave dev server running when finished.

## Acceptance tests (agent must pass)
- [ ] Menu visible; Worm selectable
- [ ] Creature **always follows** mouse / primary finger
- [ ] **Two-finger touch** boosts on touch devices; Boost button + Space also work
- [ ] Prey appears in **multiple colors**; eating grows body
- [ ] Worm body **gains complexity** (finlets / banding / frills) as it grows
- [ ] Jellyfish has **umbrella bell**, is **larger**, and **tentacles lengthen** with prey eaten
- [ ] Manta is **slower** and **wings undulate** up/down while moving
- [ ] Player and prey motion feel **noticeably slow / drifting**
- [ ] Red/blue orbs change depth
- [ ] At least one predator interaction at mid depth
- [ ] Soft fail floats up without crash
- [ ] Completing bottom egg unlocks next form and saves
- [ ] Mute toggles audio
- [ ] Mobile 390px: playable, no horizontal overflow
- [ ] Production build succeeds and still loads

## Deliverable to user
Short product summary: what Drift is, how to control it, how unlocks work — no sandbox/ops jargon.

---

## Spec deltas (this revision)

| Area | Previous | Now |
|------|----------|-----|
| Steering | Drag / touch-hold toward finger | **Always follow mouse or primary finger** |
| Touch boost | On-screen button primarily | **Two-finger touch = boost**; button remains as alternate |
| Prey colors | Generic plankton | **Multiple distinct prey colors** (4+ families) |
| Worm growth | Lit segments | **Gains complexity like sea-slug form** (finlets, banding, frills) |
| Jellyfish shape | Generic blob/tentacles | **Umbrella-shaped head** over tentacles; **larger** |
| Jellyfish growth | Segments | **Tentacles get longer** as prey consumed increases |
| Manta | Glide boost | **Slower**; **wings flow up and down** while moving |
| Global tempo | Unspecified / normal | **All prey and player motion slower** |
