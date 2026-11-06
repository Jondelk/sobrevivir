import { useEffect, useState } from 'react';

/** Enrutador mínimo basado en el fragmento (#/ruta). Permite enlaces privados sin configurar el servidor. */
export function useHashRoute(): string[] {
  const read = () => (window.location.hash.replace(/^#\/?/, '').split('?')[0] || '').split('/').filter(Boolean);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => {
      setParts(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts.map(decodeURIComponent);
}

export function go(path: string) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function newOpId() {
  return `op-${crypto.randomUUID()}`;
}
