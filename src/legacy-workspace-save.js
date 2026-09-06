const LEGACY_SAVE_KEY = "framechute.legacy-workspace-save.v1";

function readEnabled() {
  try {
    return localStorage.getItem(LEGACY_SAVE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeEnabled(enabled) {
  try {
    localStorage.setItem(LEGACY_SAVE_KEY, String(enabled));
  } catch (error) {
    console.warn("FrameChute could not persist the legacy Save / Restore preference:", error);
  }
}

function classicButton(label) {
  return [...document.querySelectorAll(".classic-toolbar-primary button")]
    .find((button) => button.textContent.trim() === label) || null;
}

function legacyControls() {
  const advancedSavedSlot = document.querySelector("#toolbar-saved-toggle")?.closest(".toolbar-slot");
  return [
    advancedSavedSlot,
    document.querySelector("#save-frame"),
    document.querySelector("#restore-frame"),
    classicButton("Save FrameChute"),
    document.querySelector("#classic-saved-frames"),
    classicButton("Restore")
  ].filter(Boolean);
}

function applyLegacyVisibility(enabled) {
  for (const control of legacyControls()) control.hidden = !enabled;

  const savedPanel = document.querySelector("#toolbar-saved-panel");
  if (!enabled && savedPanel) savedPanel.hidden = true;

  const archiveSetting = document.querySelector(".storage-setting");
  if (archiveSetting) archiveSetting.hidden = !enabled;

  document.body.classList.toggle("legacy-workspace-save-enabled", enabled);
}

function installSetting() {
  const settingsBody = document.querySelector(".settings-body");
  if (!settingsBody || document.querySelector("#setting-legacy-workspace-save")) return null;

  const row = document.createElement("label");
  row.className = "setting-row legacy-workspace-save-setting";
  row.innerHTML = `
    <input id="setting-legacy-workspace-save" type="checkbox">
    <span>
      <strong>Legacy local Save / Restore</strong>
      <small>Optional legacy browser-state saving. It may not reconstruct every local source, permission, or media relationship. For a dependable portable workspace, use Export Workspace (.fcx). Individual edited files should use Save / Save As.</small>
    </span>
  `;

  const archiveSetting = settingsBody.querySelector(".storage-setting");
  if (archiveSetting) archiveSetting.before(row);
  else settingsBody.append(row);

  return row.querySelector("#setting-legacy-workspace-save");
}

const input = installSetting();
let enabled = readEnabled();
if (input) input.checked = enabled;
applyLegacyVisibility(enabled);

input?.addEventListener("change", () => {
  enabled = input.checked;
  writeEnabled(enabled);
  applyLegacyVisibility(enabled);
});

// Classic controls are created by advanced-mode.js before this module loads,
// but keep this resilient if the toolbar is rebuilt later.
new MutationObserver(() => applyLegacyVisibility(enabled)).observe(document.querySelector(".toolbar") || document.body, {
  childList: true,
  subtree: true
});
