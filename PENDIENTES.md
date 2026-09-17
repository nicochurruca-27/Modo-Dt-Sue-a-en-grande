# Lo que falta

Lo que está hecho se cuenta en el README. Acá va lo que queda por delante, para
que no se pierda entre una charla y la otra.

Última revisión: 17/9/2026.

---

## 1. Datos que faltan cargar

Nada de esto se puede inventar: son datos reales que hay que pasar a mano. Es
lo único que no depende de programar.

### Jugadores de todos los clubes

Hoy solo Boca y River tienen plantel real cargado (`REAL_ROSTERS` en
`js/players.js`). Los otros 28 de Primera y los 36 de la Nacional juegan con
planteles generados al azar a partir de la reputación del club.

Por jugador hace falta: nombre, puesto (`POR`/`DEF`/`MED`/`DEL`), posición
detallada, edad, nacionalidad, dorsal, valoración y **proyección** (el techo al
que puede llegar). Si además vienen años de contrato, valor, sueldo y cláusula,
mejor; si no, se estiman con la escala que ya usa el resto.

### Escudos de la Nacional, de la tercera y del continente

Hoy solo están los 30 de Primera (`js/escudos.js`). El resto —los 36 de la
Nacional y los 103 clubes del continente en `js/internacional.js`— se dibuja
con un escudo genérico de iniciales. Se nota sobre todo en el cuadro de la
Libertadores, donde la mitad de los escudos son reales y la otra mitad no.

Se generan con `tools/generar-escudos.py` a partir de una carpeta con los PNG.

### Clubes de la tercera división

Para que la Copa Argentina deje de ser "todos los de Primera + casi toda la
Nacional". Son **34 lugares** para repartir entre Primera B Metropolitana,
Primera C y Torneo Federal A.

Por club: nombre, división y un nivel del 1 al 5. Van a ser un pozo **solo para
la Copa Argentina**: no son divisiones jugables.

### La edición actual de la Copa Argentina

Los 32 cruces de los treintaidosavos, en el orden de arriba hacia abajo del
cuadro, para que la primera temporada arranque con la copa real en curso.

---

## 2. La IA de los clubes rivales

Los clubes rivales ya tienen plantel, envejecen, se retiran, reponen con
juveniles y se compran y se venden entre ellos en cada ventana, y todo eso se
guarda. Falta subirle el nivel a esa IA, que hoy es a propósito simple:

- **Presupuesto**: hoy un club ficha sin que le cueste nada. Debería gastar
  solo lo que tiene, y vender para comprar.
- **Necesidades por puesto**: un club con tres arqueros y sin centrales sigue
  comprando delanteros.
- **Que el jugador opine**: si se quiere ir y lo retenés, que baje su ánimo y
  pida salir en la ventana siguiente.
- **Política de juveniles**: que un club de cantera grande suba pibes propios
  en vez de comprar.
- **Que los rivales se lesionen y acumulen amarillas**, como tu plantel.

Es lo que más emparejaría el juego: hoy vos podés comprar y ellos casi no.

---

## 3. Estadísticas

Los jugadores del usuario ya llevan partidos, goles y asistencias. Falta:

- **Tabla de goleadores del torneo.** Hoy los partidos entre dos rivales no
  miran los planteles, así que no hay a quién anotarle un gol. Sale casi gratis
  el día que esa simulación mire los planteles (punto 2).
- **Historial por temporada**: hoy queda el año en curso y el acumulado de
  carrera, pero no "en 2027 hizo 22 goles".
- **Goles separados por competencia** (liga / Copa Argentina / copas).

---

## 4. El partido minuto a minuto

Está hecho el segundo escalón: el partido se juega en **tramos** (dos tiempos,
y el tiempo se parte en dos si hay una lesión), genera eventos con minuto y
autor, frena en el entretiempo y en la lesión, y recalcula con lo que decidís.
Falta el minuto a minuto de verdad:

- **Los eventos tienen que salir en el momento**, no sortearse por tramo y
  después repartirse los minutos. Hay que recorrer los 90 minutos.
- **Poder intervenir en cualquier momento**: un cambio en el minuto 70, cambiar
  el esquema cuando te empatan.
- **Más tipos de evento**: expulsiones en vivo, penales dentro del juego (hoy
  el penal es una pantalla aparte), palos, ocasiones.
- **Los goles del rival con su autor** ya funcionan para los clubes argentinos.
  Los del continente no tienen plantel cargado y el gol queda a nombre del club.

---

## 5. La carrera del DT

Ya existen la confianza de la dirigencia, el despido, las ofertas de otros
clubes, el historial y la promesa de la presentación (que corre la vara con la
que te miden). Falta:

- **Reputación propia del DT**, que hoy se estima contando títulos. Debería
  crecer también por sostenerse en un club y por buenas campañas sin título.
- **Renunciar**, para irse a un club que te tienta antes de que te echen.
- **Ofertas estando en funciones**: hoy solo te llaman cuando quedaste libre.
- **Que la dirigencia hable de otras cosas**: pedir un refuerzo, bancarte
  públicamente, poner un ultimátum con fecha.

---

## 6. Camisetas con los colores de cada club

En la plantilla cada jugador se muestra con una camisetita, pero siempre con
los colores del club del usuario. La idea es que cada club tenga la suya —la
franja de River, el amarillo y azul de Boca— y que se vea en el once, el banco,
la reserva y el mercado.

Los colores ya están en `js/colores.js` (sacados del escudo con
`tools/generar-colores.py`) y los del continente en `internacional.js`, así que
es trabajo de dibujo y no de datos: hay que darle a `benchJerseySvg` y al once
una forma de camiseta por club (lisa, a rayas, con banda cruzada, con franja).

---

## 7. Economía, lo que quedó afinar

Cada club de Primera tiene su economía real en `js/finanzas.js` y de ahí salen
el presupuesto, el goteo semanal, la vara de sueldos y la recaudación. Queda:

- **La Primera Nacional sigue andando por categoría**: no hay datos publicados
  comparables de esos 36 clubes.
- **La recaudación de local no usa el aforo**, que está cargado y sería el dato
  natural.
- **Los socios tampoco se usan todavía**: están cargados para cuando la cuota
  social sea una fuente propia.

---

## 8. Detalles sueltos

- **La pantalla de elegir club** podría contar bastante más de cada club antes
  de que te decidas (hoy la reputación son cinco estrellitas y nada más).
- **Los 4 descensos de la Primera Nacional** solo se miran para tu club: no hay
  una división más abajo de donde traer reemplazos.
- **El usuario todavía gana de más**, aunque mucho menos que antes. Se termina
  de emparejar con la IA de clubes (punto 2).

---

## 9. Lo grande que viene: más de una liga

La idea es que el juego deje de ser solo la liga argentina. Antes de escribir
una línea conviene tener presente qué del motor es argentino y qué no:

- **Es genérico y sirve tal cual**: el partido (fuerza, formaciones, planteos,
  entretiempo, lesiones, energía), el mercado entero (estados, ofertas,
  préstamos, cláusulas, libres), la economía, la carrera del DT, las noticias,
  el desarrollo de jugadores y el motor de llaves (sirve para cualquier copa).
- **Es argentino y hay que parametrizar**: dos zonas de 15 con interzonal,
  Apertura y Clausura, la Tabla Anual, los playoffs, la Copa Argentina, el
  calendario que arranca el 1° de enero, y los cupos a Libertadores y
  Sudamericana. En el código son ~25 lugares que miran `D1`/`D2`, ~38 que miran
  `apertura`/`clausura` y ~126 que nombran a las copas.

El camino que menos duele es **un formato de liga como dato**, no como código:
un archivo por país con sus divisiones, cuántos equipos, si hay zonas, si hay
playoffs, cuántos descienden, qué copas juega y cómo reparte los cupos. El
motor lee ese formato y arma la temporada. Los 103 clubes del continente ya
están cargados con país, nivel, estadio y colores, así que Sudamérica es el
primer paso natural.
