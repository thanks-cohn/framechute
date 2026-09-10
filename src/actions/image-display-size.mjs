export function fittedImageSize(naturalWidth, naturalHeight, availableWidth, availableHeight, mode = "contain") {
  if (![naturalWidth, naturalHeight, availableWidth, availableHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  let scale;
  if (mode === "actual") scale = 1;
  else if (mode === "width") scale = availableWidth / naturalWidth;
  else if (mode === "height") scale = availableHeight / naturalHeight;
  else scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight);
  if (mode === "shrink") scale = Math.min(1, scale);
  return { width: Math.max(1, Math.round(naturalWidth * scale)), height: Math.max(1, Math.round(naturalHeight * scale)), scale };
}

export function rotatedImageBounds(width, height, degrees = 0) {
  if (![width, height, degrees].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  const radians = degrees * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  return {
    width: width * cosine + height * sine,
    height: width * sine + height * cosine
  };
}

/**
 * Return a uniform visual scale that keeps every rotated corner inside the
 * original image viewport. A tiny safety inset keeps anti-aliased edge pixels
 * from being clipped by an overflow-hidden frame.
 */
export function rotationContainScale(width, height, degrees = 0, safety = 0.985) {
  const bounds = rotatedImageBounds(width, height, degrees);
  if (!bounds) return 1;
  const raw = Math.min(1, width / bounds.width, height / bounds.height);
  if (raw >= 0.999999) return 1;
  const inset = Number.isFinite(safety) ? Math.min(1, Math.max(0.9, safety)) : 0.985;
  return raw * inset;
}
