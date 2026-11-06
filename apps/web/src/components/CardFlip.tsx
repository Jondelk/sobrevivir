import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CARD_CATEGORIES, type CardCategoryId } from '@sobrevivir/engine';
import { prefersReducedMotion } from '../lib/router';

/**
 * Registro, en memoria de esta pestaña, de las tarjetas que ya estaban sobre la mesa
 * al abrir la página (recarga o reconexión) y de las que ya se voltearon. Así la
 * animación solo ocurre cuando la tarjeta se saca en vivo, y nunca se repite.
 */
const presentOnLoad = new Set<string>();
const alreadyRevealed = new Set<string>();

export function markPresentOnLoad(eventId: string | undefined) {
  if (eventId) presentOnLoad.add(eventId);
}

export const CATEGORY_SYMBOL: Record<CardCategoryId, string> = {
  imprevisto: '/marca/casillas/imprevisto.png',
  oportunidad: '/marca/casillas/oportunidad.png',
  tentacion: '/marca/casillas/tentacion.png',
};

type FlipState = 'reverso' | 'girando' | 'frente';

/**
 * Tarjeta que se levanta: muestra el reverso y se voltea al frente.
 * La tarjeta ya fue decidida por el motor o el servidor; esto solo la representa.
 */
export function CardFlip({
  eventId,
  category,
  announce,
  front,
}: {
  eventId: string;
  category: CardCategoryId;
  announce: string;
  front: ReactNode;
}) {
  const [state, setState] = useState<FlipState>(() =>
    presentOnLoad.has(eventId) || alreadyRevealed.has(eventId) || prefersReducedMotion() ? 'frente' : 'reverso',
  );
  const animated = useRef(state !== 'frente');
  const frontRef = useRef<HTMLDivElement>(null);
  const cat = CARD_CATEGORIES[category];

  useEffect(() => {
    if (state === 'frente') {
      alreadyRevealed.add(eventId);
      if (animated.current) {
        // Tras voltear en vivo, el foco pasa a la primera acción de la tarjeta.
        frontRef.current?.querySelector<HTMLElement>('button:not(:disabled), input, select, textarea')?.focus();
      }
      return;
    }
    const t = setTimeout(() => setState(state === 'reverso' ? 'girando' : 'frente'), state === 'reverso' ? 850 : 650);
    return () => clearTimeout(t);
  }, [state, eventId]);

  return (
    <div className={`flip flip-${category}`} data-state={state} data-testid="card-flip">
      <div className="flip-inner">
        <div className="flip-face flip-back" aria-hidden={state === 'frente'}>
          <span className="flip-back-band">{cat.singular}</span>
          <img src={CATEGORY_SYMBOL[category]} alt="" className="flip-back-symbol" />
          <span className="flip-back-label">{cat.label}</span>
          <span className="flip-back-instruction">{cat.instruction}</span>
        </div>
        <div className="flip-face flip-front" ref={frontRef} aria-hidden={state !== 'frente'} inert={state !== 'frente'}>
          {front}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {state === 'frente' ? announce : `Se levanta una tarjeta de ${cat.label.toLowerCase()}…`}
      </p>
    </div>
  );
}
