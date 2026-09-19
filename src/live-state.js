import { getSnapshot, listSnapshots, saveSnapshot } from "./persistence.js";
import { writeLiveSnapshot } from "./archive.js";

const LIVE_ID = "__flashframe_live__";
const workspace = document.querySelector("#workspace");
const savedFrames = document.querySelector("#saved-frames");
const restoreButton = document.querySelector("#restore-frame");

let saveTimer = null;
let restoring = false;
let lastVideoWrite = 0;

function numberFromStyle(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function captureState(block) {
  const type = block.dataset.blockType;

  if (type === "text") {
    const editor = block.querySelector(".text-editor");
    return {
      text: editor?.value ?? "",
      scrollTop: editor?.scrollTop ?? 0,
      cursorOffset: editor?.selectionStart ?? 0
    };
  }

  if (type === "pdf") {
    const page = Number.parseInt(block.querySelector(".pdf-page")?.value ?? "1", 10);
    return { page: Number.isFinite(page) ? Math.max(1, page) : 1 };
  }

  if (type === "gallery") {
    const filename = block.querySelector(".gallery-filename")?.textContent?.trim() || null;
    const position = block.querySelector(".gallery-position")?.textContent ?? "";
    const match = position.match(/^(\d+)\s*\/\s*(\d+)$/);
    const currentIndex = match ? Math.max(0, Number.parseInt(match[1], 10) - 1) : 0;
    return {
      currentEntry: filename,
      currentIndex,
      footerVisibility: block.dataset.footerVisibility || "inherit"
    };
  }

  if (type === "video") {
    const player = block.querySelector(".video-player");
    return {
      currentTime: Number.isFinite(player?.currentTime) ? player.currentTime : 0,
      paused: player?.paused ?? true,
      volume: Number.isFinite(player?.volume) ? player.volume : 1,
      muted: Boolean(player?.muted),
      playbackRate: Number.isFinite(player?.playbackRate) ? player.playbackRate : 1,
      loop: Boolean(player?.loop),
      syncGroup: block.dataset.syncGroup || "all",
      frameless: block.dataset.frameless === "true",
      headerVisibility: block.dataset.headerVisibility || "inherit",
      footerVisibility: block.dataset.footerVisibility || "inherit"
    };
  }

  return {};
}

async function sourceMapFromNamedSnapshots() {
  const snapshots = await listSnapshots();
  const map = new Map();

  for (const snapshot of snapshots) {
    if (snapshot.id === LIVE_ID) continue;
    for (const record of snapshot.blocks ?? []) {
      if (!map.has(record.id) && record.source) map.set(record.id, record.source);
    }
  }

  return map;
}

async function storedHandlesByName() {
  return new Promise((resolve) => {
    const request = indexedDB.open("flashframe", 1);

    request.onerror = () => resolve(new Map());
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("handles")) {
        db.close();
        resolve(new Map());
        return;
      }

      const transaction = db.transaction("handles", "readonly");
      const getAll = transaction.objectStore("handles").getAll();

      getAll.onerror = () => resolve(new Map());
      getAll.onsuccess = () => {
        const map = new Map();
        for (const row of getAll.result ?? []) {
          const name = row?.handle?.name;
          if (name && !map.has(name)) map.set(name, row.id);
        }
        resolve(map);
      };

      transaction.oncomplete = () => db.close();
    };
  });
}

function inferredSource(block, sourceMap, handlesByName) {
  const exactHandleKey = block.dataset.sourceHandleKey;
  if (exactHandleKey) {
    return {
      kind: block.dataset.sourceKind || (block.dataset.blockType === "gallery" ? "directory" : "file"),
      handleKey: exactHandleKey,
      displayName: block.dataset.sourceDisplayName || block.querySelector(".block-name")?.value?.trim() || "Local source"
    };
  }

  const id = block.dataset.blockId;
  if (sourceMap.has(id)) return sourceMap.get(id);

  const type = block.dataset.blockType;
  const badgeName = block.querySelector(".source-badge")?.textContent?.trim();
  const blockName = block.querySelector(".block-name")?.value?.trim();
  const displayName = badgeName || blockName;
  const handleKey = displayName ? handlesByName.get(displayName) : null;

  if (!handleKey || type === "text" && !badgeName) return null;

  return {
    kind: type === "gallery" ? "directory" : "file",
    handleKey,
    displayName
  };
}

async function captureLiveSnapshot() {
  const checkpoint = {};
  window.dispatchEvent(new CustomEvent("framechute:checkpoint-documents", { detail: checkpoint }));
  await checkpoint.promise;
  const [sourceMap, handlesByName] = await Promise.all([
    sourceMapFromNamedSnapshots(),
    storedHandlesByName()
  ]);

  const detail = {};
  window.dispatchEvent(new CustomEvent("flashframe:capture-appearance", { detail }));
  return {
    schemaVersion: 2,
    id: LIVE_ID,
    name: "Current workspace",
    createdAt: new Date().toISOString(),
    appearance: detail.appearance ?? null,
    blocks: [...workspace.querySelectorAll(".block")].map((block) => {
      // Use the canonical type registry so live autosave retains the same PDF
      // edit state and complete DOCX block model as a named workspace.
      const captured = window.FrameChuteWorkspace?.captureBlock?.(block);
      if (captured) return { ...captured, source: captured.source || inferredSource(block, sourceMap, handlesByName) };
      return {
        id: block.dataset.blockId,
        type: block.dataset.blockType,
        name: block.querySelector(".block-name")?.value?.trim() || "Untitled",
        geometry: readGeometry(block),
        source: inferredSource(block, sourceMap, handlesByName),
        state: captureState(block),
        timedMotion: block.dataset.timedMotion ? JSON.parse(block.dataset.timedMotion) : null,
        layerRule: block.dataset.layerRuleData ? JSON.parse(block.dataset.layerRuleData) : null
      };
    })
  };
}

async function saveLiveNow() {
  if (restoring) return;

  try {
    const snapshot = await captureLiveSnapshot();
    await saveSnapshot(snapshot);
    await writeLiveSnapshot(snapshot);
    hideLiveOption();
  } catch (error) {
    console.warn("Could not autosave current Flashframe workspace:", error);
    const status = document.querySelector("#status");
    if (status) status.textContent = "Working-copy checkpoint failed. Keep this tab open and use Save As; this document may not recover after restart.";
  }
}

function scheduleLiveSave(delay = 650) {
  if (restoring) return;
  if (saveTimer != null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveLiveNow();
  }, delay);
}

function hideLiveOption() {
  const option = savedFrames.querySelector(`option[value="${LIVE_ID}"]`);
  if (option) option.remove();
}

async function restoreLiveIfPresent() {
  const snapshot = await getSnapshot(LIVE_ID);
  if (!snapshot?.blocks?.length) {
    hideLiveOption();
    return false;
  }

  let option = savedFrames.querySelector(`option[value="${LIVE_ID}"]`);
  if (!option) {
    option = document.createElement("option");
    option.value = LIVE_ID;
    option.textContent = "Current workspace";
    savedFrames.append(option);
  }

  restoring = true;
  savedFrames.value = LIVE_ID;
  restoreButton.click();

  setTimeout(() => {
    restoring = false;
    hideLiveOption();
  }, 600);

  return true;
}

workspace.addEventListener("input", () => scheduleLiveSave());
workspace.addEventListener("change", () => scheduleLiveSave());
workspace.addEventListener("flashframe:workspace-changed", () => scheduleLiveSave(200));
workspace.addEventListener("pointerup", () => scheduleLiveSave(250));

for (const eventName of ["play", "pause", "ended", "seeked", "volumechange", "ratechange"]) {
  workspace.addEventListener(eventName, () => scheduleLiveSave(250), true);
}

workspace.addEventListener("timeupdate", () => {
  const now = Date.now();
  if (now - lastVideoWrite < 2000) return;
  lastVideoWrite = now;
  scheduleLiveSave(400);
}, true);

const resizeObserver = new ResizeObserver(() => scheduleLiveSave(350));
const blockObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.classList.contains("block")) resizeObserver.observe(node);
      for (const block of node.querySelectorAll?.(".block") ?? []) resizeObserver.observe(block);
    }
  }
  scheduleLiveSave(500);
});

blockObserver.observe(workspace, { childList: true, subtree: false });
for (const block of workspace.querySelectorAll(".block")) resizeObserver.observe(block);

window.addEventListener("pagehide", () => {
  void saveLiveNow();
});

window.addEventListener("flashframe:archive-imported", () => {
  setTimeout(() => void restoreLiveIfPresent(), 100);
});

setTimeout(async () => {
  const restored = await restoreLiveIfPresent();
  if (!restored) scheduleLiveSave(800);
}, 150);
