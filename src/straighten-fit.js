import { rotationContainScale } from "./actions/image-display-size.mjs";

const workspace = typeof document !== "undefined" ? document.querySelector("#workspace") : null;
const fitState = new WeakMap();
const rotatePattern = /rotate\(\s*(-?(?:\d+(?:\.\d+)?|\.\d+))deg\s*\)/i;

function rotationFromTransform(transform) {
  const match = rotatePattern.exec(String(transform || ""));
  return match ? Number.parseFloat(match[1]) : 0;
}

function fitImage(image, force = false) {
  if (!(image instanceof HTMLImageElement) || !image.classList.contains("image-frame")) return;

  const previous = fitState.get(image);
  const current = image.style.transform || "";
  // If this is our own composed transform, retain the original transform as
  // the source of truth. Any other inline transform is a fresh Quick Actions
  // transform and becomes the new base.
  const base = previous && current === previous.applied ? previous.base : current;
  if (!force && previous && current === previous.applied && previous.base === base) return;

  const width = image.offsetWidth;
  const height = image.offsetHeight;
  if (!(width > 0 && height > 0)) return;

  const degrees = rotationFromTransform(base);
  const scale = rotationContainScale(width, height, degrees);
  const applied = scale < 0.999999
    ? `${base} scale(${scale.toFixed(6)})`.trim()
    : base;

  fitState.set(image, { base, applied, degrees, width, height });
  image.dataset.framechuteTransformFit = scale.toFixed(6);
  image.style.transformOrigin = "center center";
  if (current !== applied) image.style.transform = applied;
}

function fitAll(force = false) {
  if (!workspace) return;
  for (const image of workspace.querySelectorAll("img.image-frame")) fitImage(image, force);
}

if (workspace) {
  const mutations = new MutationObserver((records) => {
    const pending = new Set();
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof HTMLImageElement && record.target.classList.contains("image-frame")) {
        pending.add(record.target);
      }
      for (const node of record.addedNodes || []) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.("img.image-frame")) pending.add(node);
        for (const image of node.querySelectorAll?.("img.image-frame") || []) pending.add(image);
      }
    }
    for (const image of pending) fitImage(image);
  });
  mutations.observe(workspace, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });

  const resize = typeof ResizeObserver === "function" ? new ResizeObserver((entries) => {
    for (const entry of entries) if (entry.target instanceof HTMLImageElement) fitImage(entry.target, true);
  }) : null;

  const observeExisting = () => {
    for (const image of workspace.querySelectorAll("img.image-frame")) {
      resize?.observe(image);
      fitImage(image, true);
    }
  };
  observeExisting();

  const additions = new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes || []) {
      if (!(node instanceof HTMLElement)) continue;
      const images = node.matches?.("img.image-frame") ? [node] : [...(node.querySelectorAll?.("img.image-frame") || [])];
      for (const image of images) {
        resize?.observe(image);
        fitImage(image, true);
      }
    }
  });
  additions.observe(workspace, { childList: true, subtree: true });

  window.addEventListener("resize", () => fitAll(true));
}
