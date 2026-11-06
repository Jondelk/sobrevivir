import { useEffect, useMemo, useState } from 'react';
import {
  BOARD,
  FAMILY_PROFILES,
  OBSERVATION_CRITERIA,
  PHASE_LABEL,
  STATIONS,
  STATION_IDS,
  availableOf,
  formatCOP,
  movementsToCSV,
  reserveBalance,
  summarize,
  type FamilyCommand,
  type FamilyState,
  type StationId,
  type ValidationRequest,
} from '@sobrevivir/engine';
import { Wordmark } from '../brand';
import { Money, downloadText, useNow, waited } from '../components/ui';
import { History } from '../game/Accounts';
import { GameScreen } from '../game/GameScreen';
import { DecisionSummary } from '../game/FinalReflection';
import {
  ApiError,
  accessLink,
  api,
  fetchHealth,
  findAccess,
  getRoomKeys,
  saveAccess,
  saveRoomKeys,
  useRoom,
  type ConnectionState,
  type Health,
  type Session,
  type Snapshot,
} from '../lib/remote';
import { go } from '../lib/router';
import { ParticipantsEditor, type ParticipantDraft } from './ParticipantsEditor';

const routeFor = (code: string, s: Session) =>
  s.role === 'facilitador' ? `/sala/${code}/facilitador` : s.role === 'familia' ? `/sala/${code}/familia` : `/sala/${code}/estacion`;

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  const label = { conectando: 'Conectando…', conectado: 'Conectado', reconectando: 'Reconectando…', desconectado: 'Sin conexión' }[state];
  return (
    <span className={`conn conn-${state}`} role="status" aria-live="polite">
      <span className="conn-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function NeedsServer({ health }: { health: Health | null }) {
  return (
    <div className="banner banner-warn" role="alert">
      <div>
        <strong>El modo conectado no está disponible.</strong>
        <p>
          {health === null
            ? 'No se encontró el servidor de la aplicación. Inícielo con «npm run start» (ver README).'
            : health.message ?? 'El servidor no tiene MongoDB configurado.'}
        </p>
        <p>La demostración local funciona sin servidor, pero no sincroniza dispositivos.</p>
      </div>
    </div>
  );
}

export function CreateRoom() {
  const [health, setHealth] = useState<Health | null | undefined>(undefined);
  const [selected, setSelected] = useState<number[]>(FAMILY_PROFILES.map((p) => p.id));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetchHealth().then(setHealth);
  }, []);
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ code: string; keys: { facilitador: string; familias: Record<string, string>; estaciones: Record<string, string> } }>(
        'POST',
        '/api/rooms',
        { families: selected },
      );
      saveRoomKeys({ code: r.code, keys: r.keys });
      saveAccess({ code: r.code, key: r.keys.facilitador, session: { role: 'facilitador', label: 'Facilitador' }, savedAt: new Date().toISOString() });
      go(`/sala/${r.code}/facilitador`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="setup">
      <header className="page-head">
        <a href="#/" className="back">← Inicio</a>
        <Wordmark size="sm" />
        <h1>Crear una sala de aula</h1>
        <p className="muted">
          Seis familias de cinco personas y cuatro estaciones. Cada familia juega en su dispositivo; cada estación valida sus operaciones.
        </p>
      </header>
      {health === undefined && <p>Comprobando el servidor…</p>}
      {health !== undefined && (!health || !health.connectedMode) && <NeedsServer health={health} />}
      {health?.store === 'memoria-pruebas' && (
        <p className="banner banner-warn">Servidor en modo de pruebas: los datos se pierden al reiniciar. No usar en una sesión real.</p>
      )}
      {health?.connectedMode && (
        <>
          <fieldset className="family-pick">
            <legend>Familias de la sesión</legend>
            {FAMILY_PROFILES.map((p) => (
              <label key={p.id} className={`family-card ${selected.includes(p.id) ? 'family-card-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id].sort()))}
                />
                <span className="family-num">Familia {p.id}</span>
                <span className="family-name">{p.name}</span>
                <span className="family-roles">{p.roles.join(' · ')}</span>
              </label>
            ))}
          </fieldset>
          {error && <p className="banner banner-error" role="alert">{error}</p>}
          <div className="actions">
            <button type="button" className="btn btn-primary btn-lg" disabled={busy || selected.length === 0} onClick={create}>
              Crear sala
            </button>
          </div>
        </>
      )}
    </main>
  );
}

async function enter(code: string, key: string) {
  const r = await api<{ code: string; session: Session }>('POST', `/api/rooms/${code.trim().toUpperCase()}/session`, { key: key.trim().toUpperCase() });
  saveAccess({ code: r.code, key: key.trim().toUpperCase(), session: r.session, savedAt: new Date().toISOString() });
  go(routeFor(r.code, r.session));
}

export function Join() {
  const [code, setCode] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="setup narrow">
      <header className="page-head">
        <a href="#/" className="back">← Inicio</a>
        <Wordmark size="sm" />
        <h1>Unirse a una sala</h1>
        <p className="muted">El código de la sala es público; la clave privada indica si entras como familia o estación.</p>
      </header>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await enter(code, key);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <label htmlFor="join-code">Código de la sala</label>
          <input id="join-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" maxLength={8} required />
        </div>
        <div className="field">
          <label htmlFor="join-key">Clave de acceso</label>
          <input id="join-key" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} autoComplete="off" maxLength={64} required />
        </div>
        {error && <p className="banner banner-error" role="alert">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>Entrar</button>
        </div>
      </form>
    </main>
  );
}

export function AccessLink({ code, keyParam }: { code: string; keyParam: string }) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    enter(code, keyParam).catch((e) => setError((e as Error).message));
  }, [code, keyParam]);
  return (
    <main className="setup narrow">
      {error ? (
        <>
          <h1>No se pudo entrar</h1>
          <p className="banner banner-error" role="alert">{error}</p>
          <a href="#/unirse">Intentar con el código y la clave</a>
        </>
      ) : (
        <p>Entrando a la sala {code}…</p>
      )}
    </main>
  );
}

function useAccess(code: string, role: Session['role']) {
  return useMemo(() => findAccess(code, (s) => s.role === role), [code, role]);
}

function MissingAccess({ code }: { code: string }) {
  return (
    <main className="setup narrow">
      <h1>Este dispositivo no tiene acceso a la sala {code}</h1>
      <p>Abre el enlace privado que te compartió el facilitador o entra con el código y la clave.</p>
      <a className="btn btn-primary" href="#/unirse">Unirse a una sala</a>
    </main>
  );
}

function RoomTopbar({ code, connection, status, label }: { code: string; connection: ConnectionState; status?: string; label: string }) {
  return (
    <div className="topbar">
      <a href="#/" className="back">← Inicio</a>
      <Wordmark size="sm" />
      <span className="room-code">Sala {code} · {label}</span>
      <ConnectionBadge state={connection} />
      {status === 'pausada' && <span className="chip chip-imprevisto">Sesión en pausa</span>}
    </div>
  );
}

function RoomError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="banner banner-error" role="alert">{error}</p>;
}

// ---------------------------------------------------------------------- familia

export function FamilyRemote({ code }: { code: string }) {
  const access = useAccess(code, 'familia');
  const { snap, error, connection, send } = useRoom(code, access?.key);
  if (!access) return <MissingAccess code={code} />;
  const family = snap?.families[0];
  return (
    <main className="play">
      <RoomTopbar code={code} connection={connection} status={snap?.room.status} label={access.session.label} />
      <RoomError error={error} />
      {snap?.room.status === 'pausada' && <p className="banner banner-warn" role="status">El facilitador pausó la sesión. Pueden revisar sus cuentas mientras tanto.</p>}
      {!family ? (
        <p>Cargando la partida…</p>
      ) : family.phase === 'preparacion' ? (
        <RemotePreparation family={family} send={(cmd) => send(family.id, cmd)} />
      ) : (
        <GameScreen family={family} mode="aula" dispatch={(cmd) => send(family.id, cmd)} readOnly={snap?.room.status === 'pausada' || connection === 'desconectado'} />
      )}
    </main>
  );
}

function RemotePreparation({ family, send }: { family: FamilyState; send: (c: FamilyCommand) => Promise<unknown> }) {
  const profile = FAMILY_PROFILES.find((p) => p.id === family.profileId)!;
  const [drafts, setDrafts] = useState<ParticipantDraft[]>(family.participants.map((p) => ({ nickname: p.nickname, colorId: p.colorId })));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel">
      <h1>{family.name} — {profile.name}</h1>
      <p>{profile.summary} Asignen nombres o apodos (opcional) y un color de la ruleta a cada integrante.</p>
      <ParticipantsEditor roles={profile.roles} value={drafts} onChange={setDrafts} idPrefix="remote" />
      {error && <p className="banner banner-error" role="alert">{error}</p>}
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await send({ type: 'configurarParticipantes', participants: drafts });
              await send({ type: 'comenzarPartida' });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Guardar y comenzar
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------- estaciones

function allRequests(families: FamilyState[]) {
  return families.flatMap((f) => f.requests.map((r) => ({ r, f })));
}

function RequestDetail({ r, f, onResolve, busy }: { r: ValidationRequest; f: FamilyState; onResolve: (approve: boolean, note: string) => void; busy: boolean }) {
  const [note, setNote] = useState('');
  const now = useNow();
  const cmd = r.command;
  const reserve = 'reserveId' in cmd && cmd.reserveId ? f.reserves.find((x) => x.id === cmd.reserveId) : undefined;
  return (
    <article className="request-detail" aria-labelledby={`rq-${r.id}`}>
      <h3 id={`rq-${r.id}`}>{f.name}: {r.concept}</h3>
      <dl className="mini-ledger">
        <div><dt>Acción solicitada</dt><dd>{r.actionLabel}</dd></div>
        {r.amount > 0 && <div><dt>Importe</dt><dd><Money v={r.amount} /></dd></div>}
        <div><dt>Estado</dt><dd>{r.status}</dd></div>
        <div><dt>Espera</dt><dd>{waited(r.createdAt, now)}</dd></div>
        <div><dt>Disponible de la familia</dt><dd><Money v={availableOf(f)} /></dd></div>
        {reserve && <div><dt>Reserva usada</dt><dd>{reserve.label} · <Money v={reserveBalance(f, reserve.id)} /></dd></div>}
        <div><dt>Mes / turno</dt><dd>{r.month} / {r.turn}</dd></div>
      </dl>
      {r.command.type === 'confirmarCierre' && (
        <p className="hint">
          Revisen con la familia el cierre: efectivo <Money v={summarize(f).cash} />, pendientes <Money v={summarize(f).commitmentsPending + summarize(f).surprisesPending} />, deuda bancaria <Money v={summarize(f).bankDebt} />.
        </p>
      )}
      <p className="hint">Validar confirma que la operación cumple las reglas. No se pueden cambiar precios ni decidir por la familia.</p>
      {r.status === 'pendiente' && (
        <>
          <div className="field">
            <label htmlFor={`note-${r.id}`}>Nota (opcional)</label>
            <input id={`note-${r.id}`} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="actions">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onResolve(false, note)}>No validar</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onResolve(true, note)}>Validar y aplicar</button>
          </div>
        </>
      )}
    </article>
  );
}

function Queue({
  snap,
  stations,
  send,
  title,
}: {
  snap: Snapshot;
  stations: StationId[];
  send: (fid: string, cmd: FamilyCommand) => Promise<unknown>;
  title: string;
}) {
  const now = useNow();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = allRequests(snap.families).filter(({ r }) => stations.includes(r.station));
  const pending = list.filter(({ r }) => r.status === 'pendiente').sort((a, b) => a.r.createdAt.localeCompare(b.r.createdAt));
  const resolved = list.filter(({ r }) => r.status !== 'pendiente').sort((a, b) => (b.r.resolvedAt ?? '').localeCompare(a.r.resolvedAt ?? '')).slice(0, 15);
  const current = list.find(({ r }) => r.id === selected) ?? pending[0];

  const resolve = async (f: FamilyState, r: ValidationRequest, approve: boolean, note: string) => {
    setBusy(true);
    setError(null);
    try {
      await send(f.id, { type: 'resolverSolicitud', requestId: r.id, aprobar: approve, nota: note || undefined });
      setSelected(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo resolver la solicitud.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="queue" aria-labelledby="queue-title">
      <h2 id="queue-title">{title} <span className="chip">{pending.length} pendientes</span></h2>
      {error && <p className="banner banner-error" role="alert">{error}</p>}
      <div className="queue-layout">
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Cola de solicitudes</caption>
            <thead>
              <tr><th scope="col">Familia</th><th scope="col">Concepto</th><th scope="col">Importe</th><th scope="col">Acción</th><th scope="col">Estado</th><th scope="col">Espera</th><th scope="col"><span className="sr-only">Abrir</span></th></tr>
            </thead>
            <tbody>
              {pending.length === 0 && <tr><td colSpan={7} className="muted">No hay solicitudes pendientes.</td></tr>}
              {pending.map(({ r, f }) => (
                <tr key={r.id} className={current?.r.id === r.id ? 'row-on' : ''}>
                  <td>{f.name}</td>
                  <td>{r.concept}{stations.length > 1 && <small className="muted block">{STATIONS[r.station].label}</small>}</td>
                  <td>{r.amount > 0 ? formatCOP(r.amount) : '—'}</td>
                  <td>{r.actionLabel}</td>
                  <td><span className="chip chip-imprevisto">Pendiente</span></td>
                  <td>{waited(r.createdAt, now)}</td>
                  <td><button type="button" className="btn btn-sm btn-outline" onClick={() => setSelected(r.id)}>Revisar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {current && <RequestDetail key={current.r.id} r={current.r} f={current.f} busy={busy} onResolve={(a, n) => resolve(current.f, current.r, a, n)} />}
      </div>
      {resolved.length > 0 && (
        <details className="soft">
          <summary>Resueltas recientemente</summary>
          <ul className="plain-list">
            {resolved.map(({ r, f }) => (
              <li key={r.id}>
                {f.name} · {r.concept} · {r.status} por {r.resolvedBy?.label}
                {r.note && <small className="muted"> — {r.note}</small>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function StationRemote({ code }: { code: string }) {
  const access = useAccess(code, 'estacion');
  const { snap, error, connection, send } = useRoom(code, access?.key);
  if (!access || access.session.role !== 'estacion') return <MissingAccess code={code} />;
  const station = STATIONS[access.session.stationId];
  return (
    <main className="staff">
      <RoomTopbar code={code} connection={connection} status={snap?.room.status} label={station.label} />
      <RoomError error={error} />
      <header className="page-head">
        <h1>Estación {station.label}</h1>
        <p className="muted">{station.description}</p>
      </header>
      {snap ? <Queue snap={snap} stations={[station.id]} send={send} title="Cola de atención" /> : <p>Cargando…</p>}
    </main>
  );
}

// ---------------------------------------------------------------------- facilitador

const OBS_LEVELS = ['Sin observar', 'Emergente', 'En desarrollo', 'Evidente'];

function Observations({ code, k, f, snap, onSaved }: { code: string; k: string; f: FamilyState; snap: Snapshot; onSaved: () => void }) {
  const saved = snap.room.observations?.[f.id];
  const [criteria, setCriteria] = useState<Record<string, string>>(saved?.criteria ?? {});
  const [notes, setNotes] = useState(saved?.notes ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="observations"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api('POST', `/api/rooms/${code}/observations`, { familyId: f.id, criteria, notes }, k);
          setMsg('Observación guardada.');
          onSaved();
        } catch (err) {
          setMsg((err as Error).message);
        }
      }}
    >
      <p className="hint">Registro cualitativo del facilitador. No se calcula automáticamente ni depende del dinero o la deuda.</p>
      {OBSERVATION_CRITERIA.map((c) => (
        <div className="field field-inline" key={c.id}>
          <label htmlFor={`obs-${f.id}-${c.id}`}>{c.label}</label>
          <select id={`obs-${f.id}-${c.id}`} value={criteria[c.id] ?? OBS_LEVELS[0]} onChange={(e) => setCriteria({ ...criteria, [c.id]: e.target.value })}>
            {OBS_LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
      ))}
      <div className="field">
        <label htmlFor={`obs-notes-${f.id}`}>Notas</label>
        <textarea id={`obs-notes-${f.id}`} rows={3} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="actions">
        <button type="submit" className="btn btn-outline">Guardar observación</button>
        {msg && <span role="status">{msg}</span>}
      </div>
    </form>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-field">
      <span className="copy-label">{label}</span>
      <code>{value}</code>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            window.prompt('Copia el enlace:', value);
          }
        }}
      >
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

export function FacilitatorRemote({ code }: { code: string }) {
  const access = useAccess(code, 'facilitador');
  const { snap, error, connection, send, refresh } = useRoom(code, access?.key);
  const [tab, setTab] = useState<'progreso' | 'solicitudes' | 'accesos' | 'registro'>('progreso');
  const [viewFamily, setViewFamily] = useState<string | null>(null);
  const [regFamily, setRegFamily] = useState<string>('');
  const [msg, setMsg] = useState<string | null>(null);
  if (!access) return <MissingAccess code={code} />;
  const keys = getRoomKeys(code);
  const presence = snap?.presence ?? [];
  const online = (fid: string) => presence.some((p) => p.role === 'familia' && p.familyId === fid);
  const stationOnline = (sid: string) => presence.some((p) => p.role === 'estacion' && p.stationId === sid);
  const pendingCount = snap ? allRequests(snap.families).filter(({ r }) => r.status === 'pendiente').length : 0;

  const togglePause = async () => {
    if (!snap) return;
    try {
      await api('POST', `/api/rooms/${code}/pause`, { paused: snap.room.status !== 'pausada' }, access.key);
      refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const shown = snap?.families.find((f) => f.id === viewFamily);
  const reg = snap?.families.find((f) => f.id === (regFamily || snap.families[0]?.id));

  return (
    <main className="staff">
      <RoomTopbar code={code} connection={connection} status={snap?.room.status} label="Facilitador" />
      <RoomError error={error || msg} />
      {snap?.room.store === 'memoria-pruebas' && <p className="banner banner-warn">Servidor de pruebas: los datos se pierden al reiniciar.</p>}
      <header className="page-head facilitator-head">
        <div>
          <h1>Panel del facilitador</h1>
          <p className="muted">
            Código público de la sala: <strong className="room-code-big">{code}</strong> — por sí solo no da permisos; cada familia y estación necesita su clave.
          </p>
        </div>
        {snap && (
          <button type="button" className={`btn ${snap.room.status === 'pausada' ? 'btn-primary' : 'btn-outline'}`} onClick={togglePause}>
            {snap.room.status === 'pausada' ? 'Reanudar la sesión' : 'Pausar la sesión'}
          </button>
        )}
      </header>

      <nav className="tabs" role="tablist" aria-label="Secciones del panel">
        {(
          [
            ['progreso', 'Progreso'],
            ['solicitudes', `Solicitudes (${pendingCount})`],
            ['accesos', 'Accesos'],
            ['registro', 'Registro y observación'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {!snap && <p>Cargando…</p>}

      {snap && tab === 'progreso' && (
        <>
          <section className="panel">
            <h2 className="panel-title">Familias</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th scope="col">Familia</th><th scope="col">Conexión</th><th scope="col">Mes</th><th scope="col">Turno</th><th scope="col">Fase</th><th scope="col">Casilla</th><th scope="col">Solicitudes</th><th scope="col"><span className="sr-only">Ver</span></th></tr>
                </thead>
                <tbody>
                  {snap.families.map((f) => (
                    <tr key={f.id}>
                      <th scope="row">{f.name}<small className="muted block">{FAMILY_PROFILES.find((p) => p.id === f.profileId)?.name}</small></th>
                      <td>{online(f.id) ? <span className="conn conn-conectado"><span className="conn-dot" />En línea</span> : <span className="conn conn-desconectado"><span className="conn-dot" />Sin conexión</span>}</td>
                      <td>{f.month}</td>
                      <td>{f.turn}</td>
                      <td>{PHASE_LABEL[f.phase]}</td>
                      <td>{BOARD[f.position].label}</td>
                      <td>{f.requests.filter((r) => r.status === 'pendiente').length}</td>
                      <td><button type="button" className="btn btn-sm btn-outline" onClick={() => setViewFamily(viewFamily === f.id ? null : f.id)}>{viewFamily === f.id ? 'Ocultar' : 'Ver partida'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">Orden por número de familia. No hay clasificación por dinero.</p>
          </section>
          <section className="panel">
            <h2 className="panel-title">Estaciones</h2>
            <ul className="station-list">
              {STATION_IDS.map((s) => (
                <li key={s}>
                  <strong>{STATIONS[s].label}</strong>{' '}
                  {stationOnline(s) ? <span className="conn conn-conectado"><span className="conn-dot" />En línea</span> : <span className="conn conn-desconectado"><span className="conn-dot" />Sin conexión</span>}
                  <span className="muted"> · {allRequests(snap.families).filter(({ r }) => r.station === s && r.status === 'pendiente').length} pendientes</span>
                </li>
              ))}
            </ul>
          </section>
          {shown && (
            <section className="panel family-view" aria-label={`Partida de ${shown.name} (solo lectura)`}>
              <GameScreen family={shown} mode="aula" readOnly dispatch={async () => {}} />
            </section>
          )}
        </>
      )}

      {snap && tab === 'solicitudes' && (
        <>
          <p className="banner banner-info">Como respaldo, el facilitador puede atender solicitudes de cualquier estación. Cada intervención queda registrada.</p>
          <Queue snap={snap} stations={STATION_IDS} send={send} title="Todas las solicitudes" />
        </>
      )}

      {snap && tab === 'accesos' && (
        <section className="panel">
          <h2 className="panel-title">Enlaces privados</h2>
          {!keys ? (
            <p>Las claves solo se muestran en el dispositivo que creó la sala.</p>
          ) : (
            <>
              <p className="hint">Comparte cada enlace solo con su familia o estación. El enlace del facilitador no se muestra aquí.</p>
              {snap.room.familyIds.map((fid) => (
                <CopyField key={fid} label={`Familia ${fid.slice(1)} · clave ${keys.keys.familias[fid]}`} value={accessLink(code, keys.keys.familias[fid])} />
              ))}
              {STATION_IDS.map((s) => (
                <CopyField key={s} label={`Estación ${STATIONS[s].label} · clave ${keys.keys.estaciones[s]}`} value={accessLink(code, keys.keys.estaciones[s])} />
              ))}
            </>
          )}
        </section>
      )}

      {snap && tab === 'registro' && reg && (
        <>
          <section className="panel">
            <header className="panel-head">
              <h2 className="panel-title">Registro</h2>
              <label className="inline-label">
                Familia{' '}
                <select value={reg.id} onChange={(e) => setRegFamily(e.target.value)}>
                  {snap.families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => downloadText(`sala-${code}-movimientos.csv`, movementsToCSV(snap.families))}>
                Exportar todas (CSV)
              </button>
            </header>
            <DecisionSummary f={reg} />
            <details className="soft">
              <summary>Intervenciones y decisiones registradas</summary>
              <ul className="plain-list">
                {reg.decisions.map((d) => (
                  <li key={d.id}><small className="muted">Mes {d.month} · turno {d.turn} · {d.actor.label}:</small> {d.text}</li>
                ))}
              </ul>
            </details>
            {Object.keys(reg.reflections.final).length > 0 && (
              <details className="soft">
                <summary>Reflexión final de la familia</summary>
                <ul className="plain-list">
                  {Object.entries(reg.reflections.final).map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}
                </ul>
              </details>
            )}
          </section>
          <History f={reg} />
          <section className="panel">
            <h2 className="panel-title">Observación del facilitador — {reg.name}</h2>
            <Observations key={reg.id} code={code} k={access.key} f={reg} snap={snap} onSaved={refresh} />
          </section>
          <section className="panel">
            <h2 className="panel-title">Bitácora de la sala</h2>
            <ul className="plain-list">
              {(snap.room.log ?? []).map((l, i) => <li key={i}><small className="muted">{new Date(l.at).toLocaleString('es-CO')} · {l.actor}:</small> {l.text}</li>)}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
