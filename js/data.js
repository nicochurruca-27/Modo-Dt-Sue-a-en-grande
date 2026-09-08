// Contenido del juego: clubes, nombres para generar jugadores y decisiones.

const CLUBS = [
  { id: 'river', name: 'River Plate', reputation: 5, budget: 8000000 },
  { id: 'boca', name: 'Boca Juniors', reputation: 5, budget: 8000000 },
  { id: 'racing', name: 'Racing Club', reputation: 4, budget: 5000000 },
  { id: 'independiente', name: 'Independiente', reputation: 4, budget: 5000000 },
  { id: 'sanlorenzo', name: 'San Lorenzo', reputation: 3, budget: 3500000 },
  { id: 'velez', name: 'Vélez Sarsfield', reputation: 3, budget: 3500000 },
];

const FIRST_NAMES = [
  'Lionel', 'Ángel', 'Sergio', 'Nicolás', 'Rodrigo', 'Emiliano', 'Julián',
  'Enzo', 'Alexis', 'Marcos', 'Franco', 'Thiago', 'Exequiel', 'Gonzalo',
  'Leandro', 'Cristian', 'Matías', 'Lautaro', 'Joaquín', 'Bruno', 'Federico',
  'Ezequiel', 'Agustín', 'Ramiro', 'Ivo', 'Tomás', 'Santiago', 'Facundo',
  'Maximiliano', 'Diego',
];

const LAST_NAMES = [
  'Gómez', 'Fernández', 'Rodríguez', 'Pérez', 'López', 'Martínez', 'García',
  'González', 'Sánchez', 'Romero', 'Sosa', 'Torres', 'Flores', 'Acosta',
  'Benítez', 'Medina', 'Herrera', 'Aguirre', 'Vega', 'Cabrera', 'Ríos',
  'Molina', 'Silva', 'Castro', 'Ortiz', 'Núñez', 'Ibáñez', 'Duarte',
  'Paredes', 'Ledesma',
];

// 16 jugadores por plantel: 2 arqueros, 5 defensores, 5 mediocampistas, 4 delanteros.
const SQUAD_POSITIONS = [
  'POR', 'POR',
  'DEF', 'DEF', 'DEF', 'DEF', 'DEF',
  'MED', 'MED', 'MED', 'MED', 'MED',
  'DEL', 'DEL', 'DEL', 'DEL',
];

const DECISIONS = [
  {
    id: 'tactica',
    title: 'Charla táctica',
    description: 'Antes del partido definís cómo va a plantarse el equipo.',
    options: [
      { label: 'Salir a presionar arriba', tacticMod: 4, moraleMod: 0, note: 'El equipo va a buscar el arco rival desde el arranque.' },
      { label: 'Jugar de contragolpe', tacticMod: 1, moraleMod: 0, note: 'Un planteo equilibrado, esperando los espacios.' },
      { label: 'Plantarse atrás y cuidar el resultado', tacticMod: -3, moraleMod: 0, note: 'Prioridad: no recibir goles.' },
    ],
  },
  {
    id: 'prensa',
    title: 'Rueda de prensa',
    description: 'Un periodista pregunta por la floja racha del equipo.',
    options: [
      { label: 'Bancar públicamente al plantel', tacticMod: 0, moraleMod: 4, note: 'Los jugadores sienten el respaldo del técnico.' },
      { label: 'Pedir más esfuerzo sin filtro', tacticMod: 2, moraleMod: -2, note: 'El plantel sale caliente, con más intensidad pero incómodo.' },
      { label: 'Responder con evasivas', tacticMod: 0, moraleMod: 0, note: 'Nadie se entera de nada, todo sigue igual.' },
    ],
  },
  {
    id: 'plantel',
    title: 'Pedido en el vestuario',
    description: 'Un jugador suplente te pide más minutos.',
    options: [
      { label: 'Darle titularidad esta fecha', tacticMod: -1, moraleMod: 3, note: 'El plantel valora que escuchás a todos, aunque el equipo pierde rodaje.' },
      { label: 'Explicarle que debe esperar su turno', tacticMod: 0, moraleMod: -2, note: 'El jugador no queda conforme.' },
      { label: 'Rotar todo el equipo para la fecha', tacticMod: -2, moraleMod: 2, note: 'Piernas frescas, pero menos funcionamiento colectivo.' },
    ],
  },
  {
    id: 'dirigencia',
    title: 'Pedido de la dirigencia',
    description: 'Desde arriba piden un triunfo sí o sí en esta fecha.',
    options: [
      { label: 'Aceptar la presión y salir con todo', tacticMod: 3, moraleMod: -1, note: 'Se juega a matar o morir.' },
      { label: 'Pedir tiempo y jugar tranquilo', tacticMod: 0, moraleMod: 1, note: 'Le bajás el tono a la exigencia.' },
      { label: 'Ignorar el pedido', tacticMod: 0, moraleMod: -3, note: 'La dirigencia queda molesta con la decisión.' },
    ],
  },
  {
    id: 'entrenamiento',
    title: 'Entrenamiento de la semana',
    description: 'Definís en qué enfocar los trabajos previos al partido.',
    options: [
      { label: 'Foco físico', tacticMod: -1, moraleMod: 1, note: 'El equipo llega más fresco físicamente.' },
      { label: 'Foco táctico', tacticMod: 3, moraleMod: 0, note: 'Se trabajaron los movimientos para el partido.' },
      { label: 'Día de descanso', tacticMod: -2, moraleMod: 3, note: 'El plantel agradece el descanso extra.' },
    ],
  },
];

const PENALTY_DIRECTIONS = ['Izquierda', 'Centro', 'Derecha'];
