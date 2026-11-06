import { MongoClient, type Collection, type Db } from 'mongodb';
import type { FamilyDoc, RoomDoc, Store } from './types';

/**
 * Persistencia en MongoDB. Cada familia es un único documento: el movimiento,
 * la obligación y la solicitud cambian en la misma escritura atómica, protegida
 * por un número de versión (concurrencia optimista).
 */
export class MongoStore implements Store {
  readonly kind = 'mongo' as const;
  private client: MongoClient;
  private db!: Db;
  private rooms!: Collection<RoomDoc>;
  private families!: Collection<FamilyDoc>;

  constructor(
    uri: string,
    private dbName: string,
  ) {
    this.client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  }

  async init() {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    this.rooms = this.db.collection<RoomDoc>('rooms');
    this.families = this.db.collection<FamilyDoc>('families');
    await this.rooms.createIndex({ code: 1 }, { unique: true });
    await this.families.createIndex({ roomId: 1, familyId: 1 }, { unique: true });
  }

  async createRoom(room: RoomDoc, families: FamilyDoc[]) {
    await this.rooms.insertOne(room);
    if (families.length) await this.families.insertMany(families);
  }

  findRoomByCode(code: string) {
    return this.rooms.findOne({ code });
  }

  async replaceRoom(room: RoomDoc, expectedVersion: number) {
    const r = await this.rooms.replaceOne({ _id: room._id, version: expectedVersion }, room);
    return r.matchedCount === 1;
  }

  getFamily(roomId: string, familyId: string) {
    return this.families.findOne({ roomId, familyId });
  }

  listFamilies(roomId: string) {
    return this.families.find({ roomId }).sort({ familyId: 1 }).toArray();
  }

  async replaceFamily(doc: FamilyDoc, expectedVersion: number) {
    const r = await this.families.replaceOne({ _id: doc._id, version: expectedVersion }, doc);
    return r.matchedCount === 1;
  }

  async close() {
    await this.client.close();
  }
}
