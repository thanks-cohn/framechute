const DB_NAME = "flashframe";
const DB_VERSION = 1;
const LIVE_ID = "__flashframe_live__";

const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");
const supportedTypes = new Set(["pdf", "gallery", "video"]);

const sourceByBlockId = new Map();
const handleByKey = new Map();
const handleKeysByName = new Map();

let recentHandleWrite = null;
let pendingReconnectBlock = null;

function setStatus(message) {
  if (status) status.textContent = message;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStore(storeName) {
  let db;
  try {
    db = await openDatabase();
  } catch {
    return [];
  }

  if (!db.objectStoreNames.contains(storeName)) {
    db.close();
    return [];
  }

  return new Promise((resolve) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();

    request.onerror = () => resolve([]);
    request.onsuccess = () => resolve(request.result ?? []);
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => db.close();
    transaction.onerror = () => db.close();
  });
}

function sourceFromDataset(block) {
  const handleKey = block.dataset.sourceHandleKey;
  if (!handleKey) return null;

  return {
    handleKey,
    kind: block.dataset.sourceKind || (block.dataset.blockType === "gallery" ? "directory" : "file"),
    displayName: block.dataset.sourceDisplayName || block.querySelector(".block-name")?.value?.trim() || "Local source"
  };
}

function rememberSource(block, source) {
  if (!block || !source?.handleKey) return;

  const kind = source.kind || (block.dataset.blockType === "gallery" ? "directory" : "file");
  const displayName = source.displayName || handleByKey.get(source.handleKey)?.name || "Local source";

  block.dataset.sourceHandleKey = source.handleKey;
  block.dataset.sourceKind = kind;
  block.dataset.sourceDisplayName = displayName;

  let memory = block.querySelector(":scope > .local-source-memory");
  if (!memory) {
    memory = document.createElement("span");
    memory.className = "source-badge local-source-memory";
    memory.hidden = true;
    block.append(memory);
  }
  memory.textContent = displayName;

  sourceByBlockId.set(block.dataset.blockId, {
    handleKey: source.handleKey,
    kind,
    displayName
  });

  updateControls(block);
}

function sourceLabel(block, source) {
  const prefix = source.kind === "directory" || block.dataset.blockType === "gallery"
    ? "Local folder"
    : "Local file";
  return `${prefix}: ${source.displayName}`;
}

function ensureControls(block) {
  if (!supportedTypes.has(block.dataset.blockType)) return null;

  const toolbar = block.querySelector(".block-toolbar");
  if (!toolbar) return null;

  let controls = toolbar.querySelector(":scope > .local-source-controls");
  if (controls) return controls;

  controls = document.createElement("span");
  controls.className = "local-source-controls";

  const sourceButton = document.createElement("button");
  sourceButton.type = "button";
  sourceButton.className = "local-source-link";
  sourceButton.title = "Restore this remembered local source";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "local-source-copy";
  copyButton.textContent = "Copy";
  copyButton.title = "Copy remembered source name";

  controls.append(sourceButton, copyButton);
  toolbar.append(controls);

  sourceButton.addEventListener("click", () => {
    const reconnect = block.querySelector(".reconnect-source");
    if (!reconnect) return;

    pendingReconnectBlock = block;
    reconnect.click();
    setStatus(`Restoring ${block.dataset.sourceDisplayName || "local source"}…`);

    setTimeout(() => void refreshBlock(block), 500);
    setTimeout(() => void refreshBlock(block), 1400);
  });

  copyButton.addEventListener("click", async () => {
    const source = sourceFromDataset(block);
    if (!source) return;

    const text = source.displayName;
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied local source: ${text}`);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      setStatus(`Copied local source: ${text}`);
    }
  });

  return controls;
}

function updateControls(block) {
  const controls = ensureControls(block);
  if (!controls) return;

  const source = sourceFromDataset(block);
  controls.hidden = !source;
  if (!source) return;

  const sourceButton = controls.querySelector(".local-source-link");
  if (sourceButton) {
    if (block.dataset.blockType === "pdf") {
      // PDFs intentionally keep a compact fixed-width source control. Reconnect
      // refreshes must never replace this with "Local file: <long filename>",
      // which can force the PDF toolbar into an ugly extra row.
      sourceButton.textContent = "Reconnect";
      sourceButton.title = `Reconnect ${source.displayName}`;
      sourceButton.setAttribute("aria-label", "Reconnect PDF source");
    } else {
      sourceButton.textContent = sourceLabel(block, source);
      sourceButton.title = `Restore ${source.displayName}`;
    }
  }
}

function expectedKind(block) {
  return block.dataset.blockType === "gallery" ? "directory" : "file";
}

function sourceFromRecentHandle(block) {
  if (!recentHandleWrite) return null;
  if (Date.now() - recentHandleWrite.at > 5000) return null;
  if (recentHandleWrite.kind !== expectedKind(block)) return null;

  const blockName = block.querySelector(".block-name")?.value?.trim();
  if (blockName && recentHandleWrite.displayName && blockName !== recentHandleWrite.displayName) return null;

  return {
    handleKey: recentHandleWrite.handleKey,
    kind: recentHandleWrite.kind,
    displayName: recentHandleWrite.displayName
  };
}

function sourceFromRememberedName(block) {
  const name = block.querySelector(":scope > .local-source-memory")?.textContent?.trim()
    || block.querySelector(".block-name")?.value?.trim();
  if (!name) return null;

  const keys = handleKeysByName.get(name) ?? [];
  if (keys.length !== 1) return null;

  const handleKey = keys[0];
  const handle = handleByKey.get(handleKey);
  if (!handle || handle.kind !== expectedKind(block)) return null;

  return {
    handleKey,
    kind: handle.kind,
    displayName: handle.name || name
  };
}

async function refreshKnownSources() {
  const [snapshots, handles] = await Promise.all([
    readStore("snapshots"),
    readStore("handles")
  ]);

  sourceByBlockId.clear();
  handleByKey.clear();
  handleKeysByName.clear();

  for (const row of handles) {
    if (!row?.id || !row?.handle) continue;
    handleByKey.set(row.id, row.handle);

    const name = row.handle.name;
    if (!name) continue;
    const keys = handleKeysByName.get(name) ?? [];
    keys.push(row.id);
    handleKeysByName.set(name, keys);
  }

  snapshots.sort((a, b) => {
    if (a?.id === LIVE_ID && b?.id !== LIVE_ID) return -1;
    if (b?.id === LIVE_ID && a?.id !== LIVE_ID) return 1;
    return new Date(b?.createdAt ?? 0) - new Date(a?.createdAt ?? 0);
  });

  for (const snapshot of snapshots) {
    for (const record of snapshot?.blocks ?? []) {
      if (!record?.id || !record?.source?.handleKey || sourceByBlockId.has(record.id)) continue;
      sourceByBlockId.set(record.id, { ...record.source });
    }
  }
}

async function refreshBlock(block) {
  if (!(block instanceof HTMLElement) || !supportedTypes.has(block.dataset.blockType)) return;

  let source = sourceFromDataset(block);
  if (!source) source = sourceByBlockId.get(block.dataset.blockId) ?? null;
  if (!source) source = sourceFromRecentHandle(block);
  if (!source) source = sourceFromRememberedName(block);

  if (source) rememberSource(block, source);
  else updateControls(block);
}

async function refreshAllBlocks() {
  await refreshKnownSources();
  for (const block of workspace.querySelectorAll(".block")) {
    await refreshBlock(block);
  }
}

// Remember the exact handle written by Flashframe. This lets a newly-created
// block retain its source identity even if the user later renames the block.
const originalPut = IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put = function patchedPut(value, ...args) {
  if (this.name === "handles" && value?.id && value?.handle) {
    recentHandleWrite = {
      handleKey: value.id,
      kind: value.handle.kind,
      displayName: value.handle.name || "Local source",
      at: Date.now()
    };

    handleByKey.set(value.id, value.handle);
    const keys = handleKeysByName.get(value.handle.name) ?? [];
    if (!keys.includes(value.id)) keys.push(value.id);
    handleKeysByName.set(value.handle.name, keys);

    if (pendingReconnectBlock) {
      rememberSource(pendingReconnectBlock, {
        handleKey: value.id,
        kind: value.handle.kind,
        displayName: value.handle.name
      });
    }
  }

  return originalPut.call(this, value, ...args);
};

workspace.addEventListener("click", (event) => {
  const reconnect = event.target.closest(".reconnect-source");
  if (!reconnect) return;
  pendingReconnectBlock = reconnect.closest(".block");
  setTimeout(() => {
    pendingReconnectBlock = null;
  }, 5000);
}, true);

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.classList.contains("block")) void refreshBlock(node);
      for (const block of node.querySelectorAll?.(".block") ?? []) void refreshBlock(block);
    }
  }
});

observer.observe(workspace, { childList: true, subtree: true });
window.addEventListener("focus", () => void refreshAllBlocks());
window.addEventListener("flashframe:archive-imported", () => void refreshAllBlocks());

void refreshAllBlocks();
