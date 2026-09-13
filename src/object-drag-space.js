import { isViewportFixed } from "./viewport-fix.js";
import { edgePanDelta, WORKSPACE_EXPANSION_STEP, WORKSPACE_EDGE_MARGIN } from "./workspace-extent.js";

function number(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function growPositiveEdges(workspace, left, top, width, height) {
  let workspaceWidth = Math.max(workspace.offsetWidth, number(workspace.style.width, 2400));
  let workspaceHeight = Math.max(workspace.offsetHeight, number(workspace.style.height, 1600));
  let changed = false;

  while (left + width > workspaceWidth - WORKSPACE_EDGE_MARGIN) {
    workspaceWidth += WORKSPACE_EXPANSION_STEP;
    changed = true;
  }
  while (top + height > workspaceHeight - WORKSPACE_EDGE_MARGIN) {
    workspaceHeight += WORKSPACE_EXPANSION_STEP;
    changed = true;
  }

  if (changed) {
    workspace.style.width = `${workspaceWidth}px`;
    workspace.style.height = `${workspaceHeight}px`;
  }
}

function growNegativeEdge(workspace, axis, amount) {
  const growth = Math.max(0, Number(amount) || 0);
  if (!growth) return 0;

  const property = axis === "x" ? "marginLeft" : "marginTop";
  const current = number(workspace.style[property], 0);

  // This is an intentional canvas pan, not a rebase. Grow only by the tiny
  // edge-pan delta and DO NOT scroll the browser to "cancel" it. Existing
  // objects therefore drift smoothly with the canvas while the dragged object
  // is counter-adjusted by the same amount and stays under the pointer.
  workspace.style[property] = `${current + growth}px`;
  workspace.dataset.expandedOrigin = "true";
  document.body.dataset.framechuteExpandableCanvas = "true";
  return growth;
}

function atRightScrollLimit() {
  const root = document.documentElement;
  return window.scrollX + window.innerWidth >= root.scrollWidth - 2;
}

function atBottomScrollLimit() {
  const root = document.documentElement;
  return window.scrollY + window.innerHeight >= root.scrollHeight - 2;
}

function growForPositiveEdgePan(workspace, dx, dy) {
  let width = Math.max(workspace.offsetWidth, number(workspace.style.width, 2400));
  let height = Math.max(workspace.offsetHeight, number(workspace.style.height, 1600));
  let changed = false;

  if (dx > 0 && atRightScrollLimit()) {
    width += WORKSPACE_EXPANSION_STEP;
    changed = true;
  }
  if (dy > 0 && atBottomScrollLimit()) {
    height += WORKSPACE_EXPANSION_STEP;
    changed = true;
  }

  if (changed) {
    workspace.style.width = `${width}px`;
    workspace.style.height = `${height}px`;
    void workspace.offsetWidth;
  }

  return changed;
}

export function createObjectDragSession({ workspace, block, event, startLeft, startTop }) {
  const viewportFixed = isViewportFixed(block);
  const expandable = !viewportFixed && document.body.classList.contains("toolbar-hidden");

  const startX = event.clientX;
  const startY = event.clientY;
  const startScrollX = window.scrollX;
  const startScrollY = window.scrollY;
  const rect = block.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  let clientX = startX;
  let clientY = startY;
  let originGrowthX = 0;
  let originGrowthY = 0;
  let active = true;
  let panFrame = 0;

  const place = () => {
    if (viewportFixed) {
      const margin = 8;
      const rawLeft = startLeft + clientX - startX;
      const rawTop = startTop + clientY - startY;
      const maxLeft = Math.max(margin, window.innerWidth - width - margin);
      const maxTop = Math.max(margin, window.innerHeight - height - margin);
      block.style.left = `${Math.min(Math.max(rawLeft, margin), maxLeft)}px`;
      block.style.top = `${Math.min(Math.max(rawTop, margin), maxTop)}px`;
      return;
    }

    const scrollDx = expandable ? window.scrollX - startScrollX : 0;
    const scrollDy = expandable ? window.scrollY - startScrollY : 0;
    const left = startLeft + clientX - startX + scrollDx - originGrowthX;
    const top = startTop + clientY - startY + scrollDy - originGrowthY;

    if (expandable && document.body.classList.contains("toolbar-hidden")) {
      growPositiveEdges(workspace, left, top, width, height);
    }

    block.style.left = `${left}px`;
    block.style.top = `${top}px`;
  };

  const pan = () => {
    if (!active) return;

    if (expandable && document.body.classList.contains("toolbar-hidden")) {
      const { dx, dy } = edgePanDelta({
        clientX,
        clientY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        allowPastOrigin: true
      });

      if (dx || dy) {
        let scrollDx = dx;
        let scrollDy = dy;

        // At the browser's left/top origin there is no negative scroll range.
        // Instead, grow the canvas origin by only this frame's pan amount.
        // Crucially: no giant runway and no scroll-compensation jump.
        if (dx < 0 && window.scrollX <= 0) {
          originGrowthX += growNegativeEdge(workspace, "x", -dx);
          scrollDx = 0;
        }
        if (dy < 0 && window.scrollY <= 0) {
          originGrowthY += growNegativeEdge(workspace, "y", -dy);
          scrollDy = 0;
        }

        growForPositiveEdgePan(workspace, scrollDx, scrollDy);

        if (scrollDx || scrollDy) {
          window.scrollBy(scrollDx, scrollDy);
        }

        // Keep the grabbed object under the pointer after either real browser
        // scrolling or logical left/top canvas growth.
        place();
      }
    }

    panFrame = requestAnimationFrame(pan);
  };

  if (expandable) panFrame = requestAnimationFrame(pan);

  return {
    move(moveEvent) {
      clientX = moveEvent.clientX;
      clientY = moveEvent.clientY;
      place();
    },
    finish() {
      active = false;
      if (panFrame) cancelAnimationFrame(panFrame);
    }
  };
}
