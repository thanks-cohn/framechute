# NEXT RUN V7 — DOCX + PDF STANDARDIZATION SUMMIT

Start from the latest `main`, including merged PR #52. Read the existing V5/V6 prompt lineage for preserved product laws, but treat this V7 as the single authoritative prompt for this run. If there is a conflict, V7 wins.

Use up to 30 minutes. Do **not** conclude early merely because tests are green while material P0 document requirements remain unfinished. At the 30-minute mark, **conclude active implementation and provide a handoff**.

## Mission

This run is deliberately narrow: make FrameChute's DOCX and PDF handling feel normal, dependable, standards-oriented, and unsurprising for ordinary users.

The product goal is not to reproduce Microsoft Word or Adobe Acrobat. The goal is:

> **A user should be able to open or create an ordinary DOCX/PDF, perform the ordinary edits they reasonably expect, save it, reopen it elsewhere, and trust that the work survived.**

This is the foundation pass before returning to image/media refinement and, later, making WEBX the novice-friendly publishing/interchange layer.

Do not spend this run expanding WEBX, Canvas, 3D, media, or other speculative surfaces unless a regression from PR #52 blocks DOCX/PDF work. Preserve those foundations; focus implementation time on documents.

---

# P0 — one coherent document editing model

DOCX and PDF must not be collections of DOM tricks. User-visible edits must modify canonical document/edit state and serialize from that state.

Preserve the shared direction:

```text
DOCX / PDF
   ↓ parse/import
canonical document/edit state
   ↓ renderer/editor
user manipulates ordinary document objects
   ↓ serializer
valid DOCX / valid PDF
```

Rules:

- preview and save must agree;
- reopen must reproduce saved state;
- Undo/Redo must operate on canonical state;
- unsupported content should be preserved non-destructively where practical rather than silently destroyed;
- do not expose controls that only change DOM/CSS but disappear after save;
- do not claim support for an operation unless the serializer can reproduce it.

---

# P0 — DOCX reaches a credible ordinary word-processing baseline

A newly created DOCX and a typical externally-created DOCX should support the normal editing path without requiring the user to understand OOXML.

## Required DOCX basics

Implement/fix the highest-leverage missing pieces so these workflows are reliable:

```text
New DOCX
Open DOCX
Type/edit text
Select text
Bold
Italic
Underline
Font family
Font size
Paragraph alignment
Paragraph breaks / line breaks
Bulleted list
Numbered list
Hyperlink
Cut / Copy / Paste
Insert image
Select image
Delete / replace image
Basic image resize where serialization is honest
Undo
Redo
Save
Save As
Reopen
```

If heading styles are already structurally close, add at least normal paragraph + Heading 1/2 semantics rather than visual-only font enlargement.

If a simple table primitive can be completed honestly within the pass, support basic rows/cells/text because tables are ordinary DOCX usage. Do not sacrifice core text/list/image round-trip reliability to add tables.

## DOCX serialization workmanship

The saved file must remain a standards-compliant ZIP/OOXML package and reopen in Word-compatible software.

Audit and fix as needed:

- paragraph properties (`w:pPr`);
- run properties (`w:rPr`);
- bold/italic/underline;
- font family and size;
- alignment;
- list/numbering references where supported;
- hyperlinks + relationships;
- image relationships, media entries, dimensions, and content types;
- required package relationships/content types;
- proper XML escaping;
- no accidental loss of unrelated package parts when a document is opened, edited, and saved.

Prefer extending the current canonical run/paragraph model instead of adding a competing DOM serializer.

### DOCX acceptance workflow

A single document should survive:

```text
New DOCX
→ type three paragraphs
→ make one heading
→ bold/italic/underline different spans
→ change font + size
→ center one paragraph
→ create bullet/numbered content
→ add a link
→ insert an image
→ Undo / Redo several edits
→ Save As
→ reopen in FrameChute
→ reopen in Word/LibreOffice-compatible software
```

The result should retain the intended structure and formatting without malformed-package warnings.

---

# P0 — PDF reaches a credible ordinary editing baseline

PDF is not a word processor. Keep its model honest: page-oriented editing, overlays/replacements, images, page operations, and predictable save/reopen behavior.

## Required PDF basics

Implement/fix the highest-leverage missing pieces so these workflows are reliable:

```text
New PDF
Open PDF
Add text field
Edit added/replacement text
Select text field/object
Font family
Text size
Text color if current serializer can support it cleanly
Move text field
Resize text field when meaningful
Duplicate
Delete / Backspace
Insert image
Select/move/resize/delete image
Undo
Redo
Save
Save As
Reopen
```

Page operations should meet an ordinary baseline where current architecture supports them:

```text
Add page
Delete page
Duplicate page
Reorder page
Rotate page
```

Preserve existing extract/merge/crop/compress functions; do not regress them.

## PDF coordinate/layout workmanship

Use one explicit coordinate conversion path shared by preview and serializer. Preserve the existing lower-left PDF coordinate semantics while preventing text from sinking or shifting between preview/save/reopen.

For text fields:

```text
canonical field bounds
→ renderer layout
→ serializer baseline/layout
```

must produce equivalent placement.

Images and text must not rely on CSS-only transforms that cannot be represented in the saved PDF.

### PDF acceptance workflow

A document should survive:

```text
New PDF
→ add page
→ add two text fields
→ change font/size
→ move one field
→ insert and resize an image
→ duplicate/delete an object
→ Undo / Redo several edits
→ rotate/reorder a page
→ Save As
→ reopen in FrameChute
→ open in an ordinary PDF viewer
```

The saved result should match the editor closely and remain a valid PDF.

---

# P0 — Undo / Redo must now be trustworthy

Required shortcuts:

```text
Ctrl/Cmd+Z       → Undo
Ctrl/Cmd+Shift+Z → Redo
Ctrl+Y           → Redo where appropriate
```

For DOCX, history should cover at least:

- text edits;
- bold/italic/underline;
- font/size;
- paragraph/list/alignment changes;
- image insert/delete/replace/resize where implemented.

For PDF, history should cover at least:

- add/edit/delete/duplicate text fields;
- font/size/color changes where supported;
- object move/resize;
- image insert/delete/move/resize;
- page operations implemented in this pass.

One coherent gesture/action should normally become one undo step, not dozens of keystroke-level snapshots unless text coalescing requires it.

---

# P0 — format-native menus and keyboard behavior

Preserve the product law:

```text
DOCX editor surface → DOCX menu
PDF editor surface  → PDF menu
```

The generic workspace/object menu must not leak into the document body.

Menus/toolbars must expose only working operations and must remain attached to their trigger using the shared submenu positioning geometry from V5.

Keyboard basics:

- Delete/Backspace removes selected editable PDF objects or selected DOCX image/object where appropriate;
- Escape cancels/deselects transient object selection without corrupting text selection;
- arrow-key nudge for movable PDF objects where already compatible;
- standard text-selection shortcuts remain browser/OS-normal inside DOCX editing.

---

# P0 — Save / Save As / reopen is the real definition of success

Do not judge completion by what looks correct before save.

For every major editing primitive implemented in this run:

```text
edit
→ save
→ reopen
→ compare canonical/visible result
```

must work.

Use native `showSaveFilePicker()` through the existing save abstraction where available and the existing fallback where unavailable. Picker cancel is not an error.

Avoid generating bytes twice for one save operation.

---

# P1 — font architecture ready for Google Fonts without lying

The long-term user experience is one simple font picker, including Google Fonts, with format-specific export handled underneath.

Do not let that future requirement distort the basics, but establish/strengthen a shared font descriptor/adapter boundary if practical:

```text
user font choice
→ canonical font identity
→ DOCX font mapping/embedding policy
→ PDF font embedding/subsetting policy
→ later WEBX @font-face asset packaging
```

Important rules:

- never show a custom font as successfully applied if Save/reopen cannot preserve it;
- PDF custom fonts should eventually be embedded/subset rather than depending on the viewer machine;
- DOCX should preserve a valid font-family declaration and embed only when technically/licensing-wise appropriate;
- Google Fonts are font assets/data, not an excuse for remote executable code;
- core standard-font reliability outranks catalog breadth in this run.

If custom font embedding cannot be completed honestly in this pass, create the clean adapter boundary and keep the visible picker limited to fonts with truthful export behavior.

---

# Preserve merged PR #52 foundations

Do not regress:

- Quick Actions persistent minimize/maximize + red close;
- framed image rotation containment;
- toolbar-visible stable workspace extent;
- toolbar-hidden active-gesture canvas growth behavior already landed;
- New WEBX / DOCX / PDF / Canvas controls;
- Open WEBX plumbing;
- Canvas export primitives;
- format-native context routing already implemented;
- attached submenu geometry;
- internal-drag overlay suppression;
- frameless image behavior.

Known incompleteness in WEBX/Canvas/world-origin expansion is not the focus of this run unless it directly blocks document editing. Record it in the handoff rather than consuming DOCX/PDF implementation time.

---

# Testing / validation

Add focused tests that prove serialization, not just UI labels.

At minimum, where practical:

1. DOCX rich text round-trip preserves bold/italic/underline/font/size;
2. DOCX paragraph alignment survives serialization/reparse;
3. DOCX list/hyperlink serialization remains structurally valid when implemented;
4. DOCX inserted image has valid relationships/content-type/package entries;
5. DOCX Save/reopen retains edits rather than DOM-only styling;
6. PDF added text fields retain position/font/size after serialize/reopen;
7. PDF image object retains placement/size after serialize/reopen;
8. PDF page operation(s) serialize correctly;
9. DOCX Undo/Redo restores canonical state;
10. PDF Undo/Redo restores canonical state;
11. editor-body context routing remains format-native;
12. existing PR #52 and V5/V6 tests remain green.

Use generated fixtures where possible so tests remain repository-local and deterministic. For DOCX, inspect ZIP/XML structure where useful. For PDF, reopen generated bytes with the existing PDF library and assert page/object state where possible.

Run:

```text
node --test tests/*.test.mjs
node --check on every touched JS/MJS file
git diff --check
bash scripts/package-web-store.sh
```

If available, manually sanity-check one saved DOCX in Word/LibreOffice-compatible software and one saved PDF in a normal browser/PDF viewer. If that cannot be done in the environment, state it explicitly in the handoff rather than implying it was tested.

---

# 30-minute priority order

```text
1. audit DOCX/PDF current canonical models + save paths and identify real breakpoints
2. DOCX ordinary text/format/paragraph/list/link round-trip reliability
3. DOCX image insert/edit/save/reopen reliability
4. PDF text/object/image edit/save/reopen reliability
5. PDF ordinary page operations
6. coherent Undo/Redo across both formats
7. native menus/keyboard polish only where needed for ordinary workflows
8. shared font adapter foundation / truthful custom-font behavior
9. tests + package validation
```

Do not spend the run making decorative UI while serialization is incomplete.

At the 30-minute mark, **conclude active implementation and provide a handoff** containing:

- exact DOCX workflows now reliable;
- exact PDF workflows now reliable;
- canonical model/serializer changes;
- Undo/Redo coverage;
- font support and limitations;
- files changed;
- tests and validation results;
- manual compatibility checks actually performed;
- remaining ordinary-workflow gaps ranked by severity;
- any preserved-but-deferred PR #52/V6 issues;
- exact next highest-leverage document step;
- branch, commit, and PR.