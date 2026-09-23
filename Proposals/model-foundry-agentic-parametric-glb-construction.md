# Model Foundry — agentic mathematical construction of editable GLB assets

**Status:** Architecture / implementation proposal, not a claim of implemented functionality  
**Date:** 2026-09-23  
**Scope:** Independent, reusable module shared by Framechute, SUBSTRATE, and Tiled-223D  
**Design mandate:** The creator imagines; the agent interprets and plans; the mathematical system constructs, inspects, revises, and exports. No agent should need to hand-author thousands of vertices to express a model; no creator should be forced to learn an advanced modeler merely to describe or show what they want.

## 1. Founding intention

Give *any compatible agent* the **means** to construct a visualized or described object in 3D. A person supplies a sentence, sketch, photograph, illustration, or 3–4 reference views. An agent translates observable geometry and stated intent into a structured, inspectable plan; invokes a self-describing mathematical construction surface; builds an editable object; inspects its result; corrects discrepancies; and exports a usable GLB. A text-only agent may consume structured observations provided by a vision adapter; a multimodal agent may inspect references directly; a human-operated editor may submit the same construction plan without AI.

The first target is a ship generator. The mathematical language must not be trapped in a catalog of spaceship templates: the same operations should eventually construct buildings, machines, vehicles, architecture, furniture, world props, and unfamiliar forms. The goal is **agentic construction**, not a one-shot image-to-mesh black box. A finished object remains editable and semantically meaningful.

Three first-class modes are required at launch: **Default, Detail, MINUTIA**. They share one model specification, engine, validation path, and revision protocol. The mode governs allowable geometric depth, inspection effort, detail budgets, and termination criteria—never an incompatible file format or a different geometry engine.

## 2. A compact, expressive construction language

Provide a small, composable vocabulary with powerful low-level escape hatches; avoid thousands of rigid named-part templates. Every operator has a versioned schema, units, coordinate convention, constraints, parameter meaning, examples, failure modes, and deterministic output for given inputs and generator version.

- **Solid and surface foundations:** primitives; polyhedra; parametric curves and surfaces; 2D profiles; cross-sectional lofting; sweeps along curves; extrusions, bevels, fillets, chamfers, shells, and controlled thickness.
- **Composition:** transform, mirror, array, instance, interpolate, morph, lattice deform, weld, boolean union/difference/intersection, surface-to-surface fitting, joint/attachment constraints, and optional mesh remeshing.
- **Advanced forms:** NURBS/B-spline patches or similarly expressive spline surfaces, bounded signed-distance/implicit geometry, displacement fields, controlled procedural noise, custom sampled surface patches and validated custom mesh inputs. These make previously unseen silhouettes possible without a new hard-coded object type.
- **Microgeometry:** reusable splines for pipes, tubes, hoses, bundled wires, seams and cable channels; radial and surface-conforming arrays for bolts/rivets/vents; recess/cut/panel operators; nested housings, grilles, greebles, fasteners, brackets, and layered mechanical components.
- **Appearance:** PBR material definitions, UVs/texture projection where available, decals, normal maps, emissive surfaces, translucency where the renderer supports it, and geometric versus texture-based detail as an explicit choice.
- **Semantics:** type-tagged objects and typed connection points, e.g. engine exhaust, intake, mechanical mounting, camera, docking, articulation, electrical routing, landing support.

A ship's swept wing should be expressible using mathematical surfaces, not only a prepackaged `createWing`; a novel spiral or asymmetric hull should not require the agent to invent a replacement mesh generator. A high-level semantic operator is a convenience macro over the same general geometric core. Permit plug-in geometry operators behind explicit capability and execution limits.

## 3. The three creation modes

### DEFAULT — recognizable, attractive, not over-detailed
Produce the silhouette, major volumes, proportions, key colors/materials, primary components, and enough secondary cues to read as the requested object. Prefer low-cost geometry, a short coarse-to-fine revision loop, modest polygon and memory budgets, and a fast export. Do not generate thousands of invisible components, wiring, interior rooms, or detailed assemblies by default. A creator asking for only a general shape should receive a good general shape without hidden expensive work.

### DETAIL — reference-faithful design and affectations
Preserve the reference's characteristic contours and proportions, cockpit/glazing shapes, engine count and placement, panel divisions, ornamental motifs, small design flourishes, distinct material borders, recesses, vents, light strips, and visible attachment details. Use multiple reference views to constrain construction, and compare silhouette/landmarks and selected rendered views. Distinctive cute, whimsical, ornate, or otherwise expressive **design affectations are part of the intended design**, not optional generic garnish. If the source contains a charming asymmetry or unusual curvature, preserve it instead of normalizing it into a stock spaceship.

### MINUTIA — depth-resolved, inspectable small-scale construction
Enable painstaking modeling of all **observable, specified, or reasonably inferred** structures within an explicit scope: embedded pipes, exposed and concealed wiring, brackets, recessed channels, tiny fasteners, multi-layer hull thickness, engine internals, under-panel machinery, supports, cable bends, and the depths and occlusions between nearby objects. Agents must be able to isolate, zoom, section-cut, measure, reveal, and edit those features independently. Provide meaningful 3D form where detail affects silhouette, parallax, occlusion, openings, shadows, contact, interaction, or the user's requested close-up—not merely a flat ornamented texture.

MINUTIA must make microgeometry *possible and accessible* to the agent, not magically guarantee exact unseen engineering from a photograph. Preserve provenance tags: **observed**, **user-specified**, **inferred**, **invented-to-complete**. Clearly distinguish what a reference supports from what the machine plausibly completed. Three or four good views should materially improve depth recovery and cross-view consistency. If a hidden interior is requested with no reference, produce an explicitly inferred or creator-defined interior rather than claiming it was seen.

Detail is hierarchical: ship → hull → compartment → panel → cavity → pipe → clamp → screw. A component can be expanded on demand without forcing the whole ship to MINUTIA resolution. In tight camera views, geometric details must hold up under changing viewpoint. Use instancing and shared reusable parts, adaptive tessellation, LODs, visibility-aware generation, mesh and texture budgets, and optional remote compute. Never make the entire browser scene render every screw at full detail all the time.

**Mode is a user-facing starting preset, not a hard artistic ceiling.** Users can request a specific MINUTIA region even while the rest of the ship stays at Default or Detail. A saved project's component identities and overall form must survive promotion to a more detailed mode; detail adds or refines, it does not casually redesign unrelated structure. Store budgets and acceptance targets by mode, device, and selected scope, rather than promising fixed universal triangle counts.

## 4. Multi-view reference reconstruction as a usable agent tool

Accept prose, one reference image, or multiple images with optional viewpoint labels, object-scale hints, annotations, masks, and user constraints. The perception adapter extracts:

1. Semantic parts, distinctive features and relationships;
2. Silhouettes, landmarks, contours, material boundaries, apparent dimensions and camera hypotheses;
3. Surface curvature and depth/order cues, visible openings, occlusions, and correspondences across images;
4. Confidence and provenance for each observation, leaving unseen surfaces *unknown* unless user-specified or explicitly inferred.

The agent assigns reference anchors (nose, wing tips, canopy border, nozzle centers, panel corners, pipe attachment endpoints, etc.) to named 3D features. Camera calibration and reprojection align a generated model with each image; compensate for perspective rather than mistaking image-space width for real-world width. Cross-view consistency checks must flag contradictions, not silently average them.

For MINUTIA, support **local reference crops, zoomed inspections, feature-level comparisons, depth ordering, section views, and per-component revision**. If a pipe disappears behind a plate in one view and reappears in another, the agent can define a route and occlusion relationship. Where a two-dimensional image cannot determine exact depth, retain a plausible range or user-editable hypothesis, not a fabricated 'measured' value. Detect details too small, blurred, obscured or ambiguous to reconstruct reliably and expose that uncertainty.

Default and Detail can stop after silhouette and design-level agreement; MINUTIA can continue recursively into selected components until the requested close-up/detail target or budget is reached. The result must remain usable even if the agent stops early.

## 5. The agent feedback and revision loop

The agent must be able to ask what exists *before* editing. Provide introspection for component tree, parameter values, world/local transforms, dimensions, nearest neighbors, spatial clearance, surface normals, thickness, topology, visible detail, reference associations, semantic connection points, provenance, and dependency impact.

Core loop: **interpret → constrain → construct coarse geometry → render several views → measure/compare → select offending components → revise targeted parameters → validate → refine detail → export**. A revision should modify a persistent component ID or construction node, not require opaque resynthesis of the whole GLB. Use a dependency graph so a mirrored wing updates with its source and an unchanged cockpit remains unchanged.

The reference feedback surface should return both numerical diagnostics (projected anchor error, silhouette overlap, cross-view consistency, clearance, watertightness where required) and inspectable renders. The system may expose confidence and uncertainty; it must not present a single similarity score as a guarantee of physical fidelity. Include checkpoints, undo/redo, compare branches, stop conditions, resumable work, and explicit budget-exceeded responses.

A text-only agent can request structured visual observations or hand reference interpretation to a connected vision adapter; it still receives the same modeling, measurement, debugging, and revision tools. No requirement that the agent itself implement a full renderer, geometry kernel, or image-analysis algorithm.

## 6. Machine-readable API contract: small surface, rich capability

One canonical versioned internal service; HTTP/OpenAPI, MCP, CLI, and browser SDK are adapters over it. Representative operations (names illustrative):

| Operation family | What the agent can ask the system to do |
| --- | --- |
| `capabilities.list`, `schema.get`, `examples.find` | Discover supported operators, parameters, limits, examples, mode capabilities |
| `project.create`, `reference.add`, `reference.inspect` | Start or recover a project; add and parse multi-view references |
| `model.plan`, `model.inspect`, `component.inspect` | Create/read semantic geometry and dependencies |
| `geometry.create`, `geometry.modify`, `geometry.compose` | Build and revise parameterized geometry |
| `geometry.measure`, `geometry.section`, `geometry.visibility` | Measure tiny features, sample geometry, inspect internal depths and occlusions |
| `assembly.attach`, `constraint.define`, `constraint.solve` | Relate components and enforce hard/soft/semantic constraints |
| `detail.expand`, `detail.route`, `detail.instance` | Refine a region; construct wires/pipes across anchors; efficiently repeat small parts |
| `preview.render`, `reference.compare`, `validation.run` | Render reproducible cameras and compare reference, topology, budgets |
| `project.checkpoint`, `project.rollback`, `asset.export` | Save state, recover, and export GLB plus editable metadata |

The actual API must publish typed request/response JSON Schemas, machine-readable capability discovery, units, coordinate handedness/up/forward conventions, stable IDs, coordinate spaces, errors and corrective suggestions, operation cost estimates, and runnable examples. An agent must have enough footholds to ask for *a curved pipe whose endpoints attach to these two anchors with 3 cm clearance* instead of supplying every vertex. Expose both human-friendly semantic macros and lower-level mathematical control when precision demands it.

A proposed high-level request shape:

~~~json
{
  "schemaVersion": "1.0",
  "project": "manta-craft",
  "input": {
    "description": "Broad manta-like ship; elongated cockpit; four embedded engines",
    "referenceIds": ["top", "front-quarter", "rear-quarter", "underside"]
  },
  "mode": "MINUTIA",
  "scope": ["hull", "engine-bays", "cockpit"],
  "preserve": ["overall-silhouette", "engine-count"],
  "detailRequirements": [
    "Model visible engine-bay pipework and wiring as editable 3D",
    "Preserve the reference's unique canopy trims and decorative features",
    "Expose cross-section views and classify inferred hidden structure"
  ],
  "output": ["glb", "model-json", "semantic-json", "previews"]
}
~~~

This illustrates the intent, **not** a claim that a `generate(description)` endpoint can infer and produce detailed geometry in one step. The implementation must translate this goal into explicit construction operations and a controllable feedback loop.

## 7. Mathematical correctness without aesthetic homogenization

Use hard constraints for finite/valid dimensions, transform conventions, topology/export requirements, attach-point validity, requested symmetry, and specified clearances. Use soft constraints for apparent visual balance, preferred sweep, silhouette similarity, and stylistic cues. Use semantic constraints for explicit relationships, e.g. nozzle direction or a cable passing through defined clamps. Distinguish intentional overlaps from invalid intersections; an 'impossible' fictional aesthetic should not be rejected merely for violating real-world aerodynamics.

Errors should identify the exact failing node/constraint and suggest parameter changes. If an engine cannot fit inside its bay, the agent can enlarge the bay, reduce the engine, alter placement, or ask for a design decision. Geometry is deterministic for a fixed schema/operator implementation, seed, and project. Controlled randomness may fill **unconstrained** regions with plausible variation while preserving creator-specified and observed features.

## 8. Persistent editable assets: GLB is the delivery, not the source of truth

Export `ship.glb` for broad browser/game compatibility. Preserve `ship.model.json` (versioned construction DAG, numerical parameters and operations), `ship.semantic.json` (component meaning, anchor points, interactions), `ship.constraints.json` (hard/soft/semantic invariants), and provenance/reference metadata (which details were observed or inferred, source identifiers, camera assumptions, version/seed). Keep multi-angle preview images where requested.

Use glTF node hierarchies and appropriate metadata/extensions when supported, but never assume arbitrary semantic contracts survive every GLB importer; retain a documented companion JSON with stable component IDs. Make material and texture choices explicit. Export validated geometry, correctly oriented normals, defined bounds, configurable LODs, and appropriately optimized optional collision meshes.

A created ship should be immediately addressable by the 223D flight viewer: cockpit/chase-camera anchors, engines and exhaust vectors, docking/landing interfaces and collision bounds can be supplied explicitly rather than guessed from anonymous triangles. An agent revising a ship later should be able to ask 'which component controls the left nozzle?' and receive a stable answer.

## 9. Browser-first, resource-aware deployment

The GLB/browser ecosystem is the delivery advantage: one portable asset can be previewed and used in supported browser-based environments. The generator itself must remain modular and not assume infinite browser memory. Run cheap modeling locally where practical (CPU/WASM/worker-based kernels are implementation options); avoid blocking the viewer. Large MINUTIA jobs may use optional remote compute, but do not require remote inference to generate geometry from a valid JSON plan. Apply per-component detail budgets, instances, selective high-resolution export, progressive previews, lazy/visibility-aware detail, GPU memory accounting, and cancellation/resume.

Do not fake physical depth with a texture when the creator requests inspectable pipes or internal mechanisms; conversely, avoid wasting mesh geometry on invisible microscopic scratches that a normal map can handle. Expose this as a choice with clear fidelity/performance tradeoffs. Protect the host with sandboxed custom operators, bounded geometry evaluation, project-scoped permissions, provenance and rollback.

## 10. Delivery sequence and acceptance gates

1. **Kernel and specification:** establish units, geometry operators, schema discovery, component IDs, constraints, reproducible JSON→GLB and external GLB validation. A non-AI script must create a useful ship.
2. **Agent-accessible creation:** HTTP/MCP/CLI/browser adapters, examples and self-documenting tools; a general text agent must assemble, inspect, alter and re-export without implementing a geometry kernel.
3. **Default:** good recognizability and proportions from short prose, local low-cost rendering, consistent revisions.
4. **Detail:** 2–4 reference views, calibrated views/anchors, source-specific silhouette and small decorative features; measurable cross-view improvements after targeted revisions.
5. **MINUTIA:** component-wise recursive refinement, routable 3D pipes/wires, layered structures, occlusion/section inspection, material/geometry distinction, editable micro-components, provenance for hidden inferred features, close-view fidelity and enforceable resource budgets.
6. **Integration and reuse:** semantic asset package and optional 223D flight bindings; same module callable from Framechute, SUBSTRATE and other clients without copying the geometry engine.

Acceptance scenarios:
- A user asks for 'a simple low-poly manta ship' and receives a recognizable, relatively inexpensive model, not a forced ultra-detailed one.
- With three or four well-labeled views, an agent can distinguish camera projection from physical proportions, preserve peculiar trims/affectations, and explain which hidden geometry it inferred.
- In MINUTIA, a close-up of a chosen engine bay reveals actual nested panel thickness, pipes, wires, clamps, and correctly ordered depth; these parts can be inspected and moved individually.
- User says 'move the third pipe 2 cm upward, keep all other features', and a scoped revision preserves unaffected components.
- A text-only agent can retrieve enough schema, examples, measurements and structured feedback to operate the same construction tools, with visual perception supplied by an adapter when necessary.
- The exported GLB loads in an independent compatible viewer, and companion JSON reopens into an editable construction project.
- The machine detects contradictory constraints and resource exhaustion with actionable errors rather than silent corruption.
- Higher detail is **possible** without requiring it for every job, every part, or every frame.

## 11. Governing law

**Do not predetermine what an agent is allowed to imagine. Give it enough mathematical vocabulary, inspection, semantic anchors, and iterative control to construct what it understands—at the simplest silhouette scale or down to minute, depth-correct, editable geometry.** The creator owns the intended design. The agent supplies interpretation and choices. The Foundry supplies predictable geometry and a persistent construction history.

---

## Framechute integration

Expose the Foundry as an optional, separate workspace tool and agent-permissioned API, not as a replacement for existing PDF/image/DOCX frames or the working viewer. A creator can drop a reference image into a frame, choose Default/Detail/MINUTIA, authorize a modeling session, inspect previews, and save/open the generated GLB and editable project. Reuse the existing object-selection, placement, export and history primitives where appropriate. Respect device limits, and allow a text-only or local client to operate without an embedded heavyweight vision model.
