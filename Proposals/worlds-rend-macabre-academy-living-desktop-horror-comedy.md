# World's R.End — The Macabre Academy: A Living Desktop Horror-Comedy

**Status:** Design proposal only. The existing little-town demo is a standalone proof of movement and map transitions, not an implementation of this proposal.  
**Product:** SUBSTRATE / FrameChute, World's R.End optional spatial-desktop system.  
**First setting:** A cute, editable SNES-inspired academy whose residents experience ordinary desktop activity as baffling phenomena.  
**Companion proposals:** [Omni World / engine-neutral 2.5D](omni-world-engine-neutral-2-5d-worlds-rend.md), [agent-native spatial desktops](worlds-rend-agent-native-spatial-desktops.md), [world descent and rendering modes](worlds-rend-multiscale-perspectives-descent-and-engine-handoff.md), [semantic world engine](semantic-world-engine-agent-native-spatial-ir.md), and [the little globe](little-globe-descent-into-living-world.md).

## 1. The premise: an ordinary edit, an inexplicable event

The user is simply moving, resizing, opening, and closing files in SUBSTRATE. Below the editable windows, a little school continues its day. To its students, a PDF floating overhead looks like a vast stone monolith; a transparent image or new window seems to materialize from nowhere; a resized frame appears to grow; an accidental drop can become a dramatic, *fictional* impact. They do not know they are living under a desktop. Their investigations may be wildly elaborate even though the cause is only a user forgetting where a file was left.

The user's desired optional tone runs from cozy comedy to macabre mystery. Students study shadows, gossip about the government, devise explanations for the great floating rectangles, and argue about whether the sky has changed. The audience can enjoy the contrast between the pedestrian upstairs explanation and the serious downstairs response without the game claiming that the characters are actually conscious or that these are real-world catastrophes.

Illustrative dialogue, not mandatory fixed lines:

> "Anybody else not going to mention the giant stone floating thing?"
>
> "My dad says—"
>
> "Your dad says a lot of shit. The government can't even figure it out, and we're supposed to pretend that's normal?"
>
> "Ohhh... why does it look like that? It looks... alien."

A Macintosh-like desktop skin can look, *from the world below*, like a sudden alien architectural change. A student eventually proposes that someone above them may merely be moving files. Another dismisses the theory as absurd. The academy's horror is the interpretation; the editor's action is mundane.

## 2. Preserve the original World's R.End desktop promise

World's R.End is an opt-in setting, not the only path to a file. Three presentations share the *same* real desktop and world identities:

1. **Classic:** Ordinary functional SUBSTRATE canvas; no game renderer or game keyboard interception.
2. **Living overlay:** Actual editable PDF/DOCX/image/application frames remain in the foreground. The playable academy is behind them. Frames can optionally cast geometric shadows or be given harmless visual world proxies. NPCs observe permitted events and comment. Game navigation only accepts input while world controls have explicit focus.
3. **Immersed:** The academy fills the view. Interact with a school computer to open the actual desktop. Walk through a campus edge to an overworld and return. Later, the overworld/airship traverses the larger canvas and connects multiple desktop-towns. A rotatable little globe can act as a higher-level selector; the skyward look-up/look-down transition can move directly between desktops.

The school is the **first editable world theme**, not a permanently hardcoded app shell. The user or a future creator may replace it with any compatible world and retain the same real files, application permissions, and desktop identities.

## 3. One event, two perspectives

| User action | Deterministic visual event in the academy | Optional resident interpretation |
| --- | --- | --- |
| Move a frame over the courtyard | Its virtual footprint/shadow sweeps over a patch of ground | "Who turned off the sun?" / a resident seeks shade |
| Resize a frame | Shadow and optional visual proxy grow or shrink | "The stone is getting bigger." |
| Switch to a retro Macintosh-style theme | Window chrome or themed world proxy changes appearance | "Why does it look alien?" |
| Place or drop an image in the world | A world object/proxy appears at a specific mapped location | Residents examine it, ask questions, or treat it as a clue |
| Close, hide, or move a frame | Its proxy or shadow vanishes/moves | Rumor about disappearances or a missing landmark |
| Undo a *simulated* world effect | The affected decorative world state is restored | "Wasn't this building gone a minute ago?" |

**Do not map ordinary Undo to destructive world edits by default.** An editor Undo is an editor action. The world may make a visual joke about it only through a separately reversible, non-destructive event. No real PDF bytes, saved workspace state, or user documents are ever damaged as part of the narrative.

## 4. Cheap light, selective language

Most of this feature is **light work, literally**. The renderer already knows a frame's location and dimensions. A user-controlled virtual light direction and frame elevation/footprint are enough for a projected rectangular shadow in the first prototype. Detect which character footprints intersect or leave the shadow; animate looking up, shifting position, or walking to the sunlight with ordinary deterministic game logic. A local model is not needed on every animation frame.

When a meaningful event occurs, send a *small, bounded, user-permitted* description to an optional local LLM. Example event envelope:

```json
{
  "event": "shadow_enter",
  "characterId": "student-curious-01",
  "placeId": "academy-courtyard",
  "observation": "A large rectangular shadow moved over the student.",
  "context": ["sunny afternoon", "student was eating lunch"],
  "allowedResponses": ["speak", "look_up", "step_into_sunlight", "do_nothing"]
}
```

The model proposes a short line and, optionally, one action from an allowlist. The engine validates responses, checks reachability and cooldowns, and executes harmless animations/dialogue. Avoid per-frame LLM queries and uncontrolled NPC-to-NPC call loops. Rate-limit events, deduplicate shadow crossings, cache innocuous descriptions, cap dialogue length, and provide an offline deterministic fallback when there is no model or insufficient compute.

A **local text LLM cannot know what a dropped picture shows from its filename or from geometry alone**. For reactions to image *content*, ask permission for local vision or supply an explicit user-authored description; then share only the description and permitted context with character reasoning. In shadow-only mode, never inspect the PDF or picture contents. No document text, image pixels, filenames, or personal metadata go to a remote service without a separate explicit authorization.

## 5. Character-level mystery rather than random quips

Characters have small editable profiles: temperament, curiosity, favored explanations, relationships, and a compact optional event memory. They only receive observations appropriate to their local position, sightline, and current activity. The world can track **fictional theories** about monoliths, sky changes, falling objects, and spontaneous restorations; these are in-universe beliefs, not assertions about reality.

Example cast roles: a skeptical student who measures shadows; a classmate who repeats dubious parental theories; a caretaker who tries to restore order; an earnest librarian who files incident reports; a student who finally hypothesizes a mundane operator outside the map. Let reactions vary by viewpoint and recent events, with deterministic defaults and short optional LLM dialogue. Make voices, dialogue intensity, memory length, and deletion configurable. NPCs do not need access to real desktop files to maintain a fictional mystery.

## 6. Optional macabre and slapstick physics

Provide a **separate opt-in Macabre / Slapstick switch** on the World's R.End settings page, apart from enabling the overlay. In the default cozy academy, frames cast shadows and NPCs comment; no danger effects occur. In macabre mode, the user may choose to *stage* a falling image/tile or allow visual proxies to topple after an explicit in-world drop interaction. These events can scatter students, leave fictional debris, temporarily block game paths, spawn rumors, and trigger investigations.

Any falling-tile impact is restricted to the game simulation. It must not erase, close, corrupt, or relocate real user files or actual editing frames; real user actions remain independently undoable. Rebuilding a school prop or reloading a scene must be possible without relying on a generated narrative. Keep the default presentation non-graphic, and provide a reduced-motion/effects option. No simulated collisions should seize pointer focus from an active document editor.

## 7. Editable maps; no academy hardcoded into the engine

Use a portable world definition with stable IDs for the desktop, map, buildings, NPCs, props, lights, frame proxies, spawn points, gates, and entrances. Author visual tiles and object layers in a tool such as **Tiled**, exporting a documented JSON-compatible package with tilesets and metadata. Map-defined objects, not hardcoded coordinate comparisons, determine walkability, the computer interaction, and the campus exits.

A map's **computer station** resolves a validated action such as `open_current_desktop` or `open_workspace`, not a magic absolute filepath. A **campus gate** leads to the overworld at a named spawn. A **return entrance** restores the academy with its state intact. The same saved desktop remains accessible through a normal menu even if the world is unloaded or an imported map is broken. Import packages must validate types, coordinate bounds, asset paths, script capability, and reference IDs; do not execute untrusted world data as privileged extension scripts.

World artists can swap school layouts, skies, characters, physics presets, and dialogue profiles without changing the main SUBSTRATE source. Later the same protocol supports custom towns, horror academies, ships, forests, 3D renderers, and AI-assisted creation using separately granted permissions. The app core owns document state and authorization; the world renderer owns only presentation and constrained simulation.

## 8. Implementation milestones and acceptance criteria

**Milestone A — School theme and safe overlay:** Replace the demo map with a small editable academy world; bring it behind working SUBSTRATE frames on the feature branch; retain Classic mode. A user can type and edit normally while the world renders with optional focused character movement. The academy computer opens the existing desktop; a campus exit reaches and returns from the overworld.

**Milestone B — One real shadow:** One normal movable frame casts a consistent projected shadow onto the courtyard in Overlay mode. One NPC notices a new shadow and looks up, without reading the frame's content. Moving/resizing the frame updates the geometry, and disabling World's R.End removes the effect.

**Milestone C — Tiny optional local LLM:** Expose a simple opt-in model adapter with an event queue, strict timeouts, cooldowns, allowed actions, and a canned-dialogue fallback. One NPC comments on one shadow event; no local model or internet requirement for the base game. Profile privacy behavior and CPU/memory impact, especially on modest hardware.

**Milestone D — Picture and mystery:** After a user deliberately drops an image into the *world layer*, create a removable proxy. With separate permission, describe the image via local vision or user text and let nearby characters react. A small bounded incident log can let characters later reference a former event.

**Milestone E — Optional macabre skin:** Add user-invoked simulated falls, reversible decorative damage, differing theories, and ambient school-world storytelling. Keep it separate from the default cozy mode, support reduced effects, and ensure that simulated harm cannot affect real workspace data.

**Milestone F — Authoring and portability:** Import/export editable Tiled-style maps and validated world packages; make gates, collisions, spawn points, NPC profiles, lighting, and interaction destinations authored data rather than code.

### Non-negotiable acceptance tests

- Actual editable frames keep focus and text selection; gameplay keystrokes never fire while a real text/document control is active.
- Shadows and decorative objects never alter the underlying PDF/DOCX/image bytes.
- The user can disable the world, avoid image analysis, and open every legitimate document through standard SUBSTRATE navigation.
- A weak device can run the cozy deterministic scene without an LLM, vision model, elaborate physics, or a full 3D renderer.
- Every imported map can be changed or replaced without changing canonical desktop/frame IDs; invalid maps fail safely.
- All world damage is reversible fiction; ordinary editing, saves, recovery, and permissions remain authoritative.

**The pitch:** You are moving files around. In the academy underneath, this may become the greatest unsolved mystery in their history. The computer remains useful; the world makes it strange.
