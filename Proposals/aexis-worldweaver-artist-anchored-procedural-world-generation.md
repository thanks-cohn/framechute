# ÆXIS — Worldweaver: Build a Few Maps. Discover an Entire World.

**Status:** Product and game-engine proposal; design only, not implemented.  
**Date:** 2026-09-23  
**Homes:** FrameChute and SUBSTRATE `Proposals/`.  
**Scope:** ÆXIS artist-first world creation, tiled RPG maps, procedural terrain, semantic tile sheets, optional AI, future multi-perspective rendering.

## 1. The promise

> Create three or four places you love. Tell ÆXIS how they relate. Choose how big you want the world to feel. Hand the engine your tile sheets—and let the rest of the world come alive.

Artists should not have to hand-author a whole continent to make a village, temple, coast, or castle feel like it belongs to a living world. They create the places that matter and retain control over them. ÆXIS fills the spaces between with coherent, editable geography: hills, mountains, forests, rivers, plains, deserts, islands, ocean, and accessible land suitable for future construction.

This is **not** "send your maps to ChatGPT and hope for a picture." The core experience must be viable offline, without any paid AI account, using a seed-driven local procedural generator and an artist-supplied semantic tile vocabulary. AI assistance is an optional layer, never a requirement for map placement or terrain generation.

## 2. The creator journey: four maps to a world

1. **Make a handful of maps.** Import or draw three or four (or more/fewer) handcrafted tiled regions: a starting village, a mountaintop keep, a port, a desert town, a hidden shrine. Mark each as protected artist work.
2. **Give ÆXIS the tile sheets.** Supply terrain, transition, cliff, water, road, foliage, and decorative tiles; set tile dimensions, adjacency/autotile rules, movement/collision properties, biome and elevation suitability, and optional plain-language descriptions. Offer an approachable visual labeling interface as well as portable machine-readable metadata.
3. **Set the distances.** For each pair or group of important places, specify a **minimum and maximum distance** (in tiles, travel time, or approximate world distance, with the unit explicit). Allow a creator to fix an exact position or simply say "these places should be neither too close nor too far." Default to approximate ranges, with advanced exact constraints when desired.
4. **Describe geography in ordinary terms.** Select relations such as **"this map is an island," "these are on the same landmass," "this is on another continent."** Add directives: **"put a mountain range between these," "put a desert between these," "put an ocean between these—even though the two places belong to the same continent."**
5. **Choose the world scale.** Tiny, Large, or Expansive, with an eventual *Endless-Feeling* mode (finite generated chunks, streamed as explored; never promise mathematically infinite geography). Show an understandable estimated tile count, traversal scale, expected storage footprint, and performance implications.
6. **Preview and generate.** Display an editable schematic with pins for protected maps, distance bands, coastlines, landmasses, terrain corridors and barriers. Resolve conflicts openly before committing. Generate terrain around anchors, preview major regions and seam transitions, and enter or edit the world immediately.
7. **Keep building.** An artist can reserve more flat areas, place additional maps and landmarks, regenerate only selected unprotected zones, change constraints, and continue authoring the world without wiping hand-built work.

### Suggested invitation copy

**"Build the places. We'll build the world between them."**

"Make a village. Make a castle. Make a little island you love. Tell us how far apart they should be, which shore they belong to, and what you dream of finding between them. Choose a tiny world, a vast one, or a world that seems to keep unfolding. Give ÆXIS your tile sheets. Your places stay yours; everything between them becomes an adventure."

The feeling to convey is that a creator's modest handful of maps can unfold into a convincing, enormous and *inhabitable* geography—not that an algorithm takes artistic authorship away.

## 3. Constraint-based geography, not random tile wallpaper

Model each hand-built map as a protected **anchor** with an extent, location/placement flexibility, elevation, traversable exits, biome, coastline and landmass membership. Model requested relationships as a **constraint graph**:

- **Pairwise spatial constraints:** minimum and maximum separation; optional orientation (e.g., north of), crossing/travel cost and route preferences. Distinguish straight-line tile distance from navigable path length and travel time.
- **Landmass semantics:** same continuous landmass, separate island, separate continent, connected by bridge/causeway only, ocean crossing, or region on the same continental shelf. A creator should not have to learn geology to express intent.
- **Between-places features:** require mountain range, desert, forest, valley, inlet, river, lake, inland sea, ocean, or other biome/barrier to occupy the meaningful spatial corridor between specified anchors. Offer controllable size and passability.
- **Positive construction rules:** "At least 100 out of every 500 tiles should be flat or gently sloped," with selectable planning-region size, grouping and minimum contiguous building-pad size. Ensure it is *usable* land, not 100 unrelated single-tile patches, and validate by region rather than averaging over the entire continent.
- **Artist-defined hard exclusions:** protect original map interiors, specified roads, scenic views, story-critical paths, coastlines and reserved zones. Ordinary terrain constraints should be adjustable, with hard vs soft priority visible.

**Important example: "an ocean between these, but they are on the same continent."** Treat this as a legitimate artistic intent, not an error. Offer a broad coastal gulf, ocean inlet, strait around a peninsula, or a water-separated pair sharing a continental shelf. If the artist specifically requires the same *continuous dry-land* landmass as well, route the dry-land connection **around** the intervening body of water (possibly far outside the direct corridor), or ask the artist to relax a genuinely impossible combination. Do not silently replace their ocean with a river or contradict the "same continent" label.

Check feasibility of combined demands: if two 100-tile-wide protected regions are required to be 10–20 tiles apart, or a world cannot accommodate all distance ranges and landmass rules, reveal the conflict, show suggested adjustments and preserve the original intent rather than silently violating it.

## 4. Coherent generation pipeline

1. **Normalize inputs:** validate tile-sheet format, tile scale, palettes, semantic labels, anchor bounding boxes, connectors and world rules. Preserve raw creator assets and metadata.
2. **Place anchors with a constraint solver:** find a layout that satisfies hard distance limits, landmass memberships, geographical feature corridors and creator-fixed positions. Let artists manually move anchors and lock placements.
3. **Build a macro-world skeleton:** establish continents/islands, coastline masks, elevation regions, mountain chains, drainage basins, biomes, corridors, trade/travel routes and reserved buildable space before individual tiles.
4. **Generate terrain locally:** use deterministic seeded algorithms (e.g., multiscale noise, domain warping, distance fields, constrained feature masks and optional lightweight erosion). A mountain range should affect valleys, water flow, coastlines, travel routes and nearby biomes; a desert should have a plausible location relative to mountains/climate unless fantastical generation is expressly selected.
5. **Satisfy artist terrain allocations:** place flat and gently sloped pads by distribution policy; provide real clustered areas for settlements and future user assets while maintaining usable access.
6. **Translate to the supplied tileset:** use semantic metadata and adjacency/autotile transition rules for cliff edges, elevation steps, water/shore boundaries, roads, vegetation and biome changes. Where the provided art lacks a needed transition, show a clear "missing tile/rule" notice and supply a controllable fallback; never silently invent counterfeit tiles.
7. **Blend, validate and revise:** connect anchor-map exits and their world elevations without cutting through protected content. Validate water connectivity and drainage, coast/landmass connectivity, corridor features, traversability and pathfinding, buildable region quotas, constraint satisfaction and renderer budget.
8. **Stream chunks:** store a generation seed, versioned rules, world layout, hand-authored changes and chunk-level overrides. Derive unloaded terrain on demand and cache results; avoid a giant fully materialized million-tile map in RAM. Preserve stable locations across visits and save/load cycles.

Procedural generator controls may include **Idyllic**, **Beautiful**, and **Fantastical** terrain personalities, adjustable intensity, mountain frequency, openness, biome variety, and preferred minimum amount of inhabitable flat terrain. Profiles affect style; they do not override creator-specified hard geography.

## 5. World sizes and the future endless-feeling option

- **Tiny:** small authored world with short journeys; useful for prototype games and lightweight devices.
- **Large:** sizable explorable region with meaningful space between authored places.
- **Expansive:** a continent or multi-continent world around a handful of authored anchors; optimized through chunk streaming, lod/low-cost map overviews and generator determinism.
- **Endless-Feeling (future):** a huge but finite world whose horizon continually unfolds via seeded chunk generation and optional new regions. It should *feel* boundless through scale and discovery without promising literal infinity or requiring unlimited storage, RAM or bandwidth.

The UI should expose actual numerical dimensions and a realistic budget for the selected tile scale/device profile rather than pretending the labels themselves are fixed technical capacities.

## 6. Editable shared world truth

Maintain a renderer-agnostic, semantic world representation: coordinates, tile IDs, elevation/terrain classes, object bounds, biome membership, water/landmass relationships, connections, collision, roads, protected map masks, landmarks, chunk ownership and generator provenance. Support conventional top-down tiled RPGs first; allow eventual 2.5D isometric/world-map projections and optional 3D terrain translation when appropriate geometries/assets exist.

Each artist edit becomes a durable override. Creator-specified paths, plot-critical locations, protected maps and saved settlements survive regeneration. Regenerate selective unprotected regions with a preview of downstream changes to waterways, roads, biome transitions and traversal.

Expose the same truth as open, documented, versioned machine-readable JSON/JSONL so local tools, external software and optional AI agents can work with it. Agents can interpret descriptions and spatial rules, while the engine remains the authority for collision, connectivity, constraints and reproducible world state.

## 7. Delivery milestones

**MVP:** import a tile sheet; mark 3–4 protected map anchors; min/max pairwise distance; Tiny/Large/Expansive; same-landmass vs island vs different-continent controls; mountain/desert/ocean-between directives; preview valid anchor placement; create a reproducible top-down tiled world with sensible seams, flat buildable areas, pathfinding and save/load. No paid AI dependency.

**Next:** nuanced coastline/inlet semantics, editable constraint graph, enhanced river/drainage/biome models, player travel-time constraints, custom terrain personalities, better automated semantic labeling with manual correction, selective regeneration, and optional 2.5D/3D projection.

**Later:** Endless-Feeling streamed world scale, shared game-world publication/export, developer/plugin API and optional local or remote AI world-design assistance. These are aspirational, not guarantees of current capabilities.

## 8. Non-negotiable experience principles

- The user owns the hand-built places and decides how the surrounding world behaves.
- Simple language and a visual map first; sophisticated constraint controls only when wanted.
- The engine *explains* when two geographic commands conflict; it never quietly erases either.
- Geographic rules create a place with coherent relationships, not randomly distributed pretty tiles.
- Generated terrain remains editable and replaceable by artist work.
- Local, affordable, AI-optional generation and low-resource operation are first-class goals.
- Terrain should be a canvas for the next village, dungeon or story—not merely a decorative backdrop.

**One-line product vision:** "Draw the places that matter. Describe the distance, land and wonders between them. ÆXIS gives you the rest of the world."
