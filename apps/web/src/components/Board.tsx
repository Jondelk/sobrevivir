import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { BOARD, CATEGORY_LABEL, COMMITMENTS, TILE_CATEGORY, formatCOP, tileGridPosition, type Tile } from '@sobrevivir/engine';
import { tileArtFor } from '../brand';
import { prefersReducedMotion } from '../lib/router';

const TILE_HELP: Record<Tile['kind'], string> = {
  inicio: 'Al llegar o pasar por aquí se cierra el mes. La ficha se detiene y los pasos sobrantes se descartan.',
  compromiso: 'Revisen cuánto deben de este compromiso, cuánto han pagado y decidan si pagan, reservan o lo dejan pendiente.',
  imprevisto: 'Se saca una tarjeta de imprevisto. Crea una obligación que pueden pagar completa, en parte o dejar pendiente.',
  oportunidad: 'Se saca una tarjeta de oportunidad: un ingreso que se recibe una sola vez.',
  centro_comercial: 'Pueden elegir como máximo una compra del catálogo, o no comprar.',
  compra_opcional: 'Se saca una tarjeta del mazo de compras. Comprar nunca es obligatorio.',
  tentacion: 'Se saca una tarjeta del mazo de compras. Conversen antes de decidir.',
  salida_familiar: 'Cine, cena familiar o no salir. Máximo una opción.',
  banco: 'Revisen deuda, alternativas y abonos. Caer aquí no obliga a contratar.',
};

export function tileHelp(tile: Tile) {
  return TILE_HELP[tile.kind];
}

/** Recorre visualmente la ruta hasta la posición real. La posición del estado es la fuente de verdad. */
function useDisplayPosition(actual: number) {
  const [shown, setShown] = useState(actual);
  const shownRef = useRef(actual);
  useEffect(() => {
    if (shownRef.current === actual) return;
    if (prefersReducedMotion()) {
      shownRef.current = actual;
      setShown(actual);
      return;
    }
    const id = setInterval(() => {
      const next = (shownRef.current + 1) % BOARD.length;
      shownRef.current = next;
      setShown(next);
      if (next === actual) clearInterval(id);
    }, 190);
    return () => clearInterval(id);
  }, [actual]);
  return shown;
}

interface BoardProps {
  position: number;
  familyLabel: string;
  tokenColor?: string;
  activeIndex?: number | null;
  children?: ReactNode;
  compact?: boolean;
}

export function Board({ position, familyLabel, activeIndex, children, compact, tokenColor }: BoardProps) {
  const shown = useDisplayPosition(position);
  const [focusIdx, setFocusIdx] = useState(position);
  const [info, setInfo] = useState<number | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const token = tileGridPosition(shown);

  const onKey = (e: KeyboardEvent, i: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % BOARD.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + BOARD.length) % BOARD.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = BOARD.length - 1;
    if (e.key === 'Escape') setInfo(null);
    if (next !== null) {
      e.preventDefault();
      setFocusIdx(next);
      refs.current[next]?.focus();
    }
  };

  const infoTile = info !== null ? BOARD[info] : null;

  return (
    <div className={`board ${compact ? 'board-compact' : ''}`}>
      {!compact && (
        <>
          <span className="board-arrow board-arrow-up" aria-hidden="true" />
          <span className="board-arrow board-arrow-right" aria-hidden="true" />
          <span className="board-arrow board-arrow-down" aria-hidden="true" />
          <span className="board-arrow board-arrow-left" aria-hidden="true" />
        </>
      )}
      <div
        className="board-grid"
        role="group"
        aria-label="Tablero de 24 casillas. El recorrido sube por la izquierda, avanza por arriba, baja por la derecha y vuelve por abajo. Usa las flechas para recorrerlo y Enter para ver qué ocurre en cada casilla."
      >
        {BOARD.map((tile) => {
          const { row, col } = tileGridPosition(tile.index);
          const cat = TILE_CATEGORY[tile.kind];
          const here = tile.index === position;
          const corner = (row === 1 || row === 7) && (col === 1 || col === 7);
          return (
            <button
              key={tile.index}
              ref={(el) => {
                refs.current[tile.index] = el;
              }}
              type="button"
              className={`tile tile-${cat} ${corner ? 'tile-corner' : ''} ${here ? 'tile-here' : ''} ${activeIndex === tile.index ? 'tile-active' : ''}`}
              style={{ gridRow: row, gridColumn: col }}
              tabIndex={tile.index === focusIdx ? 0 : -1}
              onFocus={() => setFocusIdx(tile.index)}
              onKeyDown={(e) => onKey(e, tile.index)}
              onClick={() => setInfo(info === tile.index ? null : tile.index)}
              aria-label={`${tile.label}. ${CATEGORY_LABEL[cat]}.${here ? ` Aquí está la ficha de ${familyLabel}.` : ''}`}
              aria-expanded={info === tile.index}
            >
              <span className="tile-head">
                <span className="tile-label">{tile.label}</span>
              </span>
              <span className="tile-body" aria-hidden="true">
                {tile.concept && !compact && <span className="tile-amount">{formatCOP(COMMITMENTS[tile.concept].amount)} / mes</span>}
                <img className="tile-art" src={tileArtFor(tile)} alt="" draggable={false} />
              </span>
            </button>
          );
        })}
        <div className="board-center">{children}</div>
        <div
          className="token"
          aria-hidden="true"
          style={{
            left: `${((token.col - 1 + 0.82) / 7) * 100}%`,
            top: `${((token.row - 1 + 0.8) / 7) * 100}%`,
            ['--token' as string]: tokenColor ?? 'var(--ink)',
          }}
        >
          <span className="token-dot" />
        </div>
      </div>
      {infoTile && (
        <div className="tile-info" role="note">
          <strong>{infoTile.label}</strong> <span className={`chip chip-${TILE_CATEGORY[infoTile.kind]}`}>{CATEGORY_LABEL[TILE_CATEGORY[infoTile.kind]]}</span>
          <p>{tileHelp(infoTile)}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInfo(null)}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
