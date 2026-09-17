import { copyContentToClipboard } from "./actions/content-copy.js";

const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");
const TERMINAL_MASK_CLASS = "pdf-terminal-bleed-polish";
const NORMALIZE_DELAYS = [0, 80, 260, 900, 1400];

function setStatus(message) {
  if (status) status.textContent = message;
}

function terminalIndexes(textLayer) {
  return new Set(
    [...textLayer.querySelectorAll('.pdf-text-item[data-terminal-fragment="true"][data-index]')]
      .map((span) => String(span.dataset.index || "").trim())
      .filter(Boolean)
  );
}

function polishTerminalMasks(block) {
  const textLayer = block?.querySelector(".pdf-text-layer");
  if (!textLayer) return;

  const terminals = terminalIndexes(textLayer);
  for (const mask of textLayer.querySelectorAll('.pdf-source-mask[data-mask-role="source-line"]')) {
    const indexes = String(mask.dataset.maskIndex || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    mask.classList.toggle(TERMINAL_MASK_CLASS, indexes.some((index) => terminals.has(index)));
  }

  const selectedIndex = String(block.dataset.selectedPdfIndex || "").trim();
  const editingTerminal = textLayer.querySelector('.pdf-text-item.is-editing[data-terminal-fragment="true"]')
    || (selectedIndex
      ? textLayer.querySelector(`.pdf-text-item[data-index="${CSS.escape(selectedIndex)}"][data-terminal-fragment="true"]`)
      : null);

  for (const mask of textLayer.querySelectorAll(".pdf-live-edit-mask")) {
    mask.classList.toggle(TERMINAL_MASK_CLASS, Boolean(editingTerminal));
  }
}

function normalizePdfControls(block) {
  if (!(block instanceof HTMLElement) || !block.classList.contains("pdf-block")) return;

  // The advanced source-location footer duplicates the PDF's compact source
  // controls. PDFs own their reconnect/copy pair in the toolbar, so suppress
  // the footer instead of letting focus refreshes add another visible row.
  for (const footer of block.querySelectorAll(":scope > .framechute-source-location")) footer.remove();

  const toolbar = block.querySelector(".pdf-toolbar");
  if (!toolbar) {
    polishTerminalMasks(block);
    return;
  }

  // Remove leftovers from the earlier experimental implementation.
  toolbar.querySelectorAll(".framechute-pdf-source-controls").forEach((node) => node.remove());

  const groups = [...toolbar.querySelectorAll(".local-source-controls")];
  const keeper = groups.shift() || null;
  for (const duplicate of groups) duplicate.remove();

  if (keeper) {
    const reconnect = keeper.querySelector(".local-source-link");
    const copy = keeper.querySelector(".local-source-copy");
    if (reconnect) {
      reconnect.textContent = "Reconnect";
      reconnect.title = "Reconnect this PDF to its source";
      reconnect.setAttribute("aria-label", "Reconnect PDF source");
    }
    if (copy) {
      copy.textContent = "Copy";
      copy.title = "Copy this PDF document";
      copy.setAttribute("aria-label", "Copy PDF document");
    }
  }

  polishTerminalMasks(block);
}

function normalizeAllPdfs() {
  for (const block of workspace?.querySelectorAll(".pdf-block") || []) normalizePdfControls(block);
}

function scheduleNormalize(block = null) {
  for (const delay of NORMALIZE_DELAYS) {
    setTimeout(() => {
      if (block?.isConnected) normalizePdfControls(block);
      else normalizeAllPdfs();
    }, delay);
  }
}

async function copyPdfDocument(block, button) {
  if (!block) return;
  button.disabled = true;
  try {
    const blob = await window.FrameChuteWorkspace?.sourceBlob?.(block);
    let text = "";
    try {
      text = await window.FrameChuteWorkspace?.extractText?.(block) || "";
    } catch {
      text = "";
    }

    if (!blob && !text) {
      setStatus("Copy failed: this PDF has no copyable document content.");
      return;
    }

    const result = await copyContentToClipboard({ blob, text });
    if (result.ok && result.kind === "blob") setStatus("Copied PDF document.");
    else setStatus(result.message);
  } catch (error) {
    console.error("Could not copy PDF document:", error);
    setStatus(`Copy failed: ${error?.message || "the clipboard rejected the PDF"}.`);
  } finally {
    button.disabled = false;
    scheduleNormalize(block);
  }
}

function installStyle() {
  if (document.querySelector('style[data-framechute-pdf-light-polish="true"]')) return;
  const style = document.createElement("style");
  style.dataset.framechutePdfLightPolish = "true";
  style.textContent = `
    .pdf-block > .framechute-source-location {
      display: none !important;
    }

    .pdf-toolbar .local-source-controls {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 auto;
    }

    .pdf-toolbar .local-source-controls > button {
      min-height: 30px;
      padding: 0 9px;
      white-space: nowrap;
      font-size: 11px;
      font-weight: 700;
    }

    /* Live-editor only: extend the deleting cover well past the previous final
       source object so terminal glyph fragments/antialiasing cannot survive. */
    .pdf-source-mask.${TERMINAL_MASK_CLASS},
    .pdf-live-edit-mask.${TERMINAL_MASK_CLASS} {
      box-shadow: 22px 0 0 #fff;
    }
  `;
  document.head.append(style);
}

// Intercept the PDF toolbar Copy control before the legacy source-name handler.
// It now copies the actual current PDF document, matching the normal object Copy action.
document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const copy = target?.closest?.(".pdf-block .local-source-copy");
  if (!copy) return;

  const block = copy.closest(".pdf-block");
  event.preventDefault();
  event.stopImmediatePropagation();
  void copyPdfDocument(block, copy);
}, true);

document.addEventListener("pointerup", (event) => {
  const block = event.target instanceof Element ? event.target.closest?.(".pdf-block") : null;
  if (block) requestAnimationFrame(() => normalizePdfControls(block));
}, true);

document.addEventListener("input", (event) => {
  const block = event.target instanceof Element ? event.target.closest?.(".pdf-block") : null;
  if (block) requestAnimationFrame(() => polishTerminalMasks(block));
}, true);

workspace?.addEventListener("flashframe:workspace-changed", () => scheduleNormalize());
window.addEventListener("focus", () => scheduleNormalize());
window.addEventListener("flashframe:archive-imported", () => scheduleNormalize());

// Observe only direct workspace children. Unlike the previous version, this
// never watches the PDF text layer, so opening a PDF cannot trigger thousands
// of normalization rescans while PDF.js builds glyph nodes.
if (workspace) {
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.classList.contains("pdf-block")) scheduleNormalize(node);
        for (const block of node.querySelectorAll?.(".pdf-block") || []) scheduleNormalize(block);
      }
    }
  }).observe(workspace, { childList: true, subtree: false });
}

installStyle();
scheduleNormalize();