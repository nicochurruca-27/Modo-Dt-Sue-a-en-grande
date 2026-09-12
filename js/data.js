// Contenido del juego: clubes (Primera División y Primera Nacional),
// nombres de jugadores por país y decisiones posibles.

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// El calendario de la carrera arranca el 1° de febrero, como el arranque
// real de la temporada de AFA, y avanza de a un día por cada "Avanzar" del
// jugador (ver Engine.startCalendarWeek/advanceCalendarDay).
const CALENDAR_START_MONTH = 1; // 0 = enero
const CALENDAR_START_DAY = 1;

// division: 'D1' (Primera División) | 'D2' (Primera Nacional)
// zone: 'A' | 'B' — D1 se juega en 2 zonas de 15 equipos, D2 en 2 zonas de 18.
// Los escudos reales están en escudos.js (por ahora solo los 30 de Primera
// División). Un club sin escudo cargado se dibuja con uno genérico con sus
// iniciales — ver clubCrest en ui.js.
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

// Clásicos de Primera División. En el torneo argentino, además de las 14
// fechas contra los equipos de tu propia zona hay dos fechas interzonales, y
// una de ellas es SIEMPRE contra el clásico rival. Por eso al sortear las
// zonas se separa a cada par: si los dos clásicos cayeran en la misma zona,
// esa fecha no existiría (ver Engine.rebalanceZones).
//
// Están solamente los clásicos de verdad, con los dos equipos en Primera.
// Los clubes que no aparecen acá (porque su clásico juega en otra categoría,
// como Unión con Colón o Aldosivi con Alvarado) se emparejan al azar cada
// temporada para esa fecha, igual que hace la AFA.
const CLASICOS = [
  ['boca', 'river'],
  ['racing', 'independiente'],
  ['sanlorenzo', 'huracan'],
  ['rosariocentral', 'newells'],
  ['estudianteslp', 'gimnasialp'],
  ['lanus', 'banfield'],
  ['talleres', 'belgrano'],
  ['gimnasiamendoza', 'independienterivadavia'],
];

// Formaciones tácticas disponibles. def/med/off/del son la cantidad de
// jugadores de cada línea (siempre suman 10 + el arquero = 11). `off` es la
// línea de enganches/mediapuntas/extremos entre el mediocampo y el ataque
// (formaciones como 4-3-1-2 o 4-2-3-1); las formaciones que no la usan
// simplemente no traen ese campo. `mod` es un pequeño empujón a favor o en
// contra según qué tan ofensiva o defensiva es la formación, que se suma a
// la fuerza del equipo en cada partido.
//
// `medShape` / `offShape` (opcional): en la mayoría de las formaciones la
// línea de mediocampo o de enganches no es "una sola banda pareja" — tiene
// roles distintos según el casillero (ej. un doble 5 con un recuperador y
// un organizador, o un mediocampista central más adelantado que los otros
// dos). Cada array lista, de izquierda a derecha, la posición detallada
// (`posDetail`, ver players.js) que se espera en ese casillero puntual. Se
// usa en Engine.applyShapeRefinement: si el jugador que pusiste ahí no
// tiene exactamente esa posición (ni como alternativa), un casillero que
// daría verde por las reglas generales baja a amarillo. Las líneas de un
// solo jugador (ej. el pivote de la 4-1-4-1) también pueden tener un
// medShape/offShape de un elemento, para afinar ese casillero único.
//
// `defWidth` / `medWidth` / `offWidth` / `delWidth` (opcional): qué tan
// ancha se dibuja esa línea en la cancha (buildPitchSvg, ui.js) respecto
// al ancho total disponible. Una línea sin este campo usa 'total' (todo
// el ancho, de punta a punta, igual que la línea más ancha de la
// formación) — es el valor por default y el que ya tenía el juego antes
// de este campo, así que no hace falta declararlo en ese caso. Las otras
// opciones son 'abierta' (se abre pero no llega al borde), 'intermedio'
// (ancho moderado) y 'compacta' (angosta y centrada). Nunca afecta el
// color de ajuste de posición (eso lo maneja medShape/offShape y el
// sistema de WIDTH_BY_POS_DETAIL para DEF/DEL) — es pura ubicación visual.
//
// Todo este detalle (forma exacta de cada línea + ancho relativo) sale de
// una investigación puntual del usuario contrastando varias fuentes de
// análisis táctico (no es una suposición nuestra), formación por
// formación, para las 17 formaciones del juego.
const FORMATIONS = [
  // Defensivas
  {
    id: '541', name: '5-4-1', def: 5, med: 4, del: 1, style: 'Defensiva', mod: -3,
    // MI - MCD (recuperador) - MCD (distribuidor) - MD, todo el ancho como la defensa
    medShape: ['volante por izquierda', 'mediocampista defensivo', 'mediocampista defensivo', 'volante por derecha'],
  },
  {
    id: '532', name: '5-3-2', def: 5, med: 3, del: 2, style: 'Defensiva', mod: -2,
    // Interior izq (mixto) - MCD (pivote) - Interior der (mixto)
    medShape: ['mediocampista mixto', 'mediocampista defensivo', 'mediocampista mixto'],
    medWidth: 'intermedio', delWidth: 'compacta',
  },
  {
    id: '523', name: '5-2-3', def: 5, med: 2, del: 3, style: 'Defensiva', mod: -1,
    medShape: ['mediocampista defensivo', 'mediocampista mixto'],
    medWidth: 'compacta', delWidth: 'abierta',
  },
  {
    id: '5212', name: '5-2-1-2', def: 5, med: 2, off: 1, del: 2, style: 'Defensiva', mod: -2,
    medShape: ['mediocampista defensivo', 'mediocampista mixto'],
    offShape: ['mediocampista ofensivo'],
    medWidth: 'intermedio', delWidth: 'compacta',
  },
  {
    id: '451', name: '4-5-1', def: 4, med: 5, del: 1, style: 'Defensiva', mod: -1,
    // MI - MC (interior) - MCD (pivote, el más retrasado) - MC (interior) - MD
    medShape: ['volante por izquierda', 'mediocampista mixto', 'mediocampista defensivo', 'mediocampista mixto', 'volante por derecha'],
  },
  // Equilibradas
  {
    id: '442', name: '4-4-2', def: 4, med: 4, del: 2, style: 'Equilibrada', mod: 0,
    medShape: ['volante por izquierda', 'mediocampista defensivo', 'mediocampista mixto', 'volante por derecha'],
    delWidth: 'compacta',
  },
  {
    id: '433', name: '4-3-3', def: 4, med: 3, del: 3, style: 'Equilibrada', mod: 1,
    medShape: ['mediocampista mixto', 'mediocampista defensivo', 'mediocampista mixto'],
    medWidth: 'intermedio', delWidth: 'abierta',
  },
  {
    id: '4312', name: '4-3-1-2', def: 4, med: 3, off: 1, del: 2, style: 'Equilibrada', mod: 1,
    medShape: ['mediocampista mixto', 'mediocampista defensivo', 'mediocampista mixto'],
    offShape: ['mediocampista ofensivo'],
    medWidth: 'intermedio', delWidth: 'compacta',
  },
  {
    id: '3412', name: '3-4-1-2', def: 3, med: 4, off: 1, del: 2, style: 'Equilibrada', mod: 1,
    medShape: ['carrilero izquierdo', 'mediocampista defensivo', 'mediocampista mixto', 'carrilero derecho'],
    offShape: ['mediocampista ofensivo'],
    defWidth: 'intermedio', delWidth: 'compacta',
  },
  // Ofensivas
  {
    id: '424', name: '4-2-4', def: 4, med: 2, del: 4, style: 'Ofensiva', mod: 4,
    medShape: ['mediocampista defensivo', 'mediocampista mixto'],
    medWidth: 'compacta',
  },
  {
    id: '433o', name: '4-3-3', def: 4, med: 3, del: 3, style: 'Ofensiva', mod: 3,
    // Interior izq y der ofensivos (llegada de área), MCD en el medio como pivote
    medShape: ['mediocampista ofensivo', 'mediocampista defensivo', 'mediocampista ofensivo'],
    medWidth: 'intermedio', delWidth: 'abierta',
  },
  {
    id: '343', name: '3-4-3', def: 3, med: 4, del: 3, style: 'Ofensiva', mod: 3,
    medShape: ['volante por izquierda', 'mediocampista defensivo', 'mediocampista mixto', 'volante por derecha'],
    defWidth: 'intermedio', delWidth: 'abierta',
  },
  {
    id: '4231', name: '4-2-3-1', def: 4, med: 2, off: 3, del: 1, style: 'Ofensiva', mod: 2,
    medShape: ['mediocampista defensivo', 'mediocampista mixto'],
    offShape: ['extremo izquierdo', 'mediocampista ofensivo', 'extremo derecho'],
    medWidth: 'intermedio', offWidth: 'abierta',
  },
  {
    id: '352', name: '3-5-2', def: 3, med: 5, del: 2, style: 'Ofensiva', mod: 2,
    medShape: ['carrilero izquierdo', 'mediocampista mixto', 'mediocampista defensivo', 'mediocampista mixto', 'carrilero derecho'],
    defWidth: 'intermedio', delWidth: 'compacta',
  },
  {
    id: '4141', name: '4-1-4-1', def: 4, med: 1, off: 4, del: 1, style: 'Ofensiva', mod: 3,
    medShape: ['mediocampista defensivo'],
    // Línea de enganches: MI - MCO - MCO - MD
    offShape: ['volante por izquierda', 'mediocampista ofensivo', 'mediocampista ofensivo', 'volante por derecha'],
  },
  {
    id: '4222', name: '4-2-2-2', def: 4, med: 2, off: 2, del: 2, style: 'Ofensiva', mod: 4,
    medShape: ['mediocampista defensivo', 'mediocampista mixto'],
    offShape: ['mediocampista ofensivo', 'mediocampista ofensivo'],
    medWidth: 'compacta', offWidth: 'intermedio', delWidth: 'compacta',
  },
  {
    id: '325', name: '3-2-5', def: 3, med: 2, off: 4, del: 1, style: 'Ofensiva', mod: 5,
    medShape: ['mediocampista defensivo', 'mediocampista mixto'],
    // Línea de enganches/extremos, más adelantada que en la 4-1-4-1: EI - MCO - MCO - ED
    offShape: ['extremo izquierdo', 'mediocampista ofensivo', 'mediocampista ofensivo', 'extremo derecho'],
    medWidth: 'compacta', defWidth: 'intermedio',
  },
];

// Distribución de nacionalidades de los jugadores generados. La liga es
// argentina, así que la mayoría de los planteles son de ese país, con una
// porción menor de jugadores de países vecinos (algo habitual en el fútbol
// argentino real).
// La bandera de cada país se dibuja en ui.js (ver NATION_FLAGS), no se
// guarda acá como emoji: Windows no trae las banderas de países en su fuente
// y las muestra como las dos letras del código.
//
// El `weight` es con qué frecuencia aparece ese país al generar jugadores al
// azar. Ecuador va en 0 a propósito: no es un país habitual en los planteles
// argentinos, pero tiene que existir en la lista porque hay jugadores reales
// cargados con esa nacionalidad (Enner Valencia en Boca). Peso 0 = no se
// genera solo, pero se muestra bien cuando aparece.
const NATIONS = [
  { code: 'ARG', name: 'Argentina', weight: 0.82 },
  { code: 'URU', name: 'Uruguay', weight: 0.05 },
  { code: 'BRA', name: 'Brasil', weight: 0.05 },
  { code: 'PAR', name: 'Paraguay', weight: 0.04 },
  { code: 'COL', name: 'Colombia', weight: 0.02 },
  { code: 'CHI', name: 'Chile', weight: 0.02 },
  { code: 'ECU', name: 'Ecuador', weight: 0.0 },
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

// Calidad de la cantera de cada club: qué tan seguido saca un juvenil que
// termina siendo bueno de verdad, del 1 al 5.
//
// Esto NO es lo mismo que el tamaño del club ni su presupuesto, y por eso es
// un campo aparte de `reputation` y de `budgetTier`. El caso más claro es
// Argentinos Juniors: económicamente es un club de media tabla, y tiene la
// cantera más famosa del fútbol argentino (Maradona, Riquelme, Redondo,
// Cambiasso, Sorín). Si la cantera saliera del presupuesto, La Paternal
// sacaría los mismos juveniles que Barracas Central, que es exactamente el
// error que tenía el juego antes: el techo de un juvenil no dependía del club
// para nada, así que Platense sacaba tantas joyas como River.
//
// ACLARACIÓN IMPORTANTE: estos números son criterio nuestro, puestos según la
// historia conocida de cada club sacando jugadores. No salen de una
// investigación puntual como los datos económicos o los planteles. Si algún
// día se investigan en serio, se cambian acá y nada más.
//
// Un club que no está en esta lista usa el valor por defecto de su categoría.
const CANTERAS = {
  // Las mejores del país.
  argentinos: 5, river: 5, boca: 5, velez: 5,
  // Muy buenas, con historia larga de sacar jugadores.
  racing: 4, independiente: 4, sanlorenzo: 4, newells: 4, rosariocentral: 4,
  estudianteslp: 4, banfield: 4, lanus: 4, defensayjusticia: 4,
  // Chicas pero con trabajo de inferiores serio.
  riestra: 2, aldosivi: 2, barracascentral: 2, sarmientojunin: 2,
  gimnasiamendoza: 2, riocuarto: 2,
};

const CANTERA_POR_DEFECTO = { D1: 3, D2: 2 };

// Los colores de cada competición, para que la pantalla del partido se vea
// distinta según en qué torneo estás jugando.
//
// Hay dos cosas separadas a propósito, y es importante no mezclarlas:
//
//   `oficial` — los hexadecimales que figuran en el manual de marca de la
//               competición. Si un color no está documentado va en null: no
//               se inventa. La Libertadores y la Sudamericana tienen manual
//               público; la Liga Profesional estrenó identidad en 2026
//               (celeste, azul y blanco) pero no publicó los códigos, y el
//               brandbook de la Copa Argentina no es verificable.
//   `ui`      — los colores con los que el juego PINTA la pantalla. Son
//               decisión de diseño, no dato oficial. El fondo del juego es
//               casi negro, así que acá van tonos oscuros: un dorado a
//               pantalla completa sería ilegible.
const COLORES_COMPETICIONES = {
  liga: {
    nombre: 'Liga Profesional',
    oficial: { primario: null, secundario: null, acento: '#FFFFFF' },
    ui: { fondo: '#08083A', brillo: '#141470', acento: '#7DD3FC' },
  },
  // Del logo: el azul oscuro de los triangulitos, el celeste del pentágono
  // grande y el amarillo del chico.
  copaArgentina: {
    nombre: 'Copa Argentina',
    oficial: { primario: '#2E3D62', secundario: '#62B4E8', acento: '#F2E52A' },
    ui: { fondo: '#0B1430', brillo: '#1E2F5C', acento: '#62B4E8' },
  },
  // El dorado sale del trofeo del logo: va del bronce oscuro de las sombras al
  // dorado claro de los brillos, sobre negro.
  libertadores: {
    nombre: 'Copa Libertadores',
    oficial: { primario: '#C9922E', secundario: '#000000', acento: '#F2D98B' },
    ui: { fondo: '#0B0A07', brillo: '#231B0C', acento: '#DBAF4A' },
  },
  // La Sudamericana no es negra: su gráfica oficial es azul profundo con
  // celeste, y el trofeo del logo es plateado con una estrella dorada. Los
  // valores salen de la lámina oficial del cuadro de eliminatorias.
  sudamericana: {
    nombre: 'Copa Sudamericana',
    oficial: { primario: '#0B1E6B', secundario: '#54C4F0', acento: '#C0C4C8' },
    ui: { fondo: '#081445', brillo: '#14277F', acento: '#54C4F0' },
  },
  // De la Recopa no hay paleta documentada, así que el `ui` es una decisión
  // nuestra: un bronce que no se confunda ni con el dorado de la Libertadores
  // ni con el gris de la Sudamericana, que son justo los dos equipos que la
  // juegan.
  recopa: {
    nombre: 'Recopa Sudamericana',
    oficial: { primario: null, secundario: null, acento: null },
    ui: { fondo: '#140D07', brillo: '#2E1D0D', acento: '#C8813C' },
  },
};

// La cancha de cada club, para decir dónde se juega en vez de solo si sos
// local o visitante. Están cargados los 30 de Primera; un club que no esté
// acá (hoy, los de la Primera Nacional) simplemente no muestra estadio.
const ESTADIOS = {
  platense: 'el Estadio Ciudad de Vicente López',
  defensayjusticia: 'el Norberto Tomaghello',
  centralcordoba: 'el Alfredo Terrera',
  lanus: 'La Fortaleza',
  riestra: 'el Guillermo Laza',
  talleres: 'La Boutique',
  boca: 'La Bombonera',
  estudianteslp: 'el Jorge Luis Hirschi',
  instituto: 'el Juan Domingo Perón de Alta Córdoba',
  gimnasiamendoza: 'el Víctor Legrotaglie',
  sanlorenzo: 'el Nuevo Gasómetro',
  independiente: 'el Libertadores de América',
  newells: 'el Coloso del Parque',
  union: 'el 15 de Abril',
  velez: 'el José Amalfitani',
  argentinos: 'el Diego Armando Maradona',
  aldosivi: 'el José María Minella',
  atleticotucuman: 'el Monumental José Fierro',
  banfield: 'el Florencio Sola',
  barracascentral: 'el Claudio Chiqui Tapia',
  belgrano: 'el Gigante de Alberdi',
  river: 'el Monumental',
  gimnasialp: 'el Juan Carmelo Zerillo',
  riocuarto: 'el Antonio Candini',
  independienterivadavia: 'el Bautista Gargantini',
  huracan: 'el Tomás Adolfo Ducó',
  racing: 'el Cilindro',
  rosariocentral: 'el Gigante de Arroyito',
  sarmientojunin: 'el Eva Perón',
  tigre: 'el José Dellagiovanna',
};

// Las canchas donde se juegan los partidos que no son de nadie: las llaves de
// los playoffs del Apertura y el Clausura, y toda la Copa Argentina. Son los
// estadios provinciales grandes que se usan de verdad para esto, así que
// ninguno es la cancha de un club (menos todavía la de uno de los grandes,
// que es justo lo que no pasa en la realidad).
const CANCHAS_NEUTRALES = [
  'el Estadio Único Madre de Ciudades, en Santiago del Estero',
  'el Estadio Ciudad de La Plata',
  'el Mario Alberto Kempes, en Córdoba',
  'el Malvinas Argentinas, en Mendoza',
  'el Estadio del Bicentenario, en San Juan',
  'el Padre Ernesto Martearena, en Salta',
  'el Brigadier Estanislao López, en Santa Fe',
  'La Pedrera, en Villa Mercedes',
];

// 18 jugadores por plantel: 2 arqueros, 6 defensores, 6 mediocampistas, 4
// delanteros — deja margen suficiente de suplentes para todas las formaciones
// (incluidas las más pobladas de una línea, como 5-4-1 o 3-6-1).
const SQUAD_POSITIONS = [
  'POR', 'POR',
  'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF',
  'MED', 'MED', 'MED', 'MED', 'MED', 'MED',
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

// Mensajes que pueden aparecer un día cualquiera de la semana en el
// calendario (ver Engine.startCalendarWeek en engine.js), fuera de los
// días de partido: no afectan la táctica del próximo partido (por eso no
// tienen tacticMod como las DECISIONS), solo dan sabor a la semana y un
// empujoncito chico de ánimo según cómo los respondas.
const INBOX_MESSAGES = [
  {
    from: 'Presidente del club',
    subject: 'Un mensaje de la dirigencia',
    body: 'Estimado DT: la comisión directiva le hace llegar su satisfacción por el trabajo realizado hasta el momento. Continúe en esta línea.',
    options: [
      { label: 'Agradecer el gesto', moraleMod: 3, note: 'El respaldo de arriba te da tranquilidad.' },
      { label: 'Responder con formalidad', moraleMod: 0, note: 'Un intercambio breve y cordial, nada más.' },
    ],
  },
  {
    from: 'Presidente del club',
    subject: 'Comunicado de la comisión directiva',
    body: 'Estimado DT: la institución le solicita mesura en las declaraciones públicas de las últimas semanas, para cuidar la imagen del club.',
    options: [
      { label: 'Tomar el pedido con respeto', moraleMod: 0, note: 'Aceptás el pedido sin mayores problemas.' },
      { label: 'Responder que usted decide qué declarar', moraleMod: -2, note: 'La dirigencia no queda conforme con la respuesta.' },
    ],
  },
  {
    from: 'Cuerpo técnico',
    subject: 'Charla con tu ayudante de campo',
    body: 'Tu ayudante te comenta que notó a un par de jugadores algo bajoneados en los entrenamientos.',
    options: [
      { label: 'Hablar personalmente con el plantel', moraleMod: 4, note: 'El gesto se valora puertas adentro.' },
      { label: 'Dejar que se acomode solo', moraleMod: -1, note: 'El clima del plantel no mejora ni empeora demasiado.' },
    ],
  },
  {
    from: 'Tu representante',
    subject: 'Novedades de tu agente',
    body: 'Tu representante te cuenta que hay rumores de otro club preguntando por vos, pero todavía nada formal.',
    options: [
      { label: 'Pedirle que no diga nada por ahora', moraleMod: 0, note: 'Preferís mantener el foco en el día a día.' },
      { label: 'Que siga explorando la posibilidad', moraleMod: 1, note: 'Nunca está de más tener opciones sobre la mesa.' },
    ],
  },
  {
    from: 'Un jugador del plantel',
    subject: 'Mensaje de un titular',
    body: 'Uno de tus jugadores más importantes te escribe para agradecerte la confianza en las últimas fechas.',
    options: [
      { label: 'Responder con un mensaje cálido', moraleMod: 3, note: 'El vínculo con el plantel se fortalece.' },
      { label: 'Un simple "de nada, a seguir así"', moraleMod: 1, note: 'Corto pero suficiente.' },
    ],
  },
  {
    from: 'Un suplente',
    subject: 'Reclamo de un suplente',
    body: 'Un jugador que no viene sumando minutos te escribe algo molesto, sintiendo que no lo tenés en cuenta.',
    options: [
      { label: 'Llamarlo para explicarle su situación', moraleMod: 2, note: 'El jugador se queda más tranquilo tras la charla.' },
      { label: 'No responder por ahora', moraleMod: -2, note: 'El jugador queda con la bronca adentro.' },
    ],
  },
  {
    from: 'Un jugador del plantel',
    subject: 'Pedido de un jugador',
    body: 'Un jugador te escribe pidiendo unos días libres extra: dice que se siente cansado y necesita despejarse un poco.',
    options: [
      { label: 'Darle los días libres', moraleMod: 3, note: 'El jugador agradece la consideración con su descanso.' },
      { label: 'Explicarle que no es el momento', moraleMod: -2, note: 'El jugador entiende, pero se queda algo incómodo.' },
    ],
  },
  {
    from: 'Un jugador del plantel',
    subject: 'Consulta de un jugador',
    body: 'Un jugador te consulta si puede cambiar de posición: dice sentirse más cómodo jugando en otro lugar de la cancha.',
    options: [
      { label: 'Evaluar el pedido con el cuerpo técnico', moraleMod: 2, note: 'El jugador valora que lo escuches, más allá de lo que se decida.' },
      { label: 'Decirle que siga en su puesto habitual', moraleMod: -1, note: 'El jugador acata la decisión sin mucho entusiasmo.' },
    ],
  },
  {
    from: 'Un jugador del plantel',
    subject: 'Malestar físico de un jugador',
    body: 'Uno de tus jugadores te avisa que viene sintiendo una molestia física leve y no sabe si va a poder rendir al ciento por ciento.',
    options: [
      { label: 'Mandarlo a revisión con el cuerpo médico', moraleMod: 2, note: 'El jugador se siente cuidado por el club.' },
      { label: 'Pedirle que aguante, lo necesitás disponible', moraleMod: -3, note: 'El jugador queda preocupado por su físico.' },
    ],
  },
  {
    from: 'Un jugador del plantel',
    subject: 'Pedido personal de un jugador',
    body: 'Un jugador te comenta que le gustaría tener alguna chance de ser tenido en cuenta por su selección, y te pide que lo ayudes a mostrarse.',
    options: [
      { label: 'Darle minutos para que se muestre', moraleMod: 3, note: 'El jugador te agradece la oportunidad.' },
      { label: 'Decirle que eso no depende de vos', moraleMod: -1, note: 'El jugador se resigna, algo desanimado.' },
    ],
  },
  {
    from: 'Cuerpo médico',
    subject: 'Parte médico de rutina',
    body: 'El cuerpo médico te manda el reporte semanal: por suerte no hay ninguna lesión para lamentar.',
    options: [
      { label: 'Tomar nota y seguir', moraleMod: 0, note: 'Buenas noticias, nada que resolver.' },
    ],
  },
  {
    from: 'Socios del club',
    subject: 'Comentarios de la hinchada',
    body: 'Circula en redes sociales un comentario de un hincha reconocido pidiendo un cambio de formación.',
    options: [
      { label: 'No darle importancia', moraleMod: 0, note: 'Las redes van a seguir hablando, hagas lo que hagas.' },
      { label: 'Comentarlo con humor en la conferencia', moraleMod: 2, note: 'La hinchada valora que no te lo tomes tan en serio.' },
    ],
  },
  {
    from: 'Un periodista',
    subject: 'Pedido de entrevista',
    body: 'Un periodista de un programa deportivo te pide unos minutos para una nota en profundidad sobre el momento del equipo.',
    options: [
      { label: 'Aceptar la entrevista', moraleMod: 2, note: 'La nota sale bien y deja una buena imagen del cuerpo técnico.' },
      { label: 'Declinar por ahora', moraleMod: 0, note: 'Preferís mantener perfil bajo esta semana.' },
    ],
  },
  {
    from: 'Coordinador de inferiores',
    subject: 'Informe de las divisiones juveniles',
    body: 'El coordinador de las inferiores te avisa que hay un juvenil de la Séptima que viene destacándose en los entrenamientos con la Reserva.',
    options: [
      { label: 'Pedir que lo sumen a algún entrenamiento con el plantel', moraleMod: 2, note: 'El chico se entusiasma con la posibilidad, y el club valora la mirada a las inferiores.' },
      { label: 'Dejarlo en su categoría por ahora', moraleMod: 0, note: 'Preferís no apurar los tiempos del juvenil.' },
    ],
  },
  {
    from: 'Sponsor del club',
    subject: 'Pedido de un auspiciante',
    body: 'Uno de los sponsors del club pide que el plantel participe de una producción de fotos para su próxima campaña.',
    options: [
      { label: 'Coordinar la actividad con el plantel', moraleMod: 1, note: 'Los jugadores lo toman con buena onda, es una tarde distinta.' },
      { label: 'Pedir que se reprograme para otra semana', moraleMod: 0, note: 'El sponsor entiende, no hay problema en mover la fecha.' },
    ],
  },
  {
    from: 'El capitán del equipo',
    subject: 'Charla con el capitán',
    body: 'El capitán del equipo te pide una charla a solas para transmitirte cómo ve el clima del grupo de cara a lo que viene.',
    options: [
      { label: 'Escucharlo con atención', moraleMod: 3, note: 'El capitán se siente parte de las decisiones del cuerpo técnico.' },
      { label: 'Decirle que confíe, vos manejás el grupo', moraleMod: -1, note: 'El capitán queda con la sensación de que no lo tuviste en cuenta.' },
    ],
  },
  {
    from: 'Preparador físico',
    subject: 'Reporte de cargas de entrenamiento',
    body: 'El preparador físico te comenta que algunos jugadores están acumulando bastante carga de partidos seguidos y sugiere bajarles la intensidad de los trabajos.',
    options: [
      { label: 'Seguir la sugerencia del preparador', moraleMod: 2, note: 'El plantel agradece que se cuide el desgaste físico.' },
      { label: 'Mantener la carga habitual', moraleMod: -1, note: 'El preparador físico insiste, pero respeta la decisión.' },
    ],
  },
  {
    from: 'Un ex-jugador del club',
    subject: 'Saludo de un ídolo de la institución',
    body: 'Un histórico ídolo del club te manda un mensaje deseándote lo mejor y ofreciéndose para lo que necesites.',
    options: [
      { label: 'Agradecerle e invitarlo a un entrenamiento', moraleMod: 3, note: 'Su visita entusiasma mucho al plantel.' },
      { label: 'Agradecerle brevemente', moraleMod: 1, note: 'Un gesto lindo, sin mayores consecuencias.' },
    ],
  },
  {
    from: 'Un jugador del plantel',
    subject: 'Problema personal de un jugador',
    body: 'Un jugador te comenta que está atravesando un problema familiar y te pide discreción y comprensión estos días.',
    options: [
      { label: 'Darle el espacio y la privacidad que pide', moraleMod: 3, note: 'El jugador agradece profundamente la contención del club.' },
      { label: 'Pedirle que igual esté disponible para entrenar', moraleMod: -2, note: 'El jugador siente que no se entendió su situación.' },
    ],
  },
];

// Las 6 zonas del arco para los penales: 3 columnas (izquierda/centro/
// derecha) x 2 alturas (arriba/abajo). col/row ubican cada zona dentro del
// arco que se dibuja en pantalla (ver goalZoneCenter en ui.js).
const PENALTY_ZONES = [
  { id: 'AI', label: 'arriba a la izquierda', col: 0, row: 0 },
  { id: 'AC', label: 'arriba al medio', col: 1, row: 0 },
  { id: 'AD', label: 'arriba a la derecha', col: 2, row: 0 },
  { id: 'BI', label: 'abajo a la izquierda', col: 0, row: 1 },
  { id: 'BC', label: 'abajo al medio', col: 1, row: 1 },
  { id: 'BD', label: 'abajo a la derecha', col: 2, row: 1 },
];
