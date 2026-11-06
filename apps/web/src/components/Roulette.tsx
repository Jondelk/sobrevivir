import { useEffect, useRef, useState } from 'react';
import { PERSONAL_COLORS, type Participant, type SpinResult } from '@sobrevivir/engine';
import { prefersReducedMotion } from '../lib/router';

const SECTOR = 360 / 5;

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [50 + r * Math.cos(rad), 50 + r * Math.sin(rad)];
}

/** Ángulo de la flecha que apunta al centro del sector elegido (Azul arriba, sentido horario). */
const angleFor = (sector: number) => sector * SECTOR;

/**
 * Ruleta de cinco sectores iguales, con el estilo de referencias/ruleta.png:
 * la rueda queda fija y gira la flecha. El resultado lo decide el motor (o el
 * servidor) una sola vez; la animación solo lo representa y nunca vuelve a sortear.
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
    setRotation((prev) => prev - (((prev % 360) + 360) % 360) + 360 * 4 + target);
    const t = setTimeout(() => setAnimating(false), 1700);
    return () => clearTimeout(t);
  }, [key, spin]);

  const selected = spin && !animating ? spin.sector : -1;

  return (
    <figure className="roulette" style={{ width: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="roulette-svg" aria-hidden="true">
        {PERSONAL_COLORS.map((c, i) => {
          const a0 = i * SECTOR - SECTOR / 2;
          const a1 = i * SECTOR + SECTOR / 2;
          const [x1, y1] = polar(47, a0);
          const [x2, y2] = polar(47, a1);
          const [tx, ty] = polar(32.5, i * SECTOR);
          return (
            <g key={c.id} className={selected === i ? 'sector-on' : undefined}>
              <path d={`M50 50 L${x1} ${y1} A47 47 0 0 1 ${x2} ${y2} Z`} fill={c.hex} stroke="#102431" strokeWidth="1.1" strokeLinejoin="round" />
              <text x={tx} y={ty} fill={c.ink} fontSize="6.2" fontWeight="900" textAnchor="middle" dominantBaseline="central" letterSpacing="-0.1">
                {c.label.toUpperCase()}
              </text>
            </g>
          );
        })}
        <circle cx="50" cy="50" r="47" fill="none" stroke="#102431" strokeWidth="2.4" />
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: '50px 50px',
            transition: animating ? 'transform 1.6s cubic-bezier(.17,.67,.21,1)' : 'none',
          }}
        >
          {/* Flecha con anillo en el pivote, como la flecha recortable de la referencia */}
          <path d="M48.4 50 L48.4 30 L44.6 30 L50 21.5 L55.4 30 L51.6 30 L51.6 50 Z" fill="#102431" stroke="#F5EDE2" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="50" cy="50" r="6" fill="#102431" stroke="#F5EDE2" strokeWidth="1" />
          <circle cx="50" cy="50" r="2.2" fill="#F5EDE2" />
        </g>
      </svg>
      <figcaption className="sr-only" aria-live="polite">
        {spin && !animating
          ? `La ruleta marcó ${PERSONAL_COLORS[spin.sector].label}: ${participants[spin.participantIndex]?.role ?? ''}`
          : ''}
      </figcaption>
      {animating && <span className="roulette-spinning">Girando…</span>}
    </figure>
  );
}
