#!/usr/bin/env python3
"""Genera js/marcas.js: los logos de las competencias, para el fondo de los cuadros.

NO hace falta correr esto para jugar: js/marcas.js ya viene generado. Esto es
solo para cuando llegue un logo nuevo o haya que reemplazar alguno.

Uso:
    python3 tools/generar-marcas.py liga=/ruta/al/logo-lpf.png \\
                                    libertadores=/ruta/al/logo.jpg

Cada argumento es `id=ruta`, donde el id es el de COLORES_COMPETICIONES en
js/data.js (liga, copaArgentina, libertadores, sudamericana). Los que no se
pasen quedan como están en js/marcas.js.

Si el logo viene con el nombre del torneo escrito abajo, se le puede pasar un
recorte para quedarse solo con el dibujo:

    python3 tools/generar-marcas.py 'sudamericana=/ruta/logo.png#0,0,750,320'

Qué hace con cada imagen:
  - le saca el fondo blanco (los logos vienen sobre blanco y el cuadro es
    oscuro, así que sin esto quedaría un cuadrado blanco),
  - la recorta al contenido real,
  - la achica a 200 px de lado mayor y la guarda como PNG de paleta de 64
    colores (se dibuja al 16% de opacidad atrás del cuadro: no se nota, y el
    archivo pesa la mitad),
  - la mete como data URI dentro de js/marcas.js.

Van embebidos en un .js (y no como archivos sueltos) por lo mismo que los
escudos: el juego tiene que funcionar igual abierto como index.html o como el
archivo único, sin ningún paso de compilación.
"""

import base64
import io
import pathlib
import re
import sys

from PIL import Image, ImageChops

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'js' / 'marcas.js'
LADO = 200
# La marca va translúcida de fondo: con 64 colores alcanza y pesa la mitad.
COLORES = 64
# Un pixel se considera fondo si está a menos de esto del blanco puro.
UMBRAL_BLANCO = 26

CABECERA = '''// Los logos de las competencias, generado por tools/generar-marcas.py — no se
// edita a mano. Cada entrada es el logo real recortado, sin el fondo blanco y
// guardado como data URI, para que funcione igual abriendo index.html o el
// archivo único.
//
// La clave es el id de la competencia en COLORES_COMPETICIONES (js/data.js).
// Se usan de marca de agua atrás del cuadro de cada copa (ver
// marcaDeCompeticionSvg en ui.js). Una competencia que no esté acá se dibuja
// sin marca, y el cuadro queda igual.
const MARCAS_COMPETICIONES = {
'''


def sin_fondo_blanco(im):
    """Devuelve la imagen en RGBA con el blanco transparente.

    Un pixel es fondo si sus tres canales están cerca del blanco puro, así que
    alcanza con mirar el más oscuro de los tres.
    """
    im = im.convert('RGBA')
    r, g, b, a = im.split()
    oscuro = ImageChops.darker(ImageChops.darker(r, g), b)
    fondo = oscuro.point(lambda v: 0 if v >= 255 - UMBRAL_BLANCO else 255)
    im.putalpha(ImageChops.darker(a, fondo))
    return im


def preparar(ruta, recorte=None):
    im = Image.open(ruta)
    if recorte:
        im = im.crop(recorte)
    im = sin_fondo_blanco(im)
    caja = im.getbbox()
    if caja:
        im = im.crop(caja)
    im.thumbnail((LADO, LADO), Image.LANCZOS)
    im = im.quantize(colors=COLORES, method=Image.FASTOCTREE)
    buffer = io.BytesIO()
    im.save(buffer, format='PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')


def leer_existentes():
    if not SALIDA.exists():
        return {}
    texto = SALIDA.read_text(encoding='utf-8')
    return dict(re.findall(r"^\s{2}(\w+):\s*'([^']+)',$", texto, re.M))


def main():
    nuevos = {}
    for arg in sys.argv[1:]:
        if '=' not in arg:
            sys.exit(f'Argumento raro: {arg}. Va como id=/ruta/al/logo.png')
        clave, ruta = arg.split('=', 1)
        recorte = None
        if '#' in ruta:
            ruta, caja = ruta.split('#', 1)
            recorte = tuple(int(n) for n in caja.split(','))
        if not pathlib.Path(ruta).exists():
            sys.exit(f'No encontré {ruta}')
        nuevos[clave] = preparar(ruta, recorte)
        print(f'{clave}: listo')

    marcas = leer_existentes()
    marcas.update(nuevos)
    if not marcas:
        sys.exit('No hay ninguna marca para guardar.')

    cuerpo = ''.join(f"  {clave}: '{valor}',\n" for clave, valor in sorted(marcas.items()))
    SALIDA.write_text(f'{CABECERA}{cuerpo}}};\n', encoding='utf-8')
    kb = round(SALIDA.stat().st_size / 1024)
    print(f'Listo: {SALIDA.name} con {len(marcas)} marcas, {kb} KB.')


if __name__ == '__main__':
    main()
