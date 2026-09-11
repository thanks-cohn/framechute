import { saveBlobAs, normalizeFilename } from "./actions/native-save.js";
import { getHandle, putHandle } from "./persistence.js";
import { contentBounds, outputDimensions, squareBounds, validateRasterSize } from "./workspace-snapshot-bounds.mjs";

const workspace = document.querySelector("#workspace");
const dialog = document.querySelector("#snapshot-export-dialog");
const form = dialog?.querySelector("form");
const status = document.querySelector("#status");
const snapshotFolderStatus = document.querySelector("#snapshot-folder-status");
const snapshotFolderChoose = document.querySelector("#snapshot-folder-choose");
const snapshotFolderClear = document.querySelector("#snapshot-folder-clear");
const SNAPSHOT_FOLDER_HANDLE_ID = "__framechute_snapshot_folder__";

function announce(message) { if (status) status.textContent = message; }
function pad(value) { return String(value).padStart(2, "0"); }
function defaultName(extension) {
  const now = new Date();
  return `framechute-snapshot-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.${extension}`;
}

async function snapshotFolderHandle() {
  try {
    const handle = await getHandle(SNAPSHOT_FOLDER_HANDLE_ID);
    return handle?.kind === "directory" ? handle : null;
  } catch (error) {
    console.warn("FrameChute could not read the default snapshot folder:", error);
    return null;
  }
}

async function directoryPermission(handle, request = false) {
  if (!handle) return false;
  if (!handle.queryPermission) return true;
  try {
    const current = await handle.queryPermission({ mode: "readwrite" });
    if (current === "granted") return true;
    if (!request || !handle.requestPermission) return false;
    return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
  } catch {
    return false;
  }
}

async function refreshSnapshotFolderSetting() {
  if (!snapshotFolderStatus || !snapshotFolderChoose || !snapshotFolderClear) return;
  if (typeof window.showDirectoryPicker !== "function") {
    snapshotFolderStatus.textContent = "Default folders are unavailable in this browser. Take Snapshot will use Save As.";
    snapshotFolderChoose.disabled = true;
    snapshotFolderClear.disabled = true;
    return;
  }

  const handle = await snapshotFolderHandle();
  if (!handle) {
    snapshotFolderStatus.textContent = "Not set. Take Snapshot will ask where to save.";
    snapshotFolderChoose.textContent = "Choose folder…";
    snapshotFolderClear.disabled = true;
    return;
  }

  const granted = await directoryPermission(handle, false);
  snapshotFolderStatus.textContent = granted
    ? `Saving snapshots automatically to: ${handle.name}`
    : `Remembered folder: ${handle.name}. Chrome needs permission again.`;
  snapshotFolderChoose.textContent = granted ? "Change folder…" : "Reconnect folder…";
  snapshotFolderClear.disabled = false;
}

async function chooseSnapshotFolder() {
  if (typeof window.showDirectoryPicker !== "function") return;
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    if (!handle) return;
    await putHandle(SNAPSHOT_FOLDER_HANDLE_ID, handle);
    await refreshSnapshotFolderSetting();
    announce(`Default snapshot folder set to ${handle.name}.`);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      announce("FrameChute could not remember that snapshot folder.");
    }
  }
}

async function clearSnapshotFolder() {
  try {
    await putHandle(SNAPSHOT_FOLDER_HANDLE_ID, null);
    await refreshSnapshotFolderSetting();
    announce("Default snapshot folder cleared. Take Snapshot will ask where to save.");
  } catch (error) {
    console.error(error);
    announce("FrameChute could not clear the snapshot folder setting.");
  }
}

async function saveSnapshotOutput({ blob, filename, extension, mimeType }) {
  const handle = await snapshotFolderHandle();

  if (handle) {
    const granted = await directoryPermission(handle, true);
    if (!granted) {
      await refreshSnapshotFolderSetting();
      throw new DOMException("Default snapshot folder needs permission. Use Reconnect folder in Settings.", "NotAllowedError");
    }

    const name = normalizeFilename(filename, extension);
    const fileHandle = await handle.getFileHandle(name, { create: true });
    const writer = await fileHandle.createWritable();
    try {
      await writer.write(blob);
      await writer.close();
    } catch (error) {
      await writer.abort?.();
      throw error;
    }
    return { saved: true, directory: handle, fileHandle, filename: name };
  }

  return saveBlobAs({
    blob,
    filename,
    extension,
    mimeType,
    description: "FrameChute snapshot image"
  });
}

function measuredBlocks() {
  const origin = workspace.getBoundingClientRect();
  return [...workspace.querySelectorAll(":scope > .block")].map(block => {
    const rect = block.getBoundingClientRect();
    const style = getComputedStyle(block);
    return { block, left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height, layoutLeft: block.offsetLeft, layoutTop: block.offsetTop, layoutWidth: block.offsetWidth, layoutHeight: block.offsetHeight, visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 };
  });
}

function canvasDataUrls(source, clone) {
  const originals = source.querySelectorAll("canvas");
  clone.querySelectorAll("canvas").forEach((canvas, index) => {
    const image = document.createElement("img");
    try { image.src = originals[index].toDataURL("image/png"); } catch { image.alt = "Canvas preview unavailable"; }
    image.className = canvas.className;
    image.setAttribute("style", canvas.getAttribute("style") || "width:100%;height:100%;object-fit:contain");
    canvas.replaceWith(image);
  });
}

function snapshotNode(record, bounds) {
  const clone = record.block.cloneNode(true);
  canvasDataUrls(record.block, clone);
  clone.querySelectorAll("video").forEach((video, index) => {
    const original = record.block.querySelectorAll("video")[index];
    const image = document.createElement("img");
    image.src = original?.poster || "";
    image.alt = image.src ? "Video frame" : "Video frame unavailable";
    image.style.cssText = "width:100%;height:100%;object-fit:contain;background:#111";
    video.replaceWith(image);
  });
  clone.querySelectorAll("iframe").forEach(frame => {
    const placeholder = document.createElement("div");
    placeholder.textContent = `Web content: ${frame.title || "cross-origin frame"}`;
    placeholder.style.cssText = "display:grid;place-items:center;width:100%;height:100%;background:#eee;color:#333";
    frame.replaceWith(placeholder);
  });
  // Position from the untransformed layout box while preserving the object's
  // own transform. Bounds above use the transformed visual rectangle.
  clone.style.cssText += `;left:${record.layoutLeft - bounds.left}px;top:${record.layoutTop - bounds.top}px;width:${record.layoutWidth}px;height:${record.layoutHeight}px;margin:0;`;
  return clone;
}

function stylesheetText() {
  return [...document.styleSheets].map(sheet => {
    try { return [...sheet.cssRules].map(rule => rule.cssText).join("\n"); } catch { return ""; }
  }).join("\n");
}

async function renderSnapshot(records, bounds, options) {
  const dimensions = outputDimensions(bounds, options.scale);
  const unsafe = validateRasterSize(dimensions);
  if (unsafe) throw new RangeError(unsafe);
  const container = document.createElement("div");
  container.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  container.style.cssText = `position:relative;width:${bounds.width}px;height:${bounds.height}px;overflow:hidden;background:${options.transparent ? "transparent" : options.background};`;
  records.filter(item => item.visible).sort((a, b) => (Number(a.block.style.zIndex) || 0) - (Number(b.block.style.zIndex) || 0)).forEach(item => container.append(snapshotNode(item, bounds)));
  const serialized = new XMLSerializer().serializeToString(container);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}"><foreignObject width="100%" height="100%"><style xmlns="http://www.w3.org/1999/xhtml">${stylesheetText().replaceAll("</style", "<\\/style")}</style>${serialized}</foreignObject></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("The workspace could not be rasterized. A cross-origin object may prevent capture.")); image.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width; canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    context.scale(options.scale, options.scale);
    if (!options.transparent) { context.fillStyle = options.background; context.fillRect(0, 0, bounds.width, bounds.height); }
    context.drawImage(image, 0, 0, bounds.width, bounds.height);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The snapshot could not be encoded; cross-origin media may be the cause.")), `image/${options.format}`, options.format === "png" ? undefined : options.quality));
  } finally { URL.revokeObjectURL(url); }
}

function updateDialog(bounds) {
  const format = form.elements.format.value;
  const scale = Number(form.elements.scale.value);
  const dimensions = outputDimensions(bounds, scale);
  form.querySelector(".snapshot-bounds").textContent = `Workspace bounds: ${bounds.width} × ${bounds.height}`;
  form.querySelector(".snapshot-dimensions").textContent = `Output: ${dimensions.width} × ${dimensions.height} pixels`;
  form.querySelector(".snapshot-quality").hidden = format === "png";
  form.querySelector(".snapshot-transparent").hidden = format === "jpeg";
  const extension = format === "jpeg" ? "jpg" : format;
  if (!form.elements.filename.value || /^framechute-snapshot-/.test(form.elements.filename.value)) form.elements.filename.value = defaultName(extension);
}

function framedBounds(tightBounds) {
  return form.elements.bounds.value === "square" ? squareBounds(tightBounds) : tightBounds;
}

async function takeSnapshot() {
  const records = measuredBlocks();
  const tightBounds = contentBounds(records);
  if (!tightBounds) { announce("Nothing to snapshot."); return; }
  form.reset(); updateDialog(framedBounds(tightBounds)); dialog.showModal();
  const accepted = await new Promise(resolve => dialog.addEventListener("close", () => resolve(dialog.returnValue === "export"), { once: true }));
  if (!accepted) return;
  const format = form.elements.format.value;
  const transparent = format !== "jpeg" && form.elements.transparent.checked;
  const bounds = framedBounds(tightBounds);
  try {
    announce("Rendering the used workspace…");
    const blob = await renderSnapshot(records, bounds, { format, scale: Number(form.elements.scale.value), quality: Number(form.elements.quality.value), transparent, background: "#ffffff" });
    const extension = format === "jpeg" ? "jpg" : format;
    const saved = await saveSnapshotOutput({
      blob,
      filename: form.elements.filename.value,
      extension,
      mimeType: `image/${format}`
    });
    const destination = saved?.directory?.name ? ` to ${saved.directory.name}` : "";
    announce(`Snapshot saved${destination} (${outputDimensions(bounds, Number(form.elements.scale.value)).width} × ${outputDimensions(bounds, Number(form.elements.scale.value)).height}).`);
  } catch (error) { announce(error.message); }
}

form?.addEventListener("change", () => { const bounds = contentBounds(measuredBlocks()); if (bounds) updateDialog(framedBounds(bounds)); });
snapshotFolderChoose?.addEventListener("click", () => void chooseSnapshotFolder());
snapshotFolderClear?.addEventListener("click", () => void clearSnapshotFolder());
document.querySelector("#take-snapshot")?.addEventListener("click", () => void takeSnapshot());
window.addEventListener("framechute:take-snapshot", () => void takeSnapshot());
window.addEventListener("framechute:open-workspace", () => document.querySelector("#import-fcx")?.click());
window.addEventListener("framechute:export-workspace", () => document.querySelector("#export-fcx")?.click());
void refreshSnapshotFolderSetting();
