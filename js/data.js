// Contenido del juego: clubes (Primera División y Primera Nacional),
// nombres de jugadores por país y decisiones posibles.

// division: 'D1' (Primera División) | 'D2' (Primera Nacional)
// zone: 'A' | 'B' — D1 se juega en 2 zonas de 15 equipos, D2 en 2 zonas de 18.
// Sin escudos por ahora: el juego muestra solo el nombre de cada club.
//
// reputation (1-5): nivel deportivo del plantel (de dónde sale la fuerza en
// cancha). budgetTier (1-5, opcional): situación económica real del club,
// que puede ser distinta de su nivel deportivo — por eso son dos campos
// separados en vez de uno solo. Si un club no tiene budgetTier, se usa su
// reputation. Lista de clubes verificada contra el sorteo de zonas 2026 de
// AFA (Primera División y Primera Nacional); puede haber algún caso puntual
// desactualizado en categorías muy chicas, pero los movimientos grandes
// (descensos/ascensos recientes) están confirmados.
const CLUB_TEMPLATES = [
  // ---- Primera División — Zona A (15 equipos) ----
  { id: 'platense', name: 'Platense', division: 'D1', zone: 'A', reputation: 2 },
  { id: 'defensayjusticia', name: 'Defensa y Justicia', division: 'D1', zone: 'A', reputation: 3 },
  { id: 'centralcordoba', name: 'Central Córdoba (SdE)', division: 'D1', zone: 'A', reputation: 2 },
  { id: 'lanus', name: 'Lanús', division: 'D1', zone: 'A', reputation: 3 },
  { id: 'riestra', name: 'Deportivo Riestra', division: 'D1', zone: 'A', reputation: 2 },
  { id: 'talleres', name: 'Talleres', division: 'D1', zone: 'A', reputation: 4 },
  { id: 'boca', name: 'Boca Juniors', division: 'D1', zone: 'A', reputation: 5, budgetTier: 5 },
  { id: 'estudianteslp', name: 'Estudiantes de La Plata', division: 'D1', zone: 'A', reputation: 4 },
  { id: 'instituto', name: 'Instituto', division: 'D1', zone: 'A', reputation: 2 },
  { id: 'gimnasiamendoza', name: 'Gimnasia y Esgrima de Mendoza', division: 'D1', zone: 'A', reputation: 1 },
  { id: 'sanlorenzo', name: 'San Lorenzo', division: 'D1', zone: 'A', reputation: 3, budgetTier: 2 },
  { id: 'independiente', name: 'Independiente', division: 'D1', zone: 'A', reputation: 4 },
  { id: 'newells', name: "Newell's Old Boys", division: 'D1', zone: 'A', reputation: 4 },
  { id: 'union', name: 'Unión', division: 'D1', zone: 'A', reputation: 3 },
  { id: 'velez', name: 'Vélez Sarsfield', division: 'D1', zone: 'A', reputation: 4 },

  // ---- Primera División — Zona B (15 equipos) ----
  { id: 'argentinos', name: 'Argentinos Juniors', division: 'D1', zone: 'B', reputation: 3 },
  { id: 'aldosivi', name: 'Aldosivi', division: 'D1', zone: 'B', reputation: 2 },
  { id: 'atleticotucuman', name: 'Atlético Tucumán', division: 'D1', zone: 'B', reputation: 3 },
  { id: 'banfield', name: 'Banfield', division: 'D1', zone: 'B', reputation: 3 },
  { id: 'barracascentral', name: 'Barracas Central', division: 'D1', zone: 'B', reputation: 2 },
  { id: 'belgrano', name: 'Belgrano', division: 'D1', zone: 'B', reputation: 3 },
  { id: 'river', name: 'River Plate', division: 'D1', zone: 'B', reputation: 5, budgetTier: 5 },
  { id: 'gimnasialp', name: 'Gimnasia y Esgrima La Plata', division: 'D1', zone: 'B', reputation: 3 },
  { id: 'riocuarto', name: 'Estudiantes de Río Cuarto', division: 'D1', zone: 'B', reputation: 1 },
  { id: 'independienterivadavia', name: 'Independiente Rivadavia', division: 'D1', zone: 'B', reputation: 2 },
  { id: 'huracan', name: 'Huracán', division: 'D1', zone: 'B', reputation: 3 },
  { id: 'racing', name: 'Racing Club', division: 'D1', zone: 'B', reputation: 4 },
  { id: 'rosariocentral', name: 'Rosario Central', division: 'D1', zone: 'B', reputation: 4 },
  { id: 'sarmientojunin', name: 'Sarmiento de Junín', division: 'D1', zone: 'B', reputation: 2 },
  { id: 'tigre', name: 'Tigre', division: 'D1', zone: 'B', reputation: 3 },

  // ---- Primera Nacional — Zona A (18 equipos) ----
  { id: 'allboys', name: 'All Boys', division: 'D2', zone: 'A', reputation: 2 },
  { id: 'ferro', name: 'Ferro Carril Oeste', division: 'D2', zone: 'A', reputation: 2 },
  { id: 'madryn', name: 'Deportivo Madryn', division: 'D2', zone: 'A', reputation: 2 },
  { id: 'chacoforever', name: 'Chaco For Ever', division: 'D2', zone: 'A', reputation: 1 },
  { id: 'moron', name: 'Deportivo Morón', division: 'D2', zone: 'A', reputation: 2 },
  { id: 'estudiantesba', name: 'Estudiantes (BA)', division: 'D2', zone: 'A', reputation: 1 },
  { id: 'racingcordoba', name: 'Racing de Córdoba', division: 'D2', zone: 'A', reputation: 1 },
  { id: 'losandes', name: 'Los Andes', division: 'D2', zone: 'A', reputation: 1 },
  { id: 'mitresgo', name: 'Mitre de Santiago del Estero', division: 'D2', zone: 'A', reputation: 2 },
  { id: 'almirantebrown', name: 'Almirante Brown', division: 'D2', zone: 'A', reputation: 2 },
  { id: 'ciudaddebolivar', name: 'Ciudad de Bolívar', division: 'D2', zone: 'A', reputation: 1 },
  { id: 'colon', name: 'Colón', division: 'D2', zone: 'A', reputation: 3 },
  { id: 'centralnorte', name: 'Central Norte (Salta)', division: 'D2', zone: 'A', reputation: 1 },
  { id: 'godoycruz', name: 'Godoy Cruz', division: 'D2', zone: 'A', reputation: 3 },
  { id: 'santelmo', name: 'San Telmo', division: 'D2', zone: 'A', reputation: 2 },
  { id: 'sanmiguel', name: 'San Miguel', division: 'D2', zone: 'A', reputation: 1 },
  { id: 'defensoresbelgrano', name: 'Defensores de Belgrano', division: 'D2', zone: 'A', reputation: 2 },
  { id: 'acassuso', name: 'Acassuso', division: 'D2', zone: 'A', reputation: 1 },

  // ---- Primera Nacional — Zona B (18 equipos) ----
  { id: 'nuevachicago', name: 'Nueva Chicago', division: 'D2', zone: 'B', reputation: 2 },
  { id: 'atlanta', name: 'Atlanta', division: 'D2', zone: 'B', reputation: 2 },
  { id: 'sanmartintuc', name: 'San Martín de Tucumán', division: 'D2', zone: 'B', reputation: 2 },
  { id: 'gimnasiajujuy', name: 'Gimnasia de Jujuy', division: 'D2', zone: 'B', reputation: 1 },
  { id: 'almagro', name: 'Almagro', division: 'D2', zone: 'B', reputation: 2 },
  { id: 'chacarita', name: 'Chacarita Juniors', division: 'D2', zone: 'B', reputation: 3 },
  { id: 'sanmartinsj', name: 'San Martín de San Juan', division: 'D2', zone: 'B', reputation: 2 },
  { id: 'temperley', name: 'Temperley', division: 'D2', zone: 'B', reputation: 2 },
  { id: 'guemessgo', name: 'Güemes de Santiago del Estero', division: 'D2', zone: 'B', reputation: 1 },
  { id: 'tristansuarez', name: 'Tristán Suárez', division: 'D2', zone: 'B', reputation: 1 },
  { id: 'agropecuario', name: 'Agropecuario', division: 'D2', zone: 'B', reputation: 1 },
  { id: 'patronato', name: 'Patronato (Paraná)', division: 'D2', zone: 'B', reputation: 2 },
  { id: 'gimnasiaytiro', name: 'Gimnasia y Tiro (Salta)', division: 'D2', zone: 'B', reputation: 1 },
  { id: 'maipu', name: 'Deportivo Maipú', division: 'D2', zone: 'B', reputation: 2 },
  { id: 'quilmes', name: 'Quilmes', division: 'D2', zone: 'B', reputation: 3 },
  { id: 'colegiales', name: 'Colegiales', division: 'D2', zone: 'B', reputation: 1 },
  { id: 'atleticorafaela', name: 'Atlético de Rafaela', division: 'D2', zone: 'B', reputation: 3 },
  { id: 'midland', name: 'Ferrocarril Midland', division: 'D2', zone: 'B', reputation: 1 },
];

// Formaciones tácticas disponibles. def/med/del son la cantidad de jugadores
// de cada línea (siempre suman 10 + el arquero = 11). `mod` es un pequeño
// empujón a favor o en contra según qué tan ofensiva o defensiva es la
// formación, que se suma a la fuerza del equipo en cada partido.
const FORMATIONS = [
  { id: '532', name: '5-3-2', def: 5, med: 3, del: 2, style: 'Defensiva', mod: -2 },
  { id: '442', name: '4-4-2', def: 4, med: 4, del: 2, style: 'Equilibrada', mod: 0 },
  { id: '451', name: '4-5-1', def: 4, med: 5, del: 1, style: 'Equilibrada', mod: -1 },
  { id: '352', name: '3-5-2', def: 3, med: 5, del: 2, style: 'Equilibrada', mod: 1 },
  { id: '433', name: '4-3-3', def: 4, med: 3, del: 3, style: 'Ofensiva', mod: 2 },
  { id: '343', name: '3-4-3', def: 3, med: 4, del: 3, style: 'Ofensiva', mod: 3 },
];

// Distribución de nacionalidades de los jugadores generados. La liga es
// argentina, así que la mayoría de los planteles son de ese país, con una
// porción menor de jugadores de países vecinos (algo habitual en el fútbol
// argentino real).
const NATIONS = [
  { code: 'ARG', flag: '🇦🇷', name: 'Argentina', weight: 0.82 },
  { code: 'URU', flag: '🇺🇾', name: 'Uruguay', weight: 0.05 },
  { code: 'BRA', flag: '🇧🇷', name: 'Brasil', weight: 0.05 },
  { code: 'PAR', flag: '🇵🇾', name: 'Paraguay', weight: 0.04 },
  { code: 'COL', flag: '🇨🇴', name: 'Colombia', weight: 0.02 },
  { code: 'CHI', flag: '🇨🇱', name: 'Chile', weight: 0.02 },
];

const NAMES_BY_NATION = {
  ARG: {
    first: ['Lionel', 'Ángel', 'Sergio', 'Nicolás', 'Rodrigo', 'Emiliano', 'Julián', 'Enzo', 'Alexis', 'Marcos', 'Franco', 'Thiago', 'Exequiel', 'Gonzalo', 'Leandro', 'Cristian', 'Matías', 'Lautaro', 'Joaquín', 'Bruno', 'Federico', 'Ezequiel', 'Agustín', 'Ramiro', 'Ivo', 'Tomás', 'Santiago', 'Facundo', 'Maximiliano', 'Diego'],
    last: ['Gómez', 'Fernández', 'Rodríguez', 'Pérez', 'López', 'Martínez', 'García', 'González', 'Sánchez', 'Romero', 'Sosa', 'Torres', 'Flores', 'Acosta', 'Benítez', 'Medina', 'Herrera', 'Aguirre', 'Vega', 'Cabrera', 'Ríos', 'Molina', 'Silva', 'Castro', 'Ortiz', 'Núñez', 'Ibáñez', 'Duarte', 'Paredes', 'Ledesma'],
  },
  URU: {
    first: ['Diego', 'Luis', 'Edinson', 'Federico', 'Nahitan', 'Rodrigo', 'Matías', 'Giorgian', 'Darwin', 'Ronald'],
    last: ['Suárez', 'Cavani', 'Godín', 'Bentancur', 'Valverde', 'Núñez', 'Araujo', 'Torreira', 'Pereira', 'De Arrascaeta'],
  },
  BRA: {
    first: ['Gabriel', 'Rodrygo', 'Lucas', 'Vinícius', 'Bruno', 'Éder', 'Raphael', 'Marquinhos', 'Fabinho', 'Gustavo'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Almeida', 'Ribeiro', 'Carvalho', 'Barbosa'],
  },
  PAR: {
    first: ['Miguel', 'Gustavo', 'Ángel', 'Junior', 'Óscar', 'Antonio', 'Fabián', 'Derlis'],
    last: ['González', 'Cardozo', 'Romero', 'Alonso', 'Gómez', 'Villalba', 'Ríos', 'Duarte'],
  },
  COL: {
    first: ['James', 'Radamel', 'Juan', 'Luis', 'David', 'Yerry', 'Rafael', 'Falcao'],
    last: ['Rodríguez', 'Falcao', 'Cuadrado', 'Muriel', 'Ospina', 'Mina', 'Borré', 'García'],
  },
  CHI: {
    first: ['Alexis', 'Arturo', 'Gary', 'Claudio', 'Charles', 'Eduardo'],
    last: ['Sánchez', 'Vidal', 'Medel', 'Bravo', 'Aránguiz', 'Vargas'],
  },
};

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
      { label: 'Foco táctico', tacticMod: 3, moraleMod: 0, note: 'Se trabajaron los movimientos para el partido.', growthBoost: true },
      { label: 'Día de descanso', tacticMod: -2, moraleMod: 3, note: 'El plantel agradece el descanso extra.' },
    ],
  },
];

const PENALTY_DIRECTIONS = ['Izquierda', 'Centro', 'Derecha'];
