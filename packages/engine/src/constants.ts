/**
 * Reglas de la versión piloto de «Sobrevivir al mes».
 * Todos los importes están en pesos colombianos enteros (COP), sin decimales.
 */
export const RULES_VERSION = 'piloto-1.0';

export const MONTHLY_INCOME = 4_000_000;
export const TOTAL_MONTHS = 3;
export const BOARD_SIZE = 24;

export type Month = 1 | 2 | 3;

export type StationId = 'banco' | 'supermercado' | 'centro_comercial' | 'empresa';

export const STATIONS: Record<StationId, { id: StationId; label: string; description: string }> = {
  banco: {
    id: 'banco',
    label: 'Banco',
    description: 'Valida desembolsos, abonos, oportunidades y el inicio del mes siguiente.',
  },
  supermercado: {
    id: 'supermercado',
    label: 'Supermercado',
    description: 'Valida los pagos de alimentación.',
  },
  centro_comercial: {
    id: 'centro_comercial',
    label: 'Centro Comercial',
    description: 'Valida las compras opcionales.',
  },
  empresa: {
    id: 'empresa',
    label: 'Empresa / Servicios',
    description: 'Valida arriendo, transporte, educación e imprevistos.',
  },
};
export const STATION_IDS = Object.keys(STATIONS) as StationId[];

export type CommitmentConcept = 'arriendo' | 'alimentacion' | 'transporte' | 'educacion';

export const COMMITMENTS: Record<
  CommitmentConcept,
  { concept: CommitmentConcept; label: string; amount: number; station: StationId }
> = {
  arriendo: { concept: 'arriendo', label: 'Arriendo', amount: 1_500_000, station: 'empresa' },
  alimentacion: { concept: 'alimentacion', label: 'Alimentación', amount: 900_000, station: 'supermercado' },
  transporte: { concept: 'transporte', label: 'Transporte', amount: 400_000, station: 'empresa' },
  educacion: { concept: 'educacion', label: 'Educación', amount: 600_000, station: 'empresa' },
};
export const COMMITMENT_CONCEPTS: CommitmentConcept[] = ['arriendo', 'alimentacion', 'transporte', 'educacion'];
export const MONTHLY_COMMITMENTS_TOTAL = COMMITMENT_CONCEPTS.reduce((s, c) => s + COMMITMENTS[c].amount, 0);

export interface PurchaseItem {
  id: string;
  label: string;
  price: number;
  /** Frase breve de la situación que muestra la tarjeta (texto editable del piloto). */
  situation: string;
}

/** Mazo de compras y tentaciones (seis tarjetas). */
export const PURCHASES: PurchaseItem[] = [
  { id: 'celular', label: 'Celular nuevo', price: 500_000, situation: 'Sale un modelo nuevo y el celular actual todavía funciona.' },
  { id: 'ropa', label: 'Ropa', price: 300_000, situation: 'En la vitrina hay ropa que a alguien de la familia le gustaría estrenar.' },
  { id: 'cine', label: 'Cine', price: 150_000, situation: 'Se estrena una película que la familia quiere ver.' },
  { id: 'cena', label: 'Cena familiar', price: 200_000, situation: 'Proponen salir a cenar todos juntos.' },
  { id: 'videojuegos', label: 'Videojuegos', price: 250_000, situation: 'Llega un videojuego que los más jóvenes estaban esperando.' },
  { id: 'promocion', label: 'Promoción comercial', price: 350_000, situation: 'Una oferta «solo por hoy» invita a comprar algo que no estaba en los planes.' },
];
export const FAMILY_OUTING_OPTIONS = ['cine', 'cena'];

export interface SurpriseCard {
  id: string;
  label: string;
  amount: number;
  /** «reintegro» representa la devolución de parte del ingreso ya recibido. */
  kind: 'imprevisto' | 'reintegro';
  description: string;
}

export const SURPRISES: SurpriseCard[] = [
  {
    id: 'emergencia_medica',
    label: 'Emergencia médica',
    amount: 300_000,
    kind: 'imprevisto',
    description: 'Una consulta urgente y exámenes que no estaban previstos.',
  },
  {
    id: 'electrodomestico',
    label: 'Daño de electrodoméstico',
    amount: 250_000,
    kind: 'imprevisto',
    description: 'La nevera dejó de enfriar y hay que repararla.',
  },
  {
    id: 'perdida_ingresos',
    label: 'Pérdida parcial de ingresos',
    amount: 300_000,
    kind: 'reintegro',
    description:
      'Parte del ingreso de este mes no llegó completo. Se registra como un reintegro de $300.000 del ingreso ya recibido.',
  },
  {
    id: 'gasto_escolar',
    label: 'Gasto escolar inesperado',
    amount: 200_000,
    kind: 'imprevisto',
    description: 'Materiales y una salida pedagógica que el colegio pidió esta semana.',
  },
  {
    id: 'medicamentos',
    label: 'Medicamentos',
    amount: 150_000,
    kind: 'imprevisto',
    description: 'Un tratamiento que no cubre el sistema de salud.',
  },
];

export interface OpportunityCard {
  id: string;
  label: string;
  amount: number;
  description: string;
}

/** Oportunidades: configuración de la versión piloto. */
/**
 * Oportunidades: propuesta posterior al documento pedagógico original
 * (configuración de la versión piloto). Los identificadores internos se conservan
 * para no romper partidas guardadas; solo cambian los nombres visibles.
 */
export const OPPORTUNITIES: OpportunityCard[] = [
  { id: 'trabajo_ocasional', label: 'Trabajo ocasional', amount: 150_000, description: 'Les ofrecen un trabajo por unos días.' },
  { id: 'venta_objeto', label: 'Venta de un objeto que ya no utilizan', amount: 100_000, description: 'Venden algo de la casa que ya no usaban.' },
  { id: 'apoyo_red', label: 'Apoyo económico no reembolsable', amount: 100_000, description: 'Reciben un apoyo que no tienen que devolver.' },
  { id: 'premio_comunitario', label: 'Premio comunitario', amount: 50_000, description: 'La comunidad reconoce a la familia con un premio.' },
  { id: 'servicio_puntual', label: 'Servicio independiente ocasional', amount: 100_000, description: 'Les pagan por un servicio independiente de un día.' },
];

export type CardCategoryId = 'tentacion' | 'imprevisto' | 'oportunidad';

export interface CardCategory {
  id: CardCategoryId;
  /** Nombre de la categoría (plural) y de una tarjeta (singular). */
  label: string;
  singular: string;
  subtitle: string;
  instruction: string;
  description: string;
  mechanic: string;
  purpose: string;
  whatHappens: string;
  familyDecides: string;
}

/** Definición pedagógica de las tres categorías de tarjetas. */
export const CARD_CATEGORIES: Record<CardCategoryId, CardCategory> = {
  tentacion: {
    id: 'tentacion',
    label: 'Tentaciones de gasto',
    singular: 'Tentación de gasto',
    subtitle: 'Decisión voluntaria',
    instruction: 'Compra o pasa',
    description: 'Representan deseos, ofertas comerciales y gastos no esenciales. La familia puede aceptar o rechazar la compra después de discutirla.',
    mechanic: 'Conversen desde sus roles y decidan si compran. Si compran, se descuenta de su dinero disponible; si no, conservan el dinero.',
    purpose: 'Distinguir necesidades y deseos, reconocer la presión comercial y comprender el costo de oportunidad.',
    whatHappens: 'Aparece una compra opcional',
    familyDecides: 'Sí, compra o pasa',
  },
  imprevisto: {
    id: 'imprevisto',
    label: 'Imprevistos económicos',
    singular: 'Imprevisto',
    subtitle: 'Situación inesperada',
    instruction: 'Toma una tarjeta',
    description: 'Acontecimientos que alteran el presupuesto familiar y que no necesariamente dependen de las decisiones de los participantes.',
    mechanic: 'Queda registrado como algo por pagar. Decidan cómo afrontarlo: pagar todo o una parte con el dinero disponible o una reserva, pedir un crédito o dejarlo pendiente.',
    purpose: 'Comprender la incertidumbre financiera, la importancia de contar con reservas y las consecuencias del endeudamiento ante emergencias.',
    whatHappens: 'Ocurre un evento inesperado',
    familyDecides: 'Decide cómo afrontarlo',
  },
  oportunidad: {
    id: 'oportunidad',
    label: 'Oportunidades económicas',
    singular: 'Oportunidad',
    subtitle: 'Ingreso o beneficio favorable',
    instruction: 'Toma una tarjeta',
    description: 'Situaciones positivas que pueden ayudar a una familia a mejorar su presupuesto, sin recurrir necesariamente al endeudamiento.',
    mechanic: 'Reciban el beneficio indicado. Se registra una sola vez y no genera deudas.',
    purpose: 'Reconocer alternativas para mejorar los ingresos, valorar la iniciativa económica y comprender que las oportunidades pueden contribuir a la estabilidad familiar.',
    whatHappens: 'Recibe un beneficio económico',
    familyDecides: 'Aplica el beneficio de la tarjeta',
  },
};

export interface BankTier {
  principal: number;
  cost: number;
}
export interface BankProduct {
  id: 'prestamo_pequeno' | 'prestamo_grande' | 'microcredito' | 'tarjeta';
  label: string;
  description: string;
  tiers: BankTier[];
}

export const BANK_PRODUCTS: BankProduct[] = [
  {
    id: 'prestamo_pequeno',
    label: 'Préstamo pequeño',
    description: 'Dinero que entra a caja y se devuelve con un costo fijo.',
    tiers: [{ principal: 300_000, cost: 50_000 }],
  },
  {
    id: 'prestamo_grande',
    label: 'Préstamo grande',
    description: 'Más dinero hoy, más para devolver después.',
    tiers: [{ principal: 500_000, cost: 100_000 }],
  },
  {
    id: 'microcredito',
    label: 'Microcrédito',
    description: 'Un monto menor con un costo fijo.',
    tiers: [{ principal: 250_000, cost: 50_000 }],
  },
  {
    id: 'tarjeta',
    label: 'Tarjeta de crédito',
    description:
      'Se usa una sola vez por contrato. Para simplificar, el monto usado entra a caja como financiamiento.',
    tiers: [
      { principal: 75_000, cost: 20_000 },
      { principal: 150_000, cost: 40_000 },
      { principal: 225_000, cost: 60_000 },
      { principal: 300_000, cost: 80_000 },
    ],
  },
];

/** Mes en que vence un contrato según el mes en que se tomó. */
export function contractDueMonth(monthTaken: Month): Month {
  return monthTaken === 1 ? 2 : 3;
}

export type ColorId = 'azul' | 'naranja' | 'verde' | 'morado' | 'rojo';
/**
 * Colores de la ruleta tomados de referencias/ruleta.png. El verde se oscureció
 * ligeramente (#249534 → #1D8030) para que el texto blanco cumpla 4,5:1, y el
 * naranja usa texto oscuro porque el blanco no alcanza el contraste mínimo.
 */
export const PERSONAL_COLORS: { id: ColorId; label: string; hex: string; ink: string }[] = [
  { id: 'azul', label: 'Azul', hex: '#0065D2', ink: '#FFFFFF' },
  { id: 'naranja', label: 'Naranja', hex: '#FE7D12', ink: '#102431' },
  { id: 'verde', label: 'Verde', hex: '#1D8030', ink: '#FFFFFF' },
  { id: 'morado', label: 'Morado', hex: '#762B9B', ink: '#FFFFFF' },
  { id: 'rojo', label: 'Rojo', hex: '#C91332', ink: '#FFFFFF' },
];
export const COLOR_IDS: ColorId[] = PERSONAL_COLORS.map((c) => c.id);

export interface FamilyProfile {
  id: number;
  name: string;
  summary: string;
  roles: string[];
}

/** Composiciones exactas de las seis familias. Los roles aportan perspectivas, no reglas económicas. */
export const FAMILY_PROFILES: FamilyProfile[] = [
  {
    id: 1,
    name: 'Hogar biparental con hijos escolares',
    summary: 'Un ingreso formal sostiene un hogar de tres generaciones.',
    roles: ['Padre trabajador formal', 'Madre ama de casa', 'Hijo adolescente', 'Hija de primaria', 'Abuela'],
  },
  {
    id: 2,
    name: 'Madre cabeza de hogar',
    summary: 'La madre trabaja y organiza el cuidado de niños y abuela.',
    roles: ['Madre trabajadora', 'Hijo adolescente', 'Hija escolar', 'Abuela', 'Niño pequeño'],
  },
  {
    id: 3,
    name: 'Padre cabeza de hogar',
    summary: 'El padre trabaja mientras acompaña estudios y crianza.',
    roles: ['Padre trabajador', 'Hijo universitario', 'Hija escolar', 'Abuelo', 'Niño pequeño'],
  },
  {
    id: 4,
    name: 'Hogar con dos ingresos',
    summary: 'Dos personas trabajan; el ingreso del juego es el mismo que el de las demás familias.',
    roles: ['Padre trabajador', 'Madre trabajadora', 'Hijo universitario', 'Hija adolescente', 'Abuela'],
  },
  {
    id: 5,
    name: 'Hogar con ingresos informales',
    summary: 'El trabajo informal hace que cada semana se sienta distinta.',
    roles: ['Padre trabajador informal', 'Madre trabajadora informal', 'Hijo adolescente', 'Hija escolar', 'Abuela'],
  },
  {
    id: 6,
    name: 'Hogar con carga de salud',
    summary: 'El cuidado de la abuela atraviesa las conversaciones del hogar.',
    roles: ['Padre trabajador', 'Madre trabajadora', 'Hijo adolescente', 'Hija escolar', 'Abuela enferma'],
  },
];

export const REFLECTION_QUESTIONS: { id: string; text: string }[] = [
  { id: 'principal', text: 'Si todas las familias comenzaron con el mismo ingreso, ¿por qué terminaron en situaciones financieras diferentes?' },
  { id: 'decision_dificil', text: '¿Cuál fue la decisión más difícil?' },
  { id: 'gasto_discusion', text: '¿Qué gasto generó mayor discusión?' },
  { id: 'necesidades', text: '¿Qué necesidades escucharon más y cuáles menos?' },
  { id: 'cambios', text: '¿Qué cambiarían?' },
  { id: 'decisiones_circunstancias', text: '¿Qué dependió de sus decisiones y qué de las circunstancias?' },
];

export const OBSERVATION_CRITERIA: { id: string; label: string }[] = [
  { id: 'necesidades_deseos', label: 'Identificación de necesidades y deseos' },
  { id: 'planificacion', label: 'Planificación' },
  { id: 'credito', label: 'Comprensión del crédito' },
  { id: 'participacion', label: 'Participación y escucha' },
  { id: 'imprevistos', label: 'Ajuste ante imprevistos' },
  { id: 'registro', label: 'Registro' },
  { id: 'circunstancias', label: 'Reflexión sobre circunstancias' },
];

/** Fases del Doble Diamante asociadas a cada mes (guía de conversación). */
export const DOUBLE_DIAMOND = [
  { id: 'descubrir', label: 'Descubrir', prompt: '¿Qué necesita cada integrante este mes? Escuchen antes de decidir.' },
  { id: 'definir', label: 'Definir', prompt: '¿Qué es imprescindible y qué puede esperar?' },
  { id: 'desarrollar', label: 'Desarrollar', prompt: '¿Qué alternativas tienen? Comparen antes de pagar o pedir crédito.' },
  { id: 'entregar', label: 'Entregar', prompt: 'Decidan, registren y revisen el resultado juntos.' },
];
