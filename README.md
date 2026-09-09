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
- **Sin escudos por ahora**: se muestra solo el nombre de cada club. Se
  descartó generar escudos propios a pedido tuyo — cuando quieras sumar los
  oficiales, es cuestión de agregar las imágenes y un par de líneas en
  `ui.js` para mostrarlas.
- **Apertura y Clausura**: en Primera se juegan dos torneos por año, cada uno
  con fase de zonas a una rueda y playoffs de octavos a la final (16 mejores
  de la tabla combinada de esa edición), con una ventana de pases entre
  ambos. La Nacional juega un solo torneo anual a una rueda.
- **Copa Argentina**: al arrancar el año se sortea un cuadro de 32 (los 30
  clubes de Primera + 2 de la Nacional, garantizando que tu club esté
  adentro) y se juega en paralelo al Apertura (o al único torneo de la
  Nacional): dieciseisavos, octavos, cuartos, semifinal y final — las mismas
  rondas que tiene la competencia real desde la fase de los 32. El resto del
  cuadro se resuelve solo según la fuerza de cada club, así que siempre hay
  un campeón real al final, lo ganes vos o no.
- **Fechas FIFA**: pausan la liga; tus jugadores mejor valorados pueden ser
  convocados a su selección, con riesgo de lesión o de sumar experiencia.
- **Cupos a copas internacionales** (según el formato real de AFA): 6 a
  Libertadores —campeón del Apertura, campeón del Clausura, campeón de la
  Copa Argentina, 1º y 2º de la Tabla Anual, y un repechaje anclado en el
  9º— y 6 a Sudamericana (del 3º al 8º de la Tabla Anual). Siempre se
  saltea a un club ya clasificado por otra vía, y si un campeón desciende
  esa misma temporada pierde el cupo directo (se reparte igual por tabla).
- **Ascensos y descensos** (a fin de año, 2 de cada): en Primera descienden
  el último de la Tabla Anual y el club con peor promedio de puntos por
  partido de las últimas 3 temporadas (si coinciden, el segundo descenso
  pasa al siguiente peor promedio); en la Nacional ascienden el ganador de
  una Final directa entre los líderes de cada zona, y el ganador de un
  Torneo Reducido (2º a 8º de cada zona + el perdedor de la Final).
- **Mercado de pases**: en Primera, una ventana entre el Apertura y el
  Clausura; en la Nacional, una ventana a mitad de su único torneo. Justo
  antes de abrir el mercado, si algún jugador de tu plantel tiene el
  contrato por vencer a fin de esa temporada, te avisa para que decidas
  renovarlo (con costo) o dejarlo ir a fin de año.
- **Valoración de jugadores**: cada jugador tiene una valoración (0-100) que
  puede subir o bajar con el tiempo por edad (los jóvenes mejoran, los
  grandes bajan), por rendimiento en cancha y por tus decisiones de
  entrenamiento.
- **Penales**: elegís quién patea y la dirección (o la del arquero cuando el
  penal es en contra). En instancias de eliminación directa que terminan
  empatadas (Copa Argentina, playoffs, Final por el ascenso, Reducido), se
  resuelve por penales.
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
  mediocampo es una sola banda y el rol no cambia nada. La cancha en sí es
  un único `<svg>` armado a mano en
  `renderSquadPanel`/`buildPitchSvg` (`js/ui.js`): la posición de cada
  jugador se calcula con aritmética simple, no con flexbox — hubo varias
  vueltas con enfoques basados en CSS que fallaban en algunos navegadores
  de celular (WebViews viejos que no soportan bien `width: max-content` u
  otras propiedades modernas), así que se optó por lo más viejo y
  compatible posible: coordenadas numéricas fijas, como una imagen. Si el
  ancho que necesita la formación no entra en el panel, se desliza con el
  dedo (`.pitch-scroll`) — los jugadores nunca se achican para "entrar".

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
  se investigaron (nombre, edad, nacionalidad, contrato y una valoración
  estimada), club por club. Un club sin entrada ahí sigue usando el
  generador de jugadores al azar — no rompe nada mientras se van sumando
  el resto. Ya está cargado: River Plate (28 jugadores).
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
