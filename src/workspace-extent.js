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

// IMPORTANT:
// This module is intentionally side-effect-free.
// It must never install pointer handlers, move blocks, change workspace margins,
// resize the workspace, or scroll the browser. Runtime block dragging belongs
// exclusively to workspace.js / controls.js.
