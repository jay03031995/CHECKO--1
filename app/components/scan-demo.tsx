'use client';

import Image from 'next/image';
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { products, type Product } from '../content';
import { useIntroDone } from '../intro/use-intro-done';

// positioning → hold steady → scanning → verified → next product (ms per phase)
const PHASES = [800, 550, 1600, 1100, 650];

function Check({ animated = false }: { animated?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <m.path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        initial={animated ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.15 }} />
    </svg>
  );
}

// the phone camera's view of the product's Checko label (rendered at high resolution)
function LabelPhoto({ product }: { product: Product }) {
  return <img className="label-photo cam-shot" src={`/assets/${product.id.replace('v2-', 'v2-cam-')}.webp`} alt="" decoding="async" />;
}

export default function ScanDemo() {
  const reduced = !!useReducedMotion();
  const introDone = useIntroDone();
  const root = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const running = introDone && inView && !reduced && !paused;
  // the controller: jump to a product (starts its scan from the beginning)
  const goTo = (i: number) => { const n = products.length; setIndex(((i % n) + n) % n); setPhase(0); };

  // the phone in 3D: follows the cursor on desktop, turns by itself on touch screens
  const [autoTurn, setAutoTurn] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el || reduced) return;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fine) { setAutoTurn(true); return; }
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, last = performance.now(), idle = true;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width * 0.5)) / (r.width * 0.6), ny = (e.clientY - (r.top + r.height * 0.45)) / (r.height * 0.6);
      tx = Math.max(-1, Math.min(1, nx)); ty = Math.max(-1, Math.min(1, ny)); idle = false;
    };
    const onLeave = () => { idle = true; };
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      // with no cursor nearby the phone keeps a slow, gentle sway so it never looks frozen
      const gx = idle ? Math.sin(now / 1600) * 0.35 : tx, gy = idle ? Math.cos(now / 2100) * 0.15 : ty;
      const k = 1 - Math.exp(-dt * 6);
      x += (gx - x) * k; y += (gy - y) * k;
      el.style.setProperty('--ry', `${(x * 24).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
      el.style.setProperty('--gp', `${(50 - x * 35).toFixed(1)}%`);
      el.style.setProperty('--sx', x.toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); document.documentElement.removeEventListener('pointerleave', onLeave); };
  }, [reduced]);

  // only animate while the demo is on screen
  useEffect(() => {
    const el = root.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => {
      if (phase >= PHASES.length - 1) { setIndex(i => (i + 1) % products.length); setPhase(0); }
      else setPhase(phase + 1);
    }, PHASES[phase]);
    return () => clearTimeout(t);
  }, [running, phase, index]);

  const product = products[index];
  // the product that just left the stage slides out to the left before it rejoins the queue
  const [exiting, setExiting] = useState<number | null>(null);
  const lastIndex = useRef(index);
  useEffect(() => {
    if (lastIndex.current === index) return;
    const n = products.length, forward = index === (lastIndex.current + 1) % n, gone = (lastIndex.current + n - 1) % n;
    lastIndex.current = index;
    if (!forward) { setExiting(null); return; }
    setExiting(gone);
    const t = window.setTimeout(() => setExiting(null), 950);
    return () => clearTimeout(t);
  }, [index]);
  // on the very render where the index moves, the leaving product is already marked (no one-frame jump)
  const stepped = lastIndex.current !== index && index === (lastIndex.current + 1) % products.length;
  const exitNow = stepped ? (lastIndex.current + products.length - 1) % products.length : lastIndex.current !== index ? null : exiting;
  const verified = reduced || phase >= 3;
  const scanning = phase === 2 && !reduced;

  return (
    <LazyMotion features={domAnimation} strict>
      <div ref={root} className={`visual${autoTurn ? ' auto-turn' : ''}`} role="img"
        aria-label={`Demonstration: a phone scans the Checko label on ${product.name} and shows that the product is genuine.`}>
        <div className="visual-glow" aria-hidden="true" />
        <div className="visual-stage" aria-hidden="true">
          {/* one track of products: each keeps its element and glides between slots (left · centre · right · waiting),
              so the slide is one continuous move with no swaps or pops */}
          {products.map((p, i) => {
            const n = products.length, o = ((i - index + n + 1) % n) - 1; // -1 left, 0 centre, 1 right, 2+ waiting off-stage
            const slot = i === exitNow ? 'exit' : o === 0 ? 'centre' : o === -1 ? 'left' : o === 1 ? 'right' : 'wait';
            return (
              <div key={p.id} className={`pslot pslot-${slot} product-${p.id}`} data-tall={p.aspect < 0.8 ? '' : undefined}>
                <Image src={`/assets/${p.id}.webp`} alt="" fill sizes="(max-width: 860px) 45vw, 22vw" quality={90} priority={i === 0} />
              </div>
            );
          })}
          {/* chip and caption sit in front of the phone so they are always readable */}
          <AnimatePresence>
            {verified && (
              <m.div className="genuine-chip" key={`chip-${product.id}`} initial={reduced ? false : { opacity: 0, scale: 0.7, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}>
                <Check /> Genuine
              </m.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            <m.div className="product-caption" key={`cap-${product.id}`} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
              <strong>{product.name}</strong><span>{product.category} · Protected by Checko</span>
            </m.div>
          </AnimatePresence>
          <div className="phone">
            <div className="phone-side" />
            <i className="phone-glare" />
            <div className="screen">
              <div className="status"><span>9:41</span><span className="island" /><span className="bars"><i /><i /><i /></span></div>
              <div className="app-brand">
                <img className="app-logo" src="/assets/checko.svg" alt="" width={479} height={139} />
                <span>PRODUCT AUTHENTICATION</span>
              </div>
              <div className="camera">
                <m.div className="camera-image" key={product.id} initial={reduced ? false : { filter: 'blur(5px)', scale: 1.12 }}
                  animate={{ filter: phase >= 1 || reduced ? 'blur(0px)' : 'blur(4px)', scale: phase >= 1 || reduced ? 1 : 1.08 }}
                  transition={{ duration: 1.2 }}>
                  <LabelPhoto product={product} />
                </m.div>
                <div className={`focus-frame${verified ? ' success' : ''}`}><i /><i /><i /><i />{scanning && <div className="scan-line" />}</div>
                {verified && <span className="camera-badge">3D PATTERN MATCHED</span>}
              </div>
              <AnimatePresence mode="wait">
                {verified ? (
                  <m.div className="result" key="verified" initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div className="success-icon"><Check animated={!reduced} /></div>
                    <strong>Verified</strong>
                    <p>This is a<br /><b>genuine product</b></p>
                    <span className="secure-note">Checked against the registered label</span>
                  </m.div>
                ) : (
                  <m.div className="scan-copy" key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {scanning && <span className="scan-spinner" />}
                    <strong>{phase === 0 ? 'Positioning the phone…' : phase === 1 ? 'Hold steady' : 'Scanning label…'}</strong>
                    <p>Any phone. Any light.</p>
                    {scanning && <div className="progress"><i className="scan-progress" /></div>}
                  </m.div>
                )}
              </AnimatePresence>
              <span className="home-indicator" />
            </div>
          </div>
        </div>
      </div>
      <div className="hero-ctrl" role="group" aria-label="Product slider">
        <button type="button" className="hc-arrow" aria-label="Previous product" onClick={() => goTo(index - 1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="hc-dots">
          {products.map((p, i) => (
            <button key={p.id} type="button" className={i === index ? 'on' : ''} aria-label={`Show ${p.name}`} aria-current={i === index} onClick={() => goTo(i)}>
              {i === index && running && <i key={index} className="hc-fill" />}
            </button>
          ))}
        </div>
        <button type="button" className="hc-arrow" aria-label={paused ? 'Play the slider' : 'Pause the slider'} aria-pressed={paused} onClick={() => setPaused(v => !v)}>
          {paused ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12" /></svg>}
        </button>
        <button type="button" className="hc-arrow" aria-label="Next product" onClick={() => goTo(index + 1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </LazyMotion>
  );
}
