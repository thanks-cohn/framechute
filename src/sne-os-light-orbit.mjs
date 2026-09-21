/* SNE:OS light orbit: renderer-independent positioning with safe clearance.
 * A user selects any initial direction/position. One full circle returns to the
 * same bearing, then the primary invisible light switches to moonlight.
 * No geometry or visible celestial body is required to render the source.
 */
const TWO_PI = Math.PI * 2;
export const clampNumber = (value, low, high, fallback) =>
  Number.isFinite(Number(value)) ? Math.max(low, Math.min(high, Number(value))) : fallback;

export function safeOrbit(settings = {}, boundsRadius = 3) {
  const safeExtent = clampNumber(boundsRadius, 0.1, 100000, 3);
  const clearance = clampNumber(settings.clearance, 1, 2000, 3);
  const minRadius = safeExtent + clearance;
  const requested = Array.isArray(settings.startPosition) ? settings.startPosition : [0, 6, 12];
  const [x, y, z] = requested.map((v, i) => clampNumber(v, -100000, 100000, [0, 6, 12][i]));
  const horizontal = Math.hypot(x, z);
  const length = Math.hypot(horizontal, y);
  // An unsafe input is projected onto the outer safe orbit, never placed inside the model.
  const radius = Math.max(minRadius, length);
  const azimuth = horizontal < 0.000001 ? 0 : Math.atan2(x, z);
  const elevation = length < 0.000001 ? 0.4 : Math.atan2(y, horizontal);
  return {
    center: [0, 0, 0],
    radius,
    minRadius,
    azimuth,
    elevation: Math.max(-1.45, Math.min(1.45, elevation)),
    periodMs: clampNumber(settings.orbitDurationMs, 4000, 3600000, 28000),
    moonIntensityFactor: clampNumber(settings.moonIntensityFactor, 0.05, 1, 0.4),
    visibleBody: false
  };
}

export function orbitAt(orbit, elapsedMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const revolutions = elapsed / orbit.periodMs;
  const phi = orbit.azimuth + TWO_PI * (revolutions % 1);
  const level = Math.cos(orbit.elevation) * orbit.radius;
  return {
    position: [
      orbit.center[0] + Math.sin(phi) * level,
      orbit.center[1] + Math.sin(orbit.elevation) * orbit.radius,
      orbit.center[2] + Math.cos(phi) * level
    ],
    mode: revolutions >= 1 ? "moon" : "sun",
    phase: revolutions % 1,
    completedOrbit: revolutions >= 1
  };
}
