# Saeki — Generate, Draw, Enter, Build

**Status:** Product and implementation proposal, not a shipped feature.  
**Date:** 2026-09-24  
**Applies to:** Tiled-223D, SUBSTRATE and FrameChute.  
**Companions:** [Saeki in-world block editing and Tiled round trip](saeki-in-world-block-editor-tiled-round-trip.md), [EARTH stages](../Stages/README.md), [shape-aware insertion](aexis-shape-aware-map-insertion-stage-4-glb-placement.md).

## Product promise

Open Saeki and choose **Start with a world**, **Generate a world**, or **Import a map**. The first two paths require no Tiled installation. A built-in browser 2D editor offers quick painting and inspection of land, water and height views. Enter the same world in 3D, land, and build with immediate block actions. Return to the overhead view and see what changed. Save and reopen the same project in Chrome or in the Electron desktop shell; export an editable Tiled map when desired. Tiled is a powerful optional authoring/interchange route, not the entrance fee.

Longer term, the 2D view can become a beautiful illustrated or 2.5D representation of recognized world bodies, rather than a raw grid. Changes in that representation may become genuine world edits only when tied to explicit semantic geometry. A storybook-style transition from 2D to 3D, avatar presence, shared building and customizable floating helper hands are future experience layers, not prerequisites for the first builder.

## The comparison that clarifies Saeki

| Inspiration | Useful idea | What Saeki adds or changes |
| --- | --- | --- |
| **Civilization on SNES / early Civilization** | The pleasure of receiving a readable 2D geography, seeing coastlines and land relationships at a glance, then imagining what could happen there. This is an experiential reference, not a claim that Saeki uses its source code or exactly reproduces its map algorithm. | Saeki makes the map editable and enterable. It becomes a physical place rather than only a strategic overview. |
| **Civilization IV** | A generated world with legible geography and useful map choices: landmass shape, water, climate, terrain and likely settlement sites. | Saeki turns its own 2D geography into a height-aware 3D world. It offers no promise of Civilization's empire simulation, technology, turns or rules. |
| **Minecraft** | Arrive in a generated world, walk around, place or remove blocks, and make persistent changes with friends. | Saeki starts with a world that can also be authored from above, exported to Tiled and projected into meaningful height maps; later it may offer illustrated 2.5D views of recognized structures. No crafting, survival, mobs or infinite-world promise is implied. |

This is an original Saeki pipeline inspired by the *experience* of those games. Do not ship their assets, names as product branding, code or exact map scripts without separate rights review.

## One project, three entrances, two editors

1. **Default:** ship a small, appealing, bounded world with a safe landing/building area and enough variety to invite exploration. First launch can go straight to it. Preserve its canonical seed/source version and starter project separately from the user's edits.
2. **Generate:** offer a few meaningful choices, initially world size within a tested budget, island/continent/plain shape, water amount, hilliness and a seed. Generate a semantic 2D map first, then bounded numeric elevations and a 3D preview. Show the seed and a low-cost overhead preview before accepting. Preserve the result so changing generator code never silently changes an existing saved world.
3. **Import:** accept a supported ordinary Tiled map and an optional elevation companion, including the existing `Additions` assembly path. Eventually accept the Tiled extension's `.sworld.json` through a documented adapter. Give readable errors for unknown tilesets, IDs and unsupported geometry.

Each entrance yields one versioned **canonical world/project record**: world ID and revision, map dimensions and tile units, terrain semantics, authored numeric heights, water, seed and generator version where applicable, immutable/protected source areas, block occupancy at integer X/Y/Z, material palette, shape and object IDs, semantic cluster IDs, asset references and edit history or reversible deltas. Keep the generated base and authored edits distinct. A paint stroke in 2D and a placed block in 3D call the same validated command layer and update the same record. Rendering meshes, map images and Tiled files are projections of that record, not separate mutable truths.

**Browser 2D editor:** initially pan/zoom, paint/erase land or water, select palette and height band, inspect cells and cluster identities, change a block or its material at a selected level, undo/redo, preview and save. Offer simple shapes/region tools later, compatible with the EARTH shapes proposal. Show protected/generated/manual state, elevation and any conflicts. Editing an original terrain cell, an authored block and a cluster reference are different commands; do not let a cosmetic paint stroke accidentally remove a bridge or overwrite height data.

**In-world 3D builder:** enter or land, select Build mode, aim at a face/ground, preview the target coordinate and place/remove/repaint with immediate feedback. Floating oversized helper hands are an optional default visual/input avatar independent of the player's chosen body avatar; their gestures do not determine persistence. On edit, update block data, collision, dirty render chunks and the overhead view. Basic desktop editing works in the browser renderer; Electron adds scoped local project access. A networked session later relays the same validated edit commands and revisions to other avatars.

## Height views and recognized bodies

Keep **cluster identity before projection**. A tower is one semantic body with a stable ID, members and minimum/maximum Y; its ground floor and rooftop can appear on different height views without becoming two towers. Generate meaningful 2D height bands from explicit world-space boundaries, not one unrelated map per arbitrary block. A band shows the cross-section, footprint or surface of every body intersecting it. Preserve the exact block-level occupancy for lossless editing. The UI may present height bands as a layer slider or several map pages; Tiled export can use named layers first, then an optional per-band map plus manifest. See the companion Saeki proposal for the interchange rules.

A later image/2.5D renderer may choose a side camera that best reveals a cluster, draw a stylized map image, and link selectable image regions to its cluster and geometry IDs. Its picture is an editable *projection* only where correspondences are defined. A white-out/storybook page-opening transition can reveal the same 3D coordinates, but visual beauty must never conceal a failed data round trip.

## Implementation plan, grounded in the current repository

The inspected Tiled-223D baseline is a Vite/Three.js browser flight prototype: `src/world-data.js` owns `ground` and numeric `heights`; `src/terrain.js` renders a height surface; `src/main.js` imports ordinary Tiled JSON; `extension/substrate-world.js` exports a distinct semantic `.sworld.json`; `scripts/assemble-low-world.mjs` provides a narrow `Additions` insertion path. There is no built-in terrain painter, persistent 3D block editor, Electron wrapper, multiplayer or automatic side-profile image pipeline. Do not mark these features complete merely because the proposals exist.

1. **Shared model and command contract:** define versioned world schema, `paintTerrain`, `setHeight`, `placeBlock`, `removeBlock`, `repaintBlock`, `assignCluster`, undo/redo, validation and reversible deltas. Resolve the existing `.sworld.json` versus viewer-import mismatch. Keep existing map import and low-ground assembly working.
2. **Default world and 2D editor:** provide one saved default world and a lean in-browser map canvas with paint, erase, palette, height inspection, save/reload and undo. Prove that a 2D edit changes canonical data and its 3D render without a second conversion path.
3. **Small deterministic generator:** generate semantic 2D geography and separately numeric heights from documented constraints/seed. Ensure coast, rivers if offered, safe landing/build sites and height transitions satisfy validation. Preview → accept writes an immutable base plus later manual edits. Reopening never rerolls accepted terrain.
4. **In-world builder and round trip:** implement the companion block/chunk/editor plan; import/export Tiled height layers and reimport losslessly. Test a 2D terrain edit, 3D stacked/floating edits, and return to 2D in one session. Preserve Tiled-only object layers/tilesets or give a blocking error, never quietly drop them.
5. **Electron packaging and browser parity:** use the same renderer and command implementation in Chrome and Electron; Electron supplies only limited file dialogs/project IO. Test Windows 4 GB integrated graphics on both. Measure cold start, RAM/JS heap, p50/p95 frame time, single edit latency, generator preview duration and export/reimport time on bounded scenes; publish actual observations rather than promises.
6. **Illustrated maps and shared worlds later:** semantic cluster side-profile capture, 2.5D correspondences, storybook reveal, avatars, gestures/custom hands, permissions and multiplayer synchronization. A server or equivalent authoritative session is required for real-time shared edits; a local Electron file alone cannot synchronize friends.

## Acceptance and benefit

**First creator path:** start without Tiled → load the default world → paint a 2D land cell → see the result in 3D → land and stack blocks → return to the correct overhead/height view → save → reopen with identical terrain, heights and blocks. A generated path with a fixed seed reproduces its accepted base and retains hand edits. An imported Tiled path preserves its own geography through the same editing commands. No path silently discards another path's semantics.

**Why it helps:** newcomers can build immediately; careful map makers retain Tiled; the 2D overview makes geography and structure legible; the 3D world gives those decisions presence and scale; one shared model keeps both views and future collaboration coherent. The low-end-first budget keeps the creative entrance open on modest hardware, subject to measured results.

### Reference points

- [Official Civilization IV overview](https://civilization.com/civilization-4/) and [official Civilization II overview on map authoring](https://civilization.com/civilization-2/).
- [Minecraft's official seed picker description](https://feedback.minecraft.net/hc/en-us/articles/4412081055629-Minecraft-Bedrock-Edition-Seed-Picker-FAQ) and [official world settings discussion](https://www.minecraft.net/en-us/article/let-s-play--more-tools).

These references establish the inspirations, not an implementation dependency or an equivalence claim.
