# Pigment Match — Manual de usuario

Un compañero tranquilo y 100% local para pintores al óleo. Le das un color y te
dice cómo **mezclarlo con pigmentos reales**, y lo describe como piensa un
pintor —valor, temperatura, saturación— en vez de con números crudos.

> Pensá en pintura, no en RGB.

Todo corre en tu navegador. No se sube nada; tus paletas se guardan en tu propio
dispositivo.

---

## Primeros pasos

1. Abrí la app (`npm run dev` y entrá a la URL local que muestra).
2. La interfaz tiene once pestañas arriba: **Match · Imagen · Extraer · Coach ·
   Comparar · Mezcla · Bitácora · IMG Lab · Calibrar · Paleta · Ayuda**.
   La versión de la app se muestra al lado del título (la pestaña **Ayuda**
   tiene notas de versión, preguntas frecuentes y la historia de la app).
3. Empezá en **Match** — abre con el color de ejemplo `#927073`.

El encabezado (arriba a la derecha) muestra tu paleta activa, la cantidad de
pigmentos y un **selector de idioma (`EN / ES`)** — toda la app, incluidas las
descripciones de pintor y los consejos, cambia entre inglés y español. Tu
elección se recuerda.

---

## Pestaña Match — color → receta

Es el corazón de la app.

### 1. Ingresá tu color objetivo

Tres formas, todas intercambiables:

- **Picker** — clic en el cuadrado de color para abrir el selector del sistema.
- **HEX** — escribí un valor como `#927073` y apretá Enter.
- **RGB** — ajustá los canales R, G y B (0–255) por separado.

### 2. Leé los resultados

- **Target color** — un swatch grande con su HEX y RGB.
- **Painter analysis** — una frase en lenguaje natural ("un rojizo de baja
  saturación, valor medio, ligeramente cálido") más los cuatro ejes: **Value**
  (claro / medio / oscuro), **Temperature** (cálido / neutro / frío),
  **Saturation** y **Hue tendency** (tendencia de matiz).
- **Mixing recipe** — los pigmentos y cantidades que más se acercan al objetivo,
  con un **match score** (y ΔE, el error perceptual). Un swatch muestra el color
  que el modelo predice que dará la mezcla. Un chip indica la **paleta activa**
  de la que sale la mezcla — hacé clic para **cambiar de paleta** desde la receta.
- **Variations** — seis alternativas a un clic: más Clara, más Oscura, más
  Cálida, más Fría, más Saturada, menos Saturada. **Clic en cualquier variación**
  para convertirla en tu nuevo objetivo. Cada una tiene además un link **"Cómo
  mezclarlo"**: abre la receta de tu color base más el pequeño ajuste (qué
  pigmento agregar) que lleva esa mezcla a la variación — así no arrancás la
  mezcla de cero.

### 3. Partes vs. porcentajes

Arriba de la receta hay un toggle chico: **Parts | %**.

- **Parts** — proporciones de pintor ("1 part Titanium White") y los aportes
  chicos como *toques* (small / tiny / microscopic touch).
- **%** — cada pigmento como porcentaje de la mezcla (suman 100; lo que está por
  debajo de 1% aparece como `<1%`).

Tu elección se recuerda y aplica en todos lados (incluida la pestaña Extract).

> ¿No sabés qué hacen los controles arriba de la receta? Hacé clic en **"¿Qué
> hacen estas opciones?"** ahí — una explicación corta cubre el modelo de mezcla
> (Classic / Spectral), el nivel de detalle (Simple / Preciso), las unidades
> (Partes / %) y los controles opcionales **Máx colores** / **Prioriza valor**.
>
> **Menos colores, cuidando el valor:** para una mezcla más artística y limitada,
> poné **Máx colores** (≤2/≤3/≤4) para limitar los pigmentos y activá **Prioriza
> valor** para que la mezcla mantenga el valor (luminosidad) cerca aunque el color
> se corra. Un número **ΔL** al lado del match muestra qué tan cerca está el
> valor. Ambos están apagados por defecto — si los dejás así, las recetas se
> comportan igual que antes.

> **Qué significa el match score:** es la confianza del modelo en su propia
> predicción, medida en CIE Lab (ΔE). Un puntaje alto significa "esta mezcla
> *debería* caer muy cerca". Es un excelente punto de partida, no una garantía
> sobre la pintura real — siempre confiá en tu ojo en el caballete.

---

## Pestaña Image — sacar colores de una foto

1. Clic en el área de subida y elegí una imagen (una foto, una obra maestra…).
2. Movés el cursor por encima — el swatch debajo del lienzo previsualiza el
   color.
3. **Clic en cualquier punto** de la imagen para fijar ese color como objetivo.
4. El color muestreado entra en la misma receta + análisis + variaciones que la
   pestaña Match.

Usá los botones **+ / −** debajo de la imagen para **acercar o alejar** sin
cambiar el tamaño de la caja; con zoom podés **arrastrar la imagen** para moverte
y afinar el pick. El cursor es un cuentagotas — el clic sigue tomando el color
(un arrastre no). El botón **Zoom** activa la lupa. Usá **Replace image** para
cargar otra.

> **Comparar con tu swatch.** Debajo del color muestreado hay una tarjeta
> **Comparar con tu swatch**: subí una foto de tu propio swatch pintado y hacé
> clic para ver cómo compara con el objetivo — match %, la diferencia de valor
> (ΔL) y el consejo del Coach para acercarte.

> ¿Querés limpiar o mejorar una foto antes de muestrear? Ahora está en su propia
> pestaña **IMG Lab** — editala ahí, **Descargá** el resultado y subí la imagen
> ya limpia acá.

---

## Pestaña IMG Lab — editar y mejorar una foto

Un espacio dedicado para arreglar una imagen y después descargarla (los controles
de edición antes estaban en la pestaña Image). Subí una foto (o usá la cámara),
trabajala y **Descargá** el resultado como PNG para reusarlo.

### Ajustes

Sliders locales y predecibles, sin IA: **Nitidez, Brillo, Contraste, Saturación,
Temperatura** (balance de blancos), con **Reset**. Ideales para color, exposición
y nitidez; nunca inventan detalle.

### Mejora con IA — súper-resolución *(experimental)*

Agranda una imagen de **baja resolución / pixelada** y reconstruye detalle. Elegí
la potencia — **Rápido**, **Mejor** o **Máx** (más detalle, descarga más grande,
más lento). La mejora se nota al **hacer zoom**; no ayuda en una foto ya nítida.

### IA en la nube — Gemini (Nano Banana) *(opcional, con tu propia key)*

Para limpieza más pesada — **desenfoque, ruido, poca luz, etc.** — usá el modelo
de imagen Gemini de Google. Pegá **tu propia** API key de Google AI Studio (hay
un link "Conseguir una key gratis") — se guarda solo en tu navegador y se envía
únicamente a Google; no hay backend. Escribí una instrucción (ej. "quitá
desenfoque y ruido, mantené los colores") y ejecutá. Es **generativo**, así que
puede cambiar colores y contenido — usalo para limpieza, no como referencia de
color.

> La restauración local con IA (MAXIM deblur/denoise) se quitó: esos modelos no
> pueden correr en la GPU del navegador (superan el límite de textura de WebGL).
> Usá la opción Gemini en la nube, los **Ajustes**, o el ESRGAN de arriba.

> **Atención:** la IA corre enteramente en tu computadora (sin servidor), así que
> usa mucha CPU/GPU y memoria. Puede ser lenta, alterar colores y fallar en
> equipos modestos — si pasa, recargá la página o probá una imagen más chica.
> Para temas de color/blancos, los **Ajustes** comunes suelen ser mejores.

> **Usá tu cámara:** en todos lados donde podés subir una foto (Imagen, Mezcla,
> Coach, Comparar y la Bitácora) hay un botón **Usar cámara**. Abre la webcam de
> tu PC o la cámara del teléfono dentro de la misma página (con cambio de cámara
> frontal/trasera), y la foto que sacás se usa como imagen. El video queda en tu
> dispositivo — no se sube nada. La primera vez el navegador te pedirá permiso
> de cámara.

---

## Pestaña Extract — una paleta desde una pintura

1. Clic en **Upload a painting**.
2. Elegí cuántos colores extraer: **8, 12 o 20**.
3. La app encuentra los colores dominantes (agrupados de forma perceptual) y los
   ordena **de claro a oscuro**.

Para cada color extraído obtenés:

- Un swatch con su HEX (clic para enviarlo a **Match**).
- Una descripción breve de pintor.
- Una receta de mezcla compacta con su match score.
- Una **pista de relación** cuando los colores están emparentados — ej. *"close
  to #3 — add a touch of Ultramarine"* ("cercano al #3 — agregá un toque de
  Ultramarine").

Cambiar la cantidad de colores re-extrae al instante de la misma imagen.

---

## Pestaña Coach — qué corregir ahora

Para cuando estás mezclando en una paleta real y querés cerrar la diferencia.

1. Fijá tu **Target color** (escribilo, elegilo, o traelo de otra pestaña).
2. Fijá **Your current mix** — el color que tenés en la paleta ahora mismo.
   Escribilo, o clic en **Sample from photo** para tomarlo de una foto de tu
   paleta.
3. La tarjeta **Coach** te da pasos priorizados, en lenguaje simple:
   - **Valor** — "too dark — lift the value with Titanium White" (muy oscura,
     levantá el valor con blanco).
   - **Saturación** — "too saturated — knock it back with a touch of Raw Umber"
     (muy saturada, bajala con un toque de Raw Umber).
   - **Matiz / temperatura** — "the hue needs to go warmer — nudge it with
     Cadmium Orange" (el matiz tiene que ir más cálido).
   Cada paso muestra un punto del pigmento sugerido.
4. El **match score** en vivo sube a medida que tu mezcla se acerca. Cuando
   llegás, se pone verde: *"You're there — lay it in and trust it."*

> Hacé los pasos en orden, agregá color en cantidades **mínimas**, y volvé a
> muestrear. Igualar un color siempre son varias correcciones chicas, nunca una
> grande.

---

## Pestaña Comparar — referencia vs. tu pintura

Subí una foto de **referencia** y una de tu **obra en curso** y critica el
cuadro entero.

1. Subí ambas imágenes.
2. **Alineá** cada una: arrastrá los **4 puntos** a las esquinas del cuadro. La
   app las endereza para que coincidan píxel a píxel (resuelve ángulos y
   recortes distintos). Apretá **Analizar diferencias**.
3. Explorá las vistas:
   - **Superponer** — swipe u opacidad entre las dos, con un control de
     **entrecerrar** (blur) para comparar masas.
   - **Valores** — grises, **notan** (masas de valor posterizadas), heatmap de
     diferencia de valor e histograma de valores.
   - **Color** — heatmaps de diferencia conmutables: **ΔE** general,
     **temperatura**, **saturación**, **matiz**.
   - **Coach por zona** — hacé clic en la referencia para recibir el consejo del
     Coach de esa zona.
   - **Paletas** — la paleta dominante de cada una, lado a lado.
   - **Puntaje** — precisión de valor y color, sesgos, y una frase resumen.

Hay un toggle **Normalizar luz** para ignorar diferencias de exposición /
balance de blancos. El **valor** y la comparación relativa son lo más confiable
— el color de las fotos nunca es exacto.

---

## Pestaña Mezcla — igualar un color de referencia con tu mezcla

Un flujo enfocado de dos fotos para "¿mezclé bien este color?".

1. **Referencia** — subí una foto y **hacé clic** en el color que querés igualar.
2. **Tu mezcla en la paleta** — subí una foto de la pintura en tu paleta y hacé
   clic en la mancha.
3. Obtenés la descripción de pintor de cada color, una **escala de valor** con
   ambos marcados (y cuánto más clara/oscura está la tuya), y el consejo del
   **Coach** + un match score.

Tildá **Mostrar grises** para una vista de valor opcional, **recortada a los
puntos que muestreaste**. Al pasar el mouse por la referencia, dos cuadraditos
siguen el cursor — el **color bajo el puntero** (izquierda) y **tu mezcla**
(derecha) — para ver en vivo dónde coincide tu color/valor. (El clic sigue
cambiando el objetivo.) Hay versión a color y en escala de grises.

---

## Pestaña Bitácora — guardá tus mezclas para la próxima

Tu cuaderno personal de mezclas de color. Registrá un tono de piel genérico, un
cielo, el gris que mezclaste para las sombras — cualquier cosa que quieras volver
a encontrar — y volvé otro día a retomarla.

### Proyectos

Todo se organiza en **proyectos** (un retrato por encargo, un estudio, una
serie). Elegí un proyecto del desplegable, o escribí un nombre y apretá **Nuevo
proyecto**. Usá **Renombrar** y **Eliminar** en el encabezado del proyecto.
(Eliminar un proyecto borra también sus colores.)

### Registrar un color

1. Apretá **Agregar color**.
2. Completá lo que te sirva — todo opcional salvo tus propias costumbres:
   - **Nombre del color** — ej. *Piel caucásica genérica*.
   - **Color del swatch** — un chip de color opcional (un marcador visual
     rápido). Si agregaste una foto del swatch, apretá **Tomar color de la foto
     del swatch** y hacé clic en la pintura para tomar el color directamente de
     ella.
   - **Mezcla / receta** — texto libre, escrito como vos pensás:
     *"5 Blanco de Titanio · 1 Ocre Amarillo · toque Rojo Cadmio · mínimo Tierra
     Sombra Tostada."*
   - **Notas** — luz, dónde se usa, qué ajustar la próxima vez.
   - **Foto del swatch** y **Foto de referencia** — opcionales. Elegilas de tu
     dispositivo; se achican automáticamente para que el almacenamiento quede
     chico.
3. Apretá **Guardar color**. Después podés editar (lápiz) o eliminar (tacho)
   cualquier entrada.

### Exportar un proyecto como PDF

El botón **PDF** en el encabezado de un proyecto descarga un PDF de ese proyecto:
sus fotos de referencia y terminado, y cada color con su chip, receta, notas y
fotos. Útil para imprimir o compartir un trabajo puntual.

### Respaldo — exportar e importar

- **Exportar** descarga toda tu bitácora — proyectos, colores y las fotos
  incluidas — en un único archivo `.json`.
- **Importar** vuelve a cargar ese archivo, **agregando** sus proyectos (nunca
  pisa lo que ya tenés). Usalo para respaldar o mover tu bitácora a otro
  dispositivo o navegador.

> **Dónde se guarda:** la Bitácora vive en el **IndexedDB** de tu navegador (un
> almacén local más grande que el resto de la app, así las fotos entran cómodas).
> Sigue siendo 100% local — no se sube nada. Como es por navegador, usá
> **Exportar** para un respaldo real. El link **"¿Dónde se guardan mis datos?"**
> (debajo del texto introductorio) abre una explicación de exactamente dónde
> viven tus datos, los cuidados, y cómo respaldarlos y recuperarlos.

---

## Pestaña Calibrate — enseñale el modelo a tus pinturas reales *(opcional)*

Por defecto la app usa datos de pigmentos genéricos, estimados a ojo. La
calibración ajusta el modelo de mezcla a *tus* tubos reales y tu iluminación,
usando mezclas que hiciste de verdad. Es totalmente opcional — si la dejás
apagada, no cambia nada.

Cómo funciona: registrás unas pocas **observaciones** ("mezclé estas partes y me
dio este color"), apretás **Calibrate**, y el modelo ajusta la fuerza tintórea
de cada pigmento para que coincida con lo que viste. Después, un solo toggle
cambia toda la app al modelo calibrado.

### Registrar una observación

1. En **Record a mix you made**, ingresá las **partes** que usaste de cada
   pigmento (dejá el resto en 0).
2. Fijá **el color real que obtuviste** — escribilo, o **Sample from photo** de
   tu swatch real (lo más exacto).
3. Clic en **Add observation**.

Repetí con varias mezclas — **tres o más** da el mejor ajuste.

> **Registrá MEZCLAS, no pigmentos solos.** La calibración ajusta la *fuerza
> tintórea*, que solo se manifiesta en una mezcla — un pigmento solo siempre
> predice su propio color sin importar su fuerza, así que no le enseña nada al
> modelo. Las observaciones más útiles son **un pigmento mezclado con blanco** en
> una proporción conocida (ej. 1 blanco + 0.5 ocre, o 1 blanco + un toque de
> ultramar — los colores fuertes necesitan muy poco). Cubrí cada pigmento en al
> menos una mezcla con blanco, y sumá cualquier mezcla que la app prediga mal.
> (Esto ajusta solo la fuerza — el color base del pigmento se fija en la pestaña
> Paleta.)

### Calibrar

1. Apretá **Calibrate from N observations**.
2. La tarjeta muestra el error promedio **antes → después** (en ΔE). Una caída
   grande significa que el modelo ahora predice bien tus pinturas.
3. Activá el toggle **Calibrated mixing** (arriba de la pestaña). Aparece un
   badge **Calibrated** en el encabezado, y todas las recetas —Match, Image,
   Extract, Coach— pasan a usar tu modelo ajustado.

Podés **Re-calibrate** tras agregar más observaciones, **Discard calibration**
para descartar el ajuste, o apagar el motor cuando quieras para volver al
default. La calibración se guarda por paleta, así cada una puede tener la suya.

> La calibración por ahora ajusta la **fuerza tintórea** (cuánto rinde cada
> pigmento en una mezcla). El color base de un pigmento se setea directo en la
> pestaña Palette.

---

## Pestaña Palette — tus pigmentos

Las recetas son tan buenas como los pigmentos que la app cree que tenés, así que
mantené esto en sintonía con tus pinturas reales.

### Gestionar paletas

- **Menú desplegable** — cambiar entre paletas guardadas.
- **Campo de nombre** — renombrar la paleta activa.
- **Add preset…** — crear una paleta desde un kit conocido (Traditional Oil,
  Winsor & Newton Artists', Corfix).
- **New** — crear una paleta nueva (parte del set de óleo por defecto).
- **Reset** — restaurar la paleta activa a los 8 pigmentos por defecto.
- **Delete** — eliminar la paleta activa (siempre queda al menos una).
- **Export** — descargar la paleta activa como archivo JSON (respaldo o para
  compartir).
- **Import** — cargar una paleta desde un JSON; se agrega como paleta nueva.

### Editar un pigmento

Cada fila tiene un cuadrado de color, un nombre, un botón **Edit** y un ícono de
eliminar.

Clic en **Edit** para mostrar:

- **Opacity** — de transparente (para veladuras) a totalmente opaco.
- **Tinting strength** (fuerza tintórea) — cuán fuerte tira el pigmento la
  mezcla hacia su color. Los pigmentos fuertes (ej. los azules) "rinden más" con
  menos cantidad.
- **Temperature** — cálido / neutro / frío.

Clic en el cuadrado de color para cambiar el color del pigmento. **Add pigment**
agrega uno nuevo.

> **Fijá el masstone real.** Las recetas se construyen a partir del color base de
> cada pigmento, así que la precisión empieza acá — y la calibración solo ajusta
> la fuerza tintórea, no el color. Cada vez que edites, agregues o crees una
> pintura, fijá su color real: pintá un swatch puro, fotografialo con buena luz,
> muestrealo en la pestaña Imagen y copiá ese HEX en el pigmento. Una nota arriba
> de la pestaña Paleta lo repite.

> **Tip — calibrá con tus tubos reales:** pintá un swatch puro de un tubo,
> fotografialo con buena luz, muestrealo en la pestaña **Image**, y copiá ese
> HEX al pigmento. Cuanto más cerca estén los datos del pigmento de tu pintura
> real, mejores serán las recetas.

### Guardado

Todo se guarda automáticamente en tu navegador (`localStorage`). Cerrá la
pestaña y tus paletas seguirán ahí la próxima vez. Como el guardado es por
navegador, usá **Export** para respaldar una paleta o llevarla a otra compu, e
**Import** para traerla de vuelta.

---

## La paleta de óleo por defecto

Titanium White · Raw Umber · Burnt Umber · Cadmium Orange · Cadmium Red Light ·
Alizarin Crimson · Ultramarine Blue · Yellow Ochre.

Un set tradicional y limitado. Si un color no se puede alcanzar con él (un verde
saturado, por ejemplo), el match score lo dirá honestamente en vez de inventar
una receta.

---

## Cómo mezcla (en breve)

La pintura mezcla **sustractivamente** —absorbe luz—, por eso la app no promedia
RGB. Usa una aproximación de **Kubelka-Munk** de constante única por canal de
color (ponderada por la fuerza tintórea de cada pigmento), lo que hace que azul
+ amarillo tienda a verde y que el blanco diluya correctamente. Después una
búsqueda encuentra las proporciones de pigmento cuya mezcla predicha se acerca
más a tu objetivo en **CIE Lab**.

El modelo es una aproximación con base física, no una medición de tu pintura
real. Esperá que te deje en el barrio correcto —valor correcto, temperatura
correcta, matiz cercano— y terminá a ojo.

Para profundizar: es el mismo método de Kubelka-Munk de constante única que la
ciencia del color usa para igualar pinturas de artista — Mohammadi, Nezamabadi,
Taplin & Berns (RIT Munsell Color Science Lab, 2004), *Pigment Selection Using
Kubelka–Munk Turbid Media Theory and Non-Negative Least Square Technique*
([PDF](https://repository.rit.edu/cgi/viewcontent.cgi?article=1929&context=article)).
El match score usa la diferencia de color perceptual CIEDE2000. La tarjeta de
receta tiene un toggle **Simple / Preciso** (pocos pigmentos prácticos vs. el
menor error posible) y un toggle opcional de modelo **Classic / Spectral** (el
Spectral reconstruye una curva de reflectancia completa por pigmento;
experimental).

---

## Preguntas frecuentes

**¿Necesito internet?** No. Después de cargar, funciona totalmente offline.

**¿Dónde se guardan mis datos?** Solo en tu navegador, en este dispositivo.

**El selector de color muestra RGB, no HEX.** Ese diálogo es el de tu sistema
operativo, no el de la app — sus campos no se pueden cambiar. La app muestra HEX
y RGB al lado del picker en Match, Image y Coach.

**Un match score es bajo. ¿Está roto?** No — significa que tu paleta actual no
puede llegar a ese color. Agregá o editá pigmentos en la pestaña **Palette**.

**¿La receta será exacta?** Es un excelente punto de partida. Los datos de los
pigmentos son aproximados y la pintura real tiene variables que el modelo no
captura (marca, brillo, capas, secado). Ajustá en la paleta — la pestaña
**Coach** está hecha justo para eso.
