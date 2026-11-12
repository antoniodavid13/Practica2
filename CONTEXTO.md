# Medidas en corriente continua — Contexto del programa

Presentación interactiva de la Práctica 2 de Análisis de Circuitos I. Cubre la sección 2.5 del guion, con sus 21 actividades en orden y 33 diapositivas.

La documentación completa está en la bóveda LabVideos: `06 Prácticas/Práctica 2/Práctica 2 - Ficha.md` tiene los datos, los cálculos y las decisiones.

## Fuente

`docs/arpractica2.pdf`. Es material del departamento: nunca va en `public/`.

`docs/2003-Spanish.pdf`: catálogo Promax de 2003, de donde sale la precisión del PD-695. Tampoco va en `public/`.

## Bloques

| Bloque | Color | Contenido | Tablas |
|---|---|---|---|
| I | Violeta | Selección de tensiones de la fuente | 2.3 |
| II | Verde azulado | Corrientes de ramas, Figura 2.5, Eg = 25 V | 2.4 y 2.5 |
| III | Naranja | Divisor de corriente, Figuras 2.6 y 2.7, Eg = 36 V | 2.6 |

## Qué añade a la Práctica 1

| Archivo | Función |
|---|---|
| `src/lib/sim.js` | Análisis nodal con fuente, amperímetro en serie y LED ideal |
| `src/lib/practice.js` | Fuente, teóricos, intervalos, tablas y detección de la rama medida |
| `src/lib/meter.js` | `reading()`: tensión y corriente continuas, con signo |
| `src/components/Supply.jsx` | Fuente FAC-662B, con sus mandos y comprobación |
| `src/components/Bench.jsx` | Cables, pinzas, LEDs, mover una pata, lecturas anotadas y predicciones |
| `src/components/Widgets.jsx` | `ResultTable`: una tabla genérica para las Tablas 2.3 a 2.6 |

## Decisiones

- **Multímetro:** PD-695 en todas las medidas, también donde el guion cita el PD-181 o el Keysight. Las notas de las diapositivas lo aclaran.
- **LED ideal:** sin caída de tensión. En el cálculo es un tramo de 1 mΩ.
- **Intervalos:** con cada resistencia en sus extremos, no «teórico ± 5 %», que no vale para corrientes de rama.
- **R₆:** una sola pieza `r6`; su campo `as` dice qué resistencia física hace de R₆ (`r3b` o `r5`).
- **Fuente:** lo que entrega difiere un poco de lo que marca su voltímetro (`OFFSET` y `FIVE` en `practice.js`). Son valores propuestos.
- **Incertidumbre:** ±(0,5 % de la lectura + 1 dígito), la «precisión básica» del PD-695 en el catálogo Promax de 2003 (`docs/2003-Spanish.pdf`). El catálogo no da cifras por función: se usa en tensión, corriente y resistencia. Se expresa con una cifra significativa (dos si empieza por 1) y sin más decimales que la pantalla (`ACCURACY`, `uncertainty()` y `express()` en `meter.js`). La ley de corrientes se cumple si la diferencia cabe en la suma de las incertidumbres de las lecturas.
- **Errores con consecuencias:** la fuente limita a 1 A y su tensión cae (`analyze` en `sim.js`). El fusible del borne mA se funde por encima de 400 mA (`FUSE_MA`) un LED se estropea con más de 5 V en inversa (`LED_VR`) y una resistencia se quema si disipa más de ½ W (`P_MAX`), y queda abierta. Las tres cifras son propuestas. `settle()` en `practice.js` aplica estos cambios tras cada acción. Un amperímetro en paralelo con una resistencia se detecta con `parallelTo()`.

## Pendiente

- Fotos de 10 kΩ, 100 kΩ y LED. Sin ellas, la cuarta banda de R₄ y R₆ es provisional.
- Vídeos de ejemplo: no hay ningún `VideoBtn`.
- Guiones de voz y audios: cada diapositiva ya indica su `audio`; sin el archivo, el botón Escuchar no aparece.

## Comandos

```
npm run dev       Servidor de desarrollo
npm run lint      ESLint
npm run build     Compilación a dist/
npm run preview   Sirve dist/
```
