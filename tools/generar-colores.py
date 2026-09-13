#!/usr/bin/env python3
"""Genera js/colores.js: los dos colores de cada club, sacados de su escudo.

NO hace falta correr esto para jugar: js/colores.js ya viene generado. Esto es
solo para cuando se agregue o cambie un escudo.

    python3 tools/generar-colores.py

Los clubes argentinos no tenían colores cargados en ninguna parte (los
internacionales sí, ver `colores` en internacional.js). En vez de escribir 30
pares de colores a mano —y equivocarse en la mitad— se sacan del propio escudo,
que ya está en el juego: se cuentan los píxeles por color y se eligen los dos
que mandan.

Qué se descarta al contar:
  - lo transparente (el fondo del escudo),
  - los grises y los casi negros, que casi siempre son el contorno,
  - el blanco, que aparece en casi todos los escudos y no distingue a nadie.

El blanco vuelve a entrar solo como SEGUNDO color, y únicamente si el club no
tiene otro: es el caso de los que juegan de blanco con una sola franja
(River, Racing).
"""

import base64
import colorsys
import io
import pathlib
import re
from collections import Counter

from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ENTRADA = RAIZ / 'js' / 'escudos.js'
SALIDA = RAIZ / 'js' / 'colores.js'

# Los colores se agrupan en cubos de este lado para que dos tonos de azul casi
# iguales cuenten como el mismo color y no se lleven los dos lugares.
CUBO = 40
# Cuánto tiene que cambiar el TONO para que cuente como otro color (grados).
TONO_MINIMO = 45

CABECERA = '''// Los dos colores de cada club, generado por tools/generar-colores.py — no se
// edita a mano. Salen de contar los píxeles del propio escudo (js/escudos.js),
// así que son los colores que de verdad tiene el club, no una lista escrita a
// ojo.
//
// La clave es el id del club en CLUB_TEMPLATES (data.js). El primero es el
// color que manda y el segundo el que acompaña. Un club que no esté acá se
// dibuja con el gris de siempre.
const CLUB_COLORES = {
'''


def clasificar(r, g, b):
    """Qué es este píxel: 'color', 'blanco', 'negro' o 'gris'."""
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if v > 0.86 and s < 0.16:
        return 'blanco'
    if v < 0.20:
        return 'negro'
    if s < 0.22:
        return 'gris'
    return 'color'


def lejos_de(a, b):
    """¿Son dos colores distintos de verdad, o el mismo más claro?

    Se compara el TONO y no la distancia RGB. Con la distancia sola, el rojo
    de Estudiantes traía como segundo color un rosa: el borde suavizado del
    mismo rojo. Dos colores de club se distinguen por el tono (el azul y el
    amarillo de Boca), no por lo clarito que sea uno.
    """
    ha = colorsys.rgb_to_hsv(*[x / 255 for x in a])[0] * 360
    hb = colorsys.rgb_to_hsv(*[x / 255 for x in b])[0] * 360
    vuelta = abs(ha - hb)
    return min(vuelta, 360 - vuelta) >= 45


def colores_de(data_uri):
    crudo = base64.b64decode(data_uri.split(',', 1)[1])
    im = Image.open(io.BytesIO(crudo)).convert('RGBA')
    im.thumbnail((96, 96), Image.LANCZOS)

    cuentas = Counter()
    sumas = {}
    aparte = Counter()
    for r, g, b, a in im.getdata():
        if a < 200:
            continue
        tipo = clasificar(r, g, b)
        if tipo != 'color':
            aparte[tipo] += 1
            continue
        cubo = (r // CUBO, g // CUBO, b // CUBO)
        cuentas[cubo] += 1
        acum = sumas.setdefault(cubo, [0, 0, 0, 0])
        acum[0] += r
        acum[1] += g
        acum[2] += b
        acum[3] += 1

    def promedio(cubo):
        s = sumas[cubo]
        return (s[0] // s[3], s[1] // s[3], s[2] // s[3])

    blanco = (244, 244, 246)
    negro = (24, 24, 28)

    if not cuentas:
        # Un escudo sin ningún color: en blanco y negro, como Riestra o
        # Gimnasia de Mendoza. Manda el que más pesa.
        if aparte['negro'] >= aparte['blanco']:
            return [negro, blanco]
        return [blanco, negro]

    ordenados = cuentas.most_common()
    principal = promedio(ordenados[0][0])
    peso = ordenados[0][1]

    for cubo, cuanto in ordenados[1:]:
        # El umbral de peso saca los colores que son un detalle del escudo y no
        # un color del club: el dorado de un laurel, el ocre de una cinta. Un
        # segundo color de verdad ocupa una parte grande del escudo.
        if cuanto < peso * 0.20:
            break
        candidato = promedio(cubo)
        if lejos_de(candidato, principal):
            return [principal, candidato]

    # Sin un segundo color propio: el club juega de un color con blanco o con
    # negro (River, Racing, Newell's). Manda el que más aparece en el escudo.
    if aparte['blanco'] >= max(aparte['negro'], peso * 0.15):
        return [principal, blanco]
    if aparte['negro'] >= peso * 0.15:
        return [principal, negro]
    return [principal, tuple(x // 2 for x in principal)]


def main():
    texto = ENTRADA.read_text(encoding='utf-8')
    escudos = re.findall(r"^  (\w+): '(data:image/png;base64,[^']+)',$", texto, re.M)
    if not escudos:
        raise SystemExit('No encontré ningún escudo en js/escudos.js')

    lineas = []
    for clave, uri in escudos:
        par = ['#%02x%02x%02x' % c for c in colores_de(uri)]
        lineas.append(f"  {clave}: ['{par[0]}', '{par[1]}'],\n")
        print(f'{clave}: {par[0]} / {par[1]}')

    SALIDA.write_text(f'{CABECERA}{"".join(lineas)}}};\n', encoding='utf-8')
    print(f'\nListo: {SALIDA.name} con {len(lineas)} clubes.')


if __name__ == '__main__':
    main()
