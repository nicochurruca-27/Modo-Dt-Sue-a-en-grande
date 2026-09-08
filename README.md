# Modo DT: Sueño en Grande

Simulador de modo carrera como **director técnico** de un club de la Liga Argentina.
No se juegan los partidos: se resuelven solos según tu plantel y las decisiones
que vas tomando (táctica, prensa, vestuario, fichajes). De vez en cuando aparece
un penal donde elegís quién patea y hacia dónde.

## Cómo jugarlo

No hace falta instalar nada ni tener cuenta. Abrí el archivo `index.html` con
cualquier navegador (doble click alcanza) y arrancá a dirigir. El progreso se
guarda solo en tu navegador (`localStorage`), así que si cerrás y volvés a
abrir seguís donde quedaste.

## Stack técnico usado

**HTML + CSS + JavaScript puro, sin frameworks ni build.**

¿Por qué? Porque es lo más simple de correr y de explicar:
- No requiere instalar Node, ni compilar nada, ni configurar un servidor.
- Se abre directo en el navegador con doble click, en la línea de Copero.
- El progreso se guarda con `localStorage` del navegador, sin backend ni base de datos.
- Al no usar módulos de JavaScript (`import`/`export`), funciona incluso
  abriendo el archivo directamente desde el disco (`file://`), sin depender
  de un servidor web.

## Estructura del proyecto

```
index.html        → esqueleto de la página
style.css         → estilos visuales
js/data.js        → "contenido" del juego: clubes, nombres, decisiones posibles
js/engine.js       → la lógica: arma planteles, simula partidos, aplica decisiones
js/ui.js          → dibuja las pantallas en base al estado del juego
```

## Estructura de datos básica

- **Club**: `{ id, name, reputation (1-5), budget }`. La reputación define
  qué tan buenos son los jugadores que arranca teniendo ese club.
- **Jugador**: `{ id, name, pos (POR/DEF/MED/DEL), rating (0-100) }`.
- **Plantel**: lista de 16 jugadores de un club.
- **Decisión**: `{ title, description, options: [{ label, tacticMod, moraleMod, note }] }`.
  Cada opción suma o resta puntos a la "fuerza táctica" del próximo partido
  y al "ánimo" general del plantel (que se arrastra en el tiempo).
- **Partido**: se calcula una fuerza total por equipo (promedio de los 11
  mejores jugadores + modificador táctico + ánimo) y con eso se genera un
  resultado usando una distribución de Poisson (el mismo método que usan
  muchos simuladores de fútbol para que los resultados sean realistas).
- **Tabla de posiciones**: se actualiza después de cada fecha, incluyendo los
  partidos de los otros 5 clubes (simulados en segundo plano) para que el
  campeonato tenga sentido completo.

## Alcance de esta v1 (MVP)

Incluido:
1. Elegís entre 6 clubes de la Liga Argentina.
2. Temporada de 10 fechas (todos contra todos, ida y vuelta, entre 6 clubes).
3. Antes de cada partido tuyo aparece una decisión con 2-3 opciones.
4. Cada 3 fechas se abre el mercado de pases: podés comprar 1 de 3 ofertas
   disponibles (según presupuesto) y vender jugadores de tu plantel.
5. 25% de probabilidad de que tu partido tenga un penal, a favor o en contra,
   con mini-interacción de dirección.
6. Tabla de posiciones en vivo y resumen final de temporada.

No incluido todavía (fases futuras, según el plan original):
- Ofertas de otros clubes para cambiar de equipo.
- Otras ligas además de la argentina.
- Versión app / mobile nativa.
- Más profundidad narrativa y visual.
