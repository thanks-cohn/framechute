# Proposal: History Rich Mode — Semantic Chronicle, Versioning, and Learned Working Grammar

## Summary

SUBSTRATE should support an optional **History Rich Mode** that preserves the process of making a document, not only the document's current state.

Ordinary Undo / Redo should remain lightweight session functionality.

History Rich Mode should be separate, persistent, explicitly opt-in, and OFF by default.

When enabled, SUBSTRATE should preserve a semantic chronicle of meaningful document changes:

- text revisions
- structural rearrangements
- object movement and resizing
- layout choices
- version landmarks
- agent proposals
- accepted, rejected, and modified suggestions
- provenance
- repeated user overrides
- document-type-specific working preferences

The central principle is:

> **The final artifact shows what survived. History Rich preserves how it became that artifact.**

Over time, this history can support increasingly strong statistical models of how a user writes, lays out, revises, organizes, and transforms work.

The purpose is not to claim access to a person's inner thoughts.

The purpose is to preserve rich evidence of the creative and editorial process in a structured, inspectable form.

---

## 1. Separate Undo / Redo From Persistent History

SUBSTRATE should not overload ordinary Undo / Redo with long-term behavioral recording.

Normal mode remains simple:

~~~text
CURRENT DOCUMENT
+
SESSION HISTORY
    ↓
Undo / Redo
~~~

The editor keeps only the state required for ordinary interaction and recovery.

History Rich Mode adds a distinct persistent layer:

~~~text
SUBSTRATE DOCUMENT
│
├── Current Semantic State
│
├── Session History
│      └── Undo / Redo
│
└── History Rich Chronicle [optional]
       ├── semantic mutations
       ├── provenance
       ├── versions
       ├── agent interactions
       └── preference evidence
~~~

This distinction should remain architectural, not merely visual.

Undo history answers:

> "How do I reverse what I just did?"

History Rich answers:

> "How did this work evolve?"

---

## 2. History Rich Is OFF by Default

History Rich Mode should be explicitly opt-in.

Default:

~~~text
History Rich [ OFF ]
~~~

Enabling it should clearly explain that SUBSTRATE will preserve detailed revision history beyond ordinary Undo / Redo.

The wording should be plain.

Example:

~~~text
History Rich [ OFF ]

When enabled, SUBSTRATE preserves detailed document
revision history beyond normal Undo / Redo.

History may include:
• text revisions
• object movement
• layout changes
• document versions
• agent suggestions and responses
~~~

The user should understand what is being preserved before enabling it.

Enabling History Rich is permission to preserve history.

It is not automatically permission to upload, share, or train external models on that history.

---

## 3. Record Semantic Mutations, Not Raw Noise

The Chronicle should prefer meaningful semantic mutations over an enormous stream of raw keystrokes.

Instead of:

~~~text
typed H
typed e
typed l
typed l
typed o
~~~

prefer:

~~~text
mutation: text-edit
object: paragraph:183

before:
"Earlier wording"

after:
"Revised wording"

actor:
human

cause:
direct-edit
~~~

Likewise:

~~~text
mutation: object-move
object: figure:17

from:
after cluster:8

to:
after cluster:11
~~~

or:

~~~text
mutation: layout-change
object: section:4

before:
section-gap = 12pt

after:
section-gap = 18pt
~~~

The Chronicle should preserve the meaning of the action whenever the engine already knows it.

Raw event data may exist transiently for diagnostics, but the persistent record should favor semantic changes.

---

## 4. Stable Object Identity Is the Foundation

History Rich depends on stable object identity.

If a paragraph is edited, moved, split, merged, or restored, SUBSTRATE should retain lineage.

Example:

~~~text
paragraph:183
    ↓
edited
    ↓
split into
    ├── paragraph:183a
    └── paragraph:183b
             ↓
       moved to section:7
~~~

This permits the Chronicle to answer:

- where an object came from
- what it became
- which version introduced it
- which later objects derive from it
- which agent or human changed it
- whether a change was later reversed

The Chronicle should build on the same stable identity system used by the document model and agent API.

---

## 5. Versions Are Landmarks, Not the Whole History

History Rich should distinguish continuous semantic history from named or automatic document versions.

Conceptually:

~~~text
mutation
mutation
mutation

      ↓

VERSION 1
"First complete draft"

mutation
mutation
mutation

      ↓

VERSION 2
"Sent for review"

mutation
mutation

      ↓

VERSION 3
"Final"
~~~

A version is a landmark in the Chronicle.

The user should be able to:

- name versions
- compare versions
- restore a version
- inspect changes between versions
- ask an agent what materially changed
- preserve current truth independently of historical truth

Version history must never leak stale historical objects into the live document.

Historical state is data.

Current state is the interactive document.

---

## 6. Human and Agent Actions Share the Same Chronicle

The Chronicle should record the actor responsible for a meaningful mutation.

Examples:

~~~text
actor: human
actor: agent:jarvis
actor: agent:codex
actor: import
actor: layout-engine
~~~

An agent action authorized by the user should still be distinguishable from direct human action.

Example:

~~~text
mutation: text-replace
actor: agent:jarvis
actingFor: user
object: paragraph:183
~~~

This gives SUBSTRATE:

- causal history
- better undo explanations
- agent evaluation
- provenance
- future token/accountability support

The system should be able to say both:

> "This change had the user's authority."

and:

> "Jarvis performed it."

---

## 7. Agent Proposals Are Especially Valuable History

Agent suggestions should be first-class Chronicle events.

Possible outcomes include:

~~~text
proposal created
→ accepted
~~~

~~~text
proposal created
→ rejected
~~~

~~~text
proposal created
→ modified
→ accepted
~~~

~~~text
proposal created
→ partially accepted
~~~

A proposal record may include:

- target object IDs
- proposed semantic operation
- before state
- proposed state
- final accepted state
- acceptance/rejection status
- time
- agent identity
- user modifications

This creates unusually rich preference evidence.

Repeated rejection is informative.

Repeated partial acceptance is informative.

Restoring original language after an agent rewrite is informative.

These signals should be available to future personalization logic when the user permits it.

---

## 8. History Rich Enables Behavioral Layout Learning

The Chronicle should integrate naturally with SUBSTRATE's professional-default layout system.

Suppose the engine repeatedly proposes:

~~~text
image placement:
right-of-cluster
~~~

and the user repeatedly moves it:

~~~text
below-cluster
~~~

The Chronicle can observe a pattern.

Over enough examples, SUBSTRATE can estimate:

~~~text
P(preferred-placement = below-cluster
  | document-type,
    image-role,
    nearby-cluster-structure,
    user-history)
~~~

Likewise it can learn tendencies such as:

- preferred section spacing
- preferred paragraph width
- preferred image placement
- preferred caption placement
- preferred margin density
- preferred heading/body spacing
- preference for one column vs two
- willingness to accept automatic reflow

The professional default remains the prior.

User behavior gradually adjusts the scoring.

---

## 9. Learn a Working Grammar, Not Merely a Style Sheet

The long-term goal is richer than saving static settings.

SUBSTRATE should be capable of learning patterns such as:

~~~text
WRITING
- expands early drafts
- compresses conclusions later
- frequently restores unusual wording
- rarely accepts full-paragraph rewrites
- often accepts structural rearrangement

LAYOUT
- prefers wider margins in essays
- usually places figures below explanatory clusters
- prefers larger section gaps
- rarely uses narrow side columns

WORKFLOW
- drafts body before final headings
- rearranges sections late
- inserts images after structure stabilizes
~~~

These are not deterministic rules.

They are statistical tendencies supported by observed behavior.

The system should preserve confidence and evidence counts rather than pretending every inferred preference is absolute.

---

## 10. Context Matters

A user's behavior may differ substantially by document type.

The system should avoid collapsing all decisions into one universal profile.

Examples:

~~~text
Academic Paper
→ denser layout
→ fewer images
→ formal headings

Personal Essay
→ more whitespace
→ larger section breaks
→ expressive pull quotes

Technical Specification
→ tables
→ compact hierarchy
→ diagrams near explanatory text
~~~

Preference learning should therefore condition on context where possible:

~~~text
user
document type
semantic role
neighbor relationships
layout state
action type
~~~

The same user may legitimately have several different working grammars.

---

## 11. Professional Defaults Remain the Prior

A new user should not need history before SUBSTRATE can produce a good document.

The layout system should begin from professional defaults and document-format priors.

Conceptually:

~~~text
GLOBAL PROFESSIONAL PRIOR
        ↓
DOCUMENT-TYPE PRIOR
        ↓
USER LEARNED PREFERENCE
        ↓
CURRENT DOCUMENT CONTEXT
~~~

The user's learned behavior should bend the default over time.

It should not erase basic document laws.

For example, repeated user preference should not silently normalize accidental collisions as good layout.

Hard constraints remain distinct from soft aesthetic preferences.

---

## 12. Confidence Before Adaptation

SUBSTRATE should not radically change behavior because of one unusual action.

Preference inference should accumulate evidence.

Example:

~~~text
preference:
image-placement = below-cluster

observations:
31

confidence:
0.84
~~~

A single override may be noise.

Repeated similar overrides become a signal.

The engine may gradually increase the user-specific component of layout scoring as confidence rises.

This produces personalization without making the system unpredictable.

---

## 13. The Final Document Is Only One Projection

A conventional document format mainly preserves the current artifact.

A History Rich SUBSTRATE source can preserve more:

~~~text
DOCUMENT
=
content
+ semantics
+ layout
+ provenance
+ revision lineage
+ versions
+ agent interactions
+ user decisions
~~~

The exported PDF or DOCX may remain clean and conventional.

The rich Chronicle can remain in:

- the SUBSTRATE workspace
- a WEBX source package
- sidecar metadata
- an explicit History Rich archive

The public artifact does not need to expose the entire working history unless the user chooses to include it.

---

## 14. WEBX Should Be Able to Preserve the Chronicle

WEBX should eventually be capable of representing History Rich documents natively.

A possible package direction:

~~~text
document.json
styles.json
assets/
provenance/
history/
    mutations.jsonl
    versions.json
    proposals.json
preferences/
    evidence.json
~~~

The exact schema should remain flexible until real editing experience informs it.

The important law is:

> **Current truth and historical truth must remain explicitly distinguishable.**

History must never become accidental live content.

---

## 15. A Semantic Chronicle Is Better Than Screen Recording

A screen recording can show what changed visually.

It cannot reliably explain what the engine understood.

History Rich can record:

~~~text
object: paragraph:183
action: move
semantic-parent-before: section:3
semantic-parent-after: section:5
reading-order-before: 8
reading-order-after: 3
~~~

This is far more useful to:

- agents
- version comparison
- user-learning systems
- research
- debugging
- document restoration

Where possible, Chronicle entries should contain semantic identity and relationships rather than only pixels.

---

## 16. The Process Can Reveal More Than the Final Draft

Two final strings may be identical while their histories are very different.

Example final sentence:

~~~text
"I loved him."
~~~

History A:

~~~text
typed once
never changed
~~~

History B:

~~~text
"I cared for him."
"I thought I loved him."
"I hated that I loved him."
"I loved him despite everything."
"I loved him."
~~~

The final artifact contains the same visible sentence.

The histories reveal very different revision processes.

History Rich should preserve this distinction without claiming that revision history is equivalent to private thought.

The Chronicle is evidence of process, not a mind-reading system.

---

## 17. User Control Is a Core Requirement

Because History Rich can become unusually revealing, the user must retain unusually clear control.

At minimum, the user should be able to:

- enable History Rich explicitly
- disable it
- inspect what is being stored
- export it
- delete it
- set retention
- exclude a document
- exclude a workspace
- reset learned preferences
- use professional defaults instead of learned preferences

Possible future controls:

~~~text
Learn from this document
Do not learn from this document

Keep Chronicle
Delete Chronicle

Use my learned layout
Use professional defaults
~~~

History capture and preference learning should be independently controllable if practical.

---

## 18. Local-First by Default

History Rich should be local-first unless the user explicitly chooses otherwise.

The Chronicle may contain:

- unfinished language
- rejected arguments
- abandoned ideas
- private notes
- editorial uncertainty
- agent conversations
- document structure over time

That makes it substantially more sensitive than a final exported document.

The safest default architecture is:

~~~text
record locally
→ user controls export/share
→ external use requires separate permission
~~~

Enabling History Rich must not imply consent to model training.

---

## 19. Retention Should Be Configurable

Not every user will want permanent history.

Possible retention policies:

~~~text
Keep indefinitely
Keep 1 year
Keep 90 days
Keep until document closes
Keep named versions only
Keep semantic summaries only
~~~

A future compaction system may summarize dense low-value history while preserving major semantic transitions.

For example:

~~~text
1,200 micro-edits
→ compacted into
"paragraph:183 revised repeatedly over 22 minutes"
+
major retained semantic checkpoints
~~~

Compaction should never silently destroy explicitly named versions.

---

## 20. Chronicle Queries Should Be Agent-Friendly

The agent API should eventually expose History Rich through structured queries.

Examples:

~~~text
history.getVersions(documentId)

history.getMutations({
  objectId: "paragraph:183"
})

history.diff({
  fromVersion: "draft-1",
  toVersion: "final"
})

history.explain(objectId)

history.getRejectedProposals()

history.getPreferenceEvidence({
  kind: "image-placement"
})
~~~

An authorized agent should be able to answer:

- what changed
- when it changed
- who changed it
- what was rejected
- what was restored
- what repeatedly gets overridden
- what differs between versions

without reconstructing this from screenshots.

---

## 21. History-Aware Agent Assistance

With sufficient user-approved history, an agent can become more useful.

Examples:

> "Format this the way I usually format essays."

> "Show me the places where I kept restoring my original wording."

> "Compare this revision process with my previous three technical documents."

> "Which kinds of edits from agents do I usually reject?"

> "Finish the layout using my usual image placement."

These requests should be grounded in actual Chronicle evidence rather than vague personality assumptions.

---

## 22. History Rich Can Support Process Research

With explicit consent, History Rich archives could support research into creative and editorial processes.

Potentially observable phenomena include:

- idea expansion and compression
- structural rearrangement
- revision frequency
- vocabulary restoration
- layout preference
- proposal acceptance patterns
- document-type-specific workflows
- transition from rough structure to final structure

This can provide richer data than corpora containing only final artifacts.

A final corpus teaches:

~~~text
finished artifact
~~~

A process-aware corpus may expose:

~~~text
draft
→ revision
→ rejection
→ restructuring
→ refinement
→ finished artifact
~~~

Any external research or training use must require explicit permission separate from merely enabling History Rich.

---

## 23. History Rich and the Agent-Oriented SUBSTRATE API

History Rich should be designed alongside the agent-oriented API.

The same command system should ideally produce Chronicle entries.

Conceptually:

~~~text
Human UI
    │
    ├── MoveCommand
    │
    └── ReplaceTextCommand
    │
    ▼
SUBSTRATE CORE
    │
    ├── mutate current truth
    ├── update layout/render state
    └── emit Chronicle event
    ▲
    │
Agent API
~~~

This avoids a second history system for agents.

The rule should be:

> **One semantic command path, one current truth, one optional Chronicle.**

---

## 24. History Rich and the Layout Grammar

The proposed professional layout system and History Rich should reinforce one another.

The layout engine can produce candidate arrangements.

The Chronicle can record:

- which candidate was selected
- whether the user changed it
- what they changed it to
- whether the same change recurs

Over time:

~~~text
professional prior
+
format prior
+
learned user evidence
=
personalized candidate scoring
~~~

This is how SUBSTRATE can learn a user's working grammar without making the layout engine opaque.

---

## 25. Hard Rules vs Learned Preferences

History Rich should never blur the difference between:

- legal layout constraints
- aesthetic priors
- user preferences

For example:

~~~text
HARD LAW
text must not accidentally overlap unrelated text

SOFT PRIOR
figures often look good between clusters

USER PREFERENCE
this user usually prefers figures below the related cluster
~~~

The user preference may modify the soft prior.

It should not silently disable the hard law.

This separation keeps learned behavior understandable.

---

## 26. Explainability

Any learned preference should be explainable.

Example:

~~~text
Preference:
Place explanatory figures below their text cluster

Confidence:
0.87

Evidence:
34 comparable placements

Observed overrides:
right → below: 19
inline → below: 8
accepted below suggestion: 7
~~~

An agent or user should be able to inspect why SUBSTRATE believes a preference exists.

The system should avoid unexplained personalization.

---

## 27. Proposed Chronicle Record Shape

A future semantic record may resemble:

~~~json
{
  "mutationId": "mutation:99182",
  "documentId": "document:essay",
  "objectId": "paragraph:183",
  "actor": "human",
  "action": "replace-text",
  "cause": "direct-user-action",
  "before": {
    "text": "Earlier wording"
  },
  "after": {
    "text": "Revised wording"
  },
  "versionBefore": "draft:3",
  "versionAfter": "draft:3",
  "timestamp": "..."
}
~~~

A layout record may include:

~~~json
{
  "mutationId": "mutation:99183",
  "objectId": "figure:17",
  "action": "move",
  "before": {
    "relationship": "right-of-cluster:8"
  },
  "after": {
    "relationship": "below-cluster:8"
  },
  "actor": "human"
}
~~~

The exact serialization can evolve.

Stable semantics matter more than final field names at this stage.

---

## 28. Performance

History Rich must not turn every editing action into an expensive global analysis.

The Chronicle should be append-oriented and bounded in hot paths.

Desired properties:

- no all-document scan per keystroke
- semantic coalescing of rapid edits
- asynchronous persistence where safe
- compact records
- lazy history loading
- version snapshots only when useful
- heavy statistical inference outside pointer-move/input hot loops

Normal mode should remain essentially unaffected when History Rich is OFF.

---

## 29. Minimal First Implementation

A first useful version does not require full behavioral learning.

V1 can be:

~~~text
History Rich toggle
+
persistent semantic mutation log
+
stable actor/object IDs
+
named versions
+
version diff
+
export/delete controls
~~~

V2 can add:

~~~text
agent proposal records
+
preference evidence extraction
+
basic statistical profiles
~~~

V3 can add:

~~~text
context-sensitive learned layout scoring
+
history-aware agent assistance
+
WEBX-native Chronicle packaging
~~~

The architecture should leave room for all three without forcing V1 to solve everything.

---

## 30. Success Definition

History Rich succeeds when a user can choose to preserve the process behind a document and later ask meaningful questions about that process.

Examples:

~~~text
"What changed between Draft 2 and Final?"

"Show me every paragraph I restored after an agent rewrite."

"How did this section evolve?"

"Which layout suggestions do I usually override?"

"Format this using patterns I consistently kept in previous reports."
~~~

The answers should come from structured document history rather than screenshots or vague inference.

---

## Final Principle

A normal file records a result.

A History Rich document can record a result **and the semantic path that produced it**.

The long-term principle is:

> **The artifact is valuable. The history of becoming the artifact can be valuable too.**

SUBSTRATE should preserve that history only when the user explicitly asks it to, keep it distinguishable from current truth, and make it useful to both humans and authorized agents.
