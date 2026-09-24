# ÆXIS Within Reason: one picture to an editable world

**Status:** Proposal, not shipped. **Applies to:** Tiled-223D, SUBSTRATE, FrameChute. **Primary workflow:** [Tiled-223D single-image workflow](https://github.com/thanks-cohn/Tiled-223D/blob/main/docs/WORKFLOW_SINGLE_IMAGE_TO_WORLD.md).

## Promise

Upload one overhead photograph, glance at Aexis's interpretation, choose **Default**, and see a recognizable, beautiful 3D mockup quickly. Recognition should match the image's layout, object identities, footprints, dominant colors and orientation before decoration. Every inferred value remains editable. "Within Reason" names the constraint and variation engine, not a claim of measured accuracy or a specific ML model.

## First pass

1. Inspect image resolution and viewpoint. Segment building roofs/footprints, roads, grass, tree crowns, bushes, cars and, when distinguishable, bicycles/conifers. Keep unknown areas unknown and show confidence. Crop/tile large images for bounded inference; permit a correction before generation.
2. Build a logical scene graph: stable IDs, polygon or mask, centroid, orientation, dominant sampled color, class, confidence and relationships (street adjacency, neighboring buildings, vegetation overlap). Infer scale from user-provided distance or map calibration if available; otherwise use relative world units and disclose that scale is assumed.
3. Propose editable heights and sizes. Footprints, likely stories, shadows when usable, nearby objects and class-specific priors constrain estimates. Avoid absurd proportions without flattening deliberate differences. A tiny shed beside a tall building is possible; a bush taller than a building needs evidence or user choice. Never present single-image heights as measurements.
4. Produce an immediate preview: same-color simple extruded buildings; roof color preserved separately from unknown wall color; low-cost road/ground surfaces; appropriate vegetation; distinct cars whose size, color and orientation follow detections. Optional coherent styles (ordinary, toy, paper) change appearance without changing identity. Use stable seeds for bounded variation.
5. Show a compact review with **Generate** available on defaults. Ask only consequential questions when they cannot safely be inferred. A selected building offers door-facing side (suggest street-facing), generalized or specific windows, façade style and individual overrides; per-building questions are never mandatory for the whole image.

## Building and façade logic

The default block may gain shallow corner/edge embossing and a roof profile. Reusable licensed 2D door/window art can become lightweight 3D façade cards, frames or recesses fitted mathematically to walls. Wall height, width, floor count, door count, margins, spacing, ground contact and neighbor context constrain layout. Three doors must fit without overlaps, floating above ground or colliding with corners; otherwise propose a feasible arrangement. Window rhythm may vary near smaller neighbors to avoid visual clustering. A provided front/side photograph overrides generic façade inference for that side only, with provenance and user confirmation.

In the 3D tab, select a building, drag a top corner or edge to adjust height, or right-click **Segment roof here** and raise the section between a chosen edge and the segment. Store polygon, roof segments, control heights and authored overrides, then rebuild only affected geometry. Keep roofs non-self-intersecting and show a valid constrained preview while dragging.

## Data and editing contract

ÆXIS scene JSON is the versioned canonical record. Each object stores source-image coordinates, world transform, semantic class, confidence, proposed versus accepted values, source/correction provenance, asset reference/license, style seed and manual overrides. Generated Tiled JSON/TMX is an editable projection with stable IDs and meaningful layers; reimport changed geometry/semantics through an explicit conflict-aware adapter. Do not pretend ordinary Tiled JSON itself holds all façade and roof controls. Saved image and optional supplementary photos remain local unless explicitly exported.

The Aexis desktop UI may present **Interpretation**, **Tiled edit** and **3D rendition** tabs. Tiled is an optional external Qt editor launched against the generated map with save/reimport; native embedding requires a separate feasibility and licensing review. The standalone browser workflow must work without Tiled or a desktop shell. Give Tiled clear independent credit and an official donation link; keep Aexis donations separate, list third-party assets and licenses, and do not imply endorsement.

## Lightweight implementation order

1. Define canonical object schema, deterministic box/road/vegetation renderer, default façade rules and an editable mock recognition fixture. Prove a single image-like fixture can produce JSON, Tiled map and stable 3D preview.
2. Benchmark candidate small local semantic segmentation/object detection models on a held-out overhead set; include buildings, roads, grass, trees, bushes, cars, bicycles and unknown scenes. Select by per-class precision/recall, footprint quality, inference time and peak memory. No universal 90% claim; report class and image-domain coverage. Offer optional remote inference only with explicit consent.
3. Add import UI with confidence overlays, object corrections, scale choice and save/load. Preserve corrected objects across model reruns unless the user elects replacement.
4. Add neighborhood height reasoning, asset selection, constrained doors/windows and stable style variation. Ask for front images only when the user wants faithful façades.
5. Add roof handles/segments, Tiled round trip and optional desktop tab integration. Verify changes retain object identity and authored controls.

## Acceptance gates

- On a reference overhead neighborhood image, the user can accept defaults and get recognizable road, building, vegetation and car placement; sampled roof colors stay matched. Record elapsed import-to-preview time, peak app memory and frame time on a 4 GB Windows integrated-graphics machine, with budgets set from measured baseline rather than an untested promise.
- On a labeled held-out set, publish per-class precision, recall and boundary/footprint quality; report bicycle and bush results separately, plus failures on non-overhead or low-resolution images. Confidence and unknown states are visible. An aspirational 90% threshold applies only to explicitly named classes, metric and test domain once measured.
- Editing an object's class, height, color, door count or roof segment changes only the intended object and survives save/reload. Impossible door layouts produce a correction instead of broken geometry.
- Tiled export opens as a map, and a supported map edit reimports without losing stable IDs or unrelated roof/façade overrides. Ambiguous edits show a conflict.
- A lower-cost preview and actionable error are available when local inference or rendering exceeds the target device's resources. No per-frame model inference or one-mesh-per-tile rendering.

## Existing baseline versus proposed work

Tiled-223D already has a standalone Vite/Three.js flight prototype, ordinary Tiled JSON import, a separate `.sworld.json` exporter and a narrow `Additions`/low-ground height assembly workflow. The existing exporter and importer are not yet a complete round trip. Single-photo segmentation, inferred objects/heights, façade synthesis, roof sculpting, a desktop Tiled tab and this canonical scene format are future work. This proposal does not mark later world stages as shipped.
