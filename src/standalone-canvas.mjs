export const CANVAS_PRESETS = Object.freeze([[1920, 1080], [1080, 1080], [1080, 1920]]);
export const MAX_CANVAS_DIMENSION = 4096;
export const MAX_CANVAS_PIXELS = 8_388_608;

export function normalizeCanvasSize(width, height) {
  const clean = value => Math.max(1, Math.round(Number(value) || 0));
  return { width: clean(width), height: clean(height) };
}

export function validateCanvasSize(width, height) {
  const size = normalizeCanvasSize(width, height);
  if (size.width > MAX_CANVAS_DIMENSION || size.height > MAX_CANVAS_DIMENSION) throw new RangeError(`Canvas dimensions cannot exceed ${MAX_CANVAS_DIMENSION} pixels.`);
  if (size.width * size.height > MAX_CANVAS_PIXELS) throw new RangeError(`Canvas cannot exceed ${MAX_CANVAS_PIXELS.toLocaleString()} total pixels.`);
  return size;
}

export function canvasMetadata(width, height, background = "transparent") {
  return { version: 1, ...validateCanvasSize(width, height), background };
}

const escapeXml = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function canvasSceneToSvg(scene) {
  const { width, height } = validateCanvasSize(scene?.width, scene?.height);
  const body = (scene.layers || []).map(layer => {
    if (layer.type === "rect") return `<rect x="${Number(layer.x)||0}" y="${Number(layer.y)||0}" width="${Number(layer.width)||0}" height="${Number(layer.height)||0}" fill="${escapeXml(layer.fill||"none")}"/>`;
    if (layer.type === "text") return `<text x="${Number(layer.x)||0}" y="${Number(layer.y)||0}" font-size="${Number(layer.size)||16}" fill="${escapeXml(layer.fill||"#000")}">${escapeXml(layer.text)}</text>`;
    if (layer.type === "path") return `<path d="${escapeXml(layer.d)}" fill="${escapeXml(layer.fill||"none")}" stroke="${escapeXml(layer.stroke||"#000")}"/>`;
    if (layer.type === "image" && /^data:image\//.test(layer.href||"")) return `<image href="${escapeXml(layer.href)}" x="${Number(layer.x)||0}" y="${Number(layer.y)||0}" width="${Number(layer.width)||0}" height="${Number(layer.height)||0}"/>`;
    return "";
  }).join("");
  const background = scene.background && scene.background !== "transparent" ? `<rect width="100%" height="100%" fill="${escapeXml(scene.background)}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${background}${body}</svg>`;
}

export function canvasExportDescriptor(scene, format, options = {}) {
  const normalized = String(format).toLowerCase().replace("jpg", "jpeg");
  if (normalized === "svg") return { extension: "svg", mimeType: "image/svg+xml", text: canvasSceneToSvg(scene) };
  if (!["png", "jpeg", "webp"].includes(normalized)) throw new TypeError(`Unsupported Canvas export: ${format}`);
  return { extension: normalized === "jpeg" ? "jpg" : normalized, mimeType: `image/${normalized}`, quality: Math.max(0, Math.min(1, Number(options.quality) || .9)), flatten: true };
}

export function transparentRgba(width, height) {
  const size = validateCanvasSize(width, height);
  return new Uint8ClampedArray(size.width * size.height * 4);
}

export function createCanvasPayload(width, height, dataUrl, extras = {}) {
  const canvas = canvasMetadata(width, height);
  return { kind: "canvas", name: `Canvas ${canvas.width}×${canvas.height}`, displayName: `Transparent canvas · ${canvas.width} × ${canvas.height}`, dataUrl, canvas, ...extras };
}

export function serializeCanvasPayload(payload) {
  if (payload?.kind !== "canvas") throw new TypeError("Expected Canvas payload");
  validateCanvasSize(payload.canvas?.width, payload.canvas?.height);
  return JSON.stringify(payload);
}

export function deserializeCanvasPayload(serialized) {
  const payload = JSON.parse(serialized);
  if (payload?.kind !== "canvas") throw new TypeError("Expected Canvas payload");
  validateCanvasSize(payload.canvas?.width, payload.canvas?.height);
  return payload;
}

const button = typeof document !== "undefined" ? document.querySelector("#new-canvas") : null;
const status = typeof document !== "undefined" ? document.querySelector("#status") : null;
if (button) button.addEventListener("click", () => {
  const dialog = document.createElement("dialog");
  dialog.className = "utility-dialog new-canvas-dialog";
  dialog.innerHTML = `<form method="dialog"><h2>New Canvas</h2><p>Start with transparent pixels. Maximum ${MAX_CANVAS_PIXELS.toLocaleString()} pixels.</p><div class="canvas-presets"></div><label>Width <input name="width" type="number" min="1" max="${MAX_CANVAS_DIMENSION}" value="1080"></label><label>Height <input name="height" type="number" min="1" max="${MAX_CANVAS_DIMENSION}" value="1080"></label><div class="canvas-error" role="alert"></div><div class="utility-dialog-actions"><button value="cancel">Cancel</button><button value="create">Create Canvas</button></div></form>`;
  const presets = dialog.querySelector(".canvas-presets");
  for (const [width, height] of CANVAS_PRESETS) { const choice = document.createElement("button"); choice.type = "button"; choice.textContent = `${width} × ${height}`; choice.onclick = () => { dialog.querySelector('[name=width]').value = width; dialog.querySelector('[name=height]').value = height; }; presets.append(choice); }
  const viewport = document.createElement("button"); viewport.type = "button"; viewport.textContent = "Current view"; viewport.onclick = () => { dialog.querySelector('[name=width]').value = Math.min(MAX_CANVAS_DIMENSION, Math.round(innerWidth)); dialog.querySelector('[name=height]').value = Math.min(MAX_CANVAS_DIMENSION, Math.round(innerHeight)); }; presets.append(viewport);
  dialog.querySelector("form").addEventListener("submit", event => { try { validateCanvasSize(dialog.querySelector('[name=width]').value, dialog.querySelector('[name=height]').value); } catch (error) { event.preventDefault(); dialog.querySelector(".canvas-error").textContent = error.message; } });
  dialog.addEventListener("close", () => { if (dialog.returnValue === "create") { const { width, height } = validateCanvasSize(dialog.querySelector('[name=width]').value, dialog.querySelector('[name=height]').value); if (status) status.textContent = `Creating ${width} × ${height} canvas…`; window.dispatchEvent(new CustomEvent("framechute:add-canvas", { detail: { width, height } })); } dialog.remove(); });
  document.body.append(dialog); dialog.showModal();
});
if (typeof document !== "undefined") document.querySelector("#new-canvas-menu")?.addEventListener("click", () => button?.click());
