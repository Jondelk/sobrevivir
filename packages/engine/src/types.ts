import type { TileKind } from './board';
import type { ColorId, CommitmentConcept, Month, StationId, BankProduct } from './constants';

export type Phase =
  | 'preparacion'
  | 'inicio_mes'
  | 'esperando_ruleta'
  | 'esperando_dado'
  | 'movimiento'
  | 'resolucion'
  | 'esperando_validacion'
  | 'gestion'
  | 'cierre_mes'
  | 'finalizado';

export const PHASE_LABEL: Record<Phase, string> = {
  preparacion: 'Preparación',
  inicio_mes: 'Inicio de mes',
  esperando_ruleta: 'Girar la ruleta',
  esperando_dado: 'Lanzar el dado',
  movimiento: 'Movimiento',
  resolucion: 'Resolver la casilla',
  esperando_validacion: 'Esperando validación',
  gestion: 'Gestión de cuentas',
  cierre_mes: 'Cierre mensual',
  finalizado: 'Finalizado',
};

export type GameMode = 'local' | 'aula';

export type DeckType = 'imprevisto' | 'oportunidad' | 'tentacion';

export interface Deck {
  draw: string[];
  discard: string[];
  reshuffles: number;
}

export interface Participant {
  role: string;
  colorId: ColorId;
  nickname: string;
}

export type ActorRole = 'local' | 'familia' | 'estacion' | 'facilitador' | 'sistema';

export interface Actor {
  role: ActorRole;
  familyId?: string;
  stationId?: StationId;
  label: string;
}

export type ObligationKind = 'compromiso' | 'imprevisto' | 'reintegro';

export interface Obligation {
  id: string;
  kind: ObligationKind;
  concept: CommitmentConcept | 'imprevisto' | 'reintegro';
  label: string;
  month: Month;
  original: number;
  createdTurn: number;
  eventId?: string;
  cardId?: string;
}

export interface Reserve {
  id: string;
  label: string;
  obligationId?: string;
  month: Month;
  createdTurn: number;
}

export interface BankContract {
  id: string;
  productId: BankProduct['id'];
  label: string;
  principal: number;
  cost: number;
  monthTaken: Month;
  dueMonth: Month;
  turnTaken: number;
}

export type MovementType =
  | 'ingreso_mensual'
  | 'oportunidad'
  | 'desembolso_credito'
  | 'pago_obligacion'
  | 'compra'
  | 'abono_capital'
  | 'abono_costo'
  | 'registro_obligacion'
  | 'registro_costo_credito'
  | 'reserva'
  | 'liberacion_reserva';

export type Direction = 'entrada' | 'salida' | 'neutro';

export interface MovementRef {
  obligationId?: string;
  cardId?: string;
  eventId?: string;
  contractId?: string;
  reserveId?: string;
  itemId?: string;
  requestId?: string;
}

export interface Movement {
  id: string;
  familyId: string;
  month: Month;
  turn: number;
  type: MovementType;
  direction: Direction;
  amount: number;
  description: string;
  ref: MovementRef;
  justification?: string;
  actor: Actor;
  validation?: { requestId: string; by: Actor; at: string };
  at: string;
}

export interface ActiveEvent {
  eventId: string;
  tileIndex: number;
  kind: TileKind;
  month: Month;
  turn: number;
  deck?: DeckType;
  cardId?: string;
  obligationId?: string;
  offers?: string[];
  purchasedItemId?: string;
  collected?: boolean;
}

export type RequestStatus = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';

export interface ValidationRequest {
  id: string;
  familyId: string;
  station: StationId;
  concept: string;
  amount: number;
  actionLabel: string;
  command: EconomicCommand;
  status: RequestStatus;
  createdAt: string;
  requestedBy: Actor;
  resolvedAt?: string;
  resolvedBy?: Actor;
  note?: string;
  month: Month;
  turn: number;
}

export interface DecisionEntry {
  id: string;
  month: Month;
  turn: number;
  type:
    | 'compra'
    | 'pasar_compra'
    | 'credito'
    | 'abono'
    | 'reserva'
    | 'liberacion'
    | 'pago'
    | 'nota_turno'
    | 'cierre'
    | 'intervencion_facilitador'
    | 'solicitud_rechazada'
    | 'solicitud_cancelada';
  text: string;
  actor: Actor;
  at: string;
}

export interface SpinResult {
  turn: number;
  month: Month;
  sector: number;
  colorId: ColorId;
  participantIndex: number;
}

export interface RollResult {
  turn: number;
  month: Month;
  value: number;
  from: number;
  to: number;
  reachedStart: boolean;
  discardedSteps: number;
}

export interface FamilyState {
  rulesVersion: string;
  id: string;
  profileId: number;
  name: string;
  mode: GameMode;
  participants: Participant[];
  phase: Phase;
  phaseBeforeValidation?: Phase;
  month: Month;
  turn: number;
  position: number;
  lastSpin?: SpinResult;
  lastRoll?: RollResult;
  decks: Record<DeckType, Deck>;
  activeEvent: ActiveEvent | null;
  obligations: Obligation[];
  reserves: Reserve[];
  contracts: BankContract[];
  movements: Movement[];
  requests: ValidationRequest[];
  decisions: DecisionEntry[];
  closedMonths: Month[];
  reflections: {
    monthly: Partial<Record<'1' | '2' | '3', string>>;
    final: Record<string, string>;
  };
  seq: number;
  processedOps: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Comandos económicos que, en modo aula, requieren validación de una estación. */
export type EconomicCommand =
  | { type: 'pagarObligacion'; obligationId: string; amount: number; reserveId?: string; justificacion?: string }
  | { type: 'comprar'; itemId: string; justificacion?: string }
  | { type: 'contratarCredito'; productId: BankProduct['id']; tierIndex: number; justificacion?: string }
  | { type: 'abonarCredito'; amount: number; reserveId?: string; justificacion?: string }
  | { type: 'cobrarOportunidad' }
  | { type: 'confirmarCierre' };

export type FamilyCommand =
  | EconomicCommand
  | { type: 'configurarParticipantes'; participants: { nickname: string; colorId: ColorId }[] }
  | { type: 'comenzarPartida' }
  | { type: 'recibirIngreso' }
  | { type: 'girarRuleta' }
  | { type: 'lanzarDado' }
  | { type: 'completarMovimiento' }
  | { type: 'reservar'; amount: number; label: string; obligationId?: string }
  | { type: 'liberarReserva'; reserveId: string; amount?: number }
  | { type: 'pasarCompra'; justificacion?: string }
  | { type: 'terminarResolucion' }
  | { type: 'finalizarTurno'; nota?: string }
  | { type: 'guardarReflexionMes'; texto: string }
  | { type: 'guardarReflexionFinal'; respuestas: Record<string, string> }
  | { type: 'cancelarSolicitud'; requestId: string }
  | { type: 'resolverSolicitud'; requestId: string; aprobar: boolean; nota?: string };

export type RngPurpose = 'ruleta' | 'dado' | 'barajar';

/** Fuente de aleatoriedad. Devuelve un entero en [0, n). */
export interface Rng {
  int(n: number, purpose: RngPurpose): number;
}

export interface EngineContext {
  rng: Rng;
  actor: Actor;
  now?: () => string;
}
