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

  function updateReachability() {
    frame = 0;
    const blocks = [...workspace.querySelectorAll(".block")];
    const stableWidth = Math.max(BASE_WIDTH, number(workspace.style.width, BASE_WIDTH), window.innerWidth);
    const stableHeight = Math.max(BASE_HEIGHT, number(workspace.style.height, BASE_HEIGHT), window.innerHeight);
    let maxRight = BASE_WIDTH;
    let maxBottom = BASE_HEIGHT;
    let anyOffscreen = false;

    // Leave at least one viewport of empty canvas after the furthest object so
    // users can scroll completely past artwork without moving the artwork.
    const horizontalTail = Math.max(EXTENT_PADDING, window.innerWidth);
    const verticalTail = Math.max(EXTENT_PADDING, window.innerHeight);

    for (const block of blocks) {
      const left = number(block.style.left, block.offsetLeft);
      const top = number(block.style.top, block.offsetTop);
      const width = Math.max(block.offsetWidth, number(block.style.width, 0));
      const height = Math.max(block.offsetHeight, number(block.style.height, 0));
      maxRight = Math.max(maxRight, left + width + horizontalTail);
      maxBottom = Math.max(maxBottom, top + height + verticalTail);

      const rect = block.getBoundingClientRect();
      if (
        rect.right > window.innerWidth ||
        rect.bottom > window.innerHeight ||
        rect.left < 0 ||
        rect.top < toolbarBottom()
      ) {
        anyOffscreen = true;
      }
    }

    workspace.style.width = `${Math.ceil(gestureActive ? Math.max(stableWidth, maxRight) : stableWidth)}px`;
    workspace.style.height = `${Math.ceil(gestureActive ? Math.max(stableHeight, maxBottom) : stableHeight)}px`;
    workspace.classList.toggle("framechute-scroll-reachable", anyOffscreen);
    document.documentElement.dataset.framechuteOffscreen = anyOffscreen ? "true" : "false";
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateReachability);
  }

  // Grow scrollable reachability around direct gestures, but never rewrite a
  // block's coordinates to make its header visible. Explicit Show Header is the
  // only command allowed to reposition an object for rescue.
  workspace.addEventListener("pointerdown", event => { gestureActive = Boolean(event.target.closest?.(".block")); }, true);
  workspace.addEventListener("pointermove", () => schedule(), true);
  document.addEventListener("pointerup", () => { gestureActive = false; schedule(); }, true);
  document.addEventListener("pointercancel", () => { gestureActive = false; schedule(); }, true);

  // Viewport changes must never rewrite artwork coordinates.
  window.addEventListener("resize", () => schedule());
  window.addEventListener("scroll", () => schedule(), { passive: true });
  window.addEventListener("flashframe:rescue-reachability", () => schedule());

  if (toolbar) {
    new ResizeObserver(() => schedule()).observe(toolbar);
  }

  const mutations = new MutationObserver(() => schedule());
  mutations.observe(workspace, { childList: true });

  const resizeObserver = new ResizeObserver(() => schedule());
  const observeBlocks = () => {
    for (const block of workspace.querySelectorAll(".block")) {
      if (block.dataset.offscreenObserved === "true") continue;
      block.dataset.offscreenObserved = "true";
      resizeObserver.observe(block);
    }
  };

  const blockObserver = new MutationObserver(() => {
    observeBlocks();
    schedule();
  });
  blockObserver.observe(workspace, { childList: true });

  observeBlocks();
  schedule();
}
