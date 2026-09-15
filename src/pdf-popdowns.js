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

  block.querySelector(".pdf-toolbar")?.addEventListener("scroll", () => {
    if (details.open) details.open = false;
  }, { passive: true });
}

function bindAll(root = document) {
  root.querySelectorAll?.(".pdf-toolbar details").forEach(bind);
}

bindAll();
new MutationObserver(records => records.forEach(record => {
  record.addedNodes.forEach(node => {
    if (node.nodeType === 1) bindAll(node);
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
