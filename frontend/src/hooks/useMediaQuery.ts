import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function useBreakpoint() {
  const isMinMd = useMediaQuery('(min-width: 768px)');
  const isMinLg = useMediaQuery('(min-width: 1024px)');

  return {
    isMobile: !isMinMd,
    isTablet: isMinMd && !isMinLg,
    isDesktop: isMinLg,
  };
}
