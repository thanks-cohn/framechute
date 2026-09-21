# SNE:OS — Interchangeable Neo-Desktops, One-Click World Imports, and Liquid Mode

**Status:** Proposal / phased design, not an assertion that these features already exist.  
**Product:** SNE:OS — Simulated Neo Environments Operating System, evolving from SUBSTRATE / FrameChute.  
**Initial prototype:** `sne-os-floating-island-v0` in FrameChute; existing editable desktop and separate playable 2D town remain the starting point.  
**Related proposals:** `omni-world-engine-neutral-2-5d-worlds-rend.md`, `worlds-rend-multiscale-perspectives-descent-and-engine-handoff.md`, `semantic-world-engine-agent-native-spatial-ir.md`, `agent-native-shared-workspace-tab-scoped-autonomy.md`.

## 1. The product promise

SNE:OS should let a user **upload assets and take control of the appearance, behavior, navigation, and presentation of their personal neo-desktop**. The world is an interchangeable presentation over the same persistent documents, workspaces and permissions, not a replacement for the document engine. A simple world should work without code; an advanced creator should be able to build complex interactive experiences by attaching scripts and assets in **Liquid Mode**.

**The essential nontechnical flow:**

1. Download a compatible floating-island GLB from Sketchfab or another source, under terms that permit the intended use.
2. Open **Settings → World / Background → Change 3D Background**, then select the downloaded file.
3. Preview the model and choose **Apply**. Voilà: the new island is floating in the SNE:OS desktop background, with space, lighting, rotation and inspection controls. Its default camera automatically fits the newly imported model.
4. Continue using the *same* real PDF/DOCX windows and other desktop content. The selected world persists on reopening the app. **Undo / Previous World / Classic Desktop** remain available.

A compatible standalone GLB must require **no GitHub upload, source-code change, rebuild, command line, conversion step, or Liquid Mode configuration**. A user can change the island tomorrow just as easily. Support packaged glTF with referenced textures as an additional, clearly guided import path later. A 3D scene should be shown by default whenever the user has enabled that preference, including on a cold launch rather than appearing only after refresh. Defer nonessential animation while loading but do not leave a misleading white canvas; show a dark loading state, then the scene or an explicit recoverable error.

The first-click behavior is *inspection*, not teleportation: drag rotates the island, click zooms toward it, mouse wheel and + / − zoom in or out, and Reset restores an intelligible view. A game or desktop entry occurs only at an explicitly configured location/interaction (or via a clearly labeled manual shortcut).

## 2. Importable and replaceable asset library

Use established interchange formats whenever feasible:

| Purpose | Initial formats | Intended behavior |
| --- | --- | --- |
| 3D environments and objects | glTF 2.0 / GLB | Preview, load, rotate, zoom, replace, reuse |
| Video transitions | MP4 / WebM | Import, assign to route, play, skip, replace |
| Background images, textures, skies | PNG / JPEG / WebP | Import and assign |
| 2D scenes and tilesets | Tiled JSON / TMX with referenced assets | Supported via separate 2D adapter as the importer matures |
| World, route, camera and hotspot definitions | Versioned, documented JSON | Portable configuration, independent of model files |
| Advanced behavior | Locally installed JavaScript modules and accompanying assets | Liquid Mode only, with sandbox and capability controls |

An **Asset Library** must retain stable asset IDs, origin/author/license notes, version, type, size and dependency metadata. Imports are validated, previewed and stored in persistent local browser storage or an explicitly approved local folder—not hardcoded source paths, ephemeral object URLs, or giant localStorage strings. Let users reuse or remove assets without copying or deleting their actual documents. Model and scene replacement should be atomic: preserve the previous working selection until the new asset is successfully loaded and previewed.

Automatically compute a new model's bounds, center, scale and camera fit; allow the user to save its preferred angle, scale, orbit constraints, lighting, background and zoom limits. Handle oversized, malformed, unsupported or texture-heavy assets with bounded budgets and helpful diagnostics. Underpowered machines should have lower-quality/paused-animation options, but these are preferences rather than different underlying desktops.

## 3. World locations, hotspots, destinations and user-controlled routing

Expose a visual **Edit World** mode. Selecting an authored mesh/node, or placing a hotspot on a model without separate interactive meshes, opens a plain-language panel: **Name → When activated → Transition → Destination**. Unassigned portions of the island remain freely inspectable.

Examples:
- Academy entrance → optional camera/video cutaway → the existing 2D town.
- Lighthouse → directly open the user's research desktop.
- Tavern upstairs dark door → named private workspace or game scene.
- Same location + different typed or spoken phrase → different authorized desktop.
- Arranging objects at a certain location → reveal a hidden entrance.

Use stable SNE:OS IDs for locations, workspaces, routes, destinations and transition assets. Replacing the 3D model preserves the destinations and scripts but offers a remapping UI for changed or missing physical hotspots; never silently attach a private desktop to a random mesh in the new model. Model names can help suggest mappings, but require user confirmation where identity is uncertain.

**Canonical flow:** `interaction → condition/route resolver → optional transition → destination`. The renderer detects the visual event, while the router decides the destination. A location is not inherently a PDF, a game, or a desktop: its assignment can change through Settings without rewriting renderer code.

A hidden path or ritual is a playful discovery mechanism, **not** genuine authentication. Optional passwords and encryption must guard real private resources separately. Users must always retain an authorized, non-game method to recover their files.

## 4. Interchangeable transitions, including 2D-world entrances

Each route can select its own independent transition:

- Built-in fade/zoom/approach sequence as a reliable default.
- An uploaded MP4/WebM that plays before arrival in a 2D scene, conventional desktop, or another world.
- A later, native Three.js sequence: move the camera, turn the island, enter a specific building or portal, then hand off to another renderer.
- Future timeline, shader, image-sequence or other transition adapters, without changing destination IDs.

A transition is a **replaceable asset/effect**, not hardwired inside a destination or model. Expose preview, duration/end behavior, progress, skip, cancel, reduced-motion alternative, timeout/error fallback and return behavior. A broken or missing MP4 cannot trap a person away from their real desktop. Avoid Adobe Flash Player dependencies; a Flash-like visual style can be authored in modern browser-compatible formats.

The existing 2D prototype is entered through a selected *entrance* or explicit **Open 2D World** action, not by clicking any arbitrary part of the island. Its rendering runtime remains a replaceable adapter. The broader canvas/overworld can remain the simple initial travel presentation.

## 5. Liquid Mode — the open scripting surface

The standard editor covers uploads, environment replacement, hotspot placement, route assignment and basic conditions **without requiring code**. An **Advanced → Liquid Mode** switch exposes a substantially more open creative surface for those who want to script their environment, wire up complex animations, attach shaders or physics, import compatible modules, and program custom events.

**Do not invent a bespoke API wrapper for every Three.js feature.** In the creator's isolated world runtime, expose supported native scene primitives, camera/light/object controls, imported assets and event/lifecycle hooks (initialize, interact, update, suspend, dispose). Let authors program geometry, materials, particles, procedural scenes and complex game behavior using documented, locally installed libraries where feasible. Keep the world definition, script modules and data in independently replaceable files, with editing, preview and debugging controls.

**Do implement a deliberately small SNE:OS-specific capability bridge** for actions that touch the real application: open a permitted desktop or document, switch worlds, invoke a registered transition, use a selected asset, request an allowed permission. World scripts must not get raw access to the extension's privileged DOM, file handles, private documents, arbitrary tabs or OS resources. Merely separating scripts into files is not sandboxing; untrusted user-imported code requires an actually isolated runtime, schema-validated messages and narrowly granted capabilities. Browser extension policies also prohibit treating remotely hosted arbitrary JavaScript as an executable plugin source. The design must be validated for the deployment target before script execution ships.

A user can develop and test scripts in a preview world, disable a failing script, view runtime errors and resource usage, roll back, and start in **Safe / Classic Desktop** mode even when a custom world is broken. Prefer explicit permission grants per world or workspace with understandable revocation. Advanced custom code is optional; the ordinary “import GLB, change background” workflow never executes downloaded scripts merely because a model was imported.

## 6. Proposed module boundaries

Keep these independent, with versioned interfaces and stable identifiers:

1. **Desktop/document core:** authoritative frames, PDFs, DOCX, files, persistence, authorized workspaces.
2. **Asset manager:** import, validation, persistent storage, previews, versioning and model fallback.
3. **World definition and renderer adapters:** 3D scene(s), 2D maps, camera, lighting, geometry, optional simulation.
4. **Interaction / route engine:** hotspots, triggers, conditions, semantic destination IDs.
5. **Transition player:** default effect, video, later live 3D/other effects; handoff and cancellation.
6. **Liquid runtime:** isolated custom code and assets; minimal permissioned bridge to canonical SNE:OS actions.
7. **Settings / authoring UI:** one-click background replacement, visual editor, creator debug mode, import/export and recovery.

A shared world definition describes *what* a landmark means, not a hard dependency on its current mesh, renderer, or cutscene. An imported world package should contain assets and declarative bindings but never bundle someone's private files, passphrases or document contents by default. Portable export/import should document asset licenses and require the recipient to bind any personal desktop destinations themselves.

## 7. Phased implementation and concrete acceptance tests

**Phase 0 — Launch/interaction stability.** Respect the persisted 3D-background preference on first open; display the dark 3D loading state, fit the existing island, keep the desktop frames usable, and avoid a refresh requirement. Test cold start, reopening, a low-memory device, failed GLB load, and classic-mode recovery.

**Phase 1 — The promised simple background switch.** Add Settings' **Change 3D Background** file picker, local GLB validation/storage, preview/apply, automatic camera fit, persistence, replace/revert, and + / − / wheel/click/drag inspection. Prove a different downloaded island can replace the previous one end-to-end **without touching GitHub or code**.

**Phase 2 — User-editable interactions.** Add select/add hotspot, assign desktop or existing 2D town, preserve IDs independently of models, test remapping after replacing a model.

**Phase 3 — Cutaway transitions.** Add default sequence and user-imported MP4/WebM by route, with skip/fallback and return. A location can now open either a 2D scene or a normal desktop using independently chosen presentation.

**Phase 4 — Liquid Mode.** Implement a real isolated runtime, lifecycle, locally installed modules, editor, diagnostics and capability bridge; enable complex user-authored interactions and later interchangeable 3D transition plugins. No promise of unrestricted arbitrary code inside the privileged extension context.

**Acceptance demonstration:** A first-time user downloads a licensed GLB, selects **Settings → Change 3D Background → Apply**, inspects the world, selects a building in Edit World, links it to a desktop or the existing 2D town, imports an MP4 transition, then replaces the entire island model the next day. The same real workspaces remain intact, any broken hotspot can be remapped in Settings, and the user can always return to the classic desktop. An advanced creator can additionally open Liquid Mode and author a more elaborate behavior without requiring changes to SNE:OS's own source.

## 8. Guiding principle

**The environment belongs to the user.** SNE:OS supplies reliable computing primitives, reusable editors, a flexible renderer, and safe ways to bind them together. The user chooses the world, uploads its assets, designs the journey, selects the destination, and—when desired—programs the world itself. Everything visual or experiential should be easy to swap wholesale without sacrificing the actual documents and work beneath it.
