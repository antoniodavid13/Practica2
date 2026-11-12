import { useState } from 'react'
import { fmt } from '../lib/circuit'
import { useLab } from '../lib/lab'
import { PAIRS, display, measureBench, setpoint, supplyChecks } from '../lib/practice'
import { drawSegments } from '../lib/segments'
import { Lazy3D } from './Lazy3D'
import { plug, screen } from '../lib/three'

/* ================= Fuente de alimentación Promax FAC-662B =================
   Modelo 3D de blender/instrumentos.py. Los números son los de la Figura 2.1 del guion. */

const C_MAX = 30, F_MAX = 0.5
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d
// Ajuste grueso: 0–30 V en 270°. Fino: ±0,5 V en 270°.
const KNOBS = {
  's1:c': { node: 'FAC_Knob_S1_Coarse', ch: 's1', f: 'c', n: 4, x: -43, t: 'S₁ · ajuste grueso (4)' },
  's1:f': { node: 'FAC_Knob_S1_Fine', ch: 's1', f: 'f', n: 5, x: -104, t: 'S₁ · ajuste fino (5)' },
  's2:c': { node: 'FAC_Knob_S2_Coarse', ch: 's2', f: 'c', n: 17, x: 45, t: 'S₂ · ajuste grueso (17)' },
  's2:f': { node: 'FAC_Knob_S2_Fine', ch: 's2', f: 'f', n: 16, x: 103, t: 'S₂ · ajuste fino (16)' },
}
const knobAngle = (f, v) => (f === 'c' ? -135 + (v / C_MAX) * 270 : (v / F_MAX) * 135)
const perDeg = (f) => (f === 'c' ? C_MAX / 270 : (2 * F_MAX) / 270)
const clickStep = (f) => (f === 'c' ? 0.5 : 0.02)

const pairOf = (t) => Object.keys(PAIRS).find((k) => PAIRS[k].includes(t)) ?? null
const TERM_TIP = {
  7: 'Borne 7: positivo de S₁', 8: 'Borne 8: negativo de S₁', 9: 'Borne 9: tierra',
  10: 'Borne 10: positivo de la salida fija de 5 V', 11: 'Borne 11: negativo de la salida fija de 5 V',
  12: 'Borne 12: tierra', 13: 'Borne 13: positivo de S₂', 14: 'Borne 14: negativo de S₂',
}
const MODES = { INDEP: 'indep', SERIES: 'series', TRACK: null, PARALL: null }

function paintLed(s, text, on) {
  const { g, canvas } = s, W = canvas.width, H = canvas.height
  g.fillStyle = '#160302'
  g.fillRect(0, 0, W, H)
  if (on) {
    g.shadowColor = 'rgba(255,40,20,0.85)'
    g.shadowBlur = 14
    drawSegments(g, text, { right: W - 22, y: 34, h: 178, on: '#ff3a24', off: null, cells: 3 })
    g.shadowBlur = 0
    drawSegments(g, '888', { right: W - 22, y: 34, h: 178, on: 'rgba(255,60,40,0.07)', off: null, cells: 3 })
  }
  s.tex.needsUpdate = true
}

/* Modelo 3D. leads: bornes con clavija ({ '7': 'red', '8': 'black' }); onTerm: al pulsar un par de bornes */
function Supply3D({ supply, set, amps, leads, onTerm, onInfo }) {
  const turnKnob = (k, deg) => {
    const { ch, f } = KNOBS[k]
    set((x) => {
      const lim = f === 'c' ? [0, C_MAX] : [-F_MAX, F_MAX]
      return { ...x, [ch]: { ...x[ch], [f]: round(clamp(x[ch][f] + deg * perDeg(f), ...lim), 3) } }
    })
  }
  const nudge = (k, dir) => {
    const { ch, f } = KNOBS[k]
    set((x) => {
      const lim = f === 'c' ? [0, C_MAX] : [-F_MAX, F_MAX]
      return { ...x, [ch]: { ...x[ch], [f]: round(clamp(x[ch][f] + dir * clickStep(f), ...lim), 3) } }
    })
  }
  const leadKey = JSON.stringify(leads ?? {})
  return (
    <Lazy3D url="models/fac662b.glb" ratio={1.3} className="i3d-supply"
      label={`Fuente de alimentación Promax FAC-662B en 3D. ${supply.on ? `Encendida, modo ${supply.mode === 'series' ? 'serie' : 'independiente'}. S₁ = ${display(supply, 's1')} V, S₂ = ${display(supply, 's2')} V.` : 'Apagada.'}`}
      hot={(name) => {
        let m = /^FAC_Knob_(S1|S2)_(Coarse|Fine|Ilim)$/.exec(name)
        if (m) return m[2] === 'Ilim' ? 'ilim' : `knob:${m[1].toLowerCase()}:${m[2] === 'Coarse' ? 'c' : 'f'}`
        m = /^FAC_Btn_(V|A)_(S1|S2)$/.exec(name)
        if (m) return `${m[1] === 'V' ? 'vsel' : 'asel'}:${m[2].toLowerCase()}`
        m = /^FAC_Btn_(INDEP|TRACK|SERIES|PARALL)$/.exec(name)
        if (m) return `mode:${m[1]}`
        if (name === 'FAC_Switch_LINE') return 'line'
        m = /^FAC_Term_(\d+)$/.exec(name)
        if (m) return `term:${m[1]}`
        return null
      }}
      turn={(k) => k.startsWith('knob:')}
      tip={(k) => {
        if (k.startsWith('knob:')) return `${KNOBS[k.slice(5)].t}: arrástralo para girarlo o pulsa a un lado`
        if (k === 'ilim') return 'Límite de corriente (6 y 15): no se usa en esta práctica'
        if (k === 'line') return `Interruptor LINE (19): ${supply.on ? 'apagar' : 'encender'}`
        if (k.startsWith('vsel:')) return `Voltímetro (3): mostrar ${k.endsWith('1') ? 'S₁' : 'S₂'}`
        if (k.startsWith('asel:')) return `Amperímetro (18): mostrar ${k.endsWith('1') ? 'S₁' : 'S₂'}`
        if (k.startsWith('mode:')) { const md = k.slice(5); return MODES[md] ? `FUNCTION (2): modo ${md === 'INDEP' ? 'independiente' : 'serie'}` : `${md}: no se usa en esta práctica` }
        if (k.startsWith('term:')) { const t = k.slice(5); return `${TERM_TIP[t]}${onTerm && pairOf(t) ? ' · pulsa para medir aquí' : ''}` }
        return null
      }}
      onPick={(k, p) => {
        if (!k) return
        if (k.startsWith('knob:')) { const kk = k.slice(5); nudge(kk, p.x > KNOBS[kk].x ? 1 : -1) }
        else if (k === 'line') set((x) => ({ ...x, on: !x.on }))
        else if (k.startsWith('vsel:')) set((x) => ({ ...x, vSel: k.slice(5) }))
        else if (k.startsWith('asel:')) set((x) => ({ ...x, aSel: k.slice(5) }))
        else if (k.startsWith('mode:')) {
          const md = MODES[k.slice(5)]
          if (md) set((x) => ({ ...x, mode: md }))
          else onInfo?.(`${k.slice(5)} no se usa en esta práctica: solo los modos independiente y serie.`)
        } else if (k === 'ilim') onInfo?.('Los mandos I. LIMIT (6 y 15) no se usan en esta práctica.')
        else if (k.startsWith('term:') && onTerm) { const pr = pairOf(k.slice(5)); if (pr) onTerm(pr) }
      }}
      onTurn={(k, d) => turnKnob(k.slice(5), d)}
      setup={({ THREE, nodes, root }) => {
        const dv = screen(THREE, nodes.FAC_Disp_V, 512, 246), da = screen(THREE, nodes.FAC_Disp_A, 512, 246)
        // Cada tecla con su material, para oscurecer solo la pulsada
        const keys = {}
        for (const n of ['V_S1', 'V_S2', 'INDEP', 'TRACK', 'SERIES', 'PARALL', 'A_S1', 'A_S2']) {
          const o = nodes[`FAC_Btn_${n}`]
          o.material = o.material.clone()
          keys[n] = { o, base: o.material.color.clone(), z: o.position.z }
        }
        const plugs = []
        const at = (t) => root.worldToLocal(nodes[`FAC_Term_${t}`].getWorldPosition(new THREE.Vector3()))
        return {
          dv, da, keys, plugs, at, leads: null,
          dispose() { dv.dispose(); da.dispose(); plugs.forEach((p) => p.dispose()); Object.values(keys).forEach((k) => k.o.material.dispose()) },
        }
      }}
      apply={({ THREE, nodes, root, extra, ease, invalidate }) => {
        for (const { node, ch, f } of Object.values(KNOBS))
          ease(nodes[node], 'rotation', 'z', (-knobAngle(f, supply[ch][f]) * Math.PI) / 180)
        ease(nodes.FAC_Switch_LINE, 'rotation', 'x', ((supply.on ? -25 : 25) * Math.PI) / 180)
        const pressed = { V_S1: supply.vSel === 's1', V_S2: supply.vSel === 's2', INDEP: supply.mode === 'indep', SERIES: supply.mode === 'series', A_S1: supply.aSel !== 's2', A_S2: supply.aSel === 's2' }
        for (const [n, { o, base, z }] of Object.entries(extra.keys)) {
          const on = !!pressed[n]
          ease(o, 'position', 'z', z - (on ? 0.0025 : 0))
          o.material.color.copy(base).multiplyScalar(on ? 0.3 : 1)
        }
        paintLed(extra.dv, display(supply, supply.vSel), supply.on)
        paintLed(extra.da, amps.toFixed(2), supply.on)
        if (extra.leads !== leadKey) {
          extra.plugs.forEach((p) => { root.remove(p.group); p.dispose() })
          extra.plugs.length = 0
          for (const [t, color] of Object.entries(leads ?? {})) {
            const p = plug(THREE, color === 'red' ? '#c81e1e' : '#1c1c1c')
            const a = extra.at(t)
            a.z += 0.0005
            p.place(a, new THREE.Vector3(a.x * 0.5, -0.3, 0.06))
            root.add(p.group)
            extra.plugs.push(p)
          }
          extra.leads = leadKey
        }
        invalidate()
      }}
    />
  )
}

/* Controles de la fuente sin 3D: teclado, lectores de pantalla y ajuste preciso */
function Channel({ name, k, ids, supply, set }) {
  const s = supply[k]
  const upd = (patch) => set((x) => ({ ...x, [k]: { ...x[k], ...patch } }))
  return (
    <div className="supply-ch">
      <b>{name} · {fmt(setpoint(s), 2)} V</b>
      <label>
        <span>Grueso ({ids[0]})<em>{fmt(s.c, 1)} V</em></span>
        <input type="range" min="0" max={C_MAX} step="0.1" value={s.c} aria-label={`Ajuste grueso de ${name}`} onChange={(e) => upd({ c: +e.target.value })} />
      </label>
      <label>
        <span>Fino ({ids[1]})<em>{s.f > 0 ? '+' : ''}{fmt(s.f, 2)} V</em></span>
        <input type="range" min={-F_MAX} max={F_MAX} step="0.01" value={s.f} aria-label={`Ajuste fino de ${name}`} onChange={(e) => upd({ f: +e.target.value })} />
      </label>
    </div>
  )
}

/* Fuente de alimentación Promax FAC-662B.
   `id`: placa conectada a la fuente, para que el amperímetro interno marque su corriente.
   `leads` y `onTerm`: clavijas del multímetro en los bornes y selección de la salida que se mide. */
export function Supply({ id, leads, onTerm }) {
  const { lab, setLab } = useLab()
  const [msg, setMsg] = useState(null)
  const supply = lab.supply
  const set = (fn) => setLab((l) => ({ ...l, supply: fn(l.supply) }))
  const an = id ? measureBench(lab[id], supply).an : null
  const amps = supply.on && an?.powered ? Math.min(1, Math.abs(an.ig)) : 0
  // Con una placa conectada, sus cables salen de la salida que la alimenta
  const wires = leads ?? (id && an?.powered ? (supply.mode === 'series' ? { 7: 'red', 14: 'black' } : { 7: 'red', 8: 'black' }) : null)
  return (
    <div className="supply">
      <Supply3D supply={supply} set={set} amps={amps} leads={wires} onTerm={onTerm} onInfo={setMsg} />
      {msg && <p className="note supply-msg" aria-live="polite">{msg}</p>}
      <div className="supply-row">
        <div className="supply-keys" role="group" aria-label="Interruptor y modo">
          <button type="button" className="supply-key power" aria-pressed={supply.on} onClick={() => set((x) => ({ ...x, on: !x.on }))}>LINE · {supply.on ? 'encendida' : 'apagada'}</button>
          <button type="button" className="supply-key" aria-pressed={supply.mode === 'indep'} onClick={() => set((x) => ({ ...x, mode: 'indep' }))}>INDEP</button>
          <button type="button" className="supply-key" aria-pressed={supply.mode === 'series'} onClick={() => set((x) => ({ ...x, mode: 'series' }))}>SERIES</button>
        </div>
        <div className="supply-keys" role="group" aria-label="Voltímetro: qué fuente marca">
          {[['s1', 'V S₁'], ['s2', 'V S₂']].map(([k, t]) => (
            <button key={k} type="button" className="supply-key" aria-pressed={supply.vSel === k} onClick={() => set((x) => ({ ...x, vSel: k }))}>{t}</button>
          ))}
        </div>
      </div>
      <details className="supply-more">
        <summary>Ajuste con deslizadores</summary>
        <div className="supply-chs">
          <Channel name="S₁" k="s1" ids={[4, 5]} supply={supply} set={set} />
          <Channel name="S₂" k="s2" ids={[17, 16]} supply={supply} set={set} />
        </div>
      </details>
    </div>
  )
}

/* Lo que marca la fuente, en una línea */
export function SupplyLine() {
  const { lab } = useLab()
  const s = lab.supply
  return (
    <p className="note" style={{ margin: '0 0 8px' }}>
      {s.on ? <>El voltímetro de la fuente marca <b className="mono">{display(s, 's1')} V</b> en S₁ y <b className="mono">{display(s, 's2')} V</b> en S₂.</> : 'La fuente está apagada: enciéndela con el interruptor LINE.'}
    </p>
  )
}

/* Lista de comprobación del ajuste de la fuente */
export function SupplyStatus({ need }) {
  const { lab } = useLab()
  const items = supplyChecks(lab.supply, need)
  const ok = items.every((i) => i.ok)
  return (
    <div className={`status${ok ? ' ok' : ''}`}>
      <div className="status-head">{ok ? '✓ Fuente ajustada' : 'Comprobación de la fuente'}</div>
      <ul className="check">
        {items.map((it) => (
          <li key={it.text} className={it.ok ? 'ok' : ''}><span className="ic" aria-hidden="true">{it.ok ? '✓' : '○'}</span>{it.text}</li>
        ))}
      </ul>
    </div>
  )
}
