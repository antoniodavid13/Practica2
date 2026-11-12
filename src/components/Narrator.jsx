import { useEffect, useRef, useState } from 'react'
import { asset } from '../lib/asset'

// Audios ya comprobados: url → existe o no. Así cada archivo se consulta una sola vez.
const known = new Map()

/* Botón «Escuchar»: lee en voz alta la diapositiva actual con su audio de public/audio/<name>.mp3
   (generado en ElevenLabs a partir de guiones-voz/<name>.txt). Solo suena al pulsarlo.
   App lo monta con key = diapositiva, así que al cambiar de diapositiva el audio se para.
   Si el archivo aún no existe, el botón no aparece. */
export function Narrator({ name }) {
  const url = asset(`audio/${name}.mp3`)
  const audio = useRef(null)
  const [ok, setOk] = useState(() => known.get(url) ?? null)
  const [playing, setPlaying] = useState(false)
  const [prog, setProg] = useState(0)

  useEffect(() => {
    if (known.has(url)) return
    let live = true
    // HEAD + tipo de contenido: en desarrollo, un archivo que no existe devuelve index.html con 200
    fetch(url, { method: 'HEAD' })
      .then((r) => r.ok && (r.headers.get('content-type') || '').startsWith('audio'))
      .catch(() => false)
      .then((v) => { known.set(url, v); if (live) setOk(v) })
    return () => { live = false }
  }, [url])

  useEffect(() => () => audio.current?.pause(), [])

  if (!ok) return null
  const toggle = () => {
    const a = audio.current
    if (a.paused) a.play().catch(() => setPlaying(false))
    else a.pause()
  }
  return (
    <>
      <button type="button" className={`btn narr${playing ? ' on' : ''}`} onClick={toggle} style={{ '--p': prog }}
        aria-label={playing ? 'Pausar la narración' : 'Escuchar esta diapositiva'} aria-pressed={playing}>
        {playing ? (
          <span className="narr-eq" aria-hidden="true"><i /><i /><i /></span>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /></svg>
        )}
        <span className="lbl">{playing ? 'Pausar' : 'Escuchar'}</span>
      </button>
      <audio ref={audio} src={url} preload="none"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProg(0) }}
        onTimeUpdate={(e) => setProg(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)} />
    </>
  )
}
