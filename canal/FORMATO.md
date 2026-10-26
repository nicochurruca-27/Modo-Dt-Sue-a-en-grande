# Formato del canal — fútbol curioso

Documento de referencia del canal. Todo guion, título y miniatura se arma contra esto.
Las skills `yt-*` lo usan junto con `canal/voice.md`.

## 1. Identidad

**La promesa del canal (una frase):** las historias más raras del fútbol, contadas como en una
mesa de bar.

- **Sin cara.** Voz en off + imágenes. Nunca aparece el creador.
- **Voz:** la propia, con acento argentino. Es lo que diferencia al canal de los cientos de canales
  con voz de IA. Voz de IA solo como plan B.
- **Público:** futboleros de Latinoamérica de 16 a 40 años que ya saben de fútbol y quieren la
  historia que no conocen.
- **Lo que NO hacemos:** biografías de famosos que todos conocen ("la historia de CR7"), noticias
  del día, "le pregunté a la IA quién gana" (está saturado y no rinde).

**Nombre del canal** (a elegir; chequear antes que no exista en YouTube):
1. La Otra Pelota
2. Pelota Rara
3. Archivo Pelota
4. Fútbol de Otro Planeta

## 2. Las tres series

Cada video largo pertenece a una serie. Rotan en este orden: **1 → 2 → 1 → 3** (la serie 1 es la que
más rindió en la investigación, por eso va dos veces de cada cuatro).

### Serie 1 — "¿Por qué…?" / "¿Cómo…?"
Países, clubes y casos raros. Una pregunta que el espectador no sabe responder.

- **Título:** `¿Por qué [país/club] [cosa rara]?` o `¿Cómo es el fútbol en [lugar raro]?`
- **Miniatura:** mapa o bandera del lugar + un objeto fuera de lugar + 2-3 palabras ("¿NUNCA?",
  "PROHIBIDO").
- **Duración:** 8-10 min.
- **Ideas de arranque** (verificar todo antes de escribir):
  - ¿Cómo es el fútbol en el Vaticano?
  - ¿Por qué Groenlandia no puede jugar en la FIFA?
  - ¿Cómo un país de 350 mil habitantes llegó al Mundial? (Islandia 2018)
  - ¿Por qué China nunca fue potencia en fútbol?
  - ¿Por qué Gibraltar juega las eliminatorias de la Eurocopa?

### Serie 2 — "Así vive hoy…"
Ídolos de los 90 y 2000, sobre todo argentinos y latinoamericanos, que la gente recuerda pero no
sabe qué hacen hoy.

- **Título:** `Así vive hoy [apodo o nombre], el [rasgo de ídolo] de [club/selección]`
- **Miniatura:** ilustración del jugador en su época + "HOY" o "A LOS 52" (dato verificado).
- **Duración:** 8-12 min.
- **Regla:** respeto. Contamos la vida, no nos burlamos de la caída. Nada de salud o familia que no
  sea público y confirmado.

### Serie 3 — Experimentos con IA (una vez por mes)
La IA no es la que opina: es la herramienta de un experimento con resultado.

- **Título:** `Simulé [torneo] con [regla loca]` o `La IA armó [equipo] con [restricción]`
- **Miniatura:** escudo o trofeo + el resultado sorpresa en 2-3 palabras.
- **Duración:** 10-15 min.
- **Ideas de arranque:**
  - Simulé un torneo argentino con el 11 histórico de cada club
  - La IA armó la Selección Argentina más barata capaz de ganar un Mundial
  - Simulé la Libertadores con un solo crack por equipo

## 3. Estructura de cada video largo

A ~150 palabras por minuto: 8 min ≈ 1.200 palabras de guion.

| Tramo | Tiempo | Qué pasa |
|---|---|---|
| **Gancho** | 0:00-0:15 | Confirma el título en la primera frase, abre una pregunta que no se puede cerrar sola y deja claro que la respuesta llega. Sin "hola, bienvenidos". |
| **El giro** | 0:15-0:45 | Una frase que dice qué va a hacer el video, y arranca. Sin pedir suscripción. |
| **Cuerpo** | 3 a 5 bloques | Una idea por bloque. Cada bloque termina con una mini-pregunta que empuja al siguiente. |
| **La vuelta de tuerca** | ~60% del video | El dato que nadie esperaba. Es lo que la gente comenta. |
| **La respuesta** | penúltimo minuto | Se responde la pregunta del gancho, explícitamente. |
| **Cierre** | 15-20 s | Un solo pedido: "si te gustó esta, mirá la de [otro video del canal]". |

Cada bloque del guion lleva su `[EN PANTALLA: …]`. Si no hay nada que mirar, es un podcast.

## 4. Estilo visual

- **Imágenes:** ilustraciones generadas con IA en un estilo fijo para todo el canal (por ejemplo
  ilustración tipo archivo vintage, colores apagados). **No fotorrealista** con jugadores reales:
  confunde y obliga a etiquetarlo como contenido alterado.
- **Recursos:** mapas, recortes de diario recreados, textos grandes en pantalla, estadísticas
  animadas simples.
- **Ritmo:** cambio de imagen cada 3-5 segundos.
- **Prohibido:** imágenes de partidos de la tele (Content ID las detecta y reclama el video).
- **Al subir:** marcar "contenido alterado o sintético" cuando haya imágenes realistas.

## 5. Miniatura y título

- La miniatura y el título son una sola unidad: **la miniatura no repite el título**.
- Máximo **3 palabras** en la miniatura.
- El título lleva un **nombre, un número o un lugar** concreto (puntúa mejor en `yt-package`).
- Título de menos de 40 caracteres si se puede (lo que se ve en el celular).

## 6. Shorts

Tres por cada video largo, sacados de ese video con `yt-shorts`:
- 20-55 segundos, se entienden sin haber visto el largo.
- Primera frase nueva, escrita para el Short.
- Texto en pantalla los primeros 2 segundos.

## 7. La semana (7 horas)

| Día | Qué sale | Trabajo |
|---|---|---|
| Lun-Mié | — | Guion (Claude + `yt-script`), verificación de datos, grabar la voz |
| Jue-Vie | Short (jueves) | Imágenes y edición del largo |
| **Sábado** | **Video largo** | Título y miniatura (`yt-package`), descripción (`yt-seo`), subir |
| Domingo | Short | Cortar los 3 Shorts (`yt-shorts`) |
| Martes siguiente | Short | — |

Si la semana se complica, se caen los Shorts, nunca el largo.

## 8. Herramientas

| Paso | Herramienta |
|---|---|
| Guion, títulos, descripción | Claude con las skills `yt-*` |
| Voz | Celular + un lugar sin eco (adentro de un placard funciona); limpieza en CapCut |
| Imágenes | Un generador de imágenes con IA, siempre con el mismo estilo |
| Edición | CapCut |
| Miniaturas | Canva (Claude puede armarlas directo en Canva) |

## 9. Reglas que no se rompen

1. **Todo dato se verifica antes de grabar.** Un error en un canal de historias se paga en los
   comentarios.
2. Nada de clips de partidos de la tele.
3. Contenido con IA realista se etiqueta al subir.
4. Respeto con las personas reales: se cuenta, no se humilla.
