const workspace = document.querySelector("#workspace");
const toolbar = document.querySelector(".toolbar");

if (workspace) {
  const BASE_WIDTH = 2400;
  const BASE_HEIGHT = 1600;
  const EXTENT_PADDING = 180;

  const style = document.createElement("style");
  style.textContent = `
    html[data-framechute-offscreen="true"],
    html[data-framechute-offscreen="true"] body {
      overflow: auto !important;
      overscroll-behavior: auto;
    }

    #workspace.framechute-scroll-reachable {
      overflow: visible !important;
    }

    /* Left/up canvas growth is represented by a real document-space origin
       gutter. Blocks may keep negative workspace coordinates while the page
       still has ordinary scrollable pixels to reach them. */
    #workspace.framechute-expanded-origin::before {
      content: "";
      position: absolute;
      pointer-events: none;
      z-index: 0;
      left: calc(-1 * var(--framechute-origin-left, 0px));
      top: calc(-1 * var(--framechute-origin-top, 0px));
      width: calc(100% + var(--framechute-origin-left, 0px));
      height: calc(100% + var(--framechute-origin-top, 0px));
      background-image:
        linear-gradient(color-mix(in srgb, CanvasText 4%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, CanvasText 4%, transparent) 1px, transparent 1px);
      background-size: 24px 24px;
    }
  `;
  document.head.append(style);

  let frame = 0;
  let gestureActive = false;

  function number(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toolbarBottom() {
    if (!toolbar || document.body.classList.contains("toolbar-hidden")) return 0;
    const rect = toolbar.getBoundingClientRect();
    return rect.height > 0 ? rect.bottom : 0;
  }

  function originLeft() {
    return Math.max(0, number(workspace.dataset.framechuteOriginLeft, 0));
  }

  function originTop() {
    return Math.max(0, number(workspace.dataset.framechuteOriginTop, 0));
  }

  function applyOrigin(nextLeft, nextTop, { preserveViewport = false } = {}) {
    const previousLeft = originLeft();
    const previousTop = originTop();
    const left = Math.max(previousLeft, Math.ceil(nextLeft || 0));
    const top = Math.max(previousTop, Math.ceil(nextTop || 0));
    const dx = left - previousLeft;
    const dy = top - previousTop;

    if (!dx && !dy) return false;

    workspace.dataset.framechuteOriginLeft = String(left);
    workspace.dataset.framechuteOriginTop = String(top);
    workspace.style.marginLeft = `${left}px`;
    workspace.style.marginTop = `${top}px`;
    workspace.style.setProperty("--framechute-origin-left", `${left}px`);
    workspace.style.setProperty("--framechute-origin-top", `${top}px`);
    workspace.classList.toggle("framechute-expanded-origin", left > 0 || top > 0);

    // Growing the origin moves the workspace in document coordinates. During
    // a live drag, compensate the page scroll by the exact same amount so the
    // object remains visually under the pointer instead of jumping inward.
    if (preserveViewport && (dx || dy)) window.scrollBy(dx, dy);
    return true;
  }

  function measureExtents(blocks) {
    let minLeft = 0;
    let minTop = 0;
    let maxRight = BASE_WIDTH;
    let maxBottom = BASE_HEIGHT;

    for (const block of blocks) {
      const left = number(block.style.left, block.offsetLeft);
      const top = number(block.style.top, block.offsetTop);
      const width = Math.max(block.offsetWidth, number(block.style.width, 0));
      const height = Math.max(block.offsetHeight, number(block.style.height, 0));
      minLeft = Math.min(minLeft, left);
      minTop = Math.min(minTop, top);
      maxRight = Math.max(maxRight, left + width);
      maxBottom = Math.max(maxBottom, top + height);
    }

    return { minLeft, minTop, maxRight, maxBottom };
  }

  function updateReachability({ allowExpansion = false, recoverExisting = false } = {}) {
    frame = 0;
    const blocks = [...workspace.querySelectorAll(".block")];
    const stableWidth = Math.max(BASE_WIDTH, number(workspace.style.width, BASE_WIDTH), window.innerWidth);
    const stableHeight = Math.max(BASE_HEIGHT, number(workspace.style.height, BASE_HEIGHT), window.innerHeight);
    const { minLeft, minTop, maxRight, maxBottom } = measureExtents(blocks);
    const mayGrow = allowExpansion || recoverExisting;
    let changed = false;

    // Toolbar-visible mode intentionally does not manufacture new canvas from
    // an ordinary drag. Hidden-toolbar direct manipulation does. Recovery is
    // also allowed when blocks are restored so previously off-canvas work is
    // always reachable through normal scrollbars.
    if (mayGrow) {
      const desiredOriginLeft = minLeft < 0 ? -minLeft + EXTENT_PADDING : originLeft();
      const desiredOriginTop = minTop < 0 ? -minTop + EXTENT_PADDING : originTop();
      changed = applyOrigin(desiredOriginLeft, desiredOriginTop, {
        preserveViewport: allowExpansion
      }) || changed;

      const horizontalTail = Math.max(EXTENT_PADDING, window.innerWidth);
      const verticalTail = Math.max(EXTENT_PADDING, window.innerHeight);
      const nextWidth = Math.max(stableWidth, maxRight + horizontalTail);
      const nextHeight = Math.max(stableHeight, maxBottom + verticalTail);
      if (nextWidth > stableWidth) {
        workspace.style.width = `${Math.ceil(nextWidth)}px`;
        changed = true;
      }
      if (nextHeight > stableHeight) {
        workspace.style.height = `${Math.ceil(nextHeight)}px`;
        changed = true;
      }
    }

    let anyOffscreen = false;
    for (const block of blocks) {
      const rect = block.getBoundingClientRect();
      if (
        rect.right > window.innerWidth ||
        rect.bottom > window.innerHeight ||
        rect.left < 0 ||
        rect.top < toolbarBottom()
      ) {
        anyOffscreen = true;
        break;
      }
    }

    workspace.classList.toggle("framechute-scroll-reachable", anyOffscreen || originLeft() > 0 || originTop() > 0);
    document.documentElement.dataset.framechuteOffscreen = anyOffscreen ? "true" : "false";

    if (changed) {
      workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed", { bubbles: true }));
    }
  }

  function schedule(options = {}) {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => updateReachability(options));
  }

  function expansionAllowedNow() {
    return gestureActive && document.body.classList.contains("toolbar-hidden");
  }

  // With the top toolbar hidden, grabbing a block turns edge crossing into an
  // intentional infinite-canvas gesture. With the toolbar visible, this path
  // never grows the canvas; existing scrollbars remain available for travel.
  workspace.addEventListener("pointerdown", event => {
    gestureActive = Boolean(event.target.closest?.(".block"));
  }, true);
  workspace.addEventListener("pointermove", () => {
    schedule({ allowExpansion: expansionAllowedNow() });
  }, true);
  document.addEventListener("pointerup", () => {
    const allowExpansion = expansionAllowedNow();
    gestureActive = false;
    schedule({ allowExpansion });
  }, true);
  document.addEventListener("pointercancel", () => {
    const allowExpansion = expansionAllowedNow();
    gestureActive = false;
    schedule({ allowExpansion });
  }, true);

  // Viewport changes never rewrite object coordinates or manufacture canvas.
  window.addEventListener("resize", () => schedule());
  window.addEventListener("scroll", () => schedule(), { passive: true });
  window.addEventListener("flashframe:rescue-reachability", () => schedule({ recoverExisting: true }));

  if (toolbar) {
    new ResizeObserver(() => schedule()).observe(toolbar);
  }

  const resizeObserver = new ResizeObserver(() => schedule({ allowExpansion: expansionAllowedNow() }));
  const observeBlocks = () => {
    for (const block of workspace.querySelectorAll(".block")) {
      if (block.dataset.offscreenObserved === "true") continue;
      block.dataset.offscreenObserved = "true";
      resizeObserver.observe(block);
    }
  };

  const blockObserver = new MutationObserver(() => {
    observeBlocks();
    // A restored/imported block may already live beyond the default origin or
    // extent. Recover that existing canvas without treating toolbar-visible
    // dragging as permission to create new space.
    schedule({ recoverExisting: true });
  });
  blockObserver.observe(workspace, { childList: true });

  observeBlocks();
  schedule({ recoverExisting: true });
}
