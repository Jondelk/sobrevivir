# Sobrevivir al mes

**Educación financiera para no financieros** — una experiencia educativa de PIXELES.

Juego de mesa digital para conversar sobre las decisiones económicas de un hogar durante tres meses. Todas las familias empiezan con el mismo ingreso. No hay ganadores, perdedores, ranking ni eliminación por deudas: el dinero final se lee junto con lo pendiente y las decisiones.

- **Demostración local:** una o varias familias en un mismo navegador, sin servidor. Se guarda en el navegador (`localStorage`).
- **Sesión de aula:** servidor + MongoDB + Socket.IO. Un dispositivo por familia, un acceso por estación y un panel de facilitador.

Ambos modos usan **el mismo motor de reglas** (`packages/engine`).

---

## 1. Requisitos

- Node.js 20.19 o superior (probado con Node 22).
- npm 10.
- MongoDB 6 o superior **solo** para la sesión de aula.

## 2. Instalar

```bash
npm install
cp .env.example .env      # solo si usará el modo aula; edite MONGODB_URI
```

## 3. Ejecutar

### Demostración local (sin servidor ni base de datos)

```bash
npm run dev               # http://localhost:5173
```

Abra la página, pulse **Crear demostración**, elija familias, asigne nombres y colores y pulse **Comenzar la demostración**. La partida sobrevive a recargas. «Continuar partida guardada» la retoma. No hay sincronización entre dispositivos.

### Sesión de aula (con MongoDB)

```bash
# .env con MONGODB_URI=mongodb://localhost:27017
npm run build             # compila la web
npm start                 # servidor en http://localhost:3001 (API + Socket.IO + web)
```

Para desarrollo con recarga en caliente: `npm run dev:server` (puerto 3001) y `npm run dev` (puerto 5173, con proxy a `/api` y `/socket.io`).

**Iniciar una sesión de aula**

1. El facilitador abre la aplicación y pulsa **Crear sala de aula**, elige las familias y pulsa **Crear sala**.
2. En **Accesos** aparecen los enlaces privados de cada familia y de cada estación (Banco, Supermercado, Centro Comercial, Empresa / Servicios). Comparta cada enlace solo con su grupo. También pueden entrar en **Unirse a una sala** con el código de la sala y su clave.
3. El código público de la sala, por sí solo, **no** da permisos. La clave del facilitador solo existe en el dispositivo que creó la sala.
4. Cada familia asigna nombres y colores y pulsa **Guardar y comenzar**. Las familias avanzan de forma independiente.
5. Las operaciones económicas quedan **pendientes de validación** y no mueven dinero hasta que la estación correspondiente las valide. El facilitador puede atenderlas como respaldo (queda registrado), pausar o reanudar la sesión, ver cada partida en modo lectura, consultar el registro, exportar CSV y anotar observaciones cualitativas.

Si MongoDB no está configurado, el servidor arranca igual: la demostración local funciona y **Crear sala** explica que falta configurar `MONGODB_URI`. No se simula multijugador.

## 4. Probar

```bash
npm run typecheck   # tipos de motor, servidor y web
npm test            # pruebas unitarias del motor y pruebas del servidor (Vitest)
npm run test:e2e    # recorridos en navegador (Playwright: escritorio y celular)
npm run check       # typecheck + test + build
```

`npm run test:e2e` compila la web e inicia el servidor con `SOBREVIVIR_STORE=memoria-pruebas`: un almacén en memoria **solo para pruebas** que implementa la misma semántica de versiones que MongoDB. Si su Playwright no encuentra navegador, ejecute `npx playwright install chromium`.

## 5. Arquitectura

```
packages/engine   Motor de reglas puro en TypeScript (sin E/S). Estados, comandos, mazos,
                  banco, validaciones, selectores contables, esquemas zod y exportación CSV.
apps/server       Express 5 + Socket.IO 4 + driver oficial de MongoDB. Autoridad en modo aula.
apps/web          React 19 + Vite. Modo local (motor + localStorage) y modo aula (API + socket).
e2e               Pruebas Playwright.
referencias       Recursos visuales aprobados (pendientes; ver referencias/README.md).
```

**Motor.** `applyCommand(estado, comando, contexto)` devuelve un estado nuevo o lanza `RuleError`. Nunca muta la entrada. La aleatoriedad llega por una interfaz `Rng`: en producción es `cryptoRng` (en el navegador para el modo local y en el servidor para el aula); las pruebas usan una fuente controlada que no se exporta al paquete público.

**Contabilidad derivada.** No existe un campo «saldo». El efectivo, las reservas, lo pagado de cada obligación y el capital/costo de cada contrato se **derivan del registro de movimientos**:

- Efectivo = Σ entradas − Σ salidas.
- Disponible = efectivo − reservas.
- Pendiente de obligación = importe original − pagos aplicados.
- Deuda bancaria = capital pendiente + costo pendiente.

Registrar una deuda, un imprevisto o una reserva crea movimientos de tipo **neutro** (auditables, sin efecto en caja). No hay comando para editar saldos.

**Servidor.** Cada familia es un documento de MongoDB que contiene su estado completo (posición, mazos, obligaciones, movimientos, solicitudes). Cada comando:

1. autentica la clave (se guardan solo hashes SHA-256) y comprueba el rol;
2. valida la entrada con zod;
3. se serializa por familia y aplica el motor con aleatoriedad del servidor;
4. guarda con **concurrencia optimista** (`replaceOne` con la versión esperada) en una sola escritura atómica, de modo que movimiento, obligación y solicitud cambian juntos;
5. es **idempotente** por `opId` (reintentos y dobles clics no duplican).

Socket.IO avisa a la familia y al personal de la sala; al reconectar el cliente pide una instantánea completa. Las familias solo reciben su propio estado.

**Web.** Enrutado por fragmento (`#/…`), tablero de componentes en una cuadrícula CSS de 7 × 7 (no es una imagen de fondo), ruleta SVG y dado que solo **representan** el resultado ya guardado. En modo local, una versión en el almacenamiento evita que dos pestañas se sobrescriban: la segunda pestaña pasa a solo lectura y pide recargar.

## 6. Reglas implementadas — versión `piloto-1.0`

- **Tablero:** 24 casillas perimetrales sin numeración (1 inicio, 4 compromisos, 2 bancos, 5 imprevistos, 5 oportunidades, 2 centros comerciales, 2 compras opcionales, 2 tentaciones, 1 salida familiar). Inicio abajo a la izquierda; sube por la izquierda, recorre arriba, baja por la derecha y vuelve por abajo.
- **Turno:** ruleta de 5 sectores iguales (solo elige quién lanza) → dado de 6 caras → movimiento → resolución → gestión → fin del turno. No se puede girar ni lanzar dos veces.
- **Inicio:** si el dado alcanza o supera Inicio, la ficha se detiene allí, se descartan los pasos sobrantes, no se activa otra casilla y se abre el cierre. El ingreso siguiente se entrega solo después de confirmar el cierre (en aula, con autorización del Banco). Tras el tercer cierre la partida termina sin cuarto ingreso.
- **Ingreso y compromisos:** $4.000.000 por mes (una entrega por familia y mes). Cada mes: arriendo $1.500.000, alimentación $900.000, transporte $400.000, educación $600.000 ($3.400.000), existan o no visitas a esas casillas. Los atrasos conservan su ID.
- **Pagar, reservar, dejar pendiente:** pagos parciales sobre una obligación elegida; reservas que no son gasto, no aumentan el efectivo y pueden liberarse; pagar desde una reserva reduce reserva y efectivo. Nunca hay efectivo negativo; una familia sin dinero sigue jugando.
- **Compras:** catálogo exacto de seis artículos. Centro Comercial: máximo una compra. Compra Opcional y Tentación: una tarjeta del mazo de compras. Salida Familiar: cine, cena o nada. Sin fondos, la oferta sigue abierta mientras liberan una reserva o piden crédito.
- **Imprevistos:** crean una obligación con ID propio; la aparición no descuenta efectivo. La *pérdida parcial de ingresos* se representa como **reintegro** de $300.000 del ingreso ya recibido (no se descuenta del ingreso siguiente ni es crédito). Esta simplificación se explica en la ayuda del juego.
- **Oportunidades (configuración del piloto):** trabajo ocasional $150.000, venta de un objeto $100.000, apoyo de una red cercana $100.000, premio comunitario $50.000, servicio puntual $100.000. Una sola vez por aparición.
- **Mazos:** tres mazos por familia (5 imprevistos, 5 oportunidades, 6 compras), barajados al inicio; la tarjeta activa se conserva hasta resolverse y luego va al descarte; al agotarse se baraja el descarte; no se reinician al cambiar de mes.
- **Banco:** préstamo pequeño (300.000 + 50.000), préstamo grande (500.000 + 100.000), microcrédito (250.000 + 50.000), tarjeta en tramos (75/20, 150/40, 225/60, 300/80 mil). Un contrato activo por familia; vencido sigue activo mientras tenga saldo; costo registrado una vez; sin interés compuesto ni multas; abonos primero a capital y luego al costo; vencimiento al cierre del mes 2 (contratos del mes 1) o del mes 3 (meses 2 y 3). Para simplificar, el monto usado de la tarjeta entra a caja como financiamiento.
- **Estaciones:** Banco (desembolsos, abonos, oportunidades, inicio del mes siguiente), Supermercado (alimentación), Centro Comercial (compras), Empresa / Servicios (arriendo, transporte, educación, imprevistos). Mientras hay una solicitud pendiente, la familia no puede hacer otras operaciones económicas; al validar se revalidan saldo y estado. En modo local la validación es inmediata con las mismas reglas.

Los valores del piloto están en `packages/engine/src/constants.ts`.

## 7. Resultados de las pruebas (ejecutadas en este entorno)

| Conjunto | Resultado |
| --- | --- |
| `npm run typecheck` (motor, servidor, web) | ✅ sin errores |
| Vitest — motor (`packages/engine/test`) | ✅ 31 pruebas: caso numérico de aceptación de tres meses (entradas $12.300.000 − salidas $11.700.000 = $600.000), las 21 reglas obligatorias, geometría del tablero, validación de entradas y una simulación de 300 jugadas comprobando invariantes |
| Vitest — servidor (`apps/server/test`) | ✅ 11 pruebas: sin MongoDB responde 503 con explicación; el código público no da permisos; roles por clave; una familia no ve ni modifica otra; una estación no actúa como facilitador ni como familia; saldos del cliente rechazados; idempotencia; **dos aprobaciones simultáneas → una aplicada y otra 409**; pausa; dado decidido por el servidor; notificación en tiempo real; rechazo de sockets sin clave |
| Playwright — escritorio | ✅ 8 recorridos: crear demostración, completar un turno, comprar y rechazar, reservar y pagar, contratar y abonar, cerrar un mes y recuperar tras recargar, completar el juego (3 ingresos, reflexión, CSV), **aprobar una operación en modo conectado** con tres contextos de navegador (familia, estación, facilitador) |
| Playwright — celular (Pixel 7) | ✅ acciones primero, tablero completo bajo demanda, sin desplazamiento horizontal, diálogo de crédito utilizable |

**No ejecutado:** las pruebas contra un MongoDB real. En este entorno la descarga del binario de MongoDB está bloqueada por la red, así que el modo conectado se probó con el almacén en memoria de pruebas. `MongoStore` (`apps/server/src/store/mongo.ts`) usa el driver oficial con índices únicos y `replaceOne` condicionado por versión, pero **no se verificó contra un servidor MongoDB**. Para hacerlo: configure `MONGODB_URI`, ejecute `npm start` y repita el recorrido de aula.

## 8. Recursos visuales

La carpeta `referencias` no existía al construir esta versión: **faltan el logotipo de PIXELES, el tablero y la ruleta aprobados**. Se usa una composición tipográfica provisional y no se inventó ningún logotipo. Ver [`referencias/README.md`](referencias/README.md) para la ubicación de cada recurso y cómo reemplazarlo (logotipo: `apps/web/public/marca/` + `LOGO_PIXELES_SRC` en `apps/web/src/brand.tsx`; colores: `:root` en `apps/web/src/styles.css`).

## 9. Limitaciones conocidas

- MongoDB real no verificado en este entorno (ver §7).
- El servidor serializa comandos por familia dentro de un proceso y usa versiones en la base de datos; con varias instancias la versión evita escrituras perdidas, pero no se probó un despliegue multi-instancia.
- Las claves de aula viajan en el enlace (`#/acceso/CÓDIGO/CLAVE`); el fragmento no se envía al servidor, pero quien tenga el enlace tiene el acceso. Comparta cada enlace solo con su grupo. No hay límite de intentos de clave; para uso fuera de un aula, agregue limitación de peticiones en el proxy.
- La demostración local guarda en `localStorage` del navegador: borrar los datos del sitio borra la partida.
- No se desplegó ni publicó nada externamente.
