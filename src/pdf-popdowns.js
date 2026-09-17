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

  // Secondary commands stay discoverable without making the toolbar a single
  // endless row. Click still works normally; a short hover dwell opens desktop
  // popdowns while touch remains click-only.
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

  // Any future command that is not explicitly classified remains available on
  // the second row rather than being hidden or lost off the right edge.
  original.forEach(node => {
    if (!moved.has(node) && node !== saveAs) secondary.append(node);
  });

  toolbar.replaceChildren(primary, secondary);
  bindAll(toolbar);
}

function enhancePdfChrome(root = document) {
  const blocks = [];
  if (root.matches?.(".pdf-block")) blocks.push(root);
  root.querySelectorAll?.(".pdf-block").forEach(block => blocks.push(block));
  for (const block of blocks) enhancePdfToolbar(block);
  bindAll(root);
}

enhancePdfChrome();
new MutationObserver(records => records.forEach(record => {
  record.addedNodes.forEach(node => {
    if (node.nodeType === 1) enhancePdfChrome(node);
  });
})).observe(document.body, { childList: true, subtree: true });

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

window.addEventListener("resize", () => closeOtherPdfMenus());

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

// Cosmetic PDF chrome only. Do not place anything over the PDF surface and do
// not change page geometry, edit hit-testing, masks, reflow, or serialization.
const pdfChromeStyle = document.createElement("style");
pdfChromeStyle.dataset.pdfResponsiveChrome = "true";
pdfChromeStyle.textContent = `
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
`;
document.head.append(pdfChromeStyle);
