// ============================================================
// AgeOfTD V2 — audio.js : SFX synthétisés + musique procédurale
// (zéro asset : tout est généré au WebAudio)
// ============================================================
'use strict';

TD.audio = (() => {
  let ctx = null, master, sfxBus, musBus;
  let sfxVol = 0.8, musVol = 0.5;
  let bossMode = false;
  const lastPlay = {};                     // throttle anti-spam

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = musVol * 0.55; musBus.connect(master);
    startMusic();
    return true;
  }

  function setVolumes(sfx, mus) {
    sfxVol = sfx; musVol = mus;
    if (ctx) { sfxBus.gain.value = sfxVol; musBus.gain.value = musVol * 0.55; }
  }

  // ── briques de synthèse ──────────────────────────────────
  function env(g, t0, a, peak, d, sustain = 0) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + a + d);
  }
  function tone(type, freq, t0, a, peak, d, opts = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (opts.glide) o.frequency.exponentialRampToValueAtTime(Math.max(opts.glide, 1), t0 + a + d);
    env(g, t0, a, peak, d);
    o.connect(g);
    let out = g;
    if (opts.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; out.connect(f); out = f; }
    out.connect(opts.bus || sfxBus);
    o.start(t0); o.stop(t0 + a + d + 0.05);
  }
  let noiseBuf = null;
  function noise(t0, a, peak, d, opts = {}) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const g = ctx.createGain(); env(g, t0, a, peak, d);
    const f = ctx.createBiquadFilter();
    f.type = opts.type || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 1500, t0);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t0 + a + d);
    f.Q.value = opts.q || 0.8;
    s.connect(f); f.connect(g); g.connect(opts.bus || sfxBus);
    s.start(t0); s.stop(t0 + a + d + 0.05);
  }
  function pluck(freq, t0, vol = 0.25, bus) {
    tone('triangle', freq, t0, 0.005, vol, 0.32, { glide: freq * 0.985, bus });
    tone('sine', freq * 2, t0, 0.005, vol * 0.25, 0.18, { bus });
  }
  function taikoHit(t0, vol = 0.5, freq = 82, bus) {
    tone('sine', freq, t0, 0.004, vol, 0.3, { glide: freq * 0.5, bus });
    noise(t0, 0.002, vol * 0.5, 0.08, { freq: 900, type: 'lowpass', bus });
  }

  // ── SFX nommés ───────────────────────────────────────────
  const PENTA = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
  const SFX = {
    click:   t => tone('sine', 950, t, 0.002, 0.12, 0.05),
    hover:   t => tone('sine', 1400, t, 0.002, 0.05, 0.03),
    shoot:   t => tone('triangle', 880, t, 0.002, 0.10, 0.07, { glide: 440 }),
    taiko:   t => { taikoHit(t, 0.45); },
    ice:     t => { tone('sine', 1320, t, 0.002, 0.12, 0.22, { glide: 1900 }); tone('sine', 1980, t + 0.03, 0.002, 0.07, 0.18); },
    freeze:  t => { tone('sine', 660, t, 0.005, 0.2, 0.4, { glide: 1320 }); noise(t, 0.01, 0.1, 0.3, { freq: 4000, q: 3 }); },
    zap:     t => { noise(t, 0.002, 0.22, 0.09, { freq: 2800, q: 2, sweep: 700 }); tone('square', 180, t, 0.002, 0.06, 0.07); },
    poison:  t => tone('sine', 200, t, 0.02, 0.15, 0.2, { glide: 120, lp: 600 }),
    beam:    t => tone('sawtooth', 160, t, 0.02, 0.06, 0.25, { lp: 900, glide: 220 }),
    coin:    t => { tone('sine', 1318, t, 0.002, 0.12, 0.07); tone('sine', 1760, t + 0.06, 0.002, 0.12, 0.12); },
    death:   t => { pluck(659, t, 0.14); pluck(880, t + 0.05, 0.1); },
    leak:    t => { tone('sawtooth', 330, t, 0.01, 0.2, 0.3, { glide: 140, lp: 900 }); taikoHit(t + 0.05, 0.4, 60); },
    build:   t => { taikoHit(t, 0.3, 140); tone('sine', 1046, t + 0.06, 0.005, 0.12, 0.15); },
    sell:    t => { tone('sine', 1760, t, 0.002, 0.1, 0.06); tone('sine', 1318, t + 0.06, 0.002, 0.1, 0.1); },
    upgrade: t => { [523, 659, 784, 1046].forEach((f, i) => pluck(f, t + i * 0.06, 0.16)); },
    wave:    t => { tone('sawtooth', 220, t, 0.12, 0.14, 0.4, { lp: 1200 }); taikoHit(t + 0.1, 0.5, 90); },
    boss:    t => { noise(t, 0.05, 0.4, 0.9, { freq: 500, sweep: 90, type: 'lowpass' }); tone('sawtooth', 55, t, 0.05, 0.3, 1.0, { glide: 38, lp: 300 }); },
    ageup:   t => { taikoHit(t, 0.6, 70); tone('sine', 131, t + 0.1, 0.01, 0.35, 1.6, { glide: 130 }); [784, 1046, 1318, 1568].forEach((f, i) => pluck(f, t + 0.2 + i * 0.09, 0.14)); },
    charm:   t => { [1046, 1318, 1568].forEach((f, i) => pluck(f, t + i * 0.07, 0.18)); },
    victory: t => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => pluck(f, t + i * 0.1, 0.2)); taikoHit(t + 0.7, 0.5); },
    defeat:  t => { [440, 415, 349, 293].forEach((f, i) => tone('triangle', f, t + i * 0.22, 0.01, 0.16, 0.4, { lp: 1500 })); },
    crit:    t => { tone('square', 1568, t, 0.002, 0.08, 0.06, { glide: 784 }); },
    shield:  t => { tone('sine', 880, t, 0.002, 0.12, 0.1, { glide: 440 }); noise(t, 0.002, 0.08, 0.12, { freq: 3000, q: 4 }); },
    error:   t => { tone('square', 220, t, 0.002, 0.1, 0.14, { glide: 130, lp: 500 }); },
  };
  const THROTTLE = { shoot: 0.04, ice: 0.06, zap: 0.07, taiko: 0.06, coin: 0.03, death: 0.04, beam: 0.22, hit: 0.05, poison: 0.2, crit: 0.1, error: 0.12 };

  function sfx(name) {
    if (!ctx || !SFX[name]) return;
    const now = ctx.currentTime;
    const min = THROTTLE[name] || 0.02;
    if (lastPlay[name] && now - lastPlay[name] < min) return;
    lastPlay[name] = now;
    try { SFX[name](now); } catch (e) { /* contexte fermé etc. */ }
  }

  // ── Musique : boucle zen pentatonique (koto + nappe + taiko) ──
  let beat = 0, nextNote = 0, timer = null;
  const SCALE = [220, 261.6, 293.7, 329.6, 392];     // A min pentatonique
  let walkIdx = 2;

  function padChord(t0, root) {
    [root, root * 1.5, root * 2].forEach(f => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f * 0.5;
      o.detune.value = TD.util.rand(-6, 6);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.05, t0 + 1.2);
      g.gain.linearRampToValueAtTime(0.0001, t0 + 3.6);
      const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 700;
      o.connect(g); g.connect(f2); f2.connect(musBus);
      o.start(t0); o.stop(t0 + 3.8);
    });
  }

  function schedule() {
    if (!ctx) return;
    const bpm = bossMode ? 96 : 80;
    const beatLen = 60 / bpm / 2;       // croches
    while (nextNote < ctx.currentTime + 0.25) {
      const t = nextNote;
      if (beat % 16 === 0) padChord(t, TD.util.choice([220, 174.6, 196]));
      if (beat % 8 === 0 && (bossMode || TD.util.chance(0.5))) taikoHit(t, bossMode ? 0.3 : 0.16, 70, musBus);
      if (bossMode && beat % 8 === 4) taikoHit(t, 0.2, 95, musBus);
      if (TD.util.chance(bossMode ? 0.42 : 0.3) && beat % 2 === 0) {
        walkIdx = TD.util.clamp(walkIdx + TD.util.randi(-2, 2), 0, SCALE.length - 1);
        const oct = TD.util.chance(0.35) ? 2 : 1;
        pluck(SCALE[walkIdx] * oct, t, 0.12, musBus);
      }
      nextNote += beatLen;
      beat++;
    }
  }
  function startMusic() {
    nextNote = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 100);
  }
  function setBossMode(b) { bossMode = b; }

  return { ensure, sfx, setVolumes, setBossMode };
})();
