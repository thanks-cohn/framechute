import * as pdfjs from "../vendor/pdf.mjs";
import { PDFDocument, StandardFonts, rgb, degrees } from "../vendor/pdf-lib.mjs";
import { pdfRectToViewport, viewportRectToPdf } from "./pdf-geometry.js";
import { createPdfLayoutCache, createPdfPageLayout, layoutSemanticFlow } from "./pdf-layout.js";
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

/** Preserve the user's point size and grow downward using the same
 * semantic word-flow rules used by the page typesetter. Exact font metrics are
 * still used during Save; this is the stable runtime geometry estimate. */
export function reflowPdfTextEditGeometry(edit) {
  const value=normalizePdfEdit(edit);
  if(value.clipExplicitly)return edit;
  const flow=layoutSemanticFlow({
    region:{x:value.x,y:0,width:value.width,height:100000},
    blocks:[{
      id:`edit:${value.id}`,
      leading:1.2,
      paragraphSpacing:0,
      style:{fontSize:value.fontSize},
      runs:[{id:value.id,text:value.text,provenance:value.kind==="replacement"?"replacement":"user-authored"}]
    }],
    options:{paragraphSpacing:0}
  });
  const grown=growPdfTextField(value,Math.max(1,flow.lines.length));
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
export function semanticWrapTarget(textBox, imageBox, {text="",fontSize=null,gap=6}={}) {
  if(!pdfRectsIntersect(textBox,imageBox))return null;
  const size=Math.max(4,Number(fontSize)||Number(textBox.fontSize)||12);
  const top=Math.max(1,Number(textBox.y)||0)+Math.max(1,Number(textBox.height)||size*1.2);
  const leading=Math.max(1,(Number(textBox.height)||size*1.2)/size);
  const minimumMeasure=Math.min(72,Math.max(24,(Number(textBox.width)||72)*.45));
  const flow=layoutSemanticFlow({
    region:{x:textBox.x,y:0,width:textBox.width,height:top},
    obstacles:[{...imageBox,wrapText:true}],
    blocks:[{
      id:"image-wrap",
      leading,
      paragraphSpacing:0,
      style:{fontSize:size},
      runs:[{id:"image-wrap:run",text,provenance:"replacement"}]
    }],
    options:{gutter:gap,minimumMeasure,paragraphSpacing:0}
  });
  if(!flow.lines.length)return null;
  const first=flow.lines[0];
  // A replacement field is still one rectangular PDF object. Once a readable
  // lane is selected, size that rectangle for the complete text at that lane
  // width so live preview/save can never clip the tail merely because the
  // semantic flow would regain full width below the image.
  const laneFlow=layoutSemanticFlow({
    region:{x:first.x,y:0,width:first.width,height:100000},
    blocks:[{
      id:"image-wrap-lane",
      leading,
      paragraphSpacing:0,
      style:{fontSize:size},
      runs:[{id:"image-wrap-lane:run",text,provenance:"replacement"}]
    }],
    options:{gutter:gap,minimumMeasure:Math.min(minimumMeasure,first.width),paragraphSpacing:0}
  });
  const lineHeight=laneFlow.lines[0]?.height||first.height;
  return {
    x:first.x,
    y:first.y-Math.max(0,laneFlow.lines.length-1)*lineHeight,
    width:first.width,
    height:Math.max(Number(textBox.height)||first.height,laneFlow.lines.length*lineHeight),
    status:laneFlow.status
  };
}

export function imageWrapEditsForPage(viewport, content, edits, pageNumber) {
  const explicitByIndex=new Map(
    edits
      .filter(edit=>edit.page===pageNumber&&edit.kind!=="image"&&Number.isFinite(Number(edit.index))&&Number(edit.index)>=0)
      .map(edit=>[Number(edit.index),normalizePdfEdit(edit)])
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
      if (claimed.has(index)) return;
      const source = sourceTextBoxForItem(viewport, item, index);
      if (!source) return;
      const explicit=explicitByIndex.get(index)||null;
      const layoutBox=explicit
        ? {...source,x:explicit.x,y:explicit.y,width:explicit.width,height:explicit.height}
        : source;
      if(!pdfRectsIntersect(layoutBox,obstacle))return;
      const replacement=explicit?.text??item.str;
      const fontSize=explicit?.fontSize??source.fontSize;
      const target=semanticWrapTarget(layoutBox,obstacle,{text:replacement,fontSize,gap:6});
      if (!target) return;
      claimed.add(index);
      wraps.push({
        kind: "wrap",
        id: `wrap:${image.id || image.index}:${index}`,
        wrapImageId: image.id || String(image.index),
        sourceEditId:explicit?.id||null,
        page: pageNumber,
        index,
        original: item.str,
        replacement,
        text: replacement,
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height,
        sourceX: source.x,
        sourceY: source.y,
        sourceWidth: source.width,
        sourceHeight: source.height,
        fontFamily: explicit?.fontFamily||"Helvetica",
        fontSize,
        rotation: explicit?.rotation||0
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
  const pageLayout=await getPdfPageLayout(model,pageNumber,edits,{page,viewport,content});
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
  const wrappedSourceEditIds=new Set(wrapEdits.map(edit=>edit.sourceEditId).filter(Boolean));
  const maskEdits=edits.filter(edit=>!wrappedSourceEditIds.has(normalizePdfEdit(edit).id));
  const sourceMaskEdits=[
    ...maskEdits.filter(edit=>edit.page===pageNumber&&(edit.kind||"replacement")==="replacement"),
    ...wrapEdits
  ];
  const fieldMasks=maskEdits
    .filter(edit=>edit.page===pageNumber&&(edit.kind||"replacement")==="replacement")
    .flatMap(replacementMasksForEdit)
    .filter(mask=>mask.maskRole==="field");
  const visibleMasks = [
    ...semanticLiveSourceMasks(pageLayout,sourceMaskEdits,pageNumber),
    ...fieldMasks
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
    const saved = wrapped || explicit;
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
      if (saved.kind === "wrap" && !saved.sourceEditId) {
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
 * A replacement always erases the source glyphs it owns.
 *
 * It must NOT erase the whole destination field by default. Saved PDFs start
 * from the pristine source bytes, so a destination-field cover can destroy
 * unrelated nearby text (for example the first/last letter of a neighboring
 * label) even when that text is not part of the edit. Field erasure is now an
 * explicit opt-in reserved for a future collision-checked operation.
 */
export function replacementMasksForEdit(edit) {
  const source={ ...padPdfRect(sourceMaskForEdit(edit)), maskRole:"source", maskIndex:edit.index };
  if ((edit.kind || "replacement") === "wrap" || edit.eraseUnderField !== true) return [source];
  const field = padPdfRect({
    x: edit.x,
    y: edit.y,
    width: Math.max(Number(edit.width) || 0, 2),
    height: Math.max(Number(edit.height) || 0, 2)
  });
  return [source,{ ...field, maskRole:"field", maskIndex:edit.index }];
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

/**
 * Live preview eraser for changed source text.
 *
 * The PDF canvas already contains the original glyphs, so masking only the
 * exact PDF.js item box can leave antialiased fragments at the top/bottom or
 * between adjacent source runs. For the editor only, promote every changed
 * source range to the full semantic line band while keeping its horizontal
 * range bounded to the changed run(s). If every run on that line changed, erase
 * the entire semantic line. Native Save keeps its existing serializer masks.
 */
function horizontalBandOverlap(left,right,bounds) {
  return Math.max(0,Math.min(right,bounds.x+bounds.width)-Math.max(left,bounds.x));
}

function guardedBoundary(nearEdge,farEdge,nearCenter,farCenter,guard) {
  // When source boxes leave real whitespace between them, let the edited owner
  // consume almost all of that whitespace. Stop just before the untouched
  // neighbor instead of halfway through the gap; this removes antialiased
  // remnants without touching the neighbor. If source boxes overlap, fall back
  // to the midpoint between centers so ownership still remains disjoint.
  return farEdge>=nearEdge
    ? Math.max(nearEdge,farEdge-Math.max(0,guard))
    : (nearCenter+farCenter)/2;
}

function semanticLineOwnershipCell(layout,line,left,right,padding) {
  const page=layout?.bounds||{x:0,y:0,width:Infinity,height:Infinity};
  const center=line.bounds.y+line.bounds.height/2;
  const lineTop=line.bounds.y+line.bounds.height;
  const lineBottom=line.bounds.y;
  const candidates=(layout?.nodes||[]).filter(node=>
    node.kind==="text-line"&&node.id!==line.id&&horizontalBandOverlap(left,right,node.bounds)>.01
  );
  let above=null,below=null;
  for(const candidate of candidates){
    const otherCenter=candidate.bounds.y+candidate.bounds.height/2;
    if(otherCenter>center&&(!above||otherCenter<above.center))above={line:candidate,center:otherCenter};
    if(otherCenter<center&&(!below||otherCenter>below.center))below={line:candidate,center:otherCenter};
  }
  const safePad=Math.max(Number(padding)||0,line.bounds.height*.18,2.5);
  const aboveGuard=above?Math.max(1,Math.min(safePad,above.line.bounds.height*.16)):safePad;
  const belowGuard=below?Math.max(1,Math.min(safePad,below.line.bounds.height*.16)):safePad;
  const top=above
    ? guardedBoundary(lineTop,above.line.bounds.y,center,above.center,aboveGuard)
    : lineTop+safePad;
  const bottom=below
    ? (below.line.bounds.y+below.line.bounds.height<=lineBottom
        ? Math.min(lineBottom,below.line.bounds.y+below.line.bounds.height+belowGuard)
        : (below.center+center)/2)
    : lineBottom-safePad;
  const pageBottom=Number.isFinite(page.y)?page.y:bottom;
  const pageTop=Number.isFinite(page.y+page.height)?page.y+page.height:top;
  return {bottom:Math.max(pageBottom,Math.min(bottom,top)),top:Math.min(pageTop,Math.max(top,bottom))};
}

function semanticRunHorizontalCell(layout,line,changedIds,padding) {
  const sourceById=new Map((layout?.nodes||[]).filter(node=>node.kind==="source-text-run").map(node=>[node.id,node]));
  const siblings=(line.childIds||[]).map(id=>sourceById.get(id)).filter(Boolean)
    .sort((a,b)=>a.bounds.x-b.bounds.x||a.id.localeCompare(b.id));
  const changed=siblings.filter(run=>changedIds.has(run.id));
  if(!changed.length)return {left:line.bounds.x,right:line.bounds.x+line.bounds.width};
  if(changed.length===siblings.length){
    const pad=Math.max(Number(padding)||0,2.5);
    return {left:line.bounds.x-pad,right:line.bounds.x+line.bounds.width+pad};
  }
  const firstIndex=siblings.indexOf(changed[0]),lastIndex=siblings.indexOf(changed.at(-1));
  const first=changed[0],last=changed.at(-1),previous=siblings[firstIndex-1],next=siblings[lastIndex+1];
  const firstCenter=first.bounds.x+first.bounds.width/2,lastCenter=last.bounds.x+last.bounds.width/2;
  const safePad=Math.max(Number(padding)||0,2.5);
  let left=first.bounds.x-safePad;
  let right=last.bounds.x+last.bounds.width+safePad;
  if(previous){
    const previousRight=previous.bounds.x+previous.bounds.width;
    const previousCenter=previous.bounds.x+previous.bounds.width/2;
    const guard=Math.max(1,Math.min(safePad,previous.bounds.height*.14));
    left=first.bounds.x>=previousRight
      ? Math.min(first.bounds.x,previousRight+guard)
      : (previousCenter+firstCenter)/2;
  }
  if(next){
    const nextCenter=next.bounds.x+next.bounds.width/2;
    const lastRight=last.bounds.x+last.bounds.width;
    const guard=Math.max(1,Math.min(safePad,next.bounds.height*.14));
    right=next.bounds.x>=lastRight
      ? Math.max(lastRight,next.bounds.x-guard)
      : (lastCenter+nextCenter)/2;
  }
  return {left,right};
}

/**
 * Live preview eraser for changed source text.
 *
 * The semantic page already knows source runs and reconstructed lines. Treat
 * those as ownership cells instead of inflating masks blindly: vertical edges
 * stop halfway to the nearest overlapping line, and partial horizontal edits
 * stop halfway to untouched sibling runs. The resulting rectangles cannot
 * collide with neighboring text even when antialiasing safety is added.
 */
export function semanticLiveSourceMasks(layout, edits, pageNumber, padding=2.5) {
  const groups=new Map(),fallback=[];
  const sourceRuns=(layout?.nodes||[]).filter(node=>node.kind==="source-text-run");
  const sourceByIndex=new Map(sourceRuns.map(node=>[Number(node.metadata?.sourceIndex),node]));
  for(const edit of edits||[]){
    const kind=edit?.kind||"replacement";
    if(Number(edit?.page)!==Number(pageNumber)||!["replacement","wrap"].includes(kind))continue;
    const index=Number(edit.index);
    if(!Number.isFinite(index)||index<0)continue;
    const source=sourceByIndex.get(index);
    const line=source&&layout?.parent?.(source.id);
    if(!source||!line){
      const mask=padPdfRect(sourceMaskForEdit(edit),Math.max(1.5,Number(padding)||0));
      fallback.push({...mask,maskRole:"source",maskIndex:edit.index});
      continue;
    }
    let group=groups.get(line.id);
    if(!group){
      group={line,indexes:new Set(),sourceIds:new Set()};
      groups.set(line.id,group);
    }
    group.indexes.add(index);
    group.sourceIds.add(source.id);
  }
  const masks=[...fallback];
  for(const group of groups.values()){
    const horizontal=semanticRunHorizontalCell(layout,group.line,group.sourceIds,padding);
    const vertical=semanticLineOwnershipCell(layout,group.line,horizontal.left,horizontal.right,padding);
    const left=Math.max(layout?.bounds?.x??horizontal.left,horizontal.left);
    const right=Math.min((layout?.bounds?.x??0)+(layout?.bounds?.width??Infinity),horizontal.right);
    if(right<=left||vertical.top<=vertical.bottom)continue;
    masks.push({
      x:left,
      y:vertical.bottom,
      width:right-left,
      height:vertical.top-vertical.bottom,
      maskRole:"source-cell",
      maskIndex:[...group.indexes].join(",")
    });
  }
  return masks;
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
  const wrappedSourceEditIds = new Set();

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
      if(wrap.sourceEditId)wrappedSourceEditIds.add(wrap.sourceEditId);
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
    if(wrappedSourceEditIds.has(normalized.id))continue;
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
