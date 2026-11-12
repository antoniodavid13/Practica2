import { REAL, RES_NAME, checkBench } from './board.js'
import { fmt } from './circuit.js'
import { DIAL, bestOhm, readout } from './meter.js'
import { TABLES, branchOf, evalRow, jackOk, measureBench, parallelTo, setpoint, toNum } from './practice.js'

/* ================= Guías paso a paso =================
   Cada guía es una función del estado del laboratorio que devuelve los pasos de una diapositiva:
   { t: qué hacer, why: por qué se hace (la explicación que acompaña al paso),
     ok: si ya está hecho (undefined: paso sin comprobación), hint: pista si es el paso actual,
     final: si al cumplirse el último paso la actividad queda hecha aunque cambien los anteriores }.
   El paso actual es el primero sin hacer. */

const near = (a, b, t) => Math.abs(a - b) <= t
const V = (x) => `${fmt(x, 2)} V`
const NAME = { s1: 'S₁', s2: 'S₂' }
const KNOB = { s1: [4, 5], s2: [17, 16] }

/* ---------- Fuente ---------- */
const lineOn = (s) => ({ t: 'Enciende la fuente con el interruptor LINE (19): pulsa la palanca.', why: 'Sin red, la fuente no entrega tensión y sus displays no muestran nada.', ok: s.on })
const indep = (s) => ({
  t: 'En FUNCTION (2), pulsa INDEP: cada salida se ajusta por separado.',
  why: 'En modo independiente S₁ y S₂ son dos fuentes separadas, cada una con sus bornes y sus mandos.',
  ok: s.mode === 'indep', hint: s.mode === 'series' ? 'Ahora está en SERIES. Pulsa INDEP.' : null,
})
const showV = (s, ch) => (s.vSel !== ch ? `El voltímetro de la fuente está mostrando ${NAME[ch === 's1' ? 's2' : 's1']}. Pulsa la tecla V ${NAME[ch]} (3) para ver ${NAME[ch]}.` : null)

function channel(s, ch, target) {
  const v = setpoint(s[ch]), [g, f] = KNOB[ch], n = NAME[ch]
  const over = v > target + 0.5
  return [
    {
      t: `Gira el mando grueso de ${n} (COARSE, ${g}) hasta acercarte a ${fmt(target, 0)} V. Arrástralo en círculo, o pulsa a su derecha para subir y a su izquierda para bajar.`,
      why: 'El grueso recorre de 0 a 30 V en menos de una vuelta: sirve para acercarse rápido, no para dejar el valor exacto.',
      ok: near(v, target, 0.5),
      hint: showV(s, ch) ?? (over ? `Te has pasado: ${n} = ${V(v)}. Gira el grueso hacia la izquierda.` : `${n} = ${V(v)}. Sigue girando el grueso hacia la derecha.`),
    },
    {
      t: `Afina con el mando fino de ${n} (FINE, ${f}) hasta que el display marque ${fmt(target, 1)}.`,
      why: 'El fino solo mueve ±0,5 V: con él se deja la tensión justa sin pasarse.',
      ok: near(v, target, 0.05),
      hint: showV(s, ch) ?? `${n} = ${V(v)}: ${v < target ? 'sube' : 'baja'} con el fino. Si pulsas a un lado del mando, se mueve poco a poco.`,
    },
  ]
}

export const supplyGuide = (need) => ({ supply: s }) => {
  if (need === 'indep69') return [lineOn(s), indep(s), ...channel(s, 's1', 6), ...channel(s, 's2', 9)]
  if (need === 'indep25') return [lineOn(s), indep(s), ...channel(s, 's1', 25), { t: 'No conectes todavía la fuente a la placa: la tensión se fija en vacío.', why: 'Mientras giras los mandos pasas por otros valores. En vacío no llegan a ningún circuito: primero se ajusta y después se conecta.' }]
  return []
}

/* ---------- Multímetro ---------- */
const power = (b) => ({ t: 'Enciende el multímetro con el botón POWER.', why: 'Apagado, la pantalla no muestra nada aunque las puntas estén bien colocadas.', ok: b.power })
const ZONE_WHY = {
  vdc: 'Como voltímetro mide la diferencia de potencial entre dos puntos: las puntas se apoyan en paralelo.',
  adc: 'Como amperímetro mide la corriente que lo atraviesa: tiene que ir en serie, dentro de la rama.',
  ohm: 'Como óhmetro hace pasar una pequeña corriente por la resistencia: se mide suelta, sin alimentar.',
}
const zone = (b, g) => {
  const txt = { vdc: 'V⎓ (tensión continua, arriba a la derecha)', adc: 'A⎓ (corriente continua, a la derecha)', ohm: 'Ω (resistencia, abajo a la izquierda)' }[g]
  return { t: `Gira el selector a la zona ${txt}. Pulsa una posición de la escala o usa los botones ↺ ↻.`, why: ZONE_WHY[g], ok: DIAL[b.dial].g === g }
}
const redJack = (b, j) => ({
  t: j === 'V' ? 'Cable rojo en el borne VΩHz (el de la derecha). El negro siempre en COM.' : j === '20A' ? 'Cable rojo en el borne 20A (el de la izquierda): es el más seguro para empezar.' : 'Cable rojo en el borne mA.',
  why: j === 'V' ? 'Por el borne VΩHz el multímetro apenas toma corriente del circuito. En los de corriente sería casi un cortocircuito.'
    : j === '20A' ? 'Si la corriente fuera mayor de lo esperado, este borne la aguanta. El de mA tiene un fusible que se funde con corrientes grandes.'
      : 'El borne mA da más resolución con corrientes pequeñas. Úsalo solo cuando sepas que la corriente es de miliamperios.',
  ok: b.jack === j,
  hint: 'Pulsa el borne en el dibujo del multímetro o usa los botones de debajo.',
})
const fondoV = (b, best, why) => {
  const p = DIAL[b.dial]
  const hint = p.g !== 'vdc' ? null : p.f < best.f ? `El fondo de ${p.name} es menor que la tensión: marca OL. Sube de fondo.` : p.f > best.f ? `En ${p.name} mide, pero pierdes cifras. Baja a ${best.name}.` : null
  return { t: `Elige el fondo de ${best.name}: ${why}`, why: 'El mejor fondo es el inmediatamente superior al valor: no marca OL y da el mayor número de cifras. En 40 V, la resolución es de 0,01 V.', ok: p.name === best.name, hint }
}
const FONDO40 = { name: '40 V', f: 40 }

/* ---------- Tablas ---------- */
const filled = (lab, id, field, rows) => rows.filter((r) => (lab.t[id][r.k]?.[field] ?? '').toString().trim() !== '').length
function tableSteps(lab, id) {
  const t = TABLES[id], rows = t.rows, refRows = rows.filter((r) => r.ref)
  const nRef = filled(lab, id, 'ref', refRows), nF = filled(lab, id, 'fondo', rows), nM = rows.filter((r) => toNum(lab.t[id][r.k]?.med) !== null).length
  const bad = rows.filter((r) => toNum(lab.t[id][r.k]?.med) !== null && evalRow(r, lab.t[id][r.k]).some(([c]) => c === 'bad'))
  const steps = []
  if (refRows.length) steps.push({ t: `Escribe la columna «${t.refHead}» con su unidad (${nRef}/${refRows.length}).`, why: 'Es el valor con el que comparas la medida: sin él no sabes si lo que mides es coherente.', ok: nRef === refRows.length })
  steps.push({ t: `En cada fila, elige el fondo de escala con el que mediste (${nF}/${rows.length}).`, why: 'El fondo fija la resolución y la incertidumbre de la medida: forma parte del resultado.', ok: nF === rows.length })
  steps.push({ t: `Pulsa «Copiar lectura» en cada fila para traer la medida con todas sus cifras (${nM}/${rows.length}).`, why: 'El guion pide escribir todas las cifras de la pantalla y la unidad. «Copiar lectura» las trae tal cual.', ok: nM === rows.length })
  steps.push({ t: 'Revisa la columna Comprobación: ningún aviso en rojo.', why: 'Una medida fuera del intervalo coherente suele delatar un error de montaje, de fondo o de unidades.', ok: nM === rows.length && !bad.length, final: true, hint: bad.length ? `Revisa la fila ${bad.map((r) => r.k).join(', ')}.` : null })
  return steps
}
export const tableGuide = (id) => (lab) => tableSteps(lab, id)

/* ---------- Bloque I ---------- */
export const outputsGuide = (lab) => {
  const b = lab.m1, s = lab.supply
  const LOG = [['7-8', '7-8 S₁'], ['13-14', '13-14 S₂'], ['10-11', '10-11']]
  return [
    { t: 'La fuente tiene que estar encendida y con 6 V y 9 V (actividad anterior).', why: 'Vas a medir lo que entrega de verdad cada salida con el ajuste de la actividad 1.', ok: s.on },
    power(b), zone(b, 'vdc'), redJack(b, 'V'),
    fondoV(b, FONDO40, 'es el inmediatamente superior a 6 V, 9 V y 5 V, y da dos decimales.'),
    ...LOG.map(([k, l]) => ({ t: `Pulsa ${l} arriba del multímetro y después «Anotar».`, why: 'Cada pareja de bornes es una salida distinta: 7-8 es S₁, 13-14 es S₂ y 10-11 es la salida fija de 5 V.', ok: !!b.log[k] })),
    ...tableSteps(lab, 't23'),
  ]
}

export const fiveGuide = (lab) => {
  const b = lab.m1, s = lab.supply
  const moved = !near(setpoint(s.s1), 6, 0.05) || !near(setpoint(s.s2), 9, 0.05)
  return [
    { t: 'Responde primero la pregunta: ¿qué crees que pasará?', why: 'Predecir antes de medir te obliga a pensar cómo está construida la fuente.' },
    { t: 'En el multímetro, pulsa 10-11 para medir esa salida.', why: 'Los terminales 10 y 11 son la salida fija: es la que quieres vigilar.', ok: b.term === '10-11' },
    { t: 'Gira algún mando de S₁ o S₂ en la fuente de la derecha.', why: 'Si la salida de 10 y 11 dependiera de S₁ o S₂, su tensión cambiaría al mover sus mandos.', ok: b.term === '10-11' && moved },
    { t: 'Mira el multímetro: ¿ha cambiado la lectura? Comprueba tu predicción.', why: 'Lo que marca el multímetro mientras giras los mandos responde a la pregunta del guion.' },
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
    { t: `Elige una resistencia arriba, busca el fondo que marca ÓPTIMO y pulsa «Anotar». Repite con las cinco (${n}/5).`, why: 'Cada resistencia tiene un valor real dentro de su tolerancia. El fondo óptimo cambia con el valor: 4 kΩ para R₁ a R₃, 40 kΩ para R₄ y 4 MΩ para R₅.', ok: n === 5, hint },
    ...tableSteps(lab, 't24'),
  ]
}

const firstBad = (bench, target, src) => checkBench(bench, target, src).items.find((i) => !i.ok)?.text ?? null
export const buildGuide = (id, target, keys) => (lab) => {
  const b = lab[id]
  const have = keys.filter((k) => b.parts.some((p) => p.k === k)).length
  return [
    { t: 'Elige una resistencia en la bandeja de arriba. Después pulsa un agujero para su primera pata y otro para la segunda.', why: 'En la placa, los cinco agujeros de cada columna están unidos por dentro: cada columna es un nodo.', ok: have > 0 },
    { t: `Coloca todas: ${keys.map((k) => RES_NAME[k]).join(', ')} (${have}/${keys.length}). Cada pata en una columna del nodo que le toca.`, why: 'Cada resistencia une dos nodos. Da igual en qué agujero de la columna pongas la pata: la conexión es la misma.', ok: have === keys.length },
    { t: 'Revisa la comprobación: cada resistencia entre sus dos nodos, como en la figura. «Ver solución» muestra un montaje correcto.', why: 'Si tus nodos coinciden con los de la figura, el circuito es el mismo aunque esté colocado de otra forma.', ok: checkBench(b, target, false).ok, hint: firstBad(b, target, false) },
  ]
}

export const connectGuide = (id, target, posNode, negNode) => (lab) => {
  const b = lab[id]
  return [
    { t: `Elige «Pinza + fuente» y pulsa un agujero del nodo ${posNode}.`, why: 'La pinza roja lleva el positivo de la fuente al nodo por el que entra la corriente al circuito.', ok: !!b.src?.pos },
    { t: `Elige «Pinza − fuente» y pulsa un agujero del nodo ${negNode}.`, why: 'La pinza negra cierra el circuito de vuelta a la fuente. Rojo al positivo y negro al negativo es el convenio de colores.', ok: !!b.src?.neg },
    { t: 'Comprueba que todo queda en verde: rojo al positivo y negro al negativo.', why: 'Con la polaridad al revés, todas las corrientes cambiarían de sentido y las medidas saldrían negativas.', ok: checkBench(b, target, true).ok, hint: firstBad(b, target, true) },
  ]
}

export const prepGuide = (lab) => {
  const b = lab.m2, p = DIAL[b.dial]
  return [
    power(b), zone(b, 'adc'),
    { t: 'Empieza por el fondo de 20 A: si la corriente fuera grande, no dañarías el aparato.', why: 'Aún no sabes cuánta corriente hay. El fondo mayor es el único que seguro no se sobrecarga; después bajarás.', ok: p.name === '20 A' },
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
      why: 'Sin alimentación no circula corriente y el amperímetro marcaría 0.',
      ok: an.powered,
      hint: !s.on ? 'La fuente está apagada: enciéndela en su diapositiva.' : !b.src?.pos || !b.src?.neg ? 'Faltan las pinzas de la fuente en la placa.' : 'Revisa el montaje y la tensión de la fuente.',
    },
    {
      t: 'Multímetro como amperímetro: selector en A⎓ y cable rojo en su borne (20 A o mA).',
      why: 'El amperímetro solo mide si el selector y el borne del cable rojo coinciden: 20 A con 20A, y 400 mA o 40 mA con mA.',
      ok: amm && !(b.fuse && b.jack === 'mA'),
      hint: b.fuse && b.jack === 'mA' ? 'El fusible del borne mA está fundido: pulsa «Cambiar el fusible» en el multímetro.'
        : p.g === 'adc' && !jackOk(b) ? `Con ${p.name}, el cable rojo va en ${p.name === '20 A' ? '20A' : 'mA'}.` : null,
    },
    { t: 'Abre una rama: pulsa uno de los botones «Abrir…» de abajo, o levanta una pata con «Mover pata».', why: 'Para que la corriente de una rama pase por el amperímetro, primero hay que interrumpirla.' },
    {
      t: 'Cierra la rama con las puntas: elige «Punta roja» y pulsa el lado más cercano al + de la fuente; después «Punta negra» al otro lado.',
      why: 'Las puntas cierran el hueco y toda la corriente de la rama atraviesa el amperímetro. Con la roja hacia el +, la corriente entra por ella y la lectura sale positiva.',
      ok: amm && !!el && !an.limited,
      hint: an.limited ? 'Cortocircuito: la fuente está limitando la corriente. Si las puntas están en paralelo con la fuente, quítalas y ponlas en la rama abierta.'
        : !b.red || !b.black ? 'Faltan puntas por colocar.'
          : !el && parallelTo(b).length ? 'Las puntas están en paralelo con una resistencia y la cortocircuitan. Abre su rama y cierra el hueco con las puntas.'
            : !el ? 'Las puntas no están en serie: deben cerrar el hueco que dejaste al abrir la rama.' : null,
    },
    {
      t: 'Baja al fondo de 40 mA con el cable rojo en mA: la corriente es de miliamperios.',
      why: 'Con unos pocos miliamperios, el fondo de 40 mA da centésimas de miliamperio. En 20 A la pantalla marcaría casi 0.',
      ok: p.name === '40 mA' && b.jack === 'mA',
      hint: r?.value < 0 ? 'Signo negativo: la corriente entra por la punta negra. Intercambia las puntas.' : null,
    },
    { t: `Pulsa «Anotar» y repite con cada rama (${n}/${keys.length}).`, why: 'Con la corriente de todas las ramas podrás comprobar la ley de corrientes de Kirchhoff en cada nodo.', ok: n === keys.length, final: true },
  ]
}

/* ---------- Bloque III ---------- */
export const seriesGuide = (lab) => {
  const s = lab.supply, b = lab.m3, a = setpoint(s.s1), c = setpoint(s.s2)
  return [
    lineOn(s),
    { t: 'En FUNCTION (2), pulsa SERIES: las dos salidas se suman.', why: 'Una sola salida llega a 30 V. En serie, entre el + de S₁ y el − de S₂ hay V₁ + V₂, hasta 60 V.', ok: s.mode === 'series' },
    { t: 'Ajusta S₁ y S₂ a unos 18 V cada una: tensiones del mismo orden, como pide el guion.', why: 'Es lo que recomienda el guion. Con 18 V cada una, ninguna trabaja cerca de su máximo de 30 V.', ok: a > 0 && c > 0 && Math.max(a, c) <= 2 * Math.min(a, c), hint: showV(s, a < c ? 's1' : 's2') },
    { t: 'Afina con los mandos finos hasta que S₁ + S₂ = 36,0 V.', why: 'Los valores teóricos de la Tabla 2.6 son para Eg = 36 V. Con otra tensión, todas las corrientes cambiarían en proporción.', ok: near(a + c, 36, 0.1), hint: `Ahora S₁ + S₂ = ${V(a + c)}.` },
    power(b), zone(b, 'vdc'), redJack(b, 'V'),
    fondoV(b, FONDO40, 'el inmediatamente superior a 18 V.'),
    { t: 'Pulsa VS₁ arriba del multímetro y «Anotar».', why: 'La Tabla 2.6 pide la tensión real de cada salida, medida con el multímetro, no la que marca la fuente.', ok: !!b.log.VS1 },
    { t: 'Pulsa VS₂ y «Anotar». Después copia las dos en la Tabla 2.6.', why: 'Sumadas, VS₁ y VS₂ dan la tensión Eg que alimenta el divisor.', ok: !!b.log.VS1 && !!b.log.VS2, final: true },
  ]
}

export const ledGuide = (lab) => {
  const b = lab.m3, has = (k) => b.parts.some((p) => p.k === k)
  return [
    { t: 'Quita las puntas del multímetro: herramienta «Quitar» y pulsa cada punta.', why: 'Así el circuito queda solo con resistencias y LEDs, como en la Figura 2.7.', ok: !b.red && !b.black },
    { t: 'Abre la rama de R₃ con «Mover pata» para dejar sitio al LED.', why: 'Cada LED va en serie con su resistencia: tiene que quedar dentro de la rama, por donde pasa su corriente.' },
    { t: 'Elige «LED de R₃»: pulsa primero el agujero del ánodo (+, el lado de R₃) y después el del cátodo (−). Al revés, con 36 V, el LED se estropea.', why: 'El LED solo conduce y luce si la corriente va del ánodo al cátodo. El ánodo es la pata larga.', ok: has('led1') },
    { t: 'Haz lo mismo en la rama de R₆ con «LED de R₆».', why: 'Con un LED en cada rama puedes comparar las dos corrientes a simple vista.', ok: has('led2') },
    { t: 'Comprueba que todo queda en verde y que los dos LEDs lucen.', why: 'El brillo de cada LED crece con la corriente de su rama.', ok: checkBench(b, 'IIIL', true).ok, hint: firstBad(b, 'IIIL', true), final: true },
  ]
}

export const r6Guide = (lab) => {
  const seen = lab.m3.seen ?? {}
  return [
    { t: 'Responde primero la pregunta: ¿qué crees que le pasará al LED de R₃?', why: 'Si predices antes, sabrás si tu idea de cómo se reparte la corriente era correcta.' },
    { t: 'Pulsa «R₆ = 3,3 kΩ» y compara los dos LEDs.', why: 'Con R₆ = R₃ las dos ramas son iguales.', ok: !!seen.r3b },
    { t: 'Pulsa «R₆ = 100 kΩ» y vuelve a compararlos.', why: 'Ahora R₆ es unas 30 veces mayor que R₃.', ok: !!seen.r6 },
    { t: 'Pulsa «R₆ = 2,2 MΩ»: ¿qué LED cambia y cuál no?', why: 'R₆ es ya unas 670 veces mayor que R₃.', ok: !!seen.r5 },
    { t: 'Mira la corriente de cada LED en las barras y comprueba tu predicción.', why: 'Las barras dan la corriente de cada LED: su brillo depende solo de ella.' },
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
