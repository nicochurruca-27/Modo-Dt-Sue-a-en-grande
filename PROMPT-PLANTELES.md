# Prompt para investigar los planteles reales de los clubes

Este archivo tiene tres cosas:

1. **Qué dato lleva cada jugador** en el juego, campo por campo, con los
   vocabularios exactos que entiende el código.
2. **El plantel de Boca tal como está hoy adentro del juego** — los 31
   jugadores con todos sus datos. Es el modelo: un club nuevo tiene que
   quedar igual de completo.
3. **Dos prompts para copiar y pegar**: uno para pedirle a otra IA el
   plantel completo de un club (Racing, Independiente, el que sea) y otro
   para pedirle sólo las fechas de nacimiento de los jugadores que ya están
   cargados.
4. **De dónde bajar los datos en bloque**, que es el camino para cargar ligas
   enteras en vez de un club por vez.

Los datos terminan en `js/players.js`, en `REAL_ROSTERS`. Un club que no
tiene entrada ahí sigue usando el generador de jugadores al azar.

---

## Lo que ya nos pasó una vez (leer antes de usar los prompts)

La primera tanda de 58 fechas de nacimiento vino de Gemini. De esas, **nueve
estaban mal**, y las nueve traían "Fuente: Transfermarkt" al lado. No era
cierto: la IA no había entrado ahí. Dos de esas nueve ni siquiera erraban el
día, erraban el año (Bacidalupe y Lucas Silva son de 2007 y venían como 2006).

Los nueve errores son todos juveniles. Ninguno es un jugador conocido. Eso no
es casualidad: de Paredes o de Otamendi la fecha está escrita grande en mil
páginas, mientras que la de un pibe de Reserva aparece sola, metida en el
medio de un párrafo de un diario chico ("el entrerriano de 19 años nacido en
El Ombú"). Ahí el modelo no la lee: la deduce, y le erra.

Tres cosas que salieron de esto:

1. **Preguntarle de nuevo a la misma IA no sirve de control.** Va a repetir su
   propia invención con la misma seguridad. El buscador de Google con su
   resumen arriba y Gemini son el mismo modelo: no son dos fuentes.
2. **Pedir el link, no el nombre de la fuente.** "Transfermarkt" lo escribe
   cualquiera; una URL se abre y se mira.
3. **A los juveniles hay que chequearlos aparte, uno por uno**, contra una
   nota de diario que los nombre. Los jugadores con trayectoria vinieron todos
   bien: 49 de 49.

Y el motivo de fondo: un dato inventado es peor que un dato faltante. La fecha
que falta el juego la reemplaza sola con el reloj viejo (la edad con la que
entró más las temporadas que pasaron); una fecha falsa no la corrige nadie.

---

## 1. Qué datos lleva cada jugador

### Obligatorios

| Campo | Tipo | Para qué lo usa el juego |
| --- | --- | --- |
| `name` | texto | Nombre y apellido como se lo conoce. Es la clave: `REAL_LINEUPS` referencia al jugador por el nombre exacto, con tildes y todo. |
| `pos` | `POR` \| `DEF` \| `MED` \| `DEL` | La posición gruesa. Define en qué línea de la cancha puede jugar y cómo se agrupa el plantel. |
| `posDetail` | ver vocabulario abajo | La posición fina. Decide el color del aro en la cancha (verde/amarillo/rojo) según de qué lado cayó el casillero, y se muestra abreviada (LD, DFC, MCO…) en la cancha y en la lista de suplentes. |
| `age` | número | Edad hoy. Mueve la curva de valoración (los pibes suben, los grandes bajan) y es el respaldo mientras no haya `birthDate`. |
| `nation` | `ARG` \| `URU` \| `BRA` \| `PAR` \| `COL` \| `CHI` \| `ECU` | La banderita al lado del nombre. Un código que no esté en esa lista no rompe nada, simplemente no dibuja bandera hasta que le agreguemos el diseño. |
| `contractYears` | número | Temporadas que le quedan **contando la actual**: vence en 2026 → 1, en 2028 → 3. Cuando llega a 0 hay que renovarlo o se va libre. |
| `rating` | 0-100 | La valoración. Es una estimación (no existe una base pública tipo "overall"), pero tiene que respetar las diferencias reales entre jugadores del mismo plantel. |
| `number` | número | El dorsal real. |

### Opcionales (los que estén, mejor)

| Campo | Tipo | Para qué lo usa el juego |
| --- | --- | --- |
| `birthDate` | `'AAAA-MM-DD'` | **La fuente de verdad de la edad.** Si está, el juego calcula la edad contra el almanaque y la sube sola el día del cumpleaños. Es el dato que más falta hoy. |
| `altPosDetail` | lista de `posDetail` | Otras posiciones donde el jugador rinde bien de verdad. Si lo parás ahí, el ajuste mejora un escalón (rojo→amarillo, amarillo→verde). |
| `role` | `contención` \| `mixto` \| `ofensivo` | **Sólo para MED.** Sale directo del `posDetail` (defensivo→contención, mixto→mixto, ofensivo→ofensivo). |
| `projection` | 0-100 | El techo: hasta dónde puede llegar si le das minutos. En un pibe de 19 puede estar 15 puntos arriba del rating; en un jugador de 34 tiene que estar abajo. |
| `value` | dólares | Valor de mercado real. Si está, el juego lo usa en vez de calcularlo con su fórmula. |
| `salary` | dólares/año | Sueldo anual. Se usa para el costo de renovación. |
| `clause` | dólares | Cláusula de rescisión, si tiene. |
| `transferState` | `Intocable` \| `Retenido` \| `Transferible` \| `Fin de contrato cercano` | Cómo lo trata el club. |
| `loanFrom` / `loanUntil` | id de club / año | Si está a préstamo, de quién es y hasta cuándo. Por ahora es sólo información: el juego todavía no simula la vuelta del préstamo. |

### Los vocabularios cerrados

`posDetail` — hay que usar exactamente uno de estos quince, en minúscula y
con tilde donde va:

```
arquero
lateral derecho          lateral izquierdo
carrilero derecho        carrilero izquierdo
defensor central
mediocampista defensivo  mediocampista mixto     mediocampista ofensivo
volante por derecha      volante por izquierda
extremo derecho          extremo izquierdo
delantero centro         segundo delantero
```

Una cosa importante que no es obvia: **los extremos van como `DEL`, no como
`MED`.** En el juego los puestos abiertos de arriba son de delantero. Alan
Velasco está cargado así en Boca justamente por eso.

---

## 2. El plantel de Boca tal como está hoy en el juego

31 jugadores. Es el club más completo que hay cargado: tiene los campos
económicos, la proyección y el estado de transferencia. **Ninguno tiene
`birthDate` todavía** — esos son los cumpleaños que hay que buscar.


| Nº | Jugador | Pos | Posición detallada | Alternativas | Edad | Nac | Contrato | Val | Proy | Valor | Sueldo | Cláusula | Estado |
| ---: | --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Álvaro Montero | POR | arquero | — | 31 | COL | 5 | 75 | 75 | 3 M | 1 M | — | Retenido |
| 12 | Leandro Brey | POR | arquero | — | 23 | ARG | 4 | 66 | 76 | 5 M | 450 k | 15 M | Retenido |
| 30 | Javier García | POR | arquero | — | 39 | ARG | 1 | 60 | 58 | 150 k | 300 k | — | Fin de contrato cercano |
| 2 | Lautaro Di Lollo | DEF | defensor central | — | 22 | ARG | 4 | 69 | 78 | 7 M | 500 k | 20 M | Retenido |
| 3 | Lautaro Blanco | DEF | lateral izquierdo | carrilero izquierdo | 27 | ARG | 3 | 73 | 74 | 4.5 M | 700 k | — | Retenido |
| 4 | Nicolás Figal | DEF | defensor central | — | 32 | ARG | 2 | 70 | 68 | 1 M | 900 k | — | Retenido |
| 17 | Leandro Lozano | DEF | lateral derecho | carrilero derecho | 27 | URU | 5 | 72 | 74 | 3.5 M | 600 k | 15 M | Retenido |
| 24 | Dylan Gorosito | DEF | lateral derecho | carrilero derecho | 20 | ARG | 5 | 64 | 76 | 4.5 M | 250 k | 12 M | Retenido |
| 26 | Marco Pellegrino | DEF | defensor central | — | 24 | ARG | 4 | 73 | 79 | 6 M | 600 k | 18 M | Retenido |
| 32 | Ayrton Costa | DEF | defensor central | lateral izquierdo | 27 | ARG | 3 | 70 | 73 | 3.5 M | 600 k | — | Retenido |
| 42 | Facundo Herrera | DEF | defensor central | — | 20 | ARG | 3 | 60 | 73 | 1 M | 150 k | 8 M | Retenido |
| 5 | Leandro Paredes | MED | mediocampista defensivo | mediocampista mixto | 32 | ARG | 3 | 81 | 81 | 6 M | 2.2 M | 20 M | Intocable |
| 6 | Rodrigo Battaglia | MED | mediocampista defensivo | defensor central, mediocampista mixto | 35 | ARG | 2 | 70 | 68 | 800 k | 850 k | — | Retenido |
| 7 | Carlos Palacios | MED | mediocampista ofensivo | extremo derecho, extremo izquierdo | 26 | CHI | 4 | 73 | 78 | 5 M | 900 k | 18 M | Retenido |
| 8 | Tomás Belmonte | MED | mediocampista mixto | mediocampista defensivo | 28 | ARG | 3 | 72 | 74 | 3 M | 750 k | — | Retenido |
| 10 | Tomás Aranda | MED | mediocampista ofensivo | extremo izquierdo, mediocampista mixto | 19 | ARG | 4 | 70 | 77 | 6.5 M | 180 k | 15 M | Retenido |
| 15 | Williams Alarcón | MED | mediocampista mixto | mediocampista defensivo | 25 | CHI | 3 | 71 | 75 | 3.5 M | 750 k | — | Retenido |
| 18 | Milton Delgado | MED | mediocampista defensivo | mediocampista mixto | 21 | ARG | 4 | 75 | 80 | 10 M | 250 k | 20 M | Intocable |
| 20 | Alan Velasco | DEL | extremo izquierdo | mediocampista ofensivo, extremo derecho | 24 | ARG | 3 | 76 | 80 | 6.5 M | 1.1 M | 20 M | Retenido |
| 23 | Camilo Rey Domenech | MED | mediocampista mixto | mediocampista defensivo | 20 | ARG | 3 | 61 | 75 | 2.5 M | 180 k | 10 M | Retenido |
| 25 | Santiago Ascacíbar | MED | mediocampista defensivo | mediocampista mixto | 29 | ARG | 4 | 76 | 76 | 5 M | 1 M | 20 M | Intocable |
| 27 | Malcom Braida | MED | volante por izquierda | lateral izquierdo, extremo izquierdo | 29 | ARG | 3 | 70 | 72 | 3 M | 650 k | — | Retenido |
| 33 | Lautaro Mendieta | MED | mediocampista mixto | extremo derecho, mediocampista ofensivo | 20 | ARG | 4 | 61 | 75 | 1.2 M | 150 k | 10 M | Retenido |
| 9 | Milton Giménez | DEL | delantero centro | — | 30 | ARG | 2 | 73 | 72 | 3 M | 750 k | 15 M | Retenido |
| 11 | Ángel Romero | DEL | extremo derecho | segundo delantero, extremo izquierdo | 34 | PAR | 1 | 69 | 66 | 800 k | 700 k | — | Fin de contrato cercano |
| 13 | Enner Valencia | DEL | delantero centro | segundo delantero | 36 | ECU | 2 | 72 | 70 | 1.2 M | 1.2 M | — | Retenido |
| 16 | Miguel Merentiel | DEL | delantero centro | segundo delantero, extremo izquierdo | 30 | URU | 2 | 79 | 78 | 6 M | 1.1 M | 20 M | Intocable |
| 19 | Leonel Flores | DEL | extremo derecho | extremo izquierdo, segundo delantero | 19 | ARG | 3 | 69 | 79 | 4.5 M | 160 k | 12 M | Retenido |
| 22 | Sebastián Villa | DEL | extremo derecho | extremo izquierdo, segundo delantero | 30 | COL | 5 | 77 | 77 | 6.5 M | 1.2 M | 15 M | Intocable |
| 28 | Adam Bareiro | DEL | delantero centro | segundo delantero | 30 | PAR | 3 | 71 | 71 | 2.8 M | 700 k | — | Retenido |
| 44 | Rodrigo Bacidalupe | DEL | delantero centro | segundo delantero | 19 | ARG | 2 | 62 | 78 | 1.5 M | 150 k | 10 M | Retenido |

El otro club cargado es **River**, con 27 jugadores, pero más flaco: tiene
las posiciones, los dorsales y los contratos, y no tiene los datos
económicos ni la proyección.

Así se ve una fila en el código (`js/players.js`):

```js
{ name: 'Milton Delgado', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['mediocampista mixto'], age: 21, nation: 'ARG', contractYears: 4, rating: 75, projection: 80, number: 18, value: 10000000, salary: 250000, clause: 20000000, transferState: 'Intocable', role: 'contención' },
```

---

## 3. Prompt A — pedir el plantel completo de un club

Cambiá el nombre del club en la primera línea y copiá de acá para abajo.

> Necesito el plantel completo y real de **Racing Club** (Primera División
> de Argentina, temporada 2026) para cargarlo en un juego de manager.
>
> **Buscá en internet. No contestes de memoria.** Si un dato no lo
> encontrás, poné `null` y aclarálo; no lo estimes ni lo inventes. Prefiero
> una ficha incompleta a una inventada.
>
> Quiero **todos** los jugadores del plantel profesional, no sólo los
> titulares: arqueros, defensores, mediocampistas y delanteros, incluidos
> los juveniles que ya subieron a Primera y los que están a préstamo (en
> los dos sentidos: los que vinieron y los que se fueron, marcados).
>
> Para **cada** jugador quiero, en este orden:
>
> 1. `name` — nombre y apellido como se lo conoce, con tildes.
> 2. `birthDate` — fecha de nacimiento en formato `AAAA-MM-DD`. Este dato
>    es el más importante de todos: si no lo encontrás, poné `null`.
> 3. `pos` — una de: `POR`, `DEF`, `MED`, `DEL`. Atención: **los extremos
>    van como `DEL`**, no como `MED`.
> 4. `posDetail` — la posición real más específica, usando exactamente una
>    de estas quince, en minúscula y con tilde: arquero, lateral derecho,
>    lateral izquierdo, carrilero derecho, carrilero izquierdo, defensor
>    central, mediocampista defensivo, mediocampista mixto, mediocampista
>    ofensivo, volante por derecha, volante por izquierda, extremo derecho,
>    extremo izquierdo, delantero centro, segundo delantero.
> 5. `altPosDetail` — lista (del mismo vocabulario) con las otras
>    posiciones donde el jugador rinde bien **de verdad**, no donde podría
>    jugar en teoría. Si no tiene, omitilo.
> 6. `age` — la edad que tiene hoy.
> 7. `nation` — código de tres letras: ARG, URU, BRA, PAR, COL, CHI, ECU, o
>    el que corresponda.
> 8. `contractYears` — temporadas que le quedan **contando 2026**: si el
>    contrato vence a fin de 2026 va 1; si vence en 2028 van 3. Decime
>    también el año exacto de vencimiento aparte, para poder controlarlo.
> 9. `rating` — valoración estimada de 0 a 100. Sé honesto con la escala:
>    un titular de selección ronda 80, un titular bueno de Primera 72-77,
>    un suplente 65-70, un pibe recién subido 58-63. Lo que más me importa
>    es que las diferencias **dentro del plantel** sean correctas.
> 10. `projection` — hasta dónde puede llegar. En un pibe de 19 puede estar
>     12-15 puntos arriba del rating; en uno de 34 tiene que estar abajo.
> 11. `number` — el dorsal real que usa.
> 12. `value` — valor de mercado en dólares (Transfermarkt sirve).
> 13. `salary` — sueldo anual estimado en dólares.
> 14. `clause` — cláusula de rescisión en dólares, si tiene. Si no, omitilo.
> 15. `transferState` — una de: `Intocable`, `Retenido`, `Transferible`,
>     `Fin de contrato cercano`.
> 16. `role` — **sólo si `pos` es `MED`**: `contención` si el `posDetail`
>     es defensivo, `mixto` si es mixto o volante por un costado,
>     `ofensivo` si es ofensivo.
> 17. `loanFrom` y `loanUntil` — sólo si está a préstamo: de qué club es y
>     hasta qué año.
>
> **Formato de la respuesta:** un array de objetos JavaScript, una línea
> por jugador, con las claves en ese orden y exactamente con esos nombres.
> Así:
>
> ```js
> racing: [
>   { name: 'Facundo Cambeses', birthDate: '1997-03-16', pos: 'POR', posDetail: 'arquero', age: 29, nation: 'ARG', contractYears: 2, rating: 74, projection: 74, number: 1, value: 4000000, salary: 800000, transferState: 'Retenido' },
>   { name: 'Santiago Sosa', birthDate: '1999-05-07', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['defensor central'], age: 27, nation: 'ARG', contractYears: 3, rating: 74, projection: 76, number: 5, value: 5000000, salary: 900000, clause: 18000000, transferState: 'Retenido', role: 'contención' },
> ]
> ```
>
> Después del array, aparte, dame dos cosas:
>
> - **La formación habitual del equipo** (`433`, `442`, `4231`, `352`…) y
>   el once titular, como una lista de once nombres escritos **igual** que
>   en el array, ordenados: arquero, defensa de derecha a izquierda,
>   mediocampo, ataque.
> - **Una tabla de control** con una fila por jugador y estas columnas:
>   nombre, fecha de nacimiento, **el link exacto de donde sacaste la fecha**
>   (la URL completa, no el nombre del sitio) y la fecha en que lo
>   consultaste, y "sí/no" si el dorsal y el vencimiento de contrato los
>   pudiste confirmar. Marcá claramente las filas donde algo quedó en `null`.
>   Si de un jugador no podés dar la URL, poné la fecha en `null`: prefiero
>   el hueco.

---

## 4. Prompt B — sólo los cumpleaños de los que ya están cargados

**Ya se usó: los 58 jugadores de Boca y River tienen su fecha cargada.** Queda
acá porque sirve igual para el próximo club que se cargue sin fechas, o para
volver a controlar las que ya están.

> Necesito la **fecha de nacimiento exacta** de estos futbolistas de Boca
> Juniors y River Plate (plantel 2026). **Buscá en internet, no contestes
> de memoria.** Si de alguno no encontrás la fecha con una fuente concreta,
> poné `null`: prefiero el hueco antes que una fecha inventada.
>
> Te paso el nombre, el dorsal, el puesto, la edad que tengo anotada y la
> nacionalidad, para que no confundas homónimos. Si la fecha que encontrás
> no coincide con la edad que te paso, decímelo en vez de acomodarla.
>
> Devolveme una tabla con: nombre exacto como te lo paso, fecha de
> nacimiento en formato `AAAA-MM-DD`, edad que resulta de esa fecha al 30
> de junio de 2026 (que es cuando se investigaron las edades que te paso) y
> **el link exacto** de donde sacaste cada fecha: la URL completa, no el
> nombre del sitio. Sin link, la fecha va en `null`.
>
> **Boca Juniors (31)**
>
> ```
> Álvaro Montero (1, arquero, 31 años, COL)
> Leandro Brey (12, arquero, 23 años, ARG)
> Javier García (30, arquero, 39 años, ARG)
> Lautaro Di Lollo (2, defensor central, 22 años, ARG)
> Lautaro Blanco (3, lateral izquierdo, 27 años, ARG)
> Nicolás Figal (4, defensor central, 32 años, ARG)
> Leandro Lozano (17, lateral derecho, 27 años, URU)
> Dylan Gorosito (24, lateral derecho, 20 años, ARG)
> Marco Pellegrino (26, defensor central, 24 años, ARG)
> Ayrton Costa (32, defensor central, 27 años, ARG)
> Facundo Herrera (42, defensor central, 20 años, ARG)
> Leandro Paredes (5, mediocampista defensivo, 32 años, ARG)
> Rodrigo Battaglia (6, mediocampista defensivo, 35 años, ARG)
> Carlos Palacios (7, mediocampista ofensivo, 26 años, CHI)
> Tomás Belmonte (8, mediocampista mixto, 28 años, ARG)
> Tomás Aranda (10, mediocampista ofensivo, 19 años, ARG)
> Williams Alarcón (15, mediocampista mixto, 25 años, CHI)
> Milton Delgado (18, mediocampista defensivo, 21 años, ARG)
> Alan Velasco (20, extremo izquierdo, 24 años, ARG)
> Camilo Rey Domenech (23, mediocampista mixto, 20 años, ARG)
> Santiago Ascacíbar (25, mediocampista defensivo, 29 años, ARG)
> Malcom Braida (27, volante por izquierda, 29 años, ARG)
> Lautaro Mendieta (33, mediocampista mixto, 20 años, ARG)
> Milton Giménez (9, delantero centro, 30 años, ARG)
> Ángel Romero (11, extremo derecho, 34 años, PAR)
> Enner Valencia (13, delantero centro, 36 años, ECU)
> Miguel Merentiel (16, delantero centro, 30 años, URU)
> Leonel Flores (19, extremo derecho, 19 años, ARG)
> Sebastián Villa (22, extremo derecho, 30 años, COL)
> Adam Bareiro (28, delantero centro, 30 años, PAR)
> Rodrigo Bacidalupe (44, delantero centro, 19 años, ARG)
> ```
>
> **River Plate (27)**
>
> ```
> Ezequiel Centurión (33, arquero, 29 años, ARG)
> Santiago Beltrán (41, arquero, 21 años, ARG)
> Jeremías Martinet (57, arquero, 21 años, ARG)
> Tobías Ramírez (2, defensor central, 19 años, ARG)
> Francisco Ortega (3, lateral izquierdo, 27 años, ARG)
> Lautaro Rivero (13, defensor central, 22 años, ARG)
> Giovanni González (20, lateral derecho, 31 años, URU)
> Marcos Acuña (21, lateral izquierdo, 34 años, ARG)
> Lucas Martínez Quarta (28, defensor central, 30 años, ARG)
> Gonzalo Montiel (29, lateral derecho, 29 años, ARG)
> Nicolás Otamendi (30, defensor central, 38 años, ARG)
> Facundo González (31, defensor central, 20 años, ARG)
> Juan Carlos Portillo (5, defensor central, 26 años, ARG)
> Aníbal Moreno (6, mediocampista defensivo, 27 años, ARG)
> Mauro Arambarri (8, mediocampista mixto, 30 años, URU)
> Fausto Vera (15, mediocampista defensivo, 26 años, ARG)
> Thiago Almada (23, mediocampista ofensivo, 25 años, ARG)
> Juan Cruz Meza (24, mediocampista ofensivo, 18 años, ARG)
> Tomás Galván (26, mediocampista ofensivo, 26 años, ARG)
> Lucas Silva (44, mediocampista defensivo, 19 años, ARG)
> Tobías Andrada (50, mediocampista mixto, 19 años, ARG)
> Lautaro Pereyra (25, mediocampista mixto, 18 años, ARG)
> Sebastián Driussi (9, delantero centro, 30 años, ARG)
> Ángel Correa (10, delantero centro, 31 años, ARG)
> Lucas Beltrán (18, delantero centro, 25 años, ARG)
> Rafael Santos Borré (19, delantero centro, 30 años, COL)
> Agustín Ruberto (32, delantero centro, 20 años, ARG)
> ```

---

## 5. De dónde sacar los datos en bloque (para cargar ligas enteras)

Pedirle club por club a una IA sirve para uno o dos clubes. Para las 64
entradas que faltan del fútbol argentino —y más todavía para las ligas del
mundo— conviene una base de datos y un conversor.

### La que mejor encaja: las bases del EA Sports FC / SoFIFA

Son volcados del videojuego con licencia. Encajan casi uno a uno con lo que
necesita el juego, y —esto es lo importante— **son la única fuente pública que
trae algo equivalente a `rating` y `projection`**, que es justamente lo que no
se puede investigar en un diario.

| Campo nuestro | Columna del CSV | Cómo se arma |
| --- | --- | --- |
| `name` | `short_name` / `long_name` | Ojo con las tildes y con cómo se lo conoce acá. |
| `birthDate` | `dob` | Ya viene `AAAA-MM-DD`. |
| `age` | `age` | Mejor recalcularla de `dob` al 1 de enero del año de arranque. |
| `pos` | `player_positions` (la primera) | GK→POR · CB/LB/RB/LWB/RWB→DEF · CDM/CM/CAM/LM/RM→MED · LW/RW/ST/CF→**DEL** |
| `posDetail` | `player_positions` (la primera) | Ver la tabla de abajo. |
| `altPosDetail` | `player_positions` (las demás) | Misma tabla. |
| `nation` | `nationality_name` | Pasar a código de tres letras. |
| `contractYears` | `club_contract_valid_until` | Año de vencimiento − año de arranque + 1. |
| `rating` | `overall` | Tal cual. |
| `projection` | `potential` | Tal cual. |
| `number` | `club_jersey_number` | Tal cual. |
| `value` | `value_eur` | Tal cual (o pasado a dólares). |
| `salary` | `wage_eur` | **Ojo: el sueldo del CSV es semanal.** Anual = × 52. |
| `clause` | `release_clause_eur` | Tal cual. |
| `role` | — | Se deriva del `posDetail`: defensivo→contención, mixto o por un costado→mixto, ofensivo→ofensivo. |
| `transferState` | — | No está en ninguna base. Es criterio nuestro. |
| `loanFrom` / `loanUntil` | `club_loaned_from` | Solo en algunas ediciones. |

La traducción de puestos, que es la parte que hay que hacer con cuidado:

```
GK  → arquero                    CDM → mediocampista defensivo
RB  → lateral derecho            CM  → mediocampista mixto
LB  → lateral izquierdo          CAM → mediocampista ofensivo
RWB → carrilero derecho          RM  → volante por derecha
LWB → carrilero izquierdo        LM  → volante por izquierda
CB  → defensor central           RW  → extremo derecho
ST  → delantero centro           LW  → extremo izquierdo
CF  → segundo delantero
```

Dónde están: en Kaggle, buscando "EA FC player database". Por ejemplo
[EA FC25 Player Database](https://www.kaggle.com/datasets/mexwell/ea-fc25-player-database),
[EA Sports FC 25 database, ratings and stats](https://www.kaggle.com/datasets/nyagami/ea-sports-fc-25-database-ratings-and-stats)
o [el volcado de SoFIFA](https://www.kaggle.com/datasets/aniss7/fifa-player-data-from-sofifa-2025-06-03),
que es el que suele traer las columnas con estos nombres exactos.

**Los tres límites que tiene esta fuente:**

1. **La Primera Nacional no está.** El videojuego tiene la Liga Profesional
   argentina, no el ascenso. Para esos 36 clubes hay que ir por otro lado.
2. **Es una foto de una fecha.** Un plantel de hace una temporada tiene
   jugadores que ya se fueron y le faltan los que llegaron.
3. **Los juveniles recién subidos suelen no estar**, o estar con un rating
   genérico. Son, otra vez, los mismos que fallan por el otro camino.

### Las otras dos que sirven

- [salimt/football-datasets](https://github.com/salimt/football-datasets) —
  93.000 jugadores sacados de Transfermarkt: perfil, fecha de nacimiento,
  posición, nacionalidad, club, valor de mercado, transferencias y lesiones.
  **No trae rating ni proyección**, pero es mucho más completa en clubes y está
  más al día. Buena para cruzar contra la de arriba.
- [openfootball](https://github.com/openfootball) — datos libres de dominio
  público en JSON, sin API key. Fuerte en calendarios y resultados, más flojo
  en planteles, pero es la única de licencia totalmente abierta.

### El paso que falta

Cuando tengas el CSV, **pasámelo (con veinte filas alcanza)** y te escribo el
conversor en `tools/` que lo lee y escribe las entradas de `REAL_ROSTERS`
solas, con el mapeo de puestos, el sueldo anualizado y los años de contrato ya
calculados. No lo escribo antes porque los nombres de las columnas cambian de
una base a la otra, y un conversor que no probé contra el archivo de verdad es
un conversor roto.

---

## 6. Qué hacer con la respuesta

1. Controlá la tabla de fuentes antes que nada. Si una fila no tiene
   fuente, tratá el dato como si no existiera.
2. Los cumpleaños van en `js/players.js`, agregando `birthDate: 'AAAA-MM-DD'`
   a la línea del jugador. No hace falta tocar el `age`: el juego lo
   recalcula solo y el valor viejo queda de respaldo.
3. Un club nuevo se agrega como una entrada más en `REAL_ROSTERS`, con el id
   que ya usa el juego (`racing`, `independiente`, `sanlorenzo`, `velez`…) y
   su once en `REAL_LINEUPS`. Desde el momento en que un club tiene 11
   jugadores o más ahí, el juego deja de inventarle jugadores para
   completarle el plantel.
4. Cuando un jugador nace en un país que todavía no tiene banderita
   dibujada, el juego no se rompe: muestra la ficha sin bandera hasta que
   le agreguemos el diseño.
