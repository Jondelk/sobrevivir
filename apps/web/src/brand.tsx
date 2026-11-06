/**
 * Identidad visual. La carpeta /referencias no contenía logotipo, tablero ni ruleta
 * aprobados al construir esta versión, así que se usa una composición tipográfica
 * provisional y NO un logotipo de PIXELES.
 *
 * Para usar el logotipo oficial: copie el archivo aprobado a
 * apps/web/public/marca/logo-pixeles.svg (o .png) y cambie LOGO_PIXELES_SRC.
 */
export const LOGO_PIXELES_SRC: string | null = null; // p. ej. '/marca/logo-pixeles.svg'

export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`wordmark wordmark-${size}`}>
      <span className="wordmark-title">
        Sobrevivir <span className="wordmark-small">al</span> mes
      </span>
      {size !== 'sm' && <span className="wordmark-sub">Educación financiera para no financieros</span>}
    </div>
  );
}

export function StudioCredit() {
  return (
    <p className="studio-credit">
      Una experiencia educativa de{' '}
      {LOGO_PIXELES_SRC ? <img src={LOGO_PIXELES_SRC} alt="PIXELES" className="studio-logo" /> : <strong>PIXELES</strong>}
    </p>
  );
}
