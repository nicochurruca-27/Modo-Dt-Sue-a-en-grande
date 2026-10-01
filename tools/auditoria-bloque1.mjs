// AUDITORÍA DEL BLOQUE 1 — regresión de los sistemas que ya existen.
//
//     npm install --no-save playwright
//     node tools/auditoria-bloque1.mjs
//
// Esto NO corrige nada. Juega varias temporadas enteras con un piloto
// automático y, al cerrar cada una, le pasa al estado del juego una batería
// de invariantes: cosas que tienen que ser ciertas siempre, pase lo que pase.
// Cuando una no se cumple, lo anota con el club, la temporada y los valores,
// para que el bloque de corrección tenga por dónde empezar.
//
// El piloto elige siempre la primera opción de cada decisión: representa al
// DT que no piensa nada, que es el PISO del juego.

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEMPORADAS = Number(process.argv[2] || 10);
const CLUB = process.argv[3] || 'boca';

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await navegador.newPage();
const erroresDePagina = [];
page.on('pageerror', (e) => erroresDePagina.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') erroresDePagina.push('console: ' + m.text()); });
await page.goto('file://' + path.join(raiz, 'index.html'));
await page.waitForFunction(() => typeof Juveniles !== 'undefined');

// ---------- El piloto automático y los invariantes, adentro de la página ----------
await page.evaluate(() => {
  window.__carrera = (clubId) => {
    localStorage.removeItem('dt-simulador-save-v3');
    Engine.createDT('Nico', 'ARG', 'equilibrado');
    Engine.newGame(clubId || 'boca');
    Engine.continueFromPresentation(0);
    Engine._fuerzas = {};
  };

  // Juega hasta el cierre de la temporada y se frena ANTES de arrancar la
  // siguiente, para que lastSeasonSummary siga estando para mirar.
  window.__jugarUnaTemporada = () => {
    let vueltas = 0;
    while (vueltas++ < 60000) {
      const s = Engine.state;
      switch (s.screen) {
        case 'calendar': Engine.avanzarUnDia(); break;
        case 'pre-match': Engine.chooseDecision(0); break;
        case 'partido': Engine.simularUnMinuto(); break;
        case 'entretiempo': Engine.resolverEntretiempo(0); break;
        case 'lesion': Engine.seguirDespuesDeLaLesion(); break;
        case 'penalty': Engine.seguirDespuesDelPenal(); break;
        case 'match-result': Engine.finishMatchAndAdvance(); break;
        case 'contract-renewal': Engine.resolveContractDecision(true); break;
        case 'transfer': Engine.continueFromTransfer(); break;
        case 'fifa-break': Engine.continueFromFifa(); break;
        case 'oferta-recibida': Engine.resolverOferta(false); break;
        case 'season-end': return { ok: true, carreraTerminada: !!(s.lastSeasonSummary || {}).carreraTerminada };
        case 'despido': return { ok: false, motivo: 'te echaron' };
        default: return { ok: false, motivo: 'pantalla desconocida: ' + s.screen };
      }
    }
    return { ok: false, motivo: 'se quedó sin vueltas' };
  };

  const esNumeroSano = (n) => typeof n === 'number' && Number.isFinite(n);

  // La batería. Devuelve la lista de problemas encontrados en este momento.
  window.__invariantes = (temporada, cuando) => {
    const s = Engine.state;
    const fallos = [];
    const anotar = (sistema, que, detalle) => fallos.push({ temporada, cuando, sistema, que, detalle });

    // ---- Clubes ----
    const clubes = s.clubs || [];
    const ids = clubes.map((c) => c.id);
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (repetidos.length) anotar('clubes', 'ids de club repetidos', repetidos.join(', '));
    const d1 = clubes.filter((c) => c.division === 'D1');
    const d2 = clubes.filter((c) => c.division === 'D2');
    const sinDivision = clubes.filter((c) => c.division !== 'D1' && c.division !== 'D2');
    if (d1.length !== 30) anotar('clubes', 'Primera no tiene 30 clubes', `tiene ${d1.length}`);
    if (d2.length !== 36) anotar('clubes', 'la Nacional no tiene 36 clubes', `tiene ${d2.length}`);
    if (sinDivision.length) anotar('clubes', 'clubes sin división', sinDivision.map((c) => c.id).join(', '));
    ['D1', 'D2'].forEach((div) => {
      const zonas = {};
      clubes.filter((c) => c.division === div).forEach((c) => { zonas[c.zone] = (zonas[c.zone] || 0) + 1; });
      const esperado = div === 'D1' ? 15 : 18;
      Object.entries(zonas).forEach(([z, n]) => {
        if (n !== esperado) anotar('clubes', `zona desbalanceada en ${div}`, `zona ${z} tiene ${n}, se esperaban ${esperado}`);
      });
    });

    // ---- Jugadores: ids únicos en todo el mundo, nadie en dos clubes ----
    const dueño = new Map();
    const revisarPlantel = (clubId, plantel, propio) => {
      if (!plantel.length) { anotar('jugadores', 'club sin jugadores', clubId); return; }
      if (!plantel.filter((p) => p.pos === 'POR').length) {
        anotar('arqueros', 'club con 0 arqueros', `${clubId} (${plantel.length} jugadores)`);
      }
      plantel.forEach((p) => {
        if (dueño.has(p.id) && dueño.get(p.id) !== clubId) {
          anotar('jugadores', 'jugador en dos clubes', `${p.name} (${p.id}): ${dueño.get(p.id)} y ${clubId}`);
        }
        dueño.set(p.id, clubId);
        if (!['POR', 'DEF', 'MED', 'DEL'].includes(p.pos)) {
          anotar('jugadores', 'puesto inválido', `${p.name} (${clubId}): pos=${JSON.stringify(p.pos)}`);
        }
        const edad = Engine.edadDe(p);
        if (!esNumeroSano(edad) || edad < 14 || edad > 50) {
          anotar('jugadores', 'edad imposible', `${p.name} (${clubId}): ${edad}`);
        }
        if (p.birthDate && !Engine.parseFechaDeNacimiento(p.birthDate)) {
          anotar('jugadores', 'fecha de nacimiento inválida', `${p.name} (${clubId}): ${p.birthDate}`);
        }
        if (!esNumeroSano(p.rating)) anotar('jugadores', 'rating no numérico', `${p.name} (${clubId}): ${p.rating}`);
        if (propio && p.out && (!esNumeroSano(p.out.matches) || p.out.matches < 0)) {
          anotar('lesiones', 'partidos de baja imposibles', `${p.name}: ${JSON.stringify(p.out)}`);
        }
        if (propio && p.amarillas != null && (!esNumeroSano(p.amarillas) || p.amarillas < 0 || p.amarillas >= 5)) {
          anotar('suspensiones', 'contador de amarillas fuera de rango', `${p.name}: ${p.amarillas}`);
        }
      });
      const idsP = plantel.map((p) => p.id);
      const rep = idsP.filter((id, i) => idsP.indexOf(id) !== i);
      if (rep.length) anotar('jugadores', 'jugador repetido dentro del plantel', `${clubId}: ${[...new Set(rep)].join(', ')}`);
    };
    revisarPlantel(s.clubId, s.squad || [], true);
    clubes.forEach((c) => { if (c.id !== s.clubId) revisarPlantel(c.id, Mercado.plantel(Engine, c.id), false); });

    // ---- Economía: solo que los números sigan siendo números ----
    [['budget', s.budget], ['morale', s.morale], ['confianza', s.confianza]].forEach(([k, v]) => {
      if (v != null && !esNumeroSano(v)) anotar('economía', `${k} no es un número sano`, String(v));
    });

    // ---- Calendario ----
    const f = Engine.fechaDelJuego();
    if (!fechaExiste(f.anio, f.mes, f.dia)) {
      anotar('calendario', 'la fecha del juego no existe', JSON.stringify(f));
    }
    if (s.calendar && (!esNumeroSano(s.calendar.dayCount) || s.calendar.dayCount < 0)) {
      anotar('calendario', 'dayCount inválido', String(s.calendar && s.calendar.dayCount));
    }

    // ---- Tablas ----
    const revisarTabla = (nombre, filas) => {
      if (!filas || !filas.length) return;
      const vistos = new Set();
      filas.forEach((r, i) => {
        if (vistos.has(r.id)) anotar('tablas', `${nombre}: club repetido en la tabla`, r.id);
        vistos.add(r.id);
        const campos = { played: r.played, win: r.win, draw: r.draw, loss: r.loss, gf: r.gf, ga: r.ga, pts: r.pts };
        Object.entries(campos).forEach(([k, v]) => {
          if (v == null) return;
          if (!esNumeroSano(v) || v < 0) anotar('tablas', `${nombre}: ${k} inválido`, `${r.id}: ${v}`);
        });
        if (r.win != null && r.played != null && r.win + r.draw + r.loss !== r.played) {
          anotar('tablas', `${nombre}: G+E+P no da PJ`, `${r.id}: ${r.win}+${r.draw}+${r.loss} ≠ ${r.played}`);
        }
        if (r.pts != null && r.win != null && r.pts !== r.win * 3 + r.draw) {
          anotar('tablas', `${nombre}: los puntos no cuadran`, `${r.id}: ${r.pts} ≠ ${r.win}*3+${r.draw}`);
        }
        if (i > 0 && filas[i - 1].pts != null && r.pts > filas[i - 1].pts) {
          anotar('tablas', `${nombre}: la tabla no está ordenada`, `${filas[i - 1].id} ${filas[i - 1].pts} antes que ${r.id} ${r.pts}`);
        }
      });
    };
    const sum = s.lastSeasonSummary || {};
    revisarTabla('anual D1', sum.tablaAnualD1);
    revisarTabla('zona del usuario', sum.myZoneTable);

    // ---- Promedios ----
    const prom = Engine.obtenerTablaPromedios ? Engine.obtenerTablaPromedios() : [];
    prom.forEach((r) => {
      if (!esNumeroSano(r.promedio)) anotar('promedios', 'promedio no numérico', `${r.id}: ${r.promedio}`);
      if (r.pj != null && r.pj < 0) anotar('promedios', 'partidos negativos', `${r.id}: ${r.pj}`);
      if (r.promedio != null && (r.promedio < 0 || r.promedio > 3.01)) {
        anotar('promedios', 'promedio fuera del rango posible (0 a 3)', `${r.id}: ${r.promedio}`);
      }
    });
    const idsProm = prom.map((r) => r.id);
    const repProm = idsProm.filter((id, i) => idsProm.indexOf(id) !== i);
    if (repProm.length) anotar('promedios', 'club repetido en la tabla de promedios', [...new Set(repProm)].join(', '));

    // ---- Copa Argentina ----
    const cb = s.copaBracket;
    if (cb) {
      const vivos = (cb.alive || []).map((x) => x.id).filter(Boolean);
      const repC = vivos.filter((id, i) => vivos.indexOf(id) !== i);
      if (repC.length) anotar('copa argentina', 'equipo duplicado en el cuadro', [...new Set(repC)].join(', '));
      vivos.forEach((id) => { if (!Engine.getClub(id)) anotar('copa argentina', 'equipo que no existe', id); });
      if (cb.champion && !Engine.getClub(cb.champion)) anotar('copa argentina', 'campeón inexistente', cb.champion);
    }

    // ---- Copas internacionales ----
    const ci = s.copasInter;
    if (ci && ci.copas) {
      Object.entries(ci.copas).forEach(([nombre, copa]) => {
        if (!copa) return;
        const todos = [];
        // Un grupo es { letra, ids: [4], tabla: { id: fila }, partidos, fixture }.
        (copa.grupos || []).forEach((g) => {
          const equipos = g.ids || [];
          equipos.forEach((id) => todos.push(id));
          if (equipos.length !== 4) {
            anotar(nombre.toLowerCase(), 'grupo que no tiene 4 equipos', `grupo ${g.letra}: ${equipos.length}`);
          }
          const enLaTabla = Object.keys(g.tabla || {});
          if (enLaTabla.length !== equipos.length) {
            anotar(nombre.toLowerCase(), 'la tabla del grupo no coincide con sus equipos',
              `grupo ${g.letra}: ${equipos.length} equipos, ${enLaTabla.length} filas`);
          }
          Object.entries(g.tabla || {}).forEach(([id, r]) => {
            ['played', 'win', 'draw', 'loss', 'gf', 'ga', 'pts'].forEach((k) => {
              if (r[k] != null && (!esNumeroSano(r[k]) || r[k] < 0)) {
                anotar(nombre.toLowerCase(), `${k} inválido en un grupo`, `${id}: ${r[k]}`);
              }
            });
            if (r.played > 6) anotar(nombre.toLowerCase(), 'más de 6 partidos en la fase de grupos', `${id}: ${r.played}`);
            if (r.win + r.draw + r.loss !== r.played) {
              anotar(nombre.toLowerCase(), 'G+E+P no da PJ en un grupo', `${id}: ${r.win}+${r.draw}+${r.loss} ≠ ${r.played}`);
            }
            if (r.pts !== r.win * 3 + r.draw) {
              anotar(nombre.toLowerCase(), 'los puntos del grupo no cuadran', `${id}: ${r.pts} ≠ ${r.win}*3+${r.draw}`);
            }
          });
        });
        const rep = todos.filter((id, i) => todos.indexOf(id) !== i);
        if (rep.length) anotar(nombre.toLowerCase(), 'equipo en dos grupos', [...new Set(rep)].join(', '));
        const existe = (id) => !!Engine.getClub(id)
          || (typeof CLUBES_INTERNACIONALES !== 'undefined' && CLUBES_INTERNACIONALES.some((c) => c.id === id));
        if (copa.campeon && !existe(copa.campeon)) anotar(nombre.toLowerCase(), 'campeón que no existe', copa.campeon);
        // `clubes` puede venir como array o como mapa por id según la fase:
        // se normaliza en vez de asumir una de las dos formas.
        const crudo = copa.clubes || [];
        const participantes = (Array.isArray(crudo) ? crudo : Object.values(crudo))
          .map((c) => (typeof c === 'string' ? c : (c && c.id)))
          .filter(Boolean);
        participantes.forEach((id) => {
          if (!existe(id)) anotar(nombre.toLowerCase(), 'participante que no existe', id);
        });
        const repP = participantes.filter((id, i) => participantes.indexOf(id) !== i);
        if (repP.length) anotar(nombre.toLowerCase(), 'participante duplicado', [...new Set(repP)].join(', '));
      });
    }

    // ---- Barrido final: NaN / Infinity en cualquier rincón del estado ----
    const malos = [];
    const caminar = (obj, ruta, profundidad) => {
      if (profundidad > 8 || malos.length > 12) return;
      if (typeof obj === 'number' && !Number.isFinite(obj)) { malos.push(`${ruta} = ${obj}`); return; }
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach((k) => caminar(obj[k], `${ruta}.${k}`, profundidad + 1));
    };
    caminar(s, 'state', 0);
    malos.forEach((m) => anotar('estados imposibles', 'número que no es finito', m));

    return fallos;
  };
});

// ---------- Guardado y carga ----------
const guardadoYCarga = await page.evaluate(() => {
  const r = { problemas: [], detalle: {} };
  window.__carrera('racing');
  // Se ensucia el estado todo lo que se pueda antes de guardar.
  const s = Engine.state;
  s.squad[0].out = { reason: 'lesión', detail: 'Desgarro', matches: 3 };
  s.squad[1].amarillas = 4;
  s.squad[2].out = { reason: 'suspensión', detail: 'Roja directa', matches: 2 };
  s.budget = 12345678;
  Mercado.init(s);
  s.mercado.acuerdos.push({ jugador: { id: 'x1', name: 'Prueba' }, clubId: 'boca', precio: 1000 });
  Juveniles.init(s);
  Juveniles.mandarOjeador(Engine, 'BRA', ['DEL']);
  window.__jugarUnaTemporada();

  const antes = JSON.parse(JSON.stringify(Engine.state));
  Engine.save();
  const crudo = localStorage.getItem('dt-simulador-save-v3');
  const cargo = Engine.load();
  const despues = Engine.state;

  const comparar = (ruta, a, b) => {
    if (typeof a !== typeof b) { r.problemas.push(`${ruta}: cambió de tipo (${typeof a} -> ${typeof b})`); return; }
    if (a && typeof a === 'object') {
      const ka = Object.keys(a);
      const kb = Object.keys(b || {});
      ka.filter((k) => !kb.includes(k)).forEach((k) => r.problemas.push(`${ruta}.${k}: desapareció al cargar`));
      ka.forEach((k) => { if (kb.includes(k)) comparar(`${ruta}.${k}`, a[k], b[k]); });
      return;
    }
    if (a !== b) r.problemas.push(`${ruta}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  };
  comparar('state', antes, despues);

  r.detalle = {
    cargo,
    pesoDelSave: Math.round(crudo.length / 1024) + ' KB',
    jugadores: `${antes.squad.length} -> ${despues.squad.length}`,
    plata: `${antes.budget} -> ${despues.budget}`,
    lesionado: JSON.stringify(despues.squad.find((p) => p.out && p.out.reason === 'lesión') ? 'sí' : 'NO'),
    amarillas: despues.squad.filter((p) => p.amarillas).length,
    ojeador: despues.juveniles && despues.juveniles.ojeador ? 'sigue de viaje' : 'PERDIDO',
    acuerdos: despues.mercado.acuerdos.length,
    temporada: despues.season.year,
    tablaAnual: (despues.lastSeasonSummary || {}).tablaAnualD1 ? 'sí' : 'no',
  };
  return r;
});

// ---------- Saves corruptos ----------
const corrupcion = await page.evaluate(() => {
  const casos = {
    'JSON inválido': '{esto no es json',
    'save vacío': '',
    'solo espacios': '   ',
    'array en vez de objeto': '[]',
    'objeto vacío': '{}',
    'versión futura': JSON.stringify({ screen: 'calendar', version: 999, clubId: 'boca' }),
    'sin clubId': JSON.stringify({ screen: 'calendar', version: 1, squad: [] }),
    'squad con tipo incorrecto': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: 'no soy un array' }),
    'clubs faltante': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: [] }),
    'null': 'null',
    'número suelto': '42',
  };
  const r = {};
  window.__carrera('boca');
  const partidaBuena = JSON.stringify(Engine.state);
  Object.entries(casos).forEach(([nombre, valor]) => {
    Engine.state = JSON.parse(partidaBuena);
    localStorage.setItem('dt-simulador-save-v3', valor);
    let cargo;
    let reventó = null;
    try { cargo = Engine.load(); } catch (e) { reventó = e.message; }
    r[nombre] = {
      aceptado: cargo === true,
      reventó,
      // Lo importante: que al rechazarlo no haya dejado el estado roto.
      estadoSano: !!(Engine.state && Engine.state.clubId && Array.isArray(Engine.state.squad)),
    };
  });
  localStorage.removeItem('dt-simulador-save-v3');
  return r;
});

// ---------- fechaDeJuegoDeLaTemporada (el hallazgo del Bloque 0) ----------
const hallazgoB0 = await page.evaluate(() => {
  window.__carrera('boca');
  const s = Engine.state;
  const medir = (temporada, dayCount) => {
    s.season.year = temporada;
    s.calendar.dayCount = dayCount;
    const hoy = Engine.fechaDelJuego();
    const t1 = Engine.fechaDeJuegoDeLaTemporada(1);
    return { temporada, dayCount, hoy: `${hoy.dia}/${hoy.mes + 1}/${hoy.anio}`, dice: `${t1.dia}/${t1.mes + 1}/${t1.anio}` };
  };
  return {
    // Dentro del año el cálculo es correcto.
    dentroDelAnio: [medir(1, 100), medir(3, 100), medir(5, 100)],
    // Pasado el 31 de diciembre, fechaDelJuego avanza el año pero
    // fechaDeJuegoDeLaTemporada resta temporadas sobre el año ya avanzado.
    cruzandoElAnio: [medir(1, 400), medir(3, 400), medir(5, 400)],
    largoDeLaTemporada: 'una temporada normal termina antes de diciembre',
  };
});

// ---------- Cumpleaños en las fechas de borde ----------
const cumpleanios = await page.evaluate(() => {
  window.__carrera('boca');
  const s = Engine.state;
  const casos = ['2000-02-28', '2000-02-29', '2000-04-30', '2000-12-31'];
  const r = {};
  casos.forEach((birthDate) => {
    const j = { birthDate };
    const edades = [];
    // Se recorre un año entero día por día y se anota cada vez que sube.
    s.season.year = 3; // 2028, bisiesto
    let subidas = 0;
    let anterior = null;
    for (let d = 0; d <= 365; d++) {
      s.calendar.dayCount = d;
      const e = Engine.edadDe(j);
      if (anterior != null && e !== anterior) { subidas++; edades.push(`día ${d}: ${anterior} -> ${e}`); }
      anterior = e;
    }
    r[birthDate] = { subidasEnElAnio: subidas, cuando: edades.join(', ') || '(no subió)' };
  });
  return r;
});

// ---------- El soak multitemporada ----------
const soak = { temporadas: [], fallos: [], final: 'completo' };
await page.evaluate((c) => window.__carrera(c), CLUB);
for (let t = 0; t < TEMPORADAS; t++) {
  const paso = await page.evaluate((n) => {
    const antes = {
      temporada: Engine.state.season.year,
      dayCount: Engine.state.calendar.dayCount,
      jugadoresPropios: Engine.state.squad.length,
      retirados: (Engine.state.retirados || []).length,
    };
    const r = window.__jugarUnaTemporada();
    if (!r.ok) return { corte: r.motivo, antes };
    const fallos = window.__invariantes(Engine.state.season.year, 'al cerrar la temporada');
    const s = Engine.state;
    const sum = s.lastSeasonSummary || {};
    const resumen = {
      temporada: s.season.year,
      diasJugados: s.calendar.dayCount,
      plantel: s.squad.length,
      retiradosAcumulados: (s.retirados || []).length,
      descendieron: (sum.relegated || []).join(', ') || '-',
      ascendieron: (sum.promoted || []).join(', ') || '-',
      campeonCopaArg: sum.copaChampionName || '-',
      copas: (sum.copasInternacionales || []).map((c) => `${c.nombre || c.copa}: ${c.campeonNombre || c.campeon || '?'}`).join(' | ') || '-',
      lesionados: s.squad.filter((p) => p.out && p.out.reason === 'lesión').length,
      suspendidos: s.squad.filter((p) => p.out && p.out.reason === 'suspensión').length,
      fallos: fallos.length,
    };
    if (!sum.carreraTerminada) Engine.startNewSeason();
    return { antes, resumen, fallos, carreraTerminada: !!sum.carreraTerminada };
  }, t);
  if (paso.corte) { soak.final = paso.corte; break; }
  soak.temporadas.push(paso.resumen);
  soak.fallos.push(...paso.fallos);
  if (paso.carreraTerminada) { soak.final = 'la carrera terminó (descenso a la tercera)'; break; }
}

// ---------- Guardar y cargar DESPUÉS del soak ----------
const despuesDelSoak = await page.evaluate(() => {
  const antes = JSON.parse(JSON.stringify(Engine.state));
  Engine.save();
  const cargo = Engine.load();
  const d = Engine.state;
  const difs = [];
  const comparar = (ruta, a, b, prof) => {
    if (prof > 7 || difs.length > 10) return;
    if (a && typeof a === 'object') {
      Object.keys(a).forEach((k) => comparar(`${ruta}.${k}`, a[k], (b || {})[k], prof + 1));
      return;
    }
    if (a !== b) difs.push(`${ruta}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  };
  comparar('state', antes, d, 0);
  // Y que después de cargar se pueda seguir jugando.
  const siguio = window.__jugarUnaTemporada();
  const fallos = window.__invariantes(Engine.state.season.year, 'después de recargar y jugar otra');
  return {
    cargo,
    diferencias: difs,
    pesoDelSave: Math.round(JSON.stringify(d).length / 1024) + ' KB',
    siguioJugando: siguio.ok ? 'sí' : siguio.motivo,
    fallos,
  };
});

// ---------- Informe ----------
const linea = (t) => console.log(t);
linea('\n================ AUDITORÍA BLOQUE 1 ================\n');

linea('--- 1. GUARDADO Y CARGA ---');
linea(`  load() devolvió: ${guardadoYCarga.detalle.cargo} · save de ${guardadoYCarga.detalle.pesoDelSave}`);
Object.entries(guardadoYCarga.detalle).forEach(([k, v]) => { if (k !== 'cargo' && k !== 'pesoDelSave') linea(`  ${k}: ${v}`); });
linea(`  diferencias antes/después: ${guardadoYCarga.problemas.length}`);
guardadoYCarga.problemas.slice(0, 15).forEach((p) => linea(`    · ${p}`));

linea('\n--- 2. SAVES CORRUPTOS ---');
Object.entries(corrupcion).forEach(([nombre, r]) => {
  const bien = !r.aceptado && !r.reventó && r.estadoSano;
  linea(`  ${bien ? '✓' : '✗'} ${nombre}: aceptado=${r.aceptado} reventó=${r.reventó || 'no'} estadoSano=${r.estadoSano}`);
});

linea('\n--- 3. fechaDeJuegoDeLaTemporada (hallazgo del Bloque 0) ---');
linea('  Dentro del año:');
hallazgoB0.dentroDelAnio.forEach((x) => linea(`    temporada ${x.temporada}, día ${x.dayCount}: hoy=${x.hoy} · dice que la temporada 1 era ${x.dice}`));
linea('  Cruzando el 31 de diciembre (día 400):');
hallazgoB0.cruzandoElAnio.forEach((x) => linea(`    temporada ${x.temporada}, día ${x.dayCount}: hoy=${x.hoy} · dice que la temporada 1 era ${x.dice}`));

linea('\n--- 4. CUMPLEAÑOS EN FECHAS DE BORDE (año bisiesto 2028) ---');
Object.entries(cumpleanios).forEach(([f, r]) => linea(`  ${f}: sube ${r.subidasEnElAnio} vez/veces · ${r.cuando}`));

linea('\n--- 5. SOAK MULTITEMPORADA ---');
linea(`  final: ${soak.final} · temporadas completadas: ${soak.temporadas.length}`);
console.table(soak.temporadas);

linea('\n--- 6. GUARDADO DESPUÉS DEL SOAK ---');
linea(`  load() devolvió: ${despuesDelSoak.cargo} · save de ${despuesDelSoak.pesoDelSave}`);
linea(`  diferencias: ${despuesDelSoak.diferencias.length}`);
despuesDelSoak.diferencias.forEach((d) => linea(`    · ${d}`));
linea(`  siguió jugando después de recargar: ${despuesDelSoak.siguioJugando}`);

const todos = soak.fallos.concat(despuesDelSoak.fallos || []);
linea('\n--- 7. INVARIANTES ROTOS ---');
if (!todos.length) {
  linea('  ninguno: todas las comprobaciones pasaron en todas las temporadas');
} else {
  const porTipo = {};
  todos.forEach((f) => {
    const clave = `${f.sistema} :: ${f.que}`;
    (porTipo[clave] = porTipo[clave] || []).push(f);
  });
  Object.entries(porTipo).sort((a, b) => b[1].length - a[1].length).forEach(([clave, lista]) => {
    linea(`  ✗ ${clave} — ${lista.length} caso(s)`);
    lista.slice(0, 4).forEach((f) => linea(`      temporada ${f.temporada} (${f.cuando}): ${f.detalle}`));
    if (lista.length > 4) linea(`      ... y ${lista.length - 4} más`);
  });
}

linea('\n--- 8. ERRORES DE PÁGINA / CONSOLA ---');
linea(erroresDePagina.length ? erroresDePagina.slice(0, 10).map((e) => '  ' + e).join('\n') : '  ninguno');

linea('\n====================================================\n');
await navegador.close();
// La auditoría NO falla el proceso: su trabajo es informar, no bloquear.
process.exit(0);
