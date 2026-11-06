import { describe, expect, it } from 'vitest';
import {
  BOARD,
  RuleError,
  applyCommand,
  applyOperation,
  checkInvariants,
  computeMove,
  contractStatus,
  formatCOP,
  obligationViews,
  parseCommand,
  reserveBalance,
  summarize,
  tileGridPosition,
  type Actor,
} from '../src';
import { Driver, LOCAL, now } from './helpers';

const fam = (id: string): Actor => ({ role: 'familia', familyId: id, label: `Familia ${id}` });
const station = (id: 'banco' | 'supermercado' | 'centro_comercial' | 'empresa'): Actor => ({
  role: 'estacion',
  stationId: id,
  label: `Estación ${id}`,
});
const facilitator: Actor = { role: 'facilitador', label: 'Facilitador' };

const expectRule = (fn: () => unknown, code?: string) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(RuleError);
    if (code) expect((e as RuleError).code).toBe(code);
    return;
  }
  throw new Error('Se esperaba un RuleError');
};

/** Avanza un mes completo sin decisiones económicas, terminando en el cierre. */
function finishMonth(d: Driver) {
  // Desde Inicio: 1→3→4→6→7→9→12→13→14→16→18→19→21→Inicio, sin imprevistos ni oportunidades.
  d.walk([1, 2, 1, 2, 1, 2, 3, 1, 1, 2, 2, 1, 2, 3]);
  expect(d.f.phase).toBe('cierre_mes');
}

describe('Tablero', () => {
  it('tiene 24 casillas con la composición exacta', () => {
    expect(BOARD).toHaveLength(24);
    const count = (k: string) => BOARD.filter((t) => t.kind === k).length;
    expect(count('inicio')).toBe(1);
    expect(count('compromiso')).toBe(4);
    expect(count('banco')).toBe(2);
    expect(count('imprevisto')).toBe(5);
    expect(count('oportunidad')).toBe(5);
    expect(count('centro_comercial')).toBe(2);
    expect(count('compra_opcional')).toBe(2);
    expect(count('tentacion')).toBe(2);
    expect(count('salida_familiar')).toBe(1);
  });
  it('usa el perímetro de 7 × 7 empezando abajo a la izquierda y sin repetir celdas', () => {
    const cells = BOARD.map((t) => tileGridPosition(t.index));
    expect(cells[0]).toEqual({ row: 7, col: 1 });
    expect(cells[6]).toEqual({ row: 1, col: 1 });
    expect(cells[12]).toEqual({ row: 1, col: 7 });
    expect(cells[18]).toEqual({ row: 7, col: 7 });
    expect(cells[23]).toEqual({ row: 7, col: 2 });
    expect(new Set(cells.map((c) => `${c.row}-${c.col}`)).size).toBe(24);
    for (const c of cells) expect(c.row === 1 || c.row === 7 || c.col === 1 || c.col === 7).toBe(true);
    // casillas consecutivas son adyacentes
    for (let i = 0; i < 24; i++) {
      const a = cells[i];
      const b = cells[(i + 1) % 24];
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
    }
  });
  it('formatea pesos colombianos', () => {
    expect(formatCOP(4_000_000)).toBe('$4.000.000');
    expect(formatCOP(50_000)).toBe('$50.000');
    expect(formatCOP(0)).toBe('$0');
  });
});

describe('Reglas obligatorias del motor', () => {
  it('1. entrega un solo ingreso por familia y mes', () => {
    const d = new Driver();
    d.start();
    expectRule(() => d.run({ type: 'recibirIngreso' }));
    finishMonth(d);
    expectRule(() => d.run({ type: 'recibirIngreso' }));
    d.run({ type: 'confirmarCierre' });
    d.run({ type: 'recibirIngreso' });
    expectRule(() => d.run({ type: 'recibirIngreso' }));
    expect(d.f.movements.filter((m) => m.type === 'ingreso_mensual').map((m) => m.month)).toEqual([1, 2]);
  });

  it('2. genera doce compromisos únicos al completar tres meses', () => {
    const d = new Driver();
    d.start();
    for (let m = 1; m <= 3; m++) {
      finishMonth(d);
      d.run({ type: 'confirmarCierre' });
      if (m < 3) d.run({ type: 'recibirIngreso' });
    }
    const commitments = d.f.obligations.filter((o) => o.kind === 'compromiso');
    expect(commitments).toHaveLength(12);
    expect(new Set(commitments.map((o) => o.id)).size).toBe(12);
    expect(d.f.phase).toBe('finalizado');
  });

  it('3. saltar una casilla de compromiso no elimina la obligación', () => {
    const d = new Driver();
    d.start();
    d.turn(3); // salta Arriendo (índice 1) y cae en Centro Comercial
    expect(d.f.position).toBe(3);
    const arriendo = obligationViews(d.f).find((o) => o.concept === 'arriendo' && o.month === 1)!;
    expect(arriendo.pending).toBe(1_500_000);
  });

  it('4. reservar no reduce el efectivo total', () => {
    const d = new Driver();
    d.start();
    d.run({ type: 'reservar', amount: 600_000, label: 'Arriendo' });
    const s = summarize(d.f);
    expect(s.cash).toBe(4_000_000);
    expect(s.reserves).toBe(600_000);
    expect(s.available).toBe(3_400_000);
    expect(s.totalOut).toBe(0);
  });

  it('5. no permite reservar más de lo disponible', () => {
    const d = new Driver();
    d.start();
    d.run({ type: 'reservar', amount: 3_000_000, label: 'A' });
    expectRule(() => d.run({ type: 'reservar', amount: 1_000_001, label: 'B' }), 'fondos');
    d.run({ type: 'reservar', amount: 1_000_000, label: 'B' });
    expect(summarize(d.f).available).toBe(0);
  });

  it('6. pagar desde una reserva reduce la reserva y el efectivo', () => {
    const d = new Driver();
    d.start();
    const arriendo = d.ob(1, 'arriendo');
    d.run({ type: 'reservar', amount: 1_500_000, label: 'Arriendo', obligationId: arriendo.id });
    const reserveId = d.f.reserves[0].id;
    d.run({ type: 'pagarObligacion', obligationId: arriendo.id, amount: 1_000_000, reserveId });
    expect(reserveBalance(d.f, reserveId)).toBe(500_000);
    const s = summarize(d.f);
    expect(s.cash).toBe(3_000_000);
    expect(s.available).toBe(2_500_000);
    expectRule(
      () => d.run({ type: 'pagarObligacion', obligationId: d.ob(1, 'alimentacion').id, amount: 500_001, reserveId }),
      'reserva_insuficiente',
    );
  });

  it('7. un pago parcial deja el pendiente correcto', () => {
    const d = new Driver();
    d.start();
    const edu = d.ob(1, 'educacion');
    d.run({ type: 'pagarObligacion', obligationId: edu.id, amount: 250_000 });
    expect(obligationViews(d.f).find((o) => o.id === edu.id)!.pending).toBe(350_000);
    expectRule(() => d.run({ type: 'pagarObligacion', obligationId: edu.id, amount: 350_001 }), 'sobrepago');
  });

  it('8. pagar un atraso no crea otra obligación', () => {
    const d = new Driver();
    d.start();
    finishMonth(d);
    d.run({ type: 'confirmarCierre' });
    d.run({ type: 'recibirIngreso' });
    const ids = d.f.obligations.map((o) => o.id);
    const arriendo1 = d.ob(1, 'arriendo');
    d.run({ type: 'pagarObligacion', obligationId: arriendo1.id, amount: 1_500_000 });
    expect(d.f.obligations.map((o) => o.id)).toEqual(ids);
    expect(obligationViews(d.f).find((o) => o.id === arriendo1.id)!.pending).toBe(0);
    expect(d.f.obligations.filter((o) => o.concept === 'arriendo')).toHaveLength(2);
  });

  it('9. una compra rechazada no cambia saldos ni crea deuda', () => {
    const d = new Driver();
    d.start();
    d.turn(3); // Centro Comercial
    const before = summarize(d.f);
    d.run({ type: 'pasarCompra', justificacion: 'Primero el arriendo' });
    expect(summarize(d.f)).toEqual(before);
    expect(d.f.obligations).toHaveLength(4);
    expect(d.f.phase).toBe('gestion');
  });

  it('10. una compra sin fondos no produce efectivo negativo y conserva la oferta', () => {
    const d = new Driver();
    d.start();
    const all = d.f.obligations;
    for (const o of all) d.run({ type: 'pagarObligacion', obligationId: o.id, amount: o.original });
    d.run({ type: 'reservar', amount: 500_000, label: 'Colchón' });
    d.turn(3); // Centro Comercial; efectivo 600.000, disponible 100.000
    const event = d.f.activeEvent!;
    expectRule(() => d.run({ type: 'comprar', itemId: 'celular' }), 'fondos');
    expect(summarize(d.f).cash).toBe(600_000);
    // liberar una reserva mantiene el evento activo y la compra queda posible
    d.run({ type: 'liberarReserva', reserveId: d.f.reserves[0].id });
    expect(d.f.activeEvent).toEqual(event);
    d.run({ type: 'comprar', itemId: 'celular' });
    expect(summarize(d.f).cash).toBe(100_000);
    // no se pueden hacer dos compras en la misma activación
    expectRule(() => d.run({ type: 'comprar', itemId: 'cine' }), 'compra_hecha');
    expect(checkInvariants(d.f)).toEqual([]);
  });

  it('10b. permite pedir crédito durante la compra sin volver a sortear', () => {
    const d = new Driver();
    d.start();
    for (const o of d.f.obligations) d.run({ type: 'pagarObligacion', obligationId: o.id, amount: o.original });
    d.run({ type: 'reservar', amount: 600_000, label: 'Todo' });
    d.turn(1); // Arriendo
    d.endTurn();
    d.turn(6); // índice 7: Compra opcional (tarjeta del mazo de tentaciones)
    const card = d.f.activeEvent!.cardId;
    const calls = d.rng.calls.length;
    d.run({ type: 'contratarCredito', productId: 'prestamo_grande', tierIndex: 0 });
    expect(d.f.activeEvent!.cardId).toBe(card);
    expect(d.rng.calls.length).toBe(calls); // no se volvió a sortear nada
    d.run({ type: 'comprar', itemId: card! });
    expect(summarize(d.f).cash).toBeGreaterThanOrEqual(0);
  });

  it('11. un imprevisto no pagado genera pendiente sin salida ficticia', () => {
    const d = new Driver();
    d.start();
    d.turn(2);
    const ob = d.f.obligations.find((o) => o.kind !== 'compromiso')!;
    expect(ob.eventId).toBe(d.f.activeEvent!.eventId);
    d.run({ type: 'terminarResolucion' });
    const s = summarize(d.f);
    expect(s.cash).toBe(4_000_000);
    expect(s.totalOut).toBe(0);
    expect(s.surprisesPending).toBe(ob.original);
    const reg = d.f.movements.filter((m) => m.ref.obligationId === ob.id);
    expect(reg.map((m) => m.direction)).toEqual(['neutro']);
  });

  it('11b. la pérdida parcial de ingresos es un reintegro, no un crédito ni un descuento futuro', () => {
    const d = new Driver({ surpriseOrder: ['perdida_ingresos', 'emergencia_medica', 'electrodomestico', 'gasto_escolar', 'medicamentos'] });
    d.start();
    d.turn(2);
    const ob = d.f.obligations.find((o) => o.kind === 'reintegro')!;
    expect(ob.original).toBe(300_000);
    d.run({ type: 'terminarResolucion' });
    d.run({ type: 'finalizarTurno' });
    expect(d.f.contracts).toHaveLength(0);
    d.walk([1, 1, 2, 1, 2, 3, 1, 1, 2, 2, 1, 2, 3]);
    d.run({ type: 'confirmarCierre' });
    d.run({ type: 'recibirIngreso' });
    const income2 = d.f.movements.find((m) => m.type === 'ingreso_mensual' && m.month === 2)!;
    expect(income2.amount).toBe(4_000_000);
    expect(summarize(d.f).surprisesPending).toBe(300_000);
  });

  it('12. una oportunidad no se cobra dos veces', () => {
    const d = new Driver();
    d.start();
    d.turn(5); // Oportunidad
    expect(d.f.activeEvent!.kind).toBe('oportunidad');
    expectRule(() => d.run({ type: 'terminarResolucion' }), 'oportunidad_sin_cobrar');
    d.run({ type: 'cobrarOportunidad' });
    expectRule(() => d.run({ type: 'cobrarOportunidad' }), 'ya_cobrada');
    expect(d.f.movements.filter((m) => m.type === 'oportunidad')).toHaveLength(1);
    expect(summarize(d.f).cash).toBe(4_150_000);
  });

  it('13. los abonos bancarios van primero a capital y después al costo', () => {
    const d = new Driver();
    d.start();
    d.run({ type: 'contratarCredito', productId: 'prestamo_pequeno', tierIndex: 0 });
    expect(summarize(d.f).cash).toBe(4_300_000);
    d.run({ type: 'abonarCredito', amount: 320_000 });
    const st = contractStatus(d.f, d.f.contracts[0]);
    expect(st.capitalPending).toBe(0);
    expect(st.costPending).toBe(30_000);
    expectRule(() => d.run({ type: 'abonarCredito', amount: 30_001 }), 'sobrepago');
    d.run({ type: 'abonarCredito', amount: 30_000 });
    expect(contractStatus(d.f, d.f.contracts[0]).settled).toBe(true);
    expect(d.f.movements.filter((m) => m.type === 'registro_costo_credito')).toHaveLength(1);
    expect(summarize(d.f).cash).toBe(3_950_000);
  });

  it('14. un contrato vencido impide otro mientras tenga saldo', () => {
    const d = new Driver();
    d.start();
    d.run({ type: 'contratarCredito', productId: 'tarjeta', tierIndex: 3 });
    expect(d.f.contracts[0].dueMonth).toBe(2);
    finishMonth(d);
    d.run({ type: 'confirmarCierre' });
    d.run({ type: 'recibirIngreso' });
    finishMonth(d);
    d.run({ type: 'confirmarCierre' });
    d.run({ type: 'recibirIngreso' });
    const st = contractStatus(d.f, d.f.contracts[0]);
    expect(st.overdue).toBe(true);
    expect(st.balance).toBe(380_000); // sin intereses ni multas
    expectRule(() => d.run({ type: 'contratarCredito', productId: 'microcredito', tierIndex: 0 }), 'contrato_activo');
    d.run({ type: 'abonarCredito', amount: 380_000 });
    d.run({ type: 'contratarCredito', productId: 'microcredito', tierIndex: 0 });
    expect(d.f.contracts[1].dueMonth).toBe(3);
  });

  it('15. alcanzar o cruzar Inicio detiene la ficha y descarta los pasos sobrantes', () => {
    const d = new Driver();
    d.start();
    d.walk([6, 6, 6]); // 6, 12, 18 (compromisos) …
    expect(d.f.position).toBe(18);
    d.turn(3); // 21 compra opcional
    d.endTurn();
    const cardsBefore = JSON.stringify(d.f.decks);
    d.turn(6); // 21 + 6 = 27 → Inicio, 3 pasos descartados
    expect(d.f.position).toBe(0);
    expect(d.f.lastRoll!.discardedSteps).toBe(3);
    expect(d.f.phase).toBe('cierre_mes');
    expect(d.f.activeEvent).toBeNull();
    expect(JSON.stringify(d.f.decks)).toBe(cardsBefore);
    expect(d.f.movements.filter((m) => m.type === 'ingreso_mensual')).toHaveLength(1); // el ingreso espera al cierre
    expect(computeMove(23, 1)).toMatchObject({ to: 0, reachedStart: true, discardedSteps: 0 });
  });

  it('16. el tercer cierre no genera un cuarto ingreso y bloquea el juego', () => {
    const d = new Driver();
    d.start();
    for (let m = 1; m <= 3; m++) {
      finishMonth(d);
      d.run({ type: 'confirmarCierre' });
      if (m < 3) d.run({ type: 'recibirIngreso' });
    }
    expect(d.f.phase).toBe('finalizado');
    expect(d.f.movements.filter((m) => m.type === 'ingreso_mensual')).toHaveLength(3);
    expectRule(() => d.run({ type: 'recibirIngreso' }), 'finalizado');
    expectRule(() => d.run({ type: 'girarRuleta' }), 'finalizado');
    expectRule(() => d.run({ type: 'confirmarCierre' }), 'finalizado');
    d.run({ type: 'guardarReflexionFinal', respuestas: { principal: 'Las decisiones y los imprevistos.' } });
    expect(d.f.reflections.final.principal).toContain('imprevistos');
  });

  it('17. recargar (serializar) conserva tarjeta activa, resultados y orden de mazos', () => {
    const d = new Driver();
    d.start();
    d.turn(2);
    const saved = JSON.stringify(d.f);
    const restored = JSON.parse(saved);
    expect(restored.activeEvent).toEqual(d.f.activeEvent);
    expect(restored.lastSpin).toEqual(d.f.lastSpin);
    expect(restored.lastRoll).toEqual(d.f.lastRoll);
    expect(restored.decks).toEqual(d.f.decks);
    // tras recargar no se puede volver a lanzar en el mismo turno
    expectRule(() => applyCommand(restored, { type: 'lanzarDado' }, { rng: d.rng, actor: LOCAL, now }));
    expectRule(() => applyCommand(restored, { type: 'girarRuleta' }, { rng: d.rng, actor: LOCAL, now }));
  });

  it('18. los mazos no repiten antes de agotarse y luego se rebarajan con nuevos IDs de evento', () => {
    const d = new Driver();
    d.start();
    const seen: string[] = [];
    const events: string[] = [];
    // Imprevistos en 2, 8, 11, 17, 22: tiradas 2, 6, 3, 6, 5 (recorre un mes), luego 2 en el mes siguiente.
    for (const v of [2, 6, 3, 6, 5]) {
      d.turn(v);
      expect(d.f.activeEvent!.kind).toBe('imprevisto');
      seen.push(d.f.activeEvent!.cardId!);
      events.push(d.f.activeEvent!.eventId);
      d.endTurn();
    }
    expect(new Set(seen).size).toBe(5);
    expect(d.f.decks.imprevisto.draw).toHaveLength(0);
    expect(d.f.decks.imprevisto.discard).toHaveLength(5);
    d.turn(2); // 24 → cierre
    d.run({ type: 'confirmarCierre' });
    d.run({ type: 'recibirIngreso' });
    // los mazos no se reinician al cambiar de mes
    expect(d.f.decks.imprevisto.discard).toHaveLength(5);
    d.turn(2);
    expect(d.f.decks.imprevisto.reshuffles).toBe(1);
    expect(events).not.toContain(d.f.activeEvent!.eventId);
    expect(d.f.obligations.filter((o) => o.kind !== 'compromiso')).toHaveLength(6);
  });

  it('19. dos aprobaciones simultáneas no duplican una operación', () => {
    const d = new Driver({ mode: 'aula' });
    const me = fam('f1');
    d.start(me);
    const arriendo = d.ob(1, 'arriendo');
    d.run({ type: 'pagarObligacion', obligationId: arriendo.id, amount: 1_500_000 }, me);
    expect(d.f.phase).toBe('esperando_validacion');
    expect(summarize(d.f).cash).toBe(4_000_000); // no se cobra hasta validar
    const req = d.f.requests[0];
    expect(req.station).toBe('empresa');
    const base = d.f;
    const a = applyCommand(base, { type: 'resolverSolicitud', requestId: req.id, aprobar: true }, { rng: d.rng, actor: station('empresa'), now });
    // el segundo operador trabaja sobre la versión ya aprobada
    expectRule(
      () => applyCommand(a, { type: 'resolverSolicitud', requestId: req.id, aprobar: true }, { rng: d.rng, actor: facilitator, now }),
      'solicitud_resuelta',
    );
    expect(a.movements.filter((m) => m.type === 'pago_obligacion')).toHaveLength(1);
    expect(summarize(a).cash).toBe(2_500_000);
    expect(a.phase).toBe('esperando_ruleta');
    // idempotencia por identificador de operación
    const op1 = applyOperation(a, 'op-12345678', { type: 'girarRuleta' }, { rng: d.rng, actor: me, now });
    const op2 = applyOperation(op1.state, 'op-12345678', { type: 'girarRuleta' }, { rng: d.rng, actor: me, now });
    expect(op2.duplicate).toBe(true);
    expect(op2.state.version).toBe(op1.state.version);
  });

  it('19b. al aprobar se revalida el saldo y se bloquean gastos mientras hay validación pendiente', () => {
    const d = new Driver({ mode: 'aula' });
    const me = fam('f1');
    d.start(me);
    d.turn(3, me); // Centro Comercial
    d.run({ type: 'comprar', itemId: 'promocion' }, me);
    expect(d.f.phase).toBe('esperando_validacion');
    expectRule(() => d.run({ type: 'reservar', amount: 100, label: 'x' }, me));
    expectRule(() => d.run({ type: 'pagarObligacion', obligationId: d.ob(1, 'arriendo').id, amount: 1 }, me));
    const req = d.f.requests[0];
    expect(req.station).toBe('centro_comercial');
    expectRule(() => d.run({ type: 'resolverSolicitud', requestId: req.id, aprobar: true }, station('banco')), 'permiso');
    d.run({ type: 'resolverSolicitud', requestId: req.id, aprobar: true }, station('centro_comercial'));
    expect(d.f.phase).toBe('resolucion');
    expect(d.f.activeEvent!.purchasedItemId).toBe('promocion');
    const m = d.f.movements.find((x) => x.type === 'compra')!;
    expect(m.validation?.by.stationId).toBe('centro_comercial');
    expect(m.actor.familyId).toBe('f1');
  });

  it('20. una familia no puede modificar otra', () => {
    const d = new Driver({ mode: 'aula', id: 'f1' });
    expectRule(() => d.run({ type: 'comenzarPartida' }, fam('f2')), 'permiso');
    d.start(fam('f1'));
    expectRule(() => d.run({ type: 'girarRuleta' }, fam('f2')), 'permiso');
    expectRule(() => d.run({ type: 'girarRuleta' }, LOCAL), 'permiso'); // el actor local no opera en aula
  });

  it('21. un operador de estación no puede asumir permisos de facilitador ni de familia', () => {
    const d = new Driver({ mode: 'aula' });
    d.start(fam('f1'));
    expectRule(() => d.run({ type: 'girarRuleta' }, station('banco')), 'permiso');
    d.run({ type: 'contratarCredito', productId: 'microcredito', tierIndex: 0 }, fam('f1'));
    const req = d.f.requests[0];
    expectRule(() => d.run({ type: 'resolverSolicitud', requestId: req.id, aprobar: true }, station('empresa')), 'permiso');
    d.run({ type: 'resolverSolicitud', requestId: req.id, aprobar: true }, facilitator);
    expect(d.f.decisions.some((x) => x.type === 'intervencion_facilitador')).toBe(true);
  });
});

describe('Validación de entradas', () => {
  it('rechaza importes con decimales o negativos', () => {
    expect(() => parseCommand({ type: 'reservar', amount: 10.5, label: 'x' })).toThrow();
    expect(() => parseCommand({ type: 'reservar', amount: -1, label: 'x' })).toThrow();
    expect(parseCommand({ type: 'reservar', amount: 10, label: 'x' })).toMatchObject({ amount: 10 });
  });
  it('no acepta comandos de saldo directo', () => {
    expect(() => parseCommand({ type: 'ajustarSaldo', cash: 99 })).toThrow();
  });
  it('mantiene invariantes después de muchas jugadas aleatorias', () => {
    const d = new Driver();
    d.start();
    let x = 7;
    const next = () => (x = (x * 48271) % 2147483647);
    for (let i = 0; i < 300 && d.f.phase !== 'finalizado'; i++) {
      if (d.f.phase === 'cierre_mes') {
        d.run({ type: 'confirmarCierre' });
        continue;
      }
      if (d.f.phase === 'inicio_mes') {
        d.run({ type: 'recibirIngreso' });
        continue;
      }
      d.turn((next() % 6) + 1);
      if (d.f.phase === 'resolucion') {
        const ev = d.f.activeEvent!;
        if (ev.kind === 'oportunidad') d.run({ type: 'cobrarOportunidad' });
        if (ev.offers) {
          try {
            d.run({ type: 'comprar', itemId: ev.offers[0] });
          } catch {
            /* sin fondos */
          }
        }
        for (const o of obligationViews(d.f)) {
          const amt = Math.min(o.pending, summarize(d.f).available);
          if (amt > 0) d.run({ type: 'pagarObligacion', obligationId: o.id, amount: amt });
        }
      }
      d.endTurn();
      expect(checkInvariants(d.f)).toEqual([]);
    }
    expect(d.f.phase).toBe('finalizado');
  });
});
