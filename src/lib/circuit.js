/* ================= Datos del circuito ================= */
// r3b es la segunda R₃ del guion («2x R₃»): hace de R₆ cuando R₆ = R₃
export const R = { r1: 1500, r2: 2200, r3: 3300, r3b: 3300, r4: 1e4, r5: 2.2e6, r6: 1e5 }
export const par = (a, b) => (a * b) / (a + b)
export const fmt = (n, d) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
const trim = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 3 })

export function ohm(v, fixed) {
  if (v >= 1e6) { const x = v / 1e6; return (fixed ? fmt(x, 3) : trim(x)) + ' MΩ' }
  if (v >= 1e3) { const x = v / 1e3; return (fixed ? fmt(x, 3) : trim(x)) + ' kΩ' }
  return (fixed ? fmt(v, 1) : trim(v)) + ' Ω'
}

// Corriente en mA, o en µA si no llega a 1 mA con cifras útiles
export const amp = (i) => (Math.abs(i) < 1e-4 ? `${fmt(i * 1e6, 2)} µA` : `${fmt(i * 1e3, 3)} mA`)

// Corriente animada: la duración es inversa a la fracción de corriente (tope 60 s).
export const dur = (f) => Math.min(60, 0.3 / Math.max(f, 1e-6)).toFixed(2) + 's'

// Brillo de un LED entre 0 y 1: escala logarítmica, como la percepción del ojo. 10 mA es brillo pleno
export const glow = (i) => Math.max(0, Math.min(1, (Math.log10(Math.max(Math.abs(i), 1e-9)) + 4.9) / 3))

// La cuarta banda de R₄ y R₆ está pendiente de confirmar con una foto: oro de forma provisional
export const BANDS = {
  r1: ['brown', 'green', 'red', 'gold'],
  r2: ['red', 'red', 'red', 'gold'],
  r3: ['orange', 'orange', 'red', 'gold'],
  r3b: ['orange', 'orange', 'red', 'gold'],
  r4: ['brown', 'black', 'orange', 'gold'],
  r5: ['red', 'red', 'green', 'gold'],
  r6: ['brown', 'black', 'yellow', 'gold'],
}

/* Pasos dentro de una diapositiva */
// Elemento que aparece cuando el paso actual ≥ n (CSS: [data-step].shown)
export const at = (step, n, cls = 'frag') => ({
  'data-step': n,
  className: `${cls}${step >= n ? ' shown' : ''}`,
})
// Elemento activo solo en los pasos listados (CSS: .tog.on)
export const only = (step, list, cls) => `${cls} tog${list.includes(step) ? ' on' : ''}`
