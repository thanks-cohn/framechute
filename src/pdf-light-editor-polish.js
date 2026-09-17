const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");
const PDF_COMPACT_CONTROLS = "framechute-pdf-source-controls";
const TERMINAL_MASK_CLASS = "pdf-terminal-bleed-polish";

function setStatus(message) {
  if (status) status.textContent = message;
}

function cleanSourceLabel(value) {
  const text = String(value || "").trim();
  return text.replace(/^Local\s+(?:file|folder):\s*/i, "").trim();
}

function rememberedPdfSource(block, footer = null) {
  const footerValue = footer?.querySelector(".framechute-source-location-value")?.value?.trim();
  if (footerValue) return footerValue;

  const remembered = String(block?.dataset?.framechuteSourceAddress || "").trim();
  if (remembered) return remembered;

  const displayName = String(block?.dataset?.sourceDisplayName || "").trim();
  if (displayName) return displayName;

  const localLink = cleanSourceLabel(block?.querySelector(".local-source-link")?.textContent);
  if (localLink && localLink.toLowerCase() !== "reconnect") return localLink;

  return "";
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function ensureCompactPdfControls(block, address) {
  const toolbar = block.querySelector(".pdf-toolbar");
  if (!toolbar) return;

  const legacyGroups = [...toolbar.querySelectorAll(".local-source-controls")];
  if (legacyGroups.length) {
    const keeper = legacyGroups.shift();
    for (const duplicate of legacyGroups) duplicate.remove();

    const reconnect = keeper.querySelector(".local-source-link");
    const copy = keeper.querySelector(".local-source-copy");
    if (reconnect) {
      reconnect.textContent = "Reconnect";
      reconnect.title = "Reconnect this PDF to its remembered source";
      reconnect.setAttribute("aria-label", "Reconnect PDF source");
    }
    if (copy) {
      copy.textContent = "Copy";
      copy.title = "Copy remembered PDF source";
    }
    toolbar.querySelector(`.${PDF_COMPACT_CONTROLS}`)?.remove();
    return;
  }

  let controls = toolbar.querySelector(`.${PDF_COMPACT_CONTROLS}`);
  if (!address) {
    controls?.remove();
    return;
  }

  if (!controls) {
    controls = document.createElement("span");
    controls.className = PDF_COMPACT_CONTROLS;

    const reconnect = document.createElement("button");
    reconnect.type = "button";
    reconnect.className = "framechute-pdf-reconnect";
    reconnect.textContent = "Reconnect";
    reconnect.title = "Reconnect this PDF to its remembered source";
    reconnect.addEventListener("click", () => {
      const nativeReconnect = block.querySelector(".reconnect-source");
      if (!nativeReconnect) {
        setStatus("This PDF has no reconnectable source control.");
        return;
      }
      nativeReconnect.click();
    });

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "framechute-pdf-copy-source";
    copy.textContent = "Copy";
    copy.title = "Copy remembered PDF source";
    copy.addEventListener("click", async () => {
      const current = rememberedPdfSource(block);
      if (!current) {
        setStatus("No remembered PDF source to copy.");
        return;
      }
      await copyText(current);
      setStatus(`Copied PDF source: ${current}`);
    });

    controls.append(reconnect, copy);
    toolbar.append(controls);
  }
}

function terminalIndexes(textLayer) {
  return new Set(
    [...textLayer.querySelectorAll('.pdf-text-item[data-terminal-fragment="true"][data-index]')]
      .map(span => String(span.dataset.index || "").trim())
      .filter(Boolean)
  );
}

function polishTerminalMasks(block) {
  const textLayer = block.querySelector(".pdf-text-layer");
  if (!textLayer) return;

  const terminals = terminalIndexes(textLayer);
  for (const mask of textLayer.querySelectorAll('.pdf-source-mask[data-mask-role="source-line"]')) {
    const indexes = String(mask.dataset.maskIndex || "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);
    mask.classList.toggle(TERMINAL_MASK_CLASS, indexes.some(index => terminals.has(index)));
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

function normalizePdfBlock(block) {
  if (!(block instanceof HTMLElement) || !block.classList.contains("pdf-block")) return;

  let address = rememberedPdfSource(block);
  const footers = [...block.querySelectorAll(":scope > .framechute-source-location")];
  for (const footer of footers) {
    const footerAddress = rememberedPdfSource(block, footer);
    if (footerAddress) {
      address = footerAddress;
      block.dataset.framechuteSourceAddress = footerAddress;
    }
    footer.remove();
  }

  ensureCompactPdfControls(block, address);
  polishTerminalMasks(block);
}

function normalizeAllPdfs() {
  for (const block of workspace?.querySelectorAll(".pdf-block") || []) normalizePdfBlock(block);
}

function scheduleNormalize(block = null) {
  queueMicrotask(() => {
    if (block?.isConnected) normalizePdfBlock(block);
    else normalizeAllPdfs();
  });
}

function installStyle() {
  if (document.querySelector('style[data-framechute-pdf-light-polish="true"]')) return;
  const style = document.createElement("style");
  style.dataset.framechutePdfLightPolish = "true";
  style.textContent = `
    .${PDF_COMPACT_CONTROLS},
    .pdf-toolbar .local-source-controls {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 auto;
    }

    .${PDF_COMPACT_CONTROLS} > button,
    .pdf-toolbar .local-source-controls > button {
      min-height: 30px;
      padding: 0 9px;
      white-space: nowrap;
      font-size: 11px;
      font-weight: 700;
    }

    .pdf-source-mask.${TERMINAL_MASK_CLASS},
    .pdf-live-edit-mask.${TERMINAL_MASK_CLASS} {
      box-shadow: 4px 0 0 #fff;
    }
  `;
  document.head.append(style);
}

if (workspace) {
  new MutationObserver((mutations) => {
    const blocks = new Set();
    for (const mutation of mutations) {
      const owner = mutation.target instanceof Element ? mutation.target.closest?.(".pdf-block") : null;
      if (owner) blocks.add(owner);
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const block = node.matches?.(".pdf-block") ? node : node.closest?.(".pdf-block");
        if (block) blocks.add(block);
        for (const nested of node.querySelectorAll?.(".pdf-block") || []) blocks.add(nested);
      }
    }
    for (const block of blocks) scheduleNormalize(block);
  }).observe(workspace, { childList: true, subtree: true });
}

window.addEventListener("focus", () => setTimeout(normalizeAllPdfs, 0));
workspace?.addEventListener("flashframe:workspace-changed", () => scheduleNormalize());
window.addEventListener("flashframe:archive-imported", () => scheduleNormalize());

document.addEventListener("pointerup", event => {
  const block = event.target instanceof Element ? event.target.closest?.(".pdf-block") : null;
  if (block) requestAnimationFrame(() => normalizePdfBlock(block));
}, true);

document.addEventListener("input", event => {
  const block = event.target instanceof Element ? event.target.closest?.(".pdf-block") : null;
  if (block) requestAnimationFrame(() => polishTerminalMasks(block));
}, true);

installStyle();
normalizeAllPdfs();
