import {
  RULES_VERSION,
  RuleError,
  applyOperation,
  createFamily,
  cryptoRng,
  type Actor,
  type ColorId,
  type FamilyCommand,
  type FamilyState,
} from '@sobrevivir/engine';
import { newOpId } from './router';

/**
 * Demostración local: la partida vive en este navegador (localStorage).
 * No hay sincronización entre dispositivos. Se protege contra dos pestañas
 * escribiendo a la vez mediante un número de versión.
 */
export interface LocalGame {
  kind: 'local';
  rulesVersion: string;
  id: string;
  createdAt: string;
  families: FamilyState[];
  activeFamilyId: string;
  version: number;
}

const KEY = 'sobrevivir:demo-local';
export const LOCAL_ACTOR: Actor = { role: 'local', label: 'Demostración local' };

export class StaleTabError extends Error {
  constructor() {
    super('La partida se modificó en otra pestaña. Recarga esta pestaña para continuar con la versión más reciente.');
  }
}

function readRaw(): LocalGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as LocalGame;
    if (g.kind !== 'local' || !Array.isArray(g.families)) return null;
    return g;
  } catch {
    return null;
  }
}

export function loadLocalGame(): LocalGame | null {
  return readRaw();
}

export function hasLocalGame() {
  return readRaw() !== null;
}

export function deleteLocalGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Guarda solo si nadie escribió una versión más reciente desde que esta pestaña la cargó. */
export function saveLocalGame(next: LocalGame, expectedVersion: number) {
  const current = readRaw();
  if (current && current.id === next.id && current.version !== expectedVersion) throw new StaleTabError();
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function createLocalGame(setup: { profileId: number; participants: { nickname: string; colorId: ColorId }[] }[]): LocalGame {
  const now = new Date().toISOString();
  const families = setup.map((s) => {
    const f = createFamily({ id: `f${s.profileId}`, profileId: s.profileId, mode: 'local', rng: cryptoRng, now, participants: s.participants });
    return applyOperation(f, newOpId(), { type: 'comenzarPartida' }, { rng: cryptoRng, actor: LOCAL_ACTOR }).state;
  });
  const game: LocalGame = {
    kind: 'local',
    rulesVersion: RULES_VERSION,
    id: crypto.randomUUID(),
    createdAt: now,
    families,
    activeFamilyId: families[0].id,
    version: 1,
  };
  localStorage.setItem(KEY, JSON.stringify(game));
  return game;
}

/** Aplica un comando con el mismo motor que usa el servidor y persiste el resultado. */
export function applyLocal(game: LocalGame, familyId: string, cmd: FamilyCommand): LocalGame {
  const fam = game.families.find((f) => f.id === familyId);
  if (!fam) throw new RuleError('familia', 'Familia no encontrada.');
  const { state } = applyOperation(fam, newOpId(), cmd, { rng: cryptoRng, actor: LOCAL_ACTOR });
  const next: LocalGame = {
    ...game,
    families: game.families.map((f) => (f.id === familyId ? state : f)),
    version: game.version + 1,
  };
  saveLocalGame(next, game.version);
  return next;
}

export function setActiveFamily(game: LocalGame, familyId: string): LocalGame {
  const next = { ...game, activeFamilyId: familyId, version: game.version + 1 };
  saveLocalGame(next, game.version);
  return next;
}

export const LOCAL_STORAGE_KEY = KEY;
