# ÆXIS Expansive World — Shared Proposal

**Status:** Design proposal; not implemented. This is the FrameChute copy of the cross-project proposal recorded in Tiled-223D and SUBSTRATE. FrameChute is an optional browser-extension integration, not the owner of world rendering.

## Vision

A Tiled map is the starting point of an independently editable 3D place, not a mandatory full-world master tile grid. In a future browser editor, the creator may right-click a world location, import a Tiled map, apply its 2D-to-3D conversion filter, and use an arrow on the placed region's bottom plane to set its direction. Later native 3D additions must remain editable and must not be erased by reconversion. The optional global overview can simply show destination footprints/squares and reference points.

A creator can make a vast explorable world from a few authored places by combining three distinct systems:

### 1. Conditional Expansive Road

The source road patch repeats ahead and behind the player along its configured direction, but the active expansion only engages while the player **drives on the road or flies directly over it within approximately 50 feet above the local road surface**. Also require horizontal alignment with the road corridor; this is not a general global-altitude threshold. The 50-foot default and lateral corridor are configurable through sliders plus exact numeric fields and via a programmer/agent API. Use hysteresis to prevent activation flicker. The road's physical collision and visible surface must be prepared ahead of fast driving, gliding and landing, while the logical segment arrangement stays deterministic when reversing or returning. Validate joins, elevation, width and tangent direction; allow explicit road endpoints or connections to authored places. The road may intentionally repeat an identical patch.

### 2. Standardized lightweight Level 2 countryside

The surrounding countryside is **not a repeated copy of the roadside square**. It is a generic but biome-aware representation using altitude/elevation and color tiles, bounded silhouette and shading patterns, procedural mathematical variation and stable world-coordinate sampling. Forest resembles forest (canopy masses, clustered greens, clearings); grassland resembles grassland (coherent color patches, sparse bushes); desert resembles desert (sand palettes, subdued dune/rock shapes). Derive style, density and distribution rules from the creator's source map or selected conversion/biome filter. Custom-uploaded tree/bush GLBs can contribute cached overhead/angled image proxies or extracted compact silhouette/color recipes rather than requiring full geometry at great distance. An image capture is an acceptable default; full mathematical vector reconstruction is optional.

Use low-, medium- and large-scale seeded functions so no obvious short repeating environmental tile appears as the player travels, yet the same location remains recognizable when revisited. Like existing waves/clouds, alternate between **three and four distance presentation layers**, with stable spatial samples and crossfades; do not rearrange persistent trees or change world identity when a layer switches. Avoid regenerating expensive textures on every frame. Level 2 countryside presentation is independent of the road's 50-foot activation condition and must be reconciled with actual existing project altitude bands before implementation; Levels 1/3 and any fourth band are later design work, not silently redefined here.

### 3. Specific authored Tiled destinations

A detailed destination is a pre-placed Tiled-derived 3D region with a stable world coordinate, footprint, orientation and source/filter reference. Far away, it can be a cheap low-detail proxy. As the player approaches its *actual location*, preload its detailed terrain, trees, roads, buildings and collision before a high-speed landing; reveal that same authored place beneath the player, fading out generic countryside only inside its footprint. Roads, elevations and landmarks must align across the transition. Outside that footprint, generic countryside continues. Never invent a different Tiled map in place, randomly shift geography, overwrite source elevations or discard native 3D additions.

## Creator and SDK controls

Provide accessible default presets for the road, countryside biome and destination transition with sliders plus exact inputs; maintain one versioned data model that a programmer or AI agent can inspect and change via a scoped API. Expose road activation clearance/corridor, source segment, direction and joins; biome palette, height/color patterns, object proxy templates, seed, 3↔4 presentation layers and resource budget; destination footprint, world transform, source map, conversion filter, prefetch/LOD rules. Placeable regions can also opt into an Expansive Ocean treatment without every region allocating its own huge ocean mesh.

FrameChute should only bridge these definitions into the shared ÆXIS/SUBSTRATE workflow where permitted. Do not duplicate the renderer, create a separate incompatible file format, or load a 3D simulation in every browser tab. Use the shared portable ÆXIS experience/SDK contracts and the same access controls and diagnostics. This proposal describes a future feature, not current extension functionality.

## Validation and delivery

First audit the actual Tiled-223D rendering/altitude/road code. Begin with one straight road, correct on-road and 30/49/51-ft-above-road activation, one grassland Level 2 representation and one fixed authored destination that resolves before contact. Expand to forest/desert, stable mathematical patterns and 3–4 visual layers. Test direction/reverse, repeat seams, persistent visual geography, fast approach, no camera/LOD regression and low-resource browser performance (~4 GB target). Preserve original maps, world coordinates, floating-origin behavior and ongoing camera bug fixes. Do not present proposals as already shipped or auto-merge implementation work.

**Outcome:** browser creators can import a small Tiled map, grow a believable countryside and road around it, and approach real detailed places without hand-authoring every mile. Third-party developers can use the same portable descriptions and SDK to build equally expressive worlds with breadth, depth and ease of use.
