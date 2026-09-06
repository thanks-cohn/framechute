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
import { writeCompleteBlob, saveDocumentAs } from "./documents/document-save.js";
import { openPdfDocument, renderPdfPage, serializeEditedPdf, transformPdfPages, extractPdfPages, mergePdfBytes, cropPdfMargins, conservativelyCompressPdf, chooseSmallerPdf } from "./documents/pdf-document.js";
import { DOCX_MIME, addDocxImage, parseDocx, serializeDocx } from "./documents/docx-document.js";
import { duplicateBlockRecord } from "./actions/block-records.js";

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
  zCounter += 1;
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

    const startPointerX = event.clientX;
    const startPointerY = event.clientY;
    const startLeft = numberFromStyle(block.style.left, block.offsetLeft);
    const startTop = numberFromStyle(block.style.top, block.offsetTop);

    header.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      block.style.left = `${startLeft + moveEvent.clientX - startPointerX}px`;
      block.style.top = `${startTop + moveEvent.clientY - startPointerY}px`;
    };

    const finish = () => {
      header.removeEventListener("pointermove", move);
      header.removeEventListener("pointerup", finish);
      header.removeEventListener("pointercancel", finish);
    };

    header.addEventListener("pointermove", move);
    header.addEventListener("pointerup", finish);
    header.addEventListener("pointercancel", finish);
  });
}

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
  let result;
  if (!saveAs) result = await writeCompleteBlob(runtime.handle, runtime.serialize);
  if (saveAs || !result?.saved) result = await saveDocumentAs(options);
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
    runtime.pageData = await renderPdfPage(runtime.model, nextPage, block.querySelector(".pdf-canvas"), block.querySelector(".pdf-text-layer"), runtime.edits);
    block.querySelector(".pdf-count").textContent = `/ ${runtime.model.pageCount}`;
  }
}

async function loadPdfHandle(block, handle, state = {}) {
  const file = await fileFromHandle(handle);
  if (!file) throw new Error("PDF could not be read");

  const model = await openPdfDocument(await file.arrayBuffer());
  const edits = Array.isArray(state.edits) ? structuredClone(state.edits) : [];
  const runtime = { handle, model, edits, structurallyDirty: Boolean(state.structurallyDirty) };
  runtime.serialize = () => serializeEditedPdf(model, edits);
  runtimeSources.set(block, runtime);
  clearSourceUnavailable(block);
  setDocumentDirty(block, Boolean(state.dirty));
  await setPdfPage(block, state.page ?? block.dataset.currentPage ?? 1);
}
async function loadPdfBytes(block, bytes, state={}) { const model=await openPdfDocument(bytes),edits=Array.isArray(state.edits)?structuredClone(state.edits):[],runtime={handle:null,model,edits,structurallyDirty:Boolean(state.structurallyDirty)};runtime.serialize=()=>serializeEditedPdf(model,edits);runtimeSources.set(block,runtime);clearSourceUnavailable(block);setDocumentDirty(block,Boolean(state.dirty));await setPdfPage(block,state.page??1); }

async function applyPdfPageOperation(block, operation) {
  const previous = runtimeSources.get(block); if (!previous?.model) return;
  const edited = await previous.serialize();
  const bytes = await transformPdfPages(new Uint8Array(await edited.arrayBuffer()), operation);
  const model = await openPdfDocument(bytes); const runtime = { handle: previous.handle, model, edits: [], structurallyDirty: true };
  runtime.serialize = () => serializeEditedPdf(model, runtime.edits); runtimeSources.set(block, runtime);
  setDocumentDirty(block, true); await setPdfPage(block, Math.min(Number(operation.to || operation.page), model.pageCount));
  setStatus("PDF page change is ready. Use native Save or Save As to write the PDF.");
}
async function replacePdfRuntime(block, bytes, page=1) { const previous=runtimeSources.get(block),model=await openPdfDocument(bytes),runtime={handle:previous?.handle,model,edits:[],structurallyDirty:true};runtime.serialize=()=>serializeEditedPdf(model,runtime.edits);runtimeSources.set(block,runtime);setDocumentDirty(block,true);await setPdfPage(block,Math.min(page,model.pageCount)); }

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
    block.querySelector(".pdf-prev").addEventListener("click", () => {
      setPdfPage(block, clampInteger(block.querySelector(".pdf-page").value, 1) - 1);
    });

    block.querySelector(".pdf-next").addEventListener("click", () => {
      setPdfPage(block, clampInteger(block.querySelector(".pdf-page").value, 1) + 1);
    });

    block.querySelector(".pdf-page").addEventListener("change", (event) => {
      void setPdfPage(block, event.currentTarget.value);
    });
    block.querySelector(".pdf-rotate").addEventListener("click", () => void applyPdfPageOperation(block, { type: "rotate", page: Number(block.dataset.currentPage || 1), degrees: 90 }));
    block.querySelector(".pdf-delete").addEventListener("click", () => void applyPdfPageOperation(block, { type: "delete", page: Number(block.dataset.currentPage || 1) }).catch((error) => setStatus(error.message)));
    block.querySelector(".pdf-duplicate").addEventListener("click", () => void applyPdfPageOperation(block, { type: "duplicate", page: Number(block.dataset.currentPage || 1) }));
    block.querySelector(".pdf-move").addEventListener("click", () => { const to = Number(prompt("Move current page to position", block.dataset.currentPage || "1")); if (to) void applyPdfPageOperation(block, { type: "move", page: Number(block.dataset.currentPage || 1), to }); });
    block.querySelector(".pdf-extract").addEventListener("click", async()=>{const runtime=runtimeSources.get(block),page=Number(block.dataset.currentPage||1),blob=await runtime.serialize(),bytes=await extractPdfPages(new Uint8Array(await blob.arrayBuffer()),[page]);window.dispatchEvent(new CustomEvent("framechute:add-result-object",{detail:{blob:new Blob([bytes],{type:"application/pdf"}),name:`${block.querySelector('.block-name').value}-page-${page}.pdf`,kind:"pdf"}}));});
    block.querySelector(".pdf-merge").addEventListener("click",async()=>{try{const [handle]=await showOpenFilePicker({multiple:false,types:[{description:"PDF",accept:{"application/pdf":[".pdf"]}}]});if(!handle)return;const runtime=runtimeSources.get(block),base=await runtime.serialize(),added=await handle.getFile(),after=Number(block.dataset.currentPage||runtime.model.pageCount),bytes=await mergePdfBytes(new Uint8Array(await base.arrayBuffer()),new Uint8Array(await added.arrayBuffer()),after);await replacePdfRuntime(block,bytes,after+1);setStatus(`${added.name} inserted. Use Save As to preserve the original.`);}catch(error){if(error.name!=="AbortError")setStatus(error.message);}});
    block.querySelector(".pdf-images").addEventListener("click",async()=>{const runtime=runtimeSources.get(block);for(let number=1;number<=runtime.model.pageCount;number++){const page=await runtime.model.pdf.getPage(number),viewport=page.getViewport({scale:2}),canvas=document.createElement("canvas");canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext("2d"),viewport}).promise;const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));window.dispatchEvent(new CustomEvent("framechute:add-result-object",{detail:{blob,name:`page-${number}.png`,kind:"image"}}));}});
    block.querySelector(".pdf-crop").addEventListener("click",async()=>{const margin=Number(prompt("Crop all margins by PDF points (72 = 1 inch)","18"));if(!Number.isFinite(margin))return;const runtime=runtimeSources.get(block),blob=await runtime.serialize(),page=Number(block.dataset.currentPage||1),bytes=await cropPdfMargins(new Uint8Array(await blob.arrayBuffer()),page,{left:margin,right:margin,top:margin,bottom:margin});await replacePdfRuntime(block,bytes,page);});
    block.querySelector(".pdf-compress").addEventListener("click",async()=>{const runtime=runtimeSources.get(block),blob=await runtime.serialize(),original=new Uint8Array(await blob.arrayBuffer()),candidate=await conservativelyCompressPdf(original),choice=chooseSmallerPdf(original,candidate);if(!choice.changed){setStatus(`No smaller safe PDF was produced (${original.length.toLocaleString()} → ${candidate.length.toLocaleString()} bytes); the current PDF was kept.`);return;}await replacePdfRuntime(block,choice.bytes,Number(block.dataset.currentPage||1));setStatus(`PDF compressed conservatively: ${original.length.toLocaleString()} → ${candidate.length.toLocaleString()} bytes. Embedded images were not recompressed.`);});

    block.querySelector(".pdf-text-layer").addEventListener("dblclick", (event) => {
      const span = event.target.closest(".pdf-text-item");
      if (!span) return;
      span.contentEditable = "true";
      span.focus();
      const range = document.createRange(); range.selectNodeContents(span);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    });
    block.querySelector(".pdf-text-layer").addEventListener("keydown", (event) => {
      if (event.target.matches('.pdf-text-item[contenteditable="true"]') && event.key === "Enter") { event.preventDefault(); event.target.blur(); }
    });
    block.querySelector(".pdf-text-layer").addEventListener("focusout", (event) => {
      const span = event.target.closest('.pdf-text-item[contenteditable="true"]');
      if (!span) return;
      span.removeAttribute("contenteditable");
      const runtime = runtimeSources.get(block); if (!runtime?.pageData) return;
      const index = Number(span.dataset.index); const page = Number(block.dataset.currentPage || 1);
      const original = runtime.pageData.content.items[index];
      const replacement = span.textContent || "";
      const existing = runtime.edits.find((edit) => edit.page === page && edit.index === index);
      if (replacement === original.str) { if (existing) runtime.edits.splice(runtime.edits.indexOf(existing), 1); }
      else {
        const rect = { left: parseFloat(span.style.left), top: parseFloat(span.style.top), width: parseFloat(span.style.width), height: parseFloat(span.style.height) };
        const [x, yTop] = runtime.pageData.viewport.convertToPdfPoint(rect.left, rect.top);
        const [, yBottom] = runtime.pageData.viewport.convertToPdfPoint(rect.left, rect.top + rect.height);
        const edit = { page, index, original: original.str, replacement, x, y: yBottom, width: rect.width / runtime.pageData.viewport.scale, height: Math.abs(yTop - yBottom), fontSize: Math.abs(yTop - yBottom) * .8, rotation: 0 };
        if (existing) Object.assign(existing, edit); else runtime.edits.push(edit);
      }
      setDocumentDirty(block, runtime.edits.length > 0);
    });

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
    return { page: clampInteger(block.querySelector(".pdf-page").value, 1), edits: structuredClone(runtime?.edits || []), dirty: block.dataset.documentDirty === "true", structurallyDirty:Boolean(runtime?.structurallyDirty), embeddedBlob:(!getSourceRecord(block)||runtime?.structurallyDirty)&&runtime?.model?.bytes?new Blob([runtime.model.bytes],{type:"application/pdf"}):null };
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
  const paragraph = (node) => ({ type: "paragraph", style: /^H[1-6]$/.test(node.tagName) ? `Heading${node.tagName.slice(1)}` : "", list: node.tagName === "LI", alignment: node.style.textAlign || "left", runs: [...node.childNodes].map((child) => child.nodeType === 1 && child.matches("img[data-docx-relationship]") ? ({ text: "", images: [{ kind: "image", relationshipId: child.dataset.docxRelationship, part: child.dataset.docxPart, mime: child.dataset.docxMime, width: Number(child.dataset.docxWidth) || child.width, height: Number(child.dataset.docxHeight) || child.height }] }) : ({ text: child.textContent || "", bold: child.nodeType === 1 && ["B", "STRONG"].includes(child.tagName), italic: child.nodeType === 1 && ["I", "EM"].includes(child.tagName), underline: child.nodeType === 1 && child.tagName === "U" })).filter((run) => run.text.length || run.images?.length) });
  const blocks = [];
  for (const node of editor.children) {
    if (node.tagName === "TABLE") blocks.push({ type: "table", rows: [...node.rows].map((row) => [...row.cells].map((cell) => [...cell.children].map(paragraph))) });
    else if (["UL", "OL"].includes(node.tagName)) for (const item of node.children) blocks.push(paragraph(item));
    else blocks.push(paragraph(node));
  }
  return blocks;
}

function renderDocxEditor(block, blocks, model = runtimeSources.get(block)?.model) {
  const editor = block.querySelector(".docx-editor"); editor.replaceChildren();
  const urls = [];
  const addParagraph = (p, parent = editor) => {
    const heading = /^Heading([1-6])$/i.exec(p.style || "");
    const tag = heading ? `h${heading[1]}` : "p";
    const element = document.createElement(tag); element.style.textAlign = p.alignment || "left";
    for (const run of p.runs || []) {
      if (run.text) { const span = document.createElement(run.bold ? "strong" : run.italic ? "em" : run.underline ? "u" : "span"); span.textContent = run.text; element.append(span); }
      for (const image of run.images || []) {
        if (image.unsupported || !model?.parts?.[image.part]) { const placeholder=document.createElement("span");placeholder.className="docx-image-unavailable";placeholder.textContent=`[Image unavailable${image.part ? `: ${image.part}` : ""}]`;placeholder.contentEditable="false";element.append(placeholder);continue; }
        const img=document.createElement("img"),url=URL.createObjectURL(new Blob([model.parts[image.part]],{type:image.mime}));urls.push(url);
        img.src=url;img.alt="Embedded document image";img.dataset.docxRelationship=image.relationshipId;img.dataset.docxPart=image.part;img.dataset.docxMime=image.mime;img.dataset.docxWidth=String(image.width||"");img.dataset.docxHeight=String(image.height||"");img.contentEditable="false";
        if(image.width)img.style.width=`${image.width}px`;if(image.height)img.style.height=`${image.height}px`;img.style.maxWidth="100%";img.style.objectFit="contain";element.append(img);
      }
    }
    parent.append(element); return element;
  };
  for (const item of blocks || []) {
    if (item.type === "table") { const table = document.createElement("table"); for (const row of item.rows) { const tr = table.insertRow(); for (const cell of row) { const td = tr.insertCell(); for (const p of cell) addParagraph(p, td); } } editor.append(table); }
    else addParagraph(item);
  }
  return urls;
}

async function loadDocxHandle(block, handle, state = {}) {
  const file = await fileFromHandle(handle); if (!file) throw new Error("DOCX could not be read");
  const model = parseDocx(new Uint8Array(await file.arrayBuffer()));
  if (Array.isArray(state.blocks)) model.blocks = structuredClone(state.blocks);
  const runtime = { handle, model, objectUrls: [] }; runtimeSources.set(block, runtime);
  runtime.objectUrls = renderDocxEditor(block, model.blocks, model);
  runtime.serialize = () => { model.blocks = docxBlocksFromEditor(block.querySelector(".docx-editor")); return serializeDocx(model); };
  clearSourceUnavailable(block); setDocumentDirty(block, Boolean(state.dirty));
  requestAnimationFrame(() => { block.querySelector(".docx-editor").scrollTop = Number(state.scrollTop) || 0; });
}

registerBlockType("docx", {
  createElement() { return templates.docx.content.firstElementChild.cloneNode(true); },
  initialize(block) {
    attachDocumentSave(block);
    const editor = block.querySelector(".docx-editor");
    block.addEventListener("framechute:release-resources",()=>{for(const url of runtimeSources.get(block)?.objectUrls||[])URL.revokeObjectURL(url);},{once:true});
    const imageFiles = (event) => [...event.dataTransfer?.files || []].filter((file) => /^image\/(png|jpeg|gif|webp)$/i.test(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name));
    editor.addEventListener("dragenter", (event) => { if(!imageFiles(event).length)return;event.preventDefault();event.stopPropagation();workspace.classList.remove("is-drop-target");editor.classList.add("is-docx-drop-target"); }, true);
    editor.addEventListener("dragover", (event) => { if(!imageFiles(event).length)return;event.preventDefault();event.stopPropagation();if(event.dataTransfer)event.dataTransfer.dropEffect="copy";workspace.classList.remove("is-drop-target");editor.classList.add("is-docx-drop-target"); }, true);
    editor.addEventListener("dragleave", (event) => { if(!editor.contains(event.relatedTarget))editor.classList.remove("is-docx-drop-target"); }, true);
    editor.addEventListener("drop", async (event) => {
      const files=imageFiles(event);if(!files.length)return;event.preventDefault();event.stopPropagation();editor.classList.remove("is-docx-drop-target");workspace.classList.remove("is-drop-target");
      const runtime=runtimeSources.get(block);if(!runtime?.model){setStatus("This DOCX is not ready for image insertion.");return;}
      let target=(document.caretPositionFromPoint?.(event.clientX,event.clientY)?.offsetNode || document.caretRangeFromPoint?.(event.clientX,event.clientY)?.startContainer)?.parentElement?.closest("p,h1,h2,h3,h4,h5,h6,li,td") || editor.lastElementChild;
      if(!target || !editor.contains(target)){target=document.createElement("p");editor.append(target);}
      for(const file of files){const bitmap=await createImageBitmap(file);const ratio=Math.min(1,Math.max(1,editor.clientWidth-32)/bitmap.width),descriptor=addDocxImage(runtime.model,new Uint8Array(await file.arrayBuffer()),{mime:file.type||"image/png",width:Math.round(bitmap.width*ratio),height:Math.round(bitmap.height*ratio)});bitmap.close();const img=document.createElement("img"),url=URL.createObjectURL(file);runtime.objectUrls.push(url);img.src=url;img.alt=file.name;img.contentEditable="false";img.dataset.docxRelationship=descriptor.relationshipId;img.dataset.docxPart=descriptor.part;img.dataset.docxMime=descriptor.mime;img.dataset.docxWidth=String(descriptor.width);img.dataset.docxHeight=String(descriptor.height);img.style.width=`${descriptor.width}px`;img.style.height=`${descriptor.height}px`;img.style.maxWidth="100%";img.style.objectFit="contain";target.append(img);}
      setDocumentDirty(block,true);setStatus(`${files.length} image${files.length===1?"":"s"} inserted into the DOCX.`);
    }, true);
    editor.addEventListener("input", () => setDocumentDirty(block, true));
    for (const [selector, command] of [[".docx-bold", "bold"], [".docx-italic", "italic"], [".docx-underline", "underline"]]) block.querySelector(selector).addEventListener("click", () => { editor.focus(); document.execCommand(command); setDocumentDirty(block, true); });
    block.querySelector(".reconnect-source").addEventListener("click", async () => { try { await reconnectSource(block, pickDocxFile, (handle) => loadDocxHandle(block, handle, this.capture(block))); } catch (error) { console.error(error); setStatus("Could not reconnect that DOCX."); } });
  },
  capture(block) { const runtime=runtimeSources.get(block);return { blocks: docxBlocksFromEditor(block.querySelector(".docx-editor")), scrollTop: block.querySelector(".docx-editor").scrollTop, dirty: block.dataset.documentDirty === "true", embeddedBlob:getSourceRecord(block)?null:runtime?.serialize?.()||null }; },
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

async function createBlock(record = {}) {
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
  async sourceBlob(block) {
    const type = block.dataset.blockType;
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
    await createBlock(record);
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

try {
  await refreshSnapshotList();
  await createBlock({
    type: "text",
    name: "Welcome",
    state: {
      text: "Flashframe is running as a Chrome/Chromium extension.\n\nOpen local text, PDFs, image folders, or video. Arrange the blocks, leave each item where it is useful, then save a Flashframe."
    }
  });
  setStatus("Ready. Your workspace data stays local in this extension.");
} catch (error) {
  console.error(error);
  setStatus("Flashframe opened, but local persistence could not initialize.");
}
