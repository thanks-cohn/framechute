const states = new WeakMap();

function setStatus(message) {
  const status = document.querySelector("#status");
  if (status) status.textContent = message;
}

function markDirty(block) {
  block.dataset.documentDirty = "true";
  const dirty = block.querySelector(".document-dirty");
  if (dirty) dirty.hidden = false;
}

function snapshot(editor) {
  return {
    html: editor.innerHTML,
    pageSetup: editor.dataset.pageSetup || "",
    padding: editor.style.padding || ""
  };
}

function restoreSnapshot(block, editor, value) {
  editor.innerHTML = value.html;
  if (value.pageSetup) editor.dataset.pageSetup = value.pageSetup;
  else delete editor.dataset.pageSetup;
  editor.style.padding = value.padding || "";
  const state = states.get(block);
  if (state) {
    state.selectedImage = null;
    state.savedRange = null;
    state.preferNativeUndo = false;
  }
  markDirty(block);
  updateImageChrome(block);
}

function pushHistory(block) {
  const state = states.get(block);
  if (!state || state.restoring) return;
  const value = snapshot(state.editor);
  if (state.undo.at(-1)?.html === value.html && state.undo.at(-1)?.pageSetup === value.pageSetup && state.undo.at(-1)?.padding === value.padding) return;
  state.undo.push(value);
  if (state.undo.length > 80) state.undo.shift();
  state.redo.length = 0;
  state.preferNativeUndo = false;
  updateHistoryButtons(block);
}

function undo(block) {
  const state = states.get(block);
  if (!state) return false;
  if (!state.undo.length) {
    state.editor.focus({ preventScroll: true });
    document.execCommand("undo");
    return false;
  }
  state.redo.push(snapshot(state.editor));
  const previous = state.undo.pop();
  state.restoring = true;
  restoreSnapshot(block, state.editor, previous);
  state.restoring = false;
  updateHistoryButtons(block);
  return true;
}

function redo(block) {
  const state = states.get(block);
  if (!state) return false;
  if (!state.redo.length) {
    state.editor.focus({ preventScroll: true });
    document.execCommand("redo");
    return false;
  }
  state.undo.push(snapshot(state.editor));
  const next = state.redo.pop();
  state.restoring = true;
  restoreSnapshot(block, state.editor, next);
  state.restoring = false;
  updateHistoryButtons(block);
  return true;
}

function updateHistoryButtons(block) {
  const state = states.get(block);
  if (!state) return;
  const undoButton = block.querySelector(".docx-undo");
  const redoButton = block.querySelector(".docx-redo");
  if (undoButton) undoButton.disabled = false;
  if (redoButton) redoButton.disabled = !state.redo.length;
}

function validSavedRange(editor, range) {
  if (!range) return null;
  const common = range.commonAncestorContainer;
  const node = common.nodeType === Node.ELEMENT_NODE ? common : common.parentElement;
  return node && editor.contains(node) ? range : null;
}

function currentRange(block) {
  const state = states.get(block);
  if (!state) return null;
  const selection = document.getSelection();
  if (selection?.rangeCount) {
    const range = selection.getRangeAt(0);
    if (validSavedRange(state.editor, range)) return range.cloneRange();
  }
  return validSavedRange(state.editor, state.savedRange)?.cloneRange() || null;
}

function rememberRange(block) {
  const state = states.get(block);
  if (!state) return;
  const selection = document.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (validSavedRange(state.editor, range)) state.savedRange = range.cloneRange();
}

function selectRange(block, range) {
  const state = states.get(block);
  if (!state || !range) return;
  state.editor.focus({ preventScroll: true });
  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  state.savedRange = range.cloneRange();
}

function selectedParagraphs(block) {
  const state = states.get(block);
  if (!state) return [];
  const { editor } = state;
  const range = currentRange(block);
  if (!range) return [];
  const selector = "p,h1,h2,h3,h4,h5,h6,li";
  if (range.collapsed) {
    const node = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
    const paragraph = node?.closest?.(selector);
    return paragraph && editor.contains(paragraph) ? [paragraph] : [];
  }
  return [...editor.querySelectorAll(selector)].filter((paragraph) => {
    try { return range.intersectsNode(paragraph); } catch { return false; }
  });
}

function textSegmentsForRange(editor, range) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.data.length || node.parentElement?.closest?.("[contenteditable='false']")) return NodeFilter.FILTER_REJECT;
      try { return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
      catch { return NodeFilter.FILTER_REJECT; }
    }
  });
  const segments = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let start = 0;
    let end = node.data.length;
    if (node === range.startContainer) start = Math.max(0, Math.min(node.data.length, range.startOffset));
    if (node === range.endContainer) end = Math.max(0, Math.min(node.data.length, range.endOffset));
    if (end > start) segments.push({ node, start, end });
  }
  return segments;
}

function applyInlineStyle(block, property, value) {
  const state = states.get(block);
  if (!state) return false;
  const { editor } = state;
  const range = currentRange(block);
  if (!range) return false;

  pushHistory(block);

  if (range.collapsed) {
    const node = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer : null;
    const run = node?.parentElement && editor.contains(node.parentElement) ? node.parentElement.closest("span,a,b,strong,i,em,u,s,font") : null;
    if (run && editor.contains(run)) {
      run.style[property] = value;
      markDirty(block);
      return true;
    }
    state.undo.pop();
    updateHistoryButtons(block);
    setStatus("Select some DOCX text first, or place the caret inside an existing formatted run.");
    return false;
  }

  const segments = textSegmentsForRange(editor, range);
  if (!segments.length) {
    state.undo.pop();
    updateHistoryButtons(block);
    return false;
  }

  const wrappers = new Array(segments.length);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const { node, start, end } = segments[index];
    const segmentRange = document.createRange();
    segmentRange.setStart(node, start);
    segmentRange.setEnd(node, end);
    const wrapper = document.createElement("span");
    wrapper.style[property] = value;
    segmentRange.surroundContents(wrapper);
    wrappers[index] = wrapper;
  }

  const selectionRange = document.createRange();
  selectionRange.setStartBefore(wrappers[0]);
  selectionRange.setEndAfter(wrappers.at(-1));
  selectRange(block, selectionRange);
  markDirty(block);
  return true;
}

function replaceParagraphTag(paragraph, tagName) {
  if (!paragraph || !/^(P|H[1-6])$/.test(paragraph.tagName)) return paragraph;
  if (paragraph.tagName.toLowerCase() === tagName) return paragraph;
  const replacement = document.createElement(tagName);
  for (const attribute of paragraph.attributes) replacement.setAttribute(attribute.name, attribute.value);
  while (paragraph.firstChild) replacement.append(paragraph.firstChild);
  paragraph.replaceWith(replacement);
  return replacement;
}

function applyParagraphStyle(block, tagName) {
  const state = states.get(block);
  if (!state) return false;
  const paragraphs = selectedParagraphs(block).filter((paragraph) => /^(P|H[1-6])$/.test(paragraph.tagName));
  if (!paragraphs.length) return false;
  pushHistory(block);
  const changed = paragraphs.map((paragraph) => replaceParagraphTag(paragraph, tagName));
  const range = document.createRange();
  range.selectNodeContents(changed[0]);
  if (changed.length > 1) range.setEndAfter(changed.at(-1));
  selectRange(block, range);
  markDirty(block);
  return true;
}

function applyParagraphProperty(block, property, value) {
  const paragraphs = selectedParagraphs(block);
  if (!paragraphs.length) return false;
  pushHistory(block);
  for (const paragraph of paragraphs) paragraph.style[property] = value;
  markDirty(block);
  return true;
}

function applySpecialIndent(block) {
  const type = block.querySelector(".docx-indent-special")?.value || "none";
  const amount = Math.max(0, Number(block.querySelector(".docx-indent-by")?.value) || 0);
  return applyParagraphProperty(block, "textIndent", `${type === "hanging" ? -amount : type === "firstLine" ? amount : 0}in`);
}

function insertPageBreak(block) {
  const state = states.get(block);
  if (!state) return;
  const paragraphs = selectedParagraphs(block);
  const anchor = paragraphs.at(-1) || state.editor.lastElementChild;
  pushHistory(block);
  const paragraph = document.createElement("p");
  paragraph.dataset.pageBreak = "true";
  paragraph.innerHTML = "<br>";
  if (anchor) anchor.insertAdjacentElement("afterend", paragraph);
  else state.editor.append(paragraph);
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  range.collapse(true);
  selectRange(block, range);
  markDirty(block);
  setStatus("Page break inserted.");
}

function pageSetup(block) {
  const state = states.get(block);
  if (!state) return;
  const editor = state.editor;
  const current = editor.dataset.pageSetup || "letter,portrait,1,1,1,1";
  const answer = prompt("Page setup: size, orientation, top, right, bottom, left margins (inches)", current);
  if (!answer) return;
  const [sizeRaw, orientationRaw, ...marginRaw] = answer.split(",").map((part) => part.trim());
  const size = sizeRaw?.toLowerCase();
  const orientation = orientationRaw?.toLowerCase();
  const margins = marginRaw.map(Number);
  if (!["letter", "a4"].includes(size) || !["portrait", "landscape"].includes(orientation) || margins.length !== 4 || margins.some((value) => !Number.isFinite(value) || value < 0 || value > 5)) {
    alert("Use letter or a4, portrait or landscape, and four margins from 0 to 5 inches.");
    return;
  }
  pushHistory(block);
  editor.dataset.pageSetup = [size, orientation, ...margins].join(",");
  editor.style.padding = `${margins[0]}in ${margins[1]}in ${margins[2]}in ${margins[3]}in`;
  editor.dataset.pageSetupChanged = "true";
  markDirty(block);
  setStatus(`DOCX page setup: ${size.toUpperCase()} ${orientation}, margins ${margins.join(" / ")} in.`);
}

function selectImage(block, image) {
  const state = states.get(block);
  if (!state || !image || !state.editor.contains(image)) return;
  state.editor.querySelectorAll("img.is-docx-selected-image").forEach((item) => item.classList.remove("is-docx-selected-image"));
  image.classList.add("is-docx-selected-image");
  state.selectedImage = image;
  const range = document.createRange();
  range.selectNode(image);
  selectRange(block, range);
  updateImageChrome(block);
}

function clearSelectedImage(block) {
  const state = states.get(block);
  if (!state) return;
  state.selectedImage?.classList.remove("is-docx-selected-image");
  state.selectedImage = null;
  updateImageChrome(block);
}

function removeSelectedImage(block, image = states.get(block)?.selectedImage) {
  const state = states.get(block);
  if (!state || !image || !state.editor.contains(image)) return false;
  pushHistory(block);
  image.remove();
  state.selectedImage = null;
  markDirty(block);
  updateImageChrome(block);
  setStatus("DOCX image removed. Ctrl/Cmd+Z or Undo restores it.");
  return true;
}

function resizeImageToWidth(block, image, width) {
  if (!image || !Number.isFinite(width) || width <= 0) return false;
  const oldWidth = Number(image.dataset.docxWidth) || image.getBoundingClientRect().width || image.naturalWidth || 1;
  const oldHeight = Number(image.dataset.docxHeight) || image.getBoundingClientRect().height || image.naturalHeight || 1;
  const ratio = oldHeight / oldWidth;
  const boundedWidth = Math.max(24, Math.min(4000, width));
  const height = Math.max(24, Math.round(boundedWidth * ratio));
  image.dataset.docxWidth = String(Math.round(boundedWidth));
  image.dataset.docxHeight = String(height);
  image.style.width = `${boundedWidth}px`;
  image.style.height = `${height}px`;
  image.style.maxWidth = "none";
  markDirty(block);
  updateImageChrome(block);
  return true;
}

function imageWrap(block, image, mode) {
  const state = states.get(block);
  if (!state || !image || !state.editor.contains(image)) return;
  const editor = state.editor;
  pushHistory(block);
  const imageRect = image.getBoundingClientRect();
  const editorRect = editor.getBoundingClientRect();
  const freeLeft = imageRect.left - editorRect.left + editor.scrollLeft;
  const freeTop = imageRect.top - editorRect.top + editor.scrollTop;

  image.dataset.docxWrap = mode;
  image.style.float = "none";
  image.style.position = "static";
  image.style.left = "";
  image.style.top = "";
  image.style.zIndex = "";
  image.style.margin = "";
  image.style.display = "inline-block";
  image.style.shapeOutside = "";
  image.draggable = true;

  if (mode === "square") {
    image.style.float = "left";
    image.style.margin = "0.2rem 0.65rem 0.35rem 0";
  } else if (mode === "tight") {
    image.style.float = "left";
    image.style.margin = "0.15rem 0.55rem 0.3rem 0";
    image.style.shapeOutside = `url("${image.currentSrc || image.src}")`;
  } else if (mode === "top-bottom") {
    image.style.display = "block";
    image.style.margin = "0.5rem auto";
  } else if (mode === "behind" || mode === "front") {
    editor.style.position = "relative";
    image.style.position = "absolute";
    image.style.left = `${Math.max(0, freeLeft)}px`;
    image.style.top = `${Math.max(0, freeTop)}px`;
    image.style.zIndex = mode === "front" ? "8" : "0";
    image.style.margin = "0";
    image.draggable = false;
  }

  markDirty(block);
  selectImage(block, image);
  setStatus(mode === "front" ? "Image is In Front of Text / Free Position. Drag it anywhere on the DOCX page." : `DOCX image wrapping: ${mode}.`);
}

function updateImageChrome(block) {
  const state = states.get(block);
  if (!state?.resizeHandle) return;
  const image = state.selectedImage;
  if (!image || !state.editor.contains(image)) {
    state.resizeHandle.hidden = true;
    return;
  }
  const rect = image.getBoundingClientRect();
  state.resizeHandle.hidden = false;
  state.resizeHandle.style.left = `${rect.right - 7}px`;
  state.resizeHandle.style.top = `${rect.bottom - 7}px`;
}

function installResizeHandle(block) {
  const state = states.get(block);
  if (!state || state.resizeHandle) return;
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "docx-image-corner-handle";
  handle.title = "Drag to resize DOCX image";
  handle.setAttribute("aria-label", "Resize selected DOCX image");
  handle.hidden = true;
  document.body.append(handle);
  state.resizeHandle = handle;

  handle.addEventListener("pointerdown", (event) => {
    const image = state.selectedImage;
    if (!image) return;
    event.preventDefault();
    event.stopPropagation();
    pushHistory(block);
    const rect = image.getBoundingClientRect();
    const startX = event.clientX;
    const startWidth = rect.width;
    const startHeight = rect.height;
    const ratio = startHeight / Math.max(1, startWidth);
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      const width = Math.max(24, startWidth + moveEvent.clientX - startX);
      const height = Math.max(24, width * ratio);
      image.style.width = `${width}px`;
      image.style.height = `${height}px`;
      image.style.maxWidth = "none";
      image.dataset.docxWidth = String(Math.round(width));
      image.dataset.docxHeight = String(Math.round(height));
      updateImageChrome(block);
    };
    const finish = () => {
      handle.removeEventListener("pointermove", move);
      markDirty(block);
      updateImageChrome(block);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish, { once: true });
    handle.addEventListener("pointercancel", finish, { once: true });
  });

  block.addEventListener("framechute:release-resources", () => handle.remove(), { once: true });
}

function installHistoryButtons(block) {
  const toolbar = block.querySelector(".docx-toolbar");
  if (!toolbar || toolbar.querySelector(".docx-undo")) return;
  const undoButton = document.createElement("button");
  undoButton.type = "button";
  undoButton.className = "docx-undo";
  undoButton.textContent = "Undo";
  undoButton.title = "Undo DOCX edit";
  const redoButton = document.createElement("button");
  redoButton.type = "button";
  redoButton.className = "docx-redo";
  redoButton.textContent = "Redo";
  redoButton.title = "Redo DOCX edit";
  const before = toolbar.querySelector(".document-save");
  toolbar.insertBefore(undoButton, before);
  toolbar.insertBefore(redoButton, before);
  undoButton.addEventListener("click", () => undo(block));
  redoButton.addEventListener("click", () => redo(block));
  updateHistoryButtons(block);
}

function installDocx(block) {
  if (!block?.matches?.(".docx-block") || block.dataset.docxCorrectnessInstalled === "true") return;
  const editor = block.querySelector(".docx-editor");
  const toolbar = block.querySelector(".docx-toolbar");
  if (!editor || !toolbar) return;
  block.dataset.docxCorrectnessInstalled = "true";
  states.set(block, { editor, undo: [], redo: [], savedRange: null, selectedImage: null, resizeHandle: null, restoring: false, preferNativeUndo: false });
  installHistoryButtons(block);
  installResizeHandle(block);

  editor.addEventListener("mouseup", () => rememberRange(block));
  editor.addEventListener("keyup", () => rememberRange(block));
  editor.addEventListener("focusin", () => rememberRange(block));
  editor.addEventListener("input", (event) => {
    const state = states.get(block);
    if (state && !state.restoring && event.isTrusted) state.preferNativeUndo = true;
    rememberRange(block);
    updateImageChrome(block);
  });

  editor.addEventListener("click", (event) => {
    const image = event.target.closest?.("img[data-docx-relationship]");
    if (image && editor.contains(image)) selectImage(block, image);
    else if (!event.target.closest?.(".docx-image-corner-handle")) clearSelectedImage(block);
  }, true);

  editor.addEventListener("keydown", (event) => {
    const state = states.get(block);
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z" && !state.preferNativeUndo && state.undo.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.shiftKey) redo(block); else undo(block);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "y" && state.redo.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      redo(block);
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && state.selectedImage && editor.contains(state.selectedImage)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      removeSelectedImage(block);
    }
  }, true);

  editor.addEventListener("pointerdown", (event) => {
    const image = event.target.closest?.("img[data-docx-relationship]");
    const state = states.get(block);
    if (!image || !state || !["front", "behind"].includes(image.dataset.docxWrap) || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectImage(block, image);
    pushHistory(block);
    const startX = event.clientX;
    const startY = event.clientY;
    const left = Number.parseFloat(image.style.left) || 0;
    const top = Number.parseFloat(image.style.top) || 0;
    image.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      image.style.left = `${Math.max(0, left + moveEvent.clientX - startX)}px`;
      image.style.top = `${Math.max(0, top + moveEvent.clientY - startY)}px`;
      updateImageChrome(block);
    };
    const finish = () => {
      image.removeEventListener("pointermove", move);
      markDirty(block);
      updateImageChrome(block);
    };
    image.addEventListener("pointermove", move);
    image.addEventListener("pointerup", finish, { once: true });
    image.addEventListener("pointercancel", finish, { once: true });
  }, true);

  toolbar.addEventListener("pointerdown", () => rememberRange(block), true);

  toolbar.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches(".docx-font-size")) {
      event.stopImmediatePropagation();
      const size = Number(target.value);
      if (!Number.isFinite(size) || size < 1 || size > 400) {
        target.setCustomValidity("Enter a size from 1 to 400 pt.");
        target.reportValidity();
        return;
      }
      target.setCustomValidity("");
      applyInlineStyle(block, "fontSize", `${size}pt`);
      setStatus(`DOCX font size set to ${size} pt.`);
    } else if (target.matches(".docx-font-family")) {
      event.stopImmediatePropagation();
      applyInlineStyle(block, "fontFamily", target.value);
    } else if (target.matches(".docx-style")) {
      event.stopImmediatePropagation();
      applyParagraphStyle(block, target.value.toLowerCase());
      setStatus(`DOCX paragraph style set to ${target.options[target.selectedIndex]?.text || target.value}.`);
    } else if (target.matches(".docx-line-spacing")) {
      event.stopImmediatePropagation();
      applyParagraphProperty(block, "lineHeight", String(Number(target.value) || 1.15));
    } else if (target.matches(".docx-space-before")) {
      event.stopImmediatePropagation();
      applyParagraphProperty(block, "marginTop", `${Math.max(0, Number(target.value) || 0)}pt`);
    } else if (target.matches(".docx-space-after")) {
      event.stopImmediatePropagation();
      applyParagraphProperty(block, "marginBottom", `${Math.max(0, Number(target.value) || 0)}pt`);
    } else if (target.matches(".docx-indent-left")) {
      event.stopImmediatePropagation();
      applyParagraphProperty(block, "marginLeft", `${Number(target.value) || 0}in`);
    } else if (target.matches(".docx-indent-right")) {
      event.stopImmediatePropagation();
      applyParagraphProperty(block, "marginRight", `${Number(target.value) || 0}in`);
    } else if (target.matches(".docx-indent-special,.docx-indent-by")) {
      event.stopImmediatePropagation();
      applySpecialIndent(block);
    }
  }, true);

  toolbar.addEventListener("click", (event) => {
    if (event.target.closest(".docx-page-break")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      insertPageBreak(block);
    } else if (event.target.closest(".docx-page-setup")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      pageSetup(block);
    }
  }, true);

  block.addEventListener("scroll", () => updateImageChrome(block), true);
  window.addEventListener("resize", () => updateImageChrome(block));
  document.addEventListener("selectionchange", () => {
    const selection = document.getSelection();
    if (selection?.rangeCount && validSavedRange(editor, selection.getRangeAt(0))) rememberRange(block);
  });
}

window.addEventListener("framechute:docx-command", (event) => {
  const { block, action, selected } = event.detail || {};
  if (!states.has(block)) return;
  const state = states.get(block);
  const image = selected?.matches?.("img[data-docx-relationship]") ? selected : state.selectedImage;
  if (action === "undo") {
    event.stopImmediatePropagation();
    undo(block);
  } else if (action === "redo") {
    event.stopImmediatePropagation();
    redo(block);
  } else if (action === "remove-image") {
    event.stopImmediatePropagation();
    removeSelectedImage(block, image);
  } else if (action === "resize-image") {
    event.stopImmediatePropagation();
    if (!image) return;
    const width = Number(prompt("Image width in pixels", image.dataset.docxWidth || Math.round(image.getBoundingClientRect().width)));
    if (width > 0) {
      pushHistory(block);
      resizeImageToWidth(block, image, width);
    }
  } else if (String(action).startsWith("image-wrap-")) {
    event.stopImmediatePropagation();
    imageWrap(block, image, String(action).slice("image-wrap-".length));
  }
}, true);

function installStyles() {
  if (document.querySelector("#framechute-docx-correctness-style")) return;
  const style = document.createElement("style");
  style.id = "framechute-docx-correctness-style";
  style.textContent = `
    .docx-editor img.is-docx-selected-image {
      outline: 2px solid #276ee8;
      outline-offset: 2px;
    }
    .docx-image-corner-handle {
      position: fixed;
      z-index: 2147483645;
      width: 15px;
      height: 15px;
      min-width: 15px;
      min-height: 15px;
      padding: 0;
      border: 2px solid #276ee8;
      border-radius: 3px;
      background: #fff;
      cursor: nwse-resize;
      touch-action: none;
      box-shadow: 0 1px 4px #0003;
    }
    .docx-image-corner-handle[hidden] { display: none !important; }
    .docx-editor [data-page-break="true"] {
      position: relative;
      margin: 34px 0 !important;
      border-top: 2px dashed #9b9b9b;
    }
    .docx-editor [data-page-break="true"]::before {
      content: "Page break";
      position: absolute;
      left: 50%;
      top: -10px;
      transform: translate(-50%, -50%);
      padding: 0 7px;
      background: #fff;
      color: #666;
      font: 10px/1.4 system-ui, sans-serif;
    }
    .docx-toolbar .docx-undo,
    .docx-toolbar .docx-redo { min-width: 48px; }
  `;
  document.head.append(style);
}

installStyles();
document.querySelectorAll(".docx-block").forEach(installDocx);
window.addEventListener("framechute:block-restored", (event) => installDocx(event.detail?.block));
new MutationObserver((records) => {
  for (const record of records) for (const node of record.addedNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    if (node.matches?.(".docx-block")) installDocx(node);
    node.querySelectorAll?.(".docx-block").forEach(installDocx);
  }
}).observe(document.querySelector("#workspace") || document.body, { childList: true, subtree: true });
