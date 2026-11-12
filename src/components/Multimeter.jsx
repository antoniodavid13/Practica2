import { ADC, DIAL, OHM, VDC, bestDc, bestOhm, dialAngle, reading } from '../lib/meter'
import { ohm } from '../lib/circuit'

const CX = 150, CY = 300, R_LBL = 92, R_GRP = 124
const polar = (deg, r) => [CX + r * Math.sin((deg * Math.PI) / 180), CY - r * Math.cos((deg * Math.PI) / 180)]
const mean = (g) => { const ix = DIAL.map((p, i) => (p.g === g ? i : -1)).filter((i) => i >= 0); return dialAngle((ix[0] + ix.at(-1)) / 2) }
// Las etiquetas de tensión se apartan un poco hacia los lados para no chocar con POWER y MAX
const GROUPS = [['vdc', 'V⎓', 44], ['adc', 'A⎓'], ['aac', 'A~'], ['cap', 'F'], ['ohm', 'Ω'], ['vac', 'V~', -44]]

const JACKS = [['20A', 62, 'red', '20A'], ['mA', 114, 'red', 'mA'], ['COM', 182, 'black', null], ['VΩHz', 240, 'red', 'V']]
const JACK_NAME = { V: 'VΩHz', mA: 'mA', '20A': '20 A' }
const ZONES = [['V⎓', 2, 'vdc'], ['A⎓', 7, 'adc'], ['Ω', 17, 'ohm']]
const list = { vdc: VDC, adc: ADC, ohm: OHM }

function advice(r, p, m, jack, probes, right) {
  if (r.kind === 'off') return [null, 'Multímetro apagado. Pulsa POWER.']
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

/* Multímetro virtual Promax PD-695: pantalla, POWER, selector giratorio y bornes.
   Las puntas se colocan en la placa; aquí se elige la función, el fondo de escala y el borne del cable rojo. */
export function Multimeter({ dial, power, m, jack, probes, right, onDial, onPower, onJack }) {
  const r = reading(dial, m, power)
  const p = { ...DIAL[dial], i: dial }
  const [badge, note] = advice(r, p, m, jack, probes, right)
  const turn = (d) => onDial((dial + d + DIAL.length) % DIAL.length)
  const ang = dialAngle(dial)
  const fondos = list[p.g] ?? null
  const redX = JACKS.find((j) => j[3] === jack)[1]

  return (
    <div className="dmm">
      <svg viewBox="0 0 300 548" role="img" aria-label={`Multímetro. Selector en ${p.l} ${p.g}. Pantalla: ${r.text} ${r.unit}`}>
        <rect className="dmm-body" x="8" y="8" width="284" height="500" rx="30" />
        {/* Pantalla */}
        <rect className="dmm-bezel" x="30" y="28" width="240" height="114" rx="14" />
        <rect className="dmm-lcd" x="44" y="40" width="212" height="90" rx="6" />
        {power && (
          <g className="dmm-lcd-ink">
            <text className="dmm-ann" x="54" y="56">{r.kind === 'volt' || r.kind === 'amp' ? (r.ac ? 'AC' : 'DC') : ''}</text>
            <text className="dmm-ann" x="246" y="56" textAnchor="end">{p.name ? `RANGE ${p.l}` : ''}</text>
            <text className="dmm-digits" x="204" y="112" textAnchor="end">{r.text}</text>
            <text className="dmm-unit" x="248" y="112" textAnchor="end">{r.over ? '' : r.unit}</text>
          </g>
        )}
        {/* Panel */}
        <rect className="dmm-panel" x="22" y="154" width="256" height="322" rx="16" />
        <g className="dmm-btn" role="button" tabIndex="0" aria-pressed={power} aria-label="POWER"
          onClick={onPower} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onPower() } }}>
          <rect x="36" y="166" width="54" height="17" rx="8.5" />
          <text x="63" y="198" textAnchor="middle">POWER</text>
        </g>
        <g className="dmm-btn deco" aria-hidden="true">
          <rect x="210" y="166" width="54" height="17" rx="8.5" />
          <text x="237" y="198" textAnchor="middle">MAX</text>
        </g>
        {/* Selector */}
        {GROUPS.map(([g, t, a]) => {
          const [x, y] = polar(a ?? mean(g), a ? 116 : R_GRP)
          return <text key={g} className="dmm-grp" x={x} y={y + 4} textAnchor="middle">{t}</text>
        })}
        {DIAL.map((d, i) => {
          const a = dialAngle(i), [x1, y1] = polar(a, 62), [x2, y2] = polar(a, 69), [lx, ly] = polar(a, R_LBL)
          return (
            <g key={i} className={`dmm-pos${i === dial ? ' sel' : ''}${d.g === 'ohm' ? ' ohm' : ''}`} onClick={() => onDial(i)}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              <circle cx={lx} cy={ly} r="10" />
              <text x={lx} y={ly + 3} textAnchor="middle">{d.l}</text>
            </g>
          )
        })}
        <g className="dmm-knob" style={{ transform: `translate(${CX}px, ${CY}px) rotate(${ang}deg)` }}>
          <circle r="56" />
          <rect className="ridge" x="-12" y="-55" width="24" height="110" rx="9" />
          <line className="mark" x1="0" y1="-50" x2="0" y2="-38" />
        </g>
        {/* Bornes */}
        {JACKS.map(([t, x, c, id]) => (
          <g key={t} className={`dmm-jack ${c}`} onClick={id ? () => onJack(id) : undefined} style={id ? { cursor: 'pointer' } : undefined}>
            <text x={x} y="430" textAnchor="middle">{t}</text>
            <circle className="ring" cx={x} cy="450" r="13" />
            <circle className="hole" cx={x} cy="450" r="7" />
          </g>
        ))}
        <text className="dmm-brand" x="40" y="494">PROMAX</text>
        <text className="dmm-model" x="262" y="494" textAnchor="end">MULTIMETER PD-695</text>
        {/* Cables de las puntas */}
        <path className="dmm-cable black" d="M182 450 C 182 510, 168 520, 160 548" />
        <path className="dmm-cable red" d={`M${redX} 450 C ${redX} 510, 252 520, 262 548`} />
      </svg>

      <div className="dmm-ctl">
        <button className="btn sm" type="button" onClick={() => turn(-1)} aria-label="Girar selector a la izquierda">↺</button>
        <div className="segctl" role="radiogroup" aria-label="Zona del selector">
          {ZONES.map(([t, i, g]) => <button key={g} type="button" role="radio" aria-checked={p.g === g} onClick={() => onDial(i)}>{t}</button>)}
        </div>
        <button className="btn sm" type="button" onClick={() => turn(1)} aria-label="Girar selector a la derecha">↻</button>
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
    </div>
  )
}
