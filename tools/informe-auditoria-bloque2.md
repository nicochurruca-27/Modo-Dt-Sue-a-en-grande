# AUDITORÍA BLOQUE 2 — MERCADO DE PASES Y MOVIMIENTOS DE JUGADORES

**Solo diagnóstico. No se modificó una línea del juego.**

Herramienta: `tools/auditoria-bloque2.mjs` (Chromium headless, `file://`, 15 temporadas).

---

## A. ALCANCE Y MÉTODO

Todo lo que sigue se midió en un navegador de verdad, manejando `Engine` desde
el estado real de una partida. No hay nada deducido de leer el código sin
ejecutarlo, y nada afirmado sobre una interacción visual que no se haya podido
ejecutar.

- 26 pruebas dirigidas por área (transferencias, ventas, préstamos, contratos,
  mercado↔plantel, identidad, ascensos, guardado).
- Las 12 preguntas sobre los ids del relleno de la Nacional, contestadas una
  por una.
- Un soak de 15 temporadas con un club chico (Aldosivi, 66 clubes, 1722
  jugadores), censando el mundo entero al cierre de cada temporada.
- Dos sondas dirigidas para aislar la causa de los dos hallazgos masivos del
  soak, en lugar de dejarlos como un número.

**El juego quedó byte-idéntico.** `git diff -- js/ css/ index.html datos/`
no devuelve nada (sección F).

---

## B. CÓMO FUNCIONA EL SISTEMA (inventario)

La pertenencia de un jugador a un club se representa de **tres maneras
distintas**, y entender eso es la clave de toda la auditoría:

| | Dónde vive | ¿Se guarda? |
|---|---|---|
| **Tu club** | `state.squad`, jugadores completos | sí |
| **Los rivales** | `Mercado.plantel()` los RECONSTRUYE: semilla fija (id del club) ± `state.mundo[clubId] = {fuera:[ids], dentro:[jugadores]}` | solo la diferencia |
| **Los cedidos** | `state.cedidos`; salen de tu plantel y **no** entran al del club que los tomó | sí |

El plantel de un rival es: `base − fuera + dentro`, más reposición (red del
arquero, egresados de la cantera, relleno).

Y hay **tres clases de id**, que se comportan muy distinto:

| id | Qué es | ¿Estable? |
|---|---|---|
| `clubId-rN` | jugador de plantel investigado; N es el índice en `REAL_ROSTERS` | **sí** |
| `clubId-gN` | jugador sembrado; N es el índice en `SQUAD_POSITIONS` | **sí** |
| `clubId-cAÑO-N` | relleno de un club generado; N es `vivos.length` en ese momento | **no — acá está casi todo lo que sigue** |

Censo al arrancar: 1724 jugadores · 899 reales · 648 sembrados · 144 de
relleno · 33 otros · **0 ids duplicados**.

---

## C. LOS IDS DEL RELLENO DE LA NACIONAL — LAS 12 PREGUNTAS

Club de prueba: `allboys` (22 jugadores = 18 sembrados + 4 de relleno).

| # | Pregunta | Respuesta medida |
|---|---|---|
| 1-3 | ¿Dos llamadas seguidas a `plantel()` dan lo mismo? | **sí**, es determinista |
| 4-5 | Un jugador de relleno transferido, ¿sigue en el origen? ¿llegó al destino? | **sí a las dos**: está en los dos clubes a la vez |
| 6 | Tras una segunda transferencia, ¿dónde está? | en `talleres` **y** en `allboys` |
| 7 | ¿Sobrevive algún jugador de relleno de T1 a T2? | **no, ninguno** |
| 8-9 | ¿Al cambiar de división pierde o duplica jugadores? | no: 22 → 22, los mismos |
| 10 | ¿Guardar y cargar lo preserva? | **sí**, idéntico |
| 11 | ¿Hay dos personas distintas con el mismo id? | **sí** (ver B2-01) |
| 12 | ¿Reaparece en el club original? | **sí**: `river` + `allboys` |
| control | Un jugador **sembrado** (`-gN`) transferido | `river` y nada más: **limpio** |

El relleno se vuelve a acuñar entero cada temporada:

```
T1: allboys-c1-18, -c1-19, -c1-20, -c1-21
T2: allboys-c2-18, -c2-19, -c2-20, -c2-21
T3: allboys-c3-18, ...
```

---

## D. BUGS CONFIRMADOS

### B2-01 — ALTO — El id del relleno es una posición, no una identidad

`js/mercado.js`, el bucle del relleno:

```js
const idCantera = `${clubId}-c${anio}-${vivos.length}`;
```

Dos defectos en una línea. `vivos.length` hace que el id sea **el lugar que el
jugador ocupa en la fila**, así que cualquier cambio en los que sobreviven
corre todos los ids una posición. Y `${anio}` hace que la camada entera se
tire y se vuelva a acuñar cada temporada.

**Consecuencia 1 — un id pasa a designar a otra persona.** Saqué *un solo*
jugador sembrado de All Boys. Los cuatro ids del relleno cambiaron de dueño:

```
relleno ANTES de mover un solo sembrado:
   allboys-c1-18 = Bruno Sánchez (52)
   allboys-c1-19 = Nahitan Bentancur (59)
   allboys-c1-20 = Gonzalo Ibáñez (52)
   allboys-c1-21 = Cristian Aguirre (60)

DESPUÉS de sacar únicamente a allboys-g7:
   allboys-c1-17 = Bruno Sánchez (52)     <- id nuevo
   allboys-c1-18 = Nahitan Bentancur (59)
   allboys-c1-19 = Gonzalo Ibáñez (52)
   allboys-c1-20 = Cristian Aguirre (60)
   allboys-c1-21 = Rodrigo Rodríguez (55) <- persona que no existía
```

Un retiro cualquiera en el plantel sembrado alcanza para disparar esto, así
que pasa solo con los años.

**Consecuencia 2 — el mismo jugador en dos clubes a la vez.** El filtro de
`fuera` corre **antes** del bucle del relleno, así que al sacar a un jugador de
relleno el bucle vuelve a acuñar su id en el club de origen, mientras el
original quedó anotado en el `dentro` del destino:

```
A -> B con las tres clases de id:
  real (estudianteslp-r0): river          OK
  sembrado (allboys-g7):   river          OK
  relleno (allboys-c1-21): river+allboys  MAL
```

El soak lo reprodujo **solo**, sin que yo lo provocara, en la temporada 13:

```
en dos clubes · relleno: Julián Benítez (atlanta-c13-14): atlanta + sanmartinsj
```

Dura una temporada (desde T2 el origen acuña `-c2-*`), pero mientras dura el
jugador existe dos veces en el mundo.

**Consecuencia 3 — no se puede seguir a un pibe de la Nacional.** Ningún
jugador de relleno sobrevive de una temporada a la otra. Son 144 jugadores del
mundo que se reemplazan por completo cada año.

---

### B2-02 — ALTO — Un jugador transferido no se retira nunca

`js/mercado.js`, en `plantel()`:

```js
const vivos = base
  .filter((p) => !engine.yaSeRetiro(p) && !seFue(p.id))   // <- el filtro de retiro
  .concat(movimientos.dentro
    .filter((j) => !seFue(j.id))                          // <- acá NO hay filtro de retiro
    .map((j) => this.jugadorFichado(engine, j, anio)));
```

El control de retiro se aplica solo a `base`. El que llegó por transferencia
entra por `dentro` y no pasa por ningún control: envejece para siempre.

```
José Sosa (estudianteslp-r18), transferido con 53 años:
T1:40 T2:41 T3:42 T4:43 T5:44 T6:45 T7:46 T8:47 T9:48 T10:49 T11:50 T12:51 T13:52 T14:53
(la edad de retiro es 39)
```

Esto es acumulativo y empeora: cada pase del mercado de los rivales fabrica un
jugador inmortal más. Explica por qué en el soak los `real` bajan de 898 a 483
pero el total se estanca en ~1540.

---

### B2-03 — MEDIO — Al transferirse, el jugador pierde datos

`Mercado.transferir()` copia una lista fija de campos y `jugadorFichado()`
tampoco los reconstruye. Medido:

```
Mauro Arambarri pierde al cambiar de club: altPosDetail, clause, salary, transferState
```

No es cosmético, los cuatro se usan:

- `altPosDetail` → `Engine.encajeEnCasillero` (`js/engine.js:1399`): el jugador
  pierde las posiciones alternativas que podía cubrir.
- `clause` → precio (`js/mercado.js:266`, `964`) y se muestra en la ficha
  (`js/ui.js:5066`).
- `transferState` → el filtro nuevo del mercado (`js/mercado.js:950`): un
  transferido deja de poder aparecer como transferible o con cláusula.
- `salary` → referencia del contrato.

---

### B2-04 — MEDIO — Un arquero rival se retira y vuelve para siempre

La red del arquero de `Mercado.plantel()` (Bloque 0) devuelve a un arquero
retirado cuando el club quedaría en cero, y eso está bien. Pero
`Engine.procesarRetiros()` anota el retiro de los rivales leyendo
`REAL_ROSTERS` **directo**, sin preguntarle a esa red. Resultado: el juego
anuncia que se retiró y el jugador sigue jugando.

En tu propio plantel esto no pasa, porque ahí `esUltimoArquero` se consulta
**antes** de anotar el retiro. En los rivales no hay ese control.

Y no es "un año más" como dice el comentario del código: la red vuelve a
dispararse cada temporada, así que vuelve indefinidamente y sigue cumpliendo
años.

```
posiciones de los casos: ["POR"]  (los 14 casos son arqueros)

riestra-r2 (Marino Arzamendia): se retiró en T13 -> activo-y-retirado en T14, T15, T16
   edad anotada al retirarse: 40 · edad en T15: 41
gimnasiamendoza-r1: se retiró en T13 -> activo-y-retirado en T14, T15, T16
racing-r1:          se retiró en T13 -> activo-y-retirado en T14, T15, T16
instituto-r1:       se retiró en T14 -> activo-y-retirado en T15, T16
platense-r2:        se retiró en T14 -> activo-y-retirado en T15, T16
```

Además queda incluso cuando el club terminó con otros arqueros (`racing-r1` en
T14 con 2 arqueros, `platense-r2` en T15 con 5): la red no tiene un paso que lo
saque de vuelta cuando ya dejó de hacer falta.

---

## E. HALLAZGOS, COMPORTAMIENTO INTENCIONAL Y FUERA DE ALCANCE

### HALLAZGO — `state.mundo` no se poda nunca

Los movimientos solo crecen: **7 en T1 → 290 en T15**. `dentro` conserva al
jugador incluso después de que se fue de ese club. Hoy no rompe nada —las 57
apariciones de "anotado como llegado pero no está" se explican **todas** por
esto, ninguna quedó sin explicación— pero el save crece sin techo y cada
`plantel()` recorre una lista cada vez más larga.

```
"anotado como llegado pero no está", motivo de cada caso (15 temporadas):
   después se fue de ese club (está en `fuera`): 21 en T15
   SIN EXPLICACIÓN: 0
```

### COMPORTAMIENTO INTENCIONAL (verificado, no es bug)

- **El que llega a la edad de retiro juega su última temporada.** Es el diseño
  que pediste en el Bloque 0. Se anota en `retirados` al cerrar y no se
  arrastra a la siguiente: `10 temporadas: 190 juegan su última temporada y
  NINGUNO se arrastra a la siguiente`. (Mi primera versión de esta prueba lo
  contaba como fantasma; estaba mal la prueba, no el juego.)
- **El cedido no está en ningún plantel del mundo** mientras dura el préstamo.
  Es el modelo elegido, 5/5 pruebas de préstamo en verde, y vuelve con la edad
  al día (`salió con 38, volvió con 40`).
- **Los rivales no tienen plantel guardado.** Es deliberado para que el save no
  engorde.
- **Ascensos y descensos no pierden ni duplican a nadie**: `instituto 27 → 27`,
  `allboys 22 → 22`, los mismos. (Mi prueba comparaba el orden y no la
  membresía; corregida.)

### FUERA DE ALCANCE

- Que los rivales no fichen por posición (compran al mejor disponible).
- Renegociación de contratos: sigue en pendientes, como lo dejaste anotado.
- Rediseño de la pantalla principal.

---

## F. EL JUEGO NO SE TOCÓ, Y LO ANTERIOR SIGUE EN VERDE

```
$ git diff --stat -- js/ css/ index.html datos/
(vacío)

$ node --check js/*.js
OK los 15 archivos
```

Regresión completa, corrida de nuevo al terminar la auditoría:

| Batería | Resultado |
|---|---|
| `pruebas-edades.mjs` | 18/18 |
| `pruebas-guardado.mjs` | 18/18 |
| `pruebas-juveniles.mjs` | 21/21 |
| `pruebas-calendario.mjs` | 14/14 (Bloque 0) |
| `pruebas-arqueros.mjs` | 13/13 (Bloque 0) |
| `pruebas-bloque1.mjs` | 19/19 (B1-01 a B1-06) |
| **total** | **103/103** |

El arreglo de B1-01 aguanta: **0 duplicados en las 15 temporadas del soak**,
salvo el único caso de relleno de T13, que es B2-01 y no una recaída.

### El soak de 15 temporadas

| T | clubes | jugadores | real | sembrado | relleno | dobles | movimientos | retirados |
|---|---|---|---|---|---|---|---|---|
| 1 | 66 | 1722 | 898 | 646 | 145 | 0 | 7 | 4 |
| 5 | 66 | 1675 | 862 | 637 | 147 | 0 | 58 | 41 |
| 10 | 66 | 1577 | 735 | 504 | 259 | 0 | 173 | 173 |
| 13 | 66 | 1553 | 584 | 387 | 363 | **1** | 245 | 336 |
| 15 | 66 | 1541 | 483 | 320 | 424 | 0 | 290 | 447 |

Cero errores de página no provocados. Guardar después del soak: `load()=true`,
el censo quedó idéntico.

---

## G. CONCLUSIÓN

El esqueleto del mercado está sano: transferencias en cadena, ventas,
rescisiones, préstamos con vuelta y compra obligatoria, guardado, ascensos y
descensos, y la unicidad de ids pasan todos. Los cuatro bugs no están en la
mecánica del pase sino en **la identidad del jugador**: el juego no tiene una
noción firme de "esta persona es esta persona" para los que no vienen de un
plantel investigado.

Orden sugerido para cuando digas que arranque la corrección:

1. **B2-02** (una línea, consecuencia grande y acumulativa).
2. **B2-01** (el id tiene que ser una identidad: sin `${anio}` y sin
   `vivos.length`).
3. **B2-04** (que el retiro del rival consulte la red del arquero, igual que
   hace tu club).
4. **B2-03** (completar lo que copia `transferir`).
5. El hallazgo de la poda de `mundo`, que conviene hacer junto con B2-01.

**No empecé ninguna corrección y no empecé el Bloque 3.**
