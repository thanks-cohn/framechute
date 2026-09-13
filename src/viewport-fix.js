const workspace = document.querySelector("#workspace");
const VIEWPORT_MARGIN = 8;

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function isViewportFixed(block) {
  return block instanceof HTMLElement
    && (block.dataset.viewportFixed === "true" || block.classList.contains("is-viewport-fixed"));
}

function footerControls(block) {
  return block?.querySelectorAll?.(":scope > .source-toolbar, :scope > .gallery-toolbar, :scope > .web-toolbar") || [];
}

function forceFooterVisible(block) {
  if (!(block instanceof HTMLElement)) return;

  const footers = [...footerControls(block)];

  // DOCX/PDF formatting bars are editing toolbars, not object footers.
  // Never apply generic show-object-footer chrome to document frames because
  // its late CSS uses display:flex!important and defeats DOCX auto-hide.
  const isDocumentFrame = block.matches(".docx-block, .pdf-block, .document-block");
  if (isDocumentFrame) {
    block.classList.remove("show-object-footer");
    delete block.dataset.footerVisibility;
    return;
  }

  if (!footers.length) return;

  block.classList.remove("hide-object-footer", "is-object-chrome-faded");
  block.classList.add("show-object-footer");
  block.dataset.footerVisibility = "show";

  window.dispatchEvent(new CustomEvent("flashframe:set-object-chrome", {
    detail: { block, part: "footer", hidden: false }
  }));

  for (const footer of footers) {
    footer.hidden = false;
    footer.style.removeProperty("display");
    footer.style.removeProperty("opacity");
    footer.style.removeProperty("pointer-events");
  }
}

export function clampViewportFixedBlock(block, { resizeToFit = false } = {}) {
  if (!isViewportFixed(block)) return;
  let rect = block.getBoundingClientRect();

  const maxWidth = Math.max(120, window.innerWidth - VIEWPORT_MARGIN * 2);
  const maxHeight = Math.max(120, window.innerHeight - VIEWPORT_MARGIN * 2);

  if (resizeToFit && (rect.width > maxWidth || rect.height > maxHeight)) {
    if (rect.width > maxWidth) block.style.width = `${maxWidth}px`;
    if (rect.height > maxHeight) block.style.height = `${maxHeight}px`;
    rect = block.getBoundingClientRect();
  }

  const left = clamp(rect.left, VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN);
  const top = clamp(rect.top, VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN);

  block.style.left = `${left}px`;
  block.style.top = `${top}px`;
}

function restoreFromMaximize(block) {
  if (!block.classList.contains("is-maximized")) return;
  block.querySelector(":scope > .block-header .maximize-block")?.click();
}

export function setViewportFixed(block, fixed, { rect = null, notify = true } = {}) {
  if (!(block instanceof HTMLElement) || !workspace?.contains(block)) return false;
  const enabled = Boolean(fixed);

  if (enabled) {
    restoreFromMaximize(block);
    forceFooterVisible(block);

    const start = rect || block.getBoundingClientRect();
    block.dataset.viewportFixed = "true";
    block.classList.add("is-viewport-fixed");

    block.style.width = `${Math.max(1, start.width)}px`;
    block.style.height = `${Math.max(1, start.height)}px`;
    block.style.left = `${start.left}px`;
    block.style.top = `${start.top}px`;

    clampViewportFixedBlock(block, { resizeToFit: true });
  } else {
    if (!isViewportFixed(block)) return false;

    const screenRect = block.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();

    block.classList.remove("is-viewport-fixed");
    delete block.dataset.viewportFixed;

    block.style.width = `${Math.max(1, screenRect.width)}px`;
    block.style.height = `${Math.max(1, screenRect.height)}px`;
    block.style.left = `${screenRect.left - workspaceRect.left}px`;
    block.style.top = `${screenRect.top - workspaceRect.top}px`;
  }

  if (notify) {
    workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
  }
  window.dispatchEvent(new CustomEvent("framechute:viewport-fixed-changed", {
    detail: { block, fixed: enabled }
  }));
  return true;
}

export function toggleViewportFixed(block) {
  return setViewportFixed(block, !isViewportFixed(block));
}

window.addEventListener("framechute:toggle-viewport-fixed", (event) => {
  const block = event.detail?.block;
  if (block) toggleViewportFixed(block);
});

window.addEventListener("resize", () => {
  for (const block of workspace?.querySelectorAll?.(".block.is-viewport-fixed") || []) {
    clampViewportFixedBlock(block, { resizeToFit: true });
  }
});

window.addEventListener("framechute:block-captured", (event) => {
  const { block, record } = event.detail || {};
  if (!isViewportFixed(block) || !record) return;
  const rect = block.getBoundingClientRect();
  record.state ||= {};
  record.state.viewportFixed = true;
  record.state.viewportFixedRect = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
});

window.addEventListener("framechute:block-restored", (event) => {
  const { block, record } = event.detail || {};
  if (!block || record?.state?.viewportFixed !== true) return;
  requestAnimationFrame(() => {
    setViewportFixed(block, true, {
      rect: record.state.viewportFixedRect || null,
      notify: false
    });
  });
});


for (const block of workspace?.querySelectorAll?.(".docx-block.show-object-footer, .pdf-block.show-object-footer, .document-block.show-object-footer") || []) {
  block.classList.remove("show-object-footer");
  delete block.dataset.footerVisibility;
}
