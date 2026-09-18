import * as pdfjs from "../vendor/pdf.mjs";
import { PDFDocument, StandardFonts, rgb, degrees } from "../vendor/pdf-lib.mjs";
import { pdfRectToViewport, viewportRectToPdf } from "./pdf-geometry.js";
import { createPdfLayoutCache, createPdfPageLayout, layoutSemanticFlow } from "./pdf-layout.js";
import { contentGroupsFromPdfLayout } from "./pdf-content-groups.js";
import { buildPdfDiagnosticSnapshot, createOwnedMask, currentPdfEdits, ensurePdfEditIdentity, reconcileReopenedPdfObjects } from "./pdf-observability.js";
import { buildPdfForensicPage } from "./pdf-forensics.js";
import { buildPdfSourceMarginReconciliation } from "./pdf-runtime-truth.js";
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
  const metadata=await pdf.getMetadata().catch(()=>({}));
  const reopenedCurrent=parseCurrentVersionKeywords(metadata?.info?.Keywords);
  return { bytes: data, pdf, pageCount: pdf.numPages, reopenedCurrent, documentVersionId:reopenedCurrent?.documentVersionId||null, layoutCache:createPdfLayoutCache({maxPages:3}), layoutSignatures:new Map() };
}

const CURRENT_VERSION_KEYWORD="FrameChuteCurrentV1:";
function encodeBase64Url(value){
  const bytes=new TextEncoder().encode(value);let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");
}
function decodeBase64Url(value){
  const base64=value.replaceAll("-","+").replaceAll("_","/").padEnd(Math.ceil(value.length/4)*4,"=");
  const binary=atob(base64),bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));return new TextDecoder().decode(bytes);
}
function parseCurrentVersionKeywords(keywords){
  // Some producers expose /Keywords as a custom Info value. pdf-lib repairs
  // that value with a leading separator; tolerate surrounding whitespace so
  // the manifest survives a real-world source PDF rather than only fixtures
  // created from a pristine empty document.
  const token=String(keywords||"").split(/[;,]\s*/).map(value=>value.trim()).find(value=>value.startsWith(CURRENT_VERSION_KEYWORD));
  if(!token)return null;
  try{const parsed=JSON.parse(decodeBase64Url(token.slice(CURRENT_VERSION_KEYWORD.length)));return parsed?.schemaVersion===1&&Array.isArray(parsed.objects)?parsed:null;}catch{return null;}
}
function currentVersionManifest(edits,inherited=null){
  const authored=currentPdfEdits(edits).filter(edit=>["replacement","text","wrap"].includes(edit.kind||"replacement")).map(edit=>({
    id:edit.id,kind:edit.kind||"replacement",page:Number(edit.page),text:String(edit.text??edit.replacement??""),sourceObjectId:edit.sourceObjectId||null,sourceLineId:edit.sourceLineId||null,
    pdfRect:{x:Number(edit.x),y:Number(edit.y),width:Number(edit.width),height:Number(edit.height)},sourceOwnershipRect:{x:Number(edit.sourceX??edit.x),y:Number(edit.sourceY??edit.y),width:Number(edit.sourceWidth??edit.width),height:Number(edit.sourceHeight??edit.height)},fontSize:Number(edit.fontSize)||12,fontFamily:edit.fontFamily||"Helvetica",rotation:Number(edit.rotation)||0,index:Number.isFinite(Number(edit.index))?Number(edit.index):-1,original:String(edit.original??""),versionState:"current"
  }));
  if(!authored.length&&inherited?.objects?.length)return inherited;
  const replacedSources=new Set(authored.map(object=>object.sourceObjectId).filter(Boolean));
  const objects=[...(inherited?.objects||[]).filter(object=>!replacedSources.has(object.sourceObjectId)),...authored];
  return {schemaVersion:1,documentVersionId:`document:${createPdfEditIdForManifest()}`,objects};
}
function createPdfEditIdForManifest(){return globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;}

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
  const pageEdits=currentPdfEdits(edits.filter(edit=>Number(edit.page)===pageNumber));
  let sourceRuns=content.items.map((item,index)=>semanticSourceRun(viewport,item,index,pageNumber)).filter(Boolean);
  if(model.reopenedCurrent?.objects?.length){
    const extracted=sourceRuns.map(run=>({id:run.id||`source:p${pageNumber}:text:${run.sourceIndex}`,kind:"source-text-run",page:pageNumber,text:run.text,paintOrder:run.paintOrder,pdfRect:run.bounds,fontSize:run.fontSize}));
    const expected=model.reopenedCurrent.objects.filter(object=>object.page===pageNumber);
    const reconciled=reconcileReopenedPdfObjects(extracted,expected);
    model.reopenedReconciliation||=new Map();model.reopenedReconciliation.set(pageNumber,reconciled);
    // A hydrated manifest object owns the last matching painted replacement,
    // never the superseded source operator that happened to have its old
    // index. Updating the runtime paint index makes the real DOM field (and
    // therefore its handles/hit target) land on current presentation truth.
    for(const edit of pageEdits.filter(edit=>edit.reopened)){
      const painted=reconciled.current.find(object=>object.replacementObjectId===edit.id);
      if(painted)edit.index=painted.paintOrder;
    }
    sourceRuns=reconciled.current.map((object,index)=>({sourceIndex:index,sourceRef:object.replacementObjectId||object.id,id:object.replacementObjectId||object.id,text:object.text,bounds:object.pdfRect,fontSize:object.fontSize,angle:0,paintOrder:object.paintOrder,confidence:1}));
  }
  const signature=JSON.stringify(pageEdits.map(edit=>[edit.id,edit.kind,edit.index,edit.x,edit.y,edit.width,edit.height,edit.replacement,edit.text,edit.wrapText]));
  if(model.layoutSignatures.get(pageNumber)!==signature){model.layoutCache.invalidate(pageNumber);model.layoutSignatures.set(pageNumber,signature);}
  return model.layoutCache.get(pageNumber,()=>createPdfPageLayout({
    page:pageNumber,
    pageBounds:viewportRectToPdf(viewport,{left:0,top:0,width:viewport.width,height:viewport.height}),
    sourceRuns,
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
  edits=currentPdfEdits(edits);
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
  const marginReconciliation=options.contentRect&&options.marginConstraintsEnabled!==false
    ? buildPdfSourceMarginReconciliation({layout:pageLayout,contentRect:options.contentRect,existingEdits:edits})
    : null;
  const sourceMarginEdits=marginReconciliation?.edits||[];
  if(sourceMarginEdits.length)edits=currentPdfEdits([...edits,...sourceMarginEdits]);
  const reopened=model.reopenedReconciliation?.get(pageNumber),historicalPaintOrders=new Set((reopened?.historical||[]).map(object=>object.paintOrder));
  const reopenedCurrentByPaintOrder=new Map((reopened?.current||[]).map(object=>[object.paintOrder,object]));
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
  const visibleMasks=pdfPageMaskPlan(pageLayout,edits,wrapEdits,pageNumber);
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
    if (mask.id) element.dataset.objectId = mask.id;
    if (mask.ownerEditId) element.dataset.ownerEditId = mask.ownerEditId;
    if (mask.sourceObjectIds) element.dataset.sourceObjectIds = mask.sourceObjectIds.join(" ");
    Object.assign(element.style, { left: `${left}px`, top: `${top}px`, width: `${right-left}px`, height: `${bottom-top}px` });
    textLayer.append(element);
  }
  content.items.forEach((item, index) => {
    if (!item.str?.trim()) return;
    if(historicalPaintOrders.has(index))return;
    const [, , , d, x, y] = pdfjs.Util.transform(viewport.transform, item.transform);
    const height = Math.max(8, Math.hypot(item.transform[2], item.transform[3]) * scale);
    const explicit = edits.find((edit) => edit.page === pageNumber && edit.index === index && edit.kind !== "image");
    const wrapped = wrapEdits.find(edit => edit.index === index);
    const saved = wrapped || explicit;
    const span = document.createElement("span");
    span.className = "pdf-text-item"; span.dataset.index = String(index);span.dataset.viewportScale=String(scale);
    const nextItem=content.items.slice(index+1).find(candidate=>candidate.str?.trim());
    span.dataset.terminalFragment=String(!nextItem||Math.abs((Number(nextItem.transform?.[5])||0)-(Number(item.transform?.[5])||0))>Math.max(1,Math.abs(Number(item.transform?.[3])||0)*.35));
    const reopenedObject=reopenedCurrentByPaintOrder.get(index);
    span.dataset.objectId=saved?.id||reopenedObject?.replacementObjectId||`source:p${pageNumber}:text:${index}`;
    span.dataset.presentationTruthKind=saved?(saved.kind==="wrap"?"dom-wrapped-text":"dom-replacement-text"):"canvas-source-text";
    span.dataset.sourceObjectId=saved?.sourceObjectId||reopenedObject?.sourceObjectId||`source:p${pageNumber}:text:${index}`;
    if(saved?.id)span.dataset.ownerEditId=saved.id;
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
      // PDF text coordinates identify the baseline, not the top of its nominal
      // em box. PDF.js exposes the embedded font ascent used by its own text
      // layer; using it here removes the first (baseline -> CSS top) divergence.
      const font=content.styles?.[item.fontName]||{},ascent=Number.isFinite(font.ascent)?font.ascent:Number.isFinite(font.descent)?1+font.descent:.8;
      const angle=Math.atan2(Number(item.transform?.[1])||0,Number(item.transform?.[0])||1);
      const fontAscent=height*ascent,left=angle?x+fontAscent*Math.sin(angle):x,top=angle?y-fontAscent*Math.cos(angle):y-fontAscent;
      Object.assign(span.style, { left: `${left}px`, top: `${top}px`, width: `${Math.max(item.width*scale,1)}px`, height: `${height}px`, fontSize: `${height}px`, fontFamily: font.fontFamily||"sans-serif", transform: angle?`rotate(${angle}rad)`:"none" });
      span.dataset.geometryDerivation="pdf-baseline-font-ascent";
    }
    textLayer.append(span);
  });
  edits.filter(edit => edit.page === pageNumber && edit.kind === "text").forEach(edit => {
    const saved = normalizePdfEdit(edit), [left, top, right, bottom] = pdfRectToViewport(viewport, saved);
    const span=document.createElement("span");span.className="pdf-text-item pdf-text-edit";span.dataset.index=String(saved.index);span.dataset.presentationTruthKind="dom-free-text";span.dataset.objectId=saved.id;span.dataset.ownerEditId=saved.id;
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
  return { viewport, content, sourceMarginEdits, marginReconciliation };
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

/** Search the active semantic document. Superseded source runs and historical
 * edits are excluded by the page model rather than hidden in presentation. */
export async function searchCurrentPdfDocument(model, edits, query) {
  const needle=String(query||"").trim().toLocaleLowerCase();if(!needle)return [];
  const matches=[];
  for(let page=1;page<=model.pageCount;page++){
    const text=await extractSemanticPdfText(model,currentPdfEdits(edits),{pageNumber:page});
    let from=0,at;while((at=text.toLocaleLowerCase().indexOf(needle,from))!==-1){matches.push({page,offset:at,text:text.slice(at,at+needle.length)});from=at+Math.max(1,needle.length);}
  }return matches;
}

/** Production diagnostics adapter used by Copy Page Diagnostics and tests. */
export async function createPdfPageDiagnostics(model,edits,pageNumber,{viewport=null,observations=[],pageGeometry=null,pointerHitTest=null,interactionJournal=[],mutationJournal=[],selectedObjectId=null,editingObjectId=null,visualScene=null}={}){
  const page=await model.pdf.getPage(pageNumber),actualViewport=viewport||page.getViewport({scale:1}),content=await page.getTextContent();
  const current=currentPdfEdits(edits),layout=await getPdfPageLayout(model,pageNumber,current,{page,viewport:actualViewport,content});
  const wrapEdits=imageWrapEditsForPage(actualViewport,content,current,pageNumber),masks=pdfPageMaskPlan(layout,current,wrapEdits,pageNumber);
  const replacedSourceIds=new Set(current.filter(edit=>edit.page===pageNumber&&edit.sourceObjectId).map(edit=>edit.sourceObjectId));
  const sourceObjects=layout.nodes.filter(node=>node.kind==="source-text-run").map(node=>({id:node.id,kind:node.kind,page:pageNumber,text:node.text,pdfRect:node.bounds,coordinateSpace:"pdf-points",versionState:replacedSourceIds.has(node.id)?"superseded":"current",sourceObjectId:node.id}));
  const editObjects=current.filter(edit=>edit.page===pageNumber).map(edit=>({id:edit.id,kind:edit.kind||"replacement",page:pageNumber,text:edit.text??edit.replacement??"",pdfRect:{x:edit.x,y:edit.y,width:edit.width,height:edit.height},coordinateSpace:"pdf-points",versionState:edit.versionState,sourceObjectId:edit.sourceObjectId||null,sourceLineId:edit.sourceLineId||null,maskIds:masks.filter(mask=>mask.ownerEditId===edit.id).map(mask=>mask.id)}));
  const reopened=model.reopenedReconciliation?.get(pageNumber),historical=(reopened?.historical||[]).map(object=>({...object,pdfRect:object.pdfRect,coordinateSpace:"pdf-points"}));
  const allObjects=[...sourceObjects,...editObjects,...historical];
  const snapshot=buildPdfDiagnosticSnapshot({page:pageNumber,pageBoxes:{viewBox:page.view},viewport:{scale:actualViewport.scale,rotation:actualViewport.rotation,width:actualViewport.width,height:actualViewport.height,transform:[...actualViewport.transform]},documentVersionId:model.documentVersionId||"live-unsaved",objects:allObjects,masks,observations,pageGeometry,pointerHitTest,interactionJournal,mutationJournal,selectedObjectId,editingObjectId,visualScene,invariants:[{name:"current-version-only",ok:!historical.some(object=>object.versionState==="current")},{name:"explicit-mask-ownership",ok:masks.every(mask=>mask.ownerEditId&&mask.sourceObjectIds?.length)}],issues:reopened?.issues||[]});
  const forensicObjects=allObjects.map(object=>({...object,objectId:object.id,canonicalPdfRect:object.pdfRect,layoutRect:object.pdfRect,sourceOwnershipRect:object.kind==="replacement"?sourceMaskForEdit(current.find(edit=>edit.id===object.id)||object):object.pdfRect,semanticRole:"BODY_CONTENT",provenance:object.kind==="source-text-run"?"source-pdf":"substrate"}));
  const forensic=buildPdfForensicPage({pageNumber,mode:"debug",objects:forensicObjects,masks,contentRect:layout.contentRect||null,journal:interactionJournal});
  return {...snapshot,forensic,saveIntent:forensic.saveIntent,contentGroups:contentGroupsFromPdfLayout(layout)};
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

/** A replacement may erase only the immutable source region it supersedes.
 * Layout growth and movement grant occupancy, never additional erase rights. */
export function replacementMasksForEdit(edit) {
  edit=ensurePdfEditIdentity(edit);
  const sourceObjectId=edit.sourceObjectId||`source:p${edit.page}:text:${edit.index}`;
  if ((edit.kind || "replacement") === "wrap") {
    const pdfRect=padPdfRect(sourceMaskForEdit(edit));
    return [{...createOwnedMask({ownerEditId:edit.id,sourceObjectIds:[sourceObjectId],maskRole:"source",pdfRect}),...pdfRect,maskIndex:edit.index}];
  }
  const source = padPdfRect(sourceMaskForEdit(edit));
  return [{...createOwnedMask({ownerEditId:edit.id,sourceObjectIds:[sourceObjectId],maskRole:"source",pdfRect:source}),...source,maskIndex:edit.index}];
}

/**
 * One mask plan for both the live editor and native serialization.
 *
 * This is the WYSIWYG boundary: if the live editor hides old source glyphs or a
 * stale replacement field, Save must apply the exact same PDF-space rectangles
 * before drawing current replacement text/images.
 */
export function pdfPageMaskPlan(layout, edits, wrapEdits, pageNumber) {
  edits=currentPdfEdits(edits);
  const wrappedSourceEditIds=new Set((wrapEdits||[]).map(edit=>edit.sourceEditId).filter(Boolean));
  const maskEdits=(edits||[]).filter(edit=>!wrappedSourceEditIds.has(normalizePdfEdit(edit).id));
  const sourceMaskEdits=[
    ...maskEdits.filter(edit=>edit.page===pageNumber&&(edit.kind||"replacement")==="replacement"),
    ...(wrapEdits||[])
  ];
  return Object.freeze([
    ...semanticLiveSourceMasks(layout,sourceMaskEdits,pageNumber)
  ]);
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
 * range bounded to the changed run(s). When the edited cluster owns the final
 * run on a semantic line, grant a small bounded right-edge bleed so terminal
 * glyph overhang/antialiasing cannot survive beyond the nominal PDF.js box.
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
      const mask=padPdfRect(sourceMaskForEdit(edit),Math.max(2.5,Number(padding)||0));
      const normalized=ensurePdfEditIdentity(edit),sourceId=normalized.sourceObjectId||`source:p${pageNumber}:text:${edit.index}`;
      fallback.push({...createOwnedMask({ownerEditId:normalized.id,sourceObjectIds:[sourceId],maskRole:"source",pdfRect:mask}),...mask,maskIndex:edit.index});
      continue;
    }
    let group=groups.get(line.id);
    if(!group){
      group={line,indexes:new Set(),sourceIds:new Set(),sources:[]};
      groups.set(line.id,group);
    }
    group.indexes.add(index);
    group.sourceIds.add(source.id);
    group.sources.push(source.bounds);
  }
  const masks=[...fallback];
  for(const group of groups.values()){
    const childIds=group.line.childIds||[];
    const allChanged=group.indexes.size>=childIds.length;
    const firstChanged=childIds.length>0&&group.sourceIds.has(childIds[0]);
    const lastChanged=childIds.length>0&&group.sourceIds.has(childIds.at(-1));
    const ownsLeftEdge=allChanged||firstChanged;
    const ownsRightEdge=allChanged||lastChanged;
    const lineRight=group.line.bounds.x+group.line.bounds.width;
    // PDF.js item/line boxes can end just before the visible terminal glyph ink.
    // Only a changed cluster that owns the semantic line's right edge gets this
    // extra cover; interior edits stay bounded so neighboring current text is
    // never erased. The ordinary symmetric pad is applied after this bleed.
    const terminalBleed=ownsRightEdge
      ? Math.max(4,Math.min(10,Number(group.line.bounds.height)*.5))
      : 0;
    const left=ownsLeftEdge
      ? group.line.bounds.x
      : Math.min(...group.sources.map(rect=>rect.x));
    const right=ownsRightEdge
      ? lineRight+terminalBleed
      : Math.max(...group.sources.map(rect=>rect.x+rect.width));
    const base={
      x:left,
      y:group.line.bounds.y,
      width:Math.max(0,right-left),
      height:group.line.bounds.height
    };
    const pad=Math.max(Number(padding)||0,group.line.bounds.height*.12,2.5);
    const mask=padPdfRect(base,pad);
    const owners=(edits||[]).filter(edit=>group.indexes.has(Number(edit.index))).map(ensurePdfEditIdentity).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    const owner=owners[0];
    if(owner)masks.push({...createOwnedMask({id:`mask:${owner.id}:source-line`,ownerEditId:owner.id,sourceObjectIds:[...group.sourceIds],maskRole:"source-line",pdfRect:mask}),...mask,maskIndex:[...group.indexes].join(","),contributingEditIds:owners.map(edit=>edit.id),terminalEdge:ownsRightEdge?"right":null,terminalBleed});
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
  ensurePdfEditIdentity(edit);
  const kind = edit.kind || "replacement";
  return { ...edit, kind, id: edit.id, text: edit.text ?? edit.replacement ?? "",
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
  edits=currentPdfEdits(edits);
  const output = await PDFDocument.load(model.bytes.slice(), { ignoreEncryption: false });
  const manifest=currentVersionManifest(edits,model.reopenedCurrent),prior=output.getKeywords()?.split(/,\s*/).filter(keyword=>!keyword.startsWith(CURRENT_VERSION_KEYWORD))||[];
  output.setKeywords([...prior,`${CURRENT_VERSION_KEYWORD}${encodeBase64Url(JSON.stringify(manifest))}`]);
  const fonts = new Map();
  const wrapByImage = new Map();
  const wrappedSourceEditIds = new Set();
  const maskPlanByPage = new Map();

  // Build the same semantic mask plan used by renderPdfPage. Draw every erase
  // rectangle before any replacement text/images so Save and live preview have
  // the same old-content visibility.
  for (let pageNumber = 1; pageNumber <= model.pageCount; pageNumber++) {
    const page = await model.pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const pageLayout=await getPdfPageLayout(model,pageNumber,edits,{page,viewport,content});
    const wrapEdits=imageWrapEditsForPage(viewport,content,edits,pageNumber);
    for (const wrap of wrapEdits) {
      const list = wrapByImage.get(String(wrap.wrapImageId)) || [];
      list.push(wrap);
      wrapByImage.set(String(wrap.wrapImageId), list);
      if(wrap.sourceEditId)wrappedSourceEditIds.add(wrap.sourceEditId);
    }
    maskPlanByPage.set(pageNumber,pdfPageMaskPlan(pageLayout,edits,wrapEdits,pageNumber));
  }

  for (const [pageNumber,masks] of maskPlanByPage) {
    const page=output.getPage(pageNumber-1);
    const fallback=page.getSize();
    const pageBox=typeof page.getCropBox==="function"
      ? page.getCropBox()
      : {x:0,y:0,width:fallback.width,height:fallback.height};
    for(const rawMask of masks){
      const mask=clampPdfRectToBox(rawMask,pageBox);
      if(mask.width>0&&mask.height>0)page.drawRectangle({...mask,color:rgb(1,1,1)});
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
