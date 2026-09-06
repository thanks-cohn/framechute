import { floodFill, transformedDisplayToIntrinsic, serializePaintLayer, deserializePaintLayer } from "./paint-layer.mjs";

const layers = new WeakMap();
const HISTORY_LIMIT = 24;
const imageOf = (block) => block.querySelector(":scope > .image-frame, .image-frame, .gallery-image");

function rgba(hex) { const value = hex.replace("#", ""); return [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16)).concat(255); }
function snapshot(runtime) { runtime.history.push(runtime.context.getImageData(0, 0, runtime.canvas.width, runtime.canvas.height)); if (runtime.history.length > HISTORY_LIMIT) runtime.history.shift(); }
function sync(runtime) {
  const image = runtime.image, canvas = runtime.canvas;
  const scale=Math.min(image.offsetWidth/runtime.canvas.width,image.offsetHeight/runtime.canvas.height);
  const width=runtime.canvas.width*scale,height=runtime.canvas.height*scale,gapX=(image.offsetWidth-width)/2,gapY=(image.offsetHeight-height)/2;
  const imageStyle=getComputedStyle(image),[originX,originY]=imageStyle.transformOrigin.split(" ").map(Number.parseFloat);
  canvas.style.left = `${image.offsetLeft+gapX}px`; canvas.style.top = `${image.offsetTop+gapY}px`;
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
  canvas.style.transform = imageStyle.transform; canvas.style.transformOrigin = `${originX-gapX}px ${originY-gapY}px`;
}
function paintToolbar(runtime) {
  const toolbar = document.createElement("div"); toolbar.className = "paint-toolbar"; toolbar.setAttribute("role", "toolbar"); toolbar.setAttribute("aria-label", "Image paint tools");
  toolbar.innerHTML = '<button data-tool="brush" type="button">Brush</button><button data-tool="bucket" type="button">Bucket</button><button data-tool="erase" type="button">Erase</button><label title="Paint color">Color <input class="paint-color" type="color" value="#e53935" aria-label="Paint color"></label><label title="Brush thickness">Size <input class="paint-size" type="range" min="1" max="100" value="18" aria-label="Brush thickness"></label><button class="paint-undo" type="button">Undo</button><button class="paint-done" type="button">Done</button>';
  toolbar.querySelectorAll("[data-tool]").forEach((button) => button.onclick = () => { runtime.tool = button.dataset.tool; updateTools(runtime); });
  toolbar.querySelector(".paint-color").oninput = (event) => runtime.color = event.target.value;
  toolbar.querySelector(".paint-size").oninput = (event) => runtime.thickness = Number(event.target.value);
  toolbar.querySelector(".paint-undo").onclick = () => { const state = runtime.history.pop(); if (state) runtime.context.putImageData(state, 0, 0); };
  toolbar.querySelector(".paint-done").onclick = () => leavePaintMode(runtime.block);
  runtime.block.append(toolbar); runtime.toolbar = toolbar; updateTools(runtime);
}
function updateTools(runtime) { runtime.toolbar?.querySelectorAll("[data-tool]").forEach((button) => { const active = button.dataset.tool === runtime.tool; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); }); }
function compositePixels(runtime) {
  const scratch = document.createElement("canvas"); scratch.width = runtime.canvas.width; scratch.height = runtime.canvas.height;
  const context = scratch.getContext("2d", { willReadFrequently: true }); context.drawImage(runtime.image, 0, 0, scratch.width, scratch.height); context.drawImage(runtime.canvas, 0, 0);
  return context.getImageData(0, 0, scratch.width, scratch.height);
}
function point(runtime, event) {
  const canvasStyle = getComputedStyle(runtime.canvas), blockBounds = runtime.block.getBoundingClientRect();
  const [originX, originY] = canvasStyle.transformOrigin.split(" ").map(Number.parseFloat);
  const matrix = canvasStyle.transform === "none" ? new DOMMatrix() : new DOMMatrix(canvasStyle.transform);
  return transformedDisplayToIntrinsic(event.clientX, event.clientY, {
    left: blockBounds.left + runtime.canvas.offsetLeft, top: blockBounds.top + runtime.canvas.offsetTop,
    width: runtime.canvas.offsetWidth, height: runtime.canvas.offsetHeight
  }, matrix, { x: originX, y: originY }, runtime.canvas.width, runtime.canvas.height);
}
function stroke(runtime, from, to) {
  const ctx = runtime.context; ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = runtime.thickness; ctx.strokeStyle = runtime.color;
  ctx.globalCompositeOperation = runtime.tool === "erase" ? "destination-out" : "source-over";
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); ctx.restore();
}
function bindPointer(runtime) {
  const canvas = runtime.canvas;
  canvas.onpointerdown = (event) => {
    if (event.button !== 0) return; event.preventDefault(); snapshot(runtime);
    const at = point(runtime, event); if (!at) { runtime.history.pop(); return; }
    if (runtime.tool === "bucket") { const visible = compositePixels(runtime), overlay = runtime.context.getImageData(0, 0, canvas.width, canvas.height); floodFill({ visible: visible.data, overlay: overlay.data, width: canvas.width, height: canvas.height, x: at.x, y: at.y, color: rgba(runtime.color) }); runtime.context.putImageData(overlay, 0, 0); return; }
    canvas.setPointerCapture(event.pointerId); runtime.last = at; stroke(runtime, at, at);
  };
  canvas.onpointermove = (event) => { if (!canvas.hasPointerCapture(event.pointerId) || !runtime.last) return; const next = point(runtime, event); stroke(runtime, runtime.last, next); runtime.last = next; };
  const finish = (event) => { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); runtime.last = null; };
  canvas.onpointerup = finish; canvas.onpointercancel = finish;
}
async function makeRuntime(block, state = null) {
  const image = imageOf(block); if (!image) return null;
  if (!image.complete || !image.naturalWidth) await image.decode();
  const canvas = document.createElement("canvas"); canvas.className = "image-paint-layer"; canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const runtime = { block, image, canvas, context: canvas.getContext("2d", { willReadFrequently: true }), history: [], tool: "brush", color: "#e53935", thickness: 18, observer: null };
  block.append(canvas); runtime.observer = new ResizeObserver(() => sync(runtime)); runtime.observer.observe(image); sync(runtime); bindPointer(runtime); layers.set(block, runtime);
  block.addEventListener("framechute:release-resources", () => { runtime.observer.disconnect(); runtime.canvas.remove(); runtime.toolbar?.remove(); layers.delete(block); }, { once: true });
  if (state) await restoreCanvas(runtime, state);
  return runtime;
}
async function restoreCanvas(runtime, state) {
  const restored = deserializePaintLayer(state); if (!restored) return;
  if (restored.bytes) runtime.context.putImageData(new ImageData(restored.bytes, restored.width, restored.height), 0, 0);
  else { const image = new Image(); image.src = restored.overlay; await image.decode(); runtime.context.drawImage(image, 0, 0, runtime.canvas.width, runtime.canvas.height); }
}
export function isPaintEditing(block) { return Boolean(block?.classList.contains("is-paint-editing")); }
export async function enterPaintMode(block) { const runtime = layers.get(block) || await makeRuntime(block); if (!runtime) throw new Error("This image is not ready to edit"); runtime.canvas.classList.add("is-editing"); runtime.block.classList.add("is-paint-editing"); if (!runtime.toolbar) paintToolbar(runtime); window.dispatchEvent(new CustomEvent("framechute:image-edit-mode",{detail:{block,editing:true}})); return runtime; }
export function leavePaintMode(block) { const runtime = layers.get(block); if (!runtime) return; runtime.canvas.classList.remove("is-editing"); runtime.block.classList.remove("is-paint-editing"); runtime.toolbar?.remove(); runtime.toolbar = null; window.dispatchEvent(new CustomEvent("framechute:image-edit-mode",{detail:{block,editing:false}})); }
export function paintOverlayFor(block) { return layers.get(block)?.canvas || null; }
export function syncPaintOverlay(block) { const runtime = layers.get(block); if (runtime) sync(runtime); }

window.addEventListener("framechute:block-captured", (event) => {
  const { block, record } = event.detail, runtime = layers.get(block); if (!runtime) return;
  const overlay = runtime.canvas.toDataURL("image/png"), state = serializePaintLayer(new Uint8ClampedArray(), runtime.canvas.width, runtime.canvas.height, overlay);
  record.state.imagePaintLayer = state;
  if (typeof record.state.text === "string" && record.state.text.startsWith("__FLASHFRAME_CUSTOM_BLOCK_V1__")) { const marker = "__FLASHFRAME_CUSTOM_BLOCK_V1__", payload = JSON.parse(record.state.text.slice(marker.length)); payload.imagePaintLayer = state; record.state.text = marker + JSON.stringify(payload); }
});
window.addEventListener("framechute:block-restored", (event) => { const state = event.detail.record.state?.imagePaintLayer; if (state) void makeRuntime(event.detail.block, state); });
window.addEventListener("framechute:custom-block-ready", (event) => { const state = event.detail.payload?.imagePaintLayer; if (state) void makeRuntime(event.detail.block, state); });
window.addEventListener("keydown", (event) => { if (event.key !== "Escape" || (event.target instanceof Element && event.target.matches("input,textarea,[contenteditable=true]"))) return; document.querySelectorAll(".is-paint-editing").forEach(leavePaintMode); });
