import { useLab } from '../lib/lab'

/* «Qué tienes que hacer»: pasos de la diapositiva que se marcan solos al hacerlos.
   guide: función de lib/guides.js que devuelve los pasos a partir del estado del laboratorio.
   Compacta: se ve el paso actual, su pista y el siguiente; la lista entera queda plegada. */
export function Guide({ guide }) {
  const { lab } = useLab()
  const steps = guide(lab)
  const last = [...steps].reverse().find((s) => s.ok !== undefined)
  // final: el último paso implica los demás (p. ej. «anota las cinco corrientes»); si no, deben cumplirse todos
  const done = last?.final ? !!last.ok : steps.every((s) => s.ok !== false)
  const cur = done ? -1 : steps.findIndex((s) => s.ok === false)
  const state = (s, i) => (done || s.ok === true || (s.ok === undefined && i < cur) ? 'done' : i === cur ? 'cur' : 'todo')
  const n = steps.filter((s, i) => state(s, i) === 'done').length
  const now = steps[cur], next = steps.slice(cur + 1).find((s) => s.ok !== true)
  return (
    <div className={`guide${done ? ' ok' : ''}`}>
      <div className="guide-head">
        <span>{done ? '✓ Actividad completada' : 'Qué tienes que hacer'}</span>
        <span className="mono">{n}/{steps.length}</span>
      </div>
      <div className="guide-bar" aria-hidden="true"><i style={{ width: `${(n / steps.length) * 100}%` }} /></div>
      {now && (
        <div className="guide-now" aria-live="polite">
          <span className="guide-k" aria-hidden="true">{cur + 1}</span>
          <span>{now.t}</span>
        </div>
      )}
      {now?.hint && <p className="guide-hint"><b>Pista:</b> {now.hint}</p>}
      {next && <p className="guide-next">Después: {next.t}</p>}
      <details className="guide-all">
        <summary>Ver todos los pasos</summary>
        <ol className="guide-steps">
          {steps.map((s, i) => {
            const st = state(s, i)
            return (
              <li key={i} className={st} aria-current={st === 'cur' ? 'step' : undefined}>
                <span className="guide-k" aria-hidden="true">{st === 'done' ? '✓' : i + 1}</span>
                <span>{s.t}</span>
              </li>
            )
          })}
        </ol>
      </details>
    </div>
  )
}
