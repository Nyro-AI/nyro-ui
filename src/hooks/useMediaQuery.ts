import { useEffect, useState } from 'react';

/**
 * Hook reactivo a una media query CSS. Devuelve true si matchea y se re-renderiza
 * cuando cambia (resize / rotación de la tablet). SSR-safe (false si no hay window).
 *
 * Uso: const wide = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange(); // sincroniza por si la query cambió entre render y efecto
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
