# ADDENDUM — Open File Location from object context menus

Read this together with the current FrameChute responsive-toolbar / Simple image-menu / Select Mode addendum.

FrameChute should expose **Open File Location** from the right-click menu for objects that came from a local file or an authorized local folder.

## Product behavior

Add a context-menu action labeled:

**Open File Location**

For the Simple/non-Advanced image menu, keep the existing high-priority image actions first and place **Open File Location** immediately after **Copy Image** unless a platform-specific reason requires a nearby source/file group.

The current intended top image order therefore becomes:

1. Img Ext Change…
2. Img Size Change…
3. Crop…
4. Grab / Move Object
5. Close Object
6. Shrink to Fit
7. Copy Image
8. Open File Location

Do not add timing/sync wording back into the Simple image menu.

## What “Open File Location” means

The action should reveal the source file in its containing location when FrameChute has enough source provenance to do so.

Prefer, in order:

1. **OS/native reveal when the browser/extension exposes a safe supported API for that exact source** (for example, a known Chrome download that can be shown through the browser downloads API).
2. **FrameChute File Explorer reveal** when the source belongs to a user-authorized directory that FrameChute already knows: open/browse that containing directory and highlight/select the source file.
3. If FrameChute has only an isolated file handle / dropped File and no known parent directory, do not fake a filesystem path. Explain concisely that the containing folder is not available yet and offer/trigger the existing folder-authorization/reconnect flow when appropriate.

Do not manufacture absolute paths from `File.name` or file handles. Browser security boundaries are real.

## Provenance/state

Where current ingestion already knows a source directory, persist enough non-sensitive provenance to reconnect/reveal it later through the existing handle-key / authorized-folder infrastructure.

Examples:

- file opened from an authorized FrameChute folder → Open File Location opens that folder and highlights the file;
- gallery/folder-backed image → open the known folder and highlight the current entry;
- ordinary isolated drag/drop file with no parent handle → show an honest “containing folder is not available; choose/reconnect folder” status rather than silently doing nothing;
- downloaded file with supported native reveal metadata → reveal through the supported browser API.

The action must never upload the file, send its path remotely, or request broader filesystem access than needed.

## Selection behavior

For a multi-selection, **Open File Location** is fundamentally a source-object command. Right-clicking a selected member should reveal the specifically invoked object's location, not attempt to open a dozen folders or silently discard selection state.

Keep the selection intact after revealing the location where practical.

## Acceptance checks

1. Open an image from a user-authorized directory → right-click → Open File Location → containing directory opens/reveals in FrameChute and the source is highlighted.
2. Right-click a gallery-backed current image → Open File Location → known folder opens with that entry selected.
3. Right-click an isolated dropped image with no parent provenance → user gets a concise, truthful recovery/authorization path; no fake path and no crash.
4. If native Chrome reveal is supported for a known download source, Open File Location reveals it in the OS file manager.
5. Simple image menu retains the requested top ordering and remains free of timing/sync controls.

Product rule:

> If FrameChute knows where the file came from, let me go back there in one click. If it does not know, say so honestly and let me reconnect the location.
