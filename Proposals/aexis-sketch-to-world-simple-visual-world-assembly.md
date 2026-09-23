# ÆXIS — Sketch-to-World: Simple Visual World Assembly

**Status:** Proposal only; no generator/editor/portable-world feature is claimed to exist yet.
**Date:** 2026-09-23
**Relationship:** Companion to the existing ÆXIS Worldweaver artist-anchored procedural world-generation proposal.
**Product principle:** Maximum creative freedom, minimum required input. The user sketches intent; the engine constructs believable geography. Local/offline generation works without ChatGPT or another AI service.

**FrameChute context:** Product/editor proposal; the standalone Tiled-223D renderer and generator integration is future work. See [Worldweaver](aexis-worldweaver-artist-anchored-procedural-world-generation.md).

## The promise and the shortest possible path

"Import your places. Draw roughly where the land should be. Pick a mood—or leave everything on Default. Press Generate."

The normal creator flow should be:
1. Open an initially ocean-filled **500 × 500 tile world canvas** (adjustable later; do not confuse world tiles with screen pixels).
2. Import existing maps, for example several **50 × 50** Tiled maps; place, rotate if supported, and arrange them visually. Preserve each imported map as an authored, protected anchor, including its tile semantics, height, exits, collision, objects and source provenance.
3. Sketch lines, quadrilaterals, circles/ellipses, or optional freeform polygons around places that should **not be ocean**. Mark optional water regions or channels where land must not occur.
4. For each shape choose **Desired area (default)** or **Actual edges**. Leave all optional terrain settings on Default or open a small form with a few plain-language dropdowns.
5. Optionally enter a one-line instruction, e.g. "Make this one island", "Make these two islands", or "Connect both towns on the same landmass but leave an ocean inlet between them." Hit Preview; adjust only if desired.
6. Save the editable draft; launch the local generator with a beginner-friendly **.bat** entry point on Windows (and a script/CLI counterpart elsewhere); obtain a versioned generated **.js** module in the schema the renderer actually reads. Load/import that module through the renderer's supported local workflow. Do not assume the current renderer already accepts arbitrary uploaded JS.

An ordinary creator should never have to configure a noise algorithm, place hundreds of terrain tiles, install an AI connector, learn GIS, or use advanced geometry terms.

## Canvas and protected imported maps

- The 500 × 500 grid is a familiar first canvas, *not* a hardcoded limit for future Tiny/Large/Expansive worlds. A 50 × 50 map takes up its true 50 × 50 tile footprint, not 50 screen pixels. Show snapping, scale, boundaries, overlap warnings and a lightweight map preview.
- Imported maps may be apart, touch, or sit on different landmasses; blank tiles between them are space for the engine, not automatic land. Default terrain outside explicitly requested land is ocean.
- An imported map interior is authoritative by default. Generate seams and approaches **outside** protected maps; explicitly preview any proposed edits to a hand-built shoreline, elevation, road, entrance or collision region.
- Support the earlier Worldweaver min/max distances and island/same-landmass/other-continent relationships as optional advanced controls; the user who already positioned their maps need not fill out a constraint graph.

## Drawing semantics: an approximate outline is not a geometric coastline

For each drawn shape, expose a prominent two-choice toggle with friendly descriptions:

- **Desired area — "Land roughly here" (default):** The stroke/rectangle/circle is a *soft geographical envelope*, not a coastline to trace. Vary the boundary with seeded multiscale features, bays, inlets, peninsulas, shoreline shallows, usable beaches and terrain transitions. A circular scribble must **not** mechanically become a circular island; a quadrilateral must **not** make a boxy continent. An area may still need a user-selectable tolerance to keep land reasonably within the sketch.
- **Actual edges — "Respect this boundary":** The creator intends a real fixed coast, cliff edge, map edge or territorial boundary. Preserve the intended traced boundary within an explicit tile-level precision/tolerance, apart from clearly previewed cosmetic surf/shoreline rendering; do not erode away an authored inlet or replace a requested shape with noise.
- **Lines** may be a hard shoreline/coast, a centerline or corridor for approximate land, or a desired land bridge. A zero-width line should not silently imply a physically usable island: offer a simple width dropdown or sensible default.
- Optional shape intent dropdown: **Land here / Water here / Connect these / Keep separated**. Water is not an afterthought: allow lakes, straits, bays and ocean corridors. Shapes may overlap; show which hard rule wins, and report irreconcilable commands rather than silently changing them.
- Boundary/shape mode belongs to *each shape*, not only a global switch. Existing anchored coastlines remain protected irrespective of generic soft envelopes.

## The tiny form: generous choices, almost no required questions

Show a compact card when a user clicks a shape or region. **Default** is an actual working option at every level. Put infrequent controls behind "More options," use simple wording, and show an immediate low-cost schematic preview.

Example card:

| Form row | Simple dropdown / control | Default behavior |
|---|---|---|
| Shape means | Land here / Water here / Connect / Keep separated | Land here |
| Boundary | Desired area / Actual edges | Desired area |
| Landscape mood | Default / Idyllic / Beautiful / Fantastical / Custom | Default uses a coherent neutral style |
| Landmasses | Default / One island / Two islands / Several / Connected mainland | Default inferred from drawn constraints and anchors |
| Mountain ranges | Default / No / Yes | Default uses regional terrain style |
| If yes: how many? | Default / One / Two / Few / Many / Custom number | Sensible number for region size |
| Arrangement | Default / Clustered / Separate / Random-looking / Along a ridge | Plausible layout, reproducible with a seed |
| Mountain height | Default / Low / Medium / Dramatic / Custom numeric | Suit the mood, map elevations and region |
| Terrain mix | Default / Mostly plains / Forested / Coastal / Desert / Varied | Environmentally coherent |
| Shores | Default / Gentle beaches / Rocky / Cliffs / Mixed | Plausible with local elevation |
| Open building space | Default / A little / Plenty | Usable contiguous land, not scattered isolated pixels |
| Additional instruction | Optional short text, e.g. "one island, two mountain groups" | Empty: engine decides |

The maker can select **Fantastical + Yes mountains + Two + Separate** in a few taps, or leave the card entirely untouched. "Idyllic," "Beautiful," and "Fantastical" are **style profiles**, not hard demands for arbitrary mountains everywhere. A mountain count is regional; show which selected shape it applies to. For conflicting entries ("No mountains" plus "Two mountain ranges") ask for a simple correction. Avoid a scrolling wall of controls, a mandatory multi-step wizard, and asking for min/max distances the sketch already resolves.

Optional **Custom instruction** should remain simple and work without AI: expose common phrases as chips / template selections interpreted as validated constraints, and show a friendly notice if arbitrary prose cannot be parsed. An optional LLM can help convert prose into the same explicit constraints; it cannot secretly override actual edges, water exclusions, protected map interiors, or terrain budgets.

## What the local generator does

1. Validate the draft, source map footprints, semantic tile metadata, elevation and shape choices; keep original maps unchanged.
2. Construct a low-resolution land/water plan that satisfies hard actual edges, protected map geography, forced waterways, requested one/two-island count and intended connectivity. Interpret *desired* sketches as soft guidance.
3. Develop coastlines with seeded large-to-small variation so drawn circles and quadrilaterals become credible geography. Preserve explicit actual edges, ocean exclusions and navigable-water requirements.
4. Generate mountain chains and other terrain **as features with shape and relationship**, not isolated random humps: clusters/separate placement, count and height follow the selected form. Connect elevations, watersheds, paths, gentle/steep slopes, biome changes and usable building areas.
5. Blend only unprotected seams between placed maps and generated regions; enforce passable exits, water-vs-land collisions and plausible altitude joins.
6. Translate the result to the available tileset/semantic terrain representation. If the tileset cannot express a necessary transition, report it and offer a visible fallback; do not infer semantic meaning from image colors.
7. Provide a quick low-resolution Preview, an optional more detailed preview, and **Generate**. Save the generator version and seed so a minor edit does not rearrange unrelated geography. Permit regeneration of chosen unprotected regions.

**Safety/feasibility for geometry:** A two-island command must yield two distinct traversable landmasses in the selected region, unless explicit hard constraints make that impossible—in which case show the conflict before generating. Ocean between two maps on the same *continent* can mean a gulf/strait with the dry-land connection going around it, or a shared continental shelf without a continuous overland route; keep these interpretations explicit rather than silently deleting the ocean.

## Draft, BAT launcher and renderer contract

Treat the **editable project** and **generated runtime artifact** as separate outputs:

- Store the editable draft in versioned, readable **JSON**, with world extent, map asset references/content locations, locked author regions, per-shape coordinates and modes, constraints, optional dropdown selections, freeform instruction, procedural seed and generator version. Keep assets local unless the creator explicitly exports/shares them.
- The Windows **.bat** script should invoke the local generator against that saved draft, report missing dependencies/readable errors, and write a deterministic versioned **world-data.js** (or equivalently named ES module) plus any needed assets/metadata. A cross-platform script/CLI can offer the same workflow. No remote account or API key required.
- The generated module must export **the canonical terrain/elevation/structure/semantic records that the target renderer agrees to read**; no brittle text replacement or executable arbitrary user-submitted JS in an upload field. The runtime importer/adapter is a separate implementation task: where the current renderer lacks this flow, add a safe schema-validated import/loading interface first.
- Support a simple Open Generated World / Import World button or documented local file placement workflow, not a misleading "upload anything.js" promise. Preserve source map provenance, protected edits, original tile semantics and stable object IDs.
- For low-memory computers, batch geometry and stream/cache chunks near the player. Never render/simulate every tile as an independent 3D mesh or assume the 500 × 500 canvas must become an enormous GPU texture.

## Future: lift and drop a whole finished world as a reusable chunk

A user can select a complete created world, **Pick up as one chunk**, and place it elsewhere in a larger world. A placed instance stores an independent world transform, elevation, orientation, scale (within supported tile/asset rules), edge policy, provenance and stable identity; the source world is unchanged.

After placement the renderer generates a **controlled seam zone** around the chunk and connects its *bottom/perimeter ground* to the destination's topography: natural slopes, foothills, cliffs, beaches, roads, river connections and biome transitions as appropriate. Do not flatten or overwrite the imported village or its protected terrain just to force a join. Allow simple joining modes **Automatic (default) / Gentle blend / Dramatic cliffs / Leave unchanged** and a preview of affected destination tiles.

An ocean island, a desert plateau and an inland village need different joining rules. If a drop creates an impossible connection or intersects another locked region, highlight the collision and offer a new placement/elevation or less invasive seam. The creator can intentionally preserve a floating island or hard edge; aesthetic blending is never compulsory.

Later, support multiple world chunks, nested world-map overviews and tile/2.5D/3D views, all sharing the same authoritative map positions, heights and collision rather than rewriting world logic for each camera. Never claim spherical geometry or infinite terrain merely because the current renderer repeats a finite map.

## Implementation phases / acceptance criteria

**Phase 1 — smallest useful creator flow:** 500 × 500 draft; import and protect 50 × 50 maps; placement; circle/quad/line brushes; per-shape Actual edges vs Desired area; land/water rules; Default + one/two-island instructions; preview; save draft; offline BAT-to-schema-compatible JS; load the generated world in the renderer; retain original imported map interiors. Prove a hand-drawn circle results in an irregular island while an Actual edges boundary remains fixed.

**Phase 2 — delightful optional form:** Idyllic/Beautiful/Fantastical moods; mountain yes/no/count/clustered/separate/random-looking; biome and shore dropdowns; usable buildable space; preview-and-revise; localized deterministic regeneration; optional plain-language or agent-assisted constraint entry. Default must remain zero-configuration.

**Phase 3 — portable worlds:** export/instantiate a complete world chunk into another world, reconcile elevations and land/water boundaries, preview seam effects, retain the original and support undo/relocation. Add large/expansive chunk-streamed canvases as budgets allow.

**Quality bar:** Two users—one who presses Default and one who uses six dropdown selections—can each produce a coherent, revisitable geography around their hand-built maps without understanding procedural generation. Every advertised action should be an actual functional operation rather than a decorative form or placeholder.

**Single sentence to preserve:** "Sketch the land you imagine, choose as much or as little as you like, and ÆXIS makes the world around your maps."

---

## Addendum — Town Placement Mode: GLB Scene + Circular Connection Plane (2026-09-23)

**Design clarification:** A portable town does not have to be a whole generated world. A creator may import an ordinary GLB village as **one grouped scene/object**, attach a simple circular **connection plane underneath**, position that assembly anywhere above, at, or below existing world terrain, and then choose what—if anything—connects the town to the destination world. **The plane is the interface; the GLB is the content.** Houses, trees, roads, and scene props stay inside the imported GLB rather than being regenerated as world tiles.

### One-minute creator flow

1. In the already generated ÆXIS world, click **Place Town** and import a GLB. Preview its footprint and orientation. Preserve the original GLB and scene transforms.
2. The editor creates a **circular connection plane** underneath the GLB, sized to its projected base. Show the plane as a visual guide, not necessarily permanent visible geometry. Provide simple **Align to Ground**, radius, horizontal position, rotation, and vertical elevation controls. Let creators move the town and plane **together**, while also adjusting the plane relative to the GLB when necessary.
3. The creator positions the complete assembly anywhere: above the ground, intersecting it, flush with it, or lower than its surroundings. Preview intersections before placement.
4. On **Place Town** / **Enter**, ask: **How should your town connect to the world?**
   - **Allow to float:** leave the town suspended without a supporting platform or new terrain. No implicit terrain edits; appropriate for magical or surreal scenes.
   - **Place a floating disk underneath:** attach a **designer-provided, interchangeable platform** beneath the plane, scaled/aligned to the town's base. Offer friendly themed presets, e.g. grassy floating island, natural stone, futuristic metal, fantastical crystal; allow changing the selection later. The disk is a scene/support object, not a demand to regenerate the underlying world.
   - **Create terrain to reach the town:** edit **only nearby unprotected terrain chunks** to meet the connection plane's perimeter and elevation. Sample the existing destination ground, then construct appropriate hills, slopes, embankments, a mountain/plateau, cliff face, valley or depression depending on the height difference, neighboring biome, coastline, passable entrances, and creator's selected style. Simple styles: **Automatic (default)**, **Gentle slopes**, **Dramatic cliffs/plateau**, **Mountain rises to town**.
5. Show a **real preview before commit** (including affected terrain footprint, platform/float silhouette, collision/path connections and undo scope). On confirmation, commit the placement as a movable, reversible instance; allow relocation and changing support mode later.

### Connection-plane contract

Record the plane's local-to-GLB transform, footprint center and radius, world transform, elevation, boundary/perimeter, connection mode, optional platform preset, optional terrain style, protected-zone rules and stable IDs. Use this representation to connect the world **without needing to understand every GLB house or decorative object**. It is reasonable for the first version to support one flat circular plane, while clearly warning if a GLB's actual ground is not flat or protrudes beyond the circle; offer manual alignment and radius adjustment rather than pretending automatic bounds guarantee a usable ground surface.

The **plane may remain invisible at runtime** after serving as the guide for support geometry, terrain transition, placement, and collision. The underlying GLB remains a normal rendered scene or asset group with its own materials/LOD and optional collision proxies. Do not infer walkability from the presence of a visual plane: declare a separate authoritative ground/collision/walkable footprint and explicit entrance/path anchors when needed. Never run or execute arbitrary embedded GLB logic.

### Inexpensive, localized terrain joining

For **Create terrain to reach**, take elevation and material samples in an annulus outside the plane, determine the height difference and permissible seam width, then create a smooth, bounded blend or chosen cliff/mountain connection. Respect locked maps, authored shorelines, water exclusions, roads and existing terrain outside the affected zone. If the proposed join conflicts with locked terrain, water, other objects, or available space, explain it and offer simpler alternatives: move/raise/lower the assembly, reduce the radius, switch to cliffs or use a floating platform. Preserve the town's mesh and authored internal ground; do not flatten buildings, regenerate the GLB, or overwrite unrelated chunks.

The simple circle is an **attachment footprint**, not an instruction to generate circular coastlines or circular terrain transitions. Use soft, context-aware variation outside the precise connection boundary so the resulting surrounding land is organic while maintaining the hard surface necessary to join the town.

For a hillside settlement, future modes can replace/supplement the flat plane with a custom uneven ground mesh, sampled heightfield or linked planes; keep the same three user-visible placement choices. No need to implement that complexity in the first pass.

### Implementation priorities and acceptance cases

**First version:** Import one GLB, provide a visible/editable circular connection guide and Align to Ground, move/rotate/change elevation, choose **Float / Designed disk / Terrain join**, preview, confirm, save/reload and undo. Test one town floating unsupported, one using a fitted disk, one on a high plateau joined by generated hills, and one below nearby ground connected via a depression. Source GLB and protected maps remain unchanged. Ensure only the affected chunk set is rebuilt for a terrain join; preserve terrain/elevation/collision truth independently of display meshes. Support offline/default operation on low-memory devices and do not claim the editor already implements this proposal.

**Later:** Alternative plane outlines and uneven ground meshes, multiple entrances, snapping paths to the road network, advanced platform libraries, independently moving whole-town instances and nested town/world placement. These are optional enhancements, not prerequisites to the effortless original workflow.

**Creator-facing promise:** "Drop in your little town. Position it wherever you like. Let it float, give it a beautiful platform, or let the world grow up to meet it."
