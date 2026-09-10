/** The destination, not browser-native image payloads, decides move vs copy. */
export function documentImageDropEffect(drag, destinationKind, destinationBlock) {
  return drag?.kind === "image" && drag.originKind === destinationKind && drag.block === destinationBlock ? "move" : "copy";
}

/** Resolve a browser caret at the exact drop point, constrained to an editor. */
export function documentDropRange(documentObject, editor, x, y, movingNode = null) {
  const position = documentObject.caretPositionFromPoint?.(x, y);
  let range;
  if (position?.offsetNode) {
    range = documentObject.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
  } else {
    range = documentObject.caretRangeFromPoint?.(x, y)?.cloneRange?.() || documentObject.caretRangeFromPoint?.(x, y);
  }
  if (!range || !editor.contains(range.startContainer) || movingNode?.contains?.(range.startContainer)) return null;
  return range;
}

/** Move the same semantic node; Range insertion preserves the precise inline caret. */
export function moveNodeToDropRange(node, range) {
  if (!node || !range) return false;
  range.insertNode(node);
  range.setStartAfter?.(node);
  range.collapse?.(true);
  return true;
}
