import { useEffect, useState } from 'react'
import { REAL, RES_NAME, SOLUTIONS, checkBench, openBranch } from '../lib/board'
import { amp, glow } from '../lib/circuit'
import { useLab } from '../lib/lab'
import { DIAL, reading } from '../lib/meter'
import { CURRENT_KEY, TERMINALS, UNITS, branchOf, display, fondos, jackOk, measureBench, toNum } from '../lib/practice'
import { Protoboard } from './Protoboard'
import { Multimeter } from './Multimeter'
import { Quiz } from './Ui'

const TOOL = {
  r1: { t: 'R₁ · 1,5 kΩ', c: 'var(--r1)' },
  r2: { t: 'R₂ · 2,2 kΩ', c: 'var(--r2)' },
  r3: { t: 'R₃ · 3,3 kΩ', c: 'var(--r3)' },
  r4: { t: 'R₄ · 10 kΩ', c: 'var(--r4)' },
  r5: { t: 'R₅ · 2,2 MΩ', c: 'var(--r5)' },
  r6: { t: 'R₆', c: 'var(--r6)' },
  led1: { t: 'LED de R₃', c: 'var(--led)' },
  led2: { t: 'LED de R₆', c: 'var(--led)' },
  wire: { t: 'Cable', c: 'var(--fg-2)' },
  'src+': { t: 'Pinza + fuente', c: '#dc2626' },
  'src-': { t: 'Pinza − fuente', c: '#18181b' },
  red: { t: 'Punta roja', c: '#dc2626' },
  black: { t: 'Punta negra · COM', c: '#18181b' },
  move: { t: 'Mover pata', c: 'transparent' },
  erase: { t: 'Quitar', c: 'transparent' },
}

const useBench = (id) => {
  const { lab, setLab } = useLab()
  const update = (fn) => setLab((l) => ({ ...l, [id]: fn(l[id]) }))
  return [lab[id], update, lab.supply]
}

const note = (bench, key, r) => ({ ...bench, log: { ...bench.log, [key]: { text: r.text, unit: r.unit, fondo: r.p.name } } })

/* Placa interactiva: bandeja de piezas, protoboard y acciones. */
export function Bench({ id, tools, target }) {
  const [bench, update, supply] = useBench(id)
  const [tool, setTool] = useState(tools[0])
  const [pending, setPending] = useState(null)
  const [moving, setMoving] = useState(null)
  const [msg, setMsg] = useState('')
  const [undo, setUndo] = useState(null)
  const { an } = measureBench(bench, supply)

  useEffect(() => {
    if (!pending) return
    const onKey = (e) => { if (e.key === 'Escape') { setPending(null); setMoving(null) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pending])

  const legAt = (h) => bench.parts.find((p) => p.a === h || p.b === h)
  const pick = (t) => { setTool(t); setPending(null); setMoving(null); setMsg('') }
  const name = (k) => (k === 'wire' ? 'el cable' : RES_NAME[k])

  function onHole(h) {
    if (tool === 'red' || tool === 'black') {
      update((b) => ({ ...b, [tool]: h }))
      setMsg(`${tool === 'red' ? 'Punta roja' : 'Punta negra'} en ${h}`)
      return
    }
    if (tool === 'src+' || tool === 'src-') {
      const k = tool === 'src+' ? 'pos' : 'neg'
      update((b) => ({ ...b, src: { pos: null, neg: null, ...b.src, [k]: h } }))
      setMsg(`Pinza ${tool === 'src+' ? 'positiva' : 'negativa'} de la fuente en ${h}`)
      return
    }
    if (tool === 'erase') {
      const p = legAt(h)
      if (p) return removePart(p)
      update((b) => ({
        ...b, red: b.red === h ? null : b.red, black: b.black === h ? null : b.black,
        src: b.src ? { pos: b.src.pos === h ? null : b.src.pos, neg: b.src.neg === h ? null : b.src.neg } : null,
      }))
      return
    }
    if (tool === 'move') {
      if (!moving) {
        const p = legAt(h)
        if (!p) return setMsg('Pulsa un agujero con una pata.')
        setMoving({ id: p.id, leg: p.a === h ? 'a' : 'b' })
        setPending(h)
        setMsg(`Pata de ${name(p.k)} levantada: elige su nuevo agujero (Esc para cancelar).`)
        return
      }
      if (h === pending) { setPending(null); setMoving(null); setMsg(''); return }
      if (legAt(h)) return setMsg('Ese agujero ya está ocupado: cada agujero admite una sola pata.')
      update((b) => ({ ...b, parts: b.parts.map((p) => (p.id === moving.id ? { ...p, [moving.leg]: h } : p)) }))
      setPending(null); setMoving(null)
      setMsg(`Pata movida a ${h}.`)
      return
    }
    if (!pending) {
      if (legAt(h)) return setMsg('Ese agujero ya está ocupado: cada agujero admite una sola pata.')
      setPending(h)
      setMsg(`${tool.startsWith('led') ? 'Ánodo (+)' : 'Primera pata'} de ${name(tool)} en ${h}. Elige el agujero de la otra pata (Esc para cancelar).`)
      return
    }
    if (h === pending) { setPending(null); setMsg(''); return }
    if (legAt(h)) return setMsg('Ese agujero ya está ocupado: cada agujero admite una sola pata.')
    update((b) => ({
      ...b,
      parts: [...b.parts.filter((p) => tool === 'wire' || p.k !== tool), { id: `${tool}-${Date.now()}`, k: tool, a: pending, b: h }],
    }))
    setPending(null)
    setMsg(`${tool === 'wire' ? 'Cable' : RES_NAME[tool]} entre ${pending} y ${h}.`)
  }

  function removePart(p) {
    update((b) => ({ ...b, parts: b.parts.filter((x) => x.id !== p.id) }))
    setMsg(`${p.k === 'wire' ? 'Cable' : RES_NAME[p.k]} retirado de la placa.`)
  }

  const replaceAll = (next, text) => {
    setUndo({ parts: bench.parts, red: bench.red, black: bench.black, src: bench.src })
    update((b) => ({ ...b, ...next }))
    setPending(null); setMoving(null)
    setMsg(text)
  }
  const loadSolution = () => {
    const s = SOLUTIONS[target]
    replaceAll({ parts: s.parts.map((p, i) => ({ ...p, id: `${p.k}-sol${i}` })), red: s.red, black: s.black, src: s.src }, 'Montaje de referencia cargado.')
  }

  return (
    <div className="bench">
      <div className="tray" role="toolbar" aria-label="Piezas">
        {tools.map((t) => (
          <button key={t} type="button" className={`tool${t === 'erase' ? ' erase' : ''}`} aria-pressed={tool === t}
            style={{ '--c': TOOL[t].c }} onClick={() => pick(t)}>
            {t !== 'erase' && t !== 'move' && <i />}{TOOL[t].t}
          </button>
        ))}
      </div>
      <div className="panel pb-panel">
        <Protoboard parts={bench.parts} red={bench.red} black={bench.black} src={bench.src} leds={an.led} interactive tool={tool}
          pending={pending} onHole={onHole} onPart={removePart} label="Protoboard del montaje" />
      </div>
      <div className="bench-foot">
        <span className="bench-msg" aria-live="polite">{msg || hint(tool)}</span>
        <span className="acts">
          {undo && <button className="btn sm" type="button" onClick={() => { update((b) => ({ ...b, ...undo })); setUndo(null); setMsg('Cambios deshechos.') }}>Deshacer</button>}
          <button className="btn sm" type="button" onClick={() => replaceAll({ parts: [], red: null, black: null, src: null }, 'Placa vacía.')}>Vaciar</button>
          <button className="btn sm" type="button" onClick={loadSolution}>Ver solución</button>
        </span>
      </div>
    </div>
  )
}

const hint = (tool) =>
  tool === 'erase' ? 'Pulsa una pieza, una punta o una pinza para quitarla.'
    : tool === 'move' ? 'Pulsa la pata que quieres levantar y después su nuevo agujero.'
      : tool === 'red' || tool === 'black' ? 'Pulsa el agujero donde quieres apoyar la punta.'
        : tool.startsWith('src') ? 'Pulsa el agujero donde va la pinza.'
          : tool.startsWith('led') ? 'Pulsa primero el agujero del ánodo (+) y después el del cátodo (−).'
            : 'Pulsa un agujero para la primera pata y otro para la segunda.'

/* Lista de comprobación del montaje frente a la figura del guion */
export function BenchStatus({ id, target, source }) {
  const [bench] = useBench(id)
  const { ok, items } = checkBench(bench, target, source)
  return (
    <div className={`status${ok ? ' ok' : ''}`}>
      <div className="status-head">{ok ? '✓ Montaje correcto' : 'Comprobación del montaje'}</div>
      <ul className="check">
        {items.map((it) => (
          <li key={it.text} className={it.ok ? 'ok' : ''}><span className="ic" aria-hidden="true">{it.ok ? '✓' : '○'}</span>{it.text}</li>
        ))}
      </ul>
    </div>
  )
}

/* Multímetro conectado a la placa de un montaje */
export function BenchMeter({ id }) {
  const [bench, update, supply] = useBench(id)
  const { m, probes, right } = measureBench(bench, supply)
  return (
    <Multimeter dial={bench.dial} power={bench.power} m={m} jack={bench.jack} probes={probes} right={right}
      onDial={(dial) => update((b) => ({ ...b, dial }))} onPower={() => update((b) => ({ ...b, power: !b.power }))}
      onJack={(jack) => update((b) => ({ ...b, jack }))} />
  )
}

/* Lectura compacta del multímetro, fija arriba al desplazarse. Solo en pantallas estrechas,
   donde el multímetro queda lejos de la placa: permite medir sin subir y bajar. */
export function BenchReadout({ id }) {
  const [bench, update, supply] = useBench(id)
  const { r, right } = measureBench(bench, supply)
  const g = DIAL[bench.dial].g
  const zones = g === 'adc' || g === 'vdc' || g === 'ohm' ? fondos(g) : []
  const text = r.kind === 'off' ? 'Apagado' : !right ? 'Revisa el borne' : r.over ? 'OL' : `${r.text} ${r.unit}`
  return (
    <div className="readout-sm" aria-label="Lectura del multímetro">
      <div className="readout-lcd"><span className="mono">{text}</span></div>
      <div className="segctl" role="radiogroup" aria-label="Fondo de escala">
        {zones.map((p) => (
          <button key={p.i} type="button" role="radio" aria-checked={p.i === bench.dial} onClick={() => update((b) => ({ ...b, dial: p.i, power: true }))}>{p.l}</button>
        ))}
      </div>
    </div>
  )
}

/* Multímetro en las salidas de la fuente: elige los terminales, mide y anota. rows: [{ k, term, label }] */
export function TerminalMeter({ id, rows }) {
  const [bench, update, supply] = useBench(id)
  const row = rows.find((x) => x.term === bench.term) ?? rows[0]
  const right = jackOk(bench)
  const m = { ohms: Infinity, amps: 0, volts: right ? TERMINALS[row.term].volts(supply) : 0 }
  const r = reading(bench.dial, m, bench.power)
  const can = r.kind === 'volt' && !r.over && m.volts > 0
  return (
    <>
      <div className="segctl" role="radiogroup" aria-label="Terminales que se miden" style={{ marginBottom: 8 }}>
        {rows.map((x) => (
          <button key={x.term} type="button" role="radio" aria-checked={x.term === row.term} onClick={() => update((b) => ({ ...b, term: x.term }))}>{x.label}</button>
        ))}
      </div>
      <Multimeter dial={bench.dial} power={bench.power} m={m} jack={bench.jack} probes right={right}
        onDial={(dial) => update((b) => ({ ...b, dial }))} onPower={() => update((b) => ({ ...b, power: !b.power }))}
        onJack={(jack) => update((b) => ({ ...b, jack }))} />
      <button className="btn sm" type="button" disabled={!can} style={{ marginTop: 8 }} onClick={() => update((b) => note(b, row.k, r))}>
        {can ? `Anotar ${r.text} ${r.unit} en ${row.label}` : 'Sin lectura de tensión'}
      </button>
    </>
  )
}

/* Multímetro sobre una resistencia suelta: identificar y medir (Tabla 2.4) */
const LOOSE = ['r1', 'r2', 'r3', 'r4', 'r5']
export function ResistorMeter({ id }) {
  const [bench, update] = useBench(id)
  const right = jackOk(bench)
  const k = bench.pick
  const m = { ohms: right ? REAL[k] : Infinity, amps: 0, volts: 0 }
  const r = reading(bench.dial, m, bench.power)
  const can = r.kind === 'ohm' && !r.over
  return (
    <>
      <div className="segctl" role="radiogroup" aria-label="Resistencia que se mide" style={{ marginBottom: 8 }}>
        {LOOSE.map((x) => <button key={x} type="button" role="radio" aria-checked={x === k} onClick={() => update((b) => ({ ...b, pick: x }))}>{RES_NAME[x]}</button>)}
      </div>
      <Multimeter dial={bench.dial} power={bench.power} m={m} jack={bench.jack} probes right={right}
        onDial={(dial) => update((b) => ({ ...b, dial }))} onPower={() => update((b) => ({ ...b, power: !b.power }))}
        onJack={(jack) => update((b) => ({ ...b, jack }))} />
      <button className="btn sm" type="button" disabled={!can} style={{ marginTop: 8 }} onClick={() => update((b) => note(b, k, r))}>
        {can ? `Anotar ${r.text} ${r.unit} en ${RES_NAME[k]}` : 'Sin lectura de resistencia'}
      </button>
    </>
  )
}

/* Preparar el multímetro antes de medir corriente */
export function MeterPrep({ id }) {
  const [bench] = useBench(id)
  const p = DIAL[bench.dial]
  const items = [
    { ok: bench.power, text: 'Multímetro encendido' },
    { ok: p.g === 'adc', text: p.g === 'adc' ? 'Selector en corriente continua' : 'Gira el selector a la zona A⎓' },
    { ok: p.name === '20 A', text: 'Fondo de 20 A para empezar' },
    { ok: bench.jack === '20A', text: 'Cable rojo en el borne 20 A' },
  ]
  const ok = items.every((i) => i.ok)
  return (
    <div className={`status${ok ? ' ok' : ''}`}>
      <div className="status-head">{ok ? '✓ Multímetro preparado' : 'Comprobación del multímetro'}</div>
      <ul className="check">
        {items.map((it) => <li key={it.text} className={it.ok ? 'ok' : ''}><span className="ic" aria-hidden="true">{it.ok ? '✓' : '○'}</span>{it.text}</li>)}
      </ul>
    </div>
  )
}

const LABEL = { IR1: 'I_R₁', IR2: 'I_R₂', IR3: 'I_R₃', IR4: 'I_R₄', IR5: 'I_R₅', IR6: 'I_R₆', Ig: 'I_g' }
const nice = (k) => LABEL[k].replace('_', '')

/* Lecturas de corriente: detecta qué rama está abierta y anota lo que marca el amperímetro.
   keys: corrientes que hay que medir. target: montaje, para el botón que abre una rama de ejemplo. */
export function CurrentLog({ id, keys, target }) {
  const [bench, update, supply] = useBench(id)
  const { an, r, right } = measureBench(bench, supply)
  const el = branchOf(bench)
  const key = el === 'src' && !keys.includes('Ig') ? 'IR1' : CURRENT_KEY[el]
  const ammeter = DIAL[bench.dial].g === 'adc' && right
  const valid = ammeter && r.kind === 'amp' && !r.over && !an.short && keys.includes(key) && an.amps
  const say = an.short || an.overload ? 'Cortocircuito: el amperímetro está en paralelo con la fuente. Quita las puntas.'
    : !an.powered ? 'La fuente no está alimentando el circuito.'
      : !ammeter ? 'Prepara el multímetro como amperímetro.'
        : !bench.red || !bench.black ? 'Coloca las dos puntas para cerrar la rama abierta.'
          : !el ? 'El amperímetro no está en serie: abre la rama y ciérrala con las puntas.'
            : `Amperímetro en serie con ${el === 'src' ? 'la fuente' : RES_NAME[el]}.`
  return (
    <div className="logbox">
      <h3>Medidas de corriente</h3>
      <p className="note" style={{ margin: '0 0 8px' }} aria-live="polite">{say}</p>
      <ul className="loglist">
        {keys.map((k) => {
          const e = bench.log[k]
          return <li key={k} className={e ? 'ok' : ''}><span>{nice(k)}</span><span className="mono">{e ? `${e.text} ${e.unit}` : '—'}</span></li>
        })}
      </ul>
      <div className="acts">
        <button className="btn sm" type="button" disabled={!valid} onClick={() => update((b) => note(b, key, r))}>
          {valid ? `Anotar ${r.text} ${r.unit} en ${nice(key)}` : 'Anotar lectura'}
        </button>
        {keys.map((k) => (
          <button key={k} className="btn sm" type="button" onClick={() => update((b) => ({ ...b, ...openBranch(target, k) }))}>Abrir {nice(k)}</button>
        ))}
      </div>
    </div>
  )
}

/* Ley de corrientes con las lecturas anotadas. eqs: [{ node, ins, outs }] */
export function KclCheck({ id, eqs }) {
  const [bench] = useBench(id)
  const val = (k) => { const e = bench.log[k]; return e ? toNum(e.text) * UNITS[e.unit] : null }
  const side = (ks) => ks.map(nice).join(' + ')
  return (
    <div className="kcl">
      {eqs.map(({ node, ins, outs }) => {
        const all = [...ins, ...outs].map(val), ready = all.every((v) => v !== null)
        const sum = (ks) => ks.reduce((a, k) => a + val(k), 0)
        const a = ready ? sum(ins) : 0, b = ready ? sum(outs) : 0
        const ok = ready && Math.abs(a - b) <= 0.01e-3 * (ins.length + outs.length)
        return (
          <div key={node} className="eq">
            <span>{node}: {side(ins)} = {side(outs)}</span>
            {ready ? <><span className="mute">{amp(a)} = {amp(b)}</span><span className={`badge ${ok ? 'good' : 'warn'}`}>{ok ? 'Se cumple' : 'Revisa tus medidas'}</span></>
              : <span className="mute">Faltan medidas</span>}
          </div>
        )
      })}
    </div>
  )
}

/* Cambiar R₆ en los mismos agujeros: el campo `as` dice qué resistencia física hace de R₆ */
const R6_CASES = [['r3b', '3,3 kΩ'], [null, '100 kΩ'], ['r5', '2,2 MΩ']]
const caseOf = (bench) => bench.parts.find((p) => p.k === 'r6')?.as ?? null
export function R6Swap({ id }) {
  const [bench, update] = useBench(id)
  const cur = caseOf(bench)
  const set = (as) => update((b) => ({
    ...b, parts: b.parts.map((p) => (p.k === 'r6' ? { ...p, as: as ?? undefined } : p)),
    seen: { ...b.seen, [as ?? 'r6']: true },
  }))
  return (
    <div className="segctl" role="radiogroup" aria-label="Valor de R₆" style={{ marginTop: 10 }}>
      {R6_CASES.map(([as, t]) => <button key={t} type="button" role="radio" aria-checked={cur === as} onClick={() => set(as)}>R₆ = {t}</button>)}
    </div>
  )
}

/* Corriente y brillo de cada LED con el montaje actual */
export function LedRows({ id }) {
  const [bench, , supply] = useBench(id)
  const { an } = measureBench(bench, supply)
  const led = (k) => { const p = bench.parts.find((x) => x.k === k); return p ? an.led[p.id] : null }
  return (
    <div className="leds">
      {[['led1', 'LED de R₃'], ['led2', 'LED de R₆']].map(([k, t]) => {
        const s = led(k), lit = s?.on ? glow(s.amps) : 0
        return (
          <div key={k} className="ledrow">
            <b>{t}</b>
            <div className="ledbar" role="img" aria-label={`Brillo del ${t}: ${Math.round(lit * 100)} %`}><i style={{ width: `${lit * 100}%` }} /></div>
            <span className="mono">{s?.on ? amp(s.amps) : 'apagado'}</span>
          </div>
        )
      })}
    </div>
  )
}

/* Bloque I, actividad 4: predecir y comprobar con los mandos */
const FIVE_OPTIONS = [
  { t: 'Sube y baja con los mandos', ok: false, fb: 'Los mandos solo actúan sobre S₁ y S₂. Los terminales 10 y 11 son una tercera fuente.' },
  { t: 'Baja al subir S₁ o S₂', ok: false, fb: 'No comparten energía de esa forma: cada salida se regula por separado.' },
  { t: 'No cambia', ok: true, fb: 'Los terminales 10 y 11 son una tercera fuente, de 5 V constantes, independiente de S₁ y S₂.' },
]
export function FivePredict() {
  const [bench, , supply] = useBench('m1')
  const [guess, setGuess] = useState(null)
  const [force, setForce] = useState(false)
  const moved = display(supply, 's1') !== '6.0' || display(supply, 's2') !== '9.0'
  const measured = supply.on && bench.term === '10-11' && moved
  const show = force || (guess && measured)
  return (
    <>
      <Quiz q="Antes de probarlo: si mueves los mandos de S₁ o S₂, ¿qué le pasa a la tensión entre 10 y 11?" options={FIVE_OPTIONS} reveal={!!show} onPick={setGuess}
        pending="Predicción anotada. Ahora mide entre 10 y 11 y mueve los mandos de S₁ o S₂." />
      {!show && <button className="linkbtn" type="button" onClick={() => setForce(true)}>Mostrar la explicación sin medir</button>}
    </>
  )
}

/* Bloque III, actividad 6: la predicción se corrige después de ver los tres casos */
const LED_OPTIONS = [
  { t: 'Brilla más', ok: false, fb: 'Es lo intuitivo: la otra rama «pierde» corriente. Pero la fuente fija la tensión, y por R₃ sigue pasando Eg / R₃.' },
  { t: 'Brilla menos', ok: false, fb: 'La corriente por R₃ solo depende de Eg y de R₃, y ninguna de las dos ha cambiado.' },
  { t: 'Brilla igual', ok: true, fb: 'IR₃ = Eg / R₃: la fuente fija la tensión en las dos ramas, así que lo que pase en R₆ no afecta a R₃.' },
]
export function LedPredict({ id }) {
  const [bench] = useBench(id)
  const [guess, setGuess] = useState(null)
  const [force, setForce] = useState(false)
  const all = ['r3b', 'r6', 'r5'].every((k) => bench.seen[k])
  const show = force || (guess && all)
  return (
    <>
      <Quiz q="Antes de probarlo: al subir R₆ de 3,3 kΩ a 2,2 MΩ, ¿qué le pasa al LED de R₃?" options={LED_OPTIONS} reveal={!!show} onPick={setGuess}
        pending="Predicción anotada. Ahora prueba los tres valores de R₆ y compara los dos LEDs." />
      {!show && <button className="linkbtn" type="button" onClick={() => setForce(true)}>Mostrar la explicación sin medir</button>}
    </>
  )
}
