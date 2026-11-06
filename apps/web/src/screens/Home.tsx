import { useEffect, useState } from 'react';
import { RULES_VERSION } from '@sobrevivir/engine';
import { StudioCredit, Wordmark } from '../brand';
import { hasLocalGame } from '../lib/localGame';
import { fetchHealth, listAccesses, type Health } from '../lib/remote';
import { go } from '../lib/router';
import { BOARD, TILE_CATEGORY } from '@sobrevivir/engine';

function MiniBoardArt() {
  // Composición decorativa a partir del propio recorrido (no es una imagen de referencia).
  return (
    <div className="mini-art" aria-hidden="true">
      {BOARD.map((t) => (
        <span key={t.index} className={`mini-cell tile-${TILE_CATEGORY[t.kind]}`} style={{ ['--i' as string]: t.index }} />
      ))}
    </div>
  );
}

export function Home() {
  const [health, setHealth] = useState<Health | null | undefined>(undefined);
  const saved = hasLocalGame();
  const accesses = listAccesses();
  useEffect(() => {
    fetchHealth().then(setHealth);
  }, []);
  const roleLabel = (r: string) => (r === 'facilitador' ? 'Facilitador' : r === 'estacion' ? 'Estación' : 'Familia');

  return (
    <main className="home">
      <section className="hero">
        <div className="hero-text">
          <Wordmark size="lg" />
          <p className="lead">
            Un juego de mesa para conversar sobre el dinero de un hogar durante tres meses. Todas las familias empiezan con el mismo
            ingreso. No hay ganadores ni perdedores: hay decisiones, circunstancias y lo que aprendemos al hablarlas.
          </p>
          <StudioCredit />
        </div>
        <MiniBoardArt />
      </section>

      <section className="home-actions" aria-label="¿Qué quieres hacer?">
        <button type="button" className="action-card action-demo" onClick={() => go('/demo/preparar')}>
          <span className="action-title">Crear demostración</span>
          <span className="action-desc">Una o varias familias en este navegador. Funciona sin servidor y se guarda aquí.</span>
        </button>
        <button type="button" className="action-card action-room" onClick={() => go('/sala/crear')}>
          <span className="action-title">Crear sala de aula</span>
          <span className="action-desc">
            Para facilitadores: seis familias y cuatro estaciones en dispositivos distintos.
            {health && !health.connectedMode && <em className="block">Requiere el servidor con MongoDB configurado.</em>}
            {health === null && <em className="block">Requiere el servidor de la aplicación.</em>}
          </span>
        </button>
        <button type="button" className="action-card action-join" onClick={() => go('/unirse')}>
          <span className="action-title">Unirse a una sala</span>
          <span className="action-desc">Con el código de la sala y la clave de tu familia o estación.</span>
        </button>
        <button
          type="button"
          className="action-card action-continue"
          onClick={() => go('/demo')}
          disabled={!saved}
          aria-describedby="continue-desc"
        >
          <span className="action-title">Continuar partida guardada</span>
          <span className="action-desc" id="continue-desc">
            {saved ? 'Retoma la demostración guardada en este navegador.' : 'No hay una demostración guardada en este navegador.'}
          </span>
        </button>
      </section>

      {accesses.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">Accesos de aula guardados en este dispositivo</h2>
          <ul className="plain-list">
            {accesses.slice(0, 6).map((a) => (
              <li key={a.code + a.key}>
                <a href={`#/acceso/${a.code}/${a.key}`}>
                  Sala {a.code} · {roleLabel(a.session.role)} {'familyId' in a.session ? a.session.label.replace('Familia ', '') : ''}
                  {'stationId' in a.session ? a.session.label.replace('Estación ', '') : ''}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="home-foot">
        <span>Reglas de la versión {RULES_VERSION}</span>
        <span>
          Servidor:{' '}
          {health === undefined ? 'comprobando…' : health === null ? 'no disponible (la demostración local funciona igual)' : health.connectedMode ? 'listo para sesiones de aula' : 'sin base de datos'}
        </span>
      </footer>
    </main>
  );
}
