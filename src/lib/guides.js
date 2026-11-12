import { REAL, RES_NAME, checkBench } from './board.js'
import { fmt } from './circuit.js'
import { DIAL, bestOhm, readout } from './meter.js'
import { TABLES, branchOf, evalRow, jackOk, measureBench, setpoint, toNum } from './practice.js'

/* ================= Guías paso a paso =================
   Cada guía es una función del estado del laboratorio que devuelve los pasos de una diapositiva:
   { t: qué hacer, ok: si ya está hecho (undefined: paso sin comprobación), hint: pista si es el paso actual,
     final: si al cumplirse el último paso la actividad queda hecha aunque cambien los anteriores }.
   El paso actual es el primero sin hacer. */

const near = (a, b, t) => Math.abs(a - b) <= t
const V = (x) => `${fmt(x, 2)} V`
const NAME = { s1: 'S₁', s2: 'S₂' }
const KNOB = { s1: [4, 5], s2: [17, 16] }

/* ---------- Fuente ---------- */
const lineOn = (s) => ({ t: 'Enciende la fuente con el interruptor LINE (19): pulsa la palanca.', ok: s.on })
const indep = (s) => ({ t: 'En FUNCTION (2), pulsa INDEP: cada salida se ajusta por separado.', ok: s.mode === 'indep', hint: s.mode === 'series' ? 'Ahora está en SERIES. Pulsa INDEP.' : null })
const showV = (s, ch) => (s.vSel !== ch ? `El voltímetro de la fuente está mostrando ${NAME[ch === 's1' ? 's2' : 's1']}. Pulsa la tecla V ${NAME[ch]} (3) para ver ${NAME[ch]}.` : null)

function channel(s, ch, target) {
  const v = setpoint(s[ch]), [g, f] = KNOB[ch], n = NAME[ch]
  const over = v > target + 0.5
  return [
    {
      t: `Gira el mando grueso de ${n} (COARSE, ${g}) hasta acercarte a ${fmt(target, 0)} V. Arrástralo en círculo, o pulsa a su derecha para subir y a su izquierda para bajar.`,
      ok: near(v, target, 0.5),
      hint: showV(s, ch) ?? (over ? `Te has pasado: ${n} = ${V(v)}. Gira el grueso hacia la izquierda.` : `${n} = ${V(v)}. Sigue girando el grueso hacia la derecha.`),
    },
    {
      t: `Afina con el mando fino de ${n} (FINE, ${f}) hasta que el display marque ${fmt(target, 1)}.`,
      ok: near(v, target, 0.05),
      hint: showV(s, ch) ?? `${n} = ${V(v)}: ${v < target ? 'sube' : 'baja'} con el fino. Si pulsas a un lado del mando, se mueve poco a poco.`,
    },
  ]
}

export const supplyGuide = (need) => ({ supply: s }) => {
  if (need === 'indep69') return [lineOn(s), indep(s), ...channel(s, 's1', 6), ...channel(s, 's2', 9)]
  if (need === 'indep25') return [lineOn(s), indep(s), ...channel(s, 's1', 25), { t: 'No conectes todavía la fuente a la placa: la tensión se fija en vacío.' }]
  return []
}

/* ---------- Multímetro ---------- */
const power = (b) => ({ t: 'Enciende el multímetro con el botón POWER.', ok: b.power })
const zone = (b, g) => {
  const txt = { vdc: 'V⎓ (tensión continua, arriba a la derecha)', adc: 'A⎓ (corriente continua, a la derecha)', ohm: 'Ω (resistencia, abajo a la izquierda)' }[g]
  return { t: `Gira el selector a la zona ${txt}. Pulsa una posición de la escala o usa los botones ↺ ↻.`, ok: DIAL[b.dial].g === g }
}
const redJack = (b, j) => ({
  t: j === 'V' ? 'Cable rojo en el borne VΩHz (el de la derecha). El negro siempre en COM.' : j === '20A' ? 'Cable rojo en el borne 20A (el de la izquierda): es el más seguro para empezar.' : 'Cable rojo en el borne mA.',
  ok: b.jack === j,
  hint: 'Pulsa el borne en el dibujo del multímetro o usa los botones de debajo.',
})
const fondoV = (b, best, why) => {
  const p = DIAL[b.dial]
  const hint = p.g !== 'vdc' ? null : p.f < best.f ? `El fondo de ${p.name} es menor que la tensión: marca OL. Sube de fondo.` : p.f > best.f ? `En ${p.name} mide, pero pierdes cifras. Baja a ${best.name}.` : null
  return { t: `Elige el fondo de ${best.name}: ${why}`, ok: p.name === best.name, hint }
}
const FONDO40 = { name: '40 V', f: 40 }

/* ---------- Tablas ---------- */
const filled = (lab, id, field, rows) => rows.filter((r) => (lab.t[id][r.k]?.[field] ?? '').toString().trim() !== '').length
function tableSteps(lab, id) {
  const t = TABLES[id], rows = t.rows, refRows = rows.filter((r) => r.ref)
  const nRef = filled(lab, id, 'ref', refRows), nF = filled(lab, id, 'fondo', rows), nM = rows.filter((r) => toNum(lab.t[id][r.k]?.med) !== null).length
  const bad = rows.filter((r) => toNum(lab.t[id][r.k]?.med) !== null && evalRow(r, lab.t[id][r.k]).some(([c]) => c === 'bad'))
  const steps = []
  if (refRows.length) steps.push({ t: `Escribe la columna «${t.refHead}» con su unidad (${nRef}/${refRows.length}).`, ok: nRef === refRows.length })
  steps.push({ t: `En cada fila, elige el fondo de escala con el que mediste (${nF}/${rows.length}).`, ok: nF === rows.length })
  steps.push({ t: `Pulsa «Copiar lectura» en cada fila para traer la medida con todas sus cifras (${nM}/${rows.length}).`, ok: nM === rows.length })
  steps.push({ t: 'Revisa la columna Comprobación: ningún aviso en rojo.', ok: nM === rows.length && !bad.length, final: true, hint: bad.length ? `Revisa la fila ${bad.map((r) => r.k).join(', ')}.` : null })
  return steps
}
export const tableGuide = (id) => (lab) => tableSteps(lab, id)

/* ---------- Bloque I ---------- */
export const outputsGuide = (lab) => {
  const b = lab.m1, s = lab.supply
  const LOG = [['7-8', '7-8 S₁'], ['13-14', '13-14 S₂'], ['10-11', '10-11']]
  return [
    { t: 'La fuente tiene que estar encendida y con 6 V y 9 V (actividad anterior).', ok: s.on },
    power(b), zone(b, 'vdc'), redJack(b, 'V'),
    fondoV(b, FONDO40, 'es el inmediatamente superior a 6 V, 9 V y 5 V, y da dos decimales.'),
    ...LOG.map(([k, l]) => ({ t: `Pulsa ${l} arriba del multímetro y después «Anotar».`, ok: !!b.log[k] })),
    ...tableSteps(lab, 't23'),
  ]
}

export const fiveGuide = (lab) => {
  const b = lab.m1, s = lab.supply
  const moved = !near(setpoint(s.s1), 6, 0.05) || !near(setpoint(s.s2), 9, 0.05)
  return [
    { t: 'Responde primero la pregunta: ¿qué crees que pasará?' },
    { t: 'En el multímetro, pulsa 10-11 para medir esa salida.', ok: b.term === '10-11' },
    { t: 'Gira algún mando de S₁ o S₂ en la fuente de la derecha.', ok: b.term === '10-11' && moved },
    { t: 'Mira el multímetro: ¿ha cambiado la lectura? Comprueba tu predicción.' },
  ]
}

/* ---------- Bloque II ---------- */
const RES5 = ['r1', 'r2', 'r3', 'r4', 'r5']
export const resistorGuide = (lab) => {
  const b = lab.m2
  const n = RES5.filter((k) => b.log[k]).length
  const p = DIAL[b.dial], best = bestOhm(REAL[b.pick])
  const r = readout(b.dial, REAL[b.pick], b.power)
  const hint = p.g !== 'ohm' ? null : r.over ? `OL: la resistencia no cabe en ${p.name}. Sube de fondo.` : best && best.i !== b.dial ? `Mide, pero hay un fondo con más resolución: ${best.name}.` : 'Fondo óptimo: pulsa «Anotar».'
  return [
    power(b), zone(b, 'ohm'), redJack(b, 'V'),
    { t: `Elige una resistencia arriba, busca el fondo que marca ÓPTIMO y pulsa «Anotar». Repite con las cinco (${n}/5).`, ok: n === 5, hint },
    ...tableSteps(lab, 't24'),
  ]
}

const firstBad = (bench, target, src) => checkBench(bench, target, src).items.find((i) => !i.ok)?.text ?? null
export const buildGuide = (id, target, keys) => (lab) => {
  const b = lab[id]
  const have = keys.filter((k) => b.parts.some((p) => p.k === k)).length
  return [
    { t: 'Elige una resistencia en la bandeja de arriba. Después pulsa un agujero para su primera pata y otro para la segunda.', ok: have > 0 },
    { t: `Coloca todas: ${keys.map((k) => RES_NAME[k]).join(', ')} (${have}/${keys.length}). Cada pata en una columna del nodo que le toca.`, ok: have === keys.length },
    { t: 'Revisa la comprobación: cada resistencia entre sus dos nodos, como en la figura. «Ver solución» muestra un montaje correcto.', ok: checkBench(b, target, false).ok, hint: firstBad(b, target, false) },
  ]
}

export const connectGuide = (id, target, posNode, negNode) => (lab) => {
  const b = lab[id]
  return [
    { t: `Elige «Pinza + fuente» y pulsa un agujero del nodo ${posNode}.`, ok: !!b.src?.pos },
    { t: `Elige «Pinza − fuente» y pulsa un agujero del nodo ${negNode}.`, ok: !!b.src?.neg },
    { t: 'Comprueba que todo queda en verde: rojo al positivo y negro al negativo.', ok: checkBench(b, target, true).ok, hint: firstBad(b, target, true) },
  ]
}

export const prepGuide = (lab) => {
  const b = lab.m2, p = DIAL[b.dial]
  return [
    power(b), zone(b, 'adc'),
    { t: 'Empieza por el fondo de 20 A: si la corriente fuera grande, no dañarías el aparato.', ok: p.name === '20 A' },
    redJack(b, '20A'),
  ]
}

export const currentGuide = (id, keys, need) => (lab) => {
  const b = lab[id], s = lab.supply, { an, r } = measureBench(b, s)
  const p = DIAL[b.dial], amm = p.g === 'adc' && jackOk(b)
  const n = keys.filter((k) => b.log[k]).length
  const el = branchOf(b)
  return [
    {
      t: `La fuente alimenta el circuito: ${need}.`,
      ok: an.powered,
      hint: !s.on ? 'La fuente está apagada: enciéndela en su diapositiva.' : !b.src?.pos || !b.src?.neg ? 'Faltan las pinzas de la fuente en la placa.' : 'Revisa el montaje y la tensión de la fuente.',
    },
    { t: 'Multímetro como amperímetro: selector en A⎓ y cable rojo en su borne (20 A o mA).', ok: amm, hint: p.g === 'adc' && !jackOk(b) ? `Con ${p.name}, el cable rojo va en ${p.name === '20 A' ? '20A' : 'mA'}.` : null },
    { t: 'Abre una rama: pulsa uno de los botones «Abrir…» de abajo, o levanta una pata con «Mover pata».' },
    {
      t: 'Cierra la rama con las puntas: elige «Punta roja» y pulsa el lado más cercano al + de la fuente; después «Punta negra» al otro lado.',
      ok: amm && !!el && !an.short,
      hint: an.short ? 'Cortocircuito: las puntas están en paralelo con la fuente. Quítalas y ponlas en la rama abierta.' : !b.red || !b.black ? 'Faltan puntas por colocar.' : !el ? 'Las puntas no están en serie: deben cerrar el hueco que dejaste al abrir la rama.' : null,
    },
    {
      t: 'Baja al fondo de 40 mA con el cable rojo en mA: la corriente es de miliamperios.',
      ok: p.name === '40 mA' && b.jack === 'mA',
      hint: r?.value < 0 ? 'Signo negativo: la corriente entra por la punta negra. Intercambia las puntas.' : null,
    },
    { t: `Pulsa «Anotar» y repite con cada rama (${n}/${keys.length}).`, ok: n === keys.length, final: true },
  ]
}

/* ---------- Bloque III ---------- */
export const seriesGuide = (lab) => {
  const s = lab.supply, b = lab.m3, a = setpoint(s.s1), c = setpoint(s.s2)
  return [
    lineOn(s),
    { t: 'En FUNCTION (2), pulsa SERIES: las dos salidas se suman.', ok: s.mode === 'series' },
    { t: 'Ajusta S₁ y S₂ a unos 18 V cada una: tensiones del mismo orden, como pide el guion.', ok: a > 0 && c > 0 && Math.max(a, c) <= 2 * Math.min(a, c), hint: showV(s, a < c ? 's1' : 's2') },
    { t: 'Afina con los mandos finos hasta que S₁ + S₂ = 36,0 V.', ok: near(a + c, 36, 0.1), hint: `Ahora S₁ + S₂ = ${V(a + c)}.` },
    power(b), zone(b, 'vdc'), redJack(b, 'V'),
    fondoV(b, FONDO40, 'el inmediatamente superior a 18 V.'),
    { t: 'Pulsa VS₁ arriba del multímetro y «Anotar».', ok: !!b.log.VS1 },
    { t: 'Pulsa VS₂ y «Anotar». Después copia las dos en la Tabla 2.6.', ok: !!b.log.VS1 && !!b.log.VS2, final: true },
  ]
}

export const ledGuide = (lab) => {
  const b = lab.m3, has = (k) => b.parts.some((p) => p.k === k)
  return [
    { t: 'Quita las puntas del multímetro: herramienta «Quitar» y pulsa cada punta.', ok: !b.red && !b.black },
    { t: 'Abre la rama de R₃ con «Mover pata» para dejar sitio al LED.' },
    { t: 'Elige «LED de R₃»: pulsa primero el agujero del ánodo (+, el lado de R₃) y después el del cátodo (−).', ok: has('led1') },
    { t: 'Haz lo mismo en la rama de R₆ con «LED de R₆».', ok: has('led2') },
    { t: 'Comprueba que todo queda en verde y que los dos LEDs lucen.', ok: checkBench(b, 'IIIL', true).ok, hint: firstBad(b, 'IIIL', true), final: true },
  ]
}

export const r6Guide = (lab) => {
  const seen = lab.m3.seen ?? {}
  return [
    { t: 'Responde primero la pregunta: ¿qué crees que le pasará al LED de R₃?' },
    { t: 'Pulsa «R₆ = 3,3 kΩ» y compara los dos LEDs.', ok: !!seen.r3b },
    { t: 'Pulsa «R₆ = 100 kΩ» y vuelve a compararlos.', ok: !!seen.r6 },
    { t: 'Pulsa «R₆ = 2,2 MΩ»: ¿qué LED cambia y cuál no?', ok: !!seen.r5 },
    { t: 'Mira la corriente de cada LED en las barras y comprueba tu predicción.' },
  ]
}

/* Guía de cada diapositiva */
const R3 = ['r1', 'r2', 'r3', 'r4', 'r5']
export const G = {
  f69: supplyGuide('indep69'),
  f25: supplyGuide('indep25'),
  outputs: outputsGuide,
  five: fiveGuide,
  res: resistorGuide,
  build2: buildGuide('m2', 'II', R3),
  connect2: connectGuide('m2', 'II', 'A (con R₁)', 'D (con R₄ y R₅)'),
  prep: prepGuide,
  cur2: currentGuide('m2', ['IR1', 'IR2', 'IR3', 'IR4', 'IR5'], 'S₁ a 25 V y las pinzas en los nodos A y D'),
  t25: tableGuide('t25'),
  build3: (lab) => [
    ...buildGuide('m3', 'III', ['r3', 'r6'])(lab).slice(0, 2),
    ...connectGuide('m3', 'III', 'de un extremo del paralelo', 'del otro extremo')(lab),
  ],
  series: seriesGuide,
  cur3: currentGuide('m3', ['Ig', 'IR3', 'IR6'], 'modo serie con 36 V y las pinzas en los extremos del paralelo'),
  t26: tableGuide('t26'),
  leds: ledGuide,
  r6: r6Guide,
}
