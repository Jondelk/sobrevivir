import type { FamilyState, StationId } from '@sobrevivir/engine';

export type RoomStatus = 'activa' | 'pausada';

export interface RoomLogEntry {
  at: string;
  actor: string;
  text: string;
}

export interface ObservationRecord {
  familyId: string;
  criteria: Record<string, string>;
  notes: string;
  updatedAt: string;
}

export interface RoomDoc {
  _id: string;
  code: string;
  status: RoomStatus;
  familyIds: string[];
  /** Hash SHA-256 de cada clave de acceso. Las claves en claro nunca se guardan. */
  keys: {
    facilitador: string;
    familias: Record<string, string>;
    estaciones: Record<StationId, string>;
  };
  log: RoomLogEntry[];
  observations: Record<string, ObservationRecord>;
  createdAt: string;
  version: number;
}

export interface FamilyDoc {
  _id: string;
  roomId: string;
  familyId: string;
  version: number;
  state: FamilyState;
}

export interface Store {
  readonly kind: 'mongo' | 'memoria-pruebas';
  init(): Promise<void>;
  createRoom(room: RoomDoc, families: FamilyDoc[]): Promise<void>;
  findRoomByCode(code: string): Promise<RoomDoc | null>;
  /** Reemplaza la sala si su versión coincide. Devuelve false ante un conflicto de concurrencia. */
  replaceRoom(room: RoomDoc, expectedVersion: number): Promise<boolean>;
  getFamily(roomId: string, familyId: string): Promise<FamilyDoc | null>;
  listFamilies(roomId: string): Promise<FamilyDoc[]>;
  /** Reemplaza el documento completo (estado, movimientos y obligaciones juntos) si la versión coincide. */
  replaceFamily(doc: FamilyDoc, expectedVersion: number): Promise<boolean>;
  close(): Promise<void>;
}
