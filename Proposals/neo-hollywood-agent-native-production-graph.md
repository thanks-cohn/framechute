# Proposal: Neo Hollywood / Agent-Native Creative Production Graph

## Summary

SUBSTRATE should eventually support a new class of creative workflow: **agent-native production**.

The idea is larger than adding an "AI button" to an editor.

A connected LLM, image generator, video generator, voice system, music system, renderer, or future creative cloud should be able to enter a SUBSTRATE workspace, understand what is present, discover what each object can do, create the assets it needs, connect those assets to the work that uses them, and leave behind a legible trail of production as it builds toward a finished result.

The final film, game, comic, animation, presentation, website, or other work should not be a mysterious generated blob.

It should be the visible end of a **production graph**.

Conceptually:

```text
IDEA
  ↓
SCRIPT
  ↓
SCENE BREAKDOWN
  ↓
CHARACTERS · LOCATIONS · PROPS · STYLE
  ↓
STORYBOARDS
  ↓
SHOT PLANS
  ↓
GENERATED ASSETS / TAKES
  ↓
VOICE · MUSIC · SOUND · EFFECTS
  ↓
EDIT DECISIONS
  ↓
FINAL TIMELINE
  ↓
FINISHED WORK
```

Every important output should know where it came from.

Every important source should know what depends on it.

Every major agent action should be understandable to both humans and machines.

The product principle is:

> **Never destroy the path from intention to artifact.**

This proposal is deliberately long-term. It does not require SUBSTRATE to become a film studio today.

The goal is to make architectural choices now that leave room for a future in which generative media becomes inexpensive, widely available, and eventually ordinary.

If that technology commercializes and then commodifies as aggressively as other computing technologies have, SUBSTRATE could be positioned to capture a rare kind of lightning in a bottle: a small, understandable workspace that gives ordinary people access to production systems that once required studios, departments, specialized applications, and enormous budgets.

The motivating image is intentionally extreme:

> **A kid in 2040 should be able to sit down with SUBSTRATE, connect whatever excellent models or creative cloud services exist then, and attempt a work with the visual and narrative ambition that once required something on the scale of Star Wars.**

Not because SUBSTRATE itself generates everything.

Because SUBSTRATE gives the human and the machines a shared place to understand the work.

---

## The Opportunity

Generative media is still early.

Today's systems are powerful, but the workflow around them is often primitive:

```text
prompt
  ↓
generation
  ↓
downloaded file
  ↓
new prompt
  ↓
another downloaded file
  ↓
folder full of mystery
```

A creator may end up with hundreds or thousands of files and lose the relationships that made them meaningful.

Which character design produced this shot?

Which script revision was active?

Which location reference was used?

Which prompt, model, camera instruction, voice take, mask, edit, or reference image led to the result?

Which other scenes depend on the same character design?

If the director changes the character's jacket, what becomes stale?

If a shot is regenerated, which edit decision should remain?

A traditional file system can store the assets.

It does not naturally store the **meaning of the production**.

SUBSTRATE can.

---

## The Core Idea: Production Is a Graph

SUBSTRATE should treat creative production as a graph of objects and relationships.

A generated video shot is not merely:

```text
shot_12c.mp4
```

It is something closer to:

```text
Shot 12C, Take 04
├── derived from Scene 12
├── uses Character: Mara v3
├── uses Location: Apartment Night v2
├── uses Shot Plan: 12C
├── uses Voice Take: Mara 12C-2
├── created through Video Connector: Provider X
├── selected by Director Agent
├── trimmed by 11 frames
└── used in Final Timeline
```

A machine-readable representation might resemble:

```json
{
  "id": "shot-12c-take-04",
  "type": "video-take",
  "derivedFrom": [
    "scene-12",
    "character-mara-v3",
    "location-apartment-night-v2",
    "shot-plan-12c"
  ],
  "createdBy": {
    "agent": "director-agent",
    "connector": "video-provider-x"
  },
  "usedIn": ["timeline-main"],
  "status": "approved"
}
```

The exact schema can change.

The important principle should not:

> **Assets retain provenance and dependency.**

This allows SUBSTRATE to answer questions ordinary folders cannot answer reliably:

- Where did this shot come from?
- Which version of the character is this?
- Which assets depend on this design?
- What changed after the last script revision?
- Which shots are now stale?
- Why did the agent choose this take?
- Which generated assets were rejected?
- Which scene first introduced this prop?
- What can safely be regenerated without disturbing the edit?
- What is the complete chain from screenplay to finished frame?

---

## Human View and Machine View

SUBSTRATE should preserve a distinction that can become one of its strongest architectural ideas:

> **Humans see skins. Machines see objects.**

A human might see a screenplay editor, storyboard wall, timeline, character card, video viewer, soundtrack lane, nostalgic DOCX shell, premium PDF reader, or modern WEBX production surface.

An agent should see:

```text
workspace
├── screenplay
├── scene
├── character
├── location
├── prop
├── storyboard
├── shot-plan
├── image
├── video-take
├── audio-take
├── timeline
└── export
```

The appearance may change radically.

The semantic identity should remain stable.

The machine-facing representation should expose:

- identity
- type
- state
- bounds where relevant
- relationships
- capabilities
- dependencies
- provenance
- status
- version
- legal actions

An agent should be able to ask:

```text
What is open?
What does this object represent?
What can I do to it?
What does it depend on?
What depends on it?
What changed?
What is stale?
What is approved?
```

without reverse engineering the visible interface.

---

## The Creative Connector Layer

SUBSTRATE should not bet its architecture on one model provider.

The model that looks dominant today may be irrelevant by the time this system matters most.

Instead, SUBSTRATE should eventually define a provider-neutral **creative connector layer**.

Conceptually:

```text
SUBSTRATE
    │
    ├── LLM Connector
    ├── Image Connector
    ├── Video Connector
    ├── Voice Connector
    ├── Music Connector
    ├── Sound Connector
    ├── 3D Connector
    └── Render / Encode Connector
```

SUBSTRATE asks for an abstract operation:

```js
video.generate({
  shot: "12C",
  character: "mara",
  location: "apartment-night",
  duration: 6.5,
  camera: {
    framing: "close-up",
    motion: "slow-push-in"
  },
  continuity: [
    "scene-08",
    "character-mara-v3"
  ]
});
```

The connector translates that intent into whatever API, model protocol, local runtime, or cloud service exists.

The principle should be:

> **Providers are replaceable. Production meaning is not.**

---

## The Agent Should Create the Assets It Needs

A sufficiently capable production agent should not merely receive a pile of prepared inputs.

It should be able to work forward from intention.

For example:

```text
Read screenplay
     ↓
Identify scenes
     ↓
Identify recurring characters
     ↓
Create character design candidates
     ↓
Human approves one
     ↓
Create location concepts
     ↓
Build scene breakdown
     ↓
Create shot list
     ↓
Generate storyboards
     ↓
Generate video takes
     ↓
Generate or attach dialogue
     ↓
Generate ambience / music / SFX
     ↓
Assemble rough cut
     ↓
Inspect continuity
     ↓
Request replacements
     ↓
Prepare final sequence
```

The critical difference is that SUBSTRATE should preserve **every meaningful intermediate object**.

The character sheet is not discarded when a shot is made.

The shot plan is not discarded when the video is generated.

The rejected take is not required to disappear.

The edit decision can remain attached to the chosen take.

The final film therefore retains a comprehensible ancestry.

---

## The Trail Is Part of the Work

The production trail is not merely debug metadata.

It is useful creative material.

A user should be able to select a finished shot and choose:

```text
Show Production Trail
```

SUBSTRATE could then expose something like:

```text
Final Movie
    ↑
Final Edit
    ↑
Shot 12C Take 04
    ↑
Shot Plan 12C
   ↙       ↓        ↘
Mara v3  Apartment   Scene 12
```

Or the creator could begin with a source object and ask:

> Show me everything that depends on this.

The workspace can answer in terms of real production relationships rather than filenames.

This is where a workspace becomes much more powerful than a directory.

---

## Staleness and Dependency

Suppose the director changes:

```text
Mara jacket: black → red
```

SUBSTRATE should not blindly regenerate the entire movie.

It should understand dependency.

The system could mark affected descendants:

```text
Character: Mara v4                CURRENT
Storyboard 12C                    STALE
Shot 12C Take 04                  STALE
Poster Draft 02                   STALE
Scene 18 Take 01                  STALE
Apartment Establishing Shot       UNAFFECTED
Music Cue 12                      UNAFFECTED
```

The human can then decide what to do.

The creator might say:

> Update the affected shots. Preserve framing, timing, dialogue, performance, lighting, and edit length as closely as possible.

The goal is not uncontrolled automatic regeneration.

The goal is **informed regeneration**.

---

## Versioning Without Turning Creativity Into Git

Production history should borrow useful ideas from source control without forcing artists to think like programmers.

A character may naturally evolve:

```text
Mara
├── v1 rough concept
├── v2 costume exploration
├── v3 approved design
├── v4 rejected redesign
└── v5 final production design
```

The user should be able to inspect the lineage and understand which version was approved, which version a scene references, why another version was rejected, and whether downstream material should migrate.

An agent may leave a concise decision note:

```text
Decision:
Use Take 04 instead of Take 03.

Reason:
Take 04 preserves the intended eye-line and matches
the emotional continuity from Shot 12B.

Changes:
- trim first 11 frames
- retain original dialogue
- replace room ambience
```

This turns agent behavior from magic into reviewable work.

---

## Semantic Screenplays

A screenplay should eventually be more than formatted text.

SUBSTRATE should be able to expose or derive semantic objects such as:

```text
SCENE
CHARACTER
LOCATION
DIALOGUE
ACTION
PROP
WARDROBE
MUSIC CUE
SHOT
CONTINUITY NOTE
```

The writer still writes naturally.

The machine receives structure.

Once the script can expose these relationships, a production agent does not need to repeatedly rediscover them from prose.

It can traverse the work.

---

## Direct Manipulation as Direction

SUBSTRATE's spatial workspace can make agent direction unusually natural.

A creator might drag:

```text
Mara Character Object
        ↓
      Shot 12C
```

SUBSTRATE understands:

> Shot 12C now references Mara's canonical character definition.

Or:

```text
Apartment Night Style Board
          ↓
       Scene 12
```

SUBSTRATE understands:

> New assets for Scene 12 should inherit this visual reference unless overridden.

This is much closer to directing than writing giant prompts.

The machine-readable architecture should let obvious physical actions create explicit semantic relationships.

---

## The Agent Should Prefer Semantic Actions Over Pixels

A production agent should not need to use SUBSTRATE like a remote-controlled mouse unless no better option exists.

The preferred hierarchy should be:

```text
LEVEL 1
Semantic actions
scene.createShot()
timeline.insert()
character.attachReference()
asset.regenerate()

LEVEL 2
Semantic object tree
inspect workspace structure
inspect relationships
inspect bounds
inspect state

LEVEL 3
Mouse / keyboard / pixels
fallback for unsupported interfaces
```

Level 3 should exist.

It should not be the normal way an agent understands SUBSTRATE.

---

## WEBX as the Production Surface

WEBX could become a natural home for richer production interfaces.

A film project might visually appear as:

```text
┌─────────────────────────────────────────────────┐
│ NEO HOLLYWOOD · PROJECT ONE                     │
├────────────┬────────────────────────────────────┤
│ SCENES     │              VIEWER                │
│            │                                    │
│ 01 ✓       │          [ current take ]          │
│ 02 ✓       │                                    │
│ 03 ◉       │                                    │
│ 04         ├────────────────────────────────────┤
│ 05         │ ▓▓▓▓▓▓▓▓ TIMELINE ▓▓▓▓▓▓▓▓       │
├────────────┴────────────────────────────────────┤
│ Agent: continuity issue detected in Shot 03C   │
└─────────────────────────────────────────────────┘
```

Underneath that interface, the machine sees stable semantic state.

The beautiful interface is for the human.

The boring schema is for reliability.

Both represent the same world.

---

## Neo Hollywood

"Neo Hollywood" is a useful working name for the long-term creative vision.

It does not mean replacing filmmakers with a prompt.

It means reducing the amount of industrial machinery required between a person's imagination and a finished work.

Historically, ambitious moving-image production has required coordination between large numbers of specialists, expensive physical infrastructure, specialized software, specialized hardware, financing, distribution relationships, and time.

Those things produced extraordinary work.

They also created an enormous minimum scale for certain kinds of expression.

Generative media may lower that minimum scale dramatically.

If generation quality continues improving while inference, storage, and compute become cheaper, an increasingly large portion of production may become accessible through services that ordinary people can rent for minutes rather than studios they must own.

When that happens, the limiting factor may no longer be:

> Can the machine produce an image?

The limiting factor may become:

> Can one person coherently direct thousands of generated decisions?

That is the problem SUBSTRATE could be unusually well suited to solve.

Not generation.

**Coordination.**

Not a bigger prompt box.

**A shared creative world with memory, identity, relationships, provenance, and tools.**

---

## Lightning in a Bottle

There is a possible timing advantage here.

Building a giant proprietary generation stack would place SUBSTRATE in direct competition with companies spending enormous amounts on models and compute.

That is unnecessary.

Instead, SUBSTRATE can build the layer that becomes more valuable **as those capabilities commodify**.

```text
Generation gets cheaper
        ↓
More people can generate
        ↓
Projects become larger
        ↓
Coordination becomes harder
        ↓
Semantic production workspace becomes more valuable
```

SUBSTRATE does not need to predict which provider wins.

It needs to remain able to connect to the winners.

That is the lightning-in-a-bottle opportunity.

The project can remain small and local-first at its core while giving the user optional access to enormous remote creative capability.

---

## The 2040 Test: One Kid, One Workspace, An Impossible Movie

A useful long-term design test is:

> **Could a talented kid in 2040 use this?**

Imagine a teenager with:

- a screenplay
- a modest computer
- SUBSTRATE
- a connection to whatever generation and reasoning services are ordinary then
- enough credits, local compute, or subscription access to create media

They open the screenplay.

The system recognizes scenes and characters.

The kid sketches a character or describes one.

An image service produces candidates.

The kid chooses one.

That choice becomes a canonical character object.

The agent creates a shot plan.

The kid changes it.

Storyboards appear.

The kid rejects half.

Video takes are generated.

Some fail.

Some are astonishing.

The agent tracks which character, location, camera instruction, line reading, and style reference produced each one.

The kid rearranges the edit.

The agent identifies continuity problems.

The kid tells it to preserve one performance but change the lighting.

The system creates a replacement and knows exactly where it belongs.

Music and sound enter the graph.

The production accumulates.

Months later the creator can still click a frame and ask:

> Why does this look like this?

And SUBSTRATE can answer.

That is qualitatively different from "AI video generation."

It is a **personal production system**.

The aspiration is deliberately enormous:

> A kid who once could only imagine something on the scale of Star Wars should at least have a path to attempting it.

The result may be brilliant, terrible, strange, crude, beautiful, or all of those at once.

The important change is who gets to try.

---

## The Next Progression: A Studio Without the Studio

The solo-creator example is only the first step.

The same production graph becomes even more powerful when multiple people and multiple agents can work on it together.

The longer-term collaborative vision should resemble some combination of:

- Git
- Teams
- a writers' room
- an edit bay
- a production office
- a shared asset library

without requiring filmmakers to think like software engineers.

Imagine a five-person creative team:

```text
Writer A       → Scene 01–20
Writer B       → Scene 21–40
Director       → shot language / approvals
Visual Artist  → characters / environments
Editor         → timeline / rhythm / final assembly
```

alongside specialized agents:

```text
Continuity Agent
Storyboard Agent
Production Agent
Dialogue Agent
Sound Agent
Render Agent
```

All of them contribute to the same semantic production graph.

The writers can develop different parts of the screenplay at the same time.

The visual artist can establish canonical character and location objects while the screenplay is still evolving.

The storyboard agent can begin on approved scenes without waiting for the entire script.

The editor can start assembling finished sequences while later scenes remain in production.

The continuity agent can watch the shared graph for contradictions.

The director can review, approve, reject, branch, or merge work.

This changes production from a single long pipeline into a **parallel creative system**.

---

## Branches for Creative Work

A scene should be able to branch without destroying the approved version.

For example:

```text
Scene 24
├── Main
├── Writer A alternate ending
├── Writer B darker version
└── Director experiment
```

Each branch can carry its own downstream work:

```text
Writer B darker version
   ↓
Storyboard B
   ↓
Shot Plan B
   ↓
Rough Cut B
```

The team can compare the branches as actual productions rather than arguing over abstract prose.

If the director chooses the alternate version, SUBSTRATE can merge the accepted changes into the main production graph.

The system should understand that a creative merge is not always a text merge.

It may mean:

- accept this dialogue
- keep the original blocking
- use the alternate ending
- preserve the approved character design
- keep the current score
- regenerate only the affected shots

That is **version control for meaning**, not merely files.

---

## Collaboration Without Losing Attribution

Every contribution should remain attributable.

A final scene might reveal:

```text
Scene 24
Story foundation: Writer A
Dialogue revision: Writer B
Shot plan: Director
Character design: Artist C
Storyboard pass: Storyboard Agent
Continuity fix: Continuity Agent
Final edit: Editor D
```

This is useful for credits, accountability, review, and simply understanding how the work became what it is.

Agents should be treated similarly.

The production history should be able to say which human or machine created a revision, what it changed, and what it depended on.

---

## Semantic Merge Conflicts

Collaboration will create conflicts.

SUBSTRATE should try to make them understandable in creative terms.

Instead of:

```text
MERGE CONFLICT: line 184
```

the system might say:

```text
Scene 12 conflict

Writer A changed:
Mara leaves before Vale enters.

Writer B changed:
Vale and Mara argue in the apartment.

These versions cannot both be true.

Affected downstream objects:
- Storyboard 12B
- Shot Plan 12
- Take 12C-04
```

The team can then decide what the story should actually be.

This is a much more natural use of source-control ideas for creative work.

---

## A Great Movie in Record Time

If generative systems become reliable enough, collaborative production could compress timelines dramatically.

A group of writers might develop and revise a script while other members of the team are already building approved characters, locations, shots, voices, and edits.

Because SUBSTRATE understands dependency, the team does not need to restart every department after every revision.

Because the production trail remains legible, people can work quickly without turning the project into chaos.

Because agents can handle repetitive coordination, humans can spend more of their time on:

- taste
- performance
- character
- pacing
- humor
- emotion
- theme
- visual judgment
- final decisions

The ambition is not merely to create movies faster.

It is to make it plausible that **a small group of talented people could finish a genuinely ambitious film in a fraction of the production time previously required**, while retaining a clear record of how it was built.

The solo creator expands who can attempt a film.

The collaborative system expands what a small team can attempt.

That is the progression:

```text
ONE CREATOR
     ↓
ONE CREATOR + AGENTS
     ↓
SMALL HUMAN TEAM + AGENTS
     ↓
DISTRIBUTED NEO STUDIO
```

The studio becomes less a building and more a shared semantic production graph.

---

## This Generalizes Beyond Movies

Film is the clearest example because it combines many creative disciplines.

The same graph architecture could support games, comics, websites, music videos, presentations, software, research, design, and other collaborative work.

The universal primitive remains:

> **Objects have identity. Objects have relationships. Actions have provenance. Outputs retain their production history.**

---

## Privacy and Local-First Principles

SUBSTRATE is local-first.

Agent integration should not quietly reverse that principle.

A connector should make it explicit when material leaves the local workspace.

The user should be able to understand:

- which provider receives which asset
- which objects remain local
- which operations require cloud processing
- which outputs came from which service
- what credentials or accounts are active
- what provenance metadata is stored locally

Where local models are capable enough, they should be able to participate through the same connector concepts.

Cloud capability should expand SUBSTRATE rather than redefine it.

---

## Near-Term Architectural Implications

This proposal does not require implementing Neo Hollywood now.

It does suggest several decisions that can be useful immediately.

### 1. Stable Object Identity

Objects should have identities that survive ordinary edits where possible.

### 2. Explicit Object Types

An object should know what it is instead of forcing every consumer to infer meaning from DOM structure.

### 3. Capabilities

Objects should advertise legal actions.

### 4. Relationships

The system should leave room for references between objects.

### 5. Provenance

Derived objects should be able to record what produced them.

### 6. Version Awareness

Replacement should not always mean destruction of history.

### 7. Semantic Geometry

Bounds, regions, pages, selections, and layout relationships should be inspectable independently of appearance.

### 8. Connector Boundaries

External intelligence and generation systems should enter through explicit interfaces rather than becoming entangled throughout the core.

### 9. Human-Readable State

Where practical, important metadata should remain inspectable rather than trapped in opaque binary state.

### 10. Appearance Must Not Define Meaning

A DOCX can look like Windows 98.

A PDF can look like a premium professional reader.

A WEBX production surface can look like a futuristic React application.

Their semantics should remain stable underneath.

### 11. Collaboration Must Operate on Meaning

Future multi-user work should branch, merge, attribute, approve, and conflict at the semantic object level rather than only at the raw-file level.

---

## Non-Goals

This proposal does **not** require SUBSTRATE to:

- train foundation models
- host a giant proprietary AI cloud
- become a full Premiere replacement
- become a full Blender replacement
- hide the production process behind one prompt
- force every user into cloud services
- decide which model provider will dominate
- implement an enormous production ontology immediately
- turn artists into Git operators
- automatically resolve subjective creative disagreements

The immediate value is preserving architectural room.

The strongest version of this idea is not:

> Press button. Receive movie.

It is:

> **Give people and machines the same understandable workspace, then preserve the path of creation as they work together.**

---

## Suggested Evolution

### Phase 1: Agent Legibility

- stable object IDs
- explicit types
- capabilities
- semantic bounds
- inspectable workspace state
- machine-readable actions

### Phase 2: Relationships and Provenance

- derived-from links
- used-by links
- version lineage
- lightweight action history
- production trail inspection

### Phase 3: Generic Connectors

- LLM connector
- image connector
- video connector
- audio connector
- local and cloud provider adapters

### Phase 4: Creative Project Objects

- screenplay / scene
- character
- location
- storyboard
- shot
- take
- timeline

### Phase 5: Agent Production

- script breakdown
- asset creation
- shot planning
- generation orchestration
- continuity inspection
- dependency-aware revision
- explainable edit decisions

### Phase 6: Collaborative Production

- shared production graphs
- branches
- approvals
- semantic merge conflicts
- attribution
- human + agent roles
- parallel scene production
- review and merge workflows

### Phase 7: Neo Hollywood

A creator or small distributed team can move fluidly between writing, design, generation, performance, editing, sound, revision, and export while SUBSTRATE preserves the semantic production graph underneath.

---

## Design Laws

### Humans see skins. Machines see objects.

The visual interface can be playful, beautiful, nostalgic, strange, or highly specialized.

Meaning remains explicit underneath.

### Providers are replaceable. Production meaning is not.

Connectors translate stable SUBSTRATE intent into changing external systems.

### Never destroy the path from intention to artifact.

Generated work should retain enough provenance to understand where it came from and what depends on it.

### Agents should create legible work.

An agent should leave behind assets, relationships, decisions, and useful history rather than only a final file.

### Collaboration should preserve authorship and causality.

Fast teamwork should not erase who changed what, why it changed, or what depended on it.

### The human remains the director.

Automation should increase creative reach without making the production incomprehensible to the people creating it.

### Build for commodification.

The architecture should become more useful as generation, reasoning, and rendering become cheaper and more available.

---

## Closing Vision

SUBSTRATE began from a deceptively small idea:

> Why should ordinary digital work be harder than it needs to be?

That question can eventually extend much further.

Why should a screenplay live in one application, character references in another, generated video in a browser tab, sound in another tool, edit decisions in a timeline, prompts in chat history, provenance nowhere, and the reasoning that connected all of it disappear the moment the session ends?

Why should an artificial agent need to stare at screenshots and guess what a workspace means when the workspace itself can describe its objects?

Why should a small group of writers, artists, editors, and directors be forced to reproduce the organizational overhead of a traditional studio just because the work is ambitious?

SUBSTRATE can aim for something different:

```text
HUMAN INTENTION
      +
SEMANTIC OBJECTS
      +
MACHINE-READABLE WORKSPACE
      +
REPLACEABLE AI CONNECTORS
      +
PRODUCTION PROVENANCE
      +
COLLABORATIVE BRANCHES
      +
DIRECT HUMAN CONTROL
      ↓
A NEW SCALE OF CREATIVE POSSIBILITY
```

The long-term opportunity is not simply AI media generation.

It is a workspace where humans and machines can **make complicated things together without losing the thread of how they were made**.

That is the real Neo Hollywood idea.

Not one model.

Not one provider.

Not one magic prompt.

A substrate for creation.
