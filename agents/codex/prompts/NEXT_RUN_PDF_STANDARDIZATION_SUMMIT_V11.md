# NEXT RUN — PDF SAFE STANDARDIZATION SUMMIT V11

## Status

PR #56 / V10 is merged. The next run is PDF-first.

This prompt is the single authoritative prompt for this run.

The goal is not to make FrameChute pretend to be Acrobat. The goal is to push the PDF surface as far as we safely can toward ordinary, predictable document-editor behavior while preserving the PDF itself.

The core release standard is:

> **Open a PDF → change one thing → save it → everything unrelated remains intact.**

If FrameChute cannot safely preserve a PDF feature it does not understand, do not silently destroy or flatten it. Prefer a conservative behavior, a clear limitation, or a blocked destructive operation over corrupting unrelated content.

## Read before editing

Read the current implementations and tests first:

- `src/documents/pdf-document.js`
- `src/workspace.js`
- `src/workspace.html`
- `src/workspace.css`
- `src/editor-context-menu.js`
- `src/actions/context-menu-model.mjs`
- `src/drag-ownership.mjs`
- `src/document-image-drag.mjs`
- `tests/pdf-text-model.test.mjs`
- `tests/pdf-source-mask.test.mjs`
- `tests/document-image-drag.test.mjs`
- `agents/codex/prompts/NEXT_RUN_PR55_RECONCILE_AND_STABILIZE_DOCX_PDF_MENUS_V10.md`

Also inspect the merged post-V10 PDF fixes on `main`. Do not regress the free-text state-loss fix, image drag ownership, direct PDF image placement, link-deletion preference, or V10 overlay rules.

---

# Product law

A PDF opened in FrameChute should feel like a normal document surface, not a fragile canvas demo.

For every supported edit, the user should be able to:

1. select it,
2. edit it,
3. move/resize it where appropriate,
4. undo/redo it,
5. save,
6. reopen,
7. see the same result.

No supported edit may exist only in the DOM. The semantic PDF model is the source of truth.

No operation may silently rasterize the whole PDF unless the user explicitly chooses a flatten/rasterize operation.

No operation may silently remove unrelated pages, links, annotations, form fields, page boxes, page rotation, images, vector content, or metadata merely because FrameChute does not edit them.

---

# P0 — PDF state and round-trip correctness

## One semantic edit-object contract

Audit all PDF edit kinds and make the state model explicit.

At minimum distinguish:

- source-text replacement
- free text
- inserted image
- moved/resized inserted image
- link-aware text edit
- page operations
- any annotations FrameChute already supports

Every edit needs stable identity.

Moving/resizing must mutate geometry on the same semantic object. Typing must mutate text on the same semantic object. Re-rendering must never reconstruct an edit from stale DOM state.

The following sequences must preserve data exactly:

- type → move
- type → resize
- type → deselect/reselect
- type → page away/page back
- type → undo/redo
- type → save/reopen
- move → save/reopen
- resize → save/reopen
- image drop → move → resize → save/reopen

The old `"New text"` resurrection bug must have a permanent regression test.

---

# P0 — Text behavior that feels normal

## Canonical text

Internally preserve:

- literal spaces
- repeated spaces
- `\n`
- explicit blank lines
- `\t`

Do not normalize away user text during movement, resize, rerender, serialization, or undo/redo.

Tabs may be expanded only for layout/rendering. The semantic stored text must remain a tab.

## Editing keys

Free-text fields should behave like ordinary text editors:

- Enter inserts a newline
- Shift+Enter must not unexpectedly submit/commit the field
- Tab inserts or advances using the deterministic PDF text-field tab policy rather than leaving the field unless an accessibility/focus rule explicitly requires otherwise
- Backspace/Delete operate on text normally
- Ctrl/Cmd+A inside a text edit selects the field text, not the entire FrameChute workspace
- Ctrl/Cmd+C/X/V should work as expected where browser permissions permit
- Escape cancels the active uncommitted edit only when that is the existing FrameChute contract; otherwise do not invent destructive behavior

Do not steal normal text-editor keyboard events for workspace shortcuts while a PDF text editor owns focus.

## Field growth and overflow

An unconstrained free-text field should grow downward while preserving its top edge when additional explicit lines require it.

If the user explicitly resizes a field to a constrained height, preserve the constraint and represent overflow honestly. Do not silently discard text.

Preview and serialized PDF must use the same line-break/tab/whitespace rules closely enough that the saved result does not visibly jump.

---

# P0 — Existing PDF text: conservative replacement

FrameChute currently uses source masks plus replacement text for existing PDF text. Keep this conservative model unless there is a demonstrably safer implementation.

Do not attempt broad destructive rewriting of arbitrary PDF content streams just to claim direct text editing.

Existing-text replacement must:

- cover the original source area predictably,
- retain the replacement's stable edit identity,
- preserve the replacement after move/resize,
- preserve link target semantics when the source text is linked,
- keep source-mask and replacement geometry synchronized where necessary,
- serialize without erasing unrelated nearby content.

If an original text item has transforms/rotation, handle its geometry explicitly rather than assuming every page is unrotated horizontal text.

---

# P0 — Fonts and formatting

Make the supported font behavior explicit and deterministic.

The current standard-font set is acceptable as a safe baseline. Do not pretend an arbitrary original embedded font can be edited if FrameChute cannot safely reuse it.

For supported editable text:

- font family
- font size
- bold/italic variants where represented by a supported standard font
- text color if safely supported

should survive rerender and save/reopen.

If font substitution is required, expose a consistent substitution rule rather than silently changing differently between preview and serialization.

Do not corrupt Unicode text merely to force it into a Standard 14 font. Detect unsupported glyph coverage and either select a safe available path or tell the user the text cannot currently be serialized faithfully.

---

# P0 — PDF images

Image insertion must be dependable.

Support the existing safe interchange behavior:

- external image → PDF
- workspace image → PDF
- DOCX image → PDF where the V10 cross-container path already allows it
- PDF inserted image → same PDF MOVE
- PDF image → workspace COPY where currently supported

For an image placed into a PDF:

- insert exactly once,
- use canonical bytes,
- convert unsupported browser image formats to PNG/JPEG when required by pdf-lib,
- preserve aspect ratio by default unless the user deliberately reshapes it,
- allow move and resize,
- keep the same semantic image object for same-PDF moves,
- save/reopen at the same geometry.

Respect page rotation and coordinate conversion. A drop onto a rotated page must land where the user dropped it.

No PDF drag target may show the global `Drop into FrameChute` overlay.

---

# P0 — Page geometry and operations

Harden current page operations:

- add page
- delete page
- duplicate page
- move/reorder page
- rotate page
- extract page
- insert/merge PDF
- crop margins

Requirements:

- preserve heterogeneous page sizes,
- preserve page rotation,
- preserve MediaBox/CropBox relationships when possible,
- never assume US Letter,
- never shift edit objects onto the wrong page after reorder/delete/insert,
- undo/redo page operations if the current architecture supports them safely; otherwise do not fake it,
- save/reopen must preserve the resulting page order and geometry.

Page transformations must update FrameChute-owned edit coordinates deterministically.

---

# P0 — Links, annotations, and deletion semantics

Keep the PDF-specific setting:

**Deleting Text Deletes Link [ON]**

When linked text is edited:

- preserve the link target,
- update its clickable rectangle to follow the edited text where FrameChute owns the replacement geometry.

When linked text is deleted with the setting ON:

- remove the associated link annotation in the same semantic undo action.

Undo restores both text and link.

When the setting is OFF:

- deleting text does not silently delete the annotation; preserve the annotation unless the user explicitly removes it.

Do not delete unrelated annotations sharing the page.

---

# P1 — Selection and direct manipulation

Make selection boring and predictable.

For FrameChute-owned PDF text/image edits:

- click selects,
- click elsewhere deselects,
- selected object exposes move/resize affordances,
- handles remain attached to the selected object,
- movement does not convert the object into a new object,
- Delete removes the selected FrameChute-owned edit only when focus is not currently editing text,
- arrow-key nudging is welcome if it can be implemented safely and consistently,
- multi-selection is optional; do not destabilize single-selection to chase it.

Right-click inside a PDF must always route to the PDF-specific menu based on physical target.

Nested menus must remain adjacent to their trigger using the shared submenu positioning primitive.

---

# P1 — Undo / redo

Audit PDF undo/redo as semantic transactions.

One user gesture should normally create one undo step:

- one move
- one resize
- one text commit
- one image insert
- one delete
- linked-text + associated annotation deletion together
- one page operation

Do not record dozens of pointermove events as dozens of undo steps.

Undo/redo must restore semantic state, then rerender from that state.

---

# P1 — Safe-save preflight

Add a conservative PDF save preflight where practical.

The purpose is not to perfectly understand all PDF internals. The purpose is to avoid obvious destructive rewrites.

Before writing a modified PDF, preserve or sanity-check important unaffected characteristics where accessible:

- page count unless intentionally changed,
- per-page size,
- per-page rotation,
- existence of AcroForm if source had one,
- annotations/links not intentionally removed,
- encryption/password constraints,
- document metadata where the library preserves it.

If a source PDF uses a feature the current serializer demonstrably destroys, prefer warning/blocking the unsafe save path over silently claiming success.

Do not strip encryption or permissions as a side effect.

---

# P1 — Forms and unsupported PDF features

Do not broaden into a half-working form editor unless the existing architecture already makes it safe.

However, test PDFs containing AcroForm fields and annotations to ensure ordinary unrelated FrameChute edits do not destroy them.

Same for:

- bookmarks/outlines,
- attachments,
- unusual page boxes,
- transparency/vector graphics,
- embedded fonts,
- rotated text,
- mixed page sizes.

The standardization goal is partly **non-destruction of unsupported content**.

---

# P1 — UI cleanup

Keep the PDF toolbar compact and intentional.

The user should be able to discover:

- Save / Save As
- page navigation
- text editing controls when a text edit is selected
- page operations
- PDF-specific Settings
- image-related actions where appropriate

Do not let controls wrap into a visually broken pile when the block width narrows. Use compact popdowns/overflow patterns already established in FrameChute.

Do not expose controls that are not functional.

---

# Testing

Expand automated tests around semantic invariants, not just helper functions.

At minimum add/strengthen tests for:

1. free text exact whitespace round-trip,
2. free text movement preserving text and object identity,
3. resize preserving text and identity,
4. source replacement preserving source mask contract,
5. tabs remaining canonical while layout expansion is deterministic,
6. blank-line preservation,
7. supported font serialization,
8. unsupported glyph/font behavior failing safely rather than corrupting text,
9. inserted PNG/JPEG save/reopen,
10. unsupported browser image format conversion path where testable,
11. same-PDF image move does not duplicate,
12. page reorder/delete/insert remaps FrameChute-owned edits correctly,
13. mixed page sizes and rotations,
14. linked-text deletion preference and one-step undo semantics,
15. annotations not intentionally targeted remain present,
16. save/reopen after combined text + image + page edits,
17. no global workspace drop overlay on PDF destinations.

Use synthetic PDFs generated in tests when possible so regressions are reproducible.

Run:

- full `node --test tests/*.test.mjs`
- `node --check` on changed JS/MJS files
- `git diff --check`
- Chrome Web Store packaging gate

If browser runtime is available, manually exercise:

- create free text, type spaces/tabs/newlines, move, resize, page away/back, save/reopen
- replace existing text
- insert image by picker and drag/drop
- move/resize inserted image
- rotated page image placement
- page add/delete/reorder/rotate
- link edit/delete setting
- undo/redo
- narrow PDF block toolbar/popdowns

Do not claim manual verification that was not actually performed.

---

# Scope discipline

This is a **PDF standardization run**.

Do not start CSV work.
Do not start 3D work.
Do not redesign the entire workspace.
Do not begin the DOCX image-wrap milestone except for a shared primitive required to prevent a PDF regression.

Fix adjacent PDF correctness bugs you discover when they materially affect the standardization goal.

Prefer deleting contradictory legacy paths over layering another competing PDF state model on top.

---

# Handoff

At the end, report:

- files changed,
- PDF invariants now guaranteed,
- tests added,
- automated test results,
- manual browser behaviors actually exercised,
- known unsupported PDF features,
- any source PDFs that still cannot be safely round-tripped,
- the next highest-value PDF gap.

The success criterion is not feature count.

The success criterion is that the supported PDF subset feels ordinary, survives save/reopen, and does not casually destroy the rest of the document.
