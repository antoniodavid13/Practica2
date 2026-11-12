import { Suspense, lazy, useEffect, useRef, useState } from 'react'

/* three.js solo se descarga cuando hace falta, y cada aparato solo se monta mientras su diapositiva está activa:
   todas las diapositivas existen a la vez y el navegador admite pocos contextos WebGL (unos 16; menos en móvil). */
const Instrument3D = lazy(() => import('./Instrument3D'))

const activeSlide = (el) => { const s = el?.closest('.slide'); return !s || s.classList.contains('active') }

export function Lazy3D(props) {
  const box = useRef(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const slide = box.current?.closest('.slide')
    const check = () => setOn(activeSlide(box.current))
    check()
    if (!slide) return
    const mo = new MutationObserver(check)
    mo.observe(slide, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])
  const hold = <div className={`i3d ${props.className ?? ''}`} style={{ aspectRatio: props.ratio ?? 1 }}><div className="i3d-msg">Cargando el modelo 3D…</div></div>
  return (
    <div ref={box} className="i3d-wrap">
      {on ? <Suspense fallback={hold}><Instrument3D {...props} /></Suspense> : hold}
    </div>
  )
}
