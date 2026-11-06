import { z } from 'zod';
import { COLOR_IDS } from './constants';
import type { FamilyCommand } from './types';

const money = z.number().int().positive().max(100_000_000);
const text = (max: number) => z.string().max(max);
const id = z.string().min(1).max(80);
const colorId = z.enum(COLOR_IDS as [string, ...string[]]);

export const familyCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('pagarObligacion'),
    obligationId: id,
    amount: money,
    reserveId: id.optional(),
    justificacion: text(280).optional(),
  }),
  z.object({ type: z.literal('comprar'), itemId: id, justificacion: text(280).optional() }),
  z.object({
    type: z.literal('contratarCredito'),
    productId: z.enum(['prestamo_pequeno', 'prestamo_grande', 'microcredito', 'tarjeta']),
    tierIndex: z.number().int().min(0).max(3),
    justificacion: text(280).optional(),
  }),
  z.object({
    type: z.literal('abonarCredito'),
    amount: money,
    reserveId: id.optional(),
    justificacion: text(280).optional(),
  }),
  z.object({ type: z.literal('cobrarOportunidad') }),
  z.object({ type: z.literal('confirmarCierre') }),
  z.object({
    type: z.literal('configurarParticipantes'),
    participants: z.array(z.object({ nickname: text(40), colorId })).length(5),
  }),
  z.object({ type: z.literal('comenzarPartida') }),
  z.object({ type: z.literal('recibirIngreso') }),
  z.object({ type: z.literal('girarRuleta') }),
  z.object({ type: z.literal('lanzarDado') }),
  z.object({ type: z.literal('completarMovimiento') }),
  z.object({ type: z.literal('reservar'), amount: money, label: text(60), obligationId: id.optional() }),
  z.object({ type: z.literal('liberarReserva'), reserveId: id, amount: money.optional() }),
  z.object({ type: z.literal('pasarCompra'), justificacion: text(280).optional() }),
  z.object({ type: z.literal('terminarResolucion') }),
  z.object({ type: z.literal('finalizarTurno'), nota: text(400).optional() }),
  z.object({ type: z.literal('guardarReflexionMes'), texto: text(2000) }),
  z.object({ type: z.literal('guardarReflexionFinal'), respuestas: z.record(z.string().max(40), text(2000)) }),
  z.object({ type: z.literal('cancelarSolicitud'), requestId: id }),
  z.object({ type: z.literal('resolverSolicitud'), requestId: id, aprobar: z.boolean(), nota: text(280).optional() }),
]);

export const operationSchema = z.object({
  opId: z.string().min(8).max(80),
  command: familyCommandSchema,
});

export function parseCommand(input: unknown): FamilyCommand {
  return familyCommandSchema.parse(input) as FamilyCommand;
}
