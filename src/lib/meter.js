/* ================= Multímetro Promax PD-695 (4000 cuentas) =================
   Posiciones del selector en sentido horario desde arriba, como en el aparato del laboratorio. */

const pos = (g, l, extra = {}) => ({ g, l, ...extra })
export const DIAL = [
  pos('vdc', '1000', { f: 1000, k: 1, u: 'V', d: 0, res: 1, name: '1000 V' }),
  pos('vdc', '400', { f: 400, k: 1, u: 'V', d: 1, name: '400 V' }),
  pos('vdc', '40', { f: 40, k: 1, u: 'V', d: 2, name: '40 V' }),
  pos('vdc', '4', { f: 4, k: 1, u: 'V', d: 3, name: '4 V' }),
  pos('vdc', '400m', { f: 0.4, k: 1e-3, u: 'mV', d: 1, name: '400 mV' }),
  pos('adc', '400m', { f: 0.4, k: 1e-3, u: 'mA', d: 1, name: '400 mA' }),
  pos('adc', '40m', { f: 0.04, k: 1e-3, u: 'mA', d: 2, name: '40 mA' }),
  pos('adc', '20A', { f: 20, k: 1, u: 'A', d: 2, res: 0.01, name: '20 A' }),
  pos('aac', '400m', { u: 'mA', d: 1 }),
  pos('aac', '40m', { u: 'mA', d: 2 }),
  pos('aac', '20A', { u: 'A', d: 2 }),
  pos('cap', '40µ'), pos('cap', '4µ'), pos('cap', '400n'), pos('cap', '40n'), pos('cap', '4n'),
  pos('ohm', '400', { f: 400, k: 1, u: 'Ω', d: 1, name: '400 Ω' }),
  pos('ohm', '4k', { f: 4e3, k: 1e3, u: 'kΩ', d: 3, name: '4 kΩ' }),
  pos('ohm', '40k', { f: 4e4, k: 1e3, u: 'kΩ', d: 2, name: '40 kΩ' }),
  pos('ohm', '400k', { f: 4e5, k: 1e3, u: 'kΩ', d: 1, name: '400 kΩ' }),
  pos('ohm', '4M', { f: 4e6, k: 1e6, u: 'MΩ', d: 3, name: '4 MΩ' }),
  pos('ohm', '40M', { f: 4e7, k: 1e6, u: 'MΩ', d: 2, name: '40 MΩ' }),
  pos('diode', '→|'), pos('pnp', 'PNP'), pos('npn', 'NPN'), pos('logic', 'LOGIC'), pos('hz', 'kHz'),
  pos('vac', '400m', { u: 'mV', d: 1 }),
  pos('vac', '4', { u: 'V', d: 3 }),
  pos('vac', '40', { u: 'V', d: 2 }),
  pos('vac', '400', { u: 'V', d: 1 }),
  pos('vac', '750', { u: 'V', d: 0 }),
]
export const STEP_DEG = 360 / DIAL.length
export const dialAngle = (i) => STEP_DEG / 2 + i * STEP_DEG
export const OHM = DIAL.map((p, i) => ({ ...p, i })).filter((p) => p.g === 'ohm')

export const COUNTS = 4000
const fits = (ohms, g) => isFinite(ohms) && ohms / (g.f / COUNTS) < COUNTS - 0.5
// Fondo de escala inmediatamente superior al valor: el de mejor resolución que no se sale
export const bestOhm = (ohms) => OHM.find((g) => fits(ohms, g)) || null

// Tensión y corriente continuas: resolución de la posición y si el valor cabe en su fondo
const resOf = (p) => p.res ?? p.f / COUNTS
const fitsDc = (v, p) => isFinite(v) && Math.abs(v) / resOf(p) < p.f / resOf(p) - 0.5
const zone = (g) => DIAL.map((p, i) => ({ ...p, i })).filter((p) => p.g === g).sort((a, b) => a.f - b.f)
export const VDC = zone('vdc'), ADC = zone('adc')
// Fondo inmediatamente superior al valor, en la zona de tensión ('vdc') o de corriente ('adc')
export const bestDc = (v, g) => zone(g).find((p) => fitsDc(v, p)) || null

/* ---------- Incertidumbre ----------
   Precisión del PD-695: ±(0,5 % de la lectura + 1 dígito). Es la «precisión básica» del catálogo Promax de 2003
   (Multímetros digitales, serie industrial PD-693/695/697). El catálogo no da cifras por función, así que se
   usa la misma en tensión, corriente y resistencia. Un dígito es la resolución del fondo. */
export const ACCURACY = { pct: 0.5, digits: 1 }
// Incertidumbre de una lectura `value` (en unidades base: V, A u Ω) tomada en la posición `p` del selector
export const uncertainty = (value, p) => (Math.abs(value) * ACCURACY.pct) / 100 + ACCURACY.digits * resOf(p)

/* Expresión de la medida con su incertidumbre, en las unidades de la pantalla.
   La incertidumbre lleva una cifra significativa (dos si empieza por 1) y nunca más decimales que la pantalla
   (`maxDec`); la medida se escribe con los mismos decimales. Devuelve { dec, med, u }. */
export function express(med, u, maxDec) {
  const e = Math.floor(Math.log10(u)), lead = u / 10 ** e
  const dec = Math.max(0, Math.min(maxDec, -e + (lead < 2 ? 1 : 0)))
  const k = 10 ** dec
  return { dec, med: Math.round(med * k) / k, u: Math.max(1, Math.round(u * k)) / k }
}

/* Lo que muestra la pantalla con el circuito alimentado. m: { ohms, volts, amps }.
   El signo se conserva: una corriente que entra por la punta negra marca negativo. */
export function reading(dial, m, power) {
  const p = DIAL[dial]
  if (!power || (p.g !== 'vdc' && p.g !== 'adc')) return readout(dial, m.ohms ?? Infinity, power)
  const kind = p.g === 'vdc' ? 'volt' : 'amp', v = (kind === 'volt' ? m.volts : m.amps) ?? 0
  if (!fitsDc(v, p)) return { kind, over: true, text: 'OL', unit: p.u, p }
  const res = resOf(p), counts = Math.round(v / res)
  return { kind, text: ((counts * res) / p.k).toFixed(p.d), unit: p.u, res, ac: false, p, value: counts * res }
}

// Lo que muestra la pantalla para una posición del selector y una resistencia entre puntas
export function readout(dial, ohms, power) {
  const p = DIAL[dial]
  if (!power) return { kind: 'off', text: '', unit: '', p }
  if (p.g === 'ohm') {
    if (!fits(ohms, p)) return { kind: 'ohm', over: true, text: 'OL', unit: p.u, p }
    const res = p.f / COUNTS
    return { kind: 'ohm', text: ((Math.round(ohms / res) * res) / p.k).toFixed(p.d), unit: p.u, res, p }
  }
  // Circuito pasivo sin fuente: no hay tensión ni corriente que medir
  if (p.u) return { kind: p.g.startsWith('v') ? 'volt' : 'amp', text: (0).toFixed(p.d), unit: p.u, ac: p.g.endsWith('ac'), p }
  return { kind: 'na', text: '----', unit: '', p }
}
