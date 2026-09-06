export const SNAPSHOT_PADDING = 24;

export function contentBounds(rectangles, padding = SNAPSHOT_PADDING) {
  const visible = rectangles.filter(rect => rect && rect.width > 0 && rect.height > 0 && rect.visible !== false);
  if (!visible.length) return null;
  const left = Math.min(...visible.map(rect => rect.left)) - padding;
  const top = Math.min(...visible.map(rect => rect.top)) - padding;
  const right = Math.max(...visible.map(rect => rect.left + rect.width)) + padding;
  const bottom = Math.max(...visible.map(rect => rect.top + rect.height)) + padding;
  return { left, top, right, bottom, width: Math.ceil(right - left), height: Math.ceil(bottom - top) };
}

export function outputDimensions(bounds, scale) {
  return { width: Math.ceil(bounds.width * scale), height: Math.ceil(bounds.height * scale) };
}

export function validateRasterSize({ width, height }, { maxDimension = 16384, maxPixels = 67_108_864 } = {}) {
  if (width < 1 || height < 1) return "Nothing to snapshot.";
  if (width > maxDimension || height > maxDimension || width * height > maxPixels) {
    return `The requested ${width.toLocaleString()} × ${height.toLocaleString()} image is too large for a safe browser canvas. Choose a lower scale.`;
  }
  return "";
}
