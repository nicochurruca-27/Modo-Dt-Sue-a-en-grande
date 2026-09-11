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
const REAL_ROSTERS = {
  river: [
    { name: 'Ezequiel Centurión', pos: 'POR', posDetail: 'arquero', age: 29, nation: 'ARG', contractYears: 1, rating: 68, number: 33 },
    { name: 'Santiago Beltrán', pos: 'POR', posDetail: 'arquero', age: 21, nation: 'ARG', contractYears: 2, rating: 65, number: 41 },
    { name: 'Jeremías Martinet', pos: 'POR', posDetail: 'arquero', age: 21, nation: 'ARG', contractYears: 3, rating: 62, number: 57 },
    { name: 'Tobías Ramírez', pos: 'DEF', posDetail: 'defensor central', age: 19, nation: 'ARG', contractYears: 4, rating: 64, number: 2 },
    { name: 'Francisco Ortega', pos: 'DEF', posDetail: 'lateral izquierdo', altPosDetail: ['carrilero izquierdo'], age: 27, nation: 'ARG', contractYears: 5, rating: 72, number: 3 },
    { name: 'Lautaro Rivero', pos: 'DEF', posDetail: 'defensor central', age: 22, nation: 'ARG', contractYears: 4, rating: 73, number: 13 },
    { name: 'Giovanni González', pos: 'DEF', posDetail: 'lateral derecho', altPosDetail: ['lateral izquierdo'], age: 31, nation: 'URU', contractYears: 2, rating: 70, number: 20 },
    { name: 'Marcos Acuña', pos: 'DEF', posDetail: 'lateral izquierdo', altPosDetail: ['carrilero izquierdo'], age: 34, nation: 'ARG', contractYears: 2, rating: 76, number: 21 },
    { name: 'Lucas Martínez Quarta', pos: 'DEF', posDetail: 'defensor central', altPosDetail: ['mediocampista defensivo'], age: 30, nation: 'ARG', contractYears: 3, rating: 77, number: 28 },
    { name: 'Gonzalo Montiel', pos: 'DEF', posDetail: 'lateral derecho', altPosDetail: ['lateral izquierdo'], age: 29, nation: 'ARG', contractYears: 3, rating: 78, number: 29 },
    { name: 'Nicolás Otamendi', pos: 'DEF', posDetail: 'defensor central', age: 38, nation: 'ARG', contractYears: 2, rating: 77, number: 30 },
    { name: 'Facundo González', pos: 'DEF', posDetail: 'defensor central', age: 20, nation: 'ARG', contractYears: 3, rating: 62, number: 31 },
    { name: 'Juan Carlos Portillo', pos: 'DEF', posDetail: 'defensor central', altPosDetail: ['mediocampista defensivo'], age: 26, nation: 'ARG', contractYears: 4, rating: 69, number: 5 },
    { name: 'Aníbal Moreno', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['mediocampista mixto'], age: 27, nation: 'ARG', contractYears: 4, rating: 78, number: 6, role: 'contención' },
    { name: 'Mauro Arambarri', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['mediocampista defensivo'], age: 30, nation: 'URU', contractYears: 3, rating: 77, number: 8, role: 'mixto' },
    { name: 'Fausto Vera', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['mediocampista mixto'], age: 26, nation: 'ARG', contractYears: 1, rating: 70, number: 15, role: 'contención', loanFrom: 'Atlético Mineiro', loanUntil: '31/12/2026' },
    { name: 'Thiago Almada', pos: 'MED', posDetail: 'mediocampista ofensivo', altPosDetail: ['extremo izquierdo'], age: 25, nation: 'ARG', contractYears: 5, rating: 82, number: 23, role: 'ofensivo' },
    { name: 'Juan Cruz Meza', pos: 'MED', posDetail: 'mediocampista ofensivo', altPosDetail: ['extremo derecho'], age: 18, nation: 'ARG', contractYears: 3, rating: 61, number: 24, role: 'ofensivo' },
    { name: 'Tomás Galván', pos: 'MED', posDetail: 'mediocampista ofensivo', altPosDetail: ['extremo izquierdo'], age: 26, nation: 'ARG', contractYears: 3, rating: 66, number: 26, role: 'ofensivo' },
    { name: 'Lucas Silva', pos: 'MED', posDetail: 'mediocampista defensivo', age: 19, nation: 'ARG', contractYears: 3, rating: 58, number: 44, role: 'contención' },
    { name: 'Tobías Andrada', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['mediocampista defensivo'], age: 19, nation: 'ARG', contractYears: 5, rating: 62, number: 50, role: 'mixto' },
    { name: 'Lautaro Pereyra', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['mediocampista ofensivo'], age: 18, nation: 'ARG', contractYears: 3, rating: 57, number: 25, role: 'mixto' },
    { name: 'Sebastián Driussi', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 30, nation: 'ARG', contractYears: 3, rating: 77, number: 9 },
    { name: 'Ángel Correa', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['extremo derecho'], age: 31, nation: 'ARG', contractYears: 4, rating: 82, number: 10 },
    { name: 'Lucas Beltrán', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 25, nation: 'ARG', contractYears: 2, rating: 74, number: 18, loanFrom: 'Fiorentina', loanUntil: '30/06/2027' },
    { name: 'Rafael Santos Borré', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 30, nation: 'COL', contractYears: 4, rating: 77, number: 19 },
    { name: 'Agustín Ruberto', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 20, nation: 'ARG', contractYears: 2, rating: 64, number: 32 },
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
    { name: 'Álvaro Montero', pos: 'POR', posDetail: 'arquero', age: 31, nation: 'COL', contractYears: 5, rating: 75, projection: 75, number: 1, value: 3000000, salary: 1000000, transferState: 'Retenido' },
    { name: 'Leandro Brey', pos: 'POR', posDetail: 'arquero', age: 23, nation: 'ARG', contractYears: 4, rating: 66, projection: 76, number: 12, value: 5000000, salary: 450000, clause: 15000000, transferState: 'Retenido' },
    { name: 'Javier García', pos: 'POR', posDetail: 'arquero', age: 39, nation: 'ARG', contractYears: 1, rating: 60, projection: 58, number: 30, value: 150000, salary: 300000, transferState: 'Fin de contrato cercano' },
    { name: 'Lautaro Di Lollo', pos: 'DEF', posDetail: 'defensor central', age: 22, nation: 'ARG', contractYears: 4, rating: 69, projection: 78, number: 2, value: 7000000, salary: 500000, clause: 20000000, transferState: 'Retenido' },
    { name: 'Lautaro Blanco', pos: 'DEF', posDetail: 'lateral izquierdo', altPosDetail: ['carrilero izquierdo'], age: 27, nation: 'ARG', contractYears: 3, rating: 73, projection: 74, number: 3, value: 4500000, salary: 700000, transferState: 'Retenido' },
    { name: 'Nicolás Figal', pos: 'DEF', posDetail: 'defensor central', age: 32, nation: 'ARG', contractYears: 2, rating: 70, projection: 68, number: 4, value: 1000000, salary: 900000, transferState: 'Retenido' },
    { name: 'Leandro Lozano', pos: 'DEF', posDetail: 'lateral derecho', altPosDetail: ['carrilero derecho'], age: 27, nation: 'URU', contractYears: 5, rating: 72, projection: 74, number: 17, value: 3500000, salary: 600000, clause: 15000000, transferState: 'Retenido' },
    { name: 'Dylan Gorosito', pos: 'DEF', posDetail: 'lateral derecho', altPosDetail: ['carrilero derecho'], age: 20, nation: 'ARG', contractYears: 5, rating: 64, projection: 76, number: 24, value: 4500000, salary: 250000, clause: 12000000, transferState: 'Retenido' },
    { name: 'Marco Pellegrino', pos: 'DEF', posDetail: 'defensor central', age: 24, nation: 'ARG', contractYears: 4, rating: 73, projection: 79, number: 26, value: 6000000, salary: 600000, clause: 18000000, transferState: 'Retenido' },
    { name: 'Ayrton Costa', pos: 'DEF', posDetail: 'defensor central', altPosDetail: ['lateral izquierdo'], age: 27, nation: 'ARG', contractYears: 3, rating: 70, projection: 73, number: 32, value: 3500000, salary: 600000, transferState: 'Retenido' },
    { name: 'Facundo Herrera', pos: 'DEF', posDetail: 'defensor central', age: 20, nation: 'ARG', contractYears: 3, rating: 60, projection: 73, number: 42, value: 1000000, salary: 150000, clause: 8000000, transferState: 'Retenido' },
    { name: 'Leandro Paredes', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['mediocampista mixto'], age: 32, nation: 'ARG', contractYears: 3, rating: 81, projection: 81, number: 5, value: 6000000, salary: 2200000, clause: 20000000, transferState: 'Intocable', role: 'contención' },
    { name: 'Rodrigo Battaglia', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['defensor central', 'mediocampista mixto'], age: 35, nation: 'ARG', contractYears: 2, rating: 70, projection: 68, number: 6, value: 800000, salary: 850000, transferState: 'Retenido', role: 'contención' },
    { name: 'Carlos Palacios', pos: 'MED', posDetail: 'mediocampista ofensivo', altPosDetail: ['extremo derecho', 'extremo izquierdo'], age: 26, nation: 'CHI', contractYears: 4, rating: 73, projection: 78, number: 7, value: 5000000, salary: 900000, clause: 18000000, transferState: 'Retenido', role: 'ofensivo' },
    { name: 'Tomás Belmonte', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['mediocampista defensivo'], age: 28, nation: 'ARG', contractYears: 3, rating: 72, projection: 74, number: 8, value: 3000000, salary: 750000, transferState: 'Retenido', role: 'mixto' },
    { name: 'Tomás Aranda', pos: 'MED', posDetail: 'mediocampista ofensivo', altPosDetail: ['extremo izquierdo', 'mediocampista mixto'], age: 19, nation: 'ARG', contractYears: 4, rating: 70, projection: 77, number: 10, value: 6500000, salary: 180000, clause: 15000000, transferState: 'Retenido', role: 'ofensivo' },
    { name: 'Williams Alarcón', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['mediocampista defensivo'], age: 25, nation: 'CHI', contractYears: 3, rating: 71, projection: 75, number: 15, value: 3500000, salary: 750000, transferState: 'Retenido', role: 'mixto' },
    { name: 'Milton Delgado', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['mediocampista mixto'], age: 21, nation: 'ARG', contractYears: 4, rating: 75, projection: 80, number: 18, value: 10000000, salary: 250000, clause: 20000000, transferState: 'Intocable', role: 'contención' },
    // La investigación lo trajo como MED, pero su posición es extremo
    // izquierdo y en el once titular ocupa un puesto de ataque: en el juego
    // los extremos son DEL (ver delWidth 'abierta' en las formaciones).
    { name: 'Alan Velasco', pos: 'DEL', posDetail: 'extremo izquierdo', altPosDetail: ['mediocampista ofensivo', 'extremo derecho'], age: 24, nation: 'ARG', contractYears: 3, rating: 76, projection: 80, number: 20, value: 6500000, salary: 1100000, clause: 20000000, transferState: 'Retenido' },
    { name: 'Camilo Rey Domenech', pos: 'MED', posDetail: 'mediocampista mixto', altPosDetail: ['mediocampista defensivo'], age: 20, nation: 'ARG', contractYears: 3, rating: 61, projection: 75, number: 23, value: 2500000, salary: 180000, clause: 10000000, transferState: 'Retenido', role: 'mixto' },
    { name: 'Santiago Ascacíbar', pos: 'MED', posDetail: 'mediocampista defensivo', altPosDetail: ['mediocampista mixto'], age: 29, nation: 'ARG', contractYears: 4, rating: 76, projection: 76, number: 25, value: 5000000, salary: 1000000, clause: 20000000, transferState: 'Intocable', role: 'contención' },
    { name: 'Malcom Braida', pos: 'MED', posDetail: 'volante por izquierda', altPosDetail: ['lateral izquierdo', 'extremo izquierdo'], age: 29, nation: 'ARG', contractYears: 3, rating: 70, projection: 72, number: 27, value: 3000000, salary: 650000, transferState: 'Retenido', role: 'mixto' },
    { name: 'Milton Giménez', pos: 'DEL', posDetail: 'delantero centro', age: 30, nation: 'ARG', contractYears: 2, rating: 73, projection: 72, number: 9, value: 3000000, salary: 750000, clause: 15000000, transferState: 'Retenido' },
    { name: 'Ángel Romero', pos: 'DEL', posDetail: 'extremo derecho', altPosDetail: ['segundo delantero', 'extremo izquierdo'], age: 34, nation: 'PAR', contractYears: 1, rating: 69, projection: 66, number: 11, value: 800000, salary: 700000, transferState: 'Fin de contrato cercano' },
    { name: 'Enner Valencia', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 36, nation: 'ECU', contractYears: 2, rating: 72, projection: 70, number: 13, value: 1200000, salary: 1200000, transferState: 'Retenido' },
    { name: 'Miguel Merentiel', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero', 'extremo izquierdo'], age: 30, nation: 'URU', contractYears: 2, rating: 79, projection: 78, number: 16, value: 6000000, salary: 1100000, clause: 20000000, transferState: 'Intocable' },
    { name: 'Leonel Flores', pos: 'DEL', posDetail: 'extremo derecho', altPosDetail: ['extremo izquierdo', 'segundo delantero'], age: 19, nation: 'ARG', contractYears: 3, rating: 69, projection: 79, number: 19, value: 4500000, salary: 160000, clause: 12000000, transferState: 'Retenido' },
    { name: 'Sebastián Villa', pos: 'DEL', posDetail: 'extremo derecho', altPosDetail: ['extremo izquierdo', 'segundo delantero'], age: 30, nation: 'COL', contractYears: 5, rating: 77, projection: 77, number: 22, value: 6500000, salary: 1200000, clause: 15000000, transferState: 'Intocable' },
    { name: 'Adam Bareiro', pos: 'DEL', posDetail: 'delantero centro', altPosDetail: ['segundo delantero'], age: 30, nation: 'PAR', contractYears: 3, rating: 71, projection: 71, number: 28, value: 2800000, salary: 700000, transferState: 'Retenido' },
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

// Colores reales de la camiseta titular de cada club con plantel cargado (se
// va completando junto con los planteles). Un club sin entrada acá usa el
// color genérico (verde) del resto del juego.
const CLUB_COLORS = {
  river: { shirt: '#ffffff', band: '#d5001c', trim: '#0a0a0a' },
};
