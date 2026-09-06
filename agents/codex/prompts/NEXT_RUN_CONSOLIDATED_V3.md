# NEXT RUN — FrameChute consolidated correctness + image-editing UX pass (V3)

This is the **single authoritative prompt for the next Codex run**. Work from current `main`. Do not read older prompt files unless this one leaves a concrete implementation detail genuinely ambiguous. Where older prompts conflict, this file wins.

Use up to 30 minutes. Prioritize visible correctness and direct manipulation. At the 30-minute mark, **conclude active implementation and provide a handoff**.

Core rules:

> Internal manipulation must never look like external ingestion.
>
> The viewport moves. The artwork does not.
>
> If I just put it there, Ctrl/Cmd+Z should take it back out.
>
> If a user can point at the thing they mean, do not force them to type a code for it.
>
> A small set of dependable editing primitives is better than a large set of fake/no-op controls.

---

## P0 — internal grabs must NEVER show `Drop into FrameChute`

This remains the highest-priority correctness invariant.

Existing FrameChute object movement, resizing, selection, PDF/DOCX inner-image manipulation, menu-grab movement, and Select Mode gestures must never show the global `Drop into FrameChute` overlay, even briefly.

Only a real external OS/browser file or URL drag may activate the global ingest overlay.

Keep a strict internal-vs-external drag ownership boundary. Suppress accidental native `dragstart` for in-workspace media. Document-local image-drop affordances are allowed when intentionally copying a workspace image into PDF/DOCX, but the global overlay stays hidden.

Hard test: drag an existing image around the workspace for 10 seconds. `Drop into FrameChute` must never appear.

---

## 1. PDF / DOCX direct image manipulation + undo

PDF image drop:

```text
Drop/copy image onto PDF
→ insert exactly once at pointer
→ select immediately
→ body drag moves it
→ bottom-right handle resizes it
→ preserve aspect ratio by default
→ Save/Save As embeds it
```

DOCX inserted/supported images should also be directly selectable, movable, and resizable while persisting honestly to OOXML.

For both PDF and DOCX:

```text
insert → Ctrl/Cmd+Z removes just-inserted copy
redo → restores
move → undo restores old position
resize → undo restores old size
delete → undo restores
```

One completed gesture = one history entry.

PDF replacement text must never resurrect hidden source text on hover. Enter inserts a newline; Ctrl/Cmd+Enter commits. Keep replacement fields genuinely editable and resizable.

---

## 2. FCX persistence

`Export Workspace → Include Files` must preserve both local images and local video without requiring the original OS file handle on reopen.

State Only must keep unavailable objects visibly present with a reconnect state rather than silently dropping them.

Persist document-inserted image state and geometry where needed to restore the visible workspace/document state.

---

## 3. Image editing must feel direct: Bucket, Eyedropper, visual color chooser, brush-size slider

Audit at minimum:

```text
src/image-edit/paint-runtime.js
src/image-edit/paint-layer.mjs
src/actions/quick-actions.js
src/actions/image-operations.js
related image-edit CSS
```

The current paint runtime already has Brush / Bucket / Erase, an HTML color input, and a brush-size range. **Preserve those working primitives and make them obvious instead of losing or hiding them.**

### Editing toolbar minimum

The active Image Editing surface should expose a compact, readable toolbar containing at least:

```text
Brush
Bucket
Eraser
Eyedropper
Color swatch / visual color picker
Brush Size slider
Undo
Done
```

### Brush size

The brush must have a visible slider, not a buried setting.

Recommended behavior:

```text
Size  [----●------] 18 px
```

- live numeric value in px,
- updates brush/eraser diameter immediately,
- practical range such as 1–150 px,
- changing size does not create an undo step by itself,
- one completed brush stroke = one undo step.

### Eyedropper

Add a real eyedropper tool.

```text
click Eyedropper
→ click a pixel on the edited image/composited visible image
→ sampled color becomes current paint/fill color
→ current color swatch updates immediately
```

Sample in intrinsic image coordinates so it remains correct under resize/rotation/transform.

Prefer the local image/canvas sampling path because it works inside FrameChute without requiring the browser EyeDropper API. The browser EyeDropper API may be an optional enhancement, not a dependency.

### Visual color chooser / gradient selector

Do not make users type a hex code for ordinary paint/fill work.

Clicking the current color swatch should open a compact floating color chooser with:

```text
2D saturation/value gradient field
hue strip/slider
current + previous color swatches
optional hex/RGB field for precision
Eyedropper button
```

Mouse/pointer movement should choose color visually. Typing a code remains optional precision input, not the primary workflow.

This chooser floats above the workspace like Settings/media controls and must not change object coordinates or workspace zoom.

### Bucket

Bucket must remain present and visibly functional.

```text
Bucket → choose/pick color → click region → contiguous fill
```

Use a clear tolerance rule. If a tolerance control already exists or can be added compactly, expose it as a small slider rather than a prompt.

Bucket fill should be one undoable action.

---

## 4. `Make color transparent` becomes a point-and-click workflow

The user should not need to manually enter a color code.

Preferred interaction:

```text
Make color transparent
→ tool enters Pick Color mode
→ cursor/eyedropper indicates sampling
→ click pixel directly on image
→ FrameChute samples that image color
→ immediately preview/highlight pixels/regions that would become transparent
→ small Apply / Cancel popover appears
→ user adjusts Tolerance if needed
→ Apply commits one undoable edit
```

### Suggested transparency preview

After the color is sampled, visually suggest the affected areas before applying.

Acceptable preview:

- matching pixels become a temporary checkerboard/transparent preview, OR
- matching pixels receive a temporary obvious tint/outline while the rest stays unchanged.

The preview must use the same color-distance/tolerance calculation that Apply will use, so the preview is trustworthy.

Expose a compact tolerance slider, e.g.:

```text
Tolerance [---●------] 30
```

Useful V1 behavior:

```text
All similar pixels within tolerance
```

If adding connected-region behavior is straightforward, allow:

```text
[ All matching ]   [ Connected area only ]
```

but do not delay the reliable all-matching preview/apply workflow for it.

The Apply/Cancel confirmation should be a small floating popover near the image/tool, **not** a giant modal.

Cancel restores the untouched image. Apply creates exactly one image-history step. Undo restores opacity; redo reapplies transparency.

Do not announce success until the visible image actually changes.

---

## 5. Other image utilities must visibly work immediately

These currently reported actions must produce a real live result, not hidden state that appears only at export:

```text
Trim transparency
Make color transparent
Fill background
Blur / pixelate
Annotate
Straighten
Perspective
```

Use one canonical non-destructive image edit state and one live-preview path shared by Save/Export.

- Fill background fills **behind transparent pixels**.
- Blur/pixelate affects the selected region.
- Perspective actually warps pixels.
- Straighten visibly rotates without silently clipping content.
- Annotation appears immediately.
- Trim transparency visibly changes bounds without unexpectedly moving the object in world space.
- every committed edit participates in Ctrl/Cmd+Z / redo.

Do not recursively rasterize the latest preview as the new source; keep a stable base/source plus edit state to avoid cumulative quality loss.

---

## 6. Right-click menu: reduce clutter with hover/click submenus

The object context menu currently has many similar `Open…`, `Show…`, `Hide…`, and visibility commands. Group related secondary commands under compact submenus instead of producing one long flat list.

Important: keep the most-used image commands near the top as previously requested.

For images, the top level should still prominently include:

```text
Grab / Move Object
Close Object
Show image only / Restore image frame
Shrink to Fit
Quick Actions [ON/OFF] where applicable
```

Do **not** bury `Show image only` or `Shrink to Fit` inside a submenu.

Then group secondary actions, for example:

```text
Open ›
  Open File…
  Open in New Tab          (when supported)
  Open File Location       (when supported)

View ›
  Hide/Show object header
  Hide/Show object footer
  Show top bar
  Show Settings
  Show media player        (media only)
  Make menus visible

Arrange ›
  Bring to Front
  Send to Back
  Bring to Center
  Minimize / Expand / Restore where appropriate
```

Exact grouping can adapt to existing commands, but the rule is: **similar secondary commands should be nested; primary direct object actions stay visible.**

Submenus must work by hover **and** click/focus for accessibility, support keyboard arrows/Escape, stay inside viewport bounds, and not accidentally close when moving pointer into the child menu.

### Simple mode cleanup

In Simple / non-Advanced mode these must remain absent, not disabled:

```text
Create/Edit timed move
Preview timed move
Return to move start
Remove timed move
Layer timing…
```

### Sync exact rule

`Sync with…` and `Make independent` appear only for actual playable audio/video objects in Advanced mode. Never for images, PDF, DOCX, text, canvas, CSV, archives, screenshots, or other static files.

---

## 7. Quick Actions UX

Quick Actions must have **no Clear button**.

Header:

```text
Quick Actions                                      ×
```

`×` only hides the panel. It must not clear selection, delete the object, or alter preferences.

Settings has a global Quick Actions ON/OFF control. An individual image may override it from that image's right-click menu.

Quick Actions should ultimately behave as floating application chrome rather than a tall viewport-fixed sidebar: sensible max-height, internal scroll when necessary, draggable/repositionable if the existing floating-panel substrate permits, and independent of future workspace zoom.

---

## 8. Screenshot black-frame bug

Screenshot must wait for a real delivered capture frame, not only `video.play()` plus two RAFs.

Use `ImageCapture(track).grabFrame()`, `requestVideoFrameCallback()`, or a reliable event-based fallback after metadata/nonzero dimensions.

Exactly one PNG result on success; stop tracks on success/failure/cancel; cancellation produces no object; never claim success with a black placeholder.

---

## 9. Take Snapshot / spatial workspace

Take Snapshot uses the union of outermost visible workspace-object edges, not the viewport.

```text
Tight Bounds → object union + padding
Square → same union, expand shorter dimension symmetrically
```

Add unchecked:

```text
[ ] Create in Workspace
[ ] Open Location After
```

Render once; if Create in Workspace is checked, reuse the exact same Blob. Open Location After must use a real reveal route or report that it cannot.

Dragging top-level objects against any workspace edge should create more workspace instead of clamping them back into the current viewport. Passive resize/scroll/header changes must never move artwork.

---

## 10. Select Mode + responsive header

Top toolbar includes `Select Mode [OFF/ON]` in Simple mode too. Multi-select ordinary top-level objects without triggering drag/edit. 2+ selected objects expose a compact valid bulk-action surface; Arrange into PDF is a useful V1 if safe.

The top header must remain one professional, intentional strip at full desktop width, about half desktop width, and narrow extension width. No ugly wrapping, overlap, crushed labels, or random vertical growth. Low-priority text collapses before core actions. Header changes must never move artwork.

---

## 11. Validation

Run at minimum:

```bash
node --test tests/*.test.mjs
node --check <every modified JS file>
git diff --check
bash scripts/package-web-store.sh
```

Manual browser checks:

```text
1. Drag existing workspace object → never see global Drop into FrameChute.
2. Image Editing visibly contains Brush, Bucket, Eraser, Eyedropper, Color, Size, Undo, Done.
3. Brush Size slider changes stroke width immediately.
4. Eyedropper click samples exact visible image color and updates swatch.
5. Color swatch opens visual gradient/hue picker; hex typing is optional.
6. Bucket fills a region with the chosen/picked color and Undo reverses it.
7. Make color transparent → click image color → matching areas preview → tolerance adjusts preview → Apply commits → Undo restores.
8. Cancel transparency preview leaves image unchanged.
9. Other reported image utilities visibly update the image before export.
10. Image context menu keeps Show image only + Shrink to Fit near top.
11. Open/View/Arrange secondary commands are grouped into usable submenus.
12. Simple menu contains no timed-move items.
13. Sync/Independent appears only on playable audio/video in Advanced.
14. Quick Actions has × and no Clear.
15. Screenshot of bright content is not black.
16. Header remains clean at full / half / narrow widths.
```

Priority if time is constrained:

```text
1. internal-drag overlay invariant
2. point-and-click transparency workflow
3. Eyedropper + visible Bucket + visual color chooser + Brush Size slider
4. image utilities live-preview correctness
5. context-menu grouping without burying primary image actions
6. PDF/DOCX image direct manipulation + undo
7. FCX image persistence
8. Quick Actions polish
9. screenshot + header + snapshot/spatial/select-mode remainder
```

Handoff must include: completed, remaining, files changed, tests/results, manual browser results or untested items, risks/issues, exact next steps, branch, commit, and PR.