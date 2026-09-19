# 2026-09-18 19:06:02 CDT — PDF text editing root-cause report

**Repository:** `thanks-cohn/framechute`  
**Branch inspected:** `main`  
**Main commit inspected:** `4c7b1621cdbfae39eca4c721ed1027499f286f75`  
**Area:** PDF live text editing, source-text presentation, field selection, move/resize handles, formatting controls

## User-visible bugs

1. Clicking existing PDF text enters editing, but if the text is not changed and focus moves elsewhere, the editable DOM text remains visible over the original canvas glyphs. The result is doubled/superimposed text.
2. A single click does not show the move/resize handles.
3. Repeated clicking does not reliably make an untouched source field behave like a selectable field with handles.
4. Double click does not select the entire field for whole-field formatting. Current behavior preserves normal contenteditable word selection instead.
5. Untouched source text cannot participate in the same field-selection/formatting path as an already-authored replacement or free-text field.

## Intended interaction contract

- **Single click:** enter caret/text editing **and** show the field move/resize handles.
- **Double click:** select/highlight the entire field, keep handles visible, and make field-level formatting such as font family and font size operate on that field.
- **Click elsewhere without making a change:** exit editing cleanly and restore the original source presentation, with only the PDF canvas glyphs visible.
- **No edit should be persisted merely because the user clicked a source field.** A replacement should be materialized only when text, font/formatting, position, or size actually changes.

---

## Root cause 1: unchanged edit exit removes the mask but does not restore the transparent source overlay

### Relevant behavior

Untouched source text is represented by two visual layers:

1. the immutable PDF canvas, which already paints the original glyphs;
2. a DOM `.pdf-text-item > .pdf-edit-text` overlay used for hit testing/editing.

The source DOM overlay is intentionally invisible at rest:

```css
.pdf-text-item {
  color: transparent;
}
```

When editing begins, `enterPdfTextEditing()` explicitly makes the DOM text visible with inline styles:

```js
Object.assign(text.style,{
  color:"#111",
  WebkitTextFillColor:"#111",
  background:"transparent",
  opacity:"1"
});
```

It also adds `is-editing`, makes the inner text contenteditable, and creates a transient white source mask for existing source text so the canvas glyphs beneath it are hidden while the live DOM text is visible.

### Failure sequence

For an untouched source run:

1. User single-clicks source text.
2. DOM text becomes visible.
3. A transient source mask hides the canvas copy.
4. User changes nothing and clicks elsewhere.
5. `focusout` calls:

```js
const result=commitActivePdfText(block,"focusout");
if(result.changed) void setPdfPage(...);
```

6. `applyPdfTextCommit()` compares the text with the original source string and returns `changed:false`.
7. `commitPdfTextEdit()` removes `contenteditable` and removes the `is-editing` class.
8. `commitActivePdfText()` removes the transient live mask even when `changed:false`.
9. Because `result.changed` is false, **no rerender occurs**.
10. The inline `color:#111` / `-webkit-text-fill-color:#111` applied to the inner text is **never cleared**.

At that point the canvas glyphs are visible again because the mask is gone, while the DOM copy is also still visible because its inline text color remains black.

**Result: exact superimposition/doubling.**

### Why changed edits do not expose the same symptom

When an actual edit changes, the focusout path rerenders the page. The rerender reconstructs the text-layer DOM and presentation masks, replacing the transient live-edit DOM state with canonical source/replacement presentation. The unchanged path skips that reconstruction.

### Required correction

The editor needs an explicit **exit-live-edit presentation cleanup** that runs for both changed and unchanged exits.

For an unchanged untouched source run, cleanup must restore source presentation without creating an edit:

- remove `contenteditable`;
- remove `is-editing`;
- remove transient live mask;
- clear live inline text visibility overrides (`color`, `WebkitTextFillColor`, `background`, `opacity`) so the source DOM overlay returns to transparent;
- clear transient live text/autofit/edit datasets as appropriate;
- preserve the immutable canvas as sole visible source truth.

A full page rerender on every unchanged blur would also hide the symptom, but it is heavier than necessary and would undo the recent work to avoid needless PDF canvas repaints. The cleaner fix is a canonical exit-state restoration path.

---

## Root cause 2: single click is explicitly coded to hide controls and not select the field

The current click handler does this:

```js
textLayer.addEventListener("click", event => {
  ...
  block.querySelectorAll(".pdf-text-item.is-selected")
    .forEach(node=>node.classList.remove("is-selected"));

  const controls=block.querySelector(".pdf-edit-controls");
  if(controls) controls.hidden=true;

  enterPdfTextEditing(event,span,{showControls:false});
});
```

This directly contradicts the desired interaction.

On every single click it:

1. removes `is-selected` from every field;
2. hides the PDF edit controls;
3. calls `enterPdfTextEditing(..., {showControls:false})`.

So even before considering any other bug, **single click is intentionally prevented from showing field controls/selection**.

The current regression test also locks this behavior in:

```js
test("single click enters PDF text editing without selecting the entire source run",()=>{
  ...
  assert.match(block,/showControls=false/);
});
```

That test represents the old interaction contract and must be revised for the new one.

---

## Root cause 3: untouched source text does not possess the handle/selection machinery at all

The problem is deeper than `showControls:false`.

### Untouched source spans

In `renderPdfPage()`, untouched source text is rendered as:

```js
span.className = "pdf-text-item";
```

It receives an inner `.pdf-edit-text`, but it does **not** receive:

- the `pdf-text-edit` class;
- a `.pdf-move-handle`;
- a `.pdf-resize-handle`.

Those are only added when the source already has a saved replacement, or when the object is free text/image.

### Selection helper rejects untouched source

`selectPdfEdit()` contains this gate:

```js
if(!span?.classList.contains("pdf-text-edit")){
  controls.hidden=true;
  delete block.dataset.selectedPdfIndex;
  delete block.dataset.selectedPdfObjectId;
  return;
}
```

Therefore an untouched source run cannot become a selected PDF edit target.

### Controls helper also inherits the restriction

`showPdfTextControls()` only selects the span when:

```js
if(span?.classList.contains("pdf-text-edit"))
  selectPdfEdit(block,span);
```

So even if the toolbar is revealed, untouched source text still does not enter the same object-selection path.

### CSS only reveals handles for authored/selectable edit spans

```css
.pdf-move-handle,
.pdf-resize-handle {
  display: none;
}

.pdf-text-edit.is-selected .pdf-move-handle,
.pdf-text-edit.is-selected .pdf-resize-handle {
  display: block;
}
```

Untouched source text fails all three requirements:

- no `pdf-text-edit` class;
- no `is-selected` state;
- no handle elements to display.

This is why repeated clicking cannot make the handles appear on untouched source text.

---

## Root cause 4: double click is explicitly designed to preserve native word selection, not select the whole field

Current double-click behavior:

```js
textLayer.addEventListener("dblclick", event => {
  ...
  if(!text?.isContentEditable)
    enterPdfTextEditing(event,span,{showControls:true,preserveSelection:true});
  else
    showPdfTextControls(block,span);

  // Double-click enhances the same editing session; it never commits or
  // switches modes. Native contenteditable keeps the user's word selection.
});
```

This is not an accidental failure. It is the present design.

The current regression test also enforces it:

```js
test("double click stays in the same text editing session and only reveals controls",()=>{
  ...
  assert.match(block,/showPdfTextControls/);
  assert.equal(block.includes("commitActivePdfText"),false);
  assert.equal(block.includes("beginPdfManipulation"),false);
});
```

There is no whole-field selection operation here. Native browser double-click selection is allowed to select a word inside contenteditable.

So the requested behavior:

> double click = whole field highlighted for font/field-level operations

does not currently exist as a state.

---

## Root cause 5: field formatting depends on selected edit identity, which untouched source text does not have

The font-family handler uses:

```js
const edit=selectedPdfEdit(block);
if(!edit || edit.fontFamily===event.target.value) return;
```

`selectedPdfEdit()` resolves from the selected object/index back to an item in `runtime.edits`.

An untouched source run is intentionally **not yet in `runtime.edits`**.

This is correct from a persistence standpoint, but it means the UI currently conflates two different concepts:

- **interaction selection**: “the user has selected this source field”;
- **authored edit object**: “this field has already been modified and persisted as a replacement.”

Those must be separated.

An untouched source field needs to be selectable and format-able **before** an authored replacement exists. If the user then changes font, size, geometry, or text, the editor can materialize the replacement at that moment.

---

## Structural diagnosis

The PDF editor currently has these runtime concepts:

- idle
- editing
- manipulating
- persisted edit/replacement

But the desired UX needs another explicit concept:

- **selected field / selected source object**

Selection must not require persistence.

The code currently uses `pdf-text-edit`, `is-selected`, `selectedPdfEdit()`, and the existence of a runtime edit as if they all mean the same thing. They do not.

This coupling explains both missing handles and the inability to perform whole-field formatting on untouched source text.

---

## Recommended interaction/state correction

### 1. Separate selected target identity from persisted edit identity

Introduce a selection record that can point to either:

- an untouched source object, or
- an existing authored edit.

For example, selection can be keyed by `objectId`, `sourceObjectId`, page, and source index without requiring an item in `runtime.edits`.

### 2. Give source text transient field chrome

When source text is activated, provide move/resize handles as **interaction chrome** without immediately creating a replacement.

Possible implementation patterns:

- append/reuse transient handle elements on the active span; or
- render handles for all text spans but reveal them only for the selected target.

Do not interpret the mere existence of handles as proof that an authored edit already exists.

### 3. Single click contract

Single click should:

- select the field target;
- enter caret editing;
- display move/resize handles;
- display the relevant formatting controls;
- keep the live source mask while source DOM text is visibly editing.

### 4. Double click contract

Double click should promote the current field to whole-field selection:

- preserve the selected field target;
- keep move/resize handles visible;
- select/highlight the entire editable field rather than a single native word;
- make font/font-size controls operate on the field;
- materialize an authored replacement only if formatting or geometry actually changes.

This likely needs an explicit field-selection state instead of relying on browser-native double-click behavior.

### 5. Clean unchanged exit

On clicking elsewhere without changes:

- exit caret/field-selection state;
- remove transient mask/chrome as appropriate;
- restore the source overlay to transparent;
- leave no runtime edit behind;
- show only original canvas glyphs.

### 6. Materialize edits lazily

For untouched source text, create a replacement edit only when one of these changes:

- text;
- font family;
- font size/style;
- position;
- width/height.

Clicking/selecting alone should remain non-destructive.

---

## Tests that need to change/add

### Existing tests that encode the wrong UX

The first two tests in `tests/pdf-live-editing-interaction.test.mjs` currently enforce the old behavior:

- `single click enters PDF text editing without selecting the entire source run`
- `double click stays in the same text editing session and only reveals controls`

They should be replaced or rewritten around the new contract.

### Required regression tests

1. **Unchanged source edit restores transparent overlay**
   - click source text;
   - enter edit state;
   - blur without input;
   - assert no authored edit exists;
   - assert transient live mask is gone;
   - assert live visibility overrides are gone;
   - assert source overlay is transparent/non-painted.

2. **Single click selects target and exposes handles**
   - untouched source text must gain visible move + resize interaction chrome;
   - caret editing remains active.

3. **Single click on existing replacement/free text also exposes handles**
   - same UX regardless of whether the object has already been authored.

4. **Double click selects whole field**
   - selection range covers the entire field;
   - selected target remains stable;
   - handles remain visible;
   - toolbar points at the selected target.

5. **Formatting untouched source materializes edit lazily**
   - select untouched source;
   - change font;
   - only then create replacement;
   - source ownership/mask remains immutable and correct.

6. **Selection alone is not dirty**
   - click/double-click without modifying content/format/geometry;
   - no history entry;
   - no document dirty flag;
   - no persisted replacement.

7. **Click-away after no-op never doubles glyphs**
   - explicit visual/presentation-state assertion for canvas-source + transparent DOM source overlay.

---

## Severity

**High for PDF editor usability.**

The underlying PDF data is not necessarily corrupted by the no-op click bug, but the live editor presents contradictory visual truth and the field interaction model prevents the intended core editing workflow. The double-text symptom also makes users reasonably distrust whether an edit has actually been committed.

## Confidence

**High.**

All three primary symptoms map directly to explicit current code paths:

- no-op focusout removes the mask but skips rerender/visibility restoration;
- single click explicitly hides controls and passes `showControls:false`;
- untouched source spans do not have the `pdf-text-edit` class or handle elements and are rejected by `selectPdfEdit()`;
- double click is explicitly documented and regression-tested to retain native contenteditable selection rather than select the whole field.
