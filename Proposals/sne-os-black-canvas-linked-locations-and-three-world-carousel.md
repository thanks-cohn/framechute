# SNE:OS — Black Canvas Invariant, Linked Locations First, and Three-World Carousel

**Status:** Implementation proposal; multi-world carousel, automatic proxy generation, and visual linking are not yet shipped.  
**Current prototype:** FrameChute branch `sne-os-world-entry-v0`, Otherworld: The Last Stronghold.  
**Applies to:** Both FrameChute and SUBSTRATE's shared proposals catalogue.  
**Order of work:** Make the black base reliable → prove persistent linking on one existing world → introduce three interchangeable worlds with efficient dark proxies → polish motion and transitions.

## 1. Non-negotiable visual foundation: the page itself is black

The user currently sometimes sees white when using scrollbars or moving into extended canvas areas. Do not fix this by drawing yet another dark image or overlay over an otherwise white page. Set the **real underlying root document, document body, default/extended workspace canvas, and exposed scrollable gutter** to true black (`#000`) in SNE:OS world/boot modes. The decorative starfield and island renderer are *separate layers above that black base*, not a substitute for it.

The base must remain black during first launch, while a GLB is loading, during star and shooting-star animations, if WebGL fails, when the workspace grows past its original bounds, while dragging and using the horizontal/vertical scrollbars, and during scene transitions. On errors, the stars can continue with an accessible retry option while the ordinary computing workspace remains available. Never paint a new black layer on top of documents or hijack their scrolling. Preserve the intentionally classic workspace's existing styling if the user explicitly switches out of world mode.

**Near-term implementation:** The current FrameChute world-entry branch gets root/body/workspace black fallback and dark root scrollbar tracks. Verify the actual browser viewport, scrolling and overscroll; CSS/static checks alone do not establish that every Chrome configuration is visually correct. Keep this underlay independent of the asset format and scene renderer.

## 2. First prove linked locations on ONE world

Before building a carousel, demonstrate multiple persistent spatial links on the existing Otherworld model.

- Right-click the world → **Linking** → **Add Linked Location**. Enter placement mode. Click a real 3D surface; use raycasting to record the hit, stable mesh/node identity if available, model-local position and local surface normal. A static anchor moves correctly with the world container's rotation, translation, and scale; node-local anchors follow a node's transformation. Skinned/animated surfaces may need explicit bone- or triangle-attached anchors later.
- Offer plain-language fields: **Point name**, **Where on the structure?** (e.g. Door / Lake / House), optional human-readable comment, destination type and target, optional transition. Do not require users to type coordinates.
- Destination dropdown: a named SNE:OS workspace/location, existing 2D world, another linked point or supported document collection; **Custom / Liquid Mode** is reserved for later scripted behavior, never arbitrary code in the privileged extension context. A decorative hidden path is not a security boundary for private documents.
- Right-click → **Linking** → **See Linked Locations** lists all points across the current world with model name/ID, point name, human description, destination and current status. Permit **Locate / Edit / Test / Disable / Remove**. In editor mode show the markers; in normal mode default to unobtrusive or hover-only markers.
- Persist link records outside mutable 3D assets with stable world IDs and anchor IDs. Reopening, manual zoom, rotating, and changing the lighting must not lose or move linked points. Invalid/missing targets show a recoverable warning; actual workspaces/files are never moved or deleted.
- The generic click-to-inspect behavior continues at unlinked surfaces. Only deliberately assigned points initiate navigation. **Enter World** remains an explicit world-navigation option, not a gate to the underlying workspace.

**Proof of concept acceptance:** Create at least two named links on distinct model surfaces, point one to the existing 2D world and one to an authorized workspace, rotate/zoom/reload, then use See Linked Locations to locate and edit each with no position drift and no loss of work. Verify actual destination opening and recovery. Do not claim this milestone is completed until tested interactively, not merely by checking that event handlers exist.

## 3. Then introduce a THREE-world registry and spatial carousel

Allow users to import/register three GLB/glTF worlds at first, each with stable identity, asset metadata, retained destinations, lighting preset, positioning parameters, user-visible label, and its own link collection. The initially active world is in front; the other two stand to the **left and right at slightly different depths**.

**Layout settings:** Default to consistent, repeatable spacing. Offer an optional deterministic, seeded `organic` placement mode, with bounded spacing/depth variations and collision-safe separation so worlds never overlap. Do not generate new random positions each app launch; the user's spatial memory and saved anchors must survive. Eventually allow advanced user-directed layouts and more worlds.

**Selection motion:** Move the selected world forward along a smooth, controlled curved spline or Bézier-like track. Others drift toward the corresponding inactive slots; a small purposeful vertical/sideways variation may make the transition organic. Avoid jitter, repeated camera jumps, straight-line conveyor motion, or the prior janky startup camera dolly. Provide configurable duration/easing and a reduced-motion instant option. The **slow black-to-light reveal belongs to the initial startup only**; switching worlds uses an independent, quicker, polished selection/reveal transition.

## 4. Efficient dark silhouette proxies, not just black-painted full GLBs

Inactive worlds should look like dark, recognizable exterior shapes without unnecessarily keeping their complete geometry, high-resolution textures, interior meshes, animation mixers and interactive simulation in GPU memory. Black material alone does **not** eliminate the vertex/mesh workload.

Generate/cache a simplified external silhouette proxy when importing a model, preserving a world-level shared origin and transform. Initially use safe simplification/exterior-oriented mesh grouping; transparent, moving or exceptionally complex worlds may require a creator-provided proxy or a manual correction. Distant or very small worlds may use cheaper impostors or tiny proxy meshes. Disable inactive animations, detailed materials, shadows and unnecessary updates. Permit users to opt into fuller rendering in Settings when desired, with clear performance implications and sensible memory budgets (including a 4 GB test device).

Render the real detailed model only for the selected world (optionally load/prefetch a near world while it is being selected). The inactive proxy should remain a dark exterior shape against the black starfield; no full asset reveal until selected. Keep the user's ordinary workspace available throughout.

## 5. Match silhouette and full model mathematically: no pop-in

One world owns a **single authoritative world container transform**: position, orientation, scale and origin. Both simplified proxy and fully detailed GLB use this same world identity and coordinate frame. Keep stable model metadata and optional anchor correspondence; linked destination points are separate metadata, not alignment controls.

On selection:
1. The dark proxy starts its curved, visually coherent travel. Begin loading/decompressing/preparing the high-detail GLB without showing it prematurely.
2. Normalize and position the full model in the same coordinate frame as its proxy. Confirm loading, materials, textures, sizing and first render are ready. Match camera projection/framing and check proxy-to-model bounding/landmark alignment within defined tolerances.
3. Hold the selected world in its aesthetically dark state if the detailed model is delayed. Never reveal an incomplete model just because a timer expired.
4. Switch from proxy to full geometry while **both representations are still dark and precisely aligned**, without two opaque intersecting meshes being displayed on top of each other; then smoothly raise the selected world's configured light/material reveal. This avoids z-fighting, a white intermediate frame, instantaneous unexplained appearance and sudden changes in position.
5. Release unnecessary inactive high-detail assets after the safe handoff, with explicit memory budgets and asset-cache policies.

For a proxy generated from the same GLB, preserve and verify shared coordinates automatically rather than asking users for points. For independently authored proxy/full pairs, an advanced tool may use at least three non-collinear corresponding landmarks to solve a rigid/uniform-scale alignment and validate residual error. Three reference points are **not** a requirement for ordinary users. Treat world-navigation link markers and mesh-alignment landmarks as distinct types.

## 6. Modular creator-facing controls and scripting

Settings should expose import/change world, proxy preview/correction, carousel mode/spacing/depth, motion duration/easing, inactive-world darkness/quality, active-world light and linked-location management. Existing world-entry text remains editable (default **Enter World**); the World Key remains optionally restorable at the bottom of Settings and hidden by default. Right-click context menus provide access to Enter World and Linking.

Use standard `GLB/glTF 2.0` for models, versioned JSON for layout/links/transitions, MP4/WebM for videos and Tiled formats for 2D worlds where supported. Keep the models, proxies, links, destination registry and transition assets independently interchangeable: replacing an island should not destroy its workspaces. Missing/changed mesh attachments should show a remapping UI rather than quietly bind private files to arbitrary replacement geometry.

**Liquid Mode** later exposes creator code and world-scene behavior through an actually isolated scripting runtime; use a narrow, permission-checked bridge for operations that open real workspaces, documents or privileged resources. A world package does not automatically get unrestricted access to personal files. Users can always skip cinematics, return to a classic computing interface and disable broken scripts.

## 7. Milestones and regression plan

**M0, immediately:** Black is the actual page substrate, including scrolling, extended canvas, world-mode startup/error frames and exposed gutters. Test in Chrome with horizontal and vertical scrollbar moves, large workspaces, toolbar hidden/shown, first open, reload, GLB load failure, and both regular and high-DPI displays. Document any browser-specific failure instead of assuming that a static CSS assertion proves the visual result.

**M1, next:** One-world Linking proof. Add two persistent node/surface anchors, assign destinations, rotate/zoom/reload, See Linked Locations and correct errors through UI. Verify all real workspace functions remain available even if the linked destination or world is unavailable.

**M2:** Import/register exactly three example worlds; persist and restore default repeatable positions, optional seeded organic spacing, per-world IDs, and safe navigation.

**M3:** Create and cache lightweight proxies; validate active-versus-inactive rendering, disabled background simulation and acceptable memory/performance.

**M4:** Implement curved foreground switching, ready-gated dark proxy/full-model handoff, fast light reveal, no flashing or geometric jumping; exercise slow loads and missing assets.

**M5:** Expand user customization and isolated Liquid Mode scripts after the visual editor and ordinary no-code navigation work.

**Principle:** The user's real computing space remains available regardless of the cinematic, which island is selected, or whether a model loads. Worlds are replaceable venues with persistent identities and links; black is the underlying space, not a patch placed over white.
