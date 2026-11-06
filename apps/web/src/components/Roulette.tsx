import { useEffect, useRef, useState } from 'react';
import { PERSONAL_COLORS, type Participant, type SpinResult } from '@sobrevivir/engine';
import { prefersReducedMotion } from '../lib/router';

const SECTOR = 360 / 5;

/** Ángulo final que deja el sector elegido bajo el indicador superior. */
const angleFor = (sector: number) => -(sector * SECTOR + SECTOR / 2);

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [50 + r * Math.cos(rad), 50 + r * Math.sin(rad)];
}

/**
 * Ruleta de cinco sectores iguales. El resultado lo decide el motor (o el servidor)
 * una sola vez; la animación solo representa ese resultado y nunca vuelve a sortear.
 */
export function Roulette({ spin, participants, size = 150 }: { spin?: SpinResult; participants: Participant[]; size?: number }) {
  const key = spin ? `${spin.turn}-${spin.sector}` : 'none';
  const firstKey = useRef(key);
  const [rotation, setRotation] = useState(() => (spin ? angleFor(spin.sector) : 0));
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!spin || key === firstKey.current) return;
    firstKey.current = key;
    const target = angleFor(spin.sector);
    if (prefersReducedMotion()) {
      setRotation(target);
      return;
    }
    setAnimating(true);
    setRotation((prev) => {
      const base = prev - (((prev % 360) + 360) % 360);
      return base + 360 * 4 + ((target % 360) + 360) % 360;
    });
    const t = setTimeout(() => setAnimating(false), 1700);
    return () => clearTimeout(t);
  }, [key, spin]);

  return (
    <figure className="roulette" style={{ width: size }}>
      <div className="roulette-wheel-wrap">
        <svg viewBox="0 0 100 100" width={size} height={size} className="roulette-svg" aria-hidden="true">
          <g
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: '50px 50px',
              transition: animating ? 'transform 1.6s cubic-bezier(.17,.67,.21,1)' : 'none',
            }}
          >
            {PERSONAL_COLORS.map((c, i) => {
              const [x1, y1] = polar(48, i * SECTOR);
              const [x2, y2] = polar(48, (i + 1) * SECTOR);
              const [tx, ty] = polar(31, i * SECTOR + SECTOR / 2);
              return (
                <g key={c.id}>
                  <path d={`M50 50 L${x1} ${y1} A48 48 0 0 1 ${x2} ${y2} Z`} fill={c.hex} stroke="#F6F0E4" strokeWidth="1.2" />
                  <text
                    x={tx}
                    y={ty}
                    fill={c.ink}
                    fontSize="8"
                    fontWeight="700"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${i * SECTOR + SECTOR / 2} ${tx} ${ty})`}
                  >
                    {c.label}
                  </text>
                </g>
              );
            })}
            <circle cx="50" cy="50" r="9" fill="#F6F0E4" stroke="#182B3A" strokeWidth="1.5" />
          </g>
          <path d="M50 1 L44.5 10 L55.5 10 Z" fill="#182B3A" />
        </svg>
      </div>
      <figcaption className="sr-only" aria-live="polite">
        {spin && !animating
          ? `La ruleta marcó ${PERSONAL_COLORS[spin.sector].label}: ${participants[spin.participantIndex]?.role ?? ''}`
          : ''}
      </figcaption>
      {animating && <span className="roulette-spinning">Girando…</span>}
    </figure>
  );
}
