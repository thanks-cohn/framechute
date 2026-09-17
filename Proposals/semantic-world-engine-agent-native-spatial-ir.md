# Proposal: Semantic World Engine / Agent-Native Spatial IR

## Summary

SUBSTRATE should eventually support an **agent-native semantic world engine**: a 3D/game/simulation layer designed from the beginning so that humans, renderers, remote compute systems, and LLM agents can all understand the same world without depending on pixels or anonymous meshes as the source of truth.

This proposal extends the ideas in `Proposals/neo-hollywood-agent-native-production-graph.md`.

The central idea is:

> **The mesh is not the world. The semantic world model is the world.**

A conventional engine often treats the scene as a hierarchy of transform nodes, meshes, materials, shaders, cameras, lights, and scripts. That is enough to render a world, but it is not necessarily enough for an LLM to reason about the world reliably.

SUBSTRATE should add a higher semantic layer where every meaningful object has:

- a stable identity
- a semantic role
- explicit position, orientation, scale, and dimensions
- explicit units
- parent/child relationships
- spatial relationships to other objects
- constraints
- affordances
- state
- provenance
- version history
- collision and occupancy information
- optional physical properties
- optional uncertainty/confidence
- legal or supported actions

The same object can then be rendered by WebGPU, simulated by a local or remote physics system, edited by a human, manipulated by an LLM, rendered photorealistically by a cloud model, or inspected by another agent.

The long-term design principle should be:

> **A human should be able to understand the world. A renderer should be able to execute the world. An agent should be able to reason about the world without looking at it.**

---

## Why This Matters

LLMs and multimodal models can be surprisingly capable at high-level reasoning while still being inconsistent about exact space.

A model may understand that a cup belongs on a table while still being uncertain about:

- exact distance
- exact alignment
- whether two objects overlap
- whether a hand can reach an object
- whether a camera can see an object
- whether a path is blocked
- which direction an object must move
- how far an object must move
- what relative pose is physically useful
- whether an action remains valid after another object moves

A visual model can infer many of these things from images, but images are an indirect representation of geometry.

SUBSTRATE can give the agent the geometry directly.

Instead of only seeing:

```text
There is a coffee cup near a machine.
```

an agent could receive:

```text
object cup:kitchen:04
role: drinking-vessel
position: [1.420m, 0.910m, -0.330m]
size: [0.088m, 0.102m, 0.088m]
opening-normal: [0, 1, 0]

object machine:coffee:01
role: coffee-machine
position: [1.210m, 0.900m, -0.420m]

object spout:coffee:01
parent: machine:coffee:01
position: [1.385m, 1.055m, -0.350m]
forward: [0, -1, 0]

distance spout -> cup center: 0.148m
horizontal offset: 0.026m
vertical offset: 0.143m
```

Now the model does not have to guess what "a little above and near the cup" means.

It has measurable state.

---

## The Core Architecture

The semantic world should sit above rendering and compute backends.

```text
                 SUBSTRATE WORLD IR
                         │
          ┌──────────────┼──────────────┐
          │              │              │
      semantics       geometry        state
          │              │              │
          └──── identity / provenance ──┘
                         │
                 constraints / rules
                         │
        ┌────────────────┼────────────────┐
        │                │                │
     WebGPU          Remote GPU        Simulation
        │             / API              │
   local preview      RunPod/etc.      physics/AI
```

SUBSTRATE should own the meaning of the scene.

The backend should only perform work against that meaning.

A local 4 GB computer could therefore remain capable of editing, inspecting, scripting, previewing, and orchestrating a complex project while expensive rendering, model inference, simulation, or training jobs are delegated to a remote machine.

---

## API as Compute Contract

The remote system should not define the project.

SUBSTRATE should define a stable compute/job API.

For example:

```json
{
  "jobId": "render:shot-12:v4",
  "operation": "render-shot",
  "sceneVersion": "scene:city:v131",
  "cameraId": "camera:main",
  "frameRange": [0, 143],
  "quality": "final",
  "requestedOutputs": [
    "rgb",
    "depth",
    "normals",
    "object-id",
    "motion-vectors"
  ]
}
```

The exact executor could be:

- local WebGPU
- local WASM
- a user's workstation
- a LAN render machine
- RunPod
- another GPU cloud
- an organization server
- a future model provider

The provider is replaceable.

The job contract and semantic scene remain stable.

Conceptually:

```text
ComputeBackend
├── LocalWebGPUBackend
├── LocalWasmBackend
├── UserWorkstationBackend
├── RunPodBackend
├── RemoteSubstrateBackend
└── FutureCloudBackend
```

This allows SUBSTRATE to become a serious creative or simulation environment without requiring SUBSTRATE itself to own a giant compute cluster.

---

## An LLM-First Scene Syntax

The human-facing syntax should be deliberately explicit and boring.

That is a feature.

For example:

```text
scene kitchen

object cup:coffee {
  role: drinking-vessel
  position: [1.42m, 0.91m, -0.33m]
  size: [0.088m, 0.102m, 0.088m]
  material: ceramic-white
}

object machine:coffee {
  role: coffee-machine
  position: [1.21m, 0.90m, -0.42m]
}

constraint cup_under_spout {
  subject: cup:coffee
  reference: machine:coffee.spout
  horizontal-distance <= 0.04m
  vertical-distance: 0.10m..0.18m
}
```

Important syntax principles:

- explicit units
- stable IDs
- explicit coordinate spaces
- predictable grammar
- very little overloading
- canonical defaults
- schema validation
- bounded nesting
- deterministic ordering
- explicit relationships
- explicit constraints

The syntax is not the canonical data model.

It compiles into a stricter Scene IR.

```text
Human / LLM DSL
       ↓
Canonical Scene IR
       ↓
validation
       ↓
renderer / simulator / remote compute
```

This lets humans and LLMs author readable worlds while keeping the executable representation precise.

---

## Stable Object Identity

Every object must retain identity independently of its visual representation.

```text
chair:dining:17
```

should remain the same conceptual object whether it is:

- represented by a low-poly proxy
- replaced with a detailed mesh
- converted to another file format
- rendered by a remote model
- moved in the scene
- recolored
- retextured
- simulated
- temporarily hidden
- shown in another camera

An object dossier might contain:

```text
id: chair:dining:17
role: dining-chair
position: [1.82m, 0m, -0.73m]
rotation: [0deg, 31deg, 0deg]
parent: dining-set:2
geometry: asset:chair-walnut:v4
material: material:walnut:v2
current: true
collision-state: clear
provenance: imported:model-pack:22
```

This is the same philosophy being developed for SUBSTRATE's PDF object identity and forensic geometry.

---

## Agents Should Patch Worlds, Not Rewrite Them

LLMs should normally produce deterministic patches.

If the user says:

> Move the sofa closer to the west window.

The agent should not rewrite the entire scene.

It should produce something like:

```text
patch living_room {
  move sofa:main {
    relative_to: window:west
    distance: 0.65m
    preserve_orientation: true
  }
}
```

The engine resolves the request and returns evidence:

```text
SOFA_MOVED
old: [2.21m, 0m, 1.47m]
new: [1.76m, 0m, 1.47m]
wall-clearance: 0.42m
walking-clearance: 0.91m
collision: none
```

This makes agent behavior reviewable, reversible, and testable.

---

## Spatial Tools for LLM Surfaces

An LLM should not need the entire scene graph in context at all times.

SUBSTRATE should expose semantic tools such as:

```text
get_scene_summary()
get_object(id)
get_object_dossier(id)
get_objects_near(id, radius)
get_objects_in_frustum(camera)
get_relationships(id)
find_objects(role)
find_collisions()
find_clearances()
find_reachable_objects(actor)
apply_scene_patch(...)
validate_scene(...)
render_preview(camera)
submit_compute_job(...)
get_compute_job(...)
```

This reduces context size and turns the world into an inspectable environment rather than a giant token dump.

---

## Fighting the Spatial Weakness of LLMs

One of the largest opportunities is not rendering.

It is **giving language models an explicit spatial substrate**.

An LLM should not have to infer exact relationships from prose when the engine already knows them.

SUBSTRATE can expose relations such as:

```text
above(A, B)
below(A, B)
leftOf(A, B)
rightOf(A, B)
inside(A, B)
intersects(A, B)
touches(A, B)
faces(A, B)
visibleFrom(A, camera)
reachableBy(A, actor)
distance(A, B)
clearance(A, B)
angleBetween(A, B)
```

The system should also expose the numbers behind those labels.

For example:

```text
relation: above
subject: spout:01
reference: cup:04
delta: [0.011m, 0.143m, -0.008m]
distance: 0.144m
confidence: 1.0
```

An agent can then combine symbolic and numeric reasoning.

This is much stronger than forcing the model to estimate everything from a screenshot.

---

## A Spatial Training Corpus Could Emerge Naturally

If SUBSTRATE becomes widely used, its structured scene and action data could eventually become valuable training material, subject to explicit user consent, privacy controls, licensing, and data-governance requirements.

The important opportunity is that the engine can record not only what objects exist, but what spatial configurations and actions actually succeed.

For example, a coffee-pouring interaction could yield a structured record like:

```text
TASK: pour coffee into cup

source: coffee-pot:01
target: cup:04

successful precondition:
  spout above cup opening
  horizontal offset <= 0.028m
  vertical clearance = 0.11m
  vessel tilt begins at 34deg
  collision path = clear

outcome:
  liquid entered target
  spill = false
  collision = false
```

Across many environments and object variations, a future model could learn distributions rather than memorize one coordinate.

It could begin to generalize that successful pouring tends to require the source opening to be:

- above the receiving opening
- sufficiently close to control the stream
- not so close that the objects collide
- oriented so the stream intersects the target opening

The valuable part is not the literal number `0.11m`.

The valuable part is the relationship between:

```text
object geometry
+ relative pose
+ action
+ constraints
+ outcome
```

That structure could provide much cleaner supervision for spatial reasoning than unstructured prose alone.

This should be treated as a long-term research opportunity, not as a claim that simple scene logs automatically produce general intelligence.

---

## Learning What Is Spatially "Right"

The engine could eventually build datasets where "right" means something precise and task-specific rather than subjective.

Examples:

```text
RIGHT for pouring
= target receives liquid without collision or spill

RIGHT for sitting
= body pose supported by chair geometry and within joint limits

RIGHT for opening a drawer
= hand reaches handle, pulls along legal axis, avoids obstruction

RIGHT for camera framing
= required subject remains visible inside requested composition bounds

RIGHT for placing a book
= stable support contact, no penetration, requested shelf region satisfied
```

This creates supervised spatial examples containing:

- initial state
- object identities
- metric geometry
- relative geometry
- constraints
- action
- resulting state
- success/failure
- failure code

A model trained on enough diverse examples could potentially learn more useful priors for distance, orientation, clearance, and action planning.

It could later generalize from:

> "put this specific pot exactly 14.3 cm above this specific cup"

into something closer to:

> "for this class of pouring task, position the spout above and somewhat near the receiving opening, then refine the exact pose from the geometry."

That is a much more useful spatial abstraction.

---

## Sim-to-Real Opportunity

This architecture could also help with the **simulation-to-reality gap**.

The sim-to-real problem is that a policy or model that succeeds in a clean simulated world may fail in reality because real environments contain noise, imperfect sensors, friction differences, deformable materials, calibration errors, lighting changes, unexpected obstacles, and other unmodeled variation.

SUBSTRATE cannot eliminate that problem by itself.

But the semantic world model could make the gap easier to measure and reason about.

For the same task, SUBSTRATE could preserve:

```text
SIM EXPECTATION
object pose
object dimensions
contact points
clearance
predicted trajectory
predicted success

REAL OBSERVATION
estimated pose
estimated dimensions
observed contact
observed trajectory
actual outcome

DELTA
position error
orientation error
size error
friction/behavior difference
trajectory error
outcome mismatch
```

Instead of merely recording:

```text
simulation worked
real robot failed
```

we could retain:

```text
SIM_REAL_POSE_DELTA
expected cup center: [x, y, z]
observed cup center: [x+0.021, y, z-0.013]

SIM_REAL_CONTACT_MISMATCH
expected handle contact: true
observed handle contact: false

SIM_REAL_CLEARANCE_ERROR
expected clearance: 0.036m
observed clearance: 0.009m
```

This provides structured residue for agents, researchers, and future training systems.

---

## Domain Randomization and Generalization

A semantic IR also makes controlled variation easier.

The engine can vary:

- object size
- object position
- orientation
- material
- friction
- lighting
- camera position
- sensor noise
- actuator error
- latency
- clutter
- obstacle placement

while retaining the semantic task.

For example:

```text
TASK: pour into cup
```

can remain constant while SUBSTRATE generates thousands of valid variations of:

```text
cup size
cup location
pot geometry
spout length
counter height
lighting
camera pose
```

The model can then learn the **relationship** that makes the task work rather than memorizing one kitchen.

This could contribute to reducing sim-to-real brittleness because the training distribution can intentionally include geometric and environmental uncertainty.

---

## Real-World Calibration as Another Adapter

The semantic world should not assume its coordinates are perfectly aligned with reality.

A real-world integration could maintain explicit transforms:

```text
semantic-world coordinates
        ↓
calibration transform
        ↓
robot / camera coordinates
        ↓
observed world
```

Every real observation could include uncertainty:

```text
object: cup:04
estimated-position: [1.421m, 0.908m, -0.332m]
position-uncertainty: ±0.006m
orientation-uncertainty: ±1.8deg
source: camera:overhead:02
```

An agent can then reason not just about where an object is, but how certain that estimate is.

This is important if the scene representation is ever used for robotics, embodied AI, AR, or real-world automation.

---

## The World as a Dataset of Relationships

A major long-term insight is that a semantic world engine naturally produces a graph of spatial relationships.

```text
hand:01
  near -> mug:04
  above -> counter:01
  reachable -> handle:mug:04

mug:04
  supportedBy -> counter:01
  inside -> kitchen:room
  0.34m from -> sink:01
```

Across enough examples, the training signal is not merely visual appearance.

It becomes:

```text
WHAT exists
WHERE it exists
HOW it relates
WHAT actions were attempted
WHAT constraints applied
WHAT changed
WHETHER it worked
```

This is precisely the sort of structured information that can support spatial generalization.

---

## Structured Failure Is Valuable Training Data

Failures should be first-class records.

For example:

```text
ACTION_FAILED
code: POUR_TARGET_MISALIGNED
source: pot:01
target: cup:04
horizontal-offset: 0.083m
allowed-offset: <= 0.031m
spill: true
```

or:

```text
ACTION_FAILED
code: REACH_PATH_OCCLUDED
actor: robot-arm:01
target: mug:04
blocking-object: kettle:02
minimum-clearance: -0.012m
```

A future model can learn not only successful states but boundaries around failure.

That can be more informative than a dataset containing only successful demonstrations.

---

## From Game Engine to Semantic World Laboratory

This means the project could evolve through several stages.

### Stage 1 — Creative 3D Engine

- scene graph
- objects
- materials
- cameras
- lighting
- transforms
- simple physics
- WebGPU preview

### Stage 2 — Agent-Native Engine

- stable semantic identities
- LLM-readable Scene IR
- semantic patch language
- geometry queries
- constraints
- provenance
- diagnostics

### Stage 3 — Remote Compute Engine

- provider-neutral compute API
- RunPod/user-server connectors
- remote rendering
- remote AI generation
- remote simulation

### Stage 4 — Structured Simulation

- affordances
- action schemas
- task constraints
- success/failure states
- physical outcome logs

### Stage 5 — Spatial Learning Laboratory

- consented training export
- domain randomization
- task/outcome datasets
- sim-vs-real deltas
- spatial generalization experiments

The early engine can therefore remain useful even if the research ambitions never materialize.

The research opportunities emerge naturally from the same architecture.

---

## 3D-to-Real / Generated Reality

The semantic scene can also become a strong conditioning source for generative media.

Instead of:

```text
prompt -> image
```

SUBSTRATE can provide:

```text
semantic scene
+ camera matrix
+ depth
+ surface normals
+ object-ID masks
+ segmentation
+ materials
+ lights
+ motion vectors
+ semantic instructions
        ↓
image/video model
        ↓
photorealistic output
```

The resulting output remains attached to the source scene version and object identities.

A generated frame therefore knows:

```text
scene version
camera version
object versions
model/backend
seed
render parameters
conditioning maps
```

This gives agents much stronger continuity than treating every generated frame as an unrelated image.

It also allows geometric discrepancies between the structured scene and generated result to become measurable rather than merely visual complaints.

---

## Agent Forensics for 3D

The PDF observability work suggests a powerful rule for the world engine:

> **Every important spatial failure should leave mathematical residue.**

Examples:

```text
OBJECT_MOVED_UNEXPECTEDLY
COLLISION_AFTER_PATCH
CONSTRAINT_VIOLATED
HOVER_CHANGED_OBJECT_TRANSFORM
CAMERA_TARGET_LOST
RENDER_OBJECT_SCREEN_BOUNDS_MISMATCH
SIM_REAL_POSE_DELTA
ACTION_PRECONDITION_FAILED
PATH_OCCLUDED
REACHABILITY_CHANGED
```

A future agent should be able to ask:

```text
Why did the cup move?
Why could the hand no longer reach it?
Why did the generated character appear too far left?
Why did the simulated pour succeed but the real action fail?
```

and receive coordinates, transforms, constraints, events, and causality rather than screenshots alone.

---

## Multi-Agent Collaboration

The semantic world also creates a natural collaboration surface for specialized agents.

```text
Director Agent
    -> shot composition

Environment Agent
    -> world geometry

Lighting Agent
    -> lighting and exposure

Character Agent
    -> actors, poses, wardrobe

Physics Agent
    -> constraints and collisions

Continuity Agent
    -> state across scenes

Simulation Agent
    -> action validity

Render Agent
    -> compute backend and output
```

Each agent should operate through semantic patches and stable object IDs.

They should not communicate primarily through screenshots.

This allows multiple agents to work on the same world without losing causality.

---

## Relationship to WEBX

WEBX and the semantic world engine should share philosophical foundations.

WEBX:

> semantic document is the source; PDF/DOCX/HTML are render targets.

World engine:

> semantic world is the source; WebGPU/remote render/simulation are execution targets.

Conceptually:

```text
                 SUBSTRATE
                     │
          ┌──────────┴──────────┐
          │                     │
     DOCUMENT IR            WORLD IR
       / WEBX                   │
          │                     │
 PDF · DOCX · HTML     WebGPU · Render · Sim
```

Both should prioritize:

- stable identity
- explicit geometry
- provenance
- deterministic patches
- version state
- constraints
- agent-readable diagnostics

---

## Safety and Data Governance

If this architecture is ever used for training data or real-world automation, the system must treat data governance as foundational.

Training export should require explicit consent and clear provenance.

Real-world control should distinguish:

- simulation
- preview
- recommendation
- executable command

Physical actions should not be inferred silently from creative scene edits.

Robotics or embodied-AI execution would require separate permissions, safety constraints, hardware adapters, and validation layers.

The semantic world model can support those systems.

It should not bypass them.

---

## The Long-Term Thesis

The largest opportunity may not be that SUBSTRATE becomes another game engine.

It may be that SUBSTRATE becomes a **semantic world interface** between people, agents, renderers, simulators, models, and eventually machines acting in physical space.

The same explicit geometry that helps an LLM place a chair correctly in a game could later help a model reason about:

- where a cup should be relative to a coffee spout
- where a hand should approach a handle
- how far a camera should stand from a subject
- what path clears an obstacle
- how an object must rotate to fit through an opening
- which spatial relationships remain invariant across different rooms

If enough structured examples exist, the model can potentially move from memorizing coordinates toward learning **spatial relationships that generalize**.

The aim is not to tell a machine that every cup belongs exactly 14 centimeters below every spout.

The aim is to give it enough mathematically grounded examples that it can learn the more useful idea:

> **To pour successfully, the source must be above, near, correctly oriented to, and geometrically compatible with the target — and the exact numbers depend on the objects and environment.**

That is the bridge from language about space to measurable space.

And if SUBSTRATE can make that representation natural for humans, renderers, LLMs, simulators, and remote compute at the same time, it could become much more than a creative tool.

It could become a common spatial substrate.
