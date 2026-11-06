import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { formatCOP, parseCOP, type FamilyCommand, type FamilyState } from '@sobrevivir/engine';
import { Icon } from './Icons';

export const Money = ({ v, className }: { v: number; className?: string }) => <span className={`money ${className ?? ''}`}>{formatCOP(v)}</span>;

export interface GameCtxValue {
  family: FamilyState;
  act: (cmd: FamilyCommand) => Promise<boolean>;
  busy: boolean;
  mode: 'local' | 'aula';
  readOnly: boolean;
  error: string | null;
  clearError: () => void;
}
export const GameCtx = createContext<GameCtxValue | null>(null);
export function useGame() {
  const v = useContext(GameCtx);
  if (!v) throw new Error('GameCtx no disponible');
  return v;
}

/** Diálogo modal accesible basado en <dialog>. */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </header>
      <div className="modal-body">
        <ErrorBanner />
        {children}
      </div>
    </dialog>
  );
}

/** Campo de pesos enteros con formato colombiano. */
export function MoneyInput({
  label,
  value,
  onChange,
  max,
  hint,
  autoFocus,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
  hint?: ReactNode;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(value ? formatCOP(value) : '');
  useEffect(() => {
    const parsed = parseCOP(text) ?? 0;
    if (parsed !== value) setText(value ? formatCOP(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => {
          const n = parseCOP(e.target.value) ?? 0;
          setText(e.target.value);
          onChange(n);
        }}
        onBlur={() => setText(value ? formatCOP(value) : '')}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <small id={`${id}-hint`} className="field-hint">
          {hint}
        </small>
      )}
      {max !== undefined && value > max && <small className="field-error">Supera el máximo de {formatCOP(max)}.</small>}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  maxLength = 280,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} value={value} placeholder={placeholder} maxLength={maxLength} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/** Ayuda contextual que se despliega solo cuando se pide. */
export function HelpTip({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="helptip">
      <button type="button" className="helptip-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Icon name="ayuda" size={18} />
        <span className="sr-only">Ayuda: {title}</span>
      </button>
      {open && (
        <span id={id} role="note" className="helptip-panel">
          <strong>{title}</strong>
          <span>{children}</span>
        </span>
      )}
    </span>
  );
}

export function ErrorBanner() {
  const ctx = useContext(GameCtx);
  if (!ctx || !ctx.error) return null;
  const { error, clearError } = ctx;
  return (
    <div className="banner banner-error" role="alert">
      <span>{error}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={clearError}>
        Entendido
      </button>
    </div>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function waited(fromIso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(fromIso).getTime()) / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${s % 60} s` : `${s} s`;
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
