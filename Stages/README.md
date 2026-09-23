# The Seven Stages — ÆXIS to ANIMA

**Status:** Product roadmap and implementation proposal, **not** a claim that every stage is already implemented.  
**Shared across:** FrameChute, SUBSTRATE and Tiled-223D.  
**Core promise:** **Describe it. Show it. Make it. Place it.** A person chooses what to create; the system handles the technical construction. The same world and asset contracts must work for human creators and permissioned agents.

## The entire experience, at a glance

| Stage | Name | What it gives the creator | Simplest user action |
| --- | --- | --- | --- |
| 01 | **ÆXIS** | A world foundation: map, identity, scale and consistent spatial truth | Supply/open a world map and choose simple defaults |
| 02 | **AERIS** | Aerial exploration: altitude, flight, atmosphere, ocean and descent | Open the world and fly; change a few accessible settings if desired |
| 03 | **EARTH** *(formerly TOPOS)* | Geography and terrain: insert local maps, infer sensible elevations and establish surfaces | Upload an edited Tiled map, preview its additions and apply |
| 04 | **SEKAI** | World assembly: import existing GLBs and place them on usable surfaces | **Upload → click → drop** (or pick a project asset and click a saved location) |
| 05 | **ASTRA** | Ship design and construction, from general silhouette to detailed internals | **Describe → provide reference pictures → generate**, then place |
| 06 | **ARCADIA** | Architecture: houses, towers, interiors, cities and monumental structures | **Describe → provide reference pictures → generate**, then place |
| 07 | **ANIMA** | People and characters: anatomy, appearance, attire and eventually rigging/movement | **Describe → provide reference pictures → generate**, then place |

**Do not make seven elaborate authoring applications.** Stages 1–3 establish a usable world from uploaded/edited maps and simple choices; Stage 4 introduces the universal, intuitive placement action. Stages 5–7 *create* new assets from descriptions and pictures; those assets return to the **same Stage 4 click-and-drop placement flow**. Stage 4 and later should continue to accept existing/uploaded assets without requiring an AI generator.

The creator does not need to know Tiled internals, vertex mathematics, scripting, rigging or CAD to get a useful result. Advanced controls are available when wanted, not imposed as an entrance fee. Agents use discoverable, scoped interfaces to do the complicated work **on the creator's behalf**, not to invent a parallel workflow.

## 01 — ÆXIS: establish the world

Provide a stable, semantically meaningful world representation that can accept a Tiled map, authored terrain IDs, numeric elevation and later objects. Give every world and relevant region a durable identity, explicit horizontal X/Z and vertical Y coordinates, known units/scale, navigability and a transform between 2D maps and 3D space. Support a simple initial world with sensible defaults, with room to grow into larger and linked spaces.

**Exit condition:** Opening the same saved world yields the same geography, coordinates, identities and editable source data; later stages can query it without deducing physical truth from a picture.

## 02 — AERIS: inhabit and traverse the world

Make the ÆXIS world traversable from above: lightweight ship flight, recognizable scale and altitude, visible sky/ocean/horizon, motion and descent, return/exit to the host workspace. Flight and visuals should draw from world truth rather than becoming a separate world database. Allow attractive ocean/atmosphere effects under constrained device budgets; avoid insisting on expensive per-cell or per-frame simulation.

**Exit condition:** A creator can open, fly through and descend into the same stable world while its map, heights and collision/landing semantics remain intelligible to tools and agents.

## 03 — EARTH (formerly TOPOS): build the geography and placement surfaces

A creator can open an existing large Tiled world, add a smaller handmade region (for example, a 50 × 50 map inserted into a 500 × 500 map), export the edited map and feed it to the terrain generator along with preserved original elevation information. The system detects newly added regions and offers **Preview → Apply**, initially generating a simple, low-to-the-ground, geographically coherent insertion. Honor protected terrain, coastlines, seams and existing heights. Bounded, saved-seed variation can make repeated generation feel natural rather than identical or nonsensical.

Support authoring/inspecting Tiled object-layer **lines, circles/ellipses, rectangles, arbitrary quadrilaterals and polygons** to express land, water, roads, boundaries, cliffs or desired placement areas. A browser shape editor may provide equivalent operations using the same source-of-truth geometry. A desired boundary may permit a natural irregular result; an exact boundary must preserve the authored shape.

Most importantly, publish an **object-ready surface contract**: stable surface ID, world transform, bounds and footprint, height/normal where applicable, ground/floating status, clearance and occupancy, protection status and an explicit relation to terrain underneath. Keep a cheap default surface available; advanced sculpted hillsides, mountains and floating islands can come later. Do not flatten stacked floating and ground locations into one height value.

**Exit condition:** The edited map and generated world data round-trip consistently; the newly created surface is queryable and can receive a Stage 4 object with no custom placement code per terrain type.

## 04 — SEKAI: upload, click, drop

The creator right-clicks or otherwise selects a world location, chooses **Place Object**, uploads a GLB or selects one already in the project, previews its size/orientation and drops it onto a suitable surface. Use an existing/saved location or the clicked position. **Default placement must already work with minimal choices.**

Offer a simple placement plane or a floating aesthetic circle, with grounded/floating and bottom/support options. Initially, **Make ground underneath** can produce a plain minimal pad; later it can offer hillsides, mountains, cliffs or floating-island presets. The plane is a placement/contact surface, not necessarily a final visible disk. Preview the actual model footprint, clearance and intersections; let the user adjust transform or support when an asset has an awkward pivot or ambiguous base.

Keep a stable object instance and the same world location across its GLB, Tiled view and generated world JSON. The first inexpensive editor marker may be **white X footprint tiles** on a separate overlay, never a replacement for terrain, altitude, physics or the actual GLB. Where an elevation companion needs human/agent-readable markers, store them as *non-rendering semantic annotations* referencing the sole canonical object instance. Add/move/remove and undo must update all representations consistently without erasing protected geography or another object's footprint.

**Exit condition:** A creator can import a real GLB, click a place, see it correctly supported in the 3D world, save, reload, move and remove it. This same operation places Stage 5–7 outputs; no new per-stage placement UI is required.

## 05 — ASTRA: ships from words and pictures

The creator describes the vessel, supplies one or several sketches/images (ideally 3–4 useful views when fidelity matters), chooses a detail mode and asks an authorized agent to **build the ship directly**. The construction system interprets the silhouette, hull, engines, cockpit, proportions, materials, attachments and spatial relations; generates editable parameterized geometry; renders inspection views; revises locally; and exports a GLB **plus its editable semantic construction record**. It should accommodate unfamiliar forms rather than forcing every ship into a stock template.

Three shared construction modes:

- **Default:** An attractive, recognizable shape, main volumes and features, modest geometry and a usable result without hidden expensive machinery.
- **Detail:** More faithful proportions, distinctive decorations and cute or unusual reference details, panels, vents, windows, engine placement and visible attachments.
- **MINUTIA:** Agent-accessible deep construction of requested/observable small features: pipes, wiring, mounts, screws, cavities, layering, occlusion and depth under the hull. Selective zoom, sectioning and local revision must be possible. Unknown or unseen mechanisms are labeled *inferred*, not falsely presented as copied from a photograph.

A 3–4-view reference should help the agent reason about depth and consistency, not imply perfect reconstruction of invisible parts. Preserve the form and component IDs when increasing detail. The creator can generate a vessel and then **place it through SEKAI**.

**Exit condition:** An agent can construct and revise a non-template ship from a description/references, export a reusable editable asset and place an instance without requiring the person to model vertices.

## 06 — ARCADIA: apply the shipbuilding principles to architecture

**Reuse ASTRA's actual construction and inspection machinery**, not a separate black-box building generator. Swap in architectural semantics and constraints: foundations, floors, walls, roofs, doors, windows, stairs, interior rooms, furnishing, passages, wiring, structural supports, occupied/open space and access between levels. Support anything from a simple cottage to a detailed city block or monumental structure. Buildings can be authored from descriptions and image references at **Default / Detail / MINUTIA** scope, with local refinement rather than obliging the entire city to render at microscopic detail.

The agent should understand semantic rooms, openings, adjacency, navigability and how a building connects to its Stage 4 placement surface. Export editable building components and a usable GLB/scene; keep interiors and exterior attached to the same identity. Use SEKAI to place the building or assembled settlement in the world.

**Exit condition:** The same agentic geometry core creates a building with coherent inside/outside relationships, inspectable components and a stable world placement.

## 07 — ANIMA: apply those principles to people and characters

Use the shared agentic construction and revision interface, extended with **character-specific constraints**: body proportions, anatomy or stylized form, face, hair, hands, clothing, accessories, materials and coherent joints/attachments. From descriptions and pictures, build an editable character at **Default / Detail / MINUTIA** scale and preserve which features are observed, specified or inferred. Avoid treating a character as a rigid ship with a face: anatomical and deformation constraints must be first-class.

Rigging, expressions, motion, poses and animation are logical **progressive capabilities**, not prerequisites for the initial meaningful character creation workflow. Preserve semantic bones/attachment points and an export path that can support them later. An ANIMA character can be placed into a SEKAI world, an ARCADIA building or an ASTRA ship.

**Exit condition:** A creator can describe/show a character, have an agent construct and locally refine it, export it and place it in the world; future movement/rigging can extend the same saved identity.

## One shared engine, not three unrelated generators

ASTRA establishes a **general agentic construction kernel**. ARCADIA and ANIMA extend it with their own semantic part vocabularies, constraints and validation. Keep a common project/specification format, stable object and component IDs, geometry operations, spatial/attachment rules, inspect → construct → render → compare → revise loop, undo/revision history and GLB plus editable metadata export. Expose versioned, self-describing JSON APIs so compatible agents and human-operated UI can make the same precise changes without writing raw vertices by hand.

- **Input:** plain-language intent, optional reference pictures, optional dimensions and a detail mode. No compulsory AI for the world or existing-asset placement paths; an agent is optional and permission-scoped.
- **Agent execution:** interpret references and uncertainty, plan semantic parts, invoke measured construction operations, inspect at multiple camera angles and depths, validate constraints and revise only what needs revision. A user can stop at a usable coarse asset or request a tiny component be refined in MINUTIA.
- **Output:** inspectable, reusable 3D asset + versioned semantic model/part tree, dimensions, transforms, material references, connection/placement anchors and provenance for observed vs inferred details.
- **Handoff:** every output uses SEKAI's existing preview, position, support, footprint, save/reload and move/delete contracts. A ship can contain architectural rooms and character occupants without fragmenting world identity.
- **Performance and agency:** bounded generation budgets, chunking/LOD and instancing suit lower-memory devices; optional remote compute may be added without making local/offline Stage 1–4 dependent on a paid service. Preview changes and authorize commits; expose clear errors rather than inventing coordinates or silently modifying another part of the world.

### Two deliberately short creator journeys

**I already have a model:** Open world → choose a surface → upload/select GLB → click/drop → save. No image generator, technical modeling session or mandatory API key.

**I want something that does not exist:** “Build a ship with four engines and this observation deck” + 3–4 pictures → choose Default, Detail or MINUTIA → agent creates and previews an editable ASTRA ship → refine if wanted → click/drop in SEKAI. Replace *ship* with *building* (ARCADIA) or *character* (ANIMA); the workflow stays familiar.

## Implementation boundaries and companion proposals

This is a **roadmap**, not a report of shipped features. Preserve functioning prototype flows, including Tiled-223D's existing low-ground insertion/flight experiment, while progressively implementing and testing each gate. Do not claim Stage 4 GLB placement or Stages 5–7 agentic generation work merely because their proposals are documented.

Read alongside [Stage 3 shapes and Stage 4 GLB placement](../Proposals/aexis-shape-aware-map-insertion-stage-4-glb-placement.md) and [Model Foundry's agentic construction contract](../Proposals/model-foundry-agentic-parametric-glb-construction.md). Those documents hold the deeper geometry, round-trip, validation, provenance, detail-mode and machine API requirements. This roadmap specifies **what the stages mean and how their creator experiences compose**.


## Low-end-first creation: recommended tools, never mandatory dependencies

**Product requirement:** World's ÆXIS Engine should remain useful on modest and older computers. Treat a **4 GB RAM Windows machine with integrated graphics** as a priority testing target for the simplest world-building and small-asset workflows, **not** a blanket promise that every scene, browser, renderer or generation mode will fit in 4 GB. Publish real measured memory, startup, frame time and export results for each hardware profile and stage. If the hardware is insufficient, show an actionable message and a lower-cost alternative, rather than silently freezing, corrupting work or blocking the creator.

The basic experience remains **upload a Tiled map → preview/create the world → upload an existing GLB → click a placement surface → drop and save**. Nothing in Stages 1–4 requires a dedicated GPU, cloud subscription, advanced 3D editor or paid AI **by design**, subject to the actual browser/WebGL capability and a bounded scene. Stages 5–7 may use optional agentic or remote compute for demanding generation, but the creator must still be able to author/import simple assets locally. No external editor is required just to *place* a model.

### Suggested external editors (examples, not exclusive endorsements or bundled software)

| Editor | Creator-facing use | Import/compatibility plan |
| --- | --- | --- |
| [Blockbench](https://www.blockbench.net/) | **First suggested beginner option:** approachable low-poly and box-based models, small ships/buildings/props and stylized characters. | Prefer a tested binary glTF/GLB export where supported; otherwise validate/convert glTF or another documented export. Preserve texture/material and orientation. |
| [MagicaVoxel](https://ephtracy.github.io/) | Free voxel/blocky asset creation and retro-style buildings, props and characters. Favor manageable model sizes and do not confuse its path-tracing renderer with its modeling performance. | Offer an optional tested OBJ + material/texture or VOX conversion path to GLB; don't promise direct native GLB export. Respect the external software's redistribution restrictions; link to its original site instead of bundling it. |
| [Kenney Asset Forge](https://kenney.nl/tools/asset-forge) | Optional **paid**, block-based assembly of small models, towns, objects and stylized vehicles for people who prefer composition to mesh editing. | Accept/validate supported glTF exports and convert to GLB when necessary; do not describe it as free or include its program or paid blocks without permission. |
| [Blender](https://www.blender.org/) | Optional more advanced modeling, cleanup and export for users with the skills and machine resources. | Accept validated GLB from its export workflow; never make Blender installation a prerequisite for basic ÆXIS creation or placement. |

Maintain a short, regularly checked compatibility guide, with an asset produced in each recommended editor and actually loaded on a low-end target. Third-party export features and device needs may vary by version; do not advertise untested direct import formats or guaranteed performance.

### Required low-memory behavior

1. **Small by default:** start new worlds with low-cost geometry and texture presets, limited active objects, simple lighting and conservative visible distance; do not force cinematic effects or MINUTIA on the first launch. Preserve the option to increase quality later.
2. **Keep editing separate from heavy rendering:** lightweight map and top-down/simplified placement views should remain usable if full 3D preview becomes expensive. Allow the user to save and resume without a live high-detail scene.
3. **Lazy load and reuse:** stream terrain/world chunks and assets near the camera; use LOD, instancing, bounded caches, texture compression where supported, visibility limits and deterministic resource disposal. Do not allocate the whole planet or render every fastener at every distance.
4. **Gracefully scale features:** expose Low/Standard/High presets, with further user controls for resolution, ocean/shadows, view distance, texture size, maximum simultaneous detail and generation budget. A simple ocean mode must remain navigable and readable.
5. **Progressive agentic modeling:** ASTRA/ARCADIA/ANIMA begin with an inexpensive Default asset; request Detail or localized MINUTIA only where needed. Permit paused/resumable jobs and optional remote compute; never tie an otherwise local workflow to an obligatory external account.
6. **No hidden data loss:** preserve source map, source editor file, project object IDs and original full-quality assets. Render proxies and generated LODs are derived views, not destructive substitutions for creators' originals.
7. **Honest hardware guidance:** benchmark an actual 4 GB-class machine (and browsers/GPUs); document limitations and the simplest tested workflows instead of guaranteeing all projects will run on any weak computer.

**Onboarding copy:** *An older computer is enough to begin. Start with a small world, create a simple asset in a lightweight editor—or use one you already have—and click to place it. ÆXIS handles the underlying world data. You can add complexity as your tools and computer allow.*
