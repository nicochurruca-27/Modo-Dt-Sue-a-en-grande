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

El script no se enoja si falta un escudo: genera los que encuentre y al
final lista los que no estaban, así se puede ir cargando la Nacional de a
tandas. Cuando entren esos escudos conviene correr también
tools/generar-colores.py, que saca los colores de cada club del propio
escudo y deja de hacer falta tenerlos escritos a mano en NACIONAL_DATOS
(js/data.js).
"""

import base64
import io
import os
import re
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

# Primera Nacional (36). Acá el archivo se llama igual que el id del club, así
# que alcanza con guardar cada PNG con ese nombre y correr el script.
ARCHIVO_A_CLUB.update({
    'allboys':             'allboys',  # All Boys
    'ferro':               'ferro',  # Ferro Carril Oeste
    'madryn':              'madryn',  # Deportivo Madryn
    'chacoforever':        'chacoforever',  # Chaco For Ever
    'moron':               'moron',  # Deportivo Morón
    'estudiantesba':       'estudiantesba',  # Estudiantes (BA)
    'racingcordoba':       'racingcordoba',  # Racing de Córdoba
    'losandes':            'losandes',  # Los Andes
    'mitresgo':            'mitresgo',  # Mitre (SdE)
    'almirantebrown':      'almirantebrown',  # Almirante Brown
    'ciudaddebolivar':     'ciudaddebolivar',  # Ciudad de Bolívar
    'colon':               'colon',  # Colón
    'centralnorte':        'centralnorte',  # Central Norte (Salta)
    'godoycruz':           'godoycruz',  # Godoy Cruz
    'santelmo':            'santelmo',  # San Telmo
    'sanmiguel':           'sanmiguel',  # San Miguel
    'defensoresbelgrano':  'defensoresbelgrano',  # Defensores de Belgrano
    'acassuso':            'acassuso',  # Acassuso
    'nuevachicago':        'nuevachicago',  # Nueva Chicago
    'atlanta':             'atlanta',  # Atlanta
    'sanmartintuc':        'sanmartintuc',  # San Martín de Tucumán
    'gimnasiajujuy':       'gimnasiajujuy',  # Gimnasia de Jujuy
    'almagro':             'almagro',  # Almagro
    'chacarita':           'chacarita',  # Chacarita Juniors
    'sanmartinsj':         'sanmartinsj',  # San Martín de San Juan
    'temperley':           'temperley',  # Temperley
    'guemessgo':           'guemessgo',  # Güemes (SdE)
    'tristansuarez':       'tristansuarez',  # Tristán Suárez
    'agropecuario':        'agropecuario',  # Agropecuario
    'patronato':           'patronato',  # Patronato
    'gimnasiaytiro':       'gimnasiaytiro',  # Gimnasia y Tiro (Salta)
    'maipu':               'maipu',  # Deportivo Maipú
    'quilmes':             'quilmes',  # Quilmes
    'colegiales':          'colegiales',  # Colegiales
    'atleticorafaela':     'atleticorafaela',  # Atlético de Rafaela
    'midland':             'midland',  # Ferrocarril Midland
})


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


def leer_generados(salida):
    """Los escudos que ya están adentro de js/escudos.js, tal cual están.

    Se leen del propio archivo generado y no de los PNG originales, que no
    viven en el repo: así se puede agregar una tanda de escudos nuevos sin
    tener a mano los que ya se habían cargado.
    """
    if not os.path.exists(salida):
        return {}
    texto = open(salida, encoding='utf-8').read()
    return dict(re.findall(r"^  ([a-z0-9]+): '(data:image/png;base64,[^']+)',$", texto, re.M))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    origen = sys.argv[1]
    salida = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'js', 'escudos.js')

    # Lo que ya está generado se conserva: la carpeta que se pasa puede tener
    # tres escudos nuevos y no por eso hay que perder los otros sesenta y
    # tres. Un archivo que SÍ está en la carpeta pisa al de antes.
    ya_estan = leer_generados(salida)

    entradas = {}
    nuevos = []
    faltantes = []
    for archivo, club in sorted(ARCHIVO_A_CLUB.items(), key=lambda kv: kv[1]):
        ruta = os.path.join(origen, archivo + '.png')
        if os.path.exists(ruta):
            entradas[club] = data_uri(ruta)
            nuevos.append(club)
        elif club in ya_estan:
            entradas[club] = ya_estan[club]
        else:
            faltantes.append(archivo)
    entradas = sorted(entradas.items())

    with open(salida, 'w', encoding='utf-8') as f:
        f.write(
            '// Escudos de los clubes, generado por tools/generar-escudos.py — no se\n'
            '// edita a mano. Cada entrada es el escudo real del club, achicado a\n'
            f'// {SIZE}x{SIZE} y guardado como data URI para que funcione igual abriendo\n'
            '// index.html o el archivo único, sin depender de una carpeta de imágenes.\n'
            '//\n'
            '// La clave es el id del club en CLUB_TEMPLATES (data.js). Un club que no\n'
            '// esté acá se dibuja con un escudo genérico con sus iniciales, pintado con\n'
            '// los colores del club si los tiene — ver clubCrest en ui.js.\n'
            'const CLUB_CRESTS = {\n'
        )
        for club, uri in entradas:
            f.write(f"  {club}: '{uri}',\n")
        f.write('};\n')

    peso = os.path.getsize(salida) / 1024
    print(f'{len(entradas)} escudos -> {salida} ({peso:.0f} KB)')
    print(f'nuevos o actualizados en esta corrida: {len(nuevos)}')
    if faltantes:
        print('sin escudo todavía:', ', '.join(faltantes))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
