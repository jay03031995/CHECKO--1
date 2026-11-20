'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { startInkIntro } from './ink-engine';
import { startInkIntroGL } from './ink-engine-gl';
import { createInkSound } from './ink-sound';

export const INTRO_EVENT = 'checko:intro-done';

/**
 * Full-screen intro, played once per browser session (the inline script in layout.tsx decides before first paint,
 * so the hero never flashes underneath). Ink drops fall and spread, rush together and develop into the checko wordmark,
 * the tagline is inked in underneath, and the finished screen opens like a pair of doors onto the site.
 * Sound (drops landing, a whoosh) plays once the browser allows audio; the Sound button turns it on.
 */
export default function IntroLoader() {
  const [phase, setPhase] = useState<'run' | 'doors' | 'open' | 'gone'>('run');
  const canvas = useRef<HTMLCanvasElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const engine = useRef<{ destroy: () => void; skip: () => void } | null>(null);
  const frame = useRef<HTMLCanvasElement | null>(null);
  const started = useRef(false);
  const sound = useRef<ReturnType<typeof createInkSound>>(null);
  const [soundOn, setSoundOn] = useState(false);
  const toggleSound = useCallback(() => {
    const snd = sound.current; if (!snd) return;
    if (snd.running) { setSoundOn(false); snd.close(); sound.current = null; }
    else snd.resume().then(() => setSoundOn(snd.running));
  }, []);

  const reveal = () => {
    document.documentElement.dataset.intro = 'done';
    window.dispatchEvent(new Event(INTRO_EVENT));
  };

  // the finished frame arrives: split it into two doors and swing them open
  const openDoors = useCallback((still: HTMLCanvasElement | null) => {
    if (started.current) return;
    started.current = true;
    frame.current = still;
    setPhase('doors');
  }, []);

  const skip = useCallback(() => {
    if (engine.current) engine.current.skip(); else openDoors(null);
  }, [openDoors]);

  useEffect(() => {
    if (phase !== 'doors') return;
    const still = frame.current;
    if (still && left.current && right.current) {
      const copy = document.createElement('canvas'); copy.width = still.width; copy.height = still.height;
      copy.getContext('2d')!.drawImage(still, 0, 0);
      left.current.prepend(still); right.current.prepend(copy);
    }
    engine.current?.destroy(); engine.current = null;
    // the doors always open onto the hero
    window.scrollTo(0, 0);
    if (location.hash === '#intro') history.replaceState(null, '', location.pathname + location.search);
    // next frame: start the swing, and let the site rise in behind the doors
    const r = requestAnimationFrame(() => requestAnimationFrame(() => { setPhase('open'); reveal(); }));
    const t = window.setTimeout(() => setPhase('gone'), 1500);
    return () => { cancelAnimationFrame(r); clearTimeout(t); };
  }, [phase]);

  useEffect(() => {
    if (document.documentElement.dataset.intro !== 'play') { setPhase('gone'); return; }
    try { sessionStorage.setItem('checko-intro', '1'); } catch { /* private mode */ }
    let cancelled = false;
    const logo = new Image();
    logo.src = '/assets/checko.svg';
    // the tagline is drawn in the site's own display font, so wait for it (briefly)
    const font = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'Georgia, serif';
    const fonts = document.fonts
      ? Promise.race([document.fonts.load(`500 40px ${font}`).then(() => document.fonts.ready), new Promise(r => setTimeout(r, 900))]).catch(() => undefined)
      : Promise.resolve();
    // sound: try to start it; most browsers wait for a first click or key press
    const snd = createInkSound();
    sound.current = snd;
    if (snd) {
      snd.onState((on: boolean) => setSoundOn(on));
      snd.resume().then(() => setSoundOn(snd.running));
    }
    const wake = () => { sound.current?.resume(); };
    window.addEventListener('pointerdown', wake, { once: true });
    Promise.all([logo.decode().catch(() => undefined), fonts]).then(() => {
      if (cancelled || !canvas.current) return;
      try {
        // WebGL ink when the browser has it; the 2D version otherwise
        engine.current = startInkIntroGL({ canvas: canvas.current, logo, font, onReady: openDoors, sound: snd })
          ?? startInkIntro({ canvas: canvas.current, logo, font, onReady: openDoors, sound: snd });
      }
      catch { openDoors(null); }
    });
    const debug = /intro=debug/.test(location.search);
    const safety = window.setTimeout(() => openDoors(null), debug ? 600000 : 10000);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') skip(); };
    window.addEventListener('keydown', onKey);
    return () => { cancelled = true; clearTimeout(safety); window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', wake); engine.current?.destroy(); setTimeout(() => sound.current?.close(), 1500); };
  }, [openDoors, skip]);

  if (phase === 'gone') return null;
  return (
    <div className={`intro intro-${phase}`} aria-hidden={phase !== 'run'}>
      <p className="sr-only" role="status">Loading Checko</p>
      <canvas ref={canvas} className="intro-canvas" aria-hidden="true" />
      {phase !== 'run' && (
        <div className="intro-gate" aria-hidden="true">
          <div ref={left} className="intro-door left"><i /></div>
          <div ref={right} className="intro-door right"><i /></div>
        </div>
      )}
      {phase === 'run' && (
        <div className="intro-ctrls">
          <button type="button" className="intro-skip" onClick={toggleSound} aria-pressed={soundOn}>{soundOn ? 'Sound off' : 'Sound on'}</button>
          <button type="button" className="intro-skip" onClick={skip}>Skip intro</button>
        </div>
      )}
    </div>
  );
}
