# PR #55 Reconcile + Stabilize DOCX/PDF/Menus (V10)

## Authority

This is the single authoritative prompt for the next Codex run on PR #55.

Read first:

`agents/codex/debug/PR55_STABILIZATION_MAP_V10.md`

That debug map names the concrete failure sites, user-facing laws, and acceptance criteria. Treat it as part of this prompt.

## Starting point

Continue PR #55 on branch:

`codex/implement-docx-editing-and-context-menu`

PR #54 has already merged to `main` after PR #55 was created. Before substantive work, reconcile #55 with the latest `main`. Preserve merged #54 behavior, especially the shared drag-ownership primitive and image insertion into DOCX/PDF. Do not restore pre-#54 drag behavior during conflict resolution.

## Product objective

This pass is a stabilization summit pass, not a feature grab-bag. Make the existing interaction model behave like a dependable ordinary editor/workbench by fixing the root primitives that currently create repeated regressions.

The user should be able to right-click, type, edit, drag, save, and reopen without the interface exposing impossible commands or visually detached UI.

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
- no global Drop into FrameChute overlay during internal image movement
- image drop into DOCX
- image drop into PDF
- actual image-byte resolution
- correct native-drag lifecycle
- external workspace ingest still working

Resolve conflicts semantically, not by choosing one entire side.

### 2. Permanently fix detached submenu geometry

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

### 3. Advanced OFF must omit advanced timing commands

When `window.frameChuteAdvancedMode !== true`, these commands must not exist in the rendered generic context menu:
- Create/Edit timed move
- Preview timed move
- Return to move start
- Remove timed move
- Layer timing...

Do not merely disable them. Prefer command-model/construction filtering so the simple user is never presented with them.

### 4. Sync With is ONLY for playable audio/video

`Sync with...` and `Make independent` must appear only for actual playable video or audio objects.

Never show these commands for:
- image
- PDF
- DOCX
- WEBX
- text
- SVG
- canvas
- gallery/static image
- generic files
- blank workspace

Make the predicate capability based. Include audio and video. Keep separators hidden/omitted with the commands.

### 5. Repair PR #55 DOCX hazards

#### Safe Find/Replace

Do not use `editor.innerHTML.split(search).join(replacement)` or equivalent raw HTML mutation.

Find/Replace must operate on text nodes or canonical runs so replacement text cannot accidentally rewrite:
- HTML tags
- hrefs
- DOCX relationship metadata
- image metadata
- table structure
- arbitrary attributes

Preserve unrelated formatting/structure.

#### Formatting fidelity

If DOCX parsing records `strike`, `color`, and `highlight`, render those properties into the editable DOM and capture them back into canonical runs so they survive save/reopen.

#### Numbering fidelity

DOCX numbering IDs are document-local. Do not hard-code universal IDs such as 1 for bullet / 2 for number. Reuse compatible existing numbering definitions or allocate non-colliding numbering and abstract-number IDs as needed.

#### Preserve DOCX image insertion

After merging latest main, both OS image drop and existing FrameChute-image drop into DOCX must still insert exactly once and save/reopen correctly.

### 6. PDF explicit newlines, tabs, and structured whitespace

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

Acceptance: type line 1, Enter, line 2 => both visible, both survive Save/reopen. Type Tab then text => canonical state retains a real tab. Six literal spaces remain six literal spaces.

### 7. PDF link annotations must follow text editing

Visible text and PDF link annotations are separate structures. FrameChute must explicitly synchronize them when it can confidently associate them.

Default user law:

```text
Deleting Text Deletes Link [ON]
```

When ON:
- deleting linked text deletes the associated link annotation;
- text deletion + annotation deletion is ONE undo step;
- Undo restores both.

When OFF:
- deleting text may intentionally leave the annotation.

When editing linked text without deleting it:
- preserve the link target;
- update/rebuild the associated clickable rectangle so it follows the edited text geometry instead of leaving a ghost hot area where the old text was.

Association must be conservative and page/geometry aware. Do not delete unrelated nearby annotations.

### 8. PDF-specific Settings command/popup

Right-clicking inside the PDF editing surface should expose `Settings...` in the PDF-native context menu.

It opens a PDF-specific settings UI, not generic FrameChute settings.

Initial required setting:

```text
Deleting Text Deletes Link [ON]
```

Default ON. Persist as PDF-editor preference state so it does not reset on every right-click.

Keep Undo, Redo, Save and Save As available where appropriate in the PDF menu.

## Context routing law

Do not regress format-native menus:

```text
PDF surface  -> PDF menu
DOCX surface -> DOCX menu
WEBX surface -> WEBX menu when implemented
object chrome / blank workspace -> generic object/workspace menu
```

Resolve from the physical point/target under the right-click. Do not require prior selection to get the correct menu.

## Testing requirements

Add focused tests for pure logic wherever possible:
- submenu placement next-to-trigger / flip-left / vertical clamp;
- Advanced OFF omits timing commands;
- audio/video media sync capability; static/document objects rejected;
- safe DOCX text-only Find/Replace;
- DOCX numbering reuse/allocation;
- DOCX strike/color/highlight round-trip;
- PDF newline/tab/blank-line preservation;
- PDF field growth while preserving top anchor;
- PDF linked-text delete preference and undo snapshot semantics.

Then run the complete existing suite, including PR #54 drag-ownership and PDF-image tests.

Run syntax checks, `git diff --check`, and the Chrome Web Store packaging gate.

Do not claim Word/LibreOffice/browser manual verification unless it was actually performed.

## Completion / 30-minute reliability checkpoint

Use the available runtime aggressively. At approximately the 30-minute mark, **conclude active implementation and provide a handoff**.

The 30-minute mark is a reliability checkpoint, not an instruction to artificially limit useful work. The handoff must include:
- exact branch and head SHA;
- commits created;
- files changed;
- reusable primitives added;
- which user-facing problems are fully solved;
- which are partially solved;
- tests and validation results;
- manual checks actually performed;
- unresolved risks;
- exact next highest-leverage continuation step.

Do not leave the branch in an unexplained half-merged state.
