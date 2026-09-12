# Lo que falta

Lo que está hecho se cuenta en el README. Acá va lo que queda por delante, para
que no se pierda entre una charla y la otra.

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

### La edición actual de la Copa Argentina

Los 32 cruces de los treintaidosavos, en el orden de arriba hacia abajo del
cuadro, para que la primera temporada arranque con la copa real en curso. Con
los resultados al lado de los que ya se jugaron, si los hay.

### Los grupos reales de la Libertadores y la Sudamericana

Los 8 grupos de cada una, con sus 32 equipos, para sembrar la **primera**
temporada. Hoy las dos copas arrancan recién en la segunda, porque se juegan con
los clasificados del año anterior; con los grupos cargados a mano, la primera
edición de la carrera es la real y de ahí en adelante sale todo del sorteo
automático.

Las fases previas no hacen falta: si los grupos ya vienen armados, ese año se
saltean. Sí hacen falta los dos campeones vigentes, para la Recopa.

---

## 2. Sistema de partido en vivo

El cambio más grande que queda. Hoy el partido se resuelve de una: elegís la
charla táctica y aparece el resultado final.

La idea es que se simule **minuto a minuto**, rápido pero visible, y que se
frene en los eventos:

- Gol, amarilla, roja, lesión — cada uno con su animación.
- Poder hacer **cambios en vivo**, con el banco de 12 que ya está armado.
- Poder cambiar el planteo en el entretiempo o en el momento: pasar a algo más
  ofensivo si vas perdiendo, meterte atrás si estás ganando.

Conviene hacerlo **después** de la energía, porque los cambios en vivo recién
tienen sentido cuando un jugador cansado rinde menos y te obliga a sacarlo.

---

## 3. Energía y desgaste

Aprobado y sin empezar. Es lo próximo.

- Cada jugador tiene energía; jugar la gasta y descansar la recupera.
- Barra de color abajo de cada jugador: roja poca, naranja media, verde de 70
  para arriba.
- Pesa en el rendimiento desde el primer partido, y con la energía muy baja
  sube la chance de lesión.
- La edad manda para recuperarse (un pibe se repone más rápido) y el nivel para
  cuánto se gasta (un jugador de jerarquía se cansa menos).

Recién ahora tiene sentido: hasta que se arregló el calendario había un partido
por semana y rotar no servía de nada. Con copa entre semana y liga el fin de
semana, el desgaste pesa.

---

## 4. Detalles pendientes

- **Colores de las competencias.** La Sudamericana es negra con celeste y la
  Libertadores negra con dorado. Están cargados a ojo en
  `COLORES_COMPETICIONES` (`js/data.js`), esperando capturas para afinarlos.
- **El usuario gana demasiadas copas.** En 45 temporadas de prueba con clubes
  grandes salió campeón 8 veces de 42 copas jugadas. La fuerza del plantel del
  usuario pesa más que la de los rivales simulados (`copaStrength` usa
  `squadStrength()` para vos y una fórmula sobre el nivel para los demás).
- **El cuadro de la Copa Argentina en el celular se desliza para el costado.**
  64 equipos no entran a lo ancho de una pantalla de teléfono.
- **Los 4 descensos de la Primera Nacional** solo se miran para tu club. Los
  otros no se mueven, porque no hay una división más abajo de dónde traer
  reemplazos. Si algún día entra la tercera como división jugable, esto se
  completa.
