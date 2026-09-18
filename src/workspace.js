import { getSnapshot, listSnapshots, saveSnapshot } from "./persistence.js";
import {
  fileFromHandle,
  hasReadPermission,
  listImages,
  makeHandleKey,
  pickImageDirectory,
  pickDocxFile,
  pickPdfFile,
  pickTextFile,
  pickVideoFile,
  requestReadPermission,
  resolveHandle,
  storeHandle
} from "./file-access.js";
import { saveDocument, saveDocumentAs } from "./documents/document-save.js";
import { openPdfDocument, renderPdfPage, serializeEditedPdf, viewportRectToPdf, transformPdfPages, extractPdfPages, mergePdfBytes, cropPdfMargins, conservativelyCompressPdf, chooseSmallerPdf, PDF_STANDARD_FONTS, repositionPdfImage, reflowPdfTextEditGeometry, searchCurrentPdfDocument, pdfDocumentProperties, inferPdfSourceFontSize, extractSemanticPdfText, createPdfPageDiagnostics } from "./documents/pdf-document.js";
import { clampPdfZoom, fitPdfScale, pdfRectToViewport } from "./documents/pdf-geometry.js";
import { createPdfMarginState, derivePdfContentRect, marginsForPage, normalizePdfMargins, reconcileEditableGeometryToContentBounds, constrainRectToLayoutBounds, constrainTranslationToLayoutBounds, constrainResizeToLayoutBounds } from "./documents/pdf-layout-bounds.js";
import { DOCX_MIME, addDocxImage, parseDocx, serializeDocx } from "./documents/docx-document.js";
import { DocxNumberingState } from "./documents/docx/numbering.js";
import { editorNodeToRuns, replaceTextNodes } from "./documents/rich-text-runs.js";
import { duplicateBlockRecord } from "./actions/block-records.js";
import { saveBlobAs } from "./actions/native-save.js";
import { zipSync } from "./vendor/fflate.mjs";
import { PDFDocument } from "./vendor/pdf-lib.mjs";
import { createSimpleDocx } from "./actions/document-operations.js";
import { activeInternalDrag, beginInternalDrag, claimDocumentDrop, endInternalDrag, imageBlobsForDrop, isInternalFrameChuteDrag } from "./drag-ownership.mjs";
import { customImageSourceBlob } from "./custom-image-source.mjs";
import { documentDropRange, documentImageDropEffect, moveNodeToDropRange } from "./document-image-drag.mjs";
import { createObjectDragSession } from "./object-drag-space.js";
import { isViewportFixed } from "./viewport-fix.js";
import { fitOpenedBlock } from "./initial-open-fit.js";
import { capturePdfPageDomObservations, capturePdfPageGeometry, capturePointerHitTest, capturePdfVisualScene as buildPdfVisualScene, compareGeometryFingerprints, createBoundedGeometryJournal, createPdfEditId, ensurePdfEditIdentity, getPdfDiagnosticMode, resolvePdfInteractiveTextRect, resolvePdfVisualTarget, setPdfDiagnosticMode as updatePdfDiagnosticMode } from "./documents/pdf-observability.js";

const workspace = document.querySelector("#workspace");
const toolbar = document.querySelector(".toolbar");
const addTextButton = document.querySelector("#add-text");
const openTextButton = document.querySelector("#open-text");
const openPdfButton = document.querySelector("#open-pdf");
const openDocxButton = document.querySelector("#open-docx");
const openGalleryButton = document.querySelector("#open-gallery");
const openVideoButton = document.querySelector("#open-video");
const saveFrameButton = document.querySelector("#save-frame");
const restoreFrameButton = document.querySelector("#restore-frame");
const savedFramesSelect = document.querySelector("#saved-frames");
const status = document.querySelector("#status");

const templates = {
  text: document.querySelector("#text-block-template"),
  pdf: document.querySelector("#pdf-block-template"),
  docx: document.querySelector("#docx-block-template"),
  gallery: document.querySelector("#gallery-block-template"),
  video: document.querySelector("#video-block-template")
};

const blockTypes = new Map();
const sourceRecords = new WeakMap();
const runtimeSources = new WeakMap();
const objectUrls = new WeakMap();
function pdfTelemetry(runtime){return runtime.telemetry||=( {interactions:createBoundedGeometryJournal(60),mutations:createBoundedGeometryJournal(30),lastPointer:null,hoveredObjectId:null} );}
function recordPdfGeometry(block,runtime,event,object=null){if(getPdfDiagnosticMode(block)==="off")return null;const geometry=capturePdfPageGeometry(block,{viewport:runtime.pageData?.viewport});return pdfTelemetry(runtime).interactions.record(event,{page:Number(block.dataset.currentPage||1),objectId:object?.dataset?.objectId||null,pageGeometryFingerprint:geometry,object:object?capturePdfPageDomObservations(block.querySelector(".pdf-text-layer"),{state:event.startsWith("pointer")?(event==="pointerout"?"idle":"hover"):event}).find(item=>item.objectId===object.dataset.objectId)||null:null});}
function recordPdfMutation(block,runtime,cause,before){if(getPdfDiagnosticMode(block)==="off")return;requestAnimationFrame(()=>{const after=capturePdfPageGeometry(block,{viewport:runtime.pageData?.viewport});pdfTelemetry(runtime).mutations.record(cause,compareGeometryFingerprints(before,after,{cause}));});}

workspace.addEventListener("dragstart", event => {
  const image=event.target.closest?.("img"),block=image?.closest(".block"); if(!block)return;
  const docxImage=image.matches("img[data-docx-part]"),pdfElement=image.closest(".pdf-image-edit"),runtime=runtimeSources.get(block);
  const pdfEdit=pdfElement&&runtime?.edits?.find(edit=>String(edit.index)===pdfElement.dataset.index);
  beginInternalDrag({block,kind:"image",originKind:docxImage?"docx":pdfElement?"pdf":"workspace",originObjectId:docxImage?image.dataset.docxRelationship:pdfEdit?.id,originElement:image,sourceBlobProvider:async source => {
    if(docxImage){const bytes=runtime?.model?.parts?.[image.dataset.docxPart];return bytes?new Blob([bytes],{type:image.dataset.docxMime||"image/png"}):null;}
    if(pdfEdit?.base64)return new Blob([base64ToBytes(pdfEdit.base64)],{type:pdfEdit.mime});
    const owned=await window.FrameChuteWorkspace?.sourceBlob(source); if(owned)return owned;
    const element=source.querySelector("img"); if(!element?.currentSrc&&!element?.src)return null;
    return fetch(element.currentSrc||element.src).then(response=>response.ok?response.blob():null);
  }});
  try{event.dataTransfer.setData("application/x-framechute-object",block.dataset.blockId||"image");event.dataTransfer.effectAllowed="copyMove";}catch{}
}, true);
workspace.addEventListener("dragend", endInternalDrag, true);
const clearDocumentDragState=()=>{workspace.classList.remove("is-drop-target");workspace.querySelectorAll(".is-docx-drop-target").forEach(node=>node.classList.remove("is-docx-drop-target"));};
window.addEventListener("dragend",clearDocumentDragState,true);window.addEventListener("drop",clearDocumentDragState,true);window.addEventListener("blur",clearDocumentDragState,true);window.addEventListener("keydown",event=>{if(event.key==="Escape")clearDocumentDragState();},true);

let zCounter = 1;
let newBlockOffset = 0;

function setStatus(message) {
  status.textContent = message;
}

function isPickerCancel(error) {
  return error?.name === "AbortError";
}

function numberFromStyle(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInteger(value, min = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(min, parsed) : min;
}
function bytesToBase64(bytes) { let result="";for(let at=0;at<bytes.length;at+=0x8000)result+=String.fromCharCode(...bytes.subarray(at,at+0x8000));return btoa(result); }
function base64ToBytes(value) { const binary=atob(value||""),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes; }
function textToBase64(value) { return bytesToBase64(new TextEncoder().encode(String(value ?? ""))); }
function base64ToText(value) { return new TextDecoder().decode(base64ToBytes(value || "")); }

function formatTime(seconds) {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = Math.floor(value % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function registerBlockType(type, definition) {
  blockTypes.set(type, definition);
}

function setSourceRecord(block, source) {
  if (source) sourceRecords.set(block, { ...source });
  else sourceRecords.delete(block);
}

function getSourceRecord(block) {
  return sourceRecords.get(block) ?? null;
}

function replaceObjectUrl(block, url) {
  const previous = objectUrls.get(block);
  if (previous) URL.revokeObjectURL(previous);
  objectUrls.set(block, url);
}

function releaseBlockResources(block) {
  block.dispatchEvent(new CustomEvent("framechute:release-resources"));
  const url = objectUrls.get(block);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(block);

  const video = block.querySelector("video");
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}

function setSourceUnavailable(block, message) {
  const sourceMessage = block.querySelector(".source-message");
  const reconnect = block.querySelector(".reconnect-source");

  if (sourceMessage) {
    if (block.dataset.blockType === "gallery" && reconnect) {
      const text = document.createElement("span");
      text.textContent = message;
      const centerReconnect = document.createElement("button");
      centerReconnect.type = "button";
      centerReconnect.className = "gallery-reconnect-center";
      centerReconnect.textContent = "Reconnect folder";
      centerReconnect.title = "Reconnect to the remembered image directory";
      centerReconnect.addEventListener("click", () => reconnect.click());
      sourceMessage.replaceChildren(text, centerReconnect);
    } else sourceMessage.textContent = message;
    sourceMessage.hidden = false;
  }

  if (reconnect) reconnect.hidden = false;
}

function clearSourceUnavailable(block) {
  const sourceMessage = block.querySelector(".source-message");
  const reconnect = block.querySelector(".reconnect-source");

  if (sourceMessage) {
    sourceMessage.replaceChildren();
    sourceMessage.hidden = true;
  }

  if (reconnect) reconnect.hidden = true;
}

async function storedReadableHandle(source) {
  if (!source?.handleKey) return null;
  const handle = await resolveHandle(source.handleKey);
  if (!handle) return null;
  return (await hasReadPermission(handle)) ? handle : null;
}

async function reconnectSource(block, picker, loader) {
  const source = getSourceRecord(block);
  let handle = source?.handleKey ? await resolveHandle(source.handleKey) : null;

  if (handle && (await requestReadPermission(handle))) {
    await loader(handle);
    return;
  }

  try {
    const picked = await picker();
    handle = picked.handle;
    const handleKey = source?.handleKey || makeHandleKey(block.dataset.blockType);
    await storeHandle(handleKey, handle);

    setSourceRecord(block, {
      kind: handle.kind,
      handleKey,
      displayName: handle.name
    });

    const nameInput = block.querySelector(".block-name");
    if (nameInput && (!nameInput.value.trim() || nameInput.value === "Untitled")) {
      nameInput.value = handle.name;
    }

    await loader(handle, picked);
  } catch (error) {
    if (!isPickerCancel(error)) throw error;
  }
}

function bringToFront(block) {
  let highest = zCounter;
  for (const candidate of workspace.querySelectorAll(".block")) {
    const value = Number.parseInt(candidate.style.zIndex, 10);
    if (Number.isFinite(value)) highest = Math.max(highest, value);
  }
  zCounter = highest + 1;
  block.style.zIndex = String(zCounter);
}

function defaultGeometry(type = "text") {
  const offset = newBlockOffset % 240;
  newBlockOffset += 30;

  const defaults = {
    text: { width: 540, height: 390 },
    pdf: { width: 620, height: 680 },
    docx: { width: 680, height: 720 },
    gallery: { width: 560, height: 560 },
    video: { width: 640, height: 430 }
  };

  return {
    x: 36 + offset,
    y: 36 + offset,
    ...(defaults[type] ?? defaults.text),
    z: ++zCounter
  };
}

function applyGeometry(block, geometry) {
  block.style.left = `${geometry.x}px`;
  block.style.top = `${geometry.y}px`;
  block.style.width = `${geometry.width}px`;
  block.style.height = `${geometry.height}px`;
  block.style.zIndex = String(geometry.z ?? ++zCounter);
  zCounter = Math.max(zCounter, geometry.z ?? 0);
}

function readGeometry(block) {
  return {
    x: numberFromStyle(block.style.left, block.offsetLeft),
    y: numberFromStyle(block.style.top, block.offsetTop),
    width: block.offsetWidth || numberFromStyle(block.style.width, 480),
    height: block.offsetHeight || numberFromStyle(block.style.height, 180),
    z: Number.parseInt(block.style.zIndex, 10) || 1
  };
}

function toggleMaximize(block) {
  const isMaximized = block.classList.contains("is-maximized");

  if (isMaximized) {
    const previous = JSON.parse(block.dataset.previousGeometry || "null");
    if (previous) applyGeometry(block, previous);
    block.classList.remove("is-maximized");
    delete block.dataset.previousGeometry;
    return;
  }

  block.dataset.previousGeometry = JSON.stringify(readGeometry(block));
  block.classList.add("is-maximized");

  const workspaceTop = workspace.getBoundingClientRect().top + window.scrollY;
  block.style.left = `${window.scrollX + 16}px`;
  block.style.top = `${Math.max(16, window.scrollY - workspaceTop + 16)}px`;
  block.style.width = `${Math.max(360, window.innerWidth - 32)}px`;
  block.style.height = `${Math.max(280, window.innerHeight - toolbar.offsetHeight - 32)}px`;
  bringToFront(block);
}

async function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The page image could not be encoded.")), type, quality));
}

async function exportPdfImages(block) {
  const dialog = document.querySelector("#pdf-image-export-dialog");
  const form = dialog.querySelector("form");
  form.reset();
  dialog.showModal();
  const submitted = await new Promise(resolve => {
    const close = () => resolve(dialog.returnValue === "export");
    dialog.addEventListener("close", close, { once: true });
  });
  if (!submitted) return;
  const data = new FormData(form), format = data.get("format"), scale = Math.max(.25, Math.min(4, Number(data.get("scale")) || 1));
  const quality = Math.max(.1, Math.min(1, Number(data.get("quality")) || .9));
  const mime = `image/${format}`, extension = format === "jpeg" ? "jpg" : format;
  const runtime = runtimeSources.get(block), editedBlob = await runtime.serialize();
  const edited = await openPdfDocument(new Uint8Array(await editedBlob.arrayBuffer()));
  const pages = data.get("scope") === "all" ? Array.from({ length: edited.pageCount }, (_, index) => index + 1) : [Number(block.dataset.currentPage || 1)];
  const files = {}, digits = Math.max(4, String(edited.pageCount).length);
  try {
    for (const pageNumber of pages) {
      setStatus(`Exporting PDF page ${pageNumber} of ${edited.pageCount}…`);
      const page = await edited.pdf.getPage(pageNumber), viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const blob = await canvasBlob(canvas, mime, format === "png" ? undefined : quality);
      files[`page-${String(pageNumber).padStart(digits, "0")}.${extension}`] = new Uint8Array(await blob.arrayBuffer());
      // zipSync requires all encoded entries at the end, but the much larger
      // decoded page bitmap does not need to remain allocated between pages.
      canvas.width = 0; canvas.height = 0;
      page.cleanup?.();
    }
  } finally { await edited.pdf.destroy(); }
  const base = (block.querySelector(".block-name")?.value || "document").replace(/\.pdf$/i, "");
  if (pages.length === 1) {
    const filename = Object.keys(files)[0];
    await saveBlobAs({ blob: new Blob([files[filename]], { type: mime }), filename: `${base}-${filename}`, extension, mimeType: mime, description: "PDF page image" });
  } else {
    await saveBlobAs({ blob: new Blob([zipSync(files)], { type: "application/zip" }), filename: `${base}-images.zip`, extension: "zip", mimeType: "application/zip", description: "PDF page images" });
  }
  setStatus(`${pages.length} PDF page image${pages.length === 1 ? "" : "s"} exported.`);
}

function attachBlockInteractions(block) {
  const header = block.querySelector(".block-header");
  const removeButton = block.querySelector(".remove-block");
  const maximizeButton = block.querySelector(".maximize-block");

  block.addEventListener("pointerdown", () => bringToFront(block));

  removeButton?.addEventListener("click", () => {
    if (block.dataset.documentDirty === "true" && !window.confirm("This document has unsaved native changes. Remove it anyway?")) return;
    releaseBlockResources(block);
    block.remove();
    setStatus("Block removed. The local source was not deleted.");
  });

  maximizeButton?.addEventListener("click", () => toggleMaximize(block));

  header?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.target.closest("input, button")) return;
    if (block.classList.contains("is-maximized")) return;

    event.preventDefault();
    bringToFront(block);

    const startLeft = numberFromStyle(block.style.left, block.offsetLeft);
    const startTop = numberFromStyle(block.style.top, block.offsetTop);
    const dragSession = createObjectDragSession({ workspace, block, event, startLeft, startTop });

    header.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      dragSession.move(moveEvent);
    };

    const finish = () => {
      dragSession.finish();
      header.removeEventListener("pointermove", move);
      header.removeEventListener("pointerup", finish);
      header.removeEventListener("pointercancel", finish);
    };

    header.addEventListener("pointermove", move);
    header.addEventListener("pointerup", finish);
    header.addEventListener("pointercancel", finish);
  });
}

function showHeaderInReach(block) {
  if (!(block instanceof HTMLElement) || !block.isConnected) return;

  // A rescue command must override both per-object and global header hiding.
  block.classList.remove("hide-object-header");
  block.classList.add("show-object-header");
  window.dispatchEvent(new CustomEvent("flashframe:set-object-chrome", {
    detail: { block, part: "header", hidden: false }
  }));

  const header = block.querySelector(":scope > .block-header")
    || block.querySelector(":scope > .compact-drag-handle");
  if (!(header instanceof HTMLElement)) return;

  bringToFront(block);

  if (isViewportFixed(block)) {
    // Fixed objects must remain wholly inside the browser viewport. Show Header
    // therefore fits the frame instead of pushing its bottom beyond the screen.
    const margin = 10;
    const toolbarBottom = toolbar?.getBoundingClientRect().bottom || 0;
    const visibleTop = Math.max(margin, toolbarBottom + margin);
    const visibleBottom = innerHeight - margin;
    const availableHeight = Math.max(120, visibleBottom - visibleTop);
    const availableWidth = Math.max(120, innerWidth - margin * 2);

    let rect = block.getBoundingClientRect();
    const targetLeft = Math.min(
      Math.max(rect.left, margin),
      Math.max(margin, innerWidth - Math.min(rect.width, availableWidth) - margin)
    );
    const targetTop = Math.min(
      Math.max(rect.top, visibleTop),
      Math.max(visibleTop, visibleBottom - Math.min(rect.height, availableHeight))
    );

    if (rect.width > availableWidth) block.style.width = `${availableWidth}px`;
    if (rect.height > availableHeight || targetTop + rect.height > visibleBottom) {
      block.style.height = `${Math.max(120, visibleBottom - targetTop)}px`;
    }

    // Re-read after shrinking because DOCX/PDF flex content can affect geometry.
    rect = block.getBoundingClientRect();
    block.style.left = `${Math.min(Math.max(targetLeft, margin), Math.max(margin, innerWidth - rect.width - margin))}px`;
    block.style.top = `${Math.min(Math.max(targetTop, visibleTop), Math.max(visibleTop, visibleBottom - rect.height))}px`;

    workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
    return;
  }

  const workspaceRect = workspace.getBoundingClientRect();
  const toolbarBottom = toolbar?.getBoundingClientRect().bottom || 0;
  const margin = 10;
  const visibleLeft = Math.max(margin, workspaceRect.left + margin);
  const visibleRight = Math.min(innerWidth - margin, workspaceRect.right - margin);
  const visibleTop = Math.max(toolbarBottom + margin, workspaceRect.top + margin);
  const visibleBottom = Math.min(innerHeight - margin, workspaceRect.bottom - margin);

  const headerRect = header.getBoundingClientRect();
  const availableWidth = Math.max(1, visibleRight - visibleLeft);
  let dx = 0;
  let dy = 0;

  if (headerRect.width <= availableWidth) {
    if (headerRect.left < visibleLeft) dx = visibleLeft - headerRect.left;
    else if (headerRect.right > visibleRight) dx = visibleRight - headerRect.right;
  } else {
    // Oversized frames cannot expose both ends at once. Favor the right edge so
    // close/maximize remain available while leaving visible header surface to drag.
    dx = visibleRight - headerRect.right;
  }

  if (headerRect.top < visibleTop) dy = visibleTop - headerRect.top;
  else if (headerRect.bottom > visibleBottom) dy = visibleBottom - headerRect.bottom;

  if (dx || dy) {
    block.style.left = `${numberFromStyle(block.style.left, block.offsetLeft) + dx}px`;
    block.style.top = `${numberFromStyle(block.style.top, block.offsetTop) + dy}px`;
  }

  workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
}

window.addEventListener("framechute:object-command", event => {
  const { block, command } = event.detail || {};
  if (!(block instanceof HTMLElement) || !block.isConnected) return;
  if (command === "show-header") { showHeaderInReach(block); return; }
  if (command === "expand") { block.querySelector(":scope > .block-header .maximize-block")?.click(); return; }
  if (command === "grab") return;
  if (block.classList.contains("is-maximized")) block.querySelector(":scope > .block-header .maximize-block")?.click();
  block.style.width = "400px"; block.style.height = "400px";
  if (command === "center") {
    const workspaceRect = workspace.getBoundingClientRect(), toolbarBottom = toolbar?.getBoundingClientRect().bottom || 0;
    const visibleLeft = Math.max(0, workspaceRect.left), visibleRight = Math.min(innerWidth, workspaceRect.right);
    const visibleTop = Math.max(toolbarBottom, workspaceRect.top), visibleBottom = Math.min(innerHeight, workspaceRect.bottom);
    block.style.left = `${(visibleLeft + visibleRight) / 2 - workspaceRect.left - 200}px`;
    block.style.top = `${(visibleTop + visibleBottom) / 2 - workspaceRect.top - 200}px`;
    bringToFront(block);
  }
  workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
});

function setDocumentDirty(block, dirty) {
  block.dataset.documentDirty = String(Boolean(dirty));
  const indicator = block.querySelector(".document-dirty");
  if (indicator) indicator.hidden = !dirty;
}

async function saveNativeDocument(block, saveAs = false) {
  const runtime = runtimeSources.get(block);
  if (!runtime?.serialize) throw new Error("Reconnect the original document before saving.");
  const source = getSourceRecord(block);
  const extension = block.dataset.blockType;
  const filename = block.querySelector(".block-name")?.value || source?.displayName || `document.${extension}`;
  const options = { serialize: runtime.serialize, filename, extension, mimeType: extension === "pdf" ? "application/pdf" : DOCX_MIME, handleKey: source?.handleKey };
  const result = await saveDocument({ serialize: runtime.serialize, handle: runtime.handle, saveAs,
    saveAsWriter: (blob) => saveDocumentAs({ ...options, blob }) });
  if (!result.saved) return;
  if (result.handle) {
    runtime.handle = result.handle;
    setSourceRecord(block, { kind: "file", handleKey: source?.handleKey, displayName: result.handle.name || filename });
    block.querySelector(".block-name").value = result.handle.name || filename;
  }
  setDocumentDirty(block, false);
  setStatus(result.downloaded ? `${filename} downloaded. Future Save may require Save As again.` : `${block.querySelector(".block-name").value} saved.`);
}

function attachDocumentSave(block) {
  for (const [selector, saveAs] of [[".document-save", false], [".document-save-as", true]]) {
    block.querySelector(selector)?.addEventListener("click", async () => {
      try { await saveNativeDocument(block, saveAs); }
      catch (error) { console.error(error); setStatus(`Could not save this ${block.dataset.blockType.toUpperCase()}. Your edits are still open.`); }
    });
  }
}

function updateTextSourceBadge(block) {
  const badge = block.querySelector(".source-badge");
  const source = getSourceRecord(block);
  if (!badge) return;

  if (source?.displayName) {
    badge.textContent = source.displayName;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

async function setPdfPage(block, page) {
  const input = block.querySelector(".pdf-page");
  const runtime = runtimeSources.get(block);
  const nextPage = Math.min(clampInteger(page, 1), runtime?.model?.pageCount || Infinity);

  input.value = String(nextPage);
  block.dataset.currentPage = String(nextPage);

  if (runtime?.model) {
    runtime.renderTask?.cancel();
    const token = runtime.renderToken = (runtime.renderToken || 0) + 1;
    const surface = block.querySelector(".pdf-surface"), firstPage = await runtime.model.pdf.getPage(nextPage), base = firstPage.getViewport({scale:1});
    if (runtime.fitMode) runtime.zoom = fitPdfScale(runtime.fitMode, base, {width:surface.clientWidth-20,height:surface.clientHeight-20});
    const initialPageBounds=viewportRectToPdf(base,{left:0,top:0,width:base.width,height:base.height}),initialMargins=marginsForPage(runtime.marginState,nextPage,initialPageBounds),initialContentRect=derivePdfContentRect(initialPageBounds,initialMargins);
    if(runtime.marginState.constraintsEnabled)reconcileEditableGeometryToContentBounds({edits:runtime.edits,contentRect:initialContentRect,page:nextPage});
    try {
      const result = await renderPdfPage(runtime.model, nextPage, block.querySelector(".pdf-canvas"), block.querySelector(".pdf-text-layer"), runtime.edits, {scale:runtime.zoom, searchQuery:runtime.search?.query, onRenderTask:task=>runtime.renderTask=task});
      if (token !== runtime.renderToken) return;
      runtime.pageData = result;
      renderPdfMarginGuides(block,runtime);
      const hasSourceText = result.content.items.some(item => item.str?.trim());
      block.dataset.pdfHasSourceText = hasSourceText ? "true" : "false";
      const editButton = block.querySelector(".pdf-edit-mode");
      if (editButton && pdfEditEnabled(block)) {
        editButton.title = hasSourceText
          ? "Edit existing PDF text and added objects"
          : "This page has no embedded PDF text. Existing page lettering may be image/vector content and needs OCR before text editing.";
      }
    } catch (error) { if (error?.name !== "RenderingCancelledException") throw error; else return; }
    selectPdfEdit(block, null);
    block.querySelector(".pdf-count").textContent = `/ ${runtime.model.pageCount}`;
    block.querySelector(".pdf-zoom").value = String(Math.round((runtime.zoom || runtime.pageData.viewport.scale) * 100));
  }
}

function pdfPageBounds(runtime){const viewport=runtime?.pageData?.viewport;return viewport?viewportRectToPdf(viewport,{left:0,top:0,width:viewport.width,height:viewport.height}):null;}
function pdfLayoutForPage(runtime,page=1){const pageBounds=pdfPageBounds(runtime);if(!pageBounds)return null;const margins=marginsForPage(runtime.marginState,page,pageBounds);return {pageBounds,margins,contentRect:derivePdfContentRect(pageBounds,margins)};}
function updatePdfMarginButton(block,runtime){const button=block.querySelector(".pdf-margins-toggle"),visible=runtime?.marginState?.guidesVisible===true;if(!button)return;button.textContent=`Margins [ ${visible?"ON":"OFF"} ]`;button.setAttribute("aria-pressed",String(visible));}
function reconcilePdfMargins(block,runtime,{markDirty=true}={}){const page=Number(block.dataset.currentPage||1),layout=pdfLayoutForPage(runtime,page);if(!layout||runtime.marginState.constraintsEnabled===false)return {status:"disabled",results:[]};const result=reconcileEditableGeometryToContentBounds({edits:runtime.edits,contentRect:layout.contentRect,page});runtime.marginDiagnostics={...layout,reconciliation:result};if(result.changed&&markDirty)setDocumentDirty(block,true);if(result.overflows.length)setStatus(`${result.overflows.length} PDF object${result.overflows.length===1?" is":"s are"} too large to fit inside the margins.`);return result;}
function renderPdfMarginGuides(block,runtime){
  const layer=block.querySelector(".pdf-text-layer");layer?.querySelector(".pdf-margin-guide-layer")?.remove();updatePdfMarginButton(block,runtime);if(!layer||!runtime?.pageData||!runtime.marginState.guidesVisible)return;
  const page=Number(block.dataset.currentPage||1),layout=pdfLayoutForPage(runtime,page);if(!layout)return;const projected=runtime.pageData.viewport.convertToViewportRectangle([layout.contentRect.x,layout.contentRect.y,layout.contentRect.x+layout.contentRect.width,layout.contentRect.y+layout.contentRect.height]);
  const left=Math.min(projected[0],projected[2]),right=Math.max(projected[0],projected[2]),top=Math.min(projected[1],projected[3]),bottom=Math.max(projected[1],projected[3]),guideLayer=document.createElement("div");guideLayer.className="pdf-margin-guide-layer";guideLayer.setAttribute("aria-hidden","true");
  const positions={left:{left,top:0,width:0,height:layer.clientHeight},right:{left:right,top:0,width:0,height:layer.clientHeight},top:{left:0,top,width:layer.clientWidth,height:0},bottom:{left:0,top:bottom,width:layer.clientWidth,height:0}};
  for(const edge of ["left","right","top","bottom"]){const guide=document.createElement("div");guide.className=`pdf-margin-guide pdf-margin-guide-${edge}`;guide.dataset.marginEdge=edge;Object.assign(guide.style,Object.fromEntries(Object.entries(positions[edge]).map(([key,value])=>[key,`${value}px`])));const handle=document.createElement("button");handle.type="button";handle.className="pdf-margin-handle";handle.dataset.marginEdge=edge;handle.tabIndex=-1;handle.setAttribute("aria-label",`Drag ${edge} PDF margin`);guide.append(handle);guideLayer.append(guide);}layer.append(guideLayer);runtime.marginDiagnostics={...layout,projectedGuides:{left,right,top,bottom},activeGuideDrag:null,reconciliation:runtime.marginDiagnostics?.reconciliation||null};
}
function bindPdfMarginDrag(block){const layer=block.querySelector(".pdf-text-layer");layer.addEventListener("pointerdown",event=>{const handle=event.target.closest?.(".pdf-margin-handle"),runtime=runtimeSources.get(block);if(!handle||!runtime?.pageData)return;event.preventDefault();event.stopPropagation();handle.setPointerCapture?.(event.pointerId);const edge=handle.dataset.marginEdge,page=Number(block.dataset.currentPage||1),before=capturePdfPageGeometry(block,{viewport:runtime.pageData.viewport});runtime.marginDiagnostics={...(runtime.marginDiagnostics||{}),activeGuideDrag:{edge,pointerId:event.pointerId}};const move=moveEvent=>{const surface=layer.getBoundingClientRect(),point=runtime.pageData.viewport.convertToPdfPoint(moveEvent.clientX-surface.left,moveEvent.clientY-surface.top),layout=pdfLayoutForPage(runtime,page);if(!layout)return;const next={...layout.margins};if(edge==="left")next.left=point[0]-layout.pageBounds.x;if(edge==="right")next.right=layout.pageBounds.x+layout.pageBounds.width-point[0];if(edge==="bottom")next.bottom=point[1]-layout.pageBounds.y;if(edge==="top")next.top=layout.pageBounds.y+layout.pageBounds.height-point[1];runtime.marginState.perPage[String(page)]=normalizePdfMargins(layout.pageBounds,next,{activeEdge:edge});renderPdfMarginGuides(block,runtime);};const finish=async()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",finish);window.removeEventListener("pointercancel",finish);reconcilePdfMargins(block,runtime);runtime.marginDiagnostics.activeGuideDrag=null;recordPdfMutation(block,runtime,"pdf-margin-drag",before);setDocumentDirty(block,true);await setPdfPage(block,page);};window.addEventListener("pointermove",move);window.addEventListener("pointerup",finish,{once:true});window.addEventListener("pointercancel",finish,{once:true});},true);}

function ensurePdfHistory(runtime) { runtime.history ||= { undo: [], redo: [] }; return runtime.history; }
function snapshotPdfEdits(runtime) { return structuredClone(runtime.edits); }
function pushPdfHistory(runtime) { const history=ensurePdfHistory(runtime); history.undo.push(snapshotPdfEdits(runtime)); if(history.undo.length>50)history.undo.shift(); history.redo=[]; }
async function travelPdfHistory(block, direction) { const runtime=runtimeSources.get(block),history=runtime&&ensurePdfHistory(runtime),from=direction==="undo"?history?.undo:history?.redo,to=direction==="undo"?history?.redo:history?.undo;if(!from?.length)return;to.push(snapshotPdfEdits(runtime));runtime.edits.splice(0,runtime.edits.length,...from.pop());setDocumentDirty(block,runtime.edits.length>0||runtime.structurallyDirty);await setPdfPage(block,block.dataset.currentPage); }
function pdfEditEnabled(block) { return block?.dataset?.pdfEditMode !== "off"; }
function setPdfEditMode(block, enabled = true) {
  const active = enabled !== false;
  block.dataset.pdfEditMode = active ? "on" : "off";
  block.classList.toggle("pdf-edit-mode-off", !active);
  const button = block.querySelector(".pdf-edit-mode");
  if (button) {
    button.textContent = `EDIT [ ${active ? "ON" : "OFF"} ]`;
    button.setAttribute("aria-pressed", String(active));
    button.title = active ? "Edit existing PDF text and added objects" : "PDF is in reader mode; existing text will not be changed";
  }
  if (!active) {
    block.querySelectorAll('.pdf-edit-text[contenteditable="true"]').forEach(text => text.blur());
    selectPdfEdit(block, null);
  }
}

function selectPdfEdit(block, span) {
  block.querySelectorAll(".pdf-text-item.is-selected").forEach(node=>node.classList.remove("is-selected"));
  const controls=block.querySelector(".pdf-edit-controls");
  if (!pdfEditEnabled(block)) span = null;
  if(!span?.classList.contains("pdf-text-edit")){controls.hidden=true;delete block.dataset.selectedPdfIndex;return;}
  span.classList.add("is-selected");block.dataset.selectedPdfIndex=span.dataset.index;
  const runtime=runtimeSources.get(block),edit=runtime?.edits.find(item=>item.page===Number(block.dataset.currentPage)&&item.index===Number(span.dataset.index));
  controls.hidden = edit?.kind === "image";
  if(edit?.kind !== "image")controls.querySelector(".pdf-font-size").value=String(Math.round(edit.fontSize*10)/10);
  if(edit?.kind !== "image")controls.querySelector(".pdf-font-family").value=edit.fontFamily || "Helvetica";
}
function selectedPdfEdit(block) { const runtime=runtimeSources.get(block),index=Number(block.dataset.selectedPdfIndex),page=Number(block.dataset.currentPage);return runtime?.edits.find(edit=>edit.page===page&&edit.index===index); }

function removePdfLiveEditMask(textLayer) {
  textLayer?.querySelectorAll(".pdf-live-edit-mask").forEach(mask => mask.remove());
}

function createPdfLiveEditMask(textLayer, span) {
  removePdfLiveEditMask(textLayer);
  if (!textLayer || !span) return null;
  const layerWidth = textLayer.clientWidth;
  const layerHeight = textLayer.clientHeight;
  const rawLeft = Number.parseFloat(span.style.left) || 0;
  const rawTop = Number.parseFloat(span.style.top) || 0;
  const rawWidth = Math.max(0, Number.parseFloat(span.style.width) || 0);
  const rawHeight = Math.max(0, Number.parseFloat(span.style.height) || 0);
  const left = Math.max(0, Math.min(layerWidth, rawLeft));
  const top = Math.max(0, Math.min(layerHeight, rawTop));
  const scale = Math.max(.25, Number(span.dataset.viewportScale) || 1);
  const trailingBleed = span.dataset.terminalFragment === "true" ? Math.min(3, Math.max(.75, scale)) : 0;
  const right = Math.max(left, Math.min(layerWidth, rawLeft + rawWidth + trailingBleed));
  const bottom = Math.max(top, Math.min(layerHeight, rawTop + rawHeight));
  if (right <= left || bottom <= top) return null;
  const mask = document.createElement("div");
  mask.className = "pdf-live-edit-mask";
  mask.setAttribute("aria-hidden", "true");
  Object.assign(mask.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${right-left}px`,
    height: `${bottom-top}px`
  });
  textLayer.append(mask);
  return mask;
}

function syncPdfReplacementFieldMask(textLayer, edit, display, viewport) {
  if (!textLayer || !edit || (edit.kind || "replacement") !== "replacement") return;
  const pad = Math.max(1, 1.5 * (viewport?.scale || 1));
  const layerWidth = textLayer.clientWidth;
  const layerHeight = textLayer.clientHeight;
  const left = Math.max(0, Math.min(layerWidth, display.left - pad));
  const top = Math.max(0, Math.min(layerHeight, display.top - pad));
  const right = Math.max(left, Math.min(layerWidth, display.left + display.width + pad));
  const bottom = Math.max(top, Math.min(layerHeight, display.top + display.height + pad));
  let mask = textLayer.querySelector(`.pdf-source-mask[data-mask-index="${CSS.escape(String(edit.index))}"][data-mask-role="field"]`);
  if (!mask) {
    mask = document.createElement("div");
    mask.className = "pdf-source-mask";
    mask.dataset.maskIndex = String(edit.index);
    mask.dataset.maskRole = "field";
    mask.setAttribute("aria-hidden", "true");
    textLayer.append(mask);
  }
  Object.assign(mask.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${right-left}px`,
    height: `${bottom-top}px`
  });
}

window.addEventListener("framechute:pdf-context-command", event => {
  const { block, action, value }=event.detail||{},runtime=runtimeSources.get(block);if(!runtime?.pageData)return;
  if (!pdfEditEnabled(block)) { setStatus("PDF editing is off. Turn EDIT [ ON ] to modify the document."); return; }
  let edit=selectedPdfEdit(block);
  if(action==="add-text"){
    const surface=block.querySelector(".pdf-text-layer").getBoundingClientRect(),left=Math.max(0,event.detail.clientX-surface.left),top=Math.max(0,event.detail.clientY-surface.top);
    let geometry=viewportRectToPdf(runtime.pageData.viewport,{left,top,width:180,height:72});const layout=pdfLayoutForPage(runtime,Number(block.dataset.currentPage));if(runtime.marginState.constraintsEnabled&&layout)geometry=constrainRectToLayoutBounds(geometry,layout.contentRect).rect;pushPdfHistory(runtime);
    const index=-Date.now();runtime.edits.push({kind:"text",id:`text:${crypto.randomUUID?.()||Date.now()}`,page:Number(block.dataset.currentPage),index,text:"New text",...geometry,fontFamily:"Helvetica",fontSize:12,rotation:0,verticalAlign:"top"});
  } else if(!edit && action==="delete" && event.detail.selected?.matches(".pdf-text-item")){
    const span=event.detail.selected,index=Number(span.dataset.index),original=runtime.pageData.content.items[index];if(!original)return;
    const rect={left:parseFloat(span.style.left),top:parseFloat(span.style.top),width:parseFloat(span.style.width),height:parseFloat(span.style.height)},geometry=viewportRectToPdf(runtime.pageData.viewport,rect);pushPdfHistory(runtime);
    runtime.edits.push(ensurePdfEditIdentity({kind:"replacement",id:createPdfEditId(),sourceObjectId:span.dataset.sourceObjectId||undefined,page:Number(block.dataset.currentPage),index,original:original.str,replacement:"",...geometry,sourceX:geometry.x,sourceY:geometry.y,sourceWidth:geometry.width,sourceHeight:geometry.height,fontFamily:"Helvetica",fontSize:Math.max(4,geometry.height*.8),rotation:0}));
  } else if(!edit)return;
  else if(action==="delete"){pushPdfHistory(runtime);runtime.edits.splice(runtime.edits.indexOf(edit),1);}
  else if(action==="duplicate"){pushPdfHistory(runtime);const copy={...structuredClone(edit),id:`text:${crypto.randomUUID?.()||Date.now()}`,index:-Date.now(),x:edit.x+8,y:edit.y-8},layout=pdfLayoutForPage(runtime,copy.page);if(runtime.marginState.constraintsEnabled&&layout)Object.assign(copy,constrainRectToLayoutBounds(copy,layout.contentRect).rect);runtime.edits.push(copy);}
  else if(action==="font"&&value!==edit.fontFamily){pushPdfHistory(runtime);edit.fontFamily=value;}
  else if(action==="text-size"){const size=Number(prompt("Text size in points",String(edit.fontSize)));if(!Number.isFinite(size))return;pushPdfHistory(runtime);edit.fontSize=Math.max(4,Math.min(144,size));}
  else if(action==="toggle-wrap"&&edit.kind==="image"){pushPdfHistory(runtime);edit.wrapText=edit.wrapText!==true;}
  else return;
  setDocumentDirty(block,true);void setPdfPage(block,block.dataset.currentPage);
});

async function loadPdfHandle(block, handle, state = {}) {
  const file = await fileFromHandle(handle);
  if (!file) throw new Error("PDF could not be read");

  const model = await openPdfDocument(await file.arrayBuffer());
  const edits = Array.isArray(state.edits) ? structuredClone(state.edits).map(edit=>ensurePdfEditIdentity(edit)) : [];
  const runtime = { handle, model, edits, marginState:createPdfMarginState(state.pdfLayoutMargins), structurallyDirty: Boolean(state.structurallyDirty), zoom: state.zoom, fitMode: state.fitMode || (!state.zoom ? "page" : null) };
  runtime.serialize = () => serializeEditedPdf(model, edits);
  runtimeSources.set(block, runtime);
  setPdfEditMode(block, state.editMode !== false);
  clearSourceUnavailable(block);
  setDocumentDirty(block, Boolean(state.dirty));
  await setPdfPage(block, state.page ?? block.dataset.currentPage ?? 1);
}
async function loadPdfBytes(block, bytes, state={}) { const model=await openPdfDocument(bytes),edits=Array.isArray(state.edits)?structuredClone(state.edits).map(edit=>ensurePdfEditIdentity(edit)):[],runtime={handle:null,model,edits,marginState:createPdfMarginState(state.pdfLayoutMargins),structurallyDirty:Boolean(state.structurallyDirty),zoom:state.zoom,fitMode:state.fitMode||(!state.zoom?"page":null)};runtime.serialize=()=>serializeEditedPdf(model,edits);runtimeSources.set(block,runtime);setPdfEditMode(block,state.editMode!==false);clearSourceUnavailable(block);setDocumentDirty(block,Boolean(state.dirty));await setPdfPage(block,state.page??1); }

async function applyPdfPageOperation(block, operation) {
  const previous = runtimeSources.get(block); if (!previous?.model) return;
  const edited = await previous.serialize();
  const bytes = await transformPdfPages(new Uint8Array(await edited.arrayBuffer()), operation);
  const model = await openPdfDocument(bytes); const runtime = { handle: previous.handle, model, edits: [], marginState:createPdfMarginState(previous.marginState), structurallyDirty: true };
  runtime.serialize = () => serializeEditedPdf(model, runtime.edits); runtimeSources.set(block, runtime);
  setDocumentDirty(block, true); await setPdfPage(block, Math.min(Number(operation.to || operation.page), model.pageCount));
  setStatus("PDF page change is ready. Use native Save or Save As to write the PDF.");
}
async function replacePdfRuntime(block, bytes, page=1) { const previous=runtimeSources.get(block),model=await openPdfDocument(bytes),runtime={handle:previous?.handle,model,edits:[],marginState:createPdfMarginState(previous?.marginState),structurallyDirty:true};runtime.serialize=()=>serializeEditedPdf(model,runtime.edits);runtimeSources.set(block,runtime);setDocumentDirty(block,true);await setPdfPage(block,Math.min(page,model.pageCount)); }

async function showGalleryIndex(block, index) {
  const runtime = runtimeSources.get(block);
  if (!runtime?.entries?.length) return;

  const count = runtime.entries.length;
  const nextIndex = ((index % count) + count) % count;
  const entry = runtime.entries[nextIndex];
  const file = await entry.handle.getFile();
  const url = URL.createObjectURL(file);

  replaceObjectUrl(block, url);
  runtime.url = url;
  runtime.index = nextIndex;
  runtimeSources.set(block, runtime);

  const image = block.querySelector(".gallery-image");
  image.src = url;
  image.alt = entry.name;
  block.querySelector(".gallery-position").textContent = `${nextIndex + 1} / ${count}`;
  block.querySelector(".gallery-filename").textContent = entry.name;
}

async function loadGalleryHandle(block, handle, state = {}) {
  const entries = await listImages(handle);
  if (!entries.length) {
    runtimeSources.set(block, { handle, entries: [], index: 0 });
    setSourceUnavailable(block, "This folder does not contain supported images.");
    block.querySelector(".gallery-position").textContent = "0 / 0";
    block.querySelector(".gallery-filename").textContent = "";
    return;
  }

  let index = Number.isFinite(state.currentIndex) ? state.currentIndex : 0;
  if (state.currentEntry) {
    const exact = entries.findIndex((entry) => entry.name === state.currentEntry);
    if (exact >= 0) index = exact;
  }

  index = Math.min(Math.max(0, index), entries.length - 1);
  runtimeSources.set(block, { handle, entries, index });
  clearSourceUnavailable(block);
  await showGalleryIndex(block, index);
}

async function loadVideoHandle(block, handle, state = {}) {
  const file = await fileFromHandle(handle);
  if (!file) throw new Error("Video could not be read");

  const player = block.querySelector(".video-player");
  const url = URL.createObjectURL(file);
  replaceObjectUrl(block, url);
  runtimeSources.set(block, { handle, url, file });
  clearSourceUnavailable(block);

  player.src = url;
  player.volume = Number.isFinite(state.volume) ? Math.min(1, Math.max(0, state.volume)) : 1;
  player.muted = Boolean(state.muted);
  player.playbackRate = Number.isFinite(state.playbackRate) ? state.playbackRate : 1;

  const seekTime = Number.isFinite(state.currentTime) ? Math.max(0, state.currentTime) : 0;

  const applyPlaybackState = async () => {
    player.currentTime = Math.min(seekTime, Number.isFinite(player.duration) ? player.duration : seekTime);
    block.querySelector(".video-time").textContent = formatTime(player.currentTime);

    if (state.paused === false) {
      try {
        await player.play();
      } catch {
        setStatus("Video position restored. Chrome requires a click before playback can resume.");
      }
    }
  };

  if (player.readyState >= 1) await applyPlaybackState();
  else player.addEventListener("loadedmetadata", applyPlaybackState, { once: true });
}

registerBlockType("text", {
  createElement() {
    return templates.text.content.firstElementChild.cloneNode(true);
  },

  initialize(block) {
    updateTextSourceBadge(block);
  },

  capture(block) {
    const editor = block.querySelector(".text-editor");
    return {
      text: editor.value,
      scrollTop: editor.scrollTop,
      cursorOffset: editor.selectionStart
    };
  },

  async restore(block, state = {}) {
    const editor = block.querySelector(".text-editor");
    editor.value = state.text ?? "";
    updateTextSourceBadge(block);

    requestAnimationFrame(() => {
      editor.scrollTop = Number.isFinite(state.scrollTop) ? state.scrollTop : 0;
      if (Number.isFinite(state.cursorOffset)) {
        const cursor = Math.min(state.cursorOffset, editor.value.length);
        editor.setSelectionRange(cursor, cursor);
      }
    });
  }
});

registerBlockType("pdf", {
  createElement() {
    return templates.pdf.content.firstElementChild.cloneNode(true);
  },

  initialize(block) {
    attachDocumentSave(block);
    setPdfEditMode(block, true);
    block.querySelector(".pdf-edit-mode").addEventListener("click", () => setPdfEditMode(block, !pdfEditEnabled(block)));
    bindPdfMarginDrag(block);
    block.querySelector(".pdf-margins-toggle").addEventListener("click",()=>{const runtime=runtimeSources.get(block);if(!runtime)return;const before=capturePdfPageGeometry(block,{viewport:runtime.pageData?.viewport});runtime.marginState.guidesVisible=!runtime.marginState.guidesVisible;renderPdfMarginGuides(block,runtime);recordPdfMutation(block,runtime,"pdf-margin-toggle",before);setDocumentDirty(block,true);});
    block.querySelector(".pdf-reset-margins").addEventListener("click",()=>{const runtime=runtimeSources.get(block);if(!runtime)return;runtime.marginState.defaultMargins={left:36,right:36,top:36,bottom:36};delete runtime.marginState.perPage[String(block.dataset.currentPage||1)];reconcilePdfMargins(block,runtime);setDocumentDirty(block,true);void setPdfPage(block,block.dataset.currentPage);});
    const fontSelect = block.querySelector(".pdf-font-family");
    PDF_STANDARD_FONTS.forEach(([label]) => fontSelect.add(new Option(label, label)));
    block.querySelectorAll(".pdf-toolbar details").forEach(details => details.addEventListener("toggle", () => {
      if (!details.open) return;
      block.querySelectorAll(".pdf-toolbar details").forEach(other => { if (other !== details) other.open = false; });
    }));
    block.querySelector(".pdf-prev").addEventListener("click", () => {
      setPdfPage(block, clampInteger(block.querySelector(".pdf-page").value, 1) - 1);
    });

    block.querySelector(".pdf-next").addEventListener("click", () => {
      setPdfPage(block, clampInteger(block.querySelector(".pdf-page").value, 1) + 1);
    });

    block.querySelector(".pdf-page").addEventListener("change", (event) => {
      void setPdfPage(block, event.currentTarget.value);
    });
    const zoomBy = factor => { const runtime=runtimeSources.get(block);if(!runtime)return;runtime.fitMode=null;runtime.zoom=clampPdfZoom((runtime.zoom||runtime.pageData?.viewport?.scale||1)*factor);void setPdfPage(block,block.dataset.currentPage); };
    block.querySelector(".pdf-zoom-out").addEventListener("click",()=>zoomBy(1/1.2));
    block.querySelector(".pdf-zoom-in").addEventListener("click",()=>zoomBy(1.2));
    block.querySelector(".pdf-zoom").addEventListener("change",event=>{const runtime=runtimeSources.get(block);if(!runtime)return;runtime.fitMode=null;runtime.zoom=clampPdfZoom(Number(event.target.value)/100);void setPdfPage(block,block.dataset.currentPage);});
    block.querySelector(".pdf-fit").addEventListener("change",event=>{const runtime=runtimeSources.get(block);if(!runtime)return;runtime.fitMode=event.target.value||null;if(!runtime.fitMode)runtime.zoom=1;void setPdfPage(block,block.dataset.currentPage);});
    const searchBox=block.querySelector(".pdf-search-box"),searchInput=block.querySelector(".pdf-search-input"),searchCount=block.querySelector(".pdf-search-count");
    const showSearch=()=>{searchBox.hidden=false;searchInput.focus();searchInput.select();};
    block.querySelector(".pdf-search-toggle").addEventListener("click",showSearch);
    block.querySelector(".pdf-search-close").addEventListener("click",()=>{searchBox.hidden=true;const runtime=runtimeSources.get(block);if(runtime)runtime.search=null;void setPdfPage(block,block.dataset.currentPage);});
    const runSearch=async()=>{const runtime=runtimeSources.get(block);if(!runtime)return;const query=searchInput.value,matches=await searchCurrentPdfDocument(runtime.model,runtime.edits,query);runtime.search={query,matches,index:matches.length?0:-1};searchCount.textContent=matches.length?`1 / ${matches.length}`:"0 / 0";if(matches.length)await setPdfPage(block,matches[0].page);};
    searchInput.addEventListener("change",()=>void runSearch());
    const stepSearch=direction=>{const runtime=runtimeSources.get(block),search=runtime?.search;if(!search?.matches.length)return;search.index=(search.index+direction+search.matches.length)%search.matches.length;searchCount.textContent=`${search.index+1} / ${search.matches.length}`;void setPdfPage(block,search.matches[search.index].page);};
    block.querySelector(".pdf-search-prev").addEventListener("click",()=>stepSearch(-1));block.querySelector(".pdf-search-next").addEventListener("click",()=>stepSearch(1));
    block.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="f"&&!event.target.closest('[contenteditable="true"]')){event.preventDefault();showSearch();}if(event.key==="Escape"&&!searchBox.hidden){event.preventDefault();block.querySelector(".pdf-search-close").click();}if(!event.target.closest("input,textarea,select,[contenteditable=true]")){if(event.key==="PageUp"){event.preventDefault();void setPdfPage(block,Number(block.dataset.currentPage)-1);}if(event.key==="PageDown"){event.preventDefault();void setPdfPage(block,Number(block.dataset.currentPage)+1);}if(event.key==="Home"){event.preventDefault();void setPdfPage(block,1);}if(event.key==="End"){event.preventDefault();void setPdfPage(block,runtimeSources.get(block)?.model.pageCount);}}});
    block.querySelector(".pdf-properties").addEventListener("click",async event=>{const runtime=runtimeSources.get(block);if(!runtime)return;const data=await pdfDocumentProperties(runtime.model,Number(block.dataset.currentPage));event.currentTarget.closest(".pdf-popdown").querySelector(".pdf-properties-list").replaceChildren(...Object.entries(data).map(([key,value])=>{const row=document.createElement("div");row.innerHTML=`<strong>${key.replace(/[A-Z]/g,m=>` ${m}`).replace(/^./,m=>m.toUpperCase())}</strong><span></span>`;row.lastChild.textContent=value||"—";return row;}));});
    block.querySelector(".pdf-copy-diagnostics").addEventListener("click",async()=>{const runtime=runtimeSources.get(block);if(!runtime)return;try{const page=Number(block.dataset.currentPage||1),telemetry=pdfTelemetry(runtime),root=block.querySelector(".pdf-text-layer"),observations=capturePdfPageDomObservations(root,{state:"idle"}),selectedObjectId=block.querySelector(".pdf-text-item.is-selected")?.dataset.objectId||null,editingObjectId=block.querySelector('.pdf-text-item .pdf-edit-text[contenteditable="true"]')?.closest(".pdf-text-item")?.dataset.objectId||null,pageGeometry=capturePdfPageGeometry(block,{viewport:runtime.pageData?.viewport}),visualScene=buildPdfVisualScene(block,runtime,{mode:getPdfDiagnosticMode(block)==="deep"?"deep":"debug",observations,pageGeometry,hoveredObjectId:telemetry.hoveredObjectId,selectedObjectId,editingObjectId,pointer:telemetry.lastPointer});const diagnostics=await createPdfPageDiagnostics(runtime.model,runtime.edits,page,{viewport:runtime.pageData?.viewport,observations,pageGeometry,pointerHitTest:telemetry.lastPointer,interactionJournal:telemetry.interactions.snapshot(),mutationJournal:telemetry.mutations.snapshot(),selectedObjectId,editingObjectId,visualScene});diagnostics.marginGuidesVisible=runtime.marginState.guidesVisible;diagnostics.marginConstraintsEnabled=runtime.marginState.constraintsEnabled;diagnostics.pdfMargins=runtime.marginDiagnostics?.margins||pdfLayoutForPage(runtime,page)?.margins;diagnostics.contentRect=runtime.marginDiagnostics?.contentRect||pdfLayoutForPage(runtime,page)?.contentRect;diagnostics.projectedGuides=runtime.marginDiagnostics?.projectedGuides||null;diagnostics.activeGuideDrag=runtime.marginDiagnostics?.activeGuideDrag||null;diagnostics.layoutViolations=runtime.marginDiagnostics?.reconciliation?.results?.filter(item=>!item.violations.inside)||[];if(!Array.isArray(diagnostics.contentGroups))diagnostics.contentGroups=[];await navigator.clipboard.writeText(JSON.stringify(diagnostics,null,2));setStatus(`Copied PDF page ${page} diagnostics (${diagnostics.objects.length} objects, ${diagnostics.issues.length} issues).`);}catch(error){console.error(error);setStatus("Could not copy PDF page diagnostics.");}});
    block.querySelector(".pdf-thumbnails").addEventListener("click",async()=>{const runtime=runtimeSources.get(block),panel=block.querySelector(".pdf-side-panel");if(!runtime)return;panel.hidden=false;panel.replaceChildren();const render=async(canvas,number)=>{if(canvas.dataset.rendered)return;canvas.dataset.rendered="true";const page=await runtime.model.pdf.getPage(number),viewport=page.getViewport({scale:.18}),ratio=devicePixelRatio||1;canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;await page.render({canvasContext:canvas.getContext("2d"),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]}).promise;};const observer=new IntersectionObserver(entries=>entries.filter(entry=>entry.isIntersecting).forEach(entry=>{void render(entry.target,Number(entry.target.dataset.page));observer.unobserve(entry.target);}),{root:panel,rootMargin:"150px"});for(let number=1;number<=runtime.model.pageCount;number++){const button=document.createElement("button"),canvas=document.createElement("canvas"),label=document.createElement("span");button.type="button";canvas.dataset.page=String(number);canvas.style.aspectRatio=".72";label.textContent=String(number);button.append(canvas,label);button.addEventListener("click",()=>void setPdfPage(block,number));panel.append(button);observer.observe(canvas);}});
    block.querySelector(".pdf-outline").addEventListener("click",async()=>{const runtime=runtimeSources.get(block),panel=block.querySelector(".pdf-side-panel");if(!runtime)return;panel.hidden=false;panel.replaceChildren();const outline=await runtime.model.pdf.getOutline();const add=async(items,depth=0)=>{for(const item of items||[]){const button=document.createElement("button");button.type="button";button.textContent=item.title||"Untitled";button.style.paddingInlineStart=`${8+depth*14}px`;button.addEventListener("click",async()=>{let destination=item.dest;if(typeof destination==="string")destination=await runtime.model.pdf.getDestination(destination);if(destination?.[0])void setPdfPage(block,(await runtime.model.pdf.getPageIndex(destination[0]))+1);});panel.append(button);await add(item.items,depth+1);}};await add(outline);if(!outline?.length)panel.textContent="No document outline.";});
    block.querySelector(".pdf-side-close").addEventListener("click",()=>{block.querySelector(".pdf-side-panel").hidden=true;});
    block.querySelector(".pdf-add-page").addEventListener("click", () => void applyPdfPageOperation(block, { type: "add", page: Number(block.dataset.currentPage || 1), to:Number(block.dataset.currentPage || 1)+1 }));
    block.querySelector(".pdf-rotate").addEventListener("click", () => void applyPdfPageOperation(block, { type: "rotate", page: Number(block.dataset.currentPage || 1), degrees: 90 }));
    block.querySelector(".pdf-delete").addEventListener("click", () => void applyPdfPageOperation(block, { type: "delete", page: Number(block.dataset.currentPage || 1) }).catch((error) => setStatus(error.message)));
    block.querySelector(".pdf-duplicate").addEventListener("click", () => void applyPdfPageOperation(block, { type: "duplicate", page: Number(block.dataset.currentPage || 1) }));
    block.querySelector(".pdf-move").addEventListener("click", () => { const to = Number(prompt("Move current page to position", block.dataset.currentPage || "1")); if (to) void applyPdfPageOperation(block, { type: "move", page: Number(block.dataset.currentPage || 1), to }); });
    block.querySelector(".pdf-extract").addEventListener("click", async()=>{const runtime=runtimeSources.get(block),page=Number(block.dataset.currentPage||1),blob=await runtime.serialize(),bytes=await extractPdfPages(new Uint8Array(await blob.arrayBuffer()),[page]);window.dispatchEvent(new CustomEvent("framechute:add-result-object",{detail:{blob:new Blob([bytes],{type:"application/pdf"}),name:`${block.querySelector('.block-name').value}-page-${page}.pdf`,kind:"pdf"}}));});
    block.querySelector(".pdf-merge").addEventListener("click",async()=>{try{const [handle]=await showOpenFilePicker({multiple:false,types:[{description:"PDF",accept:{"application/pdf":[".pdf"]}}]});if(!handle)return;const runtime=runtimeSources.get(block),base=await runtime.serialize(),added=await handle.getFile(),after=Number(block.dataset.currentPage||runtime.model.pageCount),bytes=await mergePdfBytes(new Uint8Array(await base.arrayBuffer()),new Uint8Array(await added.arrayBuffer()),after);await replacePdfRuntime(block,bytes,after+1);setStatus(`${added.name} inserted. Use Save As to preserve the original.`);}catch(error){if(error.name!=="AbortError")setStatus(error.message);}});
    block.querySelector(".pdf-images").addEventListener("click",()=>void exportPdfImages(block).catch(error=>setStatus(error.message)));
    block.querySelector(".pdf-crop").addEventListener("click",async()=>{const margin=Number(prompt("Crop all margins by PDF points (72 = 1 inch)","18"));if(!Number.isFinite(margin))return;const runtime=runtimeSources.get(block),blob=await runtime.serialize(),page=Number(block.dataset.currentPage||1),bytes=await cropPdfMargins(new Uint8Array(await blob.arrayBuffer()),page,{left:margin,right:margin,top:margin,bottom:margin});await replacePdfRuntime(block,bytes,page);});
    block.querySelector(".pdf-compress").addEventListener("click",async()=>{const runtime=runtimeSources.get(block),blob=await runtime.serialize(),original=new Uint8Array(await blob.arrayBuffer()),candidate=await conservativelyCompressPdf(original),choice=chooseSmallerPdf(original,candidate);if(!choice.changed){setStatus(`No smaller safe PDF was produced (${original.length.toLocaleString()} → ${candidate.length.toLocaleString()} bytes); the current PDF was kept.`);return;}await replacePdfRuntime(block,choice.bytes,Number(block.dataset.currentPage||1));setStatus(`PDF compressed conservatively: ${original.length.toLocaleString()} → ${candidate.length.toLocaleString()} bytes. Embedded images were not recompressed.`);});

    const textLayer = block.querySelector(".pdf-text-layer");
    const interactiveOutline=document.createElement("div");interactiveOutline.className="pdf-interactive-outline";interactiveOutline.hidden=true;textLayer.append(interactiveOutline);
    const paintInteractiveOutline=event=>{
      if(!interactiveOutline.isConnected)textLayer.append(interactiveOutline);
      const item=event.target.closest?.(".pdf-text-item");
      if(!item||item.classList.contains("is-editing")||item.querySelector?.('[contenteditable="true"]')){interactiveOutline.hidden=true;return;}
      const observation=capturePdfPageDomObservations({getBoundingClientRect:()=>textLayer.getBoundingClientRect(),querySelectorAll:()=>[item]},{state:"hover"})[0];
      const ink=observation?.inkUnion,layer=textLayer.getBoundingClientRect();
      const authority=resolvePdfInteractiveTextRect({objectId:observation?.objectId,presentationTruthKind:observation?.presentationTruthKind,sourceProjectionRect:observation?.clientRect,glyphInkRect:ink,domRect:observation?.clientRect,padding:1});
      const rect=authority.interactiveRect;if(!rect){interactiveOutline.hidden=true;return;}
      Object.assign(interactiveOutline.style,{left:`${rect.x-layer.left}px`,top:`${rect.y-layer.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});interactiveOutline.hidden=false;
    };
    textLayer.addEventListener("pointerover",paintInteractiveOutline,true);
    textLayer.addEventListener("pointerout",event=>{if(!event.relatedTarget?.closest?.(".pdf-text-item"))interactiveOutline.hidden=true;},true);
    for(const type of ["pointerover","pointermove","pointerout","pointerdown","mousedown","click"]){textLayer.addEventListener(type,event=>{const runtime=runtimeSources.get(block),object=event.target.closest?.(".pdf-text-item");if(!runtime||getPdfDiagnosticMode(block)==="off")return;const telemetry=pdfTelemetry(runtime);telemetry.hoveredObjectId=type==="pointerout"?null:object?.dataset.objectId||null;recordPdfGeometry(block,runtime,type,object);const state=type==="pointerover"||type==="pointermove"?"hover":type==="pointerout"?"idle":type,observations=capturePdfPageDomObservations(textLayer,{state});telemetry.lastPointer=capturePointerHitTest(event,textLayer,{observations});},true);}
    const claimPdfImage = event => {
      if (!pdfEditEnabled(block)) return false;
      if (!claimDocumentDrop("pdf", event)) return false;
      event.preventDefault(); event.stopPropagation(); workspace.classList.remove("is-drop-target");
      if (event.dataTransfer) event.dataTransfer.dropEffect=documentImageDropEffect(activeInternalDrag(),"pdf",block);
      return true;
    };
    textLayer.addEventListener("dragenter", claimPdfImage, true);
    textLayer.addEventListener("dragover", claimPdfImage, true);
    textLayer.addEventListener("dragleave", clearDocumentDragState, true);
    textLayer.addEventListener("drop", async event => {
      if (!claimPdfImage(event)) return;
      clearDocumentDragState();
      const drag=activeInternalDrag(),runtime=runtimeSources.get(block);
      if(drag?.originKind==="pdf"&&drag.block===block){const edit=runtime?.edits?.find(item=>item.id===drag.originObjectId),surface=textLayer.getBoundingClientRect(),display=drag.originElement?.closest(".pdf-image-edit")?.getBoundingClientRect();if(edit&&display){pushPdfHistory(runtime);let geometry=viewportRectToPdf(runtime.pageData.viewport,{left:event.clientX-surface.left-display.width/2,top:event.clientY-surface.top-display.height/2,width:display.width,height:display.height}),layout=pdfLayoutForPage(runtime,edit.page);if(runtime.marginState.constraintsEnabled&&layout)geometry=constrainRectToLayoutBounds(geometry,layout.contentRect).rect;repositionPdfImage(edit,geometry);endInternalDrag();setDocumentDirty(block,true);await setPdfPage(block,block.dataset.currentPage);return;}}
      const blobs=await imageBlobsForDrop(event); if(!blobs.length||!runtime?.pageData){endInternalDrag();return;}
      let inserted=0; for(const blob of blobs){
        if(!/^image\/(png|jpeg)$/i.test(blob.type)){setStatus("PDF insertion supports PNG and JPEG images.");continue;}
        const bitmap=await createImageBitmap(blob),surface=textLayer.getBoundingClientRect(),scale=Math.min(1,runtime.pageData.viewport.width*.45/bitmap.width,runtime.pageData.viewport.height*.45/bitmap.height),displayWidth=bitmap.width*scale,displayHeight=bitmap.height*scale;
        const left=Math.max(0,Math.min(runtime.pageData.viewport.width-displayWidth,event.clientX-surface.left-displayWidth/2)),top=Math.max(0,Math.min(runtime.pageData.viewport.height-displayHeight,event.clientY-surface.top-displayHeight/2));
        let geometry=viewportRectToPdf(runtime.pageData.viewport,{left,top,width:displayWidth,height:displayHeight});const layout=pdfLayoutForPage(runtime,Number(block.dataset.currentPage));if(runtime.marginState.constraintsEnabled&&layout)geometry=constrainRectToLayoutBounds(geometry,layout.contentRect).rect;const bytes=new Uint8Array(await blob.arrayBuffer());bitmap.close();
        pushPdfHistory(runtime);runtime.edits.push({kind:"image",id:`image:${crypto.randomUUID?.()||Date.now()}`,index:-Date.now()-runtime.edits.length,page:Number(block.dataset.currentPage),mime:blob.type.toLowerCase(),base64:bytesToBase64(bytes),wrapText:true,...geometry});inserted++;
      }
      endInternalDrag();if(!inserted)return;setDocumentDirty(block,true);await setPdfPage(block,block.dataset.currentPage);setStatus(`${inserted} image${inserted===1?"":"s"} inserted into the PDF.`);
    }, true);
    const visualTextTarget=event=>{
      const observations=capturePdfPageDomObservations(textLayer,{state:event.type});
      const candidates=observations.map(item=>{
        const authority=resolvePdfInteractiveTextRect({objectId:item.objectId,presentationTruthKind:item.presentationTruthKind,sourceProjectionRect:item.clientRect,glyphInkRect:item.inkUnion,domRect:item.clientRect,padding:1});
        return {objectId:item.objectId,glyphInkRect:item.presentationTruthKind==="canvas-source-text"?item.clientRect:item.inkUnion,interactiveRect:authority.interactiveRect};
      });
      const resolved=resolvePdfVisualTarget({x:event.clientX,y:event.clientY},candidates);
      return resolved.objectId?[...textLayer.querySelectorAll(".pdf-text-item")].find(node=>String(node.dataset.objectId)===String(resolved.objectId))||null:null;
    };
    textLayer.addEventListener("click", (event) => selectPdfEdit(block, pdfEditEnabled(block) ? visualTextTarget(event) : null));
    textLayer.addEventListener("dblclick", (event) => {
      if (!pdfEditEnabled(block)) return;
      const span = visualTextTarget(event);
      if (!span) {
        if (block.dataset.pdfHasSourceText === "false") {
          setStatus("This PDF page has no embedded text to edit. It appears to be image/vector content; OCR support will be needed for direct text editing.");
        }
        return;
      }
      const text = span.querySelector(".pdf-edit-text");
      if (!text) return;
      const runtime = runtimeSources.get(block);
      const beforeGeometry=capturePdfPageGeometry(block,{viewport:runtime?.pageData?.viewport});
      recordPdfGeometry(block,runtime,"dblclick",span);
      pdfTelemetry(runtime).lastPointer=capturePointerHitTest(event,textLayer,{observations:capturePdfPageDomObservations(textLayer,{state:"dblclick"})});
      const index = Number(span.dataset.index);
      const page = Number(block.dataset.currentPage || 1);
      const existing = runtime?.edits?.find(edit => edit.page === page && edit.index === index && edit.kind !== "image");
      const original = index >= 0 ? runtime?.pageData?.content?.items?.[index] : null;
      const initialFontSize = existing?.fontSize ?? inferPdfSourceFontSize(original, 12);
      text.dataset.pendingFontSize = String(initialFontSize);
      const controls = block.querySelector(".pdf-edit-controls");
      const fontSizeInput = controls?.querySelector(".pdf-font-size");
      if (controls) controls.hidden = false;
      recordPdfMutation(block,runtime,"pdf-edit-controls-revealed",beforeGeometry);
      if (fontSizeInput) fontSizeInput.value = String(Math.round(initialFontSize * 10) / 10);
      span.style.fontSize = `${initialFontSize * (runtime?.pageData?.viewport?.scale || 1)}px`;
      if (!existing && index >= 0) createPdfLiveEditMask(textLayer, span);
      recordPdfGeometry(block,runtime,"before-contenteditable",span);
      text.contentEditable = "true"; text.dataset.before = text.textContent; text.closest(".pdf-text-item")?.classList.add("is-editing");interactiveOutline.hidden=true;
      recordPdfGeometry(block,runtime,"after-contenteditable",span);
      text.focus();
      recordPdfGeometry(block,runtime,"after-focus",span);
      const range = document.createRange(); range.selectNodeContents(text);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      recordPdfGeometry(block,runtime,"selection-created",span);
    });
    textLayer.addEventListener("input", event=>{
      const text=event.target.closest?.('.pdf-edit-text[contenteditable="true"]');if(!text)return;
      const span=text.closest(".pdf-text-item"),left=Number.parseFloat(span.style.left)||0,minWidth=Number(span.dataset.editMinWidth)||(Number.parseFloat(span.style.width)||1),maxWidth=Math.max(minWidth,textLayer.clientWidth-left);
      span.dataset.editMinWidth=String(minWidth);
      text.style.width="max-content";const needed=Math.ceil(text.scrollWidth+4);text.style.width="100%";
      const width=Math.min(maxWidth,Math.max(minWidth,needed)),height=Math.max(Number.parseFloat(span.style.height)||1,Math.ceil(text.scrollHeight));
      Object.assign(span.style,{width:`${width}px`,height:`${height}px`});
      createPdfLiveEditMask(textLayer,span);
    });
    textLayer.addEventListener("keydown", (event) => {
      if (!pdfEditEnabled(block)) return;
      const text=event.target.closest('.pdf-edit-text[contenteditable="true"]');
      if(text&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="a"){
        event.preventDefault();
        event.stopPropagation();
        const range=document.createRange();range.selectNodeContents(text);
        const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
        return;
      }
      if(text&&event.key==="Enter"&&!event.shiftKey){event.preventDefault();event.stopPropagation();text.blur();}
      if(text&&event.key==="Tab"){event.preventDefault();document.execCommand("insertText",false,"\t");}
      if(text&&event.key==="Escape"){event.preventDefault();text.dataset.cancel="true";text.textContent=text.dataset.before;text.blur();}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();void travelPdfHistory(block,event.shiftKey?"redo":"undo");}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="y"){event.preventDefault();void travelPdfHistory(block,"redo");}
      if(!text&&selectedPdfEdit(block)&&["Delete","Backspace"].includes(event.key)){event.preventDefault();const runtime=runtimeSources.get(block);pushPdfHistory(runtime);runtime.edits.splice(runtime.edits.indexOf(selectedPdfEdit(block)),1);setDocumentDirty(block,true);void setPdfPage(block,block.dataset.currentPage);return;}
      const edit=selectedPdfEdit(block);if(edit&&!text&&event.key.startsWith("Arrow")){event.preventDefault();const runtime=runtimeSources.get(block);pushPdfHistory(runtime);const amount=event.shiftKey?10:1,desired={dx:event.key==="ArrowLeft"?-amount:event.key==="ArrowRight"?amount:0,dy:event.key==="ArrowDown"?-amount:event.key==="ArrowUp"?amount:0},layout=pdfLayoutForPage(runtime,edit.page),movement=runtime.marginState.constraintsEnabled&&layout?constrainTranslationToLayoutBounds(edit,desired,layout.contentRect):{rect:{...edit,x:edit.x+desired.dx,y:edit.y+desired.dy}};Object.assign(edit,movement.rect);setDocumentDirty(block,true);void setPdfPage(block,block.dataset.currentPage);}
    });
    textLayer.addEventListener("focusout", (event) => {
      const text = event.target.closest('.pdf-edit-text[contenteditable="true"]');
      if (!text) return;
      text.removeAttribute("contenteditable");
      text.closest(".pdf-text-item")?.classList.remove("is-editing");
      removePdfLiveEditMask(textLayer);
      if(text.dataset.cancel){delete text.dataset.cancel;delete text.dataset.pendingFontSize;return;}
      const span=text.closest(".pdf-text-item"),runtime = runtimeSources.get(block); if (!runtime?.pageData) return;
      const index = Number(span.dataset.index),page = Number(block.dataset.currentPage || 1);
      if(index<0){delete text.dataset.pendingFontSize;return;}
      const original = runtime.pageData.content.items[index],replacement = text.innerText.replace(/\r\n?/g,"\n");
      const existing = runtime.edits.find((edit) => edit.page === page && edit.index === index);
      if(replacement===(existing?.replacement??original.str)){delete text.dataset.pendingFontSize;return;}
      pushPdfHistory(runtime);
      if (replacement === original.str) { if (existing) runtime.edits.splice(runtime.edits.indexOf(existing), 1); }
      else if(existing){existing.replacement=replacement;Object.assign(existing,viewportRectToPdf(runtime.pageData.viewport,{left:parseFloat(span.style.left),top:parseFloat(span.style.top),width:parseFloat(span.style.width),height:parseFloat(span.style.height)}));}
      else {
        const rect={left:parseFloat(span.style.left),top:parseFloat(span.style.top),width:parseFloat(span.style.width),height:parseFloat(span.style.height)},geometry=viewportRectToPdf(runtime.pageData.viewport,rect);
        const fontSize=Math.max(4,Math.min(144,Number(text.dataset.pendingFontSize)||inferPdfSourceFontSize(original,12)));
        runtime.edits.push(ensurePdfEditIdentity({kind:"replacement",id:createPdfEditId(),sourceObjectId:span.dataset.sourceObjectId||undefined,page,index,original:original.str,replacement,...geometry,sourceX:geometry.x,sourceY:geometry.y,sourceWidth:geometry.width,sourceHeight:geometry.height,fontFamily:"Helvetica",fontSize,rotation:0}));
      }
      const committed=runtime.edits.find(edit=>edit.page===page&&edit.index===index&&edit.kind!=="image");
      if(committed)reflowPdfTextEditGeometry(committed);
      delete text.dataset.pendingFontSize;
      setDocumentDirty(block,true);void setPdfPage(block,page);
    });
    textLayer.addEventListener("pointerdown",event=>{
      if (!pdfEditEnabled(block)) return;
      const handle=event.target.closest(".pdf-move-handle,.pdf-resize-handle"),span=handle?.closest(".pdf-text-edit"),runtime=runtimeSources.get(block),edit=selectedPdfEdit(block);if(!handle||!span||!edit)return;
      event.preventDefault();event.stopPropagation();const start={x:event.clientX,y:event.clientY,left:parseFloat(span.style.left),top:parseFloat(span.style.top),width:parseFloat(span.style.width),height:parseFloat(span.style.height)};pushPdfHistory(runtime);handle.setPointerCapture(event.pointerId);
      const move=moveEvent=>{const dx=moveEvent.clientX-start.x,dy=moveEvent.clientY-start.y,isMove=handle.matches(".pdf-move-handle");let next=viewportRectToPdf(runtime.pageData.viewport,{left:start.left+(isMove?dx:0),top:start.top+(isMove?dy:0),width:Math.max(2,start.width+(isMove?0:dx)),height:Math.max(2,start.height+(isMove?0:dy))});const layout=pdfLayoutForPage(runtime,edit.page);if(runtime.marginState.constraintsEnabled&&layout)next=isMove?constrainTranslationToLayoutBounds(edit,{dx:next.x-edit.x,dy:next.y-edit.y},layout.contentRect).rect:constrainResizeToLayoutBounds(edit,next,layout.contentRect,{minimumWidth:2,minimumHeight:2,preserveAspectRatio:edit.kind==="image"}).rect;Object.assign(edit,next);const projected=pdfRectToViewport(runtime.pageData.viewport,next),display={left:projected[0],top:projected[1],width:projected[2]-projected[0],height:projected[3]-projected[1]};Object.assign(span.style,{left:`${display.left}px`,top:`${display.top}px`,width:`${display.width}px`,height:`${display.height}px`});syncPdfReplacementFieldMask(textLayer,edit,display,runtime.pageData.viewport);};
      handle.addEventListener("pointermove",move);handle.addEventListener("pointerup",()=>{handle.removeEventListener("pointermove",move);setDocumentDirty(block,true);void setPdfPage(block,block.dataset.currentPage);},{once:true});
    });
    block.querySelector(".pdf-undo").addEventListener("click",()=>void travelPdfHistory(block,"undo"));
    block.querySelector(".pdf-redo").addEventListener("click",()=>void travelPdfHistory(block,"redo"));
    block.querySelector(".pdf-font-size").addEventListener("change",event=>{
      if(!pdfEditEnabled(block))return;
      const runtime=runtimeSources.get(block);
      const activeText=textLayer.querySelector('.pdf-edit-text[contenteditable="true"]');
      const currentEdit=selectedPdfEdit(block);
      const fallback=Number(activeText?.dataset.pendingFontSize)||currentEdit?.fontSize||12;
      const size=Math.max(4,Math.min(144,Number(event.target.value)||fallback));
      event.target.value=String(Math.round(size*10)/10);
      if(activeText){
        activeText.dataset.pendingFontSize=String(size);
        activeText.closest(".pdf-text-item").style.fontSize=`${size*(runtime?.pageData?.viewport?.scale||1)}px`;
        if(currentEdit&&currentEdit.kind!=="image"&&currentEdit.fontSize!==size){
          pushPdfHistory(runtime);currentEdit.fontSize=size;setDocumentDirty(block,true);
        }
        return;
      }
      if(!currentEdit||currentEdit.kind==="image"||size===currentEdit.fontSize)return;
      pushPdfHistory(runtime);currentEdit.fontSize=size;reflowPdfTextEditGeometry(currentEdit);setDocumentDirty(block,true);void setPdfPage(block,block.dataset.currentPage);
    });
    fontSelect.addEventListener("change",event=>{if(!pdfEditEnabled(block))return;const runtime=runtimeSources.get(block),edit=selectedPdfEdit(block);if(!edit||edit.fontFamily===event.target.value)return;pushPdfHistory(runtime);edit.fontFamily=event.target.value;setDocumentDirty(block,true);void setPdfPage(block,block.dataset.currentPage);});


    block.querySelector(".reconnect-source").addEventListener("click", async () => {
      try {
        await reconnectSource(block, pickPdfFile, async (handle) => loadPdfHandle(block, handle, this.capture(block)));
      } catch (error) {
        console.error(error);
        setStatus("Could not reconnect that PDF.");
      }
    });
  },

  capture(block) {
    const runtime = runtimeSources.get(block);
    return { page: clampInteger(block.querySelector(".pdf-page").value, 1), zoom:runtime?.zoom, fitMode:runtime?.fitMode, editMode:pdfEditEnabled(block), pdfLayoutMargins:structuredClone(runtime?.marginState||createPdfMarginState()), edits: structuredClone(runtime?.edits || []), dirty: block.dataset.documentDirty === "true", structurallyDirty:Boolean(runtime?.structurallyDirty), embeddedBlob:(!getSourceRecord(block)||runtime?.structurallyDirty)&&runtime?.model?.bytes?new Blob([runtime.model.bytes],{type:"application/pdf"}):null };
  },

  async restore(block, state = {}, source = null) {
    setPdfPage(block, state.page ?? 1);
    const handle = await storedReadableHandle(source);

    if(state.embeddedBlob instanceof Blob)await loadPdfBytes(block,new Uint8Array(await state.embeddedBlob.arrayBuffer()),state);
    else if(state.embeddedPdfBase64)await loadPdfBytes(block,base64ToBytes(state.embeddedPdfBase64),state);
    else if (handle) await loadPdfHandle(block, handle, state);
    else setSourceUnavailable(block, `Reconnect ${source?.displayName ?? "this PDF"} to display it.`);
  }
});

function docxBlocksFromEditor(editor) {
  const imageRun = (node) => {
    if (node.matches?.("img[data-docx-relationship], .docx-image-preserved[data-docx-relationship]")) {
      return { kind: "image", relationshipId: node.dataset.docxRelationship, part: node.dataset.docxPart, mime: node.dataset.docxMime, width: Number(node.dataset.docxWidth) || node.width || null, height: Number(node.dataset.docxHeight) || node.height || null, unsupported: node.dataset.docxUnsupported === "true" };
    }
    if (node.matches?.(".docx-artifact-preserved[data-docx-artifact]")) {
      try {
        return { kind:"artifact", artifact:JSON.parse(base64ToText(node.dataset.docxArtifact)) };
      } catch {
        return null;
      }
    }
    if (node.matches?.(".docx-math[data-docx-math-xml]")) {
      let math=null;
      try { math=node.dataset.docxMathAst ? JSON.parse(base64ToText(node.dataset.docxMathAst)) : null; } catch { math=null; }
      return {
        kind:"math",
        mathXml:base64ToText(node.dataset.docxMathXml),
        math,
        mathDisplay:node.dataset.docxMathDisplay==="true"
      };
    }
    return null;
  };
  const paragraph = (node, list="") => ({
    type: "paragraph",
    sourceIndex: node.dataset.docxSourceIndex ? Number(node.dataset.docxSourceIndex) : null,
    style: node.dataset.docxStyle || (/^H[1-6]$/.test(node.tagName) ? `Heading${node.tagName.slice(1)}` : ""),
    list: node.dataset.docxList || list,
    numId: node.dataset.docxNumId ? Number(node.dataset.docxNumId) : null,
    level: Math.max(0, Number(node.dataset.docxListLevel) || 0),
    numberFormat: node.dataset.docxNumberFormat || "",
    numberText: node.dataset.docxNumberText || "",
    numberStart: Math.max(1, Number(node.dataset.docxNumberStart) || 1),
    alignment: node.style.textAlign || "left",
    lineSpacing: Number(node.style.lineHeight)||null,
    spaceBefore: parseFloat(node.style.marginTop)||0,
    spaceAfter: parseFloat(node.style.marginBottom)||0,
    indentLeft: parseFloat(node.style.marginLeft)||0,
    indentRight: parseFloat(node.style.marginRight)||0,
    firstLine: parseFloat(node.style.textIndent)||0,
    pageBreak: node.dataset.pageBreak==="true",
    runs: editorNodeToRuns(node, imageRun)
  });
  const blocks = [];
  for (const node of editor.children) {
    if (node.matches?.(".docx-supplemental")) continue;
    if (node.matches?.(".docx-preserved-object")) {
      blocks.push({
        type: "preserved",
        sourceIndex: Number(node.dataset.docxSourceIndex),
        preservedTag: node.dataset.docxPreservedTag || "object",
        previewText: node.dataset.docxPreviewText || node.textContent || ""
      });
    }
    else if (node.tagName === "TABLE") blocks.push({ type: "table", sourceIndex: node.dataset.docxSourceIndex ? Number(node.dataset.docxSourceIndex) : null, rows: [...node.rows].map((row) => [...row.cells].map((cell) => [...cell.children].map(paragraph))) });
    else if (["UL", "OL"].includes(node.tagName)) for (const item of node.children) blocks.push(paragraph(item,node.tagName === "OL" ? "number" : "bullet"));
    else blocks.push(paragraph(node));
  }
  return blocks;
}

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

function mathMlElement(name, ...children) {
  const node=document.createElementNS(MATHML_NS,name);
  for(const child of children.flat()) if(child) node.append(child);
  return node;
}

function mathMlToken(text) {
  const value=String(text ?? "");
  const trimmed=value.trim();
  const operator=/^(?:[+\-−=×÷·⋅±∓<>≤≥≈≠∑∏∫∮√∞∂∇∈∉∋∩∪∧∨¬→←↔⇒⇐⇔,:;|()\[\]{}])$/u.test(trimmed);
  const numeric=/^[0-9]+(?:[.,][0-9]+)?$/.test(trimmed);
  const tag=operator?"mo":numeric?"mn":"mi";
  const node=mathMlElement(tag);
  node.textContent=value;
  if(tag==="mi" && value.length>1) node.setAttribute("mathvariant","normal");
  return node;
}

function mathAstEmpty(ast) {
  if(!ast) return true;
  if(ast.type==="token") return !ast.text;
  if(ast.type==="row") return !(ast.children||[]).some(child=>!mathAstEmpty(child));
  return false;
}

function renderMathAst(ast) {
  if(!ast) return mathMlElement("mrow");
  switch(ast.type) {
    case "token": return mathMlToken(ast.text);
    case "row": return mathMlElement("mrow",(ast.children||[]).map(renderMathAst));
    case "frac": {
      const node=mathMlElement("mfrac",renderMathAst(ast.numerator),renderMathAst(ast.denominator));
      if(ast.bar===false) node.setAttribute("linethickness","0");
      return node;
    }
    case "sup": return mathMlElement("msup",renderMathAst(ast.base),renderMathAst(ast.sup));
    case "sub": return mathMlElement("msub",renderMathAst(ast.base),renderMathAst(ast.sub));
    case "subsup": return mathMlElement("msubsup",renderMathAst(ast.base),renderMathAst(ast.sub),renderMathAst(ast.sup));
    case "rad":
      return ast.degree && !mathAstEmpty(ast.degree)
        ? mathMlElement("mroot",renderMathAst(ast.body),renderMathAst(ast.degree))
        : mathMlElement("msqrt",renderMathAst(ast.body));
    case "nary": {
      const op=mathMlToken(ast.operator||"∑");
      let scripted=op;
      const hasSub=ast.sub&&!mathAstEmpty(ast.sub),hasSup=ast.sup&&!mathAstEmpty(ast.sup);
      if(hasSub&&hasSup) scripted=mathMlElement("munderover",op,renderMathAst(ast.sub),renderMathAst(ast.sup));
      else if(hasSub) scripted=mathMlElement("munder",op,renderMathAst(ast.sub));
      else if(hasSup) scripted=mathMlElement("mover",op,renderMathAst(ast.sup));
      return mathMlElement("mrow",scripted,renderMathAst(ast.body));
    }
    case "delim": {
      const row=mathMlElement("mrow");
      if(ast.begin) row.append(mathMlToken(ast.begin));
      (ast.items||[]).forEach((item,index)=>{
        if(index&&ast.separator) row.append(mathMlToken(ast.separator));
        row.append(renderMathAst(item));
      });
      if(ast.end) row.append(mathMlToken(ast.end));
      return row;
    }
    case "func": return mathMlElement("mrow",renderMathAst(ast.name),renderMathAst(ast.body));
    case "accent": {
      const mark=mathMlToken(ast.accent||"ˆ");
      mark.setAttribute("accent","true");
      return mathMlElement("mover",renderMathAst(ast.body),mark);
    }
    case "bar": {
      const mark=mathMlToken(ast.position==="bot"?"_":"¯");
      mark.setAttribute("accent","true");
      return ast.position==="bot"
        ? mathMlElement("munder",renderMathAst(ast.body),mark)
        : mathMlElement("mover",renderMathAst(ast.body),mark);
    }
    case "group": {
      const mark=mathMlToken(ast.character||"⏞");
      return ast.position==="bot"
        ? mathMlElement("munder",renderMathAst(ast.body),mark)
        : mathMlElement("mover",renderMathAst(ast.body),mark);
    }
    case "limlow": return mathMlElement("munder",renderMathAst(ast.base),renderMathAst(ast.limit));
    case "limupp": return mathMlElement("mover",renderMathAst(ast.base),renderMathAst(ast.limit));
    case "eqarr": {
      const table=mathMlElement("mtable");
      for(const rowAst of ast.rows||[]) table.append(mathMlElement("mtr",mathMlElement("mtd",renderMathAst(rowAst))));
      return table;
    }
    case "matrix": {
      const table=mathMlElement("mtable");
      for(const row of ast.rows||[]) {
        table.append(mathMlElement("mtr",(row||[]).map(cell=>mathMlElement("mtd",renderMathAst(cell)))));
      }
      return table;
    }
    case "box": {
      const enclosure=mathMlElement("menclose",renderMathAst(ast.body));
      enclosure.setAttribute("notation","box");
      return enclosure;
    }
    case "phantom": return mathMlElement("mphantom",renderMathAst(ast.body));
    default: return mathMlElement("mrow");
  }
}

function renderDocxMath(run) {
  const wrapper=document.createElement("span");
  wrapper.className="docx-math";
  if(run.mathDisplay) wrapper.classList.add("docx-math-display");
  wrapper.contentEditable="false";
  wrapper.draggable=false;
  wrapper.title="DOCX equation preserved as Office Math";
  wrapper.dataset.docxMathXml=textToBase64(run.mathXml||"");
  wrapper.dataset.docxMathAst=textToBase64(JSON.stringify(run.math||null));
  wrapper.dataset.docxMathDisplay=String(Boolean(run.mathDisplay));

  const math=mathMlElement("math",renderMathAst(run.math));
  math.setAttribute("display",run.mathDisplay?"block":"inline");
  math.setAttribute("aria-label","Equation");
  wrapper.append(math);
  return wrapper;
}

function renderDocxEditor(block, blocks, model = runtimeSources.get(block)?.model) {
  const editor = block.querySelector(".docx-editor");
  editor.replaceChildren();

  const layout=model?.pageLayout;
  if(layout) {
    editor.style.width=`${layout.widthIn}in`;
    editor.style.minWidth=`${layout.widthIn}in`;
    editor.style.maxWidth="none";
    editor.style.minHeight=`${layout.heightIn}in`;
    editor.style.padding=`${layout.marginTopIn}in ${layout.marginRightIn}in ${layout.marginBottomIn}in ${layout.marginLeftIn}in`;
    editor.dataset.docxPageWidth=String(layout.widthIn);
    editor.dataset.docxPageHeight=String(layout.heightIn);
  } else {
    editor.style.width="8.5in";
    editor.style.minWidth="8.5in";
    editor.style.maxWidth="none";
    editor.style.minHeight="11in";
  }

  const urls = [];
  const numberingState=new DocxNumberingState(model?.numbering);

  const addParagraph = (p, parent = editor, { listItem = false } = {}) => {
    const heading = /^Heading([1-6])$/i.exec(p.style || "");
    const tag = listItem ? "li" : (heading ? `h${heading[1]}` : "p");
    const element = document.createElement(tag);

    if(p.sourceIndex!=null) element.dataset.docxSourceIndex=String(p.sourceIndex);
    if(p.style) element.dataset.docxStyle=p.style;
    if(p.list) element.dataset.docxList=p.list;
    if(p.numId!=null) element.dataset.docxNumId=String(p.numId);
    if(p.level!=null) element.dataset.docxListLevel=String(p.level);
    if(p.numberFormat) element.dataset.docxNumberFormat=p.numberFormat;
    if(p.numberText) element.dataset.docxNumberText=p.numberText;
    if(p.numberStart) element.dataset.docxNumberStart=String(p.numberStart);

    element.style.textAlign = p.alignment || "left";
    if(p.lineSpacing) element.style.lineHeight=String(p.lineSpacing);
    if(p.spaceBefore) element.style.marginTop=`${p.spaceBefore}pt`;
    if(p.spaceAfter!=null) element.style.marginBottom=`${p.spaceAfter}pt`;
    if(p.indentLeft) element.style.marginLeft=`${p.indentLeft}in`;
    if(p.indentRight) element.style.marginRight=`${p.indentRight}in`;
    if(p.firstLine) element.style.textIndent=`${p.firstLine}in`;
    if(p.pageBreak) element.dataset.pageBreak="true";

    if(listItem) {
      element.dataset.docxNumberLabel=numberingState.label(p);
      element.classList.add("docx-list-item");
    }

    for (const run of p.runs || []) {
      if (run.mathXml || run.math) {
        element.append(renderDocxMath(run));
      }

      if(run.artifact) {
        const artifact=document.createElement("span");
        artifact.className="docx-artifact-preserved";
        artifact.hidden=true;
        artifact.contentEditable="false";
        artifact.dataset.docxArtifact=textToBase64(JSON.stringify(run.artifact));
        artifact.dataset.docxCapability=run.artifact.capability||"unsupportedPreserved";
        element.append(artifact);
      }

      for(const drawing of run.drawings||[]) {
        const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");
        svg.classList.add("docx-drawing"); svg.contentEditable="false"; svg.dataset.docxCapability="readOnlyRenderable";
        svg.setAttribute("viewBox",`0 0 ${drawing.width} ${drawing.height}`); svg.style.width=`${drawing.width}px`; svg.style.height=`${drawing.height}px`;
        const shape=document.createElementNS(ns,["ellipse","oval"].includes(drawing.geometry)?"ellipse":drawing.geometry.includes("line")?"line":"rect");
        if(shape.localName==="ellipse") { shape.setAttribute("cx",drawing.width/2);shape.setAttribute("cy",drawing.height/2);shape.setAttribute("rx",drawing.width/2-2);shape.setAttribute("ry",drawing.height/2-2); }
        else if(shape.localName==="line") { shape.setAttribute("x1","2");shape.setAttribute("y1",String(drawing.height-2));shape.setAttribute("x2",String(drawing.width-2));shape.setAttribute("y2","2"); }
        else { shape.setAttribute("x","2");shape.setAttribute("y","2");shape.setAttribute("width",String(drawing.width-4));shape.setAttribute("height",String(drawing.height-4));if(drawing.geometry==="roundRect")shape.setAttribute("rx","8"); }
        shape.setAttribute("fill",shape.localName==="line"?"none":drawing.fill);shape.setAttribute("stroke",drawing.stroke);shape.setAttribute("stroke-width","2");svg.append(shape);
        if(drawing.text){const text=document.createElementNS(ns,"text");text.setAttribute("x",String(drawing.width/2));text.setAttribute("y",String(drawing.height/2));text.setAttribute("text-anchor","middle");text.textContent=drawing.text;svg.append(text);}
        if(drawing.rotation)svg.style.transform=`rotate(${drawing.rotation}deg)`;
        element.append(svg);
      }

      if (run.text) {
        const span = run.hyperlink ? document.createElement("a") : document.createElement("span");
        span.textContent = run.text;
        if(run.hyperlink) span.href=run.hyperlink;
        span.style.fontWeight=run.bold?"bold":"";
        span.style.fontStyle=run.italic?"italic":"";
        span.style.textDecoration=[run.underline&&"underline",run.strike&&"line-through"].filter(Boolean).join(" ");
        if(run.color) span.style.color=run.color;
        if(run.highlight) span.style.backgroundColor=run.highlight;
        if(run.fontFamily) span.style.fontFamily=run.fontFamily;
        if(run.fontSize) span.style.fontSize=`${run.fontSize}pt`;
        if(run.field) { span.classList.add("docx-field-result");span.dataset.docxFieldInstruction=run.field.instruction||"";span.title=`Cached field result: ${run.field.instruction||"field"}`;span.contentEditable="false"; }
        if(run.revision) {
          span.classList.add("docx-revision",`docx-revision-${run.revision.type}`);
          span.dataset.docxRevisionAuthor=run.revision.author||"";
          span.title=`Tracked ${run.revision.type}${run.revision.author?` by ${run.revision.author}`:""}`;
          span.contentEditable="false";
        }
        element.append(span);
      }

      for (const image of run.images || []) {
        if (image.unsupported || !model?.parts?.[image.part]) {
          const preservedImage=document.createElement("span");
          preservedImage.className="docx-image-preserved";
          preservedImage.hidden=true;
          preservedImage.contentEditable="false";
          preservedImage.dataset.docxRelationship=image.relationshipId||"";
          preservedImage.dataset.docxPart=image.part||"";
          preservedImage.dataset.docxMime=image.mime||"";
          preservedImage.dataset.docxWidth=String(image.width||"");
          preservedImage.dataset.docxHeight=String(image.height||"");
          preservedImage.dataset.docxUnsupported="true";
          element.append(preservedImage);
          continue;
        }

        const img=document.createElement("img");
        const url=URL.createObjectURL(new Blob([model.parts[image.part]],{type:image.mime}));
        urls.push(url);
        img.src=url;
        img.alt="Embedded document image";
        img.draggable=true;
        img.dataset.docxRelationship=image.relationshipId;
        img.dataset.docxPart=image.part;
        img.dataset.docxMime=image.mime;
        img.dataset.docxWidth=String(image.width||"");
        img.dataset.docxHeight=String(image.height||"");
        img.contentEditable="false";
        if(image.width) img.style.width=`${image.width}px`;
        if(image.height) img.style.height=`${image.height}px`;
        img.style.maxWidth="100%";
        img.style.objectFit="contain";
        element.append(img);
      }
    }

    parent.append(element);
    return element;
  };

  let activeList=null;
  let activeListKey="";
  for (const item of blocks || []) {
    if (item.type === "preserved") {
      activeList=null; activeListKey="";
      const preserved=document.createElement("div");
      preserved.className="docx-preserved-object";
      preserved.hidden=true;
      preserved.contentEditable="false";
      preserved.dataset.docxSourceIndex=String(item.sourceIndex ?? "");
      preserved.dataset.docxPreservedTag=item.preservedTag||"object";
      preserved.dataset.docxPreviewText=item.previewText||"";
      editor.append(preserved);
      continue;
    }

    if (item.type === "table") {
      activeList=null; activeListKey="";
      const table = document.createElement("table");
      if(item.sourceIndex!=null) table.dataset.docxSourceIndex=String(item.sourceIndex);
      if(item.indentTwips)table.style.marginLeft=`${item.indentTwips/1440}in`;
      if(item.alignment==="center")table.style.marginInline="auto"; else if(item.alignment==="right")table.style.marginLeft="auto";
      if(item.gridWidths?.length){const group=document.createElement("colgroup");for(const width of item.gridWidths){const col=document.createElement("col");if(width)col.style.width=`${width/1440}in`;group.append(col);}table.append(group);}
      const verticalMerges=[];
      for (const row of item.rows) {
        const tr = table.insertRow();
        if(row.heightTwips)tr.style.height=`${row.heightTwips/20}pt`;
        let column=0;
        for (const cell of row) {
          const span=cell.gridSpan||1;
          if(cell.vMerge==="continue"&&verticalMerges[column]) { verticalMerges[column].rowSpan+=1; column+=span; continue; }
          const td = tr.insertCell();
          if(span>1) td.colSpan=span;
          if(cell.vMerge==="restart") verticalMerges[column]=td;
          if(cell.widthTwips)td.style.width=`${cell.widthTwips/1440}in`;
          if(cell.shading)td.style.backgroundColor=cell.shading;
          if(cell.verticalAlign)td.style.verticalAlign=cell.verticalAlign==="center"?"middle":cell.verticalAlign;
          if(cell.margins)td.style.padding=`${(cell.margins.top||0)/20}pt ${(cell.margins.right||0)/20}pt ${(cell.margins.bottom||0)/20}pt ${(cell.margins.left||0)/20}pt`;
          for (const p of cell) addParagraph(p, td);
          column+=span;
        }
      }
      editor.append(table);
      continue;
    }

    if(item.list) {
      const tag=item.list==="number"?"OL":"UL";
      const key=`${tag}:${item.numId ?? ""}:${item.level ?? 0}`;
      if(!activeList||activeList.tagName!==tag||activeListKey!==key){
        activeList=document.createElement(tag);
        activeList.className="docx-imported-list";
        activeListKey=key;
        editor.append(activeList);
      }
      addParagraph(item,activeList,{listItem:true});
      continue;
    }

    activeList=null;
    activeListKey="";
    addParagraph(item);
  }

  // Headers and footers are preserved in their original OOXML parts, but are
  // not injected into the editable document body. Until FrameChute can place
  // them faithfully in page-margin regions, rendering them as body sections
  // creates fake bands that do not exist in Word.
  return urls;
}

function renderDocxRecoveryView(block, model, error) {
  const editor=block.querySelector(".docx-editor");
  editor.replaceChildren();
  editor.contentEditable="false";
  editor.dataset.docxRecoveryView="true";

  const appendParagraph=(paragraph,parent=editor)=>{
    const p=document.createElement("p");
    p.textContent=(paragraph?.runs||[]).map(run=>run.text||"").join("");
    parent.append(p);
  };

  for(const item of model?.blocks||[]) {
    if(item.type==="paragraph") appendParagraph(item);
    else if(item.type==="table") {
      const table=document.createElement("table");
      for(const row of item.rows||[]) {
        const tr=table.insertRow();
        for(const cell of row||[]) {
          const td=tr.insertCell();
          for(const paragraph of cell||[]) appendParagraph(paragraph,td);
        }
      }
      editor.append(table);
    } else if(item.type==="preserved") {
      continue;
    }
  }

  // Compatibility view follows the same fidelity rule: supplemental header/
  // footer parts remain preserved in the package, not shown as fake body bands.

  console.error("FrameChute DOCX rich rendering failed; compatibility view used instead.",error);
  return [];
}

async function loadDocxHandle(block, handle, state = {}) {
  const file = await fileFromHandle(handle); if (!file) throw new Error("DOCX could not be read");
  const model = parseDocx(new Uint8Array(await file.arrayBuffer()));
  if (Array.isArray(state.blocks)) model.blocks = structuredClone(state.blocks);
  const runtime = { handle, model, objectUrls: [], compatibilityView:false }; runtimeSources.set(block, runtime);

  try {
    runtime.objectUrls = renderDocxEditor(block, model.blocks, model);
  } catch(error) {
    runtime.compatibilityView=true;
    runtime.objectUrls=renderDocxRecoveryView(block,model,error);
    setStatus(`${file.name} opened in DOCX compatibility view. Advanced content was preserved.`);
  }

  if(state.pageSetup){
    const editor=block.querySelector(".docx-editor");
    editor.dataset.pageSetup=state.pageSetup;
    const [,orientation="portrait",top=1,right=1,bottom=1,left=1]=state.pageSetup.split(",");
    editor.style.padding=`${top}in ${right}in ${bottom}in ${left}in`;
    if(orientation==="landscape"&&model.pageLayout){
      editor.style.width=`${model.pageLayout.heightIn}in`;
      editor.style.minWidth=`${model.pageLayout.heightIn}in`;
      editor.style.minHeight=`${model.pageLayout.widthIn}in`;
    }
  }

  runtime.serialize = () => {
    const editor=block.querySelector(".docx-editor");
    if(!runtime.compatibilityView) model.blocks = docxBlocksFromEditor(editor);
    model.pageSetup=editor.dataset.pageSetup||"";
    return serializeDocx(model);
  };

  clearSourceUnavailable(block); setDocumentDirty(block, Boolean(state.dirty));
  requestAnimationFrame(() => {
    const viewport=block.querySelector(".docx-viewport");
    if(!viewport) return;
    viewport.scrollTop=Number(state.scrollTop)||0;
    viewport.scrollLeft=Number(state.scrollLeft)||0;
  });
}

registerBlockType("docx", {
  createElement() { return templates.docx.content.firstElementChild.cloneNode(true); },
  initialize(block) {
    attachDocumentSave(block);
    const editor = block.querySelector(".docx-editor");
    block.addEventListener("framechute:release-resources",()=>{for(const url of runtimeSources.get(block)?.objectUrls||[])URL.revokeObjectURL(url);},{once:true});
    const imageFile = (file) => file && (/^image\/(png|jpeg|gif|webp)$/i.test(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name));
    const imageItems = (event) => [...event.dataTransfer?.items || []].filter((item) => item.kind === "file" && (/^image\/(png|jpeg|gif|webp)$/i.test(item.type) || imageFile(item.getAsFile?.())));
    const imageFiles = (event) => {
      const files = [...event.dataTransfer?.files || []].filter(imageFile);
      if (files.length) return files;
      return imageItems(event).map((item) => item.getAsFile?.()).filter(imageFile);
    };
    const ownsImageDrag = (event) => isInternalFrameChuteDrag(event) || imageItems(event).length > 0 || imageFiles(event).length > 0;
    const claimImageDrag = (event) => { if(!ownsImageDrag(event)||!claimDocumentDrop("docx",event))return false;event.preventDefault();event.stopPropagation();workspace.classList.remove("is-drop-target");return true; };
    editor.addEventListener("dragenter", claimImageDrag, true);
    editor.addEventListener("dragover", (event) => { if(!claimImageDrag(event))return;if(event.dataTransfer)event.dataTransfer.dropEffect=documentImageDropEffect(activeInternalDrag(),"docx",block); }, true);
    editor.addEventListener("dragleave", clearDocumentDragState, true);
    editor.addEventListener("drop", async (event) => {
      if(!claimImageDrag(event))return;const drag=activeInternalDrag();clearDocumentDragState();
      const runtime=runtimeSources.get(block);if(!runtime?.model){setStatus("This DOCX is not ready for image insertion.");return;}
      const dropRange=documentDropRange(document,editor,event.clientX,event.clientY,drag?.originElement);
      let target=(dropRange?.startContainer?.parentElement || dropRange?.startContainer)?.closest?.("p,h1,h2,h3,h4,h5,h6,li,td") || editor.lastElementChild;
      if(!target || !editor.contains(target)){target=document.createElement("p");editor.append(target);}
      if(drag?.originKind==="docx"&&drag.block===block&&drag.originElement){if(dropRange)moveNodeToDropRange(drag.originElement,dropRange);else target.append(drag.originElement);endInternalDrag();setDocumentDirty(block,true);return;}
      const files=await imageBlobsForDrop(event);if(!files.length){endInternalDrag();return;}
      for(const file of files){const bitmap=await createImageBitmap(file);const ratio=Math.min(1,Math.max(1,editor.clientWidth-32)/bitmap.width),descriptor=addDocxImage(runtime.model,new Uint8Array(await file.arrayBuffer()),{mime:file.type||"image/png",width:Math.round(bitmap.width*ratio),height:Math.round(bitmap.height*ratio)});bitmap.close();const img=document.createElement("img"),url=URL.createObjectURL(file);runtime.objectUrls.push(url);img.src=url;img.alt=file.name||"Inserted image";img.contentEditable="false";img.dataset.docxRelationship=descriptor.relationshipId;img.dataset.docxPart=descriptor.part;img.dataset.docxMime=descriptor.mime;img.dataset.docxWidth=String(descriptor.width);img.dataset.docxHeight=String(descriptor.height);img.style.width=`${descriptor.width}px`;img.style.height=`${descriptor.height}px`;img.style.maxWidth="100%";img.style.objectFit="contain";if(dropRange){dropRange.insertNode(img);dropRange.setStartAfter(img);dropRange.collapse(true);}else target.append(img);}endInternalDrag();
      setDocumentDirty(block,true);setStatus(`${files.length} image${files.length===1?"":"s"} inserted into the DOCX.`);
    }, true);
    let savedRange=null;
    const rememberSelection=()=>{const selection=getSelection();if(selection?.rangeCount&&editor.contains(selection.anchorNode))savedRange=selection.getRangeAt(0).cloneRange();};
    const restoreSelection=(range=savedRange)=>{editor.focus({preventScroll:true});if(range){const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}};
    editor.addEventListener("input", () => { rememberSelection();setDocumentDirty(block, true); });
    editor.addEventListener("keyup",rememberSelection);editor.addEventListener("mouseup",rememberSelection);editor.addEventListener("compositionend",rememberSelection);
    block.querySelector(".docx-toolbar").addEventListener("pointerdown",event=>{if(!event.target.closest("input,select"))event.preventDefault();rememberSelection();});
    const command=(name,value=null,range=null)=>{restoreSelection(range);document.execCommand("styleWithCSS",false,true);const changed=document.execCommand(name,false,value);rememberSelection();if(changed!==false)setDocumentDirty(block,true);return changed;};
    for (const [selector, cmd] of [[".docx-bold", "bold"], [".docx-italic", "italic"], [".docx-underline", "underline"], [".docx-strike","strikeThrough"]]) block.querySelector(selector).addEventListener("click", () => command(cmd));
    block.querySelector(".docx-font-family").addEventListener("change",event=>command("fontName",event.target.value));
    block.querySelector(".docx-color").addEventListener("change",event=>command("foreColor",event.target.value));block.querySelector(".docx-highlight").addEventListener("change",event=>command("hiliteColor",event.target.value));
    block.querySelector(".docx-font-size").addEventListener("change",event=>{const size=Number(event.target.value);if(!Number.isFinite(size)||size<1||size>400){event.target.setCustomValidity("Enter a size from 1 to 400 pt.");event.target.reportValidity();return;}event.target.setCustomValidity("");command("fontSize","7");editor.querySelectorAll('font[size="7"]').forEach(font=>{font.style.fontSize=`${size}pt`;font.removeAttribute("size");});});
    block.querySelector(".docx-style").addEventListener("change",event=>command("formatBlock",event.target.value));
    block.querySelector(".docx-align").addEventListener("change",event=>command(`justify${event.target.value}`));
    block.querySelector(".docx-bullets").addEventListener("click",()=>command("insertUnorderedList"));
    block.querySelector(".docx-numbering").addEventListener("click",()=>command("insertOrderedList"));
    block.querySelector(".docx-link").addEventListener("click",()=>{const url=prompt("Link URL","https://");if(url)command("createLink",url);});
    block.querySelector(".docx-table").addEventListener("click",()=>{restoreSelection();const rows=Math.max(1,Math.min(20,Number(prompt("Rows","2"))||0)),columns=Math.max(1,Math.min(12,Number(prompt("Columns","2"))||0));if(!rows||!columns)return;const html=`<table><tbody>${Array.from({length:rows},()=>`<tr>${Array.from({length:columns},()=>"<td><p><br></p></td>").join("")}</tr>`).join("")}</tbody></table><p><br></p>`;command("insertHTML",html);});
    let replaceImageTarget=null;const imageInput=block.querySelector(".docx-image-input");block.querySelector(".docx-image").addEventListener("click",()=>imageInput.click());imageInput.addEventListener("change",async()=>{const file=imageInput.files?.[0];imageInput.value="";if(!file)return;const runtime=runtimeSources.get(block),bitmap=await createImageBitmap(file),ratio=Math.min(1,(editor.clientWidth-32)/bitmap.width),descriptor=addDocxImage(runtime.model,new Uint8Array(await file.arrayBuffer()),{mime:file.type,width:Math.round(bitmap.width*ratio),height:Math.round(bitmap.height*ratio)});bitmap.close();restoreSelection();const img=document.createElement("img");img.src=URL.createObjectURL(file);runtime.objectUrls.push(img.src);Object.assign(img.dataset,{docxRelationship:descriptor.relationshipId,docxPart:descriptor.part,docxMime:descriptor.mime,docxWidth:String(descriptor.width),docxHeight:String(descriptor.height)});img.style.width=`${descriptor.width}px`;img.style.height=`${descriptor.height}px`;if(replaceImageTarget){replaceImageTarget.replaceWith(img);replaceImageTarget=null;}else{const range=getSelection()?.getRangeAt(0);range?.insertNode(img);}setDocumentDirty(block,true);});
    const paragraphs=()=>{const selection=getSelection(),node=selection?.anchorNode;const first=node?.nodeType===1?node:node?.parentElement;return first?.closest?.("p,h1,h2,h3,li,td")?[first.closest("p,h1,h2,h3,li,td")]:[];};
    const paragraphValue=(selector,property,unit="")=>block.querySelector(selector).addEventListener("change",event=>{rememberSelection();for(const p of paragraphs())p.style[property]=`${event.target.value}${unit}`;setDocumentDirty(block,true);restoreSelection();});
    paragraphValue(".docx-line-spacing","lineHeight");paragraphValue(".docx-space-before","marginTop","pt");paragraphValue(".docx-space-after","marginBottom","pt");paragraphValue(".docx-indent-left","marginLeft","in");paragraphValue(".docx-indent-right","marginRight","in");
    block.querySelector(".docx-indent-special").addEventListener("change",()=>{const type=block.querySelector(".docx-indent-special").value,amount=Number(block.querySelector(".docx-indent-by").value)||0;for(const p of paragraphs())p.style.textIndent=`${type==="hanging"?-amount:type==="firstLine"?amount:0}in`;setDocumentDirty(block,true);restoreSelection();});
    block.querySelector(".docx-page-break").addEventListener("click",()=>{command("insertParagraph");for(const p of paragraphs())p.dataset.pageBreak="true";setDocumentDirty(block,true);});
    block.querySelector(".docx-page-setup").addEventListener("click",()=>{const current=editor.dataset.pageSetup||"letter,portrait,1,1,1,1",answer=prompt("Page setup: size, orientation, top, right, bottom, left margins (inches)",current);if(!answer)return;const [size,orientation,...margins]=answer.split(",").map(x=>x.trim());if(!["letter","a4"].includes(size?.toLowerCase())||!["portrait","landscape"].includes(orientation?.toLowerCase())||margins.length!==4||margins.some(x=>!Number.isFinite(Number(x)))){alert("Use letter or a4, portrait or landscape, and four numeric margins.");return;}editor.dataset.pageSetup=[size.toLowerCase(),orientation.toLowerCase(),...margins].join(",");editor.style.padding=`${margins[0]}in ${margins[1]}in ${margins[2]}in ${margins[3]}in`;setDocumentDirty(block,true);});
    block.querySelector(".docx-find").addEventListener("click",()=>window.dispatchEvent(new CustomEvent("framechute:docx-command",{detail:{block,action:"find",range:savedRange}})));
    const runContext=async ({action,selected,range})=>{
      if(range)savedRange=range;const simple={undo:"undo",redo:"redo",cut:"cut",copy:"copy",selectAll:"selectAll",bold:"bold",italic:"italic",underline:"underline",strike:"strikeThrough","clear-format":"removeFormat","align-left":"justifyLeft","align-center":"justifyCenter","align-right":"justifyRight","align-full":"justifyFull",bullet:"insertUnorderedList",number:"insertOrderedList",indent:"indent",outdent:"outdent"};if(simple[action])return command(simple[action],null,range);
      if(action==="paste"||action==="paste-plain"){restoreSelection(range);try{const text=await navigator.clipboard.readText();if(!text)throw new Error("Clipboard is empty or unavailable");command(action==="paste-plain"?"insertText":"insertHTML",action==="paste-plain"?text:text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/\n/g,"<br>"));}catch(error){setStatus("Paste was blocked by the browser. Focus the document and use Ctrl/Cmd+V.");}return;}
      if(action==="font"){const family=prompt("Font family",block.querySelector(".docx-font-family").value);if(family)command("fontName",family,range);return;}if(action==="paragraph"){block.querySelector(".docx-more").open=true;restoreSelection(range);return;}if(action==="link"||action==="edit-link"){const url=prompt("Link URL",selected?.href||"https://");if(url){if(selected){selected.href=url;setDocumentDirty(block,true);}else command("createLink",url,range);}return;}if(action==="remove-link"){selected?.replaceWith(...selected.childNodes);setDocumentDirty(block,true);return;}if(action==="open-link"){window.open(selected?.href,"_blank","noopener");return;}
      if(action==="find"){const search=prompt("Find","");if(!search)return;const replacement=prompt("Replace with (Cancel to only find)","");if(replacement===null){window.find(search);return;}const count=editor.textContent.split(search).length-1;if(confirm(`Replace all ${count} match(es)?`)){replaceTextNodes(editor,search,replacement);editor.dispatchEvent(new Event("input",{bubbles:true}));}return;}
      if(action==="replace-image"){replaceImageTarget=selected;imageInput.click();return;}if(action==="remove-image"){selected?.remove();setDocumentDirty(block,true);return;}if(action==="resize-image"){const width=Number(prompt("Image width in pixels",selected?.dataset.docxWidth||selected?.width));if(width>0&&selected){const ratio=(Number(selected.dataset.docxHeight)||selected.height)/(Number(selected.dataset.docxWidth)||selected.width);selected.dataset.docxWidth=String(width);selected.dataset.docxHeight=String(Math.round(width*ratio));selected.style.width=`${width}px`;selected.style.height=`${Math.round(width*ratio)}px`;setDocumentDirty(block,true);}return;}
      const cell=selected?.closest?.("td,th"),row=cell?.parentElement,table=cell?.closest("table"),index=cell?.cellIndex;if(action==="row-above"||action==="row-below"){const clone=row.cloneNode(true);clone.querySelectorAll("td,th").forEach(x=>x.innerHTML="<p><br></p>");row[action==="row-above"?"before":"after"](clone);}else if(action==="column-left"||action==="column-right")for(const tr of table.rows){const td=tr.insertCell(index+(action==="column-right"?1:0));td.innerHTML="<p><br></p>";}else if(action==="delete-row")row.remove();else if(action==="delete-column")for(const tr of table.rows)tr.cells[index]?.remove();else if(action==="delete-table")table.remove();else return;setDocumentDirty(block,true);
    };
    const contextListener=event=>{if(event.detail?.block===block)void runContext(event.detail);};window.addEventListener("framechute:docx-command",contextListener);block.addEventListener("framechute:release-resources",()=>window.removeEventListener("framechute:docx-command",contextListener),{once:true});
    editor.addEventListener("keydown",event=>{if(!(event.ctrlKey||event.metaKey))return;const key=event.key.toLowerCase();if(["b","i","u"].includes(key)){event.preventDefault();command({b:"bold",i:"italic",u:"underline"}[key]);}else if(key==="s"){event.preventDefault();block.querySelector(".document-save")?.click();}else if(key==="f"){event.preventDefault();void runContext({action:"find",range:savedRange});}});
    const updateToolbar=()=>{if(document.activeElement!==editor&&!editor.contains(document.activeElement))return;for(const [selector,name] of [[".docx-bold","bold"],[".docx-italic","italic"],[".docx-underline","underline"],[".docx-strike","strikeThrough"]])block.querySelector(selector).setAttribute("aria-pressed",String(document.queryCommandState(name)));};document.addEventListener("selectionchange",updateToolbar);block.addEventListener("framechute:release-resources",()=>document.removeEventListener("selectionchange",updateToolbar),{once:true});
    block.querySelector(".reconnect-source").addEventListener("click", async () => { try { await reconnectSource(block, pickDocxFile, (handle) => loadDocxHandle(block, handle, this.capture(block))); } catch (error) { console.error(error); setStatus("Could not reconnect that DOCX."); } });
  },
  capture(block) { const runtime=runtimeSources.get(block),editor=block.querySelector(".docx-editor"),viewport=block.querySelector(".docx-viewport");return { blocks: docxBlocksFromEditor(editor), pageSetup:editor.dataset.pageSetup||"", scrollTop: viewport?.scrollTop||0, scrollLeft: viewport?.scrollLeft||0, dirty: block.dataset.documentDirty === "true", embeddedBlob:getSourceRecord(block)?null:runtime?.serialize?.()||null }; },
  async restore(block, state = {}, source = null) { if (state.blocks) renderDocxEditor(block, state.blocks); setDocumentDirty(block, Boolean(state.dirty)); const handle = await storedReadableHandle(source); if(state.embeddedBlob instanceof Blob){const file=new File([state.embeddedBlob],block.querySelector(".block-name").value,{type:DOCX_MIME});await loadDocxHandle(block,{kind:"file",name:file.name,__framechuteSyntheticFile:file},state);}else if (handle) await loadDocxHandle(block, handle, state); else setSourceUnavailable(block, `Reconnect ${source?.displayName ?? "this DOCX"} to continue editing and save it.`); }
});

registerBlockType("gallery", {
  createElement() {
    return templates.gallery.content.firstElementChild.cloneNode(true);
  },

  initialize(block) {
    block.tabIndex = 0;

    const reconnectGallery = async (direction = 0) => {
      const state = this.capture(block);
      await reconnectSource(block, pickImageDirectory, async (handle) => {
        await loadGalleryHandle(block, handle, state);
        const runtime = runtimeSources.get(block);
        if (direction && runtime?.entries?.length) await showGalleryIndex(block, runtime.index + direction);
      });
    };

    const moveGallery = async (direction) => {
      const runtime = runtimeSources.get(block);
      if (runtime?.handle && await requestReadPermission(runtime.handle)) {
        try {
          await showGalleryIndex(block, runtime.index + direction);
          return;
        } catch (error) {
          console.warn("Gallery access needs to be refreshed:", error);
        }
      }
      await reconnectGallery(direction);
    };

    block.querySelector(".gallery-prev").addEventListener("click", () => {
      void moveGallery(-1);
    });

    block.querySelector(".gallery-next").addEventListener("click", () => {
      void moveGallery(1);
    });

    block.addEventListener("keydown", (event) => {
      if (event.target.closest("input, button, textarea")) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void moveGallery(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        void moveGallery(1);
      }
    });

    block.querySelector(".reconnect-source").addEventListener("click", async () => {
      try {
        await reconnectGallery();
      } catch (error) {
        console.error(error);
        setStatus("Could not reconnect that image folder.");
      }
    });
  },

  capture(block) {
    const runtime = runtimeSources.get(block);
    const entry = runtime?.entries?.[runtime.index];
    return {
      currentEntry: entry?.name ?? block.dataset.currentEntry ?? null,
      currentIndex: Number.isFinite(runtime?.index) ? runtime.index : 0,
      footerVisibility: block.dataset.footerVisibility || "inherit"
    };
  },

  async restore(block, state = {}, source = null) {
    block.dataset.currentEntry = state.currentEntry ?? "";
    block.dataset.footerVisibility = state.footerVisibility ?? "inherit";
    window.dispatchEvent(new CustomEvent("flashframe:restore-media-chrome", { detail: { block } }));
    const handle = await storedReadableHandle(source);

    if (handle) await loadGalleryHandle(block, handle, state);
    else setSourceUnavailable(block, `Reconnect ${source?.displayName ?? "this image folder"} to browse it.`);
  }
});

registerBlockType("video", {
  createElement() {
    return templates.video.content.firstElementChild.cloneNode(true);
  },

  initialize(block) {
    const player = block.querySelector(".video-player");
    player.addEventListener("timeupdate", () => {
      block.querySelector(".video-time").textContent = formatTime(player.currentTime);
    });

    block.querySelector(".reconnect-source").addEventListener("click", async () => {
      try {
        await reconnectSource(block, pickVideoFile, async (handle) => loadVideoHandle(block, handle, this.capture(block)));
      } catch (error) {
        console.error(error);
        setStatus("Could not reconnect that video.");
      }
    });
  },

  capture(block) {
    const player = block.querySelector(".video-player");
    const runtime = runtimeSources.get(block);
    return {
      currentTime: Number.isFinite(player.currentTime) ? player.currentTime : 0,
      paused: player.paused,
      volume: player.volume,
      muted: player.muted,
      playbackRate: player.playbackRate,
      loop: player.loop,
      syncGroup: block.dataset.syncGroup || "all",
      masterTimelineOffset: Number.isFinite(Number.parseFloat(player.dataset.masterTimelineOffset || ""))
        ? Number.parseFloat(player.dataset.masterTimelineOffset)
        : null,
      frameless: block.dataset.frameless === "true",
      headerVisibility: block.dataset.headerVisibility || "inherit",
      footerVisibility: block.dataset.footerVisibility || "inherit",
      embeddedBlob: getSourceRecord(block) ? null : runtime?.file || null
    };
  },

  async restore(block, state = {}, source = null) {
    block.dataset.timedMedia = "true";
    block.dataset.syncGroup = state.syncGroup ?? "all";
    block.dataset.frameless = String(Boolean(state.frameless));
    block.dataset.headerVisibility = state.headerVisibility ?? "inherit";
    block.dataset.footerVisibility = state.footerVisibility ?? "inherit";
    window.dispatchEvent(new CustomEvent("flashframe:restore-media-chrome", { detail: { block } }));
    const restoredPlayer = block.querySelector(".video-player");
    restoredPlayer.loop = Boolean(state.loop);
    if (state.masterTimelineOffset != null && Number.isFinite(Number(state.masterTimelineOffset))) restoredPlayer.dataset.masterTimelineOffset = String(Number(state.masterTimelineOffset));
    else delete restoredPlayer.dataset.masterTimelineOffset;
    block.querySelector(".video-time").textContent = formatTime(state.currentTime ?? 0);
    const handle = await storedReadableHandle(source);

    if (state.embeddedBlob instanceof Blob) {
      const file=new File([state.embeddedBlob],block.querySelector(".block-name").value,{type:state.embeddedBlob.type});
      await loadVideoHandle(block,{kind:"file",name:file.name,__framechuteSyntheticFile:file},state);
    } else if (handle) await loadVideoHandle(block, handle, state);
    else setSourceUnavailable(block, `Reconnect ${source?.displayName ?? "this video"} to play it.`);
  }
});

async function createBlock(record = {}, { fitOnOpen = true } = {}) {
  const type = record.type ?? "text";
  const definition = blockTypes.get(type);

  if (!definition) {
    console.warn(`Unknown Flashframe block type: ${type}`);
    return null;
  }

  const block = definition.createElement();
  block.dataset.blockId = record.id ?? crypto.randomUUID();
  block.dataset.blockType = type;
  if (record.timedMotion) block.dataset.timedMotion = JSON.stringify(record.timedMotion);
  if (record.layerRule) block.dataset.layerRuleData = JSON.stringify(record.layerRule);
  setSourceRecord(block, record.source ?? null);

  const nameInput = block.querySelector(".block-name");
  if (nameInput) nameInput.value = record.name ?? "Untitled";

  applyGeometry(block, record.geometry ?? defaultGeometry(type));
  attachBlockInteractions(block);
  definition.initialize?.(block);
  workspace.append(block);
  window.dispatchEvent(new CustomEvent("flashframe:restore-timed-motion", { detail: { block } }));
  window.dispatchEvent(new CustomEvent("flashframe:restore-layer-rule", { detail: { block } }));

  try {
    await definition.restore(block, record.state ?? {}, record.source ?? null);
  } catch (error) {
    console.error(`Could not restore ${type} block`, error);
    setSourceUnavailable(block, `Flashframe could not restore ${record.source?.displayName ?? "this source"}.`);
  }

  window.dispatchEvent(new CustomEvent("framechute:block-restored", { detail: { block, record } }));

  if (fitOnOpen) fitOpenedBlock(block);

  return block;
}

function captureBlock(block) {
  const type = block.dataset.blockType;
  const definition = blockTypes.get(type);

  if (!definition) throw new Error(`Cannot serialize unknown block type: ${type}`);

  const record = {
    id: block.dataset.blockId,
    type,
    name: block.querySelector(".block-name")?.value?.trim() || "Untitled",
    geometry: readGeometry(block),
    source: getSourceRecord(block),
    state: definition.capture(block),
    timedMotion: block.dataset.timedMotion ? JSON.parse(block.dataset.timedMotion) : null,
    layerRule: block.dataset.layerRuleData ? JSON.parse(block.dataset.layerRuleData) : null
  };
  window.dispatchEvent(new CustomEvent("framechute:block-captured", { detail: { block, record } }));
  return record;
}

// Shared public bridge for utility modules. It deliberately delegates to the
// same registry/capture/create path as built-in blocks so FCX and duplication
// never need to inspect or clone live DOM/runtime state.
window.FrameChuteWorkspace = Object.freeze({
  registerBlockType,
  createBlock,
  captureBlock,
  setPdfDiagnosticMode(block,mode){return updatePdfDiagnosticMode(block,mode);},
  capturePdfVisualScene(block,options={}){const runtime=runtimeSources.get(block);return buildPdfVisualScene(block,runtime,options);},
  async extractText(block) {
    const runtime=runtimeSources.get(block);
    if(block?.dataset?.blockType==="pdf"&&runtime?.model)return extractSemanticPdfText(runtime.model,runtime.edits);
    return null;
  },
  async sourceBlob(block) {
    const type = block.dataset.blockType;
    if (["image", "canvas"].includes(block.dataset.customKind)) return customImageSourceBlob(block, { resolveHandle });
    const definition = blockTypes.get(type); if (definition?.exportBlob) return definition.exportBlob(block);
    if (type === "text") return new Blob([block.querySelector(".text-editor")?.value || ""], { type: "text/plain" });
    const runtime = runtimeSources.get(block);
    if ((type === "pdf" || type === "docx") && runtime?.serialize) return runtime.serialize();
    if (runtime?.handle) return fileFromHandle(runtime.handle);
    if (type === "gallery" && runtime?.entries?.[runtime.index]) return runtime.entries[runtime.index].handle.getFile();
    return null;
  },
  async duplicateBlock(block) {
    const record = duplicateBlockRecord(captureBlock(block), { id: crypto.randomUUID(), z: ++zCounter });
    return createBlock(record);
  }
});

function captureWorkspace(name) {
  const detail = {};
  window.dispatchEvent(new CustomEvent("flashframe:capture-appearance", { detail }));
  return {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    appearance: detail.appearance ?? null,
    workspace: { scrollX: window.scrollX, scrollY: window.scrollY },
    blocks: [...workspace.querySelectorAll(".block")].map(captureBlock)
  };
}

async function restoreWorkspace(snapshot) {
  if ([...workspace.querySelectorAll('.document-block[data-document-dirty="true"]')].length && !window.confirm("This workspace contains unsaved document changes. Replace it anyway?")) return false;
  for (const block of workspace.querySelectorAll(".block")) releaseBlockResources(block);
  workspace.replaceChildren();
  zCounter = 1;
  newBlockOffset = 0;

  if ((snapshot.schemaVersion ?? 1) >= 2 && snapshot.appearance) {
    const detail = { appearance: snapshot.appearance, tasks: [] };
    window.dispatchEvent(new CustomEvent("flashframe:restore-appearance", { detail }));
    await Promise.all(detail.tasks);
  }

  for (const record of snapshot.blocks ?? []) {
    await createBlock(record, { fitOnOpen: false });
  }

  if (snapshot.workspace) window.scrollTo(Number(snapshot.workspace.scrollX) || 0, Number(snapshot.workspace.scrollY) || 0);

  setStatus(`Restored “${snapshot.name}”.`);
  return true;
}

// Portable formats and future history consumers use the same semantic
// serializer/restorer as local snapshots rather than inspecting private maps.
window.addEventListener("framechute:capture-workspace", (event) => {
  event.detail.snapshot = captureWorkspace(event.detail.name || "FrameChute workspace");
});
window.addEventListener("framechute:restore-workspace", (event) => {
  event.detail.promise = restoreWorkspace(event.detail.snapshot);
});

async function refreshSnapshotList(selectedId = "") {
  const snapshots = await listSnapshots();
  savedFramesSelect.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = snapshots.length ? "Saved Flashframes" : "No saved Flashframes";
  savedFramesSelect.append(placeholder);

  for (const snapshot of snapshots) {
    const option = document.createElement("option");
    option.value = snapshot.id;
    option.textContent = `${snapshot.name} — ${new Date(snapshot.createdAt).toLocaleString()}`;
    savedFramesSelect.append(option);
  }

  if (selectedId) savedFramesSelect.value = selectedId;
}

async function addPickedBlock({ type, picker, initialState }) {
  try {
    const picked = await picker();
    const handleKey = makeHandleKey(type);
    await storeHandle(handleKey, picked.handle);

    const source = {
      kind: picked.handle.kind,
      handleKey,
      displayName: picked.handle.name
    };

    const block = await createBlock({
      type,
      name: picked.handle.name,
      source,
      state: initialState?.(picked) ?? {}
    });

    if (type === "pdf") await loadPdfHandle(block, picked.handle, { page: 1 });
    if (type === "docx") await loadDocxHandle(block, picked.handle, {});
    if (type === "gallery") await loadGalleryHandle(block, picked.handle, { currentIndex: 0 });
    if (type === "video") await loadVideoHandle(block, picked.handle, { currentTime: 0, paused: true });

    setStatus(`${picked.handle.name} added.`);
  } catch (error) {
    if (isPickerCancel(error)) return;
    console.error(error);
    setStatus("Flashframe could not open that local source.");
  }
}

addTextButton.addEventListener("click", async () => {
  const block = await createBlock({ type: "text", name: "Untitled", state: { text: "" } });
  block?.querySelector(".text-editor")?.focus();
  setStatus("Text block added.");
});

openTextButton.addEventListener("click", async () => {
  try {
    const picked = await pickTextFile();
    const handleKey = makeHandleKey("text");
    await storeHandle(handleKey, picked.handle);

    const block = await createBlock({
      type: "text",
      name: picked.file.name,
      source: { kind: "file", handleKey, displayName: picked.file.name },
      state: { text: picked.text, scrollTop: 0, cursorOffset: 0 }
    });

    block?.querySelector(".text-editor")?.focus();
    setStatus(`${picked.file.name} opened. Flashframe snapshots preserve the text they contain.`);
  } catch (error) {
    if (isPickerCancel(error)) return;
    console.error(error);
    setStatus("Flashframe could not open that text file.");
  }
});

openPdfButton.addEventListener("click", () => void addPickedBlock({ type: "pdf", picker: pickPdfFile }));
openDocxButton.addEventListener("click", () => void addPickedBlock({ type: "docx", picker: pickDocxFile }));
openGalleryButton.addEventListener("click", () => void addPickedBlock({ type: "gallery", picker: pickImageDirectory }));
openVideoButton.addEventListener("click", () => void addPickedBlock({ type: "video", picker: pickVideoFile }));

document.querySelector("#new-docx")?.addEventListener("click", async () => {
  const blob=createSimpleDocx("");
  window.dispatchEvent(new CustomEvent("framechute:add-result-object",{detail:{blob,name:"Untitled.docx",kind:"docx"}}));
  setStatus("Blank editable DOCX created.");
});
document.querySelector("#new-pdf")?.addEventListener("click", async () => {
  const pdf=await PDFDocument.create();pdf.addPage([612,792]);
  const blob=new Blob([await pdf.save()],{type:"application/pdf"});
  window.dispatchEvent(new CustomEvent("framechute:add-result-object",{detail:{blob,name:"Untitled.pdf",kind:"pdf"}}));
  setStatus("Blank editable PDF created.");
});
document.querySelector("#new-webx")?.addEventListener("click", async () => {
  const block=await createBlock({type:"text",name:"Untitled.webx",state:{text:"<!doctype html>\n<html><head><meta charset=\"utf-8\"><title>Untitled</title></head><body>\n\n</body></html>"}});
  if(block){block.dataset.utilityKind="webx";block.querySelector(".text-editor")?.focus();setStatus("New WEBX semantic source created.");}
});

const openWebx=document.querySelector("#open-webx"),openWebxInput=document.querySelector("#open-webx-input");
openWebx?.addEventListener("click",()=>openWebxInput?.click());
openWebxInput?.addEventListener("change",async()=>{
  const file=openWebxInput.files?.[0];openWebxInput.value="";if(!file)return;
  const block=await createBlock({type:"text",name:file.name,state:{text:await file.text()}});
  if(block){block.dataset.utilityKind="webx";setStatus(`${file.name} opened as a WEBX editing object.`);}
});

window.addEventListener("framechute:open-document-handle", (event) => {
  const { handle, file, point } = event.detail || {};
  const type = /\.docx$/i.test(file?.name || handle?.name || "") ? "docx" : "pdf";
  event.detail.promise = (async () => {
    const handleKey = makeHandleKey(type); await storeHandle(handleKey, handle);
    const block = await createBlock({ type, name: file?.name || handle.name, source: { kind: "file", handleKey, displayName: file?.name || handle.name }, geometry: point ? { ...defaultGeometry(type), x: point.x, y: point.y } : undefined });
    if (type === "pdf") await loadPdfHandle(block, handle, { page: 1 }); else await loadDocxHandle(block, handle, {});
    setStatus(`${file?.name || handle.name} opened for editing.`);
  })();
});

window.addEventListener("framechute:open-result-file", (event) => {
  const { file, kind } = event.detail || {}; if (!(file instanceof File)) return;
  event.detail.promise = (async () => {
    const type = kind === "pdf" ? "pdf" : (kind === "video" || kind === "audio") ? "video" : kind === "docx" ? "docx" : null;
    if (!type) { window.dispatchEvent(new CustomEvent("framechute:save-result-file",{detail:{blob:file,name:file.name}})); return; }
    const handle = { kind: "file", name: file.name, __framechuteSyntheticFile: file };
    const state=type==="pdf"?{page:1,embeddedBlob:file}:type==="docx"?{}:{currentTime:0,paused:true,embeddedBlob:file};
    const block = await createBlock({ type, name: file.name, state });
    if (type === "pdf") await loadPdfHandle(block, handle, state); else if(type==="docx")await loadDocxHandle(block,handle,state);else await loadVideoHandle(block, handle, state);
  })();
});

saveFrameButton.addEventListener("click", async () => {
  const defaultName = `Flashframe ${new Date().toLocaleString()}`;
  const name = window.prompt("Name this Flashframe", defaultName);
  if (name == null) return;

  try {
    const snapshot = captureWorkspace(name.trim() || defaultName);
    await saveSnapshot(snapshot);
    await refreshSnapshotList(snapshot.id);
    setStatus(`Saved “${snapshot.name}”.`);
  } catch (error) {
    console.error(error);
    setStatus("Could not save this Flashframe.");
  }
});

restoreFrameButton.addEventListener("click", async () => {
  const id = savedFramesSelect.value;
  if (!id) {
    setStatus("Choose a saved Flashframe first.");
    return;
  }

  try {
    const snapshot = await getSnapshot(id);
    if (!snapshot) {
      setStatus("That Flashframe could not be found.");
      return;
    }

    await restoreWorkspace(snapshot);
  } catch (error) {
    console.error(error);
    setStatus("Could not restore that Flashframe.");
  }
});

let persistenceReady = true;

try {
  await refreshSnapshotList();
} catch (error) {
  persistenceReady = false;
  console.error("FrameChute local persistence could not initialize:", error);
  savedFramesSelect.replaceChildren(new Option("Local saves unavailable", ""));
  savedFramesSelect.disabled = true;
  restoreFrameButton.disabled = true;
}

try {
  await createBlock({
    type: "text",
    name: "Welcome",
    state: {
      text: "FrameChute is running as a Chrome/Chromium extension.\n\nOpen local text, PDFs, image folders, or video. Arrange the blocks, leave each item where it is useful, then save a FrameChute."
    }
  });
} catch (error) {
  console.error("FrameChute workspace initialization failed:", error);
}

setStatus(
  persistenceReady
    ? "Ready. Your workspace data stays local in this extension."
    : "Ready. Local workspace saves are unavailable in this browser session, but FrameChute can still open and edit files."
);
