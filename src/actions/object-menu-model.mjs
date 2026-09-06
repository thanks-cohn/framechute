export const QUICK_ACTIONS_GLOBAL_KEY = "framechute.quick-actions-enabled.v1";
export const QUICK_ACTIONS_OVERRIDES = Object.freeze(["global", "on", "off"]);

export function normalizeQuickActionsOverride(value) {
  return QUICK_ACTIONS_OVERRIDES.includes(value) ? value : "global";
}

export function objectMenuItems({ quickActionsOverride = "global", quickActionsEnabled = true } = {}) {
  const override = normalizeQuickActionsOverride(quickActionsOverride);
  return [
    { id: "quick-actions-global", label: `Quick Actions  [ ${quickActionsEnabled ? "ON" : "OFF"} ]` },
    { id: "quick-actions-object", label: `Quick Actions for This Object  [ ${override.toUpperCase()} ]` },
    { separator: true },
    { id: "convert", label: "Img Ext Change…" },
    { id: "resize", label: "Img Size Change…" },
    { id: "crop", label: "Crop…" },
    { id: "grab", label: "Grab / Move Object" },
    { id: "remove", label: "Close Object", danger: true },
    { id: "shrink-fit", label: "Shrink to Fit" },
    { id: "copy-image", label: "Copy Image" },
    { id: "open-image", label: "Open Image in New Tab" },
    { id: "open-location", label: "Open File Location" },
    { separator: true },
    { id: "edit", label: "Edit" },
    { id: "duplicate", label: "Duplicate" },
    { id: "save-as", label: "Save As" }
  ];
}

export function readQuickActionsEnabled(storage = globalThis.localStorage) {
  try { return storage?.getItem(QUICK_ACTIONS_GLOBAL_KEY) !== "false"; } catch { return true; }
}
export function writeQuickActionsEnabled(enabled, storage = globalThis.localStorage) {
  try { storage?.setItem(QUICK_ACTIONS_GLOBAL_KEY, enabled ? "true" : "false"); } catch { /* best effort */ }
  return Boolean(enabled);
}
export function getQuickActionsOverride(object) {
  return normalizeQuickActionsOverride(object?.dataset?.quickActionsOverride);
}
export function setQuickActionsOverride(object, value) {
  if (!object?.dataset) return;
  const normalized = normalizeQuickActionsOverride(value);
  if (normalized === "global") delete object.dataset.quickActionsOverride;
  else object.dataset.quickActionsOverride = normalized;
}
export function quickActionsVisible(object, globalEnabled) {
  const override = getQuickActionsOverride(object);
  return override === "on" || (override === "global" && Boolean(globalEnabled));
}

// Compatibility for older FCX payloads and callers. Hidden maps to Force OFF.
export const isQuickActionsHidden = object => getQuickActionsOverride(object) === "off";
export const setQuickActionsHidden = (object, hidden) => setQuickActionsOverride(object, hidden ? "off" : "global");
