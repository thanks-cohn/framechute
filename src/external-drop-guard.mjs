const INTERNAL_DRAG_TYPE = "application/x-framechute-internal-drag";

let installed = false;
let internalPointerCount = 0;
let internalNativeDrag = false;

function clearOverlay(workspace) {
  workspace?.classList.remove("is-drop-target");
}

/**
 * Installs the ownership boundary between pointer manipulation in FrameChute
 * and native drags entering it. Calling this more than once is harmless.
 */
export function installExternalDropGuard(workspace) {
  if (installed || !workspace) return;
  installed = true;

  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("#workspace .block")) return;
    internalPointerCount += 1;
    clearOverlay(workspace);
  }, true);

  const releasePointer = () => {
    internalPointerCount = Math.max(0, internalPointerCount - 1);
    clearOverlay(workspace);
  };
  document.addEventListener("pointerup", releasePointer, true);
  document.addEventListener("pointercancel", releasePointer, true);

  document.addEventListener("dragstart", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("#workspace .block")) return;
    // Object movement uses Pointer Events. A native drag from media or editable
    // document content is accidental unless a feature explicitly opts in.
    if (!event.target.closest("[data-framechute-native-drag='true']")) {
      internalNativeDrag = true;
      event.preventDefault();
      clearOverlay(workspace);
      queueMicrotask(() => { internalNativeDrag = false; });
      return;
    }
    internalNativeDrag = true;
    event.dataTransfer?.setData(INTERNAL_DRAG_TYPE, "1");
    clearOverlay(workspace);
  }, true);

  const reset = () => {
    internalNativeDrag = false;
    internalPointerCount = 0;
    clearOverlay(workspace);
  };
  document.addEventListener("dragend", reset, true);
  document.addEventListener("drop", () => {
    internalNativeDrag = false;
    clearOverlay(workspace);
  }, true);
  window.addEventListener("blur", reset);
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") reset(); }, true);

  const disableNativeMediaDrag = (root) => {
    if (!(root instanceof Element)) return;
    if (root.matches("#workspace .block img, #workspace .block video, #workspace .block audio")) root.draggable = false;
    for (const media of root.querySelectorAll?.("#workspace .block img, #workspace .block video, #workspace .block audio") || []) {
      media.draggable = false;
    }
  };
  disableNativeMediaDrag(workspace);
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) disableNativeMediaDrag(node);
  }).observe(workspace, { childList: true, subtree: true });
}

export function isInternalDrag(event) {
  const types = [...(event?.dataTransfer?.types || [])];
  return internalNativeDrag || internalPointerCount > 0 || types.includes(INTERNAL_DRAG_TYPE);
}

export function isExternalDrag(event) {
  if (!event?.dataTransfer || isInternalDrag(event)) return false;
  const types = [...(event.dataTransfer.types || [])];
  const items = [...(event.dataTransfer.items || [])];
  return items.some((item) => item.kind === "file")
    || types.some((type) => ["Files", "text/uri-list", "text/html", "text/plain"].includes(type));
}

export function clearExternalDropOverlay(workspace) {
  clearOverlay(workspace);
}
