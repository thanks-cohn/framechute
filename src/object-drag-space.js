import { edgePanDelta, WORKSPACE_EXPANSION_STEP, WORKSPACE_EDGE_MARGIN } from "./workspace-extent.js";

const NEGATIVE_RUNWAY = 8192;

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

function ensureNegativeRunway(workspace) {
  if (workspace.dataset.hiddenToolbarRunway === "true") return;

  const marginLeft = number(workspace.style.marginLeft, 0);
  const marginTop = number(workspace.style.marginTop, 0);

  // Hidden-toolbar mode gets real scrollable room before the normal origin.
  // Keep the logical workspace size unchanged here; the matching scroll cancels
  // the margin shift so existing objects remain visually stationary.
  workspace.style.marginLeft = `${marginLeft + NEGATIVE_RUNWAY}px`;
  workspace.style.marginTop = `${marginTop + NEGATIVE_RUNWAY}px`;

  // Force layout before compensating the newly-created left/top extent.
  void workspace.offsetWidth;
  window.scrollBy(NEGATIVE_RUNWAY, NEGATIVE_RUNWAY);

  workspace.dataset.hiddenToolbarRunway = "true";
  document.body.dataset.framechuteExpandableCanvas = "true";
}

function atRightScrollLimit() {
  const root=document.documentElement;
  return window.scrollX + window.innerWidth >= root.scrollWidth - 2;
}

function atBottomScrollLimit() {
  const root=document.documentElement;
  return window.scrollY + window.innerHeight >= root.scrollHeight - 2;
}

function growForEdgePan(workspace, dx, dy) {
  let width=Math.max(workspace.offsetWidth, number(workspace.style.width, 2400));
  let height=Math.max(workspace.offsetHeight, number(workspace.style.height, 1600));
  let changed=false;

  // When the pointer is parked at an edge, pointermove may stop firing. Grow
  // the canvas from the animation loop itself once browser scrolling reaches
  // the current document limit, then scrolling can continue.
  if(dx>0 && atRightScrollLimit()) {
    width += WORKSPACE_EXPANSION_STEP;
    changed=true;
  }
  if(dy>0 && atBottomScrollLimit()) {
    height += WORKSPACE_EXPANSION_STEP;
    changed=true;
  }

  if(changed) {
    workspace.style.width=`${width}px`;
    workspace.style.height=`${height}px`;
    // Ensure the new scroll extent is committed before the next scrollBy.
    void workspace.offsetWidth;
  }

  return changed;
}

export function createObjectDragSession({ workspace, block, event, startLeft, startTop }) {
  const expandable = document.body.classList.contains("toolbar-hidden");

  if (expandable) ensureNegativeRunway(workspace);

  const startX = event.clientX;
  const startY = event.clientY;
  const startScrollX = window.scrollX;
  const startScrollY = window.scrollY;
  const rect = block.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  let clientX = startX;
  let clientY = startY;
  let active = true;
  let panFrame = 0;

  const place = () => {
    const scrollDx = expandable ? window.scrollX - startScrollX : 0;
    const scrollDy = expandable ? window.scrollY - startScrollY : 0;
    const left = startLeft + clientX - startX + scrollDx;
    const top = startTop + clientY - startY + scrollDy;

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
        scrollY: window.scrollY
      });

      if (dx || dy) {
        // If scrolling has reached the current right/bottom edge, create more
        // canvas first. This is what lets holding an object at the viewport edge
        // continuously extend the hidden-toolbar workspace.
        growForEdgePan(workspace, dx, dy);

        const beforeX = window.scrollX;
        const beforeY = window.scrollY;
        window.scrollBy(dx, dy);

        // Re-place on every requested edge-pan frame, even when a particular
        // scrollBy was clamped. The growth step above may just have created new
        // space and place() also keeps positive extents caught up with the block.
        place();

        if (window.scrollX === beforeX && window.scrollY === beforeY) {
          growForEdgePan(workspace, dx, dy);
        }
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
