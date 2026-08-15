import { useEffect, useState } from 'react';

/** Reactive `window.matchMedia` subscription — panels use this instead of a
 * one-off `window.innerWidth` read so a phone rotated mid-run reflows
 * without needing a remount. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

// Width covers portrait phones; height covers landscape phones, whose width
// alone (700-926px on most devices) would otherwise pass for desktop while
// having nowhere near enough vertical room for the stacked Genes+TraitCloud
// panels.
const MOBILE_QUERY = '(max-width: 700px), (max-height: 480px)';

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
