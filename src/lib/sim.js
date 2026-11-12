import { REAL, netFinder, netOfHole } from './board.js'

/* ================= Análisis del circuito con fuente =================
   Análisis nodal modificado: la incógnita son las tensiones de los nodos y la corriente de la fuente.
   `bench.src`: { pos, neg }, agujeros donde van las pinzas de la fuente.
   El amperímetro y el LED en directa son ideales: 1 mΩ en vez de 0 Ω, para que el sistema tenga solución
   aunque formen una malla sin resistencias. La diferencia con 0 Ω no llega a verse en la pantalla. */
const R_ON = 1e-3
const G_MIN = 1e-12 // Un nodo suelto dejaría el sistema sin solución: esta fuga mínima lo evita
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
   Devuelve:
     powered   hay fuente conectada
     short     las dos pinzas de la fuente están en el mismo nodo
     overload  la corriente supera el límite de la fuente: casi siempre, un cortocircuito
     ig        corriente que entrega la fuente
     volts     tensión entre las puntas, roja menos negra (null si falta alguna)
     amps      corriente que entra por la punta roja y sale por la negra (null si no hay amperímetro)
     current   corriente de cada pieza, de su pata `a` a su pata `b`, por id
     led       { on, amps } de cada LED, por id */
export function analyze(bench, volts, { ammeter = false, values = REAL } = {}) {
  const { parts, red, black, src } = bench
  const idle = { powered: false, short: false, overload: false, ig: 0, volts: null, amps: null, current: {}, led: {} }
  const find = netFinder(parts)
  const net = (h) => netOfHole(find, h)
  const probes = !!(red && black)
  const rn = red ? net(red) : null, bn = black ? net(black) : null
  const leds = parts.filter((p) => isLed(p.k))
  const off = { ...idle, led: Object.fromEntries(leds.map((p) => [p.id, { on: false, amps: 0 }])) }
  if (!src?.pos || !src?.neg || !volts) return { ...off, volts: probes ? 0 : null, amps: ammeter && probes ? 0 : null }
  const pos = net(src.pos), neg = net(src.neg)
  if (pos === neg) return { ...off, powered: true, short: true }

  const res = parts.filter((p) => p.k !== 'wire' && !isLed(p.k))
  const nets = [...new Set([pos, neg, ...parts.filter((p) => p.k !== 'wire').flatMap((p) => [net(p.a), net(p.b)]), ...(probes ? [rn, bn] : [])])]
  const base = res.map((p) => [net(p.a), net(p.b), values[p.as ?? p.k]]).filter(([a, b]) => a !== b)
  if (ammeter && probes && rn !== bn) base.push([rn, bn, R_ON])

  // Cada LED conduce o no conduce: se prueba un estado y se corrige hasta que todos sean coherentes
  const on = new Map(leds.map((p) => [p.id, true]))
  let sol = null
  for (let i = 0; i <= 2 ** leds.length + 1; i++) {
    const edges = [...base, ...leds.filter((p) => on.get(p.id) && net(p.a) !== net(p.b)).map((p) => [net(p.a), net(p.b), R_ON])]
    sol = nodal(nets, pos, neg, volts, edges)
    if (!sol) return { ...off, powered: true, short: true }
    let stable = true
    for (const p of leds) {
      const d = sol.v.get(net(p.a)) - sol.v.get(net(p.b))
      const next = on.get(p.id) ? d > 0 : d > 1e-9
      if (next !== on.get(p.id)) { on.set(p.id, next); stable = false }
    }
    if (stable) break
  }

  const V = (n) => sol.v.get(n) ?? 0
  const ig = -sol.ig
  const current = Object.fromEntries(res.map((p) => [p.id, (V(net(p.a)) - V(net(p.b))) / values[p.as ?? p.k]]))
  const led = Object.fromEntries(leds.map((p) => {
    const amps = on.get(p.id) ? (V(net(p.a)) - V(net(p.b))) / R_ON : 0
    current[p.id] = amps
    return [p.id, { on: on.get(p.id), amps }]
  }))
  return {
    powered: true, short: false, overload: Math.abs(ig) > I_MAX, ig, current, led,
    volts: probes ? V(rn) - V(bn) : null,
    amps: ammeter && probes ? (rn === bn ? 0 : (V(rn) - V(bn)) / R_ON) : null,
  }
}
