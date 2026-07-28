/**
 * Centralized user-facing strings for Focube.
 *
 * All text uses consistent voseo (vos) register per the Voice & Tone Guide (§9).
 * Import from here instead of inlining strings in components.
 *
 * ## Convention
 * - `hero` — page-level headings and descriptions
 * - `states` — idle, paused, focus hint
 * - `timer` — session lifecycle messages
 * - `controls` — button and action labels
 * - `onboarding` — first-visit hints
 * - `aria` — screen-reader labels
 * - `notifications` — browser notification body
 * - `panel` — section headings and labels inside the control panel
 */

export const copy = {
  brand: "Focube",

  hero: {
    title: "Girá el cubo. El tiempo arranca solo.",
    subtitle:
      "Girá y soltá: la cara de arriba elige el tiempo y arranca sola. ¿Necesitás una pausa? Poné el reloj arriba.",
    eyebrow: "Focube",
  },

  states: {
    idle: "Listo cuando vos quieras. Girá una cara para arrancar.",
    paused: "En pausa. Seguís cuando quieras.",
    focusHint:
      "Solo vos y el cubo, a pantalla completa. El ambiente te acompaña.",
    pipPlaceholderTitle: "Cubo en el mini reproductor",
    pipPlaceholderDesc: "Cerrá la ventana flotante para traerlo de vuelta.",
  },

  timer: {
    pomodoroStart: (cycle: number, total: number) =>
      `A concentrarse. Bloque ${cycle} de ${total}.`,
    pomodoroResumed: "Pomodoro reanudado.",
    pomodoroDone: "¡Cuatro bloques! Gran sesión, te la ganaste.",
    countdownDone: "¡Listo! Bloque completo.",
    phaseComplete: (phase: string, cycle: number, total: number) =>
      `Fase completa. Siguiente: ${phase} ${cycle} de ${total}.`,
    customStart: (minutes: number) => `Listo: ${minutes} minutos. A darle.`,
    resumed: (label: string) => `Seguimos con ${label}.`,
    paused: "En pausa. Seguís cuando quieras.",
    faceStarted: (label: string, minutes: number) =>
      `Cara ${label} arriba. Cuenta regresiva de ${minutes} minutos.`,
    customStarted: (minutes: number) =>
      `Cuenta regresiva personalizada de ${minutes} minutos.`,
    break: (cycle: number, total: number) =>
      `Respirá. Descanso ${cycle} de ${total}.`,
    reset: "Cubo reiniciado en modo reloj.",
  },

  controls: {
    clock: "Reloj · Pausá cuando quieras",
    try25: "Probá 25 min",
    share: "Compartir mi setup",
    testAlert: "Probar alarma",
    feedback: "¿Ideas? Contanos",
    proTeaser: "Pronto: más sonidos, temas y estadísticas",
    start: "Iniciar",
    pause: "Pausar",
    reset: "Reiniciar",
    focus: "Focus",
    exit: "Salir",
    mini: "Mini",
    pomodoro: "Pomodoro",
    addAlarm: (count: number, limit: number) =>
      `Añadir alarma (${count}/${limit})`,
  },

  onboarding: {
    hint: "Girá y soltá — arranca solo",
    cta: "Probá 25 min",
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
    pomodoroAction: "25 / 5 · 4 ciclos",
    clockAction: "Pausa la cuenta",
    cycle: (cycle: number, total: number) => `Ciclo ${cycle}/${total}`,
    work: "Trabajo",
    break: "Descanso",
    stateLabel: "Estado",
    arriba: "Arriba",
    soltar: "Soltar",
    clic: "Clic",
    faceUnknown: "—",
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
    cube: "Cubo Focube interactivo. Arrastralo para voltearlo. Teclas 5, 1, 3, 6 para las caras numéricas, P para pomodoro y C para el reloj.",
    ledValue: (time: string, mode: string) =>
      `Tiempo restante: ${time}, modo ${mode}`,
    activateAlarm: (id: string) => `Activar alarma ${id}`,
    alarmTime: (id: string) => `Hora de la alarma ${id}`,
    deleteAlarm: (id: string) => `Eliminar alarma ${id}`,
  },

  notifications: {
    timerComplete: (mode: string, minutes: number) =>
      `¡Listo! Bloque de ${minutes} min — ${mode}`,
    alarm: (time: string) => `Alarma ${time}.`,
    pomodoroDone: "Pomodoro completo. Volviendo a modo reloj.",
    countdownDone: "Tiempo cumplido. Volviendo a modo reloj.",
  },
} as const;

export type Copy = typeof copy;
