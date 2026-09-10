export const FRAMECHUTE_DRAG_TYPE = "application/x-framechute-object";

let session = null;

export function beginInternalDrag({ block, kind = "object", sourceBlobProvider = null, mode = "native-drag", ...origin } = {}) {
  session = { block, kind, sourceBlobProvider, mode, ...origin, owner: "workspace", claimedBy: null };
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

export function isDocumentDragDestination(event) {
  const path = event?.composedPath?.() || [event?.target];
  return path.some(node => node?.matches?.(".docx-editor, .pdf-surface, .pdf-text-layer") || node?.closest?.(".docx-editor, .pdf-surface, .pdf-text-layer"));
}

export function shouldShowGlobalIngest(event) {
  if (isDocumentDragDestination(event)) return false;
  if (isInternalFrameChuteDrag(event) || session?.owner === "document") return false;
  return [...event?.dataTransfer?.items || []].some(item => item.kind === "file") || externalFiles(event).length > 0;
}

export function shouldGenericWorkspaceIngest(event) {
  return !isInternalFrameChuteDrag(event) && session?.owner !== "document";
}

async function canvasBlob(canvas, type = "image/png") {
  return new Promise(resolve => canvas.toBlob(resolve, type));
}

export async function normalizeImageBlobForPdf(blob) {
  if (!(blob instanceof Blob)) return blob;
  const mime = String(blob.type || "").toLowerCase();
  if (mime === "image/png" || mime === "image/jpeg") return blob;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return blob;

  let bitmap = null;
  try {
    bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, bitmap.width);
    canvas.height = Math.max(1, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) return blob;
    context.drawImage(bitmap, 0, 0);
    return await canvasBlob(canvas, "image/png") || blob;
  } catch {
    return blob;
  } finally {
    bitmap?.close?.();
  }
}

export async function imageBlobsForDrop(event) {
  let blobs = [];
  if (session?.kind === "image" && session.block?.isConnected) {
    const blob = await session.sourceBlobProvider?.(session.block);
    blobs = blob ? [blob] : [];
  } else {
    blobs = externalFiles(event).filter(file => /^image\/(png|jpeg|gif|webp)$/i.test(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name));
  }

  const pdfTarget = Boolean(event?.target?.closest?.(".pdf-surface, .pdf-text-layer"));
  if (!pdfTarget) return blobs;
  return Promise.all(blobs.map(normalizeImageBlobForPdf));
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
