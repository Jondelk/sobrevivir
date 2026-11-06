import type { Rng, RngPurpose } from './types';

/**
 * Fuente aleatoria controlada, exclusiva para pruebas automatizadas.
 * La interfaz nunca la utiliza: el modo local usa `cryptoRng` y el modo aula
 * usa la aleatoriedad del servidor.
 */
export function scriptedRng(script: Partial<Record<RngPurpose, number[]>> = {}): Rng {
  const queues: Record<RngPurpose, number[]> = {
    ruleta: [...(script.ruleta ?? [])],
    dado: [...(script.dado ?? [])],
    barajar: [...(script.barajar ?? [])],
  };
  return {
    int(n: number, purpose: RngPurpose) {
      const q = queues[purpose];
      if (q.length > 0) {
        const v = q.shift()!;
        if (v < 0 || v >= n) throw new Error(`Valor de prueba ${v} fuera de rango para ${purpose}`);
        return v;
      }
      if (purpose === 'barajar') return n - 1; // identidad: conserva el orden original
      if (purpose === 'ruleta') return 0;
      throw new Error('No quedan resultados de dado programados en la prueba');
    },
  };
}

/** Valores de Fisher–Yates que producen exactamente el orden deseado a partir del original. */
export function shuffleScriptFor<T>(original: T[], desired: T[]): number[] {
  const a = [...original];
  const out: number[] = [];
  for (let i = a.length - 1; i > 0; i--) {
    const j = a.indexOf(desired[i]);
    if (j < 0 || j > i) throw new Error('Orden deseado inválido');
    out.push(j);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return out;
}
