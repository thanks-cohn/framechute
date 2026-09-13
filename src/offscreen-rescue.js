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
      scroll-behavior: auto !important;
      overflow-anchor: none;
    }

    #workspace.framechute-scroll-reachable {
      overflow-anchor: none;
      overflow: visible !important;
    }
  `;
  document.head.append(style);

  let frame = 0;

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

    workspace.classList.toggle("framechute-scroll-reachable", anyOffscreen);
    document.documentElement.dataset.framechuteOffscreen = anyOffscreen ? "true" : "false";
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateReachability);
  }

  // Passive only: this module may expose browser scrollbars, but it never
  // changes workspace size, scroll position, or any block coordinate.
  workspace.addEventListener("pointermove", () => schedule(), true);
  document.addEventListener("pointerup", () => schedule(), true);
  document.addEventListener("pointercancel", () => schedule(), true);

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
