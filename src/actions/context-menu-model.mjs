// CODEX DEBUG V10: capability/context laws live here. See
// agents/codex/debug/PR55_STABILIZATION_MAP_V10.md before changing menu behavior.
// IMPORTANT: Advanced OFF must OMIT timing/layer-timing commands from the rendered
// menu model, not merely disable them. `Sync with...` / `Make independent` are
// valid ONLY for actual playable audio/video objects. Static/document objects
// (image/PDF/DOCX/WEBX/text/SVG/canvas/etc.) must never expose media sync.
// PDF/DOCX/WEBX editor surfaces must resolve to their format-native menus from
// the physical right-click target rather than depending on prior selection.

export function resolveEditorContext(target) {
  const surface = target?.closest?.(".pdf-surface, .docx-editor");
  if (!surface) return null;
  const block = surface.closest(".block");
  const editorKind = surface.matches(".pdf-surface") ? "pdf" : "docx";
  const selected = editorKind === "pdf" ? target.closest?.(".pdf-text-item") : target.closest?.("img[data-docx-relationship], a, td, th");
  const selectionKind = !selected ? "text" : selected.matches("img") ? "image" : selected.matches("a") ? "hyperlink" : selected.matches("td,th") ? "cell" : selected.classList.contains("pdf-text-edit") ? "edit" : "source-text";
  return { editorKind, block, surface, selectionKind, selected };
}

export function commandsForEditorContext(context) {
  if (context.editorKind === "docx") {
    const edit = [{id:"undo",label:"Undo"},{id:"redo",label:"Redo"},{type:"separator"},{id:"cut",label:"Cut"},{id:"copy",label:"Copy"},{id:"paste",label:"Paste"},{id:"paste-plain",label:"Paste as Plain Text"},{id:"select-all",label:"Select All"}];
    const format = [{id:"bold",label:"Bold"},{id:"italic",label:"Italic"},{id:"underline",label:"Underline"},{id:"strike",label:"Strikethrough"},{id:"clear-format",label:"Clear direct formatting"},{type:"separator"},{id:"font",label:"Font…"},{id:"paragraph",label:"Paragraph…"},{id:"align-left",label:"Align left"},{id:"align-center",label:"Center"},{id:"align-right",label:"Align right"},{id:"align-full",label:"Justify"},{id:"bullet",label:"Bullets"},{id:"number",label:"Numbering"},{id:"indent",label:"Increase indent"},{id:"outdent",label:"Decrease indent"}];
    const insert = [{id:"link",label:"Insert Link…"},{id:"find",label:"Find / Replace…"}];
    const contextual = context.selectionKind === "hyperlink" ? [{id:"open-link",label:"Open Link"},{id:"edit-link",label:"Edit Link…"},{id:"remove-link",label:"Remove Link"}] : context.selectionKind === "image" ? [{id:"replace-image",label:"Replace Image…"},{id:"resize-image",label:"Resize Image…"},{id:"remove-image",label:"Remove Image"}] : context.selectionKind === "cell" ? [{id:"row-above",label:"Insert Row Above"},{id:"row-below",label:"Insert Row Below"},{id:"column-left",label:"Insert Column Left"},{id:"column-right",label:"Insert Column Right"},{id:"delete-row",label:"Delete Row"},{id:"delete-column",label:"Delete Column"},{id:"delete-table",label:"Delete Table"}] : [];
    return [{id:"bold",label:"Bold"},{id:"italic",label:"Italic"},{id:"underline",label:"Underline"},{type:"separator"},{id:"editing",label:"Edit",submenu:edit},{id:"formatting",label:"Font & Paragraph",submenu:format},{id:"insert",label:"Document",submenu:insert},...(contextual.length?[{id:"context",label:context.selectionKind[0].toUpperCase()+context.selectionKind.slice(1),submenu:contextual}]:[]),{type:"separator"},{id:"save",label:"Save"},{id:"save-as",label:"Save As…"}];
  }
  if (context.selectionKind === "edit") return [
    { id: "edit-text", label: "Edit Text" },
    { id: "font", label: "Font", submenu: ["Helvetica","Helvetica Bold","Helvetica Oblique","Times Roman","Times Bold","Times Italic","Courier","Courier Bold","Courier Oblique"].map(label => ({ id: "font", label, value: label })) },
    { id: "text-size", label: "Text Size…" }, { id: "duplicate", label: "Duplicate" }, { id: "delete", label: "Delete Field" },
    { type: "separator" }, { id: "front", label: "Bring Forward" }, { id: "back", label: "Send Back" },
    { type: "separator" }, { id: "undo", label: "Undo" }, { id: "redo", label: "Redo" }, { id: "settings", label: "Settings…" }, { id: "save", label: "Save" }, { id: "save-as", label: "Save As…" }
  ];
  if (context.selectionKind === "source-text") return [
    { id: "edit-text", label: "Edit / Replace Text" }, { id: "delete", label: "Delete Text" },
    { type: "separator" }, { id: "undo", label: "Undo" }, { id: "redo", label: "Redo" }, { id: "settings", label: "Settings…" }, { id: "save", label: "Save" }, { id: "save-as", label: "Save As…" }
  ];
  return [{ id: "add-text", label: "Add Text Field" }, { id: "insert-image", label: "Insert Image…", enabled: false }, { id: "paste", label: "Paste Text / Paste Image", enabled: false }, { id: "select-region", label: "Select Region", enabled: false }, { type: "separator" }, { id: "undo", label: "Undo" }, { id: "redo", label: "Redo" }, { id: "settings", label: "Settings…" }, { id: "save", label: "Save" }, { id: "save-as", label: "Save As…" }];
}

// CODEX DEBUG V10: this implementation is too video-specific and must become a
// real playable-media capability check for BOTH video and audio. Do not weaken
// it into "advanced && block"; doing so is the regression that puts Sync on
// PDFs/images/documents.
export function supportsMediaSync(block) {
  if (!block) return false;
  const kind = block.dataset?.blockType || block.dataset?.customKind || block.dataset?.customLocalKind;
  if (!["audio", "video", "remote-video"].includes(kind)) return false;
  return Boolean(block.querySelector?.(kind === "audio" ? "audio" : "video"));
}

export function genericAdvancedVisibility({ advanced = false, block = null } = {}) {
  const hasTimedMotion = Boolean(block?.dataset?.timedMotion || block?.classList?.contains?.("has-timed-motion"));
  return { advanced, supportsMediaSync: advanced && supportsMediaSync(block), showImageOnly: advanced, timedEdit: advanced && Boolean(block), timedPlayback: advanced && hasTimedMotion };
}
