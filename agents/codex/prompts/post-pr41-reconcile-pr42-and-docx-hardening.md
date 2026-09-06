# POST-PR41 — reconcile PR #42 UX with latest main + harden DOCX images

Work from the latest `main`. PR #41 has now been merged into `main` and is the baseline that must be preserved. PR #42 is now based on an older `main` and is not mergeable as-is, so do **not** blindly merge or overwrite overlapping files from PR #42. Re-apply/reconcile the intended PR #42 Simple-mode UX onto the latest `main` while preserving the merged PR #41 DOCX/image-editing work.

## Product rules

- The viewport moves over the workspace. Workspace objects do not move merely to stay visible.
- Simple mode is for direct file/object tasks, not timing/animation plumbing.
- Editing is a mode, not a one-way transition.
- Select the thing(s) first, then do the obvious thing.
- Source files remain unchanged unless the user explicitly chooses a destructive replacement path.

## 1. Preserve PR #41 image-editing behavior while reconciling PR #42 menus

PR #41 added explicit per-image Image Editing ON/OFF state. Keep it.

Required final behavior:

- Quick Actions exposes `Image Editing [ ON / OFF ]` for a single selected image.
- OFF exits paint/edit interaction mode immediately but preserves edits.
- Normal select/move/resize/right-click behavior returns immediately.
- Re-entering editing restores the existing overlay/edit state with no duplicate toolbar/listeners.
- Object menu label is dynamic: `Edit Image` when OFF, `Finish Editing` when ON.
- The PR #42 Simple image menu ordering and per-object Quick Actions override must coexist with this dynamic edit state. Do not regress one while implementing the other.

## 2. Final Simple image context menu order

In non-Advanced mode, the image menu must begin with the following direct actions in this order:

1. `Img Ext Change…`
2. `Img Size Change…`
3. `Crop…`
4. `Grab / Move Object`
5. `Close Object`
6. `Shrink to Fit`
7. `Copy Image`
8. `Open Image in New Tab`
9. `Open File Location`

Keep the persistent workspace/global Quick Actions switch near the top and the per-object override clearly available without burying the direct image actions.

Global setting:

`Quick Actions [ ON / OFF ]`

Per-object setting:

`Quick Actions for This Object [ GLOBAL / ON / OFF ]`

Semantics:

- GLOBAL follows the workspace-wide setting.
- ON forces Quick Actions visible for this object even when global is OFF.
- OFF forces Quick Actions hidden for this object even when global is ON.
- Per-object overrides survive selection changes, reload/restore, and FCX capture/restore.
- Preserve compatibility with legacy `quickActionsHidden` payloads.

Simple image menus must contain no timing/sync/media-link wording.

## 3. Fix the actual Simple/Classic narrow-window toolbar

The real Simple/Classic toolbar is the target, not only `.toolbar-primary` used by Advanced mode.

At roughly half-screen desktop width and narrow extension widths:

- keep the top header approximately one compact row;
- do not allow it to wrap into a large multi-row block that consumes the viewport;
- hide/collapse low-priority text first;
- compact buttons before allowing layout failure;
- a single horizontal-scroll command row is acceptable;
- popup panels must float rather than increase toolbar height;
- re-expanding restores the user's preferred label mode;
- toolbar compaction must never move workspace artwork or rewrite object coordinates.

Test the actual Simple/Classic DOM (`.classic-toolbar-primary` / `.classic-toolbar-actions`) as well as Advanced mode.

## 4. Select Mode must be visible and useful in Simple mode

The first Select Mode pass must be mounted on a toolbar/control surface that is actually visible in Simple/Classic mode.

Expose:

`Select Mode [ ON / OFF ]`

When ON:

- click toggles compatible object selection rather than starting move/edit gestures;
- support images, video, audio, and other safe media objects;
- Ctrl/Cmd/Shift-click extends/toggles consistently;
- selected objects have clear selection chrome;
- opening a context menu/dialog does not accidentally clear the selection;
- right-clicking a selected member acts on the existing selection where the command supports it;
- direct move/resize/edit gestures should not fire just because the user is selecting.

Use the existing selection model. Do not create a parallel image-only selection system.

## 5. Bulk image utility scope, including Crop

Resize, format conversion, and Crop dialogs must share the same selected-image scope model:

`Apply to: This image / Selected images`

Requirements:

- single-image default remains conservative;
- `Img Size Change…` supports all selected images;
- `Img Ext Change…` supports all selected images;
- `Crop…` must also support all selected images;
- bulk Crop applies the same normalized/proportional crop rectangle to each source when dimensions differ;
- show the number of affected images before execution;
- preserve originals and existing result-routing behavior.

Large requested resize dimensions must **always** retain a visual preview. Use a bounded-memory proxy preview while clearly displaying the real requested output dimensions. Never silently clamp export dimensions to preview dimensions.

## 6. Frameless image/video bounds repair + automatic Shrink to Fit

When `Show image only`, `Show video only`, or equivalent frame removal is used:

1. enter frameless/media-only state;
2. recompute the object's visible geometry after header/footer/frame removal;
3. discard stale framed-shell dimensions for selection/menu anchoring;
4. immediately run the equivalent of `Shrink to Fit` for that same object without asking;
5. preserve aspect ratio;
6. preserve the workspace anchor/position as closely as possible;
7. update blue selection chrome, resize hit zones, and object-menu icon from the new visible media geometry.

Do not alter the source pixels. Do not move the object merely because the viewport changed.

Acceptance: after frame removal there must not be a giant stale blue box or a menu button floating away from the visible image/video.

## 7. Long renamed objects must never make restored header controls collide

- The name field is the flexible/truncating region.
- Fixed controls reserve non-shrinking space.
- Long names use ellipsis/overflow rules without mutating the true name.
- Restoring a frame recomputes the header layout using the current name and object width.
- If the framed shell is narrower than the minimum usable header width, expand only the frame width to the minimum safe width.
- Do not relocate the object to solve a header collision.
- Verify after FCX restore and browser resizing.

## 8. Open File Location must use real provenance when available

For objects opened from an explicitly authorized folder/source location:

- use existing folder/source provenance to navigate/reveal/select the containing location when the browser/platform APIs make that possible;
- if the exact OS-native reveal action is unavailable, open FrameChute's authorized-folder view at the containing folder and highlight/select the file where practical;
- if the object came from a bare dropped `File` with no parent-folder provenance, say so honestly and offer reconnect/authorize-folder behavior;
- do not fabricate local paths.

## 9. Harden merged PR #41 DOCX image insertion

The merged implementation needs correctness hardening before we call DOCX image insertion reliable.

### Relationship IDs must be globally unique

Current risk: image media filenames are chosen per extension and the same number is reused to derive `rIdFrameChuteN`. A JPEG and PNG can therefore accidentally receive the same relationship ID.

Fix this by allocating relationship IDs independently from media filenames:

- inspect **all existing relationships** in `word/_rels/document.xml.rels`;
- choose a relationship ID that is unique across the document, regardless of image extension;
- never assume media filename number == relationship ID number;
- preserve all existing relationships.

### DrawingML non-visual IDs must be unique

Do not emit every inserted image with `wp:docPr id="1"`.

- allocate a unique document-wide `wp:docPr` ID for each generated drawing;
- emit suitable unique picture non-visual metadata (`pic:nvPicPr` / `pic:cNvPr`) rather than omitting it;
- preserve relationship references and dimensions;
- keep the generated markup acceptable to Word/LibreOffice and compatible with later round-trip editing.

### Mixed multi-image round-trip tests

Add tests that create/parse/serialize/reparse a DOCX containing at least:

- one existing embedded image;
- one newly inserted PNG;
- one newly inserted JPEG;
- text edited after the images are present.

Verify:

- all relationship IDs are unique;
- all drawing non-visual IDs are unique;
- every relationship resolves to the intended `word/media/*` part;
- both inserted image byte payloads survive serialization;
- existing images remain present;
- text edits remain present;
- reparsing the saved DOCX still exposes all images.

## 10. DOCX nested drag/drop ownership must begin during hover

The editable DOCX surface must claim eligible image drops before the generic workspace drop UI takes over.

- During `dragenter` / `dragover`, inspect `dataTransfer.items` as well as `dataTransfer.files` because browsers often expose file kind/type in `items` before `files` is populated.
- Eligible image hover over `.docx-editor` should mark the DOCX editor as the active drop target.
- Suppress/avoid the generic workspace drop overlay for that owned nested drop.
- On drop, insert exactly one document image contribution and do not create a duplicate workspace image object.
- Outside the DOCX editor, normal workspace ingestion remains unchanged.

Acceptance:

1. Drag PNG over open DOCX -> DOCX editor visibly claims drop before mouse-up.
2. Drop -> image inserts in document flow exactly once.
3. No generic workspace image object appears.
4. Drag image outside DOCX -> normal workspace ingestion still occurs.

## 11. Reconciliation rule for PR #42

PR #42 was built before PR #41 landed and now overlaps files such as:

- `src/actions/object-menu-model.mjs`
- `src/actions/quick-actions.js`
- `src/actions/quick-actions-visibility.js`
- `src/workspace.css`

Do not resolve this by choosing one side wholesale.

The final latest-main behavior must include **both**:

- merged PR #41: DOCX image rendering/insertion + reversible image editing;
- intended PR #42: Simple menu ordering, global/per-object Quick Actions override, large resize preview, Copy Image, Open Image in New Tab, Select Mode foundation, Simple timing/sync cleanup, toolbar/header corrections.

Where code overlaps, integrate the state machines and tests deliberately.

## 12. Regression and validation requirements

Add focused tests for:

- global Quick Actions ON/OFF;
- per-object GLOBAL/ON/OFF override in both directions;
- legacy hidden-state migration;
- dynamic `Edit Image` / `Finish Editing` label survives reconciliation;
- exact Simple image menu order;
- bulk Crop selection scope;
- DOCX mixed-image relationship uniqueness and round-trip;
- any pure helper introduced for Simple toolbar/selection behavior.

Run:

- focused unit tests while implementing;
- `node --test tests/*.test.mjs`;
- syntax/static checks for changed modules;
- Chrome Web Store packaging/release gate;
- `git diff --check`.

Do not claim browser UI behavior was manually verified unless it actually was.

## TIME BOX

Use up to 30 minutes.

Prefer a smaller coherent, tested reconciliation over broad unrelated refactors.

At the 30-minute mark, **conclude active implementation and provide a handoff** containing:

- completed work;
- remaining work;
- files changed;
- tests run and exact results;
- known issues / risks;
- exact next implementation steps;
- branch / commit / PR state.

Leave the repository coherent and buildable. Open one clean PR against the latest `main` if the result is reviewable.
