import { commandsForEditorContext, resolveEditorContext } from "./actions/context-menu-model.mjs";

const workspace = document.querySelector("#workspace");
const menu = document.createElement("div");
menu.className = "flashframe-editor-context-menu"; menu.hidden = true; menu.setAttribute("role", "menu");
document.body.append(menu);
let context = null;

function close(deepestOnly = false) {
  const open = [...menu.querySelectorAll(".menu-submenu.is-open")];
  if (deepestOnly && open.length) { open.at(-1).classList.remove("is-open"); open.at(-1).previousElementSibling?.focus(); return; }
  menu.hidden = true; menu.replaceChildren(); context = null;
}
function place(element, x, y) {
  const margin=8, rect=element.getBoundingClientRect();
  element.style.left=`${Math.max(margin,Math.min(x,innerWidth-rect.width-margin))}px`;
  element.style.top=`${Math.max(margin,Math.min(y,innerHeight-rect.height-margin))}px`;
}
function openSubmenu(button, submenu) {
  menu.querySelectorAll(".menu-submenu.is-open").forEach(node => { if(node!==submenu)node.classList.remove("is-open"); });
  submenu.classList.add("is-open"); const parent=button.getBoundingClientRect(),rect=submenu.getBoundingClientRect();
  submenu.classList.toggle("opens-left", parent.right+rect.width>innerWidth-8);
  submenu.style.top=`${Math.max(0,Math.min(button.offsetTop,innerHeight-rect.height-8))}px`;
  submenu.querySelector("button:not(:disabled)")?.focus({preventScroll:true});
}
function appendItems(parent, items) {
  for (const item of items.filter(item => item.hidden !== true)) {
    if(item.type==="separator"){const hr=document.createElement("hr");hr.setAttribute("role","separator");parent.append(hr);continue;}
    const wrapper=item.submenu?document.createElement("div"):parent; if(item.submenu)wrapper.className="menu-submenu-owner";
    const button=document.createElement("button");button.type="button";button.role="menuitem";button.disabled=item.enabled===false;button.textContent=item.label;
    if(item.submenu){button.className="menu-submenu-trigger";button.setAttribute("aria-haspopup","menu");button.insertAdjacentHTML("beforeend",'<span aria-hidden="true">›</span>');const sub=document.createElement("div");sub.className="menu-submenu";sub.setAttribute("role","menu");appendItems(sub,item.submenu);wrapper.append(button,sub);button.addEventListener("click",()=>openSubmenu(button,sub));button.addEventListener("mouseenter",()=>openSubmenu(button,sub));parent.append(wrapper);}
    else {button.dataset.editorAction=item.id; if(item.value)button.dataset.value=item.value;parent.append(button);}
  }
}
function show(next, x, y){window.dispatchEvent(new CustomEvent("framechute:close-context-menus",{detail:{except:menu}}));context=next;menu.replaceChildren();appendItems(menu,commandsForEditorContext(next));menu.hidden=false;place(menu,x,y);menu.querySelector("button:not(:disabled)")?.focus({preventScroll:true});}
function run(action,value){const block=context?.block;if(!block)return;const selected=context.selected;
  if(action==="save"||action==="save-as")block.querySelector(action==="save"?".document-save":".document-save-as")?.click();
  else if(context.editorKind==="docx")window.dispatchEvent(new CustomEvent("framechute:docx-command",{detail:{block,action,value,selected,range:context.range}}));
  else if(action==="edit-text")selected?.dispatchEvent(new MouseEvent("dblclick",{bubbles:true}));
  else window.dispatchEvent(new CustomEvent("framechute:pdf-context-command",{detail:{block,action,value,selected,clientX:context.clientX,clientY:context.clientY}}));close();}
workspace?.addEventListener("contextmenu",event=>{const next=resolveEditorContext(event.target);if(!next)return;event.preventDefault();event.stopImmediatePropagation();next.clientX=event.clientX;next.clientY=event.clientY;const selection=document.getSelection();if(next.editorKind==="docx"&&selection?.rangeCount&&next.surface.contains(selection.anchorNode))next.range=selection.getRangeAt(0).cloneRange();if(next.selected?.matches(".pdf-text-item"))next.selected.dispatchEvent(new MouseEvent("click",{bubbles:true}));show(next,event.clientX||next.surface.getBoundingClientRect().left+24,event.clientY||next.surface.getBoundingClientRect().top+24);},true);
menu.addEventListener("click",event=>{const button=event.target.closest("button[data-editor-action]");if(button&&!button.disabled)run(button.dataset.editorAction,button.dataset.value);});
menu.addEventListener("keydown",event=>{const button=event.target.closest("button");if(event.key==="Escape"){event.preventDefault();close(true);}else if(event.key==="ArrowRight"&&button?.nextElementSibling?.classList.contains("menu-submenu")){event.preventDefault();openSubmenu(button,button.nextElementSibling);}else if(event.key==="ArrowLeft"&&button?.closest(".menu-submenu")){event.preventDefault();button.closest(".menu-submenu").classList.remove("is-open");button.closest(".menu-submenu-owner")?.querySelector(":scope > button")?.focus();}else if(["ArrowDown","ArrowUp"].includes(event.key)){event.preventDefault();const scope=button?.parentElement.closest('[role="menu"]')||menu,buttons=[...scope.querySelectorAll(":scope > button:not(:disabled), :scope > .menu-submenu-owner > button:not(:disabled)")],at=buttons.indexOf(button);buttons[(at+(event.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length]?.focus();}});
document.addEventListener("pointerdown",event=>{if(!menu.hidden&&!menu.contains(event.target))close();});window.addEventListener("framechute:close-context-menus",event=>{if(event.detail?.except!==menu)close();});
