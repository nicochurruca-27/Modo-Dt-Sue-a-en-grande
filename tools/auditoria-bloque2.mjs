// AUDITORÍA DEL BLOQUE 2 — mercado de pases y movimientos de jugadores.
//
//     npm install --no-save playwright
//     node tools/auditoria-bloque2.mjs [temporadasDelSoak] [club]
//
// SOLO DIAGNÓSTICO. No modifica una línea del juego.
//
// ---------- Cómo funciona el sistema, según el código ----------
//
// La pertenencia de un jugador a un club se representa de TRES maneras
// distintas, y entender eso es la clave de toda la auditoría:
//
//   1. TU CLUB: `state.squad`, un array de jugadores completos que se guarda
//      en la partida. Es el único plantel que existe de verdad en el estado.
//
//   2. LOS CLUBES RIVALES: no se guardan. `Mercado.plantel(engine, clubId)`
//      los RECONSTRUYE cada vez que se los pide, a partir de:
//        · una semilla fija (el id del club), que da el plantel base;
//        · `state.mundo[clubId] = { fuera: [ids], dentro: [jugadores] }`,
//          que es la DIFERENCIA guardada contra esa semilla.
//      El plantel que ves es: base − fuera + dentro, más reposición.
//
//   3. LOS CEDIDOS: `state.cedidos`, jugadores tuyos que están a préstamo.
//      Salen de `state.squad` y NO entran al plantel del club que los tomó:
//      mientras dura el préstamo no están en ningún plantel del mundo.
//
// Y hay tres clases de id, que se comportan distinto:
//
//   `clubId-rN`      jugador de un plantel investigado (los 30 de Primera).
//                    N es el índice dentro de REAL_ROSTERS: estable.
//   `clubId-gN`      jugador sembrado de un club sin plantel investigado.
//                    N es el índice dentro de SQUAD_POSITIONS: estable.
//   `clubId-cAÑO-N`  relleno que se agrega cuando un club generado se queda
//                    corto. N es `vivos.length` EN ESE MOMENTO, y AÑO es la
//                    temporada en curso. Acá está casi todo lo que sigue.
//
// Las funciones que mueven jugadores:
//   Mercado.transferir(s, j, de, a, anio)   anota en fuera/dentro
//   Mercado.liberarJugadores(engine)        saca gente y la deja libre
//   Mercado.mercadoDeLosRivales(engine)     los rivales se compran entre sí
//   Mercado.concretarAcuerdo(engine, a)     tu compra se concreta
//   Engine.resolverOferta(aceptar)          te compran a vos
//   Engine.cederJugador(oferta)             prestás un jugador
//   Engine.revisarPrestamos()               vuelven los cedidos
//   Engine.ficharLibre(i)                   fichás a uno sin club
//   Engine.rescindirContrato(id)            lo soltás vos
//   Engine.procesarRetiros()                cuelgan los botines

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEMPORADAS = Number(process.argv[2] || 15);
const CLUB = process.argv[3] || 'aldosivi';

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await navegador.newPage();
const erroresDePagina = [];
page.on('pageerror', (e) => erroresDePagina.push(String(e)));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/La partida guardada/.test(t)) erroresDePagina.push('console: ' + t);
});
await page.goto('file://' + path.join(raiz, 'index.html'));
await page.waitForFunction(() => typeof Juveniles !== 'undefined');

await page.evaluate(() => {
  window.__carrera = (c) => {
    localStorage.removeItem('dt-simulador-save-v3');
    Engine.createDT('Nico', 'ARG', 'equilibrado');
    Engine.newGame(c || 'boca');
    Engine.continueFromPresentation(0);
    Engine._fuerzas = {};
  };
  window.__temporada = () => {
    let v = 0;
    while (v++ < 60000) {
      const s = Engine.state;
      // El soak audita el MERCADO, no el sistema de despidos. Sin esto, un
      // piloto automático que no piensa nada termina echado a las dos o tres
      // temporadas y el mundo deja de moverse, que es justo lo que hay que
      // observar. Instrumentación de la prueba sobre el estado en memoria:
      // no toca una línea del juego.
      if (window.__sostenerConfianza) s.confianza = 80;
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
        case 'season-end': return 'ok';
        default: return 'cortó en ' + s.screen;
      }
    }
    return 'sin vueltas';
  };

  // La clase de id de un jugador, que es como hay que separar los resultados.
  window.__clase = (id) => {
    if (/-r\d+$/.test(id)) return 'real';
    if (/-g\d+$/.test(id)) return 'sembrado';
    if (/-c\d+$/.test(id)) return 'relleno';
    if (/^p\d+$/.test(id)) return 'tuyo-inicial';
    return 'otro';
  };

  // El censo completo del mundo: quién está dónde, de qué clase es, y qué
  // está mal. Es la pieza central de la auditoría.
  window.__censo = () => {
    const s = Engine.state;
    const dueño = new Map();
    const porClase = { real: 0, sembrado: 0, relleno: 0, 'tuyo-inicial': 0, otro: 0 };
    const dobles = [];
    const mirar = (clubId, plantel) => {
      plantel.forEach((p) => {
        porClase[window.__clase(p.id)] = (porClase[window.__clase(p.id)] || 0) + 1;
        if (dueño.has(p.id) && dueño.get(p.id) !== clubId) {
          dobles.push({ id: p.id, clase: window.__clase(p.id), nombre: p.name, clubes: [dueño.get(p.id), clubId] });
        }
        dueño.set(p.id, clubId);
      });
    };
    mirar(s.clubId, s.squad || []);
    s.clubs.forEach((c) => { if (c.id !== s.clubId) mirar(c.id, Mercado.plantel(Engine, c.id)); });

    // Los que deberían estar afuera y siguen adentro.
    const retirados = new Set((s.retirados || []).map((r) => r.id));
    const libres = new Set((s.libres || []).map((j) => j.id));
    const cedidos = new Set((s.cedidos || []).map((c) => c.jugador.id));
    // Un retirado se anota al CERRAR la temporada y la juega entera: eso es el
    // diseño del Bloque 0 y no es un fantasma. El fantasma de verdad es el que
    // se retiró en una temporada ANTERIOR y sigue en un plantel. Se separan.
    const temporadaDeRetiro = new Map((s.retirados || []).map((r) => [r.id, r.temporada]));
    const fantasmas = { retiradosActivos: [], retiradosArrastrados: [], libresEnUnClub: [], cedidosEnUnClub: [] };
    dueño.forEach((clubId, id) => {
      if (retirados.has(id)) {
        const t = temporadaDeRetiro.get(id);
        const donde = `${id} en ${clubId} (se retiró en T${t})`;
        if (t != null && t < (s.season.year || 1)) fantasmas.retiradosArrastrados.push(donde);
        else fantasmas.retiradosActivos.push(donde);
      }
      if (libres.has(id)) fantasmas.libresEnUnClub.push(`${id} en ${clubId}`);
      if (cedidos.has(id)) fantasmas.cedidosEnUnClub.push(`${id} en ${clubId}`);
    });

    // Los que el mundo dice que se fueron de un club pero siguen ahí.
    const fueraPeroSiguen = [];
    Object.entries(s.mundo || {}).forEach(([clubId, mov]) => {
      if (clubId === s.clubId) return;
      const pl = Mercado.plantel(Engine, clubId);
      (mov.fuera || []).forEach((id) => {
        if (pl.some((p) => p.id === id)) fueraPeroSiguen.push({ id, clase: window.__clase(id), club: clubId });
      });
    });

    // Los que el mundo dice que llegaron a un club y no están.
    const dentroPeroNoEstan = [];
    Object.entries(s.mundo || {}).forEach(([clubId, mov]) => {
      if (clubId === s.clubId) return;
      const pl = Mercado.plantel(Engine, clubId);
      (mov.dentro || []).forEach((j) => {
        if (pl.some((p) => p.id === j.id)) return;
        // No alcanza con contar: un "llegó y no está" puede ser historial
        // legítimo (llegó y después se fue) o una incoherencia de verdad.
        // Sin el motivo, el número no dice nada.
        let motivo = 'SIN EXPLICACIÓN';
        if ((mov.fuera || []).includes(j.id)) motivo = 'después se fue de ese club (está en `fuera`)';
        else if (retirados.has(j.id)) motivo = 'se retiró (anotado en state.retirados)';
        // Un transferido que se retira queda ausente del plantel pero NO se
        // anota en `state.retirados`: `procesarRetiros` cuenta los retiros de
        // los rivales leyendo REAL_ROSTERS y salteando a los que están en el
        // `fuera` de ese club, así que al transferido no lo cuenta nadie. La
        // ausencia es correcta —es el arreglo de B2-02 haciendo su trabajo—, y
        // lo que falta es el asiento contable. Se pregunta por la edad, que es
        // la misma regla que aplica `plantel()`.
        else if (Engine.yaSeRetiro(Mercado.jugadorFichado(Engine, j, s.season.year))) {
          motivo = 'se retiró (sin asiento en state.retirados — ver hallazgo)';
        }
        else if (cedidos.has(j.id)) motivo = 'está cedido';
        else if (libres.has(j.id)) motivo = 'quedó libre';
        else if ((s.squad || []).some((p) => p.id === j.id)) motivo = 'lo fichaste vos';
        else if (dueño.has(j.id)) motivo = `está en otro club (${dueño.get(j.id)})`;
        dentroPeroNoEstan.push({ id: j.id, clase: window.__clase(j.id), club: clubId, motivo });
      });
    });

    return {
      jugadores: dueño.size,
      porClase,
      dobles,
      fantasmas,
      fueraPeroSiguen,
      dentroPeroNoEstan,
      cedidos: (s.cedidos || []).length,
      libres: (s.libres || []).length,
      retirados: (s.retirados || []).length,
      movimientos: Object.values(s.mundo || {}).reduce((a, m) => a + m.fuera.length + m.dentro.length, 0),
    };
  };

  window.__dondeEsta = (id) => {
    const s = Engine.state;
    const donde = [];
    if ((s.squad || []).some((p) => p.id === id)) donde.push(s.clubId);
    s.clubs.forEach((c) => {
      if (c.id === s.clubId) return;
      if (Mercado.plantel(Engine, c.id).some((p) => p.id === id)) donde.push(c.id);
    });
    return donde;
  };
});

const pruebas = [];
const probar = async (area, nombre, fn, arg) => {
  try {
    const r = await page.evaluate(fn, arg);
    pruebas.push({ area, nombre, ...r });
  } catch (e) {
    pruebas.push({ area, nombre, ok: false, detalle: `reventó: ${e.message}` });
  }
};

// ================================================================
// 3. LOS IDS DEL RELLENO DE LA NACIONAL — las 12 preguntas del pedido
// ================================================================

const relleno = await page.evaluate(() => {
  const r = {};
  window.__carrera('boca');
  const s = Engine.state;
  const club = s.clubs.find((c) => c.division === 'D2' && !REAL_ROSTERS[c.id]).id;
  r.clubDePrueba = club;

  // (1) (2) (3) ¿cuándo se generan y se rehacen en cada llamada?
  const a = Mercado.plantel(Engine, club).map((p) => p.id);
  const b = Mercado.plantel(Engine, club).map((p) => p.id);
  r['1-3. dos llamadas seguidas dan lo mismo'] = a.join() === b.join();
  r['1-3. composición del plantel'] = {
    total: a.length,
    sembrados: a.filter((x) => /-g\d+$/.test(x)).length,
    relleno: a.filter((x) => /-c\d+$/.test(x)).length,
    ejemploDeRelleno: a.find((x) => /-c\d+$/.test(x)),
  };

  // (7) ¿qué pasa al cambiar de temporada?
  const porTemporada = {};
  for (let t = 1; t <= 4; t++) {
    s.season.year = t; Engine._fuerzas = {};
    const ids = Mercado.plantel(Engine, club).map((p) => p.id);
    porTemporada[`T${t}`] = ids.filter((x) => /-c\d+$/.test(x));
  }
  r['7. el relleno temporada por temporada'] = porTemporada;
  const t1 = new Set(porTemporada.T1);
  r['7. ¿sobrevive algún jugador de relleno de T1 a T2?'] = porTemporada.T2.some((x) => t1.has(x));

  // (4) (5) (6) interacción con movimientos.fuera
  s.season.year = 1; Engine._fuerzas = {};
  const antes = Mercado.plantel(Engine, club);
  const j = antes.find((p) => /-c\d+$/.test(p.id));
  Mercado.transferir(s, j, club, 'lanus', 1);
  Engine._fuerzas = {};
  r['4-5. transferido: ¿sigue en el origen?'] = Mercado.plantel(Engine, club).some((p) => p.id === j.id);
  r['4-5. transferido: ¿llegó al destino?'] = Mercado.plantel(Engine, 'lanus').some((p) => p.id === j.id);
  r['4-5. el fuera del club de origen'] = Mercado.movimientosDe(s, club).fuera.slice();
  // ¿Es el MISMO jugador, o uno nuevo con el mismo id?
  const enOrigen = Mercado.plantel(Engine, club).find((p) => p.id === j.id);
  const enDestino = Mercado.plantel(Engine, 'lanus').find((p) => p.id === j.id);
  r['11. ¿dos jugadores distintos con el mismo id?'] = enOrigen && enDestino
    ? { mismoNombre: enOrigen.name === enDestino.name, origen: `${enOrigen.name} ${enOrigen.rating}`, destino: `${enDestino.name} ${enDestino.rating}` }
    : 'no se dio el caso';

  // (6) transferirlo otra vez
  if (enDestino) {
    Mercado.transferir(s, enDestino, 'lanus', 'talleres', 1);
    Engine._fuerzas = {};
    r['6. tras la segunda transferencia, dónde está'] = window.__dondeEsta(j.id);
  }

  // (8) (9) ascenso y descenso
  window.__carrera('boca');
  const s2 = Engine.state;
  const club2 = s2.clubs.find((c) => c.division === 'D2' && !REAL_ROSTERS[c.id]);
  const antesDeSubir = Mercado.plantel(Engine, club2.id).map((p) => p.id);
  club2.division = 'D1';
  Engine._fuerzas = {};
  const despuesDeSubir = Mercado.plantel(Engine, club2.id).map((p) => p.id);
  club2.division = 'D2';
  Engine._fuerzas = {};
  r['8-9. al cambiar de división'] = {
    antes: antesDeSubir.length,
    despues: despuesDeSubir.length,
    losMismos: antesDeSubir.join() === despuesDeSubir.join(),
    cambiaron: antesDeSubir.filter((x) => !despuesDeSubir.includes(x)).slice(0, 4),
  };

  // (10) guardar y cargar
  window.__carrera('boca');
  const s3 = Engine.state;
  const club3 = s3.clubs.find((c) => c.division === 'D2' && !REAL_ROSTERS[c.id]).id;
  const antesDeGuardar = Mercado.plantel(Engine, club3).map((p) => `${p.id}:${p.name}:${p.rating}`);
  Engine.save(); Engine.load(); Engine._fuerzas = {};
  const despuesDeCargar = Mercado.plantel(Engine, club3).map((p) => `${p.id}:${p.name}:${p.rating}`);
  r['10. guardar y cargar'] = {
    iguales: antesDeGuardar.join() === despuesDeCargar.join(),
    ejemploAntes: antesDeGuardar.slice(0, 2),
    ejemploDespues: despuesDeCargar.slice(0, 2),
  };

  // (12) ¿puede reaparecer en su club original?
  window.__carrera('boca');
  const s4 = Engine.state;
  const club4 = s4.clubs.find((c) => c.division === 'D2' && !REAL_ROSTERS[c.id]).id;
  const pl4 = Mercado.plantel(Engine, club4);
  const j4 = pl4.find((p) => /-c\d+$/.test(p.id));
  Mercado.transferir(s4, j4, club4, 'river', 1);
  Engine._fuerzas = {};
  r['12. reaparece en el club original'] = window.__dondeEsta(j4.id);

  // Y el mismo experimento con un jugador SEMBRADO (-gN), para separar
  // claramente qué clase de id tiene el problema.
  window.__carrera('boca');
  const s5 = Engine.state;
  const club5 = s5.clubs.find((c) => c.division === 'D2' && !REAL_ROSTERS[c.id]).id;
  const j5 = Mercado.plantel(Engine, club5).find((p) => /-g\d+$/.test(p.id));
  Mercado.transferir(s5, j5, club5, 'river', 1);
  Engine._fuerzas = {};
  r['control. un jugador sembrado (-gN) transferido'] = window.__dondeEsta(j5.id);
  return r;
});

// ================================================================
// 4. TRANSFERENCIAS
// ================================================================

await probar('transferencias', 'A -> B simple, con las tres clases de id', () => {
  const casos = [];
  ['real', 'sembrado', 'relleno'].forEach((clase) => {
    window.__carrera('boca');
    const s = Engine.state;
    const origen = clase === 'real' ? 'estudianteslp'
      : s.clubs.find((c) => c.division === 'D2' && !REAL_ROSTERS[c.id]).id;
    const pl = Mercado.plantel(Engine, origen);
    const j = pl.find((p) => window.__clase(p.id) === clase);
    if (!j) { casos.push(`${clase}: no se encontró`); return; }
    Mercado.transferir(s, j, origen, 'river', 1);
    Engine._fuerzas = {};
    const donde = window.__dondeEsta(j.id);
    casos.push(`${clase} (${j.id}): ${donde.join('+') || 'en ningún club'}${donde.length === 1 && donde[0] === 'river' ? ' OK' : ' MAL'}`);
  });
  return { ok: casos.every((c) => c.includes('OK')), detalle: casos.join(' · ') };
});

await probar('transferencias', 'Cadena A->B->C->D->E con un jugador real', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const cadena = ['estudianteslp', 'argentinos', 'quilmes', 'lanus', 'talleres'];
  let j = Mercado.plantel(Engine, cadena[0]).find((p) => /-r\d+$/.test(p.id));
  const id = j.id;
  for (let i = 0; i < cadena.length - 1; i++) {
    Mercado.transferir(s, j, cadena[i], cadena[i + 1], 1);
    Engine._fuerzas = {};
    j = Mercado.plantel(Engine, cadena[i + 1]).find((x) => x.id === id);
    if (!j) return { ok: false, detalle: `se perdió al llegar a ${cadena[i + 1]}` };
  }
  const donde = window.__dondeEsta(id);
  return { ok: donde.length === 1 && donde[0] === 'talleres', detalle: `${id}: ${donde.join('+')}` };
});

await probar('transferencias', 'Primera -> Nacional y Nacional -> Primera', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const nacional = s.clubs.find((c) => c.division === 'D2' && !REAL_ROSTERS[c.id]).id;
  // Primera -> Nacional
  const a = Mercado.plantel(Engine, 'racing').find((p) => /-r\d+$/.test(p.id));
  Mercado.transferir(s, a, 'racing', nacional, 1);
  Engine._fuerzas = {};
  const d1aD2 = window.__dondeEsta(a.id);
  // Nacional -> Primera, con un sembrado
  const b = Mercado.plantel(Engine, nacional).find((p) => /-g\d+$/.test(p.id));
  Mercado.transferir(s, b, nacional, 'velez', 1);
  Engine._fuerzas = {};
  const d2aD1 = window.__dondeEsta(b.id);
  return {
    ok: d1aD2.length === 1 && d1aD2[0] === nacional && d2aD1.length === 1 && d2aD1[0] === 'velez',
    detalle: `Primera->Nacional: ${d1aD2.join('+')} · Nacional->Primera: ${d2aD1.join('+')}`,
  };
});

await probar('transferencias', 'El mismo jugador real transferido en temporadas distintas', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const clubes = ['newells', 'gimnasialp', 'atleticotucuman', 'aldosivi'];
  // Tiene que ser un jugador JOVEN. La primera versión de esta prueba agarraba
  // el primero de la lista —Gabriel Arias, 38 años— y lo esperaba vivo cuatro
  // temporadas después. Eso solo pasaba porque el transferido no se retiraba
  // nunca (B2-02): con el retiro arreglado, Arias cuelga los botines al cerrar
  // la T2 y es correcto que no esté. Lo que esta prueba mide es el PASE en
  // temporadas distintas, no el retiro, así que se elige a alguien que llegue
  // entero al final del recorrido.
  const candidatos = Mercado.plantel(Engine, clubes[0])
    .filter((p) => /-r\d+$/.test(p.id)
      && Engine.edadAlCierreDeTemporada(p, clubes.length) <= Engine.EDAD_DE_RETIRO);
  let j = candidatos.slice().sort((a, b) => Engine.edadDe(a) - Engine.edadDe(b))[0];
  if (!j) return { ok: false, detalle: 'no se encontró un jugador joven en newells' };
  const id = j.id;
  const traza = [];
  for (let i = 0; i < clubes.length - 1; i++) {
    Mercado.transferir(s, j, clubes[i], clubes[i + 1], s.season.year);
    s.season.year += 1;
    Engine._fuerzas = {};
    traza.push(`T${s.season.year}: ${window.__dondeEsta(id).join('+')}`);
    j = Mercado.plantel(Engine, clubes[i + 1]).find((x) => x.id === id);
    if (!j) return { ok: false, detalle: `se perdió: ${traza.join(' | ')}` };
  }
  return { ok: window.__dondeEsta(id).length === 1, detalle: traza.join(' | ') };
});

// ================================================================
// 5. VENTAS, LIBERACIONES Y RETIROS
// ================================================================

await probar('ventas', 'Un jugador liberado no sigue en su club', () => {
  window.__carrera('boca');
  Mercado.liberarJugadores(Engine);
  Engine._fuerzas = {};
  const libres = Engine.state.libres || [];
  const malos = libres.filter((j) => window.__dondeEsta(j.id).length);
  return {
    ok: !malos.length,
    detalle: malos.length ? `${malos.length} de ${libres.length} libres siguen en un club: ${malos.slice(0, 3).map((j) => `${j.id} en ${window.__dondeEsta(j.id).join('+')}`).join(' · ')}`
      : `${libres.length} jugadores libres, ninguno sigue en un club`,
  };
});

await probar('ventas', 'Un jugador libre fichado por vos sale de la lista de libres', () => {
  window.__carrera('boca');
  Mercado.liberarJugadores(Engine);
  const antes = (Engine.state.libres || []).length;
  if (!antes) return { ok: true, detalle: 'no había libres para probar' };
  const elegido = Engine.jugadoresLibres()[0];
  const fichado = Engine.ficharLibre(0);
  const enPlantel = Engine.state.squad.some((p) => p.id === elegido.id);
  const sigueLibre = (Engine.state.libres || []).some((j) => j.id === elegido.id);
  const enOtroClub = window.__dondeEsta(elegido.id).filter((c) => c !== Engine.state.clubId);
  return {
    ok: fichado !== false && enPlantel && !sigueLibre && !enOtroClub.length,
    detalle: `${elegido.name}: fichado=${fichado !== false}, en tu plantel=${enPlantel}, sigue en libres=${sigueLibre}, en otro club=${enOtroClub.join('+') || 'no'}`,
  };
});

await probar('ventas', 'Un jugador que te compran sale de tu plantel y entra al del comprador', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const mio = s.squad.find((p) => p.pos !== 'POR');
  s.ofertasRecibidas = [{ playerId: mio.id, monto: 5000000, club: { id: 'river', nombre: 'River Plate' } }];
  Engine.resolverOferta(true);
  Engine._fuerzas = {};
  const donde = window.__dondeEsta(mio.id);
  return {
    ok: !s.squad.some((p) => p.id === mio.id) && donde.length === 1 && donde[0] === 'river',
    detalle: `${mio.name}: ${donde.join('+') || 'en ningún club'}`,
  };
});

await probar('ventas', 'Un jugador rescindido queda libre y no en su club', () => {
  window.__carrera('boca');
  const s = Engine.state;
  s.budget = 999999999;
  const j = s.squad.filter((p) => p.pos !== 'POR')[5];
  const r = Engine.rescindirContrato(j.id);
  Engine._fuerzas = {};
  const donde = window.__dondeEsta(j.id);
  const enLibres = (s.libres || []).some((x) => x.id === j.id);
  return {
    ok: r.ok && !donde.length && enLibres,
    detalle: `${j.name}: rescindido=${r.ok}, en algún club=${donde.join('+') || 'no'}, en la lista de libres=${enLibres}`,
  };
});

await probar('ventas', 'Un retirado no sobrevive a la temporada siguiente', () => {
  // Ojo con el matiz, que la primera versión de esta prueba leía mal: un
  // jugador se anota en `retirados` al CERRAR la temporada y juega esa
  // temporada entera. Eso es el diseño del Bloque 0 ("el que pasó la edad
  // cuelga los botines al cerrar"). Lo que sería un bug es que siga apareciendo
  // en la temporada SIGUIENTE, y eso es lo que se mide acá.
  window.__carrera('boca');
  const s = Engine.state;
  const arrastrados = [];
  const deEstaTemporada = [];
  for (let t = 1; t <= 10; t++) {
    s.season.year = t; Engine._fuerzas = {};
    Engine.procesarRetiros();
    Engine._fuerzas = {};
    (s.retirados || []).forEach((r) => {
      if (r.clubId === s.clubId) return;
      if (!Mercado.plantel(Engine, r.clubId).some((x) => x.id === r.id)) return;
      if (r.temporada < t) arrastrados.push(`T${t}: ${r.id} se había retirado en T${r.temporada}`);
      else deEstaTemporada.push(r.id);
    });
  }
  return {
    ok: !arrastrados.length,
    detalle: arrastrados.length ? arrastrados.slice(0, 3).join(' · ')
      : `10 temporadas: ${deEstaTemporada.length} juegan su última temporada (por diseño) y NINGUNO se arrastra a la siguiente`,
  };
});

// ================================================================
// 6. PRÉSTAMOS
// ================================================================

await probar('préstamos', 'El modelo: el cedido sale de tu plantel y no entra en el del otro club', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = s.squad.find((p) => p.pos !== 'POR');
  const ok = Engine.cederJugador({ playerId: j.id, club: { id: 'lanus', nombre: 'Lanús' }, modalidad: 'simple', modalidadLabel: 'Préstamo simple', ventanas: 2 });
  Engine._fuerzas = {};
  const donde = window.__dondeEsta(j.id);
  const enCedidos = (s.cedidos || []).some((c) => c.jugador.id === j.id);
  return {
    ok: ok && !donde.length && enCedidos,
    detalle: `${j.name}: cedido=${ok}, en algún plantel=${donde.join('+') || 'no (vive solo en state.cedidos)'}, en cedidos=${enCedidos}`,
  };
});

await probar('préstamos', 'El cedido vuelve a tu plantel cuando se cumple el plazo', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = s.squad.find((p) => p.pos !== 'POR');
  Engine.cederJugador({ playerId: j.id, club: { id: 'lanus', nombre: 'Lanús' }, modalidad: 'simple', modalidadLabel: 'simple', ventanas: 2 });
  const notas1 = Engine.revisarPrestamos();
  const traasUna = s.squad.some((p) => p.id === j.id);
  const notas2 = Engine.revisarPrestamos();
  const trasDos = s.squad.some((p) => p.id === j.id);
  return {
    ok: !traasUna && trasDos && (s.cedidos || []).length === 0,
    detalle: `tras 1 ventana: en el plantel=${traasUna} · tras 2: ${trasDos} ("${notas2[0] || notas1[0] || 'sin nota'}")`,
  };
});

await probar('préstamos', 'Compra obligatoria: termina en el otro club y en ninguno más', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = s.squad.find((p) => p.pos !== 'POR');
  Engine.cederJugador({ playerId: j.id, club: { id: 'lanus', nombre: 'Lanús' }, modalidad: 'compra-obligatoria', modalidadLabel: 'con compra', ventanas: 1, compra: 3000000 });
  Engine.revisarPrestamos();
  Engine._fuerzas = {};
  const donde = window.__dondeEsta(j.id);
  return {
    ok: donde.length === 1 && donde[0] === 'lanus' && !s.squad.some((p) => p.id === j.id),
    detalle: `${j.name}: ${donde.join('+') || 'en ningún club'}`,
  };
});

await probar('préstamos', 'El préstamo sobrevive a guardar y cargar', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = s.squad.find((p) => p.pos !== 'POR');
  Engine.cederJugador({ playerId: j.id, club: { id: 'lanus', nombre: 'Lanús' }, modalidad: 'simple', modalidadLabel: 'simple', ventanas: 3 });
  const antes = JSON.stringify(Engine.state.cedidos);
  Engine.save(); Engine.load();
  const despues = JSON.stringify(Engine.state.cedidos);
  return { ok: antes === despues && despues !== '[]', detalle: antes === despues ? `el préstamo volvió idéntico (${(Engine.state.cedidos || []).length} cedido)` : 'CAMBIÓ al cargar' };
});

await probar('préstamos', 'El cedido sigue cumpliendo años y vuelve con la edad al día', () => {
  window.__carrera('aldosivi');
  const s = Engine.state;
  const j = s.squad.find((p) => p.pos !== 'POR' && p.birthDate);
  const edadAlSalir = j.age;
  Engine.cederJugador({ playerId: j.id, club: { id: 'lanus', nombre: 'Lanús' }, modalidad: 'simple', modalidadLabel: 'simple', ventanas: 1 });
  s.season.year += 2;
  Engine.refrescarEdades();
  Engine.revisarPrestamos();
  const vuelto = s.squad.find((p) => p.id === j.id);
  return {
    ok: !!vuelto && vuelto.age === Engine.edadDe(vuelto) && vuelto.age > edadAlSalir,
    detalle: vuelto ? `salió con ${edadAlSalir}, volvió con ${vuelto.age} (edadDe dice ${Engine.edadDe(vuelto)})` : 'no volvió',
  };
});

// ================================================================
// 7. CONTRATOS Y ESTADOS IMPOSIBLES
// ================================================================

await probar('contratos', 'Nadie queda libre y en un club a la vez', () => {
  window.__carrera('boca');
  const problemas = [];
  for (let t = 1; t <= 8; t++) {
    Engine.state.season.year = t; Engine._fuerzas = {};
    Mercado.liberarJugadores(Engine);
    Mercado.mercadoDeLosRivales(Engine);
    Engine._fuerzas = {};
    const c = window.__censo();
    if (c.fantasmas.libresEnUnClub.length) problemas.push(`T${t}: ${c.fantasmas.libresEnUnClub.length}`);
  }
  return { ok: !problemas.length, detalle: problemas.length ? `libres que siguen en un club — ${problemas.join(', ')}` : '8 temporadas de mercado: ningún libre sigue en un club' };
});

await probar('contratos', 'Nadie tiene contrato en cero o negativo dentro de un plantel', () => {
  window.__carrera('boca');
  const malos = [];
  for (let t = 1; t <= 8; t++) {
    Engine.state.season.year = t; Engine._fuerzas = {};
    Engine.state.clubs.forEach((c) => {
      if (c.id === Engine.state.clubId) return;
      Mercado.plantel(Engine, c.id).forEach((p) => {
        if (p.contractYears != null && (!Number.isFinite(p.contractYears) || p.contractYears < 1)) {
          malos.push(`T${t} ${p.id}: ${p.contractYears}`);
        }
      });
    });
  }
  return { ok: !malos.length, detalle: malos.length ? malos.slice(0, 4).join(' · ') : '8 temporadas: todos los contratos de los rivales son >= 1' };
});

await probar('contratos', 'Un jugador transferido, ¿se retira alguna vez?', () => {
  // Leyendo plantel() se ve que `yaSeRetiro` filtra SOLO el plantel sembrado
  // (`base`), y que los que llegan por `movimientos.dentro` no pasan por ese
  // filtro. Esto lo comprueba: se transfiere a un veterano y se lo sigue.
  window.__carrera('boca');
  const s = Engine.state;
  const viejo = Mercado.plantel(Engine, 'estudianteslp')
    .filter((p) => p.pos !== 'POR')
    .sort((a, b) => Engine.edadDe(b) - Engine.edadDe(a))[0];
  Mercado.transferir(s, viejo, 'estudianteslp', 'lanus', 1);
  Engine._fuerzas = {};
  const traza = [];
  for (let t = 1; t <= 14; t++) {
    s.season.year = t; Engine._fuerzas = {};
    const enLanus = Mercado.plantel(Engine, 'lanus').find((p) => p.id === viejo.id);
    traza.push(enLanus ? `T${t}:${Engine.edadDe(enLanus)}` : `T${t}:se fue`);
  }
  const ultima = traza[traza.length - 1];
  const edadFinal = Number((ultima.split(':')[1] || '0'));
  return {
    ok: ultima === 'T14:se fue' || edadFinal <= Engine.EDAD_DE_RETIRO + 1,
    detalle: `${viejo.name} (${viejo.id}), transferido con ${Engine.edadDe(viejo)} años: ${traza.join(' ')}`
      + ` — la edad de retiro es ${Engine.EDAD_DE_RETIRO}`,
  };
});

await probar('contratos', 'Al transferirse, ¿el jugador conserva todos sus datos?', () => {
  window.__carrera('boca');
  const s = Engine.state;
  // Un jugador de plantel investigado, que es el que más datos trae.
  const j = Mercado.plantel(Engine, 'river').find((p) => p.altPosDetail && p.altPosDetail.length);
  if (!j) return { ok: true, detalle: 'no se encontró uno con posiciones alternativas' };
  const antes = { altPosDetail: j.altPosDetail, clause: j.clause, salary: j.salary, transferState: j.transferState, number: j.number };
  Mercado.transferir(s, j, 'river', 'lanus', 1);
  Engine._fuerzas = {};
  const d = Mercado.plantel(Engine, 'lanus').find((p) => p.id === j.id);
  const perdidos = Object.keys(antes).filter((k) => antes[k] != null && d && d[k] == null);
  return {
    ok: !perdidos.length,
    detalle: perdidos.length ? `${j.name} pierde al cambiar de club: ${perdidos.join(', ')}` : 'conserva todo',
  };
});

// ================================================================
// 8 y 9. MERCADO <-> PLANTEL, E IDENTIDAD
// ================================================================

await probar('mercado-plantel', 'Todo "anotado como llegado pero ausente" tiene explicación', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const m = Mercado.init(s);
  const clubes = s.clubs.filter((c) => c.id !== s.clubId).map((c) => c.id);
  for (let i = 0; i < 80; i++) {
    const de = clubes[(i * 11) % clubes.length];
    const a = clubes[(i * 23 + 5) % clubes.length];
    if (de === a) continue;
    const pl = Mercado.plantel(Engine, de);
    const j = pl[(i * 5) % pl.length];
    if (j) { Mercado.transferir(s, j, de, a, 1); Engine._fuerzas = {}; }
  }
  const porQue = {};
  let sinExplicacion = 0;
  const ejemplos = [];
  Object.entries(s.mundo || {}).forEach(([clubId, mov]) => {
    const pl = Mercado.plantel(Engine, clubId);
    (mov.dentro || []).forEach((j) => {
      if (pl.some((x) => x.id === j.id)) return;
      let causa;
      if ((mov.fuera || []).includes(j.id)) causa = 'después se fue de ese club (está en `fuera`): es historial, no incoherencia';
      else if (m.fichados.includes(j.id)) causa = 'lo fichaste vos';
      else if ((s.libres || []).some((x) => x.id === j.id)) causa = 'quedó libre';
      else { causa = 'SIN EXPLICACIÓN'; sinExplicacion++; if (ejemplos.length < 3) ejemplos.push(`${j.id} en ${clubId}`); }
      porQue[causa] = (porQue[causa] || 0) + 1;
    });
  });
  return {
    ok: sinExplicacion === 0,
    detalle: Object.entries(porQue).map(([k, n]) => `${n} ${k}`).join(' · ') + (ejemplos.length ? ` — ej: ${ejemplos.join(', ')}` : ''),
  };
});

await probar('mercado-plantel', 'Lo que dice `mundo` coincide con lo que muestra el plantel', () => {
  window.__carrera('boca');
  const s = Engine.state;
  // Se mueven 60 jugadores de todas las clases y después se compara.
  const clubes = s.clubs.filter((c) => c.id !== s.clubId).map((c) => c.id);
  for (let i = 0; i < 60; i++) {
    const de = clubes[(i * 11) % clubes.length];
    const a = clubes[(i * 23 + 5) % clubes.length];
    if (de === a) continue;
    const pl = Mercado.plantel(Engine, de);
    const j = pl[(i * 5) % pl.length];
    if (j) { Mercado.transferir(s, j, de, a, 1); Engine._fuerzas = {}; }
  }
  const c = window.__censo();
  return {
    ok: !c.fueraPeroSiguen.length && !c.dentroPeroNoEstan.length,
    detalle: `anotados como idos pero siguen en el club: ${c.fueraPeroSiguen.length}`
      + ` (${[...new Set(c.fueraPeroSiguen.map((x) => x.clase))].join(',') || '-'})`
      + ` · anotados como llegados pero no están: ${c.dentroPeroNoEstan.length}`
      + ` (${[...new Set(c.dentroPeroNoEstan.map((x) => x.clase))].join(',') || '-'})`,
  };
});

await probar('identidad', 'Los ids son únicos en todo el mundo al arrancar', () => {
  window.__carrera('boca');
  const c = window.__censo();
  return {
    ok: !c.dobles.length,
    detalle: `${c.jugadores} jugadores · ${JSON.stringify(c.porClase)} · duplicados: ${c.dobles.length}`,
  };
});

await probar('identidad', 'Un mismo jugador conserva su id a lo largo de 10 temporadas', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const seguidos = {};
  ['river', 'racing', 'lanus'].forEach((c) => {
    const pl = Mercado.plantel(Engine, c);
    seguidos[c] = { real: pl.find((p) => /-r\d+$/.test(p.id)), total: pl.length };
  });
  const perdidos = [];
  for (let t = 2; t <= 10; t++) {
    s.season.year = t; Engine._fuerzas = {};
    Object.entries(seguidos).forEach(([c, info]) => {
      if (!info.real) return;
      const sigue = Mercado.plantel(Engine, c).some((p) => p.id === info.real.id);
      const retirado = Engine.yaSeRetiro(info.real);
      if (!sigue && !retirado) perdidos.push(`T${t} ${info.real.id} desapareció sin retirarse`);
    });
  }
  return { ok: !perdidos.length, detalle: perdidos.length ? perdidos.slice(0, 3).join(' · ') : 'tres jugadores reales seguidos 10 temporadas: o siguen, o se retiraron' };
});

// ================================================================
// 10. ASCENSOS Y DESCENSOS
// ================================================================

await probar('ascensos', 'Un club que cambia de división no pierde ni duplica jugadores', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const resultados = [];
  // Un club de Primera con plantel investigado que baja.
  const d1 = 'instituto';
  const antesD1 = Mercado.plantel(Engine, d1).map((p) => p.id);
  s.clubs.find((c) => c.id === d1).division = 'D2';
  Engine._fuerzas = {};
  const despuesD1 = Mercado.plantel(Engine, d1).map((p) => p.id);
  s.clubs.find((c) => c.id === d1).division = 'D1';
  const mismos = (a, b) => [...a].sort().join() === [...b].sort().join();
  resultados.push(`${d1} (plantel investigado) al bajar: ${antesD1.length} -> ${despuesD1.length}, ${mismos(antesD1, despuesD1) ? 'los mismos' : 'CAMBIARON'}`);
  // Un club de la Nacional con plantel generado que sube.
  Engine._fuerzas = {};
  const d2 = s.clubs.find((c) => c.division === 'D2' && !REAL_ROSTERS[c.id]).id;
  const antesD2 = Mercado.plantel(Engine, d2).map((p) => p.id);
  s.clubs.find((c) => c.id === d2).division = 'D1';
  Engine._fuerzas = {};
  const despuesD2 = Mercado.plantel(Engine, d2).map((p) => p.id);
  s.clubs.find((c) => c.id === d2).division = 'D2';
  resultados.push(`${d2} (plantel generado) al subir: ${antesD2.length} -> ${despuesD2.length}, ${mismos(antesD2, despuesD2) ? 'los mismos' : 'CAMBIARON'}`);
  // Se compara la MEMBRESÍA, no el orden: la lista sale ordenada por
  // valoración y el orden puede cambiar sin que entre ni salga nadie.
  return {
    ok: mismos(antesD1, despuesD1) && mismos(antesD2, despuesD2),
    detalle: resultados.join(' · ') + ' (se compara quiénes están, no en qué orden)',
  };
});

// ================================================================
// 11. SAVE / LOAD DEL MERCADO
// ================================================================

await probar('save/load', 'Transferir, guardar, cargar: todo igual', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const clubes = ['river', 'racing', 'lanus', 'velez'];
  for (let i = 0; i < 12; i++) {
    const de = clubes[i % clubes.length];
    const a = clubes[(i + 1) % clubes.length];
    const pl = Mercado.plantel(Engine, de);
    const j = pl[i % pl.length];
    if (j) { Mercado.transferir(s, j, de, a, 1); Engine._fuerzas = {}; }
  }
  const foto = () => s.clubs.map((c) => `${c.id}:${(c.id === s.clubId ? s.squad : Mercado.plantel(Engine, c.id)).map((p) => p.id).join(',')}`).join('|');
  const antes = foto();
  const mundoAntes = JSON.stringify(s.mundo);
  Engine.save(); Engine.load(); Engine._fuerzas = {};
  return {
    ok: foto() === antes && JSON.stringify(Engine.state.mundo) === mundoAntes,
    detalle: `planteles ${foto() === antes ? 'idénticos' : 'DISTINTOS'} · mundo ${JSON.stringify(Engine.state.mundo) === mundoAntes ? 'idéntico' : 'DISTINTO'}`,
  };
});

await probar('save/load', 'Transferir, cambiar de temporada, guardar, cargar', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = Mercado.plantel(Engine, 'river').find((p) => /-r\d+$/.test(p.id));
  Mercado.transferir(s, j, 'river', 'lanus', 1);
  s.season.year = 3;
  Engine._fuerzas = {};
  const antes = window.__dondeEsta(j.id).join('+');
  Engine.save(); Engine.load(); Engine._fuerzas = {};
  const despues = window.__dondeEsta(j.id).join('+');
  return { ok: antes === despues && despues === 'lanus', detalle: `antes ${antes} · después ${despues}` };
});

// ================================================================
// 12 y 13. SOAK MULTITEMPORADA
// ================================================================

const soak = { filas: [], incidentes: [], motivos: [], final: 'completo' };
await page.evaluate((c) => { window.__sostenerConfianza = true; window.__carrera(c); }, CLUB);
for (let t = 0; t < TEMPORADAS; t++) {
  const paso = await page.evaluate(() => {
    const r = window.__temporada();
    if (r !== 'ok') return { corte: r };
    const s = Engine.state;
    const c = window.__censo();
    const fila = {
      temporada: s.season.year,
      clubes: s.clubs.length,
      jugadores: c.jugadores,
      real: c.porClase.real,
      sembrado: c.porClase.sembrado,
      relleno: c.porClase.relleno,
      dobles: c.dobles.length,
      ultimaTemporada: c.fantasmas.retiradosActivos.length,
      arrastrados: c.fantasmas.retiradosArrastrados.length,
      fantasmas: c.fantasmas.libresEnUnClub.length + c.fantasmas.cedidosEnUnClub.length,
      idosQueSiguen: c.fueraPeroSiguen.length,
      llegadosAusentes: c.dentroPeroNoEstan.length,
      movimientos: c.movimientos,
      cedidos: c.cedidos,
      libres: c.libres,
      retirados: c.retirados,
    };
    const inc = [];
    c.dobles.forEach((d) => inc.push({ temporada: s.season.year, tipo: 'en dos clubes', clase: d.clase, detalle: `${d.nombre} (${d.id}): ${d.clubes.join(' + ')}` }));
    c.fueraPeroSiguen.forEach((d) => inc.push({ temporada: s.season.year, tipo: 'anotado como ido pero sigue', clase: d.clase, detalle: `${d.id} en ${d.club}` }));
    c.dentroPeroNoEstan.filter((d) => d.motivo === 'SIN EXPLICACIÓN').forEach((d) => inc.push({ temporada: s.season.year, tipo: 'anotado como llegado pero no está, SIN EXPLICACIÓN', clase: d.clase, detalle: `${d.id} en ${d.club}` }));
    const porMotivo = {};
    c.dentroPeroNoEstan.forEach((d) => { porMotivo[d.motivo] = (porMotivo[d.motivo] || 0) + 1; });
    c.fantasmas.retiradosArrastrados.forEach((d) => inc.push({ temporada: s.season.year, tipo: 'retirado ARRASTRADO de una temporada anterior', clase: window.__clase(d.split(' ')[0]), detalle: d }));
    c.fantasmas.libresEnUnClub.forEach((d) => inc.push({ temporada: s.season.year, tipo: 'libre en un club', clase: window.__clase(d.split(' ')[0]), detalle: d }));
    c.fantasmas.cedidosEnUnClub.forEach((d) => inc.push({ temporada: s.season.year, tipo: 'cedido en un club', clase: window.__clase(d.split(' ')[0]), detalle: d }));
    // Clubes y divisiones.
    const ids = s.clubs.map((x) => x.id);
    if (new Set(ids).size !== ids.length) inc.push({ temporada: s.season.year, tipo: 'club duplicado', clase: '-', detalle: 'ids repetidos' });
    s.clubs.forEach((x) => {
      if (x.division !== 'D1' && x.division !== 'D2') inc.push({ temporada: s.season.year, tipo: 'club sin división válida', clase: '-', detalle: `${x.id}: ${x.division}` });
    });
    // Arqueros.
    s.clubs.forEach((x) => {
      const pl = x.id === s.clubId ? s.squad : Mercado.plantel(Engine, x.id);
      if (pl.length && !pl.filter((p) => p.pos === 'POR').length) inc.push({ temporada: s.season.year, tipo: 'club sin arquero', clase: '-', detalle: x.id });
    });
    const sum = s.lastSeasonSummary || {};
    // El soak audita el MERCADO, no el sistema de despidos. Un piloto
    // automático que no piensa nada termina echado a las dos o tres
    // temporadas y el mundo deja de moverse, que es justo lo que hay que
    // observar. Se le sostiene la confianza para que la carrera siga. Esto
    // es instrumentación de la prueba sobre el estado en memoria: no toca
    // una línea del juego.
    s.confianza = 80;
    if (!sum.carreraTerminada) Engine.startNewSeason();
    s.confianza = 80;
    return { fila, inc, motivos: porMotivo, termino: !!sum.carreraTerminada };
  });
  if (paso.corte) { soak.final = paso.corte; break; }
  soak.filas.push(paso.fila);
  soak.incidentes.push(...paso.inc);
  soak.motivos.push({ temporada: soak.filas.length, ...paso.motivos });
  if (paso.termino) { soak.final = 'la carrera terminó'; break; }
}

const trasElSoak = await page.evaluate(() => {
  const antes = JSON.stringify(window.__censo());
  Engine.save();
  const cargo = Engine.load();
  Engine._fuerzas = {};
  return { cargo, igual: JSON.stringify(window.__censo()) === antes };
});

// ---------- El informe ----------
const L = (t) => console.log(t);
L('\n================ AUDITORÍA BLOQUE 2 — MERCADO ================\n');

L('--- 3. LOS IDS DEL RELLENO DE LA NACIONAL (las 12 preguntas) ---');
Object.entries(relleno).forEach(([k, v]) => L(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`));

L('\n--- PRUEBAS POR ÁREA ---');
const porArea = {};
pruebas.forEach((p) => { (porArea[p.area] = porArea[p.area] || []).push(p); });
Object.entries(porArea).forEach(([area, lista]) => {
  const mal = lista.filter((p) => !p.ok).length;
  L(`\n  ${area.toUpperCase()} — ${mal ? `${lista.length - mal}/${lista.length}` : `${lista.length}/${lista.length} OK`}`);
  lista.forEach((p) => {
    L(`    ${p.ok ? '✓' : '✗'} ${p.nombre}`);
    if (p.detalle) L(`        ${p.detalle}`);
  });
});

L(`\n--- 12. SOAK: ${soak.filas.length} temporadas (${soak.final}) ---`);
console.table(soak.filas);

L('\n--- 13a. "ANOTADO COMO LLEGADO PERO NO ESTÁ": EL MOTIVO DE CADA CASO ---');
if (soak.motivos.some((m) => Object.keys(m).length > 1)) console.table(soak.motivos);
else L('  no hubo ni un caso en todo el soak');

L('\n--- 13b. INCIDENTES DEL SOAK, SEPARADOS POR CLASE DE ID ---');
if (!soak.incidentes.length) L('  ninguno');
else {
  const porTipo = {};
  soak.incidentes.forEach((i) => {
    const k = `${i.tipo} · ${i.clase}`;
    (porTipo[k] = porTipo[k] || []).push(i);
  });
  Object.entries(porTipo).sort((a, b) => b[1].length - a[1].length).forEach(([k, lista]) => {
    L(`  ✗ ${k} — ${lista.length} caso(s)`);
    lista.slice(0, 3).forEach((i) => L(`      T${i.temporada}: ${i.detalle}`));
    if (lista.length > 3) L(`      ... y ${lista.length - 3} más`);
  });
}

L(`\n--- 11. GUARDADO DESPUÉS DEL SOAK ---`);
L(`  load()=${trasElSoak.cargo} · el censo del mundo quedó ${trasElSoak.igual ? 'idéntico' : 'DISTINTO'}`);

L(`\n--- ERRORES DE PÁGINA NO PROVOCADOS ---`);
L('  ' + (erroresDePagina.length ? erroresDePagina.slice(0, 5).join('\n  ') : 'ninguno'));
L('\n==============================================================\n');
await navegador.close();
process.exit(0);
