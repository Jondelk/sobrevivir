import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { summarize, type FamilyState } from '@sobrevivir/engine';
import { createApp } from '../src/app';
import { MemoryStore } from '../src/store/memory';

let base = '';
let close: () => Promise<void>;
let op = 0;
const opId = () => `test-op-${Date.now()}-${++op}`;

async function api(method: string, path: string, body?: unknown, key?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}
const cmd = (code: string, fid: string, key: string, command: unknown, id = opId()) =>
  api('POST', `/api/rooms/${code}/families/${fid}/commands`, { opId: id, command }, key);

beforeAll(async () => {
  const { http, io } = createApp({ store: new MemoryStore() });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  close = () => new Promise((r) => io.close(() => r()));
});
afterAll(() => close());

describe('Servidor sin MongoDB', () => {
  it('indica honestamente que el modo conectado requiere configuración', async () => {
    const { http, io } = createApp({ store: null });
    await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
    const health = await (await fetch(url + '/api/health')).json();
    expect(health.connectedMode).toBe(false);
    const res = await fetch(url + '/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"families":[1]}' });
    expect(res.status).toBe(503);
    expect((await res.json()).message).toMatch(/MongoDB/);
    await new Promise<void>((r) => io.close(() => r()));
  });
});

describe('Sesión de aula', () => {
  let code = '';
  let keys: any;

  beforeAll(async () => {
    const r = await api('POST', '/api/rooms', { families: [1, 2] });
    expect(r.status).toBe(201);
    code = r.body.code;
    keys = r.body.keys;
  });

  it('el código público no concede permisos', async () => {
    expect((await api('GET', `/api/rooms/${code}/state`)).status).toBe(401);
    expect((await api('POST', `/api/rooms/${code}/session`, { key: code + code })).status).toBe(403);
  });

  it('cada clave identifica un rol distinto', async () => {
    expect((await api('POST', `/api/rooms/${code}/session`, { key: keys.facilitador })).body.session.role).toBe('facilitador');
    expect((await api('POST', `/api/rooms/${code}/session`, { key: keys.familias.f1 })).body.session).toMatchObject({ role: 'familia', familyId: 'f1' });
    expect((await api('POST', `/api/rooms/${code}/session`, { key: keys.estaciones.banco })).body.session).toMatchObject({ role: 'estacion', stationId: 'banco' });
  });

  it('una familia solo ve y modifica su propio estado (20)', async () => {
    const snap = await api('GET', `/api/rooms/${code}/state`, undefined, keys.familias.f1);
    expect(snap.body.families.map((f: FamilyState) => f.id)).toEqual(['f1']);
    expect(snap.body.room.log).toBeUndefined();
    const r = await cmd(code, 'f2', keys.familias.f1, { type: 'comenzarPartida' });
    expect(r.status).toBe(403);
  });

  it('una estación no puede asumir permisos de facilitador ni jugar por una familia (21)', async () => {
    expect((await api('POST', `/api/rooms/${code}/pause`, { paused: true }, keys.estaciones.banco)).status).toBe(403);
    expect((await cmd(code, 'f1', keys.estaciones.banco, { type: 'comenzarPartida' })).status).toBe(403);
    expect((await api('POST', `/api/rooms/${code}/observations`, { familyId: 'f1', criteria: {}, notes: '' }, keys.estaciones.empresa)).status).toBe(403);
  });

  it('no confía en saldos enviados por el cliente', async () => {
    const r = await cmd(code, 'f1', keys.familias.f1, { type: 'ajustarSaldo', cash: 99_000_000 });
    expect(r.status).toBe(400);
  });

  it('valida, aplica una sola vez y resiste aprobaciones simultáneas (19)', async () => {
    const fk = keys.familias.f1;
    expect((await cmd(code, 'f1', fk, { type: 'comenzarPartida' })).status).toBe(200);
    const ingreso = opId();
    expect((await cmd(code, 'f1', fk, { type: 'recibirIngreso' }, ingreso)).status).toBe(200);
    // reintento con el mismo identificador: idempotente
    const again = await cmd(code, 'f1', fk, { type: 'recibirIngreso' }, ingreso);
    expect(again.status).toBe(200);
    expect(again.body.duplicate).toBe(true);

    const state: FamilyState = again.body.state;
    const food = state.obligations.find((o) => o.concept === 'alimentacion')!;
    const pay = await cmd(code, 'f1', fk, { type: 'pagarObligacion', obligationId: food.id, amount: 900_000 });
    expect(pay.body.state.phase).toBe('esperando_validacion');
    expect(summarize(pay.body.state).cash).toBe(4_000_000);
    const req = pay.body.state.requests[0];
    expect(req.station).toBe('supermercado');

    // La estación equivocada no puede aprobar
    expect((await cmd(code, 'f1', keys.estaciones.banco, { type: 'resolverSolicitud', requestId: req.id, aprobar: true })).status).toBe(403);

    // Dos operadores aprueban a la vez: estación y facilitador
    const [a, b] = await Promise.all([
      cmd(code, 'f1', keys.estaciones.supermercado, { type: 'resolverSolicitud', requestId: req.id, aprobar: true }),
      cmd(code, 'f1', keys.facilitador, { type: 'resolverSolicitud', requestId: req.id, aprobar: true }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const final = await api('GET', `/api/rooms/${code}/state`, undefined, fk);
    const f1: FamilyState = final.body.families[0];
    expect(f1.movements.filter((m) => m.type === 'pago_obligacion')).toHaveLength(1);
    expect(summarize(f1).cash).toBe(3_100_000);
  });

  it('la pausa bloquea a las familias y queda registrada', async () => {
    expect((await api('POST', `/api/rooms/${code}/pause`, { paused: true }, keys.facilitador)).status).toBe(200);
    const r = await cmd(code, 'f1', keys.familias.f1, { type: 'girarRuleta' });
    expect(r.status).toBe(423);
    expect((await api('POST', `/api/rooms/${code}/pause`, { paused: false }, keys.facilitador)).status).toBe(200);
    expect((await cmd(code, 'f1', keys.familias.f1, { type: 'girarRuleta' })).status).toBe(200);
    const snap = await api('GET', `/api/rooms/${code}/state`, undefined, keys.facilitador);
    expect(snap.body.room.log.map((l: any) => l.text)).toEqual(expect.arrayContaining(['Sesión pausada.', 'Sesión reanudada.']));
  });

  it('el servidor decide la ruleta y el dado; no se puede lanzar dos veces', async () => {
    const fk = keys.familias.f1;
    const r1 = await cmd(code, 'f1', fk, { type: 'lanzarDado' });
    expect(r1.status).toBe(200);
    const v = r1.body.state.lastRoll.value;
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(6);
    expect((await cmd(code, 'f1', fk, { type: 'lanzarDado' })).status).toBe(409);
  });

  it('notifica en tiempo real a las estaciones', async () => {
    const socket = ioClient(base, { auth: { code, key: keys.estaciones.empresa }, transports: ['websocket'] });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });
    const received = new Promise<FamilyState>((resolve) => socket.on('family', resolve));
    await cmd(code, 'f2', keys.familias.f2, { type: 'comenzarPartida' });
    const s = await received;
    expect(s.id).toBe('f2');
    expect(s.phase).toBe('inicio_mes');
    socket.close();
  });

  it('rechaza conexiones de tiempo real sin clave', async () => {
    const socket = ioClient(base, { auth: { code }, transports: ['websocket'], reconnection: false });
    const err = await new Promise<Error>((resolve) => socket.on('connect_error', resolve));
    expect(err.message).toMatch(/clave/i);
    socket.close();
  });
});
