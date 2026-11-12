import { createContext, useContext } from 'react'
import { HOLE } from './board'

/* Estado del laboratorio compartido entre diapositivas: la fuente, una placa por bloque y las tablas.
   Se guarda en localStorage (si el navegador lo permite) para no perder el trabajo al recargar. */
export const LabContext = createContext(null)
export const useLab = () => useContext(LabContext)

const KEY = 'p2-corriente-continua:lab:v1'
const IDS = ['m1', 'm2', 'm3']
const TABLES = ['t23', 't24', 't25', 't26']

// jack: borne del cable rojo ('V', 'mA' o '20A'). log: lecturas anotadas. term: salida que se mide en la fuente
export const emptyBench = () => ({ parts: [], red: null, black: null, src: null, dial: 2, power: true, jack: 'V', log: {}, term: '7-8', pick: 'r1', seen: {} })
export const emptySupply = () => ({ on: false, mode: 'indep', s1: { c: 0, f: 0 }, s2: { c: 0, f: 0 }, vSel: 's1', aSel: 's1' })
export const freshLab = () => ({
  supply: emptySupply(),
  m1: emptyBench(), m2: emptyBench(), m3: emptyBench(),
  t: Object.fromEntries(TABLES.map((t) => [t, {}])),
})

const validHole = (h) => (HOLE.has(h) ? h : null)
const validBench = (b) => ({
  ...emptyBench(), ...b,
  parts: (b.parts || []).filter((p) => HOLE.has(p.a) && HOLE.has(p.b)),
  red: validHole(b.red), black: validHole(b.black),
  src: b.src ? { pos: validHole(b.src.pos), neg: validHole(b.src.neg) } : null,
})

export function loadLab() {
  const def = freshLab()
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!s) return def
    return {
      supply: { ...def.supply, ...s.supply },
      ...Object.fromEntries(IDS.map((id) => [id, validBench(s[id] || {})])),
      t: Object.fromEntries(TABLES.map((t) => [t, s.t?.[t] || {}])),
    }
  } catch { return def }
}
export function saveLab(lab) {
  try { localStorage.setItem(KEY, JSON.stringify(lab)) } catch { /* almacenamiento bloqueado */ }
}
