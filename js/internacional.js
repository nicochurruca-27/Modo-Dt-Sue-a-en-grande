// Clubes del resto de Sudamérica que juegan la Libertadores y la
// Sudamericana, para que las copas internacionales se jueguen de verdad y no
// sean solo un cartel al final del año.
//
// Los clubes ARGENTINOS no están acá a propósito: sus cupos salen de cómo
// terminó la temporada en el propio juego (ver Engine.assignQualification),
// así que cambian todos los años según lo que pase en cancha. Esta lista es
// el resto del continente, que sí es fijo.
//
// Campos:
//   `copa`  — 'Libertadores' | 'Sudamericana': en cuál entra ese club.
//   `fase`  — 'grupos' | 'previa': si arranca directo en la fase de grupos o
//             tiene que pasar antes por una eliminatoria previa.
//   `nivel` — 1 a 5, qué tan fuerte es a nivel continental: 5 es un candidato
//             al título (Flamengo, Palmeiras), 4 un histórico de presupuesto
//             alto (São Paulo, Peñarol, LDU), 3 un club competitivo de
//             primera línea local, 2 uno de tabla media, 1 uno modesto o
//             debutante. Se usa igual que la `reputation` de los clubes
//             argentinos para calcular la fuerza en cancha.
//   `grande` — si es un histórico grande de su país. Es solo color: no
//             cambia nada de la simulación.
//
// Datos investigados por el usuario sobre la edición 2026 de cada copa,
// contrastando fuentes; sirven como base realista de qué clubes suelen estar
// y con qué peso.
const CLUBES_INTERNACIONALES = [
  // ---- Brasil ----
  { id: 'flamengo', nombre: 'Flamengo', pais: 'Brasil', copa: 'Libertadores', fase: 'grupos', nivel: 5, grande: true },
  { id: 'corinthians', nombre: 'Corinthians', pais: 'Brasil', copa: 'Libertadores', fase: 'grupos', nivel: 4, grande: true },
  { id: 'palmeiras', nombre: 'Palmeiras', pais: 'Brasil', copa: 'Libertadores', fase: 'grupos', nivel: 5, grande: true },
  { id: 'cruzeiro', nombre: 'Cruzeiro', pais: 'Brasil', copa: 'Libertadores', fase: 'grupos', nivel: 4, grande: true },
  { id: 'mirassol', nombre: 'Mirassol', pais: 'Brasil', copa: 'Libertadores', fase: 'grupos', nivel: 2 },
  { id: 'fluminense', nombre: 'Fluminense', pais: 'Brasil', copa: 'Libertadores', fase: 'grupos', nivel: 4, grande: true },
  { id: 'botafogo', nombre: 'Botafogo', pais: 'Brasil', copa: 'Libertadores', fase: 'previa', nivel: 4, grande: true },
  { id: 'bahia', nombre: 'Bahia', pais: 'Brasil', copa: 'Libertadores', fase: 'previa', nivel: 3 },
  { id: 'saopaulo', nombre: 'São Paulo', pais: 'Brasil', copa: 'Sudamericana', fase: 'grupos', nivel: 4, grande: true },
  { id: 'gremio', nombre: 'Grêmio', pais: 'Brasil', copa: 'Sudamericana', fase: 'grupos', nivel: 4, grande: true },
  { id: 'atleticomineiro', nombre: 'Atlético Mineiro', pais: 'Brasil', copa: 'Sudamericana', fase: 'grupos', nivel: 4 },
  { id: 'bragantino', nombre: 'Red Bull Bragantino', pais: 'Brasil', copa: 'Sudamericana', fase: 'grupos', nivel: 3 },
  { id: 'santos', nombre: 'Santos', pais: 'Brasil', copa: 'Sudamericana', fase: 'grupos', nivel: 4, grande: true },
  { id: 'vasco', nombre: 'Vasco da Gama', pais: 'Brasil', copa: 'Sudamericana', fase: 'grupos', nivel: 3, grande: true },

  // ---- Uruguay ----
  { id: 'nacionaluru', nombre: 'Nacional', pais: 'Uruguay', copa: 'Libertadores', fase: 'grupos', nivel: 4, grande: true },
  { id: 'penarol', nombre: 'Peñarol', pais: 'Uruguay', copa: 'Libertadores', fase: 'grupos', nivel: 4, grande: true },
  { id: 'liverpooluru', nombre: 'Liverpool (Uru)', pais: 'Uruguay', copa: 'Libertadores', fase: 'previa', nivel: 2 },
  { id: 'juventudlp', nombre: 'Juventud de Las Piedras', pais: 'Uruguay', copa: 'Libertadores', fase: 'previa', nivel: 1 },
  { id: 'citytorque', nombre: 'Montevideo City Torque', pais: 'Uruguay', copa: 'Sudamericana', fase: 'grupos', nivel: 2 },
  { id: 'bostonriver', nombre: 'Boston River', pais: 'Uruguay', copa: 'Sudamericana', fase: 'grupos', nivel: 2 },

  // ---- Colombia ----
  { id: 'santafe', nombre: 'Independiente Santa Fe', pais: 'Colombia', copa: 'Libertadores', fase: 'grupos', nivel: 3, grande: true },
  { id: 'junior', nombre: 'Junior de Barranquilla', pais: 'Colombia', copa: 'Libertadores', fase: 'grupos', nivel: 3, grande: true },
  { id: 'tolima', nombre: 'Deportes Tolima', pais: 'Colombia', copa: 'Libertadores', fase: 'grupos', nivel: 3 },
  { id: 'medellin', nombre: 'Independiente Medellín', pais: 'Colombia', copa: 'Libertadores', fase: 'grupos', nivel: 3 },
  { id: 'americacali', nombre: 'América de Cali', pais: 'Colombia', copa: 'Sudamericana', fase: 'grupos', nivel: 3, grande: true },
  { id: 'millonarios', nombre: 'Millonarios', pais: 'Colombia', copa: 'Sudamericana', fase: 'grupos', nivel: 3, grande: true },

  // ---- Chile ----
  { id: 'coquimbo', nombre: 'Coquimbo Unido', pais: 'Chile', copa: 'Libertadores', fase: 'grupos', nivel: 2 },
  { id: 'ucatolicachi', nombre: 'Universidad Católica (Chi)', pais: 'Chile', copa: 'Libertadores', fase: 'grupos', nivel: 3, grande: true },
  { id: 'huachipato', nombre: 'Huachipato', pais: 'Chile', copa: 'Libertadores', fase: 'previa', nivel: 2 },
  { id: 'ohiggins', nombre: "O'Higgins", pais: 'Chile', copa: 'Sudamericana', fase: 'grupos', nivel: 2 },
  { id: 'audax', nombre: 'Audax Italiano', pais: 'Chile', copa: 'Sudamericana', fase: 'grupos', nivel: 2 },
  { id: 'palestino', nombre: 'Palestino', pais: 'Chile', copa: 'Sudamericana', fase: 'grupos', nivel: 2 },

  // ---- Ecuador ----
  { id: 'idv', nombre: 'Independiente del Valle', pais: 'Ecuador', copa: 'Libertadores', fase: 'grupos', nivel: 4 },
  { id: 'ldu', nombre: 'Liga de Quito', pais: 'Ecuador', copa: 'Libertadores', fase: 'grupos', nivel: 4, grande: true },
  { id: 'barcelonasc', nombre: 'Barcelona SC', pais: 'Ecuador', copa: 'Libertadores', fase: 'grupos', nivel: 3, grande: true },
  { id: 'ucatolicaecu', nombre: 'Universidad Católica (Ecu)', pais: 'Ecuador', copa: 'Libertadores', fase: 'previa', nivel: 2 },
  { id: 'macara', nombre: 'Macará', pais: 'Ecuador', copa: 'Sudamericana', fase: 'grupos', nivel: 2 },
  { id: 'cuenca', nombre: 'Deportivo Cuenca', pais: 'Ecuador', copa: 'Sudamericana', fase: 'grupos', nivel: 2 },

  // ---- Paraguay ----
  { id: 'cerroporteno', nombre: 'Cerro Porteño', pais: 'Paraguay', copa: 'Libertadores', fase: 'grupos', nivel: 3, grande: true },
  { id: 'libertad', nombre: 'Libertad', pais: 'Paraguay', copa: 'Libertadores', fase: 'grupos', nivel: 3, grande: true },
  { id: 'guarani', nombre: 'Guaraní', pais: 'Paraguay', copa: 'Libertadores', fase: 'previa', nivel: 2 },
  { id: 'dosdemayo', nombre: '2 de Mayo', pais: 'Paraguay', copa: 'Libertadores', fase: 'previa', nivel: 1 },
  { id: 'olimpia', nombre: 'Olimpia', pais: 'Paraguay', copa: 'Sudamericana', fase: 'grupos', nivel: 4, grande: true },
  { id: 'recoleta', nombre: 'Deportivo Recoleta', pais: 'Paraguay', copa: 'Sudamericana', fase: 'grupos', nivel: 1 },

  // ---- Perú ----
  { id: 'universitario', nombre: 'Universitario', pais: 'Perú', copa: 'Libertadores', fase: 'grupos', nivel: 3, grande: true },
  { id: 'cuscofc', nombre: 'Cusco FC', pais: 'Perú', copa: 'Libertadores', fase: 'grupos', nivel: 2 },
  { id: 'sportingcristal', nombre: 'Sporting Cristal', pais: 'Perú', copa: 'Libertadores', fase: 'grupos', nivel: 3, grande: true },
  { id: 'alianzalima', nombre: 'Alianza Lima', pais: 'Perú', copa: 'Libertadores', fase: 'previa', nivel: 3, grande: true },
  { id: 'cienciano', nombre: 'Cienciano', pais: 'Perú', copa: 'Sudamericana', fase: 'grupos', nivel: 2 },
  { id: 'alianzaatletico', nombre: 'Alianza Atlético', pais: 'Perú', copa: 'Sudamericana', fase: 'grupos', nivel: 1 },

  // ---- Bolivia ----
  { id: 'alwaysready', nombre: 'Always Ready', pais: 'Bolivia', copa: 'Libertadores', fase: 'grupos', nivel: 2 },
  { id: 'bolivar', nombre: 'Bolívar', pais: 'Bolivia', copa: 'Libertadores', fase: 'grupos', nivel: 3, grande: true },
  { id: 'nacionalpotosi', nombre: 'Nacional Potosí', pais: 'Bolivia', copa: 'Libertadores', fase: 'previa', nivel: 2 },
  { id: 'thestrongest', nombre: 'The Strongest', pais: 'Bolivia', copa: 'Libertadores', fase: 'previa', nivel: 3, grande: true },
  { id: 'petrolero', nombre: 'Independiente Petrolero', pais: 'Bolivia', copa: 'Sudamericana', fase: 'grupos', nivel: 1 },
  { id: 'blooming', nombre: 'Blooming', pais: 'Bolivia', copa: 'Sudamericana', fase: 'grupos', nivel: 2, grande: true },

  // ---- Venezuela ----
  { id: 'ucv', nombre: 'Universidad Central', pais: 'Venezuela', copa: 'Libertadores', fase: 'grupos', nivel: 1 },
  { id: 'laguaira', nombre: 'Deportivo La Guaira', pais: 'Venezuela', copa: 'Libertadores', fase: 'grupos', nivel: 2 },
  { id: 'carabobo', nombre: 'Carabobo', pais: 'Venezuela', copa: 'Libertadores', fase: 'previa', nivel: 2 },
  { id: 'tachira', nombre: 'Deportivo Táchira', pais: 'Venezuela', copa: 'Libertadores', fase: 'previa', nivel: 2, grande: true },
  { id: 'caracas', nombre: 'Caracas FC', pais: 'Venezuela', copa: 'Sudamericana', fase: 'grupos', nivel: 2, grande: true },
  { id: 'puertocabello', nombre: 'Academia Puerto Cabello', pais: 'Venezuela', copa: 'Sudamericana', fase: 'grupos', nivel: 1 },
];
