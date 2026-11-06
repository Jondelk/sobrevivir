import type { FamilyDoc, RoomDoc, Store } from './types';

/**
 * Almacén en memoria EXCLUSIVO PARA PRUEBAS AUTOMATIZADAS.
 * Implementa la misma semántica de versión que MongoDB, pero los datos se pierden
 * al reiniciar el proceso. Solo se activa con SOBREVIVIR_STORE=memoria-pruebas.
 */
export class MemoryStore implements Store {
  readonly kind = 'memoria-pruebas' as const;
  private rooms = new Map<string, RoomDoc>();
  private families = new Map<string, FamilyDoc>();

  async init() {}

  async createRoom(room: RoomDoc, families: FamilyDoc[]) {
    if ([...this.rooms.values()].some((r) => r.code === room.code)) throw new Error('duplicate key');
    this.rooms.set(room._id, structuredClone(room));
    for (const f of families) this.families.set(f._id, structuredClone(f));
  }

  async findRoomByCode(code: string) {
    const r = [...this.rooms.values()].find((x) => x.code === code);
    return r ? structuredClone(r) : null;
  }

  async replaceRoom(room: RoomDoc, expectedVersion: number) {
    const cur = this.rooms.get(room._id);
    if (!cur || cur.version !== expectedVersion) return false;
    this.rooms.set(room._id, structuredClone(room));
    return true;
  }

  async getFamily(roomId: string, familyId: string) {
    const f = [...this.families.values()].find((x) => x.roomId === roomId && x.familyId === familyId);
    return f ? structuredClone(f) : null;
  }

  async listFamilies(roomId: string) {
    return [...this.families.values()]
      .filter((x) => x.roomId === roomId)
      .sort((a, b) => a.familyId.localeCompare(b.familyId))
      .map((f) => structuredClone(f));
  }

  async replaceFamily(doc: FamilyDoc, expectedVersion: number) {
    // Pausa asíncrona para que las pruebas de concurrencia puedan intercalar escrituras.
    await new Promise((r) => setImmediate(r));
    const cur = this.families.get(doc._id);
    if (!cur || cur.version !== expectedVersion) return false;
    this.families.set(doc._id, structuredClone(doc));
    return true;
  }

  async close() {}
}
