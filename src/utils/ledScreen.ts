import * as THREE from "three";
import { drawSevenSegmentText, measureText } from "./sevenSegment";

export type LedScreenContent = {
  primary: string;
  secondaryLabel: string;
  secondaryValue: string;
  caption: string;
  accent: string;
  alarmCount: number;
  alarmsEnabled: boolean[];
  muted: boolean;
  vibrate: boolean;
  showHourglass: boolean;
  showTomato: boolean;
  dimPrimary: boolean;
  alerting: boolean;
};

const SIZE = 1024;
const CENTRE = SIZE / 2;

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

/**
 * Paints the whole LED face to a canvas so it lives in the 3D scene. A DOM
 * overlay drifts out of alignment with the cube while it animates, because the
 * overlay transform and the WebGL frame are updated independently.
 */
export function createLedScreenTexture(content: LedScreenContent) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, SIZE, SIZE);

  // Bake the whole screen as a soft rounded rectangle with transparent margins.
  // Rendered on a flat plane, this leaves no hard geometry edge to draw a black
  // line against light or coloured finishes.
  const inset = 46;
  const radius = 150;
  context.fillStyle = content.alerting ? "#2a0d0d" : "#05070a";
  roundedRect(context, inset, inset, SIZE - inset * 2, SIZE - inset * 2, radius);
  context.fill();

  drawStatusRow(context, content);
  drawMarkerRow(context, content);

  const primaryHeight = 210;
  const primaryWidth = measureText(content.primary, primaryHeight, 10);
  context.save();
  if (content.dimPrimary) {
    context.globalAlpha = 0.16;
  }
  drawSevenSegmentText(
    context,
    content.primary,
    CENTRE - primaryWidth / 2,
    CENTRE - 96,
    primaryHeight,
    { color: content.accent, gap: 10 },
  );
  context.restore();

  drawSecondary(context, content);

  context.fillStyle = "rgba(214, 226, 238, 0.5)";
  context.font = '600 33px "Arial", system-ui, sans-serif';
  context.textAlign = "center";
  context.fillText(content.caption.toUpperCase(), CENTRE, CENTRE + 258);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.anisotropy = 8;
  return texture;
}

function drawStatusRow(
  context: CanvasRenderingContext2D,
  content: LedScreenContent,
) {
  const y = CENTRE - 168;
  context.textAlign = "center";
  context.font = '600 30px "Arial", system-ui, sans-serif';

  context.fillStyle = content.muted
    ? "rgba(143, 216, 242, 0.22)"
    : "#8fd8f2";
  context.fillText(content.vibrate ? "((•))" : "((o", CENTRE - 78, y);

  // Battery pips.
  context.fillStyle = "#8fd8f2";
  for (let index = 0; index < 3; index += 1) {
    context.fillRect(CENTRE - 16 + index * 16, y - 20, 11, 20);
  }

  context.fillStyle = content.muted ? "#ff5a5a" : "rgba(143, 216, 242, 0.22)";
  context.beginPath();
  context.arc(CENTRE + 74, y - 10, 13, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = content.muted ? "#ff5a5a" : "rgba(143, 216, 242, 0.22)";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(CENTRE + 64, y - 20);
  context.lineTo(CENTRE + 84, y);
  context.stroke();
}

function drawMarkerRow(
  context: CanvasRenderingContext2D,
  content: LedScreenContent,
) {
  const y = CENTRE - 126;
  context.lineWidth = 3;
  context.font = '600 22px "Arial", system-ui, sans-serif';
  context.textAlign = "center";

  for (let index = 0; index < 3; index += 1) {
    const x = CENTRE - 92 + index * 42;
    const on = content.alarmsEnabled[index];
    context.strokeStyle = on ? "#8fd8f2" : "rgba(143, 216, 242, 0.2)";
    context.strokeRect(x - 15, y - 15, 30, 30);
    context.fillStyle = on ? "#8fd8f2" : "rgba(143, 216, 242, 0.2)";
    context.fillText(String(index + 1), x, y + 8);
  }

  context.fillStyle = content.showHourglass
    ? "#8fd8f2"
    : "rgba(143, 216, 242, 0.2)";
  context.font = '600 34px "Arial", system-ui, sans-serif';
  context.fillText("⧗", CENTRE + 34, y + 11);

  context.fillStyle = content.showTomato ? "#ff5a3a" : "rgba(143, 216, 242, 0.2)";
  context.beginPath();
  context.arc(CENTRE + 96, y, 14, 0, Math.PI * 2);
  context.fill();
}

function drawSecondary(
  context: CanvasRenderingContext2D,
  content: LedScreenContent,
) {
  const height = 68;
  const valueWidth = measureText(content.secondaryValue, height, 5);
  const labelWidth = 66;
  const totalWidth = labelWidth + 16 + valueWidth;
  const startX = CENTRE - totalWidth / 2;
  const y = CENTRE + 132;

  context.fillStyle = "rgba(205, 216, 228, 0.78)";
  context.font = '700 34px "Arial", system-ui, sans-serif';
  context.textAlign = "left";
  context.fillText(content.secondaryLabel.toUpperCase(), startX, y + height * 0.72);

  drawSevenSegmentText(
    context,
    content.secondaryValue,
    startX + labelWidth + 16,
    y,
    height,
    { color: "#e8eef6", gap: 5 },
  );
}
