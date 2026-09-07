export const EMPTY_RUN_STYLE = Object.freeze({ bold: false, italic: false, underline: false });

function decorationUnderlines(value) {
  return String(value || "").toLowerCase().split(/\s+/).includes("underline");
}

/** Read the format-neutral style contributed by one editor DOM element. */
export function readRunStyle(element, inherited = EMPTY_RUN_STYLE) {
  const tag = String(element?.tagName || "").toUpperCase();
  const style = element?.style || {};
  const weight = String(style.fontWeight || "").toLowerCase();
  const decoration = style.textDecorationLine || style.textDecoration || "";
  return {
    bold: inherited.bold || tag === "B" || tag === "STRONG" || weight === "bold" || Number.parseInt(weight, 10) >= 600,
    italic: inherited.italic || tag === "I" || tag === "EM" || String(style.fontStyle || "").toLowerCase() === "italic",
    underline: inherited.underline || tag === "U" || decorationUnderlines(decoration)
  };
}

function sameStyle(left, right) {
  return left.bold === right.bold && left.italic === right.italic && left.underline === right.underline;
}

/** Flatten nested/inherited browser markup into canonical, combinable text runs. */
export function editorNodeToRuns(root, imageReader) {
  const runs = [];
  const append = (run) => {
    if (!run.text && !run.images?.length) return;
    const previous = runs.at(-1);
    if (run.text && previous?.text && !previous.images?.length && sameStyle(previous, run)) previous.text += run.text;
    else runs.push(run);
  };
  const visit = (node, inherited) => {
    if (node.nodeType === 3) { append({ text: node.textContent || "", ...inherited }); return; }
    if (node.nodeType !== 1) return;
    const image = imageReader?.(node);
    if (image) { append({ text: "", images: [image], ...inherited }); return; }
    const style = readRunStyle(node, inherited);
    for (const child of node.childNodes || []) visit(child, style);
  };
  for (const child of root.childNodes || []) visit(child, EMPTY_RUN_STYLE);
  return runs;
}
