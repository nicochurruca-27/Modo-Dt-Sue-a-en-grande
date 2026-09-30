#!/usr/bin/env python3
"""Convierte los dos CSV de SoFIFA en el bloque REAL_ROSTERS de js/players.js.

    python3 tools/convertir-sofifa.py listado.csv fechas.csv [planteles-viejos.json]

El primero es el listado (valoración, potencial, contratos, dorsal, puestos,
altura, peso, pierna, reputación) y el segundo la fecha de nacimiento exacta,
que en SoFIFA sólo está en la ficha de cada jugador.

---------- Las decisiones que toma este conversor ----------

1. LA VALORACIÓN MANDA SOFIFA. Donde ya teníamos un jugador cargado a mano, se
   pisa con el dato de SoFIFA. Es lo que se decidió: sale de un proceso con
   gente mirando partidos y se actualiza solo.

2. EL POTENCIAL HAY QUE TRADUCIRLO. En FC el potencial de un veterano es su
   techo HISTÓRICO, no su futuro: Di María tiene 82 de valoración y 87 de
   potencial porque fue un 87 en el PSG. Nuestro motor entiende la proyección
   como futuro y lo haría crecer (ver ratingConLosAnios en mercado.js, donde
   `26 - edadBase` se vuelve negativo y el Math.max(1, ...) le da el techo
   entero en una temporada). Entonces:

       hasta 27 años  -> el potencial de SoFIFA tal cual
       28 y 29        -> como mucho tres puntos por encima de la valoración
       30 en adelante -> la valoración, y nunca más

   Con proyección <= valoración, la rama que hace crecer al jugador no se
   ejecuta nunca. No es una probabilidad, es aritmética.

3. EL '+1' Y EL '-1' NO SE TOCAN. SoFIFA muestra '75+1' cuando la valoración
   cambió hace poco. Se usa el número base.

4. EL SUELDO DE SOFIFA ES SEMANAL. Se multiplica por 52.

5. EL ESTADO DE TRANSFERENCIA NO EXISTE EN SOFIFA: es nuestro. Se deriva con
   una regla simple y explícita (ver estado_de_transferencia).

6. LOS QUE NO ESTÁN EN SOFIFA SE CONSERVAN. Un par de juveniles debutaron
   después del volcado del 17 de septiembre de 2026 y no figuran. Se mantienen
   con los datos que ya teníamos en vez de borrarlos.
"""

import csv
import datetime
import re
import sys
import unicodedata

# El día en que arranca el juego (CALENDAR_START_DAY/MONTH + temporada 1).
HOY = datetime.date(2026, 1, 1)

# Nuestro id de club <-> el nombre con el que figura en SoFIFA. Cruzado uno a
# uno contra la página de la liga (sofifa.com/league/353).
CLUBES = {
    'boca': 'Boca Juniors', 'river': 'River Plate', 'racing': 'Racing Club',
    'independiente': 'Independiente', 'sanlorenzo': 'San Lorenzo de Almagro',
    'velez': 'Vélez Sarsfield', 'estudianteslp': 'Estudiantes de La Plata',
    'gimnasialp': 'Gimnasia y Esgrima La Plata', 'newells': "Newell's Old Boys",
    'rosariocentral': 'Rosario Central', 'talleres': 'Talleres',
    'belgrano': 'Belgrano de Córdoba', 'instituto': 'Instituto Atlético Central Córdoba',
    'argentinos': 'Argentinos Juniors', 'lanus': 'Lanús', 'banfield': 'CA Banfield',
    'huracan': 'Huracán', 'tigre': 'Tigre', 'platense': 'Platense',
    'defensayjusticia': 'Defensa y Justicia', 'union': 'Club Atlético Unión',
    'atleticotucuman': 'Atlético Tucumán', 'aldosivi': 'CA Aldosivi',
    'barracascentral': 'Barracas Central', 'centralcordoba': 'Central Cordoba SdE',
    'riestra': 'Deportivo Riestra', 'independienterivadavia': 'Independiente Rivadavia',
    'sarmientojunin': 'Club Atlético Sarmiento', 'riocuarto': 'Estudiantes de Río Cuarto',
    'gimnasiamendoza': 'Gimnasia y Esgrima de Mendoza',
}

# La sigla de SoFIFA -> (nuestro pos, nuestro posDetail).
PUESTOS = {
    'POR': ('POR', 'arquero'),
    'LD':  ('DEF', 'lateral derecho'),
    'LI':  ('DEF', 'lateral izquierdo'),
    'CAD': ('DEF', 'carrilero derecho'),
    'CAI': ('DEF', 'carrilero izquierdo'),
    'DFC': ('DEF', 'defensor central'),
    'MCD': ('MED', 'mediocampista defensivo'),
    'MC':  ('MED', 'mediocampista mixto'),
    'MCO': ('MED', 'mediocampista ofensivo'),
    'MD':  ('MED', 'volante por derecha'),
    'MI':  ('MED', 'volante por izquierda'),
    # Los extremos van como DEL: en el juego los puestos abiertos de arriba son
    # de delantero (ver delWidth 'abierta' en las formaciones).
    'ED':  ('DEL', 'extremo derecho'),
    'EI':  ('DEL', 'extremo izquierdo'),
    'DC':  ('DEL', 'delantero centro'),
    'SD':  ('DEL', 'segundo delantero'),
}

ROLES = {
    'mediocampista defensivo': 'contención',
    'mediocampista mixto': 'mixto',
    'mediocampista ofensivo': 'ofensivo',
    'volante por derecha': 'mixto',
    'volante por izquierda': 'mixto',
}

# Los países que aparecen en la liga argentina, a código de tres letras. Los
# siete primeros son los que tienen bandera dibujada (ver NATION_FLAGS en
# ui.js); el resto se muestra sin bandera y no rompe nada.
PAISES = {
    'Argentina': 'ARG', 'Uruguay': 'URU', 'Brasil': 'BRA', 'Paraguay': 'PAR',
    'Colombia': 'COL', 'Chile': 'CHI', 'Ecuador': 'ECU',
    'Siria': 'SYR', 'Armenia': 'ARM', 'EE.UU.': 'USA', 'Eslovenia': 'SVN',
    'Suiza': 'SUI', 'Italia': 'ITA', 'Japón': 'JPN', 'Puerto Rico': 'PUR',
}

MESES = {'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
         'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12}


def numero(texto):
    """'75+1' -> 75 · '82' -> 82. El +N/-N es un cambio reciente, no parte del valor."""
    m = re.match(r'-?\d+', (texto or '').strip())
    return int(m.group()) if m else None


def plata(texto):
    """'€22.5M' -> 22500000 · '€21K' -> 21000 · '€0' -> 0."""
    t = (texto or '').strip().replace('€', '').replace(',', '')
    if not t:
        return None
    m = re.match(r'([\d.]+)\s*([MK]?)', t)
    if not m:
        return None
    n = float(m.group(1))
    # round y no int(): 4.1 * 1_000_000 da 4100000.0000000005 en binario y
    # truncar deja 4099999.
    return round(n * {'M': 1_000_000, 'K': 1_000, '': 1}[m.group(2)])


def anio_de_fecha_larga(texto):
    """'30 jun. 2027' -> 2027."""
    m = re.search(r'(\d{4})', texto or '')
    return int(m.group(1)) if m else None


def edad_al_inicio(iso):
    a, m, d = (int(x) for x in iso.split('-'))
    e = HOY.year - a
    if (HOY.month, HOY.day) < (m, d):
        e -= 1
    return e


def proyeccion(rating, potencial, edad):
    """El potencial de SoFIFA traducido a 'hasta dónde puede llegar todavía'."""
    if potencial is None:
        return rating
    if edad <= 27:
        return max(rating, potencial)
    if edad <= 29:
        return max(rating, min(potencial, rating + 3))
    # De los 30 en adelante no crece más: con techo <= valoración, la rama que
    # sube en ratingConLosAnios no se ejecuta.
    return rating


def estado_de_transferencia(jugador, plantel):
    """El único campo que no está en SoFIFA. Regla explícita, no adivinanza."""
    if jugador['contractYears'] <= 1:
        return 'Fin de contrato cercano'
    mejores = sorted((p['rating'] for p in plantel), reverse=True)[:3]
    if jugador['rating'] >= 75 and jugador['rating'] >= min(mejores):
        return 'Intocable'
    return 'Retenido'


def sin_tildes(s):
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def apellidos(nombre):
    p = [w for w in re.sub(r'[^a-z ]', ' ', sin_tildes(nombre)).split() if w]
    return set(p[1:]) if len(p) > 1 else set(p)


def js(valor):
    if isinstance(valor, str):
        return "'" + valor.replace('\\', '\\\\').replace("'", "\\'") + "'"
    if isinstance(valor, bool):
        return 'true' if valor else 'false'
    if isinstance(valor, list):
        return '[' + ', '.join(js(v) for v in valor) + ']'
    return str(valor)


def convertir(csv_listado, csv_fechas):
    fechas = {f['sofifaId']: f['birthDate'] for f in
              csv.DictReader(open(csv_fechas, encoding='utf-8-sig')) if f['birthDate']}
    filas = list(csv.DictReader(open(csv_listado, encoding='utf-8-sig')))
    por_club = {}
    avisos = []

    for f in filas:
        club = next((k for k, v in CLUBES.items() if v == f['equipo']), None)
        if club is None:
            avisos.append(f"club sin cruce: {f['equipo']}")
            continue

        puestos = [p for p in f['puestos'].split('/') if p in PUESTOS]
        if not puestos:
            avisos.append(f"{f['nombre']}: sin puesto reconocible ({f['puestos']})")
            continue
        pos, detalle = PUESTOS[puestos[0]]
        alternativas = []
        for p in puestos[1:]:
            d = PUESTOS[p][1]
            if d != detalle and d not in alternativas:
                alternativas.append(d)

        nacimiento = fechas.get(f['sofifaId'])
        if not nacimiento:
            avisos.append(f"{f['nombre']}: sin fecha de nacimiento")
            continue
        edad = edad_al_inicio(nacimiento)

        rating = numero(f['Valoración general'])
        # El contrato: años que quedan contando 2026. Los cedidos no traen años
        # sino la fecha en que termina el préstamo.
        hasta = numero(f['contratoHasta']) or anio_de_fecha_larga(
            f.get('Fecha de finalización del préstamo', ''))
        contrato = max(1, (hasta - HOY.year + 1)) if hasta else 1

        valor = plata(f['Valor'])
        # Dos jugadores de 41 años figuran en €0 porque nadie paga por su pase.
        # Un cero puede hacer cosas raras en la fórmula de precios, así que se
        # les deja un valor simbólico.
        if not valor:
            valor = 50_000

        jugador = {
            'name': f['nombre'],
            'sofifaId': int(f['sofifaId']),
            'birthDate': nacimiento,
            'pos': pos,
            'posDetail': detalle,
            'age': edad,
            'nation': PAISES.get(f['nacionalidades'].split('/')[0], 'ARG'),
            'contractYears': contrato,
            'rating': rating,
            'projection': proyeccion(rating, numero(f['Potencial']), edad),
            'number': numero(f['Club kit number']),
            'value': valor,
            # El salario de SoFIFA es SEMANAL.
            'salary': (plata(f['Salario']) or 0) * 52,
        }
        if alternativas:
            jugador['altPosDetail'] = alternativas
        if pos == 'MED' and detalle in ROLES:
            jugador['role'] = ROLES[detalle]
        clausula = plata(f['Cláusula de rescisión'])
        if clausula:
            jugador['clause'] = clausula
        altura = numero(f['Altura'])
        if altura:
            jugador['altura'] = altura
        peso = numero(f['Peso'])
        if peso:
            jugador['peso'] = peso
        if f['foot']:
            jugador['pierna'] = 'izquierda' if f['foot'].startswith('Izq') else 'derecha'
        rep = numero(f['Reputación internacional'])
        if rep:
            jugador['reputacion'] = rep
        por_club.setdefault(club, []).append(jugador)

    # El estado de transferencia necesita ver el plantel entero.
    for plantel in por_club.values():
        for j in plantel:
            j['transferState'] = estado_de_transferencia(j, plantel)

    return por_club, avisos


def conservar_los_que_faltan(por_club, viejos):
    """Los que ya teníamos y no están en SoFIFA (debutaron después del volcado)."""
    conservados = []
    for club, plantel_viejo in viejos.items():
        nuevos = por_club.get(club, [])
        for v in plantel_viejo:
            ap = apellidos(v['name'])
            if any(ap & apellidos(n['name']) for n in nuevos):
                continue
            nuevos.append(v)
            conservados.append(f"{club}: {v['name']}")
        por_club[club] = nuevos
    return conservados


ORDEN = ['name', 'sofifaId', 'birthDate', 'pos', 'posDetail', 'altPosDetail',
         'age', 'nation', 'contractYears', 'rating', 'projection', 'number',
         'value', 'salary', 'clause', 'transferState', 'role',
         'altura', 'peso', 'pierna', 'reputacion', 'loanFrom', 'loanUntil',
         'edadAlLlegar', 'temporadaAlLlegar']

LINEA_POR_PUESTO = {'POR': 0, 'DEF': 1, 'MED': 2, 'DEL': 3}


def escribir(por_club):
    partes = []
    for club in sorted(por_club, key=lambda c: (CLUBES.get(c, ''))):
        plantel = sorted(por_club[club],
                         key=lambda j: (LINEA_POR_PUESTO.get(j['pos'], 9), -j['rating']))
        partes.append(f'  {club}: [')
        for j in plantel:
            campos = [f'{k}: {js(j[k])}' for k in ORDEN if k in j]
            partes.append('    { ' + ', '.join(campos) + ' },')
        partes.append('  ],')
    return '\n'.join(partes)


if __name__ == '__main__':
    if len(sys.argv) not in (3, 4):
        print(__doc__)
        sys.exit(1)
    por_club, avisos = convertir(sys.argv[1], sys.argv[2])
    if len(sys.argv) == 4:
        import json
        conservados = conservar_los_que_faltan(
            por_club, json.load(open(sys.argv[3], encoding='utf-8')))
        for c in conservados:
            sys.stderr.write(f'conservado (no está en SoFIFA): {c}\n')
    for a in avisos:
        sys.stderr.write(f'aviso: {a}\n')
    sys.stderr.write(f'clubes: {len(por_club)} · '
                     f'jugadores: {sum(len(v) for v in por_club.values())}\n')
    print(escribir(por_club))
