export const QUICK_ACTIONS_GLOBAL_KEY = "framechute.quick-actions-enabled.v1";

export function objectMenuItems({ quickActionsHidden = false, quickActionsEnabled = true, imageEditing = false } = {}) {
  return [
    { id: "quick-actions-global", label: `Quick Actions  [ ${quickActionsEnabled ? "ON" : "OFF"} ]` },
    { id: "open-file", label: "Open File…" },
    { id: "remove", label: "Close Object", danger: true }, { separator: true },
    { id: "quick-actions", label: `${quickActionsHidden ? "Show" : "Hide"} Quick Actions for This Object` },
    { id: "shrink-fit", label: "Shrink to Fit" },
    { id: "fit-workspace", label: "Fit to Workspace" },
    { id: "fit-width", label: "Fit Width" },
    { id: "fit-height", label: "Fit Height" },
    { id: "actual-size", label: "Actual Size" },
    { id: "shrink-all", label: "Shrink all images to fit" },
    { id: "edit", label: imageEditing ? "Finish Editing" : "Edit Image" }, { id: "duplicate", label: "Duplicate" },
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

export function isQuickActionsHidden(object) {
  return object?.dataset?.quickActionsHidden === "true";
}

export function setQuickActionsHidden(object, hidden) {
  if (!object?.dataset) return;
  if (hidden) object.dataset.quickActionsHidden = "true";
  else delete object.dataset.quickActionsHidden;
}
