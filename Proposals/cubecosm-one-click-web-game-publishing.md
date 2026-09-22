# Proposal: Cubecosm — One-Click Standalone Web Game Publishing
## From a programmable cube in NEON / SUBSTRATE to a shareable web address

**Status:** Product and architecture proposal; no claim that publishing, hosting, or the exporter already exists.  
**Scope:** NEON's creative experience, SUBSTRATE's portable world model and runtime, and FrameChute's browser/extension and future Electron hosts.  
**Repository homes:** `thanks-cohn/framechute/Proposals/` and `thanks-cohn/substrate/Proposals/`.  
**Companion:** `Proposals/3d-studio-focused-asset-editing-and-cubecosm-programming.md`. Also align with `omni-world-engine-neutral-2-5d-worlds-rend.md`, `semantic-world-engine-agent-native-spatial-ir.md`, and `omni-behavior-language-semantic-action-compiler.md`.

## 1. The product idea

A user can begin by customizing a desktop world, importing any compatible GLB asset, swapping the default ship and scenery, and using NEON's polished, inexpensive-to-render visual effects. They can then designate a cube-shaped region as **their own little Cubecosm**: a programmable world within the world, capable of containing its own objects, rules, simulations, NPCs, effects, and gameplay.

When the creator is happy with the result, they right-click that Cubecosm and choose **Publish as Web Game**. The platform packages *that Cubecosm* as a self-contained browser-playable game, uploads it after explicit confirmation, and returns a URL that anyone with appropriate access can open. Players should not need to install NEON, SUBSTRATE, FrameChute, Electron, or a Chrome extension. A self-hostable **Export as Website** option lets creators retain distribution control instead of requiring platform hosting.

**North star:** Build a world inside your world. Right-click the cube. Publish. Share a link. Other people can play the world you made without seeing or receiving your desktop.

## 2. End-to-end creator journey

1. Open an ordinary NEON/SUBSTRATE desktop world. Swap the default spacecraft for an imported GLB spaceship, replace scenery, and arrange structures and characters. Shared transition effects—hyperspace, teleportation, docking, arrival—continue to work on compatible replacement models with automatic bounds/camera fitting and optional attachment-point calibration. Effects belong to the runtime, not hardwired to the original ship.
2. Draw or select a cube-shaped region → **Create Cubecosm**. Define its identity, entry/exit, local assets, scene, state, and supported capabilities. The exterior desktop stays an independent environment.
3. Populate the interior with existing or Studio-edited models, 2D/3D scenes, environments, NPCs, and interactive elements. Create behavior with accessible presets and visual event logic, or extend with user-authored JS/TS and supported WASM modules. Advanced creators can use their own simulations/rendering where the target host supports them.
4. **Playtest** the Cubecosm as a visitor would encounter it: spawning, controls, camera, loading, menus, win/lose conditions, performance, state reset, and errors. Provide an external-player preview without access to the creator's other cubes, documents or host privileges.
5. Right-click the Cubecosm → **Publish** → **Web Game**. Show a small publish dialog with title, description, cover image, visibility (public / unlisted / access-controlled), target browser requirements, content/dependency review, and a clear distinction between local autosave and making something public.
6. After the creator confirms, validate and package only the explicitly selected Cubecosm and its authorized transitive dependencies; upload it, generate a playable URL, and provide **Copy link**, **Open game**, **Update release**, and **Unpublish**.
7. Also offer **Export as Website**: download a self-hostable static site bundle when the game has no server dependency. Document additional hosting requirements for multiplayer, shared state, auth, leaderboards and server-side simulation.

Illustrative address: `https://play.neon.example/<creator>/<game>` (placeholder; not a real configured domain).

## 3. Cubecosm boundary: programmable without exporting the host desktop

A Cubecosm has stable identity, bounds, a scene graph / semantic state, initial game state, declared dependencies and capabilities, a versioned interaction interface, and separately owned persistence. The boundary makes it possible for the *exterior product* to remain recognizable and functional even when the interior world uses very different rules.

The boundary is **not** an automatic security or CPU isolation boundary: implement actual execution isolation, permission checks, message validation, and lifecycle management.

Default publishing must export only explicitly included objects and assets. Never implicitly include other cubes, local files, private documents, browsing sessions, extension permissions, native OS integrations, unpublished drafts, API keys, environment variables, or personal workspace metadata. Cross-boundary references must be resolved as explicit public assets, declared external services, or missing dependencies that block publishing until addressed. No magic export of the creator's whole desktop.

Use a narrow, documented host ↔ Cubecosm message contract for spawn, enter/exit, input, event propagation, optional object transfers, pause/resume, save/load, and public data access. Hosted games receive only web-game capabilities; desktop-exclusive actions require a separate explicitly supported destination and approval.

Nested Cubecosms are possible, but the publisher must include only the creator-selected nested worlds and their approved dependencies. Nested worlds may be independently packaged or embedded according to their license/capabilities.

## 4. Asset-independent effects and replaceable worlds

The stock spaceship, teleportation, hyperspace, docking sequences, and entry animations are compelling **defaults**, not immutable geometry. Design effects around world events, camera paths, bounding volumes, customizable anchor points, and optional shaders/particles, so substituting another GLB ship normally preserves the experience.

Use lightweight, theatrical visual tricks when possible: screen-space shading, low-cost particles, starfield streaks, dissolves, camera cuts, timed transitions, streamed scene swaps and quality profiles. Allow overrides and fully custom effects. An asset may require calibrated attachment points, LODs, or fallback behavior; do not promise every arbitrary GLB will work perfectly without adjustment.

A published game packages any chosen default effects and the compatible runtime modules it actually uses. Do not carry the complete editor or creator desktop merely to play a game.

## 5. Portable project vs. playable release

Separate:
- **Editable Cubecosm project:** semantic/world data, geometry/material references, scene layout, events, source scripts/visual graphs, editor settings, dependency manifests, revisions, and private draft state.
- **Published web release:** immutable versioned manifest, selected compiled/bundled logic, public assets, runtime code, entry scene, player controls, loading page and public configuration. Contains no creator-only workspace state.
- **Optional standalone site export:** static HTML/CSS/JS/WASM/assets plus setup/readme when the project is self-hostable without backend services.

Use GLB/glTF as a supported asset interchange format, *not* the storage format for all game logic or a guarantee of editable mesh topology. Store game rules in a versioned SUBSTRATE/Cubecosm project representation with explicit engine/runtime requirements. Babylon.js/TS is the first common 3D web runtime, not the canonical owner of the user's worlds; adapt other runtimes as capabilities permit. JavaScript, TypeScript-compiled JS, and compatible WASM can be packaged for a hosted game under normal browser constraints. Native-only modules or inaccessible creator-local dependencies must be reported as unsupported for web export unless replaced with a browser-compatible implementation.

The extension and Electron desktop use appropriate host adapters to load the same *compatible* source project. A standalone browser game uses a third, least-privilege host adapter. Compatibility is declared rather than silently assumed.

## 6. Publishing service and URL lifecycle

Implement a minimal game registry and publish pipeline: validate manifest/schema and source asset provenance; identify assets by content hash; bundle/minify/tree-shake the game runtime where practical; write static immutable assets to object storage behind a CDN; generate a separate game origin or otherwise strong isolation from NEON's authenticated application; expose a URL backed by a versioned release.

One click for the user does not mean skipping validation. Show upload progress, accessibility and compatibility errors, storage usage, and release status; never claim success until the game is available and the URL resolves.

Support: public, unlisted-link and access-controlled release policies; edit metadata; release history and rollback; unpublish/delete with honest warnings about cached or downloaded copies; optional custom domain and self-hosted export later. **Unlisted means discoverability is reduced, not that a link is secret or access-controlled.**

Budget hosting intentionally. Start with single-player static games distributed over a CDN. Charge or meter storage, build minutes, bandwidth, multiplayer/backend compute, and hosted persistent state if appropriate; do not imply a million daily players can be served by a free database tier. Content-addressed shared runtime chunks, caching and incremental asset publishing can limit repeat bandwidth. Estimate cost per published game and active player before setting plans.

## 7. Execution security, permissions, and developer freedom

Code downloaded as part of a user-created game must not inherit Chrome extension privileges, Electron Node.js access, local filesystem access, or the creator's credentials. Host published games as ordinary web content on a separately isolated origin, with appropriate CSP, resource policies, validated parent messaging, content limits, and user consent for sensitive capabilities. WebAssembly executes under the browser's runtime restrictions and is not automatically a safe permission boundary.

Keep the Chrome extension's own code/distribution compliant with its store rules. Do not solve user-supplied script freedom by injecting arbitrary remotely provided code into a privileged extension context. The desktop host may offer separate opt-in native capability extensions, but these are not automatically portable to the standalone web-game release. Expose capabilities with granular versioned APIs, permission review, and a clear trust model.

Creators can implement highly complex gameplay, effects and simulations, within the target browser/hardware limits. Avoid a product-imposed fixed set of mechanics; distinguish creative freedom from unrestricted access to the host computer.

## 8. Autosave, drafts, publication, and ownership

Keep **local autosave ON by default** for editable Studio assets and Cubecosm project changes, configurable in Settings. Distinguish Save locally / Draft / Publish to private asset library / Publish public web game. Autosave never makes a creation public. Show truthful save state and recover after crashes where possible.

On desktop, use authorized local storage and atomic writes. In the extension, use browser-profile storage with explicit export/user-granted storage where supported; do not claim silent arbitrary filesystem writes. Creators can export editable projects and reusable GLBs, copy published game links, download self-hostable website bundles, and manage revisions. Respect third-party asset licenses and maintain provenance rather than asserting that importing an asset transfers copyright.

## 9. Engineering milestones and acceptance criteria

1. Export a small single-player Cubecosm built from an imported GLB hallway, a custom-colored panel, a controllable character and one door/event into a standalone Babylon.js-powered web game. It opens from a URL on a clean browser without installing NEON.
2. Verify the same compatible editable project loads in the extension and Electron, while release packaging excludes all unrelated workspace files, secrets, extension/native privileges and other Cubecosms.
3. Replace the default UFO model and retain the generic hyperspace/teleportation transitions after explicit mapping or automatic fitting; demonstrate a simple low-cost rendering profile.
4. Offer explicit Publish with public/unlisted/access-controlled semantics, produce a functioning link, update version, unpublish and export a self-hostable static site. Show failures honestly.
5. Provide a robust preflight report for missing assets, oversized textures, unsupported desktop modules, unsafe cross-boundary dependencies, browser graphics capabilities and performance budgets.
6. Demonstrate more sophisticated creator JS/TS or browser-compatible WASM game logic in an isolated game runtime with no elevation into the application host, plus graceful low-memory fallback or a clear declared hardware requirement.

**Product statement:** NEON provides a world and the tools to remake it. Cubecosm lets people author an independent little universe inside it. Publishing turns that universe into a real game anyone can visit by opening a web address.
