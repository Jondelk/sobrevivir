import { applyCommand, createFamily, SURPRISES, type Actor, type FamilyCommand, type FamilyState, type GameMode, type Rng, type RngPurpose } from '../src';
import { shuffleScriptFor } from '../src/testing';

export const LOCAL: Actor = { role: 'local', label: 'Demostración local' };

/** Fuente aleatoria controlada para pruebas: se programan resultados justo antes de usarlos. */
export class ControlledRng implements Rng {
  queues: Record<RngPurpose, number[]> = { ruleta: [], dado: [], barajar: [] };
  calls: RngPurpose[] = [];
  int(n: number, purpose: RngPurpose): number {
    this.calls.push(purpose);
    const q = this.queues[purpose];
    if (q.length) {
      const v = q.shift()!;
      if (v < 0 || v >= n) throw new Error(`valor ${v} fuera de rango`);
      return v;
    }
    if (purpose === 'barajar') return n - 1;
    if (purpose === 'ruleta') return 0;
    throw new Error('Falta programar el dado');
  }
}

let clock = 0;
export const now = () => new Date(Date.UTC(2026, 0, 1, 8, 0, clock++)).toISOString();

export class Driver {
  rng = new ControlledRng();
  f: FamilyState;
  constructor(opts: { mode?: GameMode; id?: string; profileId?: number; surpriseOrder?: string[] } = {}) {
    if (opts.surpriseOrder) {
      this.rng.queues.barajar.push(
        ...shuffleScriptFor(
          SURPRISES.map((c) => c.id),
          opts.surpriseOrder,
        ),
      );
    }
    this.f = createFamily({ id: opts.id ?? 'f1', profileId: opts.profileId ?? 1, mode: opts.mode ?? 'local', rng: this.rng, now: now() });
  }
  run(cmd: FamilyCommand, actor: Actor = LOCAL) {
    this.f = applyCommand(this.f, cmd, { rng: this.rng, actor, now });
    return this.f;
  }
  start(actor: Actor = LOCAL) {
    this.run({ type: 'comenzarPartida' }, actor);
    this.run({ type: 'recibirIngreso' }, actor);
  }
  /** Gira (sector programado) + lanza el dado con el valor dado + mueve. */
  turn(value: number, actor: Actor = LOCAL, sector = 0) {
    this.rng.queues.ruleta.push(sector);
    this.run({ type: 'girarRuleta' }, actor);
    this.rng.queues.dado.push(value - 1);
    this.run({ type: 'lanzarDado' }, actor);
    this.run({ type: 'completarMovimiento' }, actor);
    return this.f;
  }
  /** Sale de la resolución sin comprar y termina el turno. */
  endTurn(actor: Actor = LOCAL) {
    if (this.f.phase === 'resolucion') {
      if (this.f.activeEvent?.offers && !this.f.activeEvent.purchasedItemId) this.run({ type: 'pasarCompra' }, actor);
      else this.run({ type: 'terminarResolucion' }, actor);
    }
    if (this.f.phase === 'gestion') this.run({ type: 'finalizarTurno' }, actor);
  }
  /** Ejecuta varias tiradas pasando por casillas sin decisiones económicas. */
  walk(values: number[]) {
    for (const v of values) {
      this.turn(v);
      if (this.f.phase === 'cierre_mes') return;
      this.endTurn();
    }
  }
  ob(month: number, concept: string) {
    const o = this.f.obligations.find((x) => x.month === month && x.concept === concept);
    if (!o) throw new Error(`No existe la obligación ${concept} del mes ${month}`);
    return o;
  }
}
