# PRD — Mejoras de experiencia · Focube (versión gratis)

**Autor:** Producto / UX
**Fecha:** 2026-07-27
**Estado:** Propuesta
**Alcance:** Versión gratuita (web). Foco en experiencia, activación y atractivo. Fuera de alcance las funcionalidades complejas o de pago.

---

## 1. Contexto

Focube es un temporizador Pomodoro en forma de cubo 3D interactivo que se controla girándolo (dial de 5/10/30/60), con cara de reloj que pausa, modo Pomodoro (el cubo se transforma en tomate), Focus mode con ambiente sonoro, mini reproductor (Picture-in-Picture), alarmas, cronómetro y cuenta regresiva personalizada.

El producto **ya funciona y se ve bien**. El problema no es capacidad, es **experiencia de entrada y de retorno**: hoy la app no guía el primer uso, no recuerda nada entre visitas y no aprovecha momentos de deleite que la harían memorable y compartible.

Este documento prioriza mejoras de **alto impacto y bajo esfuerzo** que aumenten la probabilidad de que la gente la use, vuelva y la comparta — sin agregar complejidad.

---

## 2. Objetivo y métricas

**North Star:** sesiones de enfoque **completadas** por semana (un timer o pomodoro que llega a 0).

Métricas de apoyo:

| Métrica | Definición | Por qué importa |
|---|---|---|
| **Activación** | % de visitantes que inician un timer en < 30 s desde que carga | Mide si el primer uso es obvio |
| **Time-to-first-timer** | Tiempo mediano hasta el primer conteo | Fricción de entrada |
| **Retorno D7** | % que vuelve dentro de 7 días | Depende de recordar ajustes y de ser útil de verdad |
| **Sesiones/visita** | Timers iniciados por sesión | Engagement dentro de la visita |
| **Compartidos** | Clics en "compartir"/instalaciones PWA | Alcance orgánico |

> Sin cuentas ni backend: todo se mide con analítica de eventos anónima y estado en `localStorage`.

---

## 3. Principios de diseño (para la versión gratis)

1. **Que funcione en 5 segundos.** El primer timer debe poder arrancar sin leer nada.
2. **Recordar, no repreguntar.** Si el usuario eligió algo una vez, no volver a pedirlo.
3. **Un momento memorable por sesión.** El fin de cuenta y el tomate son oportunidades de deleite; explotarlas.
4. **Menos es más al inicio.** Mostrar lo esencial; lo avanzado, a un clic.
5. **Respetar al usuario.** Movimiento y sonido opcionales; nada intrusivo; accesible.
6. **Gratis generosa, Pro insinuada.** La versión gratis se siente completa; lo premium se sugiere sin molestar.
7. **Hablar como un compañero de foco.** Cada palabra en pantalla suma calidez y confianza, o sobra. La voz es parte del producto, no decoración (ver §9).

---

## 4. Mejoras priorizadas

Cada ítem: **qué**, **por qué** (lente UX/CS), **impacto/esfuerzo** y **nota de alcance gratis**.

### P0 — Máxima prioridad (activación + retorno, bajo esfuerzo)

#### P0.1 · Persistencia local de preferencias
- **Qué:** Guardar en `localStorage` el acabado del cubo, tipo de alerta, soundscape de focus, últimos minutos personalizados y alarmas configuradas. Restaurarlos al volver.
- **Por qué:** Hoy todo se reinicia en cada recarga. Un usuario que vuelve pierde su setup, lo que penaliza directamente la retención D7. Recordar es la mejora de retención más barata que existe.
- **Impacto:** Alto · **Esfuerzo:** Bajo
- **Gratis:** Sí. No requiere cuenta ni servidor.

#### P0.2 · Tiempo restante en el título de la pestaña
- **Qué:** Reflejar el conteo en `document.title` (p. ej. `24:59 · Trabajo — Focube`) y restaurar el título al terminar.
- **Por qué:** Un temporizador se usa mientras trabajás en **otra** pestaña. Sin esto, la app es inútil en segundo plano. Es la mejora de utilidad real más grande por línea de código.
- **Impacto:** Alto · **Esfuerzo:** Muy bajo
- **Gratis:** Sí.

#### P0.3 · Primer uso guiado en 1 gesto + CTA de arranque
- **Qué:** En la primera visita (detectada por `localStorage`), resaltar/pulsar las flechas del dial y mostrar un microcopy de un renglón: "Girá y soltá — arranca solo". Sumar un CTA primario visible: **"Probá 25 min"** que inicie un Pomodoro al instante.
- **Por qué:** El valor del producto es "flip to start", pero un primer visitante no lo sabe. Un empujón de un gesto baja el time-to-first-timer. El CTA da un camino de un clic para quien no quiere explorar.
- **Impacto:** Alto · **Esfuerzo:** Bajo
- **Gratis:** Sí. Se descarta tras el primer uso.

#### P0.4 · Celebración de fin de cuenta (micro-deleite) + probar alarma
- **Qué:** Al llegar a 0, un momento satisfactorio y breve: el anillo se completa/estalla suave, un pulso de color y un chime agradable (ya existe el beep; mejorarlo). Botón **"Probar alarma"** en Tipo de alerta para escucharla antes.
- **Por qué:** El cierre de una sesión es el pico emocional; hoy es apenas un flash. Un final memorable genera hábito y ganas de compartir. "Probar alarma" elimina la ansiedad de "¿sonará?".
- **Impacto:** Medio-alto · **Esfuerzo:** Bajo
- **Gratis:** Sí.

#### P0.5 · Accesibilidad y respeto al movimiento
- **Qué:** Soportar `prefers-reduced-motion` (atenuar el giro con resorte, el pulso de alarma y el tomate). Verificar contraste de chips de acento. Etiqueta ARIA del valor LED para lectores de pantalla. Revisar uso táctil en móvil (arrastre, tamaño de las flechas, sin robar el scroll).
- **Por qué:** Amplía el público (accesibilidad + móvil = más alcance y menos rebote), y evita mareos/molestias que hacen cerrar la pestaña.
- **Impacto:** Medio-alto · **Esfuerzo:** Bajo-medio
- **Gratis:** Sí.

#### P0.6 · Voz y tono para retener
- **Qué:** Reescribir todos los microtextos de la app (hero, leyenda, mensajes de estado/`aria-live`, hints del panel, mensajes de fin de cuenta y pausa) con una voz consistente y cálida, según la **Guía de voz y tono (§9)**. Incluye una decisión pendiente y bloqueante: **unificar el registro** (hoy conviven "Gira/Usa" en tú con "Girá/soltá" en voseo — es una inconsistencia que se lee como descuido).
- **Por qué:** El texto es el 80 % de la conversación con el usuario y hoy suena a manual técnico neutro. Un tono de "compañero de foco" —cercano, sereno, alentador— genera vínculo, baja la sensación de fricción y convierte cada pausa/fin de sesión en un refuerzo positivo que invita a volver. Es la palanca de retención más barata que existe: cambia percepción sin tocar una sola funcionalidad.
- **Impacto:** Alto (retención + percepción de marca) · **Esfuerzo:** Muy bajo
- **Gratis:** Sí. Es solo copy.

### P1 — Alta prioridad (deleite, alcance, hábito)

#### P1.1 · Preview de los sonidos de Focus
- **Qué:** Botón de escucha rápida en cada opción de Modo focus (Tic-tac / Deep focus / Tic-tac + focus) para oír 2–3 s antes de comprometerse.
- **Por qué:** El ambiente sonoro es un diferenciador atractivo, pero hoy hay que entrar a Focus para escucharlo. Preview = descubrimiento sin fricción.
- **Impacto:** Medio · **Esfuerzo:** Bajo
- **Gratis:** Sí.

#### P1.2 · Estado compartible por URL (deep link)
- **Qué:** Codificar la configuración actual (modo, minutos, acabado, soundscape) en la URL. "Compartir mi setup de focus" copia un link que abre la app ya configurada.
- **Por qué:** Viralidad ligera y sin costo: el mejor marketing de una herramienta de foco es un usuario compartiéndola. También sirve como "guardar preset".
- **Impacto:** Medio · **Esfuerzo:** Bajo-medio
- **Gratis:** Sí.

#### P1.3 · Notificación del navegador al terminar (pestaña oculta)
- **Qué:** Con permiso explícito y opt-in, mostrar una notificación del sistema cuando el timer llega a 0 y la pestaña no está visible (`document.hidden`).
- **Por qué:** Complementa P0.2: si el sonido está bajo o silenciado, la notificación asegura que el usuario se entere. Sube la confianza en el producto como herramienta seria.
- **Impacto:** Medio · **Esfuerzo:** Bajo-medio
- **Gratis:** Sí. Pedir permiso solo cuando aporta valor (no al cargar).

#### P1.4 · PWA instalable
- **Qué:** Manifest + service worker mínimo para "Agregar a la pantalla de inicio / instalar app". Ícono, nombre, arranque offline de la shell.
- **Por qué:** Un temporizador que vive en el dock/escritorio se usa a diario. La instalación es la señal de retención más fuerte que podemos tener sin cuentas.
- **Impacto:** Alto (retención) · **Esfuerzo:** Medio
- **Gratis:** Sí.

#### P1.5 · Divulgación progresiva del panel
- **Qué:** Al inicio mostrar solo lo esencial (Voltear a una cara + acción principal). Agrupar "Desde la cara del reloj", "Tipo de alerta" y "Acabado" en secciones colapsables o una pestaña "Más".
- **Por qué:** El panel derecho es denso para un primer contacto. Menos opciones visibles al inicio = menos parálisis y foco en la acción principal.
- **Impacto:** Medio · **Esfuerzo:** Bajo-medio
- **Gratis:** Sí.

### P2 — Deseables (pulido, hábito ligero, señal de producto)

#### P2.1 · Contador de foco del día (gamificación mínima, sin cuenta)
- **Qué:** "Llevás 3 sesiones hoy" y una racha de días, guardado en `localStorage`.
- **Por qué:** Refuerzo positivo que fomenta volver, sin la complejidad de cuentas ni estadísticas.
- **Impacto:** Medio · **Esfuerzo:** Bajo
- **Gratis:** Sí. (Historial y estadísticas ricas → Pro.)

#### P2.2 · Teaser no intrusivo de Pro
- **Qué:** Una línea sutil ("Pronto: más sonidos, temas y estadísticas") en un lugar natural (p. ej. al pie de Modo focus o Acabado), sin modales ni bloqueos.
- **Por qué:** Prepara el terreno de monetización y comunica que el producto está vivo, sin degradar la experiencia gratis.
- **Impacto:** Bajo (directo) · **Esfuerzo:** Muy bajo
- **Gratis:** Sí.

#### P2.3 · Canal de feedback liviano
- **Qué:** Un enlace discreto "¿Ideas? Contanos" (mailto o formulario externo).
- **Por qué:** Customer success: escuchar temprano y barato guía el roadmap y crea vínculo con los primeros usuarios.
- **Impacto:** Bajo-medio (aprendizaje) · **Esfuerzo:** Muy bajo
- **Gratis:** Sí.

#### P2.4 · Rendimiento y batería
- **Qué:** Estado de carga liviano para la escena 3D; considerar `frameloop="demand"` cuando no hay animación activa para no renderizar en vano.
- **Por qué:** Una app de timer suele quedar abierta horas; no debe calentar el equipo ni gastar batería. Cuida la percepción de calidad.
- **Impacto:** Medio (percepción) · **Esfuerzo:** Bajo-medio
- **Gratis:** Sí.

---

## 5. Fuera de alcance (reservado para Pro / más adelante)

- Cuentas de usuario y sincronización entre dispositivos.
- Estadísticas e historial de productividad.
- Biblioteca ampliada de sonidos/ambientes y temas premium del cubo.
- Integraciones (Google Calendar, Notion, etc.).
- Modo equipos / sesiones compartidas en tiempo real.
- Configuración avanzada de ciclos Pomodoro (duraciones y cantidad personalizadas).

> Estas quedan explícitamente **fuera** para no inflar la versión gratis ni desviar el foco de la experiencia base.

---

## 6. Roadmap sugerido

| Fase | Contenido | Objetivo |
|---|---|---|
| **Sprint 1 (base sólida)** | P0.1, P0.2, P0.3, P0.6 | Activar mejor, no perder al que vuelve y fijar la voz de marca desde el día 1 |
| **Sprint 2 (deleite)** | P0.4, P0.5, P1.1 | Momentos memorables + accesible + descubrir el sonido |
| **Sprint 3 (alcance)** | P1.2, P1.3, P1.4 | Compartir, notificar, instalar |
| **Sprint 4 (pulido)** | P1.5, P2.1–P2.4 | Menos fricción, hábito ligero, señal de producto |

---

## 7. Criterios de éxito

- **Activación** sube de forma medible (meta inicial: > 60 % inicia un timer en < 30 s).
- **Time-to-first-timer** por debajo de ~10 s en la mediana.
- **Retorno D7** mejora tras P0.1 + P1.4 (persistencia + PWA).
- Al menos **un momento de deleite** verificado por sesión (fin de cuenta) sin quejas de accesibilidad.
- Aparecen **compartidos/instalaciones** orgánicos como señal de atractivo.
- **Voz consistente**: un registro único en el 100 % de los textos y percepción cálida validada con 5–8 usuarios ("¿cómo describirías el tono?" → esperado: cercano, tranquilo, motivador; no frío ni técnico).

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Autoplay de audio bloqueado por el navegador | Armar audio en el primer gesto (ya se hace); "Probar alarma" y aviso visual claro |
| Notificaciones percibidas como intrusivas | Opt-in explícito, pedir permiso solo al activar, nunca al cargar |
| PWA/offline agrega complejidad de mantenimiento | Service worker mínimo (solo shell), sin caché agresiva de estado |
| Gamificación que presione en vez de motivar | Mantenerla opcional, positiva y descartable; nada de rachas "castigadoras" |
| Sobrecargar la versión gratis | Respetar la sección "Fuera de alcance"; toda feature nueva pasa por "¿mejora la experiencia base o agrega complejidad?" |
| Tono que cansa o distrae del foco | Chispa con moderación; en sesión, casi sin palabras; celebrar breve, nunca en cadena de signos; registro único y revisado (§9) |

---

## 9. Guía de voz y tono

> Objetivo: que la app **suene** como un buen compañero de foco. La voz genera confianza y calidez; la calidez retiene. Esta guía es la base de la tarea **P0.6**.

### 9.1 Personalidad (la voz — constante)

Focube es **un compañero de foco sereno y alentador**. No es un coach que grita ni un manual de instrucciones. Piensa en un amigo tranquilo que te ayuda a concentrarte: te da lo justo, en el momento justo, y se calla cuando tenés que trabajar.

Cuatro atributos de voz:

1. **Cercano** — te habla a vos, como una persona, no como un sistema.
2. **Sereno** — es una herramienta de foco: frases cortas, sin apuro, sin ruido.
3. **Alentador** — refuerza lo logrado; nunca reta ni culpa.
4. **Con chispa (sutil)** — un guiño de juego (el tomate 🍅), usado con cuentagotas y jamás a costa de la claridad.

### 9.2 Decisión de registro (bloqueante)

Hoy el copy mezcla **tú** ("Gira", "Usa", "arrastra") con **voseo** ("Girá", "soltá"). Eso se lee como descuido y hay que unificarlo.

- **Recomendación:** **voseo** en toda la app. Es más cálido y cercano para el público principal, y coincide con la voz de la marca.
- **Alternativa:** si el mercado objetivo es pan-hispano/España, usar imperativo neutro impersonal ("Girá" → "Girar" / "Soltá para arrancar" → "Soltar para arrancar") o "tú".
- **Innegociable:** un solo registro, en el 100 % de los textos (UI, `aria-live`, hints, mensajes de fin).

*Los ejemplos de abajo usan la recomendación (voseo).*

### 9.3 El tono se adapta al momento

La voz es constante; el **tono** cambia según dónde está el usuario:

| Momento | Tono | Ejemplo |
|---|---|---|
| Primer uso / onboarding | Invitador, simple | "Girá el cubo y soltá. Arranca solo." |
| En sesión (foco activo) | Casi mudo, no distraer | Deja hablar al LED; nada de mensajes |
| Pausa | Tranquilizador, sin culpa | "En pausa. Seguís cuando quieras." |
| Fin de cuenta / logro | Cálido y breve | "¡Listo! Un bloque menos. 🍅" |
| Descanso (Pomodoro) | Permisivo, amable | "Respirá. Descanso 2 de 4." |
| Vacío / en reposo | Orientador suave | "Listo cuando vos quieras. Girá una cara para arrancar." |
| Error / permiso denegado | Humano, con salida | "No pudimos activar el sonido. Tocá una vez y listo." |

### 9.4 Reglas rápidas

**Hacer**
- Verbo de acción primero, frases cortas.
- Hablar de "vos", en singular y humano.
- Celebrar el progreso, corto y genuino.
- Nombrar el beneficio, no el mecanismo ("a concentrarse", no "iniciando countdown").

**Evitar**
- Jerga técnica en pantalla: *countdown, toggle, display, LED* como etiquetas para el usuario.
- Signos de admiración en cadena o mayúsculas gritadas.
- Culpar o presionar: "perdiste tu racha", "no completaste".
- Textos largos durante el foco.
- Mezclar registros (vos/tú).

### 9.5 Reescrituras concretas (antes → después)

Sobre los textos reales de la app:

| Lugar | Antes | Después (voseo) |
|---|---|---|
| Título (H1) | El cubo Pomodoro que se controla volteándolo. | Girá el cubo. El tiempo arranca solo. |
| Intro (hero) | Gira el dial y suelta: la cara que queda arriba define el modo y arranca sola. La cara del reloj pausa la cuenta y volver a la misma cara la reanuda. | Girá y soltá: la cara de arriba elige el tiempo y arranca sola. ¿Necesitás una pausa? Poné el reloj arriba. |
| Reposo (`aria-live`) | Cubo en modo reloj. Gira una cara hacia arriba. | Listo cuando vos quieras. Girá una cara para arrancar. |
| Pausa | Reloj arriba. Cuenta en pausa. | En pausa. Seguís cuando quieras. |
| Reanudar | Cuenta reanudada en 10. | Seguimos con los 10. |
| Inicio Pomodoro | Pomodoro iniciado. Bloque de trabajo 1 de 4. | A concentrarse. Bloque 1 de 4. |
| Fin de cuenta | Tiempo cumplido. Volviendo a modo reloj. | ¡Listo! Bloque completo. 🍅 |
| Fin de Pomodoro | Pomodoro completo. Volviendo a modo reloj. | ¡Cuatro bloques! Gran sesión, te la ganaste. |
| Personalizado | Cuenta regresiva personalizada de 25 minutos. | Listo: 25 minutos. A darle. |
| Hint Focus | Pantalla completa sólo con el cubo. El ambiente suena mientras Focus está activo. | Solo vos y el cubo, a pantalla completa. El ambiente te acompaña. |
| Botón Reloj (panel) | Reloj · Pausa la cuenta | Reloj · Pausá cuando quieras |

### 9.6 Alcance y aplicación

- Los textos viven en `src/pages/Home.tsx` (hero, leyenda, chips, hints, mensajes `setLiveMessage`) y en las etiquetas de los controles.
- Los mensajes `aria-live` también los leen lectores de pantalla: mantener claros y con la misma voz.
- Idealmente, centralizar los strings en un solo módulo (p. ej. `src/copy.ts`) para mantener consistencia y facilitar futuras traducciones.

### 9.7 Cómo lo medimos

- Cualitativo (5–8 usuarios): "¿cómo describirías el tono de la app?" → esperado: *cercano, tranquilo, motivador*.
- Proxy cuantitativo: mejora en retorno D7 y en sesiones completadas tras el rediseño de copy (junto a P0.1/P0.4).
- Checklist de consistencia: 0 textos con registro mezclado; 0 tecnicismos en pantalla de cara al usuario.
