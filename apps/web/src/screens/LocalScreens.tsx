import { useCallback, useEffect, useState } from 'react';
import { FAMILY_PROFILES, PHASE_LABEL, movementsToCSV, type FamilyCommand } from '@sobrevivir/engine';
import { Wordmark } from '../brand';
import { downloadText } from '../components/ui';
import { GameScreen } from '../game/GameScreen';
import { RulesHelp } from '../game/RulesHelp';
import {
  LOCAL_STORAGE_KEY,
  StaleTabError,
  applyLocal,
  createLocalGame,
  deleteLocalGame,
  hasLocalGame,
  loadLocalGame,
  setActiveFamily,
  type LocalGame,
} from '../lib/localGame';
import { go } from '../lib/router';
import { ParticipantsEditor, defaultDrafts, type ParticipantDraft } from './ParticipantsEditor';

export function LocalSetup() {
  const [selected, setSelected] = useState<number[]>([1]);
  const [drafts, setDrafts] = useState<Record<number, ParticipantDraft[]>>({});
  const [step, setStep] = useState<1 | 2>(1);
  const existing = hasLocalGame();
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].sort()));
  const draftsFor = (id: number) => drafts[id] ?? defaultDrafts();

  const start = () => {
    if (existing && !window.confirm('Ya hay una demostración guardada en este navegador. ¿Reemplazarla por una nueva?')) return;
    createLocalGame(selected.map((id) => ({ profileId: id, participants: draftsFor(id) })));
    go('/demo');
  };

  return (
    <main className="setup">
      <header className="page-head">
        <a href="#/" className="back">← Inicio</a>
        <Wordmark size="sm" />
        <h1>Preparar la demostración</h1>
        <p className="muted">La demostración se guarda en este navegador. Las estaciones se resuelven automáticamente con las mismas reglas.</p>
      </header>
      <ol className="steps" aria-label="Pasos">
        <li aria-current={step === 1 ? 'step' : undefined}>1. Familias</li>
        <li aria-current={step === 2 ? 'step' : undefined}>2. Integrantes y reglas</li>
      </ol>

      {step === 1 && (
        <>
          <fieldset className="family-pick">
            <legend>¿Con qué familias quieren jugar?</legend>
            {FAMILY_PROFILES.map((p) => (
              <label key={p.id} className={`family-card ${selected.includes(p.id) ? 'family-card-on' : ''}`}>
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                <span className="family-num">Familia {p.id}</span>
                <span className="family-name">{p.name}</span>
                <span className="family-summary">{p.summary}</span>
                <span className="family-roles">{p.roles.join(' · ')}</span>
              </label>
            ))}
          </fieldset>
          <p className="hint">Todas las familias reciben el mismo ingreso. Los roles aportan perspectivas para conversar; no cambian las reglas económicas.</p>
          <div className="actions">
            <button type="button" className="btn btn-primary btn-lg" disabled={selected.length === 0} onClick={() => setStep(2)}>
              Continuar con {selected.length} {selected.length === 1 ? 'familia' : 'familias'}
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          {selected.map((id) => {
            const p = FAMILY_PROFILES.find((x) => x.id === id)!;
            return (
              <section className="panel" key={id}>
                <h2 className="panel-title">Familia {id} — {p.name}</h2>
                <ParticipantsEditor roles={p.roles} value={draftsFor(id)} onChange={(v) => setDrafts({ ...drafts, [id]: v })} idPrefix={`f${id}`} />
              </section>
            );
          })}
          <section className="panel">
            <h2 className="panel-title">Reglas esenciales</h2>
            <RulesHelp essentialOnly />
          </section>
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>Volver</button>
            <button type="button" className="btn btn-primary btn-lg" onClick={start}>Comenzar la demostración</button>
          </div>
        </>
      )}
    </main>
  );
}

export function LocalGameView() {
  const [game, setGame] = useState<LocalGame | null>(() => loadLocalGame());
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY) setStale(true);
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  const dispatch = useCallback(
    async (cmd: FamilyCommand) => {
      if (!game) return;
      try {
        setGame(applyLocal(game, game.activeFamilyId, cmd));
      } catch (e) {
        if (e instanceof StaleTabError) setStale(true);
        throw e;
      }
    },
    [game],
  );

  if (!game) {
    return (
      <main className="setup">
        <h1>No hay una demostración guardada</h1>
        <p>
          <a href="#/demo/preparar">Crear una demostración</a> o <a href="#/">volver al inicio</a>.
        </p>
      </main>
    );
  }
  const family = game.families.find((f) => f.id === game.activeFamilyId) ?? game.families[0];

  return (
    <main className="play">
      <div className="topbar">
        <a href="#/" className="back">← Inicio</a>
        <Wordmark size="sm" />
        <span className="badge-local" title="Sin sincronización entre dispositivos">Demostración local · guardada en este navegador</span>
      </div>
      {stale && (
        <div className="banner banner-warn" role="alert">
          La partida cambió en otra pestaña. Para evitar sobrescribirla, recarga esta pestaña.
          <button type="button" className="btn btn-sm btn-primary" onClick={() => window.location.reload()}>Recargar</button>
        </div>
      )}
      {game.families.length > 1 && (
        <nav className="family-switch" aria-label="Familias de la demostración">
          {game.families.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={f.id === family.id}
              onClick={() => {
                try {
                  setGame(setActiveFamily(game, f.id));
                } catch {
                  setStale(true);
                }
              }}
            >
              <strong>{f.name}</strong>
              <small>Mes {f.month} · {PHASE_LABEL[f.phase]}</small>
            </button>
          ))}
        </nav>
      )}
      <GameScreen key={family.id} family={family} dispatch={dispatch} mode="local" readOnly={stale} />
      <footer className="play-foot no-print">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText('movimientos-demostracion.csv', movementsToCSV(game.families))}>
          Exportar todas las familias (CSV)
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (window.confirm('¿Borrar la demostración guardada en este navegador? No se puede deshacer.')) {
              deleteLocalGame();
              go('/');
            }
          }}
        >
          Borrar demostración
        </button>
      </footer>
    </main>
  );
}
