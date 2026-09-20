# SUBSTRATE Proposal: WORLDS (R)END
## Rendered worlds, spatial desktops, and an agent-native canvas

**Status:** Proposal / future-facing architecture; not a claim of implemented functionality  
**Primary home:** `thanks-cohn/substrate/Proposals/`  
**Name:** **WORLDS (R)END** means **render**: a workspace that can be rendered as a conventional desktop, a navigable map, or an explorable little world. It does **not** mean breaking, tearing, or ending worlds.

## 1. Vision

Turn SUBSTRATE's existing expandable canvas into a collection of meaningful, persistent places. A user can work in an ordinary document workspace, save its arrangement as a desktop, leave it behind, establish another desktop elsewhere, and return to either one through a right-click menu, a world map, or an optional animated navigation companion.

The desktop may be a clean Macintosh-inspired office, an Atari GEM-like monochrome machine, a colorful KDE Crystal-inspired environment, an SGI-inspired workstation, or an original science-fiction/RPG scene. These are **presentation modes** around real PDF, DOCX, image, media, file-explorer, and future application frames. Changing how a world looks must not change what its documents contain.

A user can simply right-click and instantly switch destinations. A user who prefers playful travel may instead grab a turtle-like companion, walk along pixel-art paths, drive a little car, or fly an airship to another desktop and land there. Navigation art is replaceable and optional; no one should need to play a game to get their work done.

**Product principle:** The canvas remains functional without the RPG layer; the RPG layer gives spatial navigation personality without taking ownership of files, application state, or security decisions.

## 2. Existing foundations and architectural boundaries

Inspect the current SUBSTRATE repository before implementing any part of this proposal. Reuse the canonical workspace/block registry, frame creation and capture/restore, existing canvas pan/scroll/resize behavior, native file and working-copy persistence, and the modular frame-skin architecture when it exists on the target branch. Do not assume an unmerged PR is already in `main`.

This proposal is complementary to:
- `Proposals/living-computing-archive-and-interchangeable-frames.md`: environment presets and individual frame skins.
- `Proposals/semantic-world-engine-agent-native-spatial-ir.md`: a broader semantic 3D/scene engine. WORLDS (R)END is **the 2D/2.5D desktop navigation and canvas product**, not a requirement to first build a complete 3D engine.

Keep six responsibilities distinct:

1. **Canonical workspace and application state:** document models, frame IDs, file references, editing state, and existing snapshot/working-copy lifecycle.
2. **Spatial world model:** desktop IDs, cluster IDs, world coordinates, associations, anchors, and destinations.
3. **Camera/navigation:** coordinate transformations, pan, zoom where supported, teleport/go-to, focus, and travel.
4. **Canvas/world presentation:** wallpaper, map tiles, icons, scenery, decorative layers, selection, and animation.
5. **Frame presentation:** separately selectable frame skins; the canvas skin must not rewrite PDF/DOCX styling or override a frame's chosen skin.
6. **Agent interface:** structured, permission-controlled inspection and commands built around the same canonical state.

Avoid two competing sources of truth: an HTML/CSS element, sprite, screenshot, castle, or map tile is a rendering of a model object, not that object's identity or its authoritative file data.

## 3. Canvas presentation and styling contracts

Introduce an **independent canvas skin system** in addition to per-frame skin CSS. It should be possible to use an Atari-inspired desktop with a Macintosh-style DOCX frame and a Windows 98-inspired music player. Likewise, a coherent full-environment preset may suggest canvas and frame defaults without overwriting explicit individual frame overrides.

A canvas skin may govern:
- wallpaper, repeating patterns, palettes, textures, and ambient decorative layers;
- desktop surface, home marker, icon grid, labels, selection, menus, dock/panel presentation;
- landmarks for real desktop destinations and purely decorative scenery;
- optional map tile packs, companion/vehicle sprite sets, subdued motion, and sound;
- presentation-specific dimensions and responsive arrangements.

CSS should be organized by **responsibility and scope**, not by app engine. Conceptual organization:

```text
src/
  canvas/
    canvas-base.css
    canvas-presentation.css
    canvas-skin-registry.js
    canvas-skin-manager.js
    camera.js
    coordinates.js
  worlds/
    world-registry.js
    desktop-registry.js
    cluster-registry.js
    navigation.js
    destinations.js
    world-presentation.css
  skins/
    mac-classic/ (frame and optional canvas presentation)
    atari-gem/   (frame and optional canvas presentation)
    ...
```

This layout is illustrative. Extend existing modules instead of mechanically moving or rewriting all of `workspace.css` or duplicating the frame-skin registry. Define stable CSS tokens for canvas backgrounds, decorative surfaces, desktop icon sizes/spacing, selection, and map labels. Scope all canvas rules to an explicit environment root and make sure no rules leak into document editors.

CSS skins are for styling; **semantic objects and navigable destinations belong in the world model**. Canvas/SVG/WebGL may eventually render many tiles or richer scenery, but changing renderer must not change IDs, coordinates, permissions, or agent contracts. Use local bundled/trusted assets first, with carefully bounded future user asset import. Do not run arbitrary scripts supplied by visual skins.

## 4. World, desktop, cluster, location: explicitly different concepts

**World:** a named, optionally decorated spatial environment with stable identity, background/skin, destination graph, presentation preferences, and camera state. Worlds may contain many desktops. A world is not necessarily a fully loaded copy of every document.

**Desktop:** a designated home/base at a stable world position, optionally with background, shortcuts, icon arrangement, chosen canvas skin, default frames, and an anchor setting. Every desktop can act as the **seed of an ever-expanding canvas**: the user may travel away from it and return, without forcing all canvas content into one screen.

**Cluster:** a set of spatially associated frames/objects. The system may generate an opaque ID (for example `cluster-131g23g4uy`) and an optional friendly name. Automatic clustering must be deterministic or explicitly user-confirmed when ambiguous; do not silently move or duplicate files to create a cluster. Cluster relationships are revisable without breaking stable frame IDs.

**Location/bookmark:** a named world coordinate or bounded region to which the camera can jump. Not every location is a desktop, and not every jump requires unloading or restoring documents.

**Saved workspace/snapshot:** a persistent arrangement and application state using existing capture/restore mechanisms. A desktop may reference a snapshot; it need not embed a separate copy of every underlying file.

Give each object a stable, generated ID separate from its user-editable name and rendered map position. Renaming a kingdom or moving its castle on a map must never break links to the desktop or its documents.

## 5. Turn a snapshot or an empty region into a desktop

Offer a user action such as **Save Snapshot → Make This a Desktop**, alongside **Make This Location a Desktop** for an empty region. Capture or reference existing workspace state through the canonical snapshot mechanism. Record at least: stable desktop ID, name, owning world ID, home coordinate/region, background/canvas skin, anchor state, destination icon/asset, applicable snapshot reference, member frame references, creation/update metadata, and recovery status.

A desktop may be promoted from a cluster or created without any open frames. New destinations should be immediately discoverable via right-click switching and the world map. The user may later rename, relabel, reposition, unanchor, archive, or remove a destination. **Removing a navigation destination does not delete its source PDF/DOCX/media files.**

An anchored desktop prevents accidental movement of its home region or chosen icon/layout anchors, **not** the user's ability to pan/expand the surrounding canvas. Treat layout anchoring separately from encryption or document-access locks.

Before switching to a saved workspace that replaces active application instances, checkpoint unsaved work and preserve recovery state. If checkpoint or restoration fails, keep the previous state recoverable, report the error, and do not claim success. Jumping to another location within the same live workspace should not unnecessarily close and recreate frames.

## 6. Navigation: instant and spatial are equivalent

All ways of reaching a destination must share **one** camera and destination service:
- right-click canvas → Return to Desktop / Switch Desktop / Open World Map / Save Current View as Desktop / Create New Desktop;
- a searchable or compact destination list and optional keyboard shortcuts;
- pan/zoom and dragging empty canvas, without requiring users to grab an application window;
- a small navigation companion (initially, perhaps a turtle carrying a pack or tiny GIF asset) that the user can grab to pan;
- optional walk/drive/fly travel skins and map markers;
- an authorized agent request to focus a frame, travel to a desktop, or inspect its position.

The gamey travel is **optional and never the only route**. Users can anchor their desktops, hide companions/maps completely, and switch with one right-click. Camera movements must preserve application-frame world positions and PDF/DOCX editing coordinates.

A future airship/vehicle mode can animate movement across a stylized world. **Landing** may establish a new desktop at that coordinate or simply park at a saved location; it must not automatically snapshot, save, or lock anything without the user's chosen action. Animation failure must not corrupt destination state.

Navigation companions have replaceable sprite/asset manifests and presentation states, but the same travel commands. A mascot is not an app-frame drag handle. Its hit targets and modes must not steal pointer events from text selection, resize handles, dropped images, or active PDF edits. Offer reduced-motion and hidden/instant modes.

## 7. Coordinate correctness and collision rules

Document the mapping between:
- persistent **world space** for frames, desktops, clusters, and landmarks;
- **camera space** for current pan/zoom and focused region;
- **viewport/screen space** for input, hit testing, overlay placement, and rendered pixels;
- application-local coordinate systems already used by PDF and DOCX.

Prefer a single, testable transform pipeline with inverse mapping. Do not maintain separate scroll mathematics in the turtle, right-click menu, map, and legacy window-drag implementation. Diagnose and prevent prior unwanted recentering and leftward-drag/toolbar-hidden regressions. Keep frame geometry stable when a canvas skin changes or the camera moves.

Use measured, deterministic width **and** height layout states for desktops/menus/companions, just as for individual frame chrome. Ensure essential controls remain reachable, title/menu/icons do not collide, and map overlays do not obscure core editing UI. Decorative corner art should scale through explicit nine-slice or anchored geometry rules where appropriate, not indiscriminate image stretching.

For large worlds, support sparse positions and floating origins or comparable stable transforms if needed; do not rely on a single endlessly growing DOM box whose numeric dimensions eventually overflow practical limits.

## 8. Agent-native model and capabilities

Agents should not need to guess whether an on-screen castle is a decorative tree, a destination, an open document, or a private workspace. Expose typed, stable, versioned records and discoverable contracts for:

- world, desktop, cluster, bookmark, scenery/decorative object, frame, and navigation companion;
- identity, user-visible label, semantic role, ownership/parent relationships, world coordinates, bounds, anchor/movable state, renderer and skin metadata, and loaded/saved/visible status;
- association between a map landmark and its real destination ID;
- camera transforms, viewport bounds, active desktop, and available operations;
- current canvas-skin ID and frame-skin IDs as **independent** preferences;
- logical destination graph, optional route metadata, and navigation history.

Prefer documented read-only APIs for discovery, with explicit user-permission-gated commands for navigation or modification. All commands should validate IDs and preconditions, report successes/failures truthfully, and record bounded meaningful trace events rather than floods of animation-frame logs. No agent should need to "drive the turtle" to get to a desktop programmatically.

Where visual verification is needed, offer a bounded, permission-checked viewport/region capture with image dimensions, camera transform, and visible object IDs. This complements the semantic world model; **screenshots are not the canonical representation**.

Private/locked worlds and workspaces must not leak protected document contents, names, thumbnails, member IDs, or existence metadata beyond the user's granted access. Agent tokens must honor lock state and current permissions.

## 9. Persistence and performance

Store spatial metadata separately from large document bytes. Reference canonical source objects or existing working copies where possible. Do not duplicate a PDF whenever a desktop or castle is created. Capture world registries, destination identities, appearance preferences, camera/home state, and snapshot relationships in a versioned, backwards-compatible schema. Older workspaces lacking Worlds metadata load as an ordinary single-workspace canvas with a default home.

Render only visible or nearby scenery, map tiles, and active frames. Represent distant desktops in the map using lightweight metadata/previews and load heavy applications only when needed. Do not keep every PDF parser, media player, or DOCX model active because it has a landmark in the world. Keep the default experience fast on modest hardware and avoid mandatory large game-engine dependencies.

Provide user controls for animations, companion visibility, decorative density, performance tier, and reduced-motion compatibility. A complete professional, plain-background experience must remain available.

## 10. Product and rollout sequence

**Phase A — canvas contract.** Document existing navigation; establish independent canvas CSS/presentation, shared world/camera/viewport transforms, inspection hooks, and no-regression tests. Do not ship RPG mechanics yet.

**Phase B — home and destinations.** Add stable home/desktop IDs, desktop registration from snapshots or locations, anchor/unanchor, Return to Desktop, and instant right-click switching. Restore work safely.

**Phase C — companion and spatial controls.** Make empty-canvas panning intuitive and add a replaceable, optional turtle/handle that uses the same camera service. Fix any prior recentering problems before polishing animation.

**Phase D — world map and graphical presentation.** Render registered desktops as landmarks in a simple optional map; later support customizable SNES-style/retro-futurist map art, paths, buildings, walking, driving, and airships. Use original or appropriately licensed assets, not shipped copies of proprietary game sprites.

**Phase E — user/agent world authoring.** Let users arrange scenery, customize companions, assign landmarks and skins, and let authorized agents create or modify supported world objects through validated contracts. Keep functional workspaces and security independent from decorative assets.

A first milestone is complete when users can create two named desktop destinations from ordinary workspace state, anchor one, travel or pan to the other, and return via one right-click without moving their document frames, losing edits, or depending on an animation. An agent can inspect both desktops, the current camera, and the rendered destination correspondence without reading protected documents.

## 11. Non-regression acceptance criteria

- PDF/DOCX reading, editing, export, working-copy restoration, and document geometry remain intact.
- Image/media/gallery/frame drag-and-drop, focus, resize, maximize, fixed-to-viewport modes, and per-frame skin overrides continue to work.
- World/navigation operations do not induce viewport recentering, title-bar loss, object overlap, or document-coordinate drift.
- Ordinary workspace snapshots, duplicates, and existing saved projects still load.
- Switches between independent saved workspaces checkpoint unsaved state and preserve a valid recovery route on failure.
- World skins and frame skins never silently change a document's stored formatting or actual file bytes.
- Hidden or locked destinations remain outside unauthorized agent/file inspection.
- At each supported layout size and input mode, there is a functional, non-game method to reach any registered permitted desktop.

**Final principle:** **WORLDS (R)END** is about **rendering** an ordinary, dependable workspace as a world worth inhabiting. The canvas is the foundation; desktops are places; skins give those places character; navigation connects them; files and applications are why the places matter.
