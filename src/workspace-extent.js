const workspace = typeof document !== "undefined" ? document.querySelector("#workspace") : null;

export const WORKSPACE_EXPANSION_STEP = 640;
export const WORKSPACE_EDGE_MARGIN = 96;
export const WORKSPACE_NEGATIVE_RUNWAY = 8192;
export const WORKSPACE_PAN_EDGE = 44;
export const WORKSPACE_PAN_SPEED = 24;

export function requiredPositiveExpansion({ left, top, width, height, workspaceWidth, workspaceHeight, margin = WORKSPACE_EDGE_MARGIN, step = WORKSPACE_EXPANSION_STEP }) {
  let addWidth = 0;
  let addHeight = 0;
  while (left + width > workspaceWidth + addWidth - margin) addWidth += step;
  while (top + height > workspaceHeight + addHeight - margin) addHeight += step;
  return { addWidth, addHeight };
}

/**
 * Viewport edge-panning is navigation. The workspace itself is unbounded from
 * the user's point of view: dragging to any edge may grow reachable canvas,
 * regardless of toolbar visibility. Objects are never clamped back toward the
 * center merely to keep their headers visible.
 */
export function edgePanDelta({
  clientX,
  clientY,
  viewportWidth,
  viewportHeight,
  scrollX = 0,
  scrollY = 0,
  edge = WORKSPACE_PAN_EDGE,
  speed = WORKSPACE_PAN_SPEED
}) {
  const axis = (position, extent) => {
    if (position < edge) return -Math.max(1, Math.ceil(speed * (edge - position) / edge));
    if (position > extent - edge) return Math.max(1, Math.ceil(speed * (position - (extent - edge)) / edge));
    return 0;
  };
  let dx = axis(clientX, viewportWidth);
  let dy = axis(clientY, viewportHeight);
  if (scrollX <= 0 && dx < 0) dx = 0;
  if (scrollY <= 0 && dy < 0) dy = 0;
  return { dx, dy };
}

function numericStyle(element, property, fallback) {
  const value = Number.parseFloat(element.style[property]);
  return Number.isFinite(value) ? value : fallback;
}

function workspaceSize() {
  return {
    width: workspace.offsetWidth || numericStyle(workspace, "width", 2400),
    height: workspace.offsetHeight || numericStyle(workspace, "height", 1600)
  };
}

function setWorkspaceSize(width, height) {
  workspace.style.width = `${Math.max(1, Math.ceil(width))}px`;
  workspace.style.height = `${Math.max(1, Math.ceil(height))}px`;
}

function bringForward(block) {
  let max = 1;
  for (const item of workspace.querySelectorAll(":scope > .block")) {
    const z = Number.parseInt(item.style.zIndex, 10);
    if (Number.isFinite(z)) max = Math.max(max, z);
  }
  block.style.zIndex = String(max + 1);
}

function beginMeasuredBlockDrag(event, block, handle) {
  event.preventDefault();
  event.stopImmediatePropagation();
  bringForward(block);

  const startClientX = event.clientX;
  const startClientY = event.clientY;
  const startScrollX = window.scrollX;
  const startScrollY = window.scrollY;
  const startLeft = numericStyle(block, "left", block.offsetLeft);
  const startTop = numericStyle(block, "top", block.offsetTop);
  const rect = block.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  let clientX = event.clientX;
  let clientY = event.clientY;
  let active = true;
  let panFrame = 0;

  handle.classList.add("is-dragging");
  handle.setPointerCapture?.(event.pointerId);

  const placeBlock = () => {
    // One continuous coordinate system: pointer delta + viewport pan delta.
    // No clamping, rebasing, margin changes, rescue offsets, or object shifts.
    const left = startLeft + (clientX - startClientX) + (window.scrollX - startScrollX);
    const top = startTop + (clientY - startClientY) + (window.scrollY - startScrollY);

    const size = workspaceSize();
    const growth = requiredPositiveExpansion({ left, top, width, height, workspaceWidth: size.width, workspaceHeight: size.height });
    if (growth.addWidth || growth.addHeight) setWorkspaceSize(size.width + growth.addWidth, size.height + growth.addHeight);

    block.style.left = `${left}px`;
    block.style.top = `${top}px`;
  };

  const pan = () => {
    if (!active) return;
    const { dx, dy } = edgePanDelta({
      clientX,
      clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    });
    if (dx || dy) {
      const beforeX = window.scrollX;
      const beforeY = window.scrollY;
      window.scrollBy(dx, dy);
      // Pointer capture keeps the object in our drag session. Reposition from
      // the scroll delta so it remains in the user's hand while the viewport
      // travels across the canvas, even if the pointer itself is held still.
      if (window.scrollX !== beforeX || window.scrollY !== beforeY) placeBlock();
    }
    panFrame = requestAnimationFrame(pan);
  };

  const move = (moveEvent) => {
    clientX = moveEvent.clientX;
    clientY = moveEvent.clientY;
    placeBlock();
  };

  const finish = () => {
    active = false;
    if (panFrame) cancelAnimationFrame(panFrame);
    handle.classList.remove("is-dragging");
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", finish);
    handle.removeEventListener("pointercancel", finish);
    workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
  };

  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  panFrame = requestAnimationFrame(pan);
}

function initializeSpatialRunway() {
  if (!workspace || workspace.dataset.spatialRunwayInitialized === "true") return;
  workspace.dataset.spatialRunwayInitialized = "true";

  // Preallocate room before the logical origin ONCE. Because this never changes
  // during a drag, moving left/up cannot trigger a layout jump or rebase.
  workspace.style.marginLeft = `${WORKSPACE_NEGATIVE_RUNWAY}px`;
  workspace.style.marginTop = `${WORKSPACE_NEGATIVE_RUNWAY}px`;

  requestAnimationFrame(() => {
    window.scrollBy(WORKSPACE_NEGATIVE_RUNWAY, WORKSPACE_NEGATIVE_RUNWAY);
  });
}

initializeSpatialRunway();

// This capture-phase owner intentionally replaces the older block-drag handlers
// for the two visible drag surfaces. Dragging is spatially free in every mode:
// edge panning navigates and measured expansion keeps every placed object reachable.
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !workspace) return;
    const compact = event.target.closest?.(".compact-drag-handle");
    const header = event.target.closest?.(".block-header");
    const handle = compact || header;
    if (!handle) return;
    if (header && !compact && event.target.closest?.("input, button, select, textarea, a")) return;
    const block = handle.closest?.(".block");
    if (!block || block.classList.contains("is-maximized")) return;
    beginMeasuredBlockDrag(event, block, handle);
  }, true);
}
