# Prompt para investigar los presupuestos reales de los clubes

Este archivo es el pedido que hay que pasarle a una IA **con búsqueda web
activada** para conseguir los datos económicos de los 30 clubes de Primera.

Con la respuesta se van a recalibrar `Engine.startingBudget` y
`ECONOMIA_DATOS` (js/economia.js), que hoy reparten la plata por categoría
(grandes / históricos / media tabla / chicos) y no por club: Boca y River
arrancan con $16 M y los de mitad de tabla casi con lo mismo que los chicos.

**Ojo:** si la IA no puede buscar en internet, va a inventar los números con
total soltura y van a parecer razonables. Antes de usar la respuesta, verificá
que cada fila traiga su fuente y su fecha.

---

## El prompt (copiar de acá para abajo)

Necesito datos económicos reales y verificables de los 30 clubes de la Primera
División del fútbol argentino, para calibrar la economía de un juego de
manager. No necesito precisión contable: necesito que las DIFERENCIAS entre
clubes sean reales, porque hoy en el juego un grande y un club de mitad de
tabla manejan casi la misma plata y eso es falso.

Buscá en internet. No contestes de memoria.

### Los 30 clubes

boca (Boca Juniors), river (River Plate), estudianteslp (Estudiantes de La
Plata), independiente (Independiente), newells (Newell's Old Boys), racing
(Racing Club), rosariocentral (Rosario Central), talleres (Talleres de
Córdoba), velez (Vélez Sarsfield), argentinos (Argentinos Juniors),
atleticotucuman (Atlético Tucumán), banfield (Banfield), belgrano (Belgrano de
Córdoba), defensayjusticia (Defensa y Justicia), gimnasialp (Gimnasia y
Esgrima La Plata), huracan (Huracán), lanus (Lanús), sanlorenzo (San Lorenzo),
tigre (Tigre), union (Unión de Santa Fe), aldosivi (Aldosivi),
barracascentral (Barracas Central), centralcordoba (Central Córdoba de
Santiago del Estero), riestra (Deportivo Riestra), independienterivadavia
(Independiente Rivadavia), instituto (Instituto de Córdoba), platense
(Platense), sarmientojunin (Sarmiento de Junín), riocuarto (Estudiantes de Río
Cuarto), gimnasiamendoza (Gimnasia y Esgrima de Mendoza).

### Qué necesito de cada uno

1. **Valor de plantel** (Transfermarkt), en millones de euros o dólares, con la
   fecha del dato. Es el más comparable entre clubes y el que más me sirve.
2. **Socios** (cantidad de socios activos declarada por el club).
3. **Capacidad del estadio** propio.
4. **Ingresos anuales ordinarios**, en dólares, SOLO si el club los publicó
   (memoria y balance, asamblea, nota periodística con la cifra). Si no hay
   cifra publicada, poné "sin dato": prefiero un hueco a una estimación tuya
   disfrazada de dato.
5. **Salud financiera**, eligiendo una de estas cuatro y justificándola en una
   línea con un hecho concreto y su fecha:
   - `sana` — sin deudas que condicionen, al día
   - `ajustada` — le cuesta pero funciona
   - `endeudada` — deuda grande, problemas para pagar sueldos o fichajes
   - `crisis` — situación grave y pública (concurso, embargos, sueldos
     atrasados de meses)

### Reglas

- **Todo en dólares (USD)**, nunca en pesos. Con la inflación argentina una
  cifra en pesos de hace seis meses no sirve para comparar nada.
- **Citá la fuente y la fecha de cada dato.** Si son de años distintos,
  decilo.
- **No inventes ni promedies.** Si no encontrás algo, escribí "sin dato". Una
  fila incompleta con fuentes me sirve; una fila completa inventada me arruina
  el juego entero.
- Tené en cuenta que los clubes argentinos son asociaciones civiles sin fines
  de lucro y no publican como los europeos: es esperable que falten los
  ingresos de varios. No rellenes esos huecos.
- Si un club está en una situación fuera de lo común (acaba de cobrar una
  venta enorme, está en concurso de acreedores, lo compró un grupo inversor),
  decímelo aparte: son justo las cosas que quiero que el juego refleje.

### Cómo quiero la respuesta

Primero una tabla con una fila por club, en este orden de columnas:

| id | club | valor_plantel_musd | socios | aforo | ingresos_anuales_musd | salud | confianza |

`confianza` es `alta` / `media` / `baja` según lo sólida que sea la fuente.

Después de la tabla, una sección de **Fuentes**, con una línea por club:
qué usaste, de qué fecha y el link.

Y al final, un párrafo corto con lo que creas que NO se puede saber con datos
públicos y qué usarías como aproximación en su lugar.
