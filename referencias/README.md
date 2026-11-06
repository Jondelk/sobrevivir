# Referencias visuales

Recursos aprobados de PIXELES e integración en la aplicación.

| Archivo | Contenido |
| --- | --- |
| `logo-pixeles.png` (1536×1024, fondo crema, sin transparencia) | Marca completa del juego: «SOBREVIVIR» (azul profundo), «AL MES» (turquesa), trazo naranja, «Educación financiera para no financieros» y «Una experiencia educativa de PIXELES». |
| `tablero.png` (1254×1254) | Tablero 7 × 7 con marco azul profundo, casillas con cabecera de color y título en mayúsculas, cuerpo claro con ilustración plana y frase breve; centro con la marca, reglas resumidas y los tres mazos; flechas exteriores con el sentido del recorrido. |
| `ruleta.png` (1254×1254) | Rueda fija de cinco sectores iguales (Azul arriba; en sentido horario Naranja, Verde, Morado, Rojo) con nombres en mayúsculas blancas, borde azul profundo, centro crema y una flecha recortable que gira sobre el centro. |

## Qué quedó integrado y dónde

| Recurso | Ubicación en la app | Notas |
| --- | --- | --- |
| Logotipo | `apps/web/public/marca/logo-pixeles.png` (copia idéntica byte a byte), referenciado por `LOGO_PIXELES_SRC` en `apps/web/src/brand.tsx` | Sustituye la composición tipográfica provisional en inicio, barras superiores, preparación, sala y resumen imprimible. Texto alternativo: «Sobrevivir al mes. Educación financiera para no financieros. Una experiencia educativa de PIXELES». Como el logotipo ya incluye el crédito a PIXELES, el crédito en texto no se repite. No se recortó ni se recoloreó: el fondo crema se funde con la página mediante `mix-blend-mode: darken` en CSS. |
| Ilustraciones de casillas | `apps/web/public/marca/casillas/*.png` (13 archivos, ~230 KB) | Recortadas de `tablero.png`, con el fondo crema conectado al borde vuelto transparente. Se usan dentro de cada casilla y en la cabecera de la casilla activa. Inventario: inicio, arriendo, alimentación, transporte, educación, imprevisto, oportunidad, centro comercial, compra opcional, tentación, salida familiar, banco y la bolsa del mazo de tentaciones (reservada). |
| Estilo del tablero | `apps/web/src/components/Board.tsx`, `apps/web/src/styles.css` | Sigue siendo una cuadrícula interactiva de 7 × 7 (no una imagen de fondo). Cabecera de color con el nombre en mayúsculas, cuerpo claro con ilustración, importe mensual en los compromisos, marco azul profundo y flechas exteriores del sentido del recorrido. |
| Estilo de la ruleta | `apps/web/src/components/Roulette.tsx` | Como en la referencia, la rueda queda fija y gira la flecha con anillo en el pivote. Cinco sectores iguales con el nombre del color. El resultado lo decide el motor o el servidor una sola vez; con «reducir movimiento» la flecha salta directamente al resultado. |
| Tipografía | Nunito (`@fontsource-variable/nunito`, servida localmente) | La referencia usa una sans redondeada y muy gruesa; Nunito es la más cercana disponible sin servicios externos. Reemplaza a Atkinson Hyperlegible y Bricolage Grotesque. |

## Paleta extraída

| Uso | Referencia | En la app | Ajuste de contraste |
| --- | --- | --- | --- |
| Fondo crema | `#F5EDE2` (logotipo) | `--cream` | — |
| Azul profundo (texto) | `#102431` (logotipo) | `--ink` | 13,7:1 sobre crema |
| Marco del tablero | `#0C273C` | `--frame` | — |
| Turquesa (Inicio) | `#038B88` | `--turq` en formas grandes; `--turq-d` `#037D7A` en bandas y botones con texto | Blanco sobre `#038B88` = 4,16:1 (insuficiente); `#037D7A` = 4,98:1 |
| Terracota (compromisos) | `#B85241` | `--terra` | Blanco 4,86:1 |
| Ámbar (imprevistos) | `#EA9D34` | `--amber` | Blanco 2,24:1 (insuficiente): **texto azul profundo** sobre ámbar (7,11:1), a diferencia de la referencia, que usa blanco |
| Verde (oportunidades) | `#609144` | `--green` `#4A7F38` | Blanco 3,73:1 y azul 4,27:1 (insuficientes): verde oscurecido, blanco 4,79:1 |
| Violeta (compras) | `#92559A` | `--violet` | Blanco 5,27:1 |
| Azul banco | `#35486A` aprox. | `--bank` `#33476A` | Blanco ≈10:1 |
| Naranja (trazo) | `#ED863B` | `--orange` (foco y casilla activa) | Solo decorativo |

Colores de la ruleta (`PERSONAL_COLORS` en `packages/engine/src/constants.ts`):

| Color | Referencia | En la app | Texto |
| --- | --- | --- | --- |
| Azul | `#0065D2` | igual | blanco 5,54:1 |
| Naranja | `#FE7D12` | igual | **azul profundo** 6,18:1 (blanco daría 2,57:1) |
| Verde | `#249534` | `#1D8030` | blanco 5,02:1 (el original daba 3,87:1) |
| Morado | `#762B9B` | igual | blanco 8,11:1 |
| Rojo | `#C91332` | igual | blanco 5,80:1 |

## Diferencias entre las referencias y las reglas

- **Orden y geometría del tablero:** coinciden exactamente con `packages/engine/src/board.ts` (24 casillas, Inicio abajo a la izquierda, sube por la izquierda, recorre arriba, baja por la derecha y vuelve por abajo; las flechas de la referencia indican el mismo sentido). No hubo que corregir nada.
- **«Puedes pagar al terminar tu turno»** (centro del tablero): la aplicación permite además pagar al iniciar el mes, al resolver la casilla y en el cierre, como exigen las reglas. No es una contradicción, pero la app es más amplia.
- **«Si cae en una línea, gira otra vez»** (ruleta física): en la versión digital no hay líneas, porque el resultado es siempre un sector y se decide una sola vez. No se implementa un nuevo giro.
- **Flecha recortable:** en la app la flecha gira sobre la rueda fija, como en la referencia; antes giraba la rueda.
- **Textos blancos sobre ámbar, verde y naranja:** se cambiaron a combinaciones con contraste suficiente (ver las tablas).
- **Centro del tablero:** en la referencia muestra la marca y un resumen de reglas; en la app el centro es el área de juego (ruleta, dado, casilla activa y acciones). La marca está en la barra superior y las reglas en la pestaña «Reglas» y en la ayuda contextual.
- **Numeración:** ni la referencia ni la app muestran números de casilla.

## Pendientes y limitaciones

- No hay un logotipo aislado de PIXELES: el archivo aprobado es la marca del juego con el crédito incluido. Si existe un logotipo propio del estudio, guárdelo aquí y avise para mostrarlo por separado.
- `logo-pixeles.png` pesa 1,25 MB y se sirve sin modificar. Se descarga una vez y queda en caché, pero una versión optimizada (por ejemplo SVG o WebP de la misma marca) aceleraría la primera carga en celulares. Requiere un archivo aprobado por PIXELES.
- Las ilustraciones son recortes de una imagen rasterizada; si existen los originales vectoriales, conviene reemplazar los archivos de `apps/web/public/marca/casillas/` con el mismo nombre.

## Cómo reemplazar un recurso

1. Guarde el nuevo original aquí.
2. Logotipo: cópielo a `apps/web/public/marca/` y actualice `LOGO_PIXELES_SRC` en `apps/web/src/brand.tsx`.
3. Ilustraciones: reemplace el archivo con el mismo nombre en `apps/web/public/marca/casillas/` (PNG con transparencia o SVG; si cambia la extensión, actualice `TILE_ART` en `brand.tsx`).
4. Colores: variables de `:root` en `apps/web/src/styles.css` y `PERSONAL_COLORS` en `packages/engine/src/constants.ts`. Verifique el contraste (4,5:1 para texto normal).
5. Ejecute `npm run typecheck && npm test && npm run build && npm run test:e2e`.
