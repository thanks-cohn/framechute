export const EMPTY_RUN_STYLE = Object.freeze({ bold: false, italic: false, underline: false, strike: false, color: "", highlight: "", fontFamily: "", fontSize: null, hyperlink: "" });

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
    underline: inherited.underline || tag === "U" || decorationUnderlines(decoration),
    strike: inherited.strike || tag === "S" || tag === "STRIKE" || String(decoration).toLowerCase().includes("line-through"),
    color: style.color || inherited.color || "",
    highlight: style.backgroundColor || inherited.highlight || "",
    fontFamily: style.fontFamily?.replace(/^['"]|['"]$/g, "") || (tag === "FONT" ? element.getAttribute?.("face") : "") || inherited.fontFamily || "",
    fontSize: Number.parseFloat(style.fontSize) || inherited.fontSize || null,
    hyperlink: tag === "A" ? element.getAttribute?.("href") || inherited.hyperlink || "" : inherited.hyperlink || ""
  };
}

function sameStyle(left, right) {
  return left.bold === right.bold && left.italic === right.italic && left.underline === right.underline && left.strike === right.strike && left.color === right.color && left.highlight === right.highlight && left.fontFamily === right.fontFamily && left.fontSize === right.fontSize && left.hyperlink === right.hyperlink;
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

/** Replace only text-node content, leaving links, images, tables and metadata intact. */
export function replaceTextNodes(root, search, replacement) {
  if (!root || !search) return 0;
  let count = 0;
  const visit = node => {
    if (node.nodeType === 3) {
      const pieces = String(node.textContent || "").split(search);
      if (pieces.length > 1) { count += pieces.length - 1; node.textContent = pieces.join(replacement); }
      return;
    }
    for (const child of [...node.childNodes || []]) visit(child);
  };
  visit(root);
  return count;
}
