import { useState } from 'react';
import {
  CARD_CATEGORIES,
  FAMILY_PROFILES,
  OPPORTUNITIES,
  PURCHASES,
  formatCOP,
  REFLECTION_QUESTIONS,
  movementsToCSV,
  obligationViews,
  summarize,
  type FamilyState,
} from '@sobrevivir/engine';
import { Money, downloadText, useGame } from '../components/ui';
import { Wordmark } from '../brand';
import { monthFlows } from './Closing';

export function DecisionSummary({ f }: { f: FamilyState }) {
  const purchases = f.movements.filter((m) => m.type === 'compra');
  const passes = f.decisions.filter((d) => d.type === 'pasar_compra');
  const credits = f.decisions.filter((d) => d.type === 'credito');
  const notes = f.decisions.filter((d) => d.type === 'nota_turno');
  const surprises = obligationViews(f).filter((o) => o.kind !== 'compromiso');
  const opportunities = f.movements.filter((m) => m.type === 'oportunidad');
  return (
    <div className="decisions">
      <div className="decision-groups">
        <section className="decision-group decision-tentacion">
          <h4>{CARD_CATEGORIES.tentacion.label}: lo que decidieron comprar</h4>
          <ul className="plain-list">
            <li>
              Compraron:{' '}
              {purchases.length === 0
                ? 'nada'
                : purchases.map((m) => `${PURCHASES.find((p) => p.id === m.ref.itemId)?.label} (${formatCOP(m.amount)}, mes ${m.month})`).join(', ')}
              .
            </li>
            <li>Decidieron no comprar {passes.length} {passes.length === 1 ? 'vez' : 'veces'}.</li>
          </ul>
        </section>
        <section className="decision-group decision-imprevisto">
          <h4>{CARD_CATEGORIES.imprevisto.label}: lo que les ocurrió</h4>
          {surprises.length === 0 ? (
            <p>No aparecieron imprevistos.</p>
          ) : (
            <ul className="plain-list">
              {surprises.map((o) => (
                <li key={o.id}>
                  {o.label} (mes {o.month}, {formatCOP(o.original)}): pagado {formatCOP(o.paid)}
                  {o.pending > 0 ? `, pendiente ${formatCOP(o.pending)}` : ''}.
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="decision-group decision-oportunidad">
          <h4>{CARD_CATEGORIES.oportunidad.label}: lo que aprovecharon</h4>
          {opportunities.length === 0 ? (
            <p>No aparecieron oportunidades.</p>
          ) : (
            <ul className="plain-list">
              {opportunities.map((m) => (
                <li key={m.id}>
                  {OPPORTUNITIES.find((o) => o.id === m.ref.cardId)?.label ?? m.description} (mes {m.month}): +{formatCOP(m.amount)}.
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p>Créditos: {credits.length === 0 ? 'ninguno.' : credits.map((c) => c.text).join(' ')}</p>
      {notes.length > 0 && (
        <>
          <h4>Notas de los turnos</h4>
          <ul className="plain-list">
            {notes.map((n) => (
              <li key={n.id}>
                <small className="muted">Mes {n.month}, turno {n.turn}:</small> {n.text}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function FinalReflection() {
  const { family: f, act, busy, readOnly } = useGame();
  const s = summarize(f);
  const profile = FAMILY_PROFILES.find((p) => p.id === f.profileId)!;
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...f.reflections.final }));
  const pending = obligationViews(f).filter((o) => o.pending > 0);
  const [saved, setSaved] = useState(false);

  return (
    <section className="final" aria-labelledby="final-title">
      <header className="closing-head">
        <span className="final-logo"><Wordmark size="md" /></span>
        <span className="eyebrow">Reflexión final · {f.name}</span>
        <h2 id="final-title">¿Cómo terminó el trimestre?</h2>
        <p className="muted">{profile.name}. Aquí no hay ganadores ni perdedores: el dinero final se lee junto con lo pendiente y las decisiones.</p>
      </header>

      <div className="panel">
        <h3>Balance</h3>
        <dl className="mini-ledger mini-ledger-wide">
          <div><dt>Efectivo al final</dt><dd><Money v={s.cash} /></dd></div>
          <div><dt>De ese efectivo, reservado</dt><dd><Money v={s.reserves} /></dd></div>
          <div><dt>Obligaciones pendientes</dt><dd><Money v={s.commitmentsPending + s.surprisesPending} /></dd></div>
          <div><dt>Deuda bancaria</dt><dd><Money v={s.bankDebt} /></dd></div>
          <div><dt>Entradas totales</dt><dd><Money v={s.totalIn} /></dd></div>
          <div><dt>Salidas totales</dt><dd><Money v={s.totalOut} /></dd></div>
        </dl>
        <p>
          Comprobación: <Money v={s.totalIn} /> de entradas − <Money v={s.totalOut} /> de salidas = <Money v={s.cash} />.
        </p>
        <table className="table">
          <caption>Mes a mes</caption>
          <thead><tr><th scope="col">Mes</th><th scope="col">Inicio</th><th scope="col">Entradas</th><th scope="col">Salidas</th><th scope="col">Cierre</th></tr></thead>
          <tbody>
            {[1, 2, 3].map((m) => {
              const fl = monthFlows(f, m);
              return (
                <tr key={m}><th scope="row">{m}</th><td><Money v={fl.before} /></td><td><Money v={fl.inflow} /></td><td><Money v={fl.outflow} /></td><td><Money v={fl.after} /></td></tr>
              );
            })}
          </tbody>
        </table>
        {pending.length > 0 && (
          <p className="muted">Quedó pendiente: {pending.map((o) => `${o.label} (mes ${o.month})`).join(', ')}.</p>
        )}
      </div>

      <div className="panel">
        <h3>Resumen de decisiones</h3>
        <DecisionSummary f={f} />
      </div>

      <div className="panel">
        <h3>Conversación</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act({ type: 'guardarReflexionFinal', respuestas: answers })) setSaved(true);
          }}
        >
          {REFLECTION_QUESTIONS.map((q, i) => (
            <div className={`field ${i === 0 ? 'field-main-question' : ''}`} key={q.id}>
              <label htmlFor={`q-${q.id}`}>{q.text}</label>
              <textarea
                id={`q-${q.id}`}
                rows={i === 0 ? 4 : 2}
                maxLength={2000}
                value={answers[q.id] ?? ''}
                readOnly={readOnly}
                onChange={(e) => {
                  setSaved(false);
                  setAnswers({ ...answers, [q.id]: e.target.value });
                }}
              />
            </div>
          ))}
          {!readOnly && (
            <div className="actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>Guardar respuestas</button>
              {saved && <span role="status" className="ok">Respuestas guardadas.</span>}
            </div>
          )}
        </form>
      </div>

      <div className="actions no-print">
        <button type="button" className="btn btn-outline" onClick={() => downloadText(`movimientos-${f.id}.csv`, movementsToCSV([f]))}>
          Exportar movimientos (CSV)
        </button>
        <button type="button" className="btn btn-outline" onClick={() => window.print()}>Imprimir resumen</button>
      </div>
    </section>
  );
}
