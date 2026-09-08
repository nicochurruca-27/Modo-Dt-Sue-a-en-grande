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
  en cualquiera de las dos.
- **Sin escudos por ahora**: se muestra solo el nombre de cada club. Se
  descartó generar escudos propios a pedido tuyo — cuando quieras sumar los
  oficiales, es cuestión de agregar las imágenes y un par de líneas en
  `ui.js` para mostrarlas.
- **Liga**: fase de zonas a una rueda (con 1 fecha libre en Primera, porque
  15 es impar). En Primera, los 16 mejores de la tabla combinada de ambas
  zonas ("tabla anual") juegan playoffs de octavos a la final para coronar
  campeón del torneo.
- **Copa Argentina**: eliminación directa en paralelo a la liga, abierta a
  clubes de las dos divisiones, con rival sorteado al azar en cada ronda
  (dieciseisavos, octavos, cuartos, semifinal y final).
- **Fechas FIFA**: pausan la liga; tus jugadores mejor valorados pueden ser
  convocados a su selección, con riesgo de lesión o de sumar experiencia.
- **Cupos a copas internacionales**: campeón del torneo → Copa Libertadores
  (grupos); subcampeón y campeón de la Copa Argentina → Libertadores
  (previa); el resto de los cupos (Libertadores y Sudamericana) se reparten
  por la tabla anual, salteando a los clubes que ya clasificaron por otra
  vía — igual que en la vida real.
- **Ascensos y descensos**: a fin de temporada bajan los últimos 2 de cada
  zona de Primera y suben los primeros 2 de cada zona de la Nacional.
- **Mercado de pases**: una sola ventana, a mitad de temporada.
- **Valoración de jugadores**: cada jugador tiene una valoración (0-100) que
  puede subir o bajar con el tiempo por edad (los jóvenes mejoran, los
  grandes bajan), por rendimiento en cancha y por tus decisiones de
  entrenamiento.
- **Penales**: elegís quién patea y la dirección (o la del arquero cuando el
  penal es en contra). En instancias de eliminación directa que terminan
  empatadas, se resuelve por penales.

## Simplificaciones a propósito (para no volverlo inmanejable)

El fútbol argentino real tiene reglas bastante más intrincadas que cambian
de temporada en temporada. Para que el simulador sea jugable, se
simplificó así:

- El torneo es a una sola rueda (no ida y vuelta), y el playoff es a partido
  único (no ida y vuelta), con definición por penales en caso de empate.
- El descenso usa la tabla de la zona de esa única temporada, no el sistema
  real de promedios de varios años.
- La Copa Argentina solo trackea el recorrido de TU club: no se simula en
  segundo plano el resto del cuadro (son más de 60 equipos), así que si no
  la ganás vos, ese cupo a Libertadores se reparte por tabla anual en su
  lugar.
- Los rivales tienen una "fuerza" abstracta basada en su reputación (no
  tienen plantel jugador por jugador como el tuyo): simular 66 planteles
  completos no aportaba nada jugable y sí mucho costo.
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
