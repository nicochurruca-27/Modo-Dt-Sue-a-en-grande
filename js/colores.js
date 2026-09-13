// Los dos colores de cada club, generado por tools/generar-colores.py — no se
// edita a mano. Salen de contar los píxeles del propio escudo (js/escudos.js),
// así que son los colores que de verdad tiene el club, no una lista escrita a
// ojo.
//
// La clave es el id del club en CLUB_TEMPLATES (data.js). El primero es el
// color que manda y el segundo el que acompaña. Un club que no esté acá se
// dibuja con el gris de siempre.
const CLUB_COLORES = {
  aldosivi: ['#318e48', '#e3c206'],
  argentinos: ['#1d5da4', '#e01d33'],
  atleticotucuman: ['#7ea5d0', '#f4f4f6'],
  banfield: ['#437936', '#f4f4f6'],
  barracascentral: ['#d2130b', '#f4f4f6'],
  belgrano: ['#3599ce', '#f4f4f6'],
  boca: ['#04418d', '#f8be01'],
  centralcordoba: ['#d9be92', '#f4f4f6'],
  defensayjusticia: ['#027a3d', '#fcde00'],
  estudianteslp: ['#e00d16', '#f4f4f6'],
  gimnasialp: ['#153663', '#e4d195'],
  gimnasiamendoza: ['#f4f4f6', '#18181c'],
  huracan: ['#a51013', '#f4f4f6'],
  independiente: ['#be070f', '#f4f4f6'],
  independienterivadavia: ['#2e3368', '#f4f4f6'],
  instituto: ['#e11b2c', '#f4f4f6'],
  lanus: ['#7b202c', '#f4f4f6'],
  newells: ['#bd070e', '#18181c'],
  platense: ['#463118', '#f4f4f6'],
  racing: ['#4999ca', '#f4f4f6'],
  riestra: ['#f4f4f6', '#18181c'],
  riocuarto: ['#008bd3', '#f4f4f6'],
  river: ['#e11f1a', '#f4f4f6'],
  rosariocentral: ['#043870', '#fee424'],
  sanlorenzo: ['#1e2c4a', '#bf012d'],
  sarmientojunin: ['#386537', '#f4f4f6'],
  talleres: ['#2a3454', '#f4f4f6'],
  tigre: ['#024083', '#bf1835'],
  union: ['#be0a10', '#f4f4f6'],
  velez: ['#3461a5', '#f4f4f6'],
};
