# Medidas en corriente continua — Contexto del programa

Presentación interactiva de la Práctica 2 de Análisis de Circuitos I. Cubre la sección 2.5 del guion, con sus 21 actividades en orden y 33 diapositivas.

La documentación completa está en la bóveda LabVideos: `06 Prácticas/Práctica 2/Práctica 2 - Ficha.md` tiene los datos, los cálculos y las decisiones.

## Fuente

`docs/arpractica2.pdf`. Es material del departamento: nunca va en `public/`.

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
