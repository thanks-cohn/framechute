# Proposal — Cinematic Ocean Altitude: Shadow Footprint & Layered Wave Families

**Status:** Design proposal, not an implemented feature.  
**Vision:** An ocean that is a delight to fly over: beautiful and convincing at cruise, exhilarating at speed, expansive on ascent, and serene and monumental near the top. Keep the engine light enough to target a 4 GB computer without pretending that visual quality or FPS can be guaranteed without a real browser test.

## 1. The experience: altitude must be *felt*, not announced

The player should sense both height and velocity through **the changing relationship among the ship, its shadow, the sea, and separate families of waves**. At sea level, close ripples slide beneath the ship. In the middle atmosphere, three sizes of crest give a rich near/middle/far parallax rhythm. Higher up, visual noise falls away; two coordinated, beautiful wave families emphasize broad scale without becoming the same pattern as the top level. At the very top, a dominant, extremely broad slow-looking ocean family and a sparse secondary family show that the world is still alive without littering the planet with tiny white dashes.

**The ocean must look like waves, not “hairs,” isolated random curls, or vertical decorative speed stripes.** Speed already has a separate lightweight peripheral airflow effect; ocean waves should be credible and aesthetically rewarding even when movement is slow.

## 2. Height-dependent shadow: turn the local diamond into an intentional reference point

Keep the concept of a localized footprint below the craft but stop showing the sharp diamond/rectangle that reveals the near-ocean rendering patch. On a broad/expansive ocean, reinterpret the region as a **soft, surface-conforming, ship-referenced shadow**:

| Altitude / mood | Shadow appearance | Experience |
| --- | --- | --- |
| Low / scenic | Absent or barely perceptible, compact and diffuse. Never obscure close waves or shores. | The ship is close to the surface. |
| Middle / active | Light, gently feathered footprint; enlarges gradually as the ship climbs. | Recognizable reference beneath the player. |
| Third / expansive beauty | Broader and more distinct, but still soft and atmospheric; allow color and sea texture through. | The viewer feels suspended over an increasingly large world. |
| Top / planetary | Intentionally darker, legible but not an opaque disk; its shape and scale remain tasteful relative to the visible globe. | A cool, unmistakable height cue; the ocean and planet still read clearly. |

This is a **stylized height indicator**, not a claim that a real solar shadow necessarily becomes darker at greater altitude. Derive its location by projecting the authoritative ship through the declared light direction onto the *visible curved ocean surface* (or document a cheaper explicitly stylized vertical-under-ship option). The camera may move around it without dragging the footprint across the water. No shadow should be painted through land, on the far side of the globe, or above the ocean. A gradual soft mask or shallow translucent surface treatment is preferable to a second globe, hard-edged quad, postprocessing blur or expensive dynamic shadow map. Use depth and coast masks; hide or soften when the ocean is not below the ship. **Changing altitude must not make the reference jump in viewport space**; the change in shade, radius and position should be gradual, while the position's optical motion derives from actual navigation and perspective.

## 3. Four altitude moods, deliberately different wave compositions

| Altitude band | Main wave families | Art direction and perceived motion |
| --- | --- | --- |
| **1 — Low / scenic ocean cruise** | **One dominant small/near family**, with a *faint optional large family only toward the distance*. | Readable broken crests with connected rhythm, not randomly bent individual hairs. Small crests pass by relatively quickly due to near-field optical flow; distant wave structure gives the ocean scale. Warm, beautiful, unobtrusive while hovering. |
| **2 — Middle / acceleration** | **Three families:** small/near, medium/intermediate, broad/far. | Richest parallax; small crests sweep past, mid-range bands pace the ship, long distant bands linger. Their actual world-space speed need not differ; apparent speed follows distance and camera projection. Avoid filling the view with three equally bright textures. |
| **3 — High / expansive beauty** | **Two main families:** broad, slower-looking coherent wave bands + a lighter, medium secondary family, *distinct from the top-level combination*. | An intentionally beautiful transitional altitude: spacious long arcs and measured secondary flow, clear above/below relationship, enough motion to enjoy high-speed travel without overcrowding the curved ocean. |
| **4 — Top / planetary** | **One dominant extremely broad, long, visually quiet family** and a **small, sparse secondary subset**. | The slowest-looking large features linger as navigational references; the sparse second set provides visible change. No continent-sized “small waves,” no dense bright curls on the globe, and no loop of identical patterns every few seconds. |

Do not hard-switch families at a numeric threshold. Overlap adjacent band weights, blend style/opacity or stable LOD representation and use hysteresis where needed. **Do not rescale a crest's world-space coordinates every frame as altitude changes.** Each family has stable seed, identity, geographic anchors, shape and coordinate space. Altitude controls which families are *presented*, their projected density and contrast, not the position of existing marks.

## 4. Draw an ocean, not random lines

Use **coherent crest groups**, such as gently arcing contour bands, aligned broken segments and two/three neighboring staggered crest fragments sharing a slowly varying world-space direction field. A shallow Bézier or another low-cost sampled curve is fine; more important are consistent water-scale spacing, natural taper/fragmentation and believable perspective. Favor wide, shallow wave crescents and loosely nested/wind-driven groupings rather than individual tight curls. Tune hue, transparency and width so near foam can glint, medium wave structure remains delicate, and high-altitude contours are long and low-contrast. A wave is not automatically a ship wake; keep any wake a distinct opt-in effect.

Use a **fixed, finite geographic field** and pool a small number of visible sampled arcs rather than allocating a 16,000 × 16,000 texture or simulating fluid dynamics. Existing same-surface ocean/planet curvature and floating-origin rules apply to *every segment*; don't draw a straight screen-space chord between bent endpoints. Sample the ocean/shoreline and reject inappropriate terrain, horizon/back-hemisphere and clipped waves. Never rotate the entire field to match heading. At a stationary world/camera pose, marks should remain in place; hovering upward should change their projected scale/perspective and fade mix, **not generate artificial forward flow**. When the ship travels, overlapping distances naturally convey **small-fast / medium-paced / large-slow**, with real camera/projected motion.

## 5. Lightweight implementation and creator control

- Preserve the existing lightweight ocean as the **single authoritative rendered water surface**; draw no duplicate globe and add no full-screen volumetric pass.
- Begin with a bounded set of reusable control points/line or ribbon geometry, one shared family palette, two or three small buffers (only active bands visible), and a single cheap optional shadow mask/mesh or shader footprint. **Measure the real draw calls, vertices, allocations and GPU cost** before setting production budgets.
- Cache deterministic crest families in stable world chunks, recycle *offscreen* geometry only, and keep frame updates proportional to the small visible pool rather than total world size or ship speed. Preserve seam continuity and protect shallow shore water.
- A low-end quality profile may thin secondary families and simplify the shadow while retaining all four moods and the fundamental speed sensation. Never silently change the ship's momentum or teleport terrain to create fake optical flow.
- Make the visual system declarative for a creator: family size, strength, coloration, mood balance, shadow softness/darkening and opt-out toggles can be chosen by a validated visual preset, without a paid AI service. Preserve sensible, striking default styling; allow creator worlds to diverge without changing the canonical map/flight mathematics.

## 6. Spatial Truth, Deep Debug and agent inspection

Provide versioned, bounded, machine-readable **world coordinates and viewport projections** for ship, shadow footprint, and representative sampled crests. A trace should distinguish a genuine ship displacement, a camera/lens adjustment, an altitude-band crossfade, crest-pool recycling, and a shadow-projection change. Track the physical ship, water intersection, projected shadow footprint center/radius/opacity, crest family/ID/seed/world anchor, visibility/LOD and near/mid/far projected footprint. Give agents explicit performance counters and a selected-crest trace; allow authorized, reversible preview of visual presentation parameters without touching physics or granting world assets unrestricted privileges. Performance mode must not serialize or trace all crests each frame.

## 7. Acceptance, not just code completion

At **low → middle → third → top → descend**, verify shadow darkens/expands smoothly without a diamond seam; wave families transition without popping or moving with ascent. During hover, coast and boost, near waves should pass faster *in screen space* than distant bands, while geography is stationary in world coordinates. Validate all world scales, Forward/Overview/Auto cameras, coastlines, world wraps, unusual aspect ratios, and a loaded ship GLB. Capture a replay at identical positions and compare the sea before/after each altitude transition; test shadow occlusion at shore and the globe horizon. A successful unit test does **not** establish that waves look beautiful; inspect actual browser captures and FPS on a 4 GB Windows device. Tune with human feedback.

**Outcome:** The local rendering trick becomes a graceful, increasingly dark altitude landmark, while carefully choreographed wave families and existing clouds produce a beautiful ocean flight experience in which acceleration can simply be *felt*.

## FrameChute integration (proposal only)

The ÆXIS/WORLDS (R)END world renderer should be an optional, detachable spatial frame, not a global effect on PDFs, documents or regular browsing. A world frame may expose validated water/altitude visual profiles and semantic read-only diagnostics to authorized agents; respect frame-scoped permissions and a low-end default. Its camera, visual shadow and wave families follow the canonical world state of the companion Tiled-223D engine; no second global physics state or direct access to unrelated frames. See `Proposals/aexis-worldweaver-artist-anchored-procedural-world-generation.md` and `Proposals/worlds-rend-multiscale-perspectives-descent-and-engine-handoff.md`. Nothing in this document implies that the current extension ships these ocean effects.
