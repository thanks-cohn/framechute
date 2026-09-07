export function resolveEditorContext(target) {
  const surface = target?.closest?.(".pdf-surface, .docx-editor");
  if (!surface) return null;
  const block = surface.closest(".block");
  const editorKind = surface.matches(".pdf-surface") ? "pdf" : "docx";
  const selected = editorKind === "pdf" ? target.closest?.(".pdf-text-item") : target.closest?.("img[data-docx-relationship]");
  return { editorKind, block, surface, selectionKind: selected ? (selected.matches("img") ? "image" : selected.classList.contains("pdf-text-edit") ? "edit" : "source-text") : "page", selected };
}

export function commandsForEditorContext(context) {
  if (context.editorKind === "docx") return [
    { id: "bold", label: "Bold" }, { id: "italic", label: "Italic" }, { id: "underline", label: "Underline" },
    { type: "separator" }, { id: "save", label: "Save" }, { id: "save-as", label: "Save As…" }
  ];
  if (context.selectionKind === "edit") return [
    { id: "edit-text", label: "Edit Text" },
    { id: "font", label: "Font", submenu: ["Helvetica","Helvetica Bold","Helvetica Oblique","Times Roman","Times Bold","Times Italic","Courier","Courier Bold","Courier Oblique"].map(label => ({ id: "font", label, value: label })) },
    { id: "text-size", label: "Text Size…" }, { id: "duplicate", label: "Duplicate" }, { id: "delete", label: "Delete Field" },
    { type: "separator" }, { id: "front", label: "Bring Forward" }, { id: "back", label: "Send Back" },
    { type: "separator" }, { id: "save", label: "Save" }, { id: "save-as", label: "Save As…" }
  ];
  if (context.selectionKind === "source-text") return [
    { id: "edit-text", label: "Edit / Replace Text" }, { id: "delete", label: "Delete Text" },
    { type: "separator" }, { id: "save", label: "Save" }, { id: "save-as", label: "Save As…" }
  ];
  return [{ id: "add-text", label: "Add Text Field" }, { id: "insert-image", label: "Insert Image…", enabled: false }, { id: "paste", label: "Paste Text / Paste Image", enabled: false }, { id: "select-region", label: "Select Region", enabled: false }, { type: "separator" }, { id: "save", label: "Save" }, { id: "save-as", label: "Save As…" }];
}

export function supportsMediaSync(block) {
  return Boolean(block && (block.dataset?.blockType === "video" || block.dataset?.customKind === "remote-video") && block.querySelector?.("video"));
}

export function genericAdvancedVisibility({ advanced = false, block = null } = {}) {
  const hasTimedMotion = Boolean(block?.dataset?.timedMotion || block?.classList?.contains?.("has-timed-motion"));
  return { advanced, supportsMediaSync: advanced && supportsMediaSync(block), showImageOnly: advanced, timedEdit: advanced && Boolean(block), timedPlayback: advanced && hasTimedMotion };
}
