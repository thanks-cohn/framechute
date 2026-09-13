import { edgePanDelta, WORKSPACE_EXPANSION_STEP, WORKSPACE_EDGE_MARGIN } from "./workspace-extent.js";

const NEGATIVE_RUNWAY = 4096;

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
  const width = Math.max(workspace.offsetWidth, number(workspace.style.width, 2400));
  const height = Math.max(workspace.offsetHeight, number(workspace.style.height, 1600));

  // Hidden-toolbar mode gets scrollable room before the normal origin.
  // This happens only once, at the beginning of a drag. The matching scroll
  // cancels the margin shift, so existing objects do not move on screen.
  workspace.style.marginLeft = `${marginLeft + NEGATIVE_RUNWAY}px`;
  workspace.style.marginTop = `${marginTop + NEGATIVE_RUNWAY}px`;
  workspace.style.width = `${width + NEGATIVE_RUNWAY}px`;
  workspace.style.height = `${height + NEGATIVE_RUNWAY}px`;

  window.scrollBy(NEGATIVE_RUNWAY, NEGATIVE_RUNWAY);
  workspace.dataset.hiddenToolbarRunway = "true";
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
        const beforeX = window.scrollX;
        const beforeY = window.scrollY;
        window.scrollBy(dx, dy);
        if (window.scrollX !== beforeX || window.scrollY !== beforeY) place();
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
