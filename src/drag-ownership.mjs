export const FRAMECHUTE_DRAG_TYPE = "application/x-framechute-object";

let session = null;

export function beginInternalDrag({ block, kind = "object", sourceBlobProvider = null, mode = "native-drag" } = {}) {
  session = { block, kind, sourceBlobProvider, mode, owner: "workspace", claimedBy: null };
  return session;
}

export function activeInternalDrag() { return session; }

export function isInternalFrameChuteDrag(event) {
  if (session?.block?.isConnected) return true;
  return [...event?.dataTransfer?.types || []].includes(FRAMECHUTE_DRAG_TYPE);
}

export function externalFiles(event) {
  return [...event?.dataTransfer?.files || []];
}

export function canClaimImageDrop(event) {
  if (session?.kind === "image" && session.block?.isConnected) return true;
  return externalFiles(event).some(file => /^image\/(png|jpeg|gif|webp)$/i.test(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name));
}

export function claimDocumentDrop(owner, event) {
  if (!canClaimImageDrop(event)) return false;
  // External drags are owned by the local handler/event propagation only. A
  // persistent claim would incorrectly follow the pointer back to workspace.
  if (session?.block?.isConnected) { session.owner = "document"; session.claimedBy = owner; }
  return true;
}

export function shouldShowGlobalIngest(event) {
  if (isInternalFrameChuteDrag(event) || session?.owner === "document") return false;
  return [...event?.dataTransfer?.items || []].some(item => item.kind === "file") || externalFiles(event).length > 0;
}

export function shouldGenericWorkspaceIngest(event) {
  return !isInternalFrameChuteDrag(event) && session?.owner !== "document";
}

export async function imageBlobsForDrop(event) {
  if (session?.kind === "image" && session.block?.isConnected) {
    const blob = await session.sourceBlobProvider?.(session.block);
    return blob ? [blob] : [];
  }
  return externalFiles(event).filter(file => /^image\/(png|jpeg|gif|webp)$/i.test(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name));
}

export function endInternalDrag() { session = null; }

/**
 * End a drag session only when the event actually terminates that session type.
 * Native HTML drag-and-drop fires pointercancel after dragstart; that transition
 * must not destroy the sourceBlobProvider before DOCX/PDF receives the drop.
 */
export function handleInternalDragTermination(type) {
  if (!session) return false;
  if (session.mode === "native-drag" && (type === "pointerup" || type === "pointercancel")) return false;
  if (session.mode === "pointer-manipulation" && type === "dragend") return false;
  endInternalDrag();
  return true;
}

if (typeof window !== "undefined") {
  for (const name of ["pointerup", "pointercancel", "dragend", "blur"]) {
    window.addEventListener(name, () => handleInternalDragTermination(name), true);
  }
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") handleInternalDragTermination("escape");
  }, true);
}
