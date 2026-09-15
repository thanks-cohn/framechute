const VIEWPORT_MARGIN = 10;

function numberFromStyle(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function visibleToolbarBottom() {
  const toolbar = document.querySelector(".toolbar");
  if (!(toolbar instanceof HTMLElement)) return 0;
  const style = getComputedStyle(toolbar);
  if (style.display === "none" || style.visibility === "hidden") return 0;
  const rect = toolbar.getBoundingClientRect();
  return rect.height > 0 && rect.bottom > 0 ? rect.bottom : 0;
}

function nextObjectZ(workspace, block) {
  let max = 1;
  for (const candidate of workspace.querySelectorAll(":scope > .block")) {
    if (candidate === block) continue;
    const value = Number.parseInt(candidate.style.zIndex, 10);
    if (Number.isFinite(value)) max = Math.max(max, value);
  }
  return max + 1;
}

function revealOpeningChrome(block) {
  const header = block.querySelector(":scope > .block-header");
  if (header) {
    block.classList.remove("hide-object-header", "is-object-chrome-faded");
    block.classList.add("show-object-header");
  }

  // Document editing bars live beneath their headers but are not object
  // footers. In particular, DOCX owns its own auto-hide lifecycle.
  const footer = block.querySelector(
    ":scope > .block-toolbar:not(.docx-toolbar):not(.pdf-toolbar), " +
    ":scope > .source-toolbar, :scope > .gallery-toolbar, :scope > .web-toolbar"
  );
  if (footer) {
    block.classList.remove("hide-object-footer", "is-object-chrome-faded");
    block.classList.add("show-object-footer");
    footer.hidden = false;
  }
}

function moveByClientDelta(block, dx, dy) {
  if (dx) {
    const left = numberFromStyle(block.style.left, block.offsetLeft);
    block.style.left = `${left + dx}px`;
  }
  if (dy) {
    const top = numberFromStyle(block.style.top, block.offsetTop);
    block.style.top = `${top + dy}px`;
  }
}

/**
 * Give a newly opened FrameChute object a safe starting geometry.
 * This is intentionally one-shot placement, not viewport pinning: after this
 * runs the user may resize, move, maximize, or take the object off-screen.
 */
export function fitOpenedBlock(block, { revealChrome = true, bringFront = true } = {}) {
  if (!(block instanceof HTMLElement) || !block.isConnected || !block.classList.contains("block")) return;

  const workspace = block.closest("#workspace");
  if (!(workspace instanceof HTMLElement)) return;

  if (revealChrome) revealOpeningChrome(block);
  if (bringFront) block.style.zIndex = String(nextObjectZ(workspace, block));

  const fit = () => {
    if (!block.isConnected || block.classList.contains("is-viewport-fixed")) return;

    const topBoundary = Math.min(
      window.innerHeight - VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, visibleToolbarBottom() + VIEWPORT_MARGIN)
    );
    const leftBoundary = VIEWPORT_MARGIN;
    const rightBoundary = Math.max(leftBoundary + 1, window.innerWidth - VIEWPORT_MARGIN);
    const bottomBoundary = Math.max(topBoundary + 1, window.innerHeight - VIEWPORT_MARGIN);
    const availableWidth = Math.max(1, rightBoundary - leftBoundary);
    const availableHeight = Math.max(1, bottomBoundary - topBoundary);

    let rect = block.getBoundingClientRect();

    // Preserve the object's intended size whenever it already fits. Oversized
    // newly opened objects start smaller so both their header and bottom edge
    // are reachable without scrolling.
    if (rect.width > availableWidth) block.style.width = `${availableWidth}px`;
    if (rect.height > availableHeight) block.style.height = `${availableHeight}px`;

    rect = block.getBoundingClientRect();

    let targetLeft = rect.left;
    let targetTop = rect.top;

    if (rect.width <= availableWidth) {
      targetLeft = Math.min(Math.max(rect.left, leftBoundary), rightBoundary - rect.width);
    } else {
      targetLeft = leftBoundary;
    }

    if (rect.height <= availableHeight) {
      targetTop = Math.min(Math.max(rect.top, topBoundary), bottomBoundary - rect.height);
    } else {
      targetTop = topBoundary;
    }

    moveByClientDelta(block, targetLeft - rect.left, targetTop - rect.top);
    block.dataset.initialViewportFit = "true";

    workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
  };

  // One frame lets late-loaded fonts/chrome settle; the second pass catches a
  // footer/header inserted by another synchronous object enhancer.
  requestAnimationFrame(() => {
    fit();
    requestAnimationFrame(fit);
  });
}
