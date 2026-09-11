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

  /* Structural sections stay protected without looking like boxed widgets. */
  .toolbar {
    gap: 8px;
    padding-inline: 10px;
  }

  .toolbar > .toolbar-primary,
  .toolbar > .classic-toolbar-primary {
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1 1 auto;
    flex-wrap: nowrap;
    overflow: hidden;
  }

  .classic-toolbar-primary {
    display: none;
  }

  .framechute-toolbar-pager {
    display: inline-grid;
    grid-template-columns: 30px max-content 30px;
    align-items: center;
    gap: 3px;
    width: max-content;
    min-width: 0;
    max-width: min(220px, 32vw);
    flex: 0 0 auto;
    padding: 0;
    border: 0;
    background: transparent;
    white-space: nowrap;
    overflow: hidden;
  }

  .framechute-toolbar-fixed {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 44px;
    flex: 1 1 auto;
    margin-left: 4px;
    padding: 0 0 0 9px;
    border: 0;
    border-left: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
    background: transparent;
    white-space: nowrap;
    overflow: hidden;
    scrollbar-width: none;
  }

  .framechute-toolbar-fixed::-webkit-scrollbar {
    display: none;
  }

  .framechute-toolbar-fixed > button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    flex: 0 0 auto;
    min-height: 34px;
    white-space: nowrap;
  }

  .framechute-toolbar-fixed > button[data-toolbar-icon]::before {
    content: attr(data-toolbar-icon);
    font-size: 16px;
    line-height: 1;
  }

  @media (max-width: 1100px) {
    .framechute-toolbar-fixed > button[data-toolbar-icon] {
      width: 36px;
      min-width: 36px;
      padding: 0;
      overflow: hidden;
      font-size: 0;
    }
    .framechute-toolbar-fixed > button[data-toolbar-icon]::before {
      font-size: 18px;
    }
  }

  @media (max-width: 760px) {
    .framechute-mode-toggle > span:nth-child(2) { display: none; }
    .framechute-mode-toggle { gap: 4px; padding-right: 6px; }
    .framechute-toolbar-fixed {
      gap: 2px;
      min-width: 42px;
      margin-left: 3px;
      padding-left: 7px;
    }
    .toolbar .status { display: none; }
  }

  @media (max-width: 600px) {
    .framechute-toolbar-pager {
      grid-template-columns: 28px max-content 28px;
      width: max-content;
      min-width: 0;
      max-width: 116px;
      gap: 2px;
      margin-right: 1px;
    }

    .framechute-toolbar-pager-window,
    .framechute-toolbar-pager-item {
      max-width: 56px;
    }

    .framechute-toolbar-pager-window > button[data-toolbar-icon] {
      width: 36px;
      min-width: 36px;
      padding: 0;
      overflow: hidden;
      font-size: 0;
    }

    .framechute-toolbar-pager-window > button[data-toolbar-icon]::before {
      content: attr(data-toolbar-icon);
      font-size: 18px;
      line-height: 1;
    }

    .framechute-toolbar-pager-window > select {
      width: 44px;
      max-width: 44px;
      padding-inline: 3px;
    }
  }

  @media (max-width: 520px) {
    .brand { display: none; }
    .framechute-mode-toggle .framechute-mode-state { display: none; }
    .framechute-mode-toggle {
      width: 36px;
      min-width: 36px;
      padding: 4px;
      justify-content: center;
    }
    .framechute-toolbar-pager-window > button[data-toolbar-icon] {
      width: 36px;
      min-width: 36px;
      padding: 0;
      overflow: hidden;
      font-size: 0;
    }
    .framechute-toolbar-pager-window > button[data-toolbar-icon]::before {
      content: attr(data-toolbar-icon);
      font-size: 18px;
      line-height: 1;
    }
  }

  .framechute-toolbar-pager-window {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: max-content;
    min-width: 0;
    max-width: 154px;
    overflow: hidden;
  }

  .framechute-toolbar-pager-item {
    width: max-content;
    min-width: 0;
    max-width: 154px;
    flex: 0 1 auto;
  }

  .framechute-toolbar-pager-item:not(.is-toolbar-pager-active) {
    display: none !important;
  }

  .framechute-toolbar-pager-window > button,
  .framechute-toolbar-pager-window > select,
  .framechute-toolbar-pager-window > .toolbar-slot {
    max-width: 100%;
  }

  .framechute-toolbar-pager-window > button {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .framechute-toolbar-pager-arrow {
    display: inline-grid;
    place-items: center;
    width: 100%;
    min-width: 0;
    height: 34px;
    min-height: 34px;
    padding: 0;
    font-size: 18px;
    line-height: 1;
  }

  .framechute-toolbar-pager-arrow:disabled {
    opacity: .35;
    visibility: visible;
    pointer-events: none;
  }

  .classic-toolbar-primary select { max-width: min(220px, 36vw); }

  .toolbar .status {
    flex: 1 1 8rem;
    min-width: 0;
    max-width: 18rem;
  }

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
  button.dataset.toolbarTarget = targetId;
  const icons = {
    "export-fcx": "⇩",
    "import-fcx": "⇧",
    "take-snapshot": "▣",
    "add-text": "＋",
    "open-text": "T",
    "open-pdf": "P",
    "open-docx": "W",
    "open-image": "▧",
    "open-gallery": "▦",
    "open-video": "▶",
    "open-url": "↗",
    "save-frame": "⌑",
    "restore-frame": "↶",
    "reconnect-all": "⟳"
  };
  if (icons[targetId]) button.dataset.toolbarIcon = icons[targetId];
  button.addEventListener("click", () => document.querySelector(`#${targetId}`)?.click());
  return button;
}

function openAnyFileButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Open File";
  button.dataset.toolbarIcon = "📂";
  button.title = "Open any supported file";
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", () => window.dispatchEvent(new CustomEvent("framechute:open-file")));
  return button;
}

function fixedToolbarActions(...items) {
  const group = document.createElement("div");
  group.className = "framechute-toolbar-fixed";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Persistent toolbar commands");
  group.append(...items);
  return group;
}

function addFixedToolbarItem(group, item) {
  if (!group || !item) return item;
  if (!group.contains(item)) group.append(item);
  return item;
}

function toolbarItemLabel(item) {
  return item?.getAttribute?.("aria-label")
    || item?.title
    || item?.textContent?.replace(/\s+/g, " ").trim()
    || "toolbar command";
}

function createToolbarPager(container, label) {
  if (!container) return null;
  const initialItems = [...container.children];
  const shell = document.createElement("div");
  shell.className = "framechute-toolbar-pager";
  shell.setAttribute("role", "group");
  shell.setAttribute("aria-label", label);

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "framechute-toolbar-pager-arrow";
  previous.textContent = "‹";
  previous.title = "Previous toolbar command";
  previous.setAttribute("aria-label", previous.title);

  const windowNode = document.createElement("div");
  windowNode.className = "framechute-toolbar-pager-window";

  const next = document.createElement("button");
  next.type = "button";
  next.className = "framechute-toolbar-pager-arrow";
  next.textContent = "›";
  next.title = "Next toolbar command";
  next.setAttribute("aria-label", next.title);

  shell.append(previous, windowNode, next);
  container.replaceChildren(shell);

  const items = [];
  let index = 0;

  const isAvailable = (item) => {
    if (!item || item.hidden) return false;
    if (item.id === "frame-sequence-slot" && item.childElementCount === 0) return false;
    return true;
  };

  const render = (preferred = null) => {
    const visible = items.filter(isAvailable);
    if (!visible.length) {
      shell.hidden = true;
      return;
    }
    shell.hidden = false;
    if (preferred && visible.includes(preferred)) index = visible.indexOf(preferred);
    index = ((index % visible.length) + visible.length) % visible.length;
    const active = visible[index];
    for (const item of items) item.classList.toggle("is-toolbar-pager-active", item === active);
    previous.disabled = visible.length < 2;
    next.disabled = visible.length < 2;
    windowNode.setAttribute("aria-label", `${label}: ${toolbarItemLabel(active)}`);
  };

  const add = (item) => {
    if (!item || items.includes(item)) return item;
    item.classList.add("framechute-toolbar-pager-item");
    windowNode.append(item);
    items.push(item);
    render();
    return item;
  };

  initialItems.forEach(add);

  previous.addEventListener("click", () => {
    const visible = items.filter(isAvailable);
    if (visible.length < 2) return;
    index = (index - 1 + visible.length) % visible.length;
    render();
  });

  next.addEventListener("click", () => {
    const visible = items.filter(isAvailable);
    if (visible.length < 2) return;
    index = (index + 1) % visible.length;
    render();
  });

  new MutationObserver(() => render()).observe(windowNode, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["hidden"]
  });

  render();
  return { add, render };
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
  // The carousel always begins on one universal Open File command.
  // Format-specific commands remain reachable by the arrows, but the common
  // path is deliberately one click and accepts every file type the ingestion
  // layer knows how to route.
  advancedToolbar.prepend(openAnyFileButton());
  const advancedPager = createToolbarPager(advancedToolbar, "FrameChute advanced controls");
  const advancedFixed = fixedToolbarActions(
    proxyButton("Export Workspace", "export-fcx", "Export an editable portable FrameChute workspace")
  );
  advancedToolbar.append(advancedFixed);

  const classic = document.createElement("div");
  classic.className = "classic-toolbar-primary";
  classic.setAttribute("aria-label", "FrameChute classic controls");
  advancedToolbar.insertAdjacentElement("afterend", classic);

  // Keep one rotating command between permanent left/right arrows. Export
  // Workspace is intentionally outside the carousel so it is always visible.
  classic.append(openAnyFileButton());
  const classicPager = createToolbarPager(classic, "FrameChute classic controls");
  const saved = document.createElement("select");
  saved.id = "classic-saved-frames";
  saved.setAttribute("aria-label", "Saved FrameChutes");

  [
    proxyButton("New note", "add-text"),
    proxyButton("Open text", "open-text"),
    proxyButton("Open PDF", "open-pdf"),
    proxyButton("Open DOCX", "open-docx"),
    proxyButton("Open image", "open-image"),
    proxyButton("Open gallery", "open-gallery"),
    proxyButton("Open video", "open-video"),
    proxyButton("Open URL", "open-url"),
    proxyButton("Save FrameChute", "save-frame"),
    saved,
    proxyButton("Restore", "restore-frame"),
    proxyButton("Reconnect all", "reconnect-all"),
    proxyButton("Open Workspace", "import-fcx", "Open an editable portable FrameChute workspace"),
    proxyButton("Take Snapshot", "take-snapshot", "Save the used visual canvas as a flattened image")
  ].forEach(item => classicPager?.add(item));

  const classicFixed = fixedToolbarActions(
    proxyButton("Export Workspace", "export-fcx", "Export an editable portable FrameChute workspace")
  );
  classic.append(classicFixed);

  const sourceSaved = document.querySelector("#saved-frames");
  if (sourceSaved) syncClassicSavedSelect(saved, sourceSaved);

  window.FrameChuteToolbarPager = {
    add(item, mode = window.frameChuteAdvancedMode ? "advanced" : "classic") {
      return (mode === "advanced" ? advancedPager : classicPager)?.add(item);
    },
    refresh() {
      advancedPager?.render();
      classicPager?.render();
    }
  };

  window.FrameChuteToolbarFixed = {
    add(item, mode = window.frameChuteAdvancedMode ? "advanced" : "classic") {
      return addFixedToolbarItem(mode === "advanced" ? advancedFixed : classicFixed, item);
    }
  };

  for (const pending of window.FrameChuteToolbarFixedPending || []) {
    window.FrameChuteToolbarFixed.add(pending.item, pending.mode);
  }
  window.FrameChuteToolbarFixedPending = [];

  // Module scripts can become ready in a different order. Never let late/early
  // toolbar commands fall back to the raw header, because they can squeeze the
  // pager (including Open File and its arrows) completely out of view.
  for (const pending of window.FrameChuteToolbarPending || []) {
    window.FrameChuteToolbarPager.add(pending.item, pending.mode);
  }
  window.FrameChuteToolbarPending = [];
  window.dispatchEvent(new CustomEvent("framechute:toolbar-pager-ready"));
}
