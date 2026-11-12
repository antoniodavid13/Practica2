import { useEffect, useState } from 'react'
import { BANDS, R, ohm } from '../lib/circuit'
import { useLab } from '../lib/lab'
import { TABLES, bestFondo, emptyCell, evalRow, fondos, toNum } from '../lib/practice'
import { asset } from '../lib/asset'

/* ================= Tarjetas de componentes ================= */
// Fotos reales en public/, nombradas por su valor en ohmios. R₄ y R₆ aún no tienen foto: se dibujan con sus bandas
const PARTS = [
  { k: 'r1', n: '1', v: R.r1, use: 'Corrientes de ramas', img: '1500.png', code: 'marrón · verde · rojo · oro', read: '15 × 100 Ω' },
  { k: 'r2', n: '2', v: R.r2, use: 'Corrientes de ramas', img: '2200.png', code: 'rojo · rojo · rojo · oro', read: '22 × 100 Ω' },
  { k: 'r3', n: '3', v: R.r3, use: 'Ramas y divisor (dos)', img: '3300.png', code: 'naranja · naranja · rojo · oro', read: '33 × 100 Ω' },
  { k: 'r4', n: '4', v: R.r4, use: 'Corrientes de ramas', code: 'marrón · negro · naranja', read: '10 × 1.000 Ω' },
  { k: 'r5', n: '5', v: R.r5, use: 'Ramas y divisor', img: '2M2.png', code: 'rojo · rojo · verde · oro', read: '22 × 100.000 Ω' },
  { k: 'r6', n: '6', v: R.r6, use: 'Divisor de corriente', code: 'marrón · negro · amarillo', read: '10 × 10.000 Ω' },
]

function PartDrawing({ k }) {
  return (
    <svg className="part-svg" viewBox="0 0 220 64" aria-hidden="true">
      <line x1="0" x2="220" y1="32" y2="32" stroke="var(--leg)" strokeWidth="3" />
      <rect x="50" y="16" width="120" height="32" rx="14" fill="var(--body)" />
      {BANDS[k].map((c, i) => <rect key={i} x={[68, 88, 108, 144][i]} y="16" width="10" height="32" style={{ fill: `var(--band-${c})` }} />)}
    </svg>
  )
}

export function Parts() {
  return (
    <div className="parts p3">
      {PARTS.map((p) => (
        <article key={p.k} className="part" style={{ '--c': `var(--${p.k})` }}>
          <div className="part-top"><span className="part-name"><i /><span>R<sub>{p.n}</sub></span></span><span className="part-use">{p.use}</span></div>
          {p.img ? <img className="part-img" src={asset(p.img)} alt={`Resistencia R${p.n} de ${ohm(p.v)}: ${p.code}`} /> : <PartDrawing k={p.k} />}
          <div className="part-val">{ohm(p.v)}</div>
          <div className="part-code">{p.code} <span className="mono" style={{ color: 'var(--muted)' }}>· {p.read}</span></div>
          <div className="part-range">{ohm(p.v * 0.95)} – {ohm(p.v * 1.05)}</div>
        </article>
      ))}
    </div>
  )
}

/* ================= Barra de tolerancia ================= */
export function Tol({ min, nom, max, fmt = (v) => ohm(v, true) }) {
  const pad = (max - min) * 0.55, lo = min - pad, hi = max + pad
  const pct = (v) => (((v - lo) / (hi - lo)) * 100).toFixed(2) + '%'
  return (
    <div className="tol">
      <div className="tol-track">
        <div className="tol-band" style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` }} />
        <div className="tol-nom" style={{ left: pct(nom) }} />
      </div>
      <div className="tol-lbls">
        <span style={{ left: pct(min) }}>mín.<b>{fmt(min)}</b></span>
        <span style={{ left: pct(nom) }}>teórico<b>{fmt(nom)}</b></span>
        <span style={{ left: pct(max) }}>máx.<b>{fmt(max)}</b></span>
      </div>
    </div>
  )
}

/* ================= Tablas de resultados ================= */
// «Corriente I» + «R3»: la palabra va en redonda, y solo la magnitud en cursiva
const RowName = ({ row }) => {
  if (!row.sub) return row.label
  const words = row.label.split(' '), sym = words.pop()
  return <>{words.length > 0 && `${words.join(' ')} `}<i>{sym}</i><sub>{row.sub}</sub></>
}

function UnitSel({ value, units, onChange, label }) {
  return (
    <select className="unit" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {units.map((u) => <option key={u}>{u}</option>)}
    </select>
  )
}

/* Comprobación de una fila: un solo estado (✓, ! o ✕) con su motivo principal, la medida con su incertidumbre
   y el resto de avisos plegados en «Detalle». checks: distintivos [clase, texto] de evalRow. */
const STATUS = { bad: ['✕', 'Revisa'], warn: ['!', 'Mejorable'], good: ['✓', 'Correcta'], info: ['i', 'Anotada'] }
function CheckCell({ checks }) {
  const unc = checks.find(([, s]) => s.startsWith('Con su incertidumbre'))
  const rest = checks.filter((c) => c !== unc)
  const kind = ['bad', 'warn', 'good', 'info'].find((k) => rest.some(([c]) => c === k)) ?? 'info'
  // Con un solo aviso (p. ej. solo el valor teórico, aún sin medida), el aviso mismo es la etiqueta
  const only = rest.length === 1 ? rest[0][1] : null
  const main = kind === 'good' || only ? null : rest.find(([c]) => c === kind)?.[1]
  const [ic, word] = STATUS[kind], label = only ?? word
  return (
    <div className={`chk ${kind}`}>
      <div className="chk-head"><span className="chk-ic" aria-hidden="true">{ic}</span><b>{label}</b>{main && <span className="chk-main">{main}</span>}</div>
      {unc && <div className="chk-unc mono">{unc[1].replace('Con su incertidumbre: ', '')}</div>}
      {rest.length > 1 && (
        <details className="chk-more">
          <summary>Detalle ({rest.length})</summary>
          <ul>{rest.map(([c, s]) => <li key={s} className={c}>{s}</li>)}</ul>
        </details>
      )}
    </div>
  )
}

function Row({ id, row, focus }) {
  const { lab, setLab } = useLab()
  const t = TABLES[id]
  const c = { ...emptyCell(row), ...lab.t[id][row.k] }
  const set = (patch) => setLab((l) => ({ ...l, t: { ...l.t, [id]: { ...l.t[id], [row.k]: { ...c, ...patch } } } }))
  const log = lab[t.bench].log[row.k]
  // Lo que trae «Copiar lectura». Se calcula aquí, y solo si hay lectura: el compilador de React memoriza
  // el manejador leyendo sus dependencias, y `log.fondo` fallaría en una fila sin lectura anotada.
  const copy = log ? { med: log.text.replace('.', ','), medU: log.unit, fondo: log.fondo } : null
  const checks = evalRow(row, c)
  const name = row.sub ? `${row.label}${row.sub}` : row.label
  return (
    <tr className={focus ? 'focus' : ''}>
      <th scope="row"><RowName row={row} /></th>
      <td data-label={t.refHead}>
        {row.ref ? (
          <div className="inp">
            <input inputMode="decimal" autoComplete="off" placeholder="—" aria-label={`${t.refHead} ${name}`} value={c.ref} onChange={(e) => set({ ref: e.target.value })} />
            <UnitSel value={c.refU} units={row.units} onChange={(refU) => set({ refU })} label={`Unidad de ${t.refHead} ${name}`} />
          </div>
        ) : <span className="note">—</span>}
      </td>
      <td data-label="Fondo de escala">
        <select className="sel" value={c.fondo} onChange={(e) => set({ fondo: e.target.value })} aria-label={`Fondo de escala ${name}`}>
          <option value="">—</option>
          {fondos(row.g).map((g) => <option key={g.i}>{g.name}</option>)}
        </select>
      </td>
      <td data-label={t.medHead}>
        <div className="inp">
          <input inputMode="decimal" autoComplete="off" placeholder="—" aria-label={`${t.medHead} ${name}`} value={c.med} onChange={(e) => set({ med: e.target.value })} />
          <UnitSel value={c.medU} units={row.units} onChange={(medU) => set({ medU })} label={`Unidad de ${t.medHead} ${name}`} />
        </div>
        <button type="button" className="linkbtn" disabled={!log}
          onClick={() => copy && set(copy)}>
          {log ? `Copiar lectura (${log.text} ${log.unit})` : 'Sin lectura anotada'}
        </button>
      </td>
      <td data-label="Comprobación">
        {checks.length ? <CheckCell checks={checks} /> : <span className="note">Rellena la fila</span>}
      </td>
    </tr>
  )
}

const fmtBase = (row, v) => {
  if (row.g === 'ohm') return ohm(v, true)
  if (row.g === 'vdc') return `${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} V`
  return Math.abs(v) < 1e-4 ? `${(v * 1e6).toLocaleString('es-ES', { maximumFractionDigits: 2 })} µA` : `${(v * 1e3).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} mA`
}

// Fila de solución: valor esperado, mejor fondo e intervalo coherente
function SolRow({ row }) {
  if (row.exp === null) return null
  return (
    <tr className="sol">
      <th scope="row">Solución</th>
      <td className="num" data-label="Valor esperado">{fmtBase(row, row.exp)}</td>
      <td className="num" data-label="Fondo de escala">{bestFondo(row, row.exp)?.name}</td>
      <td className="note" colSpan="2" data-label="Intervalo">Cualquier medida entre {fmtBase(row, row.lo)} y {fmtBase(row, row.hi)} es coherente</td>
    </tr>
  )
}

/* La solución solo se puede ver cuando la fila ya tiene una medida. */
export function ResultTable({ id }) {
  const { lab } = useLab()
  const [sol, setSol] = useState(false)
  const t = TABLES[id]
  const measured = (row) => toNum(lab.t[id][row.k]?.med) !== null
  const can = t.rows.some(measured)
  return (
    <>
      <div className="tablebox">
        <table className="t111">
          <thead>
            <tr>
              <th>{t.corner}</th>
              <th>{t.refHead}{t.refSub && <span className="th-sub">{t.refSub}</span>}</th>
              <th>Fondo de escala</th><th>{t.medHead}</th><th>Comprobación</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.flatMap((row) => [
              <Row key={row.k} id={id} row={row} />,
              sol && measured(row) ? <SolRow key={`${row.k}-sol`} row={row} /> : null,
            ])}
          </tbody>
        </table>
        <div className="t111-cap">{t.caption}</div>
      </div>
      <div className="t111-acts">
        {!can && <span className="note">Escribe una medida para poder ver la solución.</span>}
        <button className="btn sm" type="button" onClick={() => window.print()}>Imprimir tablas</button>
        <button className="btn sm" type="button" aria-pressed={sol && can} disabled={!can} onClick={() => setSol((v) => !v)}>
          {sol && can ? 'Ocultar solución' : 'Ver solución'}
        </button>
      </div>
    </>
  )
}

/* Hoja de impresión: las cuatro tablas tal como las ha rellenado el alumno. Solo es visible al imprimir. */
export function PrintSheet() {
  const { lab } = useLab()
  const cell = (v, u) => (v?.trim() ? `${v.trim()} ${u}` : '')
  return (
    <div className="print-sheet" aria-hidden="true">
      <h1>Práctica 2 · Medidas de magnitudes básicas en corriente continua I</h1>
      <p className="ps-fields"><span>Grupo:</span><span>Puesto:</span><span>Alumnos:</span></p>
      {Object.entries(TABLES).map(([id, t]) => (
        <div key={id}>
          <table>
            <thead><tr><th>{t.corner}</th><th>{t.refHead}</th><th>Fondo de escala</th><th>{t.medHead}</th></tr></thead>
            <tbody>
              {t.rows.map((row) => {
                const c = lab.t[id][row.k] ?? {}
                return <tr key={row.k}><th scope="row"><RowName row={row} /></th><td>{cell(c.ref, c.refU)}</td><td>{c.fondo}</td><td>{cell(c.med, c.medU)}</td></tr>
              })}
            </tbody>
          </table>
          <p className="ps-cap">{t.caption}</p>
        </div>
      ))}
    </div>
  )
}

/* ================= Tema claro / oscuro ================= */
const THEME_KEY = 'p2-corriente-continua:theme'

function initialTheme() {
  try {
    const s = localStorage.getItem(THEME_KEY)
    if (s === 'light' || s === 'dark') return s
  } catch { /* almacenamiento bloqueado */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(initialTheme)
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  const toggle = () => {
    const t = theme === 'dark' ? 'light' : 'dark'
    setTheme(t)
    try { localStorage.setItem(THEME_KEY, t) } catch { /* almacenamiento bloqueado */ }
  }
  const label = theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'
  return (
    <button className="btn theme-btn" type="button" onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>
      )}
    </button>
  )
}
