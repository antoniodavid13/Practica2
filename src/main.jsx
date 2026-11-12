import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lab.css'
import './instruments3d.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Solo en la versión compilada: en desarrollo el service worker guardaría módulos que cambian sin parar
if (import.meta.env.PROD && 'serviceWorker' in navigator)
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}))
