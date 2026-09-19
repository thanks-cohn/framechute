import { routeOpenFileSelection } from "./file-selection-routing.mjs";

const workspace = document.querySelector("#workspace");
const status = document.querySelector("#status");
const exportButton = document.querySelector("#export-fcx");

function isEditing(target) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"], .text-editor, .docx-editor, .pdf-text-layer'));
}

function point() {
  const rect = workspace.getBoundingClientRect();
  return { x: Math.max(40, innerWidth / 2 - rect.left), y: Math.max(40, innerHeight / 2 - rect.top) };
}

function routeFiles(files) {
  return routeOpenFileSelection(files, {
    openSnapshot: file => window.dispatchEvent(new CustomEvent("framechute:open-snapshot-file", { detail: { file } })),
    ingestFiles: ordinary => void window.FrameChuteIngest?.addFiles(ordinary, point()),
    announce: message => { if (status) status.textContent = message; }
  });
}

async function openFiles() {
  try {
    if (typeof showOpenFilePicker === "function") {
      const handles = await showOpenFilePicker({ multiple: true });
      const files = await Promise.all(handles.map(handle => handle.getFile()));
      // Preserve the existing all-or-nothing FCX routing rules before opening
      // any ordinary native document handles.
      if (files.some(file => /\.fcx$/i.test(file.name || ""))) {
        routeFiles(files);
        return;
      }
      const ordinary = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index], handle = handles[index];
        if (/\.(?:pdf|docx)$/i.test(file.name || "")) {
          const detail = { handle, file, point: point() };
          window.dispatchEvent(new CustomEvent("framechute:open-document-handle", { detail }));
          await detail.promise;
        } else ordinary.push(file);
      }
      if (ordinary.length) routeFiles(ordinary);
      return;
    }
    const picker = document.createElement("input");
    picker.type = "file"; picker.multiple = true;
    picker.addEventListener("change", () => routeFiles([...picker.files]), { once: true });
    picker.click();
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      if (status) status.textContent = "FrameChute could not open that file.";
    }
  }
}

const menu = document.createElement("div");
menu.className = "workspace-file-menu";
menu.hidden = true;
menu.innerHTML = '<button type="button">Open File…</button>';
document.body.append(menu);
menu.querySelector("button").addEventListener("click", () => { menu.hidden = true; void openFiles(); });
window.addEventListener("framechute:open-file", () => void openFiles());

workspace.addEventListener("contextmenu", event => {
  if (event.target.closest(".block")) return;
  event.preventDefault();
  window.dispatchEvent(new CustomEvent("framechute:close-context-menus",{detail:{except:menu}}));
  menu.style.left = `${Math.min(event.clientX, innerWidth - 150)}px`;
  menu.style.top = `${Math.min(event.clientY, innerHeight - 45)}px`;
  menu.hidden = false;
  menu.querySelector("button").focus();
});
document.addEventListener("pointerdown", event => { if (!menu.contains(event.target)) menu.hidden = true; });
window.addEventListener("framechute:close-context-menus",event=>{if(event.detail?.except!==menu)menu.hidden=true;});

window.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "e") {
    event.preventDefault();
    exportButton?.click();
  }
});

window.addEventListener("paste", async event => {
  if (isEditing(event.target)) return;
  const data = event.clipboardData;
  if (!data) return;
  const files = [...data.files];
  const text = data.getData("text/plain").trim();
  if (!files.length && !text) return;
  event.preventDefault();
  if (files.length) {
    const handled = await window.FrameChuteIngest?.addFiles(files, point());
    if (handled) return;
  }
  if (text) {
    try {
      const url = new URL(text);
      if (["http:", "https:"].includes(url.protocol)) window.FrameChuteIngest?.addUrl(text, point());
      else await window.FrameChuteIngest?.addText(text, point());
    } catch { await window.FrameChuteIngest?.addText(text, point()); }
  }
});
