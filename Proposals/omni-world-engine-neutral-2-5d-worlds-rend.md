# SUBSTRATE Proposal: WORLDS (R)END — The Omni World
## Engine-neutral 2.5D spatial computing, environmental simulation, and playable desktops

**Status:** Consolidated long-term proposal; implementation is phased and not implied to exist yet.  
**Repositories:** SUBSTRATE and FrameChute, in `Proposals/`.  
**Name:** **(R)END means render**: render one semantic world in many forms. The name is aspirational, not a claim that the project currently implements a game engine.  
**Related proposals:** `Proposals/worlds-rend-agent-native-spatial-desktops.md`, `Proposals/living-computing-archive-and-interchangeable-frames.md`, and `Proposals/semantic-world-engine-agent-native-spatial-ir.md`.

## 1. The guiding idea

SUBSTRATE already has movable, skinnable application frames containing real PDFs, DOCX documents, images, media, and other work. Think of these frames as the first independent little objects or “spheres” in a much larger environment. Build a world beneath and around them: a persistent, spatial desktop with its own geometry, surface, lights, camera, identity, and semantics. The default *world presentation* can look like a tilted, isometric/oblique 2.5D village or diorama, not a featureless, flat top-down rectangle. The default *computing experience* remains functional and readable.

A user can open SUBSTRATE and find their chosen little 2.5D village **already present as their desktop**, beneath ordinary working frames; they should not have to launch a separate game just to see it. Other users can choose a flat conventional desktop, Macintosh/Atari-inspired environment, a spaceship, a stylized cartoon world, or no world effects at all. Their documents are still real documents.

The long-term aim is **the Omni World**: a semantic spatial computing system that can be rendered, edited, simulated, and interacted with by different software ecosystems, rendering engines, game builders, local/remote models, and authorized agents. Phaser is the first planned **game/tooling integration**, not the owner of the world. A future 3D renderer or specialized game engine should be able to participate without changing the user's underlying file references, desktop IDs, geometry, or permissions.

A location can represent a real document, app, folder, or desktop; a user can also play as an RPG character, walk or fly there, interact, and launch that resource. The same resource must also be available through ordinary non-game navigation. Playful sequences and puzzle gates may be user-selected experiences but must never be the only way to recover or access important user files.

## 2. The invariant: meaning, simulation, presentation, and app data are separate

Maintain explicit, versioned boundaries for:

1. **SUBSTRATE application core:** canonical frame identity and geometry; file handles, permissions, document models, export, working copies, editing, persistence, and normal UI controls.
2. **Omni World model:** stable semantic identities; planes, surfaces, objects, lights, desktops, locations, geometry, elevation, parent relations, interactions, and world events.
3. **Simulation:** deterministic projections, light/occlusion calculations, movement, navigation constraints, environmental state, character state, and validated actions.
4. **Projection and camera:** mapping between 3D logical world positions, 2.5D/flat/3D presentations, browser viewport, and local application coordinates.
5. **Renderers and skins:** native low-cost drawing initially; later Phaser, 3D engines, user skins, and effect-specific backends.
6. **Semantic intelligence:** local rule/behavior selection, optional compact learned models, optional remote vision/LLMs and complex simulation, all expressing intentions through the same checked action vocabulary.

No game-engine sprite, DOM node, file icon, texture, image caption, or CSS class becomes the authoritative identity of a world object. Multiple renderers should interpret the same object state, though not all renderer-specific effects need to be portable. HTML document frames remain normal editing surfaces unless a user explicitly selects an immersive presentation.

## 3. The first real object: a configurable world plane, not a mandatory “Phaser floor”

Establish a native **world plane/surface registry**. The initial object is a horizontal ground surface with a stable ID, origin, normal, material/presentation reference, walkability metadata where appropriate, and logical bounds that may be unbounded. Do not allocate a literally infinite DOM element or texture. Use finite visible chunks, culling, camera-relative rendering, and optional floating-origin strategies when needed.

Canonical logical coordinates: choose and document a single convention (for example X/Y on the ground and Z for elevation, ground Z=0), units, handedness, and transformations. The historical browser-frame coordinates are in screen/workspace pixel space; keep them authoritative for ordinary editing and define a **stable mapping or proxy** into world space. Do not silently rewrite saved frame coordinates. CSS stacking order is not virtual elevation.

The surface is a configurable geometric object, **not a permanent hardcoded 2.5D display mode**. User/world preferences can select:
- tilted/isometric or oblique **2.5D default** with a visibly spatial ground;
- flat/top-down and conventional desktop presentations;
- alternate projection angles and stylized dioramas;
- future elevated platforms, multiple planes, curved surfaces, floating islands, or genuine 3D scenes.

Implement reversible world-to-projection-to-viewport transforms with documented inverse mapping or ray/surface intersection where an inverse is not unique. Keep pointer hit-testing, navigation, geometry, lighting, frame proxies, and agent APIs consistent with whichever projection is active. A flat mode is a choice, not an indication that the logical world loses Z/elevation.

The floor/canvas owns separate, scoped CSS, tokens, texture/tile presentation, decorative layers, and skin settings. Individual frame skins and their global/category/frame override hierarchy remain independent. The canvas skin cannot overwrite PDF text, DOCX formatting, or application-local geometry.

## 4. World lighting and physical/visual shadow contract

Implement a renderer-neutral light registry: ambient light and at least one directional “sun” first; future point lights, spotlights, colored/moving sources, lights attached to vehicles/objects, multiple sources, and different light presentation strategies. Each source has a stable ID and explicit type, parameters, enabled state, and coordinate conventions. Provide sane numerical limits and reject malformed or non-finite inputs.

A participating world object has distinct capabilities and geometry:
- `castsWorldShadow` and `receivesWorldLighting`, independently configurable;
- world transform, footprint/bounds, virtual elevation, and optional silhouette/mesh;
- material/visual style and semantic references;
- optional collision/occlusion role independent from decorative shading.

First demonstration: an ordinary HTML PDF frame is represented **only as a lightweight world-space rectangular caster** and projects a mathematically consistent shadow onto the tilted ground as it moves/resizes, or as sun direction or virtual elevation changes. The actual PDF remains normal and editable. Separate world-shadow geometry calculations from Canvas/SVG/Phaser/3D-specific shadow drawing. Treat frame footprint, projected shadow polygon, and cosmetic CSS box-shadow as distinct concepts. If a frame is fixed to the viewport, explicitly define whether it is excluded from ground casting or linked to a separate, stable world proxy; do not invent a drifting shadow.

For a 2.5D projection, shadow calculations belong to the logical ground/light geometry and are projected for drawing. Later, elevated islands and frame proxies may cast shadows onto villages; villagers can perceive entering shade. Occlusion and object-to-object shadow receiving may be approximated at low detail, with richer geometry used only when available.

**Readability default:** application frames can cast world shadows but do **not** receive environmental lighting by default. Optional user-selected modes: Standard (frame completely readable); Decorative (lighting on window chrome only); Immersive (reversible presentation effect over the entire frame). Never change PDF/DOCX source colors, editing layout, export bytes, text masks, or stored data to simulate lighting. Provide per-world and per-frame/category preferences and a plain/no-effects setting. Focused editing should always offer a stable readable view.

## 5. Uploads, geometry, shadows, and user-authored assets

Users may import their own little cars, turtles, RPG characters, 2D/animated sprites, scenery, and eventually 3D models. Import must be accessible, with sensible automatic defaults, low processing cost for simple assets, and optional precise calibration.

Provide levels of shadow quality appropriate to data:
- flat primitive/contact shadow for a simple square or low-end mode;
- alpha/silhouette-derived, optionally pixel-aligned projected shadow for transparent 2D sprites;
- richer per-frame silhouette, explicit contact point, approximate height/depth mask, and user-adjustable light response for detailed 2.5D sprites;
- actual mesh/geometry-based shadow mapping for compatible 3D models.

A single PNG's alpha silhouette does **not** establish true hidden 3D geometry; do not claim physically accurate arbitrary-angle shadows from it. Cache masks and geometry once, reuse for animation, and update only relevant transforms and light state. Keep crisp pixel art crisp when requested, and allow stylized rather than photorealistic shadow policies.

A user-facing calibration panel can adjust ground-contact point, perceived height, scale, geometry proxy, sprite frame metadata, and shadow style. Persist this in a versioned asset manifest; make it inspectable and editable through authorized structured APIs. Do not execute arbitrary scripts embedded in imported art or skin packages.

## 6. Renderers and Phaser interoperability: SUBSTRATE owns the world

Start with the smallest native renderer needed to **show the world is real**: an angled projected ground, a light, and a frame's geometrically projected shadow. SVG or Canvas 2D can serve the first proof if integration with existing scrolling, viewport expansion, and HTML editor input remains safe. Avoid a mandatory game-engine package just to render the starter floor.

Specify an **engine-neutral world/renderer contract**: read scene snapshots and change sets; convert camera and world coordinates; inspect lights and geometry; register a display object against a canonical semantic world ID; subscribe to bounded events; request validated object/action updates; dispose resources. Define capabilities and fallbacks rather than pretending all renderers support every shader, physics behavior, or 3D geometry.

**Phaser is the planned first major creative ecosystem and world-building bridge.** Community creators should be able to use Phaser's tilemaps, animations, character movement, collisions, scene authoring, and programmatic tools to *edit and populate SUBSTRATE's own projected world*. They should not be confined to a disconnected Phaser game rectangle. A Phaser adapter maps sprite/scene objects, tiles, interactions, and lighting to canonical world IDs and geometry while the shared core owns identity, desktop/file links, permissions, and authoritative persistence. Phaser may maintain local rendering/gameplay caches, but must not silently overwrite world positions in competing state stores. Document who is authoritative for each mutable property and how updates reconcile.

Consider imports from tools such as Tiled via a documented map/asset adapter, without making a specific external file format mandatory. Later alternate backends can support flatter worlds, cartoony fisheye/warp presentation, or PS1-like low-poly 3D sequences. The same file/desktop link remains resolvable after switching renderers. A richer engine may choose its own projection but must map back to the semantic world and maintain accurate interactive targeting.

For third-party packages: locally bundle only code needed for the user-selected capability; isolate untrusted world logic, validate assets, restrict capabilities/permissions, and never expose unrestricted native file access or extension APIs. Do not equate extension store approval with lightweight download size.

## 7. Persistent spatial desktops, clusters, and destinations

An Omni World is also a working desktop, not just a game the user launches. The user may opt for their chosen village or spaceship to appear automatically under their open frames at startup, with a persisted camera/home state. A plain workspace and graceful renderer failure fallback are always available.

Keep distinct stable objects for world, desktop, cluster, destination/bookmark, frame, decoration, and saved snapshot. A cluster may receive a generated opaque ID and optional friendly name. A desktop can be the **seed of a separately navigable ever-expanding canvas**, with an anchored home region but freely expandable surrounding space.

Extend existing snapshot semantics with **Make This a Desktop** or **Establish Desktop Here**. Store a destination identity, location, chosen representation, relevant frame/snapshot references, and anchor preferences without cloning the actual document bytes. Before switching separately restored workspaces, checkpoint unsaved changes and preserve a recovery route. Removing a desktop navigation marker does not delete the user's underlying files.

Support right-click **Return to Desktop**, **Switch Desktop**, and **Open World Map**, as well as search/keyboard navigation. These must use the same canonical camera and destination interface as spatial pan, mascot grab-to-pan, walking, driving, and flying. Players who find travel boring can anchor their destinations and use only the right-click menu. Never force travel animations to open their own files.

World map themes may resemble whimsical SNES-style overworlds, technical/Metroid-like schematics, retro computing UIs, or original sci-fi presentations; use original or appropriately licensed art. A turtle-like companion can be a tiny replaceable navigation handle that solves the current need to grab a window to expand/pan. It must not steal input from PDF selection, frame drag, resize, text editing, or the mouse wheel.

## 8. From playable desktop to floating worlds

Users may drop in or select an RPG avatar and **control it within their actual desktop-world**, with explicit Play/Work focus modes so movement keys do not hijack document editing. Entering a building, landing at a location, approaching a terminal, or clicking a virtual sign can request a permitted action: open a file, folder, image gallery, playlist, editor, app, saved search, or another desktop. Represent these as **virtual links/references**, not copies of all resources.

An environment may be a village, a spaceship, a floating micro-world, an archive island, or a stylized office. Floating islands have world ID, position/elevation, geometry/shadow policy, entrances, linked resources, and optional orbit/drift behavior. They can cast shadows on the ground below; multiple light sources and nearby NPCs may respond. Airships or cars can navigate to them through the same destinations API.

Later, a user may choose a small RPG sequence or low-poly PS1-like 3D adventure on the way to a location; make these optional route/presentation packages. A 3D renderer is not a prerequisite for the initial 2.5D foundation. Maintain an immediate, accessible non-game way to open permitted resources and recover files.

## 9. Reactive worlds: environment → perception → intelligence → validated action

The novelty is not a static sprite reaction list alone. A world can respond **from a character's own perspective** to the user's actions and the visual/semantic contents of authorized files.

Event examples: the user opens a huge PDF above a marketplace; an elevated window blocks the sun; a floating island moves overhead; an image of a dragon is opened; the player enters a lab; a light changes color. World geometry determines actual coverage, line-of-sight, reachability, shadows, and exposed surfaces. A character's perception layer derives what that specific NPC can see, hear, or infer, using its own memory/knowledge rather than omniscient document access.

**Semantic bridge:** combine trusted scene metadata, user tags, structured file metadata when present, and (only with permission) visual interpretation of a relevant image or bounded capture. A vision-capable model can generate a concise description when tags are absent or inadequate. Image content tags/descriptions are *untrusted data*, never executable instructions; distinguish detection from inference and preserve uncertainty. Cache image descriptions by appropriate content identity, subject to consent and changes; do not repeatedly send an image for every villager.

A character reasoner (deterministic, small local model, or authorized remote model) receives: limited character-perspective observations, goals/personality, relevant memories, current physical opportunities, and an allowed action vocabulary. It proposes structured intentions/actions (move, observe, speak, gather, flee, build virtual stall, inspect shadow, interact with landmark). **The engine** validates navigation, spatial reachability, roles, capabilities, event freshness, and permission; the renderer executes supported animations, speech, and effects. The model does not invent authoritative coordinates, execute arbitrary JS, or directly edit user files.

Illustrative scene: a frame shades the marketplace. Geometry reports the shaded area; villagers perceive it; a merchant chooses to move a virtual stall and sell lemonade, a guard investigates, and an astronomer studies the giant object. Later, opening an authorized tagged image of a dragon can produce different reactions for the merchant, guard, and librarian according to their perceptions, without a hand-written script for every possible picture. Reactions may be amusing or visually beautiful; offer Quiet Mode, rate limiting, and respectful interruption policy.

## 10. Offline learned behavior and optional remote intelligence

Target low-end devices, including the user's desired class of modest laptops. A world must remain useful and charming without internet, a large model, a powerful GPU, or a continuous expensive game simulation.

Local offline NPCs may begin with deterministic rules, utility/behavior trees, and a small curated action library, and later use a compact **trained** behavior-selection model. Do not mislabel hardcoded rules as a learned model. A future trained model learns from structured event → character/context → available action examples. Movement, collision, shadow projection, and permissions stay deterministic; keep compact model inference off hot rendering paths.

With explicit user enablement, remote computation may add image recognition, richer LLM conversation, planning, complex NPC economies, persistent memories, world generation, and other expensive reasoning. Connecting does **not** replace a character's identity or reset its authoritative state. Both local and remote reasoners return proposals through the same semantic action schema and validator. Disconnection falls back to lightweight behavior; optionally cache curated, validated high-level behavior templates for offline use. Never permit arbitrary remote output to overwrite executable game code or user documents.

Split **simulation cost** from **rendering cost**: offloading thought does not eliminate local sprite/terrain/GPU workload. Locally render only nearby objects, use sprite sheets/tile culling, bounded lighting, and event-driven updates; send relevant structured world-state deltas rather than continuous desktop video when possible. Optional remote rendering for demanding 3D scenes is a separate future capability with bandwidth, latency, privacy, and cost tradeoffs.

The remote system receives only user-authorized world metadata/captures, not indiscriminate PDF bytes, background screenshots, private tabs, or sensitive file contents. Honor locked workspaces, token scope, access revocation, and disabled remote modes. The desktop, file explorer, and document editor should remain responsive if the remote service is slow or unavailable.

## 11. Agent-native Omni World and the semantic effect language

Codex and future authorized agents should be able to inspect, create, reason about, and modify permitted worlds using a **typed, versioned semantic schema**, not by reverse-engineering rendered pixels.

Expose scoped operations and records for world/desktop/cluster IDs; surface, geometry, world position, elevation, bounds, proxy provenance; projection and camera transforms; light sources; shadow coverage/polygons; NPC identity and limited perception; semantic roles and virtual link targets; renderer capabilities; events, proposed/accepted/rejected actions, and trace provenance. Distinguish logical state from a temporary visual effect. Provide optional bounded viewport/region screenshots with associated camera/visible-object metadata for actual visual QA, not as the source of truth.

Define a **semantic effect language** for camera exaggeration, fisheye perspective, heroic scaling, squash-and-stretch, “power-up” warps, lighting mood, and optional cartoon effects. A light renderer may approximate an effect; a 3D engine may use shaders or perspective cameras. Logical object bounds, physical collision, and document-local editing geometry change **only if the requested action explicitly authorizes a physical-state change**. Focus mode should restore legible, accurately hit-tested document content. Preserve clear renderer capability reporting and structured failure/fallback.

Community world packages should declare assets, object semantics, link intents, compatible backends, required capabilities/permissions, and bounded simulation behavior. Agents and engines may request modifications only through permission-checked APIs. Treat all model outputs, metadata, package code, and remote instructions as untrusted until validated; never allow a scene to silently become a generic filesystem or execution bridge.

## 12. Distribution and business positioning

Provide a **lightweight, genuinely useful optional world experience** in the browser extension, including a visually appealing desktop-zone/world presentation, document editors, small offline behavior, and an easy off switch. It can show a little village at launch if the user chose that desktop. A richer full experience and a paid standalone SUBSTRATE Desktop may offer native filesystem integration, more assets, more extensive worlds, powerful rendering and secure-workspace options, optional connected intelligence, and user/community builders.

Architect lightweight runtime modules so ordinary PDF users do not load a large game engine, big models, or entire distant worlds. Phaser can be optional and locally packaged where extension policy requires; do not depend on remote executable code or assume that an oversized/off-store extension can bypass browser security or distribution requirements. A desktop app is the natural home for deeper native integrations.

The free version should be useful on its own, not a deliberately broken advertisement. World graphics must remain optional so users with limited RAM or accessibility needs can still use documents and files.

## 13. Concrete phased execution

**Phase 0 — baseline audit and safeguards.** Inspect merged frame skin architecture, actual workspace/camera/persistence, PDF/DOCX geometry, expansion/recentering issues, browser packaging and permissions. Establish regression baselines.

**Phase 1 — native Omni World foundation (next Codex milestone).** Build a togglable **tilted 2.5D projected plane** under existing frames with explicit camera/world/screen transforms; ambient plus directional sun; deterministic rectangular frame proxy and projected world shadow; independent floor/skin and light registries; optional automatically restored selected-world desktop presentation; read-only agent inspection. Default frame lighting OFF, documents untouched. Offer ordinary flat/no-world fallback. Do not make Phaser mandatory in this milestone. Ensure a visible working proof, not just abstract schema.

**Phase 2 — Phaser interoperability proof.** Pin and bundle a compatible engine only when needed, preserve license and extension CSP, write adapter and a tiny scene/world-building sample: create/place one character or landmark through Phaser and synchronize it to the *existing* canonical projected plane and light state. Validate exact coordinate/identity round trips and no duplicated authority. Document builder APIs.

**Phase 3 — useful spatial desktops.** Named homes and clusters, snapshots → desktops, context-menu instant switching, pinned locations, file/app links, optional turtle grab navigation, small world-map representation and persistent startup preferences.

**Phase 4 — first inhabited world.** A small licensed/original village or spaceship area, one user-controlled character, several interactive locations linked to permitted actual apps/files, stylized frame/shadow responses, local scripted NPCs, and quiet/low-resource modes. Full document editing stays HTML and independent.

**Phase 5 — semantic characters and connected intelligence.** Typed perception events, opt-in image tags/vision, learned compact offline behavior only after training/evaluation, optional remote model reasoning with audited structured actions, character memory and consistent fallback.

**Phase 6 — advanced worlds and creators.** User-authored tilemaps, sprite and 3D asset calibration, floating islands and multiple lights, interchangeable renderers, cartoon distortion/effect language, PS1-like 3D sequences, safe community builder packages, richer optional remote simulation.

Do not fold all phases into one PR; preserve reviewable modules, tests, and explicit stop conditions.

## 14. First-milestone acceptance and regressions

A user opens SUBSTRATE with an optional 2.5D world selected and sees a **visibly tilted ground beneath existing functional document windows**, not a fake flat wallpaper or a standalone game tab. They open a PDF and move/resize it; its proxy casts an appropriately projected ground shadow that changes with light direction and virtual elevation. The PDF text and controls remain normal and readable. Users can disable world presentation and retain the existing canvas. The system neither requires Phaser nor a remote server to open the PDF.

Tests should cover projection/inverse or ray mapping; positive and negative world positions; expansion/pan and coordinate preservation; frame resize/maximize/fixed behavior; shadow geometry under movement/lighting/elevation changes; invalid geometry; disabled shadows and lighting; world skin isolation; visual input hit-testing; snapshot/backward compatibility; renderer failure; default frame readability; agent inspection without document leakage; event-driven/static-scene CPU use. Actually run browser-level interaction/visual checks where available and report unperformed checks plainly.

**Final principle:** The Omni World is SUBSTRATE's own lightweight, semantic, independently rendered spatial desktop. Engines such as Phaser are invited to build and play in it; models may help its inhabitants understand it; none of them should take away the user's ordinary, reliable computer.
