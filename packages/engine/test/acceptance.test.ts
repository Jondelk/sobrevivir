import { describe, expect, it } from 'vitest';
import { checkInvariants, obligationViews, summarize } from '../src';
import { Driver } from './helpers';

/**
 * Caso numérico de aceptación (sección 22). Usa únicamente comandos válidos del
 * motor y resultados de ruleta, dado y barajado controlados en la prueba.
 */
describe('Caso numérico de aceptación — tres meses', () => {
  it('reproduce exactamente los saldos de los tres meses', () => {
    const d = new Driver({
      surpriseOrder: ['emergencia_medica', 'gasto_escolar', 'electrodomestico', 'perdida_ingresos', 'medicamentos'],
    });

    // ---------------- MES 1 ----------------
    d.start();
    expect(summarize(d.f).cash).toBe(4_000_000);

    d.turn(2); // Imprevisto → Emergencia médica
    expect(d.f.activeEvent?.cardId).toBe('emergencia_medica');
    const emergencia = d.f.obligations.find((o) => o.cardId === 'emergencia_medica')!;
    expect(summarize(d.f).cash).toBe(4_000_000); // la aparición no descuenta efectivo
    d.run({ type: 'pagarObligacion', obligationId: emergencia.id, amount: 300_000 });
    d.endTurn();

    d.turn(1); // Centro Comercial
    d.run({ type: 'comprar', itemId: 'celular', justificacion: 'El celular del padre se dañó' });
    d.endTurn();

    d.turn(1); // Banco
    d.run({ type: 'contratarCredito', productId: 'prestamo_pequeno', tierIndex: 0 });
    d.run({ type: 'pagarObligacion', obligationId: d.ob(1, 'arriendo').id, amount: 1_500_000 });
    d.run({ type: 'pagarObligacion', obligationId: d.ob(1, 'alimentacion').id, amount: 900_000 });
    d.run({ type: 'pagarObligacion', obligationId: d.ob(1, 'transporte').id, amount: 400_000 });
    d.run({ type: 'pagarObligacion', obligationId: d.ob(1, 'educacion').id, amount: 200_000 });
    d.endTurn();

    d.walk([2, 1, 2, 3, 1, 1, 2, 2, 1, 2, 3]);
    expect(d.f.phase).toBe('cierre_mes');
    expect(d.f.position).toBe(0);
    d.run({ type: 'reservar', amount: 200_000, label: 'Educación pendiente', obligationId: d.ob(1, 'educacion').id });

    let s = summarize(d.f);
    expect(s.cash).toBe(500_000);
    expect(s.reserves).toBe(200_000);
    expect(s.available).toBe(300_000);
    expect(s.bankCapitalPending).toBe(300_000);
    expect(s.bankCostPending).toBe(50_000);
    expect(obligationViews(d.f).find((o) => o.id === d.ob(1, 'educacion').id)!.pending).toBe(400_000);
    d.run({ type: 'guardarReflexionMes', texto: 'Priorizamos arriendo y comida.' });
    d.run({ type: 'confirmarCierre' });

    // ---------------- MES 2 ----------------
    expect(d.f.month).toBe(2);
    expect(d.f.phase).toBe('inicio_mes');
    expect(summarize(d.f).cash).toBe(500_000);
    d.run({ type: 'recibirIngreso' });
    expect(summarize(d.f).cash).toBe(4_500_000);

    const inBefore = summarize(d.f).totalIn;
    d.run({ type: 'liberarReserva', reserveId: d.f.reserves[0].id });
    expect(summarize(d.f).totalIn).toBe(inBefore); // liberar no es ingreso
    expect(summarize(d.f).cash).toBe(4_500_000);
    expect(summarize(d.f).reserves).toBe(0);

    for (const c of ['arriendo', 'alimentacion', 'transporte', 'educacion']) {
      const o = d.ob(2, c);
      d.run({ type: 'pagarObligacion', obligationId: o.id, amount: o.original });
    }
    const obligationsBefore = d.f.obligations.length;
    d.run({ type: 'pagarObligacion', obligationId: d.ob(1, 'educacion').id, amount: 400_000 });
    expect(d.f.obligations.length).toBe(obligationsBefore); // el atraso conserva su ID
    d.run({ type: 'abonarCredito', amount: 350_000 });

    d.walk([1, 2, 1, 2, 1, 2, 3, 1, 1, 2, 2, 1, 2, 3]);
    expect(d.f.phase).toBe('cierre_mes');
    d.run({ type: 'reservar', amount: 100_000, label: 'Colchón para el mes 3' });
    s = summarize(d.f);
    expect(s.cash).toBe(350_000);
    expect(s.reserves).toBe(100_000);
    expect(s.available).toBe(250_000);
    expect(s.bankDebt).toBe(0);
    expect(obligationViews(d.f).filter((o) => o.month === 1 && o.pending > 0)).toHaveLength(0);
    d.run({ type: 'confirmarCierre' });

    // ---------------- MES 3 ----------------
    expect(summarize(d.f).cash).toBe(350_000);
    d.run({ type: 'recibirIngreso' });
    for (const c of ['arriendo', 'alimentacion', 'transporte', 'educacion']) {
      const o = d.ob(3, c);
      d.run({ type: 'pagarObligacion', obligationId: o.id, amount: o.original });
    }
    d.turn(2); // Imprevisto → Gasto escolar inesperado
    expect(d.f.activeEvent?.cardId).toBe('gasto_escolar');
    d.run({ type: 'pagarObligacion', obligationId: d.f.activeEvent!.obligationId!, amount: 200_000 });
    d.endTurn();
    d.walk([1, 1, 2, 1, 2, 3, 1, 1, 2, 2]);
    d.turn(1); // Salida Familiar
    expect(d.f.activeEvent?.kind).toBe('salida_familiar');
    d.run({ type: 'comprar', itemId: 'cine' });
    d.endTurn();
    d.walk([2, 3]);
    expect(d.f.phase).toBe('cierre_mes');
    d.run({ type: 'confirmarCierre' });

    expect(d.f.phase).toBe('finalizado');
    s = summarize(d.f);
    expect(s.cash).toBe(600_000);
    expect(s.reserves).toBe(100_000);
    expect(s.available).toBe(500_000);
    expect(s.bankDebt).toBe(0);
    expect(s.totalIn).toBe(12_300_000);
    expect(s.totalOut).toBe(11_700_000);
    expect(s.totalIn - s.totalOut).toBe(s.cash);
    expect(d.f.movements.filter((m) => m.type === 'ingreso_mensual')).toHaveLength(3);
    expect(d.f.obligations.filter((o) => o.kind === 'compromiso')).toHaveLength(12);
    expect(checkInvariants(d.f)).toEqual([]);
  });
});
