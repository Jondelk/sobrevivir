import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FAMILY_PROFILES, PERSONAL_COLORS, PHASE_LABEL, RuleError, type FamilyCommand, type FamilyState } from '@sobrevivir/engine';
import { Board } from '../components/Board';
import { markPresentOnLoad } from '../components/CardFlip';
import { ErrorBanner, GameCtx, type GameCtxValue } from '../components/ui';
import { useMediaQuery } from '../lib/router';
import { Accounts, MoneySummary } from './Accounts';
import { Closing } from './Closing';
import { DialogHost, type DialogState } from './Dialogs';
import { FinalReflection } from './FinalReflection';
import { RulesHelp } from './RulesHelp';
import { Stage } from './Stage';

type View = 'tablero' | 'cuentas' | 'cierre' | 'final' | 'ayuda';

export interface GameScreenProps {
  family: FamilyState;
  dispatch: (cmd: FamilyCommand) => Promise<unknown>;
  mode: 'local' | 'aula';
  readOnly?: boolean;
  topSlot?: ReactNode;
}

function Participants({ f }: { f: FamilyState }) {
  const current = f.lastSpin && f.lastSpin.turn === f.turn ? f.lastSpin.participantIndex : -1;
  return (
    <ul className="participants" aria-label="Integrantes de la familia">
      {f.participants.map((p, i) => {
        const c = PERSONAL_COLORS.find((x) => x.id === p.colorId)!;
        return (
          <li key={i} className={i === current ? 'participant-on' : ''}>
            <span className="swatch" style={{ background: c.hex }} aria-hidden="true" />
            <span className="participant-color">{c.label}</span>
            <span className="participant-name">
              {p.nickname && <strong>{p.nickname}</strong>} <span className="muted">{p.role}</span>
            </span>
            {i === current && <span className="sr-only">(le toca lanzar)</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function GameScreen({ family: f, dispatch, mode, readOnly = false, topSlot }: GameScreenProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [view, setView] = useState<View>(f.phase === 'finalizado' ? 'final' : f.phase === 'cierre_mes' ? 'cierre' : 'tablero');
  const [boardOpen, setBoardOpen] = useState(false);
  const mobile = useMediaQuery('(max-width: 860px)');
  const busyRef = useRef(false);
  const prevPhase = useRef(f.phase);
  const loadedRef = useRef(false);
  if (!loadedRef.current) {
    // Una tarjeta que ya estaba activa al abrir o recargar la página se muestra volteada, sin animación.
    loadedRef.current = true;
    markPresentOnLoad(f.activeEvent?.eventId);
  }

  useEffect(() => {
    if (prevPhase.current !== f.phase) {
      if (f.phase === 'cierre_mes') setView('cierre');
      else if (f.phase === 'finalizado') setView('final');
      else if (prevPhase.current === 'cierre_mes' || prevPhase.current === 'esperando_validacion') {
        if (f.phase === 'inicio_mes') setView('tablero');
      }
      prevPhase.current = f.phase;
    }
  }, [f.phase]);

  const act = useCallback(
    async (cmd: FamilyCommand) => {
      if (busyRef.current || readOnly) return false; // bloquea dobles clics
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        await dispatch(cmd);
        return true;
      } catch (e) {
        setError(e instanceof RuleError || e instanceof Error ? e.message : 'No se pudo completar la acción.');
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [dispatch, readOnly],
  );

  const ctx: GameCtxValue = useMemo(
    () => ({ family: f, act, busy, mode, readOnly, error, clearError: () => setError(null) }),
    [f, act, busy, mode, readOnly, error],
  );
  const profile = FAMILY_PROFILES.find((p) => p.id === f.profileId)!;
  const tokenColor = f.lastSpin ? PERSONAL_COLORS[f.lastSpin.sector].hex : undefined;
  const activeIndex = f.activeEvent?.tileIndex ?? null;

  const tabs: { id: View; label: string; show: boolean }[] = [
    { id: 'tablero', label: 'Tablero', show: true },
    { id: 'cuentas', label: 'Mis cuentas', show: true },
    { id: 'cierre', label: 'Cierre del mes', show: f.phase === 'cierre_mes' || (f.phase === 'esperando_validacion' && f.phaseBeforeValidation === 'cierre_mes') },
    { id: 'final', label: 'Reflexión final', show: f.phase === 'finalizado' },
    { id: 'ayuda', label: 'Reglas', show: true },
  ];

  const open = (d: DialogState) => {
    setError(null);
    setDialog(d);
  };

  const boardEl = (
    <Board position={f.position} familyLabel={f.name} activeIndex={activeIndex} tokenColor={tokenColor} compact={mobile}>
      {!mobile && <Stage open={open} />}
    </Board>
  );

  return (
    <GameCtx.Provider value={ctx}>
      <div className="game" data-phase={f.phase} data-testid="game">
        <header className="game-head">
          <div className="game-title">
            <h1>
              {f.name} <span className="muted">· {profile.name}</span>
            </h1>
            <p className="status-line">
              <span className="chip chip-month">Mes {f.month} de 3</span>
              <span className="chip">Turno {f.turn}</span>
              <span className="chip chip-phase" data-testid="phase">{PHASE_LABEL[f.phase]}</span>
              {readOnly && <span className="chip chip-imprevisto">Solo lectura</span>}
            </p>
          </div>
          {topSlot}
        </header>

        <nav className="tabs" role="tablist" aria-label="Secciones del juego">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={view === t.id} className="tab" onClick={() => setView(t.id)}>
                {t.label}
              </button>
            ))}
        </nav>

        <ErrorBanner />

        {view === 'tablero' && (
          <div className="game-layout">
            {mobile ? (
              <div className="mobile-stack">
                <Stage open={open} />
                <MoneySummary f={f} compact />
                <button type="button" className="btn btn-outline" aria-expanded={boardOpen} onClick={() => setBoardOpen(!boardOpen)}>
                  {boardOpen ? 'Ocultar el tablero' : 'Ver el tablero completo'}
                </button>
                {boardOpen && boardEl}
                <details className="soft">
                  <summary>Integrantes</summary>
                  <Participants f={f} />
                </details>
              </div>
            ) : (
              <>
                <div className="board-col">{boardEl}</div>
                <aside className="side" aria-label="Resumen familiar">
                  <section className="panel">
                    <h2 className="panel-title">Integrantes</h2>
                    <Participants f={f} />
                  </section>
                  <section className="panel">
                    <h2 className="panel-title">Dinero de la familia</h2>
                    <MoneySummary f={f} compact />
                    <button type="button" className="btn btn-outline btn-block" onClick={() => setView('cuentas')}>
                      Mis cuentas y registro
                    </button>
                  </section>
                </aside>
              </>
            )}
          </div>
        )}
        {view === 'cuentas' && <Accounts open={open} />}
        {view === 'cierre' && <Closing open={open} />}
        {view === 'final' && <FinalReflection />}
        {view === 'ayuda' && (
          <section className="panel">
            <h2>Reglas del juego</h2>
            <RulesHelp />
          </section>
        )}
        <DialogHost dialog={dialog} close={() => setDialog(null)} />
      </div>
    </GameCtx.Provider>
  );
}
