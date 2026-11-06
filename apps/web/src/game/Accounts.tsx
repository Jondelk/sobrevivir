import { useState } from 'react';
import {
  ACCOUNT_PHASES,
  BANK_PRODUCTS,
  contractStatus,
  formatCOP,
  movementsToCSV,
  obligationViews,
  pendingRequest,
  reserveBalance,
  summarize,
  type FamilyState,
  type Movement,
} from '@sobrevivir/engine';
import { HelpTip, Money, downloadText, useGame } from '../components/ui';
import type { DialogState } from './Dialogs';

type Open = (d: DialogState) => void;

export function canManage(f: FamilyState) {
  return ACCOUNT_PHASES.includes(f.phase) && !pendingRequest(f);
}

export function MoneySummary({ f, compact }: { f: FamilyState; compact?: boolean }) {
  const s = summarize(f);
  return (
    <dl className={`summary ${compact ? 'summary-compact' : ''}`}>
      <div className="summary-main">
        <dt>Efectivo total</dt>
        <dd><Money v={s.cash} /></dd>
      </div>
      <div>
        <dt>Reservado <HelpTip title="Reservas">Dinero separado para algo importante. Sigue siendo efectivo; no es un gasto.</HelpTip></dt>
        <dd><Money v={s.reserves} /></dd>
      </div>
      <div>
        <dt>Disponible</dt>
        <dd><Money v={s.available} /></dd>
      </div>
      <div className="summary-debt">
        <dt>Compromisos pendientes</dt>
        <dd><Money v={s.commitmentsPending} /></dd>
      </div>
      {!compact && (
        <div className="summary-debt">
          <dt>Imprevistos y reintegros</dt>
          <dd><Money v={s.surprisesPending} /></dd>
        </div>
      )}
      <div className="summary-debt">
        <dt>Deuda bancaria</dt>
        <dd>
          <Money v={s.bankDebt} />
          {!compact && s.bankDebt > 0 && (
            <small className="muted"> (capital <Money v={s.bankCapitalPending} /> + costo <Money v={s.bankCostPending} />)</small>
          )}
        </dd>
      </div>
    </dl>
  );
}

const TYPE_LABEL: Record<Movement['type'], string> = {
  ingreso_mensual: 'Ingreso mensual',
  oportunidad: 'Oportunidad',
  desembolso_credito: 'Desembolso de crédito',
  pago_obligacion: 'Pago',
  compra: 'Compra',
  abono_capital: 'Abono a capital',
  abono_costo: 'Abono al costo',
  registro_obligacion: 'Registro de obligación',
  registro_costo_credito: 'Registro de costo bancario',
  reserva: 'Reserva',
  liberacion_reserva: 'Liberación de reserva',
};

export function History({ f }: { f: FamilyState }) {
  const [filter, setFilter] = useState<'caja' | 'todo'>('caja');
  const list = [...f.movements].reverse().filter((m) => filter === 'todo' || m.direction !== 'neutro');
  return (
    <section className="panel" aria-labelledby="hist-title">
      <header className="panel-head">
        <h3 id="hist-title">Historial de movimientos</h3>
        <div className="seg" role="group" aria-label="Filtro del historial">
          <button type="button" aria-pressed={filter === 'caja'} onClick={() => setFilter('caja')}>Entradas y salidas</button>
          <button type="button" aria-pressed={filter === 'todo'} onClick={() => setFilter('todo')}>Todo el registro</button>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => downloadText(`movimientos-${f.name.replace(/\s/g, '-').toLowerCase()}.csv`, movementsToCSV([f]))}>
          Exportar CSV
        </button>
      </header>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Movimientos de {f.name}</caption>
          <thead>
            <tr><th scope="col">Mes</th><th scope="col">Turno</th><th scope="col">Tipo</th><th scope="col">Detalle</th><th scope="col">Importe</th><th scope="col">Validación</th></tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={6} className="muted">Aún no hay movimientos.</td></tr>
            )}
            {list.map((m) => (
              <tr key={m.id}>
                <td>{m.month}</td>
                <td>{m.turn}</td>
                <td>{TYPE_LABEL[m.type]}</td>
                <td>
                  {m.description}
                  {m.justification && <small className="muted block">«{m.justification}»</small>}
                </td>
                <td className={`amount amount-${m.direction}`}>
                  {m.direction === 'entrada' ? '+' : m.direction === 'salida' ? '−' : ''}
                  {formatCOP(m.amount)}
                  {m.direction === 'neutro' && <small className="muted block">sin efecto en caja</small>}
                </td>
                <td>{m.validation ? m.validation.by.label : m.actor.role === 'sistema' ? 'Sistema' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Accounts({ open }: { open: Open }) {
  const { family: f, readOnly } = useGame();
  const manage = canManage(f) && !readOnly;
  const views = obligationViews(f);
  const months = [...new Set(views.filter((o) => o.kind === 'compromiso').map((o) => o.month))];
  const surprises = views.filter((o) => o.kind !== 'compromiso');
  const reserves = f.reserves.map((r) => ({ r, bal: reserveBalance(f, r.id) }));

  return (
    <div className="accounts">
      {!manage && !readOnly && (
        <p className="banner banner-info" role="status">
          {pendingRequest(f)
            ? 'Hay una operación esperando validación. Las cuentas se pueden revisar, pero no modificar hasta que se resuelva.'
            : 'Las cuentas se pueden modificar al inicio del turno, al resolver una casilla, en la gestión y en el cierre del mes.'}
        </p>
      )}
      <section className="panel">
        <h3>Resumen</h3>
        <MoneySummary f={f} />
        <p className="hint">Efectivo = entradas − salidas. Disponible = efectivo − reservas. Registrar una deuda no saca dinero de caja.</p>
      </section>

      <section className="panel" aria-labelledby="commit-title">
        <header className="panel-head">
          <h3 id="commit-title">Compromisos por mes</h3>
        </header>
        {months.length === 0 && <p className="muted">Los compromisos aparecen al recibir el ingreso del mes.</p>}
        {months.map((m) => (
          <div className="table-wrap" key={m}>
            <table className="table">
              <caption>Mes {m}</caption>
              <thead>
                <tr><th scope="col">Concepto</th><th scope="col">Obligación</th><th scope="col">Pagado</th><th scope="col">Reservado</th><th scope="col">Pendiente</th>{manage && <th scope="col"><span className="sr-only">Acciones</span></th>}</tr>
              </thead>
              <tbody>
                {views.filter((o) => o.kind === 'compromiso' && o.month === m).map((o) => (
                  <tr key={o.id}>
                    <th scope="row">{o.label}</th>
                    <td><Money v={o.original} /></td>
                    <td><Money v={o.paid} /></td>
                    <td>{o.reserved ? <Money v={o.reserved} /> : '—'}</td>
                    <td className={o.pending > 0 ? 'pending' : 'ok'}>{o.pending > 0 ? <Money v={o.pending} /> : 'Pagado'}</td>
                    {manage && (
                      <td className="row-actions">
                        {o.pending > 0 && (
                          <>
                            <button type="button" className="btn btn-sm btn-commit" onClick={() => open({ kind: 'pagar', obligationId: o.id })} aria-label={`Pagar ${o.label} del mes ${o.month}`}>Pagar</button>
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => open({ kind: 'reservar', obligationId: o.id })} aria-label={`Reservar para ${o.label} del mes ${o.month}`}>Reservar</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="panel" aria-labelledby="surp-title">
        <h3 id="surp-title">
          Imprevistos y reintegros{' '}
          <HelpTip title="Pérdida parcial de ingresos">
            Se representa como un reintegro de $300.000 del ingreso ya recibido. Si no se paga, queda pendiente; no se descuenta del ingreso
            siguiente y no es un crédito bancario.
          </HelpTip>
        </h3>
        {surprises.length === 0 ? (
          <p className="muted">No han aparecido imprevistos.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col">Evento</th><th scope="col">Mes</th><th scope="col">Importe</th><th scope="col">Pagado</th><th scope="col">Pendiente</th>{manage && <th scope="col"><span className="sr-only">Acciones</span></th>}</tr>
              </thead>
              <tbody>
                {surprises.map((o) => (
                  <tr key={o.id}>
                    <th scope="row">{o.label}{o.kind === 'reintegro' && <small className="muted block">reintegro</small>}</th>
                    <td>{o.month}</td>
                    <td><Money v={o.original} /></td>
                    <td><Money v={o.paid} /></td>
                    <td className={o.pending > 0 ? 'pending' : 'ok'}>{o.pending > 0 ? <Money v={o.pending} /> : 'Pagado'}</td>
                    {manage && (
                      <td className="row-actions">
                        {o.pending > 0 && <button type="button" className="btn btn-sm btn-surprise" onClick={() => open({ kind: 'pagar', obligationId: o.id })}>Pagar</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="res-title2">
        <header className="panel-head">
          <h3 id="res-title2">Reservas</h3>
          {manage && <button type="button" className="btn btn-outline btn-sm" onClick={() => open({ kind: 'reservar' })}>Nueva reserva</button>}
        </header>
        {reserves.filter((x) => x.bal > 0).length === 0 ? (
          <p className="muted">No hay dinero reservado.</p>
        ) : (
          <ul className="reserve-list">
            {reserves.filter((x) => x.bal > 0).map(({ r, bal }) => (
              <li key={r.id}>
                <span><strong>{r.label}</strong> <small className="muted">· mes {r.month}</small></span>
                <Money v={bal} />
                {manage && <button type="button" className="btn btn-sm btn-ghost" onClick={() => open({ kind: 'liberar', reserveId: r.id })}>Liberar</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="bank-title">
        <header className="panel-head">
          <h3 id="bank-title">Banco</h3>
          {manage && <button type="button" className="btn btn-bank btn-sm" onClick={() => open({ kind: 'credito' })}>Solicitar crédito</button>}
        </header>
        {f.contracts.length === 0 && <p className="muted">No han contratado productos bancarios.</p>}
        {f.contracts.map((c) => {
          const st = contractStatus(f, c);
          return (
            <article className="contract" key={c.id}>
              <h4>
                {c.label}{' '}
                <span className={`chip ${st.settled ? 'chip-oportunidad' : st.overdue ? 'chip-imprevisto' : 'chip-banco'}`}>
                  {st.settled ? 'Pagado' : st.overdue ? 'Vencido · sigue activo' : 'Activo'}
                </span>
              </h4>
              <dl className="mini-ledger">
                <div><dt>Recibieron</dt><dd><Money v={c.principal} /></dd></div>
                <div><dt>Costo</dt><dd><Money v={c.cost} /></dd></div>
                <div><dt>Capital pendiente</dt><dd><Money v={st.capitalPending} /></dd></div>
                <div><dt>Costo pendiente</dt><dd><Money v={st.costPending} /></dd></div>
                <div><dt>Tomado / vence</dt><dd>mes {c.monthTaken} / cierre del mes {c.dueMonth}</dd></div>
              </dl>
              {manage && !st.settled && <button type="button" className="btn btn-bank btn-sm" onClick={() => open({ kind: 'abono' })}>Abonar</button>}
            </article>
          );
        })}
        <details className="soft">
          <summary>Productos disponibles</summary>
          <ul className="plain-list">
            {BANK_PRODUCTS.flatMap((p) =>
              p.tiers.map((t, i) => (
                <li key={`${p.id}-${i}`}>
                  {p.label}{p.tiers.length > 1 ? ` (tramo ${i + 1})` : ''}: recibe {formatCOP(t.principal)}, cuesta {formatCOP(t.cost)}, devuelve {formatCOP(t.principal + t.cost)}.
                </li>
              )),
            )}
          </ul>
          <p className="hint">Un contrato activo por familia. Los del mes 1 vencen al cierre del mes 2; los de los meses 2 y 3, al cierre del mes 3.</p>
        </details>
      </section>

      <History f={f} />
    </div>
  );
}
