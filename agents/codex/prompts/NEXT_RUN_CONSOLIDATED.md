# NEXT RUN — ConsolidATED FRAMECHUTE CORRECTNESS + UX PASS

This is the **single authoritative prompt for the next Codex run**. Do not read the older prompt stack unless a concrete implementation detail is missing here. Where older prompts conflict, **this file wins**.

Work from current `main`. Do not revive superseded PR #46. Do not merge stale/conflicted PR #42 wholesale; reimplement only the useful behavior on current `main`.

Core rules:

> If an action feels obvious, FrameChute should support it directly.

> The viewport moves. The artwork does not.

> If I just put it there, Ctrl/Cmd+Z should take it back out.

> Select the things. Then do the obvious thing to the selection.

> The top header must always look clean, intentional, aesthetic, and professional.

Use up to 30 minutes. Prioritize visible correctness before polish.

---

## 1. PDF / DOCX image drop, movement, resize, undo

Audit at minimum:

```text
src/documents/pdf-document.js
src/documents/docx-document.js
src/workspace.js
src/web-drop.js
src/drop-local-sources.js
src/workspace-ingestion.js
```

### Drag ownership / overlay

- Moving an existing FrameChute object must **never** show the global external-ingest overlay.
- Moving/resizing an image already inside PDF/DOCX must never show it either.
- External OS/browser file drags may show global ingest UI until a PDF/DOCX claims the drop.
- When PDF/DOCX claims a valid image drop, the document owns it completely: exactly one insertion, no duplicate workspace object.
- Existing workspace images must be droppable into PDF as an internal copy; original workspace object remains.
- Prevent accidental native browser `dragstart` on internal image/media movement.

### PDF images

Dropping an eligible image onto a PDF page must:

```text
insert at pointer position
→ select immediately
→ body drag moves it
→ bottom-right handle resizes it
→ preserve aspect ratio by default
→ store canonical PDF/page coordinates
→ survive rerender/zoom
→ Save/Save As embeds it
```

PNG/JPEG minimum; locally convert other browser-decodable formats if needed. Do not rasterize the whole PDF just to insert an image.

### DOCX images

Inserted and supported existing DOCX images must:

```text
click → select
body drag → move
bottom-right handle → resize
```

Save must preserve resulting size/position as honestly as OOXML allows. Do not fake DOM-only movement that disappears on save.

### Undo / redo

For both PDF and DOCX:

```text
insert image → Ctrl/Cmd+Z removes it
redo → restores it
move image → undo restores old position
resize image → undo restores old size
delete image → undo restores it
```

Immediately after a drop, Ctrl/Cmd+Z must remove **that just-inserted document copy**, not some unrelated prior edit and not the original workspace image.

One gesture = one history entry. Do not push history on every pointermove.

---

## 2. PDF editing correctness

### Ghost/source text

Old/source text must never reappear simply because the pointer hovers it.

```text
normal → canvas text visible
hover editable region → subtle outline/hit affordance only
committed replacement → source remains masked
hover replacement → controls/outline only
```

Remove CSS/DOM behavior that paints duplicate hidden source text on hover.

### Replacement edit affordance

Current `Select replacement text to edit.` presentation is not an actionable control. Fix the UX so the user can actually enter/select replacement editing predictably.

Prefer either:

- click/double-click an editable PDF text region directly, or
- a real button/control with clear enabled/disabled semantics.

Do not leave non-clickable text styled like an action.

### Multiline fields

Resizable PDF replacement fields must support real new lines:

```text
Enter → newline
Ctrl/Cmd+Enter → commit/finish
```

Field width controls wrapping width; field height is a real multiline area. Save/Save As must preserve the resulting line layout as closely as the current serializer supports.

### PDF bounded/marquee selection

Allow drawing a bounded rectangular selection over the PDF page to select multiple movable PDF edit objects (replacement fields and inserted images at minimum).

Then:

```text
marquee select
→ drag selection
→ all selected items move together
→ Ctrl/Cmd+Z restores prior positions
```

For original baked PDF text, convert selected text to the existing replacement/mask model rather than pretending native source objects are freely movable.

---

## 3. FCX workspace persistence

Current symptom: local video survives workspace reopen while local image may disappear.

Fix `Include Files` so every visible local asset required to reconstruct the workspace is actually embedded/restored, including custom/local image block marker families.

Audit:

```text
src/fcx-portable.js
src/fcx-format.mjs
src/web-drop.js
src/local-source-links.js
```

Required:

```text
local image + local video
→ Export Workspace
→ Include Files
→ reopen without original OS handles
→ BOTH restore automatically
```

For State Only, if a handle is unavailable, keep the object present with a clear reconnect state. Never silently drop the object.

Persist new PDF/DOCX inserted-image state and geometry sufficiently to reopen the current visible document state.

---

## 4. Expandable workspace instead of viewport confinement

Dragging a top-level FrameChute object against any workspace edge should create more workspace:

```text
left / right / top / bottom
→ extend workspace in useful chunks
→ user can later scroll into that area
```

Do **not** force objects back into the viewport.

For left/top growth use an origin + scroll-compensation approach so the user's artwork does not visibly jump and object world coordinates remain conceptually stable.

Only intentional direct object movement may trigger growth. Window resize, scrolling, toolbar wrapping, rerender, etc. must not move artwork or create space.

Persist expanded workspace extents/origin through FCX reopen.

Retire any remaining passive reachability clamp that contradicts:

> The viewport moves. The artwork does not.

`Bring to Center` remains the explicit rescue command.

---

## 5. Simple vs Advanced context-menu cleanup

### Timed move commands

In **Simple / non-Advanced mode**, hide these entirely from right-click menus:

```text
Create/Edit timed move
Preview timed move
Return to move start
Remove timed move
Layer timing…
```

Advanced may keep them.

### Sync / independent exact rule

`Sync with…` and `Make independent` are **playable-media-only** context actions.

Show them only when ALL are true:

```text
Advanced mode
+
actual playable video/movie object OR playable audio/sound object
```

Use canonical object/media capability (`<video>`, `<audio>`, playable media type), not filename text alone.

Examples allowed in Advanced:

```text
MP4 / WebM video
MP3 / WAV / OGG audio
```

Never show them for:

```text
images/GIF/screenshots
PDF
DOCX
text/notes
canvas/drawing
CSV/archive/static files
```

Simple mode: hide them for everything.

---

## 6. First-class Select Mode + bulk actions

Add an obvious top-toolbar control:

```text
Select Mode [ OFF ] / [ ON ]
```

This is a Simple-mode feature too, not Advanced-only.

Use the existing selection model rather than creating a second system.

When ON:

- normal click selects instead of starting move/edit,
- Ctrl/Cmd-click toggles,
- Shift-click extends/toggles consistently,
- empty-workspace click clears,
- selected objects show quiet clear chrome,
- context menus/dialogs do not accidentally clear selection,
- deleting an object removes it from selection,
- internal selection gestures never show global ingest overlay.

Support ordinary top-level objects at minimum: images, video, audio, PDF, DOCX, notes/text, canvas/generated visuals.

Workspace marquee selection from empty space is desirable if safe in the timebox; click multi-select is mandatory.

### Bulk action surface

When 2+ objects are selected, show a compact surface with count (e.g. `4 selected`) and only valid bulk actions.

Useful immediate actions:

```text
Close Selected
Bring to Front
Send to Back
Export / ZIP Selected
FrameSnap/Take Snapshot of Selection if existing primitives permit
Arrange into PDF…
```

All-image selections may expose existing bulk resize/format operations.

Never run a single-object command silently on only one item while presenting it as bulk.

### Arrange into PDF V1

From selection:

```text
select eligible items
→ Arrange into PDF…
→ simple organizer/list
→ reorder/remove entries
→ Make PDF
→ Save As
→ optional Add result to Workspace
```

Eligibility V1:

- images: one page each,
- PDFs: copy/import original pages where practical using pdf-lib rather than rasterizing,
- generated images: same as images.

Do not silently convert DOCX/video/web objects unless there is already a trustworthy explicit conversion route.

Preserve image aspect ratio. Support basic `Auto / Letter / A4`, Contain, Auto orientation if practical.

---

## 7. Image utilities currently appearing to do nothing

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

The current state model stores many transforms but the visible workspace preview does not always render them. Fix around one canonical non-destructive image state + live-preview renderer.

Requirements:

- every accepted action visibly updates the actual image object immediately,
- preview and Save/Export use the same state,
- stable base source prevents cumulative blur/JPEG loss/warp recursion,
- async preview jobs use stale-generation protection,
- revoke replaced object URLs,
- don't announce success until preview succeeds,
- failures leave previous image visible and report an error.

Each listed operation must visibly work and be undoable with Ctrl/Cmd+Z; redo restores it.

Perspective must warp pixels, not just the DOM rectangle. Blur/pixelate must affect the chosen region. Fill background must fill behind transparency, not cover opaque content.

---

## 8. Screenshot black-frame bug

Audit:

```text
src/actions/capture-actions.js
```

Do not rely on `video.play()` + two `requestAnimationFrame()` calls before `drawImage()`.

Wait for a real delivered capture frame using a robust strategy such as:

```text
ImageCapture(track).grabFrame()
or
requestVideoFrameCallback() after metadata + nonzero video dimensions
or
an event-based real-frame fallback
```

Requirements:

- nonzero dimensions before capture,
- actual frame readiness,
- exactly one PNG result object,
- stop capture tracks promptly on success/failure/cancel,
- cancellation creates no result,
- never create a black placeholder and claim success,
- Screenshot must not accidentally start recording.

Manual browser smoke-test the result against a bright/obvious screen or window.

---

## 9. Take Snapshot behavior

Snapshot rectangle must be determined by the **outermost visible edges of included FrameChute objects**, not the current viewport.

```text
Tight Bounds
→ object-union bounds + configured padding

Square
→ start with same union bounds
→ expand only shorter dimension symmetrically
→ never stretch/distort objects
```

Add two unchecked options with these exact labels:

```text
[ ] Create in Workspace
[ ] Open Location After
```

### Create in Workspace

After a successful save, reuse the **same rendered Blob** to create exactly one normal image object in FrameChute. Do not rerender. The new object must not retroactively affect the snapshot bounds that produced it.

### Open Location After

After successful save, use a real supported reveal/open-location route. In extension context, `chrome.downloads` + `show(downloadId)` is acceptable if needed; add only the minimal permission. If unavailable, report honestly rather than silently doing nothing.

If both are checked:

```text
render once
→ save once
→ create one workspace image from same Blob
→ reveal saved location
```

---

## 10. Top header / toolbar must always look professional

The current top header can feel crowded/janky when the browser is reduced to about half-width. Fix this as a first-class UX requirement.

Audit:

```text
src/workspace.html
src/workspace.css
src/toolbar-paradigm.js
src/framechute-final-polish.css
src/framechute-final-polish.js
```

Required visual behavior:

- one intentional compact header strip, not a pile of wrapped rows,
- no ugly overlap, collisions, crushed labels, or random vertical growth,
- full-width layout looks balanced and deliberate,
- half-width desktop still looks designed rather than merely squeezed,
- narrow extension window remains usable,
- preserve clear spacing between brand, primary actions, Select Mode, Workspace, Snapshot, status,
- low-priority text/status collapses before core actions,
- icon-only or shortened labels may activate responsively without overwriting the user's saved toolbar-text preference,
- dropdown/popup panels float over the workspace instead of increasing header height,
- horizontal scrolling for a single command strip is preferable to multi-row wrapping if necessary,
- touch/click targets remain usable,
- no toolbar resize may move workspace objects or rewrite their coordinates.

Professional means restrained and consistent: aligned baselines, consistent button heights/radii/padding, predictable gaps, no crowding, no accidental wrapping, no duplicated visual hierarchy.

Test at:

```text
full desktop width
~50% desktop width
narrow extension width
```

---

## 11. Preserve current good behavior

Do not regress:

- native Save / Save As,
- PDF replacement editing and source masking,
- PDF page controls/export,
- DOCX embedded-image hardening/unique IDs,
- Quick Actions close behavior,
- Tight/Square snapshot behavior,
- external file/URL ingestion,
- frameless media,
- workspace/object context-menu separation,
- FCX Open Workspace / Export Workspace terminology,
- spatial permanence.

---

## 12. Validation

Add focused regression tests for the changed models/helpers and run at minimum:

```bash
node --test tests/*.test.mjs
node --check <every modified JS file>
git diff --check
bash scripts/package-web-store.sh
```

Manual browser smoke tests must cover at least:

```text
1. Move workspace image → no global overlay.
2. Drop image into DOCX → Ctrl+Z removes it; redo restores.
3. Drop image into PDF → move/resize; Ctrl+Z/redo work.
4. PDF replacement hover → old text never reappears.
5. PDF multiline Enter creates newline.
6. PDF marquee selects/moves multiple edit objects if implemented.
7. FCX Include Files → local image + video both reopen.
8. Each reported image utility visibly changes the image.
9. Screenshot of bright content is not black.
10. Take Snapshot extra options behave exactly once from one render.
11. Select Mode selects several objects without starting drag/edit.
12. Arrange into PDF produces correct ordered pages if completed.
13. Simple right-click has no timed-move clutter.
14. Advanced playable audio/video shows Sync/Independent; static objects do not.
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

If the entire scope cannot fit safely, prioritize in this order:

```text
1. document drop/undo/overlay correctness
2. PDF edit correctness
3. FCX image persistence
4. screenshot + image utility no-op fixes
5. professional responsive header
6. Select Mode foundation
7. snapshot extras
8. expandable workspace
9. Arrange into PDF / marquee polish
```
