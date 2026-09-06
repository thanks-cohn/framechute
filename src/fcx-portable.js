import { fileFromHandle, resolveHandle, storeHandle } from "./file-access.js";
import { createZip, jsonEntry, readZip, validateManifest, validateState, FCX_FORMAT, FCX_VERSION } from "./fcx-format.mjs";
import { playConcurrently } from "./fcx-playback.mjs";

const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");
const exportButton = document.querySelector("#export-fcx");
const importButton = document.querySelector("#import-fcx");
const resumeButton = document.querySelector("#resume-fcx");
const choice = document.querySelector("#fcx-export-choice");
const LOCAL_MARKER = "__FLASHFRAME_LOCAL_DROP_V1__";
const MAX_ASSET_BYTES = 1500 * 1024 * 1024;
let resumeIds = new Set();

function setStatus(message) { status.textContent = message; }
function cleanName(value) {
  return String(value || "framechute").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "framechute";
}
function extension(name) { return String(name || "").match(/(\.[a-z0-9]{1,10})$/i)?.[1]?.toLowerCase() || ".bin"; }

function captureWorkspace() {
  const detail = { name: `FrameChute ${new Date().toLocaleString()}` };
  window.dispatchEvent(new CustomEvent("framechute:capture-workspace", { detail }));
  if (!detail.snapshot) throw new Error("The workspace serializer is unavailable.");
  return detail.snapshot;
}

function markerPayload(record) {
  if (record.type !== "text" || !record.state?.text?.startsWith(LOCAL_MARKER)) return null;
  try { return JSON.parse(record.state.text.slice(LOCAL_MARKER.length)); } catch { return null; }
}

function sourceReferences(state) {
  const references = [];
  for (const block of state.blocks) {
    if (block.source?.handleKey) references.push({ source: block.source, block });
    const payload = markerPayload(block);
    if (payload?.handleKey) references.push({ source: payload, block, payload });
  }
  return references;
}

async function filesFromHandle(handle) {
  if (handle?.kind !== "directory") {
    const file = await fileFromHandle(handle);
    return file ? [{ file, relativeName: file.name }] : [];
  }
  const files = [];
  for await (const [name, child] of handle.entries()) {
    if (child.kind !== "file") continue;
    files.push({ file: await child.getFile(), relativeName: name });
  }
  return files;
}

async function packageAssets(state, mode) {
  const entries = [];
  const table = {};
  const byHandle = new Map();
  let total = 0; let count = 0;
  for (const reference of sourceReferences(state)) {
    const key = reference.source.handleKey;
    if (!byHandle.has(key)) {
      const assetId = `asset-${String(++count).padStart(4, "0")}`;
      const descriptor = { id: assetId, kind: reference.source.kind || "file", originalName: reference.source.displayName || "Local file", embedded: false, files: [] };
      byHandle.set(key, descriptor); table[assetId] = descriptor;
      if (mode === "embedded") {
        const handle = await resolveHandle(key);
        if (handle) {
          descriptor.kind = handle.kind || descriptor.kind;
          for (const item of await filesFromHandle(handle)) {
            total += item.file.size;
            if (total > MAX_ASSET_BYTES) throw new Error("Local files exceed the 1.5 GB v1 export safety limit. Choose State Only or remove large media.");
            const path = `assets/${assetId}/${String(descriptor.files.length + 1).padStart(4, "0")}${extension(item.relativeName)}`;
            entries.push([path, item.file]);
            descriptor.files.push({ path, name: item.relativeName, mimeType: item.file.type || "application/octet-stream", size: item.file.size, lastModified: item.file.lastModified || null });
          }
          descriptor.embedded = descriptor.files.length > 0;
        }
      }
    }
    const descriptor = byHandle.get(key);
    reference.source.portableAssetId = descriptor.id;
    reference.source.missingWithoutOriginal = !descriptor.embedded;
    if (reference.payload) reference.block.state.text = LOCAL_MARKER + JSON.stringify(reference.payload);
  }
  // Generated media and dirty document runtimes are workspace-owned. They are
  // always embedded, including in State Only exports, because there is no real
  // OS handle that could be reconnected later.
  for (const block of state.blocks) {
    const blob=block.state?.embeddedBlob;
    if (!(blob instanceof Blob)) continue;
    total+=blob.size;if(total>MAX_ASSET_BYTES)throw new Error("Workspace-owned results exceed the 1.5 GB export safety limit.");
    const assetId=`result-${String(++count).padStart(4,"0")}`,path=`assets/${assetId}/0001${extension(block.name)}`;
    entries.push([path,blob]);table[assetId]={id:assetId,kind:"result",originalName:block.name,embedded:true,files:[{path,name:block.name,mimeType:blob.type||"application/octet-stream",size:blob.size}]};
    block.state.embeddedAssetId=assetId;delete block.state.embeddedBlob;
  }
  return { entries, table };
}

async function addBackground(state, mode, entries, table) {
  const image = state.appearance?.backgroundImage;
  if (!(image instanceof Blob)) return;
  state.appearance.backgroundImage = null;
  const id = "asset-background";
  const descriptor = { id, kind: "file", originalName: image.name || "background", embedded: mode === "embedded", files: [] };
  if (mode === "embedded") {
    const path = `assets/${id}/0001${extension(image.name)}`;
    entries.push([path, image]); descriptor.files.push({ path, name: image.name || "background", mimeType: image.type || "application/octet-stream", size: image.size });
  }
  table[id] = descriptor;
  state.appearance.backgroundImageAsset = { portableAssetId: id, name: descriptor.originalName, mimeType: image.type || "application/octet-stream" };
}

function chooseAssetMode() {
  return new Promise((resolve) => {
    choice.addEventListener("close", () => resolve(choice.returnValue), { once: true });
    choice.showModal();
  });
}

async function exportFcx() {
  const mode = await chooseAssetMode(); if (mode === "cancel" || !mode) return;
  exportButton.disabled = true;
  try {
    setStatus("Collecting workspace state and local assets…");
    const state = captureWorkspace();
    const { entries, table } = await packageAssets(state, mode);
    await addBackground(state, mode, entries, table);
    const manifest = { format: FCX_FORMAT, version: FCX_VERSION, createdAt: new Date().toISOString(), app: "FrameChute", assetMode: mode, assets: table };
    const json = (value) => new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    setStatus("Packaging portable .fcx workspace…");
    const blob = await createZip([["manifest.json", json(manifest)], ["state.json", json(state)], ...entries]);
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${cleanName(state.name)}-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}.fcx`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`Downloaded ${mode === "embedded" ? "portable workspace with files" : "state-only workspace"}.`);
  } catch (error) { console.error(error); setStatus(`Could not export .fcx: ${error.message}`); }
  finally { exportButton.disabled = false; }
}

function syntheticFileHandle(file) { return { kind: "file", name: file.name, __framechuteSyntheticFile: file }; }
function syntheticDirectoryHandle(name, files) {
  const handles = new Map(files.map((file) => [file.name, syntheticFileHandle(file)]));
  return { kind: "directory", name, __framechuteSyntheticDirectory: true, async *entries() { yield* handles.entries(); }, async getFileHandle(fileName) { const value = handles.get(fileName); if (!value) throw new DOMException("File not found", "NotFoundError"); return value; } };
}

async function materializeAssets(entries, manifest) {
  const handles = new Map();
  for (const descriptor of Object.values(manifest.assets || {})) {
    if (!descriptor?.id || !Array.isArray(descriptor.files) || !descriptor.embedded) continue;
    const files = [];
    for (const item of descriptor.files) {
      const blob = entries.get(item.path);
      if (!blob) throw new Error(`Embedded asset is missing: ${item.path}`);
      files.push(new File([blob], item.name, { type: item.mimeType, lastModified: item.lastModified || Date.now() }));
    }
    const key = `fcx:${crypto.randomUUID()}`;
    const handle = descriptor.kind === "directory" ? syntheticDirectoryHandle(descriptor.originalName, files) : syntheticFileHandle(files[0]);
    await storeHandle(key, handle); handles.set(descriptor.id, key);
  }
  return handles;
}

function restoreResultAssets(state, entries, manifest) {
  for(const block of state.blocks||[]){const id=block.state?.embeddedAssetId;if(!id)continue;const item=manifest.assets?.[id]?.files?.[0],blob=item&&entries.get(item.path);if(!blob)throw new Error(`Embedded result is missing: ${id}`);block.state.embeddedBlob=new Blob([blob],{type:item.mimeType||"application/octet-stream"});}
}

function rewriteSources(state, handles) {
  for (const reference of sourceReferences(state)) {
    const key = handles.get(reference.source.portableAssetId);
    if (key) { reference.source.handleKey = key; reference.source.missingWithoutOriginal = false; }
    // State-only snapshots retain the browser handle key as a best-effort hint.
    // It works in the originating profile and naturally becomes the existing
    // visible reconnect placeholder when opened elsewhere.
    if (reference.payload) reference.block.state.text = LOCAL_MARKER + JSON.stringify(reference.payload);
  }
}

function stagePlayback(state) {
  resumeIds = new Set();
  for (const block of state.blocks) {
    const payload = markerPayload(block);
    const mediaState = payload || block.state;
    if (mediaState?.paused === false) resumeIds.add(block.id);
    if (mediaState && "paused" in mediaState) mediaState.paused = true;
    if (payload) block.state.text = LOCAL_MARKER + JSON.stringify(payload);
  }
  resumeButton.hidden = resumeIds.size === 0;
}

async function importFcx(file) {
  importButton.disabled = true;
  try {
    setStatus("Opening and validating .fcx…");
    const entries = await readZip(file);
    const manifest = validateManifest(await jsonEntry(entries, "manifest.json"));
    const state = validateState(await jsonEntry(entries, "state.json"));
    restoreResultAssets(state,entries,manifest);
    const handles = await materializeAssets(entries, manifest);
    rewriteSources(state, handles); stagePlayback(state);
    if (state.appearance?.backgroundImageAsset?.portableAssetId) {
      const descriptor = manifest.assets?.[state.appearance.backgroundImageAsset.portableAssetId];
      const item = descriptor?.files?.[0]; const blob = item && entries.get(item.path);
      if (blob) state.appearance.backgroundImage = new File([blob], item.name, { type: item.mimeType });
    }
    setStatus("Restoring workspace and media positions…");
    const detail = { snapshot: state, promise: null };
    window.dispatchEvent(new CustomEvent("framechute:restore-workspace", { detail }));
    if (!detail.promise) throw new Error("The workspace restorer is unavailable.");
    await detail.promise;
    const missing = sourceReferences(state).filter(({ source }) => source.missingWithoutOriginal).length;
    setStatus(`Workspace opened${missing ? `; ${missing} local source${missing === 1 ? " needs" : "s need"} reconnecting` : ""}.${resumeIds.size ? " Select Resume Media to restart previously playing media." : ""}`);
  } catch (error) { console.error(error); setStatus(`Could not open .fcx: ${error.message}`); }
  finally { importButton.disabled = false; }
}

async function pickFcx() {
  try {
    const [handle] = await window.showOpenFilePicker({ multiple: false, types: [{ description: "FrameChute workspace", accept: { "application/zip": [".fcx"] } }] });
    await importFcx(await handle.getFile());
  } catch (error) { if (error?.name !== "AbortError") { console.error(error); setStatus(`Could not open .fcx: ${error.message}`); } }
}

window.addEventListener("framechute:open-snapshot-file", event => {
  const file = event.detail?.file;
  if (file) void importFcx(file);
});

exportButton.addEventListener("click", exportFcx);
importButton.addEventListener("click", pickFcx);
resumeButton.addEventListener("click", async () => {
  const media = [...workspace.querySelectorAll("video, audio")].filter((player) => resumeIds.has(player.closest(".block")?.dataset.blockId));
  // Invoke every play() before awaiting any result so linked media are not
  // deliberately staggered by asynchronous autoplay/decoder work.
  const results = await playConcurrently(media);
  const blocked = results.filter((result) => result.status === "rejected").length;
  if (!blocked) { resumeButton.hidden = true; resumeIds.clear(); setStatus("Workspace playback resumed."); }
  else setStatus(`${blocked} media item${blocked === 1 ? "" : "s"} could not resume; use its play control.`);
});

// Capture phase prevents the ordinary local-file drop router from also adding
// an .fcx as a generic file block.
window.addEventListener("drop", (event) => {
  const file = [...(event.dataTransfer?.files || [])].find((candidate) => candidate.name.toLowerCase().endsWith(".fcx"));
  if (!file) return;
  event.preventDefault(); event.stopImmediatePropagation(); void importFcx(file);
}, true);
