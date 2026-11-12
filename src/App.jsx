import { useEffect, useReducer, useRef, useState } from 'react'
import { SLIDES } from './Slides'
import { PrintSheet, ThemeToggle } from './components/Widgets'
import { Narrator } from './components/Narrator'
import { LabContext, loadLab, saveLab } from './lib/lab'

/* ================= Motor de diapositivas ================= */
const N = SLIDES.length
const MAX = SLIDES.map((s) => s.steps)
const pad2 = (n) => String(n).padStart(2, '0')

function fromHash() {
  const m = /^#slide-(\d+)$/.exec(window.location.hash)
  return m ? Math.max(0, Math.min(N, +m[1]) - 1) : 0
}

// Cada diapositiva recuerda su último paso, para que no "salte" mientras se desvanece.
function goTo(nav, i, st) {
  const cur = Math.max(0, Math.min(N - 1, i))
  const steps = nav.steps.slice()
  steps[cur] = Math.max(0, Math.min(MAX[cur], st))
  return { cur, steps }
}

function reducer(nav, a) {
  const { cur, steps } = nav, step = steps[cur]
  switch (a.type) {
    case 'next':
      if (step < MAX[cur]) return goTo(nav, cur, step + 1)
      return cur < N - 1 ? goTo(nav, cur + 1, 0) : nav
    case 'prev':
      // Al retroceder a la diapositiva anterior se muestra completa.
      if (step > 0) return goTo(nav, cur, step - 1)
      return cur > 0 ? goTo(nav, cur - 1, MAX[cur - 1]) : nav
    case 'go':
      return goTo(nav, a.i, a.step ?? 0)
    case 'hash':
      return a.i !== cur ? goTo(nav, a.i, 0) : nav
    default:
      return nav
  }
}

const init = () => goTo({ cur: 0, steps: MAX.map(() => 0) }, fromHash(), 0)

export default function App() {
  const [nav, dispatch] = useReducer(reducer, null, init)
  const { cur, steps } = nav
  const step = steps[cur], max = MAX[cur]
  const touch = useRef(null)
  const [lab, setLab] = useState(loadLab)
  useEffect(() => { saveLab(lab) }, [lab])

  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented) return // ya lo ha usado un control (p. ej. las flechas en la protoboard)
      if (document.querySelector('dialog[open]')) return // con el vídeo abierto, las teclas son del vídeo
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.altKey || e.ctrlKey || e.metaKey) return
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); dispatch({ type: 'next' }) }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); dispatch({ type: 'prev' }) }
      else if (e.key === 'Home') dispatch({ type: 'go', i: 0 })
      else if (e.key === 'End') dispatch({ type: 'go', i: N - 1, step: MAX[N - 1] })
    }
    const onHash = () => dispatch({ type: 'hash', i: fromHash() })
    document.addEventListener('keydown', onKey)
    window.addEventListener('hashchange', onHash)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  useEffect(() => {
    try { window.history.replaceState(null, '', '#slide-' + (cur + 1)) } catch { /* sin historial */ }
  }, [cur])

  // Deslizar en móvil
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e) => {
    const t = touch.current
    if (!t) return
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && !e.target.closest?.('input,select,dialog,.segctl,.pb,.dmm,.tablebox,.readout-sm,.supply'))
      dispatch({ type: dx < 0 ? 'next' : 'prev' })
    touch.current = null
  }

  return (
    <LabContext value={{ lab, setLab }}>
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2 12h4l2-5 3 10 3-10 3 10 2-5h3" /></svg></span>
          <span><b>Circuitos I</b><span className="hide-sm"> · Práctica 2</span></span>
        </div>
        <nav className="segs" aria-label="Diapositivas">
          {SLIDES.map((s, i) => (
            // Los segmentos de cada montaje llevan su color y un hueco que los separa del resto
            <button key={i} type="button"
              className={`seg${i < cur ? ' done' : ''}${i === cur ? ' cur' : ''}${s.group ? ` grp-${s.group}` : ''}${i > 0 && s.group !== SLIDES[i - 1].group ? ' gap' : ''}`}
              style={i === cur ? { '--p': String((step + 1) / (max + 1)) } : undefined}
              aria-current={i === cur ? 'step' : undefined} aria-label={`Ir a ${i + 1}: ${s.title}`}
              onClick={() => dispatch({ type: 'go', i })}>
              <span />
            </button>
          ))}
        </nav>
        <span className="count" aria-live="polite">{pad2(cur + 1)} / {pad2(N)}</span>
        <ThemeToggle />
      </header>

      <main className="stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {SLIDES.map((s, i) => (
          <section key={i} className={`slide${i === cur ? ' active' : ''}${i < cur ? ' before' : ''}${s.group ? ` grp-${s.group}` : ''}`}
            aria-hidden={i !== cur} inert={i !== cur}>
            {s.body(steps[i])}
          </section>
        ))}
      </main>

      <footer className="bar">
        <button className="btn" type="button" aria-label="Anterior" disabled={cur === 0 && step === 0}
          onClick={() => dispatch({ type: 'prev' })}>
          <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg><span className="lbl">Anterior</span>
        </button>
        <div className="mid">
          <div className="stepdots" aria-hidden="true">
            {max > 0 && Array.from({ length: max + 1 }, (_, i) => <i key={i} className={i === step ? 'on' : ''} />)}
          </div>
          <span className={`sname${SLIDES[cur].group ? ` grp-${SLIDES[cur].group}` : ''}`}>{SLIDES[cur].title}</span>
        </div>
        <div className="right">
          {/* key: al cambiar de diapositiva se monta de nuevo y la narración anterior se para */}
          {SLIDES[cur].audio && <Narrator key={cur} name={SLIDES[cur].audio} />}
          <span className="keys hide-sm"><kbd>←</kbd><kbd>→</kbd></span>
          <button className="btn primary" type="button" aria-label="Siguiente" disabled={cur === N - 1 && step === max}
            onClick={() => dispatch({ type: 'next' })}>
            <span className="lbl">Siguiente</span><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      </footer>
    </div>
    <PrintSheet />
    </LabContext>
  )
}
