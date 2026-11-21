/*
 * Checko intro: topographic contour lines.
 *
 * 1. Fine contour lines flow across a dark field, like a moving terrain map.
 * 2. The terrain rises into the checko wordmark: the lines gather into rings around the letters
 *    (a height field that blends drifting noise with the wordmark's distance field).
 * 3. The shoreline of the letters lights up in gold, then the letters fill in (tick in green).
 * 4. "The fingerprint of things." fades in underneath.
 * 5. The finished frame is handed to the page, which opens it like a pair of doors (intro-loader.tsx).
 *
 * Plain 2D canvas: a coarse grid of heights, marching squares per contour level, one path per frame.
 */

export const BG = '#0B1F1A';
const LINE = '247,245,240';
const GOLD = '201,150,43';

/* Timeline in seconds. */
export const T = {
  appear: [0, .6],
  gather: [1.0, 2.9],   // terrain rises into the wordmark
  shore: [2.6, 3.3],    // the letters' outline lights up
  fill: [3.15, 3.8],    // letters fill in
  tagline: [3.6, 4.3],
  open: 4.9,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ---------- 3D gradient noise (improved Perlin) ---------- */
const perm = new Uint8Array(512);
{
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = 1234567;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function grad(h, x, y, z) {
  const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
function noise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
  return lerp(
    lerp(lerp(grad(perm[AA] & 15, x, y, z), grad(perm[BA] & 15, x - 1, y, z), u),
      lerp(grad(perm[AB] & 15, x, y - 1, z), grad(perm[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(lerp(grad(perm[AA + 1] & 15, x, y, z - 1), grad(perm[BA + 1] & 15, x - 1, y, z - 1), u),
      lerp(grad(perm[AB + 1] & 15, x, y - 1, z - 1), grad(perm[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
}

/* ---------- distance field of a mask (two-pass chamfer, in grid cells) ---------- */
function chamfer(inside, W, H) {
  const INF = 1e9, d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = inside[i] ? 0 : INF;
  const a = 1, b = Math.SQRT2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + a);
    if (y > 0) { v = Math.min(v, d[i - W] + a); if (x > 0) v = Math.min(v, d[i - W - 1] + b); if (x < W - 1) v = Math.min(v, d[i - W + 1] + b); }
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; let v = d[i];
    if (x < W - 1) v = Math.min(v, d[i + 1] + a);
    if (y < H - 1) { v = Math.min(v, d[i + W] + a); if (x < W - 1) v = Math.min(v, d[i + W + 1] + b); if (x > 0) v = Math.min(v, d[i + W - 1] + b); }
    d[i] = v;
  }
  return d;
}

function fit(cv) {
  const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { w: r.width, h: r.height, d };
}

/**
 * @param {{canvas: HTMLCanvasElement, logo: HTMLImageElement, font: string,
 *          onReady: (still: HTMLCanvasElement|null) => void}} o
 */
export function startTopoIntro({ canvas, logo, font, onReady }) {
  const ctx = canvas.getContext('2d');
  let { w, h, d } = fit(canvas);
  const narrow = w < 700;

  /* ---------- the wordmark, recoloured for a dark ground ---------- */
  const LW = Math.round(narrow ? Math.min(w * .78, 380) : Math.min(620, w * .46)), LH = Math.round(LW * logo.naturalHeight / logo.naturalWidth);
  const lx = Math.round((w - LW) / 2), ly = Math.round(h * (narrow ? .44 : .45) - LH / 2);
  const word = document.createElement('canvas'); word.width = LW * d; word.height = LH * d;
  {
    const x = word.getContext('2d', { willReadFrequently: true });
    x.drawImage(logo, 0, 0, word.width, word.height);
    const im = x.getImageData(0, 0, word.width, word.height), p = im.data;
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const green = p[i + 1] > p[i] + 30;
      if (!green) { p[i] = 247; p[i + 1] = 245; p[i + 2] = 240; }
    }
    x.putImageData(im, 0, 0);
  }

  /* ---------- the height grid ---------- */
  const cell = narrow ? 4.5 : 5.5;
  const GW = Math.ceil(w / cell) + 2, GH = Math.ceil(h / cell) + 2;
  // wordmark mask sampled at the grid points, then its distance field (in px)
  const inside = new Uint8Array(GW * GH), cover = new Float32Array(GW * GH);
  {
    const m = document.createElement('canvas'); m.width = GW; m.height = GH;
    const x = m.getContext('2d', { willReadFrequently: true });
    x.drawImage(logo, lx / cell, ly / cell, LW / cell, LH / cell);
    const p = x.getImageData(0, 0, GW, GH).data;
    for (let i = 0; i < GW * GH; i++) { cover[i] = p[i * 4 + 3] / 255; inside[i] = cover[i] > .5 ? 1 : 0; }
  }
  const dOut = chamfer(inside, GW, GH);
  const outside = new Uint8Array(GW * GH); for (let i = 0; i < GW * GH; i++) outside[i] = 1 - inside[i];
  const dIn = chamfer(outside, GW, GH);
  const sdf = new Float32Array(GW * GH);
  for (let i = 0; i < GW * GH; i++) {
    sdf[i] = (inside[i] ? -dIn[i] + .5 : dOut[i] - .5) * cell;
    // at the edge, use the anti-aliased coverage for a sub-cell position (smooth outlines, not stairs)
    if ((inside[i] ? dIn[i] : dOut[i]) <= 1.5 && cover[i] > .02 && cover[i] < .98) sdf[i] = (.5 - cover[i]) * cell * 1.2;
  }

  const ring = narrow ? 11 : 14;           // px between rings around the letters
  const reach = Math.max(LH * 1.5, 160);   // how far the rings spread before the terrain takes over
  const H = new Float32Array(GW * GH);

  const fs = narrow ? Math.min(19, w * .05) : Math.min(28, LW * .046);
  const tag = 'The fingerprint of things.';

  let raf = 0, t0 = performance.now(), done = false, dead = false, skipAt = -1;

  function heights(t, g) {
    const f = 1 / (narrow ? 210 : 300), z = t * .11;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const k = j * GW + i, x = i * cell, y = j * cell;
      // domain-warped noise: slow, flowing terrain
      const wx = noise(x * f * .7, y * f * .7, z + 10) * 1.3, wy = noise(x * f * .7 + 40, y * f * .7, z + 20) * 1.3;
      const n = noise(x * f + wx, y * f + wy, z) + .45 * noise(x * f * 2.1 + wy, y * f * 2.1 + wx, z * 1.6 + 5);
      const terrain = n * 9;
      const s = sdf[k];
      const wv = -s / ring + 3.2;                          // rings around the letters, high ground inside
      const wgt = g * (1 - smooth(reach * .45, reach, s));     // only near the word
      H[k] = terrain * (1 - wgt) + wv * wgt;
    }
  }

  // marching squares for every integer level crossing each cell
  function contours(path, shorePath) {
    for (let j = 0; j < GH - 1; j++) for (let i = 0; i < GW - 1; i++) {
      const k = j * GW + i;
      const a = H[k], b = H[k + 1], c = H[k + GW + 1], e = H[k + GW];
      const lo = Math.min(a, b, c, e), hi = Math.max(a, b, c, e);
      for (let L = Math.ceil(lo); L <= hi; L++) {
        const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (e > L ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x = i * cell, y = j * cell;
        const top = () => [x + cell * (L - a) / (b - a), y];
        const right = () => [x + cell, y + cell * (L - b) / (c - b)];
        const bottom = () => [x + cell * (L - e) / (c - e), y + cell];
        const left = () => [x, y + cell * (L - a) / (e - a)];
        const p = L === 3 && shorePath && sdf[k] < ring * 1.5 ? shorePath : path;
        const seg = (P, Q) => { p.moveTo(P[0], P[1]); p.lineTo(Q[0], Q[1]); };
        switch (idx) {
          case 1: case 14: seg(left(), bottom()); break;
          case 2: case 13: seg(bottom(), right()); break;
          case 3: case 12: seg(left(), right()); break;
          case 4: case 11: seg(top(), right()); break;
          case 6: case 9: seg(top(), bottom()); break;
          case 7: case 8: seg(left(), top()); break;
          case 5: seg(left(), top()); seg(bottom(), right()); break;
          case 10: seg(left(), bottom()); seg(top(), right()); break;
        }
      }
    }
  }

  function draw(t) {
    const g = smooth(T.gather[0], T.gather[1], t);
    heights(t, g);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
    // soft vignette so the centre reads first
    const v = ctx.createRadialGradient(w / 2, h * .45, 0, w / 2, h * .45, Math.max(w, h) * .7);
    v.addColorStop(0, 'rgba(13,77,53,.35)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);

    const shoreOn = t > T.shore[0] - .3;
    const path = new Path2D(), shore = shoreOn ? new Path2D() : null;
    contours(path, shore);
    const appear = smooth(T.appear[0], T.appear[1], t);
    const fill = smooth(T.fill[0], T.fill[1], t);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${LINE},${(.42 - .12 * fill) * appear})`; ctx.lineWidth = 1;
    ctx.stroke(path);
    if (shore) {
      const s = smooth(T.shore[0], T.shore[1], t);
      ctx.strokeStyle = `rgba(${GOLD},${(.35 + .65 * s) * (1 - .75 * fill) * appear})`; ctx.lineWidth = 1 + 1 * s;
      ctx.stroke(shore);
    }
    if (fill > 0) {
      ctx.globalAlpha = fill;
      ctx.drawImage(word, lx, ly + (1 - fill) * 6, LW, LH);
      ctx.globalAlpha = 1;
    }
    const tg = smooth(T.tagline[0], T.tagline[1], t);
    if (tg > 0) {
      ctx.font = `500 ${fs}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = `rgba(${LINE},${.9 * tg})`;
      ctx.fillText(tag, w / 2, ly + LH + fs * 2.1 + (1 - tg) * 8);
    }
  }

  function frame(now) {
    if (dead) return;
    let t = (now - t0) / 1000;
    if (skipAt >= 0) t = Math.max(t, T.open);
    draw(Math.min(t, T.open));
    if (t >= T.open && !done) {
      done = true;
      const still = document.createElement('canvas'); still.width = canvas.width; still.height = canvas.height;
      still.getContext('2d').drawImage(canvas, 0, 0);
      onReady(still);
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    destroy() { dead = true; cancelAnimationFrame(raf); },
    skip() { skipAt = 1; },
  };
}
