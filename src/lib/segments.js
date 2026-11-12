/* Dígitos de 7 segmentos sobre un canvas: pantallas del multímetro (LCD) y de la fuente (LED rojo).
   Segmentos: a arriba, b arriba derecha, c abajo derecha, d abajo, e abajo izquierda, f arriba izquierda, g centro. */
const MAP = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
  '-': 'g', ' ': '', O: 'abcdef', L: 'def', E: 'adefg', r: 'eg', P: 'abefg', A: 'abcefg', o: 'cdeg', n: 'ceg', F: 'aefg',
}

function segPath(ctx, s, x, y, w, h, t) {
  const sk = 0.12 * h // inclinación de los dígitos
  const P = (px, py) => [x + px + sk * (1 - (py - y) / h), py]
  const g = t * 0.55, hh = h / 2
  const H = (yy) => [P(g, yy), P(g + t / 2, yy - t / 2), P(w - g - t / 2, yy - t / 2), P(w - g, yy), P(w - g - t / 2, yy + t / 2), P(g + t / 2, yy + t / 2)]
  const V = (xx, y0, y1) => [P(xx, y0 + g), P(xx + t / 2, y0 + g + t / 2), P(xx + t / 2, y1 - g - t / 2), P(xx, y1 - g), P(xx - t / 2, y1 - g - t / 2), P(xx - t / 2, y0 + g + t / 2)]
  const pts = {
    a: H(y + t / 2), d: H(y + h - t / 2), g: H(y + hh),
    f: V(t / 2, y, y + hh), e: V(t / 2, y + hh, y + h), b: V(w - t / 2, y, y + hh), c: V(w - t / 2, y + hh, y + h),
  }[s]
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
  ctx.closePath()
  ctx.fill()
}

/* Dibuja `text` alineado a la derecha en (right, y). `cells`: número de dígitos visibles (los vacíos se dibujan apagados). */
export function drawSegments(ctx, text, { right, y, h, on, off, cells = 4 }) {
  const w = h * 0.55, gap = h * 0.2, t = h * 0.13
  const chars = []
  for (const ch of String(text)) {
    if (ch === '.' && chars.length) chars[chars.length - 1].dot = true
    else chars.push({ ch, dot: false })
  }
  while (chars.length < cells) chars.unshift({ ch: ' ', dot: false })
  let x = right - chars.length * (w + gap)
  for (const { ch, dot } of chars) {
    const lit = MAP[ch] ?? ''
    for (const s of 'abcdefg') {
      const isOn = lit.includes(s)
      if (!isOn && !off) continue
      ctx.fillStyle = isOn ? on : off
      segPath(ctx, s, x, y, w, h, t)
    }
    if (dot || off) {
      ctx.fillStyle = dot ? on : off
      ctx.beginPath()
      ctx.arc(x + w + gap * 0.45, y + h - t * 0.6, t * 0.62, 0, Math.PI * 2)
      ctx.fill()
    }
    x += w + gap
  }
}
