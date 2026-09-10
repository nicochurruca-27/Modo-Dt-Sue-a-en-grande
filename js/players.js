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
// Todavía no se usa en la lógica del juego (que sigue trabajando con las 4
// categorías generales POR/DEF/MED/DEL + `role` para el mediocampo), pero
// queda guardada para el día que se quiera hacer más granular el sistema de
// posiciones/aptitud.
//
// `role` (solo en mediocampistas): 'contención' | 'mixto' | 'ofensivo' — se
// deriva directamente de `posDetail` para los MED. Se usa para el aro de
// color de la cancha en formaciones con línea de enganche, donde sí importa
// la diferencia entre "el 5" y el enganche.
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
    { name: 'Francisco Ortega', pos: 'DEF', posDetail: 'lateral izquierdo', age: 27, nation: 'ARG', contractYears: 5, rating: 72, number: 3 },
    { name: 'Lautaro Rivero', pos: 'DEF', posDetail: 'defensor central', age: 22, nation: 'ARG', contractYears: 4, rating: 73, number: 13 },
    { name: 'Giovanni González', pos: 'DEF', posDetail: 'lateral derecho', age: 31, nation: 'URU', contractYears: 2, rating: 70, number: 20 },
    { name: 'Marcos Acuña', pos: 'DEF', posDetail: 'lateral izquierdo', age: 34, nation: 'ARG', contractYears: 2, rating: 76, number: 21 },
    { name: 'Lucas Martínez Quarta', pos: 'DEF', posDetail: 'defensor central', age: 30, nation: 'ARG', contractYears: 3, rating: 77, number: 28 },
    { name: 'Gonzalo Montiel', pos: 'DEF', posDetail: 'lateral derecho', age: 29, nation: 'ARG', contractYears: 3, rating: 78, number: 29 },
    { name: 'Nicolás Otamendi', pos: 'DEF', posDetail: 'defensor central', age: 38, nation: 'ARG', contractYears: 2, rating: 77, number: 30 },
    { name: 'Facundo González', pos: 'DEF', posDetail: 'defensor central', age: 20, nation: 'ARG', contractYears: 3, rating: 62, number: 31 },
    { name: 'Juan Carlos Portillo', pos: 'DEF', posDetail: 'defensor central', age: 26, nation: 'ARG', contractYears: 4, rating: 69, number: 5 },
    { name: 'Aníbal Moreno', pos: 'MED', posDetail: 'mediocampista defensivo', age: 27, nation: 'ARG', contractYears: 4, rating: 78, number: 6, role: 'contención' },
    { name: 'Mauro Arambarri', pos: 'MED', posDetail: 'mediocampista mixto', age: 30, nation: 'URU', contractYears: 3, rating: 77, number: 8, role: 'mixto' },
    { name: 'Fausto Vera', pos: 'MED', posDetail: 'mediocampista defensivo', age: 26, nation: 'ARG', contractYears: 1, rating: 70, number: 15, role: 'contención', loanFrom: 'Atlético Mineiro', loanUntil: '31/12/2026' },
    { name: 'Thiago Almada', pos: 'MED', posDetail: 'mediocampista ofensivo', age: 25, nation: 'ARG', contractYears: 5, rating: 82, number: 23, role: 'ofensivo' },
    { name: 'Juan Cruz Meza', pos: 'MED', posDetail: 'mediocampista ofensivo', age: 18, nation: 'ARG', contractYears: 3, rating: 61, number: 24, role: 'ofensivo' },
    { name: 'Tomás Galván', pos: 'MED', posDetail: 'mediocampista ofensivo', age: 26, nation: 'ARG', contractYears: 3, rating: 66, number: 26, role: 'ofensivo' },
    { name: 'Lucas Silva', pos: 'MED', posDetail: 'mediocampista defensivo', age: 19, nation: 'ARG', contractYears: 3, rating: 58, number: 44, role: 'contención' },
    { name: 'Tobías Andrada', pos: 'MED', posDetail: 'mediocampista mixto', age: 19, nation: 'ARG', contractYears: 5, rating: 62, number: 50, role: 'mixto' },
    { name: 'Lautaro Pereyra', pos: 'MED', posDetail: 'mediocampista mixto', age: 18, nation: 'ARG', contractYears: 3, rating: 57, number: 25, role: 'mixto' },
    { name: 'Sebastián Driussi', pos: 'DEL', posDetail: 'delantero centro', age: 30, nation: 'ARG', contractYears: 3, rating: 77, number: 9 },
    { name: 'Ángel Correa', pos: 'DEL', posDetail: 'delantero centro', age: 31, nation: 'ARG', contractYears: 4, rating: 82, number: 10 },
    { name: 'Lucas Beltrán', pos: 'DEL', posDetail: 'delantero centro', age: 25, nation: 'ARG', contractYears: 2, rating: 74, number: 18, loanFrom: 'Fiorentina', loanUntil: '30/06/2027' },
    { name: 'Rafael Santos Borré', pos: 'DEL', posDetail: 'delantero centro', age: 30, nation: 'COL', contractYears: 4, rating: 77, number: 19 },
    { name: 'Agustín Ruberto', pos: 'DEL', posDetail: 'delantero centro', age: 20, nation: 'ARG', contractYears: 2, rating: 64, number: 32 },
  ],
};

// Colores reales de la camiseta titular de cada club con plantel cargado (se
// va completando junto con los planteles). Un club sin entrada acá usa el
// color genérico (verde) del resto del juego.
const CLUB_COLORS = {
  river: { shirt: '#ffffff', band: '#d5001c', trim: '#0a0a0a' },
};
