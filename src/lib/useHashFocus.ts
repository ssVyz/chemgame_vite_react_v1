import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scrolls to and briefly highlights the element whose id equals the current URL
 * hash (e.g. `/research#tech-3` focuses `<... id="tech-3">`). Powers the D4
 * cross-links between the Research and Encyclopedia tabs.
 *
 * `ready` should become true once the target elements have rendered, so the
 * effect re-runs after async catalogue data lands.
 */
export function useHashFocus(ready: boolean) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    const id = decodeURIComponent(hash.slice(1));
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('is-focused');
    const t = window.setTimeout(() => el.classList.remove('is-focused'), 2200);
    return () => window.clearTimeout(t);
  }, [hash, ready]);
}
