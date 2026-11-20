/*
 * Checko intro (v2.1, WebGL): real-looking ink.
 *
 * 1. Drops of ink land on white paper ("tup, tup, tup…"). Each one blooms like ink on wet paper:
 *    a dense black core, then a grey, feathered halo with fine radial fibres and a ragged edge.
 * 2. The blooms swell, run into each other and overlap; where two meet, a pale seam forms (as ink does).
 * 3. The ink pulls together ("zoom") and organises into a meaningful form: a QR-like code with three
 *    finder squares and a random module pattern that is different on every visit, like every Checko label.
 * 4. The code dissolves and the ink re-forms as the checko wordmark (tick in green), which settles crisp.
 * 5. "The fingerprint of things." is inked in underneath, and the finished frame goes to the doors.
 *
 * Rendered by one fragment shader over the whole screen; the crisp logo and the tagline are drawn on the
 * 2D canvas on top. If WebGL is unavailable this returns null and the loader uses the 2D engine instead.
 */

export const T = {
  rain: [0.2, 1.7],      // drops land and bloom
  gather: [1.9, 2.9],    // blooms swell, overlap and pull together
  code: [2.35, 3.3],     // the ink organises into the code
  logo: [3.85, 4.75],    // the code dissolves into the wordmark
  crisp: [4.6, 4.95],    // the wordmark settles crisp, the ink lifts
  tagline: [4.9, 5.8],
  open: 6.3,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const MAXD = 32;

const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FS = `precision highp float;
uniform vec2 uRes; uniform float uDpr; uniform float uT;
uniform vec4 uDrop[${MAXD}]; uniform vec2 uLife[${MAXD}]; uniform int uN;
uniform sampler2D uQR; uniform vec4 uQRRect;
uniform sampler2D uLogo; uniform vec4 uLogoRect;
uniform float kBlob, kCode, kLogo, kLift;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}
// ink that has been developed into a shape (code or logo): a soft, slightly bled mask with fibres at the edge
float developed(sampler2D tex, vec4 rect, vec2 p, float k, float seed, out float green){
  green=0.;
  vec2 uv=(p-rect.xy)/rect.zw;
  if(uv.x<-.15||uv.y<-.15||uv.x>1.15||uv.y>1.15||k<=0.)return 0.;
  vec2 w=vec2(fbm(p*.012+seed),fbm(p*.012+seed+7.))-.5;
  uv+=w*.012*(1.-k*.6);
  vec2 tuv=uv;
  vec4 c=texture2D(tex,tuv);
  vec4 h=texture2D(tex,tuv,3.5);
  green=c.g>c.r+.15?1.:0.;
  float m=c.a;
  // the shape develops from a few points outward, along noise, like ink finding its way
  float grow=k*1.35-fbm(p*.006+seed*3.)*.55;
  float thr=.5+(noise(p*.45+seed)-.5)*.35;
  float body=smoothstep(thr-.07,thr+.07,m)*smoothstep(0.,.18,grow);
  vec2 dir=normalize(p-(rect.xy+rect.zw*.5)+.001);
  float fib=noise(dir*55.+p*.02);
  float halo=h.a*(.25+.55*fib*fib)*smoothstep(0.,.3,grow)*(1.-k*.35);
  return max(body,halo*.55);
}
void main(){
  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uDpr;
  // ---- the blooms ----
  float acc=0.,v1=0.,v2=0.;
  for(int i=0;i<${MAXD};i++){
    if(i>=uN)break;
    vec4 D=uDrop[i]; vec2 L=uLife[i];
    if(uT<L.x)continue;
    float R=D.z;
    vec2 q=p-D.xy; float r=length(q); float d=r/max(R,1.);
    if(d>1.45)continue;
    vec2 dir=q/max(r,.001);
    float fi=float(i);
    float wob=fbm(dir*2.6+fi*7.3);
    float edge=.84+(wob-.5)*.5;
    // fine radial streaks, like pigment pulled outward by the water
    float fib=noise(dir*190.+fi*13.+vec2(d*1.4,0.))*.6+noise(dir*60.+fi*5.+vec2(d*.8,0.))*.4;
    float speck=noise(p*.12+fi*3.);
    // dark core with a speckled, bleeding edge
    float core=1.-smoothstep(.3*edge,.48*edge,d+(speck-.5)*.07);
    // a pale ring right around the core, then the grey feathered bloom fading to a ragged edge
    float bloom=(1.-smoothstep(.62*edge,edge,d))*smoothstep(.44*edge,.6*edge,d);
    float ring=smoothstep(.4*edge,.5*edge,d)*(1.-smoothstep(.5*edge,.62*edge,d));
    float v=max(core*(.92+.08*D.w),bloom*(.22+.55*fib)+ring*.08);
    v*=L.y;
    if(v>v1){v2=v1;v1=v;}else if(v>v2){v2=v;}
    acc=1.-(1.-acc)*(1.-v*.92);
  }
  // pale seams where two blooms meet
  float seam=(1.-smoothstep(0.,.1,abs(v1-v2)))*smoothstep(.12,.35,v2)*(1.-smoothstep(.6,.85,v2));
  float blob=clamp(acc-seam*.55,0.,1.)*kBlob;
  // ---- the code, then the wordmark ----
  float g1,g2;
  float dz=fbm(p*.012+9.)*.55;
  float code=developed(uQR,uQRRect,p,kCode,1.7,g1)*(1.-smoothstep(dz,dz+.22,kLogo*1.15));
  float logo=developed(uLogo,uLogoRect,p,kLogo,4.1,g2);
  float ink=1.-(1.-blob)*(1.-code)*(1.-logo);
  ink*=(1.-kLift);
  vec3 dark=vec3(.055,.062,.068);
  vec3 col=mix(dark,vec3(.306,.671,.278),g2*smoothstep(.2,.6,logo));
  vec3 paper=vec3(1.);
  gl_FragColor=vec4(mix(paper,col,ink),1.);
}`;

function makeQR(seed) {
  // a 25 × 25 code: three finder squares, timing lines and a random field of modules
  let s = seed >>> 0 || 7; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const N = 25, m = Array.from({ length: N }, () => new Array(N).fill(0)), fixed = Array.from({ length: N }, () => new Array(N).fill(false));
  const finder = (x, y) => { for (let j = -1; j < 8; j++) for (let i = -1; i < 8; i++) {
    const X = x + i, Y = y + j; if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
    fixed[Y][X] = true;
    const on = i >= 0 && j >= 0 && i < 7 && j < 7 && (i === 0 || j === 0 || i === 6 || j === 6 || (i > 1 && i < 5 && j > 1 && j < 5));
    m[Y][X] = on ? 1 : 0; } };
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  for (let i = 8; i < N - 8; i++) { m[6][i] = m[i][6] = i % 2 ? 0 : 1; fixed[6][i] = fixed[i][6] = true; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!fixed[y][x]) m[y][x] = rnd() < .47 ? 1 : 0;
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), cell = S / (N + 2);
  x.fillStyle = '#000';
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (m[j][i]) {
    const r = cell * .18; const X = (i + 1) * cell, Y = (j + 1) * cell;
    x.beginPath(); x.roundRect ? x.roundRect(X - .5, Y - .5, cell + 1, cell + 1, r) : x.rect(X, Y, cell, cell); x.fill();
  }
  return c;
}

/**
 * @param {{canvas: HTMLCanvasElement, logo: HTMLImageElement, font: string,
 *          onReady: (frame: HTMLCanvasElement) => void, sound?: any}} o
 * @returns {{destroy: () => void, skip: () => void} | null}
 */
export function startInkIntroGL({ canvas, logo, font, onReady, sound }) {
  const host = canvas.parentElement;
  const glc = document.createElement('canvas');
  glc.className = 'intro-gl'; glc.setAttribute('aria-hidden', 'true');
  const gl = glc.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  host.insertBefore(glc, canvas);
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  const tex = (unit, src) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  // the code: a new random pattern on every visit
  tex(0, makeQR((Math.random() * 4294967296) >>> 0));
  // the wordmark, on a power-of-two canvas with a margin so the bleed has room
  const lc = document.createElement('canvas'); lc.width = 1024; lc.height = 512;
  const lx = lc.getContext('2d'), lw = 880, lh = lw * logo.naturalHeight / logo.naturalWidth;
  lx.drawImage(logo, (1024 - lw) / 2, (512 - lh) / 2, lw, lh);
  tex(1, lc);
  gl.uniform1i(U('uQR'), 0); gl.uniform1i(U('uLogo'), 1);

  const ctx = canvas.getContext('2d');
  const debug = /intro=debug/.test(location.search);
  let w = 0, h = 0, d = 1, raf = 0, last = performance.now(), clock = 0, dead = false, handed = false, skipAt = -1;
  const fit = () => {
    const r = canvas.getBoundingClientRect(); w = r.width; h = r.height;
    const D = Math.min(window.devicePixelRatio || 1, 3); d = D;
    canvas.width = Math.round(w * D); canvas.height = Math.round(h * D);
    // the ink layer renders at up to 1.5× (its soft forms gain nothing from more)
    const G = Math.min(D, 1.5);
    glc.width = Math.round(w * G); glc.height = Math.round(h * G);
    gl.viewport(0, 0, glc.width, glc.height);
    gl.uniform2f(U('uRes'), glc.width, glc.height); gl.uniform1f(U('uDpr'), G);
  };
  fit();
  const narrow = w < 640;

  // layout: the code sits where the wordmark will be
  const LW = Math.round(narrow ? Math.min(w * .8, 360) : Math.min(600, w * .5)), LH = Math.round(LW * logo.naturalHeight / logo.naturalWidth);
  const fs = narrow ? Math.min(26, w * .066) : Math.min(38, LW * .066), gap = narrow ? 26 : 34, TH = Math.ceil(fs * 1.5);
  const layout = () => { const cy = h / 2 - (LH + gap + TH) / 2 + LH / 2 - (narrow ? 10 : 6); return { cx: w / 2, cy, ty: cy + LH / 2 + gap + TH / 2 }; };
  const S = Math.min(narrow ? w * .62 : w * .26, h * .42);

  // the drops: around the code's square, landing over the rain window
  const ND = narrow ? 20 : 28;
  const drops = Array.from({ length: ND }, (_, i) => {
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * S * .85;
    return {
      ox: Math.cos(a) * rr * 1.25, oy: Math.sin(a) * rr * .95,
      t0: T.rain[0] + (i / ND) * (T.rain[1] - T.rain[0]) + Math.random() * .1,
      rmax: S * (.2 + Math.random() * .2), wet: Math.random(), played: false,
    };
  });
  const dropArr = new Float32Array(MAXD * 4), lifeArr = new Float32Array(MAXD * 2);
  gl.uniform1i(U('uN'), ND);
  const uDrop = U('uDrop'), uLife = U('uLife'), uT = U('uT'), uQRRect = U('uQRRect'), uLogoRect = U('uLogoRect');
  const kB = U('kBlob'), kC = U('kCode'), kL = U('kLogo'), kLift = U('kLift');
  let zoomed = false, coded = false, logoed = false;

  const tc = document.createElement('canvas'), tx = tc.getContext('2d');
  const line = 'The fingerprint of things.';
  const onResize = () => fit();
  window.addEventListener('resize', onResize);

  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const dt = debug ? 1 / 60 : Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    clock += dt;
    if (debug) window.__introClock = clock;
    const c = skipAt >= 0 ? Math.max(clock, T.open) : clock;
    const { cx, cy, ty } = layout();

    // drops: bloom, then swell and pull in towards the code
    const gth = smooth(T.gather[0], T.gather[1], c);
    for (let i = 0; i < ND; i++) {
      const D = drops[i];
      const age = Math.max(0, c - D.t0);
      const R = D.rmax * (1 - Math.exp(-age * 2.4)) * (1 + gth * .45);
      dropArr[i * 4] = cx + D.ox * (1 - gth * .45); dropArr[i * 4 + 1] = cy + D.oy * (1 - gth * .45);
      dropArr[i * 4 + 2] = Math.max(1, R); dropArr[i * 4 + 3] = D.wet;
      lifeArr[i * 2] = D.t0; lifeArr[i * 2 + 1] = smooth(D.t0, D.t0 + .12, c);
      if (!D.played && c >= D.t0) { D.played = true; if (sound && skipAt < 0) sound.tap(.75 + Math.random() * .5, .55 + D.rmax / S); }
    }
    if (!zoomed && c >= T.gather[0]) { zoomed = true; if (sound && skipAt < 0) sound.zoom(1); }
    if (!coded && c >= T.code[1] - .1) { coded = true; if (sound && skipAt < 0) sound.settle(); }
    if (!logoed && c >= T.logo[1] - .1) { logoed = true; if (sound && skipAt < 0) sound.settle(); }

    const kCode = smooth(T.code[0], T.code[1], c), kLogo = smooth(T.logo[0], T.logo[1], c);
    gl.uniform4fv(uDrop, dropArr); gl.uniform2fv(uLife, lifeArr); gl.uniform1f(uT, c);
    gl.uniform4f(uQRRect, cx - S / 2, cy - S / 2, S, S);
    // the logo texture has margins: map its 1024 × 512 canvas so the wordmark lands on LW × LH
    const sx = LW / 880, LWt = 1024 * sx, LHt = 512 * sx;
    gl.uniform4f(uLogoRect, cx - LWt / 2, cy - LHt / 2, LWt, LHt);
    gl.uniform1f(kB, 1 - smooth(T.code[0] + .2, T.code[1] + .3, c) * .97);
    gl.uniform1f(kC, kCode); gl.uniform1f(kL, kLogo);
    const crisp = smooth(T.crisp[0], T.crisp[1], c);
    gl.uniform1f(kLift, crisp);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // on top: the crisp wordmark and the tagline
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);
    if (crisp > 0) { ctx.globalAlpha = crisp; ctx.drawImage(logo, cx - LW / 2, cy - LH / 2, LW, LH); ctx.globalAlpha = 1; }
    const tp = smooth(T.tagline[0], T.tagline[1], c);
    if (tp > 0) {
      ctx.font = `500 ${fs}px ${font}`;
      const tw = Math.ceil(ctx.measureText(line).width) + 20;
      tc.width = Math.round(tw * d); tc.height = Math.round(TH * d);
      tx.setTransform(d, 0, 0, d, 0, 0);
      tx.font = `500 ${fs}px ${font}`; tx.textAlign = 'center'; tx.textBaseline = 'middle'; tx.fillStyle = '#50555a';
      tx.fillText(line, tw / 2, TH / 2);
      tx.globalCompositeOperation = 'destination-in';
      const front = -30 + tp * (tw + 60), g = tx.createLinearGradient(front - 40, 0, front + 6, 0);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      tx.fillStyle = g; tx.fillRect(0, 0, tw, TH); tx.globalCompositeOperation = 'source-over';
      ctx.drawImage(tc, cx - tw / 2, ty - TH / 2, tw, TH);
    }

    if (!handed && c >= T.open) {
      handed = true;
      const out = document.createElement('canvas'); out.width = canvas.width; out.height = canvas.height;
      const o = out.getContext('2d');
      o.drawImage(glc, 0, 0, out.width, out.height);
      o.drawImage(canvas, 0, 0);
      onReady(out);
    }
  }
  raf = requestAnimationFrame(t => { last = t; frame(t); });
  return {
    skip() { if (skipAt < 0) skipAt = clock; },
    destroy() {
      dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize);
      const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); glc.remove();
    },
  };
}
