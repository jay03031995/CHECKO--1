/*
 * Checko intro (v2): the wordmark develops out of ink.
 *
 * 0. Drops of ink fall onto white paper all over the screen ("tup, tup, tup…") and each one spreads into a blot.
 * 1. The blots rush together into the word ("zoom") and land inside the letters.
 * 2. Each landed drop spreads with a ragged, wet edge. Where two drops meet the ink overlaps and darkens,
 *    the way ink does on paper. Inside the letters it soaks in fully; outside, only a faint bleed.
 * 3. The ink settles into the crisp checko wordmark (tick in green).
 * 4. "The fingerprint of things." is inked in underneath, left to right.
 * 5. The finished frame is handed to the page, which opens it like a pair of doors (intro-loader.tsx).
 *
 * Everything is a 2D canvas: one precomputed "arrival time" field per pixel, shaded each frame.
 */

/* Timeline in seconds. */
export const T = {
  rain: [0.25, 1.75],     // drops fall all over the screen and spread into blots
  fly: [1.75, 2.55],      // the blots rush into the word
  ink: [2.3, 3.6],        // inside the letters the ink spreads (each drop starts when its blot lands)
  settle: [3.45, 4.0],    // the ink settles into the crisp wordmark
  tagline: [3.85, 4.85],  // the tagline is inked in
  open: 5.6,              // hand over to the doors
};
const TAU = Math.PI * 2;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function fit(cv) {
  const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { w: r.width, h: r.height, d };
}

// small value noise for ragged ink edges
function noise2(seed) {
  const N = 256, v = new Float32Array(N * N);
  let s = seed >>> 0;
  for (let i = 0; i < v.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; v[i] = s / 4294967296; }
  const f = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = f(x - xi), yf = f(y - yi);
    const i0 = (xi & 255), j0 = (yi & 255), i1 = (i0 + 1) & 255, j1 = (j0 + 1) & 255;
    const a = v[j0 * N + i0], b = v[j0 * N + i1], c = v[j1 * N + i0], d = v[j1 * N + i1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

/**
 * @param {{canvas: HTMLCanvasElement, logo: HTMLImageElement, font: string,
 *          onReady: (frame: HTMLCanvasElement) => void, sound?: any}} o
 * @returns {{destroy: () => void, skip: () => void}}
 */
export function startInkIntro({ canvas, logo, font, onReady, sound }) {
  const ctx = canvas.getContext('2d');
  const debug = /intro=debug/.test(location.search);
  let { w, h } = fit(canvas);
  let raf = 0, last = performance.now(), clock = 0, dead = false, handed = false, skipAt = -1, zoomed = false, settled = false;
  const narrow = w < 640;

  /* ---------- the wordmark and its ink field ---------- */
  const LW = Math.round(narrow ? Math.min(w * .8, 360) : Math.min(600, w * .5)), LH = Math.round(LW * logo.naturalHeight / logo.naturalWidth);
  const PAD = Math.round(LW * .09);
  // field resolution: fine enough for a sharp wet edge, light enough to shade every frame
  const FS = narrow ? 1.5 : 1.25;
  const FW = Math.round((LW + PAD * 2) * FS), FH = Math.round((LH + PAD * 2) * FS);
  const mc = document.createElement('canvas'); mc.width = FW; mc.height = FH;
  const mx = mc.getContext('2d', { willReadFrequently: true });
  mx.drawImage(logo, PAD * FS, PAD * FS, LW * FS, LH * FS);
  const src = mx.getImageData(0, 0, FW, FH).data;
  const n = FW * FH;
  const ink = new Float32Array(n), green = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2], a = src[i * 4 + 3] / 255;
    ink[i] = a;
    if (a > .2 && g > r + 40) green[i] = 1;
  }
  // blurred copy of the mask: the faint bleed outside the letters follows the letters
  mx.clearRect(0, 0, FW, FH); mx.filter = `blur(${(LW * .018 * FS).toFixed(1)}px)`;
  mx.drawImage(logo, PAD * FS, PAD * FS, LW * FS, LH * FS); mx.filter = 'none';
  const near = mx.getImageData(0, 0, FW, FH).data;

  // the drops: seeded inside the letters, landing roughly left to right, the tick last
  const inside = [];
  for (let y = 0; y < FH; y += 3) for (let x = 0; x < FW; x += 3) { const i = y * FW + x; if (ink[i] > .6 && !green[i]) inside.push([x, y]); }
  const tickPts = [];
  for (let y = 0; y < FH; y += 3) for (let x = 0; x < FW; x += 3) { const i = y * FW + x; if (green[i] && ink[i] > .6) tickPts.push([x, y]); }
  const DROPS = narrow ? 13 : 17;
  const drops = [];
  for (let k = 0; k < DROPS; k++) {
    // stratify along x so every part of the word gets ink
    const lo = k / DROPS, hi = (k + 1) / DROPS;
    const pool = inside.filter(([x]) => x / FW >= lo * .9 + .03 && x / FW < hi * .9 + .07);
    const p = (pool.length ? pool : inside)[Math.floor(Math.random() * (pool.length || inside.length))];
    drops.push({ x: p[0], y: p[1], t: 0, v: (.85 + Math.random() * .4) * LW * FS * .2, tone: .55 + Math.random() * .2 });
  }
  if (tickPts.length) { const p = tickPts[Math.floor(tickPts.length / 2)]; drops.push({ x: p[0], y: p[1], t: 0, v: LW * FS * .16, tone: .7, g: true }); }

  /* ---------- the rain: blots all over the screen, then they rush into the word ---------- */
  const startLayout = (() => { const total = LH + (narrow ? 26 : 34) + Math.ceil((narrow ? Math.min(26, w * .066) : Math.min(38, LW * .066)) * 1.5); const cy = h / 2 - total / 2 + LH / 2 - (narrow ? 10 : 6); return { cx: w / 2, cy }; })();
  const toScreen = d => [startLayout.cx - LW / 2 - PAD + d.x / FS, startLayout.cy - LH / 2 - PAD + d.y / FS];
  const NB = narrow ? 34 : 64;
  const blots = [];
  for (let i = 0; i < NB; i++) {
    // keep blots off the word itself, so the word visibly forms out of them
    let x, y, tries = 0;
    do { x = w * (.04 + Math.random() * .92); y = h * (.06 + Math.random() * .88); tries++; }
    while (tries < 20 && Math.abs(x - startLayout.cx) < LW * .62 && Math.abs(y - startLayout.cy) < LH * 1.1);
    const feed = i < drops.length ? drops[i] : drops[Math.floor(Math.random() * drops.length)];
    const land = T.rain[0] + (i / NB) * (T.rain[1] - T.rain[0] - .25) + Math.random() * .12;
    const go = T.fly[0] + Math.random() * .3, dur = .5 + Math.random() * .25;
    const r = (narrow ? 5 : 7) + Math.pow(Math.random(), 1.6) * (narrow ? 11 : 17);
    const spl = Array.from({ length: 4 + (Math.random() * 4 | 0) }, () => ({ a: Math.random() * TAU, d: 1.15 + Math.random() * .7, r: .12 + Math.random() * .2 }));
    const bend = (Math.random() - .5) * .9;
    blots.push({ x, y, land, go, dur, r, spl, feed, bend, played: false, ph: Math.random() * TAU });
  }
  // each word drop starts spreading the moment its first blot arrives
  for (const d of drops) {
    const mine = blots.filter(b => b.feed === d);
    d.t = mine.length ? Math.min(...mine.map(b => b.go + b.dur)) : T.fly[1];
  }

  // arrival time of the nearest two drops for every pixel (ragged by noise)
  const nz = noise2(Math.random() * 1e9 | 0), sc = 7 / (LW * FS);
  const a1 = new Float32Array(n), a2 = new Float32Array(n), t1 = new Float32Array(n), t2 = new Float32Array(n);
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const i = y * FW + x;
      const rag = .78 + nz(x * sc, y * sc) * .3 + nz(x * sc * 4.3, y * sc * 4.3) * .14;
      // ink soaks in fast inside the letters, slowly into the bare paper around them
      const inLetter = ink[i], slow = 1 + (1 - inLetter) * 2.2;
      let b1 = 1e9, b2 = 1e9, s1 = .6, s2 = .6;
      for (const d of drops) {
        if (green[i] !== (d.g ? 1 : 0) && inLetter > .5) continue; // the tick fills from its own drop
        const dist = Math.hypot(x - d.x, y - d.y);
        const at = d.t + (dist / d.v) * rag * slow;
        if (at < b1) { b2 = b1; s2 = s1; b1 = at; s1 = d.tone; } else if (at < b2) { b2 = at; s2 = d.tone; }
      }
      a1[i] = b1; a2[i] = b2; t1[i] = s1; t2[i] = s2;
    }
  }

  const fc = document.createElement('canvas'); fc.width = FW; fc.height = FH;
  const fx = fc.getContext('2d');
  const img = fx.createImageData(FW, FH), px = img.data;
  const EDGE = .09;
  function shadeInk(c) {
    const settle = smooth(T.settle[0], T.settle[1], c);
    for (let i = 0; i < n; i++) {
      const L = ink[i];
      // coverage of the two nearest drops, each with a soft wet front
      const c1 = smooth(a1[i] - EDGE, a1[i] + EDGE, c), c2 = smooth(a2[i] - EDGE, a2[i] + EDGE, c);
      if (c1 <= 0) { px[i * 4 + 3] = 0; continue; }
      // the wet rim: ink pools darker at the front while it is still moving
      const rim1 = c1 * Math.exp(-Math.max(0, c - a1[i]) * 9) * .35, rim2 = c2 * Math.exp(-Math.max(0, c - a2[i]) * 9) * .35;
      // overlap: two layers of translucent ink are darker than one
      const l1 = clamp(c1 * t1[i] + rim1, 0, 1), l2 = clamp(c2 * t2[i] + rim2, 0, 1);
      let al = 1 - (1 - l1) * (1 - l2);
      // inside the letters the ink deepens to solid; outside it stays a faint, fading bleed
      const halo = (near[i * 4 + 3] / 255) * .34 * (1 - settle);
      al = L * mix(al, 1, settle) + (1 - L) * Math.min(al, halo);
      const g = green[i];
      px[i * 4] = g ? 78 : 26; px[i * 4 + 1] = g ? 171 : 29; px[i * 4 + 2] = g ? 71 : 31;
      px[i * 4 + 3] = Math.round(clamp(al, 0, 1) * 255);
    }
    fx.putImageData(img, 0, 0);
  }
  const mix = (a, b, t) => a + (b - a) * t;

  /* ---------- the tagline ---------- */
  const line = 'The fingerprint of things.';
  const fs = narrow ? Math.min(26, w * .066) : Math.min(38, LW * .066);
  const gap = narrow ? 26 : 34, TH = Math.ceil(fs * 1.5);
  const layout = () => {
    const total = LH + gap + TH;
    const cy = h / 2 - total / 2 + LH / 2 - (narrow ? 10 : 6);
    return { cx: w / 2, cy, ty: cy + LH / 2 + gap + TH / 2 };
  };
  const tc = document.createElement('canvas'), tx = tc.getContext('2d');
  const onResize = () => { ({ w, h } = fit(canvas)); };
  window.addEventListener('resize', onResize);

  function drawTagline(cx, ty, c, d) {
    const p = smooth(T.tagline[0], T.tagline[1], c);
    if (p <= 0) return;
    ctx.font = `500 ${fs}px ${font}`;
    const tw = Math.ceil(ctx.measureText(line).width) + 20;
    tc.width = Math.round(tw * d); tc.height = Math.round(TH * d);
    tx.setTransform(d, 0, 0, d, 0, 0);
    tx.font = `500 ${fs}px ${font}`; tx.textAlign = 'center'; tx.textBaseline = 'middle'; tx.fillStyle = '#50555a';
    tx.fillText(line, tw / 2, TH / 2);
    // ink runs along the line: a ragged front, with a darker wet edge
    tx.globalCompositeOperation = 'destination-in';
    const front = -30 + p * (tw + 60);
    const g = tx.createLinearGradient(front - 40, 0, front + 6, 0);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    tx.fillStyle = g; tx.fillRect(0, 0, tw, TH);
    tx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tc, cx - tw / 2, ty - TH / 2, tw, TH);
  }

  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const dt = debug ? 1 / 60 : Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    clock += dt;
    if (debug) window.__introClock = clock;
    const c = skipAt >= 0 ? Math.max(clock, T.open) : clock;
    const d = Math.min(window.devicePixelRatio || 1, 3);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { cx, cy, ty } = layout();

    // the rain: each drop falls (big and faint, then small and dark), lands with a splash and spreads;
    // then the blots rush along a curve into the letters and are absorbed
    ctx.fillStyle = '#1a1d1f';
    for (const b of blots) {
      if (c < b.land - .16) continue;
      const [tx, ty] = toScreen(b.feed);
      if (c < b.land) {
        const u = (c - (b.land - .16)) / .16;
        ctx.globalAlpha = .12 + u * .5; ctx.beginPath(); ctx.arc(b.x, b.y - (1 - u) * 26, b.r * .35 * (1 + (1 - u) * 2.2), 0, TAU); ctx.fill();
        continue;
      }
      if (!b.played) { b.played = true; if (sound && skipAt < 0) sound.tap(.75 + (1 - b.r / 24) * .6 + Math.random() * .15, .6 + b.r / 40); }
      const grow = 1 - Math.exp(-(c - b.land) * 7);
      const fly = clamp((c - b.go) / b.dur, 0, 1), e = fly * fly * (3 - 2 * fly);
      if (fly >= 1) continue;
      const mx2 = (b.x + tx) / 2 + (ty - b.y) * b.bend, my2 = (b.y + ty) / 2 - (tx - b.x) * b.bend;
      const at = q => [(1 - q) * (1 - q) * b.x + 2 * (1 - q) * q * mx2 + q * q * tx, (1 - q) * (1 - q) * b.y + 2 * (1 - q) * q * my2 + q * q * ty];
      const [px2, py2] = at(e);
      const R = b.r * (.35 + .65 * grow) * (1 - e * .7);
      // a liquid trail while it travels
      if (fly > 0) for (let k = 1; k <= 14; k++) {
        const [qx, qy] = at(Math.max(0, e - k * .012));
        ctx.globalAlpha = .5 * (1 - k / 15); ctx.beginPath(); ctx.arc(qx, qy, R * (1 - k * .055), 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = .88;
      ctx.beginPath(); ctx.arc(px2, py2, R, 0, TAU); ctx.fill();
      // the splash around a blot that has just landed (it pulls in when the blot starts to move)
      if (fly < .25) {
        ctx.globalAlpha = .8 * (1 - fly * 4);
        for (const sp of b.spl) {
          const d = R * sp.d * (.6 + .4 * grow);
          ctx.beginPath(); ctx.arc(px2 + Math.cos(sp.a) * d, py2 + Math.sin(sp.a) * d, Math.max(.6, R * sp.r), 0, TAU); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    if (!zoomed && c >= T.fly[0] - .05) { zoomed = true; if (sound && skipAt < 0) sound.zoom(.8); }
    if (!settled && c >= T.settle[0]) { settled = true; if (sound && skipAt < 0) sound.settle(); }

    // the crisp wordmark comes up under the settled ink, then the ink lifts off it
    const sharp = smooth(T.settle[1] - .25, T.settle[1], c);
    const inkOut = smooth(T.settle[1], T.settle[1] + .35, c);
    if (inkOut < 1 && c >= T.fly[0] + .3) {
      shadeInk(c);
      ctx.globalAlpha = 1 - inkOut;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(fc, cx - LW / 2 - PAD, cy - LH / 2 - PAD, LW + PAD * 2, LH + PAD * 2);
    }
    if (sharp > 0) { ctx.globalAlpha = sharp; ctx.drawImage(logo, cx - LW / 2, cy - LH / 2, LW, LH); }
    ctx.globalAlpha = 1;
    drawTagline(cx, ty, c, d);

    if (!handed && c >= T.open) {
      handed = true;
      const out = document.createElement('canvas'); out.width = canvas.width; out.height = canvas.height;
      const o = out.getContext('2d');
      o.fillStyle = '#fff'; o.fillRect(0, 0, out.width, out.height);
      o.drawImage(canvas, 0, 0);
      onReady(out);
    }
  }

  raf = requestAnimationFrame(t => { last = t; frame(t); });
  return {
    skip() { if (skipAt < 0) skipAt = clock; },
    destroy() { dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); },
  };
}
