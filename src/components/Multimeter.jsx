import { useRef } from 'react'
import { ADC, DIAL, OHM, STEP_DEG, VDC, bestDc, bestOhm, dialAngle, reading } from '../lib/meter'
import { ohm } from '../lib/circuit'
import { drawSegments } from '../lib/segments'
import { plug, screen } from '../lib/three'
import { Lazy3D } from './Lazy3D'

/* ================= Multímetro Promax PD-695 =================
   Modelo 3D de blender/instrumentos.py, como la fuente. Debajo, los mismos mandos en HTML: teclado,
   lectores de pantalla y ajuste rápido. Las puntas se colocan en la placa. */

const JACK_NAME = { V: 'VΩHz', mA: 'mA', '20A': '20 A' }
const ZONES = [['V⎓', 2, 'vdc'], ['A⎓', 7, 'adc'], ['Ω', 17, 'ohm']]
const list = { vdc: VDC, adc: ADC, ohm: OHM }

// Escala del selector en el modelo, en milímetros: centro y corona donde están los rótulos
const DIAL_Y = -18, RING = [19, 36]
const JACK_NODE = { '20A': '20A', mA: 'mA', V: 'V' }
const JACK_TIP = { '20A': 'Borne 20A: corrientes grandes', mA: 'Borne mA: corrientes de hasta 400 mA', V: 'Borne VΩHz: tensión y resistencia' }

function advice(r, p, m, jack, probes, right, fuse) {
  if (r.kind === 'off') return [null, 'Multímetro apagado. Pulsa POWER.']
  if (fuse && jack === 'mA') return [['bad', 'FUSIBLE'], 'El fusible del borne mA se ha fundido: pasó por él mucha más corriente de la que admite. El amperímetro ya no cierra el circuito y marca 0. Cámbialo antes de seguir midiendo en mA.']
  if (r.kind === 'na') return [null, 'Función no simulada. Gira el selector a la zona V, A o Ω.']
  if (r.ac) return [null, 'Estás en alterna y el circuito es de continua. Gira el selector a la zona de continua.']
  if (!right) {
    const want = p.g === 'adc' ? (p.name === '20 A' ? '20 A' : 'mA') : 'VΩHz'
    return [['warn', 'BORNE'], `El cable rojo está en ${JACK_NAME[jack]}: para esta posición va en el borne ${want}.`]
  }
  if (!probes) return [['warn', 'ABIERTO'], 'Coloca las dos puntas.']
  if (r.kind === 'ohm') {
    const best = bestOhm(m.ohms)
    if (r.over && !best) return [['bad', 'OL'], 'Circuito abierto entre las puntas: no hay camino de una a otra.']
    if (r.over) return [['bad', 'OL'], `La resistencia supera el fondo de ${p.name}. Sube de fondo de escala.`]
    if (best && best.i === p.i) return [['good', 'ÓPTIMO'], `Fondo inmediatamente superior al valor: máxima resolución (${ohm(r.res)}).`]
    return [['warn', 'VÁLIDO'], `Mide, pero pierdes cifras. Prueba con ${best.name}.`]
  }
  const v = r.kind === 'volt' ? m.volts : m.amps
  const name = r.kind === 'volt' ? 'tensión' : 'corriente'
  if (r.over) return [['bad', 'OL'], `La ${name} supera el fondo de ${p.name}. Sube de fondo de escala.`]
  if (!v) return [null, r.kind === 'amp' ? 'No pasa corriente por las puntas: abre la rama y ciérrala con el amperímetro.' : 'No hay tensión entre las puntas.']
  const best = bestDc(v, p.g)
  if (v < 0) return [['warn', 'SIGNO'], r.kind === 'amp' ? 'Signo negativo: la corriente entra por la punta negra.' : 'Signo negativo: la punta roja está en el lado negativo.']
  if (best && best.i === p.i) return [['good', 'ÓPTIMO'], `Fondo inmediatamente superior al valor: máxima resolución.`]
  return [['warn', 'VÁLIDO'], `Mide, pero pierdes cifras. Prueba con ${best?.name}.`]
}

/* Pantalla LCD pintada en un canvas: indicadores DC/AC y RANGE, cuatro dígitos de 7 segmentos y la unidad */
const LCD = { bg: '#b8c1a6', ink: '#1d2616', ghost: 'rgba(29,38,22,0.08)' }
function paintLcd(s, r, p, power) {
  const { g, canvas } = s, W = canvas.width, H = canvas.height
  g.fillStyle = power ? LCD.bg : '#9aa38b'
  g.fillRect(0, 0, W, H)
  if (power) {
    g.fillStyle = LCD.ink
    g.font = '600 30px Arial, sans-serif'
    g.textBaseline = 'top'
    g.textAlign = 'left'
    if (r.kind === 'volt' || r.kind === 'amp') g.fillText(r.ac ? 'AC' : 'DC', 26, 22)
    g.textAlign = 'right'
    if (p.name) g.fillText(`RANGE ${p.l}`, W - 26, 22)
    drawSegments(g, r.text, { right: W - 118, y: 82, h: 168, on: LCD.ink, off: LCD.ghost, cells: 4 })
    g.font = '700 46px Arial, sans-serif'
    g.textAlign = 'left'
    g.textBaseline = 'alphabetic'
    if (!r.over) g.fillText(r.unit, W - 104, 246)
  }
  s.tex.needsUpdate = true
}

// Posición del selector bajo un punto de la escala (milímetros del modelo), o null si cae fuera de la corona
function dialAt(p) {
  const dx = p.x, dy = p.y - DIAL_Y, rad = Math.hypot(dx, dy)
  if (rad < RING[0] || rad > RING[1]) return null
  const a = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
  return Math.floor(a / STEP_DEG) % DIAL.length
}

function Meter3D({ dial, power, r, p, jack, fuse, onDial, onPower, onJack }) {
  const acc = useRef(0) // grados arrastrados que aún no llegan a una posición del selector
  const label = `Multímetro Promax PD-695 en 3D. ${power ? `Selector en ${p.name ?? p.l}. Pantalla: ${r.text} ${r.unit}.` : 'Apagado.'} Cable rojo en ${JACK_NAME[jack]}.`
  return (
    <Lazy3D url="models/pd695.glb" ratio={0.62} className="i3d-meter" label={label}
      hot={(name, pt) => {
        if (/^PD695_Selector/.test(name)) return 'sel'
        if (name === 'PD695_Btn_POWER') return 'power'
        const m = /^PD695_Jack_(20A|mA|V|COM)$/.exec(name)
        if (m) return `jack:${m[1]}`
        if (/^PD695_(Panel|Rotulos)/.test(name) && dialAt(pt) !== null) return 'scale'
        return null
      }}
      turn={(k) => k === 'sel'}
      onTurn={(k, d, total, phase) => {
        if (phase === 'start') { acc.current = 0; return }
        acc.current += d
        const n = Math.trunc(acc.current / STEP_DEG)
        if (n) { acc.current -= n * STEP_DEG; onDial((dial + n + DIAL.length) % DIAL.length) }
      }}
      onPick={(k, pt) => {
        if (k === 'sel') onDial((dial + (pt.x > 0 ? 1 : -1) + DIAL.length) % DIAL.length)
        else if (k === 'scale') { const i = dialAt(pt); if (i !== null) onDial(i) }
        else if (k === 'power') onPower()
        else if (k?.startsWith('jack:') && k !== 'jack:COM') onJack(k.slice(5))
      }}
      tip={(k, pt) => {
        if (k === 'jack:mA' && fuse) return 'Borne mA: su fusible está fundido'
        if (k === 'sel') return 'Selector: arrástralo en círculo o pulsa a un lado para girarlo'
        if (k === 'scale') { const d = DIAL[dialAt(pt)]; return d ? `Pulsa para elegir ${d.name ?? d.l}` : null }
        if (k === 'power') return `POWER: ${power ? 'apagar' : 'encender'}`
        if (k === 'jack:COM') return 'Borne COM: el cable negro va siempre aquí'
        if (k?.startsWith('jack:')) { const j = k.slice(5); return `${JACK_TIP[j]}${j === jack ? ' · aquí está el cable rojo' : ' · pulsa para pasar aquí el cable rojo'}` }
        return null
      }}
      setup={({ THREE, nodes, root }) => {
        const lcd = screen(THREE, nodes.PD695_LCD, 512, 304)
        const btn = nodes.PD695_Btn_POWER
        const at = (t) => root.worldToLocal(nodes[`PD695_Jack_${t}`].getWorldPosition(new THREE.Vector3()))
        const red = plug(THREE, '#c81e1e'), black = plug(THREE, '#1c1c1c')
        // El anillo del borne mA, con material propio para oscurecerlo si su fusible se funde
        const ma = nodes.PD695_Jack_mA
        if (ma) { ma.material = ma.material.clone(); ma.userData.base = ma.material.color.clone() }
        root.add(red.group, black.group)
        const place = (pl, t) => { const a = at(t); a.z += 0.0015; pl.place(a, new THREE.Vector3(a.x * 0.4, -0.2, 0.05)) }
        place(black, 'COM')
        return {
          lcd, btnZ: btn?.position.z ?? 0, place, red, jack: null,
          ma, dispose() { lcd.dispose(); red.dispose(); black.dispose(); ma?.material.dispose() },
        }
      }}
      apply={({ nodes, extra, ease, invalidate }) => {
        // El selector gira en sentido horario visto de frente: rotación negativa en z
        ease(nodes.PD695_Selector, 'rotation', 'z', (-dialAngle(dial) * Math.PI) / 180, true)
        ease(nodes.PD695_Btn_POWER, 'position', 'z', extra.btnZ - (power ? 0.0015 : 0))
        paintLcd(extra.lcd, r, p, power)
        if (extra.ma) extra.ma.material.color.copy(extra.ma.userData.base).multiplyScalar(fuse ? 0.25 : 1)
        if (extra.jack !== jack) { extra.place(extra.red, JACK_NODE[jack]); extra.jack = jack }
        invalidate()
      }}
    />
  )
}

/* Multímetro virtual Promax PD-695: modelo 3D y, debajo, selector, fondos, bornes y consejo.
   fuse: fusible del borne mA fundido; onFuse: cambiarlo.
   alarm: [distintivo, texto] que sustituye al consejo cuando el montaje hace que la lectura no valga (un cortocircuito). */
export function Multimeter({ dial, power, m, jack, probes, right, fuse, alarm, onDial, onPower, onJack, onFuse }) {
  const r = reading(dial, m, power)
  const p = { ...DIAL[dial], i: dial }
  const [badge, note] = (power && right && alarm) || advice(r, p, m, jack, probes, right, fuse)
  const turn = (d) => onDial((dial + d + DIAL.length) % DIAL.length)
  const fondos = list[p.g] ?? null

  return (
    <div className="dmm">
      <Meter3D dial={dial} power={power} r={r} p={p} jack={jack} fuse={fuse} onDial={onDial} onPower={onPower} onJack={onJack} />
      <div className="dmm-ctl">
        <button className="btn sm" type="button" onClick={() => turn(-1)} aria-label="Girar selector a la izquierda">↺</button>
        <div className="segctl" role="radiogroup" aria-label="Zona del selector">
          {ZONES.map(([t, i, g]) => <button key={g} type="button" role="radio" aria-checked={p.g === g} onClick={() => onDial(i)}>{t}</button>)}
        </div>
        <button className="btn sm" type="button" onClick={() => turn(1)} aria-label="Girar selector a la derecha">↻</button>
        <button className="btn sm" type="button" aria-pressed={power} onClick={onPower}>{power ? 'Apagar' : 'POWER'}</button>
      </div>
      {fondos && (
        <div className="dmm-ctl">
          <div className="segctl" role="radiogroup" aria-label="Fondo de escala">
            {fondos.map((g) => <button key={g.i} type="button" role="radio" aria-checked={g.i === dial} onClick={() => onDial(g.i)}>{g.l}</button>)}
          </div>
        </div>
      )}
      <div className="dmm-ctl">
        <div className="segctl" role="radiogroup" aria-label="Borne del cable rojo">
          {Object.entries(JACK_NAME).map(([id, t]) => <button key={id} type="button" role="radio" aria-checked={jack === id} onClick={() => onJack(id)}>{t}</button>)}
        </div>
      </div>
      <p className="mnote">{badge && <span className={`badge ${badge[0]}`}>{badge[1]}</span>}<span>{note}</span></p>
      {fuse && onFuse && (
        <p className="mnote"><button className="btn sm" type="button" onClick={onFuse}>Cambiar el fusible del borne mA</button></p>
      )}
    </div>
  )
}
