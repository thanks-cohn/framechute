import { clearExternalDropOverlay, installExternalDropGuard, isExternalDrag } from "./external-drop-guard.mjs";

const workspace = document.querySelector("#workspace");
const mediaDock = document.querySelector("#video-dock");

installExternalDropGuard(workspace);

function cloneDragEvent(type, event) {
  return new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    dataTransfer: event.dataTransfer || null,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    button: event.button,
    buttons: event.buttons
  });
}

function forwardToWorkspace(type, event) {
  if (!workspace || !event.dataTransfer) return false;
  const forwarded = cloneDragEvent(type, event);
  workspace.dispatchEvent(forwarded);
  return forwarded.defaultPrevented;
}

if (workspace && mediaDock) {
  mediaDock.addEventListener("dragenter", (event) => {
    if (!isExternalDrag(event)) { clearExternalDropOverlay(workspace); return; }
    event.preventDefault();
    event.stopPropagation();
    workspace.classList.add("is-drop-target");
    forwardToWorkspace("dragenter", event);
  });

  mediaDock.addEventListener("dragover", (event) => {
    if (!isExternalDrag(event)) { clearExternalDropOverlay(workspace); return; }
    event.preventDefault();
    event.stopPropagation();
    try { event.dataTransfer.dropEffect = "copy"; } catch {}
    workspace.classList.add("is-drop-target");
    forwardToWorkspace("dragover", event);
  });

  mediaDock.addEventListener("dragleave", (event) => {
    if (!event.dataTransfer) return;
    event.stopPropagation();
    forwardToWorkspace("dragleave", event);
  });

  mediaDock.addEventListener("drop", (event) => {
    if (!event.dataTransfer) return;
    event.preventDefault();
    event.stopPropagation();
    workspace.classList.remove("is-drop-target");
    forwardToWorkspace("drop", event);
  });
}
