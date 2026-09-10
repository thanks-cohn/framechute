import * as pdfjs from "../vendor/pdf.mjs";
import { PDFDocument, StandardFonts, rgb, degrees } from "../vendor/pdf-lib.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.mjs", import.meta.url).href;

export const PDF_STANDARD_FONTS = Object.freeze([
  ["Helvetica", StandardFonts.Helvetica], ["Helvetica Bold", StandardFonts.HelveticaBold],
  ["Helvetica Oblique", StandardFonts.HelveticaOblique], ["Times Roman", StandardFonts.TimesRoman],
  ["Times Bold", StandardFonts.TimesRomanBold], ["Times Italic", StandardFonts.TimesRomanItalic],
  ["Courier", StandardFonts.Courier], ["Courier Bold", StandardFonts.CourierBold],
  ["Courier Oblique", StandardFonts.CourierOblique]
]);
const PDF_FONT_MAP = new Map(PDF_STANDARD_FONTS);
export const PDF_SOURCE_MASK_BLEED = 0.75;

export function resolvePdfStandardFont(name) { return PDF_FONT_MAP.get(name) || StandardFonts.Helvetica; }

/** Deterministic width-aware wrapping that preserves explicit lines and whitespace. */
export function wrapPdfText(text, font, size, maxWidth) {
  const width = Math.max(2, Number(maxWidth) || 2), lines = [];
  for (const paragraph of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    if (!paragraph) { lines.push(""); continue; }
    let line = "";
    for (const character of paragraph) {
      const candidate = line + character;
      if (line && font.widthOfTextAtSize(candidate, size) > width) { lines.push(line); line = character; }
      else line = candidate;
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

export async function openPdfDocument(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const task = pdfjs.getDocument({ data: data.slice() });
  const pdf = await task.promise;
  return { bytes: data, pdf, pageCount: pdf.numPages };
}

export async function renderPdfPage(model, pageNumber, canvas, textLayer, edits = []) {
  const page = await model.pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.max(.5, Math.min(2.5, (textLayer.parentElement.clientWidth - 20) / base.width || 1));
  const viewport = page.getViewport({ scale });
  canvas.width = Math.ceil(viewport.width * devicePixelRatio);
  canvas.height = Math.ceil(viewport.height * devicePixelRatio);
  canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
  textLayer.style.width = `${viewport.width}px`; textLayer.style.height = `${viewport.height}px`;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport, transform: devicePixelRatio === 1 ? null : [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0] }).promise;
  const content = await page.getTextContent();
  textLayer.replaceChildren();
  for (const mask of sourceMasksForPage(edits, pageNumber)) {
    const [left, top, right, bottom] = pdfRectToViewport(viewport, mask);
    const element = document.createElement("div");
    element.className = "pdf-source-mask";
    element.setAttribute("aria-hidden", "true");
    Object.assign(element.style, { left: `${left}px`, top: `${top}px`, width: `${right-left}px`, height: `${bottom-top}px` });
    textLayer.append(element);
  }
  content.items.forEach((item, index) => {
    if (!item.str?.trim()) return;
    const [, , , d, x, y] = pdfjs.Util.transform(viewport.transform, item.transform);
    const height = Math.max(8, Math.hypot(item.transform[2], item.transform[3]) * scale);
    const saved = edits.find((edit) => edit.page === pageNumber && edit.index === index);
    const span = document.createElement("span");
    span.className = "pdf-text-item"; span.dataset.index = String(index);
    const text = document.createElement("span"); text.className = "pdf-edit-text"; text.textContent = saved?.replacement ?? item.str; span.append(text);
    if (saved) {
      const [left, top, right, bottom] = pdfRectToViewport(viewport, saved);
      const previewFamily = saved.fontFamily?.startsWith("Times") ? "Times New Roman, serif" : saved.fontFamily?.startsWith("Courier") ? "Courier New, monospace" : "Arial, sans-serif";
      const previewWeight = saved.fontFamily?.includes("Bold") ? "700" : "400";
      const previewStyle = /Oblique|Italic/.test(saved.fontFamily || "") ? "italic" : "normal";
      Object.assign(span.style, { left: `${left}px`, top: `${top}px`, width: `${right-left}px`, height: `${bottom-top}px`, fontSize: `${saved.fontSize * scale}px`, fontFamily: previewFamily, fontWeight: previewWeight, fontStyle: previewStyle });
      span.classList.add("pdf-text-edit");
      const move = document.createElement("button"); move.type="button"; move.className="pdf-move-handle"; move.title="Drag replacement"; move.textContent="↕"; span.append(move);
      const resize = document.createElement("button"); resize.type="button"; resize.className="pdf-resize-handle"; resize.title="Resize replacement field"; resize.setAttribute("aria-label", "Resize replacement field"); span.append(resize);
    } else {
      Object.assign(span.style, { left: `${x}px`, top: `${y - height}px`, width: `${Math.max(item.width * scale, 8)}px`, height: `${height * 1.25}px`, fontSize: `${height}px` });
    }
    textLayer.append(span);
  });
  edits.filter(edit => edit.page === pageNumber && edit.kind === "text").forEach(edit => {
    const saved = normalizePdfEdit(edit), [left, top, right, bottom] = pdfRectToViewport(viewport, saved);
    const span=document.createElement("span");span.className="pdf-text-item pdf-text-edit";span.dataset.index=String(saved.index);
    const text=document.createElement("span");text.className="pdf-edit-text";text.textContent=saved.text;span.append(text);
    Object.assign(span.style,{left:`${left}px`,top:`${top}px`,width:`${right-left}px`,height:`${bottom-top}px`,fontSize:`${saved.fontSize*scale}px`});
    const move=document.createElement("button");move.type="button";move.className="pdf-move-handle";move.title="Drag text field";move.textContent="↕";
    const resize=document.createElement("button");resize.type="button";resize.className="pdf-resize-handle";resize.title="Resize text field";span.append(move,resize);textLayer.append(span);
  });
  return { viewport, content };
}

/** Return the fixed source cover used by both live preview and PDF serialization.
 *  A tiny PDF-point bleed covers glyph antialiasing that can survive an exact
 *  text bounding box. The bleed is intentionally bounded and remains attached
 *  only to immutable source geometry; moving/resizing replacement text cannot
 *  enlarge or relocate the area being covered.
 */
export function sourceMaskForEdit(edit) {
  const sourceX = Number(edit.sourceX ?? edit.x) || 0;
  const sourceY = Number(edit.sourceY ?? edit.y) || 0;
  const sourceWidth = Math.max(Number(edit.sourceWidth ?? edit.width) || 0, 2);
  const sourceHeight = Math.max(Number(edit.sourceHeight ?? edit.height) || 0, 2);
  const requestedBleed = edit.sourceMaskBleed == null ? PDF_SOURCE_MASK_BLEED : Number(edit.sourceMaskBleed);
  const bleed = Math.max(0, Math.min(2, Number.isFinite(requestedBleed) ? requestedBleed : PDF_SOURCE_MASK_BLEED));
  return {
    x: sourceX - bleed,
    y: sourceY - bleed,
    width: sourceWidth + bleed * 2,
    height: sourceHeight + bleed * 2
  };
}

export function sourceMasksForPage(edits, pageNumber) {
  return edits.filter((edit) => edit.page === pageNumber && (edit.kind || "replacement") === "replacement").map(sourceMaskForEdit);
}

/** Normalize legacy replacements and new fields behind one PDF edit-object contract. */
export function normalizePdfEdit(edit) {
  const kind = edit.kind || "replacement";
  return { ...edit, kind, id: edit.id || `${kind}:${edit.page}:${edit.index ?? "new"}`, text: edit.text ?? edit.replacement ?? "",
    width: Math.max(2, Number(edit.width) || 2), height: Math.max(2, Number(edit.height) || Number(edit.fontSize) * 1.2 || 14.4),
    fontFamily: edit.fontFamily || "Helvetica", fontSize: Math.max(4, Number(edit.fontSize) || 12), rotation: Number(edit.rotation) || 0 };
}

/** Shared layout rule: preserve/wrap whitespace, then clip lines to field height. */
export function layoutPdfText(edit, font) {
  const value = normalizePdfEdit(edit), lineHeight = value.fontSize * 1.2;
  const limit = Math.max(1, Math.floor(value.height / lineHeight));
  const allLines = font ? wrapPdfText(value.text, font, value.fontSize, value.width) : value.text.replace(/\r\n?/g, "\n").split("\n");
  return { ...value, lineHeight, firstBaseline: value.y + value.height - value.fontSize, lines: allLines.slice(0, limit), overflow: allLines.length > limit };
}

export function pdfRectToViewport(viewport, rect) {
  const points = viewport.convertToViewportRectangle([rect.x, rect.y, rect.x + rect.width, rect.y + rect.height]);
  return [Math.min(points[0], points[2]), Math.min(points[1], points[3]), Math.max(points[0], points[2]), Math.max(points[1], points[3])];
}

export function viewportRectToPdf(viewport, rect) {
  const points = viewport.convertToPdfPoint(rect.left, rect.top).concat(viewport.convertToPdfPoint(rect.left + rect.width, rect.top + rect.height));
  return { x: Math.min(points[0], points[2]), y: Math.min(points[1], points[3]), width: Math.abs(points[2]-points[0]), height: Math.abs(points[3]-points[1]) };
}

export async function serializeEditedPdf(model, edits) {
  const output = await PDFDocument.load(model.bytes.slice(), { ignoreEncryption: false });
  const fonts = new Map();
  for (const rawEdit of edits) {
    const normalized = normalizePdfEdit(rawEdit);
    const fontName = resolvePdfStandardFont(normalized.fontFamily);
    let font = fonts.get(fontName);
    if (!font) { font = await output.embedFont(fontName); fonts.set(fontName, font); }
    const edit = layoutPdfText(normalized, font);
    const page = output.getPage(edit.page - 1);
    const size = edit.fontSize;
    // V1 visual replacement: cover the source glyph area and draw the edit.
    // The cover is fill-only: FrameChute selection/hover chrome is never serialized.
    // A small fixed source bleed prevents antialiased glyph fragments from surviving
    // around otherwise exact text bounds on ordinary white page regions.
    if (edit.kind === "replacement") page.drawRectangle({ ...sourceMaskForEdit(edit), color: rgb(1, 1, 1) });
    edit.lines.forEach((line, index) => page.drawText(line || " ", { x: edit.x, y: edit.firstBaseline - index * edit.lineHeight, size, font, color: rgb(0, 0, 0), rotate: degrees(edit.rotation), maxWidth: edit.width }));
  }
  return new Blob([await output.save()], { type: "application/pdf" });
}

export async function transformPdfPages(bytes, operation) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const pdf = await PDFDocument.load(source.slice(), { ignoreEncryption: false });
  const count = pdf.getPageCount();
  const pageIndex = Math.max(0, Math.min(count - 1, Number(operation.page) - 1));
  if (operation.type === "add") {
    const reference=pdf.getPage(pageIndex),{width,height}=reference.getSize();pdf.insertPage(pageIndex+1,[width,height]);
  } else if (operation.type === "rotate") {
    const page = pdf.getPage(pageIndex);
    page.setRotation(degrees((page.getRotation().angle + Number(operation.degrees || 90) + 360) % 360));
  } else if (operation.type === "delete") {
    if (count <= 1) throw new Error("A PDF must keep at least one page");
    pdf.removePage(pageIndex);
  } else if (operation.type === "duplicate") {
    const [copy] = await pdf.copyPages(pdf, [pageIndex]); pdf.insertPage(pageIndex + 1, copy);
  } else if (operation.type === "move") {
    const target = Math.max(0, Math.min(count - 1, Number(operation.to) - 1));
    if (target !== pageIndex) { const [copy] = await pdf.copyPages(pdf, [pageIndex]); pdf.removePage(pageIndex); pdf.insertPage(target, copy); }
  } else throw new Error(`Unsupported PDF page operation: ${operation.type}`);
  return new Uint8Array(await pdf.save());
}

export async function extractPdfPages(bytes, pageNumbers) {
  const source=await PDFDocument.load(bytes instanceof Uint8Array?bytes.slice():bytes),output=await PDFDocument.create(),indices=[...new Set(pageNumbers)].map(page=>page-1).filter(index=>index>=0&&index<source.getPageCount());
  if(!indices.length)throw new Error("Choose at least one valid page");const pages=await output.copyPages(source,indices);pages.forEach(page=>output.addPage(page));return new Uint8Array(await output.save());
}
export async function mergePdfBytes(bytes, addedBytes, insertAfter=null) {
  const output=await PDFDocument.load(bytes instanceof Uint8Array?bytes.slice():bytes),added=await PDFDocument.load(addedBytes instanceof Uint8Array?addedBytes.slice():addedBytes),pages=await output.copyPages(added,added.getPageIndices());let at=insertAfter==null?output.getPageCount():Math.max(0,Math.min(output.getPageCount(),insertAfter));for(const page of pages)output.insertPage(at++,page);return new Uint8Array(await output.save());
}
export async function cropPdfMargins(bytes, pageNumber, margins) {
  const output=await PDFDocument.load(bytes instanceof Uint8Array?bytes.slice():bytes),page=output.getPage(pageNumber-1),{width,height}=page.getSize(),left=Math.max(0,Number(margins.left)||0),right=Math.max(0,Number(margins.right)||0),top=Math.max(0,Number(margins.top)||0),bottom=Math.max(0,Number(margins.bottom)||0);if(left+right>=width||top+bottom>=height)throw new Error("Crop margins leave no visible page");page.setCropBox(left,bottom,width-left-right,height-top-bottom);return new Uint8Array(await output.save());
}
export async function conservativelyCompressPdf(bytes) { const pdf=await PDFDocument.load(bytes instanceof Uint8Array?bytes.slice():bytes);return new Uint8Array(await pdf.save({useObjectStreams:true,addDefaultPage:false,objectsPerTick:50})); }
export function chooseSmallerPdf(original, candidate) { return candidate.byteLength < original.byteLength ? { bytes:candidate, changed:true } : { bytes:original, changed:false }; }
