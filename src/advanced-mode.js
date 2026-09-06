const ADVANCED_MODE_KEY = "framechute.advanced-mode.v1";

function readAdvancedMode() {
  try {
    return localStorage.getItem(ADVANCED_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

const advanced = readAdvancedMode();
document.body.classList.toggle("framechute-advanced", advanced);
document.body.classList.toggle("framechute-classic", !advanced);
document.documentElement.dataset.framechuteMode = advanced ? "advanced" : "classic";
window.frameChuteAdvancedMode = advanced;

document.title = advanced ? "ƒ FrameChute — Advanced" : "ƒ FrameChute";

const style = document.createElement("style");
style.textContent = `
  html[data-framechute-mode="classic"] {
    color-scheme: light !important;
    background: #fff;
    color: #111;
  }

  body.framechute-classic {
    background: #fff;
    color: #111;
  }

  body.framechute-classic .toolbar,
  body.framechute-classic .floating-dock,
  body.framechute-classic .toolbar-slot-panel,
  body.framechute-classic .block {
    color: #111;
  }

  body.framechute-classic .toolbar {
    background: rgba(255, 255, 255, .96);
    border-bottom-color: #d7d7d7;
  }

  body.framechute-classic .floating-dock,
  body.framechute-classic .toolbar-slot-panel,
  body.framechute-classic .block {
    background: #fff;
    border-color: #d2d2d2;
  }

  body.framechute-classic button,
  body.framechute-classic select,
  body.framechute-classic input,
  body.framechute-classic textarea,
  body.framechute-classic .block-name,
  body.framechute-classic .pdf-page,
  body.framechute-classic .rewind-amount input {
    background: #fff;
    color: #111;
    border-color: #c9c9c9;
  }

  body.framechute-classic button:hover,
  body.framechute-classic select:hover,
  body.framechute-classic .setting-row:hover {
    background: #f3f3f3;
  }

  body.framechute-classic .status,
  body.framechute-classic small,
  body.framechute-classic .archive-status,
  body.framechute-classic .gallery-position,
  body.framechute-classic .gallery-filename,
  body.framechute-classic .url-host,
  body.framechute-classic .embed-note {
    color: #4a4a4a;
  }

  /* Classic hides the Advanced visibility preference for the frameless resize
     corner, so the resize affordance must remain visibly available here. */
  body.framechute-classic .block.is-frameless-media > .frameless-resize-handle {
    color: #8b6d00 !important;
    opacity: 1 !important;
    visibility: visible !important;
  }

  .framechute-mode-toggle {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 36px;
    padding: 4px 9px 4px 5px;
    border-radius: 9px;
    font-weight: 800;
    white-space: nowrap;
    transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
  }

  .framechute-mode-toggle .framechute-f-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: #d71920;
    color: #fff;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px;
    font-style: italic;
    font-weight: 700;
    line-height: 1;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.18);
  }

  .framechute-mode-toggle .framechute-mode-state {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .08em;
  }

  body.framechute-classic .framechute-mode-toggle {
    color: #fff;
    background: #b5121b;
    border-color: #e04850;
    box-shadow: 0 3px 10px rgba(181,18,27,.22);
  }

  body.framechute-advanced .framechute-mode-toggle {
    color: #effff4;
    background: #176b3a;
    border-color: #2c9a58;
    box-shadow: 0 3px 10px rgba(23,107,58,.22);
  }

  .framechute-mode-toggle:active { transform: translateY(1px); }

  .classic-toolbar-primary {
    display: none;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex-wrap: wrap;
  }

  .classic-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .classic-toolbar-actions + .classic-toolbar-actions {
    padding-left: 10px;
    border-left: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
  }

  .classic-toolbar-primary select { max-width: 220px; }

  body.framechute-classic .toolbar-primary { display: none !important; }
  body.framechute-classic .classic-toolbar-primary { display: flex; }

  body.framechute-classic .settings-body .setting-action-row,
  body.framechute-classic .settings-body label:has(#setting-frameless-aspect-ratio),
  body.framechute-classic .settings-body label:has(#setting-frameless-resize-handle-mode),
  body.framechute-classic .settings-body label:has(#setting-frameless-resize-handle-delay),
  body.framechute-classic .settings-body label:has(#setting-toolbar-text),
  body.framechute-classic #settings-hide {
    display: none !important;
  }

  .toolbar-summon.framechute-f-icon {
    color: #fff !important;
    background: #d71920 !important;
    border-color: #ef4a50 !important;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px !important;
    font-style: italic;
    font-weight: 700 !important;
    opacity: .82;
  }

  .toolbar-summon.framechute-f-icon:hover,
  body.toolbar-hidden .toolbar-summon.framechute-f-icon {
    opacity: 1;
  }
`;
document.head.append(style);

const toolbar = document.querySelector(".toolbar");
const brand = toolbar?.querySelector(".brand");
const advancedToolbar = toolbar?.querySelector(".toolbar-primary");

const modeButton = document.createElement("button");
modeButton.id = "framechute-advanced-toggle";
modeButton.className = "framechute-mode-toggle";
modeButton.type = "button";
modeButton.setAttribute("aria-pressed", String(advanced));
modeButton.title = advanced
  ? "Advanced mode is on. Click to return to the simpler Chrome Web Store-style FrameChute."
  : "Advanced mode is off. Click to reveal the current GitHub FrameChute tools.";
modeButton.innerHTML = `<span class="framechute-f-mark" aria-hidden="true">ƒ</span><span>Advanced</span><span class="framechute-mode-state">${advanced ? "ON" : "OFF"}</span>`;

if (toolbar) {
  if (brand) brand.insertAdjacentElement("afterend", modeButton);
  else toolbar.prepend(modeButton);
}

modeButton.addEventListener("click", () => {
  const next = !advanced;
  try { localStorage.setItem(ADVANCED_MODE_KEY, String(next)); } catch { /* Reload still gives a clean current-session reset. */ }
  modeButton.disabled = true;
  modeButton.querySelector(".framechute-mode-state").textContent = next ? "ON" : "OFF";
  location.reload();
});

const summon = document.querySelector("#toolbar-summon");
if (summon) {
  summon.textContent = "ƒ";
  summon.classList.add("framechute-f-icon");
  summon.title = "Show or hide FrameChute controls";
  summon.setAttribute("aria-label", "Show or hide FrameChute controls");
}

function proxyButton(label, targetId, title = label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.title = title;
  button.addEventListener("click", () => document.querySelector(`#${targetId}`)?.click());
  return button;
}

function syncClassicSavedSelect(classicSelect, sourceSelect) {
  const copy = () => {
    const wanted = classicSelect.value || sourceSelect.value;
    classicSelect.replaceChildren(...[...sourceSelect.options].map((option) => option.cloneNode(true)));
    if ([...classicSelect.options].some((option) => option.value === wanted)) classicSelect.value = wanted;
  };

  copy();
  new MutationObserver(copy).observe(sourceSelect, { childList: true, subtree: true });
  sourceSelect.addEventListener("change", () => { classicSelect.value = sourceSelect.value; });
  classicSelect.addEventListener("change", () => { sourceSelect.value = classicSelect.value; });
}

if (toolbar && advancedToolbar) {
  const classic = document.createElement("div");
  classic.className = "classic-toolbar-primary";
  classic.setAttribute("aria-label", "FrameChute classic controls");

  const add = document.createElement("div");
  add.className = "classic-toolbar-actions";
  add.append(
    proxyButton("New note", "add-text"),
    proxyButton("Open text", "open-text"),
    proxyButton("Open PDF", "open-pdf"),
    proxyButton("Open DOCX", "open-docx"),
    proxyButton("Open image", "open-image"),
    proxyButton("Open gallery", "open-gallery"),
    proxyButton("Open video", "open-video"),
    proxyButton("Open URL", "open-url")
  );

  const frames = document.createElement("div");
  frames.className = "classic-toolbar-actions";
  const save = proxyButton("Save FrameChute", "save-frame");
  const saved = document.createElement("select");
  saved.id = "classic-saved-frames";
  saved.setAttribute("aria-label", "Saved FrameChutes");
  const restore = proxyButton("Restore", "restore-frame");
  const reconnect = proxyButton("Reconnect all", "reconnect-all");
  const openWorkspace = proxyButton("Open Workspace", "import-fcx", "Open an editable portable FrameChute workspace");
  const exportWorkspace = proxyButton("Export Workspace", "export-fcx", "Export an editable portable FrameChute workspace");
  const takeSnapshot = proxyButton("Take Snapshot", "take-snapshot", "Save the used visual canvas as a flattened image");
  frames.append(save, saved, restore, reconnect, openWorkspace, exportWorkspace, takeSnapshot);
  classic.append(add, frames);
  advancedToolbar.insertAdjacentElement("afterend", classic);

  const sourceSaved = document.querySelector("#saved-frames");
  if (sourceSaved) syncClassicSavedSelect(saved, sourceSaved);
}
