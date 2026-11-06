import { BOARD, computeMove } from './board';
import {
  BANK_PRODUCTS,
  COLOR_IDS,
  COMMITMENTS,
  COMMITMENT_CONCEPTS,
  FAMILY_OUTING_OPTIONS,
  FAMILY_PROFILES,
  MONTHLY_INCOME,
  OPPORTUNITIES,
  PURCHASES,
  RULES_VERSION,
  STATIONS,
  SURPRISES,
  TOTAL_MONTHS,
  contractDueMonth,
  type ColorId,
  type Month,
  type StationId,
} from './constants';
import { formatCOP } from './money';
import {
  activeContract,
  availableOf,
  obligationPending,
  pendingRequest,
  reserveBalance,
} from './selectors';
import type {
  Actor,
  DecisionEntry,
  Deck,
  DeckType,
  EconomicCommand,
  EngineContext,
  FamilyCommand,
  FamilyState,
  GameMode,
  Movement,
  MovementRef,
  MovementType,
  Phase,
  Rng,
  ValidationRequest,
} from './types';

export class RuleError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RuleError';
  }
}

const fail = (code: string, message: string): never => {
  throw new RuleError(code, message);
};

/** Fases en las que se pueden administrar cuentas: inicio de mes/turno, resolución, gestión y cierre. */
export const ACCOUNT_PHASES: Phase[] = ['esperando_ruleta', 'resolucion', 'gestion', 'cierre_mes'];

const ECONOMIC_TYPES = new Set<string>([
  'pagarObligacion',
  'comprar',
  'contratarCredito',
  'abonarCredito',
  'cobrarOportunidad',
  'confirmarCierre',
]);

export function isEconomicCommand(cmd: FamilyCommand): cmd is EconomicCommand {
  return ECONOMIC_TYPES.has(cmd.type);
}

export function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1, 'barajar');
    if (!Number.isInteger(j) || j < 0 || j > i) throw new Error('Fuente aleatoria inválida');
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fuente aleatoria criptográfica para el modo local y el servidor. */
export const cryptoRng: Rng = {
  int(n: number) {
    if (n <= 0 || !Number.isInteger(n)) throw new Error('Rango inválido');
    const limit = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    for (;;) {
      globalThis.crypto.getRandomValues(buf);
      if (buf[0] < limit) return buf[0] % n;
    }
  },
};

export interface CreateFamilyOptions {
  id: string;
  profileId: number;
  mode: GameMode;
  rng: Rng;
  now?: string;
  participants?: { nickname: string; colorId: ColorId }[];
}

export function createFamily(opts: CreateFamilyOptions): FamilyState {
  const profile = FAMILY_PROFILES.find((p) => p.id === opts.profileId);
  if (!profile) throw new RuleError('perfil_invalido', 'La familia seleccionada no existe.');
  const now = opts.now ?? new Date().toISOString();
  const participants = profile.roles.map((role, i) => ({
    role,
    colorId: opts.participants?.[i]?.colorId ?? COLOR_IDS[i],
    nickname: (opts.participants?.[i]?.nickname ?? '').trim().slice(0, 40),
  }));
  assertDistinctColors(participants.map((p) => p.colorId));
  const deck = (ids: string[]): Deck => ({ draw: shuffle(ids, opts.rng), discard: [], reshuffles: 0 });
  return {
    rulesVersion: RULES_VERSION,
    id: opts.id,
    profileId: profile.id,
    name: `Familia ${profile.id}`,
    mode: opts.mode,
    participants,
    phase: 'preparacion',
    month: 1,
    turn: 1,
    position: 0,
    decks: {
      imprevisto: deck(SURPRISES.map((c) => c.id)),
      oportunidad: deck(OPPORTUNITIES.map((c) => c.id)),
      tentacion: deck(PURCHASES.map((c) => c.id)),
    },
    activeEvent: null,
    obligations: [],
    reserves: [],
    contracts: [],
    movements: [],
    requests: [],
    decisions: [],
    closedMonths: [],
    reflections: { monthly: {}, final: {} },
    seq: 0,
    processedOps: [],
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function assertDistinctColors(colors: ColorId[]) {
  if (colors.length !== 5) fail('participantes', 'Cada familia tiene cinco integrantes.');
  if (new Set(colors).size !== 5 || colors.some((c) => !COLOR_IDS.includes(c)))
    fail('colores', 'Cada integrante necesita un color distinto de los cinco colores de la ruleta.');
}

// ---------------------------------------------------------------------------
// Utilidades internas sobre el borrador de estado
// ---------------------------------------------------------------------------

class Draft {
  constructor(
    public s: FamilyState,
    public ctx: EngineContext,
  ) {}
  get now() {
    return this.ctx.now ? this.ctx.now() : new Date().toISOString();
  }
  id(prefix: string) {
    this.s.seq += 1;
    return `${this.s.id}-${prefix}${this.s.seq}`;
  }
  move(
    type: MovementType,
    direction: Movement['direction'],
    amount: number,
    description: string,
    ref: MovementRef = {},
    extra: Partial<Pick<Movement, 'justification' | 'validation'>> & { actor?: Actor } = {},
  ) {
    if (!Number.isInteger(amount) || amount <= 0) fail('importe', 'El importe debe ser un número entero positivo.');
    const m: Movement = {
      id: this.id('mv'),
      familyId: this.s.id,
      month: this.s.month,
      turn: this.s.turn,
      type,
      direction,
      amount,
      description,
      ref,
      actor: extra.actor ?? this.ctx.actor,
      at: this.now,
    };
    if (extra.justification) m.justification = extra.justification.slice(0, 280);
    if (extra.validation) m.validation = extra.validation;
    this.s.movements.push(m);
    return m;
  }
  decide(type: DecisionEntry['type'], text: string, actor?: Actor) {
    this.s.decisions.push({
      id: this.id('dc'),
      month: this.s.month,
      turn: this.s.turn,
      type,
      text: text.slice(0, 400),
      actor: actor ?? this.ctx.actor,
      at: this.now,
    });
  }
  draw(deck: DeckType): string {
    const d = this.s.decks[deck];
    if (d.draw.length === 0) {
      if (d.discard.length === 0) fail('mazo_vacio', 'No quedan tarjetas disponibles en el mazo.');
      d.draw = shuffle(d.discard, this.ctx.rng);
      d.discard = [];
      d.reshuffles += 1;
    }
    return d.draw.shift()!;
  }
}

function requirePhase(s: FamilyState, phases: Phase[], what: string) {
  if (!phases.includes(s.phase)) {
    if (s.phase === 'finalizado') fail('finalizado', 'La partida terminó. Ya no se pueden registrar más acciones.');
    if (s.phase === 'esperando_validacion')
      fail('validacion_pendiente', 'Hay una operación esperando validación. Espera la respuesta o cancélala.');
    fail('fase', `No se puede ${what} en este momento del turno.`);
  }
}

function requireAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) fail('importe', 'El importe debe ser un número entero positivo de pesos.');
}

const justification = (j?: string) => (j && j.trim() ? j.trim().slice(0, 280) : undefined);

// ---------------------------------------------------------------------------
// Permisos
// ---------------------------------------------------------------------------

export function authorize(s: FamilyState, cmd: FamilyCommand, actor: Actor) {
  if (actor.role === 'sistema') return;
  if (actor.role === 'local') {
    if (s.mode !== 'local') fail('permiso', 'Esta partida pertenece a una sesión de aula.');
    return;
  }
  if (cmd.type === 'resolverSolicitud') {
    if (actor.role === 'facilitador') return;
    if (actor.role === 'estacion') {
      const req = s.requests.find((r) => r.id === cmd.requestId);
      if (req && req.station !== actor.stationId)
        fail('permiso', 'Esta solicitud corresponde a otra estación.');
      return;
    }
    fail('permiso', 'Solo las estaciones o el facilitador pueden validar solicitudes.');
  }
  if (actor.role === 'familia' && actor.familyId === s.id) return;
  fail('permiso', 'No tienes permiso para modificar esta familia.');
}

// ---------------------------------------------------------------------------
// Validación de comandos económicos
// ---------------------------------------------------------------------------

export function stationFor(s: FamilyState, cmd: EconomicCommand): StationId {
  switch (cmd.type) {
    case 'pagarObligacion': {
      const o = s.obligations.find((x) => x.id === cmd.obligationId);
      if (o && o.kind === 'compromiso') return COMMITMENTS[o.concept as keyof typeof COMMITMENTS].station;
      return 'empresa';
    }
    case 'comprar':
      return 'centro_comercial';
    default:
      return 'banco';
  }
}

function requiresValidation(s: FamilyState, cmd: EconomicCommand) {
  if (s.mode !== 'aula') return false;
  if (cmd.type === 'confirmarCierre') return s.month < TOTAL_MONTHS;
  return true;
}

function describeEconomic(s: FamilyState, cmd: EconomicCommand): { concept: string; amount: number; action: string } {
  switch (cmd.type) {
    case 'pagarObligacion': {
      const o = s.obligations.find((x) => x.id === cmd.obligationId)!;
      const reserve = cmd.reserveId ? s.reserves.find((r) => r.id === cmd.reserveId) : undefined;
      return {
        concept: `${o.label} (mes ${o.month})`,
        amount: cmd.amount,
        action: reserve ? `Pagar usando la reserva «${reserve.label}»` : 'Pagar',
      };
    }
    case 'comprar': {
      const item = PURCHASES.find((p) => p.id === cmd.itemId)!;
      return { concept: item.label, amount: item.price, action: 'Comprar' };
    }
    case 'contratarCredito': {
      const p = BANK_PRODUCTS.find((x) => x.id === cmd.productId)!;
      const t = p.tiers[cmd.tierIndex];
      return {
        concept: p.label,
        amount: t.principal,
        action: `Desembolso: recibe ${formatCOP(t.principal)}, cuesta ${formatCOP(t.cost)}, devuelve ${formatCOP(t.principal + t.cost)}`,
      };
    }
    case 'abonarCredito':
      return { concept: 'Abono a crédito', amount: cmd.amount, action: 'Abonar (primero capital, luego costo)' };
    case 'cobrarOportunidad': {
      const card = OPPORTUNITIES.find((c) => c.id === s.activeEvent?.cardId)!;
      return { concept: card.label, amount: card.amount, action: 'Recibir oportunidad' };
    }
    case 'confirmarCierre':
      return { concept: `Cierre del mes ${s.month}`, amount: 0, action: `Autorizar el inicio del mes ${s.month + 1}` };
  }
}

function precheckEconomic(s: FamilyState, cmd: EconomicCommand) {
  switch (cmd.type) {
    case 'pagarObligacion': {
      requirePhase(s, ACCOUNT_PHASES, 'pagar');
      requireAmount(cmd.amount);
      const o = s.obligations.find((x) => x.id === cmd.obligationId);
      if (!o) return fail('obligacion', 'Selecciona una obligación existente.');
      const pending = obligationPending(s, o);
      if (pending <= 0) fail('obligacion_pagada', 'Esta obligación ya está pagada.');
      if (cmd.amount > pending) fail('sobrepago', `El pago supera lo pendiente (${formatCOP(pending)}).`);
      if (cmd.reserveId) {
        const r = s.reserves.find((x) => x.id === cmd.reserveId);
        if (!r) fail('reserva', 'La reserva seleccionada no existe.');
        const bal = reserveBalance(s, cmd.reserveId);
        if (cmd.amount > bal) fail('reserva_insuficiente', `La reserva solo tiene ${formatCOP(bal)}.`);
      } else if (cmd.amount > availableOf(s)) {
        fail('fondos', `No alcanza el dinero disponible sin reservar (${formatCOP(availableOf(s))}).`);
      }
      return;
    }
    case 'comprar': {
      requirePhase(s, ['resolucion'], 'comprar');
      const ev = s.activeEvent;
      if (!ev || !ev.offers) return fail('sin_oferta', 'No hay una oferta de compra activa.');
      if (ev.purchasedItemId) fail('compra_hecha', 'Ya se realizó una compra en esta casilla.');
      if (!ev.offers.includes(cmd.itemId)) fail('oferta', 'Esa compra no está disponible en esta casilla.');
      const item = PURCHASES.find((p) => p.id === cmd.itemId)!;
      if (item.price > availableOf(s))
        fail(
          'fondos',
          `Faltan ${formatCOP(item.price - availableOf(s))} disponibles. Puedes liberar una reserva, solicitar crédito o no comprar.`,
        );
      return;
    }
    case 'contratarCredito': {
      requirePhase(s, ACCOUNT_PHASES, 'solicitar crédito');
      const p = BANK_PRODUCTS.find((x) => x.id === cmd.productId);
      if (!p || !p.tiers[cmd.tierIndex]) fail('producto', 'Producto bancario inválido.');
      const active = activeContract(s);
      if (active)
        fail(
          'contrato_activo',
          `Ya tienen un contrato activo (${active.contract.label}) con saldo de ${formatCOP(active.balance)}. Debe cancelarse antes de contratar otro.`,
        );
      return;
    }
    case 'abonarCredito': {
      requirePhase(s, ACCOUNT_PHASES, 'abonar');
      requireAmount(cmd.amount);
      const active = activeContract(s);
      if (!active) return fail('sin_contrato', 'No hay deuda bancaria pendiente.');
      if (cmd.amount > active.balance) fail('sobrepago', `El abono supera la deuda restante (${formatCOP(active.balance)}).`);
      if (cmd.reserveId) {
        if (!s.reserves.find((x) => x.id === cmd.reserveId)) fail('reserva', 'La reserva seleccionada no existe.');
        const bal = reserveBalance(s, cmd.reserveId);
        if (cmd.amount > bal) fail('reserva_insuficiente', `La reserva solo tiene ${formatCOP(bal)}.`);
      } else if (cmd.amount > availableOf(s)) {
        fail('fondos', `No alcanza el dinero disponible sin reservar (${formatCOP(availableOf(s))}).`);
      }
      return;
    }
    case 'cobrarOportunidad': {
      requirePhase(s, ['resolucion'], 'recibir la oportunidad');
      const ev = s.activeEvent;
      if (!ev || ev.kind !== 'oportunidad') fail('sin_oportunidad', 'No hay una oportunidad activa.');
      if (ev!.collected) fail('ya_cobrada', 'Esta oportunidad ya se recibió.');
      return;
    }
    case 'confirmarCierre':
      requirePhase(s, ['cierre_mes'], 'confirmar el cierre');
      return;
  }
}

function executeEconomic(d: Draft, cmd: EconomicCommand, validation?: Movement['validation'], requester?: Actor) {
  const s = d.s;
  precheckEconomic(s, cmd);
  const extra = { validation, actor: requester };
  switch (cmd.type) {
    case 'pagarObligacion': {
      const o = s.obligations.find((x) => x.id === cmd.obligationId)!;
      const ref: MovementRef = { obligationId: o.id };
      if (o.eventId) ref.eventId = o.eventId;
      if (o.cardId) ref.cardId = o.cardId;
      if (cmd.reserveId) ref.reserveId = cmd.reserveId;
      d.move('pago_obligacion', 'salida', cmd.amount, `Pago: ${o.label} (mes ${o.month})`, ref, {
        ...extra,
        justification: justification(cmd.justificacion),
      });
      return;
    }
    case 'comprar': {
      const ev = s.activeEvent!;
      const item = PURCHASES.find((p) => p.id === cmd.itemId)!;
      d.move(
        'compra',
        'salida',
        item.price,
        `Compra: ${item.label}`,
        { itemId: item.id, eventId: ev.eventId, ...(ev.cardId ? { cardId: ev.cardId } : {}) },
        { ...extra, justification: justification(cmd.justificacion) },
      );
      ev.purchasedItemId = item.id;
      d.decide('compra', `Compraron ${item.label} por ${formatCOP(item.price)}.${cmd.justificacion ? ` Motivo: ${cmd.justificacion}` : ''}`, requester);
      return;
    }
    case 'contratarCredito': {
      const p = BANK_PRODUCTS.find((x) => x.id === cmd.productId)!;
      const t = p.tiers[cmd.tierIndex];
      const id = d.id('ct');
      s.contracts.push({
        id,
        productId: p.id,
        label: p.id === 'tarjeta' ? `${p.label} (${formatCOP(t.principal)})` : p.label,
        principal: t.principal,
        cost: t.cost,
        monthTaken: s.month,
        dueMonth: contractDueMonth(s.month),
        turnTaken: s.turn,
      });
      d.move('desembolso_credito', 'entrada', t.principal, `Desembolso: ${p.label}`, { contractId: id }, {
        ...extra,
        justification: justification(cmd.justificacion),
      });
      d.move('registro_costo_credito', 'neutro', t.cost, `Costo del crédito registrado (se paga al devolver)`, { contractId: id }, extra);
      d.decide(
        'credito',
        `Contrataron ${p.label}: reciben ${formatCOP(t.principal)}, cuesta ${formatCOP(t.cost)}, devuelven ${formatCOP(t.principal + t.cost)}.`,
        requester,
      );
      return;
    }
    case 'abonarCredito': {
      const st = activeContract(s)!;
      let rest = cmd.amount;
      const toCapital = Math.min(rest, st.capitalPending);
      rest -= toCapital;
      const toCost = Math.min(rest, st.costPending);
      const ref: MovementRef = { contractId: st.contract.id };
      if (cmd.reserveId) ref.reserveId = cmd.reserveId;
      const j = justification(cmd.justificacion);
      if (toCapital > 0)
        d.move('abono_capital', 'salida', toCapital, `Abono a capital: ${st.contract.label}`, ref, { ...extra, justification: j });
      if (toCost > 0)
        d.move('abono_costo', 'salida', toCost, `Abono al costo: ${st.contract.label}`, ref, { ...extra, justification: j });
      d.decide('abono', `Abonaron ${formatCOP(cmd.amount)} a ${st.contract.label}.`, requester);
      return;
    }
    case 'cobrarOportunidad': {
      const ev = s.activeEvent!;
      const card = OPPORTUNITIES.find((c) => c.id === ev.cardId)!;
      d.move('oportunidad', 'entrada', card.amount, `Oportunidad: ${card.label}`, { cardId: card.id, eventId: ev.eventId }, extra);
      ev.collected = true;
      return;
    }
    case 'confirmarCierre': {
      s.closedMonths.push(s.month);
      d.decide('cierre', `Cerraron el mes ${s.month}.`, requester);
      if (s.month >= TOTAL_MONTHS) {
        s.phase = 'finalizado';
      } else {
        s.month = (s.month + 1) as Month;
        s.turn += 1;
        s.position = 0;
        s.phase = 'inicio_mes';
      }
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Movimiento y activación de casillas
// ---------------------------------------------------------------------------

function activateTile(d: Draft, index: number) {
  const s = d.s;
  const tile = BOARD[index];
  const base = { eventId: d.id('ev'), tileIndex: index, kind: tile.kind, month: s.month, turn: s.turn };
  switch (tile.kind) {
    case 'imprevisto': {
      const cardId = d.draw('imprevisto');
      const card = SURPRISES.find((c) => c.id === cardId)!;
      const obligationId = d.id('ob');
      s.obligations.push({
        id: obligationId,
        kind: card.kind,
        concept: card.kind,
        label: card.label,
        month: s.month,
        original: card.amount,
        createdTurn: s.turn,
        eventId: base.eventId,
        cardId,
      });
      d.move('registro_obligacion', 'neutro', card.amount, `Se registra ${card.kind === 'reintegro' ? 'el reintegro' : 'el imprevisto'}: ${card.label}`, {
        obligationId,
        cardId,
        eventId: base.eventId,
      });
      s.activeEvent = { ...base, deck: 'imprevisto', cardId, obligationId };
      break;
    }
    case 'oportunidad': {
      const cardId = d.draw('oportunidad');
      s.activeEvent = { ...base, deck: 'oportunidad', cardId, collected: false };
      break;
    }
    case 'centro_comercial':
      s.activeEvent = { ...base, offers: PURCHASES.map((p) => p.id) };
      break;
    case 'compra_opcional':
    case 'tentacion': {
      const cardId = d.draw('tentacion');
      s.activeEvent = { ...base, deck: 'tentacion', cardId, offers: [cardId] };
      break;
    }
    case 'salida_familiar':
      s.activeEvent = { ...base, offers: [...FAMILY_OUTING_OPTIONS] };
      break;
    default:
      s.activeEvent = { ...base };
  }
  s.phase = 'resolucion';
}

function startMonth(d: Draft) {
  const s = d.s;
  const already = s.movements.some((m) => m.type === 'ingreso_mensual' && m.month === s.month);
  if (already) fail('ingreso_duplicado', `El ingreso del mes ${s.month} ya se entregó.`);
  d.move('ingreso_mensual', 'entrada', MONTHLY_INCOME, `Ingreso del mes ${s.month}`, {}, { actor: { role: 'sistema', label: 'Sistema' } });
  for (const concept of COMMITMENT_CONCEPTS) {
    const id = `${s.id}-ob-m${s.month}-${concept}`;
    if (s.obligations.some((o) => o.id === id)) continue;
    const c = COMMITMENTS[concept];
    s.obligations.push({ id, kind: 'compromiso', concept, label: c.label, month: s.month, original: c.amount, createdTurn: s.turn });
    d.move('registro_obligacion', 'neutro', c.amount, `Compromiso del mes ${s.month}: ${c.label}`, { obligationId: id }, {
      actor: { role: 'sistema', label: 'Sistema' },
    });
  }
  s.phase = 'esperando_ruleta';
}

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

/**
 * Aplica un comando sobre una copia del estado y devuelve el nuevo estado.
 * Lanza RuleError si el comando no es válido. Nunca modifica el estado recibido.
 */
export function applyCommand(state: FamilyState, cmd: FamilyCommand, ctx: EngineContext): FamilyState {
  authorize(state, cmd, ctx.actor);
  const s: FamilyState = structuredClone(state);
  const d = new Draft(s, ctx);

  if (s.phase === 'finalizado' && cmd.type !== 'guardarReflexionFinal' && cmd.type !== 'guardarReflexionMes')
    fail('finalizado', 'La partida terminó. Ya no se pueden registrar más acciones.');

  if (isEconomicCommand(cmd)) {
    if (pendingRequest(s)) fail('validacion_pendiente', 'Hay una operación esperando validación. Espera la respuesta o cancélala.');
    precheckEconomic(s, cmd);
    if (requiresValidation(s, cmd)) {
      const info = describeEconomic(s, cmd);
      const req: ValidationRequest = {
        id: d.id('sol'),
        familyId: s.id,
        station: stationFor(s, cmd),
        concept: info.concept,
        amount: info.amount,
        actionLabel: info.action,
        command: cmd,
        status: 'pendiente',
        createdAt: d.now,
        requestedBy: ctx.actor,
        month: s.month,
        turn: s.turn,
      };
      s.requests.push(req);
      s.phaseBeforeValidation = s.phase;
      s.phase = 'esperando_validacion';
    } else {
      executeEconomic(d, cmd);
    }
    return finish(s, d);
  }

  switch (cmd.type) {
    case 'configurarParticipantes': {
      requirePhase(s, ['preparacion', 'inicio_mes', 'esperando_ruleta'], 'cambiar participantes');
      if (cmd.participants.length !== 5) fail('participantes', 'Cada familia tiene cinco integrantes.');
      assertDistinctColors(cmd.participants.map((p) => p.colorId));
      s.participants = s.participants.map((p, i) => ({
        role: p.role,
        colorId: cmd.participants[i].colorId,
        nickname: cmd.participants[i].nickname.trim().slice(0, 40),
      }));
      break;
    }
    case 'comenzarPartida':
      requirePhase(s, ['preparacion'], 'comenzar');
      s.phase = 'inicio_mes';
      break;
    case 'recibirIngreso':
      requirePhase(s, ['inicio_mes'], 'recibir el ingreso');
      startMonth(d);
      break;
    case 'girarRuleta': {
      requirePhase(s, ['esperando_ruleta'], 'girar la ruleta');
      if (s.lastSpin && s.lastSpin.turn === s.turn) fail('ruleta_repetida', 'La ruleta ya se giró en este turno.');
      const sector = ctx.rng.int(5, 'ruleta');
      if (!Number.isInteger(sector) || sector < 0 || sector > 4) throw new Error('Resultado de ruleta inválido');
      const colorId = COLOR_IDS[sector];
      s.lastSpin = {
        turn: s.turn,
        month: s.month,
        sector,
        colorId,
        participantIndex: s.participants.findIndex((p) => p.colorId === colorId),
      };
      s.phase = 'esperando_dado';
      break;
    }
    case 'lanzarDado': {
      requirePhase(s, ['esperando_dado'], 'lanzar el dado');
      if (s.lastRoll && s.lastRoll.turn === s.turn) fail('dado_repetido', 'El dado ya se lanzó en este turno.');
      const value = ctx.rng.int(6, 'dado') + 1;
      if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error('Resultado de dado inválido');
      const mv = computeMove(s.position, value);
      s.lastRoll = {
        turn: s.turn,
        month: s.month,
        value,
        from: mv.from,
        to: mv.to,
        reachedStart: mv.reachedStart,
        discardedSteps: mv.discardedSteps,
      };
      s.phase = 'movimiento';
      break;
    }
    case 'completarMovimiento': {
      requirePhase(s, ['movimiento'], 'mover la ficha');
      const roll = s.lastRoll!;
      s.position = roll.to;
      if (roll.reachedStart) {
        s.activeEvent = null;
        s.phase = 'cierre_mes';
      } else {
        activateTile(d, roll.to);
      }
      break;
    }
    case 'reservar': {
      requirePhase(s, ACCOUNT_PHASES, 'reservar');
      if (pendingRequest(s)) fail('validacion_pendiente', 'Hay una operación esperando validación.');
      requireAmount(cmd.amount);
      const avail = availableOf(s);
      if (cmd.amount > avail) fail('fondos', `Solo puedes reservar dinero disponible (${formatCOP(avail)}).`);
      if (cmd.obligationId && !s.obligations.some((o) => o.id === cmd.obligationId))
        fail('obligacion', 'La obligación asociada no existe.');
      const label = cmd.label.trim().slice(0, 60) || 'Reserva';
      const id = d.id('rs');
      s.reserves.push({ id, label, obligationId: cmd.obligationId, month: s.month, createdTurn: s.turn });
      d.move('reserva', 'neutro', cmd.amount, `Reserva: ${label}`, { reserveId: id, ...(cmd.obligationId ? { obligationId: cmd.obligationId } : {}) });
      d.decide('reserva', `Reservaron ${formatCOP(cmd.amount)} para «${label}».`);
      break;
    }
    case 'liberarReserva': {
      requirePhase(s, ACCOUNT_PHASES, 'liberar una reserva');
      if (pendingRequest(s)) fail('validacion_pendiente', 'Hay una operación esperando validación.');
      const r = s.reserves.find((x) => x.id === cmd.reserveId);
      if (!r) return fail('reserva', 'La reserva no existe.');
      const bal = reserveBalance(s, r.id);
      const amount = cmd.amount ?? bal;
      requireAmount(amount);
      if (amount > bal) fail('reserva_insuficiente', `La reserva solo tiene ${formatCOP(bal)}.`);
      d.move('liberacion_reserva', 'neutro', amount, `Liberación de reserva: ${r.label} (no es un ingreso)`, { reserveId: r.id });
      d.decide('liberacion', `Liberaron ${formatCOP(amount)} de «${r.label}».`);
      break;
    }
    case 'pasarCompra': {
      requirePhase(s, ['resolucion'], 'pasar');
      const ev = s.activeEvent;
      if (!ev || !ev.offers) return fail('sin_oferta', 'No hay una oferta de compra activa.');
      if (ev.purchasedItemId) fail('compra_hecha', 'Ya se realizó la compra de esta casilla.');
      const names = ev.offers.map((id) => PURCHASES.find((p) => p.id === id)!.label).join(', ');
      d.decide('pasar_compra', `Decidieron no comprar (${names}).${cmd.justificacion ? ` Motivo: ${cmd.justificacion}` : ''}`);
      endResolution(s);
      break;
    }
    case 'terminarResolucion': {
      requirePhase(s, ['resolucion'], 'continuar');
      if (s.activeEvent?.kind === 'oportunidad' && !s.activeEvent.collected)
        fail('oportunidad_sin_cobrar', 'Primero reciban el dinero de la oportunidad.');
      endResolution(s);
      break;
    }
    case 'finalizarTurno': {
      requirePhase(s, ['gestion'], 'finalizar el turno');
      if (cmd.nota && cmd.nota.trim()) d.decide('nota_turno', cmd.nota.trim());
      s.turn += 1;
      s.phase = 'esperando_ruleta';
      break;
    }
    case 'guardarReflexionMes': {
      const key = String(s.phase === 'inicio_mes' && s.month > 1 ? s.month - 1 : s.month) as '1' | '2' | '3';
      s.reflections.monthly[key] = cmd.texto.slice(0, 2000);
      break;
    }
    case 'guardarReflexionFinal': {
      requirePhase(s, ['finalizado'], 'guardar la reflexión final');
      for (const [k, v] of Object.entries(cmd.respuestas)) s.reflections.final[k.slice(0, 40)] = String(v).slice(0, 2000);
      break;
    }
    case 'cancelarSolicitud': {
      const req = s.requests.find((r) => r.id === cmd.requestId);
      if (!req) return fail('solicitud', 'La solicitud no existe.');
      if (req.status !== 'pendiente') fail('solicitud_resuelta', 'La solicitud ya fue resuelta.');
      req.status = 'cancelada';
      req.resolvedAt = d.now;
      req.resolvedBy = ctx.actor;
      restorePhase(s);
      d.decide('solicitud_cancelada', `Cancelaron la solicitud: ${req.actionLabel} — ${req.concept}.`);
      break;
    }
    case 'resolverSolicitud': {
      const req = s.requests.find((r) => r.id === cmd.requestId);
      if (!req) return fail('solicitud', 'La solicitud no existe.');
      if (req.status !== 'pendiente') fail('solicitud_resuelta', 'Esta solicitud ya fue resuelta por otro operador.');
      const by = ctx.actor;
      req.resolvedAt = d.now;
      req.resolvedBy = by;
      if (cmd.nota) req.note = cmd.nota.slice(0, 280);
      restorePhase(s);
      if (by.role === 'facilitador')
        d.decide('intervencion_facilitador', `El facilitador ${cmd.aprobar ? 'aprobó' : 'rechazó'}: ${req.actionLabel} — ${req.concept}.`, by);
      if (!cmd.aprobar) {
        req.status = 'rechazada';
        d.decide('solicitud_rechazada', `${STATIONS[req.station].label} no validó: ${req.concept}.${cmd.nota ? ` Nota: ${cmd.nota}` : ''}`, by);
        break;
      }
      try {
        // Revalida saldo y estado al aprobar; se aplica una única vez.
        const snapshot = structuredClone(s);
        const inner = new Draft(snapshot, ctx);
        executeEconomic(inner, req.command, { requestId: req.id, by, at: d.now }, req.requestedBy);
        const r2 = snapshot.requests.find((r) => r.id === req.id)!;
        r2.status = 'aprobada';
        return finish(snapshot, inner);
      } catch (e) {
        if (!(e instanceof RuleError)) throw e;
        req.status = 'rechazada';
        req.note = `No se pudo aplicar al validar: ${e.message}`;
        d.decide('solicitud_rechazada', `No se aplicó ${req.concept}: ${e.message}`, by);
      }
      break;
    }
    default:
      fail('comando', 'Comando desconocido.');
  }
  return finish(s, d);
}

function endResolution(s: FamilyState) {
  const ev = s.activeEvent;
  if (ev?.deck && ev.cardId) s.decks[ev.deck].discard.push(ev.cardId);
  s.activeEvent = null;
  s.phase = 'gestion';
}

function restorePhase(s: FamilyState) {
  s.phase = s.phaseBeforeValidation ?? 'gestion';
  delete s.phaseBeforeValidation;
}

function finish(s: FamilyState, d: Draft): FamilyState {
  s.version += 1;
  s.updatedAt = d.now;
  return s;
}

/**
 * Aplica un comando con identificador de operación. Si el identificador ya se procesó,
 * devuelve el estado sin cambios (idempotencia ante reintentos o doble clic).
 */
export function applyOperation(
  state: FamilyState,
  opId: string,
  cmd: FamilyCommand,
  ctx: EngineContext,
): { state: FamilyState; duplicate: boolean } {
  if (!opId || opId.length > 80) throw new RuleError('operacion', 'Identificador de operación inválido.');
  if (state.processedOps.includes(opId)) return { state, duplicate: true };
  const next = applyCommand(state, cmd, ctx);
  next.processedOps = [...next.processedOps, opId].slice(-300);
  return { state: next, duplicate: false };
}
