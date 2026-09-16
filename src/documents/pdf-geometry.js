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

/** Validate a rectangle without coercing or repairing it.  Diagnostics must call
 * this before any rendering normalization so NaN/Infinity/undefined survive as
 * evidence. `space` is deliberately required in the returned record. */
export function validateFiniteRect(raw, { space="unknown", allowZeroArea=false }={}) {
  const errors=[];
  const values={};
  for(const key of ["x","y","width","height"]){
    const value=raw?.[key];
    values[key]=value;
    if(typeof value!=="number")errors.push({code:"NOT_NUMBER",field:key,value:value===undefined?"undefined":String(value)});
    else if(!Number.isFinite(value))errors.push({code:"NON_FINITE",field:key,value:String(value)});
  }
  if(typeof raw?.width==="number"&&Number.isFinite(raw.width)&&raw.width<0)errors.push({code:"NEGATIVE_DIMENSION",field:"width",value:raw.width});
  if(typeof raw?.height==="number"&&Number.isFinite(raw.height)&&raw.height<0)errors.push({code:"NEGATIVE_DIMENSION",field:"height",value:raw.height});
  if(!allowZeroArea&&((raw?.width===0)||(raw?.height===0)))errors.push({code:"ZERO_AREA",field:raw.width===0?"width":"height",value:0});
  return Object.freeze({ok:errors.length===0,space,raw:Object.freeze(values),errors:Object.freeze(errors),rect:errors.length?null:Object.freeze({...values})});
}

/** PDF points (bottom-left origin) -> viewport-local CSS pixels (top-left
 * origin). Returns a named rectangle rather than the legacy tuple. */
export function pdfRectToViewportRect(pdfRect, viewport) {
  const validation=validateFiniteRect(pdfRect,{space:"pdf-points"});
  if(!validation.ok)return {...validation,outputSpace:"viewport-css-pixels"};
  const [left,top,right,bottom]=pdfRectToViewport(viewport,pdfRect);
  return {ok:true,inputSpace:"pdf-points",outputSpace:"viewport-css-pixels",rect:{x:left,y:top,width:right-left,height:bottom-top},raw:validation.raw,errors:[]};
}

/** Viewport-local CSS pixels -> PDF points. */
export function viewportLocalRectToPdf(viewportRect, viewport) {
  const validation=validateFiniteRect(viewportRect,{space:"viewport-css-pixels"});
  if(!validation.ok)return {...validation,outputSpace:"pdf-points"};
  return {ok:true,inputSpace:"viewport-css-pixels",outputSpace:"pdf-points",rect:viewportRectToPdf(viewport,{left:viewportRect.x,top:viewportRect.y,width:viewportRect.width,height:viewportRect.height}),raw:validation.raw,errors:[]};
}

/** Client CSS pixels -> viewport-local CSS pixels. */
export function clientRectToViewportLocal(clientRect, viewportClientRect) {
  const a=validateFiniteRect(clientRect,{space:"client-css-pixels"}),b=validateFiniteRect(viewportClientRect,{space:"client-css-pixels",allowZeroArea:true});
  if(!a.ok||!b.ok)return {ok:false,inputSpace:"client-css-pixels",outputSpace:"viewport-css-pixels",raw:{clientRect,viewportClientRect},errors:[...a.errors,...b.errors]};
  return {ok:true,inputSpace:"client-css-pixels",outputSpace:"viewport-css-pixels",rect:{x:a.rect.x-b.rect.x,y:a.rect.y-b.rect.y,width:a.rect.width,height:a.rect.height},raw:{clientRect:a.raw,viewportClientRect:b.raw},errors:[]};
}

/** CSS pixels -> physical device pixels. DPR changes raster resolution only. */
export function cssRectToDevicePixels(rect,devicePixelRatio=1) {
  const validation=validateFiniteRect(rect,{space:"css-pixels"});
  if(!validation.ok||!Number.isFinite(devicePixelRatio)||devicePixelRatio<=0)return {ok:false,inputSpace:"css-pixels",outputSpace:"device-pixels",raw:{rect:validation.raw,devicePixelRatio},errors:[...validation.errors,...(!Number.isFinite(devicePixelRatio)||devicePixelRatio<=0?[{code:"INVALID_DPR",field:"devicePixelRatio",value:String(devicePixelRatio)}]:[])]};
  return {ok:true,inputSpace:"css-pixels",outputSpace:"device-pixels",rect:Object.fromEntries(Object.entries(validation.rect).map(([key,value])=>[key,value*devicePixelRatio])),raw:{rect:validation.raw,devicePixelRatio},errors:[]};
}

export function clampPdfZoom(value) {
  return Math.max(.25, Math.min(5, Number(value) || 1));
}

export function fitPdfScale(mode, pageSize, availableSize) {
  const width = Math.max(1, availableSize.width) / Math.max(1, pageSize.width);
  const height = Math.max(1, availableSize.height) / Math.max(1, pageSize.height);
  return clampPdfZoom(mode === "width" ? width : Math.min(width, height));
}
