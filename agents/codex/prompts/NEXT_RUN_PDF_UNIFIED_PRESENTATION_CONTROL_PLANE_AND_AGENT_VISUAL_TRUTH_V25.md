# NEXT RUN — PDF UNIFIED PRESENTATION CONTROL PLANE + AGENT-VISIBLE VISUAL TRUTH V25

## Mission

Start from latest `main`.

SUBSTRATE already has most of the raw ingredients required for a serious PDF editor:

- stable source and edit identities
- canonical PDF-space geometry
- source ownership rectangles
- runtime truth
- current vs historical state
- generation clocks
- causal journals
- DOM observations
- hover/hit-test tracing
- mask ownership
- semantic page hierarchy
- save/reopen state
- diagnostics

The problem is that these systems still observe one another after the fact instead of operating under one authority.

The result is visually impossible states such as:

- original source glyph visible
- live editable text visible
- committed replacement visible
- stale mask visible
- replacement field geometry disagreeing with source ownership
- multiple layers rendering the same semantic object at once

This run must connect all of the existing layers behind a single **PDF presentation control plane**.

The goal is not merely to make one screenshot look better.

The goal is to make SUBSTRATE able to know, before the user notices visually, that the page is in an invalid state.

The central principle is:

> **If the human can see a PDF rendering defect, SUBSTRATE must be able to represent the exact defect as structured state, identify the responsible objects/layers, and prevent known-invalid presentation states from being painted.**

The agent-facing principle is:

> **An authorized agent must be able to inspect the same page truth the human sees without relying on a screenshot whenever structured state is sufficient.**

The renderer, editor, masks, current state, diagnostics, and future agent API must share one reality.

---

## 1. Real acceptance fixture

Use the repository fixture:

`pdf/sample-local-pdf.pdf`

This file is mandatory for focused regression tests.

The current class of failures includes:

```
fresh source PDF
-> click source text
-> editable text appears
-> leave field
-> original source glyphs + replacement become superimposed
```

and:

```
click one source run
-> field geometry is much larger than visible glyphs
-> unrelated nearby text appears to collide with it
```

These must become impossible presentation states, not merely logged bugs.

---

## 2. Create one canonical presentation authority

Create a module with one obvious responsibility, preferably:

`src/documents/pdf-presentation-plan.js`

Suggested core API:

```js
buildPdfPresentationPlan({
  pageNumber,
  sourceObjects,
  currentEdits,
  activeInteraction,
  selectedObjectId,
  viewport,
  historicalObjects,
  generationState,
  uiState
})
```

Suggested return shape:

```js
{
  schemaVersion,
  pageNumber,
  generation,

  objects: {
    [objectId]: {
      sourceObjectId,
      state,
      sourceVisible,
      liveVisible,
      replacementVisible,
      sourceOwnershipRect,
      layoutRect,
      interactiveRect,
      maskIds,
      controlIds,
      reasons
    }
  },

  sourcePresentations: [],
  livePresentations: [],
  replacementPresentations: [],
  masks: [],
  controls: [],
  collisions: [],
  invariantResults: [],
  conflicts: []
}
```

Exact field names may differ.

The architectural requirement is non-negotiable:

> After the plan is built, render code must not independently decide whether a source, live edit, replacement, or mask is visible.

---

## 3. Explicit presentation states

Every source-backed text identity must resolve to exactly one canonical presentation state.

At minimum:

```
SOURCE_ONLY
LIVE_EDIT
COMMITTED_REPLACEMENT
DELETED
HISTORICAL
INVALID
```

Rules:

### SOURCE_ONLY

```
sourceVisible = true
liveVisible = false
replacementVisible = false
maskRequired = false
```

### LIVE_EDIT

```
sourceVisible = false
liveVisible = true
replacementVisible = false
maskRequired = true
```

### COMMITTED_REPLACEMENT

```
sourceVisible = false
liveVisible = false
replacementVisible = true
maskRequired = true
```

### HISTORICAL

```
sourceVisible = false
liveVisible = false
replacementVisible = false
hitTestable = false
saveCurrent = false
```

A single semantic source identity must never implicitly occupy two states.

---

## 4. Hard gate: exactly one current textual presentation

Implement an invariant such as:

```
PDF_ONE_CURRENT_TEXT_PRESENTATION_PER_SOURCE
```

For every source identity:

```
visibleSource
+ visibleLive
+ visibleReplacement
<= 1
```

If a conflict is detected:

- DEBUG/DEEP must emit a structured issue including all participating IDs and geometry
- production must choose canonical current truth and suppress conflicting presentations
- the renderer must never knowingly paint the invalid combination

Diagnostics may explain the problem, but explanation alone is not enough.

The invalid state must be blocked.

---

## 5. Hard gate: source coverage before live/replacement presentation

Implement:

```
PDF_SOURCE_COVERAGE_REQUIRED
```

If a source-backed live edit or replacement is visible, its immutable source region must be covered first.

Mask authority comes from:

```
sourceOwnershipRect
```

Never from:

- current layoutRect
- contenteditable DOM size
- hover rectangle
- selection rectangle
- line/block reconstruction
- replacement width after autofit

The planner should know:

```
sourceObjectId
ownerEditId
sourceOwnershipRect
requiredMaskRect
activeMaskId
maskGeneration
coverageComplete
```

If coverage is incomplete, do not reveal the replacement yet.

Keep the previous valid presentation until coverage is ready.

---

## 6. Hard gate: unchanged click/edit does not author a replacement

Implement:

```
PDF_UNCHANGED_EDIT_PRESERVES_SOURCE
```

Scenario:

```
open clean PDF
-> click source text
-> place caret
-> do not change text
-> focusout
```

Required result:

- no replacement edit created
- no persistent source mask
- no current replacement object
- source returns to SOURCE_ONLY
- no version/history mutation except optional interaction telemetry

A click must never permanently alter document presentation.

---

## 7. Editing an existing replacement

If a committed replacement already exists and becomes editable:

```
COMMITTED_REPLACEMENT
-> LIVE_EDIT
```

During LIVE_EDIT:

- original source remains covered
- committed replacement DOM presentation is suppressed
- live editor is the only text presentation

On commit:

```
LIVE_EDIT
-> COMMITTED_REPLACEMENT
```

There must not be a frame containing:

```
committed replacement underneath live editor
```

---

## 8. Historical state cannot enter presentation

Implement:

```
PDF_HISTORICAL_NEVER_PRESENTS
```

Historical/superseded objects may remain available for:

- diagnostics
- version history
- provenance
- explicit restore

They must never participate in:

- normal render
- hit testing
- selection
- collision
- active layout
- current save

unless explicitly restored.

---

## 9. The canvas is immutable source evidence

The PDF.js canvas contains the original page.

Treat it as immutable source evidence.

Because arbitrary source operators cannot be selectively unpainted after canvas render, the presentation plan must explicitly represent whether source content is visually exposed or covered.

For every edited source-backed object:

```
canvasSourceExists = true
sourceExposed = false
maskRequired = true
```

This distinction is important.

The source still exists in the canvas.

The presentation plan determines whether the human is allowed to see it.

---

## 10. Refactor renderPdfPage() to consume the plan

Audit `renderPdfPage()`.

It currently contains independent logic for:

- source text spans
- current replacements
- masks
- reopened objects
- historical suppression
- wrapped text
- controls

Move visibility decisions out of the renderer.

Desired architecture:

```
PDF model
+ current runtime truth
+ active interaction
        ↓
buildPdfPresentationPlan()
        ↓
validate/enforce invariants
        ↓
renderPdfPresentationPlan()
```

The renderer should become mostly mechanical.

It should not decide document truth.

---

## 11. Atomic plan application

Prevent one-frame invalid transitions.

When switching:

```
SOURCE_ONLY -> LIVE_EDIT
```

or:

```
LIVE_EDIT -> COMMITTED_REPLACEMENT
```

apply the new presentation atomically.

Use a single frame boundary where practical:

- DocumentFragment
- replaceChildren()
- batched style updates
- one requestAnimationFrame
- plan generation IDs

A new plan must not become visible layer-by-layer.

If the full new plan is not ready, leave the previous valid plan visible.

---

## 12. Generation clock becomes enforceable

Extend/use the existing generation clock with:

```
semanticGeneration
presentationGeneration
renderGeneration
maskGeneration
replacementGeneration
interactionGeneration
```

A frame is valid only when the required generations match the active plan.

If not:

```
presentationReady = false
```

Do not merely emit `inSync:false`.

Prevent the invalid frame from becoming current.

---

## 13. Collision system: distinguish semantic collision from visual overlap

Create one collision classifier used by diagnostics and the presentation planner.

At minimum distinguish:

### SEMANTIC_COLLISION

Two live/current textual presentations claim the same source identity.

Always illegal.

### VISUAL_TEXT_OVERLAP

Two unrelated current textual presentations materially overlap.

Potentially illegal, depending on relationship.

### UI_OVERLAY

Selection handles, hover rectangles, resize handles, caret, diagnostics.

Not document collision.

Suggested record:

```js
{
  aId,
  bId,
  aKind,
  bKind,
  overlapArea,
  overlapRatioA,
  overlapRatioB,
  semanticRelationship,
  allowed,
  reason
}
```

Hard rule:

A source presentation and its own live/current replacement may never be visually exposed together.

---

## 14. Controls never participate in document geometry

Move/resize handles, blue outlines, hover boxes, carets, diagnostics overlays, and selection UI:

- do not participate in document collision
- do not affect layoutRect
- do not affect sourceOwnershipRect
- do not affect Save
- do not expand field height
- do not become semantic objects

They are controls, not content.

---

## 15. Geometry ancestry for every visible thing

Every visible presentation should expose its mathematical ancestry.

For text:

```
source PDF item transform
-> canonical source rect
-> sourceOwnershipRect
-> current layoutRect
-> viewport projection
-> DOM client rect
-> glyph ink rect
```

For masks:

```
sourceOwnershipRect
-> mask padding policy
-> viewport projection
-> DOM mask rect
```

For interaction:

```
pointer client point
-> viewport-local point
-> candidate objects
-> chosen object
-> interactive rect
```

No visible position may be a magic number buried in an event handler.

---

## 16. Build an Agent Page Mirror

This is a major deliverable.

Create a machine-readable snapshot of the complete current PDF page state.

Suggested function:

```js
buildPdfAgentPageMirror(blockOrRuntime, pageNumber)
```

or an engine-level equivalent.

The result must be serializable JSON and contain enough information for an authorized agent to understand the current page without a screenshot.

Suggested shape:

```js
{
  schemaVersion,
  documentId,
  pageNumber,

  viewport,
  pageBounds,
  contentRect,

  interaction: {
    hoveredObjectId,
    selectedObjectId,
    editingObjectId,
    manipulatingObjectId,
    caretObjectId
  },

  objects: [
    {
      id,
      sourceObjectId,
      kind,
      semanticRole,
      text,
      versionState,
      presentationState,

      sourceOwnershipRect,
      layoutRect,
      viewportRect,
      clientRect,
      glyphInkRect,
      interactiveRect,

      visible,
      hitTestable,
      editable,
      movable,
      resizable,

      maskIds,
      relationships,
      collisions,
      provenance
    }
  ],

  masks: [],
  presentationPlan: {},
  collisions: [],
  generations: {},
  recentCausalEvents: [],
  invariantResults: [],
  issues: []
}
```

This mirror should be bounded to the active page.

Do not dump entire large PDFs on every query.

---

## 17. Expose the mirror through a stable browser-side inspection API

Add a small, model-agnostic inspection surface that can later be bridged to Native Messaging.

For example:

```js
window.SubstrateAgent = {
  pdf: {
    inspectActivePage(),
    inspectObject(objectId),
    explainPoint({x, y, space}),
    explainObject(objectId),
    validatePresentation(),
    getRecentEvents()
  }
}
```

If an existing `window.FrameChuteWorkspace` namespace is more appropriate, use it rather than creating needless duplication.

The important thing is to expose stable structured functions.

Do NOT expose raw DOM as the public contract.

Return plain serializable objects.

---

## 18. Add direct object inspection

An authorized agent should be able to ask:

```
inspectObject("source:p1:text:17")
```

and receive:

```js
{
  sourceObjectId: "source:p1:text:17",
  currentObjectId: "edit:abc",
  presentationState: "COMMITTED_REPLACEMENT",

  sourceText: "...",
  currentText: "...",

  sourceOwnershipRect: {...},
  layoutRect: {...},
  clientRect: {...},
  glyphInkRect: {...},

  sourceVisible: false,
  liveVisible: false,
  replacementVisible: true,

  masks: [...],

  collisions: [],

  generations: {...},

  invariantStatus: "valid"
}
```

This is how future agents should "see" the same state the user sees.

---

## 19. Add explainPoint()

Given a pointer/client coordinate, return:

```js
{
  point,
  coordinateSpace,
  candidates: [...],
  chosenObjectId,
  chosenReason,
  presentationState,
  sourceObjectId,
  interactiveRect,
  glyphInkRect,
  sourceOwnershipRect
}
```

The result must use the same resolver as actual hit testing.

Do not create a diagnostic-only hit-test algorithm.

---

## 20. Add validatePresentation()

Expose:

```js
validatePresentation()
```

Return:

```js
{
  valid: boolean,
  issues: [...],
  autoSuppressedPresentations: [...],
  generationState: {...}
}
```

The validator must check at least:

- one-current-presentation law
- required source coverage
- historical-not-live
- duplicate current source ownership
- mask ownership
- generation coherence
- invalid source+live
- invalid source+replacement
- invalid live+replacement
- conflicting masks
- obvious unrelated text overlaps

---

## 21. "Copy PDF Diagnostics" should include the presentation plan

Existing Copy PDF Diagnostics should include:

- current presentation plan
- Agent Page Mirror
- invariant results
- collision records
- generation state
- object state transitions
- source/live/replacement visibility flags

This makes user-reported screenshots directly debuggable.

A screenshot plus copied diagnostics should let an agent identify the conflicting layer without guessing.

---

## 22. Optional visual checksum / screenshot support seam

Do not add heavy browser automation into the extension.

But create a seam for future screenshot correlation.

For each visible object include:

```
clientRect
glyphInkRect
presentationState
presentationGeneration
```

A future browser/agent bridge should be able to compare a screenshot region to the structured mirror.

If a lightweight page-level visual fingerprint already exists, include it.

Do not implement OCR.

---

## 23. Agent-visible issues before the human notices

The planner must detect and emit structured issues BEFORE paint when possible.

Suggested issue codes:

```
PDF_MULTIPLE_VISIBLE_PRESENTATIONS_FOR_SOURCE
PDF_SOURCE_VISIBLE_DURING_LIVE_EDIT
PDF_SOURCE_VISIBLE_UNDER_REPLACEMENT
PDF_REPLACEMENT_VISIBLE_UNDER_LIVE_EDIT
PDF_REQUIRED_SOURCE_MASK_MISSING
PDF_SOURCE_MASK_GEOMETRY_MISMATCH
PDF_PRESENTATION_GENERATION_DESYNC
PDF_HISTORICAL_PRESENTATION_ATTEMPT
PDF_DUPLICATE_CURRENT_SOURCE_OWNER
PDF_UNEXPECTED_TEXT_OVERLAP
PDF_INTERACTIVE_RECT_DIVERGES_FROM_GLYPH_INK
```

Use existing issue taxonomy where appropriate.

Do not create duplicate meanings under new names unnecessarily.

---

## 24. Hard failure vs soft warning

Classify issues.

### Hard presentation failure

Must be prevented from painting:

- multiple live presentations for one source
- source visible underneath current replacement
- source visible underneath live edit
- historical current presentation
- missing required source coverage

### Soft warning

May paint but must be observable:

- unrelated text overlap
- interactive rectangle larger than glyph ink within tolerance
- low-confidence font substitution
- slightly stale non-critical UI geometry

This distinction is important.

---

## 25. Current interaction grammar remains simple

Preserve:

### Single click

- enters text editing
- caret placed where clicked
- typing visible immediately

### Double click

- remains in editing
- reveals controls/handles
- must not commit merely because of the double click

### Enter / focusout / Save / page change

- canonical commit path

Do not reintroduce mode confusion.

---

## 26. Replacement field geometry should begin from visible source geometry

For first edit of untouched source:

```
layoutRect initial geometry
=
visible source presentation rect
```

Do not immediately manufacture:
- two-line height
- arbitrary 72px field
- full-line block width
- semantic block bounding box

Unless the user types enough content to require growth.

The field may grow from that point according to deterministic autofit.

---

## 27. Font fidelity remains explicit

For first edit:

- infer source font family/category
- preserve source size
- preserve bold/italic where determinable
- diagnostics should state substitution if exact embedded font cannot be reused

Example:

```
source font: Century Schoolbook
live substitute: Times Roman
confidence: 0.82
reason: standard serif fallback
```

Do not silently pretend Helvetica is equivalent.

---

## 28. No broad semantic reconstruction on ordinary open

Preserve the current correction:

Opening a PDF must not rewrite untouched source into replacement edits.

Semantic margin analysis may remain diagnostic.

Only explicit user/layout actions may reconstruct source.

The presentation planner must never create authored edits merely to satisfy its own visibility rules.

Masks are presentation state, not semantic edits.

---

## 29. Save must consume the same current truth

Save should consume:

- current runtime truth
- canonical source ownership
- current replacement text/geometry
- presentation mask authority

It should not serialize transient UI state.

The presentation plan may help verify Save intent, but the plan itself is not the document model.

After Save/reopen:

- one current object
- one source ownership
- one current presentation
- no duplicate old source visible

---

## 30. Reopen must rebuild the same presentation state

For a saved replacement:

```
reopen
-> hydrate current replacement
-> build presentation plan
-> source covered
-> replacement visible once
```

No user typing should be required.

No unrelated click should be required.

No future rerender should be required.

---

## 31. Keep history and presentation separate

History Rich / future version history may preserve prior mutations.

But presentation state always answers:

> what is current now?

Historical objects must never become presentation candidates unless explicitly restored.

---

## 32. Browser-side agent inspection must be read-only in this run

This run should expose powerful inspection.

Do not derail into the full Native Messaging mutation API yet.

Required now:

- inspect
- explain
- validate
- copy diagnostics
- query current page state

Mutation commands can come in the later agent control-plane run.

The priority is making the agent able to **see structured truth** first.

---

## 33. Add a developer "Presentation Debug" toggle

If practical, add a developer/debug-only toggle or diagnostic mode that can visualize:

- source ownership rect
- layout rect
- glyph ink rect
- interactive rect
- mask rect
- current presentation state

Use distinct outlines/labels only in DEBUG/DEEP.

This is not production UI.

It must not alter geometry.

This lets a human and agent inspect the same named rectangles.

---

## 34. Use the actual sample PDF in tests

Required real fixture scenario using the first PDF under `/pdf/` or specifically `sample-local-pdf.pdf` where appropriate.

Do not mutate the fixture.

Test:

```
open
-> build page mirror
-> validate presentation
```

Expected:

```
valid = true
no current replacements
all source objects SOURCE_ONLY
no source-backed masks
```

Then create/edit one replacement and validate:

```
source identity has COMMITTED_REPLACEMENT
sourceVisible = false
replacementVisible = true
mask coverage complete
valid = true
```

---

## 35. Mandatory unit/integration tests

Add focused tests for at least:

1. source-only plan
2. active live-edit plan
3. committed-replacement plan
4. editing-existing-replacement plan
5. unchanged edit returns to source-only
6. historical object suppressed
7. duplicate current owner rejected/suppressed
8. source+replacement request becomes one legal presentation
9. source+live request becomes one legal presentation
10. live+replacement request becomes one legal presentation
11. missing mask blocks replacement presentation
12. wrong-owner mask rejected
13. mask rect follows immutable source ownership
14. UI handles excluded from collision
15. unrelated text overlap classified
16. generation mismatch prevents invalid plan promotion
17. inspectObject() returns same geometry/state used by renderer
18. explainPoint() uses actual hit-test resolver
19. validatePresentation() catches intentionally injected conflict
20. Copy PDF Diagnostics contains plan + mirror + invariants
21. save/reopen rebuilds one valid presentation
22. real sample PDF pristine open validates clean

---

## 36. Add one intentionally broken test plan

Construct an impossible input:

```
same source identity
sourceVisible requested
replacementVisible requested
mask missing
```

Expected:

- planner returns conflict
- hard invariant fails
- source/replacement are not both emitted to render plan
- validator explains exactly why
- issue names the sourceObjectId and currentObjectId

This test proves the architecture blocks the bug instead of merely observing it.

---

## 37. Performance

OFF mode must stay cheap.

Requirements:

- active page only
- no all-document DOM scans on every input
- no screenshot/OCR
- no unbounded journals
- collision checks should be spatially bounded
- no full PDF rebuild for hover
- plan construction should be proportional to active-page objects

DEBUG/DEEP can collect richer evidence.

---

## 38. Do not throw away existing systems

Reuse and connect:

- `pdf-runtime-truth.js`
- `pdf-observability.js`
- `pdf-forensics.js`
- `pdf-geometry.js`
- `pdf-layout.js`
- `pdf-document.js`
- existing generation clock
- existing causal journal
- existing hit testing
- existing current/historical filtering
- existing source ownership

Do not rebuild all of them under new names.

The goal is **coalescence**.

---

## 39. Architectural target

The target is:

```
                CANONICAL PDF STATE
                       │
                       ▼
              PdfPresentationPlan
                       │
              invariant / collision gates
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
       CANVAS         MASKS       DOM TEXT
          │            │            │
          └────────────┼────────────┘
                       ▼
                 HUMAN VIEW

                       │
                       ▼
                Agent Page Mirror
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       inspect       explain      validate
```

Human view and agent mirror must derive from the same plan.

---

## 40. Final acceptance scenario

With `pdf/sample-local-pdf.pdf`:

### Fresh open

Expected:
- source PDF visually unchanged
- no phantom replacements
- plan valid
- all source text SOURCE_ONLY

### Single click

Expected:
- clicked source becomes LIVE_EDIT
- original glyph is covered
- live text is visible immediately
- no committed replacement under it
- mirror reports one presentation

### Type

Expected:
- live text updates immediately
- source stays covered
- no collision with its own source
- geometry trace explains field size

### Click away

Expected:
- live edit commits
- persistent source mask exists
- source remains hidden
- replacement visible exactly once
- plan valid

### Click without typing

Expected:
- no replacement authored
- source returns unchanged
- no persistent mask

### Diagnostics

Agent Page Mirror must make the exact current state inspectable without needing screenshot interpretation.

---

## 41. Testing

Run syntax checks for every modified JS module.

Run focused tests for:
- presentation planner
- agent mirror
- PDF live editing
- runtime truth
- mask ownership
- diagnostics

Then run:

```
node --test tests/pdf-*.test.mjs
node --test tests/*.test.mjs
```

Do not claim browser visual verification unless a real browser was actually used.

If no browser is used, explicitly state that the structured presentation invariants passed but Chrome visual confirmation is still pending.

---

## Final laws

1. One semantic source identity has at most one visible textual presentation.
2. Source ownership is the only erase authority.
3. Live/replacement text cannot appear before source coverage exists.
4. Unchanged clicks do not author edits.
5. Historical state never renders.
6. Renderer consumes presentation truth; it does not invent it.
7. Invalid plans are blocked, not merely logged.
8. Human view and agent mirror derive from the same presentation plan.
9. Every visible rectangle has mathematical ancestry.
10. Controls are not content.
11. Current truth is independent from history.
12. Save/reopen must reconstruct the same current presentation.
13. Agent inspection must use the same hit testing and geometry as the UI.
14. OFF mode remains cheap.
15. If the human can see the defect, the machine must be able to name it.

---

## Deliverable

This run is complete when SUBSTRATE can answer, for any active PDF text object:

```
What is the source identity?
What is the current object?
What state is it in?
Which textual presentation is visible?
Why is it visible?
Which source region is covered?
Which mask owns that coverage?
What geometry does the human see?
What geometry does hit testing use?
What collisions exist?
Are all hard presentation invariants valid?
What changed in the last mutation?
```

and when a source/replacement superimposition state is rejected before it reaches the human view.
