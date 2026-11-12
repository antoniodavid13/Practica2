import { amp, at } from './lib/circuit'
import { TEO25, TEO26, interval } from './lib/practice'
import { SchCircuit, SchDivider } from './components/Schematics'
import { Parts, ResultTable, Tol } from './components/Widgets'
import {
  Bench, BenchMeter, BenchReadout, CurrentLog, FivePredict, KclCheck, LedPredict, LedRows, R6Swap, ResistorMeter, TerminalMeter,
} from './components/Bench'
import { Supply, SupplyLine } from './components/Supply'
import { Guide } from './components/Guide'
import { G } from './lib/guides'
import { ActTrack, Enun, Eyebrow, Fig, Ii, Legend, OrigEnun, Photo, PrevNote, Quiz, Ri, Steps } from './components/Ui'

const BUILD2 = ['r1', 'r2', 'r3', 'r4', 'r5', 'wire', 'erase']
const CONNECT = ['src+', 'src-', 'move', 'wire', 'erase']
const MEASURE = ['red', 'black', 'move', 'wire', 'src+', 'src-', 'erase']
const BUILD3 = ['r3', 'r6', 'src+', 'src-', 'wire', 'erase']
const LEDS = ['r3', 'r6', 'led1', 'led2', 'move', 'wire', 'src+', 'src-', 'erase']

const ORIG = {
  I: ['Enunciado-Bloque1.png'],
  II: ['Enunciado-Bloque2-a.png', 'Enunciado-Bloque2-b.png', 'Enunciado-Bloque2-c.png'],
  III: ['Enunciado-Bloque3-a.png', 'Enunciado-Bloque3-b.png', 'Enunciado-Bloque3-c.png'],
}
const TERMS_I = [{ k: '7-8', term: '7-8', label: '7-8 S₁' }, { k: '13-14', term: '13-14', label: '13-14 S₂' }, { k: '10-11', term: '10-11', label: '10-11' }]
const TERMS_III = [{ k: 'VS1', term: '7-8', label: 'VS₁' }, { k: 'VS2', term: '13-14', label: 'VS₂' }]
const CUR_II = ['IR1', 'IR2', 'IR3', 'IR4', 'IR5']
const CUR_III = ['Ig', 'IR3', 'IR6']

const AMP_NOTE = <p className="note" style={{ marginTop: 10 }}>Para medir corriente: selector en <b>A⎓</b>, cable rojo en <b>mA</b> y puntas cerrando la rama abierta. La punta roja va en el lado más cercano al positivo de la fuente.</p>

// Portada de un bloque: separa claramente sus actividades de las de los otros
const cover = ({ m, fig, figN, figAlt, block, lead, acts, parts }) => () => (
  <div className="wrap mcover">
    <div className="copy">
      <Eyebrow>Bloque {block} de 3 · Figura {figN}</Eyebrow>
      <h1><span className="mcover-pill">Bloque {m}</span></h1>
      <p className="lead">{lead}</p>
      <ol className="mcover-acts">{acts.map((a, i) => <li key={i}><span className="act-n">{i + 1}</span><span>{a}</span></li>)}</ol>
      {parts && <div className="chips">{parts.map(([k, t]) => <span key={t} className="chip" style={{ '--c': `var(--${k})` }}><i />{t}</span>)}</div>}
    </div>
    <div className="vis"><Fig src={fig} alt={figAlt} /></div>
  </div>
)

// Actividad con una pregunta abierta: enunciado y explicación por pasos
const SIGN = [
  { t: 'Marca 0', ok: false, fb: 'La corriente sigue pasando por el amperímetro: lo que cambia es por dónde entra.' },
  { t: 'Se estropea', ok: false, fb: 'Con estas corrientes no le pasa nada: solo indica el sentido al revés.' },
  { t: 'Marca el mismo valor con signo negativo', ok: true, fb: 'El multímetro sigue el convenio pasivo: el signo dice por qué punta entra la corriente.' },
  { t: 'Marca OL', ok: false, fb: 'OL aparece cuando el valor supera el fondo, no por el sentido de la corriente.' },
]

/* Cada diapositiva: título corto, número de pasos y contenido (recibe el paso actual).
   `audio`: nombre de su narración, public/audio/<audio>.mp3; sin el archivo, el botón Escuchar no aparece.
   `group` ('I', 'II' o 'III') marca las diapositivas de cada bloque: color propio y barra de progreso agrupada. */
export const SLIDES = [
  {
    title: 'Portada', audio: '01-portada', steps: 0,
    body: () => (
      <div className="wrap">
        <div className="copy">
          <Eyebrow>Laboratorio de Análisis de Circuitos I · Práctica 2</Eyebrow>
          <h1>Medidas en corriente continua</h1>
          <p className="lead">Las actividades de la sección 2.5 del guion, en su orden: ajusta la fuente de alimentación, mide las corrientes de cada rama y comprueba cómo se reparte la corriente en un divisor.</p>
          <div className="chips">
            {[['r1', 'R₁ 1,5 kΩ'], ['r2', 'R₂ 2,2 kΩ'], ['r3', 'R₃ 3,3 kΩ'], ['r4', 'R₄ 10 kΩ'], ['r5', 'R₅ 2,2 MΩ'], ['r6', 'R₆ 100 kΩ']].map(([k, t]) => (
              <span key={k} className="chip" style={{ '--c': `var(--${k})` }}><i />{t}</span>
            ))}
          </div>
          <div className="hint">Avanza con <kbd>→</kbd> o <kbd>espacio</kbd>, retrocede con <kbd>←</kbd></div>
        </div>
        <div className="vis">
          <div className="panel">
            <div className="duo">
              <figure><SchCircuit flow /><figcaption className="grp-II"><b>Corrientes de ramas</b><span>Figura 2.5 · Eg = 25 V</span></figcaption></figure>
              <figure><SchDivider flow /><figcaption className="grp-III"><b>Divisor de corriente</b><span>Figura 2.6 · Eg = 36 V</span></figcaption></figure>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Introducción', audio: '02-introduccion', steps: 5,
    body: (step) => (
      <div className="wrap">
        <div className="copy">
          <Eyebrow>Introducción</Eyebrow>
          <h2>Práctica 2: Medidas de magnitudes básicas en corriente continua I</h2>
          <p>Hasta ahora has medido resistencias sin alimentar el circuito. En esta práctica entra la <b>fuente de alimentación</b> y aprendes a medir <b>corrientes</b>.</p>
          <p className="note" style={{ marginTop: 16 }}>Qué vas a aprender:</p>
          <Steps step={step} items={[
            ['1', <>Ajustar la <b>fuente</b> en modo independiente y en modo serie.</>],
            ['2', <>Conectar el <b>amperímetro en serie</b>, abriendo la rama que quieres medir.</>],
            ['3', <>Interpretar el <b>signo</b> de la medida y elegir el mejor fondo.</>],
            ['4', <>Comprobar la <b>ley de corrientes de Kirchhoff</b> con tus medidas.</>],
            ['5', <>Explicar cómo se reparte la corriente en un <b>divisor de corriente</b>.</>],
          ]} />
        </div>
        <div className="vis">
          <div className="plan">
            <div className="plan-card grp-I">
              <div className="plan-head"><b>Bloque I</b><span>Selección de tensiones</span></div>
              <ol><li><span>Ajustar S₁ y S₂</span></li><li><span>Medir las salidas: Tabla 2.3</span></li><li><span>Comparar y razonar</span></li></ol>
            </div>
            <div className="plan-card grp-II">
              <div className="plan-head"><b>Bloque II</b><span>Corrientes de ramas · Figura 2.5</span></div>
              <ol><li><span>Identificar y montar: Tabla 2.4</span></li><li><span>Conectar y medir: Tabla 2.5</span></li><li><span>Ley de corrientes</span></li></ol>
            </div>
            <div className="plan-card grp-III">
              <div className="plan-head"><b>Bloque III</b><span>Divisor de corriente · Figura 2.6</span></div>
              <ol><li><span>Modo serie y medir: Tabla 2.6</span></li><li><span>Añadir LEDs y cambiar R₆</span></li><li><span>Por qué se llama divisor</span></li></ol>
            </div>
            <div className="plan-ra">
              <span className="chip">RA01 · unidades y cifras significativas</span>
              <span className="chip">RA11 · fuente, montaje y medidas</span>
            </div>
            <PrevNote>Trae resueltos los ejercicios 1 y 2: son los valores teóricos de las Tablas 2.5 y 2.6.</PrevNote>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Los componentes', audio: '03-componentes', steps: 0,
    body: () => (
      <div className="wrap">
        <div className="copy">
          <Eyebrow>Material · Sección 2.5</Eyebrow>
          <h2>Seis valores de resistencia y dos LEDs</h2>
          <p>Necesitas dos resistencias de 3,3 kΩ: la segunda hace de R₆ cuando R₆ = R₃.</p>
          <p>R₁ a R₅ forman el circuito de la Figura 2.5. R₃ y R₆ forman el divisor.</p>
          <p className="note"><b>Ojo con los nombres:</b> no son los de la Práctica 1. Aquí R₃ vale 3,3 kΩ.</p>
          <p className="note"><b>En el simulador</b> cada resistencia tiene un valor real dentro de su tolerancia: la medida no coincidirá exactamente con el teórico.</p>
        </div>
        <div className="vis"><Parts /></div>
      </div>
    ),
  },
  {
    title: 'El multímetro', audio: '04-multimetro', steps: 4,
    body: (step) => (
      <div className="wrap">
        <div className="copy">
          <Eyebrow>Material · Promax PD-695</Eyebrow>
          <h2>Medir tensión y corriente</h2>
          <p>Es el mismo multímetro de la Práctica 1, ahora con el circuito alimentado.</p>
          <Steps step={step} items={[
            ['1', <><b>Tensión.</b> Selector en <b>V⎓</b>, cable rojo en <b>VΩHz</b>. Las puntas se apoyan en paralelo.</>],
            ['2', <><b>Corriente.</b> Selector en <b>A⎓</b>, cable rojo en <b>20 A</b> o en <b>mA</b>. Va siempre <b>en serie</b>.</>],
            ['3', <><b>Empieza por 20 A.</b> Si la medida es pequeña, pasa el cable a mA y elige un fondo menor.</>],
            ['4', <><b>Signo.</b> Lee la corriente que entra por la punta roja y sale por la negra.</>],
          ]} />
          <p className="note" style={{ marginTop: 16 }}>El guion cita el <b>Promax PD-181</b> y el <b>Keysight U1232A</b>. Aquí todas las medidas se hacen con el <b>PD-695</b>, que tiene zonas separadas para continua y alterna y bornes 20 A y mA.</p>
        </div>
        <div className="vis"><div className="panel photo-panel"><Photo src="Voltimetro.jpeg" alt="Multímetro Promax PD-695 del laboratorio" /></div></div>
      </div>
    ),
  },
  {
    title: 'La fuente', audio: '05-fuente', steps: 3,
    body: (step) => (
      <div className="wrap">
        <div className="copy">
          <Eyebrow>Material · Promax FAC-662B</Eyebrow>
          <h2>Tres fuentes en una</h2>
          <Steps step={step} items={[
            ['1', <><b>S₁ y S₂.</b> Dos fuentes iguales, de 0 a 30 V y hasta 1 A, con mando grueso y mando fino.</>],
            ['2', <><b>Salida fija.</b> Entre los terminales 10 y 11 hay siempre 5 V.</>],
            ['3', <><b>Modos.</b> Independiente: cada una por separado. Serie: entre el + de S₁ y el − de S₂ hay V₁ + V₂, hasta 60 V.</>],
          ]} />
        </div>
        <div className="vis">
          <div className="panel"><Fig src="Figura-2.1-Fuente.png" alt="Figura 2.1: fuente Promax FAC-662B con sus mandos numerados" /></div>
        </div>
      </div>
    ),
  },

  /* ---------------- Bloque I ---------------- */
  {
    group: 'I', title: 'Bloque I', audio: '06-bloque1', steps: 0,
    body: cover({
      m: 'I', fig: 'Figura-2.2-Modos.png', figN: '2.2', block: 1, figAlt: 'Figura 2.2: modos de funcionamiento de la fuente',
      lead: <>Selección de tensiones de salida: ajustas la fuente y compruebas con el multímetro lo que entrega cada salida.</>,
      acts: [<>Ajustar 6 V en S₁ y 9 V en S₂.</>, <>Medir las tres salidas y rellenar la Tabla 2.3.</>, <>Comparar fuente y multímetro.</>, <>Razonar qué pasa en los terminales 10 y 11.</>],
    }),
  },
  {
    group: 'I', title: 'Bloque I · 1 Ajustar', audio: '07-b1-ajustar', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="I" n={1} />
          <h2>Ajusta la fuente</h2>
          <Enun n="1">Encender y ajustar la fuente de alimentación en modo independiente para que se obtengan dos fuentes de tensión separadas de 6 V (S₁) y 9 V (S₂). Tener en cuenta que existe un mando de ajuste «grueso» (4 para S₁ y 17 para S₂), que producirá grandes variaciones de tensión y un mando de ajuste «fino» (5 para S₁ y 16 para S₂) que producirá variaciones pequeñas.</Enun>
          <OrigEnun files={ORIG.I} block="I" />
          <Guide guide={G.f69} />
        </div>
        <div className="vis"><Supply /></div>
      </div>
    ),
  },
  {
    group: 'I', title: 'Bloque I · 2 Medir', audio: '08-b1-medir', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="I" n={2} />
          <h2>Mide las salidas</h2>
          <Enun n="2">Medir con el multímetro Keysight U1232A la tensión proporcionada entre los terminales 7 y 8, entre los terminales 13 y 14, y entre los terminales 10 y 11. Rellenar la Tabla 2.3. En todos los casos elegir el mejor fondo de escala, escribir todas las cifras que aparecen en pantalla e indicar las unidades.</Enun>
          <Guide guide={G.outputs} />
          <TerminalMeter id="m1" rows={TERMS_I} />
        </div>
        <div className="vis">
          <SupplyLine />
          <ResultTable id="t23" />
          <p className="note" style={{ marginTop: 10 }}>En el simulador mides con el PD-695. Elige una salida, busca el mejor fondo y pulsa <b>Anotar</b>. En la tabla, <b>Copiar lectura</b> la trae con todas sus cifras.</p>
        </div>
      </div>
    ),
  },
  {
    group: 'I', title: 'Bloque I · 3 ¿Coinciden?', audio: '09-b1-coinciden', steps: 2,
    body: (step) => (
      <div className="wrap">
        <div className="copy">
          <ActTrack m="I" n={3} />
          <h2>Fuente frente a multímetro</h2>
          <Enun n="3">¿Coinciden las lecturas del voltímetro interno de la fuente con las del multímetro?</Enun>
          <p className="note">Mira tu Tabla 2.3 antes de avanzar.</p>
          <Steps step={step} items={[
            ['1', <><b>Casi, pero no del todo.</b> La fuente marca una cifra decimal y el multímetro, dos.</>],
            ['2', <><b>Fíate del multímetro.</b> Tiene mejor resolución y mide lo que llega de verdad a los bornes. El voltímetro de la fuente sirve de orientación.</>],
          ]} />
        </div>
        <div className="vis"><ResultTable id="t23" /></div>
      </div>
    ),
  },
  {
    group: 'I', title: 'Bloque I · 4 Salida de 5 V', audio: '10-b1-cinco', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="I" n={4} />
          <h2>¿Y los terminales 10 y 11?</h2>
          <Enun n="4">¿Varía la tensión entre los terminales 10 y 11 al variar los mandos de tensión de las fuentes S₁ o S₂? Razonar por qué.</Enun>
          <Guide guide={G.five} />
          <FivePredict />
          <div style={{ marginTop: 12 }}><TerminalMeter id="m1" rows={TERMS_I} /></div>
        </div>
        <div className="vis"><Supply /></div>
      </div>
    ),
  },

  /* ---------------- Bloque II ---------------- */
  {
    group: 'II', title: 'Bloque II', audio: '11-bloque2', steps: 0,
    body: cover({
      m: 'II', fig: 'Figura-2.5-Circuito.png', figN: '2.5', block: 2, figAlt: 'Figura 2.5: circuito bajo estudio, con Eg de 25 V',
      lead: <>Medidas de corrientes de ramas: montas el circuito de la Figura 2.5, mides la corriente de cada resistencia y compruebas la ley de corrientes.</>,
      acts: [<>Identificar las resistencias: Tabla 2.4.</>, <>Nombrar los nodos.</>, <>Montar las resistencias.</>, <>Fijar la tensión en vacío.</>, <>Conectar la fuente.</>, <>Preparar el multímetro.</>, <>Medir abriendo cada rama.</>, <>Rellenar la Tabla 2.5.</>, <>Comprobar la ley de corrientes.</>],
      parts: [['r1', 'R₁'], ['r2', 'R₂'], ['r3', 'R₃'], ['r4', 'R₄'], ['r5', 'R₅']],
    }),
  },
  {
    group: 'II', title: 'Bloque II · 1 Identificar', audio: '12-b2-identificar', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="II" n={1} />
          <h2>Identifica las resistencias</h2>
          <Enun n="1">Identificar todos los componentes pasivos del circuito según el código de colores, en este caso las resistencias R₁, R₂, R₃, R₄ y R₅. Comprobar que sus valores sean correctos midiéndolos con el multímetro, en este caso se utilice el Keysight. Rellene la Tabla 2.4.</Enun>
          <OrigEnun files={ORIG.II} block="II" />
          <Guide guide={G.res} />
          <ResistorMeter id="m2" />
        </div>
        <div className="vis">
          <ResultTable id="t24" />
          <p className="note" style={{ marginTop: 10 }}>En el simulador mides con el PD-695: selector en <b>Ω</b> y cable rojo en <b>VΩHz</b>.</p>
        </div>
      </div>
    ),
  },
  {
    group: 'II', title: 'Bloque II · 2 Nodos', audio: '13-b2-nodos', steps: 4,
    body: (step) => (
      <div className="wrap">
        <div className="copy">
          <ActTrack m="II" n={2} />
          <h2>Busca los nodos</h2>
          <Enun n="2">Identifique en la figura del circuito los nodos, incluso dales nombre asignándoles una letra, y elegir el mismo número de nodos en la placa de pruebas, intentando distribuirlos de forma similar al circuito de la figura. De esta forma, resultará más fácil saber cómo conectar cada componente y detectar posibles fallos. Sólo hay que conectar cada elemento a sus nodos correspondientes.</Enun>
          <Steps step={step} items={[
            ['A', <><b>Nodo A.</b> El positivo de la fuente y R₁.</>],
            ['B', <><b>Nodo B.</b> R₁, R₂ y R₃.</>],
            ['C', <><b>Nodo C.</b> R₂, R₃, R₄ y R₅.</>],
            ['D', <><b>Nodo D.</b> R₄, R₅ y el negativo de la fuente.</>],
          ]} />
        </div>
        <div className="vis"><div className="panel">
          <SchCircuit step={step} hl={[{ only: [1], d: 'M50 60 H90' }, { only: [2], d: 'M250 60 H370' }, { only: [3], d: 'M270 190 H370 M270 190 V280' }, { only: [4], d: 'M50 190 V280' }]} />
          <div className="panel-cap"><span>Cuatro nodos: cuatro grupos de agujeros en la placa</span><Legend items={[['r1', 'R₁'], ['r2', 'R₂'], ['r3', 'R₃'], ['r4', 'R₄'], ['r5', 'R₅']]} /></div>
        </div></div>
      </div>
    ),
  },
  {
    group: 'II', title: 'Bloque II · 3 Montar', audio: '14-b2-montar', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="II" n={3} />
          <h2>Monta las resistencias</h2>
          <Enun n="3">Comenzar montando sobre la placa de pruebas los componentes pasivos del circuito, en este caso las resistencias R₁, R₂, R₃, R₄ y R₅ (no encender la fuente hasta el final). Intentar que la disposición de los elementos sea todo lo parecida posible al dibujo de la Figura 2.5 empezando por la izquierda de la placa de pruebas. Dibujar el montaje realizado.</Enun>
          <Fig src="Figura-2.5-Circuito.png" alt="Figura 2.5: R1 en serie con R2 y R3 en paralelo, y con R4 y R5 en paralelo" />
          <Guide guide={G.build2} />
        </div>
        <div className="vis"><Bench id="m2" tools={BUILD2} target="II" /></div>
      </div>
    ),
  },
  {
    group: 'II', title: 'Bloque II · 4 Fijar tensión', audio: '15-b2-tension', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="II" n={4} />
          <h2>Fija la tensión en vacío</h2>
          <Enun n="4">Encender la fuente de alimentación y, en vacío (antes de conectarla al circuito), seleccionar los valores de tensión deseados. Usar el modo independiente.</Enun>
          <p className="note">La Figura 2.5 pide Eg = 25 V. Con S₁ basta: llega a 30 V.</p>
          <Guide guide={G.f25} />
        </div>
        <div className="vis"><Supply id="m2" /></div>
      </div>
    ),
  },
  {
    group: 'II', title: 'Bloque II · 5 Conectar', audio: '16-b2-conectar', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="II" n={5} />
          <h2>Conecta la fuente</h2>
          <Enun n="5">Conectar la fuente de alimentación al circuito, empleando los cables y pinzas de cocodrilo que sean necesarios. Conviene elegir el color de los cables respetando el convenio habitual (rojo para el positivo y negro para el negativo o tierra).</Enun>
          <p className="note">Pinza + en el nodo A y pinza − en el nodo D.</p>
          <Guide guide={G.connect2} />
        </div>
        <div className="vis"><Bench id="m2" tools={CONNECT} target="II" /></div>
      </div>
    ),
  },
  {
    group: 'II', title: 'Bloque II · 6 Preparar', audio: '17-b2-preparar', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="II" n={6} />
          <h2>Prepara el multímetro</h2>
          <Enun n="6">Preparar el multímetro para realizar las medidas necesarias. En este caso se medirá corriente (amperios, A) en corriente continua. Comprobar que la rueda del selector se encuentra dentro de la zona correspondiente a corrientes (A) y que el cable negro sale del terminal COM. En la parte izquierda de la pantalla del multímetro debe aparecer DC lo que significa que se van a realizar medidas de corriente continua (AC es para corriente alterna). Si no es así pulsar el botón AC/DC. En cuanto a la selección de escala, lo más prudente es comenzar seleccionando el fondo de 20 A, conectando el cable rojo en el terminal 20 A. Después, si la medida tomada resulta ser inferior a 2 A (2000 mA), se puede conectar el cable rojo al terminal µA mA y elegir un fondo de escala menor. De este modo no se pone en riesgo de sobrecarga al amperímetro.</Enun>
          <p className="note">En el PD-695 no hay botón AC/DC: continua y alterna son zonas distintas del selector. Su borne pequeño es <b>mA</b>, con fondos de 400 mA y 40 mA.</p>
        </div>
        <div className="vis">
          <BenchMeter id="m2" />
          <Guide guide={G.prep} />
        </div>
      </div>
    ),
  },
  {
    group: 'II', title: 'Bloque II · 7 Medir', audio: '18-b2-medir', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="II" n={7} />
          <h2>Abre cada rama y mide</h2>
          <BenchMeter id="m2" />
        </div>
        <div className="vis">
          <Enun n="7">Medida de corrientes. Es necesario abrir el circuito por cada una de las ramas alternativamente, y conectar el multímetro para volver a cerrar la rama que hemos abierto para medir la intensidad de su corriente al hacer que atraviese el amperímetro. Tener cuidado con que la corriente que se quiere medir entre por el positivo del amperímetro (poniendo el terminal positivo -rojo- en la parte más cercana al terminal positivo -rojo- de la fuente). ¿Qué pasa si la corriente que se quiere medir entra por el negativo del amperímetro?</Enun>
          <Guide guide={G.cur2} />
          <BenchReadout id="m2" />
          <Bench id="m2" tools={MEASURE} target="II" />
          <CurrentLog id="m2" keys={CUR_II} target="II" />
          {AMP_NOTE}
          <Quiz q="¿Qué pasa si la corriente que se quiere medir entra por el negativo del amperímetro?" options={SIGN} />
        </div>
      </div>
    ),
  },
  {
    group: 'II', title: 'Bloque II · 8 Teórico', audio: '19-b2-teorico', steps: 3,
    body: (step) => (
      <div className="wrap">
        <div className="copy">
          <ActTrack m="II" n={8} extra="Valor teórico" />
          <h2>Corrientes teóricas</h2>
          <div className="eqs">
            <div {...at(step, 1, 'eq frag')}><span><Ri n="eq" /> = <Ri n="1" /> + (<Ri n="2" /> ∥ <Ri n="3" />) + (<Ri n="4" /> ∥ <Ri n="5" />)</span><span className="res">≈ 12,775 kΩ</span></div>
            <div {...at(step, 2, 'eq frag')}><span><Ii n="g" /> = <Ii n="R1" /> = <i>E</i><sub>g</sub> / <Ri n="eq" /></span><span className="mute">= 25 / 12,775 kΩ</span><span className="res">≈ {amp(TEO25.IR1)}</span></div>
            <div {...at(step, 3, 'eq final frag')}><span>Reparto</span><span className="res">{amp(TEO25.IR2)} · {amp(TEO25.IR3)}</span><span className="mute">en R₂ y R₃</span><span className="res">{amp(TEO25.IR4)} · {amp(TEO25.IR5)}</span><span className="mute">en R₄ y R₅</span></div>
          </div>
          <div {...at(step, 3, 'frag')}><Tol min={interval.IR3[0]} nom={TEO25.IR3} max={interval.IR3[1]} fmt={amp} /></div>
          <p {...at(step, 3, 'note frag')}>La barra es la de <i>I</i><sub>R3</sub>: su intervalo es más ancho que ±5 %, porque el reparto depende del cociente entre resistencias.</p>
          <PrevNote>Estos valores son los del ejercicio 1 de las actividades previas (Tabla 2.1).</PrevNote>
        </div>
        <div className="vis"><div className="panel"><SchCircuit flow />
          <div className="panel-cap"><span>Casi toda la corriente evita R₅: es mucho mayor que R₄</span><Legend items={[['r2', '60 % por R₂'], ['r3', '40 % por R₃']]} /></div></div></div>
      </div>
    ),
  },
  {
    group: 'II', title: 'Bloque II · 8 Tabla 2.5', audio: '20-b2-tabla', steps: 0,
    body: () => (
      <div className="wrap single">
        <div className="copy">
          <ActTrack m="II" n={8} />
          <h2>Tabla 2.5</h2>
          <Enun n="8">Rellenar la Tabla 2.5 con las medidas y los valores teóricos esperados calculados en las actividades previas. En todos los casos elegir el mejor fondo de escala, escribir todas las cifras que aparecen en pantalla e indicar las unidades.</Enun>
          <Guide guide={G.t25} />
          <ResultTable id="t25" />
          <p className="note" style={{ marginTop: 14 }}><b>IR₅ apenas se puede medir:</b> vale unos 8,9 µA y, en el fondo de 40 mA, la resolución es 0,01 mA. La pantalla marca una sola cuenta: es lo máximo que da este fondo.</p>
        </div>
      </div>
    ),
  },
  {
    group: 'II', title: 'Bloque II · 9 Kirchhoff', audio: '21-b2-kirchhoff', steps: 2,
    body: (step) => (
      <div className="wrap">
        <div className="copy">
          <ActTrack m="II" n={9} />
          <h2>Ley de corrientes</h2>
          <Enun n="9">Expresar la ley de corrientes de Kirchhoff para el circuito estudiado, aplicada tanto al nodo al que se conectan R₁, R₂ y R₃, como al nodo en que se conectan R₂, R₃, R₄ y R₅. ¿Los valores experimentales confirman dicha ley? Justifica la respuesta.</Enun>
          <Steps step={step} items={[
            ['B', <><b>Nodo B.</b> Lo que entra por R₁ sale por R₂ y R₃.</>],
            ['C', <><b>Nodo C.</b> Lo que llega por R₂ y R₃ sale por R₄ y R₅.</>],
          ]} />
          <div {...at(step, 2, 'frag')}><KclCheck id="m2" eqs={[{ node: 'Nodo B', ins: ['IR1'], outs: ['IR2', 'IR3'] }, { node: 'Nodo C', ins: ['IR2', 'IR3'], outs: ['IR4', 'IR5'] }]} /></div>
          <p {...at(step, 2, 'note frag')}>Las sumas pueden diferir en la última cifra: cada lectura tiene su incertidumbre.</p>
        </div>
        <div className="vis"><div className="panel"><SchCircuit flow /></div></div>
      </div>
    ),
  },

  /* ---------------- Bloque III ---------------- */
  {
    group: 'III', title: 'Bloque III', audio: '22-bloque3', steps: 0,
    body: cover({
      m: 'III', fig: 'Figura-2.6-Divisor.png', figN: '2.6', block: 3, figAlt: 'Figura 2.6: divisor de corriente con R3 y R6 en paralelo',
      lead: <>Medidas de un divisor de corriente: dos ramas en paralelo alimentadas con 36 V. Después añades LEDs para ver la corriente de cada rama.</>,
      acts: [<>Montar con R₆ = 100 kΩ.</>, <>Alimentar en modo serie.</>, <>Medir y rellenar la Tabla 2.6.</>, <>Comprobar la ley de corrientes.</>, <>Añadir los LEDs.</>, <>Cambiar R₆.</>, <>Explicar los LEDs.</>, <>Por qué se llama divisor.</>],
      parts: [['r3', 'R₃'], ['r6', 'R₆'], ['led', 'Dos LEDs']],
    }),
  },
  {
    group: 'III', title: 'Bloque III · 1 Montar', audio: '23-b3-montar', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="III" n={1} />
          <h2>Monta el divisor</h2>
          <Enun n="1">Montar el circuito sobre la placa de pruebas con la resistencia R₆ = 100 kΩ.</Enun>
          <Fig src="Figura-2.6-Divisor.png" alt="Figura 2.6: R3 y R6 en paralelo conectadas a la fuente Eg" />
          <OrigEnun files={ORIG.III} block="III" />
          <Guide guide={G.build3} />
        </div>
        <div className="vis"><Bench id="m3" tools={BUILD3} target="III" /></div>
      </div>
    ),
  },
  {
    group: 'III', title: 'Bloque III · 2 Modo serie', audio: '24-b3-serie', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="III" n={2} />
          <h2>Más de 30 V: modo serie</h2>
          <Enun n="2">Para alimentar la asociación de resistencias se necesita una tensión superior a 30 V. Será necesario, pues, emplear la fuente de alimentación en modo serie (es recomendable emplear tensiones del mismo orden en ambas salidas). En caso de duda, revisar cómo utilizar los distintos modos de operación de la fuente de alimentación explicados en el contenido introductorio. Una vez seleccionadas las tensiones, anotar sus valores en las casillas de la Tabla 2.6.</Enun>
          <Guide guide={G.series} />
          <div style={{ marginTop: 12 }}><TerminalMeter id="m3" rows={TERMS_III} /></div>
        </div>
        <div className="vis">
          <Supply id="m3" />
          <div style={{ marginTop: 12 }}><Fig src="Figura-2.2-Modos.png" alt="Figura 2.2: en modo serie la salida es V1 más V2" /></div>
        </div>
      </div>
    ),
  },
  {
    group: 'III', title: 'Bloque III · 3 Medir', audio: '25-b3-medir', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="III" n={3} />
          <h2>Mide las tres corrientes</h2>
          <BenchMeter id="m3" />
        </div>
        <div className="vis">
          <Enun n="3">Siguiendo el mismo procedimiento que en el ejercicio anterior para la medida de corrientes, medir las intensidades de corriente a la salida del generador y en las ramas de las resistencias R₃ y R₆, anotar las intensidades medidas en la Tabla 2.6. Nota: en todos los casos elegir el mejor fondo de escala, escribir todas las cifras que aparecen en pantalla e indicar las unidades.</Enun>
          <Guide guide={G.cur3} />
          <BenchReadout id="m3" />
          <Bench id="m3" tools={MEASURE} target="III" />
          <CurrentLog id="m3" keys={CUR_III} target="III" />
          {AMP_NOTE}
        </div>
      </div>
    ),
  },
  {
    group: 'III', title: 'Bloque III · 3 Teórico', audio: '26-b3-teorico', steps: 3,
    body: (step) => (
      <div className="wrap">
        <div className="copy">
          <ActTrack m="III" n={3} extra="Valor teórico" />
          <h2>Corrientes teóricas</h2>
          <div className="eqs">
            <div {...at(step, 1, 'eq frag')}><span><Ii n="R3" /> = <i>E</i><sub>g</sub> / <Ri n="3" /></span><span className="mute">= 36 / 3,3 kΩ</span><span className="res">≈ {amp(TEO26.IR3)}</span></div>
            <div {...at(step, 2, 'eq frag')}><span><Ii n="R6" /> = <i>E</i><sub>g</sub> / <Ri n="6" /></span><span className="mute">= 36 / 100 kΩ</span><span className="res">= {amp(TEO26.IR6)}</span></div>
            <div {...at(step, 3, 'eq final frag')}><span><Ii n="g" /> = <Ii n="R3" /> + <Ii n="R6" /></span><span className="res">≈ {amp(TEO26.Ig)}</span></div>
          </div>
          <div {...at(step, 3, 'frag')}><Tol min={interval.Ig[0]} nom={TEO26.Ig} max={interval.Ig[1]} fmt={amp} /></div>
          <PrevNote>Estos valores son los del ejercicio 2 de las actividades previas (Tabla 2.2, columna R₆ = 100 kΩ).</PrevNote>
        </div>
        <div className="vis"><div className="panel"><SchDivider flow />
          <div className="panel-cap"><span>La corriente va casi toda por la rama de menor resistencia</span><Legend items={[['r3', '96,8 % por R₃'], ['r6', '3,2 % por R₆']]} /></div></div></div>
      </div>
    ),
  },
  {
    group: 'III', title: 'Bloque III · 3 Tabla 2.6', audio: '27-b3-tabla', steps: 0,
    body: () => (
      <div className="wrap single">
        <div className="copy">
          <ActTrack m="III" n={3} />
          <h2>Tabla 2.6</h2>
          <Enun n="3">Anotar las intensidades medidas en la Tabla 2.6.</Enun>
          <Guide guide={G.t26} />
          <ResultTable id="t26" />
        </div>
      </div>
    ),
  },
  {
    group: 'III', title: 'Bloque III · 4 Kirchhoff', audio: '28-b3-kirchhoff', steps: 1,
    body: (step) => (
      <div className="wrap">
        <div className="copy">
          <ActTrack m="III" n={4} />
          <h2>Ley de corrientes en el divisor</h2>
          <Enun n="4">Expresar la ley de corrientes de Kirchhoff para el divisor de corriente. ¿Los valores experimentales confirman dicha ley? Justifica la respuesta.</Enun>
          <Steps step={step} items={[['1', <>La corriente del generador se reparte entre las dos ramas: <b><i>I</i><sub>g</sub> = <i>I</i><sub>R3</sub> + <i>I</i><sub>R6</sub></b>.</>]]} />
          <div {...at(step, 1, 'frag')}><KclCheck id="m3" eqs={[{ node: 'Nodo de entrada', ins: ['Ig'], outs: ['IR3', 'IR6'] }]} /></div>
        </div>
        <div className="vis"><div className="panel"><SchDivider flow /></div></div>
      </div>
    ),
  },
  {
    group: 'III', title: 'Bloque III · 5 LEDs', audio: '29-b3-leds', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="III" n={5} />
          <h2>Añade los LEDs</h2>
          <Enun n="5">Para visualizar las corrientes que fluyen en las resistencias R₃ y R₆ vamos a añadir unos diodos que al recibir corriente eléctrica emiten luz (LED) como se muestra en la Figura 2.7. Para que el LED funcione y emita luz, la corriente debe fluir del ánodo (positivo, +) al cátodo (negativo, −). En este caso, el terminal positivo debe quedar a la izquierda, conectado a R₃ y R₆. Puedes identificar el ánodo porque tiene la pata más larga. Revise cómo utilizar los LEDs en el contenido introductorio.</Enun>
          <Fig src="Figura-2.7-LEDs.png" alt="Figura 2.7: un LED en serie con R3 y otro en serie con R6" />
          <Guide guide={G.leds} />
        </div>
        <div className="vis">
          <Bench id="m3" tools={LEDS} target="IIIL" />
          <p className="note" style={{ marginTop: 10 }}>En el simulador el LED es ideal: conduce sin caída de tensión, así que las corrientes son las de la Figura 2.6. Quita antes las puntas del multímetro.</p>
        </div>
      </div>
    ),
  },
  {
    group: 'III', title: 'Bloque III · 6 Cambiar R₆', audio: '30-b3-cambiar', steps: 0,
    body: () => (
      <div className="wrap lab">
        <div className="copy">
          <ActTrack m="III" n={6} />
          <h2>Cambia R₆ y mira los LEDs</h2>
          <Enun n="6">Vamos a observar cómo varía la intensidad luminosa de los LEDs al cambiar el valor de la resistencia R₆. Para eso consideramos los tres casos analizados en las actividades previas: R₆ = 3k3 Ω, 100 kΩ, 2M2 Ω.</Enun>
          <Guide guide={G.r6} />
          <LedPredict id="m3" />
        </div>
        <div className="vis">
          <Bench id="m3" tools={['move', 'erase']} target="IIIL" />
          <R6Swap id="m3" />
          <LedRows id="m3" />
        </div>
      </div>
    ),
  },
  {
    group: 'III', title: 'Bloque III · 7 Explicar', audio: '31-b3-explicar', steps: 3,
    body: (step) => (
      <div className="wrap">
        <div className="copy">
          <ActTrack m="III" n={7} />
          <h2>Qué hacen los LEDs</h2>
          <Enun n="7">Explicar cómo varía la intensidad luminosa de los LEDs al cambiar el valor de la resistencia R₆ en cada uno de los tres casos propuestos.</Enun>
          <Steps step={step} items={[
            ['1', <><b>R₆ = 3,3 kΩ.</b> Las dos ramas son iguales: los dos LEDs brillan lo mismo, con 10,909 mA cada uno.</>],
            ['2', <><b>R₆ = 100 kΩ.</b> Por R₆ pasan 0,360 mA: su LED brilla poco.</>],
            ['3', <><b>R₆ = 2,2 MΩ.</b> Por R₆ pasan 16,36 µA: su LED queda casi apagado. El de R₃ no cambia en ningún caso.</>],
          ]} />
        </div>
        <div className="vis"><div className="panel">
          <SchDivider flow leds r6={step >= 3 ? 2.2e6 : step === 2 ? 1e5 : 3300} />
          <div className="panel-cap"><span>La fuente fija 36 V en las dos ramas</span><Legend items={[['r3', 'I = Eg / R₃'], ['r6', 'I = Eg / R₆']]} /></div>
        </div></div>
      </div>
    ),
  },
  {
    group: 'III', title: 'Bloque III · 8 Divisor', audio: '32-b3-divisor', steps: 3,
    body: (step) => (
      <div className="wrap">
        <div className="copy">
          <ActTrack m="III" n={8} />
          <h2>Por qué se llama divisor</h2>
          <Enun n="8">A la vista de lo observado y de las medidas tomadas, ¿por qué el circuito de la Figura 2.6 tiene el nombre de divisor de corriente?</Enun>
          <Steps step={step} items={[
            ['1', <>La corriente del generador se <b>divide</b> entre las ramas en paralelo.</>],
            ['2', <>Cada rama se lleva una parte <b>inversamente proporcional</b> a su resistencia.</>],
            ['3', <>Por eso, cuanto mayor es R₆, menor es su parte de <i>I</i><sub>g</sub>: del 50 % al 0,15 %.</>],
          ]} />
          <div {...at(step, 3, 'formula frag')}><span><Ii n="R6" /> = <Ii n="g" /> · <Ri n="3" /> / (<Ri n="3" /> + <Ri n="6" />)</span></div>
        </div>
        <div className="vis"><div className="panel"><SchDivider flow /></div></div>
      </div>
    ),
  },

  {
    title: 'Ideas clave', steps: 4, // sin narración
    body: (step) => (
      <div className="wrap">
        <div className="copy">
          <Eyebrow>Cierre</Eyebrow>
          <h2>Lo que te llevas</h2>
          <Steps step={step} items={[
            ['1', <>La tensión se mide <b>en paralelo</b>; la corriente, <b>en serie</b>, abriendo la rama.</>],
            ['2', <>Para medir corriente empieza por el <b>fondo mayor</b> y baja después.</>],
            ['3', <>En un nodo, <b>lo que entra es igual a lo que sale</b>: tus medidas lo confirman.</>],
            ['4', <>En paralelo, la corriente va sobre todo por la rama de <b>menor resistencia</b>.</>],
          ]} />
        </div>
        <div className="vis"><div className="sum">
          {[
            ['Corrientes de ramas', <><Ii n="g" /> con Eg = 25 V</>, amp(TEO25.IR1)],
            ['Divisor, R₆ = 100 kΩ', <><Ii n="g" /> con Eg = 36 V</>, amp(TEO26.Ig)],
            ['Divisor, siempre', <><Ii n="R3" /> = Eg / <Ri n="3" /></>, amp(TEO26.IR3)],
          ].map(([h, f, v]) => (
            <div key={h} className="sumcard"><h3>{h}</h3><div className="f">{f}</div><div className="v">{v}<small>fondo 40 mA</small></div></div>
          ))}
        </div></div>
      </div>
    ),
  },
]
