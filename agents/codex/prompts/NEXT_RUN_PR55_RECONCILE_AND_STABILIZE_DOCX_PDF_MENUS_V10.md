# PR #55 Reconcile + Standardize DOCX/PDF/Menus (V11)

## Authority

This is the single authoritative prompt for the next Codex run on PR #55.

Read these first, in this order:

1. `agents/codex/debug/PR55_STABILIZATION_MAP_V10.md`
2. `agents/codex/debug/IMAGE_DRAG_INTERCHANGE_V10.md`
3. `agents/codex/debug/PDF_EDITOR_PARITY_AUDIT_V1.md`
4. `agents/codex/debug/PDF_TEXT_DATA_SAFETY_V1.md`
5. `agents/codex/debug/PDF_EXPORT_CLEANLINESS_V1.md`

Treat those documents as part of this prompt. Where an older note conflicts with executable code or a newer audit, the newer audit plus the executable branch are authoritative.

## Starting point

Continue PR #55 on branch:

`codex/implement-docx-editing-and-context-menu`

Before substantive work, reconcile #55 with the latest `main`. Preserve useful merged behavior from PR #54, but do not assume PDF image editing is complete merely because an older V10 note says so. Verify the actual reconciled branch. If #54 contains reusable PDF image insertion/drag work, retain and generalize it. If the reconciled branch still lacks first-class PDF image objects, implement them.

Resolve conflicts semantically, not by choosing one entire side.

## Product objective

The DOCX side has reached a considerably more useful, deliberate editing state. Bring the PDF side toward the same standard.

This does not mean cloning Acrobat or implementing arbitrary full PDF content-stream surgery in one pass. It means that ordinary editing operations a normal user expects must be coherent, safe, and native to the PDF surface:

```text
open PDF
select / add text
insert / drop / paste image
move / resize / arrange objects
change text properties
wrap or layer FrameChute-managed content
undo / redo
perform page operations
save
reopen
```

The result should feel like a real structured PDF editor rather than a viewer with unrelated utilities bolted around it.

Central law:

> **FrameChute-created PDF content must become first-class PDF page objects with canonical state, direct manipulation, deterministic serialization, and safe undo/redo.**

Data safety outranks feature count. A feature that can silently lose typed text or export editor artifacts is not complete.

---

# P0 work, in order

## 1. Reconcile PR #55 with latest main without regressing DOCX or shared drag behavior

Preserve all useful #55 DOCX work:
- richer DOCX toolbar
- literal point-size formatting
- paragraph spacing/indentation
- styles/headings
- lists
- links
- tables/images
- page setup
- dedicated DOCX context menu
- formatting round-trip work
- image resizing/removal/undo
- image wrapping/free positioning

Preserve useful merged #54/shared behavior:
- internal FrameChute image drag ownership
- actual image-byte resolution
- correct native-drag lifecycle
- external workspace ingest still working
- any valid DOCX/PDF image insertion behavior present on latest `main`

Do not restore pre-#54 drag behavior during conflict resolution.

## 2. Fix PDF text data safety BEFORE adding more PDF features

Read `PDF_TEXT_DATA_SAFETY_V1.md` and treat it as release-blocking.

Current dangerous architecture allows edited DOM text to become newer than `runtime.edits`, then a move/resize/rerender can restore stale model text. Free-text fields also use synthetic indexes that can be confused with source PDF text indexes.

Required invariant:

> **No user-entered PDF text may exist only in a temporary DOM node waiting for blur.**

Canonical PDF object state must be at least as current as visible edited text.

Implement a reliable commit/update seam such as `commitActivePdfTextEdit()` or equivalent. Before any operation capable of rerendering or replacing the page surface, ensure active text is committed without loss:
- move
- resize
- change page
- font/property changes
- duplicate
- delete
- undo/redo
- merge/crop/page operations
- Save / Save As
- workspace capture/export
- PDF frame resize/rerender

Prefer updating canonical text on `input` so the model is continuously current, with the explicit commit seam as a safety barrier.

Do not identify FrameChute-created free text through fake negative source indexes. Give every editable object a stable object ID. Original PDF replacement text may separately carry `sourceIndex` or equivalent.

Moving a field must satisfy:

```text
before move: text = X, geometry = A
after move:  text = X, geometry = B
```

Only geometry changes. Resizing must obey the same law.

## 3. Fix PDF export cleanliness BEFORE declaring PDF editing dependable

Read `PDF_EXPORT_CLEANLINESS_V1.md`.

Hard rule:

> **Saved PDFs contain document content only. Editor chrome must never appear in the output.**

Never serialize:
- selection outlines
- dashed/blue field outlines
- resize handles
- move handles
- hover backgrounds
- editor guides
- temporary drop UI

The current cover-and-redraw replacement model must not leave visible source glyph remnants or rectangular/cut-line seams on ordinary white page regions. Preserve the bounded source-mask bleed fix or improve it if tests show it is insufficient.

Do not pretend that a white rectangle is a general solution for text over photographs, gradients, colored shapes, or complex vector backgrounds. For unsupported complex-background replacement, preserve content and fail honestly rather than destructively painting an obviously wrong patch.

## 4. Introduce one general PDF page-object model

Stop treating “PDF edit” as synonymous with “text edit.”

Create or refactor toward a discriminated canonical object model, for example:

```js
{
  id,
  kind: "replacement-text" | "text" | "image",
  page,
  x,
  y,
  width,
  height,
  rotation,
  zOrder,
  ...kindSpecificData
}
```

Names may differ, but the semantics must exist.

Geometry is stored in **PDF page coordinates**, never viewport CSS pixels. Reuse/strengthen the existing `pdfRectToViewport()` / `viewportRectToPdf()` seam.

Page/frame resize may change projection only. It must never silently change saved PDF coordinates.

For images, keep binary asset bytes separate from history/object snapshots. Use an asset store keyed by stable asset ID rather than copying large base64 strings through every undo snapshot.

Example image semantics:

```js
{
  id: "...",
  kind: "image",
  assetId: "...",
  mime: "image/png",
  page: 1,
  x: 72,
  y: 300,
  width: 180,
  height: 120,
  rotation: 0,
  zOrder: 12
}
```

## 5. Implement first-class PDF image insertion

This is a core missing standard feature.

All of these routes must converge on the same canonical insertion primitive:

```text
Image button / picker -> PDF
right-click Insert Image -> PDF
OS PNG/JPEG drop -> PDF
clipboard image paste -> PDF
FrameChute workspace image -> PDF
DOCX image -> PDF
another PDF editable image -> PDF
```

The image must be inserted at the actual page/drop coordinates as a **PDF-owned editable page object**.

It must NOT become a new generic FrameChute workspace frame when the destination is a PDF page.

At minimum support PNG and JPEG using real bytes. Preserve PNG alpha where the serializer/library supports it.

Insertion must be undoable in one step and survive Save / Save As / reopen.

## 6. Give PDF images standard direct-manipulation functionality

A selected FrameChute-inserted PDF image must support ordinary editor behavior:
- click to select
- visible editor-only selection chrome
- drag to move anywhere on the page
- corner resize handles
- preserve aspect ratio by default
- optional modifier/control for free non-proportional resize if practical
- duplicate
- delete / Backspace
- undo / redo
- rotate when practical
- bring forward / send backward or equivalent z-order controls
- Save / Save As / reopen with geometry intact

Same-PDF movement changes the **same object**, not a duplicate.

Cross-container drag is a non-destructive copy by default.

A PDF image must never trigger the global `Drop into FrameChute` overlay while being manipulated inside the PDF.

## 7. Add practical image arrangement / wrapping modes for PDF-created content

Bring the PDF image experience closer to the useful DOCX image model while respecting that PDF is fixed-layout rather than flowing Word layout.

For FrameChute-managed PDF content, support at minimum these user-facing arrangement modes or their closest fixed-layout equivalents:
- **Inline / anchored placement** where applicable to FrameChute-created text flow
- **Square wrap** around the image for FrameChute-managed text fields
- **Top and Bottom** flow for FrameChute-managed text
- **Behind Text**
- **In Front of Text / Free Position**

If a true **Tight** contour wrap cannot be implemented reliably in this pass, do not fake it. Square wrap is acceptable as the standardized baseline.

Important distinction: PDF is fixed-layout. Do not rewrite arbitrary original PDF page content just to simulate Word reflow. Wrapping/reflow behavior may apply to FrameChute-created/manageable text objects where geometry is under FrameChute control.

For front/behind placement, z-order must serialize deterministically. Save/reopen must preserve the intended stacking order.

## 8. Make DOCX/PDF and internal-image movement overlay-free

This remains a hard product law.

Do NOT add another document overlay, large drop target, modal wash, or replacement drag panel.

Required:

```text
DOCX frame/editor -> Drop into FrameChute overlay impossible
PDF frame/editor  -> Drop into FrameChute overlay impossible
any image whose source is already inside FrameChute -> overlay impossible everywhere
moving image inside DOCX -> direct move only
moving image inside PDF -> direct move only
```

The global workspace ingest overlay may remain only for genuinely external material over blank/general workspace if that existing UI is otherwise desired.

Use/reuse shared drag ownership. Source identifies itself semantically; destination decides move/copy behavior.

## 9. Universal image interchange across workspace, DOCX, and PDF

Read `IMAGE_DRAG_INTERCHANGE_V10.md`, but correct its stale assumption that current PDF image editing is necessarily already present.

Architectural law:

```text
Any image whose origin is already inside FrameChute
-> begin one FrameChute-internal image drag session
-> generic external ingest is forbidden
-> destination decides move/copy semantics
```

Same-container operations are moves:
- workspace -> workspace moves same workspace image object
- DOCX -> same DOCX moves/reorders same embedded image
- PDF -> same PDF updates same canonical PDF image object

Cross-container operations are non-destructive copies:
- workspace -> DOCX/PDF leaves source
- DOCX/PDF -> workspace creates exactly one workspace image from canonical bytes and leaves source
- DOCX <-> PDF inserts exactly once and leaves source

For DOCX, use real embedded part bytes and preserve relationship/part when moving within the same document where possible.

For original images already embedded in arbitrary existing PDFs, expose direct extraction/manipulation only when underlying raster bytes and geometry can be resolved confidently. Do not fake original-image extraction by screenshotting a page region and pretending it is the original asset.

## 10. Standardize PDF text editing controls

PDF-created/replacement text should have a coherent set of everyday controls comparable in spirit to DOCX where the PDF format permits:
- exact point size
- packaged font family
- bold/italic through supported font variants
- text color
- alignment within a FrameChute-managed field
- explicit newlines
- tabs / deterministic tab stops
- repeated spaces
- blank lines
- move
- resize
- duplicate
- delete
- undo/redo

Canonical text must preserve what the writer actually created.

Required:
- ordinary Enter stores `\n`
- Tab stores `\t`, not merely a visual approximation
- literal spaces remain literal spaces
- blank lines remain explicit blank lines
- preview and PDF serialization use the same layout interpretation

When an explicit line no longer fits, grow the text field downward while keeping its visual top fixed unless the user deliberately established clipping.

PDF coordinate rule for growth:

```text
oldTop = y + height
height = requiredHeight
y = oldTop - height
```

Overflow may hide text visually, but it must never delete canonical text.

## 11. Unify PDF undo/redo around transactions

Do not leave text history, image history, and page operations as unrelated systems if that creates user-visible inconsistency.

User expectation:

> **Undo means undo the last PDF editing operation.**

At minimum these should be transactionally undoable where practical:
- text edits
- text move/resize
- image insert
- image move/resize
- image duplicate/delete
- z-order changes
- page add/delete/duplicate/reorder
- linked text + annotation changes

Large binary assets should not be copied into every history snapshot.

## 12. PDF link annotations must follow text editing

Visible text and PDF link annotations are separate structures. FrameChute must explicitly synchronize them when it can confidently associate them.

Default user law:

```text
Deleting Text Deletes Link [ON]
```

When ON, deleting linked text deletes the associated link annotation; text deletion + annotation deletion is one undo step; Undo restores both. When OFF, deleting text may intentionally leave the annotation.

When editing linked text without deleting it, preserve the link target and update/rebuild the clickable annotation rectangle so it follows edited text geometry.

### Re-linking must replace, never stack

If the user applies a new link to text/area that is already linked, the new link **overrides/replaces the existing link target** for that selected region.

Do not create multiple overlapping PDF annotations for the same logical linked area. Do not leave the old target active underneath the new one.

Required invariant:

```text
one logical selected linked region
-> one authoritative link target
```

Re-linking should be one undoable operation. Undo restores the previous target; Redo reapplies the new target.

## 13. PDF-specific Settings command/popup

Right-clicking inside the PDF editing surface should expose `Settings...` in the PDF-native context menu. It opens PDF-specific settings, not generic FrameChute settings.

Initial required setting:

```text
Deleting Text Deletes Link [ON]
```

Default ON. Persist as PDF-editor preference state so it does not reset on every right-click.

Keep Undo, Redo, Save and Save As available where appropriate in the PDF menu.

## 14. Preserve and finish DOCX safety work

Do not regress the DOCX side while improving PDF.

### Safe Find/Replace

Do not use raw `innerHTML.split(...).join(...)`. Operate on text nodes/canonical runs so replacement cannot rewrite tags, hrefs, relationship metadata, images, tables, or attributes.

### Formatting fidelity

If parsing records strike, color, highlight, etc., render/capture/serialize them so they survive save/reopen.

### Numbering fidelity

DOCX numbering IDs are document-local. Reuse compatible definitions or allocate non-colliding IDs. Do not hard-code universal bullet/number IDs.

### Image behavior

DOCX images must remain insertable, movable/reorderable, resizable, deletable, undoable, wrappable, and save/reopen-safe without global drag overlays.

### DOCX re-linking must replace, never nest/stack

If selected DOCX text already has a hyperlink and the user applies a new link, replace the previous target for that selection. Do not nest anchors or create conflicting relationship behavior.

Undo must restore the old target; Redo must restore the new one.

## 15. Permanently fix detached submenu geometry

Use one reusable submenu-positioning primitive and one coordinate system.

Law:

```text
submenu appears immediately beside trigger
small gap 0-8px
right overflow -> flip directly left
bottom overflow -> shift upward only enough to fit
```

Never mix viewport coordinates with parent-local offsets.

Keyboard ArrowRight / ArrowLeft / Escape must keep focus and geometry coherent.

## 16. Advanced OFF must omit advanced timing commands

When `window.frameChuteAdvancedMode !== true`, do not render:
- Create/Edit timed move
- Preview timed move
- Return to move start
- Remove timed move
- Layer timing...

Omit them rather than disabling them.

## 17. Sync With is ONLY for playable audio/video

`Sync with...` and `Make independent` belong only to actual playable audio/video objects.

Never show them for image, PDF, DOCX, WEBX, text, SVG, canvas, gallery/static image, generic files, or blank workspace.

Make this capability-based and keep separators hidden/omitted with the commands.

## 18. Cross-document link interaction law: Shift+Click follows links

This applies to **both DOCX and PDF**.

Normal click must remain available for selection/editing. A link should not become impossible to edit merely because it is clickable.

Required interaction:

```text
normal click on linked text/area
-> select/edit normally

Shift+Click on linked text/area
-> open/follow the link
```

This must work for links created inside FrameChute and, where safely recognized, links preserved from the source DOCX/PDF.

Requirements:
- Shift+Click follows the currently authoritative target.
- After re-linking, Shift+Click opens the **new** target, never the replaced one.
- Do not accidentally enter text-edit mode or drag the object when Shift+Click is being used to follow a link.
- Use normal safe external-navigation behavior (`noopener`/`noreferrer` where applicable).
- Do not make ordinary click automatically navigate; ordinary click remains editor interaction.
- DOCX hyperlink relationships must save/reopen correctly.
- PDF link annotations/targets must save/reopen correctly.

---

# Context routing law

```text
PDF surface  -> PDF menu
DOCX surface -> DOCX menu
WEBX surface -> WEBX menu when implemented
object chrome / blank workspace -> generic object/workspace menu
```

Resolve from the physical point/target under the right-click. Do not require prior selection to get the correct menu.

---

# Testing requirements

Add focused tests for pure logic wherever possible, plus browser/manual interaction checks where DOM event ordering is essential.

Required coverage includes:
- DOCX/PDF destinations can never activate the global ingest overlay
- internal FrameChute image drags can never activate the global ingest overlay
- genuinely external drag over blank workspace may still use existing external-ingest presentation if retained
- internal image origin descriptor and generic-ingest suppression for workspace/DOCX/PDF sources
- same-container image move vs cross-container copy arbitration
- DOCX embedded image move/reorder without duplicate workspace ingest or overlay
- PDF image insertion from PNG/JPEG bytes
- PDF image same-document move preserving object ID
- PDF image resize preserving image bytes
- PDF image Delete/Backspace + Undo/Redo
- PDF image Save/reopen geometry and z-order fidelity
- PDF behind/front ordering
- PDF square/top-bottom wrapping for FrameChute-managed text where implemented
- PDF text input commits before move/resize/rerender
- long multiline PDF text survives move, resize, page change, undo/redo, Save and reopen
- PDF newline/tab/blank-line preservation
- PDF field growth while preserving top anchor
- PDF overflow never deletes canonical text
- PDF export contains no editor chrome
- PDF source masks do not leave obvious white-page glyph/cut-line remnants
- PDF linked-text delete preference and undo transaction semantics
- re-linking an existing PDF linked area replaces old annotation/target rather than stacking
- re-linking DOCX text replaces old hyperlink relationship/target rather than nesting
- Shift+Click DOCX link follows current target while normal click edits/selects
- Shift+Click PDF link follows current target while normal click edits/selects
- Shift+Click after re-linking follows only the replacement target
- submenu placement next-to-trigger / flip-left / vertical clamp
- Advanced OFF omits timing commands
- audio/video media-sync capability; static/document objects rejected
- safe DOCX text-only Find/Replace
- DOCX numbering reuse/allocation
- DOCX strike/color/highlight round-trip

Then run the complete existing suite, including PR #54 drag-ownership tests. Run syntax checks, `git diff --check`, and the Chrome Web Store packaging gate.

Do not claim Word/LibreOffice/browser manual verification unless it was actually performed.

---

# Completion / 30-minute reliability checkpoint

Use the available runtime aggressively. At approximately the 30-minute mark, **conclude active implementation and provide a handoff**.

The 30-minute mark is a reliability checkpoint, not an instruction to artificially limit useful work. The handoff must include exact branch/head SHA, commits, files changed, reusable primitives, solved/partial problems, tests, manual checks actually performed, unresolved risks, and the exact next highest-leverage continuation step.

Do not leave the branch in an unexplained half-merged state.
