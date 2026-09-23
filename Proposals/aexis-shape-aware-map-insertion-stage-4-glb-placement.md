# ÆXIS — Shape-Aware Map Insertion and Stage 4 GLB Placement
**Status:** Proposal / implementation contract, not a claim that the features already exist.  
**Date:** 2026-09-23  
**Applies to:** FrameChute, SUBSTRATE, and Tiled-223D.  
**Companion proposals:** ÆXIS Worldweaver, ÆXIS Sketch-to-World, the existing town/GLB connection-plane addendum, and Tiled-223D's low-ground insertion proof of concept.

## Product promise

A creator opens an existing 500 × 500 Tiled world, inserts a handmade 50 × 50 map, imports the edited Tiled JSON, and can immediately draw or inspect lines and simple shapes around the new addition. The engine uses these shapes to complete a geographically sensible, revisable insertion **without asking the creator to do terrain mathematics**.

Stage 3 creates an enduring, shape-aware world surface. Stage 4 then becomes a short right-click operation: **choose a placement plane → choose an existing or local GLB → choose how it floats or is supported → place**. At first, a clear **white-tile footprint with an X on each occupied cell** is enough to delineate where the imported object belongs. Both the editable Tiled map and generated JSON records must reflect the placement. Later releases can replace the provisional ground/support with sculpted hills, mountains, cliff sides, aesthetic floating islands, and other presets without changing the placement data model.

The defaults must work without an AI service, advanced map expertise, or a dozen mandatory questions. A user or authorized agent may inspect and refine every coordinate, shape, object relation and generated cell.

## 1. Tiled already supplies drawing primitives; use them

Tiled **object layers** support rectangle, ellipse (a circle when equal width and height), polygon, polyline and point objects. A quadrilateral can be a rectangle or an **arbitrary four-vertex polygon**; a circular shape can be an ellipse with equal radii. Preserve actual vertices and rotation. Never reduce a freehand polygon to its bounding box when that changes its meaning.

Create or reuse a named object layer such as `WorldShapes` with per-object semantic metadata. Keep existing tile layers (`Ground`, `Additions`, `Structures`) and all original objects intact. Offer the **same simple shapes in the browser's preview/editor** for people who prefer to import first and draw there. One creator may define shapes in Tiled, another in the browser; both must serialize to the **same canonical geometry records**. Tiled is not required to contain the complete Stage 4 UI.

Tools in the browser: **Line/path; Rectangle; Four-point quadrilateral; Circle; Ellipse; Freeform polygon; Point/anchor.** Offer snap-to-tile, optional free coordinates, select/move/resize/rotate, vertex edit, undo/redo, selection outline and a cheap preview. Closed polygons create regions; an open polyline creates a route, boundary, corridor or ridge and needs a stated width only where area is required. Curved outlines are stored as true ellipse parameters plus a deterministic tessellation tolerance when mesh or tile rasterization is needed.

Every shape has a friendly, optional meaning, for example **Land here / Water here / Keep existing / Low insertion / Hill / Cliff edge / Road or river path / Asset footprint / Landing surface**. Two distinct boundary modes are essential: **Desired area (default)** means an approximate envelope that the generator may make irregular while honoring protected map interiors; **Actual edges** means honor the author's exact boundary within the explicit tile/geometry tolerance. A perfectly drawn circle need not become a mechanically circular island in Desired area mode. An intentional circular floating platform or Actual edges boundary must stay circular. Name each shape and assign a stable ID, world coordinates, shape type, vertices/radii, rotation, purpose, boundary mode, author/provenance, protection status, and any elevation/placement parameters.

## 2. Stage 3: insert a little map, then draw or inspect shape boundaries

1. Open the original 500 × 500 Tiled map and separately open the little 50 × 50 map. These are **tile counts**, not bitmap pixels. Place the little map on a distinct `Additions` tile layer at its selected tile offset; keep the original `Ground` untouched. Copy related structure/object layers and retain their offsets, IDs or provenance using an explicit remapping if collisions occur.
2. Export the edited Tiled map as uncompressed JSON. Retain the original elevation JSON: a normal Tiled export may not preserve this engine's custom top-level height metadata. Import the edited map and original elevations to the assembly workflow.
3. The renderer/editor shows newly inserted bounds and **any existing Tiled shapes**. If a desired connection or outline is missing, select **Draw shape** and sketch a line, circle, quadrilateral or free polygon directly over the new placement. Default shape behavior should be useful without entering numbers.
4. Select **Preview insertion**. Infer a sensible low-ground insertion from available terrain semantics and nearby heights, respecting the protected original world. Apply constrained, seed-recorded variation **without pointless repetition** and without arbitrary geographical chaos. Show the exact affected cells, coast/seam zone, geometry, collision changes and any conflicts; permit local changes without rerolling unrelated saved geography.
5. Select **Apply**. Save both (a) an editable, Tiled-compatible map/draft with its separate shape object layer, additions, object markers and stable references, and (b) schema-validated generated terrain/elevation/shape/semantic JSON used by the browser. Where the current generator produces a single combined `generated/low-world.json`, continue to support that bridge rather than require an imaginary generic-JS uploader. Include source-map provenance and versioning; allow exporting either representation for round-trip editing.

**Current prototype baseline:** Tiled-223D's existing low-ground flow already uses `Additions`, original elevation input, `generate-low-world.bat` / `scripts/assemble-low-world.mjs`, and combined `generated/low-world.json`. It does **not** yet supply this visual shape editor or GLB placement system. Implement these incrementally; do not regress the low-ground test.

## 3. Prepare the Stage 4-ready default surface in Stage 3

A completed Stage 3 region is not just a colored bitmap. It must expose a **placement-ready surface interface**: sampled ground height, semantic terrain/material, world-space transform, navigability/land-water status, slope/normal where relevant, protected masks, reserved footprints, collision proxy and allowed support/contact rules. Keep a cheap default surface/placeholder available for areas where exact geometry has not yet been constructed.

A new object should be able to request `CreateDefaultPlacementSurface(footprint, anchor, mode)`: sample or make a sufficiently sized pad/plane, align the object's intended base to it, expose clearance/occupancy, reserve its footprint and create a reversible local edit. **Default** means safe, legible, fast placement with preview and sensible fallbacks, **not** a promise that any malformed GLB can always be grounded automatically. Where a model has strange orientation, no known base, unsupported geometry or impossible intersections, show a clear preview, use its transformed bounding footprint as an initial proxy, and allow the creator to adjust pivot, scale, rotation, base height and support plane. Never quietly bury the model or overwrite protected terrain.

The Stage 3 shape registry and Stage 4 object registry must share one world-coordinate frame. For this prototype, Tiled tile (x,y) maps to 3D horizontal (x,z=y), with **+Y vertical**, **32 source-image pixels per tile** and **one world unit per tile**; normalize Tiled's pixel-based objects and offsets before making world-space geometry.

## 4. Stage 4: the creator's shortest interaction

Right-click the 2D map, 2.5D view, or 3D scene at an actual world location and select **Place Object**. Present a compact menu:

- **Placement plane:** **Default surface (automatic)** / **Floating aesthetic circle** / **Circle** / **Quadrilateral** / **Use drawn polygon** / **No visible plane (advanced)**. A plane is a **placement/contact guide**, not necessarily a final visible disk. The floating aesthetic circle is the first distinctive, attractive preset.
- **Import GLB:** **Choose from existing project/preset location** or **Upload from computer**. Support GLB first, preserve its internal scene rather than shattering a town into unrelated world tiles, preview scale/orientation/bounds, and copy or explicitly reference a local uploaded asset in the saved project so reloading works; never store a transient browser file-picker path as a permanent source.
- **Position:** click a world location or choose a saved predetermined location/anchor; adjust X/Z, altitude Y, size, rotation and optional base offset in the preview. Move the GLB and plane together by default.
- **Support:** **Floating** / **Bottom preset (dropdown)** / **Make ground underneath (default for grounded placements)**. Bottom presets initially include a simple neutral disk/pad and the selected floating aesthetic circle; later add stone, grass, metal, crystal or creator-supplied options. Floating may be unsupported suspension or a visible disk, chosen explicitly rather than conflated.
- **Make ground underneath:** first create a *plain, minimal, appropriately sized platform or local low-ground pad* without sophisticated world-sculpting. Later offer **Automatic, Hillside, Mountain, Plateau, Aesthetic cliff, Floating island**, with preview of affected unprotected terrain. Creating ground beneath a suspended plane must not silently connect that plane to the ocean floor or bury unrelated terrain.

The creator can accept all defaults, or change just one selection. Preview must show where the asset actually sits, including its physical footprint and any intersecting scene geometry. The **Place** action writes a persistent asset instance, plane/support record, footprint and reversible terrain/overlay edit. A scene may contain many separate placed GLBs; individual instances retain stable identity and can be selected, moved, swapped or removed later.

## 5. Initial Stage 4 marker: white tiles with X marks

**For the first playable Stage 4 release, do not wait for photorealistic ground reconstruction.** Rasterize the placement footprint onto a dedicated, clearly named Tiled-compatible **asset-footprint tile overlay**, using a small white square tile with a contrasting X. Every occupied or reserved tile appears as a white X tile. These tiles explicitly mean **"this region is reserved/occupied by the imported object"**, NOT permanent grass, coastline, terrain material, altitude or object geometry.

- Define a real marker tile asset/tileset with a valid Tiled GID and tile size; include/resolve its tileset references correctly on export. Do not write a magic GID that collides with the existing terrain-v1 GIDs 1–7. A compact generated marker atlas is acceptable.
- Use the actual projected GLB base/connection-plane footprint, not merely an oversized axis-aligned rectangle; for an ellipse or polygon, rasterize with a documented center-intersection/coverage policy and configurable clearance. Store **precise vector footprint geometry too**, so the white grid is only a visual aid, not the source of spatial truth.
- On the Tiled side, save/update `AssetFootprints` tile layer plus a named object/shape record holding the asset's ID, anchor, rotation, precise footprint, source reference and placement mode. On the generated JSON side, write the same ID, X/Z cell occupancy, world transform including Y, shape, scene asset path, support mode, semantic/collision data and affected-chunk references.
- **Both Tiled and generated JSON change together** in a single previewed/validated transaction: add, move, rotate, resize and delete update both representations. Export the modified map to a new project/revision or retain the original map with an explicitly approved save; prevent accidental destructive changes to original terrain and buildings.
- Marker overlay is independently toggleable in Tiled and in the renderer; it must not show as actual white checkered terrain in normal final-world rendering unless the user intentionally enters an edit/footprint mode. The real GLB stays a separately loadable object instance.
- On removal, restore only this instance's marker/terrain edits. Overlapping reservations must be reference-counted or recomputed from all remaining instances; moving an asset must not erase another asset's footprint.

**Important:** A white X footprint is a first-stage authoring/collision visualization, not evidence that GLB interiors, exact physics, navigation meshes, slope blending or full 2D sprite projection are already solved.

## 6. Canonical JSON and round-trip contract

Maintain a versioned, declarative world/project record (portable JSON, not arbitrary executable JS) with at least:

```json
{
  "schemaVersion": "placement-v1",
  "world": { "tileSizePixels": 32, "worldUnitsPerTile": 1, "up": "Y" },
  "shapes": [{
    "id": "shape-001",
    "source": "Tiled:WorldShapes",
    "kind": "ellipse",
    "centerXZ": [128, 212],
    "radiiXZ": [7, 7],
    "intent": "asset_footprint",
    "boundary": "actual_edges"
  }],
  "assets": [{
    "id": "asset-001",
    "source": "assets3d/imports/village.glb",
    "atXYZ": [128, 6, 212],
    "rotationXYZ": [0, 0, 0],
    "scaleXYZ": [1, 1, 1],
    "planeShapeId": "shape-001",
    "placement": "floating",
    "support": "aesthetic_circle",
    "occupiedCells": [[128, 212]],
    "protectedTerrainPolicy": "preserve"
  }]
}
```

This is **illustrative schema**, not a claim that the existing importer accepts it. Define actual versioned adapters and validation before shipping. Tiled object-layer shapes, white-X tile overlays, generated elevation/terrain JSON, 3D GLB instances and future 2D/2.5D views are **different projections of one stable identity and spatial truth**. Store a deterministic shape tessellation/rasterization policy, geometry/elevation units, tileset mappings, asset provenance, original edits, undo history or reversible edit delta, and generation seed. Reject unknown IDs, missing GLBs, unsupported tilesets or ambiguous coordinate transforms with actionable errors rather than guessing.

Never mistake a drawn circle for a 3D sphere, a Tiled ellipse for an actual physics mesh, or a Tiled white-X overlay for terrain altitude. A 2D tile map alone does not encode the vertical placement of a floating GLB: preserve Y and support geometry in the generated semantic record.

## 7. Minimal shipping order and definition of done

**A — Make Stage 3 shape-aware:** import the edited 500 × 500 map with a new 50 × 50 region; accept Tiled rectangles/ellipses/polygons/polylines; draw equivalent shapes in the renderer; retain `Additions` and original elevations; export a reversible, valid Tiled draft and correct low-ground generated JSON. Verify circle and arbitrary quadrilateral boundaries are not accidentally lost or converted into rectangular bounding boxes.

**B — Make the default surface dependable:** normalize geometry coordinates; expose height/material/protection/contact queries and cheap plane creation; preview a valid landing pad even where new terrain is incomplete. Fail legibly rather than assert that every GLB automatically fits.

**C — Stage 4 first playable:** right-click → select default or floating aesthetic circular plane → pick a project GLB or local file → choose saved location/click location → select Floating / Bottom preset / Make ground underneath → preview → place. Draw white X tiles only on a new `AssetFootprints` overlay; save actual shape and stable asset instance to **both** the editable Tiled map and generated JSON; reload both and see the same location, scale, support and occupancy. Demonstrate moving, removing and undoing a GLB without damage to protected old terrain or another asset's reservation.

**D — Later terrain artistry:** replace the plain pad with constrained, local mountain/hillside/cliff/floating-island synthesis, roads and exits when requested, biomes and author-supplied materials, collision/path validation, optional semantically aligned 2D representations, nested portable chunks and agent-facing placement API. Keep the minimal Stage 4 flow functional throughout.

**Performance and trust:** preview/rasterize only affected chunks; avoid per-cell heavy 3D meshes on 4 GB-class test machines; preserve original authored maps; work locally/offline; keep generation varied but sensible, seeded and reproducible; show conflicts when an imported asset overlaps a locked settlement, shoreline or other reserved object. Make any auto-generated ground genuinely usable under the model, not just a visually pleasing decal.

**One sentence to preserve:** *Draw the place, drop in the world, choose what holds it up—ÆXIS updates the map and the living world together.*
