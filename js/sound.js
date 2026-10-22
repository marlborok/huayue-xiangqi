/* 花月象棋 — soft sound effects, synthesized with Web Audio (no files to load).
 * Gentle on purpose: a paper tap for moves, small bells for captures (bright for the flower kingdom, softer for the moon),
 * a two-note call for check, a rising arpeggio for a win, and a faint blip while a character talks.
 * XQSound.play(name, side); XQSound.enabled is remembered on this device. Browsers only allow sound after a tap,
 * so the audio context starts on the first pointer press.
 */
(function () {
  const KEY = 'huayue.sound';
  let ctx = null, master = null, enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* storage blocked: default on */ }

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  }
  addEventListener('pointerdown', start, { passive: true });

  /* one note: an oscillator with a quick attack and an exponential fade */
  function tone(freq, at, dur, vol, type) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at;
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  /* a bell: the note plus a quiet octave-and-a-fifth partial */
  const bell = (f, at, vol) => { tone(f, at, 0.9, vol, 'sine'); tone(f * 3, at, 0.35, vol * 0.18, 'sine'); };
  /* a paper tap: a short burst of filtered noise */
  function tap(at, vol) {
    const n = Math.floor(ctx.sampleRate * 0.06), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(ctx.currentTime + at);
  }

  const N = { C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };
  const SOUNDS = {
    select: () => tone(N.E6, 0, 0.12, 0.05),
    move: () => { tap(0, 0.35); tone(196, 0, 0.12, 0.08); },
    capture: side => side === 'r'
      ? [N.C6, N.E6, N.G6].forEach((f, i) => bell(f, i * 0.07, 0.12))
      : [N.A5, N.C6, N.E6].forEach((f, i) => bell(f * 0.995, i * 0.1, 0.09)),
    check: () => { tone(N.A5, 0, 0.25, 0.1, 'triangle'); tone(N.E5, 0.18, 0.35, 0.1, 'triangle'); },
    win: side => (side === 'r' ? [N.C5, N.E5, N.G5, N.C6, N.E6] : [N.A5 / 2, N.C5, N.E5, N.A5, N.C6]).forEach((f, i) => bell(f, i * 0.12, 0.12)),
    blip: side => tone(side === 'r' ? 1180 : 820, 0, 0.04, 0.025, 'triangle')
  };

  function play(name, side) {
    if (!enabled || !ctx || ctx.state !== 'running' || !SOUNDS[name]) return;
    SOUNDS[name](side);
  }
  function setEnabled(v) { enabled = v; try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) { /* not remembered, still applies */ } }

  window.XQSound = { play, setEnabled, get enabled() { return enabled; } };
})();
