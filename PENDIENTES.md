# Lo que falta

Lo que está hecho se cuenta en el README. Acá va lo que queda por delante, para
que no se pierda entre una charla y la otra.

**Hay una auditoría completa en `auditoria.html`** (13/9/2026): estado real de
cada sistema, bugs, exploits, roadmap por fases y prioridades puntuadas. Este
archivo es la lista de tareas; ese otro es el diagnóstico y el orden.

El hallazgo principal de esa auditoría ya está resuelto: `clubStrength()`
ahora sale del plantel real de cada club. Lo que sigue abierto de ese frente
está más abajo, en "Planteles rivales que se muevan de verdad".

---

## 1. Datos que faltan cargar

Nada de esto se puede inventar: son datos reales que hay que pasar a mano.

### Jugadores de todos los clubes

Hoy solo Boca y River tienen plantel real cargado (`REAL_ROSTERS` en
`js/players.js`). Los otros 28 de Primera y los 36 de la Nacional juegan con
planteles generados al azar a partir de la reputación del club.

Por jugador hace falta: nombre, puesto (`POR`/`DEF`/`MED`/`DEL`), posición
detallada, edad, nacionalidad, dorsal, valoración y **proyección** (el techo al
que puede llegar). Si además vienen años de contrato, valor, sueldo y cláusula,
mejor; si no, se estiman con la escala que ya usa el resto.

### Clubes de la tercera división

Para que la Copa Argentina deje de ser "todos los de Primera + casi toda la
Nacional". Son **34 lugares** para repartir entre Primera B Metropolitana,
Primera C y Torneo Federal A.

Por club: nombre, división y un nivel del 1 al 5 (1 = Federal A flojo, 5 =
candidato de Primera Nacional). Sin el nivel, un club del Federal A le gana a
Boca demasiado seguido.

Van a ser un pozo **solo para la Copa Argentina**, como el pozo de los 103
clubes del continente: no son divisiones jugables, no hay ascenso ni descenso
hacia ellas.

### Escudos de la Nacional y de la tercera

Hoy solo están los 30 de Primera (`js/escudos.js`). El resto se dibuja con un
escudo genérico de iniciales, que se nota sobre todo en el cuadro de la Copa
Argentina. Se regeneran con `tools/generar-escudos.py` a partir de una carpeta
con los PNG.

### Escudos de los clubes del continente

Los 103 clubes de `js/internacional.js` —Flamengo, Peñarol, Nacional, Colo
Colo, todos— hoy se dibujan con el escudo genérico de iniciales. Se nota en la
fase de grupos y sobre todo en el cuadro de la Libertadores, donde la mitad de
los escudos son reales (los argentinos) y la otra mitad no.

Se cargan igual que los de Primera: una carpeta con los PNG y
`tools/generar-escudos.py`. Son 103, así que conviene hacerlos por país.

### La edición actual de la Copa Argentina

Los 32 cruces de los treintaidosavos, en el orden de arriba hacia abajo del
cuadro, para que la primera temporada arranque con la copa real en curso. Con
los resultados al lado de los que ya se jugaron, si los hay.

---

## 2. Planteles rivales que se muevan de verdad

Los clubes rivales ya tienen plantel en la simulación: envejecen, crecen hacia
su techo, se retiran y el club repone con juveniles. Falta lo que los haría un
mundo de verdad:

- **Que se guarden.** Hoy el plantel de un rival se regenera con la semilla
  cada vez que se lo mira. Lo único que persiste son los jugadores que vos le
  compraste (`s.mercado.fichados`). Hace falta guardar un *diff* por club —
  altas, bajas y cuánto creció cada jugador— en vez del plantel entero, para
  que el guardado no engorde.
- **Que los juveniles de reposición sean los mismos de un año al otro.** Hoy
  se sortean con el año adentro del id, así que el pibe que subió en la
  temporada 10 no es el mismo que está en la 11. Se arregla solo cuando los
  planteles se guarden.
- **Que compren y vendan entre ellos.** Es la IA de clubes nivel 1: cada club
  con su presupuesto, sus puestos flojos y su política. Depende de lo
  anterior.
- **Que se lesionen y acumulen amarillas**, como tu plantel.

---

## 3. Estadísticas que todavía faltan

Los jugadores del usuario ya llevan partidos, goles y asistencias. Falta:

- **Tabla de goleadores del torneo.** Hoy solo se sabe lo de tu plantel: los
  jugadores de los clubes rivales no juegan los partidos simulados, así que no
  hay a quién anotarle un gol. Sale gratis el día que la simulación de un
  partido entre dos rivales mire los planteles (punto 2).
- **Historial por temporada.** Hoy se guarda el año en curso y el acumulado de
  carrera, pero no queda "en 2027 hizo 22 goles".
- **Goles separados por competencia** (liga / Copa Argentina / internacionales).

---

## 4. Sistema de partido en vivo

El cambio más grande que queda. Hoy el partido se resuelve de una: elegís la
charla táctica y aparece el resultado final.

La idea es que se simule **minuto a minuto**, rápido pero visible, y que se
frene en los eventos:

- Gol, amarilla, roja, lesión — cada uno con su animación.
- Poder hacer **cambios en vivo**, con el banco de 12 que ya está armado.
- Poder cambiar el planteo en el entretiempo o en el momento: pasar a algo más
  ofensivo si vas perdiendo, meterte atrás si estás ganando.

La energía ya está, así que los cambios en vivo tienen sentido: un jugador
cansado rinde menos y te obliga a sacarlo. Lo que falta para esto es que el
partido produzca **hechos** y no solo un marcador: minuto, autor del gol,
amarillas, lesiones. Con esos hechos, dibujarlos en vivo es casi gratis.

---

## 5. La carrera del DT, lo que falta

Ya existen la confianza de la dirigencia, el despido, las ofertas de otros
clubes y el historial de dónde dirigiste. Falta:

- **Reputación propia del DT**, que hoy se estima contando títulos. Debería
  crecer también por sostenerse en un club, por buenas campañas sin título y
  por dirigir en Primera.
- **Renunciar**, para irse a un club que te tienta antes de que te echen.
- **Ofertas estando en funciones**: hoy solo te llaman cuando quedaste libre.
- **Que la dirigencia hable de otras cosas**: pedir un refuerzo, bancarte
  públicamente, poner un ultimátum con fecha.

---

## 5. Camisetas con los colores de cada club

En la plantilla cada jugador se muestra con una camisetita dibujada, pero hoy
es siempre la misma: toma los colores del club del usuario. La idea es que cada
club tenga la suya —la franja de River, el amarillo y azul de Boca, la de
Racing— y que se vea en todos lados donde aparece un jugador: el once, el
banco, la reserva y el mercado de pases.

Los colores ya están cargados en `data.js` (`colors` de cada club) y en
`internacional.js`, así que es trabajo de dibujo, no de datos: hay que darle a
`benchJerseySvg` y al dibujo del once una forma de camiseta por club (lisa,
a rayas verticales, con banda cruzada, con franja horizontal).

---

## 6. Detalles pendientes

- **El usuario todavía gana de más.** Con la fuerza de los rivales saliendo de
  su plantel, en 60 temporadas medidas los títulos de liga bajaron a la mitad
  (20 → 10) y las copas internacionales de 7 a 1 de 120. Sigue habiendo una
  ventaja estructural: vos podés comprar y los rivales no. Se termina de
  emparejar con la IA de clubes (punto 2).
- **Los 4 descensos de la Primera Nacional** solo se miran para tu club. Los
  otros no se mueven, porque no hay una división más abajo de dónde traer
  reemplazos. Si algún día entra la tercera como división jugable, esto se
  completa.
