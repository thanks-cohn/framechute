# NEXT RUN V12 — DOCX FIRST, THEN PDF: MAXIMUM STANDARDIZATION + FIDELITY

## Authority
Continue on branch `codex/implement-docx-editing-and-context-menu`.

Read first:
1. `agents/codex/prompts/NEXT_RUN_PR55_RECONCILE_AND_STABILIZE_DOCX_PDF_MENUS_V10.md`
2. `agents/codex/prompts/NEXT_RUN_DOCX_PDF_STANDARDIZATION_SUMMIT_V7.md`
3. `agents/codex/prompts/object-context-menu-chrome-parity-and-bring-to-center-addendum.md`
4. newest DOCX/PDF debug and audit notes on this branch.

Treat this V12 as the single authoritative prompt when instructions conflict. Preserve working behavior already landed. Resolve conflicts semantically.

Use up to 30 minutes of active implementation. Do not stop early just because tests are green while material P0 fidelity work remains.

## Mission
Elevate DOCX first, then PDF, toward the highest practical standards-based and interoperable fidelity FrameChute can honestly support.

Central product law:
> A document opened in FrameChute should not feel as though parts disappeared merely because FrameChute cannot yet edit every structure.

Interchange law:
> Files saved by FrameChute remain ordinary files that open and remain editable in other standards-compatible applications. Do not trap user documents in proprietary-only representations.

Optimize for: source document -> standards-aware parse -> canonical editable state plus preserved source structures -> faithful render -> user edits -> standards-aware serialize -> reopen in FrameChute -> reopen elsewhere.

If a feature can render but cannot be safely edited, prefer render + preserve over destructive normalization. If it cannot fully render, preserve the underlying package/object data when practical so Save/Save As does not destroy it.

Do not claim full Word, OOXML, Acrobat, or PDF compliance unless tests actually prove it.

---

# P0 — DOCX FIRST
Do not move to broad PDF work until the DOCX fidelity regressions below are materially addressed or explicitly blocked with a concrete technical reason.

Standards direction:
- Treat DOCX as OPC + WordprocessingML, not HTML in a ZIP.
- Follow ECMA-376 / ISO/IEC 29500 semantics where practical.
- Accept common Word Transitional OOXML and support Strict OOXML where practical.
- Preserve unknown or unsupported package parts and relationships whenever safe.
- Do not execute active content.

## 1. Non-destructive OOXML round-trip
Unknown does not mean disposable. On open/edit/save, preserve unrelated structures whenever practical: styles, numbering, headers/footers, footnotes/endnotes, comments, bookmarks, fields, content controls, relationships, media, theme/font tables, settings, custom XML/extension parts, drawing/object parts and safe alternate representations.

Prefer edit-minimizing serialization: mutate what changed, preserve untouched XML/parts, preserve unknown attributes/elements when safe, and avoid rebuilding the whole package from a simplified model if doing so destroys source fidelity.

## 1A. Display-first compatibility target: show almost everything, even when not editable

For DOCX, **display breadth outranks edit breadth**. The desired baseline is not “only show what FrameChute can edit.” The desired baseline is:

> **If Word/LibreOffice can visibly display a common DOCX construct, FrameChute should attempt to display a faithful or clearly recognizable representation of it, even when FrameChute cannot edit that construct yet.**

Editing may be partial. Visibility and preservation should be much broader.

Use a rendering fallback ladder:

1. **Native editable rendering** when FrameChute understands the structure and can serialize it safely.
2. **Native read-only rendering** when FrameChute can interpret/display the structure but cannot safely edit it.
3. **Preserved visual fallback** using an existing OOXML alternate/fallback representation, preview image, embedded image, or other safe source representation when available.
4. **Explicit preserved placeholder** only as a last resort, showing that an unsupported object exists and preserving its underlying OOXML/relationship parts for Save/Save As.

Never silently omit a visible source object.

Target display coverage should include, where technically possible in the current browser architecture:

- ordinary paragraphs, runs, styles, themes, fonts, colors, highlights, borders, shading;
- headings, section breaks, page breaks, columns, page size/orientation/margins;
- numbering, bullets, multilevel lists, generated labels, field-generated numbering;
- headers, footers, page numbers, first/even/odd variants;
- tables including merged cells, nested tables, borders, shading, widths and alignment;
- inline images and floating/anchored images;
- DrawingML shapes, text boxes, callouts, lines/arrows, grouped drawings;
- legacy VML objects when present;
- charts and chart fallback imagery/data where available;
- SmartArt and diagrams through native/fallback representation where available;
- WordArt/text effects through the closest faithful display or preserved fallback;
- OMML equations and mathematical symbols;
- hyperlinks, bookmarks, cross-references and visible field results;
- TOC/TOA/index and other field-result text;
- footnotes and endnotes;
- comments/annotations with a visible, non-destructive read-only representation if editing is not ready;
- tracked insertions/deletions and revision-marked content, without silently accepting/rejecting changes;
- content controls / structured document tags;
- symbols, tabs, leaders, soft hyphens, nonbreaking spaces and special characters;
- embedded/linked objects, OLE/package objects, and unknown object types via safe preserved fallback rather than execution;
- captions, text frames, drawing canvases, alternate content blocks and compatibility fallbacks;
- embedded fonts only where browser/runtime and licensing permit safe display;
- metadata-driven visible features where their visual result is part of the document.

For fields such as PAGE, NUMPAGES, DATE, REF, SEQ, TOC, INDEX, captions, and similar constructs:

- prefer preserving the field structure;
- display the stored/cached field result when present;
- recalculate only fields FrameChute can do correctly;
- never replace a field permanently with plain text merely because recalculation is unsupported.

For tracked changes:

- preserve revision XML exactly when not explicitly editing revision state;
- render both insertion/deletion/revision semantics in a recognizable way;
- never auto-accept or auto-reject revisions during unrelated edits.

For comments/notes:

- preserve anchors, comment parts and relationships;
- show a readable indicator/panel/popover if full editing is unavailable;
- unrelated edits must not strip comments.

For charts/SmartArt/OLE/unsupported drawings:

- do not execute embedded code/macros;
- prefer a safe visual fallback or existing preview;
- preserve source package parts and relationships so opening/saving in Word does not destroy them.

This is a **viewer-fidelity requirement**, not a promise that every object becomes editable in the same run.

Add a capability distinction in code/state where useful, for example:

`editable` / `readOnlyRenderable` / `preservedFallback` / `unsupportedPreserved`

so the UI can display content without pretending it is safely editable.

## 2. Proper Word numbering resolver
A known failure is that Word shows generated labels such as `[0001]`, `[0015]`, `[0016] [Math. 1]`, `[0017] [Math. 2]`, `[0019] [Table 1]`, `[Claim 1]`, `[Claim 2]`, while FrameChute can retain adjacent text but lose the generated number.

This is a general OOXML numbering problem. Implement one numbering resolver that handles:
- `styles.xml` and paragraph style inheritance;
- direct `w:numPr`;
- `w:numId`, `w:abstractNumId`, `w:lvl`, `w:ilvl`;
- `w:start`, `w:startOverride`, `w:lvlOverride`;
- `w:lvlText`, `w:numFmt`;
- decimal and padded decimal, Roman, letters, bullets;
- multilevel nesting and restart behavior;
- style-linked numbering where present.

Maintain counter state correctly. Do not hard-code patent labels, Math labels, or Claim labels.

Acceptance fixtures must include semantic equivalents of `[%1]` with 0001 formatting, `[Claim %1]`, and nested decimal/Roman/letter lists with continuation and restart.

## 3. OMML / Word equations
Do not silently flatten or drop Office Math. Preserve OMML subtrees when not editing the equation. Render common structures without disappearing: superscripts/subscripts, fractions, radicals, n-ary operators, delimiters, accents, matrices, function/application structure, and special math glyphs.

If direct equation editing is not ready, the correct baseline is faithful render + exact preservation + editable surrounding content.

## 4. Real table structure
A real merged multi-column table must not degrade into detached text or one-cell fragments.

Support/preserve rows, cells, grid columns, `gridSpan`, `vMerge`, widths, row heights where meaningful, borders, shading, paragraph content, run formatting, alignment, nested lists/paragraphs, cell margins where practical, and table width/alignment.

If editing support is basic, preserve unsupported table properties on save.

## 5. Lists, styles, and paragraph structure
Preserve actual hierarchy rather than reconstructing visible punctuation. Support numbered/bulleted lists, nested levels, continuation/restart semantics, indentation/hanging indents, tab stops, paragraph spacing, line spacing, explicit page/section breaks, and semantic headings.

Generated numbering and ordinary lists should share the same standards-aware numbering machinery.

## 6. Drawings, images, anchors, layout
Preserve inline and anchored/floating drawings, image relationships/bytes, dimensions, aspect ratio, crop data where practical, wrap modes, front/behind behavior, anchor position, alt text, section page size/margins/orientation, and headers/footers.

Moving or resizing an image inside the same DOCX modifies that same embedded object. No global Drop into FrameChute overlay, no duplicate, no conversion to a generic workspace frame.

For unsupported DrawingML/VML/SmartArt/chart/object content, preserve source parts and relationships and render a safe fallback when available rather than deleting it.

## 7. Text/run fidelity
Keep the ordinary editing baseline and make it serialize honestly: text, bold, italic, underline, strike, font family/size, color, highlight, superscript/subscript, alignment, indentation, spacing, line breaks, tabs, headings, hyperlinks, Cut/Copy/Paste, safe Find/Replace, Undo/Redo, Save and Save As.

Preserve style inheritance rather than flattening everything to direct formatting.

## 8. DOCX regression gate
Add deterministic fixtures covering at least:
1. padded generated paragraph numbering;
2. custom Claim-style `w:lvlText` numbering;
3. nested decimal/Roman/letter lists;
4. two structurally different OMML equations;
5. a merged-cell table;
6. an embedded or anchored image;
7. headings and paragraph formatting;
8. hyperlinks;
9. headers/footers if feasible;
10. an untouched unknown package part that must survive save.

Required loop: open -> render/inspect -> edit unrelated ordinary text -> Save As -> reopen in FrameChute -> inspect package/XML.

Do not claim external Word/LibreOffice verification unless it was actually performed.

---

# P0 — RIGHT-CLICK MENU ORDER: EXPLICIT PRODUCT LAW
The latest user instruction supersedes older menu ordering guidance.

For ordinary FrameChute object/frame right-click menus, whenever the actions apply, the first three visible actionable items are always:

1. **Bring to Center**
2. **Save As…**
3. **Clone**

Then a divider, then lower-priority/common/type-specific actions.

### Bring to Center
Bring to Center is always number one. Use the established explicit-object command path. Center only the selected object in the current visible FrameChute work area, account for toolbar/chrome, bring it frontmost, preserve state, and do not move unrelated objects. Preserve the current canonical 400x400 behavior if that remains intentional on the executable branch. Do not reintroduce passive reachability clamping.

### Save As…
Save As is always number two where saving applies. It must invoke the real format-aware save path, not a screenshot unless the user explicitly chose an image/snapshot export.

#### Save As sizing law
When Save As applies to a size-bearing visual object/export, resizing the object in the FrameChute canvas must **not silently rewrite the saved file dimensions by default**.

The Save As UI must expose a clear checkbox:

`Keep Modified Size`

Semantics:

- default OFF unless an existing user preference explicitly says otherwise;
- OFF -> save/export using the object's original/native dimensions;
- ON -> save/export using the object's current resized canvas dimensions;
- the current canvas dimensions at the moment Save As is invoked are the modified dimensions;
- preserve aspect ratio exactly as represented by the current object unless the user deliberately made a non-proportional resize and the format/export path supports it;
- do not infer a modified size merely from zoom, viewport scaling, CSS projection, maximized state, or Bring to Center's temporary/object geometry;
- only an actual user resize of the object counts as a modified size;
- the choice must be applied by the real format-aware serializer/exporter, not by DOM/CSS-only scaling.

For ordinary source-preserving Save As, OFF therefore means: **save the original/native size**.

For DOCX/PDF frame objects specifically, resizing the outer FrameChute frame must not be misinterpreted as changing DOCX page size or PDF page dimensions. Only use `Keep Modified Size` where the saved/exported object itself has meaningful resizable output dimensions (for example images or explicit raster/snapshot-style exports). Document page-size changes remain format-native document operations.

### Clone
Clone is always number three. Use the label `Clone`, not `Duplicate`.
Clone creates exactly one new independent FrameChute workspace object based on the selected object current state/source, preserves its document/media type and current visible state, assigns a new object identity, does not alter the original, and does not accidentally share mutable geometry/history state. For document objects, cloning the FrameChute object is distinct from duplicating content inside the DOCX or PDF.

Older guidance that placed Quick Actions, Open File, Minimize, Expand, Remove Frame, or similar commands ahead of these three is superseded. Those commands may remain below the divider.

Document-native right-click menus inside editable DOCX/PDF content may keep format-appropriate text editing commands. This ordering applies to the ordinary FrameChute object/frame menu.

---

# P1 — ONLY AFTER DOCX: PDF
After the DOCX P0 work is materially improved, elevate PDF toward the highest standards-conformant baseline supported by the current PDF stack.

Standards direction:
- Treat PDF as page-oriented document structure, not HTML.
- Follow ISO 32000 semantics supported by the current library.
- Do not force or claim PDF 2.0 if the serializer does not actually support it.
- Preserve original page content when editing is unsafe.

Central law:
> Original PDF page content must not be destructively rewritten just to imitate a word processor. FrameChute-created editable content must have canonical page-object state and deterministic serialization.

## PDF text safety
No user-entered text may exist only in a temporary DOM node. Preserve exact text, newlines, tabs, repeated spaces, blank lines, font identity, point size, color, supported bold/italic variants, alignment, bounds, top-anchor field growth, clipping without data deletion, stable object IDs, and link association where supported. Commit active edits before rerender, move, resize, save, page operations, Undo/Redo, or export.

## PDF page objects and images
Use canonical PDF-coordinate objects with stable IDs. CSS pixels are projection only. Converge picker, right-click Insert Image, OS drop, clipboard paste, workspace image, DOCX image, and PDF image routes onto one insertion primitive. Support PNG/JPEG bytes, alpha where supported, selection, move, resize, aspect lock, rotate where practical, delete, z-order, Undo/Redo, Save/reopen.

Same-PDF movement changes the same object. Cross-container operations copy by default. Internal drags must never trigger the global Drop into FrameChute overlay.

## PDF pages and annotations
Preserve or improve add/delete/reorder/rotate page, existing merge/extract/crop/compress, link annotations, relinking by replacement rather than stacking, linked-text deletion preference, Shift+Click to follow links while normal click edits/selects, and coherent Undo transactions.

Never serialize editor chrome, selection handles, guides, or temporary drop UI.

## PDF save/reopen gate
For each edit primitive: edit -> Save As -> reopen in FrameChute -> reopen in an ordinary PDF viewer/library -> compare content and placement. Preview and serializer must use the same canonical geometry/layout interpretation.

---

# Testing
Add structural tests, not only menu-label tests.

DOCX priority tests:
- numbering resolver emits padded values and survives save/reopen;
- custom `w:lvlText` Claim pattern resolves;
- nested list counters/restarts stay correct;
- OMML survives unrelated edits and common structures render;
- merged cells/grid survive round-trip;
- image relationship/media bytes survive;
- anchored geometry/wrap survives where supported;
- untouched unknown package part survives save;
- style inheritance is not unnecessarily flattened;
- hyperlink relationships survive/relink safely.

Menu tests:
- object menu item #1 is Bring to Center;
- item #2 is Save As where applicable;
- item #3 is Clone;
- Save As exposes `Keep Modified Size` for applicable size-bearing visual exports;
- with `Keep Modified Size` OFF, Save As preserves original/native dimensions;
- with `Keep Modified Size` ON, Save As uses the actual user-resized canvas dimensions and ignores mere zoom/maximize/Bring-to-Center geometry;
- Clone creates exactly one independent object;
- Bring to Center does not move other objects.

PDF tests after DOCX:
- active text commits before rerender/move/save;
- image object survives Save/reopen with geometry/z-order;
- page operations serialize;
- export contains no editor chrome;
- links replace rather than stack;
- internal drags never invoke global ingest overlay.

Run:
- `node --test tests/*.test.mjs`
- `node --check` on every touched JS/MJS file
- `git diff --check`
- `bash scripts/package-web-store.sh`

---

# Priority order
1. Reconcile current branch and inspect DOCX import/render/save pipeline.
2. Fix DOCX numbering resolver.
3. Fix/preserve OMML equations.
4. Fix table structural fidelity.
5. Fix list hierarchy, styles, and paragraph structure.
6. Preserve drawings/images/headers/footers/unknown parts.
7. Enforce object menu order: Bring to Center, Save As…, Clone.
8. Add DOCX regression fixtures and validate save/reopen.
9. Only then improve PDF canonical text/image/page-object fidelity.
10. Run full suite and packaging gate.

Do not spend this run on WEBX, 3D, speculative UI, or unrelated media work unless it directly blocks the document work.

# Handoff
At the reliability checkpoint report branch/head SHA, commits, files changed, DOCX structures now rendered, DOCX structures preserved but not editable, numbering formats implemented, OMML coverage, table coverage, package preservation strategy, Save/reopen validation, actual external compatibility checks, menu ordering and Clone semantics, PDF work completed after DOCX, tests/results, remaining P0/P1/P2 fidelity gaps, known data-loss risks, exact next continuation step, and PR state.

Leave the branch coherent, buildable, and reviewable.