# Lo que falta

Lo que está hecho se cuenta en el README. Acá va lo que queda por delante, para
que no se pierda entre una charla y la otra.

Última revisión: 9/10/2026.

---

## 1. Datos que faltan cargar

Nada de esto se puede inventar: son datos reales que hay que pasar a mano. Es
lo único que no depende de programar.

### Fechas de nacimiento — hecho

Los 58 jugadores de Boca y River ya tienen su `birthDate` cargada, así que la
edad sale del almanaque y sube sola el día del cumpleaños. El que falta es el
club que se cargue de acá en adelante: el pedido ya está escrito en
`PROMPT-PLANTELES.md` y la fecha va en el mismo renglón del jugador.

### El save de FC 27: mirado y descartado por ahora

Se abrió un archivo de guardado del Modo Carrera de FC 27 (16 MB) para ver si
servía para cargar ligas sin scrapear. Lo que se averiguó, por si algún día
cambia la cuenta:

- Es un contenedor `FBCHUNKS` con bloques `BNRY` / `LTLE` adentro, **sin
  comprimir** (entropía 6,49 con 25% de ceros).
- **Los ids de jugador son los mismos que los de SoFIFA**, que son los de EA.
  Las dos fuentes se cruzan sin ambigüedad.
- Los planteles están como listas de ids de 4 bytes seguidos: el de Boca son
  30 ids contiguos alrededor del offset 4.389.970.
- Tiene **el mundo entero**, no sólo la carrera: aparecen los 930 argentinos y
  unos 29.000 ids en el rango de jugador.
- **Lo que no se pudo leer son los atributos.** La fecha de nacimiento no
  aparece con la codificación clásica de FIFA (días desde 1582-10-14), así que
  lo más probable es que los campos estén empaquetados a nivel de bit. Sacar
  ese esquema desde cero son horas sin garantía.

Se descartó porque ahorraría unos diez minutos por liga frente a los scripts
de SoFIFA, que ya funcionan y devuelven un CSV ordenado.

### Jugadores: la Primera entera, hecha

Los 30 clubes de Primera tienen plantel real: **930 jugadores**, sacados de
SoFIFA (`sofifa.com/league/353`) el 17 de septiembre de 2026. Cada uno trae
valoración, potencial, valor de mercado, sueldo, cláusula, contrato, dorsal,
posiciones, fecha de nacimiento exacta, altura, peso, pierna hábil y su
`sofifaId`, que es la llave estable (en esta liga hay siete pares de jugadores
con nombre y apellido idénticos; el id no se repite nunca).

La cadena entera está en el repo y se puede volver a correr cuando salga la
próxima actualización de la base:

1. `tools/sofifa-extractor.js` — se pega en la consola del navegador con
   sofifa.com abierto y baja el listado de la liga.
2. `tools/sofifa-fechas.js` — lo mismo, pero entra a la ficha de cada jugador
   a buscar la fecha de nacimiento, que en el listado no está.
3. `tools/convertir-sofifa.py` — convierte los dos CSV (guardados en `datos/`)
   en el bloque `REAL_ROSTERS` de `js/players.js`. Ese archivo **no se edita a
   mano**: se regenera.

Dos cosas no se copian tal cual y están explicadas en el conversor: el
potencial de los veteranos (en EA es su techo histórico, no su futuro, y sin
traducirlo el motor hacía crecer a Di María de 82 a 87 a los 38 años) y el
estado de transferencia, que en SoFIFA no existe.

**Lo que sigue faltando son los 36 de la Nacional.** Juegan con planteles
generados, que ya no salen de la reputación a secas: cada club tiene su nivel,
su ataque y su defensa en `NACIONAL_DATOS` (`js/data.js`). SoFIFA no tiene la
Primera Nacional argentina, así que ahí hay que volver al camino de
`PROMPT-PLANTELES.md`: pedírselos a una IA club por club, con las precauciones
que ese archivo documenta.

### Las caras

Están a un paso. La foto de cada jugador sale de su `sofifaId` sin scrapear
nada: con el id en seis dígitos partido 3 + 3,
`https://cdn.sofifa.net/players/AAA/BBBBB/27_120.png`. De los 930, solo dos no
tienen (Facundo Herrera y Matías Satas, los dos de Boca).

Lo que falta no son los datos, es el envase: el juego se abre desde `file://`
y el CDN no sirve las imágenes con ese origen. Entra cuando se sirva el juego
como web (ver el bloque de arquitectura). Cuando entren, en la pantalla de
Plantel la cara reemplaza a la camiseta y al dorsal.

### Escudos del continente (y de la tercera, cuando esté)

Ya están los 66 del fútbol argentino: los 30 de Primera y los 36 de la
Primera Nacional (`js/escudos.js`). Faltan los 103 clubes del continente
(`js/internacional.js`), que se dibujan con un escudo genérico de iniciales
pintado con los colores del club. Se nota en el cuadro de la Libertadores,
donde la mitad de los escudos son reales y la otra mitad son iniciales.

Se generan con `tools/generar-escudos.py` a partir de una carpeta con los
PNG, con el archivo llamado igual que el id del club. El script conserva los
que ya están, así que se puede cargar de a tandas.

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

### Los planteles se vacían con los años — resuelto con las inferiores

Estaba medido y era grave: dejando correr los retiros, en la temporada 15 el
club más chico quedaba con **8 jugadores** y no podía ni parar un once.

Lo arreglan las inferiores (`js/juveniles.js`). Cada club tiene su cantera, y
un club al que se le retiraron tres veteranos sube tres pibes: los que hagan
falta para no bajar de su piso, y ni uno más. El piso no es parejo para todos
—sale del tamaño que tiene su plantel de verdad—, así que Boca sostiene un
plantel más grande que Instituto, como corresponde.

Medido de nuevo, con las inferiores puestas:

| Temporada | Plantel más chico | Plantel más grande |
|---|---|---|
| 1  | 27 | 36 |
| 10 | 22 | 35 |
| 15 | 22 | 30 |
| 25 | 22 | 30 |

Nunca baja de 22 en 25 temporadas, y la valoración media de la liga se queda
quieta en torno a 70 en vez de irse para cualquier lado.

**Lo que sigue faltando de esto**: que la IA rival además COMPRE para tapar
sus puestos flojos, que es lo que está en la lista de arriba. Hoy un club
repone cantidad, no puesto: si se le retiran los dos arqueros, sube a los dos
mejores que tenga aunque sean delanteros.

### `retirados` engorda la partida

Cada jugador que cuelga los botines queda anotado en `state.retirados` para
siempre. Con 930 jugadores en la liga eso son 494 anotaciones y **51 KB** en
la temporada 15 — de lejos la parte que más crece del guardado (110 KB en
total). Alcanzaría con quedarse con los de las últimas temporadas, que es lo
único que el diario y la pantalla de fin de año llegan a mostrar.

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

El partido está completo: el reloj corre del 1' al 90' a la velocidad que
elijas, los eventos salen en el momento (goles, remates, córners, faltas,
amarillas, rojas, penales y lesiones), el peligro de los dos arcos se
recalcula en cada minuto con el planteo que tengas puesto, y podés cambiar el
esquema, tocar los ajustes al vuelo y hacer los cambios cuando quieras. Las
tarjetas dependen del árbitro que te toque y los penales se patean en el
minuto en que pasan. Lo que queda:

- **Los goles del rival con su autor** ya funcionan para los clubes
  argentinos. Los del continente no tienen plantel cargado y el gol queda a
  nombre del club (es el punto 1: faltan esos planteles).
- **El arquero no puede ser expulsado**: si lo fuera habría que meter al
  suplente sacando a un jugador de campo, y el motor todavía no sabe hacer
  ese cambio. Por ahora ve muy pocas amarillas y ninguna roja.
- **Faltan los palos y las ocasiones claras** que no terminan en remate, y el
  penal errado no genera rebote.
- **Las estadísticas se guardan por partido** (`s.pendingMatch.stats`) pero no
  se suman por temporada: para una tabla de "remates por partido del año" hay
  que acumularlas en `s.stats`.

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

## 6. Camisetas: hechas

Ya no hay camisetas verdes: los 66 clubes juegan con la suya en el plantel,
el banco, la reserva y el entretiempo (`CAMISETAS_CLUBES` en `js/ui.js`).
Los 30 de Primera están confirmados uno por uno, con sus colores de
camiseta —que no siempre son los del escudo— y su diseño. Los 36 de la
Nacional van con los colores de su escudo y el diseño puesto a ojo, y así
quedan: se revisaron y están bien.

Dos cosas que quedaron decididas y NO se van a hacer por ahora:

- **La camiseta del rival** no se muestra en ningún lado, y está bien así:
  hoy no hay ninguna pantalla donde iría. El partido no dibuja los once del
  otro equipo, y en la previa y en el marcador el rival ya se identifica con
  su escudo. Tiene sentido recién el día que el partido muestre la formación
  rival.
- **El diseño de los 103 clubes del continente** se hace junto con las ligas
  del resto del continente (punto 9), no antes: hoy esos clubes solo
  aparecen en el cuadro de las copas, con su escudo de iniciales pintado con
  sus colores.

Lo de las **cartas estilo FUT en la cancha** quedó descartado y probado: se
maquetaron las dos versiones con el mismo once y en el panel no entra la
línea de cuatro, y aunque entrara se pierde de un vistazo la formación, que
es justo para lo que sirve esa pantalla. La carta quedó donde rinde: la
ficha del jugador.

## 7. Lo que sigue del mercado y del diseño

- **Buscar por país y por liga de verdad.** El buscador ya filtra por liga
  (Primera / Nacional), pero "país" todavía no significa nada porque hay un
  solo país cargado. Cuando entren más ligas, el filtro está listo: solo hay
  que sumarle el campo.
- **De quién es el jugador que está a préstamo.** SoFIFA dice hasta cuándo
  está cedido pero no de qué club es (en el listado de la liga figura en el
  club donde juega). Por eso los 134 cedidos de la liga argentina tienen
  `loanUntil` y no `loanFrom`, y el juego dice "está a préstamo hasta 2027" en
  vez de "a préstamo de tal club". Para tener el dueño hay que entrar a la
  ficha de cada uno, que es otro pasaje del script de SoFIFA.
- **Que el préstamo se termine.** Hoy es solo información: el juego no simula
  que el jugador vuelva a su club dueño cuando se cumple la fecha.
- **La pantalla principal no debería llamarse "Partido"** ni quedar en una
  punta de la barra. Es la pantalla del juego y tendría que sentirse como tal.
  Va junto con el rediseño general, que quedó para más adelante.

---

## 8. Renovar contratos: negociar, no aceptar

Hoy renovar un contrato es un botón con un precio fijo (ver
`Economia.costoRenovacion`). Tendría que ser una negociación, porque es una de
las decisiones más lindas del modo carrera y hoy no existe:

- **Cuanto mejor es el jugador, más pide.** No solo por valoración: un pibe de
  19 con techo 88 tiene que costar mucho más que un jugador hecho de 30 con la
  misma valoración de hoy, porque lo que se está comprando es el futuro.
- **El club importa.** A una joya en un club chico se le va a querer ir, y hay
  que pagarle por encima de lo que vale para que se quede. En un club grande
  la misma joya firma más barato, porque está donde quiere estar.
- **Que se pueda negociar de verdad**: que pidas un número, el jugador pida
  otro, y haya lugar para ofrecer más años, más sueldo o una cláusula más
  alta. Que también pueda decir que no.
- **Que avise antes.** Un contrato que vence en seis meses tendría que
  aparecer en el panel, no enterarte cuando el jugador ya se fue libre.

Esto se cruza directo con las inferiores: el pibe que subiste firma su primer
contrato por tres años, y cuando se le vence, si salió bueno, ahí empieza el
problema de verdad.

---

## 9. Economía, lo que quedó afinar

Cada club de Primera tiene su economía real en `js/finanzas.js` y de ahí salen
el presupuesto, el goteo semanal, la vara de sueldos y la recaudación. Queda:

- **La Primera Nacional anda con números relativos**: cada club tiene su
  presupuesto en `NACIONAL_DATOS` (`js/data.js`) y el motor lo pasa a pesos,
  pero son proporciones estimadas entre ellos, no las cuentas publicadas de
  cada club como en Primera (`js/finanzas.js`).
- **La recaudación de local no usa el aforo**, que está cargado y sería el dato
  natural.
- **Los socios tampoco se usan todavía**: están cargados para cuando la cuota
  social sea una fuente propia.

---

## 10. Detalles sueltos

- **La pantalla de elegir club** podría contar bastante más de cada club antes
  de que te decidas (hoy la reputación son cinco estrellitas y nada más).
- **Los 4 descensos de la Primera Nacional** solo se miran para tu club: no hay
  una división más abajo de donde traer reemplazos.
- **El usuario todavía gana de más**, aunque mucho menos que antes. Se termina
  de emparejar con la IA de clubes (punto 2).
- **El ojeador solo puede viajar a seis países** (Argentina, Uruguay, Brasil,
  Paraguay, Colombia y Chile). No es una decisión: son los únicos para los que
  el juego tiene nombres cargados (`NAMES_BY_NATION` en `data.js`), y mandarlo
  a España devolvería doce chicos con nombre argentino. Agregar un país es
  agregarle su lista de nombres y aparece solo en el selector.
- **Los nombres inventados pueden caer justo en uno real.** Las listas de
  nombres se armaron con nombres y apellidos de futbolistas conocidos, y se
  combinan al azar: en las de países con pocas entradas (Uruguay tiene 10 y 10)
  cada tanto sale la combinación exacta de una persona que existe — en las
  pruebas apareció un juvenil llamado Edinson Cavani. Antes casi no se notaba;
  con las inferiores generando pibes en 30 clubes por temporada, se nota. Se
  arregla agrandando las listas, o cruzando contra una lista de combinaciones
  prohibidas.

---

## 11. Lo grande que viene: más de una liga

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
primer paso natural. Cuando se haga, esos clubes van con todo: sus escudos
(hoy se dibujan con iniciales, ver punto 1) y el diseño de sus camisetas
(punto 6).

---

## 12. Lo que quedó abierto del Bloque 3

Las tres salieron de probar la corrección de B3-01 en el navegador con el MCP
de Playwright, jugando a 390x844. Son tareas separadas: ninguna se arregla de
paso mientras se toca otra cosa.

### B3-03: un jugador aparece en el once y en el banco a la vez

Jugando con Lanús se midió, en el arranque de un partido, un plantel con once
en la cancha y doce en el banco donde **Franco Petroli figuraba en los dos
lados**. Era el partido siguiente a una lesión del arquero titular, con
Petroli ascendido a titular.

Hay que encontrar la causa, pero antes conviene descartar lo más probable: la
medición leyó `state.banco` crudo, y ese array **no es la fuente de verdad**.
El que normaliza es `asegurarBanco()` —saca a los que pasaron a ser titulares
y completa hasta doce—, y se llama desde `getBanco()`. O sea que `state.banco`
puede estar sucio sin que el juego esté roto, porque nadie lo lee directo.

No se pudo reproducir: en los dos partidos siguientes el solape dio vacío con
las dos lecturas. Así que lo primero es **confirmar o descartar que sea real**,
midiendo siempre por `getBanco()`. Si es real, el lugar a mirar es en qué
momento se arma el banco respecto de cerrar el once.

Se numera B3-03 y no B3-02 porque ese número ya está tomado por el gol que no
se cuenta como remate, de la auditoría del Bloque 3.

### Balance de los partidos con el arco vacío

Desde B3-01 el arco puede quedar legítimamente vacío: si se lesiona el arquero
y no hay ninguno en el banco, se sigue con uno menos y sin nadie ahí. Falta
saber **cuánto cuesta eso de verdad**.

En la única prueba que se hizo, un partido con el arco vacío desde el minuto 61
terminó 0-0 contra Flamengo de visitante. Es **una sola observación y no
alcanza para ninguna conclusión**, pero deja la duda de si el simulador está
cobrando el arco vacío o si lo trata casi como jugar con diez.

Lo que hay que hacer es simular muchos partidos —cientos, no cinco— comparando
tres situaciones con el mismo plantel y el mismo rival: once completo, diez con
arquero, y diez con el arco vacío. Si los goles en contra del tercer caso no se
despegan del segundo, el arco vacío no se está cobrando y hay que meterle mano
a `peligroDelPartido`.

### "Terminar carrera" tiene que ir a un menú y pedir confirmación

Hoy el botón rojo de **Terminar carrera** está suelto arriba de la tarjeta del
partido, entre Sonido, Exportar e Importar. En el celular queda a un toque de
distancia mientras estás jugando, y borra la carrera entera.

Tiene que irse a un menú (el de ajustes, junto con sonido y exportar/importar)
y pedir una confirmación explícita antes de borrar nada.
