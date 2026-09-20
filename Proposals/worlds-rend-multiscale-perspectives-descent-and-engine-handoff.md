# WORLDS (R)END — Multiscale Perspectives, Descent, and Engine Handoff

**Status:** Design proposal / long-term roadmap; not a statement that these capabilities are implemented.  
**Applies to:** SUBSTRATE and FrameChute, including browser/extension and a future desktop application.  
**Companions:** `Proposals/omni-world-engine-neutral-2-5d-worlds-rend.md`, `Proposals/worlds-rend-agent-native-spatial-desktops.md`, `Proposals/semantic-world-engine-agent-native-spatial-ir.md`, and `Proposals/omni-behavior-language-semantic-action-compiler.md`.

## 1. Vision: creator, observer, traveler, inhabitant

The user starts above a little universe: a spatial desktop with independently placed villages, floating islands, ships, rooms, real document windows, and links to workspaces. From this “over-being” viewpoint they can pan, zoom, place/move entire World Blocks, rearrange their desktop, and observe changes in weather, suns, moon, light and shadows. They can choose a town, begin descending as though flying, gradually see streets, buildings and people instead of a tiny tabletop diorama, land as an avatar, and walk into a building. In a compatible world, the presentation can change to an intentionally retro PS1-like low-poly, first-person or third-person experience and then to a distinct room or app. On “Return to World,” the camera rises back to their original overhead perspective. **The same user and same semantic destinations survive the trip.**

This is an original SUBSTRATE experience inspired by miniature inhabited worlds and the feeling of moving between scales, not a requirement to reproduce any particular film, game, or copyrighted environment. First-person exploration, overhead world editing, and regular document work are all optional user-selected modes, not forced replacements for accessible conventional navigation.

The long-term objective is a **world-of-worlds computer**: visitors can enter deliberately published parts of other users’ workspaces, while private applications, files, tabs and local state stay private. The user should be able to enjoy the whole visual journey, shorten it, or teleport instantly to a permitted location.

## 2. Canonical world first: a building remains the same building

SUBSTRATE must own the authoritative scene state independent of Tiled, Phaser, a 3D engine, a browser canvas, a scene screenshot, or any particular skin.

A registered World Block is a portable, independently positioned object with stable ID, parent/local transforms, ground and height geometry, bounds, object identities, assets, optional lights, semantic roles, navigation/collision capabilities, and references to other locations. Multiple blocks can coexist on an expandable canvas; they may be nested where supported (town → building → room → furniture), with controlled transform inheritance and explicit local/world/viewport conversion. Moving a town moves its registered contents while unrelated HTML frames remain independent unless explicitly attached.

An individual building can have:
- one semantic ID and world position;
- a low-cost map marker or silhouette for a distant overview;
- a 2.5D isometric sprite and footprint for the normal desk/world;
- an optional true 3D model, collision volume and entrance for ground-level exploration;
- an associated interior scene, linked ordinary workspace or application;
- an optional entrance transform/portal that explicitly maps the exterior door to the interior location.

Switching perspective must not silently change object identity, permissions, ownership, file references or document bytes. Preserve source provenance and stable mappings on Tiled reimport and renderer transitions.

**A 2D sprite or Tiled map does not reveal the building's unseen 3D surfaces.** A smooth physical fly-down or fully navigable interior requires compatible 3D geometry and authored/generated interior information. When assets are absent, use a truthful fallback: 2.5D zoom, a stylized camera transition, a simplified low-poly proxy, a separate loading/doorway cut, or ordinary direct file navigation. Do not promise a physically continuous transition for every imported asset.

## 3. A first-class perspective and camera contract

Separate the user's **navigation intention** from a renderer's implementation-specific camera. Maintain canonical, versioned state for world/block location, position, orientation (defined units and handedness), target/anchor, desired view mode, zoom or field of view, near/far range where relevant, viewport, current destination, and transition status. Renderer adapters map that state into their own camera conventions; for a 2D isometric view, inverse projection applies only on an identified ground/surface plane, while 3D picking uses a ray/surface intersection or depth-aware method.

Proposed view modes:
1. **Overseer / world map:** broad 2.5D or stylized overview for moving World Blocks, inspecting multiple towns, navigating workspaces and controlling world-level effects.
2. **Approach / descent:** animated camera path from overview toward a chosen entrance or landing zone. Keep the actual destination identity and authoritative world coordinates explicit throughout.
3. **Ground / inhabitant:** close-up third-person or first-person traversal with selected character/navigation controls and a compatible 3D or hybrid renderer.
4. **Interior / focused room:** detailed room or embedded application, possibly a different renderer/scene; linked resources require explicit user authorization.
5. **Return / instant switch:** ascend to a saved overview viewpoint or jump directly to a known desktop/bookmark if animation is disabled or interrupted.

The camera's mode transition should be a small explicit state machine: `overview → preparing → descending → ground → entering → interior`, plus reversible exit/return, cancellation, error and fallback states. The system must save a valid last-known viewpoint and should never strand the user inside an inaccessible or unloaded scene. Support keyboard, pointer, accessible controls, and motion-reduction settings. Free-look and game movement must never hijack PDF text editing or ordinary frame dragging.

An optional high-altitude, miniature round-world or curved-world **visual overview** is a separate future representation. Do not bend canonical flat map geometry just to make the scene look spherical. A real navigable spherical planet requires a declared surface topology, geodesic mapping and navigation/collision/light rules; a cosmetic distant diorama can instead map existing world destinations onto a curved proxy without claiming physical equivalence.

## 4. Engine transitions: one world, replaceable views

The native lightweight renderer owns the everyday 2.5D desk view. Phaser may participate in top-down/isometric game authoring, tilemaps, sprites, animation and some traversal. A dedicated 3D renderer (for example a chosen WebGL/WebGPU-compatible framework in a future phase) may provide the first-person PS1-style town and room. The engine should be selected by supported capabilities and device constraints, not simply because the user zoomed to a numeric threshold.

Design a typed **renderer-adapter contract**:
- declare supported projections, geometry representations, effect capabilities, controls and quality levels;
- prepare/stream scene assets and receive canonical world snapshots/deltas within permission scope;
- map stable world and avatar IDs to backend-local objects; use a single authority for position/collision/state changes;
- accept camera intent, transition progress, light/ambient data, weather/time and semantic interactions;
- report readiness, memory estimates where available, errors, input focus and validated action outcomes;
- suspend, release and dispose backend caches/resources on exit.

A safe handoff sequence is **prepare destination → verify assets and permissions → establish equivalent camera/anchor and entrance → transition presentation → transfer input focus → suspend/dispose the old high-cost scene**. The system must handle cancellation and loss of GPU context or network mid-transition. A short crossfade, stylized flight animation, pre-rendered card, low-poly proxy or obscuring doorway is legitimate where exact cross-engine image continuity is impossible. Keep conventional resource links accessible independently of cinematic traversal.

The HTML document/frame layer remains a regular UI, not converted into uneditable texture inside a game engine by default. At ground level a terminal can link to a normal PDF/DOCX/other supported app, opening it in a legible accessible surface. The application and filesystem permissions remain separate from world navigation.

## 5. Per-world visual language without losing identity

World authors may provide distinct projection, navigation, scale, animation, lighting and interaction policies: isometric sprite village, exaggerated cartoon/fisheye district, retro low-poly spaceship, contemporary office or conventional desktop. A visitor carries stable identity/permissions/relationships and receives a compatible local representation. Switching a character to 3D requires an available 3D asset, deliberate generated proxy, or transparent default avatar; changing metadata alone cannot infer the hidden sides of an arbitrary drawing. World-specific art and gameplay rules may influence performance without giving worlds authority over user security or private documents.

Link entrances to their actual room/desk/app using stable semantic IDs, not screen pixel coordinates. World packages and agents can inspect the permitted scene graph and request typed actions; imported world scripts, filenames, tags and model suggestions are untrusted and cannot silently invoke filesystem or privileged browser APIs.

## 6. Performance as a design requirement, especially for small computers

**Goal:** a low-memory device should remain responsive in the normal desktop and be able to enjoy the overhead town even if it cannot render a rich first-person scene. “Unlimited” means extensible registered world content, **not** unlimited simultaneously active geometry, lights, frames, NPCs or GPU memory. Provide a measured, adaptive quality policy; never promise that any computer can run any world without limits.

### 6.1 Render what is seen, not everything that exists
- Index registered World Blocks by spatial bounds (initially a straightforward visible-region query; introduce spatial hash/quadtree only at scale that warrants it). Store offscreen semantics and persistent references without loading every texture or sprite.
- Frustum/viewport cull entire towns, sub-blocks, decorations and actors; prefetch a bounded halo for smooth camera movement. Use explicit limits on visible tiles, simultaneously active sprites, texture uploads and shadow casters.
- Maintain level of detail (LOD) with **hysteresis** to prevent rapid toggling: distant town = marker/silhouette/impostor, intermediate = reduced tile atlas and simplified proxy geometry, nearby = detailed 2.5D, entered = first-person assets only for the focused region. Offer user-selected distant overview as an *opt-in* and avoid decoding every town at once.
- Use occlusion culling when measurable benefit justifies the cost; interiors should not draw geometry hidden behind walls or belonging to other rooms.

### 6.2 Load in chunks and separate state from visuals
- Keep a sparse, chunked world manifest and source assets: do not allocate a single giant infinite canvas/texture. Use a viewport-bounded drawing surface, camera-relative origin and visible chunk/region loading.
- Load a destination's compact proxy first; asynchronously stream richer textures and meshes only when close or about to enter. Preload likely entrances within a strict configurable memory/time budget; evict distant decoded art and stale scenes with predictable LRU/budget policies.
- Reuse shared spritesheets/tile atlases, immutable asset references, GPU textures and identical town archetypes across World Block instances. Avoid one decoded image/mesh copy per instance. Support indexed/low-poly palettes, texture compression where supported, mipmaps for distant 3D, and precomputed/tiled impostors as appropriate.
- Limit the overhead of asset extraction/import to build/import time. Users of a packaged extension should not need a Tiled install or an image-processing tool just to launch the village.

### 6.3 Keep simulation cheap and local by default
- Drive celestial motion from a deterministic global clock; don't simulate every offscreen sun/moon movement separately per town. Sample authoritative time when the camera arrives or a region becomes relevant.
- Inactive towns keep event summaries and persistent state, not continuous per-frame AI/physics updates. Use sleep/wake, event-driven changes and coarse periodic updates for distant regions; focused visible regions get bounded high-frequency updates.
- Start with predefined character rules/behavior trees and the semantic Book of Behaviors. Optional local/remote LLMs propose infrequent validated intentions; do not run model inference on every animation frame. A shared observation can inform multiple NPCs without duplicate requests. No local model should be required to render or open documents.
- When changing views, pause/suspend unneeded renderer loops, physics and NPC presentation. Do not leave two heavyweight engines simulating the same world indefinitely.

### 6.4 Make lighting scale across many towns and suns
- Suns/moon are canonical logical entities; prioritize only lights that actually influence the active view. Apply lighting with a bounded visible-region budget and shared logical sun state rather than calculating full shadow maps for all towns.
- Default cheap ambient/directional shading, approximated ground-projected shadows, shared sun vectors and baked static scenery lighting/impostors where appropriate. Update dynamic shadow casters primarily when the light, caster or receiver meaningfully changes; quantize or throttle slowly changing celestial updates.
- In a 3D entered scene, cap live shadowed light count, shadow map resolution and draw distance according to device profile. Remaining lights can contribute cheaper ambient/diffuse approximations or unshadowed effects; a moon need not cast expensive real-time shadows everywhere.
- Ground/background lighting must not alter the legibility, layout or saved colors of normal PDF/DOCX frames unless the user deliberately enables a reversible immersive presentation mode.

### 6.5 Adaptive frame pacing, memory and failure recovery
- Detect or conservatively estimate available quality tier from observed frame timing, effective pixel ratio, renderer/resource allocation success and user settings. Device-memory APIs are incomplete/unavailable in some contexts; **do not use a reported RAM number as the sole capability test**.
- Offer explicit Low / Balanced / High / Custom / No-world settings. Low profile: lower render resolution/DPR, shorter draw distance, fewer active objects and lights, inexpensive shadows, fewer animations, simplified textures and fast non-animated transitions. Automatically downgrade after sustained poor frame pacing or memory/resource failure; allow manual override within safe limits.
- Use frame budgets, requestAnimationFrame only for active visual work, capped animation/physics update rates, batching/instancing/object pooling where compatible, and workers for suitable pure CPU computation without attempting unsupported off-main-thread DOM access. Avoid expensive uploads or garbage-heavy allocations every frame.
- Suspend rendering when the app/tab is hidden or the world is disabled; release inactive GPU resources and revoke temporary asset URLs when no longer needed. Handle WebGL/WebGPU context loss by disposing/recreating renderer resources and falling back to native 2.5D or a plain ordinary desktop.
- Keep a safe transactional handoff: do not unload the current view until the destination is renderable, and preserve a keyboard-accessible **Return to Desktop** escape path on errors. The private document editor should stay responsive even when world effects fail.
- Bound caches (decoded images, meshes, shadows, NPC presentation, terrain chunks, model responses) explicitly; observe real peak memory and frame-time regressions rather than claiming “small devices won't crash.” A resource-heavy 3D world may require a reduced fallback or may remain unsupported on some hardware.

## 7. Security, privacy and user agency

Entering a room, visiting a friend's world or watching a terminal does not authorize access to that person's private files, browser tabs or workspace. A published visitor scene is explicitly permission-filtered, and linked work/app content is shared separately. Do not stream the full private desktop as a shortcut for first-person rendering. Visitors get only allowed semantic state, assets and authorized document previews.

Keep local-first/offline behavior; no remote LLM or multiplayer service is required for overhead editing or ordinary files. Let the user choose a direct destination shortcut, skip flight/camera animations, lock the overview camera, reduce motion, turn off the village entirely, and recover their view after renderer failure. For an assistant/agent, expose accurate structured world/camera/scene state instead of demanding access to screen pixels.

## 8. A staged proof instead of one enormous first-person PR

**Phase A — today's foundation:** one visible, movable Kenney Sketch Town beneath HTML frames; actual canonical coordinates and imported editable map; optional one controllable sun/shadows; bounded viewport rendering and safe fallbacks. This is the current direction of the unmerged Omni World work, not evidence that all items are complete.

**Phase B — multiple towns and the sky:** several World Blocks sharing assets across a large sparse canvas; spatial visibility/LOD; one deterministic clock; multiple logical suns and a moon, with cheap active-region lighting. No full 3D requirement.

**Phase C — perspective proof:** choose a single town hall or laboratory with explicitly authored **minimal** low-poly exterior, one doorway and one small room. Implement overview → approach → ground/interior → return as a camera/renderer transition prototype. Use an intentional crossfade/occlusion cut if exact continuous descent is not supported by source geometry. Preserve world/building/room identity and direct link fallback.

**Phase D — scalable multi-view runtime:** adapter capability negotiation, background/foreground renderer lifecycle, chunked streaming, GPU/memory budgets, additional compatible 2D/3D scenes, automatic quality fallback. Measure on a modest device.

**Phase E — creators, worlds and visitors:** authorable entrances/interiors, Tiled-to-world data and optional compatible 3D models, safe creator-made style packages, semantic avatar representations, agent-visible world APIs and explicitly published visitor spaces with access controls. More sophisticated NPCs/LLMs remain optional.

### Acceptance criteria for a first perspective prototype

1. The user begins with a usable overhead world and a normal editable PDF. The 2.5D village is not a static fullscreen wallpaper.
2. Selecting a known entrance starts a cancellable descent with a coherent camera target. The engine reports when required 3D resources are ready; a missing model falls back rather than falsely presenting the original sprite as full 3D.
3. In first person, the chosen building and room keep stable canonical identities, and a terminal can open only an explicitly authorized document in a normal readable/editable surface.
4. “Return to World,” instant-switch and reduced-motion controls recover the prior overview position with no document loss; interruption and GPU failure also restore a safe workspace.
5. The normal 2.5D workspace works with 3D disabled; switching modes releases idle heavy assets/loops and never forces an external engine or model on ordinary users.
6. Tests cover coordinate/camera conversion, doorway mapping, identity and permission continuity, missing assets, interrupted transitions, viewport/culling, scene disposal, and saved overview state. Record actual visual/frame-time/peak-resource observations on at least one low-end test device; do not claim universal crash-proof performance.

**Guiding principle:** One authoritative spatial computer, many optional ways to look at it and live in it. The over-being can descend into their creation and rise again; the person who simply wants to read or edit a document should always be able to do that immediately, even on a small computer.
