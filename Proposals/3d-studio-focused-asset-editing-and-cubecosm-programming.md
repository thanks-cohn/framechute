# Proposal: 3D Studio and Cubecosm Programming
## Focused asset editing, autosaved local creations, and programmable world zones

**Status:** Proposed, not yet implemented.  
**Homes:** `thanks-cohn/framechute/Proposals/` and `thanks-cohn/substrate/Proposals/`.  
**Related proposals:** `omni-world-engine-neutral-2-5d-worlds-rend.md`, `semantic-world-engine-agent-native-spatial-ir.md`, `omni-behavior-language-semantic-action-compiler.md`, and the spatial desktop/worlds proposals.

## Vision

SUBSTRATE should let someone start as a user customizing their desktop, become an asset creator simply by changing what they imported, and, if they wish, become a game developer or programmer inside their own world. The default experience is almost effortless; advanced creators are not limited to a fixed catalog of game mechanics. The same creations can be used in the Chrome extension and the Electron desktop app when their declared capabilities are supported.

**Two complementary ideas:** (1) Select a ship, hallway, building, character, or other object; right-click **3D Studio**; reshape and color it; return to the world with an autosaved, reusable local asset. (2) Designate a cube-shaped programmable zone in the world—**their own little Cubecosm**—whose custom code governs simulations, logic, effects, or interactions in that space.

## 1. The 3D Studio interaction

1. Select an existing or imported compatible 3D object. Right-click → **3D Studio**. No separate Blender-like application or compulsory new project workflow.
2. The *surrounding world theatrically fades to near-black* while the object stays illuminated and the camera approaches it. Preserve the world, active documents, object identity, transform, and original camera state; do not delete or alter the background.
3. Move into a lightweight editing scene with minimal contextual controls. The user's attention and the active editor are concentrated on one object. They may return to the world at any time.
4. Select one vertex, edge, or polygon; multi-select faces; or use lasso, connected-region selection, selection grow/shrink, add/subtract/invert, and optional symmetry. A selected region can itself become the focus: nonselected geometry is dim/ghosted and temporarily protected from editing, but remains visible as context and is not deleted.
5. Use a small number of composable gestures: **push, pull, squash, stretch**, move, scale, rotate, extrude, inset, bevel, cut/subdivide, smooth/flatten, duplicate/repeat, mirror and optional soft-selection. Make it clear whether dragging a surface moves existing geometry or extrudes new geometry. Offer snapping and optional numerical transforms for precision without overcrowding the UI.
6. **Color and texture individual polygon faces or selected polygon regions.** Click just one face and set its color; lasso part of a low-poly ship or wall and apply a different color, texture, or material only there. Include simple palette/material presets, eyedropper, copy style, fill connected/similar, and later basic texture scale/rotate/tiling, projection/UV tools, and glow/emissive. Per-face color is a primary experience, not a buried advanced tool.
7. Click **Done** and restore the camera/world with a reverse fade. The edited asset remains in place and in the user's asset library; users can save a non-destructive variant or decide whether to update only the selected instance versus linked instances. They can reopen it to continue editing.

This identical flow covers structures and architectural sections, including modular corridors, walls, doorways, rooms, and ships. A novice can recolor one polygon in seconds; a skilled creator can build complexity through repeated combinations of the same operations.

## 2. Real focused processing, not just a black overlay

On entry, pause irrelevant world gameplay, physics, animations and simulation; stop unnecessary background rendering and release expendable GPU resources where safe. Render one selected object in a low-cost editing viewport, with out-of-focus portions of that object idle and protected. Preserve all canonical world, frame and document state, and restore it reliably on exit. Use region-local mesh updates when they actually help.

The darkness alone does **not** free CPU/GPU resources; implement real scheduling/suspension. Connected mesh boundaries, normals, bounds, collision, UVs and topology sometimes require updates outside the selected region. A single low-poly mesh should be practical on a 4 GB RAM system under sensible resource budgets, but huge imported geometry, textures, other open tabs and undo history still consume memory. Offer low-memory settings, budgeted caches, explicit save status and recovery; never promise every asset can run on every device.

Imported GLB/glTF models may contain multiple meshes, duplicated seam vertices, rigs, animations and existing texture coordinates. The first implementation should handle editable polygon geometry and document or guard incompatible operations; automatic retopology/remeshing is a later enhancement, not a prerequisite to editing a normal polygon mesh.

## 3. Automatic local ownership and asset lifecycle

**Autosave is ON by default and can be turned OFF in Settings.** The user should never be required to perform a manual Save As just to retain an ordinary 3D Studio edit. Save committed edits with sensible debouncing and recoverable checkpoints, not every pointer movement. Clearly display Saving / Saved locally / Save failed / Storage full; never claim a successful save before it completes. If autosave is off, warn about unsaved work before exiting.

Retain a stable asset ID, the imported source, editable project state (mesh/topology, per-face materials, metadata and useful revisions), optional variants, thumbnail and provenance. Export a portable GLB for supported models, but do not confuse GLB with a full editor project or complete game-logic package. Avoid overwriting every placed copy when the user meant to change only one.

**Electron desktop:** after an initial user-authorized library-directory choice, automatically write durable draft assets and compatible exports to the user's computer with atomic writes and recovery; offer Reveal in Folder, Export and Change Library Folder. Respect filesystem permissions.

**Chrome extension:** autosave locally in durable extension-managed browser storage as appropriate, accounting for quota, browser-profile loss and recovery; offer explicit download/export, supported user-granted directory access, or an optional authorized native companion for syncing. Do not claim an extension can silently write arbitrary files anywhere on the computer. Explain whether an asset is saved in the browser profile or exported as a normal disk file.

Distinguish **Save Draft**, **Use/Publish to My Assets Now** (private asset-library availability), and **Publicly Share/Publish/Sell**. Autosaving or clicking Done must never automatically upload an asset or make it public. Users own and can reuse, duplicate, export, and share their authorized creations. Clearly track original third-party asset provenance and licenses where applicable.

## 4. Cubecosm Programming — their own little Cubecosm

**Exact name: Cubecosm** (not “Cubcosm”). A creator draws/selects a cube-shaped 3D region in a world and chooses **Create Cubecosm / Program This Zone**. This region becomes a clearly visible, stable-ID programmable domain with bounds, location, objects, dependencies, state, rules, and a scoped capability manifest. The cube is an intuitive starting shape and spatial authoring metaphor; other zone shapes may be supported later.

A Cubecosm can define its own event handling, simulations, graphics effects, interactive rules, procedural geometry, custom game mechanics, AI/NPC behaviors, physics conditions, and local environment state. Imagine a zero-gravity spaceship chamber, an ecosystem, a shop, an animated theatrical event, a puzzle, a complex minigame, or a changing architectural structure programmed entirely by its creator.

**Flow:** draw/select cube → enter its focused zone editor → attach assets, choose starter behavior or author a visual event graph → add custom code if desired → preview/test inside the zone → automatically save the draft locally → immediately use it in the world or explicitly publish/share it.

Expose versioned events such as `onEnter`, `onExit`, `onInteract`, `onTick`, and validated cross-zone messages. Zone boundaries are explicit: decide how objects, people, physics, light, audio, and events interact across boundaries; do not pretend drawing a cube magically isolates everything computationally.

**Progressive openness:** beginners use presets and visual logic; programmers can implement their own JavaScript/TypeScript systems and optional C++/Rust-to-WebAssembly modules through a versioned SDK for objects, world state, events, input, rendering, physics hooks, messaging and serialization. A sophisticated Cubecosm can be computationally ambitious; actual limits arise from available hardware, host runtime and user-authorized permissions rather than an arbitrary ceiling on the kinds of logic creators may express. Custom modules and behaviors can themselves become reusable assets for other creators.

**Scheduling:** prioritize active/in-view zones, pause or reduce update rates for irrelevant regions, budget memory/CPU/GPU, support suitable worker/WASM workloads, and make expensive simulations opt-in or degradable on low-end devices. A zone is an execution and editing scope, not guaranteed physical resource isolation.

**Security:** downloaded user code must execute separately from privileged Chrome extension APIs and Electron/Node/native capabilities. Chrome extension Manifest V3 and store rules constrain executable remote code; use a compliant unprivileged game host or other reviewed architecture for arbitrary downloaded programs rather than granting extension privileges. Desktop-only native integrations require explicit installation/permission. A world package declares required capabilities and degrades or reports incompatibility honestly when opened on another host.

## 5. Portable world and engine architecture

Start with a shared TypeScript + Babylon.js 3D editor/game runtime where practical, GLB/glTF for portable models, and a separate versioned SUBSTRATE world/project format for scene identity, object transforms, editable assets, game logic, Cubecosm zones, dependencies, capability requirements and persistence. Babylon.js is a default renderer/runtime, not the canonical owner of world objects. Support future 2D or alternate 3D backends through adapters where semantics and capabilities overlap.

Electron desktop and Chrome extension should load the *same compatible* assets and worlds through host-specific storage and permissions. More demanding worlds may declare extra hardware, code-runtime or native capability requirements rather than being forced into a lowest-common-denominator limit. An advanced creator may make an intricate Cubecosm for desktop hardware even if it cannot run identically in the extension.

One creator can customize a hallway in 3D Studio, save it instantly, assemble it with other assets into a world, add a Cubecosm whose code governs that room, then publish a portable game or desktop experience. The editor, desktop and game-development platform are different uses of the same authoring environment.

## 6. Suggested milestones / acceptance tests

1. Right-click imported low-poly object → 3D Studio → fade the surrounding world → actually pause extraneous world work → return with camera, document frames and original object placement preserved.
2. Select **one polygon**, color it; lasso several polygons, texture only them; push/pull or squash/stretch only the active region with nonselected geometry protected and connected boundaries intact; undo/redo.
3. Recolor and reshape an imported modular hallway; leave Studio without pressing Save; reopen and find the saved local editable asset and corresponding world instance. Demonstrate autosave OFF and honest failure/recovery states.
4. Open the same compatible asset in Electron and the extension and verify host-specific local persistence/export behavior without falsely claiming unrestricted Chrome filesystem access.
5. Define a Cubecosm cube, attach an onEnter event, run a custom effect or zero-gravity rule within its boundaries, exit and restore ordinary world behavior, save/reload its program and state.
6. Run an advanced creator-supplied JS/WASM zone through the appropriate isolated runtime with scoped permissions and declared hardware/capability requirements; verify the game cannot acquire native or extension privileges just by being imported.

**North star:** Select a ship → 3D Studio → the world goes dark → shape and color one region → Done → it is already your local asset. Then select a region of the world → create your own little **Cubecosm** → give that space whatever sophisticated behavior you can program.
