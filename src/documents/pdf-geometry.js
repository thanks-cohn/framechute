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

/** Named diagnostic shape for viewport-local CSS pixels. */
export function pdfRectToViewportRect(viewport, rect) {
  const [left, top, right, bottom] = pdfRectToViewport(viewport, normalizePdfRect(rect));
  return { left, top, width:right-left, height:bottom-top };
}

export function normalizePdfRect(rect = {}) {
  let x=Number(rect.x)||0,y=Number(rect.y)||0,width=Number(rect.width)||0,height=Number(rect.height)||0;
  if(width<0){x+=width;width=-width;} if(height<0){y+=height;height=-height;}
  return {x,y,width,height};
}

/** Convert a viewport-local rectangle to browser client/workspace coordinates. */
export function viewportLocalRectToClient(rect, viewportElementRect) {
  return {left:rect.left+viewportElementRect.left,top:rect.top+viewportElementRect.top,width:rect.width,height:rect.height};
}

export function cssRectToDevicePixels(rect, devicePixelRatio=1) {
  const ratio=Math.max(0,Number(devicePixelRatio)||1);
  return Object.fromEntries(Object.entries(rect).map(([key,value])=>[key,Number(value)*ratio]));
}

export function pdfBaselineToViewport(viewport, baseline) {
  const point=viewport.convertToViewportPoint(baseline.x,baseline.y);
  return {left:point[0],top:point[1]};
}

export function clampPdfZoom(value) {
  return Math.max(.25, Math.min(5, Number(value) || 1));
}

export function fitPdfScale(mode, pageSize, availableSize) {
  const width = Math.max(1, availableSize.width) / Math.max(1, pageSize.width);
  const height = Math.max(1, availableSize.height) / Math.max(1, pageSize.height);
  return clampPdfZoom(mode === "width" ? width : Math.min(width, height));
}
