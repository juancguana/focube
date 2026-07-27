# Focube

Temporizador Pomodoro en forma de cubo 3D interactivo que se controla girándolo, construido con React, Three.js, `@react-three/fiber` y `@react-three/drei`.

## Funcionalidades

- Cubo 3D con esquinas redondeadas y cuatro caras numéricas.
- Detección de qué cara queda orientada hacia `+Y` usando normales y cuaterniones.
- Inicio automático del timer al soltar el cubo con una cara numérica hacia arriba.
- Doble clic o long-press para usar el valor pequeño alternativo de cada cara.
- Pantalla LED principal, cronómetro secundario y alarma generada con Web Audio API.
- Modo Pomodoro opcional con ciclos `25/5` hasta completar cuatro rondas.
- Selector de color, reset y toggle de sonido.

## Scripts

```bash
npm install
npm run dev
npm run check
npm run lint
npm run test
npm run build
```

## Despliegue con SST

El proyecto incluye `sst.config.ts` para publicar el build estático de Vite.

```bash
npm run sst:dev
npm run sst:deploy
```

## Estructura relevante

- `src/pages/Home.tsx`: interfaz principal y escena 3D.
- `src/utils/cube.ts`: lógica de detección de caras y helpers de tiempo.
- `src/utils/cube.test.ts`: pruebas unitarias.
- `sst.config.ts`: despliegue del sitio estático con SST.
