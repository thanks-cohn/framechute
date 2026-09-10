# PDF Text Data Safety V1

## Status

**P0 / release-blocking for serious PDF editing.**

This document describes a confirmed data-loss path in the current PDF editor and the invariants required before FrameChute should treat long-form PDF text editing as dependable.

## User-visible failure being prevented

A user must be able to:

1. create or edit a PDF text field;
2. type a large amount of text;
3. press Enter for new lines;
4. press Tab for indentation/spacing;
5. immediately grab and move or resize the field;
6. continue editing, undo, redo, save, reopen, or navigate pages;

without any typed content disappearing.

**Moving geometry must never change text content.**

## Confirmed root cause in the current branch

The current PDF editor has two representations of an actively edited text field:

- the DOM (`.pdf-edit-text[contenteditable=true]`), which immediately contains what the user just typed;
- `runtime.edits`, which is the persistent model used by rerendering and serialization.

Today, the model is generally updated on `focusout`, not on every input. This creates a dangerous interval where the DOM contains newer user data than the model.

### Bug 1: free-text commit is handled as if it were source replacement text

FrameChute-created free text is currently represented approximately as:

```js
{
  kind: "text",
  id: "text:...",
  page,
  index: negativeSyntheticIndex,
  text: "New text",
  ...geometry
}
```

The existing `focusout` handler computes:

```js
const original = runtime.pageData.content.items[index];
const replacement = text.innerText.replace(/\r\n?/g, "\n");
const existing = runtime.edits.find(...);

if (replacement === (existing?.replacement ?? original.str)) return;
```

For a free-text object, `index` is synthetic/negative, so `original` is normally `undefined`. A free-text object also stores its content in `edit.text`, not `edit.replacement`. Therefore `existing?.replacement` is undefined and evaluating `original.str` can throw.

Even when no exception is surfaced to the user, the newly typed DOM content has not been copied into `existing.text`.

### Bug 2: moving/resizing can rerender before the draft is committed

The move/resize `pointerdown` handler calls `preventDefault()`. Depending on browser focus behavior, this can prevent the active contenteditable from blurring before the gesture starts.

The move gesture then mutates geometry, and on pointer-up calls `setPdfPage(...)`, which rerenders the page from `runtime.edits`.

If the current DOM text was never committed to `runtime.edits`, rerendering replaces the visible DOM with the older model value. To the user, the text appears to have been deleted by moving the box.

This is an architecture problem, not a newline or Tab problem.

## Enter, Tab, spaces, and long text

Current PDF text layout intentionally supports explicit newlines and repeated spaces. Enter is normalized to `\n`; Tab currently inserts four literal spaces. Repeated spaces must remain repeated spaces in the canonical text value.

A field may have more text than its current rectangle can display or serialize visibly. That is **overflow/clipping**, not permission to delete the text. The full canonical string must remain in the model even if only some lines fit the current field height.

## Required safety architecture

### Invariant 1: the model must never lag behind user text

No meaningful user text may exist only in the DOM.

Add an `input`/`beforeinput` path that writes the active editor's canonical text into the selected PDF object as the user types:

```text
DOM input
-> normalize textual value
-> update the SAME edit object immediately
-> mark document dirty
```

Use kind-aware storage:

```text
kind: replacement-text -> edit.replacement
kind: text             -> edit.text
kind: image            -> no text path
```

Never use `original.str` for a free-text object.

### Invariant 2: every rerender boundary flushes the active editor first

Create one function such as:

```js
commitActivePdfTextEdit(block)
```

and call it before anything that can rerender, replace the runtime, change page, or serialize, including at minimum:

- move start;
- resize start;
- selecting another PDF object;
- page previous/next/direct navigation;
- font family/size changes;
- Delete/Duplicate;
- Undo/Redo;
- page structural operations;
- PDF merge/crop/compress;
- Save / Save As;
- workspace capture/export;
- PDF frame rerender caused by resize;
- context-menu actions that replace selection state.

The flush must be idempotent.

### Invariant 3: move and resize mutate geometry only

A geometry transaction must never write the text property.

Before and after a move/resize:

```text
textBefore === textAfter
```

byte-for-byte after canonical newline normalization.

### Invariant 4: stable object IDs, not overloaded source indexes

New free-text fields should be selected and looked up by stable `id`, not by overloading `index` with negative timestamp values.

Source-PDF text may retain `sourceIndex` separately for the replacement-mask relationship.

Recommended shape:

```js
{
  id,
  kind: "replacement-text" | "text",
  page,
  sourceIndex: number | null,
  text,
  ...geometry
}
```

The DOM should carry `data-pdf-edit-id` for editable FrameChute objects.

### Invariant 5: history operates on canonical model state

Do not create dozens of undo entries for every keystroke, but do not leave text outside history either.

Recommended edit transaction:

```text
focus/edit begins
-> snapshot model once
-> input mutates canonical object live
-> blur/move/navigation/save commits transaction boundary
```

Then one Undo restores the pre-edit text while preserving subsequent geometry transactions as separate undoable actions where appropriate.

### Invariant 6: overflow never destroys canonical content

`layoutPdfText()` may report overflow and draw only the lines that fit. It must not replace `edit.text` with `layout.lines.join(...)` or otherwise truncate the stored string.

The UI should eventually expose an overflow indication so the user knows some text does not fit the current field.

### Invariant 7: Save is fail-closed

Before Save / Save As:

1. flush active DOM text into the model;
2. validate every editable object;
3. serialize to a new Blob;
4. verify serialization completed;
5. only then clear dirty state.

If serialization fails, keep the editor, model, history, and dirty state intact and tell the user the save failed. Never clear edits after a failed save.

## Mandatory regression tests

At minimum add automated tests for these exact cases.

### A. Free text survives edit -> move

Create free text, type:

```text
First line
    Indented second line
Third  line  with  repeated  spaces
```

Move the box without manually blurring first.

Assert the canonical text is unchanged and geometry changed.

### B. Free text survives edit -> resize

Same as A, but resize immediately after typing.

### C. Free text survives edit -> page navigation -> return

Type multiline text, navigate away, return, and assert exact canonical text.

### D. Free text survives edit -> Save

Save immediately while the contenteditable still owns focus. Reopen the output PDF/model and verify the typed text was the serialized source value.

### E. Free text never dereferences source content

A `kind:"text"` object with no valid `sourceIndex` must never access `pageData.content.items[index].str`.

### F. Replacement text still works

Source replacement text must continue to retain its source mask while its replacement string, geometry, font, and size change independently.

### G. Undo/Redo across text + geometry

Type text, move field, Undo move, Undo text, Redo text, Redo move. At every step assert the expected text and geometry independently.

### H. Large content stress test

Use at least several thousand characters with many explicit newlines and repeated spaces. Move, resize, navigate, Save, and restore workspace state. Assert canonical content equality after every operation.

### I. Overflow safety

Make a field too short to display all lines. Assert layout reports overflow but the canonical edit text remains complete. Enlarge the field and assert the previously clipped lines are available again.

## Acceptance law

The PDF editor is not data-safe until this statement is true:

> **Any operation that changes where or how a PDF text object is displayed may change geometry or presentation, but may never silently change the user's canonical text.**

For the user's specific test: typing a long multiline/indented field and immediately moving it must be a boring operation. The text must remain exactly present, Undo must be able to restore prior states, and Save must serialize the same canonical text that the user can see/edit.
