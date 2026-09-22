# Proposal: Bring to Life — Universal Image-to-Actionable Worlds
## Draw it, import it, inhabit it, and let it act

**Status:** Vision and phased implementation proposal; not an implemented feature.  
**Applies to:** SUBSTRATE / FrameChute, the 2D / 2.5D / 3D Worlds (R)END architecture, and creator-authored Cubecosms.  
**Related:** `semantic-world-engine-agent-native-spatial-ir.md`, `omni-behavior-language-semantic-action-compiler.md`, `omni-world-engine-neutral-2-5d-worlds-rend.md`, `universal-object-interchange-different-media-same-physics.md`, `3d-studio-focused-asset-editing-and-cubecosm-programming.md`, `aeris-stage-ii-semantic-mapping-maplift-and-descent.md`.

## 1. Vision: make imported pictures come alive

The creator drops in an image, drawing, pixel-art sheet, photograph of a room, picture of a skyscraper, or character illustration and chooses **Bring to Life**. SUBSTRATE does not merely display or animate the image as a flat video. It **adapts the asset into an actionable participant in a shared world**: a visual embodiment plus stable semantic identity, usable geometry, permitted interactions, animation/deformation affordances, and collision/navigation state.

The ideal first impression evokes the childhood animation fantasy of drawing a door on a wall and then opening it, drawing a character and watching it step off the page, or importing a picture of a room and walking into it. Pay homage to that *feeling*, not by copying third-party characters or protected designs.

**Design law: The imported image supplies appearance; the reconstruction supplies form; the semantic world supplies meaning and rules; the expression engine makes it move and respond.** The image is the beginning of an object, not its final boundary. Creators should not have to know rigging, CAD, game engines, or physics just to make a recognizable picture act convincingly in their world.

The especially distinctive capability is **generalization to unfamiliar user-supplied assets**. A user who brings an ordinary wall photograph should be able to punch a plausible hole through it without hand-authoring a special destructible wall. A creator who imports a skyscraper should be able to interact with windows, entrances, floors and walls once those features have been inferred or supplied. A drawing of a character should acquire compatible movement and expressive behavior.

## 2. One asset, multiple selectable embodiments

The creator explicitly chooses what the imported image should become; not every image should be forced into photorealistic 3D.

| Mode | Generated representation | Typical interactions |
| --- | --- | --- |
| **2D Image / Tiled World** | Region masks, collision shapes, layered sprites, mesh proxies | walk, grab, strike, cut, stretch, fracture, pass through an opening |
| **Pixel Life** | Pixel-art sprites, animation states/sheets, pixel-scale collision proxies | SNES-like movement and expressive interactions |
| **2D Animated Life / Video Portrait** | Layered 2D rig, expression/mouth/pose controls, or bounded generated portrait animation | blink, emote, gesture, speak with user-enabled dialogue |
| **Stylized / Anime Life** | 2D rig or 3D stylized avatar with suitable animation adapter | stylized movement, squash/stretch, interaction |
| **3D Animated Life** | Mesh + texture/material + rig/animation mapping + collision and navigation proxies | walk, climb, interact, morph where supported |
| **Room / Building / World** | Segmented architectural regions, inferred 2.5D or 3D shell, navigation graph and object hierarchy | enter, traverse, open, fracture, rearrange and author locations |

Use the *same canonical semantic identity, affordances, action schema and state* across alternate embodiments when possible. Rendering and animation quality can differ without changing the meaning of an action. A low-end machine can run a 2D proxy while a stronger device renders the same event in 3D. A model should not need to emit a fresh video for every movement.

## 3. Universal asset-incarnation pipeline

1. **Import and preserve source.** Retain immutable original bytes, provenance, dimensions, license/permission notes supplied by the creator, and an editable project record. Never replace the user's original with a generated guess.
2. **Perceive and propose.** Use an optional image-capable model, deterministic CV, descriptive creator-supplied labels and semantic texture metadata to identify subject(s), regions, outlines, likely material, surfaces, depth ordering, doors, windows, floors, characters, anchors and relations. Attach confidence/uncertainty. A text-only agent can operate on the generated semantic dossier afterward.
3. **Creator correction.** Overlay proposed masks, object boundaries, labels, material types, entrances, anchors and inferred depth. Offer easy click-to-fix, draw-to-separate, mark-behind, and “this is a wall/door/character” controls. Do not require technical modeling.
4. **Reconstruct the chosen form.** Produce a 2D mask/mesh/rig, pixel sprites, a 2.5D layered scene or a 3D mesh/scene as requested, choosing cheap local processing where sufficient and opt-in connected cloud inference for more intensive image-to-3D, multiview synthesis, rigging and animation. Keep render mesh distinct from interaction/collision proxy.
5. **Create an actionable semantic object.** Assign stable IDs to meaningful subobjects; canonical coordinates and units; parent/child and connected-region relationships; materials, edge/fill masks, collision and navigability; anchors/joints; transform and deformation capabilities; supported actions, constraints and state. Record which fields are observed, inferred, generated or human-confirmed.
6. **Bind reusable effect adapters.** Match candidate actions to the image's actual representation: fracture/split, squash/stretch, peel/fold, ripple/displace, darken/shadow, fragment/dissolve, deformation along splines, particles, camera/audio response and reassembly. Generated geometry must not automatically imply that any arbitrary action is feasible.
7. **Validate, preview, commit.** Test geometry, seams, texture mapping, hit tests, traversal, performance budget and undo. Let creators preview and revise before saving as a reusable world asset. Persist the source, semantic dossier, proxies, generated outputs, confidence and provenance.

A clear image of a simple wall can get a nearly automatic adapter. A complicated room or unfamiliar illustration should offer a short correction pass rather than silently pretending the inferred segmentation is exact.

## 4. Mathematical Expression Grammar: expressive, inexpensive and composable

The world must distinguish **edges/boundaries, fill/interior, anchors, connectivity, material, depth layers and collision**. Import-time adaptation maps an unfamiliar image into primitives the runtime already knows how to manipulate. The semantic action compiler converts a key press, mouse gesture, authored rule, or an LLM's high-level intent into a **typed, validated operation**. The JavaScript/WebGL/WebGPU engine executes it immediately; an LLM should not be in the per-frame or per-keypress control loop.

Illustrative operation families:

- Geometry: `scale(anchor)`, `stretch(path)`, `compress(axis)`, `bend(spline)`, `bulge(point)`, `shear`, `ripple`, `split(path)`, `reform`.
- Appearance: `darken(region)`, `silhouette`, `texture-warp`, `smear`, `dissolve`.
- World interaction: `apply-impact(target, point, direction, impulse)`, `fracture(material, seed)`, `spawn-debris`, `update-collision`, `open-passage`, `displace-water`, `camera-response`, `audio-cue`.

A **Rubberband Man** is a useful benchmark character: deformable body, anchored feet, spline-extended arms, squash/compress, flatten-through-opening, giant silhouette and reforming. Punch, compress, stretch, shadow-shift and other compound abilities can map to creator-selected keys. The same typed intent can be realized as cartoony rubber motion, unnerving shadow motion, or mechanical extension by different expression adapters.

Allow performance presets: material-aware, exaggerated cartoon, horror, slapstick or deliberately meme-worthy. A realistic masonry fracture should favor plausible joints and heavy debris; a cartoon wall might swell before breaking; a gag might leave a person-shaped hole. **Convincing and entertaining** is the requirement, not perfect structural physics in every mode. Never misrepresent a stylized physical approximation as an engineering simulation.

## 5. Signature demo: punch any ordinary wall picture

Given a single clear wall image and a known contact point:

1. Estimate wall bounds, surface material, a plane/mesh proxy, mask, depth order and impact coordinate.
2. Generate low-cost jagged crack paths from the contact point; use seeded branching and material-specific bias. Prefer valid connected fracture regions over unbounded random lines.
3. Turn paths into clipping polygons / triangulated image fragments. Retain source texture UVs, introduce plausible exposed edges, and draw or infer a backing region so the gap is not a transparent visual glitch.
4. Animate a brief impact bulge or pause; separate fragments under bounded rotation/translation/gravity, with debris, dust, sound and camera response appropriate to the selected style.
5. Update the authoritative collision/nav model from the actual opening. If the action fails or the wall is unbreakable, do not show a hole that the player cannot traverse.
6. Preserve reversibility, restore/reform where applicable, and allow subsequent hits against the remaining wall.

The core distinction: **the creator did not pre-rig or pre-animate the particular wall**. Its photo becomes an interactive object through the shared adapter and a small library of procedural operations. Prefer local shaders, clipping, cached meshes and batched fragments at runtime; fall back to a simple crack overlay or silhouette change on restricted hardware.

## 6. Entire pictures become spaces, not one giant destructible bitmap

A room image needs segmentation into walls, floor, ceiling, furniture, doors, windows, foreground occluders and background layers; an uploaded city or skyscraper needs architectural subobjects and a spatial graph. A punch should modify the *wall region*, not tear the whole room photograph. Introduce layered source preservation, masks, semantic IDs, parent-child relationships, generated hidden/backside surfaces and traversal links.

For a skyscraper: infer visible floors, facade, windows and entrances; generate a plausible exterior shell and optional explorable interior. **One exterior photo cannot recover the building's true unseen rooms, precise structure, or engineering.** Label interiors/geometry as inferred or generated, accept additional views or floor plans and explicit creator corrections, and offer a visual-fidelity mode separate from a physically/architecturally faithful reconstruction mode. Never call an imagined floor plan “correct” merely because it looks realistic.

For characters: infer a suitable skeleton/rig or layered 2D controls and bind reusable movement/interaction primitives. Dialogue and high-level agent behavior are optional separate capabilities, not a necessary prerequisite for a picture to come alive.

## 7. Player-directed actions, AI world-making and competitions

- A person can attach `Q`, `E`, click, controller input or other bindings to validated compound abilities such as punch, stretch, compress, slip through a gap, or shadow expansion. Players may design and share ability sets built from primitives.
- An agent can propose compositions from world geometry, material tags and character affordances, but the compiler validates target, capability, world version, permission, resources and outcome. Do not run generated arbitrary JS as trusted game logic.
- An AI course builder can assemble rooms, structures, obstacles, routes and an optional mecha rival; verify at least one reachable solution with permitted abilities before publishing a challenge. Different toolsets may solve the same obstacle differently.
- The deterministic/authoritative simulation adjudicates interactions and competition outcomes. The model choreographs or authors at a higher level; it does not fabricate collision outcomes or grant itself capabilities.
- Imported creations remain usable locally/offline once generated and cached wherever their features do not require a remote service.

## 8. Cloud inference and product constraints

Support user-connected or opt-in SUBSTRATE cloud providers for image-to-3D, reconstruction, rigging and generated animation. Present estimated compute cost/quality before initiating paid work; track quotas, job states, cancellation, model/provider provenance, caching and privacy settings. Heavy inference happens primarily at asset-creation time; routine gameplay stays locally executable when possible. Design explicitly for low-end/4 GB devices: image size limits, proxy levels of detail, batching, adjustable effects, texture budgets and graceful 2D fallbacks. Do not implicitly upload private room photos, documents or portraits.

For a real person's likeness, require an appropriate consent/authorization workflow before enabling realistic interactive impersonation or publication; make provenance and generated status visible. Respect asset rights and avoid presenting generated unseen real-world spaces as facts.

## 9. Implementation phases and measurable demonstrations

**Phase A — Universal 2D wall:** import an unfamiliar wall image; creator can correct its mask; punch at arbitrary valid points; generate seeded cracks and original-texture fragments; update collision to permit passage; undo/reload succeeds. Measure time-to-first-interaction, collision/visual consistency and frame performance.

**Phase B — Living 2D scenes:** import a room illustration and segment its interactive regions; import a simple character image; produce a lightweight articulated/layered avatar; let the character walk, punch an identified wall and pass through the opening. Offer pixel and cartoon expression presets.

**Phase C — Semantic Motion Grammar:** ship typed action/ability schemas, material adapters, creator keybindings and agent composition with deterministic execution; demonstrate Rubberband Man deformation and the same action realized differently by rubber, shadow and mecha appearances.

**Phase D — Optional 3D incarnation:** reconstruct a photograph into a visually plausible 3D shell and interaction proxy; creator corrects entrances and floors; produce a rigged character option; demonstrate an explorable stylized building. Report uncertainty and render/interaction quality separately.

**Phase E — Shareable worlds and challenges:** package source assets, canonical semantic scene, generated embodiments, adapters, controls and provenance into a portable world/Cubecosm; support AI-authored, verified obstacle courses and compatible local/cloud rendering.

## Product acceptance principle

A new, previously unseen user-supplied picture should be able to join the world with **minimal creator effort**, respond to a meaningful action through reusable mathematical/semantic behavior, and remain coherently interactive afterward. The lasting product is not a collection of AI-generated videos; it is an expanding vocabulary through which drawings, photographs, characters and buildings can **become actionable worlds**.
