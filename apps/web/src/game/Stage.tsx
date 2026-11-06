import { useState } from 'react';
import {
  BANK_PRODUCTS,
  BOARD,
  COMMITMENTS,
  DOUBLE_DIAMOND,
  MONTHLY_COMMITMENTS_TOTAL,
  MONTHLY_INCOME,
  OPPORTUNITIES,
  PERSONAL_COLORS,
  PURCHASES,
  STATIONS,
  SURPRISES,
  activeContract,
  availableOf,
  formatCOP,
  obligationViews,
  pendingRequest,
  reserveBalance,
  type FamilyState,
  type Phase,
} from '@sobrevivir/engine';
import { Die } from '../components/Die';
import { Icon } from '../components/Icons';
import { tileArtFor } from '../brand';
import { Roulette } from '../components/Roulette';
import { HelpTip, Money, TextField, useGame, useNow, waited } from '../components/ui';
import { tileHelp } from '../components/Board';
import type { DialogState } from './Dialogs';

type Open = (d: DialogState) => void;

const diamondStep = (p: Phase) =>
  p === 'resolucion' ? 1 : p === 'gestion' || p === 'esperando_validacion' ? 2 : p === 'cierre_mes' ? 3 : 0;

export function personLabel(f: FamilyState, index: number) {
  const p = f.participants[index];
  if (!p) return '';
  return p.nickname ? `${p.nickname} (${p.role})` : p.role;
}

export function DiamondStrip({ phase }: { phase: Phase }) {
  const step = diamondStep(phase);
  return (
    <ol className="diamond" aria-label="Doble Diamante">
      {DOUBLE_DIAMOND.map((d, i) => (
        <li key={d.id} className={i === step ? 'diamond-on' : ''} aria-current={i === step ? 'step' : undefined}>
          <span className="diamond-shape" aria-hidden="true" />
          {d.label}
        </li>
      ))}
    </ol>
  );
}

function TurnHeader() {
  const { family: f } = useGame();
  const spun = f.lastSpin && f.lastSpin.turn === f.turn ? f.lastSpin : undefined;
  const rolled = f.lastRoll && f.lastRoll.turn === f.turn ? f.lastRoll : undefined;
  const color = spun ? PERSONAL_COLORS[spun.sector] : undefined;
  return (
    <div className="turn-tools">
      <Roulette spin={spun} participants={f.participants} size={136} />
      <div className="turn-who">
        {spun && color ? (
          <>
            <span className="eyebrow">Lanza y mueve</span>
            <span className="who">
              <span className="swatch" style={{ background: color.hex }} aria-hidden="true" />
              <strong>{color.label}</strong>
            </span>
            <span className="who-name">{personLabel(f, spun.participantIndex)}</span>
            <small className="muted">La ruleta solo elige quién lanza. Las decisiones son de toda la familia.</small>
          </>
        ) : (
          <span className="muted">La ruleta elige a quién le toca lanzar el dado.</span>
        )}
      </div>
      <Die value={rolled?.value} rollKey={rolled ? `${rolled.turn}-${rolled.value}` : undefined} size={58} />
    </div>
  );
}

function Primary({ children, onClick, disabled, kind = 'primary' }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; kind?: string }) {
  return (
    <button type="button" className={`btn btn-${kind} btn-lg`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function ManageRow({ open }: { open: Open }) {
  const { family: f, readOnly } = useGame();
  if (readOnly) return null;
  const hasPending = obligationViews(f).some((o) => o.pending > 0);
  const debt = activeContract(f);
  return (
    <div className="manage-row" role="group" aria-label="Gestión de cuentas">
      <button type="button" className="btn btn-outline" onClick={() => open({ kind: 'pagar' })} disabled={!hasPending}>Pagar</button>
      <button type="button" className="btn btn-outline" onClick={() => open({ kind: 'reservar' })} disabled={availableOf(f) <= 0}>Reservar</button>
      <button type="button" className="btn btn-outline" onClick={() => open({ kind: 'credito' })}>Crédito</button>
      {debt && <button type="button" className="btn btn-outline" onClick={() => open({ kind: 'abono' })}>Abonar</button>}
    </div>
  );
}

function ShortOfMoney({ price, open }: { price: number; open: Open }) {
  const { family: f } = useGame();
  const avail = availableOf(f);
  if (price <= avail) return null;
  const withBalance = f.reserves.filter((r) => reserveBalance(f, r.id) > 0);
  return (
    <div className="short" role="status">
      <p>
        Les faltan <Money v={price - avail} /> disponibles. La oferta sigue abierta mientras deciden:
      </p>
      <div className="manage-row">
        {withBalance.map((r) => (
          <button key={r.id} type="button" className="btn btn-outline btn-sm" onClick={() => open({ kind: 'liberar', reserveId: r.id })}>
            Liberar «{r.label}»
          </button>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => open({ kind: 'credito' })}>Solicitar crédito</button>
      </div>
    </div>
  );
}

function PurchaseResolution({ open }: { open: Open }) {
  const { family: f, act, busy, mode, readOnly } = useGame();
  const ev = f.activeEvent!;
  const tile = BOARD[ev.tileIndex];
  const offers = (ev.offers ?? []).map((id) => PURCHASES.find((p) => p.id === id)!);
  const [pick, setPick] = useState(offers.length === 1 ? offers[0].id : '');
  const [why, setWhy] = useState('');
  const item = offers.find((o) => o.id === pick);
  const avail = availableOf(f);

  if (ev.purchasedItemId) {
    const bought = PURCHASES.find((p) => p.id === ev.purchasedItemId)!;
    return (
      <>
        <p className="result-line">
          <Icon name="check" /> Compraron <strong>{bought.label}</strong> por <Money v={bought.price} />.
        </p>
        {!readOnly && <Primary onClick={() => act({ type: 'terminarResolucion' })} disabled={busy}>Continuar a la gestión</Primary>}
      </>
    );
  }
  const intro =
    tile.kind === 'centro_comercial'
      ? 'Pueden elegir como máximo una compra o no comprar.'
      : tile.kind === 'salida_familiar'
        ? '¿Salen en familia? Máximo una opción.'
        : 'Sacaron esta tarjeta del mazo de compras. Comprar nunca es obligatorio.';
  return (
    <>
      <p>{intro}</p>
      <div className={`catalog ${offers.length > 2 ? 'catalog-grid' : ''}`} role="radiogroup" aria-label="Opciones de compra">
        {offers.map((o) => (
          <label key={o.id} className={`offer ${pick === o.id ? 'offer-on' : ''} ${o.price > avail ? 'offer-short' : ''}`}>
            <input type="radio" name="oferta" value={o.id} checked={pick === o.id} onChange={() => setPick(o.id)} disabled={readOnly} />
            <span className="offer-name">{o.label}</span>
            <Money v={o.price} className="offer-price" />
          </label>
        ))}
      </div>
      {item && <ShortOfMoney price={item.price} open={open} />}
      {!readOnly && (
        <>
          <TextField label="¿Por qué? (opcional, ayuda a conversar)" value={why} onChange={setWhy} />
          <div className="actions-stack">
            <Primary
              kind="purchase"
              disabled={!item || busy || item.price > avail}
              onClick={() => item && act({ type: 'comprar', itemId: item.id, justificacion: why || undefined })}
            >
              {item ? `${mode === 'aula' ? 'Solicitar compra' : 'Comprar'}: ${item.label} · ${formatCOP(item.price)}` : 'Elige una opción para comprar'}
            </Primary>
            <button type="button" className="btn btn-ghost btn-lg" disabled={busy} onClick={() => act({ type: 'pasarCompra', justificacion: why || undefined })}>
              No comprar
            </button>
          </div>
        </>
      )}
    </>
  );
}

function CommitmentResolution({ open }: { open: Open }) {
  const { family: f, act, busy, readOnly } = useGame();
  const concept = BOARD[f.activeEvent!.tileIndex].concept!;
  const rows = obligationViews(f).filter((o) => o.concept === concept);
  return (
    <>
      <p>
        {COMMITMENTS[concept].label} es un compromiso de <Money v={COMMITMENTS[concept].amount} /> cada mes. Existe aunque no caigan
        en esta casilla.
      </p>
      <table className="table table-compact">
        <caption className="sr-only">Obligaciones de {COMMITMENTS[concept].label} por mes</caption>
        <thead>
          <tr><th scope="col">Mes</th><th scope="col">Obligación</th><th scope="col">Pagado</th><th scope="col">Pendiente</th></tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <th scope="row">{o.month}</th>
              <td><Money v={o.original} /></td>
              <td><Money v={o.paid} /></td>
              <td className={o.pending > 0 ? 'pending' : 'ok'}>{o.pending > 0 ? <Money v={o.pending} /> : 'Pagado'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <div className="actions-stack">
          {rows.filter((o) => o.pending > 0).map((o) => (
            <div className="manage-row" key={o.id}>
              <button type="button" className="btn btn-commit" onClick={() => open({ kind: 'pagar', obligationId: o.id })}>Pagar mes {o.month}</button>
              <button type="button" className="btn btn-outline" onClick={() => open({ kind: 'reservar', obligationId: o.id })} disabled={availableOf(f) <= 0}>
                Reservar
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-lg" disabled={busy} onClick={() => act({ type: 'terminarResolucion' })}>
            {rows.some((o) => o.pending > 0) ? 'Mantener pendiente y continuar' : 'Continuar'}
          </button>
        </div>
      )}
    </>
  );
}

function SurpriseResolution({ open }: { open: Open }) {
  const { family: f, act, busy, readOnly } = useGame();
  const ev = f.activeEvent!;
  const card = SURPRISES.find((c) => c.id === ev.cardId)!;
  const ob = obligationViews(f).find((o) => o.id === ev.obligationId)!;
  return (
    <>
      <article className="card card-imprevisto">
        <span className="eyebrow">{card.kind === 'reintegro' ? 'Reintegro' : 'Imprevisto'}</span>
        <h3>{card.label}</h3>
        <p>{card.description}</p>
        <p className="card-amount"><Money v={card.amount} /></p>
        {card.kind === 'reintegro' && (
          <p className="hint">
            Simplificación del juego: se registra como reintegro pendiente de $300.000. No se descuenta del ingreso siguiente ni es un
            crédito bancario.
          </p>
        )}
      </article>
      <p className="muted">
        Pagado <Money v={ob.paid} /> · pendiente <Money v={ob.pending} />
      </p>
      {!readOnly && (
        <div className="actions-stack">
          {ob.pending > 0 && (
            <button type="button" className="btn btn-surprise btn-lg" onClick={() => open({ kind: 'pagar', obligationId: ob.id })}>
              Pagar todo o una parte
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-lg" disabled={busy} onClick={() => act({ type: 'terminarResolucion' })}>
            {ob.pending > 0 ? 'Dejar pendiente y continuar' : 'Continuar'}
          </button>
        </div>
      )}
    </>
  );
}

function OpportunityResolution() {
  const { family: f, act, busy, mode, readOnly } = useGame();
  const ev = f.activeEvent!;
  const card = OPPORTUNITIES.find((c) => c.id === ev.cardId)!;
  return (
    <>
      <article className="card card-oportunidad">
        <span className="eyebrow">Oportunidad</span>
        <h3>{card.label}</h3>
        <p>{card.description}</p>
        <p className="card-amount">+<Money v={card.amount} /></p>
      </article>
      {!readOnly &&
        (ev.collected ? (
          <Primary onClick={() => act({ type: 'terminarResolucion' })} disabled={busy}>Continuar</Primary>
        ) : (
          <Primary kind="opportunity" onClick={() => act({ type: 'cobrarOportunidad' })} disabled={busy}>
            {mode === 'aula' ? `Solicitar al Banco ${formatCOP(card.amount)}` : `Recibir ${formatCOP(card.amount)}`}
          </Primary>
        ))}
    </>
  );
}

function BankResolution({ open }: { open: Open }) {
  const { family: f, act, busy, readOnly } = useGame();
  const st = activeContract(f);
  return (
    <>
      <p>Revisen su deuda y sus alternativas. Caer en el banco no obliga a contratar.</p>
      {st ? (
        <dl className="mini-ledger">
          <div><dt>Contrato</dt><dd>{st.contract.label}{st.overdue ? ' · vencido' : ''}</dd></div>
          <div><dt>Capital pendiente</dt><dd><Money v={st.capitalPending} /></dd></div>
          <div><dt>Costo pendiente</dt><dd><Money v={st.costPending} /></dd></div>
          <div><dt>Vence</dt><dd>cierre del mes {st.contract.dueMonth}</dd></div>
        </dl>
      ) : (
        <ul className="plain-list">
          {BANK_PRODUCTS.map((p) => (
            <li key={p.id}>
              <strong>{p.label}</strong>:{' '}
              {p.tiers.map((t, i) => (
                <span key={i}>
                  {i > 0 && ' · '}recibe {formatCOP(t.principal)}, devuelve {formatCOP(t.principal + t.cost)}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="actions-stack">
          <div className="manage-row">
            {st ? (
              <button type="button" className="btn btn-bank" onClick={() => open({ kind: 'abono' })}>Abonar</button>
            ) : (
              <button type="button" className="btn btn-bank" onClick={() => open({ kind: 'credito' })}>Ver productos y contratar</button>
            )}
          </div>
          <button type="button" className="btn btn-ghost btn-lg" disabled={busy} onClick={() => act({ type: 'terminarResolucion' })}>
            Continuar sin contratar
          </button>
        </div>
      )}
    </>
  );
}

function Resolution({ open }: { open: Open }) {
  const { family: f } = useGame();
  const ev = f.activeEvent;
  if (!ev) return null;
  const tile = BOARD[ev.tileIndex];
  return (
    <section className={`resolution res-${tile.kind}`} aria-labelledby="res-title">
      <header className="res-head">
        <img className="res-art" src={tileArtFor(tile)} alt="" />
        <h2 id="res-title">{tile.label}</h2>
        <HelpTip title={tile.label}>{tileHelp(tile)}</HelpTip>
      </header>
      {tile.kind === 'compromiso' && <CommitmentResolution open={open} />}
      {tile.kind === 'imprevisto' && <SurpriseResolution open={open} />}
      {tile.kind === 'oportunidad' && <OpportunityResolution />}
      {ev.offers && <PurchaseResolution open={open} />}
      {tile.kind === 'banco' && <BankResolution open={open} />}
      {tile.kind !== 'oportunidad' && <ManageRow open={open} />}
    </section>
  );
}

function Waiting() {
  const { family: f, act, busy, readOnly } = useGame();
  const req = pendingRequest(f);
  const now = useNow();
  if (!req) return null;
  return (
    <section className="waiting" aria-live="polite">
      <span className="pulse" aria-hidden="true" />
      <h2>Esperando validación</h2>
      <p>
        <strong>{STATIONS[req.station].label}</strong> revisa: {req.actionLabel} — {req.concept}
        {req.amount > 0 && <> · <Money v={req.amount} /></>}
      </p>
      <p className="muted">
        <Icon name="reloj" size={16} /> Esperando {waited(req.createdAt, now)}. El dinero no se mueve hasta que la estación confirme.
      </p>
      {!readOnly && (
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => act({ type: 'cancelarSolicitud', requestId: req.id })}>
          Cancelar solicitud
        </button>
      )}
    </section>
  );
}

function LastRequestNotice() {
  const { family: f } = useGame();
  const last = [...f.requests].reverse().find((r) => r.status !== 'pendiente');
  if (!last || last.status !== 'rechazada' || last.turn !== f.turn) return null;
  return (
    <p className="banner banner-warn" role="status">
      {STATIONS[last.station].label} no validó «{last.concept}». {last.note}
    </p>
  );
}

export function Stage({ open }: { open: Open }) {
  const { family: f, act, busy, readOnly } = useGame();
  const [note, setNote] = useState('');
  const rolled = f.lastRoll && f.lastRoll.turn === f.turn ? f.lastRoll : undefined;
  const priorPending = obligationViews(f).filter((o) => o.pending > 0);

  let body: React.ReactNode = null;
  switch (f.phase) {
    case 'preparacion':
      body = (
        <div className="stage-block">
          <h2>Preparación</h2>
          <p>Revisen los nombres y colores de cada integrante. Cuando estén listos, comiencen.</p>
          {!readOnly && <Primary onClick={() => act({ type: 'comenzarPartida' })} disabled={busy}>Comenzar la partida</Primary>}
        </div>
      );
      break;
    case 'inicio_mes':
      body = (
        <div className="stage-block">
          <span className="eyebrow">Mes {f.month} de 3</span>
          <h2>Comienza el mes</h2>
          <p>
            Reciben <Money v={MONTHLY_INCOME} /> y aparecen los compromisos del mes: arriendo, alimentación, transporte y educación,
            por <Money v={MONTHLY_COMMITMENTS_TOTAL} />.
          </p>
          {priorPending.length > 0 && (
            <p className="muted">
              Siguen pendientes <Money v={priorPending.reduce((s, o) => s + o.pending, 0)} /> de meses o eventos anteriores.
            </p>
          )}
          <p className="prompt">{DOUBLE_DIAMOND[0].prompt}</p>
          {!readOnly && (
            <Primary onClick={() => act({ type: 'recibirIngreso' })} disabled={busy}>
              Recibir el ingreso de {formatCOP(MONTHLY_INCOME)}
            </Primary>
          )}
        </div>
      );
      break;
    case 'esperando_ruleta':
      body = (
        <div className="stage-block">
          <TurnHeader />
          {!readOnly && <Primary onClick={() => act({ type: 'girarRuleta' })} disabled={busy}>Girar la ruleta</Primary>}
          <details className="soft">
            <summary>Antes de girar: gestionar cuentas</summary>
            <ManageRow open={open} />
          </details>
        </div>
      );
      break;
    case 'esperando_dado':
      body = (
        <div className="stage-block">
          <TurnHeader />
          {!readOnly && <Primary onClick={() => act({ type: 'lanzarDado' })} disabled={busy}>Lanzar el dado</Primary>}
        </div>
      );
      break;
    case 'movimiento':
      body = (
        <div className="stage-block">
          <TurnHeader />
          {rolled && (
            <p className="result-line" aria-live="polite">
              Salió <strong>{rolled.value}</strong>.{' '}
              {rolled.reachedStart
                ? `Llegan a Inicio: se cierra el mes${rolled.discardedSteps ? ` y se descartan ${rolled.discardedSteps} ${rolled.discardedSteps === 1 ? 'paso' : 'pasos'}` : ''}.`
                : `Avanzan hasta ${BOARD[rolled.to].label}.`}
            </p>
          )}
          {!readOnly && <Primary onClick={() => act({ type: 'completarMovimiento' })} disabled={busy}>Mover la ficha</Primary>}
        </div>
      );
      break;
    case 'resolucion':
      body = <Resolution open={open} />;
      break;
    case 'esperando_validacion':
      body = <Waiting />;
      break;
    case 'gestion':
      body = (
        <div className="stage-block">
          <span className="eyebrow">Gestión de cuentas</span>
          <h2>Conversen y registren</h2>
          <p className="prompt">{DOUBLE_DIAMOND[2].prompt}</p>
          <ManageRow open={open} />
          {!readOnly && (
            <>
              <TextField label="Nota del turno (opcional): ¿qué conversaron?" value={note} onChange={setNote} multiline maxLength={400} />
              <Primary
                onClick={async () => {
                  if (await act({ type: 'finalizarTurno', nota: note || undefined })) setNote('');
                }}
                disabled={busy}
              >
                Finalizar el turno
              </Primary>
            </>
          )}
        </div>
      );
      break;
    case 'cierre_mes':
      body = (
        <div className="stage-block">
          <span className="eyebrow">Mes {f.month}</span>
          <h2>Llegaron a Inicio</h2>
          <p>Es momento del cierre mensual. Revisen el saldo y lo pendiente antes de confirmar.</p>
        </div>
      );
      break;
    case 'finalizado':
      body = (
        <div className="stage-block">
          <h2>Terminaron los tres meses</h2>
          <p>Revisen juntos la reflexión final.</p>
        </div>
      );
      break;
  }

  return (
    <div className="stage">
      <DiamondStrip phase={f.phase} />
      <LastRequestNotice />
      {body}
    </div>
  );
}
