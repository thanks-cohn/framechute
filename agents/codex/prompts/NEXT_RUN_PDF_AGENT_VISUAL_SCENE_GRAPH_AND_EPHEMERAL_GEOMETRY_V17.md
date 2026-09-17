# NEXT RUN — PDF AGENT VISUAL SCENE GRAPH + EPHEMERAL GEOMETRY TRACE V17

Repository: `thanks-cohn/framechute`
Target branch: `main`

## Mission

Extend Substrate's existing PDF observability system into an **agent-readable visual scene graph** that can describe what the user is actually seeing and interacting with on the current PDF page.

The goal is not merely to know where a PDF text object exists semantically. The goal is to make every important visual projection of that object measurable, comparable, and traceable:

- original PDF source text
- visible glyph ink
- invisible/transparent hit target
- hover outline / hover box
- selected field box
- editable content field
- erase mask
- replacement text
- search highlight
- pointer location
- canvas location
- text-layer location
- clipping and stacking context
- scroll offset
- toolbar / reader movement

When the human says:

> "The hover box is near the sentence but not actually over it."

Substrate must be able to answer programmatically:

> visible glyph ink is at `(x,y,w,h)`
> hover/hit box is at `(x,y,w,h)`
> overlap ratio is `63%`
> center delta is `(+7.2px, -11.4px)`
> first divergence occurs between `pdf-viewport-css` and `text-layer-local-css`
> probable cause: stale transform / wrong origin / oversized field / layout shift

This is the architecture that lets ChatGPT/Codex "see" the same geometry the user sees without requiring a screenshot for every bug.

---

# 1. Build on the current observability foundation

Do not replace the current diagnostics system.

Extend the existing architecture in:

- `src/documents/pdf-observability.js`
- `src/documents/pdf-geometry.js`
- `src/documents/pdf-document.js`
- `src/workspace.js`
- tests

The current code already has:

- explicit coordinate-space names
- page geometry capture
- canvas/text-layer alignment checks
- pointer hit-test dossiers
- bounded interaction and mutation journals
- object identity/provenance
- glyph/client/editable rectangles
- Copy Page Diagnostics
- stable issue codes

V17 should turn those pieces into a coherent **current-page visual scene model**.

---

# 2. Core design law

> If the human can point at, hover over, click, select, edit, mask, or visually compare something, the agent must be able to obtain its geometry and relationship to the thing it represents.

And:

> Every ephemeral visual state must leave a bounded programmatic trace in Debug mode.

Normal users must not pay the RAM/CPU cost of deep diagnostics.

---

# 3. Introduce a Visual Projection Record

For every relevant PDF object, create a structured record of its visual projections.

Conceptually:

```js
{
  objectId: "source:p1:text:17",
  sourceObjectId: "source:p1:text:17",
  ownerEditId: null,
  page: 1,
  text: "and one cannot possibly be longer",

  semantic: {
    kind: "source-text-run",
    pdfRect: { rect: {...}, space: "pdf-points" }
  },

  projections: {
    expectedViewport: { rect: {...}, space: "pdf-viewport-css" },
    domLayout: { rect: {...}, space: "client-css" },
    glyphInk: { rect: {...}, space: "glyph-ink-client-css" },
    hitTarget: { rect: {...}, space: "client-css" },
    hoverOutline: { rect: {...}, space: "client-css" },
    selectedField: null,
    editableField: null,
    sourceMask: null,
    replacementField: null
  },

  visualState: {
    hovered: false,
    selected: false,
    editing: false,
    visible: true,
    clipped: false,
    pointerReachable: true,
    zIndex: 0
  }
}
```

Do not require every projection to exist at all times.

Null is valid and informative.

---

# 4. Hover geometry must become first-class

The current bug class includes cases where the user hovers over visible text but the outline appears displaced or covers the wrong region.

Capture the hover state explicitly.

On `pointerover` / `pointermove` / `pointerout` in diagnostic mode, record:

- pointer client coordinates
- target element identity
- `elementFromPoint`
- `elementsFromPoint`
- visible glyph ink rect
- CSS box rect
- actual hover-outline rect
- nearest visible text candidates
- chosen DOM object
- distance from pointer to glyph ink
- distance from pointer to hit target
- overlap between hover outline and glyph ink

Add a stable issue code:

```text
HOVER_BOX_GLYPH_MISMATCH
```

Trigger when the hover projection is materially displaced from the glyph ink it claims to represent.

---

# 5. Add geometric relationship metrics

Do not make agents infer overlap from raw rectangles.

For any two relevant visual projections, support a reusable relationship record:

```js
{
  a: "glyphInk",
  b: "hoverOutline",
  intersectionRect: {...},
  intersectionArea: 823.4,
  unionArea: 1210.7,
  iou: 0.68,
  coverageOfA: 0.91,
  coverageOfB: 0.74,
  centerDelta: { x: 6.2, y: -9.8 },
  edgeDelta: {
    left: 4.1,
    top: -10.0,
    right: 8.2,
    bottom: -9.6
  },
  classification: "near-but-misaligned"
}
```

Provide classifications such as:

- `aligned`
- `near-but-misaligned`
- `partial-overlap`
- `contains-glyphs`
- `oversized-hitbox`
- `undersized-hitbox`
- `disjoint`
- `offscreen`
- `clipped`

This is essential.

The agent should not merely know coordinates. It should know **what the coordinates mean relative to each other**.

---

# 6. Define explicit visual alignment invariants

Add invariant checks for the important relationships.

At minimum:

```text
SOURCE_DOM_SHOULD_COVER_SOURCE_GLYPH
HOVER_BOX_SHOULD_COVER_HIT_GLYPH
SELECTED_FIELD_SHOULD_REMAIN_ANCHORED_TO_SOURCE
EDITABLE_FIELD_SHOULD_REMAIN_ANCHORED_TO_SELECTED_FIELD
SOURCE_MASK_SHOULD_COVER_SUPERSEDED_SOURCE_GLYPH
REPLACEMENT_GLYPH_SHOULD_FIT_REPLACEMENT_FIELD
POINTER_TARGET_SHOULD_MATCH_NEAREST_VISIBLE_GLYPH
CANVAS_AND_TEXT_LAYER_SHOULD_SHARE_PAGE_ORIGIN
```

Each failure must report:

- object IDs
- coordinate spaces
- expected geometry
- actual geometry
- relationship metrics
- first transform stage where divergence appears
- current interaction state

---

# 7. Build a current-page Visual Scene Graph

Create an on-demand function approximately like:

```js
capturePdfVisualScene(block, runtime, options)
```

Return a serializable scene graph for the current page.

Conceptually:

```js
{
  schemaVersion: "...",
  page: 1,

  viewport: {...},
  surface: {...},
  canvas: {...},
  textLayer: {...},
  scroll: {...},
  chrome: {...},

  objects: [...visualProjectionRecords],

  relationships: [
    {
      from: "source:p1:text:17",
      to: "hover:source:p1:text:17",
      type: "projects-to",
      metrics: {...}
    }
  ],

  pointer: {...},
  interaction: {...},
  issues: [...]
}
```

The purpose is to let an agent reconstruct the visible state mathematically.

---

# 8. Distinguish semantic object from visual projections

Do not treat these as the same thing:

```text
semantic PDF text run
DOM hit box
visible glyph ink
hover outline
edit field
mask
replacement glyphs
```

They are related projections of one logical object.

A large class of current bugs exists precisely because those projections can diverge.

The architecture must make divergence explicit rather than collapsing them into one rectangle.

---

# 9. Ephemeral state trace

In Debug mode, create a bounded event trace for visual state transitions.

Capture states such as:

```text
pointer-enter
pointer-move
hover-acquired
hover-lost
pointerdown
mousedown
click
selected
before-controls-change
after-controls-change
dblclick
before-contenteditable
after-contenteditable
before-focus
after-focus
selection-created
input
focusout
rerender-start
rerender-complete
```

Each event should capture only the relevant current-page geometry.

Example:

```js
{
  sequence: 903,
  event: "hover-acquired",
  pointer: { x: 612, y: 553 },
  objectId: "source:p1:text:17",
  projections: {
    glyphInk: {...},
    hitTarget: {...},
    hoverOutline: {...}
  },
  relationships: {
    hoverToGlyph: {...}
  },
  pageGeometryFingerprint: "..."
}
```

Memory must be bounded.

Suggested default diagnostic journal sizes:

- 60 interaction events
- 30 geometry mutations
- current page only

---

# 10. Add Debug modes without burdening normal users

Introduce an explicit runtime diagnostic level.

### OFF / Normal

Default.

- no pointer-move journal
- no Range glyph scanning except where already needed
- no scene graph retention
- no continuous layout observation
- negligible additional memory

### DEBUG

Current PDF block + current page only.

- pointer hover/click trace
- object projection capture
- relationship metrics
- bounded journals
- current chrome/page geometry

### DEEP DEBUG

Explicitly invoked by agent/user.

- glyph Range rects per text object
- TextMetrics
- full stacking/clipping ancestry
- full current-page projection graph
- richer transform chain evidence

No full-document DOM residency.

No permanent observer scanning every page.

No screenshot loop.

---

# 11. Instrument CSS-generated visual state

The machine must know what the user sees even when the appearance comes from CSS.

For hover/selected/editing states, capture relevant computed style:

- outline width/style
- background
- opacity
- visibility
- display
- pointer-events
- z-index
- overflow
- transform
- transform-origin
- clip-path if present
- bounding client rect

If a hover outline is produced by CSS rather than a dedicated DOM node, derive its visual rectangle from the element's border box + outline width.

Name that projection explicitly:

```text
hover-outline-client-css
```

Do not pretend the DOM border box and the visible outline are identical if the outline extends beyond it.

---

# 12. Trace stacking and clipping

For each active/hovered/selected object, capture enough ancestry to answer:

- is it clipped?
- by which ancestor?
- is overflow hiding part of the box?
- is another element painted above it?
- is pointer-events disabled?
- is the object visually behind a mask?

Add a compact `visualAncestry` record.

Do not dump the entire DOM tree.

Only the ancestors that affect:

- coordinate origin
- transform
- scroll
- clipping
- stacking

---

# 13. Add first-divergence analysis

Given two projections that should align, provide a helper that walks their transform ancestry and reports the first stage where they diverge.

Example output:

```js
{
  expected: "glyphInk",
  actual: "hoverOutline",
  firstDivergence: {
    stage: "text-layer-local-css -> client-css",
    expectedOrigin: {x: 284.0, y: 401.2},
    actualOrigin: {x: 284.0, y: 438.4},
    delta: {x: 0, y: 37.2},
    causeCandidates: ["layout-shift", "stale-client-rect"]
  }
}
```

Do not overclaim a cause when only a location of divergence is known.

Use `causeCandidates` or equivalent.

---

# 14. Add agent questions as APIs

Create helper queries over the scene graph so ChatGPT/Codex can ask direct questions.

Examples:

```js
findVisualObjectAtPoint(scene, {x, y})
nearestVisibleGlyph(scene, {x, y})
compareObjectProjection(scene, objectId, "hoverOutline", "glyphInk")
objectsWhoseHitboxesDoNotMatchGlyphs(scene)
objectsWithUnexpectedVisualOverlap(scene)
firstGeometryDivergence(scene, objectId)
```

These can be ordinary pure helper functions.

The important thing is that the diagnostics become queryable, not merely a giant JSON dump.

---

# 15. Upgrade Copy Page Diagnostics

Extend the existing command so an agent receives a concise but complete visual scene dossier.

Include:

- page geometry
- canvas/text-layer alignment
- current toolbar/chrome geometry
- current pointer state
- active hover object
- selected object
- editing object
- all current-page visual projection records
- projection relationship metrics
- current issues
- recent interaction trace
- recent geometry mutation trace
- first-divergence analyses for failing invariants

Avoid unnecessary duplicated data.

If the full scene is too large, return:

```text
summary
+ failing objects
+ active/hovered/selected/editing objects
+ bounded surrounding candidates
```

and provide a separate Deep Diagnostics path for all current-page objects.

---

# 16. Add smoke tests for visual relationships

Create deterministic tests for the math and state transitions.

At minimum:

### Hover box exact alignment

Glyph and hover box overlap nearly perfectly.

Expected classification:

```text
aligned
```

### Hover box near but wrong

Shift hover rect by 8px x / 12px y.

Expected:

```text
near-but-misaligned
HOVER_BOX_GLYPH_MISMATCH
```

### Oversized hit field

Hit target covers two neighboring lines while glyph ink belongs to one.

Expected:

```text
oversized-hitbox
```

### Disjoint edit field

Edit field is one line above source glyphs.

Expected:

```text
EDIT_FIELD_TELEPORTED_FROM_SOURCE
```

### Shared page translation

Canvas, text layer, glyph, hover field all move +40px together.

Expected:

```text
no relative alignment failure
EXPECTED_SHARED_LAYOUT_SHIFT
```

### One-layer-only movement

Canvas moves +40px, text layer does not.

Expected:

```text
PDF_CANVAS_TEXT_LAYER_ORIGIN_MISMATCH
```

### Scroll

Scroll current PDF surface while preserving local alignment.

Client coordinates change, page-local relationships remain stable.

### Zoom

At 50%, 100%, 200%, relationship metrics remain geometrically equivalent within tolerance.

---

# 17. Make visual states replayable enough for debugging

Do not build a full event-replay engine yet.

But every interaction trace record should contain enough state to compare:

```text
before hover
hover
before click
selected
after edit activation
rerendered
```

This allows agents to identify exactly which transition broke alignment.

---

# 18. Do not solve the current PDF bug with arbitrary offsets

This task is architecture-first.

Do not add:

```js
top += 12
left -= 4
```

because a screenshot appears better.

Instead:

1. measure the visible glyphs,
2. measure the hover/hit/edit projections,
3. compare them,
4. locate first divergence,
5. only then fix the underlying transform/layout ownership error.

---

# 19. Preserve the stable toolbar work

The PDF toolbar now has stable persistent rows so editing controls do not appear/disappear and move the page during a click sequence.

Do not undo that.

The visual scene graph should observe toolbar/chrome geometry, not reintroduce dynamic toolbar height.

---

# 20. Performance acceptance

Normal usage must remain effectively unchanged.

Acceptance targets:

- no full-document scan
- no retained all-page DOM geometry
- no continuous pointer telemetry when Debug is OFF
- no unbounded arrays
- no screenshot capture loop
- current-page-only deep observations
- diagnostics collected lazily/on interaction/on explicit command
- suitable for low-memory machines

---

# 21. Debug-mode activation

Provide a simple internal mechanism for agents/developers to enable debug mode.

Prefer a runtime flag / dataset / settings hook that can later be exposed in UI.

For now it is acceptable to support something explicit such as:

```js
setPdfDiagnosticMode(block, "debug")
setPdfDiagnosticMode(block, "deep")
setPdfDiagnosticMode(block, "off")
```

Do not make Debug mode permanently active by default.

---

# 22. The ultimate question this architecture must answer

For any visible text object:

> Is the hover/edit/hit field actually superimposed on the visible text?

If YES:

- by how much?
- what percentage overlaps?
- does it fully contain the glyphs?
- is it too large?

If NO:

- how far away is it?
- in which direction?
- which coordinate transform introduced the error?
- did a parent layout/scroll/toolbar mutation cause it?
- is the DOM field stale while the canvas moved?
- is the hit target owned by the wrong semantic object?

That question must be answerable from diagnostics alone.

---

# 23. Acceptance criteria

V17 is complete when:

1. Every relevant current-page PDF object can expose separate semantic, glyph, DOM, hover, hit, selected, editable, mask, and replacement projections.
2. Projection relationships include overlap and displacement metrics.
3. Hover geometry is explicitly captured in Debug mode.
4. Pointer target vs visible glyph can be compared directly.
5. The current selected/editing field can be compared against the source glyphs it represents.
6. Visual clipping/stacking/transform ancestry is captured compactly.
7. A first-divergence report identifies the transform stage where alignment first fails.
8. Copy Page Diagnostics exports enough current-page visual information for ChatGPT/Codex to diagnose geometry without a screenshot.
9. Debug mode is bounded and off by default.
10. Smoke tests cover aligned, near-misaligned, oversized, disjoint, shared-translation, scroll, and zoom cases.
11. No arbitrary offset compensation is introduced.
12. Existing PDF save/reopen, semantic layout, editing, toolbar stability, masks, and low-memory behavior remain intact.

---

# Design credo

> The PDF should not merely render visually. Its visual state should have a machine-readable shadow.

> The human sees glyphs, fields, highlights, masks, and movement. The agent should receive coordinates, identities, transforms, relationships, and state transitions for those same things.

> Every visible projection should have a mathematical ancestry.

This is a foundational step toward making Substrate a PDF engine that human users, renderers, and agents can all reason about from the same underlying spatial truth.