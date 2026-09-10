#!/usr/bin/env python3
"""Genera js/escudos.js a partir de una carpeta con los PNG originales.

NO hace falta correr esto para jugar: js/escudos.js ya viene generado en el
repo. Esto es solo para cuando lleguen escudos nuevos (por ejemplo los de
Primera Nacional, que todavía faltan).

Uso:
    python3 tools/generar-escudos.py /ruta/a/la/carpeta/con/los/png

Qué hace con cada imagen:
  - la recorta al contenido real (saca el aire transparente de alrededor),
  - la achica a 128x128 centrada sobre un cuadrado transparente,
  - la guarda como PNG de paleta (64 colores), que en escudos de colores
    planos se ve igual que el original pero pesa 5 veces menos,
  - la mete como data URI dentro de js/escudos.js.

Van embebidas en un .js (y no como archivos sueltos en una carpeta) para que
el juego siga funcionando igual abierto como index.html o como el archivo
único con todo adentro, sin ningún paso de compilación de por medio.

ARCHIVO -> id del club en CLUB_TEMPLATES (data.js). Si el archivo se llama
igual que el id, igual conviene dejarlo escrito acá para que quede a la
vista qué escudo entró y cuál no.
"""

import base64
import io
import os
import sys

from PIL import Image

SIZE = 128
COLORS = 64

# Primera División (30). De Estudiantes se usa el escudo tipo escudo (EDLP),
# no el banderín; de Independiente y de Racing, la versión bordada (la del
# contorno oscuro, como el parche de la camiseta).
ARCHIVO_A_CLUB = {
    'aldosivi': 'aldosivi',
    'argentinos': 'argentinos',
    'atleticotucuman': 'atleticotucuman',
    'banfield': 'banfield',
    'barracas': 'barracascentral',
    'belgrano': 'belgrano',
    'boca': 'boca',
    'centralcordoba': 'centralcordoba',
    'defensa': 'defensayjusticia',
    'estudiantes': 'estudianteslp',
    'estudiantesrc': 'riocuarto',
    'gimnasia': 'gimnasialp',
    'gimnasiamendoza': 'gimnasiamendoza',
    'huracan': 'huracan',
    'independiente': 'independiente',
    'independienteriv': 'independienterivadavia',
    'instituto': 'instituto',
    'lanus': 'lanus',
    'newells': 'newells',
    'platense': 'platense',
    'racing': 'racing',
    'riestra': 'riestra',
    'river': 'river',
    'rosariocentral': 'rosariocentral',
    'sanlorenzo': 'sanlorenzo',
    'sarmiento': 'sarmientojunin',
    'talleres': 'talleres',
    'tigre': 'tigre',
    'union': 'union',
    'velez': 'velez',
}


def data_uri(path):
    im = Image.open(path).convert('RGBA')
    caja = im.getbbox()
    if caja:
        im = im.crop(caja)
    im.thumbnail((SIZE, SIZE), Image.LANCZOS)
    lienzo = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    lienzo.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2), im)
    buf = io.BytesIO()
    lienzo.quantize(colors=COLORS, method=Image.FASTOCTREE).save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    origen = sys.argv[1]
    salida = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'js', 'escudos.js')

    entradas = []
    faltantes = []
    for archivo, club in sorted(ARCHIVO_A_CLUB.items(), key=lambda kv: kv[1]):
        ruta = os.path.join(origen, archivo + '.png')
        if not os.path.exists(ruta):
            faltantes.append(archivo)
            continue
        entradas.append((club, data_uri(ruta)))

    with open(salida, 'w', encoding='utf-8') as f:
        f.write(
            '// Escudos de los clubes, generado por tools/generar-escudos.py — no se\n'
            '// edita a mano. Cada entrada es el escudo real del club, achicado a\n'
            f'// {SIZE}x{SIZE} y guardado como data URI para que funcione igual abriendo\n'
            '// index.html o el archivo único, sin depender de una carpeta de imágenes.\n'
            '//\n'
            '// La clave es el id del club en CLUB_TEMPLATES (data.js). Un club que no\n'
            '// está acá (hoy, los de Primera Nacional) se dibuja con un escudo genérico\n'
            '// con sus iniciales — ver clubCrest en ui.js.\n'
            'const CLUB_CRESTS = {\n'
        )
        for club, uri in entradas:
            f.write(f"  {club}: '{uri}',\n")
        f.write('};\n')

    peso = os.path.getsize(salida) / 1024
    print(f'{len(entradas)} escudos -> {salida} ({peso:.0f} KB)')
    if faltantes:
        print('sin archivo:', ', '.join(faltantes))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
