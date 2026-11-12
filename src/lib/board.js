/* ================= Protoboard (geometría, nodos y análisis) =================
   Placa de 830 puntos como la del laboratorio: 63 columnas, filas a–j y cuatro carriles
   (+ y − arriba y abajo) en grupos de 5. Columna de 5 agujeros = un nodo; fila de carril = un nodo. */

export const P = 12, COLS = 63, X0 = 36
export const W = X0 * 2 + (COLS - 1) * P // 816
export const H = 264
export const UP = ['a', 'b', 'c', 'd', 'e'], LO = ['f', 'g', 'h', 'i', 'j']
export const ROW_Y = { a: 68, b: 80, c: 92, d: 104, e: 116, f: 148, g: 160, h: 172, i: 184, j: 196 }
export const RAIL_Y = { 't+': 20, 't-': 32, 'b+': 232, 'b-': 244 }
const RAIL_NAME = { 't+': 'carril superior +', 't-': 'carril superior −', 'b+': 'carril inferior +', 'b-': 'carril inferior −' }
export const bx = (c) => X0 + c * P

// Columnas (base 0) con agujero de carril: 10 grupos de 5, con un hueco en el centro
export const RAIL_COLS = []
for (let g = 0; g < 10; g++) for (let k = 0; k < 5; k++) RAIL_COLS.push((g < 5 ? 2 + g * 6 : 33 + (g - 5) * 6) + k)

// Agujeros: id legible ("f12", "t+7"), posición, nodo y descripción
export const HOLES = []
for (const r of Object.keys(RAIL_Y))
  for (const c of RAIL_COLS)
    HOLES.push({ id: `${r}${c + 1}`, x: bx(c), y: RAIL_Y[r], node: r, label: RAIL_NAME[r] })
for (let c = 0; c < COLS; c++)
  for (const r of UP.concat(LO))
    HOLES.push({
      id: `${r}${c + 1}`, x: bx(c), y: ROW_Y[r], node: `${c + 1}${UP.includes(r) ? 'U' : 'L'}`,
      label: `columna ${c + 1} (${UP.includes(r) ? 'a–e' : 'f–j'})`,
    })
export const HOLE = new Map(HOLES.map((h) => [h.id, h]))
export const NODES = [...new Set(HOLES.map((h) => h.node))]

// Rectángulo que cubre todos los agujeros de un nodo (para resaltarlo)
export function stripRect(node) {
  if (RAIL_Y[node] !== undefined)
    return { x: bx(RAIL_COLS[0]) - 7, y: RAIL_Y[node] - 6, w: bx(RAIL_COLS.at(-1)) - bx(RAIL_COLS[0]) + 14, h: 12 }
  const c = parseInt(node, 10) - 1, up = node.endsWith('U')
  const y0 = up ? ROW_Y.a : ROW_Y.f
  return { x: bx(c) - 6, y: y0 - 6, w: 12, h: ROW_Y.e - ROW_Y.a + 12 }
}

/* ---------- Componentes ---------- */
export const RES_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']
export const RES_NAME = { r1: 'R₁', r2: 'R₂', r3: 'R₃', r4: 'R₄', r5: 'R₅', r6: 'R₆', led1: 'LED de R₃', led2: 'LED de R₆' }
// Valor "real" de cada resistencia del simulador: dentro de su tolerancia, como en el laboratorio.
export const REAL = { r1: 1491, r2: 2213, r3: 3276, r3b: 3312, r4: 9930, r5: 2.176e6, r6: 98700 }

const names = (ks) => {
  const n = ks.map((k) => RES_NAME[k])
  return n.length > 1 ? n.slice(0, -1).join(', ') + ' y ' + n.at(-1) : n[0]
}

// Unión de nodos a través de los cables (resistencia nula)
export function netFinder(parts) {
  const p = new Map()
  const find = (x) => { let r = x; while (p.has(r)) r = p.get(r); return r }
  for (const pt of parts) {
    if (pt.k !== 'wire') continue
    const a = find(HOLE.get(pt.a).node), b = find(HOLE.get(pt.b).node)
    if (a !== b) p.set(a, b)
  }
  return find
}
export const netOfHole = (find, id) => find(HOLE.get(id).node)

// Resistencia que ve el óhmetro entre las puntas: análisis nodal con 1 A inyectado en la roja.
export function resistance({ parts, red, black }) {
  if (!red || !black) return Infinity
  const find = netFinder(parts)
  const s = netOfHole(find, red), t = netOfHole(find, black)
  if (s === t) return 0
  const edges = parts.filter((p) => p.k !== 'wire' && !p.k.startsWith('led'))
    .map((p) => [netOfHole(find, p.a), netOfHole(find, p.b), REAL[p.as ?? p.k]])
    .filter(([a, b]) => a !== b)
  const adj = new Map()
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a).push(b); adj.get(b).push(a)
  }
  const seen = new Set([s]), queue = [s]
  while (queue.length) for (const n of adj.get(queue.shift()) || []) if (!seen.has(n)) { seen.add(n); queue.push(n) }
  if (!seen.has(t)) return Infinity

  const nodes = [...seen].filter((n) => n !== t), idx = new Map(nodes.map((n, i) => [n, i])), n = nodes.length
  const G = Array.from({ length: n }, () => new Float64Array(n + 1))
  for (const [a, b, r] of edges) {
    if (!seen.has(a)) continue
    const g = 1 / r, ia = idx.get(a), ib = idx.get(b)
    if (ia !== undefined) G[ia][ia] += g
    if (ib !== undefined) G[ib][ib] += g
    if (ia !== undefined && ib !== undefined) { G[ia][ib] -= g; G[ib][ia] -= g }
  }
  G[idx.get(s)][n] = 1
  // Eliminación gaussiana con pivoteo parcial
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(G[r][col]) > Math.abs(G[piv][col])) piv = r;
    [G[col], G[piv]] = [G[piv], G[col]]
    for (let r = 0; r < n; r++) {
      if (r === col || !G[r][col]) continue
      const f = G[r][col] / G[col][col]
      for (let k = col; k <= n; k++) G[r][k] -= f * G[col][k]
    }
  }
  const i = idx.get(s)
  return G[i][n] / G[i][i]
}

/* ---------- Comprobación del montaje frente a la figura ---------- */
export const TARGETS = {
  II: { fig: 'la Figura 2.5', strict: true, ends: ['A', 'D'], res: { r1: ['A', 'B'], r2: ['B', 'C'], r3: ['B', 'C'], r4: ['C', 'D'], r5: ['C', 'D'] } },
  III: { fig: 'la Figura 2.6', ends: ['A', 'B'], res: { r3: ['A', 'B'], r6: ['A', 'B'] } },
  IIIL: { fig: 'la Figura 2.7', strict: true, ends: ['A', 'B'], res: { r3: ['A', 'C'], led1: ['C', 'B'], r6: ['A', 'D'], led2: ['D', 'B'] } },
}
const samePair = (a, b) => (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])
const perms = (xs) => xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms(xs.filter((_, j) => j !== i)).map((p) => [x, ...p]))

export function checkBench(bench, targetKey, withSource) {
  const { fig, res: target, ends, strict } = TARGETS[targetKey]
  const want = Object.keys(target)
  const labels = [...new Set(Object.values(target).flat())] // letras de los nodos de la figura
  const res = bench.parts.filter((p) => p.k !== 'wire')
  const have = res.map((p) => p.k)
  const missing = want.filter((k) => !have.includes(k)), extra = have.filter((k) => !want.includes(k))
  const find = netFinder(bench.parts)
  const shorted = res.filter((p) => netOfHole(find, p.a) === netOfHole(find, p.b))
  const items = [
    {
      ok: !missing.length && !extra.length,
      text: missing.length ? `Falta ${names(missing)}` : extra.length ? `Sobra ${names(extra)}: quítala de la placa` : `${names(want)} en la placa`,
    },
    {
      ok: !shorted.length,
      text: shorted.length ? `${names(shorted.map((p) => p.k))} en cortocircuito: sus dos patas están en el mismo nodo` : 'Ninguna resistencia en cortocircuito',
    },
  ]
  let map = null
  if (!missing.length && !extra.length && !shorted.length) {
    const nodes = [...new Set(res.flatMap((p) => [netOfHole(find, p.a), netOfHole(find, p.b)]))]
    if (nodes.length === labels.length)
      for (const perm of perms(nodes)) {
        const m = Object.fromEntries(labels.map((l, i) => [l, perm[i]]))
        if (res.every((p) => samePair([netOfHole(find, p.a), netOfHole(find, p.b)], target[p.k].map((l) => m[l])))) { map = m; break }
      }
  }
  items.push({ ok: !!map, text: map ? `Nodos ${labels.join(', ')} como en ${fig}` : `Las conexiones aún no forman el circuito de ${fig}` })
  const leds = res.filter((p) => p.k.startsWith('led'))
  if (leds.length && map) {
    const ok = leds.every((p) => netOfHole(find, p.a) === map[target[p.k][0]])
    items.push({ ok, text: ok ? 'LEDs con el ánodo hacia su resistencia' : 'Hay un LED al revés: el ánodo (+) va hacia su resistencia' })
  }
  if (withSource) {
    const placed = bench.src?.pos && bench.src?.neg
    const got = placed ? [netOfHole(find, bench.src.pos), netOfHole(find, bench.src.neg)] : []
    const want2 = map ? ends.map((l) => map[l]) : []
    const ok = !!(map && placed && (strict ? got[0] === want2[0] && got[1] === want2[1] : samePair(got, want2)))
    items.push({ ok, text: ok ? 'Fuente conectada: rojo al positivo y negro al negativo' : placed ? 'Revisa las pinzas de la fuente' : 'Coloca las dos pinzas de la fuente' })
  }
  // `map`: nodos del alumno (null si el montaje aún no coincide con la figura)
  return { ok: items.every((i) => i.ok), items, map }
}

/* ---------- Soluciones de referencia ---------- */
export const SOLUTIONS = {
  // Figura 2.5, de izquierda a derecha: A = columna 5, B = 11, C = 19 y D = 27
  II: {
    parts: [
      { k: 'r1', a: 'a5', b: 'a11' }, { k: 'r2', a: 'b11', b: 'b19' }, { k: 'r3', a: 'd11', b: 'd19' },
      { k: 'r4', a: 'a19', b: 'a27' }, { k: 'r5', a: 'c19', b: 'c27' },
    ],
    src: { pos: 'e5', neg: 'e27' }, red: null, black: null,
  },
  // Figura 2.6: las dos resistencias entre las columnas 5 y 20
  III: {
    parts: [{ k: 'r3', a: 'a5', b: 'a20' }, { k: 'r6', a: 'c5', b: 'c20' }],
    src: { pos: 'e5', neg: 'e20' }, red: null, black: null,
  },
  // Figura 2.7: cada LED después de su resistencia, con el ánodo hacia ella. El carril superior − es el nodo común
  IIIL: {
    parts: [
      { k: 'r3', a: 'a5', b: 'a12' }, { k: 'led1', a: 'b12', b: 't-15' },
      { k: 'r6', a: 'c5', b: 'c24' }, { k: 'led2', a: 'b24', b: 't-27' },
    ],
    src: { pos: 'e5', neg: 't-31' }, red: null, black: null,
  },
}

/* Cómo abrir cada rama para medir su corriente: qué pata se mueve y dónde van las puntas.
   La punta roja queda en el lado más cercano al positivo de la fuente. */
const OPENINGS = {
  II: {
    IR1: { move: ['r1', 'b', 'a8'], red: 'b8', black: 'e11' },
    IR2: { move: ['r2', 'a', 'b15'], red: 'e11', black: 'c15' },
    IR3: { move: ['r3', 'a', 'd15'], red: 'e11', black: 'c15' },
    IR4: { move: ['r4', 'b', 'a23'], red: 'b23', black: 'e27' },
    IR5: { move: ['r5', 'b', 'c23'], red: 'e23', black: 'e27' },
  },
  III: {
    Ig: { clip: 'e2', red: 'd2', black: 'd5' },
    IR3: { move: ['r3', 'b', 'a17'], red: 'b17', black: 'b20' },
    IR6: { move: ['r6', 'b', 'c16'], red: 'd16', black: 'b20' },
  },
}
export function openBranch(target, key) {
  const s = SOLUTIONS[target], o = OPENINGS[target][key]
  const parts = s.parts.map((p, i) => {
    const q = { ...p, id: `${p.k}-sol${i}` }
    if (o.move && o.move[0] === p.k) q[o.move[1]] = o.move[2]
    return q
  })
  return { parts, red: o.red, black: o.black, src: o.clip ? { ...s.src, pos: o.clip } : s.src }
}
