'use client';

import { useEffect, useState } from 'react';

/** True once the intro has finished, or straight away when it is not playing. */
export function useIntroDone() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (document.documentElement.dataset.intro !== 'play') { setDone(true); return; }
    const on = () => setDone(true);
    window.addEventListener('checko:intro-done', on);
    return () => window.removeEventListener('checko:intro-done', on);
  }, []);
  return done;
}
