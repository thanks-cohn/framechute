import {
  fileFromHandle,
  hasReadPermission,
  listImages,
  makeHandleKey,
  requestReadPermission,
  resolveHandle,
  storeHandle
} from "./file-access.js";
import { classifyLocalFile, extensionOf } from "./media-types.js";

const MARKER = "__FLASHFRAME_LOCAL_DROP_V1__";
const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");
const addTextButton = document.querySelector("#add-text");

const objectUrls = new WeakMap();
import { shouldGenericWorkspaceIngest, shouldShowGlobalIngest } from "./drag-ownership.mjs";
let dropOffset = 0;
let dragDepth = 0;

if (!document.querySelector('link[data-flashframe-web-drop-style="true"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./web-drop.css", import.meta.url).href;
  link.dataset.flashframeWebDropStyle = "true";
  document.head.append(link);
}

function setStatus(message) {
  if (status) status.textContent = message;
}

function isTextFile(file) {
  if (file.type.startsWith("text/")) return true;
  return new Set([
    "txt", "md", "markdown", "log", "csv", "json", "xml", "yaml", "yml",
    "js", "mjs", "cjs", "ts", "tsx", "jsx", "css", "html", "htm", "py",
    "rb", "go", "rs", "zig", "c", "h", "cc", "cpp", "hpp", "java", "sh",
    "fish", "toml", "ini", "conf", "sql"
  ]).has(extensionOf(file.name));
}

function isPdfFile(file) {
  return classifyLocalFile(file) === "pdf";
}

function isDocxFile(file) { return /\.docx$/i.test(file.name || "") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; }

function isVideoFile(file) {
  return classifyLocalFile(file) === "video";
}

function isAudioFile(file) {
  return classifyLocalFile(file) === "audio";
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

function nextZ() {
  let max = 1;
  for (const block of workspace.querySelectorAll(".block")) {
    const value = Number.parseInt(block.style.zIndex, 10);
    if (Number.isFinite(value)) max = Math.max(max, value);
  }
  return max + 1;
}

function placementFor(kind, point = null, offset = 0) {
  const fallbackOffset = dropOffset % 220;
  dropOffset += 28;
  const sizes = {
    pdf: { width: 620, height: 680 },
    gallery: { width: 560, height: 560 },
    video: { width: 640, height: 430 },
    audio: { width: 480, height: 180 },
    file: { width: 480, height: 230 }
  };
  const size = sizes[kind] ?? sizes.file;
  const baseX = point ? point.x - 80 + offset : 48 + fallbackOffset;
  const baseY = point ? point.y - 40 + offset : 48 + fallbackOffset;
  return {
    x: Math.max(8, baseX),
    y: Math.max(8, baseY),
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
  if (notify) {
    workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
  }
}

function replaceObjectUrl(block, url) {
  const previous = objectUrls.get(block);
  if (previous) URL.revokeObjectURL(previous);
  objectUrls.set(block, url);
}

function releaseBlock(block) {
  const url = objectUrls.get(block);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(block);
  const media = block.querySelector("video, audio");
  if (media) {
    media.pause();
    media.removeAttribute("src");
    media.load();
  }
}

function bringForward(block) {
  block.style.zIndex = String(nextZ());
}

function attachInteractions(block) {
  const header = block.querySelector(".block-header");
  const remove = block.querySelector(".remove-block");
  const maximize = block.querySelector(".maximize-block");

  block.addEventListener("pointerdown", () => bringForward(block));

  remove?.addEventListener("click", () => {
    releaseBlock(block);
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
  block.className = `block custom-local-drop-block ${payload.kind}-block`;
  block.dataset.blockType = "text";
  block.dataset.blockId = options.id ?? crypto.randomUUID();
  block.dataset.customLocalKind = payload.kind;

  const placement = options.placement ?? placementFor(payload.kind, options.point, options.offset ?? 0);
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
  name.value = options.name || payload.name || payload.displayName || "Local source";

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
  attachInteractions(block);
  return block;
}

function reconnectButton(label = "Reconnect") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "reconnect-source";
  button.textContent = label;
  return button;
}

function setUnavailable(block, message) {
  const sourceMessage = block.querySelector(".source-message");
  const reconnect = block.querySelector(".reconnect-source");
  if (sourceMessage) {
    if (block.dataset.customLocalKind === "gallery" && reconnect) {
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

function clearUnavailable(block) {
  const sourceMessage = block.querySelector(".source-message");
  const reconnect = block.querySelector(".reconnect-source");
  if (sourceMessage) {
    sourceMessage.replaceChildren();
    sourceMessage.hidden = true;
  }
  if (reconnect) reconnect.hidden = true;
}

async function readableHandle(payload) {
  if (!payload.handleKey) return null;
  const handle = await resolveHandle(payload.handleKey);
  if (!handle) return null;
  return (await hasReadPermission(handle)) ? handle : null;
}

async function reconnectHandle(block, payload, expectedKind) {
  let handle = payload.handleKey ? await resolveHandle(payload.handleKey) : null;
  if (handle?.kind === expectedKind && (await requestReadPermission(handle))) return handle;

  try {
    handle = expectedKind === "directory"
      ? await window.showDirectoryPicker({ mode: "read" })
      : (await window.showOpenFilePicker({ multiple: false }))[0];
    if (!handle) return null;
    const handleKey = payload.handleKey || makeHandleKey(payload.kind);
    await storeHandle(handleKey, handle);
    payload.handleKey = handleKey;
    payload.displayName = handle.name;
    payload.name = handle.name;
    block.querySelector(".block-name").value = handle.name;
    writeMarker(block, payload, true);
    return handle;
  } catch (error) {
    if (error?.name !== "AbortError") console.error(error);
    return null;
  }
}

async function showGalleryIndex(block, payload, handle, index) {
  const entries = await listImages(handle);
  if (!entries.length) {
    setUnavailable(block, "This folder does not contain supported images.");
    block.querySelector(".gallery-position").textContent = "0 / 0";
    block.querySelector(".gallery-filename").textContent = "";
    block.querySelector(".gallery-image").removeAttribute("src");
    return;
  }

  let nextIndex = Number.isFinite(index) ? index : 0;
  if (payload.currentEntry) {
    const exact = entries.findIndex((entry) => entry.name === payload.currentEntry);
    if (exact >= 0 && !Number.isFinite(index)) nextIndex = exact;
  }
  nextIndex = ((nextIndex % entries.length) + entries.length) % entries.length;

  const entry = entries[nextIndex];
  const file = await entry.handle.getFile();
  const url = URL.createObjectURL(file);
  replaceObjectUrl(block, url);

  const image = block.querySelector(".gallery-image");
  image.src = url;
  image.alt = entry.name;
  block.querySelector(".gallery-position").textContent = `${nextIndex + 1} / ${entries.length}`;
  block.querySelector(".gallery-filename").textContent = entry.name;
  block.dataset.galleryIndex = String(nextIndex);

  payload.currentIndex = nextIndex;
  payload.currentEntry = entry.name;
  clearUnavailable(block);
  writeMarker(block, payload, true);
}

async function loadGallery(block, payload) {
  const handle = await readableHandle(payload);
  if (!handle || handle.kind !== "directory") {
    setUnavailable(block, `Reconnect ${payload.displayName || "this image folder"} to browse it.`);
    return;
  }
  await showGalleryIndex(block, payload, handle, undefined);
}

function renderGallery(payload, options = {}) {
  const block = buildShell(payload, options);
  block.tabIndex = 0;

  const stage = document.createElement("div");
  stage.className = "gallery-stage";
  const image = document.createElement("img");
  image.className = "gallery-image";
  image.alt = "";
  const message = document.createElement("div");
  message.className = "source-message";
  message.hidden = true;
  stage.append(image, message);

  const toolbar = document.createElement("div");
  toolbar.className = "block-toolbar gallery-toolbar";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "gallery-prev";
  previous.title = "Previous image";
  previous.textContent = "‹";
  const position = document.createElement("span");
  position.className = "gallery-position";
  position.textContent = "0 / 0";
  const filename = document.createElement("span");
  filename.className = "gallery-filename";
  const next = document.createElement("button");
  next.type = "button";
  next.className = "gallery-next";
  next.title = "Next image";
  next.textContent = "›";
  const reconnect = reconnectButton();
  reconnect.hidden = true;
  toolbar.append(previous, position, filename, next, reconnect);
  block.append(stage, toolbar);

  const move = async (direction) => {
    const current = Number.parseInt(block.dataset.galleryIndex || String(payload.currentIndex || 0), 10);
    let handle = await readableHandle(payload);
    if (!handle) handle = await reconnectHandle(block, payload, "directory");
    if (!handle) return;
    await showGalleryIndex(block, payload, handle, current + direction);
  };

  previous.addEventListener("click", () => void move(-1));
  next.addEventListener("click", () => void move(1));
  block.addEventListener("keydown", (event) => {
    if (event.target.closest("input, button, textarea")) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      void move(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      void move(1);
    }
  });

  reconnect.addEventListener("click", async () => {
    const handle = await reconnectHandle(block, payload, "directory");
    if (handle) await showGalleryIndex(block, payload, handle, undefined);
  });

  void loadGallery(block, payload);
  return block;
}

async function loadPdf(block, payload) {
  const handle = await readableHandle(payload);
  if (!handle || handle.kind !== "file") {
    setUnavailable(block, `Reconnect ${payload.displayName || "this PDF"} to display it.`);
    return;
  }
  const file = await fileFromHandle(handle);
  const url = URL.createObjectURL(file);
  replaceObjectUrl(block, url);
  clearUnavailable(block);
  const page = Math.max(1, Number.parseInt(payload.page || 1, 10) || 1);
  block.querySelector(".pdf-page").value = String(page);
  block.querySelector(".pdf-viewer").src = `${url}#page=${page}&toolbar=1&navpanes=0`;
}

function renderPdf(payload, options = {}) {
  const block = buildShell(payload, options);
  const toolbar = document.createElement("div");
  toolbar.className = "block-toolbar pdf-toolbar";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "pdf-prev";
  previous.title = "Previous page";
  previous.textContent = "‹";
  const label = document.createElement("label");
  label.append("Page ");
  const page = document.createElement("input");
  page.className = "pdf-page";
  page.type = "number";
  page.min = "1";
  page.step = "1";
  page.value = String(payload.page || 1);
  page.inputMode = "numeric";
  label.append(page);
  const next = document.createElement("button");
  next.type = "button";
  next.className = "pdf-next";
  next.title = "Next page";
  next.textContent = "›";
  const reconnect = reconnectButton();
  reconnect.hidden = true;
  toolbar.append(previous, label, next, reconnect);

  const message = document.createElement("div");
  message.className = "source-message";
  message.hidden = true;
  const viewer = document.createElement("iframe");
  viewer.className = "pdf-viewer";
  viewer.title = "PDF viewer";
  block.append(toolbar, message, viewer);

  const setPage = async (value) => {
    payload.page = Math.max(1, Number.parseInt(value, 10) || 1);
    writeMarker(block, payload, true);
    await loadPdf(block, payload);
  };
  previous.addEventListener("click", () => void setPage((payload.page || 1) - 1));
  next.addEventListener("click", () => void setPage((payload.page || 1) + 1));
  page.addEventListener("change", () => void setPage(page.value));
  reconnect.addEventListener("click", async () => {
    const handle = await reconnectHandle(block, payload, "file");
    if (handle) await loadPdf(block, payload);
  });

  void loadPdf(block, payload);
  return block;
}

async function loadVideo(block, payload) {
  const handle = await readableHandle(payload);
  if (!handle || handle.kind !== "file") {
    setUnavailable(block, `Reconnect ${payload.displayName || "this video"} to play it.`);
    return;
  }
  const file = await fileFromHandle(handle);
  const url = URL.createObjectURL(file);
  replaceObjectUrl(block, url);
  clearUnavailable(block);

  const player = block.querySelector(".video-player");
  if (payload.masterTimelineOffset != null && Number.isFinite(Number(payload.masterTimelineOffset))) player.dataset.masterTimelineOffset = String(Number(payload.masterTimelineOffset));
  else delete player.dataset.masterTimelineOffset;
  player.src = url;
  player.addEventListener("error", () => setUnavailable(block, "Flashframe recognizes this video, but Chromium cannot decode its codec."), { once: true });
  player.volume = Number.isFinite(payload.volume) ? Math.min(1, Math.max(0, payload.volume)) : 1;
  player.muted = Boolean(payload.muted);
  player.playbackRate = Number.isFinite(payload.playbackRate) ? payload.playbackRate : 1;
  const seekTime = Number.isFinite(payload.currentTime) ? Math.max(0, payload.currentTime) : 0;

  const restore = async () => {
    player.currentTime = Math.min(seekTime, Number.isFinite(player.duration) ? player.duration : seekTime);
    block.querySelector(".video-time").textContent = formatTime(player.currentTime);
    if (payload.paused === false) {
      try {
        await player.play();
      } catch {
        setStatus("Video position restored. Chrome requires a click before playback can resume.");
      }
    }
  };
  if (player.readyState >= 1) await restore();
  else player.addEventListener("loadedmetadata", restore, { once: true });
}

function renderVideo(payload, options = {}) {
  const block = buildShell(payload, options);
  block.dataset.timedMedia = "true";
  block.dataset.syncGroup = payload.syncGroup ?? "all";
  const message = document.createElement("div");
  message.className = "source-message";
  message.hidden = true;
  const player = document.createElement("video");
  player.className = "video-player";
  player.controls = true;
  player.preload = "metadata";

  const toolbar = document.createElement("div");
  toolbar.className = "block-toolbar source-toolbar";
  const time = document.createElement("span");
  time.className = "video-time";
  time.textContent = formatTime(payload.currentTime || 0);
  const loopLabel = document.createElement("label");
  loopLabel.className = "video-loop-control";
  loopLabel.title = "Loop this video";
  const loop = document.createElement("input");
  loop.type = "checkbox";
  loop.className = "video-loop";
  loop.checked = Boolean(payload.loop);
  const loopText = document.createElement("span");
  loopText.textContent = "Loop";
  loopLabel.append(loop, loopText);
  const reconnect = reconnectButton();
  reconnect.hidden = true;
  toolbar.append(time, loopLabel, reconnect);
  block.append(message, player, toolbar);

  let lastPersist = 0;
  const capture = (force = false) => {
    payload.currentTime = Number.isFinite(player.currentTime) ? player.currentTime : 0;
    payload.paused = player.paused;
    payload.volume = player.volume;
    payload.muted = player.muted;
    payload.playbackRate = player.playbackRate;
    payload.loop = player.loop;
    payload.syncGroup = block.dataset.syncGroup || "all";
    payload.masterTimelineOffset = Number.isFinite(Number.parseFloat(player.dataset.masterTimelineOffset || ""))
      ? Number.parseFloat(player.dataset.masterTimelineOffset)
      : null;
    time.textContent = formatTime(payload.currentTime);
    const now = Date.now();
    if (force || now - lastPersist > 1200) {
      writeMarker(block, payload, true);
      lastPersist = now;
    } else {
      writeMarker(block, payload, false);
    }
  };

  player.addEventListener("timeupdate", () => capture(false));
  for (const name of ["play", "pause", "volumechange", "ratechange", "ended"]) {
    player.addEventListener(name, () => capture(true));
  }
  loop.addEventListener("change", () => {
    player.loop = loop.checked;
    capture(true);
  });
  reconnect.addEventListener("click", async () => {
    const handle = await reconnectHandle(block, payload, "file");
    if (handle) await loadVideo(block, payload);
  });

  void loadVideo(block, payload).then(() => {
    player.loop = Boolean(payload.loop);
  });
  return block;
}

async function loadAudio(block, payload) {
  const handle = await readableHandle(payload);
  if (!handle || handle.kind !== "file") {
    setUnavailable(block, `Source needs permission again: ${payload.displayName || "this audio"}.`);
    return;
  }
  const file = await fileFromHandle(handle);
  const url = URL.createObjectURL(file);
  replaceObjectUrl(block, url);
  clearUnavailable(block);
  const player = block.querySelector(".audio-player");
  if (payload.masterTimelineOffset != null && Number.isFinite(Number(payload.masterTimelineOffset))) player.dataset.masterTimelineOffset = String(Number(payload.masterTimelineOffset));
  else delete player.dataset.masterTimelineOffset;
  player.src = url;
  player.addEventListener("error", () => setUnavailable(block, "Flashframe recognizes this audio file, but Chromium cannot decode its codec."), { once: true });
  player.volume = Number.isFinite(payload.volume) ? Math.min(1, Math.max(0, payload.volume)) : 1;
  player.muted = Boolean(payload.muted);
  player.playbackRate = Number.isFinite(payload.playbackRate) ? payload.playbackRate : 1;
  player.loop = Boolean(payload.loop);
  player.addEventListener("loadedmetadata", async () => {
    player.currentTime = Math.min(payload.currentTime || 0, player.duration || payload.currentTime || 0);
    if (payload.paused === false) try { await player.play(); } catch { setStatus("Audio restored; click play to resume."); }
  }, { once: true });
}

function renderAudio(payload, options = {}) {
  const block = buildShell(payload, options);
  block.dataset.timedMedia = "true";
  block.dataset.syncGroup = payload.syncGroup ?? "all";
  block.dataset.audioVisibility = payload.visibility ?? "visible";
  block.classList.add(`audio-${block.dataset.audioVisibility}`);
  const message = document.createElement("div");
  message.className = "source-message";
  message.hidden = true;
  const player = document.createElement("audio");
  player.className = "audio-player";
  player.controls = true;
  player.preload = "metadata";
  const toolbar = document.createElement("div");
  toolbar.className = "block-toolbar source-toolbar";
  const mode = document.createElement("select");
  mode.className = "audio-visibility";
  mode.setAttribute("aria-label", "Audio visibility");
  mode.innerHTML = '<option value="visible">Visible</option><option value="fade">Fade</option><option value="hidden">Hidden</option>';
  mode.value = block.dataset.audioVisibility;
  const reconnect = reconnectButton();
  reconnect.hidden = true;
  toolbar.append("Audio display", mode, reconnect);
  block.append(message, player, toolbar);

  let lastPersist = 0;
  const capture = (force = false) => {
    Object.assign(payload, {
      currentTime: Number.isFinite(player.currentTime) ? player.currentTime : 0,
      paused: player.paused, volume: player.volume, muted: player.muted,
      playbackRate: player.playbackRate, loop: player.loop,
      syncGroup: block.dataset.syncGroup || "all",
      masterTimelineOffset: Number.isFinite(Number.parseFloat(player.dataset.masterTimelineOffset || ""))
        ? Number.parseFloat(player.dataset.masterTimelineOffset)
        : null,
      visibility: block.dataset.audioVisibility || "visible"
    });
    if (force || Date.now() - lastPersist > 1200) { writeMarker(block, payload, true); lastPersist = Date.now(); }
    else writeMarker(block, payload, false);
  };
  for (const name of ["play", "pause", "volumechange", "ratechange", "ended"]) player.addEventListener(name, () => capture(true));
  player.addEventListener("timeupdate", () => capture(false));
  mode.addEventListener("change", () => {
    block.classList.remove("audio-visible", "audio-fade", "audio-hidden");
    block.dataset.audioVisibility = mode.value;
    block.classList.add(`audio-${mode.value}`);
    capture(true);
  });
  reconnect.addEventListener("click", async () => {
    const handle = await reconnectHandle(block, payload, "file");
    if (handle) await loadAudio(block, payload);
  });
  void loadAudio(block, payload);
  return block;
}

async function loadGenericFile(block, payload) {
  const handle = await readableHandle(payload);
  const open = block.querySelector(".open-local-file");
  if (!handle || handle.kind !== "file") {
    setUnavailable(block, `Reconnect ${payload.displayName || "this file"} to open it.`);
    if (open) open.disabled = true;
    return;
  }
  const file = await fileFromHandle(handle);
  clearUnavailable(block);
  if (open) {
    open.disabled = false;
    open.onclick = () => {
      const url = URL.createObjectURL(file);
      replaceObjectUrl(block, url);
      window.open(url, "_blank", "noopener,noreferrer");
    };
  }
}

function renderGenericFile(payload, options = {}) {
  const block = buildShell(payload, options);
  const body = document.createElement("div");
  body.className = "custom-source-message";
  const title = document.createElement("strong");
  title.textContent = payload.displayName || "Local file";
  const detail = document.createElement("div");
  detail.textContent = payload.mimeType || "Local file";
  const message = document.createElement("div");
  message.className = "source-message";
  message.hidden = true;
  body.append(title, detail, message);

  const toolbar = document.createElement("div");
  toolbar.className = "block-toolbar source-toolbar";
  const open = document.createElement("button");
  open.type = "button";
  open.className = "open-local-file";
  open.textContent = "Open file";
  const reconnect = reconnectButton();
  reconnect.hidden = true;
  toolbar.append(open, reconnect);
  block.append(body, toolbar);

  reconnect.addEventListener("click", async () => {
    const handle = await reconnectHandle(block, payload, "file");
    if (handle) await loadGenericFile(block, payload);
  });
  void loadGenericFile(block, payload);
  return block;
}

function createCustomBlock(payload, options = {}) {
  let block = null;
  if (payload.kind === "gallery") block = renderGallery(payload, options);
  if (payload.kind === "pdf") block = renderPdf(payload, options);
  if (payload.kind === "video") block = renderVideo(payload, options);
  if (payload.kind === "audio") block = renderAudio(payload, options);
  if (payload.kind === "file") block = renderGenericFile(payload, options);
  if (!block) return null;
  if (options.replace) options.replace.replaceWith(block);
  else workspace.append(block);
  return block;
}

function convertRestoredMarker(block) {
  if (!block?.isConnected || block.classList.contains("custom-local-drop-block")) return false;
  const editor = block.querySelector(".text-editor");
  if (!editor?.value?.startsWith(MARKER)) return false;

  let payload;
  try {
    payload = JSON.parse(editor.value.slice(MARKER.length));
  } catch {
    return false;
  }

  const style = {
    left: block.style.left,
    top: block.style.top,
    width: block.style.width,
    height: block.style.height,
    zIndex: block.style.zIndex
  };
  createCustomBlock(payload, {
    id: block.dataset.blockId,
    name: block.querySelector(".block-name")?.value || payload.name,
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

async function waitForNewTextBlock(before) {
  return new Promise((resolve) => {
    const find = () => [...workspace.querySelectorAll('.block[data-block-type="text"]')]
      .find((block) => !before.has(block) && !block.classList.contains("custom-local-drop-block"));
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

async function createTextFileBlock(file, point, offset = 0) {
  const before = new Set(workspace.querySelectorAll(".block"));
  const waiting = waitForNewTextBlock(before);
  addTextButton?.click();
  const block = await waiting;
  if (!block) return false;
  const editor = block.querySelector(".text-editor");
  const name = block.querySelector(".block-name");
  if (editor) editor.value = await file.text();
  if (name) name.value = file.name || "Dropped text";
  block.style.left = `${Math.max(8, point.x - 80 + offset)}px`;
  block.style.top = `${Math.max(8, point.y - 40 + offset)}px`;
  workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
  return true;
}

async function addHandle(handle, file, point, offset = 0) {
  if (!handle) return null;

  if (handle.kind === "directory") {
    const handleKey = makeHandleKey("gallery");
    await storeHandle(handleKey, handle);
    createCustomBlock({
      kind: "gallery",
      name: handle.name || "Dropped folder",
      displayName: handle.name || "Dropped folder",
      handleKey,
      currentIndex: 0,
      currentEntry: null
    }, { point, offset });
    return "folder";
  }

  if (handle.kind !== "file") return null;
  const localFile = file || await handle.getFile();
  if (!localFile) return null;

  if (localFile.type.startsWith("image/")) return null;
  if (isPdfFile(localFile) || isDocxFile(localFile)) {
    const detail = { handle, file: localFile, point: { x: Math.max(8, point.x - 80 + offset), y: Math.max(8, point.y - 40 + offset) } };
    window.dispatchEvent(new CustomEvent("framechute:open-document-handle", { detail }));
    await detail.promise;
    return isDocxFile(localFile) ? "docx" : "pdf";
  }
  if (isTextFile(localFile)) {
    await createTextFileBlock(localFile, point, offset);
    return "text";
  }

  const kind = isAudioFile(localFile) ? "audio" : isVideoFile(localFile) ? "video" : "file";
  const handleKey = makeHandleKey(kind);
  await storeHandle(handleKey, handle);
  const payload = {
    kind,
    name: localFile.name || handle.name || "Dropped file",
    displayName: localFile.name || handle.name || "Dropped file",
    handleKey,
    mimeType: localFile.type || ""
  };
  if (kind === "pdf") payload.page = 1;
  if (kind === "video" || kind === "audio") {
    payload.currentTime = 0;
    payload.paused = true;
    payload.volume = 1;
    payload.muted = false;
    payload.playbackRate = 1;
    payload.loop = false;
    payload.syncGroup = "all";
    if (kind === "audio") payload.visibility = "visible";
  }
  createCustomBlock(payload, { point, offset });
  return kind;
}

window.FrameChuteIngest = Object.freeze({
  ...(window.FrameChuteIngest || {}),
  async addFiles(files, point = { x: 80, y: 80 }) {
    let added = 0;
    for (const file of files) {
      if (!(file instanceof File)) continue;
      if (classifyLocalFile(file) === "image") {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        workspace.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: point.x, clientY: point.y }));
        added += 1;
        continue;
      }
      const handle = { kind: "file", name: file.name, __framechuteSyntheticFile: file };
      if (await addHandle(handle, file, point, added * 28)) added += 1;
    }
    return added;
  }
});

workspace.addEventListener("dragenter", (event) => {
  if (!shouldShowGlobalIngest(event)) return;
  if (![...event.dataTransfer?.items || []].some((item) => item.kind === "file")) return;
  event.preventDefault();
  dragDepth += 1;
  workspace.classList.add("is-drop-target");
});

workspace.addEventListener("dragover", (event) => {
  if (!shouldShowGlobalIngest(event)) return;
  if (![...event.dataTransfer?.items || []].some((item) => item.kind === "file")) return;
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
  const items = [...event.dataTransfer?.items || []].filter((item) => item.kind === "file");
  if (!items.length) return;

  event.preventDefault();
  dragDepth = 0;
  workspace.classList.remove("is-drop-target");
  const point = canvasPoint(event);

  let added = 0;
  const kinds = [];

  for (const item of items) {
    try {
      const handle = typeof item.getAsFileSystemHandle === "function"
        ? await item.getAsFileSystemHandle()
        : null;
      if (!handle) continue;
      const kind = await addHandle(handle, item.getAsFile?.() || null, point, added * 28);
      if (kind) {
        kinds.push(kind);
        added += 1;
      }
    } catch (error) {
      console.error("Could not add dropped local source", error);
    }
  }

  if (added) {
    const folders = kinds.filter((kind) => kind === "folder").length;
    const files = added - folders;
    if (folders && files) setStatus(`${folders} folder${folders === 1 ? "" : "s"} and ${files} file${files === 1 ? "" : "s"} dropped into Flashframe.`);
    else if (folders) setStatus(`${folders} folder${folders === 1 ? "" : "s"} opened as ${folders === 1 ? "a gallery" : "galleries"}.`);
    else setStatus(`${files} local file${files === 1 ? "" : "s"} dropped into Flashframe.`);
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
      if (node.classList.contains("custom-local-drop-block")) releaseBlock(node);
      for (const block of node.querySelectorAll?.(".custom-local-drop-block") ?? []) releaseBlock(block);
    }
  }
});

observer.observe(workspace, { childList: true, subtree: false });
for (const block of workspace.querySelectorAll('.block[data-block-type="text"]')) scheduleMarkerCheck(block);
