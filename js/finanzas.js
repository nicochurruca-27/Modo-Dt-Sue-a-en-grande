// La realidad económica de cada club de Primera: el valor de su plantel, sus
// socios, el aforo de su cancha y en qué estado están sus cuentas.
//
// Antes el juego repartía la plata por CATEGORÍA: los dos grandes en un
// escalón, los históricos en otro, y así. El resultado era que Boca y River
// arrancaban con los mismos $16 M, los de mitad de tabla con casi lo mismo que
// los chicos, y un club fundido manejaba igual de bien la plata que uno sano.
// Nada de eso es cierto.
//
// De dónde salen los números (investigación de septiembre de 2026):
//
//   `plantel` — valor de mercado del plantel según Transfermarkt, pasado a
//               millones de dólares (corte junio-septiembre de 2026). Es el
//               dato más comparable entre los 30: no es un activo contable,
//               pero mide bien la escala deportiva y económica de cada club.
//   `socios`  — padrón declarado por el club (informe AFA 2025 / padrones
//               auditados). Dos clubes no publican: van en null.
//   `aforo`   — capacidad de la cancha donde juega de local.
//   `salud`   — en qué estado están las cuentas, de lo que publicaron los
//               propios clubes: 'sana', 'ajustada', 'endeudada' o 'crisis'.
//
// Lo que NO hay, y por eso no está: el "dinero disponible para fichajes" real
// de cada club. Ningún club argentino lo publica de forma comparable, y los
// balances que sí se publican están en pesos, que con la inflación no sirven
// para comparar un club con otro. El juego lo DERIVA de lo de arriba (ver
// Economia.ingresoAnualDe y Engine.startingBudget) en vez de inventarlo.
//
// Los dos casos que más cambian el juego:
//   - San Lorenzo: plantel de los más caros del país y un pasivo relevado en
//     junio de 2026 de unos USD 68 M. Plantel grande, sin un peso.
//   - Newell's: auditoría de mayo de 2026 con USD 33,6 M de deuda.
//
// Los clubes de la Primera Nacional no están acá: no hay datos publicados
// comparables, así que siguen andando por categoría como hasta ahora.
const FINANZAS_CLUBES = {
  boca: { plantel: 121.42, socios: 264802, aforo: 54000, salud: 'sana' },
  river: { plantel: 150.61, socios: 352712, aforo: 85000, salud: 'sana' },
  estudianteslp: { plantel: 57.42, socios: 55871, aforo: 32530, salud: 'ajustada' },
  independiente: { plantel: 43.91, socios: 130600, aforo: 48069, salud: 'ajustada' },
  newells: { plantel: 35.45, socios: 84759, aforo: 49000, salud: 'crisis' },
  racing: { plantel: 81.20, socios: 102707, aforo: 55000, salud: 'sana' },
  rosariocentral: { plantel: 62.51, socios: 104951, aforo: 46755, salud: 'sana' },
  talleres: { plantel: 49.55, socios: 70582, aforo: 57000, salud: 'sana' },
  velez: { plantel: 44.79, socios: 79083, aforo: 49747, salud: 'sana' },
  argentinos: { plantel: 49.20, socios: 20069, aforo: 22063, salud: 'sana' },
  atleticotucuman: { plantel: 13.61, socios: 27956, aforo: 35200, salud: 'ajustada' },
  banfield: { plantel: 17.43, socios: 16803, aforo: 34901, salud: 'ajustada' },
  belgrano: { plantel: 32.17, socios: 67318, aforo: 38550, salud: 'sana' },
  defensayjusticia: { plantel: 28.55, socios: 7400, aforo: 18750, salud: 'sana' },
  gimnasialp: { plantel: 29.25, socios: 35389, aforo: 33000, salud: 'ajustada' },
  huracan: { plantel: 24.20, socios: 68755, aforo: 43482, salud: 'ajustada' },
  lanus: { plantel: 45.81, socios: 36206, aforo: 46619, salud: 'sana' },
  sanlorenzo: { plantel: 55.17, socios: 89717, aforo: 47964, salud: 'crisis' },
  tigre: { plantel: 42.33, socios: 9181, aforo: 26282, salud: 'sana' },
  union: { plantel: 32.94, socios: 22774, aforo: 27358, salud: 'ajustada' },
  aldosivi: { plantel: 9.77, socios: 5604, aforo: 35180, salud: 'ajustada' },
  barracascentral: { plantel: 19.89, socios: 3107, aforo: 18000, salud: 'sana' },
  centralcordoba: { plantel: 8.87, socios: 6567, aforo: 30000, salud: 'sana' },
  riestra: { plantel: 11.41, socios: 1007, aforo: 10000, salud: 'sana' },
  independienterivadavia: { plantel: 47.36, socios: 18926, aforo: 24000, salud: 'sana' },
  instituto: { plantel: 26.09, socios: 29156, aforo: 25000, salud: 'sana' },
  platense: { plantel: 33.11, socios: 9132, aforo: 28530, salud: 'sana' },
  sarmientojunin: { plantel: 15.13, socios: 9340, aforo: 23156, salud: 'ajustada' },
  riocuarto: { plantel: 8.17, socios: null, aforo: 12000, salud: 'sana' },
  gimnasiamendoza: { plantel: 15.03, socios: null, aforo: 14000, salud: 'sana' },
};

// Cuánto de su plata llega de verdad al plantel según cómo esté el club. Un
// club en crisis no factura menos: factura parecido y la plata se va en otra
// cosa antes de llegar al fútbol.
//
// Los valores están medidos, no elegidos a ojo: con 0,78 para 'ajustada' un
// club chico y ajustado se quedaba sin un peso en la quinta temporada sin
// haber hecho nada, y 'ajustada' quiere decir "le cuesta pero funciona", no
// "se funde". Con estos, un club ajustado aprieta y uno en crisis duele.
const SALUD_FACTOR = {
  sana: 1,
  ajustada: 0.88,
  endeudada: 0.62,
  crisis: 0.45,
};
