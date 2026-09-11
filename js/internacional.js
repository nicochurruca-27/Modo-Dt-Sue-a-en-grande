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
//   `apodo`, `estadio`, `colores`, `titulos` — datos de color para cuando se
//             arme la pantalla de las copas con más onda (escudo con sus
//             colores reales, nombre de estadio, etc.). Todavía no se usan
//             en ningún lado, pero ya están cargados para no tener que
//             volver a pedirlos.
//
// Datos investigados por el usuario sobre la edición 2026 de cada copa,
// contrastando fuentes; sirven como base realista de qué clubes suelen estar
// y con qué peso. Brasil y Uruguay están con el detalle completo (pedido a
// una IA con todos los clubes que jugaron Libertadores/Sudamericana en los
// últimos 10 años); el resto de los países todavía tiene la lista corta
// original, pendiente de la misma pasada.
const CLUBES_INTERNACIONALES = [
  // ---- Brasil ----
  { id: "flamengo", nombre: "Flamengo", nombreCompleto: "Clube de Regatas do Flamengo", pais: "Brasil", copa: "Libertadores", fase: "grupos", nivel: 5, grande: true, apodo: "Mengão", estadio: "Maracanã", colores: { primario: "#000000", secundario: "#FF0000" }, titulos: { libertadores: 4, sudamericana: 0 } },
  { id: "palmeiras", nombre: "Palmeiras", nombreCompleto: "Sociedade Esportiva Palmeiras", pais: "Brasil", copa: "Libertadores", fase: "grupos", nivel: 5, grande: true, apodo: "Verdão", estadio: "Allianz Parque", colores: { primario: "#006437", secundario: "#FFFFFF" }, titulos: { libertadores: 3, sudamericana: 0 } },
  { id: "sao-paulo", nombre: "São Paulo", nombreCompleto: "São Paulo Futebol Clube", pais: "Brasil", copa: "Libertadores", fase: "grupos", nivel: 4, grande: true, apodo: "Tricolor Paulista", estadio: "MorumBIS", colores: { primario: "#FF0000", secundario: "#000000" }, titulos: { libertadores: 3, sudamericana: 1 } },
  { id: "gremio", nombre: "Grêmio", nombreCompleto: "Grêmio Foot-Ball Porto Alegrense", pais: "Brasil", copa: "Libertadores", fase: "grupos", nivel: 4, grande: true, apodo: "Tricolor Gaúcho", estadio: "Arena do Grêmio", colores: { primario: "#0080C8", secundario: "#000000" }, titulos: { libertadores: 3, sudamericana: 0 } },
  { id: "internacional", nombre: "Internacional", nombreCompleto: "Sport Club Internacional", pais: "Brasil", copa: "Libertadores", fase: "grupos", nivel: 4, grande: true, apodo: "Colorado", estadio: "Beira-Rio", colores: { primario: "#FF0000", secundario: "#FFFFFF" }, titulos: { libertadores: 2, sudamericana: 1 } },
  { id: "atletico-mineiro", nombre: "Atlético Mineiro", nombreCompleto: "Clube Atlético Mineiro", pais: "Brasil", copa: "Libertadores", fase: "grupos", nivel: 4, grande: true, apodo: "Galo", estadio: "Arena MRV", colores: { primario: "#000000", secundario: "#FFFFFF" }, titulos: { libertadores: 1, sudamericana: 0 } },
  { id: "cruzeiro", nombre: "Cruzeiro", nombreCompleto: "Cruzeiro Esporte Clube", pais: "Brasil", copa: "Libertadores", fase: "grupos", nivel: 4, grande: true, apodo: "Raposa", estadio: "Mineirão", colores: { primario: "#003DA5", secundario: "#FFFFFF" }, titulos: { libertadores: 2, sudamericana: 0 } },
  { id: "corinthians", nombre: "Corinthians", nombreCompleto: "Sport Club Corinthians Paulista", pais: "Brasil", copa: "Libertadores", fase: "grupos", nivel: 4, grande: true, apodo: "Timão", estadio: "Neo Química Arena", colores: { primario: "#000000", secundario: "#FFFFFF" }, titulos: { libertadores: 1, sudamericana: 0 } },
  { id: "fluminense", nombre: "Fluminense", nombreCompleto: "Fluminense Football Club", pais: "Brasil", copa: "Libertadores", fase: "grupos", nivel: 4, grande: true, apodo: "Tricolor", estadio: "Maracanã", colores: { primario: "#8B0000", secundario: "#008000" }, titulos: { libertadores: 1, sudamericana: 0 } },
  { id: "santos", nombre: "Santos", nombreCompleto: "Santos Futebol Clube", pais: "Brasil", copa: "Libertadores", fase: "grupos", nivel: 4, grande: true, apodo: "Peixe", estadio: "Vila Belmiro", colores: { primario: "#FFFFFF", secundario: "#000000" }, titulos: { libertadores: 3, sudamericana: 0 } },
  { id: "botafogo", nombre: "Botafogo", nombreCompleto: "Botafogo de Futebol e Regatas", pais: "Brasil", copa: "Libertadores", fase: "grupos", nivel: 4, grande: true, apodo: "Fogão", estadio: "Estádio Nilton Santos", colores: { primario: "#000000", secundario: "#FFFFFF" }, titulos: { libertadores: 1, sudamericana: 0 } },
  { id: "vasco-da-gama", nombre: "Vasco da Gama", nombreCompleto: "Club de Regatas Vasco da Gama", pais: "Brasil", copa: "Sudamericana", fase: "grupos", nivel: 3, grande: true, apodo: "Gigante da Colina", estadio: "São Januário", colores: { primario: "#000000", secundario: "#FFFFFF" }, titulos: { libertadores: 1, sudamericana: 0 } },
  { id: "athletico-paranaense", nombre: "Athletico Paranaense", nombreCompleto: "Club Athletico Paranaense", pais: "Brasil", copa: "Sudamericana", fase: "grupos", nivel: 3, apodo: "Furacão", estadio: "Ligga Arena", colores: { primario: "#FF0000", secundario: "#000000" }, titulos: { libertadores: 0, sudamericana: 2 } },
  { id: "fortaleza", nombre: "Fortaleza", nombreCompleto: "Fortaleza Esporte Clube", pais: "Brasil", copa: "Sudamericana", fase: "grupos", nivel: 3, apodo: "Leão", estadio: "Arena Castelão", colores: { primario: "#0000FF", secundario: "#FF0000" } },
  { id: "bahia", nombre: "Bahia", nombreCompleto: "Esporte Clube Bahia", pais: "Brasil", copa: "Libertadores", fase: "grupos", nivel: 3, apodo: "Tricolor de Aço", estadio: "Arena Fonte Nova", colores: { primario: "#003DA5", secundario: "#FF0000" } },
  { id: "red-bull-bragantino", nombre: "Red Bull Bragantino", nombreCompleto: "Red Bull Bragantino", pais: "Brasil", copa: "Sudamericana", fase: "grupos", nivel: 3, apodo: "Massa Bruta", estadio: "Estádio Nabi Abi Chedid", colores: { primario: "#FFFFFF", secundario: "#FF0000" } },
  { id: "sport", nombre: "Sport Recife", nombreCompleto: "Sport Club do Recife", pais: "Brasil", copa: "Sudamericana", fase: "previa", nivel: 2, apodo: "Leão da Ilha", estadio: "Ilha do Retiro", colores: { primario: "#FF0000", secundario: "#000000" } },
  { id: "goias", nombre: "Goiás", nombreCompleto: "Goiás Esporte Clube", pais: "Brasil", copa: "Sudamericana", fase: "previa", nivel: 2, apodo: "Esmeraldino", estadio: "Estádio da Serrinha", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "vitoria", nombre: "Vitória", nombreCompleto: "Esporte Clube Vitória", pais: "Brasil", copa: "Sudamericana", fase: "previa", nivel: 2, apodo: "Leão da Barra", estadio: "Barradão", colores: { primario: "#FF0000", secundario: "#000000" } },
  { id: "america-mineiro", nombre: "América Mineiro", nombreCompleto: "América Futebol Clube", pais: "Brasil", copa: "Libertadores", fase: "previa", nivel: 2, apodo: "Coelho", estadio: "Independência", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "coritiba", nombre: "Coritiba", nombreCompleto: "Coritiba Foot Ball Club", pais: "Brasil", copa: "Sudamericana", fase: "previa", nivel: 2, apodo: "Coxa", estadio: "Couto Pereira", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "chapecoense", nombre: "Chapecoense", nombreCompleto: "Associação Chapecoense de Futebol", pais: "Brasil", copa: "Sudamericana", fase: "previa", nivel: 2, apodo: "Verdão do Oeste", estadio: "Arena Condá", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "ceara", nombre: "Ceará", nombreCompleto: "Ceará Sporting Club", pais: "Brasil", copa: "Sudamericana", fase: "previa", nivel: 2, apodo: "Vovô", estadio: "Arena Castelão", colores: { primario: "#000000", secundario: "#FFFFFF" } },

  // ---- Uruguay ----
  { id: "penarol", nombre: "Peñarol", nombreCompleto: "Club Atlético Peñarol", pais: "Uruguay", copa: "Libertadores", fase: "grupos", nivel: 5, grande: true, apodo: "Carbonero", estadio: "Campeón del Siglo", colores: { primario: "#000000", secundario: "#FFD700" }, titulos: { libertadores: 5, sudamericana: 0 } },
  { id: "nacional-uru", nombre: "Nacional", nombreCompleto: "Club Nacional de Football", pais: "Uruguay", copa: "Libertadores", fase: "grupos", nivel: 5, grande: true, apodo: "Bolso", estadio: "Gran Parque Central", colores: { primario: "#FFFFFF", secundario: "#003DA5" }, titulos: { libertadores: 3, sudamericana: 0 } },
  { id: "defensor-sporting", nombre: "Defensor Sporting", nombreCompleto: "Defensor Sporting Club", pais: "Uruguay", copa: "Libertadores", fase: "grupos", nivel: 3, apodo: "Violeta", estadio: "Luis Franzini", colores: { primario: "#612A7A", secundario: "#FFFFFF" } },
  { id: "danubio", nombre: "Danubio", nombreCompleto: "Danubio Fútbol Club", pais: "Uruguay", copa: "Libertadores", fase: "grupos", nivel: 3, apodo: "La Franja", estadio: "Jardines del Hipódromo", colores: { primario: "#000000", secundario: "#FFFFFF" } },
  { id: "liverpool-uru", nombre: "Liverpool", nombreCompleto: "Liverpool Fútbol Club", pais: "Uruguay", copa: "Libertadores", fase: "grupos", nivel: 3, apodo: "Negriazules", estadio: "Belvedere", colores: { primario: "#000000", secundario: "#FFFFFF" } },
  { id: "montevideo-wanderers", nombre: "Montevideo Wanderers", nombreCompleto: "Montevideo Wanderers Fútbol Club", pais: "Uruguay", copa: "Libertadores", fase: "previa", nivel: 2, apodo: "Bohemios", estadio: "Parque Alfredo Víctor Viera", colores: { primario: "#000000", secundario: "#FFFFFF" } },
  { id: "plaza-colonia", nombre: "Plaza Colonia", nombreCompleto: "Club Plaza Colonia de Deportes", pais: "Uruguay", copa: "Libertadores", fase: "previa", nivel: 2, apodo: "Patablanca", estadio: "Parque Prandi", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "boston-river", nombre: "Boston River", nombreCompleto: "Boston River", pais: "Uruguay", copa: "Libertadores", fase: "previa", nivel: 2, apodo: "Sastre", estadio: "Estadio Campeones Olímpicos", colores: { primario: "#FF0000", secundario: "#FFFFFF" } },
  { id: "cerro-largo", nombre: "Cerro Largo", nombreCompleto: "Cerro Largo Fútbol Club", pais: "Uruguay", copa: "Libertadores", fase: "previa", nivel: 2, apodo: "Arachanes", estadio: "Estadio Ubilla", colores: { primario: "#0000FF", secundario: "#FFFFFF" } },
  { id: "river-plate-uru", nombre: "River Plate", nombreCompleto: "Club Atlético River Plate", pais: "Uruguay", copa: "Sudamericana", fase: "previa", nivel: 2, apodo: "Darseneros", estadio: "Parque Federico Omar Saroldi", colores: { primario: "#FFFFFF", secundario: "#FF0000" } },
  { id: "rentistas", nombre: "Rentistas", nombreCompleto: "Club Atlético Rentistas", pais: "Uruguay", copa: "Libertadores", fase: "previa", nivel: 1, apodo: "Bichos Colorados", estadio: "Complejo Rentistas", colores: { primario: "#FF0000", secundario: "#FFFFFF" } },

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
