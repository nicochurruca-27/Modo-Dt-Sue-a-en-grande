#!/usr/bin/env python3
"""Arma modo-dt-sueno-en-grande.html: el juego entero en un solo archivo.

NO hace falta correr esto para jugar desde el repo: con abrir index.html
alcanza. Esto es para tener una copia suelta que se pueda mandar por
WhatsApp o por mail y que funcione con doble click, sin la carpeta js/ ni
el style.css al lado.

Uso:
    python3 tools/armar-archivo-unico.py

Qué hace: toma index.html y reemplaza el <link> del CSS y cada <script
src> por el contenido del archivo, en el mismo orden. Nada más. El juego
no tiene paso de compilación: es el mismo código, pegado.

El archivo que sale está en .gitignore, porque sería duplicar todo el
repo y habría que regenerarlo en cada cambio.
"""

import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'modo-dt-sueno-en-grande.html'


def leer(ruta):
    archivo = RAIZ / ruta
    if not archivo.exists():
        sys.exit(f'No encontré {ruta}. ¿Corriste esto desde otra carpeta?')
    return archivo.read_text(encoding='utf-8')


def main():
    html = leer('index.html')

    # El CSS, en un <style> en la cabecera.
    css = leer('style.css')
    html = html.replace(
        '<link rel="stylesheet" href="style.css" />',
        f'<style>\n{css}\n</style>',
    )

    # Cada script, en el mismo orden en que los carga index.html.
    def inlinear(match):
        ruta = match.group(1)
        return f'<script>\n{leer(ruta)}\n</script>'

    html, cuantos = re.subn(r'<script src="([^"]+)"></script>', inlinear, html)
    if not cuantos:
        sys.exit('No encontré ningún <script src> en index.html.')

    SALIDA.write_text(html, encoding='utf-8')
    kb = round(len(html.encode('utf-8')) / 1024)
    print(f'Listo: {SALIDA.name} con {cuantos} scripts adentro, {kb} KB.')


if __name__ == '__main__':
    main()
