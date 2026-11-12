import { R, dur, glow, ohm, only } from '../lib/circuit'
import { E36, TEO25 } from '../lib/practice'

// Camino de resistencia en zigzag entre (x1,y1) y (x2,y2), con cuerpo de longitud `body` centrado.
function zz(x1, y1, x2, y2, body) {
  const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux
  const s = (L - body) / 2, n = 6, seg = body / n, A = 7.5
  const pts = [[x1, y1], [x1 + ux * s, y1 + uy * s]]
  for (let i = 0; i < n; i++) {
    const t = s + seg * (i + 0.5), g = i % 2 ? -1 : 1
    pts.push([x1 + ux * t + nx * A * g, y1 + uy * t + ny * A * g])
  }
  pts.push([x1 + ux * (s + body), y1 + uy * (s + body)], [x2, y2])
  return 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L')
}

export const Sub = ({ children }) => <tspan className="sub" dy="4">{children}</tspan>

const Flow = ({ d, f }) => <path className="flow" d={d} style={{ '--d': dur(f) }} />
const Zr = ({ k, d }) => <path className="zr" style={{ '--c': `var(--${k})` }} d={d} />

function Lbl({ x, y, n, k, val, anchor = 'start' }) {
  return (
    <>
      <text className="slbl" style={{ '--c': `var(--${k})` }} x={x} y={y} textAnchor={anchor}>R<Sub>{n}</Sub></text>
      <text className="vlbl" x={x} y={y + 19} textAnchor={anchor}>{val}</text>
    </>
  )
}

const Highlights = ({ hl, step }) =>
  hl.map((h, i) => <path key={i} className={only(step, h.only, 'hlp')} d={h.d} />)

// Fuente de tensión con su borne positivo arriba
function Src({ x, y, label }) {
  return (
    <>
      <circle className="sch-src" cx={x} cy={y} r="20" />
      <text className="sch-sign" x={x} y={y - 3} textAnchor="middle">+</text>
      <text className="sch-sign" x={x} y={y + 14} textAnchor="middle">−</text>
      <text className="vlbl" x={x - 26} y={y + 4} textAnchor="end">{label}</text>
    </>
  )
}

function LedSym({ x, y, amps }) {
  const lit = glow(amps)
  return (
    <>
      <circle className="sch-led-glow" cx={x} cy={y} r="18" style={{ opacity: lit * 0.7 }} />
      <path className="sch-led" d={`M${x - 10} ${y - 10} L${x - 10} ${y + 10} L${x + 8} ${y} Z`} style={{ '--lit': `${Math.round(lit * 100)}%` }} />
      <path className="sch-led" d={`M${x + 8} ${y - 10} V${y + 10}`} />
    </>
  )
}

// Figura 2.5: R₁ en serie con (R₂ ∥ R₃) y con (R₄ ∥ R₅)
export function SchCircuit({ flow, hl = [], step = 0 }) {
  const ig = TEO25.IR1, f = (k) => TEO25[k] / ig
  return (
    <svg className={`sch${flow ? ' flowing' : ''}`} viewBox="0 0 470 330" role="img"
      aria-label="Esquema de la Figura 2.5: R1 en serie con el paralelo de R2 y R3 y con el paralelo de R4 y R5">
      <Highlights hl={hl} step={step} />
      <path className="w" d="M50 60 V105 M50 145 V280 M270 60 H370 M370 190 H270 M270 190 V280" />
      <Zr k="r1" d={zz(50, 60, 270, 60, 66)} />
      <Zr k="r2" d={zz(270, 60, 270, 190, 56)} />
      <Zr k="r3" d={zz(370, 60, 370, 190, 56)} />
      <Zr k="r4" d={zz(270, 190, 50, 190, 66)} />
      <Zr k="r5" d={zz(270, 280, 50, 280, 66)} />
      {flow && (
        <>
          <Flow d="M50 105 V60 H270" f={1} />
          <Flow d="M270 60 V190" f={f('IR2')} />
          <Flow d="M270 60 H370 V190 H270" f={f('IR3')} />
          <Flow d="M270 190 H50" f={f('IR4')} />
          <Flow d="M270 190 V280 H50 V190" f={f('IR5')} />
          <Flow d="M50 190 V145" f={1} />
        </>
      )}
      <Src x={50} y={125} label="Eg" />
      <circle className="jn" cx="50" cy="60" r="4" /><circle className="jn" cx="270" cy="60" r="4" />
      <circle className="jn" cx="270" cy="190" r="4" /><circle className="jn" cx="50" cy="190" r="4" />
      <text className="nlbl" x="38" y="50" textAnchor="end">A</text>
      <text className="nlbl" x="282" y="50">B</text>
      <text className="nlbl" x="282" y="208">C</text>
      <text className="nlbl" x="38" y="208" textAnchor="end">D</text>
      <Lbl x={160} y={26} n="1" k="r1" val="1,5 kΩ" anchor="middle" />
      <Lbl x={252} y={118} n="2" k="r2" val="2,2 kΩ" anchor="end" />
      <Lbl x={388} y={118} n="3" k="r3" val="3,3 kΩ" />
      <Lbl x={160} y={152} n="4" k="r4" val="10 kΩ" anchor="middle" />
      <Lbl x={160} y={242} n="5" k="r5" val="2,2 MΩ" anchor="middle" />
    </svg>
  )
}

// Figuras 2.6 y 2.7: R₃ ∥ R₆, con un LED en cada rama si `leds`
export function SchDivider({ flow, r6 = R.r6, leds, hl = [], step = 0 }) {
  const i3 = E36 / R.r3, i6 = E36 / r6, ig = i3 + i6
  const end = leds ? 270 : 360
  return (
    <svg className={`sch${flow ? ' flowing' : ''}`} viewBox="0 0 470 330" role="img"
      aria-label={`Esquema del divisor de corriente: R3 en paralelo con R6${leds ? ', con un LED en cada rama' : ''}`}>
      <Highlights hl={hl} step={step} />
      <path className="w" d="M50 110 H130 M130 50 V170 M360 50 V170 M360 110 H420 V290 H50 V215 M50 110 V175" />
      {leds && <path className="w" d="M270 50 H360 M270 170 H360" />}
      <Zr k="r3" d={zz(130, 50, end, 50, 60)} />
      <Zr k="r6" d={zz(130, 170, end, 170, 60)} />
      {flow && (
        <>
          <Flow d="M50 175 V110 H130" f={1} />
          <Flow d="M130 110 V50 H360 V110" f={i3 / ig} />
          <Flow d="M130 110 V170 H360 V110" f={i6 / ig} />
          <Flow d="M360 110 H420 V290 H50 V215" f={1} />
        </>
      )}
      {leds && <><LedSym x={315} y={50} amps={i3} /><LedSym x={315} y={170} amps={i6} /></>}
      <Src x={50} y={195} label="Eg" />
      <circle className="jn" cx="130" cy="110" r="4" /><circle className="jn" cx="360" cy="110" r="4" />
      <Lbl x={leds ? 200 : 245} y={20} n="3" k="r3" val="3,3 kΩ" anchor="middle" />
      <Lbl x={leds ? 200 : 245} y={198} n="6" k="r6" val={ohm(r6)} anchor="middle" />
    </svg>
  )
}
