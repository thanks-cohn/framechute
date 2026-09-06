# Codex Request: FrameChute workspace UI, responsive toolbar, and real canvas snapshot

## Goal

Make the FrameChute Simple-mode workflow obvious, compact, and reliable while fixing the blocker in PR #46. The key concepts must be clearly separated:

- **Open Workspace** = open/import an editable portable FrameChute workspace file.
- **Export Workspace** = export/save the editable portable FrameChute workspace file.
- **Take Snapshot** = render the entire USED visual workspace/canvas into one flattened image.

Do not use the word **Snapshot** for editable workspace files anymore.

## 1. Fix the PR #46 `layer-menu.js` runtime blocker first

PR #46 added handlers for `quick-actions`, `minimize`, `expand`, and `center`, but the new branches were inserted at module scope after the existing event listeners. They reference `button` outside the `menu.addEventListener("click", ...)` handler, which can throw `ReferenceError: button is not defined` when the module loads.

Move those branches inside the existing menu click handler alongside the other `button.dataset.layerAction` cases. There must be no module-scope reference to `button`.

Verify that `src/layer-menu.js` loads without console exceptions and that the context menu continues working.

## 2. Make the top toolbar stay aesthetically compact at every practical window width

Current problem: narrowing the FrameChute window can make the header controls wrap into a tall vertical stack. This consumes the workspace and looks broken rather than intentionally responsive.

Do **not** solve this by letting every individual button wrap vertically.

Desired behavior:

- Keep the header predominantly horizontal and compact.
- Preserve FrameChute identity and the Simple/Advanced state clearly.
- Keep highest-priority actions immediately reachable.
- Progressively collapse lower-priority controls into compact grouped menus such as `Open…`, `Workspace…`, or `More…` as width decreases.
- Avoid giant blank gaps.
- Avoid page-level horizontal overflow.
- Do not let buttons become absurdly narrow.
- Narrow windows must still leave most of the viewport for the actual workspace.
- The header should look intentionally designed at approximately 1400px, 900px, 650px, and 450px widths.

A reasonable responsive grouping is:

### Highest priority / usually visible
- FrameChute identity
- Advanced toggle
- Upload / Add
- Take Snapshot
- Recording controls when active/relevant

### Workspace group
- Open Workspace…
- Save
- Saved Workspaces…
- Restore selected/local save
- Export Workspace…

### Lower-priority actions
- individual document openers
- reconnect
- less-frequently-used utilities

These may collapse into grouped menus at smaller widths without removing functionality.

**Principle:** narrowing the browser should reduce secondary chrome, not reduce the usable workspace.

## 3. Simplify the floating Settings capsule

The minimized/floating Settings control currently has redundant controls such as a grab control plus a gear plus an expand/minimize-style control.

When compact/minimized, reduce it to exactly two controls:

- **GRAB ME!** / Move: drag/reposition the Settings capsule.
- **Expand / Restore**: open/expand the Settings panel.

Remove the redundant gear button from the compact state. Do not leave two controls that fulfill the same open/expand role.

Requirements:

- one compact horizontal capsule
- no internal wrapping at narrow widths
- remains reachable near viewport edges
- preserves drag position/state
- accessible tooltip and ARIA label for the expand/restore control

## 4. Rename the portable workspace actions everywhere

Change the existing user-facing labels:

- `Open Snapshot` -> **Open Workspace**
- `Export Snapshot` -> **Export Workspace**

Apply this consistently to:

- top header / main toolbar
- context/right-click menus
- dialogs
- tooltips
- ARIA labels
- status messages
- documentation/help text that users see

`Open Workspace` and `Export Workspace` are core Simple-mode features. They must not require Advanced mode.

## 5. Put `Open Workspace` in the top header AND the right-click menu

### Top header

`Open Workspace` must be clearly discoverable from the main header in Simple mode. At narrow widths it may live inside a compact **Workspace** menu, but it must remain easy to find.

### Right-click menus

Expose workspace-level actions in the appropriate context menu(s):

- **Open Workspace…**
- **Export Workspace…**
- **Take Snapshot…**

The workspace/empty-space/general layer menu should definitely provide these. If an object-specific menu is intentionally mixed with global commands, it may also provide them, but keep object actions and workspace actions visually grouped/separated.

Suggested menu grouping:

### Workspace
- Open Workspace…
- Export Workspace…
- Take Snapshot…

### Object
- Minimize
- Expand / Restore
- Bring to Center
- Grab / Move Object
- Close Object
- other existing object-specific actions

## 6. Add a real `Take Snapshot` feature

Add a prominent **Take Snapshot** action to the top toolbar/header and the appropriate right-click workspace menu.

This is **not** the existing portable workspace export. It creates a normal flattened raster image of the complete USED FrameChute canvas.

### Used-canvas bounds

Determine the capture rectangle from the outermost visible FrameChute objects:

- leftmost object edge
- rightmost object edge
- topmost object edge
- bottommost object edge

The snapshot must include objects outside the current browser viewport. Do not capture only the visible viewport.

Do not include enormous unused portions of the infinite workspace. Crop to actual content bounds plus a small sensible padding.

A narrow and a wide browser window should produce equivalent workspace content bounds if the workspace itself did not change.

### Visual fidelity

Preserve, as faithfully as practical:

- object positions and dimensions
- z-order/layering
- visible transforms
- image edits
- text
- canvas/drawing objects
- visible PDF/document content
- visible media frame/poster/current frame where technically supported
- spatial relationships between objects

Do not burn unrelated application chrome into the image unless that chrome is intentionally part of an object.

### Export dialog

Clicking **Take Snapshot** should open a compact export dialog with:

#### Format
- PNG
- JPEG
- WebP

#### Scale / output size
- 50%
- 100%
- 200%
- 300%
- 400%

Display the resulting pixel dimensions when practical.

Example:

- Workspace bounds: `1840 x 1260`
- 200% output: `3680 x 2520`

#### Quality

For JPEG and WebP, provide a quality control. Do not show a misleading lossy-quality slider for PNG.

#### Background

For alpha-capable formats, allow transparent output when appropriate. JPEG must flatten to an opaque background.

#### Filename / destination

Use the existing FrameChute native save/download flow where practical so the user can choose filename and save location.

Suggested default filename:

`framechute-snapshot-YYYY-MM-DD-HHMM.png`

### Safety for huge captures

Calculate raster dimensions before allocation. Do not crash/freeze the browser on impossible canvases.

If requested output exceeds safe browser canvas/memory limits:

- warn the user
- offer/recommend a lower scale
- fail gracefully

Use tiled/composited rendering if practical. Do not claim streaming or bounded memory if the implementation is not actually bounded.

### Cross-origin/web objects

Be honest about browser security restrictions. Do not weaken security or request excessive permissions to rasterize arbitrary cross-origin iframe content. If an object cannot be faithfully captured, use an existing safe rendered representation where available or report the limitation clearly rather than silently omitting it.

## 7. Preserve distinction between local saves and portable workspaces

Current FrameChute also has local `Save`, `Saved FrameChutes`, and `Restore` behavior. Keep it if useful, but make the relationship obvious:

- **Save** = quick/local workspace save
- **Saved Workspaces** = local saved states
- **Restore** = restore selected local saved state
- **Export Workspace** = portable editable workspace file written to disk
- **Open Workspace** = open/import a portable editable workspace file from disk
- **Take Snapshot** = flattened image of the visual used canvas

A first-time user should immediately be able to answer: **How do I reopen the workspace I exported yesterday?** The visible answer should be **Open Workspace**.

## 8. PDF toolbar/popdown follow-up from PR #46

Review the compact PDF toolbar implementation. It currently combines horizontal overflow with absolutely positioned pop-downs. Ensure `Edit`, `Pages`, and `More` pop-downs cannot be clipped by an overflow ancestor.

Prefer a robust portal/positioning/layout solution rather than simply increasing z-index if the clipping ancestor is the actual problem.

## 9. PDF whole-document image export memory behavior

PR #46 renders PDF pages sequentially but retains each encoded page in a `files` object before `zipSync`, so memory still grows with the whole document.

Improve this if practical. At minimum:

- release page/canvas resources immediately
- avoid unnecessary duplicate buffers
- document any unavoidable whole-document memory limitation honestly
- do not destabilize export merely to claim streaming

## 10. Acceptance tests / verification

Verify all of the following:

### Runtime / context menu
- `layer-menu.js` loads without exceptions
- right-click workspace/object menus work
- Grab / Move works
- Minimize works
- Expand / Restore works
- Bring to Center works
- Quick Actions toggle works
- Advanced-only timing/sync items remain Advanced-only

### Responsive UI
- toolbar is visually compact around 1400px, 900px, 650px, and 450px widths
- no giant vertical stack of every toolbar button
- no important Simple-mode action becomes inaccessible
- Settings compact control has only two controls: grab + expand/restore

### Workspace terminology
- no user-facing `Open Snapshot`
- no user-facing `Export Snapshot`
- `Open Workspace` appears in top header / Workspace group
- `Export Workspace` appears in top header / Workspace group
- `Open Workspace` and `Export Workspace` are available in Simple mode
- right-click workspace/general menu exposes Open Workspace, Export Workspace, and Take Snapshot

### Take Snapshot
1. Two objects far apart, one outside viewport -> both appear.
2. Object partially at negative/left/top workspace coordinate -> bounds remain correct.
3. Overlapping objects -> z-order preserved.
4. Moving an object farther away expands snapshot bounds.
5. Removing the outermost object shrinks bounds.
6. Narrow and wide browser windows produce equivalent content bounds.
7. 100% and 200% exports preserve geometry while changing pixel dimensions.
8. PNG, JPEG, and WebP save correctly.
9. JPEG/WebP quality behavior works and PNG does not expose fake lossy quality.
10. Huge requested output fails safely rather than crashing.
11. Empty workspace gives a clear message such as `Nothing to snapshot.`
12. Export Workspace still produces the editable portable workspace and was not accidentally converted into image export.

### PDF
- PDF pop-down menus are not clipped
- current-page PDF image export still works
- whole-PDF image export still works

## 11. Testing commands

Run at minimum:

- full existing JS test suite
- targeted tests for changed modules
- `node --check` on modified JS files
- `git diff --check`
- existing extension packaging/release-gate script if applicable

Add focused automated tests where practical, especially for terminology/action wiring and content-bounds calculations. Manually exercise the responsive widths and snapshot rendering cases that are difficult to cover in unit tests.

## 12. Scope discipline

Keep this a focused corrective/UX implementation. Do not perform an unrelated visual rewrite of the application. Preserve existing working behavior unless this request explicitly changes it.

If PR #46 remains open, treat it as implementation context but do not blindly merge it as-is before fixing the runtime blocker described above.