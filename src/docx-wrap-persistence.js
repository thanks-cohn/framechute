const MARKER = "|fcwrap:";
const MODES = new Set(["square", "tight", "top-bottom", "behind", "front"]);

function splitRelationship(value = "") {
  const at = String(value).indexOf(MARKER);
  if (at < 0) return { base: String(value), layout: null };
  const base = String(value).slice(0, at);
  const [mode = "", x = "0", y = "0"] = String(value).slice(at + MARKER.length).split(",");
  return {
    base,
    layout: MODES.has(mode) ? { mode, x: Number(x) || 0, y: Number(y) || 0 } : null
  };
}

function encodeRelationship(base, mode, x, y) {
  if (!MODES.has(mode)) return base;
  const clean = value => Math.round((Number(value) || 0) * 100) / 100;
  return `${base}${MARKER}${mode},${clean(x)},${clean(y)}`;
}

function pointInEditor(editor, image) {
  const editorRect = editor.getBoundingClientRect();
  const imageRect = image.getBoundingClientRect();
  return {
    x: imageRect.left - editorRect.left + editor.scrollLeft,
    y: imageRect.top - editorRect.top + editor.scrollTop
  };
}

function applyLayout(editor, image, layout) {
  if (!layout || !MODES.has(layout.mode)) return;
  const mode = layout.mode;
  image.dataset.docxWrap = mode;
  image.style.float = "none";
  image.style.position = "static";
  image.style.left = "";
  image.style.top = "";
  image.style.zIndex = "";
  image.style.margin = "";
  image.style.display = "inline-block";
  image.style.shapeOutside = "";
  image.draggable = true;

  if (mode === "square") {
    image.style.float = "left";
    image.style.margin = "0.2rem 0.65rem 0.35rem 0";
  } else if (mode === "tight") {
    image.style.float = "left";
    image.style.margin = "0.15rem 0.55rem 0.3rem 0";
    image.style.shapeOutside = `url("${image.currentSrc || image.src}")`;
  } else if (mode === "top-bottom") {
    image.style.display = "block";
    image.style.margin = "0.5rem auto";
  } else if (mode === "behind" || mode === "front") {
    editor.style.position = "relative";
    editor.style.isolation = "isolate";
    image.style.position = "absolute";
    image.style.left = `${Math.max(0, layout.x)}px`;
    image.style.top = `${Math.max(0, layout.y)}px`;
    image.style.zIndex = mode === "behind" ? "-1" : "8";
    image.style.margin = "0";
    image.draggable = false;
  }
}

function restoreImage(image) {
  if (!image?.matches?.("img[data-docx-relationship]")) return;
  const editor = image.closest(".docx-editor");
  if (!editor) return;
  const parsed = splitRelationship(image.dataset.docxRelationship);
  if (parsed.layout) applyLayout(editor, image, parsed.layout);
}

function persistImage(image) {
  if (!image?.matches?.("img[data-docx-relationship]")) return;
  const editor = image.closest(".docx-editor");
  if (!editor) return;
  const parsed = splitRelationship(image.dataset.docxRelationship);
  const mode = image.dataset.docxWrap || parsed.layout?.mode || "inline";
  if (!MODES.has(mode)) {
    if (parsed.layout) image.dataset.docxRelationship = parsed.base;
    return;
  }
  let point;
  if ((mode === "front" || mode === "behind") && image.style.position === "absolute") {
    point = { x: Number.parseFloat(image.style.left) || 0, y: Number.parseFloat(image.style.top) || 0 };
  } else point = pointInEditor(editor, image);
  image.dataset.docxRelationship = encodeRelationship(parsed.base, mode, point.x, point.y);
}

function visitNode(node, callback) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  if (node.matches?.("img[data-docx-relationship]")) callback(node);
  node.querySelectorAll?.("img[data-docx-relationship]").forEach(callback);
}

document.querySelectorAll(".docx-editor img[data-docx-relationship]").forEach(restoreImage);

const workspace = document.querySelector("#workspace") || document.body;
new MutationObserver((mutations) => {
  const restore = new Set();
  const persist = new Set();
  for (const mutation of mutations) {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach(node => visitNode(node, image => restore.add(image)));
    } else if (mutation.type === "attributes") {
      const image = mutation.target;
      if (image.matches?.("img[data-docx-relationship]")) persist.add(image);
    }
  }
  restore.forEach(restoreImage);
  requestAnimationFrame(() => persist.forEach(persistImage));
}).observe(workspace, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["style", "data-docx-wrap", "data-docx-width", "data-docx-height"]
});

window.addEventListener("framechute:block-restored", event => {
  requestAnimationFrame(() => event.detail?.block?.querySelectorAll?.(".docx-editor img[data-docx-relationship]").forEach(restoreImage));
});
