'use client';

import { useEffect, useRef, useState } from 'react';

/*
 * Section 2 · The problem — "Running total, with dives" (chosen concept), with the copy cut back:
 * each row is a number and a few words; the context, chart and source live inside the dive.
 * The counter is the yearly figure spread per second (an estimate, labelled as such), counted since the page opened.
 */

const YEAR = 365 * 24 * 3600;
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

type Feed = 'global' | 'danger' | 'tax';
const FEEDS: Record<Feed, { rate: number; fmt: Intl.NumberFormat; label: string; per: string }> = {
  global: { rate: 467e9 / YEAR, fmt: usd, label: 'Fakes traded worldwide since you opened this page', per: '≈ $14,800 every second' },
  danger: { rate: 75e9 / YEAR, fmt: usd, label: 'Dangerous fakes traded since you opened this page', per: '≈ $2,400 every second' },
  tax: { rate: 58521e7 / YEAR, fmt: inr, label: 'Tax India lost since you opened this page', per: '≈ ₹18,600 every second' },
};

type Viz = 'share' | 'danger' | 'people' | 'online' | 'jobs';
const ROWS: { big: string; title: string; line: string; viz: Viz; feed: Feed; src: string }[] = [
  { big: '$467bn', title: 'in fake goods traded every year', line: 'Up to 2.3% of all world imports. Every copy is a sale the real brand never makes.', viz: 'share', feed: 'global', src: 'OECD & EUIPO, Mapping Global Trade in Fakes 2025 (2021 data)' },
  { big: '$75bn', title: 'of fakes can hurt people', line: 'Medicines, cosmetics, toys, car parts: 16% of all fakes put health or safety at risk.', viz: 'danger', feed: 'danger', src: 'OECD & EUIPO, Dangerous Fakes 2022 (2019 data)' },
  { big: '89%', title: 'of urban Indians have bought a fake', line: 'A good copy looks exactly like the real thing.', viz: 'people', feed: 'global', src: 'ASPA & CRISIL, State of Counterfeiting in India 2025 (1,639 consumers, 9 cities)' },
  { big: '53%', title: 'of fakes in India are bought online', line: 'The buyer sees a photo, never the product, before paying.', viz: 'online', feed: 'global', src: 'ASPA & CRISIL, State of Counterfeiting in India 2025' },
  { big: '₹58,521 cr', title: 'in tax lost in a single year', line: 'Just five industries, one year. And the jobs go with it.', viz: 'jobs', feed: 'tax', src: 'FICCI CASCADE, Illicit Markets, 2022 (2019–20 data)' },
];

function Chart({ viz, on }: { viz: Viz; on: boolean }) {
  if (viz === 'share' || viz === 'danger') {
    const pct = viz === 'share' ? 2.3 : 16;
    return (
      <div className="pv-share">
        <div className="pv-bar"><i className={viz === 'danger' ? 'red' : ''} style={{ width: on ? `${pct}%` : 0 }} /></div>
        <div className="pv-legend">
          <span><b className={viz === 'danger' ? 'red' : 'char'} />{viz === 'share' ? 'Fakes, 2.3%' : 'Dangerous, 16%'}</span>
          <span><b />{viz === 'share' ? 'All other world trade' : 'Other fakes'}</span>
        </div>
      </div>
    );
  }
  if (viz === 'people') {
    return (
      <div className="pv-people">
        <div className="pv-ppl" role="img" aria-label="89 out of 100 people highlighted">
          {Array.from({ length: 100 }, (_, k) => <i key={k} className={on && k < 89 ? 'on' : ''} style={{ transitionDelay: `${k * 14}ms` }} />)}
        </div>
        <span className="pv-cap">89 in every 100</span>
      </div>
    );
  }
  if (viz === 'online') {
    return (
      <div className="pv-hbars">
        {[['Online', 53], ['Offline', 47]].map(([l, v], k) => (
          <div key={l} className={`pv-hbar${k ? ' dim' : ''}`}><span>{l}</span><span className="t"><i style={{ width: on ? `${v}%` : 0, transitionDelay: `${k * 150}ms` }} /></span><b>{v}%</b></div>
        ))}
      </div>
    );
  }
  return (
    <div className="pv-pair">
      <div><strong>≈16 lakh</strong><span>legitimate jobs lost</span></div>
    </div>
  );
}

// "$467bn", "89%", "₹58,521 cr": counts from 0 the first time the section comes into view
function CountUp({ value, run }: { value: string; run: boolean }) {
  const m = value.match(/^([^\d]*)([\d,]+)(.*)$/);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!m || !run || !ref.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const [, pre, num, post] = m, to = Number(num.replace(/,/g, '')), fmt = new Intl.NumberFormat(pre.includes('₹') ? 'en-IN' : 'en-US');
    const el = ref.current, start = performance.now(), dur = 1400;
    let raf = 0;
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - u, 3);
      el.textContent = pre + fmt.format(Math.round(to * e)) + post;
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref} className="acc-big">{value}</span>;
}

export default function Problem() {
  const [open, setOpen] = useState(0);
  const [seen, setSeen] = useState(false);
  const [all, setAll] = useState(false);
  const [feed, setFeed] = useState<Feed>('global');
  const [swapping, setSwapping] = useState(false);
  const num = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLElement>(null);
  const root = useRef<HTMLElement>(null);
  const feedRef = useRef<Feed>('global');

  // the running total: written straight to the DOM, and only while the section is on screen
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, visible = false, shown = '';
    const tick = () => {
      const t = reduced ? 60 : performance.now() / 1000;
      const F = FEEDS[feedRef.current], s = F.fmt.format(Math.floor(F.rate * t));
      if (num.current && s !== shown) { shown = s; num.current.textContent = s; }
      if (bar.current) bar.current.style.width = reduced ? '100%' : `${(t % 1) * 100}%`;
      if (visible && !reduced) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) setSeen(true); cancelAnimationFrame(raf); if (visible) raf = requestAnimationFrame(tick); else tick(); });
    if (root.current) io.observe(root.current);
    tick();
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  function toggle(k: number) {
    const next = open === k ? -1 : k;
    setOpen(next);
    const f = next < 0 ? 'global' : ROWS[next].feed;
    if (f === feedRef.current) return;
    // fade the counter out, retune it, fade back in
    setSwapping(true);
    window.setTimeout(() => { feedRef.current = f; setFeed(f); setSwapping(false); }, 240);
  }

  return (
    <section ref={root} id="problem" className="problem" aria-labelledby="problem-title">
      <div className="problem-inner" data-rv>
        <div className="problem-left">
          <span className="problem-pill">The problem</span>
          <h2 id="problem-title">Counterfeiting costs <span className="hl">everyone.</span></h2>
          <p className="problem-sub">Every one of these starts with a fake nobody could tell apart.</p>
          <div className={`ticker${swapping ? ' swap' : ''}`} aria-live="off">
            <span className="ticker-lab">{FEEDS[feed].label}</span>
            <span ref={num} className="ticker-num">$0</span>
            <span className="ticker-rate">{FEEDS[feed].per}<i><b ref={bar} /></i></span>
          </div>
          <a className="problem-cta" href="#solutions">See how Checko stops it <span aria-hidden="true">→</span></a>
        </div>

        <div className="problem-right">
          <span className="problem-kicker">Five ways it hurts</span>
          <ul className={`acc${all ? ' all' : ''}`} data-rv-stagger>
            {ROWS.map((r, k) => {
              const on = open === k;
              return (
                <li key={r.big} className={`acc-row${on ? ' open' : ''}`}>
                  <button type="button" aria-expanded={on} aria-controls={`dive-${k}`} onClick={() => toggle(k)}>
                    <CountUp value={r.big} run={seen} />
                    <span className="acc-title">{r.title}</span>
                    <span className="acc-pm" aria-hidden="true" />
                  </button>
                  <div className="acc-dive" id={`dive-${k}`} role="region" aria-label={r.title}>
                    <div>
                      <div className="acc-in">
                        <p>{r.line}</p>
                        <div className="acc-card"><Chart viz={r.viz} on={on && seen} /></div>
                        <cite>{r.src}</cite>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {!all && <button type="button" className="acc-more" onClick={() => setAll(true)}>Show all five</button>}
        </div>
      </div>
    </section>
  );
}
