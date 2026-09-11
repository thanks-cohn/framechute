import { connectArchiveDirectory, getArchiveStatus } from "./archive.js";

const SETTINGS_KEY = "flashframe.settings.v1";
const VIDEO_LOOP_OVERRIDES_KEY = "flashframe.video-loop-overrides.v1";
const TOOLBAR_BUTTON_KEY = "flashframe.toolbar-summon-position.v1";
const SETTINGS_DOCK_KEY = "flashframe.settings-dock.v2";
const VIDEO_DOCK_KEY = "flashframe.video-dock.v2";
const VIDEO_STEP_KEY = "flashframe.video-step-seconds.v1";

const defaults = {
  showBlockHeaders: true,
  showToolbar: true,
  loopVideosByDefault: false
};

const workspace = document.querySelector("#workspace");
const toolbarSummon = document.querySelector("#toolbar-summon");
const settingsDock = document.querySelector("#settings-dock");
const settingsDrag = document.querySelector("#settings-dock-grip");
const settingsExpand = document.querySelector("#settings-expand");
const settingsHide = document.querySelector("#settings-hide");
const settingsMini = document.querySelector("#settings-mini");
const videoDock = document.querySelector("#video-dock");
const videoDrag = document.querySelector("#video-dock-grip");
const videoExpand = document.querySelector("#video-expand");
const rewindButton = document.querySelector("#video-rewind-all");
const playButton = document.querySelector("#video-play-all");
const forwardButton = document.querySelector("#video-forward-all");
const stepInput = document.querySelector("#video-rewind-seconds");
const showBlockHeadersInput = document.querySelector("#setting-block-headers");
const showToolbarInput = document.querySelector("#setting-toolbar");
const loopVideosInput = document.querySelector("#setting-loop-videos");
const archiveStatus = document.querySelector("#archive-status");
const archiveConnect = document.querySelector("#archive-connect");

let settings = { ...defaults, ...readJson(SETTINGS_KEY, {}) };
let videoLoopOverrides = readJson(VIDEO_LOOP_OVERRIDES_KEY, {});
let toolbarTemporaryVisible = null;
let suppressToolbarClick = false;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not persist ${key}:`, error);
  }
}

function saveSettings() {
  writeJson(SETTINGS_KEY, settings);
}

function clampPosition(element, x, y) {
  const margin = 8;
  const width = element.offsetWidth || 48;
  const height = element.offsetHeight || 48;

  return {
    x: Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - width - margin)),
    y: Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - height - margin))
  };
}

function placeFloating(element, key, x, y, persist = false) {
  const point = clampPosition(element, x, y);
  element.style.right = "auto";
  element.style.left = `${point.x}px`;
  element.style.top = `${point.y}px`;

  if (persist) {
    const old = readJson(key, {});
    writeJson(key, { ...old, x: point.x, y: point.y });
  }
}

function initializeFloatingPosition(element, key) {
  const saved = readJson(key, {});
  requestAnimationFrame(() => {
    const rect = element.getBoundingClientRect();
    placeFloating(
      element,
      key,
      Number.isFinite(saved.x) ? saved.x : rect.left,
      Number.isFinite(saved.y) ? saved.y : rect.top
    );
  });
}

function attachDragOnly(element, handle, key) {
  if (!(element instanceof HTMLElement) || !(handle instanceof HTMLElement)) return;

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = element.getBoundingClientRect();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = rect.left;
    const startTop = rect.top;
    let active = true;

    element.classList.add("is-dragging");

    // Pointer capture is useful when Chromium supports it reliably, but floating
    // docks must not depend on it. Window-level tracking keeps Settings/Media
    // movable on machines where capture is lost or never starts.
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      // Window listeners below remain authoritative.
    }

    const move = (moveEvent) => {
      if (!active || moveEvent.pointerId !== pointerId) return;
      placeFloating(
        element,
        key,
        startLeft + moveEvent.clientX - startX,
        startTop + moveEvent.clientY - startY
      );
    };

    const finish = (finishEvent) => {
      if (!active) return;
      if (finishEvent?.pointerId != null && finishEvent.pointerId !== pointerId) return;
      active = false;

      element.classList.remove("is-dragging");
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", finish, true);
      window.removeEventListener("blur", finish, true);

      try {
        if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
      } catch {
        // The pointer may already have been released by Chromium.
      }

      const finalRect = element.getBoundingClientRect();
      placeFloating(element, key, finalRect.left, finalRect.top, true);
    };

    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", finish, true);
    window.addEventListener("blur", finish, true);
  });
}

function setDockCollapsed(dock, expandButton, key, collapsed) {
  dock.classList.toggle("is-collapsed", collapsed);
  expandButton.textContent = collapsed ? "□" : "−";
  expandButton.title = collapsed ? "Expand" : "Minimize";
  expandButton.setAttribute("aria-label", expandButton.title);

  const old = readJson(key, {});
  writeJson(key, { ...old, collapsed });

  requestAnimationFrame(() => {
    const rect = dock.getBoundingClientRect();
    placeFloating(dock, key, rect.left, rect.top, true);
  });
}

function setDockHidden(dock, key, hidden) {
  dock.classList.toggle("dock-hidden", hidden);
  const old = readJson(key, {});
  writeJson(key, { ...old, hidden });
}

function initializeDock(dock, expandButton, key) {
  const saved = readJson(key, {});
  const collapsed = saved.collapsed === true;
  dock.classList.toggle("dock-hidden", saved.hidden === true);
  dock.classList.toggle("is-collapsed", collapsed);
  expandButton.textContent = collapsed ? "□" : "−";
  expandButton.title = collapsed ? "Expand" : "Minimize";
  expandButton.setAttribute("aria-label", expandButton.title);
  initializeFloatingPosition(dock, key);

  expandButton.addEventListener("click", () => {
    setDockCollapsed(dock, expandButton, key, !dock.classList.contains("is-collapsed"));
  });
}

function effectiveToolbarVisible() {
  return toolbarTemporaryVisible ?? settings.showToolbar;
}

function applyToolbarVisibility() {
  document.body.classList.toggle("toolbar-hidden", !effectiveToolbarVisible());
}

function bringBlockForward(block) {
  let maxZ = 1;
  for (const candidate of workspace.querySelectorAll(".block")) {
    const z = Number.parseInt(candidate.style.zIndex, 10);
    if (Number.isFinite(z)) maxZ = Math.max(maxZ, z);
  }
  block.style.zIndex = String(maxZ + 1);
}

function attachCompactBlockDrag(block) {
  if (block.querySelector(".compact-drag-handle")) return;

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "compact-drag-handle";
  handle.innerHTML = `<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M9 24c-3-3-5-8-2-10 2-1 4 2 5 3V5c0-4 5-4 5 0v8-9c0-4 5-4 5 0v9-8c0-4 5-4 5 0v9-6c0-4 5-4 5 0v10c3-4 8-3 9 0-4 9-10 13-20 13-5 0-9-2-12-7Z"/><path d="M13 24c7 3 14 3 22 0"/></svg><span>Grab</span>`;
  handle.title = "Grab here to move block";
  handle.setAttribute("aria-label", "Grab here to move block");
  block.append(handle);

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    bringBlockForward(block);

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = Number.parseFloat(block.style.left) || block.offsetLeft;
    const startTop = Number.parseFloat(block.style.top) || block.offsetTop;

    handle.classList.add("is-dragging");
    handle.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      block.style.left = `${startLeft + moveEvent.clientX - startX}px`;
      block.style.top = `${startTop + moveEvent.clientY - startY}px`;
    };

    const finish = () => {
      handle.classList.remove("is-dragging");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  });
}

function attachResizeHandle(block) {
  if (block.querySelector(":scope > .coarse-resize-handle")) return;
  const handle = document.createElement("div");
  handle.className = "coarse-resize-handle";
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-label", "Resize block");
  block.append(handle);
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || block.classList.contains("is-maximized")) return;
    event.preventDefault();
    event.stopPropagation();
    bringBlockForward(block);
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = block.getBoundingClientRect().width;
    const startHeight = block.getBoundingClientRect().height;
    let resized = false;
    const minimum = getComputedStyle(block);
    const minWidth = Number.parseFloat(minimum.minWidth) || 280;
    const minHeight = Number.parseFloat(minimum.minHeight) || 190;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("is-resizing");
    const move = (moveEvent) => {
      resized = true;
      block.style.width = `${Math.max(minWidth, startWidth + moveEvent.clientX - startX)}px`;
      block.style.height = `${Math.max(minHeight, startHeight + moveEvent.clientY - startY)}px`;
    };
    const finish = () => {
      const image = block.querySelector(".image-frame, .gallery-image");
      if (resized && image) {
        block.dataset.userResizedContentWidth = String(Math.max(1, Math.round(image.clientWidth)));
        block.dataset.userResizedContentHeight = String(Math.max(1, Math.round(image.clientHeight)));
      }
      handle.classList.remove("is-resizing");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  });
}

function effectiveLoop(block) {
  const id = block.dataset.blockId;
  if (id && Object.prototype.hasOwnProperty.call(videoLoopOverrides, id)) {
    return Boolean(videoLoopOverrides[id]);
  }
  return Boolean(settings.loopVideosByDefault);
}

function prepareVideoBlock(block) {
  const player = block.querySelector(".video-player");
  const checkbox = block.querySelector(".video-loop");
  if (!player || !checkbox) return;

  const loop = effectiveLoop(block);
  player.loop = loop;
  checkbox.checked = loop;

  if (checkbox.dataset.flashframeBound === "true") return;
  checkbox.dataset.flashframeBound = "true";

  checkbox.addEventListener("change", () => {
    const id = block.dataset.blockId;
    if (!id) return;
    videoLoopOverrides[id] = checkbox.checked;
    player.loop = checkbox.checked;
    writeJson(VIDEO_LOOP_OVERRIDES_KEY, videoLoopOverrides);
  });

  checkbox.closest(".video-loop-control")?.addEventListener("dblclick", (event) => {
    event.preventDefault();
    const id = block.dataset.blockId;
    if (!id) return;
    delete videoLoopOverrides[id];
    writeJson(VIDEO_LOOP_OVERRIDES_KEY, videoLoopOverrides);
    prepareVideoBlock(block);
  });
}

function prepareBlock(block) {
  if (!(block instanceof HTMLElement) || !block.classList.contains("block")) return;
  attachCompactBlockDrag(block);
  attachResizeHandle(block);
  if (block.dataset.blockType === "video") prepareVideoBlock(block);
}

function applySettings() {
  showBlockHeadersInput.checked = Boolean(settings.showBlockHeaders);
  showToolbarInput.checked = Boolean(settings.showToolbar);
  loopVideosInput.checked = Boolean(settings.loopVideosByDefault);
  document.body.classList.toggle("hide-block-headers", !settings.showBlockHeaders);
  applyToolbarVisibility();
  for (const block of workspace.querySelectorAll(".block")) prepareBlock(block);
}

function players() {
  const scope = document.querySelector("#media-scope")?.value || "all";
  return [...workspace.querySelectorAll(".video-player, .audio-player")]
    .filter((player) => {
      const group = player.closest(".block")?.dataset.syncGroup || "all";
      return group !== "independent" && (scope === "all" || group === scope);
    });
}

function anyPlaying() {
  return players().some((player) => !player.paused && !player.ended);
}

function updatePlayButton() {
  const playing = anyPlaying();
  playButton.textContent = playing ? "❚❚" : "▶";
  playButton.title = playing ? "Pause timed media" : "Play timed media";
  playButton.setAttribute("aria-label", playButton.title);
}

async function toggleAllPlayback() {
  const all = players();
  if (!all.length) return;

  if (anyPlaying()) {
    for (const player of all) player.pause();
  } else {
    for (const player of all) {
      if (!player.src) continue;
      try {
        await player.play();
      } catch {
        // One unavailable source should not stop the rest.
      }
    }
  }

  updatePlayButton();
}

function videoStepSeconds() {
  const parsed = Number.parseFloat(stepInput.value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(3600, Math.max(0.1, parsed));
}

function updateStepSetting() {
  const seconds = videoStepSeconds();
  stepInput.value = String(seconds);
  writeJson(VIDEO_STEP_KEY, seconds);
  rewindButton.title = `Rewind timed media ${seconds} seconds`;
  forwardButton.title = `Forward timed media ${seconds} seconds`;
  rewindButton.setAttribute("aria-label", rewindButton.title);
  forwardButton.setAttribute("aria-label", forwardButton.title);
}

function stepAll(direction) {
  const delta = videoStepSeconds() * direction;

  for (const player of players()) {
    if (!Number.isFinite(player.currentTime)) continue;
    const upper = Number.isFinite(player.duration) ? player.duration : Number.POSITIVE_INFINITY;
    player.currentTime = Math.min(upper, Math.max(0, player.currentTime + delta));
  }
}

function bindStepButton(button, direction) {
  let holdDelay = null;
  let holdInterval = null;
  let suppressClick = false;

  const stop = () => {
    if (holdDelay != null) clearTimeout(holdDelay);
    if (holdInterval != null) clearInterval(holdInterval);
    holdDelay = null;
    holdInterval = null;
  };

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    suppressClick = true;
    stepAll(direction);
    button.setPointerCapture(event.pointerId);

    holdDelay = setTimeout(() => {
      holdInterval = setInterval(() => stepAll(direction), 160);
    }, 420);
  });

  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    button.addEventListener(eventName, () => {
      stop();
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    });
  }

  button.addEventListener("click", () => {
    if (suppressClick) return;
    stepAll(direction);
  });
}

async function refreshArchiveStatus() {
  const state = await getArchiveStatus();

  if (!state.configured) {
    archiveStatus.textContent = "Not connected. Create/select ~/flashframe once.";
    archiveConnect.textContent = "Choose ~/flashframe";
    return;
  }

  if (state.permission === "granted") {
    archiveStatus.textContent = `Connected: ${state.name} · live/ + sessions/`;
    archiveConnect.textContent = "Change folder";
    return;
  }

  archiveStatus.textContent = `${state.name} remembered. Chrome needs permission again.`;
  archiveConnect.textContent = "Reconnect folder";
}

showBlockHeadersInput.addEventListener("change", () => {
  settings.showBlockHeaders = showBlockHeadersInput.checked;
  saveSettings();
  applySettings();
});

showToolbarInput.addEventListener("change", () => {
  settings.showToolbar = showToolbarInput.checked;
  toolbarTemporaryVisible = null;
  saveSettings();
  applyToolbarVisibility();
});

loopVideosInput.addEventListener("change", () => {
  settings.loopVideosByDefault = loopVideosInput.checked;
  saveSettings();

  for (const block of workspace.querySelectorAll('.block[data-block-type="video"]')) {
    const id = block.dataset.blockId;
    if (id && !Object.prototype.hasOwnProperty.call(videoLoopOverrides, id)) {
      const player = block.querySelector(".video-player");
      const checkbox = block.querySelector(".video-loop");
      if (player) player.loop = settings.loopVideosByDefault;
      if (checkbox) checkbox.checked = settings.loopVideosByDefault;
    }
  }
});

settingsMini?.addEventListener("click", () => {
  setDockCollapsed(settingsDock, settingsExpand, SETTINGS_DOCK_KEY, !settingsDock.classList.contains("is-collapsed"));
});

playButton.addEventListener("click", () => void toggleAllPlayback());
bindStepButton(rewindButton, -1);
bindStepButton(forwardButton, 1);

stepInput.value = String(readJson(VIDEO_STEP_KEY, 10));
updateStepSetting();
stepInput.addEventListener("change", updateStepSetting);

archiveConnect.addEventListener("click", async () => {
  archiveConnect.disabled = true;
  archiveStatus.textContent = "Waiting for Chrome folder permission…";

  try {
    const previous = await getArchiveStatus();
    const handle = await connectArchiveDirectory({
      chooseNew: previous.configured && previous.permission === "granted"
    });
    archiveStatus.textContent = `Connected: ${handle.name} · live/ + sessions/`;
    window.dispatchEvent(new CustomEvent("flashframe:archive-ready"));
  } catch (error) {
    if (error?.name === "AbortError") {
      archiveStatus.textContent = "Folder choice cancelled.";
    } else if (error?.name === "SecurityError") {
      archiveStatus.textContent = "Chrome blocked that location. Select the ~/flashframe child folder itself.";
    } else {
      console.error(error);
      archiveStatus.textContent = "Could not connect that folder.";
    }
  } finally {
    archiveConnect.disabled = false;
    await refreshArchiveStatus();
  }
});

attachDragOnly(settingsDock, settingsDrag, SETTINGS_DOCK_KEY);
attachDragOnly(videoDock, videoDrag, VIDEO_DOCK_KEY);
initializeDock(settingsDock, settingsExpand, SETTINGS_DOCK_KEY);
initializeDock(videoDock, videoExpand, VIDEO_DOCK_KEY);
settingsHide?.addEventListener("click", () => setDockHidden(settingsDock, SETTINGS_DOCK_KEY, true));

initializeFloatingPosition(toolbarSummon, TOOLBAR_BUTTON_KEY);
toolbarSummon.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;

  const rect = toolbarSummon.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  let moved = false;

  toolbarSummon.setPointerCapture(event.pointerId);

  const move = (moveEvent) => {
    if (Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY) > 4) moved = true;
    placeFloating(
      toolbarSummon,
      TOOLBAR_BUTTON_KEY,
      rect.left + moveEvent.clientX - startX,
      rect.top + moveEvent.clientY - startY
    );
  };

  const finish = () => {
    toolbarSummon.removeEventListener("pointermove", move);
    toolbarSummon.removeEventListener("pointerup", finish);
    toolbarSummon.removeEventListener("pointercancel", finish);
    const finalRect = toolbarSummon.getBoundingClientRect();
    placeFloating(toolbarSummon, TOOLBAR_BUTTON_KEY, finalRect.left, finalRect.top, true);

    if (moved) {
      suppressToolbarClick = true;
      setTimeout(() => {
        suppressToolbarClick = false;
      }, 0);
    }
  };

  toolbarSummon.addEventListener("pointermove", move);
  toolbarSummon.addEventListener("pointerup", finish);
  toolbarSummon.addEventListener("pointercancel", finish);
});

toolbarSummon.addEventListener("click", () => {
  if (suppressToolbarClick) return;
  toolbarTemporaryVisible = !effectiveToolbarVisible();
  applyToolbarVisibility();
});

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.classList.contains("block")) prepareBlock(node);
      for (const block of node.querySelectorAll?.(".block") ?? []) prepareBlock(block);
    }
  }
  updatePlayButton();
});

observer.observe(workspace, { childList: true, subtree: true });
for (const eventName of ["play", "pause", "ended"]) {
  workspace.addEventListener(eventName, updatePlayButton, true);
}

window.addEventListener("resize", () => {
  for (const [element, key] of [
    [toolbarSummon, TOOLBAR_BUTTON_KEY],
    [settingsDock, SETTINGS_DOCK_KEY],
    [videoDock, VIDEO_DOCK_KEY]
  ]) {
    const rect = element.getBoundingClientRect();
    placeFloating(element, key, rect.left, rect.top, true);
  }
});

window.addEventListener("flashframe:show-toolbar", () => {
  toolbarTemporaryVisible = true;
  applyToolbarVisibility();
});

window.addEventListener("flashframe:show-settings", () => {
  setDockHidden(settingsDock, SETTINGS_DOCK_KEY, false);
  settingsDock.classList.remove("is-faded");
  setDockCollapsed(settingsDock, settingsExpand, SETTINGS_DOCK_KEY, false);
  settingsDock.animate([{ outline: "4px solid #ffd34e" }, { outline: "0 solid transparent" }], { duration: 900 });
});

applySettings();
updatePlayButton();
void refreshArchiveStatus();
