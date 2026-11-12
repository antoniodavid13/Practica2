import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { asset } from '../lib/asset'

/* ================= Visor 3D de un instrumento modelado en Blender =================
   Los modelos salen de blender/instrumentos.py (labvideos.blend) y se exportan a public/models/.
   Unidades del modelo: metros. Ejes: x a la derecha, y arriba, z hacia quien mira.

   Props:
   - url, label: archivo .glb y descripción para lectores de pantalla.
   - hot(name, p): clave interactiva de una pieza, o null. Se prueba con la pieza y con sus padres.
     p: punto pulsado en milímetros del modelo.
   - turn(key): true si la pieza gira al arrastrarla (mandos, selector).
   - onPick(key, p): clic o toque sin arrastrar.
   - onTurn(key, deltaDeg, totalDeg, phase): giro al arrastrar, en grados, positivo en sentido horario.
   La rueda del ratón no gira piezas: desplaza la página, para no cambiar un mando sin querer.
   - setup(ctx): una vez cargado el modelo. Devuelve lo que necesite apply (pantallas, cables…).
   - apply(ctx): tras cada render de React, para reflejar el estado en el modelo.
   - tip(key, p): texto de ayuda sobre la pieza señalada.
   ctx = { THREE, root, nodes, extra, ease(obj, prop, axis, value, wrap), invalidate() } */

const cache = new Map()
function loadModel(url) {
  if (!cache.has(url)) cache.set(url, new GLTFLoader().loadAsync(url).catch((e) => { cache.delete(url); throw e }))
  return cache.get(url)
}

const coarse = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export function Instrument3D({ url, label, ratio = 1, hot, turn, onPick, onTurn, setup, apply, tip, className = '' }) {
  const box = useRef(null)
  const cb = useRef({})
  const api = useRef(null)
  const [status, setStatus] = useState('loading')
  const [hint, setHint] = useState(null)
  const [orbit, setOrbit] = useState(() => !coarse())

  // Las funciones más recientes, para los manejadores registrados una sola vez
  useEffect(() => {
    cb.current = { hot, turn, onPick, onTurn, setup, apply, tip }
    api.current?.applyNow()
  })

  useEffect(() => { api.current?.setOrbit(orbit) }, [orbit])

  useEffect(() => {
    const el = box.current
    let disposed = false
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 0.95
    const canvas = renderer.domElement
    canvas.className = 'i3d-canvas'
    el.prepend(canvas)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTex
    scene.environmentIntensity = 0.5
    const sun = new THREE.DirectionalLight(0xffffff, 1.1)
    sun.position.set(-0.6, 1, 1.2)
    scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.35))

    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 10)
    const controls = new OrbitControls(camera, canvas)
    Object.assign(controls, {
      enableDamping: true, dampingFactor: 0.12, enablePan: false, enableZoom: false, rotateSpeed: 0.6,
      minAzimuthAngle: -0.85, maxAzimuthAngle: 0.85, minPolarAngle: Math.PI / 2 - 0.65, maxPolarAngle: Math.PI / 2 + 0.3,
    })

    let root = null, nodes = {}, extra = null, fit = null, dirty = true
    const tweens = new Map()
    const ctx = {
      THREE,
      get root() { return root },
      get nodes() { return nodes },
      get extra() { return extra },
      invalidate: () => { dirty = true },
      // Lleva suavemente obj[prop][axis] hacia value. wrap: el giro va por el camino más corto
      ease(obj, prop, axis, value, wrap = false) {
        if (!obj) return
        let v = value
        if (wrap) {
          const cur = obj[prop][axis], T = Math.PI * 2
          v = cur + ((((value - cur) % T) + T + Math.PI) % T) - Math.PI
        }
        tweens.set(`${obj.uuid}:${prop}:${axis}`, { obj, prop, axis, v })
        dirty = true
      },
    }

    function frame() {
      if (!root) return
      const b = new THREE.Box3().setFromObject(root)
      const size = b.getSize(new THREE.Vector3()), center = b.getCenter(new THREE.Vector3())
      fit = { size, center }
      if (import.meta.env.DEV) window.__i3d = { ...window.__i3d, [url]: { camera, controls, fit, root } }
      resize()
      controls.target.copy(center)
      controls.saveState()
    }
    function placeCamera() {
      if (!fit) return
      const { size, center } = fit
      const t = Math.tan((camera.fov * Math.PI) / 360)
      const dist = Math.max(size.y / 2 / t, size.x / 2 / (t * camera.aspect)) * 1.1 + size.z / 2
      const dir = camera.position.clone().sub(controls.target)
      if (dir.lengthSq() < 1e-9 || !placeCamera.done) dir.set(0, 0.1, 1)
      camera.position.copy(center).add(dir.normalize().multiplyScalar(dist))
      camera.lookAt(center)
      placeCamera.done = true
    }
    function resize() {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      placeCamera()
      dirty = true
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    function loop() {
      const moved = controls.update()
      let easing = false
      for (const [k, t] of tweens) {
        const cur = t.obj[t.prop][t.axis], d = t.v - cur
        if (Math.abs(d) < 1e-4) { t.obj[t.prop][t.axis] = t.v; tweens.delete(k) } else { t.obj[t.prop][t.axis] = cur + d * 0.28; easing = true }
      }
      if (moved || easing || dirty) { renderer.render(scene, camera); dirty = false }
    }

    /* ---------- Punteros ---------- */
    const orbitRef = { on: true }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
    function hit(e) {
      if (!root) return null
      const r = canvas.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const h = ray.intersectObject(root, true)[0]
      if (!h) return null
      const p = root.worldToLocal(h.point.clone()).multiplyScalar(1000)
      let o = h.object, key = null, obj = null
      while (o && o !== scene) {
        key = cb.current.hot?.(o.name, p) ?? null
        if (key) { obj = o; break }
        o = o.parent
      }
      return { key, obj, p }
    }
    let drag = null
    const angleAt = (e, c) => (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI
    function screenOf(obj) {
      const v = obj.getWorldPosition(new THREE.Vector3()).project(camera), r = canvas.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }
    function down(e) {
      const h = hit(e)
      drag = { x: e.clientX, y: e.clientY, h, moved: false }
      if (h?.key) {
        e.preventDefault() // sin selección de texto ni desplazamiento mientras se gira una pieza
        controls.enabled = false
        canvas.setPointerCapture?.(e.pointerId)
        if (cb.current.turn?.(h.key)) {
          const c = screenOf(h.obj)
          drag.turn = { c, last: angleAt(e, c), total: 0 }
          cb.current.onTurn?.(h.key, 0, 0, 'start')
        }
      }
    }
    function move(e) {
      if (!drag) {
        if (e.pointerType !== 'mouse') return
        const h = hit(e)
        canvas.style.cursor = h?.key ? (cb.current.turn?.(h.key) ? 'grab' : 'pointer') : orbitRef.on ? 'move' : 'default'
        const t = h?.key ? cb.current.tip?.(h.key, h.p) : null
        setHint((old) => (old === t ? old : t))
        return
      }
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true
      const tr = drag.turn
      if (tr) {
        canvas.style.cursor = 'grabbing'
        const a = angleAt(e, tr.c)
        const d = ((a - tr.last + 540) % 360) - 180
        tr.last = a
        tr.total += d
        cb.current.onTurn?.(drag.h.key, d, tr.total, 'move')
      }
    }
    function up(e) {
      if (!drag) return
      const d = drag
      drag = null
      controls.enabled = orbitRef.on
      if (!d.moved && !(d.turn && Math.abs(d.turn.total) > 3)) {
        const h = hit(e) ?? d.h
        if (h) cb.current.onPick?.(h.key, h.p)
      }
    }
    function cancel() { drag = null; controls.enabled = orbitRef.on }
    function leave() { setHint(null) }
    canvas.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    canvas.addEventListener('pointerleave', leave)

    function setOrbit(on) {
      orbitRef.on = on
      controls.enabled = on
      // Sin giro de vista, el dedo desplaza la página por encima del aparato
      canvas.style.touchAction = on ? 'none' : 'pan-y'
    }

    api.current = {
      setOrbit,
      applyNow() { if (root) { cb.current.apply?.(ctx); dirty = true } },
      reset() { controls.reset(); placeCamera.done = false; placeCamera(); dirty = true },
    }
    setOrbit(!coarse())

    loadModel(asset(url)).then((gltf) => {
      if (disposed) return
      root = gltf.scene.clone(true)
      root.traverse((o) => { if (o.name) nodes[o.name] = o })
      scene.add(root)
      root.updateMatrixWorld(true)
      frame()
      extra = cb.current.setup?.(ctx) ?? null
      cb.current.apply?.(ctx)
      setStatus('ready')
      renderer.setAnimationLoop(loop)
    }).catch(() => { if (!disposed) setStatus('error') })

    return () => {
      disposed = true
      api.current = null
      renderer.setAnimationLoop(null)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('pointerleave', leave)
      controls.dispose()
      extra?.dispose?.()
      envTex.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [url])

  return (
    <div className={`i3d ${className}`} style={{ aspectRatio: ratio }} ref={box} role="img" aria-label={label}>
      {status === 'loading' && <div className="i3d-msg">Cargando el modelo 3D…</div>}
      {status === 'error' && <div className="i3d-msg">No se ha podido cargar el modelo 3D.</div>}
      {hint && <div className="i3d-tip" aria-hidden="true">{hint}</div>}
      <div className="i3d-tools">
        <button type="button" className={`i3d-btn${orbit ? ' on' : ''}`} aria-pressed={orbit} onClick={() => setOrbit((o) => !o)}
          title={orbit ? 'Arrastrar el fondo gira la vista' : 'Activa para girar la vista arrastrando'}>
          <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>
          <span>Girar vista</span>
        </button>
        <button type="button" className="i3d-btn" onClick={() => api.current?.reset()} title="Volver a la vista de frente">
          <svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
          <span>De frente</span>
        </button>
      </div>
    </div>
  )
}

export default Instrument3D
