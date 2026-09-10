const TOOLBAR_GAP = 8;

function createFloatingPanel(toggle, className = "responsive-toolbar-panel") {
  const panel = document.createElement("div");
  panel.className = className;
  panel.hidden = true;
  panel.setAttribute("role", "menu");
  document.body.append(panel);

  const position = () => {
    if (panel.hidden) return;
    const rect = toggle.getBoundingClientRect();
    const margin = 8;
    const width = panel.offsetWidth || 260;
    const height = panel.offsetHeight || 180;
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const below = rect.bottom + 8;
    const top = below + height <= window.innerHeight - margin
      ? below
      : Math.max(margin, rect.top - height - 8);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };

  const close = () => {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    document.dispatchEvent(new CustomEvent("framechute:close-toolbar-panels", { detail: { except: panel } }));
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    requestAnimationFrame(position);
  };

  toggle.setAttribute("aria-haspopup", "menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (panel.hidden) open();
    else close();
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("framechute:close-toolbar-panels", (event) => {
    if (event.detail?.except !== panel) close();
  });
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, true);

  return { panel, close, open, position };
}

function proxyClick(targetId) {
  const target = document.querySelector(`#${targetId}`);
  if (!target) return false;
  target.click();
  return true;
}

function installNewLauncher(toolbar, brand) {
  if (toolbar.querySelector("#framechute-new-toggle")) return toolbar.querySelector("#framechute-new-slot");

  const slot = document.createElement("div");
  slot.id = "framechute-new-slot";
  slot.className = "framechute-new-slot";

  const toggle = document.createElement("button");
  toggle.id = "framechute-new-toggle";
  toggle.type = "button";
  toggle.className = "toolbar-command framechute-new-toggle";
  toggle.innerHTML = '<span class="framechute-new-plus" aria-hidden="true">＋</span><span>New</span><span class="framechute-new-chevron" aria-hidden="true">▾</span>';
  toggle.title = "Create a new document or workspace object";
  slot.append(toggle);

  const floating = createFloatingPanel(toggle, "responsive-toolbar-panel framechute-new-panel");
  floating.panel.innerHTML = `
    <strong>New</strong>
    <div class="responsive-toolbar-panel-grid">
      <button type="button" data-new-target="new-docx"><span class="new-kind">DOCX</span><small>Editable Word document</small></button>
      <button type="button" data-new-target="new-pdf"><span class="new-kind">PDF</span><small>Blank PDF document</small></button>
      <button type="button" data-new-target="new-webx"><span class="new-kind">WEBX</span><small>Web project</small></button>
      <button type="button" data-new-target="new-canvas-menu"><span class="new-kind">Canvas</span><small>Free spatial canvas</small></button>
    </div>
  `;
  floating.panel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-new-target]");
    if (!button) return;
    if (proxyClick(button.dataset.newTarget)) floating.close();
  });

  if (brand) brand.insertAdjacentElement("afterend", slot);
  else toolbar.prepend(slot);
  return slot;
}

function convertClassicGroup(group, label, title) {
  if (!group || group.dataset.responsiveGrouped === "true") return;
  group.dataset.responsiveGrouped = "true";

  const contents = [...group.childNodes];
  group.replaceChildren();
  group.classList.add("responsive-toolbar-group");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "toolbar-command responsive-toolbar-group-toggle";
  toggle.innerHTML = `<span>${label}</span><span class="responsive-toolbar-chevron" aria-hidden="true">▾</span>`;
  toggle.title = title;
  group.append(toggle);

  const floating = createFloatingPanel(toggle, "responsive-toolbar-panel responsive-toolbar-group-panel");
  const body = document.createElement("div");
  body.className = "responsive-toolbar-panel-actions";
  body.append(...contents);
  floating.panel.append(body);
  floating.panel.addEventListener("click", (event) => {
    if (event.target.closest("button")) setTimeout(floating.close, 0);
  });
}

function visiblePagingItems(track) {
  return [...track.querySelectorAll("button, select, .toolbar-slot")].filter((element) => {
    if (element.closest(".toolbar-slot-panel, .responsive-toolbar-panel")) return false;
    if (element.hidden) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

function installPager(toolbar, activeTrack, newSlot, modeButton, status) {
  if (!activeTrack || activeTrack.closest(".responsive-toolbar-shell")) return;

  const shell = document.createElement("div");
  shell.className = "responsive-toolbar-shell";
  shell.setAttribute("aria-label", "FrameChute toolbar pages");

  const left = document.createElement("button");
  left.type = "button";
  left.className = "responsive-toolbar-page responsive-toolbar-page-left";
  left.textContent = "‹";
  left.title = "Previous toolbar controls";
  left.setAttribute("aria-label", "Previous toolbar controls");

  const viewport = document.createElement("div");
  viewport.className = "responsive-toolbar-viewport";
  viewport.tabIndex = -1;

  const right = document.createElement("button");
  right.type = "button";
  right.className = "responsive-toolbar-page responsive-toolbar-page-right";
  right.textContent = "›";
  right.title = "Next toolbar controls";
  right.setAttribute("aria-label", "Next toolbar controls");

  activeTrack.parentNode.insertBefore(shell, activeTrack);
  viewport.append(activeTrack);
  shell.append(left, viewport, right);

  activeTrack.classList.add("responsive-toolbar-track");
  activeTrack.style.display = "flex";

  if (newSlot) shell.insertAdjacentElement("beforebegin", newSlot);
  if (modeButton) {
    if (status) toolbar.insertBefore(modeButton, status);
    else toolbar.append(modeButton);
  }

  const update = () => {
    const overflow = viewport.scrollWidth > viewport.clientWidth + 2;
    shell.classList.toggle("has-overflow", overflow);
    left.hidden = !overflow;
    right.hidden = !overflow;
    left.disabled = !overflow || viewport.scrollLeft <= 2;
    right.disabled = !overflow || viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 2;
  };

  const pageTo = (direction) => {
    const items = visiblePagingItems(activeTrack);
    if (!items.length) return;
    const viewRect = viewport.getBoundingClientRect();
    const candidates = items.map((item) => ({ item, rect: item.getBoundingClientRect() }));
    let target;
    if (direction > 0) {
      target = candidates.find(({ rect }) => rect.right > viewRect.right + TOOLBAR_GAP)?.item;
      if (!target) target = items.at(-1);
    } else {
      target = [...candidates].reverse().find(({ rect }) => rect.left < viewRect.left - TOOLBAR_GAP)?.item;
      if (!target) target = items[0];
    }
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const delta = direction > 0
      ? rect.left - viewRect.left
      : rect.right - viewRect.right;
    viewport.scrollBy({ left: delta, behavior: "smooth" });
    document.dispatchEvent(new CustomEvent("framechute:close-toolbar-panels"));
  };

  left.addEventListener("click", () => pageTo(-1));
  right.addEventListener("click", () => pageTo(1));
  viewport.addEventListener("scroll", update, { passive: true });
  viewport.addEventListener("wheel", (event) => {
    if (!shell.classList.contains("has-overflow")) return;
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) && !event.shiftKey) return;
    event.preventDefault();
    viewport.scrollLeft += event.deltaX || event.deltaY;
  }, { passive: false });

  const observer = new ResizeObserver(update);
  observer.observe(viewport);
  observer.observe(activeTrack);
  new MutationObserver(update).observe(activeTrack, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "style", "class"] });
  requestAnimationFrame(update);
}

function installStyles() {
  if (document.querySelector("#framechute-responsive-toolbar-style")) return;
  const style = document.createElement("style");
  style.id = "framechute-responsive-toolbar-style";
  style.textContent = `
    .toolbar.framechute-responsive-toolbar {
      flex-wrap: nowrap !important;
      overflow: hidden;
      gap: 8px;
      min-height: 54px;
    }

    .toolbar.framechute-responsive-toolbar > .brand,
    .toolbar.framechute-responsive-toolbar > .framechute-new-slot,
    .toolbar.framechute-responsive-toolbar > .framechute-mode-toggle {
      flex: 0 0 auto;
    }

    .toolbar.framechute-responsive-toolbar > .status {
      flex: 0 1 18rem;
      max-width: min(18rem, 24vw);
      margin-left: 0;
    }

    .framechute-new-slot { display: inline-flex; position: relative; }
    .framechute-new-toggle {
      min-height: 36px;
      padding: 0 10px 0 8px;
      border-radius: 9px;
      font-weight: 850;
    }
    .framechute-new-plus { font-size: 18px; line-height: 1; }
    .framechute-new-chevron,
    .responsive-toolbar-chevron { font-size: 10px; opacity: .65; }

    .responsive-toolbar-shell {
      min-width: 0;
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      gap: 4px;
      overflow: hidden;
    }

    .responsive-toolbar-viewport {
      min-width: 0;
      flex: 1 1 auto;
      overflow-x: hidden;
      overflow-y: hidden;
      scroll-behavior: smooth;
      scrollbar-width: none;
      mask-image: linear-gradient(to right, transparent 0, #000 8px, #000 calc(100% - 8px), transparent 100%);
    }
    .responsive-toolbar-viewport::-webkit-scrollbar { display: none; }

    .responsive-toolbar-track,
    .classic-toolbar-primary.responsive-toolbar-track,
    .classic-toolbar-actions,
    .toolbar-primary.responsive-toolbar-track {
      width: max-content;
      max-width: none;
      flex: 0 0 auto;
      flex-wrap: nowrap !important;
      white-space: nowrap;
      align-items: center;
      gap: 6px;
    }

    .responsive-toolbar-page {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 28px;
      width: 28px;
      min-width: 28px;
      min-height: 34px;
      padding: 0;
      border-radius: 999px;
      font-size: 24px;
      line-height: 1;
      font-family: Georgia, serif;
      transition: opacity 120ms ease, transform 120ms ease, background-color 120ms ease;
    }
    .responsive-toolbar-page[hidden] { display: none !important; }
    .responsive-toolbar-page:active:not(:disabled) { transform: scale(.94); }
    .responsive-toolbar-page:disabled { opacity: .22; }

    .responsive-toolbar-panel {
      position: fixed;
      z-index: 2147483646;
      width: min(360px, calc(100vw - 16px));
      padding: 10px;
      border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
      border-radius: 12px;
      background: Canvas;
      color: CanvasText;
      box-shadow: 0 16px 44px color-mix(in srgb, CanvasText 22%, transparent);
      backdrop-filter: blur(16px);
    }
    body.framechute-classic .responsive-toolbar-panel { background: #fff; color: #111; border-color: #d2d2d2; }
    .responsive-toolbar-panel[hidden] { display: none !important; }
    .responsive-toolbar-panel > strong { display: block; margin: 2px 2px 9px; font-size: 13px; }

    .responsive-toolbar-panel-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
    }
    .responsive-toolbar-panel-grid button {
      min-height: 64px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 3px;
      padding: 9px 10px;
      text-align: left;
    }
    .responsive-toolbar-panel-grid .new-kind { font-weight: 850; }
    .responsive-toolbar-panel-grid small { opacity: .68; white-space: normal; }

    .responsive-toolbar-group { display: inline-flex; padding: 0 !important; border: 0 !important; }
    .responsive-toolbar-panel-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .responsive-toolbar-panel-actions > button,
    .responsive-toolbar-panel-actions > select { flex: 1 1 120px; }

    body.framechute-advanced .add-slot .new-document-menu { display: none !important; }

    @media (max-width: 820px) {
      .toolbar.framechute-responsive-toolbar > .status { display: none; }
    }

    @media (max-width: 600px) {
      .toolbar.framechute-responsive-toolbar { padding-inline: 8px; gap: 6px; }
      .toolbar.framechute-responsive-toolbar > .brand { max-width: 74px; overflow: hidden; text-overflow: ellipsis; }
      .framechute-mode-toggle { padding-right: 6px !important; gap: 4px !important; }
      .framechute-mode-toggle > span:not(.framechute-f-mark):not(.framechute-mode-state) { display: none; }
      .framechute-new-toggle { padding-inline: 7px; }
    }
  `;
  document.head.append(style);
}

function installResponsiveToolbar() {
  const toolbar = document.querySelector(".toolbar");
  if (!toolbar || toolbar.dataset.responsiveToolbarInstalled === "true") return;

  const advanced = document.body.classList.contains("framechute-advanced");
  const activeTrack = advanced
    ? toolbar.querySelector(".toolbar-primary")
    : toolbar.querySelector(".classic-toolbar-primary");
  if (!activeTrack) return;

  toolbar.dataset.responsiveToolbarInstalled = "true";
  toolbar.classList.add("framechute-responsive-toolbar");
  installStyles();

  const brand = toolbar.querySelector(".brand");
  const status = toolbar.querySelector("#status");
  const modeButton = toolbar.querySelector("#framechute-advanced-toggle");
  const newSlot = installNewLauncher(toolbar, brand);

  if (!advanced) {
    const groups = [...activeTrack.querySelectorAll(":scope > .classic-toolbar-actions")];
    convertClassicGroup(groups[0], "Open / Add", "Open files, media, notes, and URLs");
    convertClassicGroup(groups[1], "Workspace", "Save, restore, reconnect, import, export, or snapshot the workspace");
  } else {
    const addToggle = activeTrack.querySelector("#toolbar-add-toggle");
    if (addToggle) {
      const label = addToggle.querySelector(".toolbar-command-label");
      if (label) label.textContent = "Open / Add";
      addToggle.title = "Open or add files, media, notes, and URLs";
    }
  }

  installPager(toolbar, activeTrack, newSlot, modeButton, status);

  document.addEventListener("click", () => document.dispatchEvent(new CustomEvent("framechute:close-toolbar-panels")));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.dispatchEvent(new CustomEvent("framechute:close-toolbar-panels"));
  });
}

installResponsiveToolbar();
window.addEventListener("flashframe:restore-appearance", () => requestAnimationFrame(installResponsiveToolbar));
