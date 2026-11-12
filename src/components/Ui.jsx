import { useState } from 'react'
import { asset } from '../lib/asset'

export const Eyebrow = ({ children }) => <div className="eyebrow"><span className="dot" />{children}</div>

/* ---------- Bloques: cada uno con su color y su lista de actividades del guion ---------- */
const ACTS = {
  I: ['Ajustar', 'Medir', '¿Coinciden?', 'Salida de 5 V'],
  II: ['Identificar', 'Nodos', 'Montar', 'Fijar tensión', 'Conectar', 'Preparar', 'Medir', 'Tabla 2.5', 'Kirchhoff'],
  III: ['Montar', 'Modo serie', 'Medir', 'Kirchhoff', 'LEDs', 'Cambiar R₆', 'Explicar', 'Divisor'],
}

// Cabecera de las diapositivas de un bloque: de qué bloque es y en qué actividad estás
export function ActTrack({ m, n, extra }) {
  return (
    <div className="act-track">
      <span className="act-pill">Bloque {m}</span>
      <ol className="act-steps" aria-label={`Actividades del bloque ${m}`}>
        {ACTS[m].map((t, i) => (
          <li key={t} title={`Actividad ${i + 1}: ${t}`} className={i + 1 === n ? 'cur' : i + 1 < n ? 'done' : ''} aria-current={i + 1 === n ? 'step' : undefined}>
            <span className="act-n">{i + 1}</span><span className="act-t">{t}</span>
          </li>
        ))}
      </ol>
      {extra && <span className="act-extra">{extra}</span>}
    </div>
  )
}

// Lista numerada por pasos: cada punto aparece en su paso y se resalta mientras es el actual.
export function Steps({ step, items }) {
  return (
    <ol className="steps">
      {items.map(([k, body], i) => {
        const n = i + 1
        return (
          <li key={n} data-step={n} className={`frag${step >= n ? ' shown' : ''}${step === n ? ' on' : ''}`}>
            <span className="k">{k}</span><span>{body}</span>
          </li>
        )
      })}
    </ol>
  )
}

export const Legend = ({ items }) => (
  <span className="legend">
    {items.map(([k, t]) => <span key={t} style={{ '--c': `var(--${k})` }}><i />{t}</span>)}
  </span>
)

export const Ri = ({ n }) => <><i>R</i><sub>{n}</sub></>
export const Ii = ({ n }) => <><i>I</i><sub>{n}</sub></>

// Punto del guion, citado tal cual
export const Enun = ({ n, children }) => (
  <blockquote className="enun"><span className="enun-n">{n}</span><p>{children}</p></blockquote>
)

export const Fig = ({ src, alt, children }) => (
  <figure className="fig"><img src={asset(src)} alt={alt} />{children && <figcaption>{children}</figcaption>}</figure>
)

// Aviso: los valores teóricos salen de las actividades previas
export const PrevNote = ({ children }) => (
  <aside className="prev">
    <span className="prev-ic" aria-hidden="true">✎</span>
    <p><b>Haz las actividades previas.</b> {children} Si los llevas calculados, sabrás en el momento si tu medida es coherente.</p>
  </aside>
)

export const Photo = ({ src, alt, className = '' }) => <img className={`photo ${className}`} src={asset(src)} alt={alt} />

// Enunciado original del guion, plegado
export const OrigEnun = ({ files, block }) => (
  <details className="orig">
    <summary>Ver el enunciado original del guion</summary>
    {files.map((f, i) => <img key={f} src={asset(f)} alt={`Enunciado del bloque ${block} en el guion de la práctica, parte ${i + 1}`} />)}
  </details>
)

/* Pregunta de opción múltiple. Cada opción: { t, ok, fb }.
   Con reveal=false la respuesta queda anotada pero no se corrige (p. ej. hasta que el alumno mida). */
export function Quiz({ q, label, options, reveal = true, pending, onPick }) {
  const [pick, setPick] = useState(null)
  const choice = options[pick]
  return (
    <div className="quiz">
      <p className="quiz-q">{q}</p>
      <div className="quiz-opts" role="group" aria-label={label || q}>
        {options.map((o, i) => (
          <button key={i} type="button" aria-pressed={pick === i}
            className={`quiz-opt${pick === i ? ' sel' : ''}${pick === i && reveal ? (o.ok ? ' good' : ' bad') : ''}`}
            onClick={() => { setPick(i); onPick?.(o) }}>
            {o.t}
          </button>
        ))}
      </div>
      {choice && (
        <p className={`quiz-fb${reveal ? (choice.ok ? ' good' : ' bad') : ''}`} aria-live="polite">
          {reveal ? <><b>{choice.ok ? 'Correcto.' : 'No exactamente.'}</b> {choice.fb}</> : pending}
        </p>
      )}
    </div>
  )
}
