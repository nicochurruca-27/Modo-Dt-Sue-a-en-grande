# Modo DT: Sueño en Grande

Simulador de modo carrera como **director técnico** de un club de la Primera
División argentina. No se juegan los partidos: se resuelven solos según tu
plantel y las decisiones que vas tomando (táctica, prensa, vestuario,
fichajes). De vez en cuando aparece un penal donde elegís quién patea y hacia
dónde.

## Cómo jugarlo

No hace falta instalar nada ni tener cuenta. Abrí el archivo `index.html` con
cualquier navegador (doble click alcanza) y arrancá a dirigir. El progreso se
guarda solo en tu navegador (`localStorage`), así que si cerrás y volvés a
abrir seguís donde quedaste.

## Qué incluye esta versión

- **Primera División real**: los 30 clubes actuales (2 zonas de 15),
  verificados contra el sorteo de zonas 2026 de AFA. Es la única división
  que se juega partido a partido; las zonas se vuelven a sortear cada
  temporada para mantener siempre ese reparto.
- **Primera Nacional como reserva**: no se simula partido a partido. Es una
  lista de 36 clubes reales de la que salen al azar los 2 ascensos de cada
  año, y a la que van los 2 descensos — así el mundo del juego se siente
  vivo (nombres reales entrando y saliendo de Primera) sin tener que jugar
  una segunda división completa. Tu club nunca puede ser uno de los 2
  descensos, porque no habría dónde jugar la temporada siguiente; los otros
  29 sí compiten normalmente por el descenso.
- **Reputación vs. presupuesto**: son dos cosas separadas a propósito. La
  reputación define el nivel del plantel en cancha; el presupuesto
  (`budgetTier` en `data.js`) refleja la situación económica real del club,
  que puede no coincidir — por ejemplo San Lorenzo tiene un plantel de nivel
  medio pero un presupuesto bajo por su crisis institucional, mientras que
  Boca y River manejan presupuestos muy por encima del resto.
- **Sin escudos por ahora**: se muestra solo el nombre de cada club (a la
  espera de que se sumen escudos propios más adelante).
- **Apertura y Clausura**: se juegan dos torneos por año, cada uno con fase
  de zonas a una rueda y playoffs de octavos a la final (16 mejores de la
  tabla combinada de esa edición), con una ventana de pases entre ambos.
- **Copa Argentina**: al arrancar el año se sortea un cuadro de 32 (los 30
  clubes de Primera + 2 de la reserva, como "invitados" de una categoría
  menor) y se juega en paralelo al Apertura: dieciseisavos, octavos,
  cuartos, semifinal y final — las mismas rondas que tiene la competencia
  real desde la fase de los 32. El resto del cuadro se resuelve solo según
  la fuerza de cada club, así que siempre hay un campeón real al final, lo
  ganes vos o no.
- **Fechas FIFA**: pausan la liga; tus jugadores mejor valorados pueden ser
  convocados a su selección, con riesgo de lesión o de sumar experiencia.
- **Cupos a copas internacionales** (según el formato real de AFA): 6 a
  Libertadores —campeón del Apertura, campeón del Clausura, campeón de la
  Copa Argentina, 1º y 2º de la Tabla Anual, y un repechaje anclado en el
  9º— y 6 a Sudamericana (del 3º al 8º de la Tabla Anual). Siempre se
  saltea a un club ya clasificado por otra vía, y si un campeón desciende
  esa misma temporada pierde el cupo directo (se reparte igual por tabla).
- **Ascensos y descensos** (a fin de año, 2 de cada): descienden el último
  de la Tabla Anual y el club con peor promedio de puntos por partido de las
  últimas 3 temporadas (si coinciden, el segundo descenso pasa al siguiente
  peor promedio); ascienden 2 clubes al azar desde la reserva.
- **Mercado de pases**: una ventana entre el Apertura y el Clausura.
- **Valoración de jugadores**: cada jugador tiene una valoración (0-100) que
  puede subir o bajar con el tiempo por edad (los jóvenes mejoran, los
  grandes bajan), por rendimiento en cancha y por tus decisiones de
  entrenamiento.
- **Penales**: elegís quién patea y la dirección (o la del arquero cuando el
  penal es en contra). En instancias de eliminación directa que terminan
  empatadas (Copa Argentina, playoffs), se resuelve por penales.

## Simplificaciones a propósito (para no volverlo inmanejable)

El fútbol argentino real tiene reglas bastante más intrincadas y que además
cambian de temporada en temporada. Para que el simulador sea jugable, se
simplificó así:

- Cada torneo es a una sola rueda (no ida y vuelta), y los cuadros
  eliminatorios (playoffs, Copa Argentina) son a partido único, con
  definición por penales en caso de empate — en vez de partidos de ida y
  vuelta.
- La Primera Nacional no se juega partido a partido: es una reserva de
  nombres reales de la que salen ascensos al azar y a la que van los
  descensos. No tiene su propia tabla ni temporada.
- El cuadro de la Copa Argentina son 32 equipos (30 de Primera + 2 de la
  reserva), no los más de 200 clubes de todas las categorías que compiten
  en la vida real a través de fases regionales previas.
- No se simula que un club argentino sea el actual campeón vigente de la
  Libertadores o la Sudamericana (eso requeriría simular esas copas
  también), así que esa excepción de cupo directo no está implementada.
- Los rivales tienen una "fuerza" abstracta basada en su reputación (no
  tienen plantel jugador por jugador como el tuyo): simular 29 planteles
  completos no aportaba nada jugable y sí mucho costo.
- Los nombres de jugadores son generados al azar, no son futbolistas reales
  (por ahora — ver "en progreso" abajo).

## En progreso

- **Jugadores reales**: se está investigando plantel por plantel de cada
  club de Primera para reemplazar los nombres generados, actualizados a
  mediados de 2026. Es un trabajo grande que avanza de a poco.
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
js/data.js    → "contenido" del juego: los 30 clubes de Primera + 36 de
                reserva, nombres de jugadores por país, decisiones posibles
js/engine.js  → toda la lógica: arma planteles, arma el calendario de cada
                zona, simula partidos y playoffs, aplica decisiones,
                administra ascensos/descensos y cupos a copas
js/ui.js      → dibuja las pantallas en base al estado del juego
```

## Estructura de datos básica

- **Club**: `{ id, name, division ('D1'|'D2'), zone ('A'|'B'), reputation,
  budgetTier? }`. `division` D1 = Primera (jugable), D2 = reserva (no se
  simula). La reputación define la fuerza del club en cancha; `budgetTier`
  (opcional) su presupuesto real si es distinto de su nivel deportivo.
  `zone` solo importa para los D1 y se vuelve a sortear cada año.
- **Jugador**: `{ id, name, pos, rating (0-100), age, nation }`. Solo tu
  propio plantel tiene jugadores individuales; los rivales usan la
  reputación de su club como fuerza abstracta.
- **Decisión**: `{ title, description, options: [{ label, tacticMod,
  moraleMod, note }] }`. Cada opción suma o resta a la fuerza táctica del
  próximo partido y al ánimo general (que se arrastra en el tiempo).
- **Temporada** (`season`): guarda las 2 zonas de Primera (D1-A, D1-B), cada
  una con su calendario y tabla, más en qué fecha estás y cuándo tocan
  fecha FIFA / Copa Argentina / mercado de pases.
- **Bracket / Copa**: objetos que trackean en qué ronda de un cuadro
  eliminatorio estás (playoffs o Copa Argentina), quién sigue en carrera y
  quién salió campeón.

## Alcance futuro (no en esta versión)

- Ofertas de otros clubes para cambiarte de equipo con buenos resultados.
- Otras ligas además de la argentina.
- Versión app / mobile nativa.
- Cuentas de usuario (usuario/contraseña) para guardar el progreso en un
  servidor en vez de solo en el navegador — requiere sumar un backend.
- Visualización del partido (cancha, minuto a minuto) en vez de simulación
  directa al resultado.
