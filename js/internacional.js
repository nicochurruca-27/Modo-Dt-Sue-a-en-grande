// Clubes del resto de Sudamérica que juegan la Libertadores y la
// Sudamericana, para que las copas internacionales se jueguen de verdad y no
// sean solo un cartel al final del año.
//
// Los clubes ARGENTINOS no están acá a propósito: sus cupos salen de cómo
// terminó la temporada en el propio juego (ver Engine.assignQualification),
// así que cambian todos los años según lo que pase en cancha. Esta lista es
// el resto del continente.
//
// IMPORTANTE: esta lista es el POZO de clubes que pueden clasificar, no los
// que clasifican. Cada país tiene muchos más clubes acá que cupos reales
// (ver CUPOS_INTERNACIONALES más abajo): todos los años se sortea cuáles de
// ese pozo se ganan los cupos, así no clasifican siempre los mismos y una
// temporada podés cruzarte con Fluminense y a la otra con Fortaleza.
//
// Campos:
//   `copa`  — 'Libertadores' | 'Sudamericana': en cuál suele jugar ese club.
//             Es dato de color (lo usan las noticias); el cupo real de cada
//             año lo decide el sorteo, no este campo.
//   `nivel` — 1 a 5, qué tan fuerte es a nivel continental: 5 es un candidato
//             al título (Flamengo, Palmeiras), 4 un histórico de presupuesto
//             alto (São Paulo, Peñarol, LDU), 3 un club competitivo de
//             primera línea local, 2 uno de tabla media, 1 uno modesto o
//             debutante. Se usa igual que la `reputation` de los clubes
//             argentinos para calcular la fuerza en cancha, y además pesa en
//             el sorteo de cupos: cuanto más alto, más seguido clasifica.
//   `grande` — si es un histórico grande de su país. Es solo color: no
//             cambia nada de la simulación.
//   `apodo`, `estadio`, `colores`, `titulos` — datos de color para la
//             pantalla de las copas (escudo con los colores reales del club,
//             nombre del estadio, etc.).
//
// Datos investigados contrastando fuentes: todos los clubes que jugaron
// alguna de las dos copas en los últimos 10 años, apuntando a cargar por
// país alrededor del doble de clubes que cupos tiene. Están los nueve
// países cargados.
const CLUBES_INTERNACIONALES = [
  // ---- Brasil ----
  { id: "flamengo", nombre: "Flamengo", nombreCompleto: "Clube de Regatas do Flamengo", pais: "Brasil", copa: "Libertadores", nivel: 5, grande: true, apodo: "Mengão", estadio: "Maracanã", colores: { primario: "#000000", secundario: "#FF0000" }, titulos: { libertadores: 4, sudamericana: 0 } },
  { id: "palmeiras", nombre: "Palmeiras", nombreCompleto: "Sociedade Esportiva Palmeiras", pais: "Brasil", copa: "Libertadores", nivel: 5, grande: true, apodo: "Verdão", estadio: "Allianz Parque", colores: { primario: "#006437", secundario: "#FFFFFF" }, titulos: { libertadores: 3, sudamericana: 0 } },
  { id: "sao-paulo", nombre: "São Paulo", nombreCompleto: "São Paulo Futebol Clube", pais: "Brasil", copa: "Libertadores", nivel: 4, grande: true, apodo: "Tricolor Paulista", estadio: "MorumBIS", colores: { primario: "#FF0000", secundario: "#000000" }, titulos: { libertadores: 3, sudamericana: 1 } },
  { id: "gremio", nombre: "Grêmio", nombreCompleto: "Grêmio Foot-Ball Porto Alegrense", pais: "Brasil", copa: "Libertadores", nivel: 4, grande: true, apodo: "Tricolor Gaúcho", estadio: "Arena do Grêmio", colores: { primario: "#0080C8", secundario: "#000000" }, titulos: { libertadores: 3, sudamericana: 0 } },
  { id: "internacional", nombre: "Internacional", nombreCompleto: "Sport Club Internacional", pais: "Brasil", copa: "Libertadores", nivel: 4, grande: true, apodo: "Colorado", estadio: "Beira-Rio", colores: { primario: "#FF0000", secundario: "#FFFFFF" }, titulos: { libertadores: 2, sudamericana: 1 } },
  { id: "atletico-mineiro", nombre: "Atlético Mineiro", nombreCompleto: "Clube Atlético Mineiro", pais: "Brasil", copa: "Libertadores", nivel: 4, grande: true, apodo: "Galo", estadio: "Arena MRV", colores: { primario: "#000000", secundario: "#FFFFFF" }, titulos: { libertadores: 1, sudamericana: 0 } },
  { id: "cruzeiro", nombre: "Cruzeiro", nombreCompleto: "Cruzeiro Esporte Clube", pais: "Brasil", copa: "Libertadores", nivel: 4, grande: true, apodo: "Raposa", estadio: "Mineirão", colores: { primario: "#003DA5", secundario: "#FFFFFF" }, titulos: { libertadores: 2, sudamericana: 0 } },
  { id: "corinthians", nombre: "Corinthians", nombreCompleto: "Sport Club Corinthians Paulista", pais: "Brasil", copa: "Libertadores", nivel: 4, grande: true, apodo: "Timão", estadio: "Neo Química Arena", colores: { primario: "#000000", secundario: "#FFFFFF" }, titulos: { libertadores: 1, sudamericana: 0 } },
  { id: "fluminense", nombre: "Fluminense", nombreCompleto: "Fluminense Football Club", pais: "Brasil", copa: "Libertadores", nivel: 4, grande: true, apodo: "Tricolor", estadio: "Maracanã", colores: { primario: "#8B0000", secundario: "#008000" }, titulos: { libertadores: 1, sudamericana: 0 } },
  { id: "santos", nombre: "Santos", nombreCompleto: "Santos Futebol Clube", pais: "Brasil", copa: "Libertadores", nivel: 4, grande: true, apodo: "Peixe", estadio: "Vila Belmiro", colores: { primario: "#FFFFFF", secundario: "#000000" }, titulos: { libertadores: 3, sudamericana: 0 } },
  { id: "botafogo", nombre: "Botafogo", nombreCompleto: "Botafogo de Futebol e Regatas", pais: "Brasil", copa: "Libertadores", nivel: 4, grande: true, apodo: "Fogão", estadio: "Estádio Nilton Santos", colores: { primario: "#000000", secundario: "#FFFFFF" }, titulos: { libertadores: 1, sudamericana: 0 } },
  { id: "vasco-da-gama", nombre: "Vasco da Gama", nombreCompleto: "Club de Regatas Vasco da Gama", pais: "Brasil", copa: "Sudamericana", nivel: 3, grande: true, apodo: "Gigante da Colina", estadio: "São Januário", colores: { primario: "#000000", secundario: "#FFFFFF" }, titulos: { libertadores: 1, sudamericana: 0 } },
  { id: "athletico-paranaense", nombre: "Athletico Paranaense", nombreCompleto: "Club Athletico Paranaense", pais: "Brasil", copa: "Sudamericana", nivel: 3, apodo: "Furacão", estadio: "Ligga Arena", colores: { primario: "#FF0000", secundario: "#000000" }, titulos: { libertadores: 0, sudamericana: 2 } },
  { id: "fortaleza", nombre: "Fortaleza", nombreCompleto: "Fortaleza Esporte Clube", pais: "Brasil", copa: "Sudamericana", nivel: 3, apodo: "Leão", estadio: "Arena Castelão", colores: { primario: "#0000FF", secundario: "#FF0000" } },
  { id: "bahia", nombre: "Bahia", nombreCompleto: "Esporte Clube Bahia", pais: "Brasil", copa: "Libertadores", nivel: 3, apodo: "Tricolor de Aço", estadio: "Arena Fonte Nova", colores: { primario: "#003DA5", secundario: "#FF0000" } },
  { id: "red-bull-bragantino", nombre: "Red Bull Bragantino", nombreCompleto: "Red Bull Bragantino", pais: "Brasil", copa: "Sudamericana", nivel: 3, apodo: "Massa Bruta", estadio: "Estádio Nabi Abi Chedid", colores: { primario: "#FFFFFF", secundario: "#FF0000" } },
  { id: "sport", nombre: "Sport Recife", nombreCompleto: "Sport Club do Recife", pais: "Brasil", copa: "Sudamericana", nivel: 2, apodo: "Leão da Ilha", estadio: "Ilha do Retiro", colores: { primario: "#FF0000", secundario: "#000000" } },
  { id: "goias", nombre: "Goiás", nombreCompleto: "Goiás Esporte Clube", pais: "Brasil", copa: "Sudamericana", nivel: 2, apodo: "Esmeraldino", estadio: "Estádio da Serrinha", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "vitoria", nombre: "Vitória", nombreCompleto: "Esporte Clube Vitória", pais: "Brasil", copa: "Sudamericana", nivel: 2, apodo: "Leão da Barra", estadio: "Barradão", colores: { primario: "#FF0000", secundario: "#000000" } },
  { id: "america-mineiro", nombre: "América Mineiro", nombreCompleto: "América Futebol Clube", pais: "Brasil", copa: "Libertadores", nivel: 2, apodo: "Coelho", estadio: "Independência", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "coritiba", nombre: "Coritiba", nombreCompleto: "Coritiba Foot Ball Club", pais: "Brasil", copa: "Sudamericana", nivel: 2, apodo: "Coxa", estadio: "Couto Pereira", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "chapecoense", nombre: "Chapecoense", nombreCompleto: "Associação Chapecoense de Futebol", pais: "Brasil", copa: "Sudamericana", nivel: 2, apodo: "Verdão do Oeste", estadio: "Arena Condá", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "ceara", nombre: "Ceará", nombreCompleto: "Ceará Sporting Club", pais: "Brasil", copa: "Sudamericana", nivel: 2, apodo: "Vovô", estadio: "Arena Castelão", colores: { primario: "#000000", secundario: "#FFFFFF" } },
  { id: "mirassol", nombre: "Mirassol", nombreCompleto: "Mirassol Futebol Clube", pais: "Brasil", copa: "Libertadores", nivel: 2, apodo: "Leão", estadio: "Maião", colores: { primario: "#FFD700", secundario: "#008000" } },

  // ---- Uruguay ----
  { id: "penarol", nombre: "Peñarol", nombreCompleto: "Club Atlético Peñarol", pais: "Uruguay", copa: "Libertadores", nivel: 5, grande: true, apodo: "Carbonero", estadio: "Campeón del Siglo", colores: { primario: "#000000", secundario: "#FFD700" }, titulos: { libertadores: 5, sudamericana: 0 } },
  { id: "nacional-uru", nombre: "Nacional (Uru)", nombreCompleto: "Club Nacional de Football", pais: "Uruguay", copa: "Libertadores", nivel: 5, grande: true, apodo: "Bolso", estadio: "Gran Parque Central", colores: { primario: "#FFFFFF", secundario: "#003DA5" }, titulos: { libertadores: 3, sudamericana: 0 } },
  { id: "defensor-sporting", nombre: "Defensor Sporting", nombreCompleto: "Defensor Sporting Club", pais: "Uruguay", copa: "Libertadores", nivel: 3, apodo: "Violeta", estadio: "Luis Franzini", colores: { primario: "#612A7A", secundario: "#FFFFFF" } },
  { id: "danubio", nombre: "Danubio", nombreCompleto: "Danubio Fútbol Club", pais: "Uruguay", copa: "Libertadores", nivel: 3, apodo: "La Franja", estadio: "Jardines del Hipódromo", colores: { primario: "#000000", secundario: "#FFFFFF" } },
  { id: "liverpool-uru", nombre: "Liverpool (Uru)", nombreCompleto: "Liverpool Fútbol Club", pais: "Uruguay", copa: "Libertadores", nivel: 3, apodo: "Negriazules", estadio: "Belvedere", colores: { primario: "#000000", secundario: "#FFFFFF" } },
  { id: "montevideo-wanderers", nombre: "Montevideo Wanderers", nombreCompleto: "Montevideo Wanderers Fútbol Club", pais: "Uruguay", copa: "Libertadores", nivel: 2, apodo: "Bohemios", estadio: "Parque Alfredo Víctor Viera", colores: { primario: "#000000", secundario: "#FFFFFF" } },
  { id: "plaza-colonia", nombre: "Plaza Colonia", nombreCompleto: "Club Plaza Colonia de Deportes", pais: "Uruguay", copa: "Libertadores", nivel: 2, apodo: "Patablanca", estadio: "Parque Prandi", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "boston-river", nombre: "Boston River", nombreCompleto: "Boston River", pais: "Uruguay", copa: "Libertadores", nivel: 2, apodo: "Sastre", estadio: "Estadio Campeones Olímpicos", colores: { primario: "#FF0000", secundario: "#FFFFFF" } },
  { id: "cerro-largo", nombre: "Cerro Largo", nombreCompleto: "Cerro Largo Fútbol Club", pais: "Uruguay", copa: "Libertadores", nivel: 2, apodo: "Arachanes", estadio: "Estadio Ubilla", colores: { primario: "#0000FF", secundario: "#FFFFFF" } },
  { id: "river-plate-uru", nombre: "River Plate (Uru)", nombreCompleto: "Club Atlético River Plate", pais: "Uruguay", copa: "Sudamericana", nivel: 2, apodo: "Darseneros", estadio: "Parque Federico Omar Saroldi", colores: { primario: "#FFFFFF", secundario: "#FF0000" } },
  { id: "rentistas", nombre: "Rentistas", nombreCompleto: "Club Atlético Rentistas", pais: "Uruguay", copa: "Libertadores", nivel: 1, apodo: "Bichos Colorados", estadio: "Complejo Rentistas", colores: { primario: "#FF0000", secundario: "#FFFFFF" } },

  // ---- Colombia ----
  { id: "atletico-nacional", nombre: "Atlético Nacional", nombreCompleto: "Atlético Nacional S. A.", pais: "Colombia", copa: "Libertadores", nivel: 4, grande: true, apodo: "Verdolaga", estadio: "Atanasio Girardot", colores: { primario: "#008000", secundario: "#FFFFFF" }, titulos: { libertadores: 2, sudamericana: 0 } },
  { id: "america-de-cali", nombre: "América de Cali", nombreCompleto: "Sociedad Anónima Deportiva América de Cali", pais: "Colombia", copa: "Libertadores", nivel: 3, grande: true, apodo: "La Mechita", estadio: "Olímpico Pascual Guerrero", colores: { primario: "#FF0000", secundario: "#FFFFFF" } },
  { id: "deportivo-cali", nombre: "Deportivo Cali", nombreCompleto: "Asociación Deportivo Cali", pais: "Colombia", copa: "Sudamericana", nivel: 3, grande: true, apodo: "Azucarero", estadio: "Estadio Deportivo Cali", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "millonarios", nombre: "Millonarios", nombreCompleto: "Millonarios Fútbol Club S. A.", pais: "Colombia", copa: "Libertadores", nivel: 3, grande: true, apodo: "Embajador", estadio: "El Campín", colores: { primario: "#0057B8", secundario: "#FFFFFF" } },
  { id: "junior", nombre: "Junior", nombreCompleto: "Club Deportivo Popular Junior Fútbol Club S. A.", pais: "Colombia", copa: "Libertadores", nivel: 3, grande: true, apodo: "Tiburón", estadio: "Metropolitano Roberto Meléndez", colores: { primario: "#FF0000", secundario: "#FFFFFF" } },
  { id: "santa-fe", nombre: "Santa Fe", nombreCompleto: "Independiente Santa Fe S. A.", pais: "Colombia", copa: "Sudamericana", nivel: 3, grande: true, apodo: "Cardenal", estadio: "El Campín", colores: { primario: "#FF0000", secundario: "#FFFFFF" }, titulos: { libertadores: 0, sudamericana: 1 } },
  { id: "deportes-tolima", nombre: "Deportes Tolima", nombreCompleto: "Club Deportes Tolima S. A.", pais: "Colombia", copa: "Libertadores", nivel: 3, apodo: "Pijao", estadio: "Manuel Murillo Toro", colores: { primario: "#FFD700", secundario: "#FF0000" } },
  { id: "independiente-medellin", nombre: "Independiente Medellín", nombreCompleto: "Deportivo Independiente Medellín S. A.", pais: "Colombia", copa: "Sudamericana", nivel: 3, apodo: "Poderoso", estadio: "Atanasio Girardot", colores: { primario: "#FF0000", secundario: "#000000" } },
  { id: "once-caldas", nombre: "Once Caldas", nombreCompleto: "Once Caldas S. A.", pais: "Colombia", copa: "Libertadores", nivel: 3, apodo: "Blanco Blanco", estadio: "Palogrande", colores: { primario: "#FFFFFF", secundario: "#000000" }, titulos: { libertadores: 1, sudamericana: 0 } },

  // ---- Chile ----
  { id: "colo-colo", nombre: "Colo-Colo", nombreCompleto: "Club Social y Deportivo Colo-Colo", pais: "Chile", copa: "Libertadores", nivel: 4, grande: true, apodo: "Cacique", estadio: "Monumental David Arellano", colores: { primario: "#FFFFFF", secundario: "#000000" }, titulos: { libertadores: 1, sudamericana: 0 } },
  { id: "universidad-catolica", nombre: "Universidad Católica (Chi)", nombreCompleto: "Club Deportivo Universidad Católica", pais: "Chile", copa: "Libertadores", nivel: 4, grande: true, apodo: "Cruzados", estadio: "Estadio Santa Laura", colores: { primario: "#003DA5", secundario: "#FFFFFF" } },
  { id: "universidad-de-chile", nombre: "Universidad de Chile", nombreCompleto: "Club Universidad de Chile", pais: "Chile", copa: "Libertadores", nivel: 3, grande: true, apodo: "La U", estadio: "Estadio Nacional Julio Martínez Prádanos", colores: { primario: "#003DA5", secundario: "#FFFFFF" }, titulos: { libertadores: 0, sudamericana: 1 } },
  { id: "union-espanola", nombre: "Unión Española", nombreCompleto: "Club Unión Española", pais: "Chile", copa: "Libertadores", nivel: 3, apodo: "Hispanos", estadio: "Estadio Santa Laura", colores: { primario: "#FF0000", secundario: "#FFD700" } },
  { id: "palestino", nombre: "Palestino", nombreCompleto: "Club Deportivo Palestino", pais: "Chile", copa: "Sudamericana", nivel: 3, apodo: "Tricolor", estadio: "Municipal de La Cisterna", colores: { primario: "#008000", secundario: "#FF0000" } },
  { id: "huachipato", nombre: "Huachipato", nombreCompleto: "Club Deportivo Huachipato", pais: "Chile", copa: "Sudamericana", nivel: 3, apodo: "Acereros", estadio: "Huachipato-CAP Acero", colores: { primario: "#000000", secundario: "#FFFFFF" } },
  { id: "everton-chi", nombre: "Everton (Chi)", nombreCompleto: "Everton de Viña del Mar", pais: "Chile", copa: "Sudamericana", nivel: 2, apodo: "Ruleteros", estadio: "Sausalito", colores: { primario: "#003DA5", secundario: "#FFD700" } },
  { id: "audax-italiano", nombre: "Audax Italiano", nombreCompleto: "Audax Club Sportivo Italiano", pais: "Chile", copa: "Sudamericana", nivel: 2, apodo: "Itálicos", estadio: "Bicentenario de La Florida", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "cobreloa", nombre: "Cobreloa", nombreCompleto: "Club de Deportes Cobreloa", pais: "Chile", copa: "Libertadores", nivel: 2, apodo: "Zorros del Desierto", estadio: "Zorros del Desierto", colores: { primario: "#FF6600", secundario: "#FFFFFF" } },
  { id: "coquimbo-unido", nombre: "Coquimbo Unido", nombreCompleto: "Coquimbo Unido", pais: "Chile", copa: "Libertadores", nivel: 2, apodo: "Piratas", estadio: "Francisco Sánchez Rumoroso", colores: { primario: "#FFD700", secundario: "#000000" } },

  // ---- Ecuador ----
  { id: "independiente-del-valle", nombre: "Independiente del Valle", nombreCompleto: "Club de Alto Rendimiento Especializado Independiente del Valle", pais: "Ecuador", copa: "Libertadores", nivel: 5, apodo: "Negriazules", estadio: "Banco Guayaquil", colores: { primario: "#000000", secundario: "#0066CC" }, titulos: { libertadores: 0, sudamericana: 2 } },
  { id: "liga-de-quito", nombre: "Liga de Quito", nombreCompleto: "Liga Deportiva Universitaria de Quito", pais: "Ecuador", copa: "Libertadores", nivel: 4, grande: true, apodo: "Albos", estadio: "Rodrigo Paz Delgado", colores: { primario: "#FFFFFF", secundario: "#FF0000" }, titulos: { libertadores: 1, sudamericana: 1 } },
  { id: "barcelona-sc", nombre: "Barcelona (Ecu)", nombreCompleto: "Barcelona Sporting Club", pais: "Ecuador", copa: "Libertadores", nivel: 3, grande: true, apodo: "Ídolo", estadio: "Monumental Banco Pichincha", colores: { primario: "#FFD700", secundario: "#000000" } },
  { id: "emelec", nombre: "Emelec", nombreCompleto: "Club Sport Emelec", pais: "Ecuador", copa: "Libertadores", nivel: 3, grande: true, apodo: "Bombillo", estadio: "George Capwell", colores: { primario: "#0057B8", secundario: "#FFFFFF" } },
  { id: "el-nacional", nombre: "El Nacional", nombreCompleto: "Club Deportivo El Nacional", pais: "Ecuador", copa: "Libertadores", nivel: 3, grande: true, apodo: "Militares", estadio: "Olímpico Atahualpa", colores: { primario: "#FF0000", secundario: "#000000" } },
  { id: "deportivo-cuenca", nombre: "Deportivo Cuenca", nombreCompleto: "Club Deportivo Cuenca", pais: "Ecuador", copa: "Libertadores", nivel: 2, apodo: "Morlacos", estadio: "Alejandro Serrano Aguilar", colores: { primario: "#FF0000", secundario: "#FFD700" } },
  { id: "deportivo-quito", nombre: "Deportivo Quito", nombreCompleto: "Sociedad Deportivo Quito", pais: "Ecuador", copa: "Libertadores", nivel: 2, apodo: "Azulgranas", estadio: "Olímpico Atahualpa", colores: { primario: "#003DA5", secundario: "#FF0000" } },
  { id: "aucas", nombre: "Aucas", nombreCompleto: "Sociedad Deportiva Aucas", pais: "Ecuador", copa: "Libertadores", nivel: 2, apodo: "Papá", estadio: "Gonzalo Pozo Ripalda", colores: { primario: "#FFD700", secundario: "#FF0000" } },
  { id: "delfin", nombre: "Delfín", nombreCompleto: "Delfín Sporting Club", pais: "Ecuador", copa: "Libertadores", nivel: 2, apodo: "Cetáceos", estadio: "Jocay", colores: { primario: "#0000FF", secundario: "#FFFFFF" } },
  { id: "universidad-catolica-ecu", nombre: "Universidad Católica (Ecu)", nombreCompleto: "Club Deportivo Universidad Católica", pais: "Ecuador", copa: "Libertadores", nivel: 2, apodo: "Trencito Azul", estadio: "Olímpico Atahualpa", colores: { primario: "#003DA5", secundario: "#FFFFFF" } },

  // ---- Paraguay ----
  { id: "olimpia", nombre: "Olimpia", nombreCompleto: "Club Olimpia", pais: "Paraguay", copa: "Libertadores", nivel: 5, grande: true, apodo: "Decano", estadio: "Tigo Manuel Ferreira", colores: { primario: "#FFFFFF", secundario: "#000000" }, titulos: { libertadores: 3, sudamericana: 0 } },
  { id: "cerro-porteno", nombre: "Cerro Porteño", nombreCompleto: "Club Cerro Porteño", pais: "Paraguay", copa: "Libertadores", nivel: 4, grande: true, apodo: "Ciclón", estadio: "General Pablo Rojas", colores: { primario: "#FF0000", secundario: "#003DA5" } },
  { id: "libertad", nombre: "Libertad", nombreCompleto: "Club Libertad", pais: "Paraguay", copa: "Libertadores", nivel: 4, apodo: "Gumarelo", estadio: "Tigo La Huerta", colores: { primario: "#000000", secundario: "#FFFFFF" } },
  { id: "guarani", nombre: "Guaraní", nombreCompleto: "Club Guaraní", pais: "Paraguay", copa: "Libertadores", nivel: 3, apodo: "Aborigen", estadio: "Rogelio Livieres", colores: { primario: "#000000", secundario: "#FFD700" } },
  { id: "nacional-par", nombre: "Nacional (Par)", nombreCompleto: "Club Nacional", pais: "Paraguay", copa: "Libertadores", nivel: 2, apodo: "Tricolor", estadio: "Arsenio Erico", colores: { primario: "#FFFFFF", secundario: "#003DA5" } },
  { id: "sportivo-luqueno", nombre: "Sportivo Luqueño", nombreCompleto: "Club Sportivo Luqueño", pais: "Paraguay", copa: "Sudamericana", nivel: 2, apodo: "Kure Luque", estadio: "Feliciano Cáceres", colores: { primario: "#003DA5", secundario: "#FFFFFF" } },
  { id: "sol-de-america", nombre: "Sol de América", nombreCompleto: "Club Sol de América", pais: "Paraguay", copa: "Sudamericana", nivel: 2, apodo: "Danzarín", estadio: "Luis Alfonso Giagni", colores: { primario: "#003DA5", secundario: "#FF0000" } },
  { id: "sportivo-ameliano", nombre: "Sportivo Ameliano", nombreCompleto: "Club Sportivo Ameliano", pais: "Paraguay", copa: "Sudamericana", nivel: 2, apodo: "V Azulada", estadio: "Martín Torres", colores: { primario: "#003DA5", secundario: "#FFFFFF" } },

  // ---- Perú ----
  { id: "universitario", nombre: "Universitario", nombreCompleto: "Club Universitario de Deportes", pais: "Perú", copa: "Libertadores", nivel: 3, grande: true, apodo: "Cremas", estadio: "Monumental", colores: { primario: "#8B0000", secundario: "#FFFFFF" } },
  { id: "alianza-lima", nombre: "Alianza Lima", nombreCompleto: "Club Alianza Lima", pais: "Perú", copa: "Libertadores", nivel: 3, grande: true, apodo: "Blanquiazules", estadio: "Alejandro Villanueva", colores: { primario: "#003DA5", secundario: "#FFFFFF" } },
  { id: "sporting-cristal", nombre: "Sporting Cristal", nombreCompleto: "Club Sporting Cristal", pais: "Perú", copa: "Libertadores", nivel: 3, grande: true, apodo: "Celestes", estadio: "Alberto Gallardo", colores: { primario: "#00AEEF", secundario: "#FFFFFF" } },
  { id: "melgar", nombre: "Melgar", nombreCompleto: "Foot Ball Club Melgar", pais: "Perú", copa: "Libertadores", nivel: 3, apodo: "Rojinegros", estadio: "Monumental de la UNSA", colores: { primario: "#FF0000", secundario: "#000000" } },
  { id: "cienciano", nombre: "Cienciano", nombreCompleto: "Club Sportivo Cienciano", pais: "Perú", copa: "Sudamericana", nivel: 3, apodo: "El Papá", estadio: "Inca Garcilaso de la Vega", colores: { primario: "#C8102E", secundario: "#FFFFFF" }, titulos: { libertadores: 0, sudamericana: 1 } },
  { id: "sport-huancayo", nombre: "Sport Huancayo", nombreCompleto: "Club Sport Huancayo", pais: "Perú", copa: "Sudamericana", nivel: 2, apodo: "Rojo Matador", estadio: "Huancayo", colores: { primario: "#FF0000", secundario: "#FFFFFF" } },
  { id: "utc", nombre: "UTC", nombreCompleto: "Universidad Técnica de Cajamarca", pais: "Perú", copa: "Sudamericana", nivel: 2, apodo: "Gavilán del Norte", estadio: "Héroes de San Ramón", colores: { primario: "#FF0000", secundario: "#FFFFFF" } },
  { id: "cusco", nombre: "Cusco", nombreCompleto: "Cusco Fútbol Club", pais: "Perú", copa: "Libertadores", nivel: 2, apodo: "Los Guerreros Dorados", estadio: "Inca Garcilaso de la Vega", colores: { primario: "#8B1E3F", secundario: "#F4C542" } },
  { id: "juan-aurich", nombre: "Juan Aurich", nombreCompleto: "Club Juan Aurich", pais: "Perú", copa: "Libertadores", nivel: 2, apodo: "El Ciclón del Norte", estadio: "Elías Aguirre", colores: { primario: "#C8102E", secundario: "#FFFFFF" } },
  { id: "deportivo-municipal", nombre: "Deportivo Municipal", nombreCompleto: "Club Centro Deportivo Municipal", pais: "Perú", copa: "Libertadores", nivel: 2, apodo: "La Academia", estadio: "Iván Elías Moreno", colores: { primario: "#8B0000", secundario: "#FFFFFF" } },
  { id: "binacional", nombre: "Binacional", nombreCompleto: "Deportivo Binacional Fútbol Club", pais: "Perú", copa: "Libertadores", nivel: 1, apodo: "Poderoso del Sur", estadio: "Guillermo Briceño Rosamedina", colores: { primario: "#0000FF", secundario: "#FFFFFF" } },

  // ---- Bolivia ----
  { id: "bolivar", nombre: "Bolívar", nombreCompleto: "Club Bolívar", pais: "Bolivia", copa: "Libertadores", nivel: 4, grande: true, apodo: "La Academia", estadio: "Hernando Siles", colores: { primario: "#003DA5", secundario: "#FFFFFF" } },
  { id: "the-strongest", nombre: "The Strongest", nombreCompleto: "Club The Strongest", pais: "Bolivia", copa: "Libertadores", nivel: 3, grande: true, apodo: "Tigres", estadio: "Hernando Siles", colores: { primario: "#FFD700", secundario: "#000000" } },
  { id: "jorge-wilstermann", nombre: "Jorge Wilstermann", nombreCompleto: "Club Deportivo Jorge Wilstermann", pais: "Bolivia", copa: "Libertadores", nivel: 3, grande: true, apodo: "Aviador", estadio: "Félix Capriles", colores: { primario: "#FF0000", secundario: "#000000" } },
  { id: "always-ready", nombre: "Always Ready", nombreCompleto: "Club Deportivo Always Ready", pais: "Bolivia", copa: "Libertadores", nivel: 3, apodo: "El Millonario", estadio: "Municipal de El Alto", colores: { primario: "#E30613", secundario: "#FFFFFF" } },
  { id: "oriente-petrolero", nombre: "Oriente Petrolero", nombreCompleto: "Club Deportivo Oriente Petrolero", pais: "Bolivia", copa: "Libertadores", nivel: 2, apodo: "Refineros", estadio: "Ramón Aguilera Costas", colores: { primario: "#008000", secundario: "#FFFFFF" } },
  { id: "blooming", nombre: "Blooming", nombreCompleto: "Club Blooming", pais: "Bolivia", copa: "Sudamericana", nivel: 2, apodo: "Celestes", estadio: "Ramón Aguilera Costas", colores: { primario: "#003DA5", secundario: "#FFFFFF" } },
  { id: "aurora", nombre: "Aurora", nombreCompleto: "Club Aurora", pais: "Bolivia", copa: "Libertadores", nivel: 2, apodo: "Celestes", estadio: "Félix Capriles", colores: { primario: "#003DA5", secundario: "#FFFFFF" } },
  { id: "nacional-potosi", nombre: "Nacional Potosí", nombreCompleto: "Club Atlético Nacional Potosí", pais: "Bolivia", copa: "Sudamericana", nivel: 2, apodo: "Rancho Guitarras", estadio: "Víctor Agustín Ugarte", colores: { primario: "#FF0000", secundario: "#FFFFFF" } },
  { id: "san-jose", nombre: "San José", nombreCompleto: "Club Deportivo San José", pais: "Bolivia", copa: "Libertadores", nivel: 2, apodo: "El Santo", estadio: "Jesús Bermúdez", colores: { primario: "#FFD700", secundario: "#000000" } },
  { id: "real-potosi", nombre: "Real Potosí", nombreCompleto: "Club Real Potosí", pais: "Bolivia", copa: "Libertadores", nivel: 2, apodo: "El Lila", estadio: "Víctor Agustín Ugarte", colores: { primario: "#6A0DAD", secundario: "#FFFFFF" } },

  // ---- Venezuela ----
  { id: "caracas", nombre: "Caracas", nombreCompleto: "Caracas Fútbol Club", pais: "Venezuela", copa: "Libertadores", nivel: 3, grande: true, apodo: "Rojos del Ávila", estadio: "Olímpico de la UCV", colores: { primario: "#FF0000", secundario: "#000000" } },
  { id: "deportivo-tachira", nombre: "Deportivo Táchira", nombreCompleto: "Deportivo Táchira Fútbol Club", pais: "Venezuela", copa: "Libertadores", nivel: 3, grande: true, apodo: "Aurinegro", estadio: "Polideportivo de Pueblo Nuevo", colores: { primario: "#FFD700", secundario: "#000000" } },
  { id: "zamora", nombre: "Zamora", nombreCompleto: "Zamora Fútbol Club", pais: "Venezuela", copa: "Libertadores", nivel: 2, apodo: "Blanquinegros", estadio: "Agustín Tovar", colores: { primario: "#000000", secundario: "#FFFFFF" } },
  { id: "monagas", nombre: "Monagas", nombreCompleto: "Monagas Sport Club", pais: "Venezuela", copa: "Libertadores", nivel: 2, apodo: "Azulgranas", estadio: "Monumental de Maturín", colores: { primario: "#003DA5", secundario: "#FFFFFF" } },
  { id: "estudiantes-de-merida", nombre: "Estudiantes de Mérida", nombreCompleto: "Estudiantes de Mérida Fútbol Club", pais: "Venezuela", copa: "Sudamericana", nivel: 2, apodo: "Académicos", estadio: "Metropolitano de Mérida", colores: { primario: "#FF0000", secundario: "#FFFFFF" } },
  { id: "carabobo", nombre: "Carabobo", nombreCompleto: "Carabobo Fútbol Club", pais: "Venezuela", copa: "Libertadores", nivel: 2, apodo: "Granate", estadio: "Misael Delgado", colores: { primario: "#FF0000", secundario: "#000000" } },
  { id: "metropolitanos", nombre: "Metropolitanos", nombreCompleto: "Metropolitanos Fútbol Club", pais: "Venezuela", copa: "Sudamericana", nivel: 2, apodo: "Violetas", estadio: "Olímpico de la UCV", colores: { primario: "#800080", secundario: "#FFFFFF" } },
  { id: "deportivo-la-guaira", nombre: "Deportivo La Guaira", nombreCompleto: "Deportivo La Guaira Fútbol Club", pais: "Venezuela", copa: "Sudamericana", nivel: 2, apodo: "El Naranja", estadio: "Olímpico de la UCV", colores: { primario: "#F58220", secundario: "#000000" } },
  { id: "universidad-central", nombre: "Universidad Central", nombreCompleto: "Universidad Central de Venezuela Fútbol Club", pais: "Venezuela", copa: "Libertadores", nivel: 2, apodo: "El Tricolor", estadio: "Olímpico de la UCV", colores: { primario: "#8B0000", secundario: "#FFFFFF" } },
  { id: "mineros-de-guayana", nombre: "Mineros de Guayana", nombreCompleto: "Club Deportivo Mineros de Guayana", pais: "Venezuela", copa: "Libertadores", nivel: 2, apodo: "Los Negriazules", estadio: "Cachamay", colores: { primario: "#000000", secundario: "#FFFFFF" } },
  { id: "deportivo-lara", nombre: "Deportivo Lara", nombreCompleto: "Club Deportivo Lara", pais: "Venezuela", copa: "Libertadores", nivel: 2, apodo: "Los Rojinegros", estadio: "Metropolitano de Cabudare", colores: { primario: "#8B0000", secundario: "#FFFFFF" } },
  { id: "deportivo-anzoategui", nombre: "Deportivo Anzoátegui", nombreCompleto: "Deportivo Anzoátegui Sport Club", pais: "Venezuela", copa: "Sudamericana", nivel: 1, apodo: "El Aurirrojo", estadio: "José Antonio Anzoátegui", colores: { primario: "#0057B8", secundario: "#FFFFFF" } },
];

// Cuántos cupos reparte cada país todos los años. Es lo que hace que el pozo
// de arriba sea un pozo: si Brasil tiene 23 clubes cargados pero 13 cupos,
// diez se quedan afuera cada temporada, y cuáles son cambia según cómo les
// fue ese año (ver Engine.sortearCuposInternacionales).
//
// Los de la Libertadores son los de la edición 2026 de verdad: Brasil mete 7
// (5 directo a grupos y 2 por fase previa) y los otros ocho países 4 cada uno
// (2 y 2). Argentina no está acá porque sus 6 cupos salen del propio juego
// (ver Engine.assignQualification), y coinciden con los reales: 5 a grupos y
// el sexto a fase previa.
//
// Los de la Sudamericana también son los de 2026: Brasil mete sus 6 directo a
// la fase de grupos (igual que los 6 argentinos, que salen del juego) y los
// otros ocho países mandan 4 cada uno a la Primera Fase. Son 32 equipos
// cruzándose ahí, de los que sobreviven 16.
//
//   `libertadoresGrupos`      — entran directo a los grupos de la Libertadores.
//   `libertadoresPrevia`      — arrancan en alguna fase previa de la Libertadores.
//   `sudamericanaGrupos`      — entran directo a los grupos de la Sudamericana.
//   `sudamericanaPrimeraFase` — arrancan en la Primera Fase de la Sudamericana.
const CUPOS_INTERNACIONALES = {
  Brasil:    { libertadoresGrupos: 5, libertadoresPrevia: 2, sudamericanaGrupos: 6, sudamericanaPrimeraFase: 0 },
  Uruguay:   { libertadoresGrupos: 2, libertadoresPrevia: 2, sudamericanaGrupos: 0, sudamericanaPrimeraFase: 4 },
  Colombia:  { libertadoresGrupos: 2, libertadoresPrevia: 2, sudamericanaGrupos: 0, sudamericanaPrimeraFase: 4 },
  Chile:     { libertadoresGrupos: 2, libertadoresPrevia: 2, sudamericanaGrupos: 0, sudamericanaPrimeraFase: 4 },
  Ecuador:   { libertadoresGrupos: 2, libertadoresPrevia: 2, sudamericanaGrupos: 0, sudamericanaPrimeraFase: 4 },
  Paraguay:  { libertadoresGrupos: 2, libertadoresPrevia: 2, sudamericanaGrupos: 0, sudamericanaPrimeraFase: 4 },
  'Perú':    { libertadoresGrupos: 2, libertadoresPrevia: 2, sudamericanaGrupos: 0, sudamericanaPrimeraFase: 4 },
  Bolivia:   { libertadoresGrupos: 2, libertadoresPrevia: 2, sudamericanaGrupos: 0, sudamericanaPrimeraFase: 4 },
  Venezuela: { libertadoresGrupos: 2, libertadoresPrevia: 2, sudamericanaGrupos: 0, sudamericanaPrimeraFase: 4 },
};

// Con cuántos equipos arranca la fase de grupos cada copa. No es un dato
// decorativo: son 8 grupos de 4, siempre, y un grupo de 3 no existe en
// ninguna de las dos. Los cupos de arriba están puestos para que la cuenta dé
// justo, pero si algún año queda un cupo sin dueño el juego lo completa antes
// del sorteo (ver Engine.completarCuposDeGrupos).
const CUPOS_EN_GRUPOS = { Libertadores: 32, Sudamericana: 32 };

// Las finales de las dos copas son a partido único y en una sede que CONMEBOL
// define con meses de anticipación, siempre en un estadio grande del
// continente y nunca en la cancha de ninguno de los dos finalistas. Estas son
// las que se usaron en las últimas ediciones.
const SEDES_FINALES_CONMEBOL = [
  'el Monumental (Buenos Aires)',
  'el Maracaná (Río de Janeiro)',
  'el Centenario (Montevideo)',
  'el Mineirão (Belo Horizonte)',
  'el Defensores del Chaco (Asunción)',
  'el Nacional de Lima',
  'el Metropolitano de Barranquilla',
  'el Rodrigo Paz Delgado (Quito)',
  'el Monumental Banco Pichincha (Guayaquil)',
  'el Mario Alberto Kempes (Córdoba)',
];

// Cómo resuelve cada copa lo que se juega ANTES de la fase de grupos.
//
// La Libertadores tiene tres fases encadenadas: en cada una juegan los que
// ganaron la anterior más los que recién entran ahí. Son 6 en la Fase 1
// (quedan 3), 16 en la Fase 2 (esos 3 más 13 nuevos, quedan 8) y 8 en la
// Fase 3, de donde salen los 4 que llegan a los grupos. Con los cupos de
// arriba arrancan en previa justo 19 equipos (18 del continente más el sexto
// argentino), que es lo que pide el formato real. Los 4 que pierden la Fase 3
// no quedan eliminados: caen a los grupos de la Sudamericana.
//
// La Sudamericana tiene una sola ronda, a partido único, y con una particu-
// laridad linda: los cuatro equipos de cada país se cruzan ENTRE ELLOS. Los
// dos bolivianos contra los otros dos bolivianos, y así con los ocho países.
// De los 32 que entran pasan 16.
const FASES_PREVIAS = {
  Libertadores: { encadenadas: [6, 16, 8] },
  Sudamericana: { cruceEntreCompatriotas: true },
};
