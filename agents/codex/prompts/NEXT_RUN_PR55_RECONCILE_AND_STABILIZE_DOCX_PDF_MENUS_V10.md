# PR #55 Reconcile + Stabilize DOCX/PDF/Menus (V10)

## Authority

This is the single authoritative prompt for the next Codex run on PR #55.

Read first:

`agents/codex/debug/PR55_STABILIZATION_MAP_V10.md`

and its focused drag companion:

`agents/codex/debug/IMAGE_DRAG_INTERCHANGE_V10.md`

Those debug maps name the concrete failure sites, user-facing laws, acceptance criteria, and drag ownership model. Treat both as part of this prompt.

## Starting point

Continue PR #55 on branch:

`codex/implement-docx-editing-and-context-menu`

PR #54 has already merged to `main` after PR #55 was created. Before substantive work, reconcile #55 with the latest `main`. Preserve merged #54 behavior, especially the shared drag-ownership primitive and image insertion into DOCX/PDF. Do not restore pre-#54 drag behavior during conflict resolution.

## Product objective

This pass is a stabilization summit pass, not a feature grab-bag. Make the existing interaction model behave like a dependable ordinary editor/workbench by fixing the root primitives that currently create repeated regressions.

The user should be able to right-click, type, edit, drag, save, and reopen without the interface exposing impossible commands, visually detached UI, treating material already inside FrameChute as if it had just arrived from outside, or flashing drag overlays during document/image manipulation.

## P0 work, in order

### 1. Reconcile PR #55 with latest main without regressing PR #54

Preserve all useful #55 DOCX work:
- richer DOCX toolbar
- paragraph spacing/indentation
- styles/headings
- lists
- links
- tables/images
- page setup
- dedicated DOCX context menu
- formatting round-trip work

Preserve all merged #54 work:
- internal FrameChute image drag ownership
- image drop into DOCX
- image drop into PDF
- actual image-byte resolution
- correct native-drag lifecycle
- external workspace ingest still working

Resolve conflicts semantically, not by choosing one entire side.

### 2. Make DOCX/PDF and internal-image movement overlay-free

This is a hard product law.

Do NOT add another document overlay, large drop target, modal wash, or replacement drag panel.

Required:

```text
DOCX frame/editor -> Drop into FrameChute overlay impossible
PDF frame/editor  -> Drop into FrameChute overlay impossible
any image whose source is already inside FrameChute -> overlay impossible everywhere
moving image up/down inside DOCX -> direct move only
moving image inside PDF -> direct move only
```

The global workspace ingest overlay may remain only for genuinely external material over blank/general workspace if that existing UI is otherwise desired. It must never activate over DOCX/PDF surfaces and never activate for an internal FrameChute image drag.

Do not replace the old overlay with a new DOCX/PDF-specific visual overlay. If feedback is needed, a cursor/dropEffect is enough.

### 3. Make image drag ownership universal across workspace, DOCX, and PDF

Read `agents/codex/debug/IMAGE_DRAG_INTERCHANGE_V10.md` before implementing this.

Current symptom set:
- an embedded DOCX image can be dragged out in a way that becomes a new FrameChute frame, yet cannot reliably be repositioned/reordered inside the same DOCX;
- PDF can receive images but editable PDF images are not yet symmetric drag sources that can move within PDF or be dragged back out to workspace/DOCX;
- browser-native `<img>` payloads can still make internal image origins look external.

Architectural law:

```text
Any image whose origin is already inside FrameChute
-> begin one FrameChute-internal image drag session
-> generic external ingest is forbidden
-> destination decides move/copy semantics
```

Use/reuse the shared drag-ownership primitive with an origin descriptor and real image Blob provider. Preserve the #54 native drag lifecycle where the browser's normal post-`dragstart` `pointercancel` must not destroy the session.

Same-container operations are moves:
- workspace -> workspace moves the same workspace image object;
- DOCX image -> same DOCX moves/reorders the same semantic embedded image at the drop caret, preserving relationship/part when possible;
- PDF editable image -> same PDF updates the same image edit geometry.

Cross-container operations are non-destructive copies by default:
- workspace -> DOCX/PDF leaves source;
- DOCX/PDF -> workspace creates exactly one workspace image from canonical bytes and leaves source;
- DOCX <-> PDF inserts exactly once and leaves source.

For DOCX, use the real embedded part bytes and relationship metadata. `contentEditable=false` must not imply `immovable`.

For PDF, FrameChute-inserted image edits already have MIME/bytes/base64/geometry and must become first-class internal drag sources. Existing original-PDF image extraction should only be exposed when real underlying raster bytes + geometry can be resolved confidently; do not fake it with page screenshots.

### 4. Permanently fix detached submenu geometry

This is a repeatedly reported blocking UI regression.

Affected generic/editor nested menus include Open, Arrange, Show, Font, Text Size, Paragraph and any future nested item.

Implement one reusable submenu-positioning primitive. Use one coordinate system only. Prefer `getBoundingClientRect()` + fixed-position submenu portaled to `document.body`, or an equally consistent alternative.

Law:

```text
submenu appears immediately beside the trigger row
small gap about 0-8px
right overflow => flip directly left
bottom overflow => shift upward only enough to fit
```

Never mix viewport rectangles with `offsetTop`/parent-local coordinates. Never let a child menu appear halfway across the viewport or near the far-right edge detached from its parent.

Keyboard ArrowRight/ArrowLeft/Escape must keep focus and geometry coherent.

### 5. Advanced OFF must omit advanced timing commands

When `window.frameChuteAdvancedMode !== true`, these commands must not exist in the rendered generic context menu:
- Create/Edit timed move
- Preview timed move
- Return to move start
- Remove timed move
- Layer timing...

Do not merely disable them. Prefer command-model/construction filtering so the simple user is never presented with them.

### 6. Sync With is ONLY for playable audio/video

`Sync with...` and `Make independent` must appear only for actual playable video or audio objects.

Never show these commands for image, PDF, DOCX, WEBX, text, SVG, canvas, gallery/static image, generic files, or blank workspace.

Make the predicate capability based. Include audio and video. Keep separators hidden/omitted with the commands.

### 7. Repair PR #55 DOCX hazards

#### Safe Find/Replace

Do not use `editor.innerHTML.split(search).join(replacement)` or equivalent raw HTML mutation. Find/Replace must operate on text nodes or canonical runs so replacement text cannot accidentally rewrite tags, hrefs, DOCX relationship metadata, image metadata, table structure, or arbitrary attributes.

#### Formatting fidelity

If DOCX parsing records `strike`, `color`, and `highlight`, render those properties into the editable DOM and capture them back into canonical runs so they survive save/reopen.

#### Numbering fidelity

DOCX numbering IDs are document-local. Do not hard-code universal IDs such as 1 for bullet / 2 for number. Reuse compatible existing numbering definitions or allocate non-colliding numbering and abstract-number IDs as needed.

#### Preserve and extend DOCX image insertion

After merging latest main, both OS image drop and existing FrameChute-image drop into DOCX must still insert exactly once and save/reopen correctly.

Existing embedded DOCX images must become deliberate internal drag sources. Dragging one elsewhere in the same DOCX must move/reorder that image at the resolved caret rather than creating a new workspace frame. The direct interaction should be ordinary: pick up image, move it up/down, drop it. No document overlay.

### 8. PDF explicit newlines, tabs, and structured whitespace

The canonical PDF edit object must preserve what the writer actually created.

Required:
- ordinary Enter creates/stores `\n`;
- Tab creates/stores `\t`, not four literal spaces;
- literal spaces remain literal spaces;
- blank lines remain explicit blank lines;
- preview and PDF serialization use the same layout interpretation.

When a new explicit line no longer fits, grow the text field downward while keeping its visual top fixed, unless an explicit clipping constraint has deliberately been established by the user.

PDF coordinate rule for growth:

```text
oldTop = y + height
height = requiredHeight
y = oldTop - height
```

Implement a deterministic tab-stop rule for preview/export while retaining `\t` in canonical text.

### 9. PDF link annotations must follow text editing

Visible text and PDF link annotations are separate structures. FrameChute must explicitly synchronize them when it can confidently associate them.

Default user law:

```text
Deleting Text Deletes Link [ON]
```

When ON, deleting linked text deletes the associated link annotation; text deletion + annotation deletion is ONE undo step; Undo restores both. When OFF, deleting text may intentionally leave the annotation.

When editing linked text without deleting it, preserve the link target and update/rebuild the clickable annotation rectangle so it follows the edited text geometry.

### 10. PDF-specific Settings command/popup

Right-clicking inside the PDF editing surface should expose `Settings...` in the PDF-native context menu. It opens a PDF-specific settings UI, not generic FrameChute settings.

Initial required setting:

```text
Deleting Text Deletes Link [ON]
```

Default ON. Persist as PDF-editor preference state so it does not reset on every right-click.

Keep Undo, Redo, Save and Save As available where appropriate in the PDF menu.

## Context routing law

```text
PDF surface  -> PDF menu
DOCX surface -> DOCX menu
WEBX surface -> WEBX menu when implemented
object chrome / blank workspace -> generic object/workspace menu
```

Resolve from the physical point/target under the right-click. Do not require prior selection to get the correct menu.

## Testing requirements

Add focused tests for pure logic wherever possible:
- DOCX/PDF destinations can never activate the global ingest overlay;
- internal FrameChute image drags can never activate the global ingest overlay;
- genuinely external drag over blank workspace may still use existing external-ingest presentation if retained;
- internal image origin descriptor and generic-ingest suppression for workspace/DOCX/PDF sources;
- same-container image move vs cross-container copy arbitration;
- DOCX embedded image move/reorder without duplicate workspace ingest or overlay;
- PDF editable image same-document move and drag-out Blob path without overlay;
- submenu placement next-to-trigger / flip-left / vertical clamp;
- Advanced OFF omits timing commands;
- audio/video media sync capability; static/document objects rejected;
- safe DOCX text-only Find/Replace;
- DOCX numbering reuse/allocation;
- DOCX strike/color/highlight round-trip;
- PDF newline/tab/blank-line preservation;
- PDF field growth while preserving top anchor;
- PDF linked-text delete preference and undo snapshot semantics.

Then run the complete existing suite, including PR #54 drag-ownership and PDF-image tests. Run syntax checks, `git diff --check`, and the Chrome Web Store packaging gate.

Do not claim Word/LibreOffice/browser manual verification unless it was actually performed.

## Completion / 30-minute reliability checkpoint

Use the available runtime aggressively. At approximately the 30-minute mark, **conclude active implementation and provide a handoff**.

The 30-minute mark is a reliability checkpoint, not an instruction to artificially limit useful work. The handoff must include exact branch/head SHA, commits, files changed, reusable primitives, solved/partial problems, tests, manual checks actually performed, unresolved risks, and the exact next highest-leverage continuation step.

Do not leave the branch in an unexplained half-merged state.
