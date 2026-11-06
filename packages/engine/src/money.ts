const formatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0, minimumFractionDigits: 0 });

/** Formato colombiano: $4.000.000. Los importes son enteros en pesos. */
export function formatCOP(amount: number): string {
  if (!Number.isInteger(amount)) throw new Error('Los importes deben ser enteros');
  const sign = amount < 0 ? '−' : '';
  return `${sign}$${formatter.format(Math.abs(amount)).replace(/[\s, ]/g, '.')}`;
}

/** Interpreta un texto escrito por una persona ("300.000", "$ 300000") como pesos enteros. */
export function parseCOP(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}
