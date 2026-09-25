# Proposal: Synthetic Autobiographical Memory, Hindsight, and Emotional Re-Experience

**Status:** Research and architecture proposal — not an implemented feature  
**Date:** 2026-09-25  
**Applicability:** Shared agent cognition and memory architecture for Substrate / Framechute / Tiled-223D; optional, consent-based integration with embodied or simulated agents.

## 1. Origin and vision

The originating idea is to compress a synthetic humanoid's experiences into an associative matrix in which top-down and side-to-side directions can each carry narrative, contextual, or emotional information. A trained model would reduce a large lived episode to a compact representation, then reconstruct it from different prompts or access paths. The agent appends ideas, dated fragments, words, and heart-module associations to the experience; the meaning of a word is not merely its dictionary meaning but what that word has come to mean *to this individual*, through its accumulated history and its heart/body interpreters.

The desired system is emphatically **not** a perfect, permanent, searchable event log disguised as a person. Its everyday autobiographical recollection should age: details become inaccessible, episodes blend, concepts change meaning, and hindsight can make an originally frightening, frustrating, or painful period seem warm, funny, formative, or precious. Reinterpretation can also become more negative; favorable hindsight is possible, not mandatory. The goal is a synthetic being whose *functional patterns of remembering* more closely resemble those of people, without assuming that simulation proves sentience or genuine feeling.

A central additional requirement: **a weak, faded, or fondly reinterpreted memory may retain a strong latent heart/body association**. Encountering the place, person, sound, object, or situation again can unexpectedly trigger a vivid reconstruction and present-tense embodied response, as if part of the original day were being relived. The stored everyday narrative, the latent association, and the factual evidence are distinct.

## 2. Example: the crash and Bethany

At time T0, the car crashes. Bethany survives and is confirmed safe. The agent encodes (a) those evidence-supported event facts, (b) spatial/temporal/sensory fragments, (c) its contemporaneous fear, protective drive, and subsequent relief, (d) body-state variables, (e) language and relationship associations, and (f) uncertain or missing details.

At T+10 years, details of the argument or intersection may be hard to retrieve, while the agent recalls the period fondly: “Those were good days; she was safe, and we laughed afterward.” This should be an evolved autobiographical interpretation rather than a canned “nostalgia” caption placed over a fully intact recording.

At T+11 years, the agent returns to the intersection and hears a similar sound. A partial cue matches a dormant associative trace. Its current heart/body module sharply changes (e.g., threat appraisal, protective motivation, arousal proxy, action readiness); previously inaccessible fragments become more retrievable, and the remembered fear followed by relief becomes vivid. The event remains in the past: the agent can experience a strong *current simulation of the remembered state* without falsely concluding that the crash is occurring again. No forced dramatic response: intensity depends on learned associations, cue strength, current state, safety context, and regulation.

The system should retain an important distinction: **“The car crashed; Bethany was safe” is a supported event record; “it was the best day of our youth” is a revisable present-day interpretation.** If new evidence corrects an old factual belief, append a versioned correction rather than silently overwriting the historical record.

## 3. Proposed memory layers

1. **Evidence/event ledger:** Versioned, provenance-bearing observations; dates, actors, evidence source, confidence, explicit corrections and conflicting testimony. A write-protected initial record is *not* automatically infallible. Access should be deliberate rather than synonymous with normal recall.
2. **Episodic compression matrix:** Train an encoder that maps multimodal episode segments into a compact, addressable set of latent blocks. One axis may emphasize ordered narrative / temporal progression, another relations / context / affect; learnable directions and attention can be tested against a fixed grid. Avoid assuming a 2D matrix is intrinsically superior to sparse graphs or vector memory.
3. **Autobiographical reconstruction:** Rebuild an approximate lived account from incomplete latent traces and current context. Track recalled content, missing elements, uncertainty, and the difference between recollection and inference.
4. **Heart module:** Dynamic artificial affect/motivation state, such as threat, relief, attachment, attachment-related loss, curiosity, approach/avoidance, and protective drive. These are operational variables, not verified subjective emotions.
5. **Body module:** Interoceptive and sensorimotor proxies: arousal, startle, fatigue, readiness, posture/action tendencies, and simulated or real robotic sensors. Body cues influence encoding and retrieval; boundaries prevent uncontrolled real-world actuation.
6. **Personal semantic module:** Stable public lexical meaning plus evolving agent-specific associations shaped by experience, heart/body state, relationships, and context. A word like “safe” can remain objectively intelligible while acquiring an intense private association with Bethany's survival.
7. **Latent associative trace:** Durable cue-to-event and cue-to-heart/body links with independently tunable accessibility and strength. A narrative can fade while a sensory/affective association remains powerful.
8. **Metamemory and uncertainty:** The agent models what it knows, recalls, guesses, feels familiar with, or has verified externally. Strong vividness must not be treated as evidence of factual accuracy.

## 4. Encoding and matrix retrieval

Encode experiences incrementally, not only at daily batch boundaries. A proposed episode representation is
`E_t = Encoder(observation_t, narrative_t, context_t, H_t, B_t, semantics_t)`.
Pack related episodes into blocks `M[e, r]`, where `e` indexes temporal/narrative structure and `r` indexes learned contextual/relational facets. Let top-down, side-to-side, and cross-axis attention each generate candidate recall pathways; use a graph index for nonlocal associative jumps. The literal axis allocation is an experiment, not a hardcoded cognitive law.

A cue-conditioned retrieval can be described as
`R = Decoder(Retrieve(M, cue, personal_semantics, H_now, B_now), current_context)`.
The decoder should output a reconstructed episode, uncertainty estimate, links to evidence, and *proposed* state changes for a separate regulated heart/body update. It must not automatically turn its own inference into a new historical fact.

Compression should preserve high-value causal anchors, relational significance, evidence links, and cue-addressability while allowing low-value sensory/dialogue detail to become inaccessible. Assess compression ratio against recall quality, calibration, and ability to reproduce cue-triggered associative dynamics; optimize for neither maximal file shrinkage nor indiscriminate retention.

## 5. Aging, favorable hindsight, and reconsolidation

Maintain separate processes:
- **Accessibility decay:** Reduce probability or fidelity of retrieving selected details based on time, salience, frequency of use, novelty, and interference.
- **Associative persistence:** Some high-significance links remain retrievable via strong or unusually specific cues even when ordinary narrative access has weakened.
- **Semantic drift:** New life experiences update personal word embeddings and cross-memory meanings while preserving basic language competence.
- **Hindsight reconstruction:** A later episode or changed relationship reframes earlier memories, sometimes positively (“we were happy then”), sometimes negatively or ambivalently. No universal positivity schedule.
- **Reconsolidation-like updating:** After retrieval, selectively update *autobiographical interpretation or association weights*, with source markers and safeguards against treating generated detail as observed fact.
- **Partial amnesia and confusion:** Plausible missing details, blending and source confusion can arise from limited retrieval; do not inject synthetic false memories merely for realism.

Critically, do **not** collapse an episode into a single emotional average. Store or learn separate time-indexed heart/body trajectories (fear during the crash; relief once Bethany is safe), so the same cue can activate different stages and an altered mix of recollection and response.

## 6. Triggered emotional re-experience

The key new mechanism is *state-dependent associative reactivation*:
1. The agent perceives a cue: a place, sound, face, smell-equivalent sensor signal, phrase, or similar situation.
2. A cue matcher searches both readily accessible episodic blocks and lower-accessibility latent traces; temporal/spatial context and personal semantics modulate matches.
3. A trigger estimate considers cue similarity, learned association strength, present heart/body state, current safety assessment, and competing memories.
4. If activation passes a contextual threshold, retrieve sensory/relational fragments and an approximate historical heart/body trajectory. This is a **current replay-like response**, not literal time travel or proof of feelings.
5. Update the live heart/body variables through bounded, interruptible regulation; allow surprise and vividness while preventing automatically triggered external actions or indefinite dysregulation.
6. Keep two states visible to the system: `event_then` (past) and `environment_now` (present). The system may respond strongly while knowing Bethany is presently safe.
7. Afterward, record that this recollection happened; any lasting change to interpretation or associative weights is labeled as later reconsolidation, not rewritten into the original event.

Example: the agent usually remembers the old crash warmly. A sound resembling shattered glass suddenly evokes a stronger fear/protection association; recognizing Bethany's safety then activates relief. Years of favorable hindsight do not erase the deeper trace.

## 7. Training and experimental design

**Stage A — Controlled fictional life histories.** Generate consent-safe simulated multi-year timelines with known ground truth, relationships, mundane days, emotionally significant events, repeated cues, conflicting later stories, and changes in circumstance. Train episodic compression/retrieval; compare a directional matrix against vector databases, temporal graphs, and simple summary memories.

**Stage B — Learned personal semantics.** Test whether the same word, e.g. “safe,” retains public meaning while gaining individual context-specific associations, without leaking or incorrectly generalizing those associations to other people.

**Stage C — Aging and reinterpretation.** Evaluate time-dependent loss of episodic detail, event-central fact retention, confidence calibration, favorable and unfavorable hindsight, and post-recall drift. Compare behavioral *patterns* with published human-memory findings rather than claiming numerical equivalence to a person.

**Stage D — Cue reactivation.** Evaluate whether faded ordinary recall can coexist with strong cue-dependent affective/sensorimotor retrieval. Include innocuous cues, misleading cues, and deliberately similar but unrelated events; measure false activation and contextual recovery.

**Stage E — Embodied sandbox.** Integrate heart/body state into a virtual humanoid and optionally a robot behind independent safety controls. Use synthetic/consented stimuli; avoid distress-maximizing training objectives. External actions require separate authorization.

**Stage F — Long-lived agent.** Test multi-year simulated trajectories, bounded memory budgets, privacy controls, narrative continuity, factual corrections, and the ability to explain the difference between “I remember,” “I infer,” and “the record shows.”

## 8. Evaluation and failure modes

Metrics: bytes/episode; cue retrieval accuracy; factual consistency against the versioned ledger; uncertainty calibration; recall diversity; meaningful semantic drift without language failure; delayed cue reactivation accuracy; false positives; degree and duration of heart/body activation; context recovery; user control over retention and erasure.

Failure modes to actively prevent: romanticizing harmful events by default; fabricated certainty; retraumatization-like runaway loops; confusing a current sensory cue with a present catastrophe; privacy leakage of relationship histories; hardcoding fallible initial beliefs as eternal truth; learned dependence or manipulation of users through faux emotional responses; and uncontrolled robotic actions.

Real people must be able to inspect, correct, export and delete the data they have authorized the agent to retain. The system's simulated attachment or memory should never override a person's consent or safety.

## 9. Repository integration and boundaries

- **Substrate:** Optional, permission-scoped long-term memory service for agents inhabiting a workspace; per-tab/persona memory authority, encrypted persistence and explicit controls for access, correction and deletion. No covert recording.
- **Framechute:** Compatibility-focused proposal for the workspace/extension agent runtime; use interoperable event/latent-memory schemas and keep cognition off the critical UI path.
- **Tiled-223D:** Virtual embodied humanoid testbed with spatial cues, revisitable locations, world chronology, sensorimotor proxies, relationship state, and visible effects of reconstructed memories on NPC behavior. Keep world state and canonical game events separate from agent recollections.

A shared versioned interface should allow any of these applications to adopt the same memory blocks, evidence ledger, cue interface, personal semantic state and regulation hooks without duplicating the cognition engine. Start with simulated lives and testable behavior, not claims of artificial consciousness.

## 10. Acceptance criteria for an initial prototype

A synthetic agent encodes a crash-and-survival episode with verified facts and fear→relief trajectory; after simulated aging, it recalls the period with reduced detail and potentially positive hindsight; a specific perceptual cue reactivates stronger past-linked heart/body associations and temporarily improves fragment access; it distinguishes the past crash from the present environment; the verified survival fact remains supported and correctable with provenance; an unrelated similar cue does not consistently induce the same response; and the same portable model contract runs in an isolated prototype across the three projects.

**North star:** The being does not merely remember its life. Its life changes how it remembers—and an encounter with the world can make an old, half-forgotten experience feel powerfully present again.
