const workspace = document.querySelector("#workspace");

function blocksByLayer() {
  return [...workspace.querySelectorAll(".block")].sort((a, b) => {
    const az = Number.parseInt(a.style.zIndex, 10) || 0;
    const bz = Number.parseInt(b.style.zIndex, 10) || 0;
    return az - bz;
  });
}

function applyLayerOrder(blocks) {
  blocks.forEach((block, index) => {
    block.style.zIndex = String(index + 1);
  });
  workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
}

function bringToFront(block) {
  const ordered = blocksByLayer().filter((candidate) => candidate !== block);
  ordered.push(block);
  applyLayerOrder(ordered);
}

function sendToBack(block) {
  const ordered = blocksByLayer().filter((candidate) => candidate !== block);
  ordered.unshift(block);
  applyLayerOrder(ordered);
}

function closeBlock(block) {
  if (!block) return;
  const remove = block.querySelector(".remove-block");
  if (remove instanceof HTMLElement) {
    remove.click();
    return;
  }
  block.remove();
  workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
}

function makeMenusVisible() {
  window.dispatchEvent(new CustomEvent("flashframe:reveal-menus"));
}

window.addEventListener("framechute:grab-object", event => {
  const block = event.detail?.block;
  if (block) startMenuGrab(block, { clientX: block.getBoundingClientRect().left + 12, clientY: block.getBoundingClientRect().top + 12 });
});

const menu = document.createElement("div");
menu.className = "flashframe-layer-menu";
menu.hidden = true;
menu.setAttribute("role", "menu");
menu.innerHTML = `
  <button type="button" data-layer-action="front" role="menuitem">Bring to front</button>
  <button type="button" data-layer-action="back" role="menuitem">Send to back</button>
  <button type="button" data-layer-action="grab" role="menuitem" title="Move Object: choose Grab, then drag the object from its visible image or video">Grab / Move Object <span class="flashframe-layer-menu-shortcut">G</span></button>
  <button type="button" data-layer-action="open-file" role="menuitem">Open File…</button>
  <div class="flashframe-layer-menu-separator" role="separator"></div>
  <button type="button" data-layer-action="sync" role="menuitem">Sync with…</button>
  <button type="button" data-layer-action="independent" role="menuitem">Make independent</button>
  <div class="flashframe-layer-menu-separator" role="separator"></div>
  <button type="button" data-layer-action="show-toolbar" role="menuitem">Show top bar</button>
  <button type="button" data-layer-action="show-settings" role="menuitem">Show Settings</button>
  <button type="button" data-layer-action="show-media-player" role="menuitem">Show media player</button>
  <button type="button" data-layer-action="reveal-menus" role="menuitem">Make menus visible</button>
  <div class="flashframe-layer-menu-separator" role="separator"></div>
  <button type="button" data-layer-action="object-header" role="menuitem">Hide object header</button>
  <button type="button" data-layer-action="object-footer" role="menuitem">Hide object footer</button>
  <button type="button" data-layer-action="frameless" role="menuitem">Show image only</button>
  <div class="flashframe-layer-menu-separator frameless-separator" role="separator"></div>
  <button type="button" data-layer-action="timed-edit" role="menuitem">Create timed move</button>
  <button type="button" data-layer-action="timed-play" role="menuitem">Preview timed move</button>
  <button type="button" data-layer-action="timed-return" role="menuitem">Return to move start</button>
  <button type="button" data-layer-action="timed-clear" role="menuitem">Remove timed move</button>
  <button type="button" data-layer-action="layer-rule" role="menuitem">Layer timing…</button>
  <div class="flashframe-layer-menu-separator timed-motion-separator" role="separator"></div>
  <button type="button" data-layer-action="close" class="flashframe-layer-menu-close" role="menuitem">Close frame</button>
`;
document.body.append(menu);

const style = document.createElement("style");
style.textContent = `
  .flashframe-layer-menu {
    position: fixed;
    z-index: 2147483647;
    min-width: 178px;
    max-height: calc(100vh - 16px);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 6px;
    border: 1px solid rgba(255,255,255,.16);
    border-radius: 10px;
    background: rgba(20,22,24,.97);
    color: #fff;
    box-shadow: 0 14px 34px rgba(0,0,0,.38);
    backdrop-filter: blur(10px);
  }
  .flashframe-layer-menu[hidden] { display: none; }
  .flashframe-layer-menu button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    padding: 8px 10px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #fff;
    text-align: left;
    cursor: pointer;
    font: inherit;
  }
  .flashframe-layer-menu button:hover,
  .flashframe-layer-menu button:focus-visible {
    background: rgba(255,255,255,.10);
    outline: none;
  }
  .flashframe-layer-menu-shortcut {
    min-width: 18px;
    padding: 1px 5px;
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 5px;
    color: rgba(255,255,255,.7);
    font-size: 10px;
    font-weight: 800;
    text-align: center;
  }
  .flashframe-layer-menu .flashframe-layer-menu-close {
    color: #ffb1a2;
  }
  .flashframe-layer-menu-separator {
    height: 1px;
    margin: 5px 4px;
    background: rgba(255,255,255,.14);
  }
  .block.is-menu-grabbed {
    outline: 2px solid #f7cf4b;
    outline-offset: 2px;
    cursor: grabbing !important;
  }
  body.framechute-menu-grabbing,
  body.framechute-menu-grabbing * {
    cursor: grabbing !important;
  }
`;
document.head.append(style);

let targetBlock = null;
let lastContextPoint = { clientX: 0, clientY: 0 };
let menuGrab = null;

function hideMenu() {
  menu.hidden = true;
  targetBlock = null;
}

function number(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function finishMenuGrab({ cancel = false } = {}) {
  if (!menuGrab) return;
  const { block, startLeft, startTop } = menuGrab;
  if (cancel && block?.isConnected) {
    block.style.left = `${startLeft}px`;
    block.style.top = `${startTop}px`;
  }
  block?.classList.remove("is-menu-grabbed");
  document.body.classList.remove("framechute-menu-grabbing");
  menuGrab = null;
  if (block?.isConnected) {
    workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
    window.dispatchEvent(new CustomEvent("flashframe:rescue-reachability"));
  }
}

function startMenuGrab(block, point = lastContextPoint) {
  if (!(block instanceof HTMLElement)) return;
  if (menuGrab) finishMenuGrab({ cancel: false });
  bringToFront(block);
  const startLeft = number(block.style.left, block.offsetLeft);
  const startTop = number(block.style.top, block.offsetTop);
  menuGrab = {
    block,
    startLeft,
    startTop,
    pointerX: Number.isFinite(point?.clientX) ? point.clientX : 0,
    pointerY: Number.isFinite(point?.clientY) ? point.clientY : 0
  };
  block.classList.add("is-menu-grabbed");
  document.body.classList.add("framechute-menu-grabbing");
}

function showMenu(block, x, y) {
  window.dispatchEvent(new CustomEvent("framechute:close-context-menus", { detail: { except: menu } }));
  targetBlock = block;
  menu.hidden = false;
  const timed = Boolean(block) && (block.dataset.timedMedia === "true" || Boolean(block.querySelector("video, audio")));
  menu.querySelector('[data-layer-action="front"]').hidden = !block;
  menu.querySelector('[data-layer-action="back"]').hidden = !block;
  menu.querySelector('[data-layer-action="grab"]').hidden = !block;
  menu.querySelector('[data-layer-action="sync"]').hidden = !timed;
  menu.querySelector('[data-layer-action="independent"]').hidden = !timed;
  const isImage = block?.dataset.customKind === "image"
    || block?.dataset.customLocalKind === "image"
    || Boolean(block?.querySelector(":scope > .image-frame"));
  const isVideo = Boolean(block?.querySelector(":scope > video"))
    || block?.dataset.blockType === "video"
    || block?.dataset.customKind === "remote-video";
  const isVisualMedia = isImage || isVideo;
  const isGallery = block?.dataset.blockType === "gallery" || block?.classList.contains("gallery-block");
  const framelessButton = menu.querySelector('[data-layer-action="frameless"]');
  const objectHeaderButton = menu.querySelector('[data-layer-action="object-header"]');
  const objectFooterButton = menu.querySelector('[data-layer-action="object-footer"]');
  const frameless = Boolean(block?.classList.contains("is-frameless-media"));
  const headerHidden = Boolean(block?.classList.contains("hide-object-header"))
    || (frameless && !block?.classList.contains("show-object-header"));
  const footerHidden = Boolean(block?.classList.contains("hide-object-footer"))
    || (frameless && !block?.classList.contains("show-object-footer"));
  objectHeaderButton.hidden = !isVisualMedia;
  objectFooterButton.hidden = !(isVisualMedia || isGallery);
  objectHeaderButton.textContent = headerHidden
    ? (frameless ? "Show header" : "Restore object header")
    : "Hide object header";
  objectFooterButton.textContent = footerHidden
    ? (frameless ? "Show footer" : "Restore object footer")
    : "Hide object footer";
  framelessButton.hidden = !isVisualMedia;
  framelessButton.textContent = block.classList.contains("is-frameless-media")
    ? `Restore ${isVideo ? "video" : "image"} frame`
    : `Show ${isVideo ? "video" : "image"} only`;
  menu.querySelector(".frameless-separator").hidden = !isVisualMedia;
  const closeButton = menu.querySelector('[data-layer-action="close"]');
  const hasTimedMotion = Boolean(block?.dataset.timedMotion || block?.classList.contains("has-timed-motion"));
  const simple = window.frameChuteAdvancedMode !== true;
  menu.querySelector('[data-layer-action="timed-edit"]').hidden = !block || simple;
  menu.querySelector('[data-layer-action="timed-edit"]').textContent = hasTimedMotion ? "Edit timed move" : "Create timed move";
  menu.querySelector('[data-layer-action="timed-play"]').hidden = !hasTimedMotion || simple;
  menu.querySelector('[data-layer-action="timed-return"]').hidden = !hasTimedMotion || simple;
  menu.querySelector('[data-layer-action="timed-clear"]').hidden = !hasTimedMotion || simple;
  menu.querySelector('[data-layer-action="layer-rule"]').hidden = !block || simple;
  menu.querySelector(".timed-motion-separator").hidden = !block || simple;
  menu.querySelector('[data-layer-action="sync"]').hidden = !block || isImage || simple;
  menu.querySelector('[data-layer-action="independent"]').hidden = !block || isImage || simple;
  closeButton.hidden = !block;
  closeButton.textContent = isVisualMedia ? "Close object" : "Close frame";

  const margin = 8;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - rect.width - margin));
  const top = Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - rect.height - margin));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  menu.querySelector("button:not([hidden])")?.focus({ preventScroll: true });
}

// Existing blocks normally rise on pointerdown. Suppress that behavior for
// right-click so opening the layer menu does not silently change the stack.
workspace.addEventListener("pointerdown", (event) => {
  if (event.button !== 2) return;
  if (!event.target.closest(".block")) return;
  event.stopPropagation();
}, true);

workspace.addEventListener("contextmenu", (event) => {
  const block = event.target.closest(".block");
  event.preventDefault();
  event.stopPropagation();
  lastContextPoint = { clientX: event.clientX, clientY: event.clientY };
  showMenu(block, event.clientX, event.clientY);
});

menu.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-layer-action]");
  if (!button) return;

  if (button.dataset.layerAction === "grab") {
    const block = targetBlock;
    const point = { clientX: event.clientX, clientY: event.clientY };
    hideMenu();
    if (block) startMenuGrab(block, point);
    return;
  }
  if (button.dataset.layerAction === "reveal-menus") {
    makeMenusVisible();
    hideMenu();
    return;
  }
  if (button.dataset.layerAction === "show-toolbar") {
    window.dispatchEvent(new CustomEvent("flashframe:show-toolbar"));
    hideMenu();
    return;
  }
  if (button.dataset.layerAction === "open-file") {
    window.dispatchEvent(new CustomEvent("framechute:open-file"));
    hideMenu();
    return;
  }
  if (button.dataset.layerAction === "show-settings") {
    window.dispatchEvent(new CustomEvent("flashframe:show-settings"));
    hideMenu();
    return;
  }
  if (button.dataset.layerAction === "show-media-player") {
    window.dispatchEvent(new CustomEvent("flashframe:show-media-player"));
    hideMenu();
    return;
  }
  if (button.dataset.layerAction === "sync" || button.dataset.layerAction === "independent") {
    window.dispatchEvent(new CustomEvent("flashframe:media-link-request", {
      detail: { block: targetBlock, independent: button.dataset.layerAction === "independent" }
    }));
    hideMenu();
    return;
  }
  if (button.dataset.layerAction.startsWith("timed-")) {
    const block = targetBlock;
    const action = button.dataset.layerAction.slice("timed-".length);
    hideMenu();
    if (block) window.dispatchEvent(new CustomEvent(`flashframe:${action}-timed-motion`, { detail: { block } }));
    return;
  }
  if (button.dataset.layerAction === "layer-rule") {
    const block = targetBlock;
    hideMenu();
    if (block) window.dispatchEvent(new CustomEvent("flashframe:edit-layer-rule", { detail: { block } }));
    return;
  }
  if (button.dataset.layerAction === "close") {
    const block = targetBlock;
    hideMenu();
    closeBlock(block);
    return;
  }
  if (button.dataset.layerAction === "frameless") {
    const block = targetBlock;
    hideMenu();
    if (block) {
      window.dispatchEvent(new CustomEvent("flashframe:set-frameless", {
        detail: { block, frameless: !block.classList.contains("is-frameless-media") }
      }));
    }
    return;
  }
  if (button.dataset.layerAction === "object-header" || button.dataset.layerAction === "object-footer") {
    const block = targetBlock;
    const part = button.dataset.layerAction === "object-header" ? "header" : "footer";
    const hidden = block && (block.classList.contains(`hide-object-${part}`)
      || (block.classList.contains("is-frameless-media") && !block.classList.contains(`show-object-${part}`)));
    hideMenu();
    if (block) {
      window.dispatchEvent(new CustomEvent("flashframe:set-object-chrome", {
        detail: { block, part, hidden: !hidden }
      }));
    }
    return;
  }

  if (!targetBlock) return;
  if (button.dataset.layerAction === "front") bringToFront(targetBlock);
  if (button.dataset.layerAction === "back") sendToBack(targetBlock);
  hideMenu();
});

menu.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "g" && targetBlock) {
    event.preventDefault();
    const block = targetBlock;
    hideMenu();
    startMenuGrab(block, lastContextPoint);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    hideMenu();
  }
});

// No-hold move mode: after Grab object/G is selected, pointer movement moves
// the frame without requiring a mouse button. Click, Enter, or Space drops it;
// Escape cancels and restores the starting position.
document.addEventListener("pointermove", (event) => {
  if (!menuGrab?.block?.isConnected) return;
  const dx = event.clientX - menuGrab.pointerX;
  const dy = event.clientY - menuGrab.pointerY;
  menuGrab.block.style.left = `${menuGrab.startLeft + dx}px`;
  menuGrab.block.style.top = `${menuGrab.startTop + dy}px`;
}, true);

document.addEventListener("pointerdown", (event) => {
  if (!menuGrab || event.button !== 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  finishMenuGrab({ cancel: false });
}, true);

document.addEventListener("keydown", (event) => {
  if (!menuGrab) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    finishMenuGrab({ cancel: true });
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopImmediatePropagation();
    finishMenuGrab({ cancel: false });
  }
}, true);

document.addEventListener("pointerdown", (event) => {
  if (!menu.hidden && !menu.contains(event.target)) hideMenu();
}, true);

window.addEventListener("blur", () => {
  hideMenu();
  if (menuGrab) finishMenuGrab({ cancel: false });
});
window.addEventListener("resize", hideMenu);
window.addEventListener("scroll", (event) => {
  if (!menu.contains(event.target)) hideMenu();
}, true);
window.addEventListener("framechute:close-context-menus", (event) => {
  if (event.detail?.except !== menu) hideMenu();
});
