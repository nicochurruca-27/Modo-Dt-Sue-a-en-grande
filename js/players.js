// Planteles reales, investigados club por club (temporada 2026, mediados de
// año). Un club que no tiene entrada acá sigue usando el generador de
// jugadores al azar (ver generateSquad en engine.js) — así se puede ir
// completando de a poco sin romper nada.
//
// Edad, nacionalidad y año de vencimiento de contrato salen de fuentes como
// Transfermarkt (capturas mandadas por el usuario). La valoración (rating,
// 0-100) es una estimación nuestra en base al nivel del jugador, no un dato
// oficial — no hay una base pública equivalente al "overall" de un videojuego
// con licencia, así que esto es lo más parecido que se puede armar a mano.
//
// contractYears = temporadas que le quedan de contrato contando esta (por
// ejemplo, un contrato que vence en 2026 = 1; en 2028 = 3).
const REAL_ROSTERS = {
  river: [
    { name: 'Santiago Beltrán', pos: 'POR', age: 21, nation: 'ARG', contractYears: 2, rating: 68 },
    { name: 'Ezequiel Centurión', pos: 'POR', age: 29, nation: 'ARG', contractYears: 1, rating: 73 },
    { name: 'Lautaro Rivero', pos: 'DEF', age: 22, nation: 'ARG', contractYears: 4, rating: 75 },
    { name: 'Lucas Martínez Quarta', pos: 'DEF', age: 30, nation: 'ARG', contractYears: 3, rating: 80 },
    { name: 'Tobías Ramírez', pos: 'DEF', age: 19, nation: 'ARG', contractYears: 4, rating: 68 },
    { name: 'Juan Carlos Portillo', pos: 'DEF', age: 26, nation: 'ARG', contractYears: 3, rating: 70 },
    { name: 'Nicolás Otamendi', pos: 'DEF', age: 38, nation: 'ARG', contractYears: 2, rating: 78 },
    { name: 'Facundo González', pos: 'DEF', age: 20, nation: 'ARG', contractYears: 3, rating: 67 },
    { name: 'Francisco Ortega', pos: 'DEF', age: 27, nation: 'ARG', contractYears: 4, rating: 71 },
    { name: 'Matías Viña', pos: 'DEF', age: 28, nation: 'URU', contractYears: 1, rating: 75 },
    { name: 'Marcos Acuña', pos: 'DEF', age: 34, nation: 'ARG', contractYears: 2, rating: 80 },
    { name: 'Gonzalo Montiel', pos: 'DEF', age: 29, nation: 'ARG', contractYears: 3, rating: 81 },
    { name: 'Fabricio Bustos', pos: 'DEF', age: 30, nation: 'ARG', contractYears: 2, rating: 74 },
    { name: 'Giovanni González', pos: 'DEF', age: 31, nation: 'URU', contractYears: 2, rating: 72 },
    { name: 'Aníbal Moreno', pos: 'MED', age: 27, nation: 'ARG', contractYears: 2, rating: 76 },
    { name: 'Fausto Vera', pos: 'MED', age: 26, nation: 'ARG', contractYears: 1, rating: 74 },
    { name: 'Lucas Silva', pos: 'MED', age: 19, nation: 'ARG', contractYears: 3, rating: 65 },
    { name: 'Tobías Andrada', pos: 'MED', age: 19, nation: 'ARG', contractYears: 5, rating: 64 },
    { name: 'Mauro Arambarri', pos: 'MED', age: 30, nation: 'URU', contractYears: 3, rating: 77 },
    { name: 'Lautaro Pereyra', pos: 'MED', age: 18, nation: 'ARG', contractYears: 3, rating: 62 },
    { name: 'Thiago Almada', pos: 'MED', age: 25, nation: 'ARG', contractYears: 4, rating: 84 },
    { name: 'Tomás Galván', pos: 'MED', age: 26, nation: 'ARG', contractYears: 3, rating: 73 },
    { name: 'Juan Cruz Meza', pos: 'MED', age: 18, nation: 'ARG', contractYears: 3, rating: 63 },
    { name: 'Ángel Correa', pos: 'MED', age: 31, nation: 'ARG', contractYears: 4, rating: 80 },
    { name: 'Lucas Beltrán', pos: 'DEL', age: 25, nation: 'ARG', contractYears: 2, rating: 78 },
    { name: 'Sebastián Driussi', pos: 'DEL', age: 30, nation: 'ARG', contractYears: 3, rating: 78 },
    { name: 'Rafael Santos Borré', pos: 'DEL', age: 30, nation: 'COL', contractYears: 4, rating: 79 },
    { name: 'Agustín Ruberto', pos: 'DEL', age: 20, nation: 'ARG', contractYears: 2, rating: 66 },
  ],
};
