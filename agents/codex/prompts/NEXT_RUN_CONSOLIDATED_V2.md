# NEXT RUN — FrameChute correctness + UX pass (V2)

This is the **single authoritative prompt** for the next Codex run. Work from current `main`. **Do not read the older prompt stack unless this file leaves a concrete implementation detail genuinely ambiguous.** Where older prompts conflict, this file wins.

Do not revive PR #46 and do not merge stale PR #42 wholesale. Reimplement needed behavior on current `main`.

Core rules:

> If an action feels obvious, FrameChute should support it directly.

> The viewport moves. The artwork does not.

> If I just put it there, Ctrl/Cmd+Z should take it back out.

> Select the things. Then do the obvious thing to the selection.

> The top header must always look clean, intentional, aesthetic, and professional.

Use up to 30 minutes. Prioritize user-visible correctness.

---

## 1. PDF / DOCX image drop, move, resize, undo

Audit at minimum:

```text
src/documents/pdf-document.js
src/documents/docx-document.js
src/workspace.js
src/web-drop.js
src/drop-local-sources.js
src/workspace-ingestion.js
```

Required:

- Moving an existing FrameChute object must **never** show the global external-ingest overlay.
- Moving/resizing an image already inside PDF/DOCX must never show it either.
- External file/URL drags may show ingest UI until a document claims the drop.
- PDF/DOCX valid image drop = document owns it, exactly one insertion, no duplicate workspace object.
- Existing workspace images must be droppable into PDF/DOCX as a copy; original workspace object remains.
- Prevent accidental native `dragstart` during internal manipulation.

### PDF image insertion

Drop an eligible image on the current PDF page:

```text
insert at pointer
→ select
→ drag image body to move
→ bottom-right handle to resize
→ preserve aspect ratio by default
→ store page/PDF coordinates
→ survive rerender/zoom
→ Save/Save As embeds it
```

PNG/JPEG minimum; locally convert other browser-decodable formats if needed. Do not rasterize the whole PDF just to insert an image.

### DOCX image manipulation

Inserted and supported existing DOCX images:

```text
click → select
body drag → move
bottom-right handle → resize
```

Persist size/position honestly in OOXML. Do not make DOM-only edits that vanish on save.

### Undo/redo

For both PDF and DOCX:

```text
insert → Ctrl/Cmd+Z removes it
redo → restores it
move → undo restores old position
resize → undo restores old size
delete → undo restores it
```

Immediately after a drop, Undo must remove **that just-inserted document copy**, not an unrelated edit and not the original workspace image. One gesture = one history entry.

---

## 2. PDF editing correctness

### Ghost/source text

Old PDF source text must never reappear on hover.

```text
normal → canvas text visible
hover editable region → outline/hit affordance only
committed replacement → source stays masked
hover replacement → controls/outline only
```

### Replacement editing affordance

`Select replacement text to edit.` is currently non-clickable and confusing. Replace it with a real interaction:

- direct click/double-click on editable text, or
- an actual button/control with clear state.

Do not leave action-looking text that cannot be clicked.

### Multiline replacement fields

```text
Enter → newline
Ctrl/Cmd+Enter → commit/finish
```

Field width controls wrap width; height is a real multiline area. Save/Save As should preserve line layout as closely as the serializer permits.

### PDF bounded selection

Allow a rectangular marquee inside a PDF page to select multiple movable PDF edit objects, at minimum replacement fields + inserted images.

```text
marquee → select objects → drag group → Ctrl/Cmd+Z restores positions
```

For original baked PDF text, use the existing replacement/mask model rather than pretending source PDF objects are directly movable.

---

## 3. FCX persistence

Current symptom: local video survives reopening while local image may disappear.

Audit:

```text
src/fcx-portable.js
src/fcx-format.mjs
src/web-drop.js
src/local-source-links.js
```

`Include Files` must package every local asset required to reconstruct the workspace, including all local/custom image marker families.

Acceptance:

```text
local image + local video
→ Export Workspace / Include Files
→ reopen without original OS handles
→ BOTH restore automatically
```

State Only: if source handle is unavailable, keep the object visible with a reconnect state. Never silently drop it.

Persist new PDF/DOCX inserted-image state and geometry sufficiently to restore current visible document state.

---

## 4. Expandable workspace

Dragging a top-level FrameChute object against left/right/top/bottom should create more workspace rather than force the object into the viewport.

- grow in useful chunks while intentionally dragging at an edge,
- user can later scroll into the new area,
- left/top growth uses origin + scroll compensation so artwork does not visibly jump,
- passive scroll, resize, toolbar changes, rerender, etc. must not move artwork or create space,
- persist extents/origin through FCX,
- `Bring to Center` remains the explicit rescue command.

Retire any passive reachability clamp that contradicts:

> The viewport moves. The artwork does not.

---

## 5. Simple vs Advanced right-click cleanup

In Simple mode hide completely:

```text
Create/Edit timed move
Preview timed move
Return to move start
Remove timed move
Layer timing…
```

Advanced may keep them.

### Sync / independent exact rule

`Sync with…` and `Make independent` exist only for **actual playable audio/video objects in Advanced mode**.

Allowed examples:

```text
MP4/WebM video
MP3/WAV/OGG audio
```

Never show them for image/GIF/screenshot, PDF, DOCX, text/note, canvas, CSV, archive, or other static/non-playable objects. Simple mode hides them for everything.

Use actual media capability/object type (`<video>`, `<audio>`, canonical playable-media type), not filename text alone.

---

## 6. First-class Select Mode + bulk actions

Add a visible top-toolbar control:

```text
Select Mode [OFF/ON]
```

It is available in Simple mode too.

When ON:

- click selects instead of starting move/edit,
- Ctrl/Cmd-click toggles,
- Shift-click extends/toggles consistently,
- click empty workspace clears,
- selected objects show quiet selection chrome,
- opening menus/dialogs does not accidentally clear selection,
- deleting an object removes it from selection,
- selection gestures never trigger global ingest overlay.

Support ordinary top-level images, video, audio, PDF, DOCX, notes/text, canvas/generated visuals. Workspace marquee is desirable if safe; click multi-select is mandatory.

When 2+ items are selected, show a compact bulk surface with count and only valid actions. Useful actions:

```text
Close Selected
Bring to Front
Send to Back
Export/ZIP Selected
FrameSnap/Take Snapshot of Selection if existing primitives allow
Arrange into PDF…
```

All-image selection may expose existing bulk resize/format operations.

### Arrange into PDF V1

```text
select eligible items
→ Arrange into PDF…
→ simple reorder/remove organizer
→ Make PDF
→ Save As
→ optional Add result to Workspace
```

Eligibility V1: images = one page each; PDFs = copy/import original pages where practical without rasterizing; generated images = images. Do not silently convert DOCX/video/web.

Preserve aspect ratio. Basic Auto/Letter/A4 + Contain + Auto orientation is enough if practical.

---

## 7. Quick Actions UX — authoritative rule

Audit:

```text
src/actions/quick-actions.js
src/actions/quick-actions.css
src/actions/quick-actions-visibility.js
src/actions/object-menu-model.mjs
src/settings.js
src/layer-menu.js
```

### REMOVE `Clear`

The Quick Actions panel currently contains a `Clear` button. **Delete it from the Quick Actions UI.** It must not appear anywhere in the panel.

The panel header should be:

```text
Quick Actions                                      ×
```

Requirements for `×`:

- top-right of the Quick Actions panel,
- accessible label `Close Quick Actions`,
- closes/hides the panel only,
- does **not** clear selection,
- does **not** delete/close the selected object,
- does **not** change Quick Actions settings,
- does **not** change per-object enable state.

Do not rename `Clear` to another selection-clearing button. The selection-clear command can exist elsewhere if needed, but **not in the Quick Actions panel**.

### Global Settings control

Add an obvious Settings option, for example:

```text
[ ] Enable Quick Actions
```

or equivalent `Quick Actions [ON/OFF]` wording.

Semantics:

```text
Global ON
→ normal objects may show Quick Actions according to normal selection rules

Global OFF
→ Quick Actions stay hidden globally
→ EXCEPT an individual image explicitly enabled from its right-click menu
```

Persist the global setting using existing settings storage.

### Per-image right-click override

Image right-click menu must expose:

```text
Quick Actions [ON/OFF]
```

This is an **individual image override**, not a global switch.

Required behavior:

```text
Global OFF + image override ON
→ that image may show Quick Actions

Global OFF + image override OFF/default
→ hidden

Global ON + image override OFF
→ hidden for that image

Global ON + image override ON/default
→ visible according to normal selection rules
```

For an image that has never been explicitly overridden, follow the global setting. The right-click toggle changes only the invoked image. Persist the per-image override across ordinary selection changes, frame/frameless changes, reload/workspace state, and FCX where object state is already persisted.

Do not let incidental selection, dialog open/close, or panel close resurrect Quick Actions against the effective global + per-image state.

The user specifically asked for the override on **images**. Do not add unnecessary per-object Quick Actions toggles to PDF/DOCX/text/audio/video unless already required elsewhere.

---

## 8. Image utilities that currently appear to do nothing

Reported no-op actions:

```text
Trim transparency
Make color transparent
Fill background
Blur / pixelate
Annotate
Straighten
Perspective
```

Audit:

```text
src/actions/quick-actions.js
src/actions/image-operations.js
src/image-edit/paint-runtime.js
```

Build/refactor around one canonical non-destructive image state + live-preview path.

Required:

- every accepted operation visibly updates the current image immediately,
- preview and Save/Export use the same state,
- stable base source avoids cumulative quality loss/effect recursion,
- stale async preview renders cannot overwrite newer edits,
- revoke replaced object URLs,
- only announce success after visible preview succeeds,
- failure leaves previous image intact and reports error,
- each listed operation participates in Ctrl/Cmd+Z/redo.

Perspective must warp pixels, not only the DOM rectangle. Blur/pixelate affects only selected region. Fill background goes behind transparent pixels.

---

## 9. Screenshot black-frame bug

Audit `src/actions/capture-actions.js`.

Do not use `video.play()` + two RAFs as the sole readiness test.

Wait for an actual frame using a robust route such as:

```text
ImageCapture(track).grabFrame()
or requestVideoFrameCallback()
or event-based real-frame fallback after metadata/nonzero dimensions
```

Requirements:

- nonzero dimensions,
- real delivered frame,
- exactly one PNG result object,
- stop capture tracks on success/failure/cancel,
- cancellation creates no object,
- never create a black placeholder and claim success,
- Screenshot must not start recording.

Manual browser test against bright/obvious content.

---

## 10. Take Snapshot

Capture rectangle = union of outermost visible edges of included FrameChute objects, not viewport.

```text
Tight Bounds → object union + padding
Square → same union, expand shorter dimension symmetrically, no distortion
```

Add two unchecked options with exact labels:

```text
[ ] Create in Workspace
[ ] Open Location After
```

`Create in Workspace`: after successful save, reuse the exact rendered Blob to create exactly one normal FrameChute image. Do not rerender.

`Open Location After`: after successful save, use a real supported reveal route. `chrome.downloads` + `show(downloadId)` is acceptable in extension context if needed, with minimal permission. Never silently no-op.

Both checked:

```text
render once → save once → create one workspace image → reveal saved location
```

---

## 11. Top header must always look professional

Audit:

```text
src/workspace.html
src/workspace.css
src/toolbar-paradigm.js
src/framechute-final-polish.css
src/framechute-final-polish.js
```

At full width, ~50% desktop width, and narrow extension width:

- keep one intentional compact header strip,
- no multi-row pileup,
- no overlaps/collisions/crushed labels/random height growth,
- balanced spacing among brand, core actions, Select Mode, Workspace, Snapshot, status,
- low-priority text/status collapses before core actions,
- responsive icon-only/short labels may activate without overwriting saved toolbar-text preference,
- popup/dropdown panels float rather than increasing header height,
- horizontal scrolling for one command strip is preferable to multi-row wrapping,
- consistent button heights/radii/padding/baselines,
- toolbar resizing must never move artwork.

The header should look designed, not merely squeezed.

---

## 12. Preserve current good behavior

Do not regress native Save/Save As, PDF replacement/source-mask work, PDF page controls/export, DOCX image ID/relationship hardening, Tight/Square snapshot behavior, real external ingestion, frameless media, object/workspace context-menu separation, FCX terminology, and spatial permanence.

---

## 13. Validation

Add focused tests for changed helpers/models and run:

```bash
node --test tests/*.test.mjs
node --check <every modified JS file>
git diff --check
bash scripts/package-web-store.sh
```

Manual browser smoke test at minimum:

```text
1. Move workspace image → no global overlay.
2. Drop image into DOCX → Ctrl+Z removes; redo restores; move/resize works.
3. Drop image into PDF → move/resize; Ctrl+Z/redo works.
4. PDF replacement hover → old text never reappears.
5. PDF multiline Enter → newline.
6. FCX Include Files → local image + video both reopen.
7. Every reported image utility visibly changes the image.
8. Screenshot of bright content is not black.
9. Take Snapshot options each work exactly once from one render.
10. Select Mode selects several objects without drag/edit.
11. Simple menu has no timed-move clutter.
12. Advanced playable audio/video shows Sync/Independent; static objects do not.
13. Quick Actions panel has × and NO Clear button.
14. Global Quick Actions OFF hides panel; image right-click override ON can enable it only for that image.
15. Header looks clean at full, half, and narrow widths.
```

Use up to 30 minutes.

At the 30-minute mark, **conclude active implementation and provide a handoff**.

Handoff must include:

```text
completed
remaining
files changed
tests/results
manual browser results / anything not browser-tested
known issues/risks
exact next steps
branch/commit/PR
```

If the full scope cannot fit safely, prioritize:

```text
1. document drop/undo/overlay correctness
2. PDF edit correctness
3. FCX image persistence
4. Quick Actions Clear removal + close/global/per-image override
5. screenshot + image utility fixes
6. professional responsive header
7. Select Mode foundation
8. snapshot extras
9. expandable workspace
10. Arrange into PDF / marquee polish
```
