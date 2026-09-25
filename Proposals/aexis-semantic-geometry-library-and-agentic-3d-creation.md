# ÆXIS — Semantic Geometry Library & Agentic 3D Creation
## Proposal for Framechute and SUBSTRATE

**Status:** Vision and phased implementation proposal  
**Scope:** Shared ÆXIS world-building, modeling, rendering, agent interface, and creator SDK  
**Core principle:** Construct once, inspect directly, edit incrementally, reuse indefinitely.

## 1. Executive vision

ÆXIS should let a person and an AI agent design a 3D object together through natural language, editable mathematical descriptions, reusable geometry, and an agent-controlled camera. We should not have to wait for a new, complete GLB asset every time a creator asks for a change to a spaceship wing, building roof, avatar jaw, or floating ship. Instead, ÆXIS should retain a persistent, structured source object; the AI should edit only the necessary parameters or components; and the renderer should immediately display the result for human and agent inspection.

Every successfully created object should become an optional building block for the next. The cumulative library should be searchable by *what a shape means* and *how it is mathematically constructed*. A bird wing may provide a reusable curved surface for a spaceship wing or a roof; a cathedral arch may become a ship's structural rib; an existing avatar base may be adapted rather than reconstructed vertex by vertex. An AI should be able to retrieve these components, see compatible attachment points and constraints, combine them, and inspect the assembled object through the same in-world camera system available to the creator.

This is a design and implementation goal, not a claim that all complex 3D generation becomes instantaneous. Mesh construction, texture generation, rigging, validation, and rendering still consume computation. The large practical gain is avoiding unnecessary full-asset regeneration and export/import cycles.

## 2. Design goals

1. **Conversation-first authoring:** A creator can say, "Make an elongated floating ship with four under-mounted engines and upward-curving wings," then request localized revisions such as "triple the wing span without moving the cockpit."
2. **Agent-native control:** An authorized agent can search the asset library, inspect source geometry and scene relationships, construct and edit objects, operate an inspection camera, capture views, read geometric diagnostics, and propose or apply validated changes.
3. **Mathematical + semantic representation:** The source of truth is an editable procedural/component graph with dimensions, coordinate conventions, curves, surfaces, meshes, materials, identities, attachment contracts, and semantic annotations.
4. **Reuse across domains:** Shapes and procedures can be adapted across aerospace, architecture, characters, landscapes, cinematics, and interactive worlds without losing their original provenance.
5. **Human and programmer parity:** The UI, natural-language agent interface, and SDK modify the same model through the same validated operations.
6. **Portable output:** Native descriptions remain editable; glTF/GLB import and export serve compatibility and distribution, not as a mandatory intermediate step.
7. **Performance scalability:** Compact source objects, caching, instancing, incremental updates, levels of detail, and controlled agent capture keep the baseline appropriate for the project's 4 GB target while supporting richer hardware.
8. **Deterministic, auditable edits:** A creator can understand what changed, revert it, branch variants, and reproduce geometry from its versioned parameters and dependencies.

## 3. Two descriptions of every reusable object

### A. Geometric description — how to construct it

An asset records a stable ID and version, units and axis/handedness conventions, local origin and transform, procedural generator or mesh data, parameter bounds, topology and material assignments, attachment sockets, deformation handles, LOD policy, and dependencies. It may be represented by primitives, parametric curves/surfaces, extrusion/loft operations, constructive solid geometry, a component graph, and direct editable mesh regions. The renderer compiles or evaluates this into GPU-ready geometry as needed.

### B. Semantic description — what it is and what can be done with it

Metadata records a human-readable name, category, visual characteristics, possible functions, intended scale, part/whole relations, symmetry, compatible sockets, editable parameters, constraints, behavioral affordances, animation/rig contracts, and provenance. Semantic descriptions support retrieval and suggestions; they must not substitute for geometric checks or make unsupported functional claims.

For example, a reusable wing may be described mathematically as a swept tapered surface with adjustable curvature and thickness, and semantically as an aerodynamic-looking lateral component with a fuselage attachment socket and a mirrorable counterpart. Both descriptions are required for reliable agentic assembly.

**Cross-category reuse:** Retrieve by shape as well as noun. A curved feather-like surface might inform a metal spaceship wing, architectural canopy, or ornamental armor panel. Adaptations become new assets or derived variants with explicit links to their sources rather than silently overwriting originals.

## 4. Geometry vocabulary and procedural operations

Provide a layered modeling vocabulary so an agent does not need to transmit thousands of vertices for routine work:

- **Primitives:** cubes, spheres, ellipsoids, cones, cylinders, capsules, planes, rings, and configurable profile shapes.
- **Parametric construction:** Bézier and spline curves, surfaces of revolution, lofts, sweeps, extrusions, taper, bevel, thickness, symmetry, and procedural arrays.
- **Compositional modeling:** parent/child assemblies, booleans where supported, transforms, mirroring, duplication, modular sockets, and material substitutions.
- **Fine editing:** vertex/edge/face operations, normals, UVs, topology-sensitive mesh edits, rig weights, morph targets, and constrained deformation.
- **Procedural domain kits:** reusable hulls and engines; rooms and arches; terrain, rocks, and vegetation; stylized heads, limbs, and character rigs.

Start with a small, reliable, well-tested vocabulary. Complex organic or photorealistic forms may additionally need authored reference assets or specialized generation tools. Do not promise that arbitrary text descriptions can always be converted into production-ready, rigged meshes.

## 5. Agentic camera and the closed visual loop

The agent should be able to inspect its own output through the ÆXIS camera and through exact scene data.

**Example loop:**
1. Parse the creator's request into an explicit assembly/edit plan, resolving ambiguous scale and coordinates with sensible editable defaults.
2. Retrieve candidate assets by semantic and geometric similarity, while checking dependency availability and socket compatibility.
3. Construct or update only affected graph nodes. Generate or update their renderable geometry.
4. Position an inspection camera; orbit, zoom, switch to wireframe or component isolation, and capture front/side/top/perspective views as needed.
5. Read exact object bounds, transforms, part IDs, intersections, surface diagnostics, and validation results from the geometry engine. Do not infer dimensions from screenshots when authoritative geometry is available.
6. Propose and apply targeted corrections to the identified parts, re-render, and repeat until stated requirements are met or the user intervenes.
7. Save a versioned source object and optionally publish reusable derived parts to the library.

An inspection camera must be scoped to an authorized scene/session. It should not unexpectedly seize a person's active gameplay camera. Captures need explicit budget/rate limits and resolution controls. Visual feedback is supplementary to deterministic validation: an attractive screenshot is not proof of manifold geometry, collision correctness, healthy rigging, or physically valid aerodynamics.

## 6. A persistent object and compact edit protocol

The editable source—not a repeated full GLB generation—is the center of the workflow. Give each object and component stable identities so edits can be small and local:

```text
CREATE object "floating_ship" FROM "hull_elongated_v3"
ATTACH "organic_wing_v2" TO floating_ship.socket.left_wing AS left_wing
MIRROR left_wing INTO right_wing ACROSS floating_ship.local_X
ARRAY "thruster_v1" COUNT 4 AT floating_ship.sockets.underside
SET floating_ship.left_wing.curvature = 0.65
CAMERA.ORBIT object=floating_ship degrees=90
CAMERA.CAPTURE object=floating_ship view="three_quarter"
VALIDATE floating_ship
SAVE floating_ship AS "floating_ship_v1"
```

This command language is **illustrative**, not an existing API. Define a typed, versioned schema and validated operations before implementing the SDK. Applying an edit should check object IDs, parameter ranges, coordinate spaces, transform inheritance, affected dependencies, mesh validity, and undo/redo safety. Preserve the creator's original and allow variants to branch. Use graph-node invalidation, geometry caching, and optional baked mesh snapshots so unaffected components do not have to be rebuilt.

## 7. A practical example: design a floating cathedral ship

**Creator:** "Make a long, elegant floating ship with birdlike upward-curving wings and four engines below."

**Agent:** Retrieves an elongated hull, an organic wing surface, a thruster module, and compatible attachment definitions; assembles them with mirroring and an engine array; renders and inspects the first result.

**Creator:** "The wings are too small. Triple their span and make the body resemble a cathedral."

**Agent:** Changes only the wing-span parameters, retrieves arch/rib/window geometry by both geometry and meaning, adds the selected details to the existing hull, checks collisions and visual balance from several camera angles, and shows the updated version. The original hull and assembly history remain intact.

**Library effect:** The finished ship, its adapted wing, its architectural rib, and any reusable assembly templates can be saved as separate versioned assets. The next ship can reference them instead of starting from an empty mesh.

## 8. Library retrieval, provenance, and compatibility

Store structured metadata and optionally semantic embeddings to search by category, visual intent, dimensions, shape descriptors, topology, attachment contracts, and adjustable properties. Rank retrieval candidates by suitability, but require explicit compatibility validation before assembly. Support user-created assets, approved built-in kits, imported GLBs, and derivations. Distinguish source-native parametric models from imported baked meshes: an imported GLB is reusable, but its editable construction history cannot be assumed to exist.

Keep creator ownership and permissions, license/source provenance, versioned dependency references, hashes or stable content IDs, and safe asset-sharing boundaries. Make the library navigable visually for people and programmatically for agents; allow project-private, shared, and published assets according to user authorization.

## 9. Runtime and portability architecture

A proposed layered implementation:

1. **Authoring interface:** human editor, natural-language agent tools, and typed programmer SDK.
2. **Source model:** versioned native ÆXIS component/procedural scene graph with metadata and history.
3. **Geometry services:** procedural evaluation, mesh validation, incremental dependency tracking, caching, and optional asset import/baking.
4. **Renderer + camera service:** live scene display, agent-scoped viewpoints, diagnostic overlays, captures, and LOD.
5. **Interchange:** glTF/GLB import/export plus explicit handling for animation, skinning, materials, unsupported procedural features, and extension metadata.

Aim for a common schema and interoperable authoring commands across browser and future desktop runtimes. Avoid maintaining unrelated parallel modeling semantics. Browser rendering, native rendering, and exported assets can use different adapters while sharing one authoritative source model. Any Babylon.js or other engine integration is an implementation choice to validate against the project's current renderer rather than an assumption about code already present.

## 10. Performance principles for the 4 GB baseline

Use compact parametric descriptions instead of verbose vertex lists when possible. Retain a single shared mesh for repeated instances; reuse materials; employ viewport-dependent LOD, frustum/distance culling, spatial partitioning, lazy evaluation, asset streaming, geometry caches, and bounded memory/texture budgets. Recompute only changed graph nodes. Give agent camera captures explicit quotas. Where a complex asset is more economical as a baked mesh, allow baking and preserve the parametric source separately.

Performance must be measured, not inferred from the lack of a GLB file. A simple primitive ship may appear almost immediately; a detailed organic character, complex boolean, texture bake, or rigged model may still be expensive.

## 11. Milestone plan and acceptance criteria

**Phase 0 — Schema and feasibility:** Document units, handedness, object/component identity, graph/versioning, procedural operators, socket constraints, import/export boundaries, and agent permissions. Demonstrate a primitive hull + mirrored wings + four thrusters with reproducible output.

**Phase 1 — Minimal live editor:** Implement primitive/parametric creation, object-scoped camera capture, incremental parameter edits, visual inspection, geometry bounds/validation, undo/redo, and native save/load. Measure end-to-end edit-to-preview latency and memory use on a 4 GB test machine.

**Phase 2 — Reusable semantic library:** Build indexed asset registration, geometric and semantic retrieval, attachment contracts, assemblies, variants, provenance, and project permissions. Demonstrate reusing a wing across a ship and an architectural canopy.

**Phase 3 — Agent and SDK parity:** Expose typed tools for search, create, attach, edit, inspect, validate, capture, save, and export. The human UI and agent must produce equivalent operations through the same validated APIs. Provide transaction boundaries and recovery from invalid operations.

**Phase 4 — Rich assets and interchange:** Expand mesh editing, character templates/rig integration, animation and deformation contracts, glTF/GLB round-tripping, procedural baking, and asset portability. Explicitly document lossy conversions.

**Phase 5 — Shared creator ecosystem:** Publish reusable building kits and recipes; support collaborative versioning, safe asset permissions, increasingly sophisticated procedural domains, and portable cross-runtime scene contracts.

**Acceptance checks:** A creator can change a named ship component without regenerating or replacing the entire ship; an agent can independently inspect its output through a scoped camera and exact diagnostics; a reusable source component works in two distinct assemblies; save/reload preserves editability and dependencies; export produces a usable GLB for the supported subset; invalid geometry or incompatible sockets are reported rather than silently accepted; baseline memory and latency are measured.

## 12. Long-term ambition

ÆXIS can become an accessible human-and-agent-native 3D construction language: artists direct it visually and conversationally, AI agents inspect and manipulate the same world, and programmers use a documented SDK and portable object format. Its compounding advantage is the shared library: every reusable object and mathematical construction gives future creators more vocabulary and less repetitive work. The goal is breadth, depth, and ease of use—not claiming to have invented procedural modeling, semantic retrieval, or 3D interchange, but integrating them into a coherent, extensible world-building workflow.
