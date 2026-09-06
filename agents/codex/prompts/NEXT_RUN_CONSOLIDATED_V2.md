# NEXT RUN — FrameChute authoritative correctness + UX pass

This is the **single authoritative prompt** for the next Codex run. Work from current `main`. Do not read older prompt files unless this file leaves a concrete implementation detail genuinely ambiguous. Where older prompts conflict, this file wins. Do not revive PR #46 or blindly merge stale PR #42.

Use up to 30 minutes. Prioritize visible correctness. At the 30-minute mark, **conclude active implementation and provide a handoff**.

Core rules:

> Internal manipulation must never look like external ingestion.
>
> The viewport moves. The artwork does not.
>
> If I just put it there, Ctrl/Cmd+Z should take it back out.
>
> Select the things. Then do the obvious thing to the selection.
>
> The top header must always look clean, intentional, aesthetic, and professional.

---

## P0 — MOST IMPORTANT: grabbing/moving anything inside FrameChute must NEVER show `Drop into FrameChute`

Fix this first and verify it before lower-priority polish.

Audit the drag/drop and object-movement paths, especially:

```text
src/web-drop.js
src/drop-local-sources.js
src/workspace-ingestion.js
src/workspace.js
src/layer-menu.js
src/frameless-media.js
src/documents/pdf-document.js
src/documents/docx-document.js
```

Required contract:

```text
External OS/browser file or URL drag
→ global `Drop into FrameChute` overlay MAY appear

Grab/move existing FrameChute image/video/audio/PDF/DOCX/text/canvas/object
→ global overlay MUST NOT appear, not even briefly

Resize existing FrameChute object
→ no global overlay

Select/marquee existing FrameChute objects
→ no global overlay

Move/resize image already inside PDF/DOCX
→ no global overlay

Drag existing workspace image into PDF/DOCX intentionally as a copy
→ document-local drop affordance may appear
→ global overlay stays hidden
→ original workspace image remains
→ exactly one document insertion
```

Implementation requirements:

- Internal manipulation is application pointer state, not external/native ingestion.
- Prevent accidental native `dragstart` on internal images/media (`draggable=false`, prevent internal dragstart, or a robust ownership marker).
- Global drag-depth/overlay logic must explicitly ignore internal drags.
- PDF/DOCX must claim supported image drops before the global workspace router.
- Clear drag ownership/overlay state on drop, pointer release, dragleave, cancel, Escape, and failed handoff.
- Preserve real external file/URL drag-and-drop.

Hard acceptance test:

```text
Pick up an existing FrameChute image and drag it around the workspace for 10 seconds.
→ `Drop into FrameChute` never appears at any point.
```

Repeat with video, PDF/DOCX block movement, Select Mode, and document-image movement.

---

## 1. PDF / DOCX image insertion, move, resize, undo

### PDF

Drop an eligible image onto the current PDF page:

```text
insert at pointer
→ select immediately
→ drag image body to move
→ bottom-right handle resizes
→ preserve aspect ratio by default
→ store canonical PDF/page coordinates
→ survive rerender/zoom
→ Save/Save As embeds it
```

Existing workspace image → PDF must insert a copy while leaving the workspace original intact. No global overlay and no duplicate workspace object.

### DOCX

Inserted/supported existing images:

```text
click → select
body drag → move
bottom-right handle → resize
```

Persist size/position honestly in OOXML; no DOM-only movement that disappears on save.

### Undo/redo

For both PDF and DOCX:

```text
insert image → Ctrl/Cmd+Z removes that just-inserted document copy
redo → restores it
move → undo restores prior position
resize → undo restores prior size
delete → undo restores it
```

One completed gesture = one history entry, not one per pointermove.

---

## 2. PDF editing correctness

- Old/source PDF text must never reappear on hover after replacement; hover gives outline/hit affordance only.
- Replace the non-clickable `Select replacement text to edit.` presentation with an actually usable interaction: direct click/double-click or a real button/control.
- Multiline replacement fields: `Enter` = newline; `Ctrl/Cmd+Enter` = commit/finish. Width controls wrapping and height is a real multiline area.
- Add a bounded rectangular marquee inside PDF to select multiple movable replacement fields + inserted images; drag the group together; Ctrl/Cmd+Z restores the move.
- Original baked PDF text may become movable only through the existing replacement/mask model.

---

## 3. FCX persistence

Fix the current local-image restore gap.

```text
local image + local video
→ Export Workspace / Include Files
→ reopen without original OS handles
→ BOTH restore automatically
```

`Include Files` must package every required local asset, including all local/custom image marker families.

State Only: unavailable handle leaves a visible reconnect object/state. Never silently drop the image.

Persist current PDF/DOCX inserted-image state and geometry enough to reopen the visible document state.

---

## 4. Simple-mode right-click cleanup + image menu priority

In **Simple / non-Advanced mode**, these must not appear at all in the right-click menu:

```text
Create timed move
Edit timed move
Preview timed move
Return to move start
Remove timed move
Layer timing…
```

Do not merely disable them. Hide/omit them entirely. Advanced mode may keep them.

### Image right-click menu: `Show image only` and `Shrink to Fit` must be near the top

For image objects, keep these two actions in the **top group of normal image commands**, not buried near the bottom:

```text
Show image only
Shrink to Fit
```

Preferred top composition after any compact Quick Actions setting/header controls:

```text
Grab / Move Object
Close Object
Show image only
Shrink to Fit
```

Then follow with the rest of the image-specific commands such as resize/format/crop/edit/copy/open actions.

Requirements:

- `Show image only` enters the existing frameless-image state; if already frameless, use the corresponding restore wording.
- `Shrink to Fit` is display/workspace sizing only, preserves aspect ratio, shrinks only when needed, and never modifies source pixels.
- Neither command should be hidden behind Advanced mode.
- Their position should remain near the top in both full-width and narrow/context-menu layouts.
- Do not duplicate either action elsewhere in the same menu.

### Sync / independent exact rule

`Sync with…` and `Make independent` are context actions only for **actual playable audio/video objects in Advanced mode**.

Allowed examples: MP4/WebM video, MP3/WAV/OGG audio.

Never show them for image/GIF/screenshot, PDF, DOCX, text/note, canvas, CSV, archive, or other static/non-playable objects. Simple mode hides them for everything.

Use real playable-media capability (`<video>`, `<audio>`, canonical playable-media type), not filename text alone.

---

## 5. First-class Select Mode + bulk actions

Add a visible top-toolbar:

```text
Select Mode [OFF/ON]
```

Available in Simple mode too.

When ON:

- click selects instead of starting move/edit,
- Ctrl/Cmd-click toggles,
- Shift-click extends/toggles consistently,
- empty-workspace click clears,
- selection chrome is clear but quiet,
- menus/dialogs do not accidentally clear selection,
- deleting an object removes it from selection,
- selection gestures never show the global ingest overlay.

Support ordinary top-level images, video, audio, PDF, DOCX, notes/text, canvas/generated visuals. Workspace marquee is desirable if safe; click multi-select is mandatory.

When 2+ selected, show a compact bulk surface with count and only valid actions, including as applicable:

```text
Close Selected
Bring to Front
Send to Back
Export/ZIP Selected
Take Snapshot/FrameSnap Selection
Arrange into PDF…
```

### Arrange into PDF V1

```text
select eligible items
→ Arrange into PDF…
→ simple reorder/remove organizer
→ Make PDF
→ Save As
→ optional Add result to Workspace
```

Images = one page each. PDFs should copy/import original pages where practical rather than rasterizing. Do not silently convert DOCX/video/web.

---

## 6. Quick Actions — authoritative UX

Audit:

```text
src/actions/quick-actions.js
src/actions/quick-actions.css
src/actions/quick-actions-visibility.js
src/actions/object-menu-model.mjs
src/settings.js
src/layer-menu.js
```

### Remove `Clear`

Delete the `Clear` button from Quick Actions entirely.

Header:

```text
Quick Actions                                      ×
```

The `×` is top-right, labeled `Close Quick Actions`, and only hides the panel. It must not clear selection, delete anything, or alter settings.

### Global setting

Add Settings control:

```text
Quick Actions [ON/OFF]
```

Global OFF hides Quick Actions by default.

### Per-image override

Image right-click menu exposes:

```text
Quick Actions [ON/OFF]
```

This changes only that image.

Semantics:

```text
Global OFF + image ON → Quick Actions may show for that image only
Global OFF + image default/OFF → hidden
Global ON + image OFF → hidden for that image
Global ON + image default/ON → normal visibility
```

Persist global setting and per-image override through normal reload/workspace/FCX state where object state is already persisted.

---

## 7. Image utilities that currently appear to do nothing

These must visibly work immediately and be undoable:

```text
Trim transparency
Make color transparent
Fill background
Blur / pixelate
Annotate
Straighten
Perspective
```

Use one canonical non-destructive image state + live-preview renderer. Preview and Save/Export must use the same state. Perspective must warp pixels, blur/pixelate must affect the chosen region, and fill background must go behind transparent pixels.

Do not announce success until the visible image actually updates.

---

## 8. Screenshot black-frame bug

Fix `src/actions/capture-actions.js` so Screenshot waits for a real delivered frame, not just `video.play()` + two RAFs.

Use a reliable path such as `ImageCapture(track).grabFrame()`, `requestVideoFrameCallback()`, or an event-based fallback after metadata + nonzero dimensions.

Requirements:

- actual nonzero frame,
- exactly one PNG object,
- stop capture tracks promptly,
- cancellation creates no object,
- never create a black placeholder and claim success,
- Screenshot must not start recording.

Manual browser test against bright/obvious content.

---

## 9. Take Snapshot

Capture rectangle = union of the outermost visible edges of included workspace objects, not viewport.

```text
Tight Bounds → object union + padding
Square → same union, expand shorter side symmetrically, never distort
```

Add unchecked options:

```text
[ ] Create in Workspace
[ ] Open Location After
```

`Create in Workspace`: after successful save, reuse the exact rendered Blob to create exactly one normal FrameChute image. No rerender.

`Open Location After`: after successful save, use a real supported reveal route; in extension context `chrome.downloads` + `show(downloadId)` is acceptable with minimal permission. Never silently no-op.

Both checked:

```text
render once → save once → create one workspace image → reveal saved location
```

---

## 10. Expandable workspace

Dragging a top-level object against left/right/top/bottom should create more workspace rather than force it back into the viewport.

- grow only during intentional direct drag,
- left/top use origin + scroll compensation so artwork does not jump,
- passive scroll/resize/toolbar/rerender must not move artwork or create space,
- persist extents/origin through FCX,
- `Bring to Center` remains explicit recovery.

---

## 11. Top header must always look professional

At full width, ~50% desktop width, and narrow extension width:

- one compact intentional header strip,
- no multi-row pileup,
- no overlaps/collisions/crushed labels/random height growth,
- balanced spacing among brand, core actions, Select Mode, Workspace, Snapshot, status,
- low-priority text/status collapses before core actions,
- responsive icon-only/short labels may activate without overwriting saved toolbar-text preference,
- popup/dropdown panels float instead of increasing header height,
- horizontal scrolling of one command strip is preferable to ugly wrapping,
- consistent button heights/radii/padding/baselines,
- toolbar resizing never moves artwork.

The header should look designed, not merely squeezed.

---

## 12. Preserve current good behavior

Do not regress native Save/Save As, PDF source masking/page controls/export, DOCX relationship/drawing-ID hardening, Tight/Square snapshot behavior, real external ingestion, frameless media, object/workspace context-menu separation, FCX terminology, and spatial permanence.

---

## 13. Validation

Run:

```bash
node --test tests/*.test.mjs
node --check <every modified JS file>
git diff --check
bash scripts/package-web-store.sh
```

Manual smoke test minimum:

```text
1. Drag existing workspace image for 10 seconds → NEVER see `Drop into FrameChute`.
2. Move video/PDF/DOCX block → no global overlay.
3. Drop image into DOCX → Ctrl+Z removes; redo restores; move/resize works.
4. Drop image into PDF → move/resize; Ctrl+Z/redo works.
5. PDF replacement hover → old text never reappears.
6. PDF Enter → newline; Ctrl/Cmd+Enter commits.
7. FCX Include Files → local image + video both reopen.
8. Every reported image utility visibly changes the image.
9. Screenshot of bright content is not black.
10. Take Snapshot extra options work exactly once from one render.
11. Select Mode selects several objects without drag/edit or global overlay.
12. Simple right-click menu contains none of the timed-move items.
13. Image right-click menu has Show image only + Shrink to Fit near the top.
14. Advanced playable audio/video shows Sync/Independent; static objects do not.
15. Quick Actions has × and NO Clear button.
16. Global Quick Actions OFF + one image ON enables only that image.
17. Header looks clean at full, half, and narrow widths.
```

Priority if time is constrained:

```text
1. INTERNAL GRAB/MOVE OVERLAY BUG — P0
2. PDF/DOCX drop + undo + move/resize
3. PDF edit correctness
4. FCX image persistence
5. Simple menu cleanup + image menu priority + Quick Actions
6. screenshot + image utility fixes
7. responsive professional header
8. Select Mode
9. snapshot extras
10. expandable workspace / Arrange into PDF polish
```

Handoff must include completed, remaining, files changed, tests/results, manual browser results or untested items, risks/issues, exact next steps, branch, commit, and PR.