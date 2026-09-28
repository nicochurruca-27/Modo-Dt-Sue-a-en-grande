// Planteles reales, investigados club por club (temporada 2026, mediados de
// año). Un club que no tiene entrada acá sigue usando el generador de
// jugadores al azar (ver generateSquad en engine.js) — así se puede ir
// completando de a poco sin romper nada.
//
// Fuente de esta actualización: el usuario le pidió a ChatGPT la lista con
// un prompt puntual (edad, nacionalidad, posición general y detallada,
// dorsal, vencimiento de contrato, préstamos, valoración estimada) club por
// club, y nos pasó el resultado. La valoración (rating, 0-100) sigue siendo
// una estimación (no hay una base pública equivalente al "overall" de un
// videojuego con licencia), pero ahora al menos sale de una investigación
// puntual por jugador en vez de a mano nuestra.
//
// contractYears = temporadas que le quedan de contrato contando esta (por
// ejemplo, un contrato que vence en 2026 = 1; en 2028 = 3).
//
// `number` = dorsal real, tal como lo confirmó la investigación.
//
// `posDetail` = la posición real más específica (lateral derecho, defensor
// central, mediocampista defensivo/mixto/ofensivo, delantero centro, etc.).
// Se usa en positionFit (engine.js) para afinar el color en DEF/DEL según
// de qué lado de la cancha quedó el casillero (ver WIDTH_BY_POS_DETAIL /
// slotWidthCategory) y se muestra abreviada (LD, DFC, MCO, etc.) en la
// cancha y la lista de suplentes (ver POS_DETAIL_ABBREV en ui.js).
//
// `altPosDetail` (opcional, array): otras posiciones donde el jugador
// también rinde bien en la realidad (ej. Thiago Almada: mediocampista
// ofensivo o extremo izquierdo). Si lo ponés en un casillero que
// corresponde a una de sus posiciones alternativas, el ajuste mejora un
// escalón (rojo→amarillo, amarillo→verde) respecto de lo que daría su
// posición principal sola — ver Engine.applyAltPositionBonus. Por ahora
// solo se investigó puntualmente para algunos jugadores; no es necesario
// cargarlo para todos.
//
// `role` (solo en mediocampistas): 'contención' | 'mixto' | 'ofensivo' — se
// deriva directamente de `posDetail` para los MED. Se usa para el aro de
// color de la cancha en formaciones con línea de enganche, donde sí importa
// la diferencia entre "el 5" y el enganche.
//
// Campos económicos (opcionales, se van sumando con cada club investigado):
//   `value`   — valor de mercado real en dólares. Si está, el juego lo usa en
//               vez de calcularlo con la fórmula de playerValue.
//   `salary`  — sueldo anual real. Se usa para el costo de renovación en vez
//               de la estimación por categoría de club.
//   `clause`  — cláusula de rescisión, si tiene.
//   `projection` — techo futbolístico estimado (hasta dónde puede llegar).
//   `transferState` — cómo lo trata el club: 'Intocable', 'Retenido',
//               'Transferible' o 'Fin de contrato cercano'.
//
// `loanFrom` / `loanUntil` (opcional): si el jugador está a préstamo, de qué
// club es dueño y hasta cuándo. Es solo información — el juego todavía no
// simula que el préstamo termine y el jugador vuelva a su club dueño.
// ---------- La fecha de nacimiento ----------
//
// Cada jugador puede llevar `birthDate: 'AAAA-MM-DD'`. Cuando está, es la
// fuente de verdad de su edad: el juego la calcula contra el almanaque y sube
// sola el día del cumpleaños (ver Engine.edadDe).
//
// Los 58 jugadores de acá abajo ya la tienen, buscada y verificada uno por
// uno contra fuentes públicas (los nueve juveniles vinieron mal en la primera
// investigación y se corrigieron). Un jugador sin fecha no rompe nada: su edad sale del reloj grueso —la edad con
// la que entró más las temporadas que pasaron—, que es lo que hacía el juego
// antes. No se inventa ninguna: el hueco es mejor que el dato falso.
//
// El `age` que va al lado es la edad **al 1 de enero de 2026**, que es el día
// en que arranca el juego (CALENDAR_START_DAY/MONTH + temporada 1). Sale de la
// misma fecha de nacimiento, así que las dos cosas dicen lo mismo: se usa para
// la curva de valoración y como respaldo si algún día falta la fecha.
const REAL_ROSTERS = {
  river: [
    { name: 'Ezequiel Centurión', birthDate: '1997-05-20', pos: 'POR', posDetail: 'arquero', age: 28, nation: 'ARG', contractYears: 1, rating: 68, number: 33 },
    { name: 'Santiago Beltrán', birthDate: '2004-10-04', pos: 'POR', posDetail: 'arquero', age: 21, nation: 'ARG', contractYears: 2, rating: 65, number: 41 },
    { name: 'Jeremías Martinet', birthDate: '2005-08-30', pos: 'POR', posDetail: 'arquero', age: 20, nation: 'ARG', contractYears: 3, rating: 62, number: 57 },
    { name: 'Tobías Ramírez', birthDate: '2006-11-11', pos: 'DEF', posDetail: 'defensor central', age: 19, nation: 'ARG', contractYears: 4, rating: 64, number: 2 },
    { name: 'Francisco Ortega', birthDate: '1999-03-19', pos: 'DEF', posDetail: 'lateral izquierdo', altPosDetail: ['carrilero izquierdo'], age: 26, nation: 'ARG', contractYears: 5, rating: 72, number: 3 },
    { name: 'Lautaro Rivero', birthDate: '2003-11-01', pos: 'DEF', posDetail: 'defensor central', age: 22, nation: 'ARG', contractYears: 4, rating: 73, number: 13 },
    { name: 'Giovanni González', birthDate: '1994-09-20', pos: 'DEF', posDetail: 'lateral derecho', altPosDetail: ['lateral izquierdo'], age: 31, nation: 'URU', contractYears: 2, rating: 70, number: 20 },
    { name: 'Marcos Acuña', birthDate: '1991-10-28', pos: 'DEF', posDetail: 'lateral izquierdo', altPosDetail: ['carrilero izquierdo'], age: 34, nation: 'ARG', contractYears: 2, rating: 76, number: 21 },
    { name: 'Lucas Martínez Quarta', birthDate: '1996-05-10', pos: 'DEF', posDetail: 'defensor central', altPosDetail: ['mediocampista defensivo'], age: 29, nation: 'ARG', contractYears: 3, rating: 77, number: 28 },
    { name: 'Gonzalo Montiel', birthDate: '1997-01-01', pos: 'DEF', posDetail: 'lateral derecho', altPosDetail: ['lateral izquierdo'], age: 29, nation: 'ARG', contractYears: 3, rating: 78, number: 29 },
    { name: 'Nicolás Otamendi', birthDate: '1988-02-12', pos: 'DEF', posDetail: 'defensor central', age: 37, nation: 'ARG', contractYears: 2, rating: 77, number: 30 },
    { name: 'Facundo González', birthDate: '2006-04-03', pos: 'DEF', posDetail: 'defensor central', age: 19, nation: 'ARG', contractYears: 3, rating: 62, number: 31 },
    { name: 'Juan Carlos Portillo', birthDate: '2000-05-18', pos: 'DEF', posDetail: 'defensor central', altPosDetail: ['mediocampista defensivo'], age: 25, nation: 'ARG', contractYears: 4, rating: 69, number: 5 },
    { name: 'Aníbal Moreno', birthDate: '1999-05-13', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['mediocampista mixto'], age: 26, nation: 'ARG', contractYears: 4, rating: 78, number: 6, role: 'contención' },
    { name: 'Mauro Arambarri', birthDate: '1995-09-30', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['mediocampista defensivo'], age: 30, nation: 'URU', contractYears: 3, rating: 77, number: 8, role: 'mixto' },
    { name: 'Fausto Vera', birthDate: '2000-03-26', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['mediocampista mixto'], age: 25, nation: 'ARG', contractYears: 1, rating: 70, number: 15, role: 'contención', loanFrom: 'Atlético Mineiro', loanUntil: '31/12/2026' },
    { name: 'Thiago Almada', birthDate: '2001-04-26', pos: 'MED', posDetail: 'mediocampista ofensivo', altPosDetail: ['extremo izquierdo'], age: 24, nation: 'ARG', contractYears: 5, rating: 82, number: 23, role: 'ofensivo' },
    { name: 'Juan Cruz Meza', birthDate: '2008-03-14', pos: 'MED', posDetail: 'mediocampista ofensivo', altPosDetail: ['extremo derecho'], age: 17, nation: 'ARG', contractYears: 3, rating: 61, number: 24, role: 'ofensivo' },
    { name: 'Tomás Galván', birthDate: '2000-04-11', pos: 'MED', posDetail: 'mediocampista ofensivo', altPosDetail: ['extremo izquierdo'], age: 25, nation: 'ARG', contractYears: 3, rating: 66, number: 26, role: 'ofensivo' },
    { name: 'Lucas Silva', birthDate: '2007-02-26', pos: 'MED', posDetail: 'mediocampista defensivo', age: 18, nation: 'ARG', contractYears: 3, rating: 58, number: 44, role: 'contención' },
    { name: 'Tobías Andrada', birthDate: '2007-02-02', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['mediocampista defensivo'], age: 18, nation: 'ARG', contractYears: 5, rating: 62, number: 50, role: 'mixto' },
    { name: 'Lautaro Pereyra', birthDate: '2008-03-28', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['mediocampista ofensivo'], age: 17, nation: 'ARG', contractYears: 3, rating: 57, number: 25, role: 'mixto' },
    { name: 'Sebastián Driussi', birthDate: '1996-02-09', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 29, nation: 'ARG', contractYears: 3, rating: 77, number: 9 },
    { name: 'Ángel Correa', birthDate: '1995-03-09', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['extremo derecho'], age: 30, nation: 'ARG', contractYears: 4, rating: 82, number: 10 },
    { name: 'Lucas Beltrán', birthDate: '2001-03-29', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 24, nation: 'ARG', contractYears: 2, rating: 74, number: 18, loanFrom: 'Fiorentina', loanUntil: '30/06/2027' },
    { name: 'Rafael Santos Borré', birthDate: '1995-09-15', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 30, nation: 'COL', contractYears: 4, rating: 77, number: 19 },
    { name: 'Agustín Ruberto', birthDate: '2006-01-14', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 19, nation: 'ARG', contractYears: 2, rating: 64, number: 32 },
  ],
  // Boca Juniors. Investigado con el mismo criterio que River, pero con los
  // campos económicos ya cargados (valor, sueldo, cláusula, proyección).
  //
  // Cuatro valoraciones se corrigieron a mano después de cargarlas: Milton
  // Delgado 67→75, Tomás Aranda 62→70, Leonel Flores 62→69 y Adam Bareiro
  // 68→71. El error fue del prompt con el que se pidió la investigación: para
  // evitar que inflara a los juveniles caros, decía que la valoración de un
  // juvenil "probablemente sea 62-68". Esa frase, pensada para el pibe que
  // todavía no juega, terminó aplastando también a los que ya son titulares
  // hace más de un año. El prompt ya está corregido para los próximos clubes.
  //
  // Del plantel investigado (45 jugadores) quedaron los 29 profesionales: se
  // sacaron los de reserva, que son justamente aquellos de los que la propia
  // investigación no pudo confirmar ni la edad ni la fecha de nacimiento.
  // También quedó afuera Kevin Zenón, vendido a México, y se unificó a
  // Lautaro Mendieta, que venía duplicado con el mismo dorsal en dos puestos.
  //
  // Las cláusulas de rescisión salen de una primera versión de la
  // investigación: al volver a pedir los mismos datos, las cifras cambiaron
  // en el 83% de los valores y el 91% de los sueldos, y las 14 cláusulas
  // desaparecieron. No es que estén mal: son estimaciones con mucho margen,
  // porque esa información no es pública. Se congeló una versión y es esta.
  boca: [
    { name: 'Álvaro Montero', birthDate: '1995-03-29', pos: 'POR', posDetail: 'arquero', age: 30, nation: 'COL', contractYears: 5, rating: 75, projection: 75, number: 1, value: 3000000, salary: 1000000, transferState: 'Retenido' },
    { name: 'Leandro Brey', birthDate: '2002-09-21', pos: 'POR', posDetail: 'arquero', age: 23, nation: 'ARG', contractYears: 4, rating: 66, projection: 76, number: 12, value: 5000000, salary: 450000, clause: 15000000, transferState: 'Retenido' },
    { name: 'Javier García', birthDate: '1987-01-29', pos: 'POR', posDetail: 'arquero', age: 38, nation: 'ARG', contractYears: 1, rating: 60, projection: 58, number: 30, value: 150000, salary: 300000, transferState: 'Fin de contrato cercano' },
    { name: 'Lautaro Di Lollo', birthDate: '2004-03-10', pos: 'DEF', posDetail: 'defensor central', age: 21, nation: 'ARG', contractYears: 4, rating: 69, projection: 78, number: 2, value: 7000000, salary: 500000, clause: 20000000, transferState: 'Retenido' },
    { name: 'Lautaro Blanco', birthDate: '1999-02-19', pos: 'DEF', posDetail: 'lateral izquierdo', altPosDetail: ['carrilero izquierdo'], age: 26, nation: 'ARG', contractYears: 3, rating: 73, projection: 74, number: 3, value: 4500000, salary: 700000, transferState: 'Retenido' },
    { name: 'Nicolás Figal', birthDate: '1994-04-03', pos: 'DEF', posDetail: 'defensor central', age: 31, nation: 'ARG', contractYears: 2, rating: 70, projection: 68, number: 4, value: 1000000, salary: 900000, transferState: 'Retenido' },
    { name: 'Leandro Lozano', birthDate: '1998-12-19', pos: 'DEF', posDetail: 'lateral derecho', altPosDetail: ['carrilero derecho'], age: 27, nation: 'URU', contractYears: 5, rating: 72, projection: 74, number: 17, value: 3500000, salary: 600000, clause: 15000000, transferState: 'Retenido' },
    { name: 'Dylan Gorosito', birthDate: '2006-02-03', pos: 'DEF', posDetail: 'lateral derecho', altPosDetail: ['carrilero derecho'], age: 19, nation: 'ARG', contractYears: 5, rating: 64, projection: 76, number: 24, value: 4500000, salary: 250000, clause: 12000000, transferState: 'Retenido' },
    { name: 'Marco Pellegrino', birthDate: '2002-07-18', pos: 'DEF', posDetail: 'defensor central', age: 23, nation: 'ARG', contractYears: 4, rating: 73, projection: 79, number: 26, value: 6000000, salary: 600000, clause: 18000000, transferState: 'Retenido' },
    { name: 'Ayrton Costa', birthDate: '1999-07-12', pos: 'DEF', posDetail: 'defensor central', altPosDetail: ['lateral izquierdo'], age: 26, nation: 'ARG', contractYears: 3, rating: 70, projection: 73, number: 32, value: 3500000, salary: 600000, transferState: 'Retenido' },
    { name: 'Facundo Herrera', birthDate: '2006-07-11', pos: 'DEF', posDetail: 'defensor central', age: 19, nation: 'ARG', contractYears: 3, rating: 60, projection: 73, number: 42, value: 1000000, salary: 150000, clause: 8000000, transferState: 'Retenido' },
    { name: 'Leandro Paredes', birthDate: '1994-06-29', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['mediocampista mixto'], age: 31, nation: 'ARG', contractYears: 3, rating: 81, projection: 81, number: 5, value: 6000000, salary: 2200000, clause: 20000000, transferState: 'Intocable', role: 'contención' },
    { name: 'Rodrigo Battaglia', birthDate: '1991-07-12', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['defensor central', 'mediocampista mixto'], age: 34, nation: 'ARG', contractYears: 2, rating: 70, projection: 68, number: 6, value: 800000, salary: 850000, transferState: 'Retenido', role: 'contención' },
    { name: 'Carlos Palacios', birthDate: '2000-07-20', pos: 'MED', posDetail: 'mediocampista ofensivo', altPosDetail: ['extremo derecho', 'extremo izquierdo'], age: 25, nation: 'CHI', contractYears: 4, rating: 73, projection: 78, number: 7, value: 5000000, salary: 900000, clause: 18000000, transferState: 'Retenido', role: 'ofensivo' },
    { name: 'Tomás Belmonte', birthDate: '1998-05-27', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['mediocampista defensivo'], age: 27, nation: 'ARG', contractYears: 3, rating: 72, projection: 74, number: 8, value: 3000000, salary: 750000, transferState: 'Retenido', role: 'mixto' },
    { name: 'Tomás Aranda', birthDate: '2007-05-09', pos: 'MED', posDetail: 'mediocampista ofensivo', altPosDetail: ['extremo izquierdo', 'mediocampista mixto'], age: 18, nation: 'ARG', contractYears: 4, rating: 70, projection: 77, number: 10, value: 6500000, salary: 180000, clause: 15000000, transferState: 'Retenido', role: 'ofensivo' },
    { name: 'Williams Alarcón', birthDate: '2000-11-29', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['mediocampista defensivo'], age: 25, nation: 'CHI', contractYears: 3, rating: 71, projection: 75, number: 15, value: 3500000, salary: 750000, transferState: 'Retenido', role: 'mixto' },
    { name: 'Milton Delgado', birthDate: '2005-06-16', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['mediocampista mixto'], age: 20, nation: 'ARG', contractYears: 4, rating: 75, projection: 80, number: 18, value: 10000000, salary: 250000, clause: 20000000, transferState: 'Intocable', role: 'contención' },
    // La investigación lo trajo como MED, pero su posición es extremo
    // izquierdo y en el once titular ocupa un puesto de ataque: en el juego
    // los extremos son DEL (ver delWidth 'abierta' en las formaciones).
    { name: 'Alan Velasco', birthDate: '2002-07-27', pos: 'DEL', posDetail: 'extremo izquierdo', altPosDetail: ['mediocampista ofensivo', 'extremo derecho'], age: 23, nation: 'ARG', contractYears: 3, rating: 76, projection: 80, number: 20, value: 6500000, salary: 1100000, clause: 20000000, transferState: 'Retenido' },
    { name: 'Camilo Rey Domenech', birthDate: '2006-03-10', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['mediocampista defensivo'], age: 19, nation: 'ARG', contractYears: 3, rating: 61, projection: 75, number: 23, value: 2500000, salary: 180000, clause: 10000000, transferState: 'Retenido', role: 'mixto' },
    { name: 'Santiago Ascacíbar', birthDate: '1997-02-25', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['mediocampista mixto'], age: 28, nation: 'ARG', contractYears: 4, rating: 76, projection: 76, number: 25, value: 5000000, salary: 1000000, clause: 20000000, transferState: 'Intocable', role: 'contención' },
    { name: 'Malcom Braida', birthDate: '1997-05-17', pos: 'MED', posDetail: 'volante por izquierda', altPosDetail: ['lateral izquierdo', 'extremo izquierdo'], age: 28, nation: 'ARG', contractYears: 3, rating: 70, projection: 72, number: 27, value: 3000000, salary: 650000, transferState: 'Retenido', role: 'mixto' },
    // Los dos pibes de la Reserva que acaba de subir el club. Su valoración de
    // hoy es la de un juvenil recién convocado, no la de un titular de Primera:
    // lo que los hace interesantes es la proyección, que es de dónde pueden
    // llegar si les das minutos.
    { name: 'Lautaro Mendieta', birthDate: '2006-04-27', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['extremo derecho', 'mediocampista ofensivo'], age: 19, nation: 'ARG', contractYears: 4, rating: 61, projection: 75, number: 33, value: 1200000, salary: 150000, clause: 10000000, transferState: 'Retenido', role: 'mixto' },
    { name: 'Milton Giménez', birthDate: '1996-08-12', pos: 'DEL', posDetail: 'delantero centro', age: 29, nation: 'ARG', contractYears: 2, rating: 73, projection: 72, number: 9, value: 3000000, salary: 750000, clause: 15000000, transferState: 'Retenido' },
    { name: 'Ángel Romero', birthDate: '1992-07-04', pos: 'DEL', posDetail: 'extremo derecho', altPosDetail: ['segundo delantero', 'extremo izquierdo'], age: 33, nation: 'PAR', contractYears: 1, rating: 69, projection: 66, number: 11, value: 800000, salary: 700000, transferState: 'Fin de contrato cercano' },
    { name: 'Enner Valencia', birthDate: '1989-11-04', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 36, nation: 'ECU', contractYears: 2, rating: 72, projection: 70, number: 13, value: 1200000, salary: 1200000, transferState: 'Retenido' },
    { name: 'Miguel Merentiel', birthDate: '1996-02-24', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero', 'extremo izquierdo'], age: 29, nation: 'URU', contractYears: 2, rating: 79, projection: 78, number: 16, value: 6000000, salary: 1100000, clause: 20000000, transferState: 'Intocable' },
    { name: 'Leonel Flores', birthDate: '2007-02-06', pos: 'DEL', posDetail: 'extremo derecho', altPosDetail: ['extremo izquierdo', 'segundo delantero'], age: 18, nation: 'ARG', contractYears: 3, rating: 69, projection: 79, number: 19, value: 4500000, salary: 160000, clause: 12000000, transferState: 'Retenido' },
    { name: 'Sebastián Villa', birthDate: '1996-05-19', pos: 'DEL', posDetail: 'extremo derecho', altPosDetail: ['extremo izquierdo', 'segundo delantero'], age: 29, nation: 'COL', contractYears: 5, rating: 77, projection: 77, number: 22, value: 6500000, salary: 1200000, clause: 15000000, transferState: 'Intocable' },
    { name: 'Adam Bareiro', birthDate: '1996-07-26', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 29, nation: 'PAR', contractYears: 3, rating: 71, projection: 71, number: 28, value: 2800000, salary: 700000, transferState: 'Retenido' },
    { name: 'Rodrigo Bacidalupe', birthDate: '2007-07-22', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 18, nation: 'ARG', contractYears: 2, rating: 62, projection: 78, number: 44, value: 1500000, salary: 150000, clause: 10000000, transferState: 'Retenido' },
  ],
};

// Formación habitual de cada club y su once titular, tal como lo para el
// técnico en la realidad. Sirve para que el equipo arranque parado como
// corresponde en vez de armarse solo por valoración. El usuario después lo
// acomoda a su gusto desde la pantalla de Plantel.
//
// Un club sin entrada acá arma el once automáticamente (ver
// recomputeStartingSlots en engine.js).
const REAL_LINEUPS = {
  boca: {
    formation: '433',
    xi: ['Álvaro Montero', 'Leandro Lozano', 'Lautaro Di Lollo', 'Marco Pellegrino', 'Lautaro Blanco', 'Santiago Ascacíbar', 'Leandro Paredes', 'Tomás Belmonte', 'Alan Velasco', 'Miguel Merentiel', 'Sebastián Villa'],
  },
};

// Acá vivía CLUB_COLORS, una tabla de colores de camiseta escrita a mano que
// tenía UN club adentro (River). Ya no hace falta: la camiseta de cada club
// sale de sus colores reales, que tools/generar-colores.py saca del escudo
// (js/colores.js), y el diseño —rayas, franja, banda— está en CAMISETAS, en
// js/ui.js, al lado de donde se dibuja.
