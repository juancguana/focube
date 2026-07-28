/**
 * Centralized user-facing strings for Focube.
 *
 * All text uses neutral Latin American Spanish ("tú" register) per the
 * Voice & Tone Guide (§9). Import from here instead of inlining strings
 * in components — no user-facing literal should live in a component.
 *
 * ## Convention
 * - `hero` — page-level headings and descriptions
 * - `states` — idle, paused, focus hint
 * - `timer` — session lifecycle messages
 * - `controls` — button and action labels
 * - `onboarding` — first-visit hints
 * - `panel` — section headings and labels inside the control panel
 * - `chips` — heads-up display badges over the scene
 * - `aria` — screen-reader-only labels
 * - `notifications` — browser notification bodies (short, no context)
 * - `title` — document title fragments
 * - `links` — outbound URLs
 * - `og` — Open Graph / Twitter card copy (social link previews)
 */

export const copy = {
  brand: "Focube",

  hero: {
    title: "Gira el cubo. El tiempo arranca solo.",
    subtitle:
      "Gira y suelta: la cara de arriba elige el tiempo y arranca sola. ¿Necesitas una pausa? Pon el reloj arriba.",
    eyebrow: "Focube",
  },

  states: {
    idle: "Listo cuando quieras. Gira una cara para arrancar.",
    paused: "En pausa. Continúa cuando quieras.",
    focusHint:
      "Solo tú y el cubo, a pantalla completa. El ambiente te acompaña.",
    pipPlaceholderTitle: "Cubo en el mini reproductor",
    pipPlaceholderDesc: "Cierra la ventana flotante para traerlo de vuelta.",
    legend:
      "Usa las flechas para girar el cubo — cada una dice a qué cara va y qué hace · también puedes arrastrarlo o hacer clic en una cara",
  },

  timer: {
    pomodoroStart: (cycle: number, total: number) =>
      `A concentrarse. Bloque ${cycle} de ${total}.`,
    pomodoroResumed: "Seguimos. El bloque continúa.",
    pomodoroDone: "¡Cuatro bloques! Gran sesión, te la ganaste.",
    countdownDone: "¡Listo! Bloque completo. 🍅",
    started: (minutes: number) => `Listo: ${minutes} minutos. A concentrarse.`,
    resumed: (label: string) => `Seguimos con ${label}.`,
    paused: "En pausa. Continúa cuando quieras.",
    break: (cycle: number, total: number) =>
      `Respira. Descanso ${cycle} de ${total}.`,
    work: "trabajo",
    rest: "descanso",
    reset: "Todo en cero. El reloj te espera.",
    celebration: "¡Listo!",
  },

  controls: {
    clock: "Reloj · Pausa cuando quieras",
    share: "Compartir mi setup",
    shareCopied: "¡Link copiado!",
    shareMessage: "Link copiado. Compártelo y se abre con tu setup.",
    testAlert: "Probar alarma",
    feedback: "¿Ideas? Cuéntanos",
    proTeaser: "Pronto: más sonidos, temas y estadísticas",
    start: "Iniciar",
    pause: "Pausar",
    reset: "Reiniciar",
    focus: "Focus",
    exit: "Salir",
    mini: "Mini",
    pomodoro: "Pomodoro",
    notify: "Avisarme aunque esté en otra pestaña",
    notifyDenied: "El navegador bloqueó las notificaciones. Actívalas y vuelve.",
    addAlarm: (count: number, limit: number) =>
      `Añadir alarma (${count}/${limit})`,
  },

  onboarding: {
    hint: "Gira y suelta — arranca solo",
    cta: "Prueba 25 min",
  },

  panel: {
    flipToFace: "Voltear a una cara",
    fromClockFace: "Desde la cara del reloj",
    focusMode: "Modo focus",
    alertType: "Tipo de alerta",
    finish: "Acabado",
    clock: "Reloj",
    custom: "Personalizado",
    stopwatch: "Cronómetro",
    alarms: "Alarmas",
    sound: "Sonido",
    vibration: "Vibración",
    silent: "Silencioso",
    clockHint:
      "La cara del reloj muestra hora, día y fecha, y pausa cualquier conteo en curso.",
    customRange: (min: number, max: number) =>
      `Cuenta regresiva personalizada (${min}–${max} min)`,
    stopwatchHint: (maxMinutes: number) =>
      `Cuenta hacia arriba hasta ${maxMinutes} minutos.`,
    pomodoroAction: (workMinutes: number) => `${workMinutes} / 5 · 4 ciclos`,
    pomodoroBlockLabel: "Bloque de trabajo",
    pomodoroBlockHint: "El descanso siempre son 5 minutos.",
    pomodoroBlockOption: (multiplier: number, workMinutes: number) =>
      `x${multiplier} · ${workMinutes} min`,
    clockAction: "Pausa la cuenta",
    pauseAction: "Pausa",
    cycle: (cycle: number, total: number) => `Ciclo ${cycle}/${total}`,
    work: "Trabajo",
    break: "Descanso",
    faceUnknown: "—",
    sessionsToday: (count: number) =>
      count === 1 ? "1 sesión hoy" : `${count} sesiones hoy`,
    streakDays: (days: number) => `${days} días seguidos`,
    streakDismiss: "Ocultar por hoy",
  },

  links: {
    feedback: "https://github.com/juancguana/focube/issues",
  },

  og: {
    title: "Focube — temporizador Pomodoro en un cubo 3D",
    description:
      "Gira el cubo y el tiempo arranca solo: temporizador Pomodoro en un cubo 3D que se controla volteándolo.",
    imageAlt:
      "Cubo Focube en verde y negro con el mensaje: gira el cubo, el tiempo arranca solo.",
  },

  chips: {
    arriba: "Arriba",
    estado: "Estado",
    soltar: "Soltar",
    clic: "Clic",
    enPausa: "En pausa",
    reloj: "Reloj",
    pomodoro: "Pomodoro",
    cuentaRegresiva: "Cuenta regresiva",
  },

  aria: {
    cube: "Cubo Focube interactivo. Arrástralo para voltearlo. Teclas 5, 1, 3, 6 para las caras numéricas, P para pomodoro y C para el reloj.",
    readout: (time: string, mode: string) =>
      `Tiempo restante: ${time}, modo ${mode}`,
    readoutClock: (time: string) => `Son las ${time}`,
    readoutStopwatch: (time: string) => `Cronómetro en ${time}`,
    previewSound: (label: string) => `Escuchar ${label}`,
    collapseSection: (section: string) => `Mostrar u ocultar ${section}`,
    activateAlarm: (id: string) => `Activar alarma ${id}`,
    alarmTime: (id: string) => `Hora de la alarma ${id}`,
    deleteAlarm: (id: string) => `Eliminar alarma ${id}`,
    pomodoroBlock: (multiplier: number, workMinutes: number) =>
      `Bloque de trabajo x${multiplier}, ${workMinutes} minutos. El descanso sigue en 5 minutos.`,
  },

  notifications: {
    countdownDone: "¡Listo! Bloque completo.",
    pomodoroDone: "¡Cuatro bloques! Gran sesión.",
    phaseComplete: (phase: string) => `Bloque completo. Ahora ${phase}.`,
    alarm: (time: string) => `Alarma de las ${time}.`,
  },

  title: {
    work: "Trabajo",
    countdown: "Temporizador",
    clock: "Reloj",
    paused: "En pausa",
  },
} as const;

export type Copy = typeof copy;
