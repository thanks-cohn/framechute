# ÆXIS — Independent Cinematic Camera Composition, Editable Presets and Creator-First Controls

**Status:** Shared cross-project design proposal; this is not a statement that every feature already exists.  
**Repositories:** `thanks-cohn/Tiled-223D` (ÆXIS reference world and camera implementation), `thanks-cohn/substrate` (creator workspace), `thanks-cohn/framechute` (optional browser-extension/workspace integration).  
**Related work:** `docs/CINEMATIC_CAMERA_SYSTEM_CODEX_PROPOSAL.md`, `Bugs/camera-and-curvature-impostor-2026-09-25.md` on the cinematic-camera PR branch, and `portable-visions/AEXIS_PORTABLE_INTERACTIVE_EXPERIENCE_STANDARD_PROPOSAL.md`. This document **extends** those specifications without claiming their deferred features are implemented.

## 1. Creator intention and experience

ÆXIS should provide a compelling, optimized and aesthetically coherent camera setup *immediately*. A creator can import a compatible ship/GLB, fly it, see attractive cinematic views and an independent bottom-right live preview, and press `C` to swap the two views. Neither beginners nor new browser-game developers should have to code an entire camera system to achieve an enjoyable first experience.

Yet our carefully designed defaults must never become mandatory limitations. A programmer, an agent or an artist should be able to edit any individual camera, make a derived preset, redefine a project's preferred defaults, and create new named presets for ships, cars, people, fantasy avatars or other world objects. Both the intuitive browser UI and programmer/agent SDK operate on the **same versioned camera definitions and validation rules**.

The immediate motivating observation: current cinematic views often frame the ship effectively but can leave **too little visible Earth/world**; at high altitude some views reportedly zoom into the visually enlarged ship or go dark, while the older Forward/Overview view still reveals the planet. Creators want to say “keep looking at the ship, but tilt the shot toward the planet,” or “put the ship higher in my frame so I see more Earth,” without physically relocating the ship, planet or camera rig unless that is their intention.

**Three independent artistic decisions:**
1. **Camera position:** where the camera is relative to its follow reference (forward/right/up; world units and declared local frame).
2. **Camera orientation/target:** whether to aim at the ship by default, a selected world/GLB object or planet if actually present, a fixed point, or use manual angles; then add intentional pitch/yaw/roll offsets to the evaluated look-at direction.
3. **Viewport composition:** where the tracked subject sits in the image (normalized horizontal/vertical anchor or off-axis projection), desired world/planet coverage and optional safe margins; this changes the picture, not the authoritative object or planet position.

Angle and viewport composition must not be two labels for a secretly identical control. Define their distinct math, interaction and precedence. Expose independent values and a visual preview so creators can see the consequence immediately.

## 2. Keep original shots; add a literal fisheye sibling

Maintain the original ship camera positions and semantic behaviors. Retain the present perspective-based low-front shot as **Low Front Wide-Angle (Customizable)**. Add **Low Front Fisheye (Customizable)** as another preset with the same initial position, orientation, look-at, motion and framing defaults but an actual fisheye projection/distortion effect that visibly warps straight lines; increasing ordinary perspective FOV alone is insufficient. Do not silently change the original shot's effective geometry or break existing stable identifiers: alias/migrate the old low-front ID deliberately if renaming it. Thus there are six original shot *positions* plus one lens variant (seven independently selectable presets), not the removal of any other shot. Genuine distortion must affect the intended camera image only, with correct aspect in the main and preview, not HUD/UI or other cameras, and with a graceful explicitly labeled fallback for low-end devices.

Other original shots remain Rear Chase, Front Portrait, High Front Left, High Front Right and Overhead. Each initially looks at the controlled ship when it exists. Their base offsets remain authoring defaults, not compulsory runtime camera positions at every altitude or mesh size.

## 3. Independent camera identity versus viewport-specific presentation

A **camera definition** owns its stable ID, semantic shot name, original/default baseline, follow reference, target and look-at policy, editable position/angle/lens/fisheye/framing settings, smoothing and mode (Standard/Liquid when supported). Modifying the definition affects **that camera** wherever it appears; the main/preview cameras should not unintentionally share one mutable definition unless the user deliberately selects the same instance.

A **viewport assignment** owns which camera ID it displays, its own dimensions/aspect/safe-area, enabled/quality status, and optional viewport-local presentation overrides. The large main viewport and bottom-right preview can each have distinct *effective* framing/angle/lens adjustments or even independently cloned camera instances. This is necessary: a pleasing main-view composition may cut off the ship in the small preview. Provide a clear switch between “Edit selected camera preset” (travels with it when swapped) and “Edit this viewport's presentation” (stays with its screen region). Do not ambiguously promise both behaviors from one set of controls.

When `C` is pressed, exchange camera assignments; camera-owned saved settings **travel with the camera**, while viewport-local margins, offsets and quality remain with their respective screen regions. `C` again restores the previous arrangement. Preview selection is an independent control, not an implicit “next in cycle” after each swap. Support separately editing the camera currently assigned to main and preview; UI must make the edit target unmistakable and show both independently. An explicit “copy main composition to preview” and “reset viewport override” can make experimentation convenient but should not overwrite the shared preset unexpectedly.

If viewport-local overrides change an image but not its underlying definition, display the override distinctly (e.g., “Preview framing override”) instead of incorrectly marking the camera itself Modified. Changes to authored camera defaults, however, have the normal modification semantics below.

## 4. The accessible browser camera editor: every numerical control gets slider + input

Make visual experimentation immediate. Every ordinary numeric control should have a directly linked **slider and precise numeric input field**, showing the same underlying value in real time. Input values use clear units; sliders should show limits, sensible snap/step and keyboard accessibility. Numeric inputs permit typed precision beyond the slider's coarse step where safe. Dragging the slider changes the number; typing a valid number moves the slider; no “Apply” ritual should be required for live previews unless an expensive operation explicitly warrants it. Debounce heavy rebuilds without delaying simple camera pose edits.

Proposed controls, independently available per camera/viewport where relevant:

- Select **Main** or **Bottom-right preview**, with visible current semantic shot and original/modified status; select the camera to display and distinguish preset vs viewport editing.
- Forward/back, right/left, raise/lower: absolute values with feet/world-unit conversion and a separate API for relative deltas.
- Look at selected target: Yes/No (ship true by default); target dropdown for controlled ship/available avatar, actual Earth/world reference, selected world object, imported GLB instance and node/attachment point, fixed coordinate, registered custom resolver, or manual orientation. A missing real target must be clearly unavailable; do not invent a spherical Earth object or arbitrary GLB placement.
- Pitch/yaw/roll **relative to automatic look-at** when look-at is enabled, and explicitly specified orientation when disabled. Make axis signs understandable in the UI with a small live orientation preview; allow independent numerical camera angle.
- Subject frame placement: horizontal and vertical normalized offsets with an intuitive on-preview draggable framing marker, plus sliders and exact inputs. Offer “move ship upward in viewport / reveal more Earth below” as an intelligible composition operation, not a misleading movement of actual planet/ship coordinates.
- Lens and field of view, genuine fisheye strength on supported lens, camera distance, follow damping, rotation smoothing, optional collision-safe framing, ship/planet context bias at altitude, optional horizon level and safe margins.
- Reset one control, reset this camera to its authored baseline, and reset only this viewport's overrides as distinct operations. Clearly indicate affected scope.

Use progressive disclosure: basic panel = position, angle, subject framing, look-at and reset; advanced = lens, numeric anchor semantics, altitude profiles, curves and Liquid. All remain reachable programmatically; do not hide critical options behind a permanently intimidating wall of controls.

Input safety: finite values, supported ranges, degree/radian conversion, live validation and useful error messages. Avoid invalid `NaN`, near/far inversions, extreme distortion or clipping. Sliders are an *interface*, not the single source of truth.

## 5. Look-at, angle, and subject placement are independent

**Default**: `lookAt.enabled=true`, `target=controlled-ship`. Compute the baseline orientation from the evaluated camera position toward the selected subject anchor. Apply authored pitch/yaw/roll angle offsets around a documented local/reference frame. This allows a camera to keep tracking the ship yet tilt downward to include more of the apparent world.

**Composition/subject placement:** provide a normalized screen coordinate (e.g. center [0.5,0.5], upper third near [0.5,0.33]) and a renderer-independent projection/framing policy to bias the subject's screen position. A controlled aim offset and an off-axis projection are both possible techniques; choose and document one (or expose them as distinct behaviors). Preserve correct apparent target position across differing aspect ratios, especially the small preview. Framing must not move the actual planet/ship. Targeting may be off-center intentionally; do not force it back to screen center just because Look at Ship is true.

**Optional “show more Earth” control:** a creator may choose planet/world context as a composition intent, not merely a claim that Look at Ship=false. On higher altitudes, smoothly blend effective camera distance, pitch, FOV and framing as needed to include desired planet coverage while retaining the selected shot identity and ship tracking. An off-axis shift cannot reveal scenery outside the frustum by magic: when physically impossible, report the limitation and allow a lens/distance change or a separate alternative camera. Manual angle, automatic subject placement and high-altitude context policies should have deterministic documented precedence; show the evaluated effective result in the UI.

When look-at is disabled, the camera must receive a defined, stable manual orientation; it must not inherit an arbitrary stale quaternion from a previous frame.

## 6. High-altitude safety and existing bug gates (do first)

The reported camera problems are **P0 prerequisites to declaring the first visual slice ready**, not defects that a new slider panel can conceal.

- **Main/preview framing:** Default cameras can cut off or intersect the displayed ship. Compute framing from actual displayed GLB/fallback bounds, altitude-dependent visual scale, true lens FOV, viewport aspect and safe margin. Do not change the stored preset merely because a runtime auto-frame safety offset is active.
- **Bigger 2,500×2,500:** User reports a repeatable approximate ALT **1455** boundary where climbing zooms into the ship then produces darkness; descending returns the apparent planet/world.
- **Massive 16,000×16,000:** High-altitude cinematic shots lose the planet, sometimes revealing it briefly on switching from low-front to high-front-left and again at lower altitude, whereas legacy view remains usable.
- Inspect camera near plane versus few-world-unit camera offsets and altitude-scaled visual ship, evaluated target, far plane, globe/horizon projected bounds, correct yaw/pitch/roll and screen-space composition. Diagnose with actual values and local browser imagery, not an unsupported claim that the camera “only looks up.” Maintain the V/Shift+V legacy Forward/Overview altitude and planet framing; preserve navigation/position and island curvature behavior.
- Provide appropriate **effective per-camera** altitude/scale-aware visual bounds, collision and clipping safety, and optional world-context framing, without secretly replacing a chosen ship-facing shot with a legacy view. Smooth transitions through altitude thresholds and scale changes.
- Test low/mid/orbit, all seven shots, Current/Bigger/Massive, sphere and GLB, both viewport roles, C swap, camera-angle edits, extreme composition values, preview disabled, resize, ship turn/bank and zoom; check browser on the user's ~4GB Windows target. Unit tests/build alone do not establish visual correctness.

The distant island billboard orientation/curvature bug tracked in `Bugs/camera-and-curvature-impostor-2026-09-25.md` is related to high-altitude visual coherence but separate from camera controls; do not fix camera composition by moving islands or physical world geometry.

## 7. Programmer SDK: optimized defaults, complete customization, and new baseline presets

Publish structured, typed and validated operations to inspect camera libraries, get/set a camera's current values, apply absolute or relative adjustments, clone presets, author brand-new presets, register them for an entity/game, select them for main/preview, set viewport overrides, inspect resolved effective pose/projection, reset to baseline, and serialize/export configurations. The independent SDK should not require adopting our browser UI, GLB asset marketplace or eventual C++ renderer.

**Three levels of authorship:**
1. **ÆXIS optimized original presets:** default ship cameras and coherent visual/audio/flight feel, usable out of the box.
2. **Modified instance:** a creator adjusts a built-in preset. Semantic display name changes from `High Front Left (Customizable)` to `High Front Left (Modified)`; restoring all baseline values returns it to `(Customizable)`. The suffix is **replaced**, not appended.
3. **New creator/programmer-defined preset:** clone an existing shot or author one from scratch, then **explicitly save/establish a new baseline**. E.g. `Racing High Left (Customizable)` with developer-selected up/forward/pitch/framing values. Future edits are compared to *its own* established baseline, not the immutable ÆXIS factory values. The new stable ID differs from its source preset; names can change without breaking references.

Separate actions with explicit names: `setCurrent`/relative `adjust` vs `setDefaults`/ `createPreset` vs `restoreDefaults`. **Never infer “establish new defaults” just because a user dragged a slider.** Keep the original factory version available to clone and restore deliberately; prevent silent mutation of global built-in templates.

Illustrative future API (adapt exact symbols to the shared engine contract, not a claim of shipped functions):

```ts
const base = world.cameras.get("ship.camera.high-front-left");
const racing = base.clonePreset({
  id: "my-game.camera.racing-high-left",
  semanticName: "Racing High Left"
});
racing.establishDefaults({
  position: { forward: 25, right: -12, up: 18, unit: "ft" },
  lookAt: { enabled: true, target: { kind: "controlled-ship" } },
  angleOffset: { pitch: -15, yaw: 0, roll: 0, unit: "deg" },
  composition: { subjectX: 0.5, subjectY: 0.3 },
  lens: { type: "perspective", fovDegrees: 75 }
});
world.cameras.registerPreset(racing);
world.viewports.setCamera("main", racing.id);
world.viewports.setCamera("preview", "ship.camera.rear-chase");
world.viewports.setOverride("preview", { safeMargin: 0.16 });
```

Expose original baseline, current values, effective evaluated values, viewport override and status separately for inspectability. Version presets, document unit/axis conventions and migrations; stable IDs and object-binding permissions carry across persistence and exchange. Use the same structured core for AI agents: inspect, plan/preview, validate, explicitly commit authorized changes, support revisions/undo; no unrestricted model or world mutation from imported scripts.

## 8. Independent default behavior by vehicle class, altitude and viewport

Each ship/GLB size and movement mode (flight vs future driving) can choose **a distinct optimized starting camera profile** while inheriting the same six ship shot locations plus seventh lens variant where applicable. As the ship becomes visually larger in orbital mode, or when monster wheels/hidden wheels change the apparent ground clearance, default *effective* camera distance, target anchor and FOV may adapt without corrupting saved presets or losing the world. Cars, people and custom avatars can define their own libraries and mappings; avoid pretending these vehicle systems already exist.

Allow optional author-controlled profiles for the project's four existing atmospheric height bands, with interpolation or authored hard switching and independent camera and preview overrides. Distinguish observer altitude, entity altitude, size class, distance LOD, and game mode. The user may force a color or aesthetic composition while preserving underlying deterministic math where appropriate. A viewport's authored composition is not guaranteed to show the same amount of planet at a different size/aspect, so expose deterministic adaptation and inspect the effective result.

**Liquid Mode extension:** allow bounded programmable camera offset, target, pitch/yaw/roll, lens and composition as functions of speed, acceleration, banking, target/planet visibility, impact and suspension events, altitude and world state. Maintain look-at selector/Yes-No controls while hiding ordinary numeric controls only in Liquid's dedicated editor, with explicit return to Standard and retained original presets. Require safe/capability-scoped execution or a declarative behavior graph; no unrestricted executable imported code. Its output should be compatible with the portable ÆXIS sequence/SDK contracts where possible. Liquid is **later work**, not a blocker for fixing current orbital camera failures.

## 9. Project roles and integration

**Tiled-223D:** owns the existing Three.js browser viewer reference behavior, camera schema, render/viewport adapters, regression tests and current PR #28 visual bugfix sequence. Start by fixing framing/orbital/curvature problems, then add the UI and SDK semantics incrementally; preserve original controls, world API and low-compute design.

**SUBSTRATE:** long-term browser-accessible creator workspace that can host an optional camera/sequence editor with sliders + exact numbers, independent main/preview panes, original/modified presets, agent inspection and export of portable definitions. Preserve workspace isolation and permissions. Do not make a fully rendered 3D world load in every tab.

**FrameChute:** existing browser-extension implementation/optional bridge to opening, editing and exporting compatible camera/experience packages, reusing the same schema/UI primitives and not maintaining a competing camera-state format. Its integration is proposed, not already present.

## 10. Delivery sequence and acceptance

**Stage A (urgent):** investigate/fix documented PR #28 main/preview ship cutoff and 2,500/Massive orbital blackout with real browser verification. Preserve V/Shift+V, C two-way swap and existing numerical camera values. Correct the existing distant-island curvature bug independently. Add camera bounds/near-plane tests, screenshot/visual and low-end performance checks.

**Stage B (intuitive controls):** per selected main/preview camera, ship/world target choice where real, pitch/yaw/roll, horizontal/vertical subject placement, FOV and configurable safety margins. Every numeric property gets synchronized slider+input; editing scope and reset semantics are explicit. Test that edits survive swaps and do not unexpectedly mutate other cameras/viewport overrides.

**Stage C (distinct lens shots):** retain Low Front Wide-Angle unchanged under accurate naming and introduce Low Front Fisheye with actual lens distortion and separately adjustable strength. Test both main and preview aspect, scene vs HUD separation, optional low-end fallback and no regressions to the other five shots.

**Stage D (portable developer freedom):** typed inspect/edit/clone/establish-defaults/restore/register operations, independent viewport assignments/overrides, versioned persistence, agent planning and tests of new baseline/modified naming. Provide an independent mini demo using the public programmer SDK and the same schema as the editor.

**Stage E (future depth):** per-altitude/movement profiles, richer world-context framing, Liquid/sequence director and native adapters once the working slice is proven.

**Definition of success:** A new creator can use optimized built-in camera angles, drag a slider to tilt one shot toward Earth, type a precise subject-position value, customize the small preview independently, swap via C, restore the original preset or save their own new baseline, and export it. A browser-game programmer can load the same preset/SDK, bind their ship and world, change a few values and obtain a playable, cinematic result without rebuilding the camera system. Across all supported altitudes and scales, default cameras remain legible and do not unintentionally disappear into the ship or black out.

**Long-term ambition:** earn an open, interoperable standard of **breadth, depth and ease of use** for browser-based interactive experiences, culminating in a browser-first authoring/SDK combination of a distinctive kind. Other engines and timelines already contain related concepts; “first of its kind for browsers” is an aspiration about the particular accessible, integrated product we build, not a categorical claim of inventing cameras, cinematic timelines or interchange.
