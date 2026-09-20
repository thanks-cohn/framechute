# WORLDS (R)END — Omni Behavior Language and the Book of Behaviors
## Turning natural-language direction into reusable, physically grounded actions

**Status:** Design proposal. This is not an implemented NPC runtime.  
**Applies to:** SUBSTRATE / FrameChute Omni World architecture.  
**Companion:** `Proposals/omni-world-engine-neutral-2-5d-worlds-rend.md`.

## 1. Purpose: direct the performance, let the world perform it

A creator, user, pre-programmed behavior rule, local compact model, or opt-in remote LLM can describe an intention in human language, for example:

> “The villagers funnily and hastily move out of the shadow's reach.”

SUBSTRATE should translate this to a **typed, validated, renderer-neutral behavior instruction**, not ask an LLM to produce every animation frame or manually assign every villager a coordinate. The world model already knows the ground plane, projected shadow polygon, walkable area, characters' positions, goals, perceptions, capabilities, and nearby destinations. An action planner selects reachable locations **outside the current or predicted shadow**, calculates feasible paths and timing, and conveys expressive instructions such as “hasty” or “comical” to the active renderer/animation adapter.

The engine decides *what can physically happen*; the creative direction decides *what kind of performance is desired*. The language should remain usable with the native lightweight renderer, Phaser, future low-poly 3D worlds, and approved external game-builder integrations. Rendering and simulation need not reproduce identical animation frames across engines, but should preserve the same validated intention and outcome.

## 2. End-to-end semantic pipeline

1. **World event and perception:** register meaningful, bounded events (shadow approaching, character enters shade, image opens, location entered). Resolve each NPC's actual position, visibility/occlusion, perception scope, world revision, and constraints. Characters do not magically know the contents of private files or invisible objects.
2. **Intent source:** local rules and behavioral templates first; a compact user-connected local LLM or optional remote model may propose novel interpretation, dialogue, or behavior on permitted events. Human-authored natural language uses the same compilation path.
3. **Language compilation:** map prose to a schema with known actor selectors, typed intents, targets, destination predicates, modifiers, preconditions, fallback, and duration. Ambiguous or unsupported requests return a validation error or request clarification. Do not silently invent new executable verbs.
4. **World validation:** check the proposed intent and actor selection against permission, current authoritative geometry, character roles/capabilities, safety policy, available actions, and current world revision.
5. **Plan and execute:** pathfind/determine appropriate destinations, choose animation primitives, group coordination, and timing through the selected renderer adapter. Do not create a second authority for frame geometry or world coordinates.
6. **Observe and learn:** record accepted/rejected proposals, actual outcome and causal metadata, using bounded event traces. Store reusable generalized behaviors only after validation and evaluation; do not treat a plausible LLM suggestion as a verified world law.

Example intermediate representation (illustrative and subject to schema versioning):

```json
{
  "schemaVersion": 1,
  "intent": "evade",
  "actors": {
    "group": "nearby-villagers",
    "perceptionPredicate": "shadow-approaching"
  },
  "target": {
    "kind": "environmental-region",
    "id": "shadow-001"
  },
  "destination": {
    "predicate": "outside-predicted-shadow",
    "preference": "reachable-nearby-safe-area"
  },
  "performance": {
    "urgency": "high",
    "style": "comical",
    "coordination": "loose-group"
  },
  "fallback": "seek-nearest-permitted-shelter"
}
```

This record is not source code, not an absolute coordinate list, and not a grant of access to files. The compiler resolves natural-language synonyms to a finite set of documented meanings; the simulation applies those meanings to live world state.

## 3. What the world must supply

**Spatial grounding:** canonical local/block/world coordinates; plane and platform geometry; camera/projection transforms; occluders, lighting and shadow polygons; character hitboxes and collision; navigable regions; available destinations. A projected shadow is geometry, not a CSS box-shadow and not proof that a 2D image has complete 3D geometry.

**Perception grounding:** the approaching shadow must be perceivable by the actors selected. The NPC may see darkness rather than understand the object's actual contents or cause. Character knowledge, temperament, memory, and localized events matter.

**Goal grounding:** distinguish `evade(shadow)` from `avoid(shade)`, `leave-current-region`, `flee-danger`, or `seek-sunlight`. A merchant might intentionally seek shade while a startled villager leaves it; do not derive one universal emotional response from the shadow alone.

**Time grounding:** if a shadow moves, plan against its predicted footprint and velocity over a bounded horizon; recompute when the light/caster/terrain changes. Stale plans must be rejected or safely revised. If no reachable destination exists, report failure or play a suitable blocked/hesitation behavior—do not teleport, clip through walls, or claim success.

**Expressive grounding:** `comical`, `frantic`, `subtle`, `cautious`, `celebratory`, etc. are performance modifiers consumed by an animation policy, not changes to permission, collision, physical size, or document data. A comical flee could vary speed, turn anticipation, stagger, look-back, gesture, or character spacing, but must not assume all sprites or renderer backends have the same assets.

## 4. The controlled action language

Start small, type each action, and expand only with tested verbs. Initial intentions can include `observe`, `approach`, `evade`, `move`, `gather`, `inspect`, `speak`, `interact`, and `wait`. Structured selectors may target a named actor/group, a tagged role, a sensed region, a light/shadow source, or a permitted world object.

Modifiers may include urgency, mood, character-specific variation, grouping, performance style, action budget, timing, and fallback. Outcomes should be explicit: accepted, rejected, running, succeeded, interrupted, failed, or expired, with machine-readable reasons.

The low-level runtime resolves goals into existing animation/movement primitives and validated world commands. An LLM or imported “book” must **not** emit arbitrary JavaScript, direct filesystem operations, unbounded loops, anonymous network calls, privileged permission changes, or unsandboxed engine-specific code. Files and app launches are separate, explicit, user-authorized world actions.

Provide a documented adapter contract for Phaser: receive a validated plan, map canonical object IDs to local sprite IDs, play the available animation primitives, report observed outcome, and reconcile position back to the authoritative world state. The same contract may later support a 3D, toon, or native low-cost renderer.

## 5. The Book of Behaviors: reusable knowledge rather than replayed choreography

Store generalized and versioned behavior templates. A record should include:
- stable behavior ID and schema version;
- source (built-in curated rule, user-authored, local model proposal, remote provider suggestion);
- event/context predicates, character role/personality applicability, and perception preconditions;
- goal/destination predicates and expressive modifiers, not one-off hardcoded x/y destinations;
- allowed actions, safety/permission bounds, fallback and invalidation conditions;
- provenance, validation/evaluation status, observed outcome(s), and revision history;
- optional private character memories held separately from shareable general rules.

For example, “a merchant in warm weather may move a virtual stall toward reachable shade if customers are nearby” is a reusable conditional behavior. “Move merchant-01 to coordinate (120,85) whenever PDF-7 opens” is a brittle scene recording, not generalized knowledge.

Cache common, validated responses keyed by the relevant *semantic conditions and schema/model version*, not by the precise original phrasing alone. On a repeated event, evaluate those conditions anew against current state. Do not cache authorization decisions as permanent permissions. Private scene history, tags, document metadata, and model-generated interpretations must remain subject to their original privacy scopes.

Unfamiliar behavior can be proposed by a user's connected local or remote model, but must pass schema validation, sandboxed trial/evaluation where applicable, and explicit approval rules before the “book” adopts it. For the first release, prefer interpretable behavior trees/utility rules and templates over claiming to train a new neural model; truly trained lightweight selectors may be introduced after collecting and assessing a suitable example set.

## 6. Intelligence budget and routing

Local deterministic logic handles geometry, shadow projection, navigation, ordinary character routines, and familiar responses. Connected models are **optional**: primarily for unfamiliar scenes, richer character-specific interpretations, dialogue, or synthesis of new candidate behavior templates. Let users connect their own local model (including an authenticated local-network model) or explicitly choose an external provider.

Minimize cost using event deduplication, one scene-level semantic interpretation shared with affected NPCs, contextual templates, cached validated outcomes, and bounded compact requests. Do not send the entire canvas, complete PDFs, filenames, private images, or screenshots by default. Image analysis requires an authorized relevant capture or tagged asset; treat descriptive tags and vision output as untrusted content, never executable instructions.

Offer visible request/token and budget policies with user-selected caps and truthful caveats about what the provider's metering permits. If the budget or provider is unavailable, NPCs gracefully use the offline book and ordinary rules; documents and controls continue to work. Do not promise an exact monetary ceiling where provider usage cannot be measured or capped reliably.

Remote provider billing and referral attribution are commercial integrations requiring actual agreements; do not assume arbitrary API metadata confers referral credit. The core world should remain useful with no AI provider at all.

## 7. World authoring and observable debugging

Expose the semantic language to world builders and authorized agents programmatically, as well as through an optional plain-language editor. Users may author: “When the library window blocks the village square, make the nervous villagers run hilariously out of the shadow, but have the merchant move his stand into it.” The compiler emits a preview of validated actor selectors, predicates, intended outcomes, and animation requirements before running.

Provide inspectable traces for: input intent → parsed schema → perceived scene revision → actor selection → computed destinations → plan approval/rejection → engine adapter output → actual results → optional validated behavioral memory. Allow replay of deterministic test scenes without requiring an LLM. Keep diagnostic exports privacy-filtered; neither online visitors nor third-party world packages gain automatic access to the user's private workspace events.

Future shared worlds may synchronize validated semantic actions rather than sending every animation frame; distinct rendering backends can express a common event with their own visual style, but the shared authority decides the accepted world-state change.

## 8. Phased implementation and a concrete test

**A — current Omni World foundation:** establish the projected plane, light, moving frame shadow, and agent-inspectable geometry before attempting NPC reasoning.

**B — minimal behavior compiler:** hand-author an `evade` command with `outside-shadow` destination predicates, one or two controlled performance modifiers, and a few deterministic villagers. No LLM required. Test movement against a real moving projected shadow.

**C — Book v1:** store a small curated behavior set, conditional matching, validation results, versioned memory, and fallback; let a user author equivalent structured rules.

**D — optional natural-language/LLM bridge:** compile one typed command from text and support user-connected model proposals under clear limits. Verify repeated known scenes execute without another model request.

**E — richer worlds:** community-defined characters, Phaser/3D animation adapters, personal character histories, group choreography, longer plans, and controlled world sharing.

**Acceptance example:** A PDF frame moves above Sketch Town, and its moving projected shadow approaches three villagers. The engine identifies only the villagers that perceive the shadow; it picks reachable positions outside the shadow, makes them move hastily with a comical animation where assets permit, and reports actual outcomes. The merchant is allowed to seek shade instead according to a different role rule. Repeating the scene reuses local behavioral knowledge without requiring remote inference. Opening/editing the PDF remains normal and readable throughout.

**Final principle:** A model or human directs the performance in understandable language; SUBSTRATE's semantic book remembers what works; the world engine validates what is possible; any compatible renderer expresses the action beautifully, without making the user's documents or computer depend on an LLM.
