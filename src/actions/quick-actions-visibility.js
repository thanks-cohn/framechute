import { isViewportFixed, toggleViewportFixed } from "../viewport-fix.js";
import { isQuickActionsHidden, objectMenuItems, readQuickActionsEnabled, setQuickActionsHidden, writeQuickActionsEnabled } from "./object-menu-model.mjs";
import { fittedImageSize } from "./image-display-size.mjs";
import { isPaintEditing } from "../image-edit/paint-runtime.js";
const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");
const bar = document.querySelector(".quick-actions");
const actions = window.FrameChuteActions;

if (!workspace || !bar || !actions?.selection) {
  console.warn("FrameChute Quick Actions visibility controls could not initialize.");
} else {
  const selection = actions.selection;
  let quickActionsEnabled = readQuickActionsEnabled();
  const style = document.createElement("style");
  style.textContent = `
    .quick-actions-close {
      width: 28px;
      min-width: 28px;
      height: 28px;
      min-height: 28px;
      padding: 0 !important;
      border-radius: 999px !important;
      background: transparent !important;
      color: #dce6f4;
      font-size: 18px;
      line-height: 1;
      opacity: .72;
    }
    .quick-actions-close:hover { opacity: 1; background: #ffffff18 !important; }
    .framechute-object-context-menu {
      position: fixed;
      z-index: 100001;
      min-width: 190px;
      padding: 5px;
      border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
      border-radius: 10px;
      background: Canvas;
      color: CanvasText;
      box-shadow: 0 12px 34px #0005;
      font: 13px system-ui, sans-serif;
      max-height: calc(100vh - 12px);
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .framechute-object-context-menu[hidden] { display: none; }
    .framechute-object-context-menu button {
      width: 100%;
      min-height: 34px;
      padding: 6px 10px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .framechute-object-context-menu button:hover,
    .framechute-object-context-menu button:focus-visible {
      background: color-mix(in srgb, CanvasText 8%, Canvas);
      outline: none;
    }
  `;
  document.head.append(style);

  function isImageBlock(block) {
    return block instanceof HTMLElement && (block.dataset.customKind === "image" || Boolean(block.querySelector(".image-frame")));
  }

  function isObjectBlock(block) {
    return block instanceof HTMLElement && block.classList.contains("block");
  }

  function isHiddenFor(block) {
    return isObjectBlock(block) && isQuickActionsHidden(block);
  }

  function setHiddenFor(block, hidden) {
    if (!isObjectBlock(block)) return;
    setQuickActionsHidden(block, hidden);
  }

  function selectedObjects() {
    return selection.items.filter(isObjectBlock);
  }

  function selectedImagesOnly() {
    const items = selection.items;
    return items.length > 0 && items.every(isImageBlock) ? items : [];
  }

  function shouldHideBar() {
    if (!quickActionsEnabled) return true;
    const items = selectedObjects();
    if (!items.length) return true;
    return items.every(isHiddenFor);
  }

  function applyBarVisibility() {
    const desiredHidden = shouldHideBar();
    if (bar.hidden !== desiredHidden) bar.hidden = desiredHidden;
    const close = bar.querySelector(".quick-actions-close");
    if (close) close.hidden = selectedObjects().length === 0;
  }

  const closeButton = bar.querySelector(".quick-actions-close") || document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "quick-actions-close";
  closeButton.textContent = "×";
  closeButton.title = "Close Quick Actions";
  closeButton.setAttribute("aria-label", "Close Quick Actions");
  closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const items = selectedObjects();
    for (const block of items) setHiddenFor(block, true);
    applyBarVisibility();
    if (status) {
      const noun = items.length === 1 ? "this object" : `${items.length} selected objects`;
      status.textContent = `Quick Actions hidden for ${noun}. Use the object menu to show them again.`;
    }
  });
  if (!closeButton.isConnected) bar.querySelector(".quick-actions-heading")?.append(closeButton);

  const menu = document.createElement("div");
  menu.className = "framechute-object-context-menu"; menu.hidden = true; menu.setAttribute("role", "menu");
  document.body.append(menu); let menuBlock = null;

  function closeMenu() { menu.hidden = true; menuBlock = null; }
  function positionMenu(clientX, clientY) { window.dispatchEvent(new CustomEvent("framechute:close-context-menus", { detail: { except: menu } })); menu.style.left=`${clientX}px`;menu.style.top=`${clientY}px`;menu.hidden=false;const rect=menu.getBoundingClientRect();menu.style.left=`${Math.max(6,Math.min(clientX,innerWidth-rect.width-6))}px`;menu.style.top=`${Math.max(6,Math.min(clientY,innerHeight-rect.height-6))}px`;menu.querySelector("button")?.focus(); }
  function imageFor(block) { return block?.querySelector(".image-frame, .gallery-image"); }
  function resizeDisplay(block, mode) {
    const image=imageFor(block); if(!image?.naturalWidth)return;
    const blockRect=block.getBoundingClientRect(),imageRect=image.getBoundingClientRect();
    const chromeWidth=Math.max(0,blockRect.width-imageRect.width),chromeHeight=Math.max(0,blockRect.height-imageRect.height);
    const size=fittedImageSize(image.naturalWidth,image.naturalHeight,Math.max(1,workspace.clientWidth-48-chromeWidth),Math.max(1,workspace.clientHeight-48-chromeHeight),mode);
    if(!size)return; block.style.width=`${Math.ceil(size.width+chromeWidth)}px`;block.style.height=`${Math.ceil(size.height+chromeHeight)}px`;
    workspace.dispatchEvent(new CustomEvent("flashframe:workspace-changed",{bubbles:true}));
  }
  async function runMenuAction(id) {
    const block=menuBlock; if(!block)return;
    try {
      if(id==="show-header")window.dispatchEvent(new CustomEvent("framechute:object-command",{detail:{block,command:"show-header"}}));
      if(id==="quick-actions-global"){quickActionsEnabled=writeQuickActionsEnabled(!quickActionsEnabled);applyBarVisibility();if(status)status.textContent=`Quick Actions are now ${quickActionsEnabled?"on":"off"} everywhere.`;}
      if(id==="quick-actions"){const show=isHiddenFor(block);setHiddenFor(block,!show);selection.replace(block);applyBarVisibility();if(status)status.textContent=`Quick Actions ${show?"shown":"hidden"} for this object.`;}
      if(id==="shrink-fit")resizeDisplay(block,"shrink");
      if(id==="fit-workspace")resizeDisplay(block,"contain");
      if(id==="fit-width")resizeDisplay(block,"width");
      if(id==="fit-height")resizeDisplay(block,"height");
      if(id==="actual-size")resizeDisplay(block,"actual");
      if(id==="shrink-all")workspace.querySelectorAll(".block").forEach(candidate=>{if(isImageBlock(candidate))resizeDisplay(candidate,"shrink");});
      if(id==="edit")await actions.registry.run("image.paint",{selection:[block]});
      if(id==="duplicate")await actions.registry.run("object.duplicate",{selection:[block]});
      if(id==="save-as")await actions.registry.run("image.save-as",{selection:[block]});
      if(id==="open-file")window.dispatchEvent(new CustomEvent("framechute:open-file"));
      if(id==="minimize"||id==="expand"||id==="center"||id==="grab")window.dispatchEvent(new CustomEvent("framechute:object-command",{detail:{block,command:id}}));
      if(id==="remove")block.querySelector(":scope > .block-header .remove-block")?.click();
      if(id==="fix-viewport")toggleViewportFixed(block);
    } catch(error) {
      console.error(error);
      if(status)status.textContent=error?.message || "That object action could not be completed.";
    } finally { closeMenu(); }
  }
  function openMenu(block,clientX,clientY){if(!isImageBlock(block))return;menuBlock=block;menu.replaceChildren();for(const item of objectMenuItems({quickActionsHidden:isHiddenFor(block),quickActionsEnabled,imageEditing:isPaintEditing(block),viewportFixed:isViewportFixed(block)})){if(item.separator){const rule=document.createElement("hr");rule.setAttribute("role","separator");menu.append(rule);continue;}const control=document.createElement("button");control.type="button";control.setAttribute("role","menuitem");control.textContent=item.label;if(item.danger)control.className="danger";control.onclick=()=>void runMenuAction(item.id);menu.append(control);}positionMenu(clientX,clientY);}
  window.addEventListener("framechute:open-object-menu",event=>openMenu(event.detail?.block,event.detail?.clientX||0,event.detail?.clientY||0));
  workspace.addEventListener("contextmenu", event => { const block=event.target.closest(".block");if(!isImageBlock(block)){closeMenu();return;}event.preventDefault();if(!selection.has(block))selection.replace(block);openMenu(block,event.clientX,event.clientY); });

  document.addEventListener("pointerdown", (event) => {
    if (!menu.hidden && !menu.contains(event.target)) closeMenu();
  });
  window.addEventListener("blur", closeMenu);
  window.addEventListener("resize", closeMenu);
  window.addEventListener("scroll", event => { if (!menu.contains(event.target)) closeMenu(); }, true);
  window.addEventListener("framechute:close-context-menus", event => { if (event.detail?.except !== menu) closeMenu(); });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { closeMenu(); return; }
    if (menu.hidden || !["ArrowDown","ArrowUp","Home","End","PageDown","PageUp"].includes(event.key)) return;
    event.preventDefault(); const controls=[...menu.querySelectorAll("button")],current=Math.max(0,controls.indexOf(document.activeElement));
    let next=event.key==="Home"?0:event.key==="End"?controls.length-1:current+(event.key.includes("Down")?1:-1);
    next=Math.max(0,Math.min(controls.length-1,next));controls[next]?.focus();controls[next]?.scrollIntoView({block:"nearest"});
  });

  selection.addEventListener("change", applyBarVisibility);
  window.addEventListener("storage", event => {
    if (event.key !== "framechute.quick-actions-enabled.v1") return;
    quickActionsEnabled = readQuickActionsEnabled();
    applyBarVisibility();
  });
  window.addEventListener("framechute:quick-actions-global-changed", event => {
    quickActionsEnabled = typeof event.detail?.enabled === "boolean" ? event.detail.enabled : readQuickActionsEnabled();
    applyBarVisibility();
    if (status) status.textContent = `Quick Actions are now ${quickActionsEnabled ? "on" : "off"} everywhere.`;
  });

  const barObserver = new MutationObserver(() => applyBarVisibility());
  barObserver.observe(bar, { attributes: true, attributeFilter: ["hidden"] });

  window.addEventListener("framechute:block-captured", (event) => {
    const { block, record } = event.detail;
    if (!isObjectBlock(block) || !isHiddenFor(block)) return;
    record.state ||= {};
    record.state.quickActionsHidden = true;
    if (typeof record.state.text === "string" && record.state.text.startsWith("__FLASHFRAME_CUSTOM_BLOCK_V1__")) {
      const marker = "__FLASHFRAME_CUSTOM_BLOCK_V1__";
      const payload = JSON.parse(record.state.text.slice(marker.length));
      payload.quickActionsHidden = true;
      record.state.text = marker + JSON.stringify(payload);
    }
  });

  function restoreVisibility(block, hidden) {
    if (!isObjectBlock(block)) return;
    setHiddenFor(block, hidden === true);
    applyBarVisibility();
  }

  window.addEventListener("framechute:block-restored", (event) => {
    restoreVisibility(event.detail.block, event.detail.record.state?.quickActionsHidden);
  });
  window.addEventListener("framechute:custom-block-ready", (event) => {
    restoreVisibility(event.detail.block, event.detail.payload?.quickActionsHidden);
  });

  applyBarVisibility();
}
