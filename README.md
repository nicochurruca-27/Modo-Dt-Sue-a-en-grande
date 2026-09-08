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

- **Primera División y Primera Nacional**: 30 clubes reales en Primera (2
  zonas de 15) y 36 en la Nacional (2 zonas de 18). Podés arrancar tu carrera
  en cualquiera de las dos. Las zonas se vuelven a sortear cada temporada
  (como en la vida real) para mantener siempre ese reparto.
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
  Clausura; en la Nacional, una ventana a mitad de su único torneo.
- **Valoración de jugadores**: cada jugador tiene una valoración (0-100) que
  puede subir o bajar con el tiempo por edad (los jóvenes mejoran, los
  grandes bajan), por rendimiento en cancha y por tus decisiones de
  entrenamiento.
- **Penales**: elegís quién patea y la dirección (o la del arquero cuando el
  penal es en contra). En instancias de eliminación directa que terminan
  empatadas (Copa Argentina, playoffs, Final por el ascenso, Reducido), se
  resuelve por penales.

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
- Los nombres de jugadores son generados al azar, no son futbolistas reales.

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
