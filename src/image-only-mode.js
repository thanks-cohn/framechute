const workspace = document.querySelector("#workspace");
const menu = document.querySelector(".flashframe-layer-menu");
let contextBlock = null;

function visualMediaKind(block) {
  if (!(block instanceof HTMLElement)) return null;
  const isImage = block.dataset.customKind === "image"
    || block.dataset.customLocalKind === "image"
    || Boolean(block.querySelector(":scope > .image-frame"));
  if (isImage) return "image";

  const isVideo = block.dataset.blockType === "video"
    || block.dataset.customKind === "remote-video"
    || block.classList.contains("remote-video-block")
    || Boolean(block.querySelector(":scope > video, :scope > .video-player"));
  return isVideo ? "video" : null;
}

function refreshImageOnlyCommand() {
  if (!menu || menu.hidden) return;
  const button = menu.querySelector('[data-layer-action="frameless"]');
  const separator = menu.querySelector(".frameless-separator");
  if (!button) return;

  const kind = visualMediaKind(contextBlock);
  button.hidden = !kind;
  if (separator) separator.hidden = !kind;
  if (!kind) return;

  const frameless = contextBlock.classList.contains("is-frameless-media");
  button.textContent = frameless
    ? `Restore ${kind} frame`
    : `Show ${kind} only`;
  button.setAttribute("aria-pressed", String(frameless));
}

// Image-only is a core image/video interaction, not an Advanced-only feature.
// Record the physical right-click target before layer-menu.js builds its menu,
// then correct the command visibility in the same event turn before paint.
workspace?.addEventListener("contextmenu", (event) => {
  contextBlock = event.target.closest?.(".block") || null;
  queueMicrotask(refreshImageOnlyCommand);
}, true);

// Own this one command in capture phase so it cannot fail because a stale
// layer-menu target was cleared or because Advanced mode changed visibility.
menu?.addEventListener("click", (event) => {
  const button = event.target.closest?.('[data-layer-action="frameless"]');
  if (!button || button.hidden) return;
  const block = contextBlock;
  const kind = visualMediaKind(block);
  if (!block || !kind) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  const next = !block.classList.contains("is-frameless-media");
  window.dispatchEvent(new CustomEvent("flashframe:set-frameless", {
    detail: { block, frameless: next }
  }));
  menu.hidden = true;
  menu.querySelectorAll(".layer-submenu.is-open").forEach(node => node.classList.remove("is-open"));
  contextBlock = null;
}, true);

window.addEventListener("framechute:close-context-menus", (event) => {
  // layer-menu.js emits this *while opening itself* with { except: menu }.
  // Clearing here would erase the just-recorded right-click target before the
  // Image Only command is rendered, which is exactly the failure this module
  // is preventing.
  if (event.detail?.except === menu) return;
  contextBlock = null;
});
