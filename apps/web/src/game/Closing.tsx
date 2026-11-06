import { useState } from 'react';
import { obligationViews, summarize, type FamilyState } from '@sobrevivir/engine';
import { Money, TextField, useGame } from '../components/ui';
import { MoneySummary } from './Accounts';
import type { DialogState } from './Dialogs';

export function monthFlows(f: FamilyState, month: number) {
  const ms = f.movements.filter((m) => m.month === month);
  const inflow = ms.filter((m) => m.direction === 'entrada').reduce((s, m) => s + m.amount, 0);
  const outflow = ms.filter((m) => m.direction === 'salida').reduce((s, m) => s + m.amount, 0);
  const before = f.movements
    .filter((m) => m.month < month)
    .reduce((s, m) => s + (m.direction === 'entrada' ? m.amount : m.direction === 'salida' ? -m.amount : 0), 0);
  return { before, inflow, outflow, after: before + inflow - outflow };
}

export function Closing({ open }: { open: (d: DialogState) => void }) {
  const { family: f, act, busy, mode, readOnly } = useGame();
  const [text, setText] = useState(f.reflections.monthly[String(f.month) as '1'] ?? '');
  const flows = monthFlows(f, f.month);
  const pending = obligationViews(f).filter((o) => o.pending > 0);
  const s = summarize(f);
  const last = f.month === 3;

  return (
    <section className="closing" aria-labelledby="closing-title">
      <header className="closing-head">
        <span className="eyebrow">Cierre mensual</span>
        <h2 id="closing-title">Cierre del mes {f.month}</h2>
      </header>

      <div className="panel">
        <h3>Comprobación del saldo</h3>
        <table className="table check-table">
          <tbody>
            <tr><th scope="row">Efectivo al empezar el mes</th><td><Money v={flows.before} /></td></tr>
            <tr><th scope="row">+ Entradas del mes</th><td><Money v={flows.inflow} /></td></tr>
            <tr><th scope="row">− Salidas del mes</th><td><Money v={flows.outflow} /></td></tr>
            <tr className="total"><th scope="row">= Efectivo al cierre</th><td><Money v={flows.after} /></td></tr>
          </tbody>
        </table>
        {flows.after !== s.cash && <p className="banner banner-error">El saldo no cuadra con el registro. Avisen al facilitador.</p>}
        <MoneySummary f={f} />
      </div>

      <div className="panel">
        <h3>Lo que queda pendiente</h3>
        {pending.length === 0 ? (
          <p>No tienen obligaciones pendientes.</p>
        ) : (
          <ul className="pending-list">
            {pending.map((o) => (
              <li key={o.id}>
                <span>{o.label} <small className="muted">· mes {o.month}</small></span>
                <Money v={o.pending} />
                {!readOnly && f.phase === 'cierre_mes' && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => open({ kind: 'pagar', obligationId: o.id })}>
                    Pagar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="hint">
          Los pagos finales son opcionales. Lo pendiente pasa al mes siguiente con su mismo registro; no se crean deudas nuevas por eso.
        </p>
        {!readOnly && f.phase === 'cierre_mes' && (
          <div className="manage-row">
            <button type="button" className="btn btn-outline" onClick={() => open({ kind: 'reservar' })} disabled={s.available <= 0}>Reservar</button>
            {s.bankDebt > 0 && <button type="button" className="btn btn-outline" onClick={() => open({ kind: 'abono' })}>Abonar al crédito</button>}
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Reflexión breve</h3>
        <TextField
          label="¿Qué aprendieron este mes? ¿Qué harían distinto?"
          value={text}
          onChange={setText}
          multiline
          maxLength={2000}
        />
        {!readOnly && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ type: 'guardarReflexionMes', texto: text })}>
            Guardar reflexión
          </button>
        )}
      </div>

      {!readOnly && f.phase === 'cierre_mes' && (
        <div className="closing-confirm">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={busy}
            onClick={async () => {
              if (text !== (f.reflections.monthly[String(f.month) as '1'] ?? '')) await act({ type: 'guardarReflexionMes', texto: text });
              await act({ type: 'confirmarCierre' });
            }}
          >
            {last
              ? 'Confirmar el cierre final'
              : mode === 'aula'
                ? `Enviar el cierre al Banco para iniciar el mes ${f.month + 1}`
                : `Confirmar el cierre e iniciar el mes ${f.month + 1}`}
          </button>
          <p className="hint">
            {last ? 'Después del tercer mes no hay un cuarto ingreso.' : 'El ingreso del mes siguiente se entrega después de confirmar el cierre.'}
          </p>
        </div>
      )}
    </section>
  );
}
