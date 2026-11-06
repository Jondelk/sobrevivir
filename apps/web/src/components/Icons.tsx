import type { JSX } from 'react';
import type { Tile } from '@sobrevivir/engine';

/** Iconos lineales propios, de trazo uniforme, coherentes entre sí. */
const P = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export type IconName =
  | 'inicio'
  | 'arriendo'
  | 'alimentacion'
  | 'transporte'
  | 'educacion'
  | 'imprevisto'
  | 'oportunidad'
  | 'centro_comercial'
  | 'compra_opcional'
  | 'tentacion'
  | 'salida_familiar'
  | 'banco'
  | 'reserva'
  | 'historial'
  | 'ayuda'
  | 'check'
  | 'reloj'
  | 'persona';

const paths: Record<IconName, JSX.Element> = {
  inicio: (
    <>
      <path d="M6 21V4" {...P} />
      <path d="M6 4h11l-2.5 4L17 12H6" {...P} />
    </>
  ),
  arriendo: (
    <>
      <path d="M3 11l9-7 9 7" {...P} />
      <path d="M5 10v10h14V10" {...P} />
      <path d="M10 20v-6h4v6" {...P} />
    </>
  ),
  alimentacion: (
    <>
      <path d="M4 9h16l-1.5 10.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5Z" {...P} />
      <path d="M8 9l3-5M16 9l-3-5" {...P} />
      <path d="M9 13v4M12 13v4M15 13v4" {...P} />
    </>
  ),
  transporte: (
    <>
      <rect x="4" y="4" width="16" height="13" rx="3" {...P} />
      <path d="M4 11h16" {...P} />
      <circle cx="8" cy="14" r="0.6" {...P} />
      <circle cx="16" cy="14" r="0.6" {...P} />
      <path d="M7 17v3M17 17v3" {...P} />
    </>
  ),
  educacion: (
    <>
      <path d="M2 9l10-5 10 5-10 5Z" {...P} />
      <path d="M6 11v5c3 2.5 9 2.5 12 0v-5" {...P} />
      <path d="M22 9v6" {...P} />
    </>
  ),
  imprevisto: (
    <>
      <path d="M13 2L4 14h7l-1 8 9-12h-7Z" {...P} />
    </>
  ),
  oportunidad: (
    <>
      <path d="M12 21v-9" {...P} />
      <path d="M12 12C12 7 8 5 4 5c0 4 3 7 8 7Z" {...P} />
      <path d="M12 14c0-4 3-6 8-6 0 4-3 6-8 6Z" {...P} />
    </>
  ),
  centro_comercial: (
    <>
      <path d="M5 8h14l-1 13H6Z" {...P} />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" {...P} />
    </>
  ),
  compra_opcional: (
    <>
      <path d="M3 12V4h8l10 10-8 8Z" {...P} />
      <circle cx="7.5" cy="8.5" r="1.3" {...P} />
    </>
  ),
  tentacion: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" {...P} />
      <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z" {...P} />
    </>
  ),
  salida_familiar: (
    <>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" {...P} />
    </>
  ),
  banco: (
    <>
      <path d="M3 9l9-5 9 5" {...P} />
      <path d="M5 9v8M9.5 9v8M14.5 9v8M19 9v8" {...P} />
      <path d="M3 20h18" {...P} />
    </>
  ),
  reserva: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="2" {...P} />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" {...P} />
      <path d="M12 13v3" {...P} />
    </>
  ),
  historial: (
    <>
      <path d="M6 3h12v18H6Z" {...P} />
      <path d="M9 8h6M9 12h6M9 16h4" {...P} />
    </>
  ),
  ayuda: (
    <>
      <circle cx="12" cy="12" r="9" {...P} />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7" {...P} />
      <circle cx="12" cy="17" r="0.5" {...P} />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" {...P} />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" {...P} />
      <path d="M12 7v5l3 2" {...P} />
    </>
  ),
  persona: (
    <>
      <circle cx="12" cy="8" r="4" {...P} />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...P} />
    </>
  ),
};

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" className={className}>
      {paths[name]}
    </svg>
  );
}

export function tileIcon(tile: Tile): IconName {
  if (tile.kind === 'compromiso') return tile.concept as IconName;
  return tile.kind as IconName;
}
