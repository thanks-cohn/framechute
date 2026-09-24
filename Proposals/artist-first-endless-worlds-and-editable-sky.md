# Artist-first worlds: endless possibilities and an editable sky

**Status:** Cross-repository product proposal, not implemented. Shared across Tiled-223D, SUBSTRATE and FrameChute. Existing stages and prototypes retain their documented status.

> My goal has always been endless possibilities for anyone who so dreams. So I hope the foundations I've laid may make your wildest visions and dreams come true.

## The experience to aim for

A young artist supplies a few pictures and a description. The builder makes a quick, attractive first world that feels eerily close to their vision. They can grab, paint, reshape, move and revise any part of it with delight. The default is beautiful, simple and readily editable. No particular art style, genre, asset source, machine size or model provider should define the limits of the world format.

Creation should feel like play: visible changes, understandable controls, reversible experiments and immediate previews. Keep the exact authored choices as constraints when generating surrounding details. If a result is merely close, the artist can keep refining it toward *exactly like this* without starting over or losing the parts they love.

## Shared foundation and two first-class API surfaces

Store stable world, region, object, material, light and celestial-body IDs with explicit coordinates, units, relationships, constraints, provenance, revisions and undo. Keep source references and authored data separate from render proxies and model guesses. A 2D map, a 3D view, an advanced editor and a playable runtime should be projections of the same world truth.

Expose a precise, typed programmer API for geometry, maps, surfaces, placement, lights, time and export; expose an agent API for inspection, intent, planning, preview and proposed edits. Both use the same IDs, validation, permissions and revision system. Agents may suggest; creators can inspect and change every accepted result. Offer ordinary debug mode for clear errors and an opt-in deep debug mode for geometry, lighting, provenance, timing and performance diagnostics. Neither mode should alter world semantics.

Make the world core and its contracts understandable enough that future small local models can help interpret descriptions and reference images. Collect training or evaluation examples only with creator consent and appropriate rights: input intent, accepted proposals, specific user corrections and final result. Do not assume a large model, network access or future training data is needed for the basic editing path. A small model drafts structured operations; the deterministic core checks and executes them.

## Lighting that feels like world-building

Begin with a pleasing, inexpensive sky and lighting preset. Let a creator drag a sun or moon into the sky, set its path and start time, then watch the world respond. Support multiple moons as distinct editable bodies, with independent placement, apparent size, color, intensity and motion where meaningful. Provide simple artistic controls for day length, color, haze, cloud cover, shadow softness and surface response; advanced controls expose measured light directions, curves, atmosphere parameters and render budgets.

Define a versioned sky/light specification that records the celestial paths, clock, sky scattering or its lightweight approximation, weather/haze, ambient fill, shadows and per-surface material interaction. Preview light filtering through atmosphere and clouds consistently in 2D and 3D. Offer low-cost gradient/lookup and limited-light modes before expensive volumetrics, with clear device presets. A second moon should never silently double the cost or produce unpredictable exposure. Pausing, scrubbing and saving time must recreate the same view from the same seed and revision.

## Styles, games and advanced Liquid Mode

Allow 2D, 2.5D and 3D views and creator-authored visual styles over the shared spatial and semantic core. Proposed **Advanced Liquid Mode** lets expert creators transform shapes, surfaces, materials, light and procedural rules through explicit mathematical operations, bounded evaluation and preview. Its output remains inspectable, editable and versioned; no user should need the mode for the ordinary world-building path. Publish stable scene and interchange contracts so game developers can use the worlds and attach input, collision, state, audio and packaging systems. World creation alone should not be advertised as a finished game engine.

## Ordered delivery and acceptance

1. **Reliable world truth:** define the shared schema, stable IDs, source/reference provenance, map-to-world transforms, atomic preview/commit/undo and meaningful errors. A programmer edit and an agent edit must be visible through both APIs after reload, without corrupting authored maps or elevations.
2. **Joyful first draft:** accept several pictures and a description or structured hints; show named proposed regions and a quick, cheap preview; let the artist accept or adjust one region without regenerating locked neighbors. Clearly mark inferred unseen geometry and unsupported inputs.
3. **Editable sky:** ship an attractive low-cost default, a single sun and one moon with drag/path/time controls, then multiple moons and more nuanced atmosphere and shadow response. Save, reload and scrub must give reproducible results; preview and undo must work for each light edit.
4. **Open style and runtime hooks:** expose versioned material/geometry/light extensions and 2D/3D projections; prototype Advanced Liquid Mode with bounded operations and a game-runtime export/adapter. A custom style must not change collision or object identity unless explicitly edited.
5. **Small-model assistance:** test an optional compact model against consented description/image-to-structured-operation examples. Evaluate similarity to the artist's stated constraints, editability, latency, memory, uncertainty reporting and correction cost. Keep manual and programmatic paths usable without inference.

Measure startup, peak memory, preview latency and interactive frame times on the actual 4 GB Windows target, with bounded scene sizes and Low/Standard/High presets. Record qualitative artist feedback separately from quantitative timings. Preserve simple map/placement editing if full lighting or 3D rendering exceeds that device's budget. Do not promise universal 4 GB performance before measuring it.

## Repository responsibilities

- **Tiled-223D:** canonical world operations, Tiled interchange, reference-driven region planning, sky/light data contracts and browser preview; see `Stages/README.md` and `docs/AGENT_WORLD_API_HANDOFF.md`.
- **SUBSTRATE:** the welcoming workspace, permissioned agent access, linked 2D/3D views, creator controls and save/reopen experience.
- **FrameChute:** interoperable frame/asset and canvas workflows, creator-facing visual controls and handoff to the same world contracts.

This proposal describes a direction. It does not claim image-to-world generation, multi-moon lighting, Advanced Liquid Mode, a complete game engine or the later roadmap stages are already shipped.
