# ÆXIS bridge in Framechute: authored worlds agents can understand

**Status:** Proposal, not an implemented Framechute integration. Companion proposals in Tiled-223D specify the world/API path; SUBSTRATE specifies the workspace and stage fit. The [stage roadmap](../Stages/README.md) and [agent design](agentic_design.md) provide the surrounding vision.

## Why this belongs in a creator workspace

The creator should be able to keep a Tiled map, a Blender model, a few reference photographs, written descriptions and eventually a book near the world they are building. Drop one small map onto another, ask an agent for an expansive master geography, preview the result, fix a coast and go straight back to the source. A world can be small and intimate or spread the same detailed landmasses across large cheap open seas; the ocean between them is an implicit region and renderer rule, not millions of stored water tiles. The author can always inspect what an agent inferred versus what was supplied.

The current standalone Tiled-223D work supplies a browser flight prototype, ordinary Tiled JSON import, procedural sample terrain, a limited low-ground insertion path, and a narrow versioned agent/programmer world API for rectangular regions, preview, commit and undo. Multi-map composition, reading books and images, semantic face labeling, a complete Tiled round trip and Godot export remain future work. Framechute hosting does not make those capabilities appear by itself.

## Two creative entrances, one world truth

Tiled artists bring 2D maps and elevation companions; Blender artists bring GLBs. ÆXIS provides the common meaning: stable world/landmass/asset IDs, coordinates, height, footprints, ownership, adjacency, attachment points, permissions and collision truth. The browser view, Tiled export and later game-engine export derive from this versioned structure. A displayed curved or folded world is an artistic projection of a flat wrapping geography unless a future topology is explicitly chosen. The firmament and lighting are separately editable.

Offer a small **surface studio** for each imported GLB. Select a base, front, entrance, roof or connection point with simple quadrilateral/part selection first; later offer mesh polygon and volumetric segmentation. Store labels with asset hashes, durable part bindings, normals and local/world transforms. A model may propose labels after inspecting images and geometry; show uncertainty and let the artist correct its guesses. A Blender reexport must preserve verified bindings or surface unresolved changes, never attach “door” to an unrelated face by accident.

## The agent's footholds

Give authorized agents open, documented inspection and action surfaces: find a region; query its terrain, scale, water, protected cells and available support surfaces; inspect an asset's oriented footprint, base and doorway; ask for a placement plan; preview contact, collision, travel and lighting implications; commit atomically or undo. The same semantic, logical and mathematical constraints serve a programmer API and an agent API. An agent can do repeated assembly while the creator adjusts a landmass, accepts an asset or says “make the sea between them feel wider.” No LLM is required in the render loop.

With those footholds, agents could progressively create and implement more of a game using existing maps and assets: world layout, object placement, paths, gameplay references and later animations. This would be easier than forcing an agent to reconstruct the whole game from pictures. A full-game-from-book experience is an eventual goal that requires substantial new interpretation, validation and runtime work.

## Route into a game engine

Tiled and Blender are the first communities to serve. Godot is the first planned game-engine target after the import and labeling experience is reliable. Export or adapt terrain with numeric elevations, placed GLB instances, collision proxies, stable IDs and semantic anchors to a Godot starter project; let Godot handle scripts, gameplay and runtime scenes. Where Tiled JSON or glTF cannot express an ÆXIS rule directly, include a versioned companion manifest and document supported subsets. Keep the creator's source files and ÆXIS world editable after export.

**Proof of usefulness:** An author supplies a small map, adds a second region, labels the base and entrance of one Blender asset, has an agent propose a valid placement, previews it in the browser, undoes and revises it, then opens the matching starter scene in Godot. Source terrain, IDs, elevations and accepted labels survive. Measure this on the 4 GB target before advertising seamless handoff.
