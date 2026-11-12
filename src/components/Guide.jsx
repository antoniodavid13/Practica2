import { useLab } from '../lib/lab'

/* «Qué tienes que hacer»: los pasos de la actividad, en orden y todos a la vista.
   guide: función de lib/guides.js que devuelve los pasos a partir del estado del laboratorio.
   Cada paso dice qué hacer y, debajo, por qué (`why`). Se marcan solos al hacerlos; el actual se resalta
   y lleva su explicación y su pista. Los hechos se compactan a una línea para que el actual quede siempre a la vista. */
export function Guide({ guide }) {
  const { lab } = useLab()
  const steps = guide(lab)
  const last = [...steps].reverse().find((s) => s.ok !== undefined)
  // final: el último paso implica los demás (p. ej. «anota las cinco corrientes»); si no, deben cumplirse todos
  const done = last?.final ? !!last.ok : steps.every((s) => s.ok !== false)
  const cur = done ? -1 : steps.findIndex((s) => s.ok === false)
  const state = (s, i) => (done || s.ok === true || (s.ok === undefined && i < cur) ? 'done' : i === cur ? 'cur' : 'todo')
  const n = steps.filter((s, i) => state(s, i) === 'done').length
  const now = steps[cur]
  return (
    <div className={`guide${done ? ' ok' : ''}`}>
      <div className="guide-head">
        <span>{done ? '✓ Actividad completada' : 'Qué tienes que hacer'}</span>
        <span className="mono">{n}/{steps.length}</span>
      </div>
      <div className="guide-bar" aria-hidden="true"><i style={{ width: `${(n / steps.length) * 100}%` }} /></div>
      {/* Para lectores de pantalla: se anuncia el paso actual cada vez que cambia */}
      <p className="sr-only" aria-live="polite">{now ? `Paso ${cur + 1}: ${now.t}` : done ? 'Actividad completada' : ''}</p>
      <ol className="guide-steps">
        {steps.map((s, i) => {
          const st = state(s, i)
          return (
            <li key={i} className={st} aria-current={st === 'cur' ? 'step' : undefined}>
              <span className="guide-k" aria-hidden="true">{st === 'done' ? '✓' : i + 1}</span>
              <div className="guide-body">
                <p className="guide-t">{s.t}</p>
                {s.why && st === 'cur' && <p className="guide-why"><b>Por qué:</b> {s.why}</p>}
                {st === 'cur' && s.hint && <p className="guide-hint"><b>Pista:</b> {s.hint}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
