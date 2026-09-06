# ADDENDUM — responsive toolbar, Simple image menu, bulk image dialogs, frameless fit

Read this with the current FrameChute utility/image-editing prompts. This is a UI correctness and product-simplicity pass, not a new subsystem.

## 1. Narrow-window / half-screen toolbar must remain compact

Current problem: when the browser window is reduced to roughly half-screen width, the sticky top toolbar wraps aggressively and can consume a large portion of the viewport. The workspace then feels visually broken.

Required behavior:

- The top toolbar must remain a compact strip at narrow widths.
- Do not allow toolbar controls to wrap into many stacked rows.
- Prefer progressive compaction in this order:
  1. temporarily hide plain-language toolbar labels while narrow, without overwriting the user's saved Show Toolbar Text preference;
  2. collapse low-priority/status content before core commands;
  3. allow one horizontally scrollable command row if needed;
  4. keep popup/dropdown panels floating outside the toolbar rather than increasing toolbar height.
- The toolbar should remain approximately one normal row of controls, not grow to occupy most of the screen.
- Re-expanding the window restores the user's preferred label mode automatically.
- Responsive toolbar layout must never move workspace objects or rewrite artwork coordinates.
- Verify at full width, about half desktop width, and a narrow extension window.

Product rule:

> Narrowing the viewport may compact the controls. It must not turn the header into the workspace.

## 2. Simple / non-Advanced right-click menu: no timing UI

Simple mode is for direct everyday file actions. Timing/animation controls must not appear there.

In non-Advanced mode, hide/remove all right-click entries related to:

- Create/Edit timed move
- Preview timed move
- Return to move start
- Remove timed move
- Layer timing…
- any other animation/timing scheduling entry

Do not merely disable them. They should not be present in the Simple menu.

Advanced mode may retain timing features.

Important architecture note: `src/layer-menu.js` currently constructs timing commands for ordinary blocks and `workspace-extras.js` imports timing/layer systems outside Advanced mode. Do not remove the underlying capability; gate what is exposed based on mode.

## 3. Images must never show sync/media-link wording

Image objects are not timed-media link targets.

For an image object, do not show:

- Sync with…
- Make independent
- media sync/link language
- audio/video synchronization wording

This applies even if another generic menu system would otherwise contribute those actions.

Image resize/crop/format dialogs must contain no sync-related copy.

## 4. Simple image right-click menu: exact top action order

For an image object in non-Advanced mode, the first actions in the right-click menu must be, in this order:

1. **Img Ext Change…**
2. **Img Size Change…**
3. **Crop…**
4. **Grab / Move Object**
5. **Close Object**
6. **Shrink to Fit**
7. **Copy Image**

`Close Object` is intentionally near the top. Do not bury it at the bottom of a long utility/timing menu.

After these top actions, other image-specific utilities may follow, but timing/sync items must remain absent in Simple mode.

### Meaning of the commands

**Img Ext Change…**
- Real image format conversion, not a filename-only rename.
- Offer formats already safely supported by the existing encoder, at minimum PNG / JPEG / WebP.
- Preserve the source object unless the user explicitly chooses replacement.
- Reuse the existing transformed-image / Save As result pipeline.

**Img Size Change…**
- Reuse the existing Resize Image workflow/engine.
- Pixel-dimension editing/export, distinct from display-only `Shrink to Fit`.

**Crop…**
- Reuse the existing crop workflow/engine.

**Grab / Move Object**
- Use the existing direct manipulation / menu-grab path.

**Close Object**
- Remove the workspace object only; never delete the source file.

**Shrink to Fit**
- Must be a visible right-click menu action for images.
- Display/workspace sizing only.
- Preserve aspect ratio.
- Shrink only when necessary; do not enlarge an already fitting object.
- Reuse the existing fitted-image sizing math.

**Copy Image**
- Copy the visible/current image result to the system clipboard as an image, using `navigator.clipboard.write()` / `ClipboardItem` when available.
- The copied bitmap should reflect current visible FrameChute edits/transforms that can safely render (crop, paint, rotation, flip, background, etc.), not merely the untouched source bytes.
- If the browser denies clipboard image writes, give a clear status message rather than silently failing.

## 5. Resize / Crop / Ext Change dialogs must offer bulk scope

The small utility window that opens for image resizing, cropping, and extension/format conversion must explicitly offer scope when multiple image objects are selected.

Use a simple control such as:

`Apply to: This image / Selected images`

Requirements:

- Default conservatively to `This image` unless the user deliberately chooses the selected-image bulk scope.
- For **Img Size Change**, apply the chosen dimensions/fit rule to selected images using the existing batch/resize engine and bounded-memory processing.
- For **Img Ext Change**, convert each selected image to the chosen output format with safe deterministic naming and no source overwrite by default.
- For **Crop**, allow the same normalized crop rectangle to be applied across selected images; make clear that the crop is proportional when source dimensions differ.
- Show a concise preview/summary of how many images will be affected before destructive-looking output actions.
- Keep Save As / Add to Workspace/result routing explicit.
- No sync/media/timing wording belongs anywhere in these image dialogs.

If only one image is selected, the dialog may simply show `This image` and keep bulk scope unavailable until a multi-image selection exists.

## 6. Removing the frame from image/video must immediately repair bounds and shrink to fit

Current problem: switching an image or video to frameless/media-only can leave stale block dimensions. That creates an oversized blue selection rectangle and moves the menu icon away from the actual visible media.

Required behavior when the user chooses `Show image only` / `Show video only` / otherwise removes the object frame:

1. switch to frameless state;
2. recompute the block's visible bounds from the actual media geometry after the frame/header/footer disappears;
3. immediately run the equivalent of **Shrink to Fit** for that same object, without asking;
4. preserve aspect ratio;
5. preserve the object's workspace anchor/position as closely as possible rather than teleporting it;
6. update selection chrome, resize hit targets, and menu-button anchoring from the new visible geometry.

This automatic post-frameless `Shrink to Fit` applies to both images and videos.

Do not resize the underlying source pixels merely to repair display bounds.

Product rule:

> Remove the frame → the object becomes the media itself → its bounds immediately match what the user can see.

Acceptance checks:

- image with large framed shell → Show image only → shell disappears → blue outline hugs image → object fits workspace if oversized → menu icon stays on the visible image;
- video with controls/header/footer → Show video only → stale frame space disappears → video remains reachable and correctly sized;
- restoring the frame can restore the framed presentation without corrupting source media or workspace state.

## 7. Renaming must never break the restored object header

Current bug/edge case: after renaming an object, switching it to frameless/media-only and later restoring its frame can cause the returned top object header controls to collide or overlap each other.

The object name is user content. A long or newly changed name must never be allowed to push the Grab control, menu button, maximize/close controls, source badge, or other fixed header controls into each other.

Required behavior:

- Renaming an object must not change the structural geometry contract of the object's header.
- The name field gets the flexible/truncatable space; fixed controls keep reserved non-shrinking space.
- Use `min-width: 0`, overflow clipping/ellipsis, sensible flex/grid constraints, and explicit non-shrinking action groups as appropriate rather than relying on accidental available width.
- Preserve access to the complete name via the editable field/title/tooltip as appropriate; visual truncation must not mutate the actual name.
- Restoring a frame after `Show image only` / `Show video only` must recompute header layout against the current object width and current name.
- If the restored framed shell is too narrow to fit its minimum header controls, enlarge only the frame width to the minimum safe header width; do not move the object merely to solve the collision.
- The compact Grab affordance / object-menu control must not sit on top of the name field or close/maximize buttons.
- Close Object and the menu affordance must remain reachable at narrow object widths.
- The same rules apply after FCX restore and after browser/window resizing.

Acceptance checks:

1. Rename an image to a very long name → Show image only → restore image frame → header controls remain separated and usable; name truncates instead of colliding.
2. Rename a video to a very long name → Show video only → restore frame → Grab/menu/close/player controls remain usable.
3. Restore the same object from FCX at a narrower browser width → no header control collision and artwork position remains unchanged.

Product rule:

> Names may be arbitrarily long. Controls may never collide because of the name.

## 8. Large image resizes must still show a preview

Current problem: large requested output dimensions can cause the resize dialog to stop showing the preview or effectively cap preview generation.

Required behavior:

- **Img Size Change… must always provide a visual preview, including when the requested output is very large.**
- Do not replace the preview with a generic `too large`, `preview unavailable`, or arbitrary size-cap state merely because the target dimensions exceed a convenient canvas/display threshold.
- The preview does not need to allocate a full-size target bitmap merely to show the user the result.
- For very large output dimensions, generate a bounded-memory proxy preview that preserves:
  - final aspect ratio;
  - crop/rotation/flip/paint/background/transparency semantics;
  - the intended resize geometry;
  - enough visual fidelity for the user to judge the result.
- Clearly display the **real requested output dimensions** separately from the preview's internal proxy dimensions.
- The actual export must still use the full requested dimensions subject only to real browser/encoder limits. Do not silently clamp the requested output to the preview size.
- If the requested export exceeds an actual browser/encoder hard limit, say so clearly and distinguish that from preview generation.
- Preview updates should remain responsive while typing dimensions; debounce/cancel stale preview work and avoid runaway memory use.

Example:

`12000 × 8000 requested → scaled visual proxy preview shown → label still says 12000 × 8000 output → export attempts the real 12000 × 8000 result.`

Product rule:

> Large output may use a smaller preview surface. It must never mean no preview.

## 9. First-class Select Mode for multi-object media work

FrameChute needs an explicit **Select Mode** so users can select a group of image/media objects and then act on the group.

The first version should support at minimum:

- images;
- videos;
- audio objects;
- other already-supported media objects where selection is safe.

Do not make this an image-only selection hack. Build it on the existing selection model so the same selection set can later power mixed-object document composition and group operations.

### Entering / leaving Select Mode

Expose a clear persistent control such as:

`Select Mode  [ ON / OFF ]`

When Select Mode is ON:

- ordinary click toggles object selection instead of starting a move/edit gesture;
- Shift/Ctrl/Cmd-click may extend/toggle selection consistently;
- selected objects get clear but unobtrusive selection chrome;
- clicking empty workspace may clear selection unless a modifier is held;
- dragging empty workspace may provide a marquee/lasso rectangle if practical for this pass;
- direct object move/resize/edit gestures should not accidentally fire just because the user is trying to select objects.

When Select Mode is OFF:

- return to normal FrameChute direct manipulation behavior;
- existing selected objects may remain selected only if that is useful and non-confusing, otherwise clear them explicitly and consistently;
- do not destroy or flatten object state.

### Selection semantics

- A selection can contain multiple media types at once, for example image + video + audio.
- Right-clicking any member of an existing multi-selection should act on the selection set where the invoked command supports multiple items.
- Commands that only support a single object should say so clearly or operate on the specifically invoked object; do not silently discard the rest of the selection.
- Quick Actions should display the selected count and only show actions valid for the current selection.
- Bulk image dialogs from this addendum should use this same selection set for `Selected images` scope.
- Selection must survive harmless UI events such as opening a context menu/dialog; it should not evaporate merely because a popup opened.
- Closing/deleting an object removes it from the selection model immediately.
- FCX does not need to persist transient selection UI unless there is already a clean state slot for it; object state itself must remain unchanged.

### Foundation for later features

Implement Select Mode with an architecture that can later support:

- Arrange into PDF;
- contact sheet / stitch;
- Resize All / Convert All;
- ZIP selected;
- Group/Ungroup;
- align/distribute;
- multi-object FrameSnap.

Do not implement all of those in this pass. The requirement here is the reusable multi-object selection foundation.

Product rule:

> Select the things first. Then decide what to do with the set.

## 10. Preserve the Simple/Advanced distinction

Simple mode should emphasize direct file/object tasks. Advanced mode can expose timing, layered animation and deeper controls.

Do not solve this pass by duplicating separate menu implementations if one menu can be conditionally composed from object type + mode.

Keep existing persistence, FCX behavior, native Save/Save As semantics, Manifest V3, and Chrome Web Store compatibility.
