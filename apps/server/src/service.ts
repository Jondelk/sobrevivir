import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  FAMILY_PROFILES,
  RuleError,
  STATION_IDS,
  STATIONS,
  applyOperation,
  createFamily,
  cryptoRng,
  type Actor,
  type FamilyCommand,
  type FamilyState,
  type StationId,
} from '@sobrevivir/engine';
import type { FamilyDoc, ObservationRecord, RoomDoc, Store } from './store/types';

export type Session =
  | { role: 'facilitador'; label: string }
  | { role: 'familia'; familyId: string; label: string }
  | { role: 'estacion'; stationId: StationId; label: string };

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomCode(length: number) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
const hashKey = (key: string) => createHash('sha256').update(key.trim().toUpperCase()).digest('hex');
const sameHash = (a: string, b: string) => {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
};

export function sessionToActor(s: Session): Actor {
  if (s.role === 'familia') return { role: 'familia', familyId: s.familyId, label: s.label };
  if (s.role === 'estacion') return { role: 'estacion', stationId: s.stationId, label: s.label };
  return { role: 'facilitador', label: s.label };
}

export interface CreatedRoom {
  code: string;
  keys: { facilitador: string; familias: Record<string, string>; estaciones: Record<StationId, string> };
}

export type Notifier = {
  family(roomId: string, state: FamilyState): void;
  room(roomId: string): void;
};

export class GameService {
  private locks = new Map<string, Promise<unknown>>();
  notifier: Notifier = { family() {}, room() {} };

  constructor(public store: Store) {}

  /** Serializa los comandos de una misma familia dentro del proceso. */
  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    const chain = prev.then(() => next);
    this.locks.set(key, chain);
    await prev.catch(() => {});
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(key) === chain) this.locks.delete(key);
    }
  }

  async createRoom(profileIds: number[]): Promise<CreatedRoom> {
    const ids = [...new Set(profileIds)].sort();
    if (ids.length === 0 || ids.some((id) => !FAMILY_PROFILES.some((p) => p.id === id)))
      throw new HttpError(400, 'familias', 'Selecciona entre una y seis familias válidas.');
    const roomId = randomUUID();
    const now = new Date().toISOString();
    const keys: CreatedRoom['keys'] = {
      facilitador: randomCode(24),
      familias: {},
      estaciones: {} as Record<StationId, string>,
    };
    const families: FamilyDoc[] = ids.map((pid) => {
      const familyId = `f${pid}`;
      keys.familias[familyId] = randomCode(10);
      const state = createFamily({ id: familyId, profileId: pid, mode: 'aula', rng: cryptoRng, now });
      return { _id: `${roomId}:${familyId}`, roomId, familyId, version: state.version, state };
    });
    for (const st of STATION_IDS) keys.estaciones[st] = randomCode(10);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode(6);
      const room: RoomDoc = {
        _id: roomId,
        code,
        status: 'activa',
        familyIds: families.map((f) => f.familyId),
        keys: {
          facilitador: hashKey(keys.facilitador),
          familias: Object.fromEntries(Object.entries(keys.familias).map(([k, v]) => [k, hashKey(v)])),
          estaciones: Object.fromEntries(Object.entries(keys.estaciones).map(([k, v]) => [k, hashKey(v)])) as Record<
            StationId,
            string
          >,
        },
        log: [{ at: now, actor: 'Facilitador', text: 'Sala creada.' }],
        observations: {},
        createdAt: now,
        version: 1,
      };
      try {
        await this.store.createRoom(room, families);
        return { code, keys };
      } catch (e) {
        if (!String(e).includes('duplicate')) throw e;
      }
    }
    throw new HttpError(500, 'codigo', 'No se pudo generar un código de sala único.');
  }

  async getRoom(code: string) {
    const room = await this.store.findRoomByCode(String(code).trim().toUpperCase());
    if (!room) throw new HttpError(404, 'sala', 'No existe una sala con ese código.');
    return room;
  }

  /** Identifica el rol de una clave. El código público de la sala, por sí solo, no concede permisos. */
  async authenticate(code: string, key: string | undefined): Promise<{ room: RoomDoc; session: Session }> {
    const room = await this.getRoom(code);
    if (!key || key.length < 8 || key.length > 64) throw new HttpError(401, 'clave', 'Falta una clave de acceso válida.');
    const h = hashKey(key);
    if (sameHash(h, room.keys.facilitador)) return { room, session: { role: 'facilitador', label: 'Facilitador' } };
    for (const [familyId, fh] of Object.entries(room.keys.familias)) {
      if (sameHash(h, fh)) return { room, session: { role: 'familia', familyId, label: `Familia ${familyId.slice(1)}` } };
    }
    for (const [stationId, sh] of Object.entries(room.keys.estaciones)) {
      if (sameHash(h, sh))
        return {
          room,
          session: { role: 'estacion', stationId: stationId as StationId, label: `Estación ${STATIONS[stationId as StationId].label}` },
        };
    }
    throw new HttpError(403, 'clave', 'La clave no corresponde a esta sala.');
  }

  async snapshot(room: RoomDoc, session: Session) {
    const docs = await this.store.listFamilies(room._id);
    const families = docs.map((d) => d.state).filter((f) => session.role !== 'familia' || f.id === session.familyId);
    return {
      room: {
        code: room.code,
        status: room.status,
        familyIds: room.familyIds,
        createdAt: room.createdAt,
        store: this.store.kind,
        ...(session.role === 'facilitador' ? { log: room.log, observations: room.observations } : {}),
      },
      session,
      families,
      serverTime: new Date().toISOString(),
    };
  }

  async command(code: string, key: string | undefined, familyId: string, opId: string, command: FamilyCommand) {
    const { room, session } = await this.authenticate(code, key);
    if (!room.familyIds.includes(familyId)) throw new HttpError(404, 'familia', 'La familia no participa en esta sala.');
    if (session.role === 'familia' && session.familyId !== familyId)
      throw new HttpError(403, 'permiso', 'No tienes permiso para modificar esta familia.');
    if (session.role !== 'familia' && command.type !== 'resolverSolicitud')
      throw new HttpError(403, 'permiso', 'Este acceso solo puede validar solicitudes.');
    if (room.status === 'pausada' && session.role !== 'facilitador')
      throw new HttpError(423, 'pausada', 'La sesión está en pausa. Espera a que el facilitador la reanude.');

    const actor = sessionToActor(session);
    return this.withLock(`${room._id}:${familyId}`, async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const doc = await this.store.getFamily(room._id, familyId);
        if (!doc) throw new HttpError(404, 'familia', 'Familia no encontrada.');
        // Servidor autoritativo: los resultados aleatorios se generan aquí y nunca vienen del cliente.
        const { state, duplicate } = applyOperation(doc.state, opId, command, { rng: cryptoRng, actor });
        if (duplicate) return { state, duplicate };
        const ok = await this.store.replaceFamily({ ...doc, version: state.version, state }, doc.version);
        if (ok) {
          this.notifier.family(room._id, state);
          return { state, duplicate };
        }
      }
      throw new HttpError(409, 'conflicto', 'Otro dispositivo modificó la partida al mismo tiempo. Intenta de nuevo.');
    });
  }

  private async updateRoom(code: string, mutate: (room: RoomDoc) => void) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const room = await this.getRoom(code);
      const expected = room.version;
      mutate(room);
      room.version = expected + 1;
      if (await this.store.replaceRoom(room, expected)) {
        this.notifier.room(room._id);
        return room;
      }
    }
    throw new HttpError(409, 'conflicto', 'No se pudo actualizar la sala. Intenta de nuevo.');
  }

  async setPaused(code: string, key: string | undefined, paused: boolean) {
    const { session } = await this.authenticate(code, key);
    if (session.role !== 'facilitador') throw new HttpError(403, 'permiso', 'Solo el facilitador puede pausar la sesión.');
    return this.updateRoom(code, (room) => {
      room.status = paused ? 'pausada' : 'activa';
      room.log.push({ at: new Date().toISOString(), actor: 'Facilitador', text: paused ? 'Sesión pausada.' : 'Sesión reanudada.' });
    });
  }

  async saveObservation(code: string, key: string | undefined, obs: Omit<ObservationRecord, 'updatedAt'>) {
    const { room, session } = await this.authenticate(code, key);
    if (session.role !== 'facilitador') throw new HttpError(403, 'permiso', 'Solo el facilitador registra observaciones.');
    if (!room.familyIds.includes(obs.familyId)) throw new HttpError(404, 'familia', 'Familia no encontrada.');
    return this.updateRoom(code, (r) => {
      r.observations[obs.familyId] = { ...obs, updatedAt: new Date().toISOString() };
    });
  }
}

export function toHttpError(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  if (e instanceof RuleError) return new HttpError(e.code === 'permiso' ? 403 : 409, e.code, e.message);
  if (e && typeof e === 'object' && 'issues' in e) return new HttpError(400, 'datos', 'Los datos enviados no son válidos.');
  console.error(e);
  return new HttpError(500, 'interno', 'Error interno del servidor.');
}
