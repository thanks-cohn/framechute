/**
 * PDF geometry boundary.
 *
 * Persisted geometry is always expressed in PDF points. A PDF.js viewport is
 * used only at the rendering boundary, so zoom, devicePixelRatio, CropBox
 * offsets, and page rotation cannot leak into the document edit model.
 */
export function pdfRectToViewport(viewport, rect) {
  const points = viewport.convertToViewportRectangle([
    rect.x, rect.y, rect.x + rect.width, rect.y + rect.height
  ]);
  return [
    Math.min(points[0], points[2]), Math.min(points[1], points[3]),
    Math.max(points[0], points[2]), Math.max(points[1], points[3])
  ];
}

export function viewportRectToPdf(viewport, rect) {
  const points = viewport.convertToPdfPoint(rect.left, rect.top).concat(
    viewport.convertToPdfPoint(rect.left + rect.width, rect.top + rect.height)
  );
  return {
    x: Math.min(points[0], points[2]),
    y: Math.min(points[1], points[3]),
    width: Math.abs(points[2] - points[0]),
    height: Math.abs(points[3] - points[1])
  };
}

export function clampPdfZoom(value) {
  return Math.max(.25, Math.min(5, Number(value) || 1));
}

export function fitPdfScale(mode, pageSize, availableSize) {
  const width = Math.max(1, availableSize.width) / Math.max(1, pageSize.width);
  const height = Math.max(1, availableSize.height) / Math.max(1, pageSize.height);
  return clampPdfZoom(mode === "width" ? width : Math.min(width, height));
}
