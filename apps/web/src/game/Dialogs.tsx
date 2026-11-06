import { useState } from 'react';
import {
  BANK_PRODUCTS,
  activeContract,
  availableOf,
  cashOf,
  contractDueMonth,
  formatCOP,
  obligationViews,
  reserveBalance,
  type BankProduct,
} from '@sobrevivir/engine';
import { Modal, Money, MoneyInput, TextField, useGame } from '../components/ui';

function ReserveSourcePicker({ value, onChange, preferFor }: { value: string; onChange: (v: string) => void; preferFor?: string }) {
  const { family } = useGame();
  const reserves = family.reserves.map((r) => ({ r, bal: reserveBalance(family, r.id) })).filter((x) => x.bal > 0);
  return (
    <fieldset className="field">
      <legend>¿De dónde sale el dinero?</legend>
      <label className="radio">
        <input type="radio" name="fuente" checked={value === ''} onChange={() => onChange('')} />
        Dinero disponible sin reservar · <Money v={availableOf(family)} />
      </label>
      {reserves.map(({ r, bal }) => (
        <label className="radio" key={r.id}>
          <input type="radio" name="fuente" checked={value === r.id} onChange={() => onChange(r.id)} />
          Reserva «{r.label}» · <Money v={bal} />
          {preferFor && r.obligationId === preferFor && <span className="chip chip-inicio">asociada</span>}
        </label>
      ))}
    </fieldset>
  );
}

export function PayDialog({ obligationId, onClose }: { obligationId?: string; onClose: () => void }) {
  const { family, act, busy, mode } = useGame();
  const pendingList = obligationViews(family).filter((o) => o.pending > 0);
  const [oid, setOid] = useState(obligationId ?? pendingList[0]?.id ?? '');
  const ob = pendingList.find((o) => o.id === oid);
  const linked = family.reserves.find((r) => r.obligationId === oid && reserveBalance(family, r.id) > 0);
  const [source, setSource] = useState(linked?.id ?? '');
  const [amount, setAmount] = useState(ob?.pending ?? 0);
  const [why, setWhy] = useState('');
  const limit = source ? reserveBalance(family, source) : availableOf(family);
  const valid = ob && amount > 0 && amount <= ob.pending && amount <= limit;

  return (
    <Modal title="Pagar una obligación" onClose={onClose}>
      {pendingList.length === 0 ? (
        <p>No hay obligaciones pendientes.</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            const ok = await act({ type: 'pagarObligacion', obligationId: oid, amount, reserveId: source || undefined, justificacion: why || undefined });
            if (ok) onClose();
          }}
        >
          <div className="field">
            <label htmlFor="pay-ob">Obligación</label>
            <select
              id="pay-ob"
              value={oid}
              onChange={(e) => {
                setOid(e.target.value);
                const next = pendingList.find((o) => o.id === e.target.value);
                setAmount(next?.pending ?? 0);
                const r = family.reserves.find((x) => x.obligationId === e.target.value && reserveBalance(family, x.id) > 0);
                setSource(r?.id ?? '');
              }}
            >
              {pendingList.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} · mes {o.month} · pendiente {formatCOP(o.pending)}
                </option>
              ))}
            </select>
          </div>
          {ob && (
            <dl className="mini-ledger">
              <div><dt>Importe original</dt><dd><Money v={ob.original} /></dd></div>
              <div><dt>Pagado</dt><dd><Money v={ob.paid} /></dd></div>
              <div><dt>Pendiente</dt><dd><Money v={ob.pending} /></dd></div>
            </dl>
          )}
          <ReserveSourcePicker value={source} onChange={setSource} preferFor={oid} />
          <MoneyInput label="Importe a pagar" value={amount} onChange={setAmount} max={Math.min(ob?.pending ?? 0, limit)} autoFocus />
          <div className="quick">
            {ob && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAmount(Math.min(ob.pending, limit))}>
                {ob.pending <= limit ? 'Todo lo pendiente' : 'Todo lo que alcanza'}
              </button>
            )}
          </div>
          <TextField label="¿Por qué esta decisión? (opcional)" value={why} onChange={setWhy} />
          {ob && valid && (
            <p className="preview">
              Quedará pendiente <Money v={ob.pending - amount} />. Efectivo después del pago: <Money v={cashOf(family) - amount} />.
            </p>
          )}
          {mode === 'aula' && <p className="hint">La estación correspondiente validará el pago antes de descontarlo.</p>}
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!valid || busy}>
              {mode === 'aula' ? 'Enviar a validación' : 'Pagar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function ReserveDialog({ obligationId, onClose }: { obligationId?: string; onClose: () => void }) {
  const { family, act, busy } = useGame();
  const avail = availableOf(family);
  const pendingList = obligationViews(family).filter((o) => o.pending > 0);
  const [oid, setOid] = useState(obligationId ?? '');
  const ob = pendingList.find((o) => o.id === oid);
  const [amount, setAmount] = useState(Math.min(ob?.pending ?? 0, avail));
  const [label, setLabel] = useState(ob ? ob.label : '');
  const valid = amount > 0 && amount <= avail;
  return (
    <Modal title="Reservar dinero" onClose={onClose}>
      <p className="hint">
        Reservar separa dinero para algo importante. No es un gasto, no paga la obligación y no aumenta el efectivo:
        solo reduce el dinero disponible. Puede liberarse después.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          const ok = await act({ type: 'reservar', amount, label: label || ob?.label || 'Reserva', obligationId: oid || undefined });
          if (ok) onClose();
        }}
      >
        <div className="field">
          <label htmlFor="res-ob">¿Para qué? (opcional)</label>
          <select
            id="res-ob"
            value={oid}
            onChange={(e) => {
              setOid(e.target.value);
              const o = pendingList.find((x) => x.id === e.target.value);
              if (o) {
                setLabel(o.label);
                setAmount(Math.min(o.pending, avail));
              }
            }}
          >
            <option value="">Sin asociar a una obligación</option>
            {pendingList.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} · mes {o.month} · pendiente {formatCOP(o.pending)}
              </option>
            ))}
          </select>
        </div>
        <TextField label="Nombre de la reserva" value={label} onChange={setLabel} placeholder="Ej.: Arriendo del próximo mes" maxLength={60} />
        <MoneyInput label="Importe a reservar" value={amount} onChange={setAmount} max={avail} hint={<>Disponible para reservar: {formatCOP(avail)}</>} />
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!valid || busy}>Reservar</button>
        </div>
      </form>
    </Modal>
  );
}

export function ReleaseDialog({ reserveId, onClose }: { reserveId: string; onClose: () => void }) {
  const { family, act, busy } = useGame();
  const r = family.reserves.find((x) => x.id === reserveId)!;
  const bal = reserveBalance(family, reserveId);
  const [amount, setAmount] = useState(bal);
  return (
    <Modal title={`Liberar «${r.label}»`} onClose={onClose}>
      <p className="hint">Liberar una reserva no es un ingreso: el efectivo sigue igual y el dinero vuelve a estar disponible.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act({ type: 'liberarReserva', reserveId, amount })) onClose();
        }}
      >
        <MoneyInput label="Importe a liberar" value={amount} onChange={setAmount} max={bal} autoFocus />
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy || amount <= 0 || amount > bal}>Liberar</button>
        </div>
      </form>
    </Modal>
  );
}

export function CreditDialog({ onClose }: { onClose: () => void }) {
  const { family, act, busy, mode } = useGame();
  const active = activeContract(family);
  const [sel, setSel] = useState<{ p: BankProduct['id']; t: number }>({ p: 'prestamo_pequeno', t: 0 });
  const [why, setWhy] = useState('');
  const product = BANK_PRODUCTS.find((p) => p.id === sel.p)!;
  const tier = product.tiers[sel.t];
  const due = contractDueMonth(family.month);
  return (
    <Modal title="Solicitar crédito" onClose={onClose} wide>
      {active ? (
        <>
          <p>
            Ya tienen un contrato activo: <strong>{active.contract.label}</strong> con saldo de <Money v={active.balance} />
            {active.overdue ? ' (vencido)' : ''}. Para contratar otro, primero deben cancelarlo por completo.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>Entendido</button>
          </div>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act({ type: 'contratarCredito', productId: sel.p, tierIndex: sel.t, justificacion: why || undefined })) onClose();
          }}
        >
          <fieldset className="products">
            <legend>Productos del banco</legend>
            {BANK_PRODUCTS.flatMap((p) =>
              p.tiers.map((t, i) => (
                <label key={`${p.id}-${i}`} className={`product ${sel.p === p.id && sel.t === i ? 'product-on' : ''}`}>
                  <input type="radio" name="producto" checked={sel.p === p.id && sel.t === i} onChange={() => setSel({ p: p.id, t: i })} />
                  <span className="product-name">{p.label}{p.tiers.length > 1 ? ` · tramo ${i + 1}` : ''}</span>
                  <span className="product-terms">
                    Recibe <Money v={t.principal} /> · cuesta <Money v={t.cost} /> · devuelve <Money v={t.principal + t.cost} />
                  </span>
                </label>
              )),
            )}
          </fieldset>
          <div className="confirm-box" aria-live="polite">
            <p><strong>{product.label}</strong></p>
            <dl className="mini-ledger">
              <div><dt>Reciben hoy</dt><dd><Money v={tier.principal} /></dd></div>
              <div><dt>Costo (una sola vez)</dt><dd><Money v={tier.cost} /></dd></div>
              <div><dt>Deben devolver</dt><dd><Money v={tier.principal + tier.cost} /></dd></div>
              <div><dt>Vence</dt><dd>al cierre del mes {due}</dd></div>
            </dl>
            <p className="hint">{product.description} Sin intereses compuestos ni multas. Los abonos van primero a capital y luego al costo; pagar antes no cambia el costo.</p>
          </div>
          <TextField label="¿Para qué lo necesitan? (opcional)" value={why} onChange={setWhy} />
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-bank" disabled={busy}>
              {mode === 'aula' ? 'Enviar al Banco' : `Contratar y recibir ${formatCOP(tier.principal)}`}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function AbonoDialog({ onClose }: { onClose: () => void }) {
  const { family, act, busy, mode } = useGame();
  const active = activeContract(family);
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState(active ? Math.min(active.balance, availableOf(family)) : 0);
  if (!active)
    return (
      <Modal title="Abonar al crédito" onClose={onClose}>
        <p>No tienen deuda bancaria pendiente.</p>
      </Modal>
    );
  const limit = source ? reserveBalance(family, source) : availableOf(family);
  const toCap = Math.min(amount, active.capitalPending);
  const toCost = Math.min(Math.max(0, amount - toCap), active.costPending);
  const valid = amount > 0 && amount <= active.balance && amount <= limit;
  return (
    <Modal title={`Abonar a ${active.contract.label}`} onClose={onClose}>
      <dl className="mini-ledger">
        <div><dt>Capital pendiente</dt><dd><Money v={active.capitalPending} /></dd></div>
        <div><dt>Costo pendiente</dt><dd><Money v={active.costPending} /></dd></div>
        <div><dt>Deuda total</dt><dd><Money v={active.balance} /></dd></div>
      </dl>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (valid && (await act({ type: 'abonarCredito', amount, reserveId: source || undefined }))) onClose();
        }}
      >
        <ReserveSourcePicker value={source} onChange={setSource} />
        <MoneyInput label="Importe del abono" value={amount} onChange={setAmount} max={Math.min(active.balance, limit)} autoFocus />
        {valid && (
          <p className="preview">
            Se aplicará <Money v={toCap} /> a capital y <Money v={toCost} /> al costo.
          </p>
        )}
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-bank" disabled={!valid || busy}>{mode === 'aula' ? 'Enviar al Banco' : 'Abonar'}</button>
        </div>
      </form>
    </Modal>
  );
}

export type DialogState =
  | { kind: 'pagar'; obligationId?: string }
  | { kind: 'reservar'; obligationId?: string }
  | { kind: 'liberar'; reserveId: string }
  | { kind: 'credito' }
  | { kind: 'abono' }
  | null;

export function DialogHost({ dialog, close }: { dialog: DialogState; close: () => void }) {
  if (!dialog) return null;
  switch (dialog.kind) {
    case 'pagar':
      return <PayDialog obligationId={dialog.obligationId} onClose={close} />;
    case 'reservar':
      return <ReserveDialog obligationId={dialog.obligationId} onClose={close} />;
    case 'liberar':
      return <ReleaseDialog reserveId={dialog.reserveId} onClose={close} />;
    case 'credito':
      return <CreditDialog onClose={close} />;
    case 'abono':
      return <AbonoDialog onClose={close} />;
  }
}
