# NEXT PASS — Simple UI, responsive toolbar, selection, context actions, and Quick Actions overrides

This is the newest source of truth for the behaviors in this file. Read it with the existing FrameChute utility/image prompts, but where an older prompt conflicts with this file, **this file wins**.

Do not redo completed unrelated work. Keep FrameChute local-first, Manifest V3 compatible, Chrome Web Store compatible, and preserve native Save / Save As and FCX behavior.

Core product rule:

> Select the thing. Do the obvious thing. Save the result.

## 1. Narrow / half-screen toolbar must stay one compact strip

Current bug: when the browser is reduced to roughly half-screen width, the sticky top toolbar wraps into many rows and consumes much of the viewport.

Required:

- keep the toolbar approximately one normal row high;
- never let it wrap into a large multi-row header;
- temporarily hide plain-language labels at narrow widths without overwriting the user's saved Show Toolbar Text preference;
- collapse low-priority/status content before core commands;
- if necessary, use one horizontally scrollable command row;
- keep dropdown/popup panels floating outside the toolbar instead of expanding toolbar height;
- restore the user's preferred label mode when width returns;
- responsive layout must never move workspace objects or rewrite artwork coordinates.

Verify at full desktop width, approximately half desktop width, and a narrow extension window.

## 2. Simple mode right-click menus must contain no timing UI

In non-Advanced / Simple mode, do not show any timing/animation entries:

- Create/Edit timed move
- Preview timed move
- Return to move start
- Remove timed move
- Layer timing…
- scheduling/timing controls of the same family

Do not merely disable them; omit them from the menu. Advanced mode may retain them.

## 3. Images must contain no sync/media-link wording

Image objects must not show:

- Sync with…
- Make independent
- media synchronization/link wording

Resize, crop and format dialogs for images must also contain no sync/timing language.

## 4. Quick Actions must have a persistent global default AND a per-object override

The right-click menu must expose both levels distinctly.

### Global default

Expose:

`Quick Actions  [ ON / OFF ]`

- persists across object changes, reloads and reopen using the existing local settings mechanism;
- OFF means objects that use the global/default state do not show Quick Actions;
- ON restores inherited normal behavior immediately;
- selecting/right-clicking/opening another object must not silently change this setting.

### Per-object override

Every object also gets:

`Quick Actions for This Object  [ GLOBAL / ON / OFF ]`

Equivalent wording `Use Global / Force ON / Force OFF` is acceptable.

Exact semantics:

```text
GLOBAL → follow global setting
ON     → show Quick Actions for this object even if global is OFF
OFF    → hide Quick Actions for this object even if global is ON
```

This **supersedes any older prompt saying global OFF must always override local state**. The user explicitly wants an individual object to be able to bypass the global default in either direction.

Persistence:

- per-object override survives ordinary selection changes;
- survives frameless/frame restore;
- persists through FCX capture/restore using existing object state/payload infrastructure;
- toggling global state does not erase per-object overrides;
- changing a per-object override from a right-click menu changes only the invoked object unless a separate explicit bulk control exists.

The Quick Actions panel must never resurrect from incidental selection/popup events; effective visibility must always be derived from global + per-object state.

## 5. Simple image right-click menu — required top composition

Quick Actions controls may appear first as a compact settings/header group. After that, the first normal image actions in Simple mode must be:

1. **Img Ext Change…**
2. **Img Size Change…**
3. **Crop…**
4. **Grab / Move Object**
5. **Close Object**
6. **Shrink to Fit**
7. **Copy Image**
8. **Open Image in New Tab**
9. **Open File Location**

`Close Object` must stay near the top.

### Img Ext Change…

- real image conversion, not filename-only extension rename;
- PNG / JPEG / WebP minimum;
- preserve source unless replacement is explicitly requested;
- reuse existing transformed-image / encoder / Save As pipeline.

### Img Size Change…

- pixel-dimension resize/export;
- reuse existing resize engine;
- distinct from display-only Shrink to Fit.

### Crop…

- reuse existing crop workflow/engine.

### Grab / Move Object

- use existing direct manipulation / menu-grab behavior.

### Close Object

- closes/removes only the workspace object;
- never deletes the source file.

### Shrink to Fit

- visible in the image right-click menu;
- display/workspace sizing only;
- preserve aspect ratio;
- shrink only when necessary; do not enlarge an already fitting image;
- reuse existing fitted-image sizing math.

### Copy Image

- copy the current visible rendered image to the clipboard with `navigator.clipboard.write()` / `ClipboardItem` where available;
- include supported visible edits/transforms such as crop, paint, rotation, flip, background, etc.;
- clear status/error if clipboard image writing is denied/unavailable.

### Open Image in New Tab

- open the image as a normal standalone browser image in a new tab;
- prefer the current visible/rendered result when there are FrameChute edits/transforms, so the tab represents what the user is looking at rather than silently reverting to untouched source bytes;
- when the object is unmodified and has a stable usable URL, that source URL may be used directly;
- for local/blob-backed or transformed images, create a safe Blob/object URL and open that; manage/revoke temporary URLs when it is safe to do so without breaking the newly opened tab;
- if popup blocking prevents the new tab, report that clearly rather than failing silently;
- this is an image action only; do not use sync/timing terminology.

### Open File Location

- if FrameChute has an authorized parent-folder/directory handle or another supported native reveal mechanism for this exact local source, open/reveal that location and highlight/select the file when the platform permits;
- if only an isolated file handle/blob/drop is known and no parent directory provenance exists, do not invent a path;
- instead explain briefly that FrameChute needs the containing folder authorized and offer the existing reconnect/Choose Folder flow where appropriate;
- preserve browser permission boundaries; never claim unrestricted filesystem access.

## 6. Resize / Crop / Ext Change dialogs need explicit bulk scope

When multiple images are selected, utility dialogs must offer:

`Apply to: This image / Selected images`

Requirements:

- default to `This image` unless user deliberately chooses bulk scope;
- Img Size Change applies chosen resize rule across selected images using bounded-memory processing;
- Img Ext Change converts selected images with deterministic safe naming and no source overwrite by default;
- Crop can apply the same normalized/proportional crop rectangle across selected images;
- show affected-image count/summary before output;
- keep Save As / Add to Workspace / result routing explicit;
- no sync/timing language anywhere in these dialogs.

## 7. Large resize values must ALWAYS keep a preview

Large requested dimensions must not make the preview disappear or cap out.

Example:

`12000 × 8000 requested → bounded-memory proxy preview remains visible → UI still says output is 12000 × 8000 → actual export attempts 12000 × 8000.`

Requirements:

- always show a visual preview even for very large requested sizes;
- proxy preview may be smaller internally to control memory;
- preview must preserve intended aspect ratio, crop, rotation, flip, paint/background/transparency semantics sufficiently for judgment;
- clearly distinguish proxy preview dimensions from real requested output dimensions;
- actual export may only refuse/clamp for a real browser/encoder limit, never because the preview surface is smaller;
- debounce/cancel stale preview jobs while dimensions are being edited.

## 8. Frameless image/video conversion must repair bounds and auto-Shrink to Fit

When user chooses Show image only / Show video only / removes the frame:

1. enter frameless state;
2. recompute block bounds from actual visible media geometry after header/footer/frame removal;
3. immediately run the equivalent of **Shrink to Fit** for that same image/video without asking;
4. preserve aspect ratio;
5. preserve the object's workspace anchor/position as closely as possible;
6. update blue selection chrome, resize targets and menu-button anchor from the new visible geometry.

Do not resize underlying source pixels for this display repair.

Expected result: no huge stale blue rectangle and no menu icon stranded away from the visible image/video.

## 9. Renaming must never make restored frame controls collide

A long/new object name must never push Grab, menu, maximize/close, badges or other fixed header controls into one another.

Required:

- name field is the flexible/truncating region;
- fixed controls reserve non-shrinking space;
- use min-width:0 / overflow / ellipsis / sane flex-grid constraints;
- do not mutate actual name when visually truncating it;
- restoring a frame recomputes header layout using current width and current name;
- if the frame is too narrow for minimum controls, enlarge only frame width to minimum safe width;
- do not move the object merely to solve header collision;
- same behavior after FCX restore and browser resize.

## 10. First-class Select Mode

FrameChute needs an explicit persistent control:

`Select Mode  [ ON / OFF ]`

Use the existing selection model as the foundation. Do not build a second image-only selection system.

First version supports at minimum:

- images;
- videos;
- audio;
- other currently safe media objects.

When Select Mode is ON:

- ordinary click toggles object selection rather than starting move/edit;
- Shift/Ctrl/Cmd-click extends/toggles consistently;
- selected objects get clear unobtrusive selection chrome;
- direct move/resize/edit should not accidentally fire while the user is selecting;
- clicking empty workspace can clear selection consistently;
- marquee selection from empty workspace is desirable if practical in this pass.

Selection semantics:

- mixed selection is allowed, e.g. image + video + audio;
- right-clicking a member of the current selection acts on the set when the command supports multiple items;
- single-object commands operate on the invoked object or clearly state their scope; never silently discard the rest of the selection;
- Quick Actions show selected count and only valid actions;
- bulk image dialogs use this same selection set;
- selection survives harmless popup/dialog/context-menu events;
- closing/deleting an object removes it immediately from selection.

This selection foundation should be reusable later for:

- Arrange into PDF;
- contact sheet / stitch;
- Resize All / Convert All;
- ZIP selected;
- Group/Ungroup;
- align/distribute;
- multi-object FrameSnap.

Do not implement all of those in this pass.

## 11. Preserve Simple vs Advanced

Simple mode emphasizes direct everyday object/file actions. Advanced mode may expose timing, layered motion and deeper controls.

Prefer one conditional menu-composition system based on object type + mode rather than duplicated menu implementations.

## Acceptance priorities

1. Half-width browser → toolbar remains compact and workspace usable.
2. Simple image right-click → no timing/sync items; required top actions in exact order.
3. Global Quick Actions OFF + one object Force ON → only that object can still show Quick Actions.
4. Global Quick Actions ON + one object Force OFF → that object remains hidden.
5. Right-click image → Open Image in New Tab → visible/current rendition opens standalone.
6. Right-click local image with known folder → Open File Location uses supported authorized reveal path; unknown-parent source is handled honestly.
7. Very large resize → preview remains visible.
8. Frameless image/video → bounds immediately hug media and auto-shrink if needed.
9. Long rename → frame restore → header controls remain separated.
10. Select Mode → select several mixed media objects without triggering accidental move/edit gestures.
