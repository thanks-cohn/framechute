const workspace = typeof document !== "undefined" ? document.querySelector("#workspace") : null;

export const WORKSPACE_EXPANSION_STEP = 640;
export const WORKSPACE_EDGE_MARGIN = 96;
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

function workspaceOrigin(axis) {
  const property = axis === "x" ? "marginLeft" : "marginTop";
  return Math.max(0, numericStyle(workspace, property, 0));
}

function expandNegativeEdge(axis) {
  // Grow empty canvas BEFORE the logical workspace origin. Do not rewrite any
  // block coordinates. Scrolling by the same amount keeps every object visually
  // stationary while giving the user new reachable space to the left/up.
  if (axis === "x") {
    const next = workspaceOrigin("x") + WORKSPACE_EXPANSION_STEP;
    workspace.style.marginLeft = `${next}px`;
    window.scrollBy(WORKSPACE_EXPANSION_STEP, 0);
    return WORKSPACE_EXPANSION_STEP;
  }

  const next = workspaceOrigin("y") + WORKSPACE_EXPANSION_STEP;
  workspace.style.marginTop = `${next}px`;
  window.scrollBy(0, WORKSPACE_EXPANSION_STEP);
  return WORKSPACE_EXPANSION_STEP;
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
  let originGrowthX = 0;
  let originGrowthY = 0;
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
    // Browser scroll created by origin growth is compensation, not user motion.
    // Subtract it so the logical object coordinate never jumps when more canvas
    // is created to the left/top.
    let left = startLeft + (clientX - startClientX) + (window.scrollX - startScrollX) - originGrowthX;
    let top = startTop + (clientY - startClientY) + (window.scrollY - startScrollY) - originGrowthY;

    // Allow genuine negative logical coordinates. Only add physical gutter when
    // the object would otherwise cross beyond the browser's scrollable origin.
    while (workspaceOrigin("x") + left < WORKSPACE_EDGE_MARGIN) {
      originGrowthX += expandNegativeEdge("x");
    }
    while (workspaceOrigin("y") + top < WORKSPACE_EDGE_MARGIN) {
      originGrowthY += expandNegativeEdge("y");
    }

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
