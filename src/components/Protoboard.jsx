import { memo, useState } from 'react'
import { BANDS, glow, only } from '../lib/circuit'
import {
  COLS, H, HOLE, HOLES, LO, NODES, RAIL_COLS, RAIL_Y, RES_NAME, ROW_Y, UP, W, bx, netFinder, stripRect,
} from '../lib/board'

const WIRE_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#9333ea', '#dc2626']

// Fondo de la placa: carriles con sus líneas roja (+) y azul (−), numeración y canal central
const BoardBase = memo(function BoardBase() {
  const railLine = (y, cls) => (
    <>
      <line className={cls} x1={bx(RAIL_COLS[0]) - 6} x2={bx(30) + 6} y1={y} y2={y} />
      <line className={cls} x1={bx(33) - 6} x2={bx(RAIL_COLS.at(-1)) + 6} y1={y} y2={y} />
    </>
  )
  const nums = []
  for (let c = 0; c < COLS; c++)
    if (c === 0 || (c + 1) % 5 === 0)
      nums.push(
        <g key={c}>
          <text className="pb-num" x={bx(c)} y="51" textAnchor="middle">{c + 1}</text>
          <text className="pb-num" x={bx(c)} y="217" textAnchor="middle">{c + 1}</text>
        </g>,
      )
  return (
    <>
      <rect className="pb-board" x="1" y="1" width={W - 2} height={H - 2} rx="10" />
      <rect className="pb-chan" x="14" y="126" width={W - 28} height="12" rx="3" />
      {railLine(10, 'pb-pos')}{railLine(42, 'pb-neg')}{railLine(222, 'pb-pos')}{railLine(254, 'pb-neg')}
      {[['+', RAIL_Y['t+']], ['−', RAIL_Y['t-']], ['+', RAIL_Y['b+']], ['−', RAIL_Y['b-']]].map(([s, y], i) => (
        <g key={i} className={s === '+' ? 'pb-sign pos' : 'pb-sign neg'}>
          <text x="14" y={y + 3.5} textAnchor="middle">{s}</text>
          <text x={W - 14} y={y + 3.5} textAnchor="middle">{s}</text>
        </g>
      ))}
      {nums}
      {UP.concat(LO).map((r) => (
        <g key={r}>
          <text className="pb-num" x="18" y={ROW_Y[r] + 2.5} textAnchor="middle">{r}</text>
          <text className="pb-num" x={W - 18} y={ROW_Y[r] + 2.5} textAnchor="middle">{r}</text>
        </g>
      ))}
    </>
  )
})

const HoleLayer = memo(function HoleLayer() {
  return HOLES.map((h) => <rect key={h.id} className="pb-hole" x={h.x - 2.6} y={h.y - 2.6} width="5.2" height="5.2" rx="1" />)
})

// Zonas de clic: una por agujero, del tamaño del paso de la placa
const HitLayer = memo(function HitLayer() {
  return HOLES.map((h) => <rect key={h.id} className="pb-hit" data-id={h.id} x={h.x - 6} y={h.y - 6} width="12" height="12" rx="3" />)
})

const Strip = ({ node, cls }) => {
  const r = stripRect(node)
  return <rect className={cls} x={r.x} y={r.y} width={r.w} height={r.h} rx="6" />
}

// Resistencia. Quemada: cuerpo ennegrecido y con un aspa
function Resistor({ p, onClick }) {
  const a = HOLE.get(p.a), b = HOLE.get(p.b)
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy)
  const L = Math.max(14, Math.min(34, len - 10)), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI
  // Etiqueta desplazada en perpendicular al cuerpo
  const nx = -dy / len, ny = dx / len, side = nx > 0 || (nx === 0 && ny < 0) ? 1 : -1
  const lx = mx + nx * 15 * side, ly = my + ny * 15 * side + 4
  return (
    <g className={`pb-part${onClick ? ' erasable' : ''}${p.burnt ? ' burnt' : ''}`} onClick={onClick}>
      <line className="pb-leg-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <line className="pb-leg" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <circle className="pb-pin" cx={a.x} cy={a.y} r="2.2" /><circle className="pb-pin" cx={b.x} cy={b.y} r="2.2" />
      <g transform={`translate(${mx} ${my}) rotate(${ang})`}>
        <rect className="pb-body" x={-L / 2} y="-5" width={L} height="10" rx="5" />
        {BANDS[p.as ?? p.k].map((c, i) => (
          <rect key={i} className="pb-band" x={L * [-0.3, -0.13, 0.04, 0.27][i]} y="-5" width={L * 0.08} height="10" style={{ fill: `var(--band-${c})` }} />
        ))}
        {p.burnt && <path className="pb-led-x" d="M-4 -4 L4 4 M4 -4 L-4 4" />}
      </g>
      <text className="pb-lbl" style={{ fill: `var(--${p.k})` }} x={lx} y={ly} textAnchor="middle">{RES_NAME[p.k]}</text>
    </g>
  )
}

function Wire({ p, color, onClick }) {
  const a = HOLE.get(p.a), b = HOLE.get(p.b)
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1
  const k = Math.min(30, len * 0.18), cx = (a.x + b.x) / 2 - (dy / len) * k, cy = (a.y + b.y) / 2 + (dx / len) * k
  return (
    <g className={`pb-part${onClick ? ' erasable' : ''}`} onClick={onClick}>
      <path className="pb-leg-hit" d={`M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`} />
      <path className="pb-wire" style={{ stroke: color }} d={`M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`} />
      <circle className="pb-pin" cx={a.x} cy={a.y} r="2.2" /><circle className="pb-pin" cx={b.x} cy={b.y} r="2.2" />
    </g>
  )
}

// LED: la pata `a` es el ánodo (+). El halo crece con la corriente. Estropeado: gris y con un aspa
function Led({ p, state, onClick }) {
  const a = HOLE.get(p.a), b = HOLE.get(p.b)
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
  const lit = state?.on ? glow(state.amps) : 0
  return (
    <g className={`pb-part${onClick ? ' erasable' : ''}`} onClick={onClick}>
      <line className="pb-leg-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <line className="pb-leg" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <circle className="pb-pin" cx={a.x} cy={a.y} r="2.2" /><circle className="pb-pin" cx={b.x} cy={b.y} r="2.2" />
      <circle className="pb-led-glow" cx={mx} cy={my} r="17" style={{ opacity: lit * 0.75 }} />
      <circle className={`pb-led${state?.broken ? ' broken' : ''}`} cx={mx} cy={my} r="6.5" style={{ '--lit': `${Math.round(lit * 100)}%` }} />
      {state?.broken && <path className="pb-led-x" d={`M${mx - 4} ${my - 4} L${mx + 4} ${my + 4} M${mx + 4} ${my - 4} L${mx - 4} ${my + 4}`} />}
      <text className="pb-lbl" style={{ fill: 'var(--led)' }} x={a.x + (b.x - a.x) * 0.2} y={a.y + (b.y - a.y) * 0.2 - 7} textAnchor="middle">+</text>
    </g>
  )
}

// Pinza de la fuente de alimentación
function Clip({ id, kind }) {
  const h = HOLE.get(id)
  const ex = h.x - 14, ey = h.y < 50 ? h.y + 22 : h.y + 20
  return (
    <g className={`pb-clip ${kind}`}>
      <line x1={h.x} y1={h.y} x2={ex} y2={ey} />
      <circle className="tip" cx={h.x} cy={h.y} r="3" />
      <rect className="cap" x={ex - 8} y={ey - 6} width="16" height="12" rx="3" />
      <text x={ex} y={ey + 3.4} textAnchor="middle">{kind === 'pos' ? 'F+' : 'F−'}</text>
    </g>
  )
}

function Probe({ id, kind }) {
  const h = HOLE.get(id)
  // Cerca del borde superior la punta entra desde abajo para no salirse de la placa
  const ex = h.x + 16, ey = h.y < 50 ? h.y + 24 : h.y - 24
  return (
    <g className={`pb-probe ${kind}`}>
      <line x1={h.x} y1={h.y} x2={ex} y2={ey} />
      <circle className="tip" cx={h.x} cy={h.y} r="3.2" />
      <circle className="cap" cx={ex} cy={ey} r="8" />
      <text x={ex} y={ey + 3.2} textAnchor="middle">{kind === 'red' ? '+' : '−'}</text>
    </g>
  )
}

/* ---------- Teclado: flechas para recorrer los agujeros ---------- */
const ROW_ORDER = ['t+', 't-', ...UP, ...LO, 'b+', 'b-']
const isRail = (r) => RAIL_Y[r] !== undefined
// 'b+3' empieza por 'b', pero solo encaja con 'b+': tras el prefijo tienen que quedar cifras
const rowOf = (id) => ROW_ORDER.find((r) => id.startsWith(r) && /^\d+$/.test(id.slice(r.length)))
const nearestRail = (c) => RAIL_COLS.reduce((a, b) => (Math.abs(b - c) < Math.abs(a - c) ? b : a))

function moveHole(id, key) {
  const r = rowOf(id), c = +id.slice(r.length) - 1
  let ri = ROW_ORDER.indexOf(r), nc = c
  if (key === 'ArrowUp') ri = Math.max(0, ri - 1)
  else if (key === 'ArrowDown') ri = Math.min(ROW_ORDER.length - 1, ri + 1)
  else {
    const d = key === 'ArrowLeft' ? -1 : 1
    if (isRail(r)) nc = RAIL_COLS[Math.max(0, Math.min(RAIL_COLS.length - 1, RAIL_COLS.indexOf(c) + d))]
    else nc = Math.max(0, Math.min(COLS - 1, c + d))
  }
  const nr = ROW_ORDER[ri]
  if (isRail(nr) && !RAIL_COLS.includes(nc)) nc = nearestRail(nc)
  return `${nr}${nc + 1}`
}

const ZOOMS = ['Ajustar', 'Grande', 'Muy grande']

/* Protoboard. Con `interactive`, avisa de los clics en agujeros (onHole) y en piezas (onPart, para quitar).
   También se maneja con teclado (flechas + Intro) y, en pantallas pequeñas, se puede ampliar y desplazar. */
export function Protoboard({
  parts = [], red, black, src, leds = {}, hl = [], step = 0, interactive, tool, pending, onHole, onPart, label, children,
}) {
  const [hover, setHover] = useState(null)
  const [kb, setKb] = useState(null)
  const [focused, setFocused] = useState(false)
  const [zoom, setZoom] = useState(() => (interactive && window.matchMedia?.('(max-width: 700px)').matches ? 1 : 0))
  const find = netFinder(parts)
  const hoverNet = hover ? find(HOLE.get(hover).node) : null
  const erase = interactive && tool === 'erase'
  const wireIdx = new Map(parts.filter((p) => p.k === 'wire').map((p, i) => [p.id, i]))

  const onMove = (e) => { const id = e.target.dataset?.id || null; if (id !== hover) setHover(id) }
  const onClick = (e) => { const id = e.target.dataset?.id; if (id) onHole?.(id) }
  const hits = interactive && (
    <g onPointerMove={onMove} onPointerLeave={() => setHover(null)} onClick={onClick}><HitLayer /></g>
  )
  const h = hover && HOLE.get(hover)
  const conn = hover ? parts.filter((p) => find(HOLE.get(p.a).node) === hoverNet || find(HOLE.get(p.b).node) === hoverNet) : []

  // El agujero elegido con teclado se comporta como el del ratón: resalta su nodo y lo describe abajo
  const goKb = (id, box) => {
    setKb(id); setHover(id)
    const px = (HOLE.get(id).x / W) * box.scrollWidth
    if (px < box.scrollLeft + 24 || px > box.scrollLeft + box.clientWidth - 24) box.scrollLeft = px - box.clientWidth / 2
  }
  const onKey = (e) => {
    if (e.key.startsWith('Arrow')) { e.preventDefault(); goKb(kb ? moveHole(kb, e.key) : 'a10', e.currentTarget) }
    else if ((e.key === 'Enter' || e.key === ' ') && kb) { e.preventDefault(); onHole?.(kb) }
  }
  const kbHole = interactive && focused && kb && HOLE.get(kb)

  return (
    <div className="pb">
      {interactive && (
        <div className="segctl pb-zoom" role="radiogroup" aria-label="Tamaño de la placa">
          {ZOOMS.map((t, i) => <button key={t} type="button" role="radio" aria-checked={zoom === i} onClick={() => setZoom(i)}>{t}</button>)}
        </div>
      )}
      <div className={`pb-scroll z-${zoom}`} {...(interactive && {
        tabIndex: 0, onKeyDown: onKey,
        'aria-label': `${label || 'Protoboard'}. Flechas para recorrer los agujeros, Intro para elegir uno.`,
        // Solo con foco de teclado: al pulsar con el ratón o el dedo no aparece el cursor
        onFocus: (e) => {
          if (!e.currentTarget.matches(':focus-visible')) return
          setFocused(true)
          if (!kb) goKb('a10', e.currentTarget)
        },
        onKeyUp: () => setFocused(true),
        onBlur: () => { setFocused(false); setHover(null) },
      })}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label || 'Protoboard'}>
          <BoardBase />
          {hl.map((x, i) => <Strip key={i} node={x.node} cls={only(step, x.on, `pb-hl${x.alt ? ' alt' : ''}`)} />)}
          {hoverNet && NODES.filter((n) => find(n) === hoverNet).map((n) => <Strip key={n} node={n} cls="pb-hover" />)}
          <HoleLayer />
          {erase && hits}
          {parts.map((p) => p.k === 'wire'
            ? <Wire key={p.id} p={p} color={WIRE_COLORS[wireIdx.get(p.id) % WIRE_COLORS.length]} onClick={erase ? () => onPart(p) : undefined} />
            : p.k.startsWith('led') ? <Led key={p.id} p={p} state={leds[p.id]} onClick={erase ? () => onPart(p) : undefined} />
            : <Resistor key={p.id} p={p} onClick={erase ? () => onPart(p) : undefined} />)}
          {pending && <circle className="pb-pend" cx={HOLE.get(pending).x} cy={HOLE.get(pending).y} r="6" />}
          {pending && h && <line className="pb-ghost" x1={HOLE.get(pending).x} y1={HOLE.get(pending).y} x2={h.x} y2={h.y} />}
          {kbHole && <circle className="pb-kb" cx={kbHole.x} cy={kbHole.y} r="6.5" />}
          {red && <Probe id={red} kind="red" />}
          {black && <Probe id={black} kind="black" />}
          {src?.pos && <Clip id={src.pos} kind="pos" />}
          {src?.neg && <Clip id={src.neg} kind="neg" />}
          {children}
          {!erase && hits}
        </svg>
      </div>
      {interactive && (
        <div className="pb-info" aria-live="polite">
          {h ? (
            <><b className="mono">{h.id}</b> · {h.label}
              {conn.length > 0 && <> · conectado con {conn.map((p) => (p.k === 'wire' ? 'cable' : RES_NAME[p.k])).join(', ')}</>}</>
          ) : 'Pasa el ratón o el dedo por la placa: se iluminan los agujeros unidos por dentro.'}
        </div>
      )}
    </div>
  )
}
