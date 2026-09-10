# Modo DT: Sueño en Grande

Simulador de modo carrera como **director técnico** de un club del fútbol
argentino. No se juegan los partidos: se resuelven solos según tu plantel y
las decisiones que vas tomando (táctica, prensa, vestuario, fichajes). De vez
en cuando aparece un penal donde elegís quién patea y hacia dónde.

## Cómo jugarlo

No hace falta instalar nada ni tener cuenta. Abrí el archivo `index.html` con
cualquier navegador (doble click alcanza) y arrancá a dirigir. El progreso se
guarda solo en tu navegador (`localStorage`), así que si cerrás y volvés a
abrir seguís donde quedaste.

## Qué incluye esta versión

- **Creá tu Director Técnico**: antes de elegir club, ponés nombre,
  nacionalidad y un estilo personal (Ofensivo, Equilibrado o Conservador).
  El estilo da un empujoncito de sabor al arrancar la carrera — Ofensivo
  suma +10 de ánimo inicial, Conservador da +10% de presupuesto inicial,
  Equilibrado no cambia nada — y tu nombre queda mostrado en la cabecera
  durante toda la carrera. Es identidad, no dificultad: no vuelve a
  preguntarse hasta que termines la carrera y empieces una nueva.
- **Presentación en sociedad**: después de elegir club (solo la primera
  temporada de la carrera), la dirigencia te plantea el objetivo del año
  según el nivel del club — desde "pelear el campeonato" para los grandes
  hasta "no descender" o "consolidarse" para los más chicos, y "pelear el
  ascenso" en la Nacional — y elegís cómo responder (aceptar el desafío,
  pedir tiempo, o poner paños fríos), con un pequeño efecto en el ánimo. El
  objetivo queda visible en la cabecera durante toda la temporada.
- **Calendario día a día**: entre una fecha y la siguiente ya no se salta
  directo al próximo partido — aparece un calendario con la fecha real
  (arranca el 1° de febrero). Tocás "Avanzar" una vez y pasa de largo
  todos los días sin nada (no hace falta tocarlo día por día): se frena
  solo en el primer día con algo, ya sea un mensaje del club (19 mensajes
  distintos en `INBOX_MESSAGES` de `js/data.js`, de la dirigencia, el
  cuerpo técnico, jugadores con pedidos o reclamos, tu representante, la
  prensa, sponsors, el capitán, el preparador físico, un ídolo del club,
  y más) que respondés antes de poder seguir, o el día del partido (o de
  la fecha FIFA, la ventana de pases, etc.), que revela la pantalla
  correspondiente directamente.
- **Primera División y Primera Nacional**: 30 clubes reales en Primera (2
  zonas de 15) y 36 en la Nacional (2 zonas de 18), con la composición
  actual verificada (incluye los últimos ascensos/descensos: Colón, Godoy
  Cruz y San Martín de San Juan bajaron; Aldosivi, Estudiantes de Río Cuarto
  y Gimnasia de Mendoza subieron). Podés arrancar tu carrera en cualquiera
  de las dos. Las zonas se vuelven a sortear cada temporada (como en la vida
  real) para mantener siempre ese reparto.
- **Reputación vs. presupuesto**: son dos cosas separadas a propósito. La
  reputación define el nivel del plantel en cancha; el presupuesto (`budgetTier`
  en `data.js`) refleja la situación económica real del club, que puede no
  coincidir — por ejemplo San Lorenzo tiene un plantel de nivel medio pero un
  presupuesto bajo por su crisis institucional, mientras que Boca y River
  manejan presupuestos muy por encima del resto.
- **Escudos**: los 30 clubes de Primera tienen su escudo real, embebido en
  `js/escudos.js` (ver `tools/generar-escudos.py` para regenerarlo). Los de
  la Nacional todavía no están: esos clubes se muestran con un escudo
  genérico con sus iniciales.
- **Apertura y Clausura**: en Primera se juegan dos torneos por año, cada uno
  con fase de zonas a una rueda y playoffs de octavos a la final, con una
  ventana de pases entre ambos. La Nacional juega un solo torneo anual a una
  rueda.
- **Playoffs con llave fija**: clasifican los 8 primeros de cada zona y el
  cuadro queda armado de entrada, como en el reglamento de la LPF — ganar los
  octavos ya te dice contra quién jugás en cuartos. Los octavos cruzan zonas
  (1ºA-8ºB, 4ºB-5ºA, 2ºB-7ºA, 3ºA-6ºB por un lado; 1ºB-8ºA, 4ºA-5ºB, 2ºA-7ºB,
  3ºB-6ºA por el otro). Todo a partido único, de local el mejor ubicado de la
  fase regular y a penales si empatan; la final se juega en cancha neutral.
- **Tabla Anual**: pestaña propia en el panel de tablas de Primera. Suma la
  fase de zonas del Apertura y la del Clausura (los playoffs no suman
  puntos) y se va actualizando fecha a fecha. Marca con colores los puestos
  de Libertadores, Sudamericana y descenso.
- **Copa Argentina**: al arrancar el año se sortea un cuadro de 32 (los 30
  clubes de Primera + 2 de la Nacional, garantizando que tu club esté
  adentro) y se juega en paralelo al Apertura (o al único torneo de la
  Nacional): dieciseisavos, octavos, cuartos, semifinal y final — las mismas
  rondas que tiene la competencia real desde la fase de los 32. El resto del
  cuadro se resuelve solo según la fuerza de cada club, así que siempre hay
  un campeón real al final, lo ganes vos o no.
- **Fechas FIFA**: pausan la liga; tus jugadores mejor valorados pueden ser
  convocados a su selección, con riesgo de lesión o de sumar experiencia.
- **Lesiones y suspensiones**: después de cada partido puede haber bajas —
  una molestia muscular de un par de partidos, un desgarro, un esguince, una
  lesión de rodilla larga, una expulsión o la quinta amarilla. Salen en el
  parte médico junto con el resultado. Un jugador de baja no puede ser
  titular: el once se recompone solo con el mejor reemplazo para ese puesto,
  y si intentás ponerlo en la cancha el juego te avisa. El contador baja de a
  un partido por cada partido del equipo.
- **Once inicial**: se arma por puesto, no por puntaje. El casillero de
  lateral izquierdo lo ocupa el lateral izquierdo del plantel aunque haya un
  central con más puntaje, así que el equipo que aparece al empezar se parece
  al que pondría el club de verdad.
- **Resultados de los partidos**: la diferencia de nivel entre dos equipos
  define sobre todo quién gana, no por cuánto. Un grande de local contra un
  chico gana cerca del 70% de las veces, pero 2-0 o 1-0: las goleadas
  grandes son raras (3% de los partidos) y ningún equipo pasa de 6 goles.
- **Libertadores y Sudamericana**: se juegan de verdad todos los años (fase
  previa, 8 grupos de los que pasan dos, y eliminatorias hasta la final), con
  los clasificados argentinos que salieron de tu temporada anterior más los
  clubes del resto del continente, cada uno con su nivel (ver
  `js/internacional.js`). Las plazas de cada país se reparten de nuevo cada
  temporada según el nivel de cada club más una buena dosis de azar, así que
  no clasifican siempre los mismos: los grandes van casi todos los años y los
  chicos se cuelan de vez en cuando. El campeón de cada copa y hasta dónde llegó tu club
  quedan en la pestaña "Copas" del panel. La primera temporada de una carrera
  todavía no tiene copas: se juegan desde el año siguiente. Es una versión
  simplificada: las llaves son a partido único y los grupos se sortean sin
  bombos por país.
- **Cupos a copas internacionales** (según el formato real de AFA): 6 a
  Libertadores —campeón del Apertura, campeón del Clausura, campeón de la
  Copa Argentina, y los 3 mejores de la Tabla Anual que no hayan clasificado
  ya, el último de ellos por fase previa— y 6 a Sudamericana (los 6
  siguientes de la Tabla Anual). Si un mismo club gana más de un título, el
  cupo que libera se reparte corriendo la Tabla Anual hacia abajo. Un campeón
  que además desciende conserva igual su cupo, como en la realidad.
- **Ascensos y descensos** (a fin de año, 2 de cada): en Primera descienden
  los dos últimos de la Tabla Anual; en la Nacional ascienden el ganador de
  una Final directa entre los líderes de cada zona, y el ganador de un
  Torneo Reducido (2º a 8º de cada zona + el perdedor de la Final).
  En la realidad el segundo descenso sale de la tabla de promedios de las
  últimas 3 temporadas: acá se usan los dos últimos de la Anual a propósito,
  para no arrastrar una segunda tabla con el historial de cada club.
- **Mercado de pases**: en Primera, una ventana entre el Apertura y el
  Clausura; en la Nacional, una ventana a mitad de su único torneo. Justo
  antes de abrir el mercado, si algún jugador de tu plantel tiene el
  contrato por vencer a fin de esa temporada, te avisa para que decidas
  renovarlo (con costo) o dejarlo ir a fin de año. Un refuerzo suma al
  plantel (máximo 30 jugadores; con el plantel lleno hay que vender primero,
  y no se puede bajar de 14).
- **Cuánto vale un jugador**: el precio duplica cada 6 puntos de valoración,
  así que un titular de Primera (70) ronda el millón y medio, un crack (82)
  se va a 6 millones y una estrella (88) a 12. La edad ajusta: un pibe con
  proyección vale más caro que un veterano de la misma valoración. Con eso,
  el presupuesto de River alcanza para un refuerzo de 90 o dos de 82, y un
  club chico de la Nacional puede comprar un jugador de 62.
- **Valoración de jugadores**: cada jugador tiene una valoración (0-100) que
  puede subir o bajar con el tiempo por edad (los jóvenes mejoran, los
  grandes bajan), por rendimiento en cancha y por tus decisiones de
  entrenamiento. El crecimiento de los jóvenes tiene un techo (`potential`
  en `engine.js`, calculado una sola vez al armar el plantel según la edad):
  no es ilimitado, así que un jugador de veintipico no termina llegando a
  90+ de la nada, como mucho mejora unos pocos puntos con los años.
- **Penales, con arquito y cinemática**: cuando hay un penal a favor, elegís
  primero quién lo patea y después tocás una de las 6 zonas del arco
  (izquierda/centro/derecha, arriba/abajo) donde querés que apunte; la
  pelota y el arquero rival se mueven cada uno a su zona (la del arquero
  sale al azar) y, si entra, la pelota queda clavada adentro del arco con
  un cartel de "¡GOL!" como confirmación — si no, se ve "¡ATAJADA!". Cuando
  el penal es en contra, aparece tu propio arquero (con la camiseta real de
  tu club si está cargada) y elegís vos hacia dónde se tira para intentar
  atajarlo. El mismo arquito se usa en instancias de eliminación directa
  que terminan empatadas (Copa Argentina, playoffs, Final por el ascenso,
  Reducido) para resolver la definición por penales.
- **Pantalla con 3 paneles**: a la izquierda una tabla de posiciones con
  flechitas para recorrer tu zona, la otra zona de tu misma división y un
  resumen de la última clasificación a copas internacionales; en el medio el
  juego en sí (decisiones, partidos, mercado, etc.), con un botón para
  terminar la carrera actual y arrancar una de cero desde cualquier
  pantalla, no solo al final de la temporada; a la derecha tu plantel sobre
  una cancha, con el arquero abajo y subiendo hacia los delanteros, más una
  lista de suplentes.
- **Formaciones y estilo táctico**: 17 formaciones agrupadas en 3 estilos
  elegibles con un click (Defensiva, Equilibrada, Ofensiva). Elegir un
  estilo selecciona una formación de ese grupo y muestra el resto de las
  formaciones de esa familia para elegir la exacta.
  - Defensivas: 5-4-1, 5-3-2, 5-2-3, 5-2-1-2, 4-5-1.
  - Equilibradas: 4-4-2, 4-3-3, 4-3-1-2, 3-4-1-2.
  - Ofensivas: 4-2-4, 4-3-3, 3-4-3, 4-2-3-1, 3-5-2, 4-1-4-1, 4-2-2-2, 3-2-5.

  (La 4-4-2 en rombo/diamante, otra formación clásica muy conocida, ya
  estaba cubierta desde antes: es la misma forma que nuestra 4-3-1-2.)

  Formaciones como 4-3-1-2 o 3-2-5 tienen una cuarta línea entre el
  mediocampo y el ataque (el enganche/las mediapuntas) que se dibuja como
  una fila propia en la cancha, entre los mediocampistas y los delanteros.
  La formación decide cuántos jugadores entran a cada línea (los mejores de
  cada una según su valoración) y da un pequeño empujón o resta a tu fuerza
  en el partido según qué tan ofensiva sea.
- **Cambios de titulares**: se tocan dos jugadores — dos de la cancha, o uno
  de la cancha y uno del banco — para intercambiarlos, sin un botón
  intermedio. El casillero (cuántos hay en cada línea) siempre lo define la
  formación elegida, no el cambio en sí. Se puede poner a cualquiera en
  cualquier puesto, pero jugar fuera de su posición natural le baja el
  rendimiento: un aro verde en la cancha indica que juega en lo suyo,
  amarillo una línea vecina (por ejemplo un mediocampista de defensor) y
  rojo bien fuera de lugar (por ejemplo un delantero de defensor, o
  cualquiera menos el
  arquero en el arco) — la valoración efectiva que usa en el partido baja
  según eso. Dentro de los mediocampistas hay además un rol interno
  (`contención` / `mixto` / `ofensivo`, ver `role` en `js/players.js`) que
  solo entra en juego en formaciones con línea de enganche (4-3-1-2,
  3-4-1-2, 4-2-3-1, 5-2-1-2, 3-2-5): ahí un mediocampista ofensivo puesto
  de "5" es amarillo (no es su lugar natural) y uno de marca puesto de
  enganche es directamente rojo — en formaciones sin esa línea, el
  mediocampo es una sola banda y el rol no cambia nada.

  De forma parecida, en defensa y ataque se distingue de qué lado de la
  cancha juega cada uno en la realidad (`posDetail` en `js/players.js`:
  lateral derecho/izquierdo, defensor central, extremo derecho/izquierdo,
  delantero centro — se muestra abreviado como LD/LI/DFC/ED/EI/DC en la
  lista de suplentes). Un lateral derecho puesto en un casillero de defensor
  central (o del lado izquierdo) rinde amarillo, no verde — se calcula solo
  según en qué punta o el medio de la línea quedó ese casillero
  (`Engine.slotWidthCategory`), sin necesidad de que la formación distinga
  explícitamente "lateral" de "central" como casilleros separados. Esto
  todavía no se investigó para todos los clubes (depende de tener
  `posDetail` cargado), así que un jugador sin ese dato sigue funcionando
  exactamente como antes.

  Algunos jugadores rinden bien en más de una posición real (`altPosDetail`
  en `js/players.js`, ej. Thiago Almada: mediocampista ofensivo o extremo
  izquierdo; Gonzalo Montiel: lateral derecho o izquierdo) — si lo ponés en
  un casillero que corresponde a una de esas posiciones alternativas, el
  ajuste mejora un escalón (rojo→amarillo, amarillo→verde) respecto de lo
  que daría su posición principal sola (`Engine.applyAltPositionBonus`). En
  DEF/DEL esto también respeta el lado de la cancha: la alternativa de
  Montiel es específicamente "lateral izquierdo", así que solo lo beneficia
  del lado izquierdo, no en cualquier casillero de defensa. Es un dato que
  se investiga puntualmente jugador por jugador, no algo que se cargue para
  todo un plantel de una.

  El mediocampo y la línea de enganches tampoco son siempre "una sola banda
  pareja": en formaciones puntuales, cada casillero espera un tipo de
  mediocampista distinto (`medShape`/`offShape` en FORMATIONS, `js/data.js`
  — ej. en la 4-1-4-1 la línea de enganches es volante izquierdo,
  mediapunta, mediapunta, volante derecho; en la 4-3-3 ofensiva el
  mediocampo es dos mixtos con uno más adelantado en el medio). Si el
  jugador que pusiste ahí no es exactamente ese tipo (ni lo tiene como
  posición alternativa), un casillero que daría verde por las reglas
  generales baja a amarillo (`Engine.applyShapeRefinement`). Todavía no
  está cargado para las 17 formaciones, se va completando de a una.

  La valoración de cada titular y su abreviatura de posición (LD, DFC, MCO,
  etc.) se muestran debajo del nombre en la cancha (y en la lista de
  suplentes) — sin sacar nada de lo que ya había.

  La cancha en sí es un único `<svg>` armado a mano en
  `renderSquadPanel`/`buildPitchSvg` (`js/ui.js`): la posición de cada
  jugador se calcula con aritmética simple, no con flexbox — hubo varias
  vueltas con enfoques basados en CSS que fallaban en algunos navegadores
  de celular (WebViews viejos que no soportan bien `width: max-content` u
  otras propiedades modernas), así que se optó por lo más viejo y
  compatible posible: coordenadas numéricas fijas, como una imagen. Si el
  ancho que necesita la formación no entra en el panel, se desliza con el
  dedo (`.pitch-scroll`) — los jugadores nunca se achican para "entrar".
  Cada línea se reparte proporcionalmente sobre la misma grilla que usa la
  fila más ancha (en vez de centrarse como un bloque aparte): así una dupla
  de mediocampistas queda en las dos puntas del ancho disponible en lugar
  de apilada justo debajo de otra línea del mismo tamaño (por ejemplo los
  dos enganches de una 4-2-2-2, que antes quedaban pegados en columna recta
  contra los dos delanteros de arriba).

## Simplificaciones a propósito (para no volverlo inmanejable)

El fútbol argentino real tiene reglas bastante más intrincadas y que además
cambian de temporada en temporada. Para que el simulador sea jugable, se
simplificó así:

- Cada torneo es a una sola rueda (no ida y vuelta), y los cuadros
  eliminatorios (playoffs, Copa Argentina, Final por el ascenso, Reducido)
  son a partido único, con definición por penales en caso de empate — en
  vez de partidos de ida y vuelta.
- El cuadro de la Copa Argentina son 32 equipos (30 de Primera + 2 de la
  Nacional), no los más de 200 clubes de todas las categorías que compiten
  en la vida real a través de fases regionales previas. Es la parte de la
  competencia que sí modelamos (desde los dieciseisavos), simplificando todo
  lo anterior.
- No se simula que un club argentino sea el actual campeón vigente de la
  Libertadores o la Sudamericana (eso requeriría simular esas copas
  también), así que esa excepción de cupo directo no está implementada.
- Los rivales tienen una "fuerza" abstracta basada en su reputación (no
  tienen plantel jugador por jugador como el tuyo): simular 66 planteles
  completos no aportaba nada jugable y sí mucho costo. Por eso, la división
  en la que NO jugás se resuelve entera e instantáneamente al arrancar el
  año (no hay nada interactivo ahí, pero sus resultados sí importan para los
  cupos a copas y los ascensos/descensos).
- Los nombres de jugadores son generados al azar, salvo que el club tenga
  un plantel real cargado (ver abajo).

## En progreso

- **Jugadores reales**: `js/players.js` tiene los planteles reales que ya
  se investigaron (nombre, edad, nacionalidad, posición general y detallada,
  dorsal, contrato, préstamos si aplica, y una valoración estimada), club
  por club. Un club sin entrada ahí sigue usando el generador de jugadores
  al azar — no rompe nada mientras se van sumando el resto. Ya está cargado:
  River Plate (27 jugadores). El flujo de carga cambió: en vez de investigar
  cada plantel a mano, el usuario le pide a otra IA (con acceso a internet
  real, algo que esta sesión de Claude Code no tiene disponible por la
  política de red del entorno) que arme la lista con un prompt puntual, y la
  pega acá para cargarla — mucho más rápido que sacarle captura a cada
  plantel.
- **Dorsales y colores reales**: se van completando junto con cada plantel.
  De River ya se cargaron los dorsales que confirmó el club para 2026 (los
  que no se pudieron confirmar con una fuente oficial quedan sin número, no
  se inventan) y su camiseta real (blanco con banda roja). Un jugador sin
  dorsal cargado sigue mostrando su valoración, como antes.
- **Escudos reales**: pendientes de que se sumen las imágenes (son marca
  registrada de cada club, así que no se pueden generar ni bajar de
  internet sin más).

## Stack técnico usado

**HTML + CSS + JavaScript puro, sin frameworks ni build.**

¿Por qué? Porque es lo más simple de correr y de explicar: no requiere
instalar Node ni compilar nada, se abre directo con doble click (en la línea
de Copero), y el progreso se guarda con `localStorage` del navegador sin
backend ni base de datos. Al no usar módulos de JavaScript, funciona incluso
abriendo el archivo desde el disco (`file://`).

## Estructura del proyecto

```
index.html    → esqueleto de la página
style.css     → estilos visuales
js/data.js    → "contenido" del juego: los 66 clubes, nombres de jugadores
                por país, decisiones posibles
js/players.js → planteles reales investigados club por club (se van
                sumando de a poco; sin entrada ahí = jugadores al azar)
js/engine.js  → toda la lógica: arma planteles, arma el calendario de cada
                zona, simula partidos y playoffs, aplica decisiones,
                administra ascensos/descensos y cupos a copas
js/ui.js      → dibuja las pantallas en base al estado del juego
```

## Estructura de datos básica

- **Club**: `{ id, name, division ('D1'|'D2'), zone ('A'|'B'), reputation }`.
  La reputación define la fuerza del club y el presupuesto inicial si lo
  elegís vos; `division`/`zone` van cambiando entre temporadas por los
  ascensos y descensos.
- **Jugador**: `{ id, name, pos, rating (0-100), age, nation }`. Solo tu
  propio plantel tiene jugadores individuales; los rivales usan la
  reputación de su club como fuerza abstracta.
- **Decisión**: `{ title, description, options: [{ label, tacticMod,
  moraleMod, note }] }`. Cada opción suma o resta a la fuerza táctica del
  próximo partido y al ánimo general (que se arrastra en el tiempo).
- **Temporada** (`season`): guarda las 4 zonas (D1-A, D1-B, D2-A, D2-B), cada
  una con su calendario y tabla, más en qué fecha estás y cuándo tocan
  fecha FIFA / Copa Argentina / mercado de pases.
- **Playoff / Copa**: objetos separados que trackean en qué ronda estás, quién
  sigue en carrera y quién salió campeón.

## Alcance futuro (no en esta versión)

- Ofertas de otros clubes para cambiarte de equipo con buenos resultados.
- Otras ligas además de la argentina.
- Versión app / mobile nativa.
- Escudos oficiales de cada club.
- Simulación más detallada de los planteles rivales.
