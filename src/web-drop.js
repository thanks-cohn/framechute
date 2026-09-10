import { createCanvasPayload, validateCanvasSize } from "./standalone-canvas.mjs";
import {
  fileFromHandle,
  hasReadPermission,
  makeHandleKey,
  requestReadPermission,
  resolveHandle,
  storeHandle
} from "./file-access.js";
import { classifyLocalFile, looksLikeImageUrl, nativeImagePickerExtensions } from "./media-types.js";
import { parseCsv } from "./actions/csv.js";

const MARKER = "__FLASHFRAME_CUSTOM_BLOCK_V1__";
const LEGACY_EMBED_KIND = "you" + "tube";
const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");
const addTextButton = document.querySelector("#add-text");
const openImageButton = document.querySelector("#open-image");
const openUrlButton = document.querySelector("#open-url");

const customObjectUrls = new WeakMap();
let customOffset = 0;
let dragDepth = 0;

function setStatus(message) {
  if (status) status.textContent = message;
}

function formatTime(seconds) {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = Math.floor(value % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function normalizeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

function defaultPlacement(kind, point = null) {
  const offset = customOffset % 220;
  customOffset += 28;
  const sizes = {
    image: { width: 520, height: 440 },
    canvas: { width: 520, height: 440 },
    web: { width: 720, height: 560 }
  };
  const size = sizes[kind] ?? sizes.web;
  return {
    x: point ? Math.max(8, point.x - 80) : 48 + offset,
    y: point ? Math.max(8, point.y - 40) : 48 + offset,
    ...size
  };
}

function canvasPoint(event) {
  const rect = workspace.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function markerPayload(block) {
  const store = block.querySelector(".custom-state-store");
  if (!store?.value?.startsWith(MARKER)) return null;
  try {
    return JSON.parse(store.value.slice(MARKER.length));
  } catch {
    return null;
  }
}

function writeMarker(block, payload, notify = false) {
  const store = block.querySelector(".custom-state-store");
  if (!store) return;
  store.value = `${MARKER}${JSON.stringify(payload)}`;
  block.dataset.customKind = payload.kind;
  if (notify) {
    workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
  }
}

function nextZ() {
  let max = 1;
  for (const block of workspace.querySelectorAll(".block")) {
    const z = Number.parseInt(block.style.zIndex, 10);
    if (Number.isFinite(z)) max = Math.max(max, z);
  }
  return max + 1;
}

function bringForward(block) {
  block.style.zIndex = String(nextZ());
}

function cleanupCustomBlock(block) {
  const url = customObjectUrls.get(block);
  if (url) URL.revokeObjectURL(url);
  customObjectUrls.delete(block);
}

function setObjectUrl(block, url) {
  const old = customObjectUrls.get(block);
  if (old) URL.revokeObjectURL(old);
  customObjectUrls.set(block, url);
}

function attachCustomInteractions(block) {
  const header = block.querySelector(".block-header");
  const remove = block.querySelector(".remove-block");
  const maximize = block.querySelector(".maximize-block");

  block.addEventListener("pointerdown", () => bringForward(block));

  remove?.addEventListener("click", () => {
    cleanupCustomBlock(block);
    block.remove();
    setStatus("Block removed. Local source unchanged.");
    workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
  });

  maximize?.addEventListener("click", () => {
    const maximized = block.classList.contains("is-maximized");
    if (maximized) {
      const previous = JSON.parse(block.dataset.previousGeometry || "null");
      if (previous) {
        block.style.left = previous.left;
        block.style.top = previous.top;
        block.style.width = previous.width;
        block.style.height = previous.height;
      }
      block.classList.remove("is-maximized");
      delete block.dataset.previousGeometry;
    } else {
      block.dataset.previousGeometry = JSON.stringify({
        left: block.style.left,
        top: block.style.top,
        width: block.style.width,
        height: block.style.height
      });
      block.classList.add("is-maximized");
      const workspaceTop = workspace.getBoundingClientRect().top + window.scrollY;
      block.style.left = `${window.scrollX + 16}px`;
      block.style.top = `${Math.max(16, window.scrollY - workspaceTop + 16)}px`;
      block.style.width = `${Math.max(360, window.innerWidth - 32)}px`;
      block.style.height = `${Math.max(280, window.innerHeight - 86)}px`;
      bringForward(block);
    }
    workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
  });

  header?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("input, button") || block.classList.contains("is-maximized")) return;
    event.preventDefault();
    bringForward(block);

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = Number.parseFloat(block.style.left) || block.offsetLeft;
    const startTop = Number.parseFloat(block.style.top) || block.offsetTop;
    header.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      block.style.left = `${startLeft + moveEvent.clientX - startX}px`;
      block.style.top = `${startTop + moveEvent.clientY - startY}px`;
    };

    const finish = () => {
      header.removeEventListener("pointermove", move);
      header.removeEventListener("pointerup", finish);
      header.removeEventListener("pointercancel", finish);
      workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
    };

    header.addEventListener("pointermove", move);
    header.addEventListener("pointerup", finish);
    header.addEventListener("pointercancel", finish);
  });
}

function buildShell(payload, options = {}) {
  const block = document.createElement("section");
  block.className = `block custom-flashframe-block ${payload.kind}-block`;
  // Existing Flashframe persistence treats custom blocks as text containers.
  // The hidden textarea carries a versioned custom payload and is converted
  // back into the rich block immediately after restore.
  block.dataset.blockType = "text";
  block.dataset.blockId = options.id ?? crypto.randomUUID();
  block.dataset.customKind = payload.kind;

  const placement = options.placement ?? defaultPlacement(payload.kind, options.point);
  block.style.left = options.style?.left ?? `${placement.x}px`;
  block.style.top = options.style?.top ?? `${placement.y}px`;
  block.style.width = options.style?.width ?? `${placement.width}px`;
  block.style.height = options.style?.height ?? `${placement.height}px`;
  block.style.zIndex = options.style?.zIndex ?? String(nextZ());

  const header = document.createElement("div");
  header.className = "block-header";

  const name = document.createElement("input");
  name.className = "block-name";
  name.setAttribute("aria-label", "Block name");
  name.value = options.name || payload.name || (payload.kind === "web" ? "Web page" : "Image");

  const actions = document.createElement("div");
  actions.className = "block-actions";
  actions.innerHTML = '<button class="maximize-block" type="button" title="Maximize">□</button><button class="remove-block" type="button" title="Remove from workspace">×</button>';
  header.append(name, actions);

  const store = document.createElement("textarea");
  store.className = "text-editor custom-state-store";
  store.setAttribute("aria-hidden", "true");
  store.tabIndex = -1;

  block.append(header, store);
  writeMarker(block, payload);
  attachCustomInteractions(block);
  return block;
}

function customFooter(...children) {
  const footer = document.createElement("div");
  footer.className = "block-toolbar custom-block-toolbar";
  footer.append(...children);
  return footer;
}

function button(label, className, title = label) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  element.title = title;
  return element;
}

function hostLabel(url) {
  const span = document.createElement("span");
  span.className = "url-host";
  try {
    span.textContent = new URL(url).hostname;
  } catch {
    span.textContent = url;
  }
  return span;
}

function openPage(url) {
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    // A blocked popup should not affect the workspace block.
  }
}

async function renderImage(block, payload) {
  let image = block.querySelector(".image-frame");
  if (!image) {
    image = document.createElement("img");
    image.className = "image-frame";
    image.alt = payload.displayName || payload.name || "Image";
    block.querySelector(".custom-state-store").after(image);
    image.addEventListener("error", () => {
      let message = block.querySelector(".image-decode-message");
      if (!message) {
        message = document.createElement("div");
        message.className = "custom-source-message image-decode-message";
        image.after(message);
      }
      message.textContent = "Flashframe recognizes this image, but Chromium cannot render this format. The original source remains available for reconnect or external use.";
    });
    image.addEventListener("load", () => block.querySelector(".image-decode-message")?.remove());
  }

  const existingMessage = block.querySelector(".custom-source-message");
  existingMessage?.remove();

  if (payload.dataUrl) {
    image.src = payload.dataUrl;
    return;
  }

  if (payload.url) {
    image.src = payload.url;
    return;
  }

  if (!payload.handleKey) return;
  const handle = await resolveHandle(payload.handleKey);
  if (handle && (await hasReadPermission(handle))) {
    const file = await fileFromHandle(handle);
    const url = URL.createObjectURL(file);
    setObjectUrl(block, url);
    image.src = url;
    return;
  }

  image.removeAttribute("src");
  const message = document.createElement("div");
  message.className = "custom-source-message";
  const reconnect = button("Reconnect image", "reconnect-custom-image");
  const text = document.createElement("div");
  text.textContent = `Reconnect ${payload.displayName || "this image"} to display it.`;
  message.append(text, reconnect);
  image.after(message);

  reconnect.addEventListener("click", async () => {
    let candidate = await resolveHandle(payload.handleKey);
    if (candidate && (await requestReadPermission(candidate))) {
      await renderImage(block, payload);
      return;
    }

    try {
      const [picked] = await showOpenFilePicker({
        multiple: false,
        types: [{ description: "Images", accept: { "image/*": nativeImagePickerExtensions } }]
      });
      if (!picked) return;
      const handleKey = payload.handleKey || makeHandleKey("image");
      await storeHandle(handleKey, picked);
      payload.handleKey = handleKey;
      payload.displayName = picked.name;
      writeMarker(block, payload, true);
      await renderImage(block, payload);
    } catch (error) {
      if (error?.name !== "AbortError") console.error(error);
    }
  });
}

async function blankCanvasDataUrl(width, height) {
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not create the transparent canvas.")), "image/png"));
  return fileAsDataUrl(new File([blob], "transparent-canvas.png", { type: "image/png" }));
}

function renderImageBlock(payload, options = {}) {
  const block = buildShell(payload, options);
  if(payload.kind==="canvas")block.dataset.canvasObject="true";
  const detail = document.createElement("span");
  detail.className = "custom-detail";
  detail.textContent = payload.displayName || "Image";
  const sourceUrl = payload.url || null;
  const open = button("Open image", "open-external");
  open.hidden = !sourceUrl;
  if (sourceUrl) open.addEventListener("click", () => openPage(sourceUrl));
  block.append(customFooter(detail, open));
  void renderImage(block, payload);
  return block;
}

function renderWebBlock(payload, options = {}) {
  const block = buildShell(payload, options);
  const frame = document.createElement("iframe");
  frame.className = "web-frame";
  frame.title = payload.name || "Web page";
  frame.src = payload.url;

  const note = document.createElement("span");
  note.className = "custom-detail";
  note.textContent = "Some sites block embedding";
  const reload = button("Reload", "reload-web");
  const open = button("Open page", "open-external");
  reload.addEventListener("click", () => {
    frame.src = payload.url;
  });
  open.addEventListener("click", () => openPage(payload.url));

  block.append(frame, customFooter(hostLabel(payload.url), note, reload, open));
  return block;
}

function createCustomBlock(payload, options = {}) {
  let block = null;
  if (payload.kind === "image") block = renderImageBlock(payload, options);
  if (payload.kind === "canvas") block = renderImageBlock(payload, options);
  if (payload.kind === LEGACY_EMBED_KIND) payload = { kind: "web", name: payload.name || "Web page", url: payload.url }; // migrate old snapshots
  if (payload.kind === "web") block = renderWebBlock(payload, options);
  if (!block) return null;

  if (options.replace) options.replace.replaceWith(block);
  else workspace.append(block);
  window.dispatchEvent(new CustomEvent("framechute:custom-block-ready", { detail: { block, payload } }));
  return block;
}

window.addEventListener("framechute:add-canvas", event => {
  event.detail.promise = (async () => {
    try {
      const { width, height } = validateCanvasSize(event.detail?.width, event.detail?.height);
      const payload = createCanvasPayload(width, height, await blankCanvasDataUrl(width, height));
      const block = createCustomBlock(payload); if (!block) return;
      setStatus(`Transparent ${width} × ${height} canvas added.`);
      workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
    } catch (error) { console.error(error); setStatus(error?.message || "The canvas could not be created."); }
  })();
});

window.addEventListener("framechute:add-result-object", async (event) => {
  const { blob, name, kind, point } = event.detail || {};
  if (!(blob instanceof Blob)) return;
  if(kind==="csv"){await window.FrameChuteWorkspace.createBlock({type:"csv",name:name||"result.csv",state:{rows:parseCsv(await blob.text())}});return;}
  if (kind === "text") { await createDroppedText(await blob.text(), { x: 120, y: 120 }); const block=[...workspace.querySelectorAll('.block[data-block-type="text"]')].at(-1); if(block)block.querySelector(".block-name").value=name||"Extracted text"; return; }
  if (kind !== "image") { window.dispatchEvent(new CustomEvent("framechute:open-result-file", { detail: { file: new File([blob], name || "result", { type: blob.type }), kind } })); return; }
  const dataUrl = await fileAsDataUrl(new File([blob], name || "result.png", { type: blob.type }));
  const style=point?{left:`${point.x}px`,top:`${point.y}px`}:undefined;
  const block = createCustomBlock({ kind: "image", name: name || "Result", displayName: name || "Result", dataUrl },{style});
  if (block) {
    block.dataset.resultObject = "true";
    setStatus(`${name || "Image result"} added to the workspace.`);
    workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
  }
});

function convertRestoredMarker(block) {
  if (!block?.isConnected || block.classList.contains("custom-flashframe-block")) return false;
  const editor = block.querySelector(".text-editor");
  if (!editor?.value?.startsWith(MARKER)) return false;

  let payload;
  try {
    payload = JSON.parse(editor.value.slice(MARKER.length));
  } catch {
    return false;
  }

  const name = block.querySelector(".block-name")?.value || payload.name;
  const style = {
    left: block.style.left,
    top: block.style.top,
    width: block.style.width,
    height: block.style.height,
    zIndex: block.style.zIndex
  };
  createCustomBlock(payload, {
    id: block.dataset.blockId,
    name,
    style,
    replace: block
  });
  return true;
}

function scheduleMarkerCheck(block) {
  for (const delay of [0, 30, 120, 350]) {
    setTimeout(() => convertRestoredMarker(block), delay);
  }
}

async function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

async function createImageFromDrop(item, point, offset = 0) {
  const file = item.getAsFile?.();
  if (!file || classifyLocalFile(file) !== "image") return false;

  const payload = {
    kind: "image",
    name: file.name || "Dropped image",
    displayName: file.name || "Dropped image"
  };

  try {
    const handle = typeof item.getAsFileSystemHandle === "function" ? await item.getAsFileSystemHandle() : null;
    if (handle?.kind === "file") {
      const handleKey = makeHandleKey("image");
      await storeHandle(handleKey, handle);
      payload.handleKey = handleKey;
    } else {
      payload.dataUrl = await fileAsDataUrl(file);
    }
  } catch {
    payload.dataUrl = await fileAsDataUrl(file);
  }

  createCustomBlock(payload, { point: { x: point.x + offset, y: point.y + offset } });
  return true;
}

async function waitForNewTextBlock(before) {
  return new Promise((resolve) => {
    const find = () => [...workspace.querySelectorAll('.block[data-block-type="text"]')]
      .find((block) => !before.has(block) && !block.classList.contains("custom-flashframe-block"));

    const immediate = find();
    if (immediate) {
      resolve(immediate);
      return;
    }

    const observer = new MutationObserver(() => {
      const block = find();
      if (!block) return;
      observer.disconnect();
      resolve(block);
    });
    observer.observe(workspace, { childList: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(find() ?? null);
    }, 1000);
  });
}

async function createDroppedText(text, point) {
  const before = new Set(workspace.querySelectorAll(".block"));
  const waiting = waitForNewTextBlock(before);
  addTextButton?.click();
  const block = await waiting;
  if (!block) return;
  const editor = block.querySelector(".text-editor");
  const name = block.querySelector(".block-name");
  if (editor) editor.value = text;
  if (name) name.value = "Dropped text";
  block.style.left = `${Math.max(8, point.x - 80)}px`;
  block.style.top = `${Math.max(8, point.y - 40)}px`;
  workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
}

function imageUrlFromHtml(html) {
  if (!html) return null;
  try {
    const document = new DOMParser().parseFromString(html, "text/html");
    return document.querySelector("img[src]")?.src ?? null;
  } catch {
    return null;
  }
}

function firstUri(data) {
  return String(data || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#")) || null;
}

function createUrlBlock(value, point = null, forceImage = false) {
  const url = normalizeUrl(value);
  if (!url) {
    setStatus("That does not look like an HTTP or HTTPS URL.");
    return null;
  }

  if (forceImage || looksLikeImageUrl(url)) {
    const block = createCustomBlock({ kind: "image", name: "Image", url: url.href, displayName: url.pathname.split("/").pop() || url.hostname }, { point });
    setStatus("Image added from the web.");
    return block;
  }

  const block = createCustomBlock({ kind: "web", name: url.hostname, url: url.href }, { point });
  setStatus("Web page added. If the site blocks embedding, use Open page in the block footer.");
  return block;
}

// One public ingestion seam is shared by paste/Open File and the established
import { shouldGenericWorkspaceIngest, shouldShowGlobalIngest } from "./drag-ownership.mjs";
// drag/drop implementation; it deliberately delegates to the same creators.
window.FrameChuteIngest = Object.freeze({
  ...(window.FrameChuteIngest || {}),
  addUrl: (value, point) => createUrlBlock(value, point),
  addText: (value, point) => createDroppedText(value, point)
});

openImageButton?.addEventListener("click", async () => {
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: "Images and GIFs", accept: { "image/*": nativeImagePickerExtensions } }]
    });
    if (!handle) return;

    const handleKey = makeHandleKey("image");
    await storeHandle(handleKey, handle);
    createCustomBlock({
      kind: "image",
      name: handle.name || "Image",
      displayName: handle.name || "Image",
      handleKey
    });
    setStatus(`${handle.name || "Image"} added. Right-click it to show the image only.`);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      setStatus("FrameChute could not open that image.");
    }
  }
});

openUrlButton?.addEventListener("click", () => {
  const value = window.prompt("Paste a webpage, image, or direct media URL");
  if (value == null) return;
  createUrlBlock(value);
});

workspace.addEventListener("dragenter", (event) => {
  if (!shouldShowGlobalIngest(event)) return;
  event.preventDefault();
  dragDepth += 1;
  workspace.classList.add("is-drop-target");
});

workspace.addEventListener("dragover", (event) => {
  if (!shouldShowGlobalIngest(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  workspace.classList.add("is-drop-target");
});

workspace.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) workspace.classList.remove("is-drop-target");
});

workspace.addEventListener("drop", async (event) => {
  if (!shouldGenericWorkspaceIngest(event)) return;
  event.preventDefault();
  dragDepth = 0;
  workspace.classList.remove("is-drop-target");
  const point = canvasPoint(event);
  const transfer = event.dataTransfer;
  if (!transfer) return;

  const fileItems = [...transfer.items].filter((item) => item.kind === "file");
  let imagesAdded = 0;
  for (const item of fileItems) {
    if (classifyLocalFile(item.getAsFile?.()) !== "image") continue;
    if (await createImageFromDrop(item, point, imagesAdded * 28)) imagesAdded += 1;
  }
  if (imagesAdded) {
    setStatus(`${imagesAdded} image${imagesAdded === 1 ? "" : "s"} dropped into Flashframe.`);
    return;
  }

  const htmlImage = imageUrlFromHtml(transfer.getData("text/html"));
  if (htmlImage) {
    createUrlBlock(htmlImage, point, true);
    return;
  }

  const uri = firstUri(transfer.getData("text/uri-list"));
  if (uri) {
    createUrlBlock(uri, point);
    return;
  }

  const plain = transfer.getData("text/plain").trim();
  if (!plain) return;
  if (normalizeUrl(plain)) createUrlBlock(plain, point);
  else await createDroppedText(plain, point);
});

workspace.addEventListener("click", (event) => {
  if (event.target.closest(".remove-block")) {
    queueMicrotask(() => setStatus("Block removed. Local source unchanged."));
  }
});

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.classList.contains("block")) scheduleMarkerCheck(node);
      for (const block of node.querySelectorAll?.(".block") ?? []) scheduleMarkerCheck(block);
    }
    for (const node of mutation.removedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.classList.contains("custom-flashframe-block")) cleanupCustomBlock(node);
      for (const block of node.querySelectorAll?.(".custom-flashframe-block") ?? []) cleanupCustomBlock(block);
    }
  }
});

observer.observe(workspace, { childList: true, subtree: false });
for (const block of workspace.querySelectorAll('.block[data-block-type="text"]')) scheduleMarkerCheck(block);
