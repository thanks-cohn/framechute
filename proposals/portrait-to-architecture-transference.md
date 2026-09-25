# Image-to-Form Transference Engine
## Portrait-to-Architecture, Image-Derived Design Languages, and Beautiful 3D Assets

**Status:** proposal / research direction, not implemented  
**Scope:** image → extracted geometric and expressive vocabulary → architecture, interiors, sculpture, props, asset families, or explorable world fragments.

## 1. Vision and artistic premise
Given a photograph, painting, illustration, silhouette, or other image, create a beautiful and coherent *new* form whose architecture, geometry, spatial rhythm, and optional palette arise from that image. A human body, for example, may be decomposed into arcs, curves, volumes, proportions, and negative spaces and reassembled into a building. Its silhouette need not remain recognizably human. At the literal extreme the result can resemble the photographed person; at the free extreme the image is a creative seed for a very different 3D work.

This literalizes artistic transference playfully: a portrait can become a building assembled from the person's shapes, with an inspectable explanation of how individual architectural elements descend from the source. The deeper objective is to preserve some chosen combination of geometry, gesture, character, and artistic *spirit* while producing an independently beautiful artifact. "Essence" is an artist-directed, subjective design goal, not an objectively measurable property of a person.

The creator should be able to upload an image, choose an output domain, adjust the degree and *kind* of resemblance, inspect candidate concepts and their geometric ancestry, refine an option, and export structured 3D assets.

## 2. Primary design principles
1. **Artist control over resemblance.** Source likeness is a continuous choice, not a prerequisite. Never equate geometric fidelity with visible likeness.
2. **Reassemble, don't merely wrap.** Derive an editable shape vocabulary and rearrange it into coherent spatial form rather than mapping the picture as a surface texture.
3. **Beauty with accountability.** Optimize appearance and usefulness under explicit source-fidelity and geometric constraints; expose where design judgment caused a departure from the original.
4. **Optional and independent palette.** Source colors, materials, and lighting may be transferred, overridden, or ignored without changing source geometry.
5. **Traceable, not falsely exact.** Show real relationships in the generation graph. Label interpretive associations as interpretations; don't invent exact pixel-to-vertex ancestry for unconstrained generative outputs.
6. **Reusable and editable.** Prefer semantic geometry, component graphs, curves, primitive libraries, modular assemblies, and portable assets over a single opaque final image.
7. **Progressive fidelity.** Start with fast concept studies and low-poly blockouts, then refine selected candidates. Full asset-quality 3D generation is a long-term goal.

## 3. Degrees of transference — core creator control
Expose a **Source Resemblance / Creative Freedom** slider, with continuous values and helpful named anchor presets (not hard, mutually exclusive categories):

| Anchor | Intended behavior |
| --- | --- |
| Literal | Preserve recognizable overall silhouette, contours, proportions, and motifs. A building may visibly resemble the source subject. |
| Structural | Preserve extracted arcs, curves, relative dimensions, and geometric vocabulary, but permit major reorientation and rearrangement into architecture. |
| Abstract | Preserve selected rhythms, negative-space relationships, proportions, and motifs while recognizable likeness may disappear. |
| Essence-led | Favor a creator-specified reading of gesture, compositional energy, atmosphere, or visual character over literal contour reproduction. |
| Free | Use the source as inspiration; allow substantial formal departure in pursuit of a coherent, beautiful new result. |

**Important:** these presets guide generation, not mathematically guarantee a fixed percentage of likeness. In the UI, a value of 70% "freedom" expresses a preference, not a claim that 70% of the subject has been changed.

### 3.1 Independent fidelity dials
Provide advanced controls with independently selectable target weights: **silhouette**, **specific curves and arcs**, **proportional relationships**, **part inventory / use of original fragments**, **composition and rhythm**, **pose or gesture**, **semantic / expressive character**, and **palette / materials** (off by default or optional). Include manual locking: "keep this eyebrow curve exactly," "preserve these three ratios," "ignore the face outline," "do not carry source colors." Allow users to control *which* parts influence which asset layers (massing, facade, circulation, ornament, materials, landscape).

Distinguish three separate ideas:
- **Source-shape preservation:** how closely a derived primitive matches a contour or ratio.
- **Source-shape usage:** how much of the original vocabulary actually appears in the output.
- **Source recognizability:** whether an observer can identify the original image from the finished building.

A geometrically faithful rearrangement can have low visual recognizability. A recognizable silhouette can use newly invented structural components. The product must not collapse these into one "similarity" score.

### 3.2 Examples and interaction
A source portrait's lip curve could become a roof, shoulder sweep a stair, and eyebrow arc a bridge: all curves remain geometrically faithful, yet the building need not look like a face. Conversely, preserve the body's outer silhouette for a figurative monument while freely designing its internal structure. Generate several candidates at distinct transference degrees from the same frozen source, so the artist can compare outcomes and branch without losing earlier versions.

## 4. Traceable transference — provenance as creative interface
A creator may click any roof, arch, stair, wall, balcony, window rhythm, or other generated element and ask: **"Where did this come from?"** The interface highlights contributing regions or curves in the source image and displays the transformations between source and result. Selecting a source feature can also reveal all of its descendants in the design. Traceability remains useful even at high abstraction: it can expose what was retained, rearranged, stretched, blended, or discarded.

### 4.1 Provenance graph
Store a graph with immutable source-asset ID, extracted region or control points, feature ID and type, transform steps (rotation, translation, uniform/nonuniform scale, spline fitting, loft, merge), target component ID, version and generation settings, plus optional user or agent edit history. Many-to-many links must be supported: one shoulder arc can influence several roof segments; one roof can combine several source curves. Let users compare alternate ancestry and edit a link intentionally.

### 4.2 Honesty about evidence
Mark a link as **direct** when target geometry can be reproduced from recorded source curves and deterministic transformations; **derived/composed** when multiple documented features contribute; **interpretive** when an AI or artist uses the source as inspiration without reproducible geometric correspondence; and **unattributed** when the tool cannot establish a reliable link. Show confidence only if calibrated and meaningful. Do not display fabricated exact mappings for generated pixels/vertices.

### 4.3 UX and export
Provide side-by-side source and 3D viewer, hover or click cross-highlighting, a layer-toggle for source curves and target geometry, lineage breadcrumbs ("image → shoulder contour → spline #12 → roof #4"), before/after geometry overlays, feature locking, and optional transformation animation. Export the provenance graph alongside the asset (e.g., JSON references keyed to glTF/GLB node IDs), with opt-in image embedding and privacy-safe options for portrait-based projects.

## 5. Image-to-form pipeline
1. **Source intake:** user-owned or authorized image(s); optional target category and text brief; identify camera/perspective ambiguity and preserve the original.
2. **Perceptual parsing:** subject and part segmentation, silhouettes, edges and splines, negative space, proportion landmarks, composition, gesture, recurring motifs, optional palette and material cues. A single view cannot reveal the subject's actual unseen 3D anatomy; inferred depth must be marked as inferred.
3. **Shape-language inventory:** create normalized curves, arc families, ratios, primitives, volumes, symmetry axes, semantic labels, and an editable feature library; tie each source feature to image coordinates.
4. **Interpretation plan:** map selected source features to target-domain roles (massing, roofline, circulation, ornament, furniture, sculpture, props). Obey transference degree, independent fidelity dials, locked parts, practical constraints, and creator's stylistic instructions.
5. **Concept exploration:** produce multiple rapid 2D views and 3D blockouts with different arrangements. Let the artist compare similarity, geometry reuse, spatial coherence, and visual appeal without conflating them.
6. **3D synthesis:** assemble parametric curves and volumes, component graphs, constructive solid geometry or meshes; use a learned generator where helpful, but maintain an editable geometry intermediate whenever possible.
7. **Aesthetic and utility refinement:** iterate proportion, silhouette readability, rhythm, lighting, detail and composition; optionally impose architectural circulation, access, collision, and structural *concept* checks. Do not advertise generated concepts as construction-ready engineering plans.
8. **Review and export:** show the source-to-result graph, accept manual overrides and branches, generate appropriate LODs and texture/material variants, and export scene-ready assets with relevant metadata.

## 6. Possible avenues
- **Portrait → architecture:** home, tower, museum, pavilion, cathedral-like fantasy building, civic monument, or intentionally comic literal portrait-building.
- **Portrait → interiors:** room, study, chamber, gallery, hallway, furniture, lighting and architectural detail.
- **Figure/object/painting → sculpture:** installations, monuments, stage design, wearable or product-form studies.
- **Image → reusable asset kit:** doors, arches, columns, props, furniture, vegetation silhouettes, vehicles, and decorative modules expressing one coherent source-derived language.
- **Image → explorable world:** multiple interoperable buildings, a district, cave, forest structure, or themed environment generated from one or several visual seeds.
- **Multi-source mixing:** derive form from one image, palette from another, circulation plan from a sketch, and mood from a text brief; show separate provenance for each.
- **Inverse design challenge:** assemble a coherent building from a finite set of extracted source fragments with strict usage constraints; turn artistic transference into a playful design puzzle.
- **Artist workflow:** editable curated variations, licensing/attribution where relevant, versioned collaboration, and optional audience-facing "reveal the source" experiences.

## 7. Long-term research: a model for beautiful, spirit-faithful image-to-3D assets
The aspirational model should accept an image and optional creator direction, infer its geometric grammar and expressive cues, and produce **beautiful, editable, reusable 3D assets** rather than a generic mesh or only a plausible 2D render. Train for controllable transformation, not unquestioning visual imitation.

A plausible modular research stack:
- **Vision and geometry encoder:** contours, parts, landmarks, composition, perspective, semantic content, and optional text/artist annotations.
- **Shape-grammar representation:** normalized splines, proportions, primitive and module graphs, source-coordinate links, and geometric constraints; keep an interpretable branch alongside any learned latent.
- **Cross-domain translator:** source vocabulary + target category + fidelity settings → assembly plan and design candidates.
- **3D generator / constructor:** procedural geometry plus learned proposal/refinement modules; experiment with implicit surfaces, meshes, and structured parametric or scene graphs according to asset type.
- **Aesthetic and utility critics:** separate human-guided feedback for visual quality, source relation, editability, topology, collision, and target-domain suitability, rather than one opaque "beauty" score.
- **Multiview consistency and export:** enforce view-to-view coherence, surface continuity, modularity, LOD, and stable object IDs; preserve links between generated parts and the source when they truly exist.

### Training paths
Start by benchmarking existing image-to-3D, 3D editing and procedural methods rather than assuming a foundation model must be trained from scratch. Curate permitted image/asset examples with descriptive transformation annotations; synthesize deterministic source-curve→asset pairs and their exact provenance; include artist-created pairs and counterexamples for over-literal, unrelated, or unusable output. Collect separate human judgments for beauty, geometric fidelity, recognizability, expressive relevance, and 3D usefulness; these are subjective and sometimes conflicting. Fine-tune or train specialized adapters and preference models only after obtaining enough vetted examples and a baseline. Use multiview/3D-aware data to discourage single-view illusions, test generalization on held-out source subjects, and document rights, consent, dataset bias, and provenance limits.

### Evaluation
Measure curve/ratio fidelity where strictly requested, geometric reuse and provenance validity, artist-rated aesthetic quality, artist-rated source-to-output resonance, multi-view coherence, mesh integrity, editor reusability, render and export performance, and consistency under independently varied dials. Compare matched seeds at different freedom levels; the expected relationship between freedom and likeness should be tested rather than assumed.

## 8. Delivery plan
**Prototype A — manual art test:** hand-extract a few curves and create several building concepts from one image at different degrees of resemblance; annotate provenance manually. Establish a visual target before automation.

**Prototype B — inspectable procedural blockout:** image annotation, spline extraction and editing, feature-to-component mapping, basic extrusions/lofts, slider presets, cross-highlighting, and GLB export with provenance JSON.

**Prototype C — hybrid agentic design:** optional concept-model candidates plus constraint-aware geometry assembly, user feedback, part locking, variants, branching, and side-by-side 3D inspection.

**Prototype D — trained transference model:** build and validate datasets, explore domain adapters, human preference feedback, multiview fidelity, more detailed 3D output, and reliable provenance for the portions the model can actually trace.

This is a research roadmap, not a claim that exact semantic "essence" extraction or reliable image-to-production-ready-3D synthesis already exists.

## 9. Product and safety considerations
Source photographs of people may be sensitive: obtain authorization, avoid presenting generated forms as factual anatomical or psychological interpretations, provide retention and deletion controls, and don't expose source portraits in shared exports by default. Preserve creator rights, license data appropriately, and mark unconstrained generative contributions honestly. Build with opt-in remote compute and local-preview fallbacks as feasible.

## 10. Definition of success
A user can supply an image, choose how much recognizable likeness and which *specific* source properties to preserve, generate multiple attractive and editable candidate assets, select any component and inspect honest source ancestry, then export a functional 3D result. The broad artistic ambition: **a person can become a building; an image can become a world; the artist controls what survives the transformation.**

## Repository-specific integration
FRAMECHUTE hosts the visual authoring workflow: source-image frames, extracted-feature frames, candidate-design frames, transformation controls, editable previews, and export or handoff to downstream 3D tools.
