// Keep PDF toolbar menus owned by their PDF object.
//
// Older builds portalled these panels to document.body so they could escape the
// toolbar's clipping context. That made the menus visually detach from their
// PDF, become awkward to click, and remain behind when the object moved. PDF
// menus now live inside the block and are clamped to its visible bounds.

function closeOtherPdfMenus(except = null) {
  document.querySelectorAll(".pdf-toolbar details[open]").forEach(details => {
    if (details !== except) details.open = false;
  });
}

function positionAttached(panel, summary, block) {
  const blockRect = block.getBoundingClientRect();
  const summaryRect = summary.getBoundingClientRect();
  const margin = 8;
  const gap = 6;

  panel.style.left = "0px";
  panel.style.top = "0px";
  panel.style.maxHeight = "";
  panel.style.maxWidth = "";

  const panelRect = panel.getBoundingClientRect();
  const maxWidth = Math.max(120, blockRect.width - margin * 2);
  const maxHeight = Math.max(90, blockRect.height - margin * 2);

  panel.style.maxWidth = `${maxWidth}px`;
  panel.style.maxHeight = `${maxHeight}px`;

  const width = Math.min(panelRect.width || 220, maxWidth);
  const height = Math.min(panelRect.height || 160, maxHeight);
  const localLeft = summaryRect.left - blockRect.left;
  const below = summaryRect.bottom - blockRect.top + gap;
  const above = summaryRect.top - blockRect.top - height - gap;

  const left = Math.min(
    Math.max(margin, localLeft),
    Math.max(margin, blockRect.width - width - margin)
  );

  let top;
  if (below + height <= blockRect.height - margin) top = below;
  else if (above >= margin) top = above;
  else top = Math.max(margin, Math.min(below, blockRect.height - height - margin));

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function bind(details) {
  if (details.dataset.popdownPortalBound) return;
  details.dataset.popdownPortalBound = "true";

  const panel = details.querySelector(":scope > .pdf-popdown");
  const summary = details.querySelector(":scope > summary");
  const block = details.closest(".pdf-block");
  if (!panel || !summary || !block) return;

  details.addEventListener("toggle", () => {
    if (details.open) {
      closeOtherPdfMenus(details);
      panel.classList.remove("pdf-popdown-portal");
      panel.classList.add("pdf-popdown-attached");
      block.append(panel);
      requestAnimationFrame(() => positionAttached(panel, summary, block));
    } else {
      panel.classList.remove("pdf-popdown-attached");
      panel.removeAttribute("style");
      details.append(panel);
    }
  });

  // Secondary tools are discoverable without forcing another click. A short
  // hover dwell opens the same panel as a click; it remains open until the user
  // chooses something, opens another menu, or clicks away.
  let hoverTimer = 0;
  summary.addEventListener("pointerenter", event => {
    if (event.pointerType === "touch" || details.open) return;
    clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => { details.open = true; }, 260);
  });
  summary.addEventListener("pointerleave", () => {
    clearTimeout(hoverTimer);
    hoverTimer = 0;
  });

  block.querySelector(".pdf-toolbar")?.addEventListener("scroll", () => {
    if (details.open) details.open = false;
  }, { passive: true });
}

function bindAll(root = document) {
  root.querySelectorAll?.(".pdf-toolbar details").forEach(bind);
  if (root.matches?.(".pdf-toolbar details")) bind(root);
}

function makeToolbarMenu(className, label, controls = []) {
  const details = document.createElement("details");
  details.className = className;
  const summary = document.createElement("summary");
  summary.textContent = label;
  const panel = document.createElement("div");
  panel.className = "pdf-popdown";
  controls.filter(Boolean).forEach(control => panel.append(control));
  details.append(summary, panel);
  return details;
}

function enhancePdfToolbar(block) {
  const toolbar = block.querySelector(".pdf-toolbar");
  if (!toolbar || toolbar.dataset.pdfResponsiveToolbar === "true") return;
  toolbar.dataset.pdfResponsiveToolbar = "true";

  const original = [...toolbar.children];
  const primary = document.createElement("div");
  primary.className = "pdf-toolbar-row pdf-toolbar-row-primary";
  primary.setAttribute("role", "group");
  primary.setAttribute("aria-label", "PDF essentials");
  const secondary = document.createElement("div");
  secondary.className = "pdf-toolbar-row pdf-toolbar-row-secondary";
  secondary.setAttribute("role", "group");
  secondary.setAttribute("aria-label", "PDF tools");

  const saveAs = toolbar.querySelector(":scope > .document-save-as");
  const fileMenu = saveAs ? makeToolbarMenu("pdf-file-menu", "File", [saveAs]) : null;
  const pageLabel = toolbar.querySelector(".pdf-page")?.closest("label");
  const zoomLabel = toolbar.querySelector(".pdf-zoom")?.closest("label");
  const editControls = toolbar.querySelector(":scope > .pdf-edit-controls");
  const organize = toolbar.querySelector(":scope > .pdf-organize-menu");
  const more = toolbar.querySelector(":scope > .pdf-more-menu");

  const primaryNodes = [
    toolbar.querySelector(":scope > .document-save"),
    toolbar.querySelector(":scope > .pdf-prev"),
    pageLabel,
    toolbar.querySelector(":scope > .pdf-count"),
    toolbar.querySelector(":scope > .pdf-next"),
    toolbar.querySelector(":scope > .pdf-zoom-out"),
    zoomLabel,
    toolbar.querySelector(":scope > .pdf-zoom-in"),
    toolbar.querySelector(":scope > .pdf-fit"),
    toolbar.querySelector(":scope > .pdf-search-toggle"),
    toolbar.querySelector(":scope > .pdf-edit-mode")
  ].filter(Boolean);

  const moved = new Set(primaryNodes);
  primaryNodes.forEach(node => primary.append(node));

  if (editControls) { secondary.append(editControls); moved.add(editControls); }
  if (fileMenu) secondary.append(fileMenu);
  if (organize) { secondary.append(organize); moved.add(organize); }
  if (more) { secondary.append(more); moved.add(more); }
  if (saveAs) moved.add(saveAs);

  // Preserve future controls instead of silently dropping them. Any command not
  // explicitly classified as an essential lands on the tools row.
  original.forEach(node => {
    if (!moved.has(node) && node !== saveAs) secondary.append(node);
  });

  toolbar.replaceChildren(primary, secondary);
  bindAll(toolbar);
}

const GUIDE_DEFAULTS = Object.freeze({ left:0.075, right:0.075, top:0.06, bottom:0.06 });
const GUIDE_MIN = 0.02;
const GUIDE_MAX = 0.42;
const GUIDE_MIN_CONTENT = 0.12;

function clampGuide(value, opposite) {
  const number = Number(value);
  const upper = Math.min(GUIDE_MAX, 1 - Math.max(GUIDE_MIN, Number(opposite) || GUIDE_MIN) - GUIDE_MIN_CONTENT);
  return Math.max(GUIDE_MIN, Math.min(upper, Number.isFinite(number) ? number : GUIDE_MIN));
}

function readGuideState(block) {
  const read = (name, fallback) => {
    const value = Number(block.dataset[`pdfGuide${name}`]);
    return Number.isFinite(value) ? value : fallback;
  };
  let left = read("Left", GUIDE_DEFAULTS.left);
  let right = read("Right", GUIDE_DEFAULTS.right);
  let top = read("Top", GUIDE_DEFAULTS.top);
  let bottom = read("Bottom", GUIDE_DEFAULTS.bottom);
  left = clampGuide(left, right); right = clampGuide(right, left);
  top = clampGuide(top, bottom); bottom = clampGuide(bottom, top);
  return { left, right, top, bottom };
}

function writeGuideState(block, state) {
  for (const [name, value] of Object.entries(state)) {
    block.dataset[`pdfGuide${name[0].toUpperCase()}${name.slice(1)}`] = String(value);
  }
}

function guidePointLabel(block, overlay, side, ratio) {
  const zoom = Math.max(0.01, (Number(block.querySelector(".pdf-zoom")?.value) || 100) / 100);
  const horizontal = side === "left" || side === "right";
  const cssExtent = horizontal ? overlay.offsetWidth : overlay.offsetHeight;
  const points = Math.round(cssExtent * ratio / zoom);
  return `${side[0].toUpperCase()}${side.slice(1)} ${points} pt`;
}

function applyGuideState(block, overlay) {
  const state = readGuideState(block);
  const guides = Object.fromEntries([...overlay.querySelectorAll(".pdf-margin-guide")].map(node => [node.dataset.side, node]));
  if (guides.left) guides.left.style.left = `${state.left * 100}%`;
  if (guides.right) guides.right.style.right = `${state.right * 100}%`;
  if (guides.top) guides.top.style.top = `${state.top * 100}%`;
  if (guides.bottom) guides.bottom.style.bottom = `${state.bottom * 100}%`;
  for (const [side, guide] of Object.entries(guides)) {
    guide.dataset.label = guidePointLabel(block, overlay, side, state[side]);
    guide.setAttribute("aria-valuenow", String(Math.round(state[side] * 1000) / 10));
  }
}

function syncPdfGuides(block) {
  const surface = block.querySelector(".pdf-surface");
  const canvas = surface?.querySelector(".pdf-canvas");
  const overlay = surface?.querySelector(".pdf-page-guides");
  if (!surface || !canvas || !overlay) return;
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  if (width <= 0 || height <= 0) return;
  Object.assign(overlay.style, {
    left:`${canvas.offsetLeft}px`,
    top:`${canvas.offsetTop}px`,
    width:`${width}px`,
    height:`${height}px`
  });
  overlay.hidden = block.dataset.pdfGuidesHidden === "true";
  applyGuideState(block, overlay);
}

function updateGuideFromPointer(block, overlay, side, clientX, clientY) {
  const rect = overlay.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const state = readGuideState(block);
  if (side === "left") state.left = clampGuide((clientX - rect.left) / rect.width, state.right);
  else if (side === "right") state.right = clampGuide((rect.right - clientX) / rect.width, state.left);
  else if (side === "top") state.top = clampGuide((clientY - rect.top) / rect.height, state.bottom);
  else if (side === "bottom") state.bottom = clampGuide((rect.bottom - clientY) / rect.height, state.top);
  writeGuideState(block, state);
  applyGuideState(block, overlay);
}

function nudgeGuide(block, overlay, side, delta) {
  const state = readGuideState(block);
  const opposite = side === "left" ? state.right : side === "right" ? state.left : side === "top" ? state.bottom : state.top;
  state[side] = clampGuide(state[side] + delta, opposite);
  writeGuideState(block, state);
  applyGuideState(block, overlay);
}

function bindGuideDrag(block, overlay, guide) {
  if (guide.dataset.pdfGuideBound) return;
  guide.dataset.pdfGuideBound = "true";
  const side = guide.dataset.side;
  guide.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    guide.setPointerCapture?.(event.pointerId);
    guide.classList.add("is-dragging");
    updateGuideFromPointer(block, overlay, side, event.clientX, event.clientY);
    const move = next => updateGuideFromPointer(block, overlay, side, next.clientX, next.clientY);
    const done = next => {
      guide.classList.remove("is-dragging");
      guide.releasePointerCapture?.(next.pointerId);
      guide.removeEventListener("pointermove", move);
      guide.removeEventListener("pointerup", done);
      guide.removeEventListener("pointercancel", done);
    };
    guide.addEventListener("pointermove", move);
    guide.addEventListener("pointerup", done);
    guide.addEventListener("pointercancel", done);
  });
  guide.addEventListener("keydown", event => {
    const vertical = side === "left" || side === "right";
    const step = event.shiftKey ? 0.02 : 0.005;
    let delta = 0;
    if (vertical && event.key === "ArrowLeft") delta = side === "left" ? -step : step;
    if (vertical && event.key === "ArrowRight") delta = side === "left" ? step : -step;
    if (!vertical && event.key === "ArrowUp") delta = side === "top" ? -step : step;
    if (!vertical && event.key === "ArrowDown") delta = side === "top" ? step : -step;
    if (!delta) return;
    event.preventDefault();
    nudgeGuide(block, overlay, side, delta);
  });
}

function ensurePdfGuides(block) {
  const surface = block.querySelector(".pdf-surface");
  const canvas = surface?.querySelector(".pdf-canvas");
  if (!surface || !canvas) return;
  let overlay = surface.querySelector(".pdf-page-guides");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "pdf-page-guides";
    overlay.setAttribute("aria-label", "PDF page edge and movable content guides");
    overlay.innerHTML = `
      <div class="pdf-page-edge-warning">PAGE EDGE · content outside is clipped</div>
      <div class="pdf-margin-guide pdf-margin-guide-left" data-side="left" role="separator" tabindex="0" aria-label="Left content guide" aria-orientation="vertical"></div>
      <div class="pdf-margin-guide pdf-margin-guide-right" data-side="right" role="separator" tabindex="0" aria-label="Right content guide" aria-orientation="vertical"></div>
      <div class="pdf-margin-guide pdf-margin-guide-top" data-side="top" role="separator" tabindex="0" aria-label="Top content guide" aria-orientation="horizontal"></div>
      <div class="pdf-margin-guide pdf-margin-guide-bottom" data-side="bottom" role="separator" tabindex="0" aria-label="Bottom content guide" aria-orientation="horizontal"></div>`;
    surface.append(overlay);
    overlay.querySelectorAll(".pdf-margin-guide").forEach(guide => bindGuideDrag(block, overlay, guide));
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(() => syncPdfGuides(block));
      observer.observe(canvas);
      observer.observe(surface);
      overlay._pdfGuideResizeObserver = observer;
    }
  }
  requestAnimationFrame(() => syncPdfGuides(block));
}

function resetPdfGuides(block) {
  delete block.dataset.pdfGuideLeft;
  delete block.dataset.pdfGuideRight;
  delete block.dataset.pdfGuideTop;
  delete block.dataset.pdfGuideBottom;
  syncPdfGuides(block);
}

function enhancePdfChrome(root = document) {
  const blocks = [];
  if (root.matches?.(".pdf-block")) blocks.push(root);
  root.querySelectorAll?.(".pdf-block").forEach(block => blocks.push(block));
  for (const block of blocks) {
    enhancePdfToolbar(block);
    ensurePdfGuides(block);
  }
  bindAll(root);
}

enhancePdfChrome();
new MutationObserver(records => records.forEach(record => {
  record.addedNodes.forEach(node => {
    if (node.nodeType === 1) enhancePdfChrome(node);
  });
})).observe(document.body, { childList: true, subtree: true });

window.addEventListener("framechute:pdf-toggle-guides", event => {
  const block = event.detail?.block;
  if (!block?.matches?.(".pdf-block")) return;
  block.dataset.pdfGuidesHidden = block.dataset.pdfGuidesHidden === "true" ? "false" : "true";
  syncPdfGuides(block);
});
window.addEventListener("framechute:pdf-reset-guides", event => {
  const block = event.detail?.block;
  if (!block?.matches?.(".pdf-block")) return;
  block.dataset.pdfGuidesHidden = "false";
  resetPdfGuides(block);
});

// Moving/resizing a PDF starts a new spatial interaction. Transient document
// menus should never remain floating over the page while that happens.
document.addEventListener("pointerdown", event => {
  const movingBlock = event.target.closest?.(
    ".pdf-block > .block-header, .pdf-block > .compact-drag-handle, .pdf-block > .coarse-resize-handle"
  )?.closest?.(".pdf-block");
  if (movingBlock) {
    movingBlock.querySelectorAll(".pdf-toolbar details[open]").forEach(details => {
      details.open = false;
    });
    return;
  }

  const open = [...document.querySelectorAll(".pdf-toolbar details[open]")];
  for (const details of open) {
    const panel = details.closest(".pdf-block")?.querySelector(".pdf-popdown-attached");
    if (!details.contains(event.target) && !panel?.contains(event.target)) details.open = false;
  }
}, true);

window.addEventListener("resize", () => {
  closeOtherPdfMenus();
  document.querySelectorAll(".pdf-block").forEach(syncPdfGuides);
});

// The PDF canvas is the visual source of truth for untouched source text. The
// transparent text-layer spans exist for hit-testing/edit initiation only. A
// generic hover rule in workspace.css intentionally reveals normal source text,
// but that can also resurrect source glyphs which have already been occulted by
// a live erase mask (most visibly at terminal line fragments such as a trailing
// "if"). Keep raw source-span text transparent on hover while preserving the
// hover outline/background and leaving replacements, wrapped text, search hits,
// and active editing untouched.
const sourceHoverGuard = document.createElement("style");
sourceHoverGuard.dataset.pdfSourceHoverGuard = "true";
sourceHoverGuard.textContent = `
.pdf-block:not(.pdf-edit-mode-off)
  .pdf-text-item:not(.pdf-text-edit):not(.pdf-wrapped-source):not(.pdf-search-match):not(.is-editing):hover {
  color: transparent !important;
}
`;
document.head.append(sourceHoverGuard);

const pdfChromeStyle = document.createElement("style");
pdfChromeStyle.dataset.pdfResponsiveChrome = "true";
pdfChromeStyle.textContent = `
/* Two intentional toolbar bands: essential reading/editing controls stay in
   sight; secondary tools are grouped into compact hover/click popdowns. */
.pdf-toolbar[data-pdf-responsive-toolbar="true"] {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: stretch !important;
  gap: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  scrollbar-width: none;
}
.pdf-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  align-content: center;
  gap: 4px;
  row-gap: 4px;
  min-width: 0;
  padding: 5px 7px;
}
.pdf-toolbar-row-secondary {
  min-height: 38px;
  padding-top: 4px;
  padding-bottom: 5px;
  border-top: 1px solid color-mix(in srgb, CanvasText 9%, transparent);
  background: color-mix(in srgb, CanvasText 2.5%, Canvas);
}
.pdf-toolbar-row > * { flex: 0 0 auto; }
.pdf-toolbar[data-pdf-responsive-toolbar="true"] button,
.pdf-toolbar[data-pdf-responsive-toolbar="true"] select,
.pdf-toolbar[data-pdf-responsive-toolbar="true"] input,
.pdf-toolbar[data-pdf-responsive-toolbar="true"] summary {
  min-height: 29px;
  font-size: 12px;
}
.pdf-toolbar[data-pdf-responsive-toolbar="true"] button,
.pdf-toolbar[data-pdf-responsive-toolbar="true"] summary { padding-inline: 8px; }
.pdf-toolbar[data-pdf-responsive-toolbar="true"] label { gap: 3px; font-size: 11px; }
.pdf-toolbar[data-pdf-responsive-toolbar="true"] .pdf-page { width: 50px; }
.pdf-toolbar[data-pdf-responsive-toolbar="true"] .pdf-zoom { width: 52px; }
.pdf-toolbar[data-pdf-responsive-toolbar="true"] .pdf-fit { max-width: 96px; }
.pdf-toolbar[data-pdf-responsive-toolbar="true"] .pdf-zoom-out,
.pdf-toolbar[data-pdf-responsive-toolbar="true"] .pdf-zoom-in,
.pdf-toolbar[data-pdf-responsive-toolbar="true"] .pdf-organize-menu,
.pdf-toolbar[data-pdf-responsive-toolbar="true"] .pdf-more-menu,
.pdf-toolbar[data-pdf-responsive-toolbar="true"] .pdf-file-menu { display: block !important; }
.pdf-toolbar[data-pdf-responsive-toolbar="true"] .pdf-zoom-out,
.pdf-toolbar[data-pdf-responsive-toolbar="true"] .pdf-zoom-in { display: inline-flex !important; }
.pdf-toolbar[data-pdf-responsive-toolbar="true"] .pdf-popdown .document-save-as {
  display: block !important;
  width: 100%;
  text-align: left;
}
.pdf-toolbar-row-secondary .pdf-edit-controls:not([hidden]) {
  display: inline-flex !important;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding-left: 0;
  border-left: 0;
}
.pdf-toolbar-row-secondary .pdf-edit-controls[hidden] { display: none !important; }
@container (max-width: 480px) {
  .pdf-toolbar-row { padding-inline: 5px; gap: 3px; }
  .pdf-toolbar[data-pdf-responsive-toolbar="true"] button,
  .pdf-toolbar[data-pdf-responsive-toolbar="true"] summary { padding-inline: 6px; }
  .pdf-toolbar[data-pdf-responsive-toolbar="true"] .pdf-fit { max-width: 84px; }
}

/* Actual page edge + movable content guides. The solid outer rectangle mirrors
   the real canvas boundary; dashed inner lines are visual editing guides only. */
.pdf-page-guides {
  position: absolute;
  z-index: 6;
  box-sizing: border-box;
  border: 2px solid rgba(255, 188, 66, .9);
  outline: 1px solid rgba(0, 0, 0, .28);
  pointer-events: none;
  text-align: left;
}
.pdf-page-guides[hidden] { display: none !important; }
.pdf-page-edge-warning {
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  max-width: calc(100% - 20px);
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(67, 45, 8, .84);
  color: white;
  font: 700 9px/1.35 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: .025em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.pdf-margin-guide {
  position: absolute;
  z-index: 3;
  border: 0;
  margin: 0;
  padding: 0;
  background: transparent;
  opacity: .7;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
}
.pdf-margin-guide::before {
  content: "";
  position: absolute;
  inset: 0;
  border-color: rgba(32, 121, 221, .9);
  border-style: dashed;
}
.pdf-margin-guide-left,
.pdf-margin-guide-right {
  top: 0;
  bottom: 0;
  width: 9px;
  transform: translateX(-4.5px);
  cursor: ew-resize;
}
.pdf-margin-guide-left::before,
.pdf-margin-guide-right::before { left: 4px; width: 0; border-width: 0 0 0 1px; }
.pdf-margin-guide-top,
.pdf-margin-guide-bottom {
  left: 0;
  right: 0;
  height: 9px;
  transform: translateY(-4.5px);
  cursor: ns-resize;
}
.pdf-margin-guide-top::before,
.pdf-margin-guide-bottom::before { top: 4px; height: 0; border-width: 1px 0 0; }
.pdf-margin-guide:hover,
.pdf-margin-guide:focus-visible,
.pdf-margin-guide.is-dragging { opacity: 1; outline: none; }
.pdf-margin-guide::after {
  content: attr(data-label);
  position: absolute;
  display: none;
  padding: 3px 5px;
  border-radius: 5px;
  background: rgba(18, 24, 32, .9);
  color: white;
  font: 700 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: nowrap;
  pointer-events: none;
}
.pdf-margin-guide:hover::after,
.pdf-margin-guide:focus-visible::after,
.pdf-margin-guide.is-dragging::after { display: block; }
.pdf-margin-guide-left::after { left: 8px; top: 24px; }
.pdf-margin-guide-right::after { right: 8px; top: 24px; }
.pdf-margin-guide-top::after { left: 24px; top: 8px; }
.pdf-margin-guide-bottom::after { left: 24px; bottom: 8px; }
`;
document.head.append(pdfChromeStyle);
