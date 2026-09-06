# Critical addendum: image utilities must visibly work, screenshots must not be black, and Take Snapshot needs two output options

Read this together with the current next-run prompts:

```text
agents/codex/prompts/document-image-drop-direct-manipulation-fcx-persistence-correctness.md
agents/codex/prompts/expandable-workspace-simple-mode-timed-move-and-snapshot-bounds-addendum.md
agents/codex/prompts/pdf-multiline-fields-and-marquee-selection-addendum.md
agents/codex/prompts/pdf-drop-overlay-edit-affordance-and-document-image-undo-critical-addendum.md
```

This is part of the **same next Codex run**. Treat it as a priority user-visible correctness pass.

The user currently reports:

```text
1. These image utilities appear to do nothing:
   - Trim transparency
   - Make color transparent
   - Fill background
   - Blur / pixelate
   - Annotate
   - Straighten
   - Perspective

2. Screenshot currently produces a black image.

3. Take Snapshot needs two additional opt-in checkboxes, using these user-facing labels:
   - Create in Workspace
   - Open Location After
```

FrameChute's rules here are:

> If I click an image operation, I should see what it did immediately.

> If FrameChute says it captured the screen, the result must contain the captured frame, not a black first-frame placeholder.

> Render the snapshot once, then let the user save it, create it in FrameChute, and reveal the saved file location without rerendering.

---

# 1. Fix the image utility hidden-state / no-visible-result architecture

Audit at minimum:

```text
src/actions/quick-actions.js
src/actions/image-operations.js
src/image-edit/paint-runtime.js
src/live-state.js
src/drop-local-sources.js
```

Current behavior stores many utility operations in the `transforms` WeakMap. `updateTransform(...)` visibly applies only CSS rotate/straighten/flip, while crop, transparent-color removal, background fill, blur/pixelate regions, annotations, and perspective are actually rasterized later by `imageElementToBlob(...)`.

That means FrameChute can announce an edit as applied while the visible workspace object has not changed.

Do not fix this with seven unrelated DOM tricks.

Create/refactor one canonical non-destructive image utility model and live-preview path:

```text
stable original/base image
        +
current utility state
        +
paint overlay where applicable
        ↓
render current preview
        ↓
visible FrameChute image
```

Requirements:

- Render from the stable base source plus canonical operation state, not recursively from the previous rasterized preview.
- Preview and Save As/Add Result must use the same operation state and visually agree.
- Avoid cumulative JPEG loss, repeated blur, repeated perspective warping, etc.
- Revoke replaced object URLs.
- Protect async preview rendering with a generation/version guard so stale renders cannot overwrite newer edits.
- Keep the original source recoverable.
- Do not announce success until the visible preview has actually updated.
- If rendering fails, leave the prior visible image intact and report the actual error.
- Do not keep important edits only in a WeakMap that disappears on reload.

Persist where applicable:

```text
crop / trim-alpha bounds
transparentColor + tolerance
background
regions[]
annotations[]
straighten
perspective
rotate
flipX / flipY
```

Workspace save/restore and FCX should reconstruct the same visible image edit state when the base source is available or embedded.

---

# 2. `Trim transparency` must visibly trim

Required:

```text
click Trim transparency
→ calculate true alpha bounds
→ visible image immediately loses transparent margins
```

Requirements:

- Preserve all nontransparent content.
- If no transparent margin exists, say so clearly rather than silently doing nothing.
- Fully transparent input may keep the existing explicit error.
- Keep workspace position stable; do not unexpectedly recenter/move the object.
- Update visible aspect/content bounds coherently.
- Save/export must match the preview.

---

# 3. `Make color transparent` must visibly remove the chosen color

Required:

```text
choose target color + tolerance
→ Apply
→ matching pixels visibly become transparent immediately
```

Requirements:

- Preserve alpha in preview/output.
- Workspace/background should show through removed pixels.
- Tolerance must actually affect matching.
- Do not silently flatten the result onto white.
- Save/export must preserve the same alpha.
- If a remote image taints canvas because of CORS, report a specific failure instead of claiming success.

A live dialog preview is desirable, but if timeboxed, Apply must at minimum update the actual image object visibly.

---

# 4. `Fill background` must visibly fill transparent pixels

Required:

```text
transparent image
→ Fill background
→ choose color
→ transparent areas immediately show that color behind the source image
```

Requirements:

- Fill behind the source, not over opaque pixels.
- Preview and output match.
- Validate the chosen color.
- If the image has no transparent pixels and therefore no visible change, report that honestly.

---

# 5. `Blur / pixelate` must visibly affect the chosen region

Required:

```text
Blur / pixelate
→ choose region
→ choose effect
→ Apply
→ selected region visibly changes immediately
```

Requirements:

- Correct coordinate conversion from displayed image to source pixels.
- Pixelate must be visibly pixelated.
- Blur must be visibly blurred.
- Affect only the chosen region.
- Preserve previously committed regions.
- Preview and output match.
- Avoid browser-dependent self-drawing from a canvas back onto itself; use a stable/offscreen source for the effect when needed.

The current simple confirm-based choice may remain for this correctness pass if necessary; the operation itself must work.

---

# 6. `Annotate` must add a real visible annotation

Required:

```text
Annotate
→ text / rectangle / arrow
→ annotation appears immediately on the image
```

Requirements:

- Text is visible/readable.
- Rectangle is visibly drawn.
- Arrow is visibly drawn.
- Annotation coordinates stay attached to the image when the workspace object moves.
- Save/export includes annotations.
- Preserve annotation records non-destructively until raster export where practical.
- Do not say annotations are editable unless editing them is actually supported.

Reuse the existing image-edit overlay substrate if that produces one coherent model rather than a second incompatible overlay system.

---

# 7. `Straighten` must visibly rotate by the requested fine angle

Required:

```text
Straighten
→ enter e.g. 7 degrees
→ image visibly rotates 7 degrees immediately
```

Requirements:

- Keep existing angle clamp unless intentionally changed.
- Must work on framed and frameless images.
- No other transform subsystem should overwrite the result.
- Final raster/export matches the visible angle.
- Rotate + straighten + flip compose deterministically.
- Preserve source pixels rather than clipping corners merely because the preview canvas is too small.

---

# 8. `Perspective` must visibly warp pixels

Required:

```text
Perspective
→ choose nonzero correction/inset
→ Apply
→ visible image immediately changes perspective
```

Requirements:

- Nonzero input produces an obvious visible difference.
- Warp image pixels, not merely the outer DOM rectangle.
- Preview and output match.
- Preserve transparency outside the warped pixels where appropriate.
- Avoid triangle seams where practical.
- Reject degenerate corner geometry.

The current one-number top-edge inset UI is acceptable as V1 if it actually works. A later run may add a four-handle editor.

---

# 9. Image utility undo/redo

These committed actions should participate in one coherent image history:

```text
Trim transparency     → Ctrl/Cmd+Z restores previous crop
Make color transparent→ Ctrl/Cmd+Z restores previous alpha operation
Fill background       → Ctrl/Cmd+Z restores previous background
Blur / pixelate       → Ctrl/Cmd+Z removes latest region
Annotate               → Ctrl/Cmd+Z removes latest annotation
Straighten             → Ctrl/Cmd+Z restores previous angle
Perspective            → Ctrl/Cmd+Z restores previous warp
```

Redo restores them.

One accepted operation = one history entry. Do not create a history entry for every slider preview tick.

Reconcile this with the existing paint/image-edit undo system rather than creating conflicting Ctrl+Z ownership.

---

# 10. Screenshot: black capture is a correctness blocker

Audit:

```text
src/actions/capture-actions.js
```

Current `captureScreenImage()` does roughly:

```text
getDisplayMedia()
→ assign stream to <video>
→ video.play()
→ wait two requestAnimationFrame callbacks
→ drawImage(video)
```

Two page animation frames are not a reliable guarantee that the display-capture video has delivered a real decoded frame. This can rasterize a black/empty first frame.

Fix the capture readiness contract.

Preferred robust flow:

```text
getDisplayMedia({ video: true })
→ obtain video track
→ wait until the capture source reports real dimensions/frame readiness
→ capture one actual delivered frame
→ encode PNG
→ add exactly one image object
→ stop all capture tracks promptly
```

Use one of these reliable strategies, in preference order where supported:

```text
A. ImageCapture(videoTrack).grabFrame()
B. requestVideoFrameCallback() on a video element after loadedmetadata/canplay and nonzero videoWidth/videoHeight
C. event-based fallback that waits for a real frame rather than arbitrary RAF count
```

Requirements:

- Do not use a fixed two-RAF delay as the sole readiness test.
- Wait for nonzero capture dimensions.
- If using video fallback, wait for an actual video frame callback/event before canvas draw.
- Keep the temporary video muted, playsInline, and non-draggable/non-visible.
- Stop all tracks on success, cancellation, timeout, and failure.
- If the user cancels picker/permission, produce no object.
- If capture fails, produce no black placeholder object and report the error.
- Screenshot adds exactly one PNG image object.
- Do not accidentally start screen recording when Screenshot is requested.

### Testing

Abstract the frame-readiness logic into testable helpers where possible. Unit tests should verify that capture does not proceed with zero dimensions and that the fallback waits for a real frame signal.

Manual browser smoke test is mandatory because getDisplayMedia cannot be fully validated in ordinary Node tests:

```text
1. Click Screenshot.
2. Choose a visible browser tab/window/screen with obvious bright content.
3. Result appears in FrameChute.
4. Result contains the actual chosen content, not a black rectangle.
5. Screen-sharing indicator ends promptly after the still capture.
6. Exactly one image object is created.
```

---

# 11. Take Snapshot: add exact opt-in options

The Take Snapshot dialog in `src/workspace.html` currently has Bounds, Format, Scale, Quality, transparency, and Filename.

Add two unchecked checkboxes using these labels:

```text
[ ] Create in Workspace
[ ] Open Location After
```

Use these labels consistently in Simple mode as well.

## `Create in Workspace`

If checked:

```text
render snapshot once
→ save snapshot normally
→ create one new FrameChute image object from that same rendered Blob
```

Requirements:

- Do NOT rerender the workspace for the duplicate.
- Reuse the exact Blob that was saved.
- The new object is a normal FrameChute image object and can be moved/resized/edited/saved like any other image.
- Name it from the chosen snapshot filename.
- Place it at a sensible visible point without moving existing artwork.
- Creating the result must not change the snapshot bounds used for the snapshot that was just rendered.
- Exactly one workspace copy is created.

If saving is cancelled, do not silently create an output unless the implementation intentionally documents that behavior. Preferred V1: treat the Save Snapshot operation as cancelled and create no workspace copy.

## `Open Location After`

If checked and save succeeds:

```text
save snapshot
→ reveal/open the containing folder/file location in the OS
```

This must be a real action, not a checkbox that silently does nothing.

### Extension-compatible implementation

The current native `showSaveFilePicker()` path returns a `FileSystemFileHandle`, but web File System Access does not provide a generic reveal-in-Explorer/Finder method.

Because FrameChute is a Chrome extension, a practical implementation is:

```text
Open Location After checked
→ save through chrome.downloads.download({ saveAs: true, ... }) so a download ID is available
→ after completion, call chrome.downloads.show(downloadId)
```

Add the minimal `downloads` permission to `manifest.json` only if this implementation is used.

Keep the existing native save path for ordinary saves when Open Location After is not selected unless there is a cleaner common abstraction.

Requirements:

- Do not claim the location was opened if the browser/platform does not support it.
- Wait until the download/save has actually started/completed sufficiently for `show()` to work.
- Revoke temporary Blob URLs after safe delay/completion.
- Cancellation creates no duplicate and opens no location.
- If downloads API is unavailable in a non-extension/dev context, disable or clearly report that `Open Location After` is unavailable rather than silently ignoring it.

If both checkboxes are checked:

```text
render once
→ save
→ create one workspace image from same Blob
→ reveal saved file location
```

No second render.

---

# 12. Preserve snapshot bounds semantics

Do not regress the separate next-run snapshot-bounds requirement:

```text
Take Snapshot capture rectangle
→ union of the farthest visible edges of included workspace objects
→ plus configured padding
→ viewport does not define the capture rectangle
```

Square mode still begins from the same object-union bounds and symmetrically expands only the shorter dimension. Never stretch/distort objects to make a square.

The new `Create in Workspace` output must not get included retroactively in the snapshot being created.

---

# 13. Acceptance tests

Add automated/static coverage for wiring and operation-state logic where possible.

Minimum checks:

```text
1. Utility action state triggers a visible preview render path.
2. Trim-alpha state changes preview crop.
3. Transparent-color state affects rendered alpha.
4. Background fill is rendered behind source pixels.
5. Blur/pixelate region state is rasterized in preview.
6. Annotation state is rasterized in preview.
7. Straighten composes with rotate/flip.
8. Perspective nonzero state changes output pixels/geometry.
9. Utility undo/redo restores operation state.
10. Screenshot helper refuses zero-dimension capture and waits for a delivered frame signal.
11. Snapshot dialog contains unchecked `Create in Workspace` and `Open Location After` controls.
12. `Create in Workspace` reuses the saved/rendered Blob and creates exactly one image object.
13. `Open Location After` has a real supported reveal path, not a no-op.
14. Both options together still render only once.
15. Existing Tight Bounds / Square snapshot tests remain green.
```

Manual smoke test:

```text
A. Run each reported image utility and verify the actual image visibly changes.
B. Undo each utility once and verify the image returns.
C. Screenshot a bright window/tab and verify non-black captured content.
D. Take Snapshot with neither extra option checked: normal save only.
E. Take Snapshot with Create in Workspace: saved file + exactly one new image object.
F. Take Snapshot with Open Location After: saved file + OS location revealed.
G. Take Snapshot with both: one render, one saved file, one new workspace image, location revealed.
```

---

# 14. Preserve current good behavior

Do not regress:

- PDF/DOCX direct-manipulation requirements from the other prompts,
- document-image Ctrl/Cmd+Z,
- internal drag overlay correction,
- PDF image drop ownership,
- PDF multiline/marquee work,
- FCX local-image persistence,
- expandable workspace edge growth,
- Simple-mode timed-move hiding,
- snapshot Tight Bounds / Square behavior,
- snapshot format/scale/quality/transparency/filename,
- native Save/Save As,
- real external file/URL ingestion,
- spatial permanence.

---

# 15. Validation / timebox / handoff

Run at minimum:

```bash
node --test tests/*.test.mjs
node --check <every modified JS file>
git diff --check
bash scripts/package-web-store.sh
```

If browser automation exists, use it for the image utility preview and snapshot-option wiring. `getDisplayMedia` still requires a manual browser smoke test if automation cannot grant/select a capture surface reliably.

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

Fix user-visible no-op/black-output behavior before optional polish.