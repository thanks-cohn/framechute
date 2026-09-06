import { saveBlobAs } from "./actions/native-save.js";
import { contentBounds, outputDimensions, validateRasterSize } from "./workspace-snapshot-bounds.mjs";

const workspace = document.querySelector("#workspace");
const dialog = document.querySelector("#snapshot-export-dialog");
const form = dialog?.querySelector("form");
const status = document.querySelector("#status");

function announce(message) { if (status) status.textContent = message; }
function pad(value) { return String(value).padStart(2, "0"); }
function defaultName(extension) {
  const now = new Date();
  return `framechute-snapshot-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.${extension}`;
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

async function takeSnapshot() {
  const records = measuredBlocks();
  const bounds = contentBounds(records);
  if (!bounds) { announce("Nothing to snapshot."); return; }
  form.reset(); updateDialog(bounds); dialog.showModal();
  const accepted = await new Promise(resolve => dialog.addEventListener("close", () => resolve(dialog.returnValue === "export"), { once: true }));
  if (!accepted) return;
  const format = form.elements.format.value;
  const transparent = format !== "jpeg" && form.elements.transparent.checked;
  try {
    announce("Rendering the used workspace…");
    const blob = await renderSnapshot(records, bounds, { format, scale: Number(form.elements.scale.value), quality: Number(form.elements.quality.value), transparent, background: "#ffffff" });
    await saveBlobAs({ blob, filename: form.elements.filename.value, extension: format === "jpeg" ? "jpg" : format, mimeType: `image/${format}`, description: "FrameChute snapshot image" });
    announce(`Snapshot saved (${outputDimensions(bounds, Number(form.elements.scale.value)).width} × ${outputDimensions(bounds, Number(form.elements.scale.value)).height}).`);
  } catch (error) { announce(error.message); }
}

form?.addEventListener("change", () => { const bounds = contentBounds(measuredBlocks()); if (bounds) updateDialog(bounds); });
document.querySelector("#take-snapshot")?.addEventListener("click", () => void takeSnapshot());
window.addEventListener("framechute:take-snapshot", () => void takeSnapshot());
window.addEventListener("framechute:open-workspace", () => document.querySelector("#import-fcx")?.click());
window.addEventListener("framechute:export-workspace", () => document.querySelector("#export-fcx")?.click());
