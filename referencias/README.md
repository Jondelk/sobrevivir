# Referencias visuales

Al construir esta versión **la carpeta `referencias` no existía en el repositorio**: no se encontraron el logotipo de PIXELES, la referencia del tablero ni la de la ruleta.

## Qué se hizo mientras tanto

| Recurso | Estado | Solución provisional |
| --- | --- | --- |
| Logotipo de PIXELES | **Pendiente** | Texto «Una experiencia educativa de **PIXELES**». No se dibujó ningún logotipo. |
| Marca «Sobrevivir al mes» | Pendiente | Composición tipográfica (`Wordmark` en `apps/web/src/brand.tsx`). |
| Tablero | Pendiente | Tablero construido con componentes (`apps/web/src/components/Board.tsx`), siguiendo las reglas: 7 × 7, 24 casillas, inicio abajo a la izquierda. |
| Ruleta | Pendiente | SVG de cinco sectores iguales (`apps/web/src/components/Roulette.tsx`). |
| Paleta | Provisional | Crema `#F6F0E4`, azul profundo `#182B3A`, turquesa `#168C88`, naranja `#E98B46`, más terracota, ámbar, verde y violeta por categoría (`apps/web/src/styles.css`, bloque `:root`). |

## Cómo reemplazarlos cuando lleguen

1. Guarde aquí los originales aprobados (por ejemplo `referencias/logo-pixeles.svg`, `referencias/tablero.png`, `referencias/ruleta.png`).
2. **Logotipo:** copie el archivo a `apps/web/public/marca/logo-pixeles.svg` y en `apps/web/src/brand.tsx` cambie
   `LOGO_PIXELES_SRC = null` por `'/marca/logo-pixeles.svg'`.
3. **Colores:** ajuste las variables de `:root` en `apps/web/src/styles.css` (`--cream`, `--ink`, `--turq`, `--terra`, `--amber`, `--green`, `--violet`, `--bank`). Los colores personales de la ruleta están en `PERSONAL_COLORS` (`packages/engine/src/constants.ts`).
4. **Tablero y ruleta:** la referencia guía el estilo (texturas, iconos, tipografía). El tablero debe seguir siendo interactivo; no lo sustituya por una imagen de fondo con coordenadas. Si la referencia contradice las reglas (texto o geometría), prevalecen las reglas.
5. Ejecute `npm run build` y `npm run test:e2e`.
