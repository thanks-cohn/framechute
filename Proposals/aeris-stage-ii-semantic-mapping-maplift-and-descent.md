# Proposal: SUBSTRATE AERIS — Stage II: Semantic Mapping, Maplift, Descent & NEA

**Status:** Product and architecture proposal; these capabilities are not asserted to be implemented.
**Repositories:** `thanks-cohn/framechute` and `thanks-cohn/substrate`.
**Names:** SUBSTRATE = platform; AERIS = proposed world engine; AERIS Semantic Mapping (ASM) = open authoring standard; Maplift = semantic 2D-to-3D aerial generation; AERIS Descent = atmospheric arrival and renderer handoff; **NEA** = the original signature four-wing descending ship; NOVA = potential later evolution, not a Stage II prerequisite.
**Companions:** `little-globe-descent-into-living-world.md`, `worlds-rend-multiscale-perspectives-descent-and-engine-handoff.md`, `semantic-world-engine-agent-native-spatial-ir.md`, `omni-world-engine-neutral-2-5d-worlds-rend.md`, `omni-behavior-language-semantic-action-compiler.md`, and `cubecosm-one-click-web-game-publishing.md`.

## 1. North star

**Describe a world → any compatible agent can correctly build/edit an ordinary Tiled map → Maplift converts its *meaning* into a lightweight aerial 3D world → AERIS Descent carries the player from space through clouds toward a chosen destination → land in the same world in 2D RPG, 2.5D or 3D form.**

Stage I's little globe/space navigation remains the entry point; Stage II gives its destinations a coherent, inhabitable world. The signature default must be visually premium and emotionally memorable without making a full-detail planet or high-end GPU mandatory. A creator's 2D map stays editable; world identity, object IDs, resources, spatial relationships and permissions stay stable between aerial and ground-level renderers. The SUBSTRATE semantic world model, not a Tiled screenshot or one engine's scene graph, is the long-term canonical cross-renderer representation.

Creators can use this to make role-playing games, exploration spaces, aircraft adventures, social worlds, dioramas, or entirely different experiences by changing assets, logic, renderers and world rules. Ship an unusually polished default, but do not hard-code the default ship, gameplay mode, or aesthetics into the architecture.

## 2. Keep three technologies distinct

### 2.1 AERIS Semantic Mapping (ASM): open, agent-agnostic Tiled authoring

This is **not** a proprietary chat assistant or a single-model Tiled plugin. Define an openly documented, versioned contract that any *authorized* local or remote AI agent, traditional script, or human-facing tool can use to reason about and edit maps deterministically.

- **Discover:** map version, dimensions, tile size, map orientation, coordinate spaces, layer roles, selections, protected regions, existing landmarks/objects and stable IDs; available tilesets with actual IDs and semantic roles.
- **Semantic tileset catalog:** declare terrain/material type, variants, rotations, footprints, collision/walkability, adjacency/autotiling rules, transitions, optional elevation/height, object anchors, valid interactions, 3D asset or proxy mappings and missing-data flags. Do not equate visual resemblance with known tile semantics.
- **Agent operations:** `inspect_map`, `list_semantic_tiles`, `query_region`, `plan_patch`, `preview_patch`, `validate_patch`, `apply_patch`, `undo_patch`, `export_world` (illustrative names, to be specified). Write **bounded structured patches**, never unreviewable full-map replacements by default.
- **Spatial rules:** unambiguous units and grid/world coordinate transforms; named north/south/east/west; occupancy; coast/river/road connections; bridge crossing; pathfinding/accessibility; safe landing-site footprint and approach corridor; protected and locked areas.
- **Validation:** enforce map revision checks, semantic tile availability, terrain/road adjacency, bounds, collision and crossing rules, object references, stable IDs, selection limits and creator-authored constraints. Return intelligible conflicts and missing-information errors rather than guessing.
- **Safe editing:** preview exact changes, apply as one undoable transaction, preserve unrelated manual edits, retain provenance, permit selective rollback and ordinary Tiled editing at any point.
- **Portability:** keep normal Tiled TMX/JSON and tilesets usable; store versioned ASM manifests/properties in compatible files or sidecars; publish schema, fixtures, examples, migrations and conformance tests so independent agents implement the same rules.

Example: “Place a coastal village west of the river; connect a northbound road, and put a landing zone on a hill overlooking the town.” The agent first reads the *actual* map and tileset catalog, prepares a structured regional patch and checks road connections, river crossings, local elevation and landing clearance. Another compatible agent should be able to read and edit the result.

### 2.2 Tiled integration: the editor is a host, not the standard

Make an AERIS-for-Tiled extension for map/tileset discovery, semantic properties, selection, preview/validation and undoable edits. Add an optional, permission-scoped local bridge/companion so **any** compatible AI agent can invoke the same versioned operations; a future MCP adapter may expose these tools without making the standard depend on MCP or one AI vendor. Tiled stays the familiar editable 2D authoring experience. Define adapters for other tile editors and engines later; ASM is not locked to Tiled implementation details or absolute tileset indices.

Provide official AERIS semantic tilesets with ready-to-use metadata, plus a documented way for creators to annotate their own assets. Tile roles are resolved through the active catalog, not hardcoded art. Keep agents from directly executing arbitrary user asset scripts or inheriting browser-extension and desktop privileges.

### 2.3 AERIS Maplift: semantic map → cheap 3D aerial representation

Maplift reads the semantic map/world representation and builds a **recognizable aerial interpretation** of the actual terrain: low-poly heightfield or chunked terrain, rivers/coastlines, forests, roads, villages, landmarks and selected landing sites. Use documented tile-to-geometry mappings, procedural defaults, optional creator-supplied heightmaps and custom GLB/glTF assets. Cache generated chunks and proxies keyed by source content and asset revisions; regenerate affected regions rather than the entire planet after a small edit.

A 2D tile does **not** reveal its true unseen sides, exact building height or mountain shape. Where metadata is absent, offer clear approximations and explicit overrides; do not claim physically faithful automatic reconstruction from arbitrary pixel art. The 2D RPG rendition and aerial 3D rendition reference the same semantic world, but do not need to look identical at pixel level.

### 2.4 AERIS Descent: world-entry, not another unrelated map

Descent composes a high-altitude approach, atmospheric sky, low-cost clouds, progressive aerial detail, camera route, chosen arrival craft/character and landing handoff. It uses Maplift's world and the creator's defined landing marker; the village, river, mountain and roads seen during the flight correspond to what was authored on the 2D map.

Suggested phases:
1. Select a world or location from the Stage I globe/space view; lock onto a safe, declared arrival point.
2. Approach from orbit or high sky with a simplified planet/terrain silhouette and atmospheric shading.
3. Move through a mostly inexpensive blue sky with sparse cloud cards or shader layers. Use this interval to stream the next terrain chunks; do not rely on clouds to conceal persistent loading failure.
4. Reveal the actual low-poly aerial world with progressively richer local landmarks along a validated camera/flight corridor.
5. Land and hand off to the chosen playable presentation — 2D top-down RPG, 2.5D or walkable 3D — retaining identity, position/landing semantics and gameplay state.

Offer a **skip/instant arrival** path, a shorter repeat-play intro, reduced motion, manual graphics settings and a performance-based recommended tier. The workspace must remain accessible through normal non-game navigation; a cinematic never prevents access to personal files or an exit.

## 3. NEA: AERIS's original signature descending ship

**NEA** is our original, unmistakably **four-wing**, badass flagship descent craft. Design a unique silhouette, flight behavior, animation language, materials and distinctive pilot. Its default cinematic should make the player excited to enter a world: onlookers on the ground look up; the craft tears through the clouds and stabilizes under pressure; the pilot fights to bring the passengers safely down and **does not give up**. The pilot is resolute and skilled, not a kamikaze or a character seeking death. The camera follows a thrilling but readable approach into the creator's actual landscape, then hands off to gameplay.

Take inspiration from the **energy** of classic arcade space-flight games such as Star Fox and the cinematic feeling of dramatic atmospheric entries, but create entirely original ship geometry, mascot/pilot design, animation, soundtrack, shot composition, logos and assets. Do not clone identifiable game/film designs or protected assets.

**NEA is the premium default, never the mandatory vehicle.** The creator may select NEA, a UFO, their own ship, a fantasy mount, or no vehicle at all. Descent operates against a documented `ArrivalVehicle` adapter: bounds, optional wing/engine/landing-gear attachment points, camera anchors, animation states, approach envelope, effects, sounds, landing method and fallback behavior. A replacement GLB can be used with fitting/calibration; arbitrary imported geometry cannot be guaranteed to work without configuration. The underlying world entry and landing logic remain shared.

*NEA — a name chosen with love. ♡*

## 4. Premium look without premium hardware requirements

Favor clean silhouettes, purposeful camera movement, beautiful color and atmospheric staging over expensive geometry. Distant terrain uses low-poly meshes/heightfields or pre-rendered overview proxies; faraway objects use billboards/impostors; chunks and LOD stream according to distance and device capability. Cloud cards, inexpensive particles, tasteful bloom where supported and low-cost shaders can provide the signature look. The sky can be mostly blue and simple without feeling empty because sound, pacing, parallax and landmarks establish scale.

- **Low tier:** 2D or pre-rendered high-altitude overview, 2D cloud layers/fade, short flight and 2D RPG arrival.
- **Medium tier:** chunked low-poly Maplift terrain, sparse animated clouds, cinematic camera, 2.5D/3D landing.
- **High tier:** richer geometry, cloud and lighting quality, vehicle effects and a more continuous approach.
- **Fallback:** quick transition/instant arrival if rendering or asset generation fails; preserve state.

Measure frame times and memory on modest devices rather than assuming low RAM always implies poor GPU. Do not generate detailed terrain synchronously in the middle of a cinematic; precompute/cache when possible and provide an honest fallback.

## 5. Interchangeable runtimes and exported games

Keep ASM + the semantic world definition, simulation/events and rendering adapters separate. The same map/world may run in a lightweight browser renderer, Tiled-compatible 2D RPG runtime, future 3D runtime, a published Cubecosm web game or another compatible host. Preserve stable IDs, coordinate conversions, exit/landing locations, object interactions and permissions through renderer transitions.

Support ordinary creator-owned exports and licensed assets. A published game must never inadvertently include the creator's private SUBSTRATE desktop, unreleased documents, extension privileges, credentials or local filesystem access. Package only explicitly selected world dependencies and supported host capabilities, as in the companion Cubecosm proposal.

## 6. AERIS creator choice, attribution and optional family intro

AERIS Descent may remain proprietary as an **implementation** while ASM and map interoperability are openly specified. Do not claim ownership over the general *idea* of descending from space to a world or over a creator's original map/game. Offer an explicit export control, **“Exclude proprietary AERIS Descent”**; omission produces a valid game without the proprietary descent module, using a creator-selected replacement or simple transition.

For creators who **include the proprietary AERIS Descent runtime**, propose a clear, permissive redistribution/license path for commercial or free games with a small, reasonably accessible credit somewhere (game credits, About page, documentation or game site), with no forced on-screen logo, royalties or surrender of creator ownership. Provide a copy-ready credit and an ordinary opportunity to correct accidental omissions. Exact grants/terms need separate legal review; a marketing aspiration is not itself a license.

Make an optional, highly polished **AERIS startup family**: a brief recognizable audio-visual sequence, classic-console-era *feeling* but wholly original, potentially using NEA's cinematic descent or a game-specific adaptation. “Powered by AERIS” identifies technology; an optional “AERIS title” intro is a creator's chosen presentation, not a claim that every user game is quality-certified. Players should associate the intro with excellent experiences because it adds production value, not because creators are forced to run an ad.

## 7. First vertical slice and acceptance criteria

**Vertical slice:** one small Tiled map, one official semantic tileset with known terrain/road/river/building/landing roles, one ASM agent-operation interface, one Maplift aerial output, and one skippable AERIS Descent using NEA or a replaceable craft to arrive in a real 2D RPG scene. Keep the first proof narrow; grow toward curved planets, fully traversable spherical gravity, larger generated worlds and elaborate ship sequences later.

Acceptance checks:
- Two independent clients (for example a test script and an AI tool caller) can discover the same tile semantics and apply valid, bounded edits through the same protocol.
- A request for a village, road, river and landing point yields editable Tiled assets; validation catches blocked paths, invalid tiles and unsafe landing footprints. Undo restores the map without erasing unrelated work.
- Editing the source map updates only affected generated aerial regions; map landmarks visibly align with descent and arrival.
- The same world can launch at low and higher quality settings, with correct fallback on low-end hardware.
- NEA can be swapped for a UFO/custom craft without rewriting map, descent routing or landing logic.
- Descent can be shortened/skipped; ordinary documents and workspace permissions remain unaffected.
- Creator export can include the licensed descent with attribution or exclude it cleanly; no private workspace contents leak into the game package.

**The desired result:** any agent can help author a real 2D world using a standardized Tiled contract; AERIS makes that world visible from above; NEA or a creator's own craft descends into it; the player lands, recognizes the world they made, and can actually inhabit it.
