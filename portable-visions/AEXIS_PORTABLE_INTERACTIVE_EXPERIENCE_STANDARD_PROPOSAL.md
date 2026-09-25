# ÆXIS: A Portable Interactive Experience Format for the Browser and Beyond

**Status:** Comprehensive vision and architecture proposal; not an implementation or an established industry standard.  
**Shared across:** `thanks-cohn/Tiled-223D` (ÆXIS world/engine), `thanks-cohn/substrate` (creator workspace), and `thanks-cohn/framechute` (browser extension implementation).  
**Proposed file family:** `.aexseq` (human-readable sequence manifest), optionally bundled in a portable experience package with model/audio/effect assets. Names, extensions, and exact schemas remain design decisions, not shipped APIs.

## 1. The proposition: build the feeling, not merely the object

The originating question is childlike, concrete, and ambitious: *What if my spaceship was flying absurdly fast, I cut the engines, glided down, landed on the pavement, bounced on its wheels, and then just drove away? What would that feel like?*

The experience must not amount to a static model, a camera trick, or a scripted cutscene that abruptly teleports from flight to driving. Its pleasure comes from continuity: the player carries forward momentum, approaches terrain, meets the pavement at a particular attitude and velocity, compresses suspension, rebounds, retains control, and continues moving. Camera composition, timing, sound, animation and impact feedback work together so that a creator can express an aesthetic—not only technical correctness.

We propose an intuitive, browser-first experience authoring system and an independent, portable *interactive experience sequence format* that captures that choreography. A newcomer can open the browser, import a GLB ship, try attractive defaults, change a few values, preview the result, export it, and use it in a game. A programmer or AI agent can inspect, generate, modify, validate, and run the same experience using a typed SDK/API. The accessible editor and precise SDK must be two first-class interfaces on one authoritative, versioned core, not separate implementations.

The ship-to-pavement landing is the flagship showcase, **not** the boundary of the format. The same primitives should eventually support people, cars, ships, dragons, robots, flying avatars, combat moves, transformations, music-driven cinematics, narrated moments, interactive set pieces, and new game types devised by creators.

**North star:** maximum breadth, depth, ease of use, and emotional richness per unit of complexity and computation. Offer a delightful working starting point; never require a creator to build every basic camera, motion response, wheel, effect or sound cue before experiencing something enjoyable.

## 2. What existing formats provide—and where this format begins

GLB/glTF already stores geometry, materials, skins, animation channels/keyframes and camera definitions; it can animate camera transforms. We are not inventing keyframes, timelines, cameras, 3D interchange, event-driven animation, or cinematic editors. Existing engines, DCC tools, and media formats already provide important parts of this.

A GLB by itself does **not** standardize our entire interactive contract: gameplay-camera selection and swapping, follow/target semantics, dynamic look-at to world objects, predicted versus actual impact events, custom audio-slot scheduling, driving/flight mode transitions, traction and suspension response, the player's ongoing control, or portable execution of custom Liquid behaviors. glTF supports extensions, but using an optional companion experience manifest is an intentional first design: it can refer to several GLBs, sounds, scripts/behavior graphs and world entities while keeping asset interchange separate from gameplay semantics. Evaluate glTF-compatible extension packaging later when justified.

Proposed stack:

1. **Assets:** standard GLB/glTF for models/rigs/animations; interoperable audio/image assets where possible.
2. **Portable experience specification:** versioned semantic references, timeline/event graph, camera rig definitions, behavior bindings, parameter defaults, declared capabilities and graceful fallbacks.
3. **Reference evaluator and SDK:** deterministic bounded sequencing, validation, events, timing, inspection, and host adapters.
4. **Host game engine:** authoritative physics/collision, actual world state, rendering, audio playback, input and game-specific objects.
5. **ÆXIS browser editor:** an approachable reference authoring experience over the *same* specification and evaluator, not the exclusive way to author it.

A game should be able to support the format without adopting the ÆXIS renderer, workspace, proprietary assets, or a subscription.

## 3. The creator's five-minute experience

A creator opens a browser editor, starts in a functioning sample world, imports a ship GLB or selects a built-in ship, and instantly flies it using supplied movement and cinematic camera defaults. There is a live next-camera preview at the bottom right; they can choose its shot and press `C` to swap the main view and the preview back and forth. They can move from person to car to ship or another avatar type where those forms are supported, keeping each form's own movement/camera identity while reusing shared controls.

The creator enables driving for the ship. Default wheels are attached beneath it based on measured model size and approximate underside; compact wheels for small craft, medium wheels for medium craft, monster wheels for large craft. These are expressive, intentionally recognizable defaults, not a restriction: creators can choose tiny comical wheels on an enormous ship, replace visible wheels with their own models, or conceal them. They can enable **Drag Close to Floor: Yes/No** and adjust hidden-wheel mounting, body height and ride-height parameters while preserving legitimate collision/ground-contact geometry.

They activate gliding and try landing at speed. The machine continues forward with its momentum as gravity pulls it toward the road; the wheels meet terrain, the suspension compresses, the body reacts, sound and camera timing communicate the impact, then it rebounds or settles and transitions to driving. The result should feel dramatic, controllable and repeatable without pretending to be a high-fidelity aerodynamics or crash simulator.

The creator opens a simple visual timeline, tries an alternate camera shot just before impact, swaps a sound, lengthens the hydraulic rebound, and exports an interactive package. A separate developer integrates the SDK into their own browser game, binds the manifest's ship role to their existing entity/GLB, maps required contacts and events, and receives a functional authored animation/camera experience after a small amount of host-specific configuration. Advanced edits remain available through precise programmer and agent APIs.

## 4. Universal cinematic camera families

Each entity type may have its own camera library: a person, car, ship, dragon, or custom avatar need not share identical offsets or shot priorities. Related types can reuse shot rigs. The six initial ship shots are *defaults*, never hardcoded limits. Distances are in feet in the creator-facing specification with an explicit conversion to world units, using a ship-relative coordinate frame: forward toward the nose, right toward starboard, up vertically in the chosen local rig frame.

| Semantic shot | Forward | Right | Up | Initial intent |
| --- | ---: | ---: | ---: | --- |
| Rear Chase | -15 ft | 0 | 0 | centered behind looking at ship |
| Front Portrait | +15 ft | 0 | 0 | centered in front looking back |
| Low Front Fisheye | +10 ft | 0 | slightly below (initial tunable -2 ft suggestion) | from ahead/low, looking back and slightly up, with fisheye treatment |
| High Front Left | +15 ft | -10 ft | +14 ft | elevated front-left view looking down |
| High Front Right | +15 ft | +10 ft | +14 ft | mirrored elevated front-right view |
| Overhead | 0 | 0 | +20 ft | directly overhead, looking down |

All six default to **Look at Ship = true**, while creators may change their look-at target and disable target tracking. Camera position, orientation, target, follow rig, focal point, FOV, projection/fisheye strength, roll, damping, lag, collision avoidance and transitions must be independently configurable. A camera may follow a ship while looking at Earth, a selected world object, a GLB instance/node/attachment, a fixed point, or a custom programmatic resolver; only offer an Earth object when one actually exists in the host's world. Target options appear in a clear dropdown/selector with Yes/No enable semantics; one target is active at a time unless explicit multi-target blending is authored. Distinguish target-selection booleans from a falsely simultaneous set of mutually exclusive looks.

A creator can raise/lower by a relative amount, set an absolute offset, adjust pitch/yaw/roll numerically, choose auto look-at true/false, or set a custom look target via UI, programmer API, or agent API. Stable IDs are independent of human labels. Each initial label uses exactly `Rear Chase (Customizable)`, etc.; changing **any** preset value or mode **replaces** the suffix with `(Modified)`. Restoring all original values/mode restores `(Customizable)`; never append both suffixes. Preserve presets and user changes across saves and runtime view changes.

The bottom-right live preview depicts another camera in the same world, not a static screenshot or second simulation. `C` **swaps** the main and preview views, so a second press swaps them back; choosing which camera to preview is a separate action, not automatic cycling on each swap. Consider low-resolution and lower-cadence preview, quality toggles and disabled-preview mode for a 4 GB target. Camera systems should react to different ground versus flight poses and wheel positions: a huge ship's ground chase shot may need greater distance/height than a tiny ship's.

## 5. Liquid Mode: authored response, not only fixed offsets

Each camera supports **Standard Mode** (ordinary numeric/default controls) and **Liquid Mode** (custom behavior linked to movement and events). When Liquid Mode is selected, hide or blank the normal positioning/orientation sliders in the primary UI, leaving the target dropdown, its Look at Selected Target true/false control, optional object/node selectors and the code/behavior authoring surface. Retain standard-mode data so switching back restores it; entering Liquid changes the label to `(Modified)`.

Liquid may read authorized, typed, bounded entity state—speed, measured acceleration, player acceleration input, turn input, angular velocity, banking/roll, climb/descent, velocity, wheel deployment, suspension travel, first contact, bounce, landing and other exposed events—and map those to camera offset, orbit, pitch/yaw/roll, FOV, fisheye, damping and visual effects. Automatic look-at, when enabled, operates on the resulting position and may take deliberate angle offsets; when disabled, authored orientation owns the view. Do not equate input signals with measured physical accelerations.

This code must not be unrestricted executable JavaScript inside an untrusted shared asset. Define a safe declarative behavior graph or a bounded/capability-scoped execution model, with permission checks, validated outputs, deterministic fixed-tick semantics as needed, resource budgets, error fallbacks and no host/browser/OS access by default. Portable data does not make arbitrary TypeScript/JavaScript automatically runnable in a future C/C++ runtime. Specify common behavior semantics and adapters instead of promising effortless source-code portability.

## 6. Universal wheel and ground adaptation

For an imported ship, estimate bounds, orientation, underside/bottom reference plane, contact hull or multiple ground-contact anchors, mass/collision proxy and approximate mounting points. Provide size-responsive compact/standard/monster wheel presets, replaceable visible wheel GLB assets, independent physical contact-wheel geometry and independently tunable ship-body presentation. Do not assume all arbitrary meshes have a flat usable underside or a center-of-mass at their GLB origin. The creator/agent can inspect and correct the auto-fit; wheel choice is always overrideable.

**Drag Close to Floor: Yes/No** is an explicit authoring option, with adjustable hidden-wheel height and body clearance. It should allow the ship to appear low-slung, even with mostly hidden contact wheels, without letting its collision body tunnel through terrain. Large monster wheels and tiny joke wheels are legitimate aesthetics, not mandatory realism. The visible wheel mesh, the support/contact system, and the ship's cosmetic body reaction are separate but coordinated.

Provide preprogrammed shared hydraulic/suspension response: compression/rebound, terrain-following over hills, roll under cornering, pitch under braking/acceleration, airborne jumps, contact recovery and fall-to-drive transition. A common physics foundation with distinct small/medium/monster visual/handling presets gives the engine a recognizable style that creators can reuse in other vehicles, creatures and game genres. A wheel contact or transition event should expose meaningful measured data for camera, sound, animation and effects. Distinguish actual airborne motion from visual-only bounce; do not fake continuity by snapping velocity to zero on landing.

## 7. Powered flight, gliding, real contact and authored exaggeration

The experience centerpiece is *a ship carrying speed into the pavement*. Gliding stops actively maintaining powered altitude, preserves the existing momentum and lets gravity, any configured aerodynamic lift/drag, attitude control and terrain determine the approach. A wingless ship may use ballistic/arcade gliding; do not claim physically correct aerodynamic lift for every GLB. Allow a forgiving arcade default while making the physical assumptions explicit.

An actual authoritative contact event is produced from the host collision/suspension model, with time, contact points and normals, relative velocity, impact intensity, compression and grounded state. Do not use a purely timed animation as the sole proof of ground contact. Continue horizontal movement as feasible; progressive wheel traction, braking, skidding, steering and suspension determine the driving handoff. Camera, sound, dust, sparks where applicable, visual deformation and optional controller haptics respond to the **same** event and measurements.

Our signature landing should be exciting, badass and intentionally expressive: lowered engine sound in glide, a sense of rising road, wheel extension, collision, hydraulic compression, rebound and satisfying drive-away. The system should let creators exaggerate the *presentation* while keeping collision/physics authoritative and preventing models from visually or physically tunneling through the ground. Support different outcomes for gentle touchdown, very fast landing, tilted touch, bounce, skid and a missed landing.

## 8. Browser-first Impact/Cinematic Sequence Director

Provide a friendly visual editor with synchronized tracks and keyframes for:
- trajectory/glide and ground-reference markers;
- wheel deployment and transformation;
- body rig, suspension, compression and rebound animations;
- physical contact and related telemetry;
- camera shots, live preview selection, transitions and Liquid parameters;
- sound slots, volume, playback/trim duration, fades, replacement files and timing;
- particles/visual effects and optional haptics;
- custom events, conditions, branches and authored reusable behaviors.

A creator can arrange **multiple camera shots before, at and after impact** for a chosen aesthetic, or choose one uninterrupted camera, or leave the camera entirely under player control. Camera takeover and movement takeover are independent opt-in choices: a cinematic shot sequence must not silently remove steering/flight control. Support hard cuts, smooth camera-rig movement, and optional crossfades where performance permits. Existing standard and Liquid camera definitions should remain reusable and editable per shot.

Use a clear impact-relative timeline: `T=0` is actual ground contact for live gameplay, while a fixed scripted sequence may author a predetermined contact timestamp. An event at `-12 s` or `-0.8 s` cannot literally know the future in unrestricted gameplay; schedule before-impact cues against **predicted** contact, with confidence, re-evaluation, cancellation/re-timing rules, and a fallback when the event never occurs. Post-impact tracks anchor to actual contact. Expose deployment, first-wheel contact, peak compression, rebound, settling and drive-away as distinct event anchors. A creator can also position a track arbitrarily in a pre-authored deterministic cinematic.

The ship's *bottom reference plane* and per-wheel contact points are editable and inspectable so a generic GLB can be aligned relative to actual terrain. The author can scrub a representative recorded/simulated contact trajectory in the browser editor, set contact keyframes, move the body relative to its physical rig, adjust bounce amplitude/duration, and replace audio while watching the consequences. Support Blender-authored GLB skeletal/object animations as optional input, but never require Blender to author or edit the experience: the browser must provide the intuitive timeline, preview, and exports.

Sound slots have stable semantic identifiers (e.g., glide.wind, wheels.deploy, landing.impact.primary, hydraulics.compress, hydraulics.rebound, tires.road); assign our custom signature sounds by default, but allow per-slot swaps, custom audio imports, volume, duration, fades, looping, playback speed where supported, time offsets in seconds/ms, and event-condition mapping. Audio identity must not be inseparable from a specific sound file. Mix size-responsive default sound personalities while allowing complete replacement.

## 9. The portable format and package

Propose a versioned `.aexseq` manifest (JSON or another inspectable format) plus an optional archive/container for required assets. An exported *experience* is not only a baked video, a GLB animation, or a browser-only scene save. It contains interoperable intent and host bindings:

- formatVersion, schema URI, stable package/sequence ID, author/license/provenance;
- declared required/optional capabilities and extensions; application/profile compatibility;
- entity roles (`ship`, `ground`, `cameraOwner`, `target`) and stable host binding requirements;
- unit/coordinate frames, bottom plane, collision/attachment and GLB node identifiers where relevant;
- timeline tracks, typed events, conditional branches, absolute or impact-relative time anchors and cancellation rules;
- semantic camera rigs, target registries, transitions, manual/player/cinematic control policies;
- animation references and parameterized suspension/body poses;
- audio and effect asset slots with explicit URLs/paths and timing;
- approved portable behavior graphs or explicitly declared supported code runtime (never hidden arbitrary executable code);
- extension namespaces, deterministic seed/tick policies where relevant, authored defaults, bounds/validation, fallback behavior and graceful unsupported-feature reporting.

Prefer explicit asset references and package-relative paths; do not duplicate large binary GLB data inside an ordinary JSON manifest. Safe asset loading must respect origin, licensing and integrity/size limits. Include migration/versioning policies, authoritative schema validation, and useful diagnostics for missing nodes, worlds, targets, audio files, events and unsupported extensions.

**Illustrative—not standardized—manifest fragment:**

```json
{
  "format": "aexis.experience-sequence",
  "formatVersion": "0.1-proposal",
  "id": "signature-pavement-landing",
  "roles": { "vehicle": "host:vehicle", "ground": "host:terrain" },
  "trigger": { "event": "landing.firstContact", "time": 0 },
  "cameraPolicy": "optional-cinematic",
  "shots": [
    { "camera": "vehicle.rearChase", "time": { "kind": "predictedImpactOffset", "seconds": -3 } },
    { "camera": "vehicle.lowFrontFisheye", "time": { "kind": "predictedImpactOffset", "seconds": -0.8 } },
    { "camera": "vehicle.highFrontLeft", "time": { "kind": "actualImpactOffset", "seconds": 0 } },
    { "camera": "vehicle.rearChase", "time": { "kind": "actualImpactOffset", "seconds": 0.7 } }
  ],
  "soundSlots": [
    { "id": "landing.impact.primary", "asset": "audio/signature-impact.ogg",
      "time": { "kind": "actualImpactOffset", "seconds": 0 } }
  ]
}
```

Keep proprietary creative *content* optional and legally separate from open *format/SDK semantics*. Creators need clear licenses for distribution, remixing, commercial use, and imported GLBs/music.

## 10. Two first-class creation surfaces: intuitive editor and programmer/agent SDK

**The intuitive browser surface:** open/import, select a model, “attach driving,” choose wheels and ground clearance, choose standard shot presets, see live camera preview, press C, enable glide, try landings, place/edit camera/audio/animation blocks on the impact timeline, toggle player-control versus director-control, preview and scrub, export. Progressive disclosure keeps first-time users away from intimidating technical walls; advanced numeric editing and curves remain available. Accessible keyboard controls, undo/redo, templates, readable diagnostics and safe reset matter.

**The programmer SDK:** a small, typed, documented library independent of the ÆXIS editor/renderer. It must load and validate a manifest, report capabilities, discover/bind host object IDs, run a reference sequence evaluator, expose events/telemetry, author or patch tracks/cameras/targets and serialize/export valid packages. Define plugin/adapter interfaces for host scene transforms, physics contacts, asset resolution, renderer camera creation, audio scheduler, input and optional haptics. Do not assume the host hands over its renderer or game loop. Distinguish reference semantics from host-specific physical fidelity. Offer a minimal “add SDK, bind my ship/ground/assets, activate this sequence” tutorial and working example in an **independent** browser game—not only in ÆXIS itself.

**The agent surface:** shared schemas, stable IDs, permissions, inspection, deterministic preview/planning, explicit proposed changes, revision conflict checks, validation, atomic commit/undo and diagnostics where supported. Agent capabilities do not imply unrestricted execution of third-party scripts or unrestricted access to the user's workspace.

Example future usage (conceptual only; do not advertise a shipped package):

```ts
import { ExperiencePlayer } from "@aexis/runtime";
const experience = await ExperiencePlayer.load("/landing.aexseq", {
  adapter: myGameAdapter
});
experience.bind("vehicle", myShip);
experience.bind("ground", myTerrain);
experience.play({ cameraPolicy: "optional-cinematic" });
```

A small integration should produce a functioning *camera + animation + sound + event-responsive play experience*, not merely display a still GLB. Host-specific bindings and actual required capabilities must remain explicit; arbitrary games cannot be made compatible by “one import” without providing entity/physics/render/audio adapters.

## 11. Open standard ambition and governance

The goal is to become a **de facto browser-game creator standard for breadth, depth and ease of use**: game developers should be able to import a common SDK or support a public format, change a few parameters and object bindings, and give players a working library of expressive animations and cinematic experiences. Creators author once and reuse across games; independently built games can exchange compatible sequences. Our browser editor can be the reference authoring experience while our native C/C++ renderer, if built later, can consume the same portable contracts.

This is an **ambition**, not a claim of current industry adoption, uniqueness, universal compatibility or invention of animation/timeline formats. Existing DCC tools, glTF extensions, game cinematic timelines and interchange approaches provide meaningful precedent. We aim to combine these capabilities in a distinctly accessible browser-first, entity/event-linked, engine-agnostic product and to contribute an open, well-documented interoperable format. “First of its kind for browsers” should be framed as an *aspiration for this particular integrated combination*, contingent on research and demonstration, not an unverified categorical historical first.

Publish schemas, normative timing/event semantics, conformance fixtures, a small independent reference runtime, tests, license terms, examples and compatibility profiles. Permit independent implementations without account lock-in or mandatory marketplace use. Keep versioning stable, use a public extension process and evaluate external contributors' needs. A format becomes a de facto standard through useful implementations, reliable portability, attractive content and developer trust—not by naming it a standard.

The commercial layer can offer optional signature models, wheel families, premium animation/effects/sound packages, creator marketplace, hosted workflows and sophisticated authoring services while keeping foundational interoperability available.

## 12. Delivery roadmap: prove portability before claiming a standard

**Phase 0 — Audit and contracts.** Inspect the current Tiled-223D/ÆXIS Three.js viewer and World API, and SUBSTRATE/FrameChute integration boundaries. Read each repo's AGENTS/handoff docs. Identify genuinely available object IDs, input events, GLB anchors, collision, persistence, audio scheduling and extension surfaces. Write a minimal versioned semantic event/track/camera schema and capability manifest; avoid building two implementations of one truth.

**Phase 1 — A dazzling working slice.** Six adjustable ship cameras with semantic `(Customizable)` → `(Modified)` labels, one-authoritative-world live preview bottom-right, C two-way swap, default look-at and targeted selection, one correctly event-anchored landing demo with an independently customizable camera and sound cue. Keep old flight controls intact.

**Phase 2 — Ground adaptation and signature feel.** Automatic wheel selection/fit with editable underside/contact anchors, compact/medium/monster presets, Drag Close to Floor, preserved momentum gliding, authoritative contact, hydraulic compression/rebound, size-aware ground cameras and carefully authored sound slots. Provide a playable browser preview with adjustable performance tiers.

**Phase 3 — Visual director.** Browser timeline for multiple pre/during/post-impact shots, camera transitions, animation/audio/effects tracks, target nodes, predicted/actual event anchors, scrub/rehearse/record, customizable control takeover and export. Import GLB animations from Blender optionally but retain browser-native authoring.

**Phase 4 — Portable package and independent SDK proof.** Export a versioned sequence, validate it, import it into an unrelated minimal Three.js or Babylon.js browser demo *without the ÆXIS editor*, bind a different ship/ground, and reproduce the core camera, animation, audio and impact-relative semantics. Publish the independent SDK adapter interface, docs and conformance tests. This is the first real evidence of interoperability.

**Phase 5 — Creators and wider engines.** Expand avatars, vehicles, game genres and custom target/behavior extensions; publish templates and optional marketplace assets; test independent developers' integration time and editability. Add engine adapters and eventually C/C++ native evaluation only when realistic and measured. Resist feature growth that makes the core format too complicated to adopt.

**Acceptance gates:** actual browser demonstration; no fabricated Earth/GLB placement/native backend; tests for timing prediction vs actual contact, camera swapping, modified labels, stable bindings, invalid objects/nodes, safe Liquid fallback, physical vs cosmetic body offsets, serialization and cross-host reproduction; bounded resource use, with real testing on a 4 GB machine where available. Record limitations honestly; preserve existing user-authored worlds and repository functionality.

## 13. Relationship of the three repositories

- **Tiled-223D / ÆXIS:** primary browser-world prototype, reference camera/landing behavior, format schema/evaluator experiments and independent interoperability demo. Preserve world API, map/elevation, flight and existing handoff boundaries.
- **SUBSTRATE:** long-term accessible creator/workspace host: open, inspect, manipulate, version, collaborate on and export experience packages alongside other digital material, with agent-assisted workflows and explicit permissions. Do not assert these integrations are already implemented.
- **FrameChute:** current browser-extension route into SUBSTRATE, potentially an optional world/sequence editing surface or file/workspace integration; do not force the extension to own the engine or run heavyweight rendering in every tab. Keep the host lightweight and opt-in.

This proposal is intentionally duplicated as the **same shared vision document** in all three repositories, so their roadmaps do not diverge. Individual implementation tasks belong in the owning repository and should refer to the shared contract rather than invent separate formats.

## 14. The destination

We want to give browser creators a working set of cinematic and interactive experiences **from the first minutes**: import their model, swap out a few values or effects, and feel the ship move, glide, land, rebound, and drive; open the visual editor to arrange precisely how it happens; or use the programmer SDK and agent API to build something entirely new. They should not need to become experts in animation pipelines, physics engines, camera systems or our own editor to get started, but nothing about the easy starting path should deny them the power to go deeper.

The aspiration is a browser-first experience toolkit that is **“first of its kind for browsers” in the particular integrated experience we deliver**—not a claim to have invented cinematic timelines, animation formats, or engine interop. The standard we want to earn is not just a file extension; it is a reputation for **breadth, depth, and ease of use**. If a new browser-game developer can use our public format or SDK, bind a few objects, edit a few settings, and immediately have a playable suite of expressive animations and cinematic camera experiences—then expand it without changing engines—we will have created a practical common language for making browser games feel alive.
