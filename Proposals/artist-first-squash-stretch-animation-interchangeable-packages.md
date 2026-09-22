# Proposal: Artist-First Squash-and-Stretch Engine and Interchangeable Animation Packages

**Status:** Vision and staged design proposal; not implemented.  
**Date:** 2026-09-22  
**Homes:** `thanks-cohn/substrate/Proposals/` and `thanks-cohn/framechute/Proposals/`.  
**Companions:** `universal-object-interchange-different-media-same-physics.md`, `omni-behavior-language-semantic-action-compiler.md`, `semantic-world-engine-agent-native-spatial-ir.md`, `3d-studio-focused-asset-editing-and-cubecosm-programming.md`, `bring-to-life-universal-image-to-actionable-worlds.md`, and the Omni World/Worlds (R)end proposals.

## Vision

Make SUBSTRATE a home for squash-and-stretch artists and other expressive animators: **artists first author and position their art, and SUBSTRATE makes it interact in a mathematically stable world; later, those same creators may tune or replace the mathematics to produce their own distinctive behavior.** Do not make writing a physics engine, rigging in one prescribed style, or adopting stock animations a prerequisite to putting a personally drawn character into a playable world.

Creators may upload their *own* sprites, hand-drawn sequences, sprite sheets, 2D/2.5D or 3D assets and animations, control their frames, positional movement, pivots and timing, attach those clips to world entities, and iterate visually. They can subsequently adjust response curves, constraints, colliders, contact behavior, game logic, deformation rules, and custom mathematical models. A mathematically stable default is a convenience and starting point, **not a permanent restriction or forced visual style**.

The longer-term opportunity is an **interchangeable creative-component ecosystem**: a creator may pair a character animation with an effect on a form, a door, a tree, a body of water, a vehicle, a document frame, or an entire environment, and publish the combination as a reusable, installable, remixable package. A different creator can replace the artwork while retaining the permitted behavior, replace the behavior while keeping the artwork, or compose several compatible packages into an original experience. The goal is not to claim that squash-and-stretch, modding, animation graphs, or package marketplaces were never attempted elsewhere; the product ambition is to make *artist-controlled positional animation + progressively editable mathematics + semantic interchange* a coherent, approachable workflow.

## 1. Authoring order: art → position → interaction → mathematics

1. **Bring your art:** import frames/sprite sheets, transparent images, layered sequences, a supported animated 3D asset, or a hand-authored in-product animation. Preserve provenance, source assets, authored frame order, timing, and working files.
2. **Place and choreograph it:** artist controls the visible entity's local position and world placement, orientation, pivots, anchor points, scale, layering, paths, keyframes, transitions, per-frame offsets, and animation timing. They can drag a contact point to a ground plane or align a hand to a handle directly in the preview; the engine does not silently override intentional animation. Positional authoring is the first-class interface.
3. **Make it play:** choose a minimal action binding (idle / run / jump / land / interact / effect), connect the animated object to a stable initial movement or interaction controller, and preview it in a real scene. Start with easy defaults; expose precise controls only when requested.
4. **Choose what deformation means:** by default, visual squash/stretch does not automatically alter movement mass, ground clearance, every collider, or platform penetration. Explicitly mark what should be visual-only and what should have physical consequences. Hands, feet and interaction regions may follow animation separately from the stable locomotion body.
5. **Refine the mathematics later:** allow artists to adjust named parameters and curves before they ever see equations. Advanced authors may define custom deterministic motions, compliant collision shapes, alternative controllers, procedural deformation, local physics, or explicitly scoped code/WASM behavior. Custom mechanics need not be reduced to presets, but unsupported effects must fail clearly rather than pretend to work.

**Non-negotiable:** if an artist specifies a positional keyframe, its visual intent is authoritative within the declared authoring mode. Constraint/collision conflicts are shown in the editor with selectable policies (preserve appearance and keep a separate gameplay body; adjust/root-align animation by consent; change physical collision; or reject conflicting interaction). Never secretly “fix” the animation by reshaping it. A renderer may interpolate visual frames, but gameplay state changes only under declared rules.

## 2. Two representations, one entity

A playable entity has a **visual/animation representation** and a **canonical world/interaction representation** linked by a versioned adapter, not a single mutable sprite box that must serve every purpose.

- Visual: authored frames or rig, transforms, motion curves, squash/stretch, pixel/mesh geometry, rendering layers and visual effects.
- Spatial: stable ID, canonical coordinates, velocities when relevant, controller state, grounding, occupancy, interaction targets and event state.
- Contact: body collider; optional foot/hand/head anchors, per-action hitboxes, sensor regions, deformation envelopes and animation-event markers.
- Mapping: explicit conversion between rendered/pixel/asset units and local/world units, origin/pivot rules, coordinate handedness, scaling and timebase.

**Three user-selectable interaction modes:**

- **Stable body (default):** exaggeration affects artwork; conservative gameplay body and ground anchor remain stable. Reliable for a quick platformer or desktop-world NPC.
- **Authored contacts:** the artist marks time-varying contacts/regions, including reaching hands, spreading blob edges, a tail, or a door sweep; selected areas influence gameplay and can trigger explicit events.
- **Fully custom physical behavior:** a package supplies a validated custom controller, deformation/collider evolution, or scoped simulation with resource and permission requirements. This is an advanced opt-in, not inferred from sprites.

Examples: a blob flattens on landing without falling through a floor; a stretched arm can grab a handle through its animated hand sensor without inflating the torso collider; an inflating character's visual growth may be cosmetic or intentionally change occupancy, according to the creator's rule; a rolling character can switch movement mode and geometry at a marked animation event.

**Mathematical correctness means declared invariants hold**, not that the engine overrides cartoon exaggeration with “realistic” physics. Document and test contact stability, deterministic event order, non-penetration where requested, reproducible time-stepping, anchor alignment, and clear failure modes. Not every artistic pose can satisfy every chosen physical constraint simultaneously.

## 3. Editor experience and feedback

A minimal studio should expose: upload/choose an asset; pick a clip; assign action; position the art by dragging; adjust pivot and foot/hand/contact anchor; view a timeline; play it against a floor, platform, wall, and test interactable; and press **Use in World**. Optional overlays show the visual bounds, root, canonical body, sensors and contact points. The artist can toggle overlays without affecting their work.

A beginner-facing panel offers grounded visual concepts: **squash, stretch, springiness, anticipation, recovery, jump arc, impact strength, friction, grounding, effect timing**. Each slider maps to a documented parameter with sensible bounds and preview. A later **Advanced Mathematics** panel reveals equations/curves, units, solver/controller assumptions, constraints, event graph, and plugin hooks. Fine control can modify timing, interpolation/easing, frequency/damping, impulse response, collider policy and procedural mesh deformation.

**Preview the actual behavior**, not just a rendered animation loop. Show meaningful warnings: “hand sensor never reaches handle,” “root moves outside platform,” “collision geometry disagrees with this frame,” “package expects a 3D renderer,” or “this motion requires an unsupported controller.” An artist can keep a deliberate visual illusion when gameplay contact remains separately valid.

Apply undo/redo, named variants, locally saved drafts and original-source preservation. Saving an animation locally must not implicitly publish it or run downloaded scripts.

## 4. Pair animations with effects on forms and world objects

Treat an animation as one component in an **event → action → response** relationship rather than a clip locked to a single character. Creators should be able to bind visual motion to a typed object capability and make packages combining these.

Examples:

- The same **impact squash** can flatten a blob, compress a springy sofa, ripple a lake, and shake nearby grass, with separate visual assets and an explicitly configured impact event.
- A **stretch-to-reach** clip can extend a cartoon arm, animate a flexible bridge, bend a tree branch, or unfurl a banner, each with its own contact and capability rules.
- A **landing** event can play a character squash, trigger a dust puff, deform terrain visually, send a bounded impulse to loose objects, and play a sound. The terrain need not literally change collision mesh unless that is declared.
- A user-authored **open** action can animate a door, window, drawer, UI form, PDF/DOCX/WEBX frame or spatial portal, but each target exposes only its supported and permissioned operations. A document's visual animation must not grant access to its contents or silently edit it.
- A water package can pair a surface animation with impact ripples, buoyancy responses and region-specific shaders; a wind package can influence trees, cloth-like objects and particle effects using declared adapters.
- A Cubecosm or world zone can apply a compatible effect package to its permitted inhabitants and objects without leaking its logic or resource demands outside its scope.

Describe effects through typed capabilities such as `onContact`, `onLand`, `onStretch`, `onOpen`, `onEnterRegion` and `onInteract`; bind to a semantic target/capability rather than brittle renderer-internal IDs or a one-off coordinate. Allow blending, priorities, local overrides and explicit conflict handling when multiple packages respond to the same event. Keep object IDs and authoritative world state stable when art or renderer changes.

## 5. Interchangeable packages as the creative unit

A package may hold **art, clips, effect assets, behavior definitions, math/controller modules, interaction bindings and semantic descriptions**, independently or together. Useful types include character packs, animation packs, effect packs, controller/physics packs, world-object reaction packs, procedural form/deformation packs, 2D-to-3D counterpart packs, and complete scene/world kits.

A portable package manifest should declare:

- namespace, stable package ID, semantic version and compatible SUBSTRATE schema/engine API versions;
- what is supplied (assets, clips, action tags, controller, collision/contact bindings, visual effects, supported targets);
- exposed parameters, units, defaults, authoring limits and configuration UI schema;
- named events, input requirements, output effects, resource limits, conflicts and extension points;
- 2D/2.5D/3D representations where available, equivalent action IDs, retargeting and fallback rules; no assumption that a sprite automatically reveals complete 3D geometry;
- dependencies with pinned ranges or lockfile, runtime/host capabilities, permissions and portability limits;
- author, provenance, third-party source licenses, reuse/remix/commercial permissions and attribution requirements;
- versioned machine-readable semantic descriptions so AI agents or other tools can *discover* what an asset does without treating descriptions as executable authority.

**Interchangeability is capability-matched, not magic.** An animation that expects a left-hand grip cannot guarantee equivalent results on a handless creature; a water ripple shader is not automatically a collision model; a high-end deformable 3D asset cannot be represented identically in a 2D low-memory renderer. The editor should surface compatibility, preview adapters/fallbacks and offer editable mapping instead of silently substituting behavior. Keep rendering, simulation and metadata separable so each can be swapped independently.

Creator workflow: **Make animation → place/position it → bind interactions/effects → optionally tune/author mathematics → test → save private reusable component → optionally export/share/publish a package.** A recipient can install a package, choose another visual skin, remix the permitted action/effect mappings, and make a new package with explicit dependency and license tracking. Commercial distribution may be supported later but is not required to prove this concept.

## 6. Semantic and agent-native interface

Every asset, clip, anchor, controller, target capability and effect receives a stable typed identity and human-readable description. Example intentions: “this clip is the blob's landing; feet must remain grounded; at 15% play a visual impact; if a surface advertises `surface.ripple`, send a bounded ripple event.” An agent should be able to map actions and propose package combinations from these descriptions **without** inventing unavailable hooks or guessing that a shape is a physics collider.

Provide a versioned, declarative action schema, validation, deterministic execution path, previews and change reports. An LLM may suggest bindings; the runtime confirms asset/action capability, target geometry, consent, permission, schema version, host support and budget before applying changes. Semantics help author and search; they are not permission grants or proof that an inferred mechanical relationship is valid. Reuse the canonical object graph, the existing Omni behavior compiler and world adapters instead of creating a competing source of truth.

## 7. Host, performance, trust and authorship

- **Browser/extension:** keep the lightweight default available, cap texture/frame sizes and active controllers, throttle offscreen animation where permitted, and separate downloaded content/code from privileged extension APIs. Respect browser extension remote-code restrictions and user-authorized storage. No arbitrary local filesystem access.
- **Electron/desktop:** allow more ambitious physics, deformation, scripting and local resources through a separate capability profile and explicitly consented native operations. The existence of a native host does not grant every package unrestricted local access.
- **Runtime:** deterministic fixed-step gameplay where needed, interpolated visual presentation, declared timebase and root-motion policy, bounds and resource budgets, cached compatible adapters, and graceful fallback where possible. Preserve state when swapping a package, or require a clearly disclosed migration if state schemas differ.
- **User-supplied code:** isolate, validate and permission-scope custom script/WASM modules; avoid unsandboxed remote JS in a privileged extension context. Rendering and physics resources have measurable limits; custom code cannot assume infinite CPU/GPU, native API access or automatic cross-world authority.
- **Artist ownership:** preserve source and version history, separate private draft/use from public share/sale, respect third-party licenses, and distinguish author-authored motion from engine-generated interpolation or optional retargeting.

## 8. Suggested milestones

**M0 — One complete playable artist loop (2D):** upload sprite sheet or frame sequence; assign idle/run/jump/land; drag art into world; set pivot, foot anchor and positional timeline; play with a stable platformer body; preserve author-selected visuals; save/reopen locally. Test a stretched jump and flattened landing on platforms.

**M1 — Effects + contacts:** per-frame/clip event markers; selectable visual-only vs authored contact regions; hand sensor and object interaction; object reaction package (impact → ripple, dust or spring); editor overlay for gameplay-vs-art alignment. Verify events fire once in a stable order and do not trigger forbidden edits or physics changes.

**M2 — Portable package interchange:** manifest, schema validation, namespace/version/dependencies, provenance/license fields and export/import; swap one character's art while retaining compatible behavior; pair the same bounded effect package with two distinct target forms; expose compatibility errors and fallbacks.

**M3 — Artist-tunable mathematics:** named curves and parameters, motion/easing/root-motion options, constraints, collision-mode choices and explicit deforming collider option; interactive scene previews; deterministic replay tests. Add advanced custom controller API under a permissioned, budgeted host rather than requiring it for M0.

**M4 — 2.5D/3D, world-scale composition and marketplace:** corresponding 2D/3D variants through named adapters; effect graphs across world objects/zones; semantic agent-assisted package composition; versioned publication and optional commercial ecosystem. These are targets, not claims of implementation.

### Acceptance tests

1. Artist uploads four personally drawn sequences, positions them and makes a playable character **without** entering equations or writing code.
2. The rendered body can triple in visible height during a jump and flatten on landing while the declared stable body remains grounded and does not clip through a platform.
3. With an explicit authored sensor, a stretched hand interacts with a reachable handle while other visual deformation remains cosmetic.
4. The same declared impact event plays a squash on one character and a ripple on a compatible world surface; turning off either effect does not break the world's canonical collision state.
5. A second creator can replace a compatible animation/effect pack without renaming original world entities or losing unrelated saved state; incompatibilities are clearly reported.
6. A creator can later change the motion equation/curve or write an authorized custom controller without being locked to stock movement. Inputs, constraints and divergent host requirements are visible.
7. Install/uninstall/version a package without silently executing privileged downloaded code, publishing private drafts or violating source license conditions.

**North star:** Someone draws a beautiful, wildly exaggerated character, places the art exactly as intended, and has it playable in a reliable world in minutes. The same person can later invent entirely new mathematical behavior, pair it with effects on other objects, and offer that combination as a reusable creative package. The artistic language stays theirs; the interoperable substrate makes it live and interact.

---

## Addendum A — Positional truth, living toon worlds, camera-locked moves and safe creative experiments (2026-09-22)

### A1. A real spatial inhabitant with artist-authored 2D appearances

Treat the world's authoritative 3D coordinates, movement, orientation, contact, depth, occlusion and interactions as **positional truth**. The art may be a flat drawing or sprite representing the inhabitant at that position: a 2D visual reality laid over an interactive 3D world. An artist should be able to make a personal, hand-drawn character walk behind a 3D tree, land on a chair, enter a doorway or interact with other 2D/3D inhabitants without building a full modeled character first. The engine tracks actual geometry and chooses how to render the artistic representation.

Offer an optional one-view sprite with camera-facing billboard behavior; two/four/eight directional views (front, back, left, right and diagonals) with distinct artist-provided idle/walk/run/jump/land clips; and later additional elevations/poses or compatible rig-guided interpolations. Select the display view by camera-relative direction while retaining the same world-space entity and physical state. Do not claim eight illustrations provide a continuous 3D body, unseen geometry or perfect viewpoint interpolation. View switching has controllable threshold/hysteresis and pivot/foot-anchor continuity; unsupported view angles use a disclosed nearest-view, fallback, or optional artist-approved interpolation policy.

Make visual/camera motion and simulation distinct: rotating the camera can change visible character art without moving the character's canonical position; a character can move behind scenery, receive shadows when supported and interact with 3D objects using explicit contact rules. The 2D, 2.5D and full-3D representations can share object/action identity, with capability-specific render/behavior adapters and user-controlled degradation on low-end hardware. This is a practical hybrid-animation ambition, not a claim to have invented 2.5D sprites or mixed-media worlds.

### A2. Action-scoped locked viewport and rig-guided hand drawing

For an artist-defined special move, dance, finishing action, transformation, comic reaction or cinematic cut-in, offer an **action-scoped locked view**. The artist selects a specific camera pose, screen-space framing and time range, optionally constrained to an action's active phase. They can block the move with a simple 3D/skeletal rig, choose a pose/timing, then draw *only the frames they want the audience to see from that viewpoint* (over the rig, alongside it, or replacing its rendered appearance). Their original 2D art is the authority for the visible result; the rig is a guide/optional driver, not a mandatory conversion to 3D art.

Support distinct modes: locked **preview viewport** for editing while the player's camera remains free; an optional **in-world presentation lock** for the action/instance; or a clearly declared **cinematic camera cut** with seamless restore after the move. A locked preview must never quietly seize the player camera. If an action requires a fixed view but the player has camera autonomy (e.g. multiplayer/VR/accessibility), permit a non-locking fallback such as a screen-space cut-in, nearest authored view or supported rig render. Explicitly map a locked camera's artwork to entity/world position and depth, so gameplay and collision continue using positional truth during the move, with transitions into and out of the authored pose. Camera lock is a visual rule, not a permission or movement override.

### A3. Minimal-labor “home free” stylized animation

Provide an optional instant visual offering: a simple moving 3D or skeletal figure rendered as a **black silhouette, white silhouette, glowing outline or high-contrast toon**, enhanced by adjustable bloom, trails, ink flashes, auras and impact effects. At chosen key moments, briefly display an artist-uploaded 2D pose or drawn frame over/alongside the rendered rig. The figure underneath provides spatial motion and continuity; the selective flash of illustrations supplies the author's signature style without requiring an entirely hand-drawn sequence for every pose.

Keep this lightweight: primitive/basic rigs and small effect presets first, affordable GPU budgets, low-memory options, an accessible no-bloom/high-contrast fallback and clear preview of the actual device cost. Allow the artist to progressively replace silhouettes with their own views, hand-drawn overlays, partial frame sequences or fully authored animation. The mode is an option, not the compulsory platform look.

### A4. Progressive openness: safe first, rig programming later

A beginner can choose art, place it in the world, drag key positions, lock an editing view or action shot, choose a basic rig or silhouette and see the action work against stable spatial constraints **without writing equations, scripts or code**. Provide named motion curves and toggles later. A technically advanced author may then attach procedural animation, deforming geometry, rig controllers, custom constraint solvers and interaction code through the scoped, validated **Liquid mode** extension surface (subject to host permissions and runtime budgets). Do not make artist-authored rig scripts an initial import or publish requirement.

### A5. Cheap, fast and non-destructive experimentation before committing

Design **Try → Move → Preview/Test → Compare → Refine → Commit** as a first-class authoring loop, not an afterthought. Users should be able to test how their personal artistic style reads under movement, depth, lighting, character/object interaction and different camera angles within minutes, using local scratch scenes, included test rigs/objects and inexpensive default effects. Never require uploading assets to a server or paying for cloud rendering merely to perform an ordinary local preview.

- **Scratch space and test scene:** drag art or a rig into a disposable local stage with a floor, platform, ramp, wall, chair, doorway, light and camera orbit. Move the character and change visual art, directional view mapping, pivots/anchors, hitboxes, animation speed, camera locks and contact effects in place. Replay collision, interaction and movement immediately; expose helpful overlays/warnings but keep them optional.
- **Safety by default:** preserve the original source asset immutable; keep editable working copies, undo/redo, cheap local autosaved draft checkpoints and clearly marked experimental branches/variants. A test must not overwrite the artist's approved asset, corrupt a published package, change a live world, or trigger an unintended public upload. Use sandboxed simulation with no privileged package code or side effects by default.
- **Compare styles rapidly:** A/B preview an artist's own poses against a silhouette/rig-only/fully drawn version; switch between one-view, directional and locked-view solutions; save a named variant with its art, mapping, timing, camera, effect and controller configuration. Permit visual split/alternating playback where affordable. Lower-end machines should have frame/texture/resolution limits and scalable effects, not a mandatory expensive 3D render.
- **Explicit commit boundary:** distinguish **Preview**, **Save draft locally**, **Apply to selected world instance**, **Commit approved asset/version to my library/project**, and **Publish/export/share package**. They are separate actions, with visible change summaries, dependency validation and rollback. A creator can adopt a tested look for one character without changing all linked characters, or deliberately upgrade all compatible instances. Committing is an intentional choice after experimentation, not a condition for trying an idea.
- **Meaningful and reversible feedback:** offer low-cost automated checks for ground/anchor continuity, occlusion, directional switching, camera-lock transitions, effect timing, CPU/GPU budget and package compatibility. When the requested look conflicts with stable gameplay, visualize the conflict and offer explicit alternatives rather than silently reshaping the artwork.

### A6. Package and milestone implications

The package schema should optionally expose available directional views, camera-relative facing rules, rig maps, action-scoped camera requirements/fallbacks, silhouette/effect presets, animation overlay timing, and declared Liquid-mode rig hooks. A recipient can swap a rig, art layer, viewpoint set or effect pack only when compatible, and can preview the result in a scratch scene before committing. Position, object identity, event ordering and permission boundaries remain authoritative.

**Incremental acceptance demonstration:** On a modest laptop, import a creator's two poses of a character; place it on a 3D stage; test walking behind a box and jumping onto a platform with a stable gameplay body; use a simple rig/silhouette during ordinary movement; lock only the editing view for a special move and flash one hand-drawn impact pose; compare two artistic variants; leave the original intact; explicitly commit one tested variant to the local asset library. Then export a package whose view/rig/effect requirements are validated, without publishing or running user code merely because it was previewed.

**Added north star:** SUBSTRATE supplies reliable spatial truth and an inexpensive, reversible creative laboratory. Artists supply as few or as many drawings as they wish, select the viewpoints and presentation that serve their art, and can safely play with rigs, effects and motion before intentionally committing their own distinctive creations.
