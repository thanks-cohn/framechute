# ÆXIS: one world, web rendering now, native rendering later

**Status:** Small cross-repository architecture proposal. It records a direction, not a claim that a native renderer or desktop-ready game engine has shipped.

ÆXIS should let creators, programmers, and authorized agents build and understand the same world. The browser experience remains a first-class way to create and play. The desktop experience should initially reuse that experience, while leaving a clean path to a browser-free native renderer when the product and measurements justify it.

## The near-term path

Tiled-223D already has a browser viewer built with JavaScript and Three.js and an **experimental optional Qt 6 / Qt WebEngine shell**. Use that shell as the desktop prototype: open a project, show the existing world, and connect project-scoped operations through a narrow bridge. This is a desktop window with a web engine inside it. We have not selected Electron or Tauri, and the current Qt Map tab is a placeholder rather than an embedded Tiled editor.

Add a local, versioned world API that both people and agents can call. A creator opens a project and grants an agent an appropriate, revocable project scope; the agent can then inspect, preview, commit, debug, and undo permitted operations without a new approval prompt for each tile. A token may authorize ÆXIS operations, but it does not bypass browser or operating-system file permissions. Keep regular and opt-in deep debug as bounded views of the same authoritative decision record. Desktop, browser, CLI, and future tool adapters should consume that contract instead of inventing separate world rules.

## The durable boundary

Keep **one canonical world model**, independent of either renderer: versioned coordinates, terrain and numeric elevation, stable region/entity/asset IDs, transforms, anchors and surfaces, semantics, collision and behavior facts, authorship/provenance, revisions, permissions, diagnostics, and edit history. Expose bounded snapshots and change sets with explicit schema versions. The world API validates mutations; renderer objects never become the sole source of truth.

Two presentation backends can then consume that model:

- **Web:** Three.js displays the world in a browser or the initial desktop webview.
- **Future native desktop:** a C/C++ renderer reads the same versioned world snapshots and applies the same committed changes using native graphics APIs, without requiring a browser engine.

The native renderer would not run Three.js unchanged. It would reuse world meaning and behavior contracts, not Three.js draw calls. Shared gameplay semantics and edits must stay in the core; rendering-specific meshes, lighting, batching, and GPU resources belong in their adapters. Avoid maintaining two incompatible save formats, permission systems, or agent APIs.

## Proof before expansion

1. Finish one visible round trip: programmatic edit → validation and preview → commit → browser render → inspect and undo, with stable IDs and Tiled export/reimport.
2. Define the minimal renderer-independent scene snapshot and change-set contract. Prove one terrain patch, one labeled GLB entity with an anchor, and one editable light without claiming a full asset or lighting engine.
3. Only then prototype one native view against that contract. Compare visual meaning, interaction, startup time, frame time, memory, and resource cleanup against the web view, including a real 4 GB Windows machine when available.
4. Choose a native renderer and broader desktop distribution after those measurements. Preserve browser publishing and the optional desktop path even if one backend becomes preferred.

This keeps our end goal visible while letting today's work ship: a world an artist can reshape, a programmer can control precisely, and an agent can inspect and improve through understandable, authorized operations.

## Addendum: browser-first creation and transfer to other game engines

ÆXIS should reach creators through the browser first, while making an authored world transferable to a native ÆXIS desktop renderer and, eventually, Godot, Unity, and Unreal. This does **not** require the ÆXIS core to be rewritten in every destination's scripting language. Use JavaScript/TypeScript for the initial world core and web tools; a future C/C++ renderer consumes the same versioned world snapshots. Engine-side adapters use the host's extension languages: Godot's editor/scripting APIs, a C# Unity package, and an Unreal C++ plugin with Blueprint-facing hooks where useful.

Keep three layers explicit:

1. **Portable world truth:** stable IDs, terrain/elevations, entity and asset references, transforms, anchors, surfaces, lights, cameras, authored constraints, provenance, revisions, and a versioned coordinate/unit contract. Tiled JSON and GLB/glTF can carry suitable maps and 3D assets, but neither defines ÆXIS gameplay behavior by itself.
2. **Portable supported behavior:** a small, typed set of actions and events—such as activate a door, follow a route, switch a light, or attach an object to an anchor—with deterministic parameters and declared semantics. Each destination adapter maps these to native engine concepts, or marks a feature unsupported. Gameplay rules and project permissions belong to the core contract; renderer and editor implementations remain replaceable.
3. **Destination-specific extensions:** arbitrary JavaScript, shaders, physics tuning, visual scripts, plugins, and editor-only effects may require an engine-specific implementation. Do not promise automatic translation of arbitrary code or identical simulation across different physics/rendering engines.

An export should create the destination scene *and* a machine-readable compatibility report: transferred, approximated, unsupported, affected IDs, and suggested repairs. Preserve identity and creator corrections during reimport and targeted updates; never silently replace unrelated regions or objects. Provide fixtures that compare coordinates, elevations, labels, simple behaviors, and revision changes across browser ÆXIS and each destination.

Prove this in stages: first a browser-to-Godot example with terrain, one labeled GLB, a light, and one basic interaction; then a Unity C# importer over the **same** world contract; then an Unreal plugin. One-click transfer is the promise for the explicitly supported portable subset, expanded only after parity and round-trip tests. The artist can still take the world further in the target engine without ÆXIS claiming to own that engine's native features.

## Addendum: test Babylon.js as a unified web/native rendering path

**Design refinement:** The future C/C++ renderer described above is a possible fallback, **not** a commitment to maintain a second independently written rendering engine. A more maintainable goal is one TypeScript/JavaScript ÆXIS codebase for scene construction, interaction contracts, and world tools; one portable world model; and a rendering API usable both on the web and in a browser-free desktop host. A native C++ backend may sit underneath that shared rendering API. Creator, programmer, and agent surfaces continue to address the same authoritative world.

[Babylon Native](https://github.com/BabylonJS/BabylonNative) makes Babylon.js a serious candidate for that path. It connects Babylon.js's JavaScript engine abstraction to a C++ native engine and native graphics backends. The intent is to reuse scene code across browser and native hosts, which could save ÆXIS the cost of building and maintaining separate Three.js and bespoke C/C++ renderers. TypeScript remains a good authoring language because its output runs as JavaScript in the relevant host; it is not a substitute for native graphics implementation.

**Compatibility is a hypothesis to verify, not a promise.** Babylon Native currently identifies itself as a source-only public preview with a potentially changing consumption contract. Its [published support list](https://github.com/BabylonJS/BabylonNative#project-status) includes partial support for GUI, input, instancing, and post-processing, and lists audio, particles, and some texture loaders as not yet supported. Web-specific DOM/UI facilities do not automatically exist in a native host. ÆXIS must test the features it actually needs, including flight controls, terrain batching, GLB animation, multiple lights, atmospheric effects, editing gizmos, UI, audio, and 4 GB performance.

Before replacing Three.js, build a **time-boxed compatibility spike**: take one representative current world and implement a Babylon.js web scene, then run its shared scene logic in Babylon Native on desktop. Record which files run unchanged, which need small host adapters, which need different implementations, and what is unavailable. Compare appearance, interaction semantics, import fidelity, frame time, startup time, memory, and debugging. State precise pass/fail criteria and preserve an opt-in Qt/WebEngine desktop route until the native path is proven.

If the spike succeeds, migrate rendering deliberately and keep the core and scene contract stable. Prefer one shared scene implementation plus small host-specific adapters over two feature-for-feature rendering engines. If Babylon Native cannot yet support a necessary ÆXIS feature, retain the webview route or defer native parity; do not force lower-quality creator experiences merely to claim a unified codebase. Either way, do not couple world identity, gameplay rules, authorization, save data, or engine export adapters to Babylon.js or Three.js.
