# Registro de avance

1. Inspección: repositorio vacío (solo README), sin carpeta `referencias`. Se creó el proyecto desde cero (monorepo npm).
2. Motor de reglas compartido (`packages/engine`): estados, mazos, banco, validaciones, contabilidad derivada del registro. Caso de aceptación de tres meses y 21 reglas obligatorias en verde.
3. Servidor Express + Socket.IO + MongoDB con claves por rol, idempotencia y concurrencia optimista. MongoDB real no disponible en el entorno (descarga bloqueada); se probó con almacén en memoria exclusivo para pruebas.
4. Web React + Vite: inicio, preparación, juego, cuentas, cierre, reflexión final, estaciones y facilitador.
5. Revisión visual en escritorio y celular. Corregido: desbordamiento horizontal en celular causado por etiquetas ocultas dentro de tablas desplazables; botones de diálogos fijos al pie.
6. Pruebas Playwright de recorridos críticos, incluido el modo conectado con tres dispositivos simulados.
7. Integración de los recursos aprobados (logotipo, tablero y ruleta): logotipo sin modificar, ilustraciones recortadas del tablero, paleta extraída con ajustes de contraste, ruleta con flecha giratoria, tipografía Nunito. Verificado con typecheck, Vitest, build, Playwright y capturas en escritorio y celular.
