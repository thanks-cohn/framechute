const workspace = document.querySelector("#workspace");

export const WORKSPACE_EXPANSION_STEP = 640;
export const WORKSPACE_EDGE_MARGIN = 96;

export function clampBlockToExtent({ left, top, width, height, workspaceWidth, workspaceHeight }) {
  return {
    left: Math.max(0, Math.min(left, Math.max(0, workspaceWidth - width))),
    top: Math.max(0, Math.min(top, Math.max(0, workspaceHeight - height)))
  };
}

export function requiredPositiveExpansion({ left, top, width, height, workspaceWidth, workspaceHeight, margin = WORKSPACE_EDGE_MARGIN, step = WORKSPACE_EXPANSION_STEP }) {
  let addWidth = 0;
  let addHeight = 0;
  while (left + width > workspaceWidth + addWidth - margin) addWidth += step;
  while (top + height > workspaceHeight + addHeight - margin) addHeight += step;
  return { addWidth, addHeight };
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

function shiftAllBlocks(dx, dy) {
  if (!dx && !dy) return;
  for (const block of workspace.querySelectorAll(":scope > .block")) {
    const left = numericStyle(block, "left", block.offsetLeft);
    const top = numericStyle(block, "top", block.offsetTop);
    if (dx) block.style.left = `${left + dx}px`;
    if (dy) block.style.top = `${top + dy}px`;
  }
}

function expandNegativeEdge(axis) {
  const size = workspaceSize();
  if (axis === "x") {
    shiftAllBlocks(WORKSPACE_EXPANSION_STEP, 0);
    setWorkspaceSize(size.width + WORKSPACE_EXPANSION_STEP, size.height);
    window.scrollBy(WORKSPACE_EXPANSION_STEP, 0);
  } else {
    shiftAllBlocks(0, WORKSPACE_EXPANSION_STEP);
    setWorkspaceSize(size.width, size.height + WORKSPACE_EXPANSION_STEP);
    window.scrollBy(0, WORKSPACE_EXPANSION_STEP);
  }
}

function maybeAutoScroll(event) {
  if (!document.body.classList.contains("toolbar-hidden")) return;
  const edge = 36;
  const speed = 28;
  let dx = 0;
  let dy = 0;
  if (event.clientX < edge && window.scrollX > 0) dx = -speed;
  else if (event.clientX > innerWidth - edge) dx = speed;
  if (event.clientY < edge && window.scrollY > 0) dy = -speed;
  else if (event.clientY > innerHeight - edge) dy = speed;
  if (dx || dy) window.scrollBy(dx, dy);
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

  handle.classList.add("is-dragging");
  handle.setPointerCapture?.(event.pointerId);

  const move = (moveEvent) => {
    maybeAutoScroll(moveEvent);

    let left = startLeft + (moveEvent.clientX - startClientX) + (window.scrollX - startScrollX);
    let top = startTop + (moveEvent.clientY - startClientY) + (window.scrollY - startScrollY);

    if (!document.body.classList.contains("toolbar-hidden")) {
      // Toolbar visible = bounded desk. Its current dimensions are frozen; users
      // can scroll around that whole fixed canvas, but moving an object cannot
      // create more canvas.
      const size = workspaceSize();
      const point = clampBlockToExtent({ left, top, width, height, workspaceWidth: size.width, workspaceHeight: size.height });
      left = point.left;
      top = point.top;
    } else {
      // Toolbar hidden = measured expandable canvas. Crossing any edge creates
      // another fixed-size slab of desk. Left/top expansion shifts the origin
      // and scroll position together so existing objects do not visually jump.
      while (left < WORKSPACE_EDGE_MARGIN) {
        expandNegativeEdge("x");
        left += WORKSPACE_EXPANSION_STEP;
      }
      while (top < WORKSPACE_EDGE_MARGIN) {
        expandNegativeEdge("y");
        top += WORKSPACE_EXPANSION_STEP;
      }

      const size = workspaceSize();
      const growth = requiredPositiveExpansion({ left, top, width, height, workspaceWidth: size.width, workspaceHeight: size.height });
      if (growth.addWidth || growth.addHeight) setWorkspaceSize(size.width + growth.addWidth, size.height + growth.addHeight);
    }

    block.style.left = `${left}px`;
    block.style.top = `${top}px`;
  };

  const finish = () => {
    handle.classList.remove("is-dragging");
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", finish);
    handle.removeEventListener("pointercancel", finish);
    workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
  };

  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
}

// This capture-phase owner intentionally replaces the older block-drag handlers
// for the two visible drag surfaces. It is what enforces the product rule:
// toolbar visible = fixed extent; toolbar hidden = drag-to-expand extent.
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
