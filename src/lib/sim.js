import { REAL, netFinder, netOfHole } from './board.js'

/* ================= Análisis del circuito con fuente =================
   Análisis nodal modificado: la incógnita son las tensiones de los nodos y la corriente de la fuente.
   `bench.src`: { pos, neg }, agujeros donde van las pinzas de la fuente.
   El amperímetro y el LED en directa son ideales: 1 mΩ en vez de 0 Ω, para que el sistema tenga solución
   aunque formen una malla sin resistencias. La diferencia con 0 Ω no llega a verse en la pantalla. */
const R_ON = 1e-3
const G_MIN = 1e-12 // Un nodo suelto dejaría el sistema sin solución: esta fuga mínima lo evita
/* Un LED que no conduce se calcula como 1 GΩ, no como circuito abierto: así su tensión inversa es la real.
   Abierto, una pata suelta quedaría a 0 V por la fuga G_MIN y el LED parecería soportar una inversa que no tiene.
   Su corriente, de nanoamperios, no llega a verse en ningún fondo. */
const R_OFF = 1e9
export const LEDS = ['led1', 'led2']
export const I_MAX = 1 // Límite de corriente de cada fuente, en amperios

const isLed = (k) => LEDS.includes(k)

// Eliminación gaussiana con pivoteo parcial
function solve(A) {
  const n = A.length
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]]
    if (!A[col][col]) return null
    for (let r = 0; r < n; r++) {
      if (r === col || !A[r][col]) continue
      const f = A[r][col] / A[col][col]
      for (let k = col; k <= n; k++) A[r][k] -= f * A[col][k]
    }
  }
  return A.map((row, i) => row[n] / row[i])
}

// Tensión de cada nodo y corriente que entrega la fuente, con unas ramas [a, b, ohmios] dadas
function nodal(nets, pos, neg, volts, edges) {
  const free = nets.filter((n) => n !== neg), idx = new Map(free.map((n, i) => [n, i]))
  const n = free.length, size = n + 1
  const A = Array.from({ length: size }, () => new Float64Array(size + 1))
  for (let i = 0; i < n; i++) A[i][i] += G_MIN
  for (const [a, b, r] of edges) {
    const g = 1 / r, ia = idx.get(a), ib = idx.get(b)
    if (ia !== undefined) A[ia][ia] += g
    if (ib !== undefined) A[ib][ib] += g
    if (ia !== undefined && ib !== undefined) { A[ia][ib] -= g; A[ib][ia] -= g }
  }
  const ip = idx.get(pos)
  A[ip][n] += 1 // La corriente de la fuente entra en el nodo positivo
  A[n][ip] += 1
  A[n][size] = volts
  const x = solve(A)
  if (!x) return null
  const v = new Map(free.map((f, i) => [f, x[i]]))
  v.set(neg, 0)
  return { v, ig: x[n] }
}

/* Estado eléctrico de la placa.
   volts: tensión de la fuente. ammeter: true si las puntas actúan de amperímetro (cierran la rama entre ellas).
   La fuente limita su corriente a I_MAX: si el circuito pide más, pasa a corriente constante y su tensión
   cae lo necesario (`scale`). El circuito es lineal y el LED ideal no tiene umbral, así que basta con
   repetir el cálculo con la tensión reducida en la misma proporción.
   Devuelve:
     powered   hay fuente conectada
     short     las dos pinzas de la fuente están en el mismo nodo
     limited   la fuente está limitando la corriente: casi siempre, un cortocircuito
     scale     fracción de la tensión ajustada que llega de verdad a la salida (1 si no limita)
     ig        corriente que entrega la fuente
     volts     tensión entre las puntas, roja menos negra (null si falta alguna)
     amps      corriente que entra por la punta roja y sale por la negra (null si no hay amperímetro)
     current   corriente de cada pieza, de su pata `a` a su pata `b`, por id
     led       { on, amps, reverse, broken } de cada LED, por id. reverse: tensión inversa que soporta
   Una resistencia quemada (`burnt`) es un circuito abierto: su corriente es 0. */
export function analyze(bench, volts, opts = {}) {
  const an = solveBench(bench, volts, opts)
  if (!an.powered || an.short || Math.abs(an.ig) <= I_MAX * (1 + 1e-9)) return an
  const scale = I_MAX / Math.abs(an.ig)
  return { ...solveBench(bench, volts * scale, opts), limited: true, scale }
}

function solveBench(bench, volts, { ammeter = false, values = REAL } = {}) {
  const { parts, red, black, src } = bench
  const idle = { powered: false, short: false, limited: false, scale: 1, ig: 0, volts: null, amps: null, current: {}, led: {} }
  const find = netFinder(parts)
  const net = (h) => netOfHole(find, h)
  const probes = !!(red && black)
  const rn = red ? net(red) : null, bn = black ? net(black) : null
  const leds = parts.filter((p) => isLed(p.k))
  // Un LED estropeado ya no conduce en ningún sentido
  const live = leds.filter((p) => !p.broken)
  const off = { ...idle, led: Object.fromEntries(leds.map((p) => [p.id, { on: false, amps: 0, reverse: 0, broken: !!p.broken }])) }
  if (!src?.pos || !src?.neg || !volts) return { ...off, volts: probes ? 0 : null, amps: ammeter && probes ? 0 : null }
  const pos = net(src.pos), neg = net(src.neg)
  // Pinzas en el mismo nodo: la fuente limita a I_MAX y su tensión cae a cero
  if (pos === neg) return { ...off, powered: true, short: true, limited: true, scale: 0, ig: I_MAX, volts: probes ? 0 : null, amps: ammeter && probes ? 0 : null }

  const res = parts.filter((p) => p.k !== 'wire' && !isLed(p.k) && !p.burnt)
  const nets = [...new Set([pos, neg, ...parts.filter((p) => p.k !== 'wire').flatMap((p) => [net(p.a), net(p.b)]), ...(probes ? [rn, bn] : [])])]
  const base = res.map((p) => [net(p.a), net(p.b), values[p.as ?? p.k]]).filter(([a, b]) => a !== b)
  if (ammeter && probes && rn !== bn) base.push([rn, bn, R_ON])

  // Cada LED conduce o no conduce: se prueba un estado y se corrige hasta que todos sean coherentes
  const on = new Map(live.map((p) => [p.id, true]))
  let sol = null
  for (let i = 0; i <= 2 ** live.length + 1; i++) {
    const edges = [...base, ...live.filter((p) => net(p.a) !== net(p.b)).map((p) => [net(p.a), net(p.b), on.get(p.id) ? R_ON : R_OFF])]
    sol = nodal(nets, pos, neg, volts, edges)
    if (!sol) return { ...off, powered: true, short: true, limited: true, scale: 0, ig: I_MAX }
    let stable = true
    for (const p of live) {
      const d = sol.v.get(net(p.a)) - sol.v.get(net(p.b))
      const next = on.get(p.id) ? d > 0 : d > 1e-9
      if (next !== on.get(p.id)) { on.set(p.id, next); stable = false }
    }
    if (stable) break
  }

  const V = (n) => sol.v.get(n) ?? 0
  const ig = -sol.ig
  const current = Object.fromEntries(res.map((p) => [p.id, (V(net(p.a)) - V(net(p.b))) / values[p.as ?? p.k]]))
  for (const p of parts) if (p.burnt) current[p.id] = 0
  const led = Object.fromEntries(leds.map((p) => {
    const d = V(net(p.a)) - V(net(p.b)), lit = !!on.get(p.id)
    const amps = lit ? d / R_ON : 0
    current[p.id] = amps
    return [p.id, { on: lit, amps, reverse: Math.max(0, -d), broken: !!p.broken }]
  }))
  return {
    ...idle, powered: true, ig, current, led,
    volts: probes ? V(rn) - V(bn) : null,
    amps: ammeter && probes ? (rn === bn ? 0 : (V(rn) - V(bn)) / R_ON) : null,
  }
}
