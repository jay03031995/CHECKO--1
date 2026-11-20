'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { industries } from '../content';

/*
 * Section · Industries — a conveyor belt driven by scroll.
 * The section pins to the screen; as you scroll, the belt carries the nine industries Checko serves.
 * The product in the centre comes forward, larger, and the panel underneath says what Checko does there.
 * Under 620px tall it stays a plain, swipeable row.
 */

const N = industries.length;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);


export default function Industries() {
  const [cur, setCur] = useState(0);
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const belt = useRef<HTMLDivElement>(null);
  const curRef = useRef(0);

  useEffect(() => {
    const el = root.current, tr = track.current, bl = belt.current;
    if (!el || !tr || !bl) return;
    const pinMQ = matchMedia('(min-height: 620px)');
    let raf = 0, visible = false;

    const frame = () => {
      if (!pinMQ.matches) { tr.style.transform = ''; if (visible) raf = requestAnimationFrame(frame); return; }
      const r = el.getBoundingClientRect(), range = Math.max(1, el.offsetHeight - window.innerHeight);
      const prog = clamp(-r.top / range, 0, 1) * (N - 1);
      // travel between stops, and hold at each stop so the product can be seen
      const i = Math.floor(prog), f = prog - i;
      const pos = Math.min(N - 1, i + ease(clamp((f - 0.3) / 0.55, 0, 1)));
      const idx = Math.round(pos);
      // one slot = the width of a product cell (set in CSS as --slot)
      tr.style.transform = `translate3d(calc(${-pos} * var(--slot)), 0, 0)`;
      bl.style.backgroundPositionX = `calc(${-pos} * var(--slot))`;
      if (idx !== curRef.current) { curRef.current = idx; setCur(idx); }
      if (visible) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(frame);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  // clicking a product (or a step dot) scrolls the belt to it
  const go = (i: number) => {
    const el = root.current;
    if (!el) return;
    if (!matchMedia('(min-height: 620px)').matches) {
      track.current?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      setCur(i); return;
    }
    const top = el.getBoundingClientRect().top + window.scrollY, range = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + range * ((i + 0.05) / (N - 1)) - (i ? 0 : 1), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const ind = industries[cur];
  return (
    <section ref={root} id="industries" className="industries-belt" aria-labelledby="industries-title" style={{ '--n': N } as React.CSSProperties}>
      <div className="ib-pin">
        <div className="ib-head" data-rv>
          <div>
            <span className="kicker">Industries we serve</span>
            <h2 id="industries-title">Protecting the products your customers <span className="hl">rely on.</span></h2>
            <p className="ib-sub">Checko labels work across all of these industries, on almost any pack.</p>
          </div>
          <span className="ib-count" aria-hidden="true"><b>{String(cur + 1).padStart(2, '0')}</b> / {String(N).padStart(2, '0')}</span>
        </div>

        <div className="ib-stage">
          <div className="ib-viewport">
            <div ref={track} className="ib-track" role="list">
              {industries.map((it, i) => (
                <button key={it.img} type="button" role="listitem" className={`ib-item${i === cur ? ' on' : ''}`}
                  onClick={() => go(i)} aria-label={`${it.name}: ${it.risk}`} aria-current={i === cur}>
                  <Image src={`/assets/industries/${it.img}.webp`} alt="" width={1024} height={1024} sizes="(max-width: 700px) 46vw, 300px" quality={90} />
                </button>
              ))}
            </div>
          </div>
          <div ref={belt} className="ib-belt" aria-hidden="true" />
        </div>

        <div className="ib-info" aria-live="polite">
          <div key={cur} className="ib-info-in">
            <h3>{ind.name}</h3>
            <p className="ib-risk">{ind.risk}</p>
            <p className="ib-fit">{ind.fit}</p>
            <span className="ib-who">Checko-compatible · protects {ind.who.toLowerCase()}</span>
          </div>
        </div>

        <div className="ib-steps" aria-label="Choose an industry">
          {industries.map((it, i) => (
            <button key={it.img} type="button" className={i === cur ? 'on' : ''} aria-label={it.name} aria-current={i === cur} onClick={() => go(i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
