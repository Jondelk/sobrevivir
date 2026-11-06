import type { BankContract, FamilyState, Movement, Obligation } from './types';

const sum = (list: Movement[]) => list.reduce((s, m) => s + m.amount, 0);

/** Efectivo total = entradas reales − salidas reales (derivado del registro). */
export function cashOf(f: FamilyState): number {
  let cash = 0;
  for (const m of f.movements) {
    if (m.direction === 'entrada') cash += m.amount;
    else if (m.direction === 'salida') cash -= m.amount;
  }
  return cash;
}

export function totalIn(f: FamilyState): number {
  return sum(f.movements.filter((m) => m.direction === 'entrada'));
}
export function totalOut(f: FamilyState): number {
  return sum(f.movements.filter((m) => m.direction === 'salida'));
}

/** Saldo de una reserva = reservado − liberado − pagado desde la reserva. */
export function reserveBalance(f: FamilyState, reserveId: string): number {
  let bal = 0;
  for (const m of f.movements) {
    if (m.ref.reserveId !== reserveId) continue;
    if (m.type === 'reserva') bal += m.amount;
    else if (m.type === 'liberacion_reserva') bal -= m.amount;
    else if (m.direction === 'salida') bal -= m.amount;
  }
  return bal;
}

export function reservesTotal(f: FamilyState): number {
  return f.reserves.reduce((s, r) => s + reserveBalance(f, r.id), 0);
}

/** Disponible = efectivo total − reservas. */
export function availableOf(f: FamilyState): number {
  return cashOf(f) - reservesTotal(f);
}

export function obligationPaid(f: FamilyState, obligationId: string): number {
  return sum(f.movements.filter((m) => m.type === 'pago_obligacion' && m.ref.obligationId === obligationId));
}

/** Pendiente = importe original − pagos aplicados. */
export function obligationPending(f: FamilyState, o: Obligation): number {
  return o.original - obligationPaid(f, o.id);
}

export interface ContractStatus {
  contract: BankContract;
  capitalPaid: number;
  costPaid: number;
  capitalPending: number;
  costPending: number;
  balance: number;
  overdue: boolean;
  settled: boolean;
}

export function contractStatus(f: FamilyState, c: BankContract): ContractStatus {
  const capitalPaid = sum(f.movements.filter((m) => m.type === 'abono_capital' && m.ref.contractId === c.id));
  const costPaid = sum(f.movements.filter((m) => m.type === 'abono_costo' && m.ref.contractId === c.id));
  const capitalPending = c.principal - capitalPaid;
  const costPending = c.cost - costPaid;
  const balance = capitalPending + costPending;
  return {
    contract: c,
    capitalPaid,
    costPaid,
    capitalPending,
    costPending,
    balance,
    overdue: balance > 0 && f.closedMonths.includes(c.dueMonth),
    settled: balance === 0,
  };
}

/** Contrato activo: el que todavía tiene saldo (aunque esté vencido). */
export function activeContract(f: FamilyState): ContractStatus | null {
  for (const c of f.contracts) {
    const st = contractStatus(f, c);
    if (st.balance > 0) return st;
  }
  return null;
}

export interface ObligationView extends Obligation {
  paid: number;
  pending: number;
  reserved: number;
}

export function obligationViews(f: FamilyState): ObligationView[] {
  return f.obligations.map((o) => ({
    ...o,
    paid: obligationPaid(f, o.id),
    pending: obligationPending(f, o),
    reserved: f.reserves.filter((r) => r.obligationId === o.id).reduce((s, r) => s + reserveBalance(f, r.id), 0),
  }));
}

export interface FamilySummary {
  cash: number;
  reserves: number;
  available: number;
  commitmentsPending: number;
  surprisesPending: number;
  bankCapitalPending: number;
  bankCostPending: number;
  bankDebt: number;
  totalIn: number;
  totalOut: number;
  pendingRequests: number;
}

export function summarize(f: FamilyState): FamilySummary {
  const views = obligationViews(f);
  const commitmentsPending = views.filter((o) => o.kind === 'compromiso').reduce((s, o) => s + o.pending, 0);
  const surprisesPending = views.filter((o) => o.kind !== 'compromiso').reduce((s, o) => s + o.pending, 0);
  let bankCapitalPending = 0;
  let bankCostPending = 0;
  for (const c of f.contracts) {
    const st = contractStatus(f, c);
    bankCapitalPending += st.capitalPending;
    bankCostPending += st.costPending;
  }
  const reserves = reservesTotal(f);
  const cash = cashOf(f);
  return {
    cash,
    reserves,
    available: cash - reserves,
    commitmentsPending,
    surprisesPending,
    bankCapitalPending,
    bankCostPending,
    bankDebt: bankCapitalPending + bankCostPending,
    totalIn: totalIn(f),
    totalOut: totalOut(f),
    pendingRequests: f.requests.filter((r) => r.status === 'pendiente').length,
  };
}

export function pendingRequest(f: FamilyState) {
  return f.requests.find((r) => r.status === 'pendiente') ?? null;
}

/** Verifica las invariantes contables. Devuelve la lista de problemas (vacía si todo cuadra). */
export function checkInvariants(f: FamilyState): string[] {
  const problems: string[] = [];
  const cash = cashOf(f);
  if (cash < 0) problems.push(`Efectivo negativo: ${cash}`);
  if (cash !== totalIn(f) - totalOut(f)) problems.push('Efectivo no coincide con entradas − salidas');
  for (const m of f.movements) {
    if (!Number.isInteger(m.amount) || m.amount <= 0) problems.push(`Importe inválido en ${m.id}`);
  }
  for (const r of f.reserves) {
    const b = reserveBalance(f, r.id);
    if (b < 0) problems.push(`Reserva ${r.id} negativa`);
  }
  if (reservesTotal(f) > cash) problems.push('Las reservas superan el efectivo');
  for (const o of f.obligations) {
    const p = obligationPending(f, o);
    if (p < 0 || p > o.original) problems.push(`Pendiente fuera de rango en ${o.id}`);
  }
  for (const c of f.contracts) {
    const st = contractStatus(f, c);
    if (st.capitalPending < 0 || st.costPending < 0) problems.push(`Contrato ${c.id} sobrepagado`);
  }
  const ids = new Set<string>();
  for (const o of f.obligations) {
    if (ids.has(o.id)) problems.push(`Obligación duplicada ${o.id}`);
    ids.add(o.id);
  }
  return problems;
}
