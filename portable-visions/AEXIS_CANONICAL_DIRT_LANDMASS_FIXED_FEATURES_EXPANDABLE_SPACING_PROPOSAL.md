# ÆXIS — Canonical Dirt Landmass, Fixed Features, Expandable Spacing

**Status:** Design and Codex implementation proposal; NOT a claim that this architecture, editor or driving system already exists. This document supersedes conflicting interpretations of the dirt-continent experiment in PR #30 without rewriting any source maps.  
**Shared locations:** Tiled-223D (ÆXIS engine), SUBSTRATE (creator workspace), FrameChute (optional browser-extension workspace).  
**Related:** `AEXIS_EXPANSIVE_ROAD_LEVEL2_COUNTRYSIDE_AND_TILED_DESTINATIONS_PROPOSAL.md`; `docs/EXPANSIVE_DIRT_VERTICAL_SLICE.md` in Tiled-223D describes the experimental PR #30 implementation, not this final intended design.

## 1. The creator's precise rule

**One canonical 500 × 500 Tiled world, one new canonical dirt landmass, and three scale interpretations of the SAME saved landmass. Preserve every authored ramp and other protected feature exactly; when expanding, lengthen the traversable space BETWEEN these features. Never enlarge a ramp into a cliff or invent three unrelated sets of ramps.**

The new landmass is approximately **one third of the world in the default showcase** and exists in the 500 × 500, 2,500 × 2,500 and 16,000 × 16,000 worlds. Its **relative footprint, outline, position, feature identities and topology** derive from the saved canonical Tiled map. It is NOT three independent elliptical continents generated afresh and NOT a recoloring of one third of the original islands. The original islands, their original textures, elevations, geometry, trees and destinations remain separate and protected. The canonical map is the geographical reference; a future creator may edit the footprint and its intended proportion. A small patch in another authored Tiled map may have exceptionally long internal travel while staying small on the overview.

**Two distinct notions of expansion:**
1. **World-scale selection**: Current (500 × 500), Bigger (2,500 × 2,500), Massive (16,000 × 16,000). Maps use the same canonical Tiled geographical proportions, scaled to each world's coordinates. This DOES NOT imply that authored ramp meshes increase in size.
2. **Landmass experience expansion**: what happens *on or driving across* a chosen region—experienced length, gaps between fixed features, mostly-flat in-between terrain, traffic/roadside scenery, camera/speed and region-specific travel rules. Default: use the current world's established expansion profile with a deliberately tuned dirt-driving presentation. Optional: **replace** that inherited profile entirely with a landmass-specific profile, for example apply ocean-like expansion within a dirt patch on the 500 × 500 world. Replacement is NOT an implicit multiplier, overlay or combination with the original world rules.

The experience-space distance may be longer than a bird's-eye exterior-world coordinate interval. Keep explicit, stable mappings from experience-local progress to canonical points/entry/exit. Do not physically stretch the whole exterior planet or teleport authored destinations. The forest-only locations described in the related proposal remain reachable through their defined experience by default; exposing direct external flight access is a separate creator decision.

## 2. Produce the small original ONCE, then save it

In the canonical 500 × 500 generation workflow, generate/author the **new dirt landmass** from the same Tiled geographical source as the two existing islands, using deterministic mathematical terrain synthesis. Persist the canonical production before deriving any larger world, including:
- stable landmass ID, original Tiled source/version, 500 × 500 map space, location, coastal outline/mask and relative world footprint;
- canonical dirt surface palette/seed, mostly-flat elevation baseline, tiny rolling variations and saved color-region descriptors;
- each individual large/medium/small ramp with stable ID, exact local size, footprint, shape/height profile, orientation, position and collision/visual representation;
- protected features such as authored rocks, roads, crossings, structures, clearings, destination anchors, and any no-build/no-ramp clearance zones;
- deterministic inter-feature interval IDs and expansion-safe variation rules, profile schema/version and any authored overrides.

Persist both numerical/semantic descriptors and sufficient deterministic procedural recipe to rebuild detail without storing an enormous full-resolution mesh. A saved source ramp stays the same on reload; changing random seeds or selected world scale does not silently replace its shape, count, ID, order or location relative to other protected features. Changes to the original are explicit revisions; derived worlds can be invalidated/regenerated from that revision.

For the initial default landmass: roughly one-third of the canonical world; broad light-/medium-/dark-brown patches, subtle outlines and **mostly flat actual ground**. Color variation should usually be visual/material variation rather than a new height bump. Small terrain undulations may be sampled coherently; preserve a safe driving corridor and reasonable isolated high points. Make all defaults configurable later through the same editor/SDK surface used by the built-in preset.

## 3. The exact protected-feature rule

**Fixed ramps:** Their mesh/profile, width, height, orientation, local contact surface, launch geometry and collision response do not change when selecting Bigger or Massive or when increasing travel expansion. A large ramp may be large relative to a vehicle but it must NOT scale by 5× or 32× as a consequence of the world setting. No duplicate ramps merely to fill additional distance.

**Expandable intervals:** Record the space between the edges of consecutive protected feature footprints as a distinct interval. Expansion adds/interpolates traversable dirt **inside that interval**, leaving each endpoint feature unchanged. Maintain ramp order, left/right relationship, bearing and intended connectivity. For roads/paths, insert additional coherent, mainly flat segments, lightweight texture/color detail and appropriately spaced decoration between ramp clearance envelopes. Merge to each ramp at its authored approach/exit elevation with continuous height and sensible slope and normals; avoid abrupt seam, floating ramp, invented cliff or collision discrepancy.

A conceptual one-dimensional route example (illustrative only):

```text
Small source:   entry -- [ramp A] ---- [ramp B] -- [ramp C] -- exit
Bigger:         entry -- [ramp A] ---------------- [ramp B] -------- [ramp C] -- exit
Massive:        entry -- [ramp A] ----------------------------- [ramp B] ---------------- [ramp C] -- exit
                ^ ramp A/B/C footprints and jumps do not scale; only open gaps change
```

Do not assume linear spacing across every path: use a monotone, invertible, piecewise mapping along each route/landmass travel coordinate. Protected feature intervals map with slope 1 (or explicit physical-size preservation), unprotected gaps absorb the selected expansion distance. Where the canonical geography is 2D rather than one road, preserve feature neighborhoods/topology and develop a continuous local 2D warp or corridor decomposition that cannot fold features over one another. Declare unresolved multi-road intersections, overlapping protection zones, path splits and incompatible expansion budgets instead of silently deforming a ramp.

Illustrative math: protected features `F_i=[a_i,b_i]` have `length_expanded(F_i)=b_i-a_i`; inter-feature gaps `G_i=[b_i,a_(i+1)]` receive nonnegative additional length `E_i` and `length_expanded(G_i)=length(G_i)+E_i`. The selected total experienced length is the sum of unscaled features plus expanded gaps. Allocate `E_i` by safe available gap weights and authored constraints, never by scaling the fixed features. If a segment is too crowded or a creator asks for less length than the protected features and minimum clearances require, return an explicit infeasibility diagnostic.

**A ramp located halfway across the original experience remains the same ramp**, but its expanded route-progress coordinate can shift according to the gap allocation. Do not independently regenerate new random ramps at "50% progress" in each scale. Canonical map proportions on the overview and actual experienced progress while driving are separate, deliberate coordinates.

## 4. Initial default ramp rules: sparse, enjoyable, non-clustered

The revised initial proposed spawn rates are **5% large, 3% medium, 10% small**. State precisely what percentage means: for this first default use a probability **per eligible, independently spaced canonical candidate zone**, NOT a claim that 5%/3%/10% of the continent's surface area is covered in ramp geometry. Creator API/editor may later support area-coverage targets as a separate, clearly labeled mode. Do not keep the superseded 10%/9%/30% numbers.

Generate candidate zones only in safe, suitable parts of the original 500 × 500 dirt landmass, never inside existing islands, coast protections, destination footprints, water, steep slopes, another ramp's clearance envelope or an authored no-placement zone. Select deterministically with a stable seed and spatial exclusion/Poisson-disk-like clearance; large ramps need wider approach/landing clearance than medium or small. Resolve overlapping candidate sizes deterministically, enforce a minimum gap between ramps, and provide a long safe approach/exit where high driving speeds require it. A creator can change probabilities and minimum separation *before an explicit regenerate*; changing world size alone does not re-roll them.

The ramps are actual traversable terrain profiles—not decorative images. The near mesh, swept vehicle/wheel collision queries, map/overview indications where warranted and cinematic impact/jump cues must refer to the SAME sampled geometry. A default ship need not have the future wheel/hydraulics system yet, but never advertise completed fun driving physics while only an approximate visual slope exists.

## 5. Sparse visual and physical interpretation at all three scales

The physical canonical Tiled geography determines the map-level outline and proportional position of the dirt region in **all three** world overview representations. The world renderer can draw a low-cost, coarse distant brown landmass aligned with that outline. The near-ground interpreter streams a bounded set of tiles/chunks near the active player with expanded inter-feature dirt, subtle shades, high points only where allowed, ramps that retain their original exact mesh/height profile, and context-appropriate light/atmosphere.

Keep an explicit separation of:
- canonical 500 × 500 surface and saved feature descriptors;
- world-space scale/overview transform;
- experience-local expanded traversal and in-between procedural detail;
- bounded GPU presentation (far coarse representation, near geometry and occasional 2D proxies);
- authoritative collision sampling corresponding to the **currently active experience representation**.

Do NOT allocate a 2,500² or 16,000² height/ground grid to implement this. Generate bounded, deterministic chunks from saved original data plus a profile; use versioned seeds, consistent boundary conditions, caching and stable LOD transitions. Do not render the close mesh and coarse mesh over exactly the same area without clipping/blending—avoid depth fighting, coastline gaps, conflicting elevations, and the appearance of the dirt sheet covering the existing islands. On a 4 GB test machine, profile CPU frame time, JS heap, GPU memory, upload frequency and camera behavior from ground to orbital overview.

The earliest exploratory PR #30 implementation uses an **independently sampled ellipse** and per-scale analytical ramps. That is an intermediate experiment, NOT the intended same-Tiled-landmass/same-ramp architecture. Do not claim that changing its scale gating or probabilities alone satisfies this proposal.

## 6. Defaults, replacement policies and creator access

The first showcase should work without editing anything: a coherent one-third dirt landmass in the canonical small world; mostly flat dirt and sparse fixed ramps; standard world expansion inherited in all scales with dirt-specific **presentation/driving tuning**, not hidden compound multiplication. If dirt needs ocean-like feel, make that an explicit named/default profile choice that fully defines the effective behavior; keep true expansion-profile inheritance vs replacement unambiguous.

```ts
// PROPOSED versioned data shape; not an existing runtime API.
type LandmassExpansion =
  | { mode: "inherit-world" }
  | { mode: "replace"; profileId: string; rules?: DirtExperienceRules };

type DirtLandmass = {
  id: string;
  sourceMapId: string;
  canonicalMapSize: [500, 500];
  canonicalRegion: SavedRegionMaskAndTransform;
  features: SavedFixedFeature[];      // same IDs and physical shapes for ALL scales
  intervals: SavedExpandableInterval[];
  expansion: LandmassExpansion;
  rampGeneration: {
    seed: number;
    probabilityByEligibleZone: { large: 0.05; medium: 0.03; small: 0.10 };
    minimumClearanceBySize: Record<string, number>;
  };
};
```

The current world selection establishes world dimensions and default experience profile. For each landmass resolve exactly ONE effective profile: `landmass.mode==="replace" ? landmass.profile : world.defaultProfile`. Dirt-specific *surface handling* (wheel support, collision, visual palette) is a different dimension from expansion-profile stacking: it must not secretly multiply experienced distances again. A creator can choose the ocean expansion profile on a tiny 500 × 500 landmass while keeping its proportional Tiled placement.

**Simple editor:** select the dirt landmass; show its Tiled footprint and unchanging ramp IDs; toggle "Use world expansion" / "Replace with selected profile"; choose a preset or custom profile; change overall travel distance and interval allocation, tint/outline/flatness, ramp probabilities (with clear "regenerates canonical features" warning), size/spacing clearance, and preview the ground-level and world overview results. Slider + exact value for each control, undo/restore defaults and per-world-scale preview. A creator must not need to write code to do this.

**Programmer/agent API:** versioned inspect/list/source/feature/progress mapping/preview/plan/commit operations with authorized edits, validation and diagnostics for overlapping features, insufficient interval lengths, mismatched authored anchors, duplicate IDs, performance budget, and unsupported direct exterior-flight connections. Expose deterministic regeneration and a dry-run that reports how many canonical features would change before applying it. API and editor are two views of the SAME settings; the ÆXIS default itself is one saved editable preset.

## 7. Codex implementation and acceptance plan

1. **Protect the existing islands and separate authored source from generated interpretation.** Compare PR #30 against the intended contract. Stop treating the independently generated ellipse as the authoritative geography. Introduce a canonical new dirt region in the **same source Tiled map** (or an explicit, persisted canonical map-layer addition that does not overwrite the original island cells), with stable region mask/outline and landmass ID. Preserve original source maps and source elevation backups.
2. **Canonical feature generation.** Generate and save the 500 × 500 mostly-flat brown dirt representation ONCE. Save exactly the selected ramps and fixed footprints/terrain shapes, seed, clearance and original source-relative positions. Defaults: large 5%, medium 3%, small 10% per eligible separated candidate zone. Test deterministic reload and count/shape invariance; protect island cells.
3. **Piecewise gap-expansion interpreter.** Derive Current, Bigger and Massive from the same saved source and feature list. Preserve every ramp's mesh/contact dimensions; distribute additional experienced distance only over allowed intervals with safe height and collision joins. Maintain canonical overview location and proportional region outline in all three worlds; explicit infeasibility errors rather than silent ramp scaling. Support an ocean-style replacement profile on a small world as a concrete proof.
4. **Bounded rendering and navigation.** Generate and cache coarse/near representation chunks, limit memory, ensure exact authoritative ground/collision agreement at feature contacts, avoid overlapping LOD artifacts, and keep world-to-experience mapping stable under reverse travel, turns and stage transitions.
5. **Editor and API in increments.** First expose truthful source/feature/profile inspection and nonmutating previews; then implement authorized deterministic edits with revisioning and persistence; finally add friendly sliders/exact fields/undo. Existing incomplete APIs must report capability honestly.
6. **Validate before merging.** Automated tests and browser screenshots for 500, 2,500 and 16,000 worlds: landmass proportional location and outline, untouched original islands, unchanged ramp count/IDs/sizes/geometry and order, increased interval lengths, seamless ramp contacts/collisions, easy driving, correct ocean/land boundary, stable main/preview cameras, no overwrites on Tiled import, and roughly 4 GB hardware performance. Test a custom landmass replacing its inherited rule with ocean expansion in the small world. Review PR #30 and create follow-up commits or a replacement PR rather than merging a mismatched prototype.

**One-line promise: The map tells us where the landmass and its ramps are; our saved small-world production tells us what each ramp is; expansion changes the journey BETWEEN them. World defaults make it delightful immediately, and the editor/API make every choice understandable and replaceable.**

## Addendum — Generate the canonical world once; save mathematical constraints; stream deterministic geometry

**Decision for the small-machine target:** Generate and persist the original 500 × 500 dirt-landmass production **once**. Derive an expanded-experience plan from that saved source and the selected profile, retaining the same feature identities and geometry in every world size. Generate/render only bounded nearby terrain chunks as the player approaches. A chunk may be rebuilt after unloading, but it must reproduce the **same place**, not create a new random landscape on each visit. This is the intended balance between a persistent world and the roughly 4 GB target machine.

### Three distinct operations, with different lifetimes

1. **Canonical source production (once, then explicit revision):** Save the original Tiled-relative geographical footprint, dirt palette and color-patch recipe, mostly-flat base terrain/elevation constraints, deterministic seeds, individually identified ramp meshes/profiles and collision footprints, no-build clearances, authored locations, topology, route connections and source schema version. Persist this source independently of transient GPU meshes; retain the original islands unmodified. Ramps are selected and fixed **here**, with default probabilities of **5% large, 3% medium and 10% small per eligible, adequately separated canonical candidate zone**. An explicit creator regeneration can revise them, but ordinary reload, world-scale switching or approaching them cannot.
2. **Expansion interpretation (once per relevant source/profile revision, with compact persistent or reconstructible descriptors):** Resolve the currently selected world's default expansion rules, unless this landmass explicitly **replaces** them with one other selected profile. Preserve the Tiled map's relative outline and placement in Current (500 × 500), Bigger (2,500 × 2,500) and Massive (16,000 × 16,000). Assign stable IDs and deterministic seeds to the expandable intervals **between** the unchanged ramp/feature footprints, record their effective experienced lengths and coordinate mapping, and define color/elevation interpolation and safe joins. Cache/save the compact plan or derive it reproducibly from saved canonical data plus a versioned expansion profile; do not save enormous full-resolution representations unnecessarily. Never combine inherited and replacement expansion distances by silent multiplication.
3. **View-dependent geometry (as needed and disposable):** Near the ship/vehicle, build a bounded detailed mesh and matching authoritative ground/collision samples from the saved mathematical recipe and expansion plan. At middle distance use simplified geometry and silhouettes; at planetary scale use a cheap coarse representation of the same canonical landmass outline. Stream/prefetch chunks in the direction of travel. Keep an optional small, bounded recently used mesh cache for quick reverse driving; discard distant GPU/CPU vertex buffers without discarding their source definitions. On revisiting an unloaded chunk, recompute its *same* deterministic height, brown shading, features and road alignment. Do not reroll or relocate ramps, roads, destinations or shared multiplayer collision obstacles.

### Mathematical contract and feature continuity

For each mapped expanded interval `I`, a deterministic function `H_I(u,v)=H_base + epsilon*N_I(u,v) + R_I(u,v)` defines the physical height, where `N_I` is smooth bounded low-amplitude in-between variation and `R_I` comes from *saved* protected features (and their explicitly defined joins), not newly sampled ramps. A distinct dirt-color function can generate broad mostly brown/light-brown/dark-brown patches and occasional outlines without turning every color change into a height change. Elevation/road/brown-shade seeds are tied to stable interval IDs and canonical source/profile revisions, **not** load order, camera distance, wall clock or frame count. The same sampled height, interpolation and feature contact geometry must drive both visible near terrain and actual wheel/ship collision. Keep the original ramp dimensions and approach/landing clearances invariant while distributing added experienced distance into permitted gaps; ensure C0 height continuity and appropriate slope/normal continuity where gaps meet ramps.

**Do not assume saving the world means storing every rendered polygon.** Prefer compact semantic descriptors, mathematical coefficients, deterministic seeds, fixed ramp data, saved world/experience coordinate maps, and creator edits. Cache derived expansion-plan metadata when expensive to recompute; invalidate only affected intervals when the saved source/profile changes. An authored exception or manual terrain edit must be persisted as an explicit patch over the deterministic recipe, with stable IDs and revisioning, rather than lost when a chunk unloads.

### Streaming and speed safeguards

Use a bounded chunk scheduler with three relevant distance levels: **near:** detailed physical surface, collision and intact fixed ramps; **mid:** reduced mesh and color/elevation silhouettes consistent with canonical features; **far/orbital:** lightweight map-aligned landmass outline and broad color. Prevent simultaneous overlapping coarse/near triangles from causing depth fighting; provide a deliberate clip, morph or blend seam. Reserve and prefetch the future travel corridor based on actual vehicle velocity, acceleration, steering reach and braking/turning time, so a fast ship cannot discover a ramp or road turn only after collision preparation would be too late. A visible actionable obstacle must correspond to a prepared authoritative one. Use conservative fallback geometry and sensible speed/physics handling when fine chunks cannot be prepared in time; never substitute a freshly randomized or secretly non-collidable ramp.

Keep a strict CPU/JS-heap/GPU/mesh-cache budget, reuse material/texture assets, cap concurrent builds and vertex uploads, and measure actual loading and frame times on the target 4 GB Windows device. Generating all detailed geometry for a 16,000 × 16,000 world is **not** part of the default contract. The coarse planetary representation is a separate cheap view of the SAME canonical geography, not a second unrelated randomly produced landmass.

### Proposed compact representation (illustrative, not an existing runtime schema)

```json
{
  "source": {
    "canonicalMapSize": [500, 500],
    "landmassId": "dirt-landmass-01",
    "sourceRevision": 1,
    "fixedFeatureIds": ["ramp-A", "ramp-B", "ramp-C"]
  },
  "interpretation": {
    "worldScale": "bigger",
    "effectiveExpansion": {
      "mode": "inherit-world",
      "profileId": "bigger-default"
    },
    "intervals": [{
      "id": "ramp-A--ramp-B",
      "startFeature": "ramp-A",
      "endFeature": "ramp-B",
      "expandedTravelLength": 1250,
      "terrainSeed": 48193,
      "baseElevation": 8,
      "elevationVariation": 0.4,
      "brownShadeVariation": 0.25
    }]
  }
}
```

The example's 1,250-unit interval length is illustrative: real gap length comes from a constrained, profile-specific expansion plan. The saved source and effective interpretation together reproduce the exact same ramps and intervening traversable land after a reload.

### Acceptance checks

- Save the 500 × 500 canonical production, load each world scale, drive from ramp A to B, unload/reload the corridor and drive backwards: the ramps retain **identical IDs, shape, dimensions and collision profiles** and the in-between geometry/shading reappears deterministically. The larger experienced distance occurs only in the allowed intervals.
- Change camera distance/altitude or reload the app: no visible landmark, ramp or authored edit is re-rolled; planetary and near-ground views correspond to one canonical region. A nontrivial source/profile edit invalidates only affected derived chunks and retains manually authored patches.
- Verify no world-sized detailed grid is allocated for Bigger/Massive; measure bounded chunk/mesh cache and prefetch at slow and extremely fast flight/driving speeds, including reversal, curves, high-speed approach, and low-memory conditions.
- Verify near visual surface and collision/landing/suspension sampling agree; safe/coherent seams, no high-speed tunneling, abrupt terrain pops, falsely collidable distant proxies or conflicting coarse/near meshes.
- Confirm a small 500 × 500 world can use an ocean-like **replacement** expansion profile on its dirt landmass while retaining the exact saved ramps and original canonical world footprint.
- Treat this as a **proposal and implementation acceptance criteria**, not proof that the experimental PR #30 already implements saved canonical data, deterministic interval streaming, seam-free LOD, or production-ready road physics.

**Design maxim:** Generate and save what the world *is* once; resolve how expansive its journeys *are* from the selected rules; rebuild only what the player needs to *see and touch*. The geometry may come and go. The same ramps, authored places and mathematical terrain remain.

## Agent Recommendations — Implementation Architecture and First Playable Milestone

*The following are implementation recommendations from the agent, not replacements for the creator's established defaults, saved-canonical-geography requirement, fixed-ramp rule, or inherit-versus-replace expansion policy. This section proposes how to realize those requirements efficiently and incrementally.*

### A. Maintain three independently testable systems

1. **Persistent world definition — what exists.** The saved canonical 500 × 500 Tiled-relative world is authoritative for the new dirt landmass's geographical footprint, original islands, ramp identities, immutable physical ramp dimensions and profiles, protected features, semantic dirt palette, procedural seeds, authored edits and revision history. World-size selection never rerolls those original features.
2. **Expansion interpreter — how traversal is experienced.** Resolve exactly one effective expansion profile: inherit the selected world's default, or fully replace it with the landmass's explicit alternative. From the canonical features, derive a stable route/experience-coordinate mapping and extra traversable *gaps between fixed features*. Preserve fixed-feature geometry, order, topology, approach and landing clearance, and the landmass's proportional placement in the world overview.
3. **Terrain presentation and collision — what must be visible and physically available now.** Stream bounded near-ground geometry and authoritative collision/contact samples from the same deterministic expanded terrain definition. Use simpler mid-distance terrain and a cheap canonical, map-aligned far/orbital representation. Allow disposable rendered geometry without making world data disposable. Keep the three subsystems independently testable so a future renderer or desktop backend can reuse the same saved world and interpreter.

### B. Do not precompute or save every polygon of expanded terrain

Save the canonical source and versioned rules. Derive lightweight, stable descriptors for expanded intervals when necessary, and persist/cache them only when recomputation or authored changes warrant it. Each interval should carry a stable ID, bounding fixed-feature IDs, canonical endpoints, selected effective expansion-profile revision, experienced distance, interpolation/terrain parameters, deterministic seed and explicit authored patches. A useful conceptual record is:

```js
{
  id: "ramp-A-to-ramp-B",
  sourceRevision: 1,
  effectiveProfile: "bigger-default",
  startFeature: "ramp-A",
  endFeature: "ramp-B",
  originalLength: 120,
  expandedLength: 1200,
  terrainSeed: 48193,
  baseElevation: 8,
  elevationVariation: 0.4
}
```

The numbers are illustrative, not mandated defaults or a currently shipped API. The interval is an addressable *recipe* for reproducible terrain, not a preallocated giant mesh. Invalidate affected derived intervals on relevant source/profile edits; preserve creator-authored exceptions across reloads and cache eviction.

### C. Use permanent mathematical chunk addresses

Address a chunk by canonical landmass ID, canonical source revision, effective expansion-profile ID/version, route/interval ID and deterministic chunk index (and any necessary branch/side coordinate). A request for the same address must reconstruct the same ground, dirt coloration, road alignment and protected features, regardless of visit order, camera, machine or time. Chunk LOD/resolution may vary, but must sample the same underlying place. Unload distant meshes and optionally keep a small, bounded recent-chunk cache for reversing; never reroll ramps when a player returns. For multiplayer, share authoritative feature/terrain coordinates and seeds while allowing explicitly cosmetic per-player presentation overrides.

### D. Protect ramps as independent physical features

Store each canonical ramp's stable ID, original footprint, width, height, profile, orientation, contact surface and entry/exit clearance independently from the in-between terrain generator. Expansion increases travel length *only inside permitted gaps*; ramps do not scale by world linear dimension, and new ones are not silently created merely to fill distance. The interpolated in-between terrain must meet the original ramp approach and departure surfaces with continuous height and suitable slope/normal continuity. If a requested experience length is incompatible with unchanged features and their minimum safe clearances, report that constraint rather than deforming the ramps.

### E. Separate collision-relevant geometry from appearance

Use a relatively economical, mostly flat height/contact surface with gentle bounded undulations and actual ramps for physical interaction. Derive broad light-, medium- and dark-brown patches, minimal outlines and small dirt details primarily from deterministic material/shading functions; a change in soil color should not force more physical vertices or an elevation bump. Rendered near terrain and swept ship/wheel collision must sample the same authoritative heights and fixed-ramp geometry. Reduce mesh detail only where doing so cannot mislead an approaching player about the drivable surface.

### F. Begin with a small streaming prototype, then profile the 4 GB target

Start with a few bounded near-ground chunks, a low-detail middle distance, a map-aligned far representation and a small recent-chunk cache. Choose chunk dimensions and cache limits using measured frame time, geometry upload cost, CPU/JS memory, GPU memory, and high-speed prefetch performance on the actual 4 GB Windows test machine—not untested large fixed values. Keep generation/upload work bounded per frame; reuse materials and geometry buffers when practical. Prefetch a longer navigable corridor as speed increases, and prepare actual ramp collision/contact geometry before reaching it. Do not allocate an entire 2,500² or 16,000² detailed grid or generate every expanded interval up front. Avoid overlapping coarse/fine mesh z-fighting and terrain seams.

### G. First working milestone before expanding to the full forest

Demonstrate **one** canonical dirt landmass with **three saved ramps** in the small world. Switch among Current, Bigger and Massive: the exact three ramps keep their IDs, physical dimensions, shapes, orientations, contact geometry and order, while the drivable distances between them change according to each scale's effective expansion rules. Drive away, unload the corridor, return, reverse and reload: the same deterministic ground and ramp geometry must reappear. Confirm the original islands remain unchanged, the new landmass's relative Tiled-map footprint stays consistent, near rendering agrees with collision, and a dirt landmass in Current can select an ocean-like expansion profile via **replacement**, not superimposition. Only after this vertical slice is visually and physically reliable should the full four-layer forest, high-speed scenic events, multiplayer variants and cinematic road systems be built on this foundation.

**Agent recommendation in one sentence:** Persist what the world *is* once; determine the selected journey's expansion without resizing its fixed features; construct and discard only the terrain geometry the player presently needs.
