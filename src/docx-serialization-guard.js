// The DOCX serializer intentionally uses a least-destructive fast path when only
// text/run formatting changes. Page geometry and drawing mutations must take the
// canonical OOXML path instead. The editor model currently decides that from
// paragraph structure, so use a sub-rounding spacing nudge that is invisible and
// serializes back to the same Word spacing value while making the structure
// comparison correctly notice that a structural save is required.

const EPSILON_PT = 0.0001;

function forceCanonicalSave(editor) {
  if (!editor?.matches?.(".docx-editor") || editor.dataset.framechuteCanonicalSave === "true") return;
  let paragraph = editor.querySelector("p,h1,h2,h3,h4,h5,h6,li");
  if (!paragraph) {
    paragraph = document.createElement("p");
    paragraph.innerHTML = "<br>";
    editor.append(paragraph);
  }
  const current = Number.parseFloat(paragraph.style.marginBottom) || 0;
  paragraph.style.marginBottom = `${current + EPSILON_PT}pt`;
  paragraph.dataset.framechuteCanonicalNudge = "true";
  editor.dataset.framechuteCanonicalSave = "true";
}

function relevantMutation(mutation) {
  const target = mutation.target;
  const editor = target?.closest?.(".docx-editor");
  if (!editor) return null;

  if (mutation.type === "childList") {
    const changed = [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
      node.nodeType === Node.ELEMENT_NODE && (node.matches?.("img[data-docx-relationship]") || node.querySelector?.("img[data-docx-relationship]"))
    );
    return changed ? editor : null;
  }

  if (mutation.type === "attributes") {
    if (target === editor && ["data-page-setup", "data-page-setup-changed"].includes(mutation.attributeName)) return editor;
    if (target.matches?.("img[data-docx-relationship]") && ["style", "data-docx-width", "data-docx-height", "data-docx-wrap"].includes(mutation.attributeName)) return editor;
  }
  return null;
}

const workspace = document.querySelector("#workspace") || document.body;
const observer = new MutationObserver((mutations) => {
  const editors = new Set();
  for (const mutation of mutations) {
    const editor = relevantMutation(mutation);
    if (editor) editors.add(editor);
  }
  for (const editor of editors) forceCanonicalSave(editor);
});

observer.observe(workspace, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["style", "data-docx-width", "data-docx-height", "data-docx-wrap", "data-page-setup", "data-page-setup-changed"]
});

window.addEventListener("framechute:block-restored", (event) => {
  const editor = event.detail?.block?.querySelector?.(".docx-editor");
  if (!editor) return;
  // A restored editor starts clean; do not force canonical output until a page
  // or drawing mutation actually occurs.
  delete editor.dataset.framechuteCanonicalSave;
});
