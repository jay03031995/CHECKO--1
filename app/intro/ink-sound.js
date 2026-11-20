/*
 * Sounds for the ink intro, synthesised with Web Audio (no audio files to download).
 *  tap():  one ink drop landing, a short wet "tup" with a little pitch variation
 *  zoom(): the drops rushing together into the wordmark, a soft rising whoosh
 *  settle(): a low, quiet thud as the ink sets
 * Browsers only let a page play sound after the visitor has interacted with it, so the context may
 * start suspended; the intro shows a "Sound on" button, and any click or key press also turns it on.
 */
export function createInkSound() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  let ctx;
  try { ctx = new AC(); } catch { return null; }
  const master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  let noiseBuf = null;
  const noise = () => {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  };
  const live = () => ctx.state === 'running';
  return {
    get running() { return live(); },
    resume() { return ctx.resume().catch(() => undefined); },
    onState(fn) { ctx.onstatechange = () => fn(live()); },
    tap(pitch = 1, vol = 1) {
      if (!live()) return;
      const t = ctx.currentTime;
      // the body of the drop: a sine that drops in pitch fast
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(900 * pitch, t);
      o.frequency.exponentialRampToValueAtTime(260 * pitch, t + 0.07);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32 * vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.13);
      // the wet click on contact
      const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
      n.buffer = noise(); f.type = 'bandpass'; f.frequency.value = 2400 * pitch; f.Q.value = 1.2;
      ng.gain.setValueAtTime(0.12 * vol, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      n.connect(f).connect(ng).connect(master); n.start(t, Math.random() * 0.8, 0.04);
    },
    zoom(dur = 0.75) {
      if (!live()) return;
      const t = ctx.currentTime;
      const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      n.buffer = noise(); n.loop = true;
      f.type = 'bandpass'; f.Q.value = 2.2;
      f.frequency.setValueAtTime(220, t); f.frequency.exponentialRampToValueAtTime(2600, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
      n.connect(f).connect(g).connect(master); n.start(t); n.stop(t + dur + 0.15);
    },
    settle() {
      if (!live()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.4);
    },
    close() { try { ctx.close(); } catch { /* already closed */ } },
  };
}
