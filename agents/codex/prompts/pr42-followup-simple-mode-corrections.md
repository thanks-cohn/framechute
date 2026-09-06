# PR #42 FOLLOW-UP — finish the Simple-mode UX pass correctly

Work on the existing PR #42 branch. Read this file together with `agents/codex/prompts/next-simple-ui-select-context-pass.md`. This follow-up is narrower and wins where it is more specific.

Do not redo the parts of PR #42 that are already correct: the ordered image context-menu actions, global Quick Actions toggle, per-object GLOBAL/ON/OFF override, Copy Image, Open Image in New Tab, batch-aware resize/format conversion, Simple-mode timing/sync hiding, and existing tests around those behaviors.

## 1. Fix the *actual* Simple/Classic toolbar at narrow widths

Current issue: PR #42 mainly hardens `.toolbar-primary`, but Simple/Classic mode hides `.toolbar-primary` and uses `.classic-toolbar-primary` instead. The half-window problem therefore remains on the surface users actually see.

Required behavior:
- `.classic-toolbar-primary` and its `.classic-toolbar-actions` groups must stay approximately one compact toolbar row.
- Do not allow them to wrap into a tall multi-row header that consumes the viewport.
- At narrower widths, progressively compact labels, hide low-priority status text, and/or use horizontal scrolling inside the toolbar row.
- Popup panels must float over the workspace rather than increase toolbar height.
- Re-expanding the window restores normal presentation.
- Never move workspace objects merely because the viewport width changed.

Acceptance:
1. Full desktop width: normal toolbar.
2. Roughly half-screen desktop width: still one compact row or one horizontally scrollable row.
3. Narrow extension window: controls remain reachable and the toolbar does not become most of the screen.

## 2. Mount Select Mode on the toolbar that is actually visible in Simple mode

Current issue: `quick-actions.js` appends the Select Mode button to `.toolbar-primary`, but Simple/Classic hides that container.

Required behavior:
- In Simple/Classic mode, the Select Mode control must be visible on `.classic-toolbar-primary` (or a shared always-visible toolbar slot).
- In Advanced mode, it may remain on the Advanced toolbar if appropriate.
- There must be one logical Select Mode state, not two independent controls.
- If two visual proxies are necessary, they must mirror the same state and never drift.
- `Select Mode [ ON / OFF ]` persists using the existing key.
- While ON, object clicks select/toggle instead of accidentally starting normal drag/edit behavior.
- It should safely support images, video, audio and other already-supported media/object types using the existing selection model.

## 3. Finish bulk Crop

Current issue: Resize and Ext Change support `This image / Selected images`, but Crop is still single-image-only.

Required behavior:
- Crop dialog must expose `Apply to: This image / Selected images` when multiple images are selected.
- `This image` remains the conservative default.
- For `Selected images`, apply the same normalized/proportional crop rectangle to every selected image so different source dimensions are handled consistently.
- Reuse existing image transform/render/result infrastructure.
- Preserve originals unless the existing result-routing UI explicitly chooses otherwise.
- Show how many images will be affected before applying.
- Do not add timing/sync wording to this dialog.

## 4. Frameless image/video must repair bounds and automatically Shrink to Fit

This is a correctness requirement, not optional polish.

When the user chooses Show image only / Show video only / removes the frame:
1. switch to frameless state;
2. measure/recompute the actual visible media bounds after header/footer/frame removal;
3. remove stale framed-shell width/height from the selection geometry;
4. immediately run the equivalent of `Shrink to Fit` for that same object without asking;
5. preserve aspect ratio;
6. keep the object's workspace anchor/position as stable as possible;
7. recompute the blue selection outline, resize hotspot and object-menu anchor from the visible media geometry.

Do not destructively resize source pixels.

Acceptance:
- oversized image frame → Show image only → blue outline hugs the image → object shrinks only if needed → menu icon remains attached to visible image;
- same for video;
- restoring the frame does not corrupt source state or workspace coordinates.

## 5. Finish restored-header collision handling after rename

PR #42 adds name truncation, which is good, but the structural rule must be stronger.

Required behavior:
- Long names must never collide with Grab/menu/maximize/close/source/dirty controls.
- Name field is the flexible/truncating element; fixed controls never shrink into one another.
- When restoring an image/video frame, recompute header layout against the current object width and current name.
- If the restored frame is narrower than the minimum width required for usable controls, enlarge only the frame width to that minimum safe width.
- Do not move the object merely to solve a header collision.
- Same behavior after FCX restore and after browser resizing.

## 6. Make Open File Location useful when FrameChute has provenance

Current PR mostly emits a reconnect message. Improve this while staying honest about browser security.

Required behavior:
- If the object was opened from an explicitly authorized folder and FrameChute retains a usable folder/file handle or reconnect location, `Open File Location` should open/browse that authorized folder in FrameChute's file-browser/location UI and, where practical, select/highlight the source file.
- If a browser/platform native reveal API is actually available and permitted, use it.
- If the object came from an isolated dropped file with no parent-folder provenance, do not pretend a path exists; show the existing concise reauthorize/reconnect explanation.
- Reuse existing source-location / reconnect infrastructure instead of inventing a second filesystem model.

## 7. Preserve the good PR #42 behavior

Do not regress:
- exact Simple image context-menu ordering;
- Close Object near top;
- Shrink to Fit visible in the image right-click menu;
- Copy Image;
- Open Image in New Tab;
- global Quick Actions ON/OFF persistence;
- per-object Quick Actions GLOBAL / ON / OFF override that can bypass global both ways;
- FCX persistence for the per-object override;
- bounded proxy preview for very large resize requests while actual export still uses the requested dimensions;
- Simple-mode timing/sync entries absent.

## 8. Tests / verification

Add or extend tests where practical for:
- Simple/Classic Select Mode control targeting the visible toolbar/state;
- bulk Crop scope and proportional application;
- per-object Quick Actions override regression;
- menu ordering regression;
- any pure geometry helper used by frameless bounds repair.

Run focused tests, then the normal test suite and Chrome Web Store packaging/validation if time permits.

## TIME BOX

Use up to 30 minutes.

Prioritize finished, testable corrections over broad unrelated refactors.

At the 30-minute mark, **conclude active implementation and provide a handoff** containing:
- completed work;
- remaining work;
- files changed;
- tests run and results;
- known issues / risks;
- exact next implementation steps;
- current branch / commit / PR state.

Leave PR #42 in a coherent, buildable, reviewable state. Do not make unrelated changes.