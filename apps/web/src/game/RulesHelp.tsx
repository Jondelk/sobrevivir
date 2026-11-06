import { CARD_CATEGORIES, COMMITMENTS, COMMITMENT_CONCEPTS, MONTHLY_INCOME, OPPORTUNITIES, PURCHASES, RULES_VERSION, SURPRISES, formatCOP } from '@sobrevivir/engine';

/** Reglas esenciales, divididas en secciones que se abren cuando se necesitan. */
export function RulesHelp({ essentialOnly }: { essentialOnly?: boolean }) {
  return (
    <div className="rules">
      <details open={essentialOnly}>
        <summary>Cómo es un turno</summary>
        <ol>
          <li>Giran la ruleta: el color indica quién lanza el dado y mueve la ficha. No decide por todos.</li>
          <li>Lanzan el dado de seis caras y mueven la ficha.</li>
          <li>Resuelven la casilla: conversan, deciden y registran.</li>
          <li>Gestionan cuentas si lo necesitan y finalizan el turno.</li>
        </ol>
        <p>Si el dado alcanza o pasa Inicio, la ficha se detiene allí, los pasos sobrantes se descartan y se hace el cierre del mes.</p>
      </details>
      <details open={essentialOnly}>
        <summary>Dinero y compromisos</summary>
        <p>
          Cada mes todas las familias reciben {formatCOP(MONTHLY_INCOME)}, también el hogar con dos ingresos. Cada mes aparecen cuatro
          compromisos aunque no caigan en sus casillas:{' '}
          {COMMITMENT_CONCEPTS.map((c) => `${COMMITMENTS[c].label} ${formatCOP(COMMITMENTS[c].amount)}`).join(', ')}.
        </p>
        <p>Pueden pagar todo, una parte o dejarlo pendiente. Lo pendiente pasa al mes siguiente con el mismo registro.</p>
      </details>
      <details open={essentialOnly}>
        <summary>Reservar</summary>
        <p>
          Reservar separa dinero para algo importante. No es un gasto, no paga la obligación y no aumenta el efectivo: reduce el dinero
          disponible. Se puede liberar, y liberar tampoco es un ingreso.
        </p>
      </details>
      <details open={essentialOnly}>
        <summary>Tentaciones, imprevistos y oportunidades</summary>
        <p>
          Estas tarjetas no son gastos obligatorios: el arriendo, la alimentación, el transporte y la educación existen aparte, cada mes.
          Ninguna decisión se califica sola; se conversa según lo que la familia necesita y lo que produce.
        </p>
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Cómo se diferencian las tres categorías</caption>
            <thead>
              <tr><th scope="col">Categoría</th><th scope="col">¿Qué sucede?</th><th scope="col">¿La familia decide?</th></tr>
            </thead>
            <tbody>
              {(['tentacion', 'imprevisto', 'oportunidad'] as const).map((id) => {
                const c = CARD_CATEGORIES[id];
                return (
                  <tr key={id}>
                    <th scope="row">
                      <span className={`chip chip-cat-${id}`}>{c.singular}</span>
                    </th>
                    <td>{c.whatHappens}</td>
                    <td>{c.familyDecides}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
      {!essentialOnly && (
        <>
          <details>
            <summary>Compras y tentaciones</summary>
            <p>Catálogo: {PURCHASES.map((p) => `${p.label} ${formatCOP(p.price)}`).join(', ')}.</p>
            <p>
              En el Centro Comercial eligen como máximo una compra. En Compra Opcional y Tentación de Gasto sacan una tarjeta de ese
              catálogo. En la Salida Familiar eligen cine, cena o nada. Comprar nunca es obligatorio y caer en una casilla no cuesta dinero.
            </p>
          </details>
          <details>
            <summary>Imprevistos</summary>
            <p>Mazo: {SURPRISES.map((s) => `${s.label} ${formatCOP(s.amount)}`).join(', ')}.</p>
            <p>
              Un imprevisto crea una obligación que pueden pagar completa, en parte o dejar pendiente. La pérdida parcial de ingresos se
              representa, para simplificar, como un reintegro de $300.000 del ingreso ya recibido: si no se paga queda pendiente, no se
              descuenta del ingreso siguiente y no es un crédito bancario.
            </p>
          </details>
          <details>
            <summary>Oportunidades</summary>
            <p>{OPPORTUNITIES.map((o) => `${o.label}: ${formatCOP(o.amount)}`).join('; ')}. Cada aparición se recibe una sola vez y no genera deudas.</p>
            <p className="muted">Estas cinco tarjetas son una propuesta de la versión piloto, posterior al documento pedagógico original.</p>
          </details>
          <details>
            <summary>Banco</summary>
            <p>
              Un contrato activo por familia. El banco siempre muestra cuánto reciben, cuánto cuesta y cuánto devuelven. El costo se
              registra una sola vez; no hay intereses compuestos, multas ni costos de mora. Los abonos van primero a capital y luego al
              costo. Los contratos del mes 1 vencen al cierre del mes 2; los de los meses 2 y 3, al cierre del mes 3. Un contrato vencido
              sigue activo mientras tenga saldo.
            </p>
            <p>Para simplificar, el monto usado de la tarjeta de crédito entra a caja como financiamiento y se usa una sola vez por contrato.</p>
          </details>
          <details>
            <summary>Mazos y tarjetas</summary>
            <p>
              Cada familia tiene sus propios mazos de imprevistos, oportunidades y compras. Las tarjetas usadas van al descarte; cuando un
              mazo se agota, se baraja el descarte. Los mazos no se reinician al cambiar de mes.
            </p>
          </details>
          <p className="muted">Reglas de la versión {RULES_VERSION}.</p>
        </>
      )}
    </div>
  );
}
