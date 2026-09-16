import * as pdfjs from "../vendor/pdf.mjs";
import { PDFDocument, StandardFonts, rgb, degrees } from "../vendor/pdf-lib.mjs";
import { pdfRectToViewport, viewportRectToPdf } from "./pdf-geometry.js";
import { createPdfLayoutCache, createPdfPageLayout } from "./pdf-layout.js";
export { pdfRectToViewport, viewportRectToPdf } from "./pdf-geometry.js";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.mjs", import.meta.url).href;

export const PDF_STANDARD_FONTS = Object.freeze([
  ["Helvetica", StandardFonts.Helvetica], ["Helvetica Bold", StandardFonts.HelveticaBold],
  ["Helvetica Oblique", StandardFonts.HelveticaOblique], ["Times Roman", StandardFonts.TimesRoman],
  ["Times Bold", StandardFonts.TimesRomanBold], ["Times Italic", StandardFonts.TimesRomanItalic],
  ["Courier", StandardFonts.Courier], ["Courier Bold", StandardFonts.CourierBold],
  ["Courier Oblique", StandardFonts.CourierOblique]
]);
const PDF_FONT_MAP = new Map(PDF_STANDARD_FONTS);

export function resolvePdfStandardFont(name) { return PDF_FONT_MAP.get(name) || StandardFonts.Helvetica; }

/** Deterministic width-aware wrapping that preserves explicit lines and whitespace. */
export function wrapPdfText(text, font, size, maxWidth) {
  const width = Math.max(2, Number(maxWidth) || 2), lines = [];
  for (const paragraph of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    if (!paragraph) { lines.push(""); continue; }
    let line = "";
    let column = 0;
    for (const rawCharacter of paragraph) {
      const character = rawCharacter === "\t" ? " ".repeat(4 - (column % 4)) : rawCharacter;
      const candidate = line + character;
      if (line && font.widthOfTextAtSize(candidate, size) > width) { lines.push(line); line = character; }
      else line = candidate;
      column = line.length;
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

/** Grow an unconstrained field downward while preserving its PDF top edge. */
export function growPdfTextField(edit, requiredLines) {
  const value = normalizePdfEdit(edit), requiredHeight = Math.max(value.height, requiredLines * value.fontSize * 1.2);
  if (requiredHeight === value.height || value.clipExplicitly) return value;
  const oldTop = value.y + value.height;
  return { ...value, height: requiredHeight, y: oldTop - requiredHeight };
}

/** Preserve the user's point size and grow downward using a conservative
 * standard-font estimate. Exact font metrics are used again during Save. */
export function reflowPdfTextEditGeometry(edit) {
  const value=normalizePdfEdit(edit),average=Math.max(1,value.fontSize*.52),columns=Math.max(1,Math.floor(value.width/average));
  let lines=0;
  for(const paragraph of value.text.split("\n")){
    if(!paragraph){lines++;continue;}
    let used=0;for(const word of paragraph.match(/\S+/g)||[]){const length=[...word].length,next=used?used+1+length:length;if(used&&next>columns){lines++;used=length;}else used=next;if(length>columns){lines+=Math.floor((length-1)/columns);used=((length-1)%columns)+1;}}lines++;
  }
  const grown=growPdfTextField(value,Math.max(1,lines));
  Object.assign(edit,{y:grown.y,height:grown.height});
  return edit;
}

/** Mutate the existing PDF image edit so identity/history references stay stable. */
export function repositionPdfImage(edit, geometry) {
  if (!edit || edit.kind !== "image") return null;
  Object.assign(edit, geometry);
  return edit;
}

function pdfRectsIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Choose a conservative line-level placement for source text that would be
 * covered by an inserted image. PDF source text is fixed-position rather than
 * paragraph-flow content, so FrameChute relocates only intersecting text items
 * into the nearest clear horizontal region and preserves the original source
 * rectangle as the mask.
 */
export function wrapPdfTextBoxAroundImage(textBox, imageBox, gap = 6) {
  if (!pdfRectsIntersect(textBox, imageBox)) return null;
  const gutter = Math.max(0, Number(gap) || 0);
  const pageWidth = Math.max(
    Number(textBox.pageWidth) || 0,
    textBox.x + textBox.width,
    imageBox.x + imageBox.width
  );
  const leftEdge = Math.max(0, imageBox.x - gutter);
  const rightEdge = Math.min(pageWidth, imageBox.x + imageBox.width + gutter);
  const leftAvailable = Math.max(0, leftEdge - textBox.x);
  const rightStart = Math.max(textBox.x, rightEdge);
  const rightAvailable = Math.max(0, textBox.x + textBox.width - rightStart);

  if (leftAvailable >= Math.min(textBox.width, 18) || rightAvailable >= Math.min(textBox.width, 18)) {
    const useLeft = leftAvailable >= rightAvailable;
    const width = Math.max(2, Math.min(textBox.width, useLeft ? leftAvailable : rightAvailable));
    return {
      x: useLeft ? Math.max(0, leftEdge - width) : rightStart,
      y: textBox.y,
      width,
      height: textBox.height
    };
  }

  // A source item sitting almost entirely beneath the image has no useful
  // horizontal lane. Move it to the nearest vertical edge instead of silently
  // hiding it underneath the image.
  const aboveY = imageBox.y + imageBox.height + gutter;
  const belowY = Math.max(0, imageBox.y - gutter - textBox.height);
  const sourceCenter = textBox.y + textBox.height / 2;
  const imageCenter = imageBox.y + imageBox.height / 2;
  return {
    x: textBox.x,
    y: sourceCenter >= imageCenter ? aboveY : belowY,
    width: textBox.width,
    height: textBox.height
  };
}

function sourceTextBoxForItem(viewport, item, index) {
  if (!item?.str?.trim()) return null;
  const scale = viewport.scale || 1;
  const [, , , , x, y] = pdfjs.Util.transform(viewport.transform, item.transform);
  const height = Math.max(8, Math.hypot(item.transform[2], item.transform[3]) * scale);
  const display = {
    left: x,
    top: y - height,
    width: Math.max(item.width * scale, 8),
    height: height * 1.25
  };
  const rect = viewportRectToPdf(viewport, display);
  return {
    ...rect,
    index,
    text: item.str,
    fontSize: Math.max(4, rect.height * .8),
    pageWidth: viewport.width / scale
  };
}

/**
 * Derive transient standard-PDF text replacement edits for wrapped images.
 * These are not stored as proprietary file state; they are recomputed from the
 * source PDF text plus image geometry on render/save.
 */
export function imageWrapEditsForPage(viewport, content, edits, pageNumber) {
  const explicitIndexes = new Set(
    edits.filter(edit => edit.page === pageNumber && edit.kind !== "image" && Number.isFinite(Number(edit.index)))
      .map(edit => Number(edit.index))
  );
  const claimed = new Set();
  const wraps = [];
  const images = edits.filter(edit => edit.page === pageNumber && edit.kind === "image" && edit.wrapText === true);

  for (const image of images) {
    const obstacle = {
      x: image.x,
      y: image.y,
      width: image.width,
      height: image.height
    };
    content.items.forEach((item, index) => {
      if (claimed.has(index) || explicitIndexes.has(index)) return;
      const source = sourceTextBoxForItem(viewport, item, index);
      if (!source || !pdfRectsIntersect(source, obstacle)) return;
      const target = wrapPdfTextBoxAroundImage(source, obstacle, 6);
      if (!target) return;
      claimed.add(index);
      wraps.push({
        kind: "wrap",
        id: `wrap:${image.id || image.index}:${index}`,
        wrapImageId: image.id || String(image.index),
        page: pageNumber,
        index,
        original: item.str,
        replacement: item.str,
        text: item.str,
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height,
        sourceX: source.x,
        sourceY: source.y,
        sourceWidth: source.width,
        sourceHeight: source.height,
        fontFamily: "Helvetica",
        fontSize: source.fontSize,
        rotation: 0
      });
    });
  }
  return wraps;
}

/** Keep a free-text edit's semantic model synchronized without replacing its identity or geometry. */
export function updatePdfFreeText(edit, text) {
  if (!edit || edit.kind !== "text") return false;
  const value = String(text ?? "").replace(/\r\n?/g, "\n");
  if (edit.text === value) return false;
  edit.text = value;
  return true;
}

export async function openPdfDocument(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const task = pdfjs.getDocument({ data: data.slice() });
  const pdf = await task.promise;
  return { bytes: data, pdf, pageCount: pdf.numPages, layoutCache:createPdfLayoutCache({maxPages:3}), layoutSignatures:new Map() };
}

function semanticSourceRun(viewport, item, index, pageNumber) {
  const box=sourceTextBoxForItem(viewport,item,index);
  if(!box)return null;
  return {
    sourceIndex:index, sourceRef:`p${pageNumber}:text:${index}`, text:item.str, bounds:box,
    fontSize:inferPdfSourceFontSize(item), angle:Math.atan2(Number(item.transform?.[1])||0,Number(item.transform?.[0])||1)*180/Math.PI,
    paintOrder:index, confidence:1
  };
}

/** Lazily construct the canonical semantic page model in PDF points. */
export async function getPdfPageLayout(model, pageNumber, edits=[], prepared={}) {
  const page=prepared.page || await model.pdf.getPage(pageNumber);
  const viewport=prepared.viewport || page.getViewport({scale:1});
  const content=prepared.content || await page.getTextContent();
  const pageEdits=edits.filter(edit=>Number(edit.page)===pageNumber);
  const signature=JSON.stringify(pageEdits.map(edit=>[edit.id,edit.kind,edit.index,edit.x,edit.y,edit.width,edit.height,edit.replacement,edit.text,edit.wrapText]));
  if(model.layoutSignatures.get(pageNumber)!==signature){model.layoutCache.invalidate(pageNumber);model.layoutSignatures.set(pageNumber,signature);}
  return model.layoutCache.get(pageNumber,()=>createPdfPageLayout({
    page:pageNumber,
    pageBounds:viewportRectToPdf(viewport,{left:0,top:0,width:viewport.width,height:viewport.height}),
    sourceRuns:content.items.map((item,index)=>semanticSourceRun(viewport,item,index,pageNumber)).filter(Boolean),
    edits:pageEdits,
    // Text content alone cannot prove the absence of paths, scans, or masks.
    // Candidates can still be queried, but are explicitly not certified free.
    uncertain:true
  }));
}

/** Edit-aware logical extraction; never serializes or rewrites PDF streams. */
export async function extractSemanticPdfText(model, edits=[], {pageNumber=null, applyEdits=true}={}) {
  const pages=pageNumber?[pageNumber]:Array.from({length:model.pageCount},(_,index)=>index+1);
  const text=[];
  for(const number of pages)text.push((await getPdfPageLayout(model,number,edits)).extractText({applyEdits}));
  return text.filter(Boolean).join("\n\n");
}

export async function renderPdfPage(model, pageNumber, canvas, textLayer, edits = [], options = {}) {
  const page = await model.pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = options.scale || Math.max(.5, Math.min(2.5, (textLayer.parentElement.clientWidth - 20) / base.width || 1));
  const viewport = page.getViewport({ scale });
  canvas.width = Math.ceil(viewport.width * devicePixelRatio);
  canvas.height = Math.ceil(viewport.height * devicePixelRatio);
  canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
  textLayer.style.width = `${viewport.width}px`; textLayer.style.height = `${viewport.height}px`;
  const renderTask = page.render({ canvasContext: canvas.getContext("2d"), viewport, transform: devicePixelRatio === 1 ? null : [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0] });
  options.onRenderTask?.(renderTask);
  await renderTask.promise;
  const content = await page.getTextContent();
  await getPdfPageLayout(model,pageNumber,edits,{page,viewport,content});
  const wrapEdits = imageWrapEditsForPage(viewport, content, edits, pageNumber);
  textLayer.replaceChildren();
  for (const edit of edits.filter(item => item.page === pageNumber && item.kind === "image")) {
    const [left, top, right, bottom] = pdfRectToViewport(viewport, edit);
    const element = document.createElement("div"); element.className = "pdf-text-item pdf-text-edit pdf-image-edit"; element.dataset.index = String(edit.index); element.dataset.wrapText = edit.wrapText === true ? "on" : "off";
    const image = document.createElement("img"); image.src = `data:${edit.mime};base64,${edit.base64}`; image.alt = "Inserted PDF image"; image.draggable = true;
    const move=document.createElement("button");move.type="button";move.className="pdf-move-handle";move.textContent="↕";
    const resize=document.createElement("button");resize.type="button";resize.className="pdf-resize-handle";resize.setAttribute("aria-label","Resize inserted image");
    Object.assign(element.style,{left:`${left}px`,top:`${top}px`,width:`${right-left}px`,height:`${bottom-top}px`}); element.append(image,move,resize); textLayer.append(element);
  }
  const visibleMasks = [
    ...sourceMasksForPage(edits, pageNumber),
    ...wrapEdits.flatMap(replacementMasksForEdit)
  ];
  for (const mask of visibleMasks) {
    const raw = pdfRectToViewport(viewport, mask);
    const left = Math.max(0, Math.min(viewport.width, raw[0]));
    const top = Math.max(0, Math.min(viewport.height, raw[1]));
    const right = Math.max(left, Math.min(viewport.width, raw[2]));
    const bottom = Math.max(top, Math.min(viewport.height, raw[3]));
    if (right <= left || bottom <= top) continue;
    const element = document.createElement("div");
    element.className = "pdf-source-mask";
    element.setAttribute("aria-hidden", "true");
    if (mask.maskIndex !== undefined) element.dataset.maskIndex = String(mask.maskIndex);
    if (mask.maskRole) element.dataset.maskRole = mask.maskRole;
    Object.assign(element.style, { left: `${left}px`, top: `${top}px`, width: `${right-left}px`, height: `${bottom-top}px` });
    textLayer.append(element);
  }
  content.items.forEach((item, index) => {
    if (!item.str?.trim()) return;
    const [, , , d, x, y] = pdfjs.Util.transform(viewport.transform, item.transform);
    const height = Math.max(8, Math.hypot(item.transform[2], item.transform[3]) * scale);
    const explicit = edits.find((edit) => edit.page === pageNumber && edit.index === index && edit.kind !== "image");
    const wrapped = wrapEdits.find(edit => edit.index === index);
    const saved = explicit || wrapped;
    const span = document.createElement("span");
    span.className = "pdf-text-item"; span.dataset.index = String(index);
    if (options.searchQuery && item.str.toLocaleLowerCase().includes(options.searchQuery.toLocaleLowerCase())) span.classList.add("pdf-search-match");
    const text = document.createElement("span"); text.className = "pdf-edit-text"; text.textContent = saved?.replacement ?? item.str; span.append(text);
    if (saved) {
      const [left, top, right, bottom] = pdfRectToViewport(viewport, saved);
      const previewFamily = saved.fontFamily?.startsWith("Times") ? "Times New Roman, serif" : saved.fontFamily?.startsWith("Courier") ? "Courier New, monospace" : "Arial, sans-serif";
      const previewWeight = saved.fontFamily?.includes("Bold") ? "700" : "400";
      const previewStyle = /Oblique|Italic/.test(saved.fontFamily || "") ? "italic" : "normal";
      Object.assign(span.style, { left: `${left}px`, top: `${top}px`, width: `${right-left}px`, height: `${bottom-top}px`, fontSize: `${saved.fontSize * scale}px`, fontFamily: previewFamily, fontWeight: previewWeight, fontStyle: previewStyle });
      if (saved.kind === "wrap") {
        span.classList.add("pdf-wrapped-source");
      } else {
        span.classList.add("pdf-text-edit");
        const move = document.createElement("button"); move.type="button"; move.className="pdf-move-handle"; move.title="Drag replacement"; move.textContent="↕"; span.append(move);
        const resize = document.createElement("button"); resize.type="button"; resize.className="pdf-resize-handle"; resize.title="Resize replacement field"; resize.setAttribute("aria-label", "Resize replacement field"); span.append(resize);
      }
    } else {
      Object.assign(span.style, { left: `${x}px`, top: `${y - height}px`, width: `${Math.max(item.width * scale, 8)}px`, height: `${height * 1.25}px`, fontSize: `${height}px` });
    }
    textLayer.append(span);
  });
  edits.filter(edit => edit.page === pageNumber && edit.kind === "text").forEach(edit => {
    const saved = normalizePdfEdit(edit), [left, top, right, bottom] = pdfRectToViewport(viewport, saved);
    const span=document.createElement("span");span.className="pdf-text-item pdf-text-edit";span.dataset.index=String(saved.index);
    const text=document.createElement("span");text.className="pdf-edit-text";text.textContent=saved.text;span.append(text);
    const markDirty=()=>{const block=text.closest?.(".block");if(block)block.dataset.documentDirty="true";};
    text.addEventListener("input",()=>{if(updatePdfFreeText(edit,text.innerText))markDirty();});
    text.addEventListener("focusout",()=>{
      if(text.dataset.cancel){updatePdfFreeText(edit,text.dataset.before??edit.text);delete text.dataset.cancel;}
      else if(updatePdfFreeText(edit,text.innerText))markDirty();
      text.removeAttribute("contenteditable");
    });
    Object.assign(span.style,{left:`${left}px`,top:`${top}px`,width:`${right-left}px`,height:`${bottom-top}px`,fontSize:`${saved.fontSize*scale}px`});
    const move=document.createElement("button");move.type="button";move.className="pdf-move-handle";move.title="Drag text field";move.textContent="↕";
    const resize=document.createElement("button");resize.type="button";resize.className="pdf-resize-handle";resize.title="Resize text field";span.append(move,resize);textLayer.append(span);
  });
  return { viewport, content };
}

export async function searchPdfDocument(model, query) {
  const needle = String(query || "").trim().toLocaleLowerCase();
  if (!needle) return [];
  const matches = [];
  for (let pageNumber = 1; pageNumber <= model.pageCount; pageNumber++) {
    const content = await (await model.pdf.getPage(pageNumber)).getTextContent();
    content.items.forEach((item, index) => {
      let from = 0, at;
      const text = String(item.str || ""), haystack = text.toLocaleLowerCase();
      while ((at = haystack.indexOf(needle, from)) !== -1) {
        matches.push({ page: pageNumber, index, offset: at, text });
        from = at + Math.max(1, needle.length);
      }
    });
  }
  return matches;
}

export async function pdfDocumentProperties(model, pageNumber = 1) {
  const [metadata, page] = await Promise.all([model.pdf.getMetadata().catch(() => ({})), model.pdf.getPage(pageNumber)]);
  const viewport = page.getViewport({ scale: 1 });
  const info = metadata?.info || {};
  return {
    title: info.Title || "", author: info.Author || "", subject: info.Subject || "",
    keywords: info.Keywords || "", creator: info.Creator || "", producer: info.Producer || "",
    creationDate: info.CreationDate || "", modificationDate: info.ModDate || "",
    pageCount: model.pageCount, pageSize: `${Math.round(viewport.width * 100) / 100} × ${Math.round(viewport.height * 100) / 100} pt`,
    version: info.PDFFormatVersion || "Unknown"
  };
}

const PDF_REPLACEMENT_MASK_PAD = 1.5;

function padPdfRect(rect, amount = PDF_REPLACEMENT_MASK_PAD) {
  const pad = Math.max(0, Number(amount) || 0);
  return {
    x: (Number(rect?.x) || 0) - pad,
    y: (Number(rect?.y) || 0) - pad,
    width: Math.max(0, Number(rect?.width) || 0) + pad * 2,
    height: Math.max(0, Number(rect?.height) || 0) + pad * 2
  };
}

/** Return the original source-text cover for a replacement/wrap edit. */
export function sourceMaskForEdit(edit) {
  return {
    x: edit.sourceX ?? edit.x,
    y: edit.sourceY ?? edit.y,
    width: Math.max(edit.sourceWidth ?? edit.width, 2),
    height: Math.max(edit.sourceHeight ?? edit.height, 2)
  };
}

/**
 * A replacement owns two erase regions: its original source glyph box and its
 * current replacement field box. This makes resizing the field a deliberate
 * "erase underneath here" operation without erasing the strip between source
 * and destination when a field is moved.
 */
export function replacementMasksForEdit(edit) {
  if ((edit.kind || "replacement") === "wrap") {
    return [{ ...padPdfRect(sourceMaskForEdit(edit)), maskRole:"source", maskIndex:edit.index }];
  }
  const source = padPdfRect(sourceMaskForEdit(edit));
  const field = padPdfRect({
    x: edit.x,
    y: edit.y,
    width: Math.max(Number(edit.width) || 0, 2),
    height: Math.max(Number(edit.height) || 0, 2)
  });
  return [
    { ...source, maskRole:"source", maskIndex:edit.index },
    { ...field, maskRole:"field", maskIndex:edit.index }
  ];
}

export function clampPdfRectToBox(rect, box) {
  const boxLeft = Number(box?.x) || 0;
  const boxBottom = Number(box?.y) || 0;
  const boxRight = boxLeft + Math.max(0, Number(box?.width) || 0);
  const boxTop = boxBottom + Math.max(0, Number(box?.height) || 0);
  const left = Math.max(boxLeft, Number(rect?.x) || 0);
  const bottom = Math.max(boxBottom, Number(rect?.y) || 0);
  const right = Math.min(boxRight, (Number(rect?.x) || 0) + Math.max(0, Number(rect?.width) || 0));
  const top = Math.min(boxTop, (Number(rect?.y) || 0) + Math.max(0, Number(rect?.height) || 0));
  return { x:left, y:bottom, width:Math.max(0,right-left), height:Math.max(0,top-bottom) };
}

export function sourceMasksForPage(edits, pageNumber) {
  return edits
    .filter(edit => edit.page === pageNumber && (edit.kind || "replacement") === "replacement")
    .flatMap(replacementMasksForEdit);
}

export function inferPdfSourceFontSize(item, fallback = 12) {
  const transform = Array.isArray(item?.transform) ? item.transform : [];
  const inferred = Math.hypot(Number(transform[2]) || 0, Number(transform[3]) || 0);
  const value = Number.isFinite(inferred) && inferred > 0 ? inferred : Number(fallback) || 12;
  return Math.max(4, Math.min(144, value));
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
  const allLines = font ? wrapPdfText(value.text, font, value.fontSize, value.width) : value.text.replace(/\r\n?/g, "\n").split("\n");
  const limit = Math.max(1, Math.floor(value.height / lineHeight));
  return { ...value, lineHeight, firstBaseline: value.y + value.height - value.fontSize, lines: allLines.slice(0, limit), overflow: allLines.length > limit };
}

export async function serializeEditedPdf(model, edits) {
  const output = await PDFDocument.load(model.bytes.slice(), { ignoreEncryption: false });
  const fonts = new Map();
  const wrapByImage = new Map();

  for (let pageNumber = 1; pageNumber <= model.pageCount; pageNumber++) {
    const images = edits.filter(edit => edit.page === pageNumber && edit.kind === "image" && edit.wrapText === true);
    if (!images.length) continue;
    const page = await model.pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const wrap of imageWrapEditsForPage(viewport, content, edits, pageNumber)) {
      const list = wrapByImage.get(String(wrap.wrapImageId)) || [];
      list.push(wrap);
      wrapByImage.set(String(wrap.wrapImageId), list);
    }
  }

  const drawTextEdit = async rawEdit => {
    const normalized = normalizePdfEdit(rawEdit);
    const fontName = resolvePdfStandardFont(normalized.fontFamily);
    let font = fonts.get(fontName);
    if (!font) { font = await output.embedFont(fontName); fonts.set(fontName, font); }
    const edit = layoutPdfText(normalized, font);
    const page = output.getPage(edit.page - 1);
    const size = edit.fontSize;
    if (edit.kind === "replacement" || edit.kind === "wrap") {
      const fallback = page.getSize();
      const pageBox = typeof page.getCropBox === "function"
        ? page.getCropBox()
        : { x:0, y:0, width:fallback.width, height:fallback.height };
      for (const rawMask of replacementMasksForEdit(edit)) {
        const mask = clampPdfRectToBox(rawMask, pageBox);
        if (mask.width > 0 && mask.height > 0) page.drawRectangle({ ...mask, color: rgb(1, 1, 1) });
      }
    }
    edit.lines.forEach((line, index) => page.drawText(line || " ", {
      x: edit.x,
      y: edit.firstBaseline - index * edit.lineHeight,
      size,
      font,
      color: rgb(0, 0, 0),
      rotate: degrees(edit.rotation),
      maxWidth: edit.width
    }));
  };

  for (const rawEdit of edits) {
    const normalized = normalizePdfEdit(rawEdit);
    if (normalized.kind === "image") {
      for (const wrap of wrapByImage.get(String(normalized.id || normalized.index)) || []) {
        await drawTextEdit(wrap);
      }
      const page = output.getPage(normalized.page - 1);
      const bytes = Uint8Array.from(atob(normalized.base64), character => character.charCodeAt(0));
      const embedded = normalized.mime === "image/png" ? await output.embedPng(bytes) : await output.embedJpg(bytes);
      page.drawImage(embedded, { x: normalized.x, y: normalized.y, width: normalized.width, height: normalized.height });
      continue;
    }
    await drawTextEdit(normalized);
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
