const DB_NAME = "flashframe";
const DB_VERSION = 1;
const FILECHUTE_DRAG_TYPE = "application/x-filechute-item+json";
const FILECHUTE_PROTOCOL = "filechute-item";
const FILECHUTE_VERSION = 1;
const LOCAL_MARKER = "__FLASHFRAME_LOCAL_DROP_V1__";
const CUSTOM_MARKER = "__FLASHFRAME_CUSTOM_BLOCK_V1__";
const EXTENSION_GALLERY_MARKER = "__FRAMECHUTE_EXTENSION_GALLERY_V1__";

const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");
const reconnectAll = document.querySelector("#reconnect-all");

let pendingFileChuteSource = null;
let snapshotSources = new Map();
let refreshTimer = 0;

function setStatus(message) {
  if (status) status.textContent = message;
}

function cleanAddress(value) {
  const text = String(value || "").trim();
  if (/^https?:\/\//i.test(text)) return text;
  return text.replace(/^\/+/, "");
}

function baseName(value) {
  const parts = cleanAddress(value).split("/").filter(Boolean);
  return parts.at(-1) || cleanAddress(value);
}

function parseFileChutePayload(transfer) {
  try {
    const raw = transfer?.getData(FILECHUTE_DRAG_TYPE);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (payload?.protocol !== FILECHUTE_PROTOCOL || payload?.version !== FILECHUTE_VERSION) return null;
    return payload;
  } catch {
    return null;
  }
}

function stateStore(block) {
  return block?.querySelector(".custom-state-store, .text-editor") || null;
}

function markerRecord(block) {
  const store = stateStore(block);
  const value = String(store?.value || "");
  for (const marker of [LOCAL_MARKER, CUSTOM_MARKER, EXTENSION_GALLERY_MARKER]) {
    if (!value.startsWith(marker)) continue;
    try {
      return { marker, payload: JSON.parse(value.slice(marker.length)), store };
    } catch {
      return null;
    }
  }
  return null;
}

function writeMarkerRecord(record) {
  if (!record?.store || !record?.marker || !record?.payload) return;
  record.store.value = `${record.marker}${JSON.stringify(record.payload)}`;
  workspace?.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
}

function pendingMatches(block, payload) {
  const pending = pendingFileChuteSource;
  if (!pending || Date.now() - pending.at > 5000) return false;
  const currentName = String(
    payload?.displayName || payload?.name || block?.querySelector(".block-name")?.value || ""
  ).trim();
  if (!currentName || !pending.name) return true;
  return currentName === pending.name || baseName(pending.address) === currentName;
}

function persistAddressIntoMarker(block, record) {
  if (!record?.payload) return false;
  const payload = record.payload;
  let changed = false;

  if (record.marker === EXTENSION_GALLERY_MARKER) {
    const path = cleanAddress(payload.source?.path);
    if (path && payload.sourceAddress !== path) {
      payload.sourceAddress = path;
      payload.sourceProvider = payload.source?.providerName || "FileChute";
      payload.sourceProviderId = payload.source?.extensionId || null;
      changed = true;
    }
  } else if (pendingMatches(block, payload)) {
    const pending = pendingFileChuteSource;
    if (pending?.address && payload.sourceAddress !== pending.address) {
      payload.sourceAddress = pending.address;
      payload.sourceProvider = "FileChute";
      payload.sourceProviderId = pending.extensionId || null;
      payload.sourceKind = pending.kind || payload.kind || "file";
      changed = true;
    }
    pendingFileChuteSource = null;
  } else if (!payload.sourceAddress) {
    const fallback = cleanAddress(payload.url || payload.displayName || payload.name);
    if (fallback) {
      payload.sourceAddress = fallback;
      payload.sourceProvider = payload.url ? "Web" : "Local";
      changed = true;
    }
  } else if (payload.sourceProvider !== "FileChute" && !payload.url && payload.displayName) {
    const currentBase = baseName(payload.sourceAddress);
    if (currentBase && currentBase !== payload.displayName) {
      payload.sourceAddress = payload.displayName;
      changed = true;
    }
  }

  if (changed) writeMarkerRecord(record);
  return changed;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSnapshots() {
  let db;
  try {
    db = await openDatabase();
  } catch {
    return [];
  }
  if (!db.objectStoreNames.contains("snapshots")) {
    db.close();
    return [];
  }
  return new Promise((resolve) => {
    const transaction = db.transaction("snapshots", "readonly");
    const request = transaction.objectStore("snapshots").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => db.close();
    transaction.onerror = () => db.close();
  });
}

async function refreshSnapshotSources() {
  const snapshots = await readSnapshots();
  snapshots.sort((a, b) => {
    if (a?.id === "__flashframe_live__" && b?.id !== "__flashframe_live__") return -1;
    if (b?.id === "__flashframe_live__" && a?.id !== "__flashframe_live__") return 1;
    return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
  });

  const next = new Map();
  for (const snapshot of snapshots) {
    for (const block of snapshot?.blocks || []) {
      if (!block?.id || next.has(block.id) || !block?.source) continue;
      next.set(block.id, block.source);
    }
  }
  snapshotSources = next;
}

function descriptorFor(block) {
  if (!(block instanceof HTMLElement)) return null;

  const marker = markerRecord(block);
  if (marker) {
    persistAddressIntoMarker(block, marker);
    const payload = marker.payload;
    const address = cleanAddress(
      payload.sourceAddress ||
      payload.source?.path ||
      payload.url ||
      payload.displayName ||
      payload.name
    );
    if (!address) return null;
    return {
      address,
      provider: payload.sourceProvider || payload.source?.providerName || (payload.url ? "Web" : "Local"),
      url: payload.url || null
    };
  }

  const saved = snapshotSources.get(block.dataset.blockId) || null;
  const savedAddress = cleanAddress(saved?.address || saved?.relativePath || saved?.path || saved?.displayName);
  if (savedAddress) {
    block.dataset.framechuteSourceAddress = savedAddress;
    return { address: savedAddress, provider: saved?.providerName || "Local", url: null };
  }

  const remembered = cleanAddress(block.dataset.framechuteSourceAddress);
  if (remembered) return { address: remembered, provider: "Local", url: null };

  const reconnect = block.querySelector(".reconnect-source, .reconnect-custom-image");
  if (reconnect) {
    const name = cleanAddress(block.querySelector(".block-name")?.value);
    if (name) {
      block.dataset.framechuteSourceAddress = name;
      return { address: name, provider: "Local", url: null };
    }
  }

  const webFrame = block.querySelector(".web-frame");
  const webAddress = cleanAddress(webFrame?.src);
  if (webAddress) return { address: webAddress, provider: "Web", url: webAddress };
  return null;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function reconnectControl(block) {
  return block.querySelector(".reconnect-custom-image, .reconnect-source");
}

function reconnectToDescriptor(block, descriptor) {
  const control = reconnectControl(block);
  if (control) {
    control.click();
    setStatus(`Reconnecting ${descriptor.address}…`);
    return true;
  }

  if (descriptor.url) {
    const image = block.querySelector(".image-frame");
    const frame = block.querySelector(".web-frame");
    if (image) image.src = descriptor.url;
    else if (frame) frame.src = descriptor.url;
    else return false;
    setStatus(`Reloaded ${descriptor.address}.`);
    return true;
  }
  return false;
}

function ensureFooter(block, descriptor) {
  let footer = block.querySelector(":scope > .framechute-source-location");
  if (!descriptor) {
    footer?.remove();
    return;
  }

  if (!footer) {
    footer = document.createElement("div");
    footer.className = "framechute-source-location";

    const label = document.createElement("span");
    label.className = "framechute-source-location-label";
    label.textContent = "Location";

    const value = document.createElement("input");
    value.className = "framechute-source-location-value";
    value.type = "text";
    value.readOnly = true;
    value.setAttribute("aria-label", "Remembered source location");
    value.addEventListener("focus", () => value.select());
    value.addEventListener("click", () => value.select());

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "framechute-copy-location";
    copy.textContent = "Copy";
    copy.title = "Copy remembered source location";
    copy.addEventListener("click", async () => {
      const address = value.value;
      if (!address) return;
      await copyText(address);
      setStatus(`Copied location: ${address}`);
    });

    const reconnect = document.createElement("button");
    reconnect.type = "button";
    reconnect.className = "framechute-reconnect-location";
    reconnect.textContent = "Reconnect to location";
    reconnect.title = "Reconnect this block to its remembered source";
    reconnect.addEventListener("click", () => {
      const current = descriptorFor(block);
      if (!current || !reconnectToDescriptor(block, current)) {
        setStatus("This source has a remembered location, but Chromium has no reconnectable handle or URL for it.");
      }
    });

    footer.append(label, value, copy, reconnect);
    block.append(footer);
  }

  const value = footer.querySelector(".framechute-source-location-value");
  const label = footer.querySelector(".framechute-source-location-label");
  const reconnect = footer.querySelector(".framechute-reconnect-location");
  if (value && value.value !== descriptor.address) value.value = descriptor.address;
  if (value) value.title = descriptor.address;
  if (label) label.textContent = descriptor.provider ? `${descriptor.provider} location` : "Location";
  if (reconnect) reconnect.disabled = !reconnectControl(block) && !descriptor.url;
}

function decorateBlock(block) {
  if (!(block instanceof HTMLElement) || !block.classList.contains("block")) return;

  // PDFs already own a compact Reconnect/Copy source control in their toolbar.
  // Never decorate them with the generic source-location footer: reconnecting
  // returns focus to the window and used to recreate that footer as a third row.
  if (block.dataset.blockType === "pdf" || block.classList.contains("pdf-block")) {
    block.querySelector(":scope > .framechute-source-location")?.remove();
    return;
  }

  ensureFooter(block, descriptorFor(block));
}

function decorateAll() {
  for (const block of workspace?.querySelectorAll(".block") || []) decorateBlock(block);
}

function scheduleDecorate(block) {
  for (const delay of [0, 35, 120, 360, 900]) setTimeout(() => decorateBlock(block), delay);
}

function installStyle() {
  if (document.querySelector('style[data-framechute-source-locations="true"]')) return;
  const style = document.createElement("style");
  style.dataset.framechuteSourceLocations = "true";
  style.textContent = `
    .framechute-source-location {
      display: grid;
      grid-template-columns: auto minmax(80px, 1fr) auto auto;
      gap: 6px;
      align-items: center;
      min-width: 0;
      padding: 5px 7px;
      border-top: 1px solid rgba(127,127,127,.22);
      background: rgba(20,20,20,.88);
      font-size: 10px;
      line-height: 1;
    }
    .framechute-source-location-label {
      opacity: .68;
      white-space: nowrap;
    }
    .framechute-source-location-value {
      min-width: 0;
      width: 100%;
      height: 24px;
      padding: 2px 6px;
      border: 1px solid rgba(127,127,127,.25);
      border-radius: 6px;
      background: rgba(0,0,0,.18);
      color: inherit;
      font: 10px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      text-overflow: ellipsis;
    }
    .framechute-source-location button {
      min-height: 24px;
      padding: 3px 7px;
      white-space: nowrap;
      font-size: 10px;
    }
    @media (max-width: 560px) {
      .framechute-source-location {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .framechute-source-location-label { display: none; }
      .framechute-reconnect-location { grid-column: 1 / -1; }
    }
  `;
  document.head.append(style);
}

workspace?.addEventListener("drop", (event) => {
  const payload = parseFileChutePayload(event.dataTransfer);
  if (!payload) return;
  pendingFileChuteSource = {
    address: cleanAddress(payload.relativePath || payload.name || payload.originalName),
    name: String(payload.originalName || payload.name || "").trim(),
    kind: payload.kind || "file",
    extensionId: payload.sourceExtensionId || null,
    at: Date.now()
  };
}, { capture: true });

workspace?.addEventListener("flashframe:workspace-changed", () => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    void refreshSnapshotSources().finally(decorateAll);
  }, 80);
});

if (workspace) {
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.classList.contains("block")) scheduleDecorate(node);
        for (const block of node.querySelectorAll?.(".block") || []) scheduleDecorate(block);
      }
    }
  }).observe(workspace, { childList: true, subtree: false });
}

window.addEventListener("focus", () => void refreshSnapshotSources().finally(decorateAll));
window.addEventListener("flashframe:archive-imported", () => void refreshSnapshotSources().finally(decorateAll));

if (reconnectAll) {
  reconnectAll.textContent = "Reconnect all to locations";
  reconnectAll.title = "Reconnect every disconnected block to its remembered source location";
}

installStyle();
void refreshSnapshotSources().finally(decorateAll);
