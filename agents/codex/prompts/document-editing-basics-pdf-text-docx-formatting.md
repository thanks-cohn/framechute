# Codex Request: PDF Text Editing + Practical DOCX Formatting Basics

## Mission

FrameChute already has the beginnings of native PDF/DOCX editing. This pass should make those editors feel like ordinary usable document tools rather than viewers with a few special-case controls.

The user expectation is simple:

> If I can see text in a normal PDF or DOCX, I should be able to make a small obvious change, use familiar basic formatting, and save the native file again.

This is not a request for Acrobat or Microsoft Word parity. It is a request for the basic editing surface people now expect even from lightweight Markdown-capable editors.

Use the latest `main` as the source of truth.

Read the existing broader document prompt for architectural background:

`agents/codex/prompts/editable-documents-pdf-docx-native-save.md`

This focused request wins where it is more specific.

---

# Preserve current good behavior

Do not regress:

- native PDF Save / Save As
- native DOCX Save / Save As
- DOCX embedded-image rendering/insertion
- unique DOCX relationship IDs and DrawingML IDs
- DOCX nested image-drop ownership
- current PDF page operations
- FCX capture/restore of document state
- dirty-state warnings
- Simple/Classic availability

Do not replace the existing editors with a disconnected mini-application.

---

# 1. Make visible PDF text actually editable

The repository already renders PDF text items into a positioned `.pdf-text-layer`, and `serializeEditedPdf(...)` already has a v1 visual replacement path that covers the original glyph area and draws replacement text into the saved PDF.

The missing part is a clear user-facing edit loop.

## Required interaction

For ordinary text-layer PDFs:

```text
click or double-click visible text
        ↓
edit that text in place
        ↓
Enter / click away commits
Escape cancels the current uncommitted change
        ↓
PDF becomes dirty
        ↓
Save / Save As
        ↓
reopened PDF visibly contains the replacement
```

Use an inline editable overlay or compact text-edit popover anchored to the selected text item. Do not make the user edit the whole page in one textarea.

## Edit model

Store PDF text edits explicitly and serializably. At minimum each committed edit needs enough information to survive page navigation, FCX restore, and native save:

- page number
- stable text-item identity/index for the current source PDF
- original text
- replacement text
- PDF-space x/y
- width/height
- font size
- rotation/orientation when known
- reasonable color/family fallback data when derivable without large scope

Do not store only incidental DOM state.

## Coordinate correctness

The visible text layer is rendered at a viewport scale, while native PDF serialization needs PDF-space coordinates.

Derive and store edit geometry in PDF coordinates rather than saving CSS-pixel positions and hoping they line up later.

Test non-100%-scale rendering and rotated pages.

## Editing behavior

- existing text is selectable/clickable without accidentally moving the whole PDF block
- an unchanged edit should not create a dirty record
- an edit can be changed again later
- deleting all text in one item should intentionally blank that region
- page switching away and back must show committed edits
- native Save / Save As must include them
- FCX restore must preserve them
- scanned/image-only PDFs remain non-text-editable without pretending OCR exists

## V1 fidelity boundary

The existing cover-and-redraw replacement strategy is acceptable for this focused pass if it is made reliable and honest.

Do not claim deep source-content-stream rewriting if the implementation is still visual replacement.

Preserve unedited pages and unrelated PDF content.

Use a reasonable font fallback when the original embedded font cannot safely be reused.

---

# 2. PDF text edit Undo / Redo

Basic document edits should not feel irreversible.

Add a small bounded per-document history for committed PDF text changes.

Minimum:

- Undo button when useful
- Redo button when useful
- Ctrl/Cmd+Z while focus is in the PDF editing surface
- Ctrl/Cmd+Shift+Z and Ctrl+Y for Redo
- do not hijack unrelated DOCX/text-field browser undo
- a new edit after Undo clears the Redo branch
- history may remain live-session-only if FCX persistence of history would materially expand scope; the current committed edit state must still persist

---

# 3. Upgrade DOCX from B/I/U-only to a practical lightweight editor

The current DOCX toolbar is essentially:

```text
B  I  U  Save  Save As
```

That is too limited for a document editor.

Keep the toolbar compact. Do not build a Word ribbon.

## Paragraph / heading styles

Add a compact paragraph-style selector with at least:

```text
Normal
Title
Subtitle
Heading 1
Heading 2
Heading 3
```

If existing DOCX style names are available, map common Word styles sensibly rather than discarding them.

Changing a paragraph style must modify the semantic DOCX model / generated OOXML, not merely apply browser CSS.

For existing documents, preserve untouched style references wherever possible.

## Custom text size

Add an obvious font-size control for the selection/caret.

Requirements:

- numeric point size, e.g. `12 pt`
- practical bounded range, not arbitrary unsafe canvas-scale values
- applies to current selection or typing state
- mixed-size content remains representable in the DOCX run model
- imported run font sizes should be read when practical
- saved DOCX writes proper run-size OOXML (`w:sz` / compatible representation), not just HTML inline CSS

Do not silently normalize the whole document to one size.

## Basic inline formatting

Retain:

- Bold
- Italic
- Underline

Add lightweight common formatting where it fits cleanly:

- Strikethrough

Do not let extra controls make the toolbar visually noisy.

## Paragraph basics

Add compact controls for:

- left align
- center
- right align
- justify
- bulleted list
- numbered list

The parser/model/serializer must preserve these semantic states.

Existing current alignment/list support should be reused rather than replaced.

## Markdown-era convenience level

Include a few basics users expect from modern lightweight text editors when they can be implemented cleanly and round-trip honestly:

- blockquote paragraph style or equivalent visual/semantic block treatment
- monospace/code-style inline text OR code paragraph style

These are lower priority than headings, font size, alignment, lists, and B/I/U/strike. Do not delay the core pass for them.

---

# 4. DOCX model / OOXML requirements

The current model already preserves paragraph style, list state, alignment, and run bold/italic/underline.

Extend it rather than bypassing it.

At minimum add round-trip representation for:

- run font size
- run strikethrough
- paragraph style changes
- numbered vs bulleted list distinction if currently collapsed into one boolean
- current paragraph alignment

Prefer the least-destructive save path for documents that can be patched safely.

When the editor makes structural/style changes that require regeneration, preserve unrelated package parts and relationships as current architecture intends.

Do not regress embedded images, tables, hyperlinks, section properties, or the recent DOCX ID hardening.

---

# 5. Selection-aware DOCX toolbar state

The toolbar should respond to where the caret/selection is.

Examples:

- caret in Heading 2 -> style selector shows Heading 2
- caret in centered paragraph -> center control appears active
- selected bold text -> Bold appears active
- selected 18 pt text -> size control shows 18 where determinable
- mixed formatting may show a neutral/mixed state instead of lying

Formatting controls should return focus to the editor and not destroy the active text selection before applying the command.

Avoid relying solely on deprecated `document.execCommand` for new semantic features when model-aware code is practical. Existing B/I/U behavior can be migrated incrementally if necessary.

---

# 6. Undo / Redo for DOCX basic edits

The browser's native contenteditable history may help, but toolbar-driven semantic changes must still behave predictably.

At minimum ensure:

- Ctrl/Cmd+Z works for ordinary typing and recent formatting changes
- Ctrl/Cmd+Shift+Z / Ctrl+Y works where supported
- toolbar operations do not unexpectedly destroy the browser undo chain
- no global FrameChute shortcut steals undo while focus is inside the DOCX editor

A full custom document command history is not required in this pass if native contenteditable history plus small command integration is reliable.

---

# 7. UI philosophy

This should feel closer to a very capable Notepad/Markdown editor than a miniature Office ribbon.

A compact DOCX toolbar could conceptually be:

```text
[Normal ▾] [12 pt]  B I U S  |  Align ▾  |  Bullets  Numbered  |  Save  Save As
```

Exact visual implementation should follow FrameChute's existing compact controls.

Controls may collapse intelligently at narrow block widths; do not make the document toolbar consume half the editor height.

PDF text editing should be equally quiet: the document remains the center of attention.

---

# 8. Acceptance tests

Add focused automated tests around serializable document-model behavior and use manual browser checks for selection/caret interaction.

## PDF

Test at minimum:

1. Open text PDF.
2. Commit replacement for one text item.
3. Change page and return; replacement is still visible.
4. Save serialization includes the committed edit.
5. Reload/reopen generated PDF and verify replacement text is present/searchable where practical.
6. Undo/Redo edit model works.
7. Empty replacement intentionally removes visible source text.
8. Rotated/scaled page coordinate conversion does not drift badly.

## DOCX

Create/reuse a fixture with:

- Normal paragraph
- Title/Heading paragraph
- different font sizes
- bold/italic/underline
- list
- alignment
- inline image

Modify:

- paragraph style
- font size
- strikethrough
- alignment
- bullet/numbered list state

Serialize, reopen with FrameChute, and verify the semantic formatting survives along with the existing image.

Do not merely test toolbar DOM labels.

---

# 9. Scope discipline

Do not expand this pass into:

- full PDF object editing
- OCR
- complex PDF font embedding/reflow engine
- Word comments/tracked changes
- headers/footers editor
- footnotes/endnotes
- advanced page layout
- macros
- equations
- PowerPoint/XLSX work

Those can be separate milestones.

This pass succeeds when ordinary users can make visible PDF text corrections and use a genuinely useful set of basic DOCX formatting controls without leaving FrameChute.

---

# 10. Time box / handoff

Use up to 30 minutes of active implementation.

Prioritize a coherent end-to-end slice over touching every optional item.

At the 30-minute mark, conclude active implementation and provide a handoff containing:

- completed work
- remaining work
- files changed
- tests run and exact results
- manual browser checks performed
- known limitations / fidelity boundaries
- exact next steps
- branch / commit / PR state

Leave the repository buildable and open one clean PR against the latest `main` if the work is reviewable.

Do not make unrelated changes.
