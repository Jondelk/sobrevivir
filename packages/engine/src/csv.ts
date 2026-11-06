import { formatCOP } from './money';
import type { FamilyState } from './types';

const esc = (v: string | number | undefined) => {
  const s = v === undefined ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const DIRECTION_LABEL = { entrada: 'Entrada', salida: 'Salida', neutro: 'Registro (sin efecto en caja)' } as const;

/** Exporta el historial auditable de movimientos en CSV (separador «;», importes enteros). */
export function movementsToCSV(families: FamilyState[]): string {
  const header = [
    'id', 'familia', 'mes', 'turno', 'tipo', 'sentido', 'importe_cop', 'importe_formato', 'descripcion',
    'obligacion', 'tarjeta', 'evento', 'contrato', 'reserva', 'compra', 'justificacion', 'actor',
    'validado_por', 'solicitud', 'fecha',
  ];
  const rows = [header.join(';')];
  for (const f of families) {
    for (const m of f.movements) {
      rows.push(
        [
          m.id, f.name, m.month, m.turn, m.type, DIRECTION_LABEL[m.direction], m.amount, formatCOP(m.amount),
          m.description, m.ref.obligationId, m.ref.cardId, m.ref.eventId, m.ref.contractId, m.ref.reserveId,
          m.ref.itemId, m.justification, m.actor.label, m.validation?.by.label, m.validation?.requestId, m.at,
        ]
          .map(esc)
          .join(';'),
      );
    }
  }
  return '﻿' + rows.join('\n');
}
