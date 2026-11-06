/**
 * Identidad visual aprobada (ver referencias/README.md).
 *
 * El archivo aprobado `referencias/logo-pixeles.png` es la marca completa del juego:
 * «Sobrevivir al mes», el lema y el crédito «Una experiencia educativa de PIXELES».
 * Se copió sin modificaciones a apps/web/public/marca/logo-pixeles.png.
 * Como ya incluye el crédito a PIXELES, donde se muestra el logotipo no se repite
 * el crédito en texto.
 */
export const LOGO_PIXELES_SRC: string | null = '/marca/logo-pixeles.png';

export const LOGO_ALT = 'Sobrevivir al mes. Educación financiera para no financieros. Una experiencia educativa de PIXELES';

/** Marca del juego: el logotipo aprobado o, si faltara, una composición tipográfica. */
export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  if (LOGO_PIXELES_SRC) {
    return (
      <span className={`logo logo-${size}`}>
        <img src={LOGO_PIXELES_SRC} alt={LOGO_ALT} width={1536} height={1024} decoding="async" />
      </span>
    );
  }
  return (
    <div className={`wordmark wordmark-${size}`}>
      <span className="wordmark-title">
        Sobrevivir <span className="wordmark-small">al</span> mes
      </span>
      {size !== 'sm' && <span className="wordmark-sub">Educación financiera para no financieros</span>}
    </div>
  );
}

/** Crédito al estudio. No se muestra cuando el logotipo (que ya lo incluye) está presente. */
export function StudioCredit() {
  if (LOGO_PIXELES_SRC) return null;
  return (
    <p className="studio-credit">
      Una experiencia educativa de <strong>PIXELES</strong>
    </p>
  );
}

/** Ilustraciones recortadas de referencias/tablero.png (fondo transparente). */
export const TILE_ART = {
  inicio: '/marca/casillas/inicio.png',
  arriendo: '/marca/casillas/arriendo.png',
  alimentacion: '/marca/casillas/alimentacion.png',
  transporte: '/marca/casillas/transporte.png',
  educacion: '/marca/casillas/educacion.png',
  imprevisto: '/marca/casillas/imprevisto.png',
  oportunidad: '/marca/casillas/oportunidad.png',
  centro_comercial: '/marca/casillas/centro_comercial.png',
  compra_opcional: '/marca/casillas/compra_opcional.png',
  tentacion: '/marca/casillas/tentacion.png',
  salida_familiar: '/marca/casillas/salida_familiar.png',
  banco: '/marca/casillas/banco.png',
} as const;

export function tileArtFor(tile: { kind: string; concept?: string }): string {
  const key = (tile.kind === 'compromiso' ? tile.concept : tile.kind) as keyof typeof TILE_ART;
  return TILE_ART[key];
}
