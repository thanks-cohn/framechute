const savedRanges = new WeakMap();
const frozenHighlightName = "framechute-docx-selection";

const style = document.createElement("style");
style.textContent = `
  ::highlight(${frozenHighlightName}) {
    background: #9ec5ff;
    color: #111;
  }

  .docx-toolbar label[title="Text color"],
  .docx-toolbar label[title="Highlight"] {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 34px;
    padding: 0 8px;
    border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
    border-radius: 8px;
    background: Canvas;
    color: CanvasText;
    white-space: nowrap;
  }

  .docx-toolbar input[type="color"] {
    width: 28px;
    height: 24px;
    padding: 1px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    cursor: pointer;
  }

  .docx-more > summary {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 0 10px;
    border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
    border-radius: 8px;
    background: Canvas;
    color: CanvasText;
    cursor: pointer;
    list-style: none;
    white-space: nowrap;
  }

  .docx-more > summary::-webkit-details-marker { display: none; }
  .docx-more > summary::before { content: "▸"; margin-right: 6px; opacity: .7; }
  .docx-more[open] > summary::before { content: "▾"; }

  .docx-panel {
    left: 0 !important;
    right: auto !important;
    width: min(360px, calc(100vw - 28px)) !important;
    max-height: min(520px, 70vh);
    overflow: auto;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 10px 12px !important;
    padding: 12px !important;
    border: 1px solid color-mix(in srgb, CanvasText 18%, transparent) !important;
    border-radius: 12px !important;
    background: Canvas !important;
    box-shadow: 0 16px 40px color-mix(in srgb, CanvasText 20%, transparent) !important;
  }

  .docx-panel label {
    min-width: 0;
    gap: 4px !important;
    font-size: 12px;
    font-weight: 650;
  }

  .docx-panel input,
  .docx-panel select,
  .docx-panel button {
    width: 100%;
    min-width: 0;
  }

  .docx-panel button {
    min-height: 36px;
  }
`;
document.head.append(style);

function editorFor(node) {
  return node?.closest?.(".docx-block")?.querySelector?.(".docx-editor") || null;
}

function currentRangeInside(editor) {
  const selection = document.getSelection();
  if (!editor || !selection?.rangeCount) return null;
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  if (!anchor || !focus || !editor.contains(anchor) || !editor.contains(focus)) return null;
  return selection.getRangeAt(0).cloneRange();
}

function remember(editor) {
  const range = currentRangeInside(editor);
  if (range) savedRanges.set(editor, range);
  return range || savedRanges.get(editor) || null;
}

function freeze(editor) {
  const range = savedRanges.get(editor);
  if (!range || range.collapsed || !globalThis.CSS?.highlights || typeof globalThis.Highlight !== "function") return;
  CSS.highlights.set(frozenHighlightName, new Highlight(range));
}

function unfreeze() {
  globalThis.CSS?.highlights?.delete?.(frozenHighlightName);
}

function restoreRange(editor, range = savedRanges.get(editor), { focus = false } = {}) {
  if (!editor || !range) return false;
  try {
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    if (focus) editor.focus({ preventScroll: true });
    return true;
  } catch {
    return false;
  }
}

// Keep a non-DOM visual selection while native focus temporarily moves into
// font/size/color controls. This prevents the selected text from appearing to
// vanish simply because Chromium focused a toolbar control.
document.addEventListener("pointerdown", (event) => {
  const toolbar = event.target.closest?.(".docx-toolbar");
  if (toolbar) {
    const editor = editorFor(toolbar);
    remember(editor);
    freeze(editor);
    return;
  }
  const editor = event.target.closest?.(".docx-editor");
  if (editor) unfreeze();
}, true);

document.addEventListener("contextmenu", (event) => {
  const editor = event.target.closest?.(".docx-editor");
  if (!editor) return;
  remember(editor);
  freeze(editor);
}, true);

document.addEventListener("selectionchange", () => {
  const selection = document.getSelection();
  const node = selection?.anchorNode;
  const editor = node?.nodeType === Node.ELEMENT_NODE ? node.closest?.(".docx-editor") : node?.parentElement?.closest?.(".docx-editor");
  if (!editor) return;
  const range = currentRangeInside(editor);
  if (range) savedRanges.set(editor, range);
  if (document.activeElement === editor || editor.contains(document.activeElement)) unfreeze();
});

// Restore the actual selection immediately before the existing DOCX toolbar
// change handlers run. The control keeps its value, while the command still
// targets the range the user highlighted in the document.
document.addEventListener("change", (event) => {
  const toolbar = event.target.closest?.(".docx-toolbar");
  if (!toolbar) return;
  const editor = editorFor(toolbar);
  restoreRange(editor);
  freeze(editor);
}, true);

window.addEventListener("framechute:docx-command", (event) => {
  const { block, action, value, range: contextRange } = event.detail || {};
  if (!block || !["highlight", "remove-highlight"].includes(action)) return;
  const editor = block.querySelector(".docx-editor");
  const range = contextRange || savedRanges.get(editor);
  if (!editor || !range || range.collapsed) return;

  savedRanges.set(editor, range.cloneRange());
  restoreRange(editor, range, { focus: true });
  document.execCommand("styleWithCSS", false, true);
  const color = action === "remove-highlight"
    ? "transparent"
    : (value || block.querySelector(".docx-highlight")?.value || "#ffff00");
  document.execCommand("hiliteColor", false, color);
  block.dataset.documentDirty = "true";
  const dirty = block.querySelector(".document-dirty");
  if (dirty) dirty.hidden = false;
  remember(editor);
  unfreeze();
});
