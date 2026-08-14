/**
 * Melodic meditation bed (yoga / calm-app style) + soft SFX.
 * Warm drones under a slow pentatonic melody with breath dynamics.
 */

export class DriftAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private padGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private stoppers: Array<() => void> = [];
  private muted = false;
  private started = false;
  private melodyTimer: ReturnType<typeof setTimeout> | null = null;
  private melodyStep = 0;

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.42, this.ctx.currentTime, 0.08);
    }
  }

  isMuted() {
    return this.muted;
  }

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.padGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.padGain.gain.value = 0.2;
      this.sfxGain.gain.value = 0.22;
      this.master.gain.value = this.muted ? 0 : 0.42;
      this.padGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (!this.started) {
      this.started = true;
      this.startMeditationPad();
      this.startMelody();
    }
  }

  /**
   * Warm D-dorian bed: open fifths + soft mid tones under the melody.
   */
  private startMeditationPad() {
    if (!this.ctx || !this.padGain) return;
    const ctx = this.ctx;
    const bus = this.padGain;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.35;
    filter.connect(bus);
    this.nodes.push(filter);

    const breath = ctx.createGain();
    breath.gain.value = 0.5;
    breath.connect(filter);
    const breathLfo = ctx.createOscillator();
    const breathDepth = ctx.createGain();
    breathLfo.type = "sine";
    breathLfo.frequency.value = 0.05; // ~20s breath
    breathDepth.gain.value = 0.18;
    breathLfo.connect(breathDepth);
    breathDepth.connect(breath.gain);
    breathLfo.start();
    this.nodes.push(breath, breathLfo, breathDepth);
    this.stoppers.push(() => {
      try {
        breathLfo.stop();
      } catch {
        /* */
      }
    });

    const addDrone = (
      freq: number,
      type: OscillatorType,
      gain: number,
      detuneCents = 0,
    ) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detuneCents;
      g.gain.value = gain;
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.type = "sine";
      lfo.frequency.value = 0.02 + Math.random() * 0.02;
      lfoG.gain.value = 3;
      lfo.connect(lfoG);
      lfoG.connect(osc.detune);
      osc.connect(g);
      g.connect(breath);
      osc.start();
      lfo.start();
      this.nodes.push(osc, g, lfo, lfoG);
      this.stoppers.push(() => {
        try {
          osc.stop();
          lfo.stop();
        } catch {
          /* */
        }
      });
    };

    // Deep foundation
    addDrone(73.42, "sine", 0.24, 0); // D2
    addDrone(110.0, "sine", 0.16, -4); // A2
    addDrone(146.83, "triangle", 0.08, 2); // D3
    addDrone(174.61, "sine", 0.05, 0); // F3
    addDrone(220.0, "sine", 0.035, -3); // A3

    // Soft noise bed
    try {
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      noise.loop = true;
      const nFilter = ctx.createBiquadFilter();
      nFilter.type = "lowpass";
      nFilter.frequency.value = 260;
      const nGain = ctx.createGain();
      nGain.gain.value = 0.03;
      noise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(breath);
      noise.start();
      this.nodes.push(noise, nFilter, nGain);
      this.stoppers.push(() => {
        try {
          noise.stop();
        } catch {
          /* */
        }
      });
    } catch {
      /* optional */
    }
  }

  /**
   * Slow, singable D-dorian / pentatonic phrases — like a calm yoga playlist lead.
   * Notes land gently, spaced so the line breathes rather than arpeggiating busily.
   */
  private startMelody() {
    if (!this.ctx || !this.padGain) return;
    const ctx = this.ctx;

    // Melody bus (slightly brighter than pad, still soft)
    const melBus = ctx.createGain();
    melBus.gain.value = 0.11;
    const melFilter = ctx.createBiquadFilter();
    melFilter.type = "lowpass";
    melFilter.frequency.value = 1600;
    melFilter.Q.value = 0.5;
    // light reverb-ish delay
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.42;
    const delayFb = ctx.createGain();
    delayFb.gain.value = 0.28;
    const delayMix = ctx.createGain();
    delayMix.gain.value = 0.35;
    melBus.connect(melFilter);
    melFilter.connect(this.padGain);
    melFilter.connect(delay);
    delay.connect(delayFb);
    delayFb.connect(delay);
    delay.connect(delayMix);
    delayMix.connect(this.padGain);
    this.nodes.push(melBus, melFilter, delay, delayFb, delayMix);

    // D E F G A C D  (D dorian-ish / calm yoga scale), mid register
    const scale = [
      146.83, // D3
      164.81, // E3
      174.61, // F3
      196.0, // G3
      220.0, // A3
      261.63, // C4
      293.66, // D4
      329.63, // E4
      349.23, // F4
    ];

    // Phrases: index into scale, null = rest
    const phrases: Array<Array<number | null>> = [
      [0, 2, 4, 5, 4, 2, null],
      [4, 5, 6, 4, 2, 0, null],
      [2, 4, 3, 2, 0, 2, 4],
      [6, 5, 4, 5, 2, null, null],
      [0, 4, 5, 7, 6, 4, null],
      [5, 4, 2, 4, 0, null, null],
      [2, 0, 2, 4, 5, 4, 2],
      [6, 4, 5, 2, 0, null, null],
    ];

    // Flatten into a long looping sequence
    const sequence: Array<number | null> = [];
    for (const p of phrases) sequence.push(...p);

    const beat = 1.35; // seconds per step — unhurried

    const playTone = (freq: number, when: number, dur: number, vol: number) => {
      if (!this.ctx || this.muted) return;
      // Dual soft oscillators for a slightly choral tone
      for (const [type, det, mul] of [
        ["sine", 0, 1],
        ["triangle", 6, 0.35],
      ] as const) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, when);
        osc.detune.setValueAtTime(det, when);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(vol * mul, when + 0.08);
        g.gain.setValueAtTime(vol * mul * 0.85, when + dur * 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        osc.connect(g);
        g.connect(melBus);
        osc.start(when);
        osc.stop(when + dur + 0.05);
      }
    };

    const scheduleAhead = () => {
      if (!this.ctx || !this.started) return;
      const now = this.ctx.currentTime;
      // Schedule ~8 steps ahead each tick
      for (let i = 0; i < 8; i++) {
        const step = this.melodyStep + i;
        const when = now + i * beat + 0.05;
        const note = sequence[step % sequence.length]!;
        if (note != null) {
          const freq = scale[note]!;
          // Slight phrase dynamics
          const vol = 0.09 + (note / scale.length) * 0.04;
          playTone(freq, when, beat * 1.15, vol);
          // Occasional soft harmony a fifth above on phrase ends
          if (note >= 2 && step % 7 === 6) {
            playTone(freq * 1.5, when + 0.05, beat * 0.9, vol * 0.35);
          }
        }
      }
      this.melodyStep += 8;
      this.melodyTimer = setTimeout(scheduleAhead, beat * 6 * 1000);
    };

    // Small intro rest so pad settles first
    this.melodyTimer = setTimeout(scheduleAhead, 1800);
    this.stoppers.push(() => {
      if (this.melodyTimer) clearTimeout(this.melodyTimer);
      this.melodyTimer = null;
    });
  }

  private blip(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.25) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = Math.min(1400, freq * 2.2);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.85), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.04);
  }

  eat() {
    this.blip(380 + Math.random() * 40, 0.18, "sine", 0.16);
  }

  boost() {
    this.blip(140, 0.28, "sine", 0.14);
  }

  dive() {
    this.blip(72, 0.45, "sine", 0.2);
  }

  surface() {
    this.blip(196, 0.35, "sine", 0.16);
  }

  hurt() {
    this.blip(90, 0.3, "triangle", 0.1);
  }

  unlockForm() {
    this.blip(293.66, 0.4, "sine", 0.18);
    setTimeout(() => this.blip(349.23, 0.45, "sine", 0.16), 280);
    setTimeout(() => this.blip(440, 0.7, "sine", 0.14), 560);
  }

  dispose() {
    for (const stop of this.stoppers) stop();
    this.stoppers = [];
    this.nodes = [];
    if (this.melodyTimer) clearTimeout(this.melodyTimer);
    this.melodyTimer = null;
    this.melodyStep = 0;
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.started = false;
  }
}
