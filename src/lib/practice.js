import { R, fmt, par } from './circuit.js'
import { REAL, netFinder, netOfHole, resistance } from './board.js'
import { DIAL, OHM, bestDc, bestOhm, reading } from './meter.js'
import { I_MAX, analyze } from './sim.js'

/* ================= Datos y reglas de la Práctica 2 ================= */
export const E25 = 25, E36 = 36
const TOL = 0.05

/* ---------- Fuente de alimentación ---------- */
// Lo que entrega cada salida difiere un poco de lo que marca su voltímetro, como en un aparato real
const OFFSET = { s1: 0.02, s2: -0.03 }
const FIVE = 5.03
const VMAX = 30

export const setpoint = (s) => Math.max(0, Math.min(VMAX, s.c + s.f))
const output = (supply, k) => (supply.on && setpoint(supply[k]) > 0 ? setpoint(supply[k]) + OFFSET[k] : 0)
// Tensión en los bornes a los que se conecta el circuito: S₁ en modo independiente, S₁ + S₂ en modo serie
export const busVolts = (supply) => (supply.mode === 'series' ? output(supply, 's1') + output(supply, 's2') : output(supply, 's1'))
// Pantalla del voltímetro de la fuente: una cifra decimal
export const display = (supply, k) => (supply.on ? setpoint(supply[k]).toFixed(1) : '')

export const TERMINALS = {
  '7-8': { label: '7-8 · S₁', volts: (s) => output(s, 's1') },
  '13-14': { label: '13-14 · S₂', volts: (s) => output(s, 's2') },
  '10-11': { label: '10-11 · 5 V', volts: (s) => (s.on ? FIVE : 0) },
}

// Pares de bornes de la Figura 2.1: positivo y negativo de cada salida
export const PAIRS = { '7-8': ['7', '8'], '13-14': ['13', '14'], '10-11': ['10', '11'] }

const near = (a, b, t) => Math.abs(a - b) <= t
export function supplyChecks(supply, need) {
  const a = setpoint(supply.s1), b = setpoint(supply.s2)
  const items = [{ ok: supply.on, text: supply.on ? 'Fuente encendida' : 'Enciende la fuente con el interruptor' }]
  if (need === 'series36') {
    items.push({ ok: supply.mode === 'series', text: supply.mode === 'series' ? 'Modo serie' : 'Pulsa SERIES' })
    items.push({ ok: near(a + b, E36, 0.1), text: `S₁ + S₂ = ${fmt(a + b, 1)} V: ajústalas para sumar ${E36} V` })
    items.push({ ok: a > 0 && b > 0 && Math.max(a, b) <= 2 * Math.min(a, b), text: 'Tensiones del mismo orden en las dos salidas' })
  } else {
    items.push({ ok: supply.mode === 'indep', text: supply.mode === 'indep' ? 'Modo independiente' : 'Pulsa INDEP' })
    if (need === 'indep69') {
      items.push({ ok: near(a, 6, 0.05), text: `S₁ = ${fmt(a, 1)} V: ajústala a 6 V` })
      items.push({ ok: near(b, 9, 0.05), text: `S₂ = ${fmt(b, 1)} V: ajústala a 9 V` })
    } else items.push({ ok: near(a, E25, 0.05), text: `S₁ = ${fmt(a, 1)} V: ajústala a ${E25} V` })
  }
  return items
}

/* ---------- Valores teóricos ---------- */
const fig25 = (v, E = E25) => {
  const r23 = par(v.r2, v.r3), r45 = par(v.r4, v.r5), ig = E / (v.r1 + r23 + r45)
  const vbc = ig * r23, vc = ig * r45
  return { IR1: ig, IR2: vbc / v.r2, IR3: vbc / v.r3, IR4: vc / v.r4, IR5: vc / v.r5 }
}
const fig26 = (v, E = E36) => ({ Ig: E / v.r3 + E / v.r6, IR3: E / v.r3, IR6: E / v.r6 })

/* El intervalo coherente de una corriente no es «teórico ± tolerancia»: el reparto entre ramas depende
   de cocientes de resistencias. Se prueban todas las combinaciones con cada una en su mínimo o su máximo. */
function corners(keys, fn) {
  const out = {}
  for (let m = 0; m < 2 ** keys.length; m++) {
    const v = { ...R }
    keys.forEach((k, i) => { v[k] = R[k] * (m >> i & 1 ? 1 + TOL : 1 - TOL) })
    for (const [k, x] of Object.entries(fn(v))) {
      const [lo, hi] = out[k] ?? [Infinity, -Infinity]
      out[k] = [Math.min(lo, x), Math.max(hi, x)]
    }
  }
  return out
}
export const TEO25 = fig25(R), TEO26 = fig26(R)
const INT25 = corners(['r1', 'r2', 'r3', 'r4', 'r5'], fig25)
const INT26 = corners(['r3', 'r6'], fig26)
export const interval = { ...INT25, Ig: INT26.Ig, IR6: INT26.IR6, IR3d: INT26.IR3 }

/* ---------- Tablas ---------- */
const UV = ['V', 'mV'], UR = ['Ω', 'kΩ', 'MΩ'], UA = ['mA', 'µA', 'A']
export const UNITS = { V: 1, mV: 1e-3, 'Ω': 1, 'kΩ': 1e3, 'MΩ': 1e6, A: 1, mA: 1e-3, 'µA': 1e-6 }

const volt = (k, label, exp, ref = true) => ({ k, label, ref, exp, lo: exp - 0.1, hi: exp + 0.1, g: 'vdc', units: UV })
const res = (k, sub) => ({ k, label: 'R', sub, ref: true, exp: R[k], lo: R[k] * (1 - TOL), hi: R[k] * (1 + TOL), g: 'ohm', units: UR, refU: R[k] >= 1e6 ? 'MΩ' : 'kΩ' })
const cur = (k, sub, exp, [lo, hi]) => ({ k, label: 'I', sub, ref: true, exp, lo, hi, g: 'adc', units: UA })

export const TABLES = {
  t23: {
    bench: 'm1', corner: 'Terminales', refHead: 'Tensión marcada por el voltímetro de la fuente', medHead: 'Tensión medida con el multímetro',
    caption: 'Tabla 2.3: Tensiones de salida de la fuente de alimentación medidas con el multímetro Keysight.',
    rows: [volt('7-8', '7-8 S₁', 6), volt('13-14', '13-14 S₂', 9), volt('10-11', '10-11', 5, false)],
  },
  t24: {
    bench: 'm2', corner: 'Resistencia', refHead: 'Valor nominal', medHead: 'Valor medido',
    caption: 'Tabla 2.4: Identificación de las resistencias del circuito con el multímetro Keysight.',
    rows: [res('r1', '1'), res('r2', '2'), res('r3', '3'), res('r4', '4'), res('r5', '5')],
  },
  t25: {
    bench: 'm2', corner: 'Corriente', refHead: 'Valor teórico', refSub: '(actividades previas)', medHead: 'Valor medido',
    caption: 'Tabla 2.5: Valores medidos de intensidad de corriente con el multímetro Promax.',
    rows: ['IR1', 'IR2', 'IR3', 'IR4', 'IR5'].map((k) => cur(k, k.slice(1), TEO25[k], INT25[k])),
  },
  t26: {
    bench: 'm3', corner: '', refHead: 'Valor teórico', refSub: '(actividades previas)', medHead: 'Valor medido',
    caption: 'Tabla 2.6: Medidas en el divisor de corriente con el multímetro Promax.',
    rows: [
      { k: 'VS1', label: 'Tensión V', sub: 'S1', ref: false, exp: null, g: 'vdc', units: UV },
      { k: 'VS2', label: 'Tensión V', sub: 'S2', ref: false, exp: null, g: 'vdc', units: UV },
      { ...cur('IR6', 'R6=100kΩ', TEO26.IR6, INT26.IR6), label: 'Corriente I' },
      { ...cur('IR3', 'R3', TEO26.IR3, INT26.IR3), label: 'Corriente I' },
      { ...cur('Ig', 'g', TEO26.Ig, INT26.Ig), label: 'Corriente I' },
    ],
  },
}

export const emptyCell = (row) => {
  const u = row.g === 'vdc' ? 'V' : row.g === 'adc' ? 'mA' : row.refU ?? 'kΩ'
  return { ref: '', refU: u, fondo: '', med: '', medU: u }
}
export const toNum = (s) => { const t = (s ?? '').trim().replace(',', '.'); return t !== '' && isFinite(+t) ? +t : null }

const zone = { ohm: OHM, vdc: DIAL.map((p, i) => ({ ...p, i })).filter((p) => p.g === 'vdc'), adc: DIAL.map((p, i) => ({ ...p, i })).filter((p) => p.g === 'adc') }
export const fondos = (g) => [...zone[g]].sort((a, b) => a.f - b.f)
const bestOf = (g, v) => (g === 'ohm' ? bestOhm(v) : bestDc(v, g))
const resolution = (p) => p.res ?? p.f / 4000
export const bestFondo = (row, value) => bestOf(row.g, value)

// Comprobación de una fila: distintivos [clase, texto]
export function evalRow(row, c) {
  const out = []
  const ref = toNum(c.ref), med = toNum(c.med), v = med === null ? null : med * UNITS[c.medU]
  const target = row.exp ?? v
  if (row.ref && ref !== null) {
    const ok = Math.abs(ref * UNITS[c.refU] - row.exp) / row.exp < 0.005
    out.push(ok ? ['good', 'Valor de referencia correcto'] : ['bad', 'Revisa este valor'])
  }
  const g = zone[row.g].find((x) => x.name === c.fondo), best = target === null ? null : bestOf(row.g, target)
  if (g && best) {
    if (g.i === best.i) out.push(['good', 'Fondo óptimo'])
    else if (g.f <= Math.abs(target)) out.push(['bad', 'En ese fondo marcaría OL'])
    else out.push(['warn', 'Válido, pero hay un fondo con más resolución'])
  }
  if (v !== null) {
    if (row.exp !== null) {
      const res_ = g ? resolution(g) : 0
      const ok = v >= row.lo - res_ && v <= row.hi + res_
      out.push([ok ? 'good' : 'bad', ok ? 'Dentro del intervalo coherente' : 'Fuera del intervalo coherente'])
      if (g && Math.abs(v) / res_ < 10) out.push(['info', 'Pocas cuentas: este fondo no da más resolución'])
    }
    const dec = (c.med.trim().replace(',', '.').split('.')[1] || '').length
    if (g && g.u === c.medU && dec < g.d) out.push(['warn', `Anota todos los dígitos: en ${g.name} salen ${g.d} decimales`])
    if (g) {
      const r = resolution(g) / UNITS[c.medU], d = g.u === c.medU ? g.d : Math.max(0, Math.ceil(-Math.log10(r) - 1e-9))
      out.push(['info', `Con incertidumbre: ${fmt(med, d)} ± ${fmt(r, d)} ${c.medU}`])
    }
  }
  return out
}

/* ---------- Lo que ve el multímetro en una placa ---------- */
const valuesOf = REAL

// Si el cable rojo está en el borne que pide la posición del selector
export function jackOk(bench) {
  const p = DIAL[bench.dial]
  if (p.g === 'adc') return bench.jack === (p.name === '20 A' ? '20A' : 'mA')
  return bench.jack === 'V'
}

export function measureBench(bench, supply) {
  const ammeter = bench.jack !== 'V'
  const an = analyze(bench, busVolts(supply), { ammeter, values: valuesOf })
  const right = jackOk(bench)
  const probes = !!(bench.red && bench.black)
  const clip = (i) => Math.max(-I_MAX, Math.min(I_MAX, i ?? 0))
  const m = { ohms: right ? resistance(bench) : Infinity, volts: right ? an.volts ?? 0 : 0, amps: right && !an.short ? clip(an.amps) : 0 }
  return { an, m, r: reading(bench.dial, m, bench.power), probes, right }
}

// Rama que mide el amperímetro: un extremo de las puntas debe llegar a un nodo con un solo elemento conectado.
// Si no es así, las puntas están en paralelo con algo y no en serie.
export function branchOf(bench) {
  const { parts, red, black, src } = bench
  if (!red || !black) return null
  const find = netFinder(parts), net = (h) => netOfHole(find, h)
  const conn = new Map()
  const add = (n, e) => conn.set(n, [...(conn.get(n) || []), e])
  for (const p of parts) {
    if (p.k === 'wire') continue
    add(net(p.a), p.k); add(net(p.b), p.k)
  }
  if (src?.pos) add(net(src.pos), 'src')
  if (src?.neg) add(net(src.neg), 'src')
  for (const h of [red, black]) {
    const list = conn.get(net(h)) || []
    if (list.length === 1) return list[0]
  }
  return null
}

// Clave de la tabla que corresponde a cada elemento medido
export const CURRENT_KEY = { r1: 'IR1', r2: 'IR2', r3: 'IR3', r4: 'IR4', r5: 'IR5', r6: 'IR6', src: 'Ig', led1: 'IR3', led2: 'IR6' }
