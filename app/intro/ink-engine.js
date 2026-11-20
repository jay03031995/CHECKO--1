/*
 * Checko intro.
 *
 * 1. Black specks drift across the screen (the ink in the air).
 * 2. Some of them fly together into the checko wordmark.
 * 3. The dots develop into ink: they spread and run together, then settle into the crisp wordmark (tick in green).
 * 4. "The fingerprint of things." gathers underneath.
 * 5. The finished frame is handed to the page, which opens it like a pair of doors (intro-loader.tsx).
 *
 * Dots: 2D canvas. Ink: a small WebGL canvas over the wordmark that renders the merged ink.
 * Without WebGL the dots simply stay dots.
 */

const TAU = Math.PI * 2;

/* Timeline in seconds. */
export const T = {
  gather: [0.5, 2.2],     // dots fly into the wordmark (staggered)
  develop: [2.15, 3.2],   // dots spread and run together into solid ink
  tagline: [3.2, 4.3],    // the tagline gathers underneath, then turns crisp
  open: 5.1,              // hand over to the doors
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const mix = (a, b, t) => a + (b - a) * t;

function fit(cv) {
  const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { w: r.width, h: r.height, d };
}

// sample a mask into dot positions on a hexagonal grid, centred on (0,0)
function sample(draw, W, H, sp, test) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  draw(x);
  const px = x.getImageData(0, 0, W, H).data, pts = [];
  let row = 0;
  for (let y = sp / 2; y < H; y += sp * .866, row++) {
    for (let xx = (row % 2 ? sp / 2 : 0) + sp / 4; xx < W; xx += sp) {
      const jx = xx + (Math.random() - .5) * .35 * sp, jy = y + (Math.random() - .5) * .35 * sp;
      const i = (Math.round(jy) * W + Math.round(jx)) * 4;
      const kind = test(px[i], px[i + 1], px[i + 2], px[i + 3]);
      if (kind) pts.push({ x: jx - W / 2, y: jy - H / 2, g: kind === 2 });
    }
  }
  return pts;
}

/* ---------- the ink: a height field lit as a raised, glossy surface ---------- */
// red channel = black ink, green channel = the green tick; both add up into one surface
function inkGL(cv) {
  const gl = cv.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false, alpha: true });
  if (!gl) return null;
  const vs = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const fs = `precision mediump float;varying vec2 v;uniform sampler2D F;uniform vec2 T;uniform float thr,relief;uniform vec3 L;uniform vec2 tilt;
  float fh(vec2 p){vec4 c=texture2D(F,p);return c.r+c.g;}
  float ht(vec2 p){return smoothstep(thr,.95,fh(p));}
  void main(){
    vec2 uv=v-tilt*ht(v)*.03*relief;
    vec4 c=texture2D(F,uv);
    float f=c.r+c.g;
    float cov=smoothstep(thr-.025,thr+.025,f);
    float hx=ht(uv+vec2(T.x,0.))-ht(uv-vec2(T.x,0.)),hy=ht(uv+vec2(0.,T.y))-ht(uv-vec2(0.,T.y));
    vec3 n=normalize(vec3(-hx*4.2*relief,-hy*4.2*relief,1.));
    vec3 l=normalize(L),hv=normalize(l+vec3(0.,0.,1.));
    float nh=max(dot(n,hv),0.);
    float spec=pow(nh,48.)*.75+pow(nh,8.)*.08;
    float gr=clamp(c.g/max(f,.001),0.,1.);
    vec3 base=mix(vec3(.03,.034,.038),vec3(.2,.6,.19),gr);
    vec3 ink=base+vec3((1.-n.z)*.1)+vec3(spec);
    ink=mix(mix(vec3(.102,.114,.122),vec3(.306,.671,.278),gr),ink,relief);
    float sh=ht(uv+l.xy*T*9.)*(1.-cov)*.3*relief;
    gl_FragColor=vec4(ink*cov,max(cov,sh*.7));
  }`;
  const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
  [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const u = n => gl.getUniformLocation(pr, n), uT = u('T'), uThr = u('thr'), uRel = u('relief'), uL = u('L'), uTilt = u('tilt');
  return {
    draw(field, upload, o) {
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (upload) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, field);
      gl.uniform2f(uT, 1.4 / field.width, 1.4 / field.height); gl.uniform1f(uThr, .32); gl.uniform1f(uRel, o.relief);
      gl.uniform3f(uL, o.L[0], o.L[1], o.L[2]); gl.uniform2f(uTilt, o.tilt[0], o.tilt[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    release() { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); },
  };
}

// one soft blob, pre-rendered per channel; drawn scaled with "lighter" so overlapping blobs add up into liquid
const STOPS = [[0, 158], [.2, 139], [.4, 97], [.6, 51], [.8, 21], [1, 0]];
function blobSprite(channel) {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  STOPS.forEach(([o, v]) => g.addColorStop(o, channel === 'g' ? `rgb(0,${v},0)` : `rgb(${v},0,0)`));
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return c;
}

/**
 * @param {{canvas: HTMLCanvasElement, logo: HTMLImageElement, font: string,
 *          onReady: (frame: HTMLCanvasElement) => void}} o
 * @returns {{destroy: () => void, skip: () => void}}
 */
export function startInkIntro({ canvas, logo, font, onReady }) {
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;
  const debug = /intro=debug/.test(location.search);
  let { w, h } = fit(canvas);
  let raf = 0, last = performance.now(), clock = 0, dead = false, handed = false, skipAt = -1;
  const narrow = w < 640;

  /* ---------- the wordmark ---------- */
  const LW = Math.round(narrow ? Math.min(w * .8, 360) : Math.min(600, w * .5)), LH = Math.round(LW * logo.naturalHeight / logo.naturalWidth);
  const spL = Math.max(3.2, LW / 120);
  const word = sample(x => x.drawImage(logo, 0, 0, LW, LH), LW, LH, spL, (r, g, b, a) => {
    if (a < 140) return 0;
    if (g > r + 40) return 2;
    return r < 110 && g < 110 && b < 110 ? 1 : 0;
  });
  /* ---------- the tagline, underneath ---------- */
  const line = 'The fingerprint of things.';
  const fs = narrow ? Math.min(26, w * .066) : Math.min(38, LW * .066);
  const meas = document.createElement('canvas').getContext('2d'); meas.font = `500 ${fs}px ${font}`;
  const TW = Math.ceil(meas.measureText(line).width + fs * .4), TH = Math.ceil(fs * 1.5);
  const spT = Math.max(1.9, fs / 16);
  const tagPts = sample(x => { x.font = `500 ${fs}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#000'; x.fillText(line, TW / 2, TH / 2); },
    TW, TH, spT, (r, g, b, a) => a > 110 ? 1 : 0);

  const gap = narrow ? 26 : 34;
  const layout = () => {
    const total = LH + gap + TH;
    const cy = h / 2 - total / 2 + LH / 2 - (narrow ? 10 : 6);
    return { cx: w / 2, cy, ty: cy + LH / 2 + gap + TH / 2 };
  };

  const mkDots = (pts, start, span) => pts.map(p => ({
    p, sx: Math.random() * w, sy: Math.random() * h, ph: Math.random() * TAU, r0: .7 + Math.random() * 1.2,
    // tick dots arrive last; the rest land in a loose left-to-right wave
    t0: p.g ? start + span * .85 : start + span * clamp(((p.x / (pts === word ? LW : TW)) + .5) * .5 + Math.random() * .45, 0, 1) * .6,
  }));
  const wDots = mkDots(word, T.gather[0], T.gather[1] - T.gather[0]);
  const tDots = mkDots(tagPts, T.tagline[0], T.tagline[1] - T.tagline[0] - .25);

  /* ---------- the ink layer ---------- */
  const PAD = Math.round(LW * .06);
  const gcv = document.createElement('canvas');
  gcv.className = 'intro-ink'; gcv.setAttribute('aria-hidden', 'true');
  Object.assign(gcv.style, { width: LW + PAD * 2 + 'px', height: LH + PAD * 2 + 'px', opacity: '0' });
  host.appendChild(gcv);
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  gcv.width = Math.round((LW + PAD * 2) * dpr); gcv.height = Math.round((LH + PAD * 2) * dpr);
  let G = null;
  try { G = inkGL(gcv); } catch { G = null; }
  const FS = Math.max(narrow ? 1.6 : 2, Math.min(dpr, 3)); // field resolution per CSS px: matches the screen, up to 3×
  const field = document.createElement('canvas');
  field.width = Math.round((LW + PAD * 2) * FS); field.height = Math.round((LH + PAD * 2) * FS);
  const fctx = field.getContext('2d');
  const sprR = blobSprite('r'), sprG = blobSprite('g');
  let fieldKey = '';
  function paintField(dev) {
    const k = dev.toFixed(3); if (k === fieldKey) return false; fieldKey = k;
    fctx.globalCompositeOperation = 'source-over'; fctx.fillStyle = '#000'; fctx.fillRect(0, 0, field.width, field.height);
    fctx.globalCompositeOperation = 'lighter';
    // each dot spreads from a bead into a pool and runs into its neighbours
    const grow = easeOut(dev), base = spL * mix(.32, .62, grow);
    for (const d of wDots) {
      const s = base * (.9 + (d.ph / TAU) * .2), R = s * 2.5 * FS;
      const x = (d.p.x + LW / 2 + PAD) * FS, y = (d.p.y + LH / 2 + PAD) * FS;
      fctx.globalAlpha = 1;
      fctx.drawImage(d.p.g ? sprG : sprR, x - R, y - R, R * 2, R * 2);
    }
    fctx.globalAlpha = 1;
    // a soft blur turns the bumpy bead edges into a liquid outline
    if ('filter' in fctx) {
      fctx.globalCompositeOperation = 'copy'; fctx.filter = `blur(${(1.4 * FS * grow).toFixed(2)}px)`;
      fctx.drawImage(field, 0, 0); fctx.filter = 'none'; fctx.globalCompositeOperation = 'source-over';
    }
    return true;
  }

  /* ---------- the background specks ---------- */
  let specks = [];
  const seed = () => {
    const n = clamp(Math.round(w * h / (narrow ? 230 : 170)), 500, 3200);
    specks = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0, r: .6 + Math.pow(Math.random(), 1.8) * 1.8 }));
  };
  seed();
  const onResize = () => { ({ w, h } = fit(canvas)); seed(); };
  window.addEventListener('resize', onResize);

  function drawDot(x, y, r, col, a) {
    ctx.globalAlpha = a; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, Math.max(.35, r), 0, TAU); ctx.fill();
  }

  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const dt = debug ? 1 / 60 : Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    clock += dt;
    if (debug) window.__introClock = clock;
    // skipping fast-forwards to the finished frame
    const c = skipAt >= 0 ? Math.max(clock, T.open) : clock;
    const d = Math.min(window.devicePixelRatio || 1, 3);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { cx, cy, ty } = layout();

    // background specks: drift, and thin out as the shapes form
    const thin = smooth(T.gather[0], T.develop[1], c);
    ctx.globalAlpha = smooth(0, .5, c) * (1 - thin * .78);
    ctx.fillStyle = 'rgb(26,29,31)'; ctx.beginPath();
    for (const p of specks) {
      const nx = Math.sin(p.y * .011 + c * .35) + Math.sin((p.x + p.y) * .006 - c * .2);
      const ny = Math.cos(p.x * .009 - c * .3) + Math.cos((p.x - p.y) * .007 + c * .25);
      p.vx += (nx * 13 - p.vx) * .04 + (Math.random() - .5) * 8; p.vy += (ny * 13 - p.vy) * .04 + (Math.random() - .5) * 8;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -5) p.x = w + 5; if (p.x > w + 5) p.x = -5; if (p.y < -5) p.y = h + 5; if (p.y > h + 5) p.y = -5;
      ctx.moveTo(p.x + p.r, p.y); ctx.arc(p.x, p.y, p.r, 0, TAU);
    }
    ctx.fill();

    // develop: the dots hand over to the ink layer
    const dev = G ? smooth(T.develop[0], T.develop[1], c) : 0;
    const dotsAlpha = G ? 1 - smooth(T.develop[0], T.develop[0] + .35, c) : 1 - smooth(T.develop[1] - .2, T.develop[1] + .3, c);
    // the crisp wordmark appears under the ink first, then the ink fades off it: no half-transparent grey moment
    const sharp = smooth(T.develop[1] - .15, T.develop[1] + .05, c);
    const inkOut = smooth(T.develop[1] + .05, T.develop[1] + .5, c);

    // the wordmark's dots
    if (dotsAlpha > 0) {
      for (const p of wDots) {
        const g = easeOut(smooth(p.t0, p.t0 + (p.p.g ? .45 : 1.0), c));
        const swirl = (1 - g) * g * 60;
        const x = mix(p.sx + Math.sin(c * .7 + p.ph) * 12, cx + p.p.x, g) + Math.cos(p.ph) * swirl;
        const y = mix(p.sy + Math.cos(c * .6 + p.ph) * 12, cy + p.p.y, g) + Math.sin(p.ph) * swirl;
        const green = p.p.g ? smooth(p.t0 + .3, p.t0 + .6, c) : 0;
        const col = green > 0 ? `rgb(${mix(26, 78, green) | 0},${mix(29, 171, green) | 0},${mix(31, 71, green) | 0})` : '#1a1d1f';
        drawDot(x, y, mix(p.r0, spL * .5, g), col, dotsAlpha);
      }
    }

    // the ink layer: the dots spread and run together into solid, flat ink (no tilt, no gloss)
    if (G && dev > 0) {
      paintField(dev);
      G.draw(field, fieldKey !== gcv.dataset.k, { relief: 0, L: [0, 0, 1], tilt: [0, 0] });
      gcv.dataset.k = fieldKey;
      gcv.style.opacity = String(smooth(T.develop[0], T.develop[0] + .3, c) * (1 - inkOut));
      gcv.style.transform = `translate(${cx - (LW / 2 + PAD)}px,${cy - (LH / 2 + PAD)}px)`;
    }
    // once set, the ink settles into the crisp wordmark: pin-sharp on any screen, up to 4K
    if (sharp > 0) {
      ctx.globalAlpha = sharp;
      ctx.drawImage(logo, cx - LW / 2, cy - LH / 2, LW, LH);
      ctx.globalAlpha = 1;
    }

    // the tagline's dots, then the crisp line
    const crisp = smooth(T.tagline[1] - .3, T.tagline[1] + .2, c);
    for (const p of tDots) {
      const g = easeOut(smooth(p.t0, p.t0 + .8, c));
      if (g <= 0 && c < T.tagline[0]) continue;
      const x = mix(p.sx, cx + p.p.x, g), y = mix(p.sy, ty + p.p.y, g);
      drawDot(x, y, mix(p.r0, spT * .5, g), '#50555a', (1 - crisp) * smooth(T.tagline[0], T.tagline[0] + .3, c));
    }
    if (crisp > 0) {
      ctx.globalAlpha = crisp; ctx.fillStyle = '#50555a';
      ctx.font = `500 ${fs}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(line, cx, ty);
    }
    ctx.globalAlpha = 1;

    // finished: compose one still frame (dots + ink) and hand it to the doors
    if (!handed && c >= T.open) {
      handed = true;
      const out = document.createElement('canvas'); out.width = canvas.width; out.height = canvas.height;
      const o = out.getContext('2d');
      o.fillStyle = '#fff'; o.fillRect(0, 0, out.width, out.height);
      o.drawImage(canvas, 0, 0);
      if (G && inkOut < 1) o.drawImage(gcv, (cx - LW / 2 - PAD) * d, (cy - LH / 2 - PAD) * d, (LW + PAD * 2) * d, (LH + PAD * 2) * d);
      onReady(out);
    }
  }

  raf = requestAnimationFrame(t => { last = t; frame(t); });
  return {
    skip() { if (skipAt < 0) skipAt = clock; },
    destroy() { dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); if (G) G.release(); gcv.remove(); },
  };
}
