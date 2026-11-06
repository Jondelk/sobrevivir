import { describe, expect, it } from 'vitest';
import { CARD_CATEGORIES, OPPORTUNITIES, PURCHASES, SURPRISES } from '../src';

const pairs = (list: { label: string }[], value: (x: never) => number) => list.map((x) => [x.label, value(x as never)]);

describe('Tarjetas: nombres y valores del documento pedagógico', () => {
  it('tentaciones de gasto', () => {
    expect(pairs(PURCHASES, (p: { price: number }) => p.price)).toEqual([
      ['Celular nuevo', 500_000],
      ['Ropa', 300_000],
      ['Cine', 150_000],
      ['Cena familiar', 200_000],
      ['Videojuegos', 250_000],
      ['Promoción comercial', 350_000],
    ]);
  });

  it('imprevistos económicos', () => {
    expect(pairs(SURPRISES, (s: { amount: number }) => s.amount)).toEqual([
      ['Emergencia médica', 300_000],
      ['Daño de electrodoméstico', 250_000],
      ['Pérdida parcial de ingresos', 300_000],
      ['Gasto escolar inesperado', 200_000],
      ['Medicamentos', 150_000],
    ]);
    expect(SURPRISES.find((s) => s.id === 'perdida_ingresos')!.kind).toBe('reintegro');
  });

  it('oportunidades económicas (propuesta del piloto)', () => {
    expect(pairs(OPPORTUNITIES, (o: { amount: number }) => o.amount)).toEqual([
      ['Trabajo ocasional', 150_000],
      ['Venta de un objeto que ya no utilizan', 100_000],
      ['Apoyo económico no reembolsable', 100_000],
      ['Premio comunitario', 50_000],
      ['Servicio independiente ocasional', 100_000],
    ]);
  });

  it('cada categoría tiene subtítulo, instrucción, mecánica y propósito', () => {
    expect(CARD_CATEGORIES.tentacion).toMatchObject({ subtitle: 'Decisión voluntaria', instruction: 'Compra o pasa', familyDecides: 'Sí, compra o pasa' });
    expect(CARD_CATEGORIES.imprevisto).toMatchObject({ subtitle: 'Situación inesperada', instruction: 'Toma una tarjeta', familyDecides: 'Decide cómo afrontarlo' });
    expect(CARD_CATEGORIES.oportunidad).toMatchObject({
      subtitle: 'Ingreso o beneficio favorable',
      instruction: 'Toma una tarjeta',
      familyDecides: 'Aplica el beneficio de la tarjeta',
    });
    for (const c of Object.values(CARD_CATEGORIES)) {
      expect(c.mechanic.length).toBeGreaterThan(20);
      expect(c.purpose.length).toBeGreaterThan(20);
    }
  });
});
