'use client';

import { useEffect, useRef, useState } from 'react';

/*
 * Section 2 · The problem — four figures in one clean row.
 * Amounts first, then percentages; every amount in US dollars. Each number counts up once when the row comes into view.
 */

type Stat = { to: number; dec: number; pre: string; suf: string; label: string; src: string };
const STATS: Stat[] = [
  { to: 467, dec: 0, pre: '$', suf: 'bn', label: 'in fake goods traded worldwide every year', src: 'OECD & EUIPO, Mapping Global Trade in Fakes 2025 (2021 data)' },
  { to: 8.3, dec: 1, pre: '$', suf: 'bn', label: 'in tax India lost to illicit trade in one year', src: 'FICCI CASCADE, Illicit Markets 2022: ₹58,521 crore in 2019–20, at that year’s average of about ₹70.9 per US$' },
  { to: 89, dec: 0, pre: '', suf: '%', label: 'of urban Indians have bought a fake at least once', src: 'ASPA & CRISIL, State of Counterfeiting in India 2025' },
  { to: 10, dec: 0, pre: '', suf: '%', label: 'of medical products in low- and middle-income countries are substandard or falsified', src: 'WHO, 2017' },
];

function Count({ s, run }: { s: Stat; run: boolean }) {
  const [v, setV] = useState(s.to);
  useEffect(() => {
    if (!run || matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(s.to); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - p, 3);
      setV(s.to * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, s.to]);
  return <>{s.pre}{v.toFixed(s.dec)}{s.suf}</>;
}

export default function Problem() {
  const row = useRef<HTMLUListElement>(null);
  const [run, setRun] = useState(false);
  useEffect(() => {
    const el = row.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setRun(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="problem" className="problem2" aria-labelledby="problem-title">
      <div className="p2-head" data-rv>
        <div>
          <span className="kicker">The problem</span>
          <h2 id="problem-title">Counterfeiting costs <span className="hl">everyone.</span></h2>
        </div>
        <div className="p2-side">
          <p>A good copy looks exactly like the real thing. Brands lose the sale, governments lose the tax, and buyers take the risk.</p>
          <a className="p2-cta" href="#solutions">See how Checko stops it <span aria-hidden="true">→</span></a>
        </div>
      </div>
      <ul ref={row} className="p2-row">
        {STATS.map((s, i) => (
          <li key={s.label} className={s.suf === '%' ? 'pct' : 'amt'} style={{ '--i': i } as React.CSSProperties}>
            <strong aria-label={`${s.pre}${s.to}${s.suf}`}><Count s={s} run={run} /></strong>
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
      <p className="p2-src">Sources: {STATS.map(s => s.src).join(' · ')}.</p>
    </section>
  );
}
