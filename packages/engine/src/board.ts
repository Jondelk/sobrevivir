import { BOARD_SIZE, type CommitmentConcept } from './constants';

export type TileKind =
  | 'inicio'
  | 'compromiso'
  | 'imprevisto'
  | 'centro_comercial'
  | 'banco'
  | 'oportunidad'
  | 'compra_opcional'
  | 'tentacion'
  | 'salida_familiar';

export interface Tile {
  index: number;
  kind: TileKind;
  label: string;
  concept?: CommitmentConcept;
}

export type TileCategory = 'inicio' | 'compromiso' | 'imprevisto' | 'oportunidad' | 'compra' | 'banco';

export const TILE_CATEGORY: Record<TileKind, TileCategory> = {
  inicio: 'inicio',
  compromiso: 'compromiso',
  imprevisto: 'imprevisto',
  oportunidad: 'oportunidad',
  centro_comercial: 'compra',
  compra_opcional: 'compra',
  tentacion: 'compra',
  salida_familiar: 'compra',
  banco: 'banco',
};

export const CATEGORY_LABEL: Record<TileCategory, string> = {
  inicio: 'Inicio',
  compromiso: 'Compromiso',
  imprevisto: 'Imprevisto',
  oportunidad: 'Oportunidad',
  compra: 'Compras y tentaciones',
  banco: 'Banco',
};

const t = (kind: TileKind, label: string, concept?: CommitmentConcept) => ({ kind, label, concept });

/** Recorrido de 24 casillas. El índice es interno y no se muestra. */
export const BOARD: Tile[] = [
  t('inicio', 'Inicio / Cierre de mes'),
  t('compromiso', 'Arriendo', 'arriendo'),
  t('imprevisto', 'Imprevisto'),
  t('centro_comercial', 'Centro Comercial'),
  t('banco', 'Banco'),
  t('oportunidad', 'Oportunidad'),
  t('compromiso', 'Alimentación', 'alimentacion'),
  t('compra_opcional', 'Compra Opcional'),
  t('imprevisto', 'Imprevisto'),
  t('tentacion', 'Tentación de Gasto'),
  t('oportunidad', 'Oportunidad'),
  t('imprevisto', 'Imprevisto'),
  t('compromiso', 'Transporte', 'transporte'),
  t('centro_comercial', 'Centro Comercial'),
  t('banco', 'Banco'),
  t('oportunidad', 'Oportunidad'),
  t('tentacion', 'Tentación de Gasto'),
  t('imprevisto', 'Imprevisto'),
  t('compromiso', 'Educación', 'educacion'),
  t('salida_familiar', 'Salida Familiar'),
  t('oportunidad', 'Oportunidad'),
  t('compra_opcional', 'Compra Opcional'),
  t('imprevisto', 'Imprevisto'),
  t('oportunidad', 'Oportunidad'),
].map((tile, index) => ({ index, ...tile }));

if (BOARD.length !== BOARD_SIZE) {
  throw new Error('El tablero debe tener exactamente 24 casillas.');
}

/**
 * Posición de una casilla en la cuadrícula de 7 × 7 (filas y columnas desde 1).
 * Inicio en la esquina inferior izquierda; el recorrido sube por la izquierda,
 * avanza a la derecha por arriba, baja por la derecha y vuelve por abajo.
 */
export function tileGridPosition(index: number): { row: number; col: number } {
  if (index < 0 || index >= BOARD_SIZE) throw new Error('Casilla fuera del tablero');
  if (index <= 6) return { row: 7 - index, col: 1 };
  if (index <= 12) return { row: 1, col: 1 + (index - 6) };
  if (index <= 18) return { row: 1 + (index - 12), col: 7 };
  return { row: 7, col: 7 - (index - 18) };
}

export interface MoveResult {
  from: number;
  steps: number;
  to: number;
  reachedStart: boolean;
  discardedSteps: number;
  path: number[];
}

/** Calcula un movimiento. Si alcanza o supera Inicio, se detiene allí y descarta los pasos sobrantes. */
export function computeMove(from: number, steps: number): MoveResult {
  const raw = from + steps;
  if (raw >= BOARD_SIZE) {
    const used = BOARD_SIZE - from;
    const path = Array.from({ length: used }, (_, i) => (from + i + 1) % BOARD_SIZE);
    return { from, steps, to: 0, reachedStart: true, discardedSteps: raw - BOARD_SIZE, path };
  }
  const path = Array.from({ length: steps }, (_, i) => from + i + 1);
  return { from, steps, to: raw, reachedStart: false, discardedSteps: 0, path };
}
