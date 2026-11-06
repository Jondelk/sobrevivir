import { PERSONAL_COLORS, type ColorId } from '@sobrevivir/engine';

export interface ParticipantDraft {
  nickname: string;
  colorId: ColorId;
}

/** Asigna apodos y colores. Los roles no cambian; elegir un color ocupado intercambia los colores. */
export function ParticipantsEditor({
  roles,
  value,
  onChange,
  idPrefix,
}: {
  roles: string[];
  value: ParticipantDraft[];
  onChange: (v: ParticipantDraft[]) => void;
  idPrefix: string;
}) {
  const setColor = (i: number, colorId: ColorId) => {
    const next = value.map((p) => ({ ...p }));
    const other = next.findIndex((p, j) => j !== i && p.colorId === colorId);
    if (other >= 0) next[other].colorId = next[i].colorId;
    next[i].colorId = colorId;
    onChange(next);
  };
  return (
    <table className="table participants-editor">
      <thead>
        <tr><th scope="col">Rol</th><th scope="col">Nombre o apodo (opcional)</th><th scope="col">Color</th></tr>
      </thead>
      <tbody>
        {roles.map((role, i) => {
          const color = PERSONAL_COLORS.find((c) => c.id === value[i].colorId)!;
          return (
            <tr key={role}>
              <th scope="row">{role}</th>
              <td>
                <label className="sr-only" htmlFor={`${idPrefix}-n${i}`}>Nombre de {role}</label>
                <input
                  id={`${idPrefix}-n${i}`}
                  value={value[i].nickname}
                  maxLength={40}
                  placeholder="Sin nombre"
                  onChange={(e) => onChange(value.map((p, j) => (j === i ? { ...p, nickname: e.target.value } : p)))}
                />
              </td>
              <td>
                <span className="color-pick">
                  <span className="swatch" style={{ background: color.hex }} aria-hidden="true" />
                  <label className="sr-only" htmlFor={`${idPrefix}-c${i}`}>Color de {role}</label>
                  <select id={`${idPrefix}-c${i}`} value={value[i].colorId} onChange={(e) => setColor(i, e.target.value as ColorId)}>
                    {PERSONAL_COLORS.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export const defaultDrafts = (): ParticipantDraft[] => PERSONAL_COLORS.map((c) => ({ nickname: '', colorId: c.id }));
