# WORLDS (R)END — A Personal Digital Home

**Status:** Design proposal / future development, not an implemented feature.  
**Repositories:** SUBSTRATE and FrameChute.  
**Related proposals:** `Proposals/omni-world-engine-neutral-2-5d-worlds-rend.md`, `Proposals/worlds-rend-multiscale-perspectives-descent-and-engine-handoff.md`, and `Proposals/omni-behavior-language-semantic-action-compiler.md`.

## Vision

Let a person **build a home for their digital life**: a little cottage, apartment, spaceship, island, village, or other personal place that they can design, furnish, traverse, revisit, and—only when deliberately authorized—invite others into. Locations connect to real computing activities rather than serving as decorations. A writer can return to the stream where they left their poems; a family room can display selected photographs; an upstairs study can open research notes; a workshop can link to an actual project. Files remain ordinary files, opened with SUBSTRATE's existing applications, not locked into a game format.

The user can explore as a 2D RPG character, look down on a 2.5D isometric home, or descend into an optional first-person/third-person 3D scene. Choose the mode based on preference, available authored representations, hardware, and accessibility needs. Provide a conventional menu, search, and direct-link navigation path for every destination: walking to a file must be fun, never mandatory.

## A home is a persistent semantic place, not one heavy game scene

Use an authoritative, engine-independent world/home manifest with stable IDs for home → outdoor zones → buildings → rooms → objects → linked resources. Each zone has parent/local transforms, bounded geometry, a supported representation list, explicit entrances/exits, a stable return point, optional lighting, and a set of *resource references* whose permission checks remain separate from the decorative world.

Example zones: garden and stream, study, family room, upstairs hall, workshop, and public porch. The place can be arranged spatially, and a single entrance may link to a separately loaded interior scene. Indoor and outdoor models need not all be resident at once. Changing style or renderer must not erase room identity, spatial bookmarks, relationships, local application state, or file references.

Use an explicit **zone graph** (room/region nodes and typed connection edges): door, stair, path, elevator, portal, direct shortcut. A transition changes the active zone and viewpoint while preserving world-state continuity. A low-end machine can transition with a brief doorway fade, crossfade, or instant jump; an advanced device can perform a longer camera descent when valid compatible assets exist. Every transition has a recoverable **Return to Desktop / Return to World** action.

## Spatial bookmarks and meaningful personal places

A spatial bookmark is a persistent, inspectable reference to a location and optionally a permitted resource, not just an x/y camera coordinate. Suggested fields: version, destination world/zone/object ID, preferred viewpoint and presentation mode, resource reference, descriptive label, sharing scope, and an explicit fallback if a room or visual asset is missing. Examples: “Go to the stream where I write poems,” “Open the family photographs downstairs,” and “Return to the desk where I left the article.”

A location may present one document or a curated collection. Moving a house or redecorating a room must not silently break the link. File access is resolved only when requested, with ordinary application permissions; moving a visual object does not move, overwrite, publish, or delete the actual local file. If a linked file has moved or is disconnected, show a reconnect prompt, not a broken world.

Allow creators to configure locations using ordinary controls such as “Attach file,” “Choose collection,” “Set as arrival point,” and “Make bookmark.” An agent can inspect the authorized location graph and request a typed navigation or open-resource action rather than guessing from screenshots.

## Authoring: make existing ecosystems approachable

Do not require users to model a whole game before making a home. Provide a few original, lightweight starter layouts and a guided “Create your home” experience: select a world type and graphics profile, import or choose a layout, inspect recognized rooms/entrances, connect doors and staircases, assign artworks and files to permitted objects, select a spawn point, and preview the result.

- **2D/2.5D:** Support an explicitly documented subset of Tiled tilemaps and associated asset packs through a converter to SUBSTRATE's own canonical zone, tile, and object representation. Preserve import provenance and stable source mappings; don't make a Tiled runtime or editor compulsory.
- **3D:** Support a documented, safe asset interchange path such as glTF/GLB for eligible models, with editable scale/origin, zone boundaries, collision/navigation geometry and doors. A mesh or 2D sprite alone does *not* provide unseen rooms, working doors, navigation, or an automatically reconstructed building. Let users author missing structure or select truthful simplified fallbacks.
- **Extensible engines:** Native lightweight display by default, optional adapters for tools such as Phaser and a future dedicated 3D renderer. External engines are renderers/authoring tools, not owners of the canonical world, files, permissions, clock, or semantic IDs.
- **Style conversion:** Different representations may share a zone identity, but require appropriate artwork and controls. Avoid promising automatic 2D→fully navigable 3D conversion when requisite geometry doesn't exist.

A house imported as a single external package should first become a **movable World Block**. Its rooms and decorations are registered as child objects with relative coordinates. Moving the parent preserves their internal positions and links; unattached desktop windows remain independent.

## Performance: zone-to-zone, hardware-adaptive, and local-first

An impressive-looking personal world must remain optional and affordable on a small computer. “An unlimited home” means as many **saved** zones as the user's storage permits, **not** unlimited simultaneous rendering.

1. **Load the active zone, not the whole property.** Keep a compact metadata/semantic manifest of all zones while rendering the current room and a bounded nearby/preloaded margin. A closed door can show a tiny low-cost view or static proxy of the next zone without running that entire scene.
2. **Resource budget.** Cap active textures, decoded images, meshes, dynamic characters, lights, effects, and renderer canvas dimensions. Use shared atlases, pooled/cached assets, frustum/occlusion culling when useful, simplified distant models, and explicit resource disposal after switching zones.
3. **One heavy renderer at a time.** When a ground-level 3D room is active, suspend expensive rendering and simulation for the overhead world; restore only what is needed on return. Keep document editing independent of either renderer and preserve its state.
4. **Adaptive tiers.** Low: compact 2D or simple isometric room, reduced device-pixel ratio, limited effects and animation, cheap contact shadows and instant/crossfade transitions. Balanced: selected 2.5D effects and a few animated elements. High: opt-in compatible 3D interiors, richer lighting, longer draw distance. Let a user force 2D or turn the world off. Hardware detection is imperfect; monitor actual frame times and context/resource failures, offer conservative fallbacks rather than promising crash-proof graphics.
5. **Slow world clock, event-driven simulation.** Shared environment time, global sun/moon state and preset day/night pacing may illuminate the active zone; dormant rooms do not need per-frame lighting, NPC or physics updates. Restore or sample their state when entered. Preserve normal PDF/DOCX readability independently of atmospheric lighting unless the user explicitly enables a reversible effect.
6. **Local behavior first.** Preset interactions and a bounded semantic behavior book should function offline. An external local or remote model is never needed to enter a room, open a file, or render the world; optional inference has explicit permissions and resource budgets.
7. **Recovery.** If a GPU context is lost, an import is malformed, an asset is absent or a 3D scene is too large, return to a working 2D/2.5D or ordinary desktop and keep the bookmark/resource accessible. Don't strand the user in a blocked doorway or discard unsaved document changes.

The browser extension should prioritize a lightweight, store-compatible baseline; a future opt-in desktop app may support more advanced native integration. No compulsory cloud rendering or remote computer is required for basic home navigation.

## Lighting and lived time

A home should feel like it has a real environment, with explicit light sources rather than an unrelated brightness filter. Outdoor and indoor zones may sample the same canonical world clock, sun/moon directions, location-inspired or custom time-cycle presets, and local lamps. Render only the lights that influence the active zone. The user can choose always-daylight, cozy overcast, real-time pacing, accelerated fantasy day, a manually frozen hour, or a location-inspired cycle without requiring exact real-world weather or location tracking. Keep lighting data independent of renderer and normal document pixels. If two zones show the same outdoor time, their appearances should remain semantically consistent while allowing deliberately different artistic styles.

## Privacy, files, and visitors

A public garden does not reveal the files in a private study. Shared homes and visitor modes publish an explicit permission-filtered world manifest and user-approved resources, not the owner's live unrestricted desktop. Merely seeing a document represented by an object does not grant access to the underlying file; authorization occurs when it is opened. No imported asset, world script, NPC, LLM response or visiting avatar receives arbitrary filesystem/browser access. Permit quick isolation of a room, expiring visitor access, and an always-available exit to a normal desktop.

## First practical demonstration and phased roadmap

**Phase 1 — first visible home:** keep current Sketch Town development separate; register a small cottage/study as a World Block or zone with a visible exterior, one linked ordinary document, a direct “Visit study / Return to World” command and one persistent spatial bookmark. No new game engine necessary. Verify that the file still opens in the real editor and survives a world-mode toggle.

**Phase 2 — zone transitions:** create a garden/stream and two small rooms, bounded active-zone loading and disposal, a room graph, camera/entry/exit points, and a concise authoring interface for assigning a poem and a photograph collection. A user can move between stream and family room on low-end hardware without rendering the entire house simultaneously.

**Phase 3 — optional compatible 3D interior:** one intentionally authored low-poly house and a single room with an entrance, selectable ground-level mode and reliable return to the overview. Test resource budgets and browser/context failure fallbacks; 2D mode remains fully functional.

**Phase 4 — creator imports and world sharing:** support further documented Tiled/3D import subsets, straightforward editing, saved presets, authorized visitor zones, future avatar/world-style adapters and personal-local-LLM enhancements only where they add real value.

### Acceptance criteria

- A user can attach a real DOCX poem to a named stream location, leave, come back through a bookmark or short walk, and open the same document in the normal readable/editable application.
- A room with family photographs can be visited independently without loading all exterior, upper-floor, or alternate 3D resources; loading-state, memory and performance behavior are observable.
- The same home retains stable room/object/file references after the user moves its World Block, changes rendering quality, switches 2D/2.5D/compatible 3D, or uses Return to Desktop.
- Opening a file works via a direct menu/search action without requiring traversal or gamepad controls.
- Unavailable models, assets or advanced hardware cause a clear lower-cost fallback without losing access to files, and private content stays private unless separately shared.

**Guiding principle:** Users design a home for their digital lives, and SUBSTRATE makes that home navigable, useful and available across different hardware — one place and one active zone at a time.
