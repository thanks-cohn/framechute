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
