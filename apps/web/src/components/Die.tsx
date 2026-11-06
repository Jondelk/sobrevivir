import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/router';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

/** Dado de seis caras. Muestra el valor ya decidido; la sacudida es solo visual. */
export function Die({ value, rollKey, size = 64 }: { value?: number; rollKey?: string; size?: number }) {
  const first = useRef(rollKey);
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (!rollKey || rollKey === first.current) return;
    first.current = rollKey;
    if (prefersReducedMotion()) return;
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 650);
    return () => clearTimeout(t);
  }, [rollKey]);

  return (
    <div className={`die ${shaking ? 'die-shake' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={value ? `Dado: ${value}` : 'Dado sin lanzar'}>
        <rect x="4" y="4" width="92" height="92" rx="18" fill="#FFFDF8" stroke="#182B3A" strokeWidth="4" />
        {value
          ? PIPS[value].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8.5" fill="#182B3A" />)
          : <text x="50" y="58" textAnchor="middle" fontSize="30" fill="#182B3A" opacity="0.35">?</text>}
      </svg>
    </div>
  );
}
