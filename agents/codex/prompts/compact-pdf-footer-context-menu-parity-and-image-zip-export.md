# Codex Request: Compact PDF footer + context-menu parity + image ZIP export

## Mission

Refine FrameChute's everyday controls so first-time users see the obvious actions immediately while advanced capability stays available without turning the UI into a wall of buttons.

This pass has five connected goals:

1. make the PDF lower footer compact and priority-driven;
2. use pop-down menus instead of a permanently enormous footer;
3. expose the important top-header/workspace commands from the right-click menu of ANY FrameChute object without duplicating action logic;
4. remove ALL timing and synchronization options from the non-Advanced right-click menu;
5. give the Quick Actions panel a small, obvious × close control;
6. upgrade PDF page raster export into a current-page / whole-document image ZIP workflow with format, quality, and size controls.

Use the latest `main` as the source of truth.

Preserve current PDF editing behavior, especially PR #44 direct replacement-field manipulation and PR #45 live source masking.

---

# Product rules

> Obvious actions first. Specialist actions one click away.

> Pop-down menus should absorb breadth before the footer becomes absurdly wide.

> Right-click should expose the same important workspace commands as the visible top chrome, not a disconnected second product.

> Timing and synchronization belong to Advanced mode only.

> Closing a utility panel is not the same as clearing the user's work.

---

# 1. Compact PDF footer

The current PDF footer is a long flat row. Replace that layout with a compact first-visible set plus grouped pop-down menus.

The initial visible controls should prioritize what ordinary users understand immediately:

```text
[ Save As ] [ Save ]   [ ‹ ] Page [ n ] / [ count ] [ › ]   [ Export Images… ]   [ Edit ▾ ] [ Pages ▾ ] [ More ▾ ]
```

Exact visual spacing may adapt to the existing FrameChute style, but preserve this priority:

1. Save As
2. Save
3. page navigation
4. Export Images…
5. grouped menus

Do NOT bury Save As or Save in a menu.

Do NOT make a first-time user horizontally scroll just to discover Save/Save As.

---

# 2. Pop-down menus instead of a giant footer

Use compact pop-down menus for lower-frequency PDF actions.

Reuse existing FrameChute menu/panel conventions where practical rather than introducing a heavyweight menu framework.

Suggested groups:

## `Edit ▾`

When a PDF text replacement is selected:

- Text size: `[ value ] pt`
- Undo
- Redo

Hide or honestly disable contextual edit items when no editable replacement is selected.

## `Pages ▾`

- Rotate
- Delete page
- Duplicate page
- Move page…
- Extract current page
- Insert PDF
- Crop margins

## `More ▾`

- Compress
- Reconnect source when relevant
- genuinely lower-frequency PDF utilities

`Export Images…` remains directly visible because it is a broad, obvious conversion task.

Menu behavior:

- keep menus inside the viewport;
- open downward when possible, otherwise use available space;
- Escape closes;
- outside click closes;
- keyboard accessible;
- opening one FrameChute menu should coordinate with existing context menus instead of stacking chaotically;
- no accidental changes to PDF/workspace geometry;
- avoid nested menus in the PDF footer for this pass.

---

# 3. Horizontal footer left/right controls remain as a narrow-width fallback

Even after grouping, very narrow PDF blocks may still overflow.

Provide distinct footer-scroll controls when needed:

```text
[ ◀ ]  <compact scrollable footer strip>  [ ▶ ]
```

These arrows are NOT the PDF previous/next-page buttons.

Requirements:

- arrows only appear or become enabled when horizontal overflow exists;
- left disabled/quiet at the beginning;
- right disabled/quiet at the end;
- clicking scrolls by a useful chunk, approximately one visible footer section;
- focused controls are scrolled into view;
- normal trackpad/horizontal scrolling remains usable where practical;
- footer remains one row and never wraps into a tall multi-row ribbon.

The pop-down menus should make overflow uncommon. The arrows are a safety valve, not the primary interaction model.

---

# 4. Upgrade `Pages to PNG` into `Export Images…`

Replace the current narrow `Pages to PNG` action with a compact export dialog.

User flow:

```text
Export Images…
        ↓
Scope
  (•) This page
  ( ) Entire PDF

Format
  PNG / JPEG / WebP

Size
  50%
  100%
  200%
  Custom scale or target width where practical

Quality
  JPEG/WebP quality control
  hidden or disabled for PNG

[ Export ] [ Cancel ]
```

## This page

- rasterize only the current page;
- use the requested format, scale/size, and applicable quality;
- offer a normal Save As flow;
- optionally retain the existing ability to add the result to the workspace if it fits cleanly.

## Entire PDF

- rasterize every page in document order;
- DO NOT create hundreds/thousands of workspace image objects by default;
- place the rendered files into one ZIP;
- use stable zero-padded filenames such as `page-0001.png`, `page-0002.png`, etc.;
- Save As one ZIP file;
- show progress for multi-page work;
- allow cancellation if the existing architecture has a clean cancellation pattern;
- process pages sequentially or with tightly bounded concurrency so a large document does not explode RAM.

Reuse the repository's existing ZIP capability (`fflate` / existing archive helpers) rather than bringing in another archive dependency.

The exported raster must reflect the CURRENT edited PDF state, including committed replacement text/source masking/page operations, rather than rasterizing an obsolete pre-edit source if the current architecture can serialize the edited PDF first.

Do not promise huge-PDF streaming architecture in this pass. Keep memory bounded as practical and leave the later Sumatra-style huge-PDF work as its own milestone.

---

# 5. Right-click on ANY FrameChute object should expose top-header/workspace commands

The user should not have to move to the top of the window to perform common workspace actions.

Every ordinary FrameChute object context menu should include access to the important commands currently exposed by the top header.

Current top-header capabilities include the Upload/Add panel, Saved FrameChutes, Save, Restore, Reconnect, Export Snapshot, Open Snapshot, and Resume Snapshot when relevant.

Expose these through a compact grouped context-menu entry/section such as:

```text
Workspace ▸
  Add / Upload…
  Saved FrameChutes…
  Save FrameChute
  Restore FrameChute
  Reconnect All
  Export Snapshot
  Open Snapshot
  Resume Snapshot   (only when available)
```

`Add / Upload…` should provide the same add/open choices as the top Upload panel:

- New note
- New Canvas
- Open text
- Open PDF
- Open DOCX
- Open image
- Open gallery
- Open video
- Open URL

The exact presentation can be a submenu, popover, or compact second-stage panel, whichever best matches the existing menu architecture. Do not dump every top-header command flat into an already-long object menu.

CRITICAL: do not build a second implementation of these commands.

Create/reuse central command functions or delegate to the existing command handlers so:

> top toolbar action == right-click action

The two surfaces must share behavior, permission handling, status messages, and future fixes.

Object-specific actions such as Grab / Move, Close Object, image utilities, PDF utilities, layer ordering, etc. remain available according to object type.

---

# 6. Timing and Sync are ADVANCED-ONLY in the right-click menu

This is a hard UX rule.

In non-Advanced / Simple mode, the right-click object menu must NOT show:

- Sync with…
- Make independent when it exists only as sync/timing behavior
- Create timed move
- Edit timed move
- Preview timed move
- Return to move start
- Remove timed move
- Layer timing…
- timing/sync separators or dead empty menu space
- any other timing/motion authoring command

These controls should exist only when Advanced mode is active.

The current `src/layer-menu.js` creates Sync and timed-motion items directly and currently decides visibility primarily by object/media state. Gate the ENTIRE timing/sync group behind the same authoritative Advanced-mode state used by the rest of FrameChute.

The current Advanced preference is associated with `framechute.advanced-mode.v1`. Prefer a shared helper/state source rather than sprinkling new direct `localStorage` checks through unrelated modules.

Simple/non-Advanced mode should remain focused on ordinary file/object operations.

Advanced mode may continue to expose all timing/sync functionality.

Add focused tests for menu-model visibility if practical.

---

# 7. Add a small × to the Quick Actions panel

The floating Quick Actions panel currently has a title, count, actions, and a `Clear` button but no ordinary close affordance.

Add a small × in the panel's upper-right/header area.

Required semantics:

- × HIDES/CLOSES the Quick Actions panel;
- × does NOT delete objects;
- × does NOT clear the current selection;
- × does NOT silently change global/per-object Quick Actions preferences;
- the existing `Clear` control remains the explicit action for clearing selection;
- Escape may also close the panel when focus is inside it if this fits existing keyboard behavior;
- panel can appear again through the normal Quick Actions/selection workflow;
- accessible label/title: `Close Quick Actions`;
- style it as a small quiet window close control, not a giant destructive button.

This distinction matters:

```text
×      = close this panel
Clear  = clear selected objects from Quick Actions selection
```

---

# 8. Preserve existing object-menu behavior

Do not regress:

- Bring to front / Send to back
- Grab / Move Object
- Open File… where supported
- Show top bar
- Show Settings
- Show media player
- Make menus visible
- object header/footer visibility
- frameless image/video behavior
- Close Object / Close Frame
- current image-specific menu behavior
- global/per-object Quick Actions semantics

Do not reintroduce passive viewport logic that moves artwork merely to keep controls reachable.

The spatial rule remains:

> The viewport moves. The artwork does not.

---

# 9. Testing / acceptance

Manual/browser acceptance cases:

1. Open an ordinary PDF at normal width -> Save As, Save, page navigation, and Export Images are visible immediately.
2. Open Pages/Edit/More pop-downs -> all previous PDF actions remain reachable.
3. Make PDF block narrow -> footer arrows appear/enable appropriately and menus still stay in viewport.
4. Export current page as PNG/JPEG/WebP -> chosen scale/quality is reflected in output.
5. Export an entire multi-page PDF -> one ZIP with ordered page images, no explosion of workspace objects.
6. Edit PDF text, move it, save current page image -> raster output reflects current edited visual state.
7. Right-click an image/PDF/DOCX/video/text object -> Workspace/top-header commands are reachable.
8. Run a top-header command and its right-click equivalent -> same behavior/result.
9. Non-Advanced mode -> NO timing or sync items exist in right-click menu and no orphan separators remain.
10. Advanced mode -> timing/sync items are restored where applicable.
11. Quick Actions panel -> × closes panel while preserving current selection; Clear still clears selection.

Run as practical:

- focused menu/export tests
- `node --test tests/*.test.mjs`
- `node --check` on changed JS modules
- `git diff --check`
- Chrome Web Store packaging/release gate

Record any browser-only interaction that could not be manually verified.

---

# Scope discipline

Do NOT expand this pass into:

- FrameSnap implementation
- tabs / URL sleeping tabs / bottomless history
- huge-PDF architecture
- OCR
- full Acrobat-style PDF editing
- XLSX/PPTX
- new timing features

This is a compact interaction/discoverability/export pass.

---

# Time box / handoff

Use up to 30 minutes.

Prioritize a coherent, tested end-to-end pass over unrelated refactors.

At the 30-minute mark, conclude active implementation and provide a handoff containing:

- completed work
- remaining work
- files changed
- tests run and exact results
- manual browser checks performed
- known issues / risks
- exact next steps
- branch / commit / PR state

Leave the repository coherent and buildable.

Open one clean PR against the latest `main` if the result is reviewable.
