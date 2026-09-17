# NEXT RUN — SUBSTRATE PDF GEOMETRY TRUTH, VISUAL TELEMETRY, AND REGRESSION RAILGUARDS V16

Repository: `thanks-cohn/framechute`

## Mission

Build the mathematical/debugging architecture that makes PDF visual geometry observable enough that an agent can understand what the human sees without depending on screenshots.

The immediate symptom motivating this work is severe:

- the user visually double-clicks one PDF text line,
- hover/highlight geometry appears offset from the visible glyphs,
- activating editing can cause the page to move,
- the bounded editable field can appear at a different vertical position from the text the user clicked,
- toolbar/chrome height changes are suspected of affecting coordinate geometry.

Do **not** solve this with arbitrary pixel offsets.

Instead make Substrate able to answer, programmatically and deterministically:

> What object did the user visually point at?
> Where is that object according to the PDF?
> Where is its DOM hit target?
> Where are its visible glyphs?
> Where is its editable field?
> Where is the canvas?
> Where is the text layer?
> What changed between pointerdown, click, double-click, focus and editing?
> Which transform or layout mutation caused any displacement?

The goal is to turn the visual UI into structured machine-readable geometry.

## 1. Core invariant

For every visually interactive PDF object, Substrate must be able to describe this chain:

```text
PDF object
↓
PDF-point rectangle
↓
viewport transformation
↓
page-local CSS rectangle
↓
text-layer-local rectangle
↓
client/browser rectangle
↓
visible glyph-ink rectangle
↓
pointer/hit-test rectangle
↓
editable-field rectangle
```

Every transition must be explicit and inspectable.

No hidden coordinate conversion.

No CSS transform should be treated as invisible implementation detail.

## 2. Canonical coordinate spaces

Create or extend a strict coordinate-space registry.

At minimum support:

- `pdf-points`
- `semantic-pdf-points`
- `pdf-viewport-css`
- `pdf-surface-local-css`
- `pdf-text-layer-local-css`
- `block-local-css`
- `workspace-css`
- `client-css`
- `document-css`
- `device-pixels`
- `canvas-backing-pixels`
- `glyph-ink-client-css`
- `editable-field-client-css`

Every geometry record must say what coordinate space it belongs to.

Never expose a bare `{x,y,width,height}` in diagnostics without its coordinate-space identity.

Prefer immutable records such as:

```js
{
  rect: { x, y, width, height },
  space: "pdf-text-layer-local-css"
}
```

## 3. Explicit transform chain

Add a reusable geometry-transform chain abstraction.

Example:

```js
{
  from: "pdf-points",
  to: "client-css",
  steps: [
    {
      kind: "pdf-viewport",
      scale: 1.25,
      rotation: 0,
      matrix: [...]
    },
    {
      kind: "text-layer-origin",
      left: ...,
      top: ...
    },
    {
      kind: "scroll",
      scrollLeft: ...,
      scrollTop: ...
    },
    {
      kind: "css-transform",
      matrix: [...]
    }
  ]
}
```

Codex should be able to reconstruct exactly how a PDF rectangle became the browser rectangle the user sees.

Add inverse transforms where meaningful.

Round-trip invariant:

```text
PDF → client → PDF
```

must remain within an explicitly defined tolerance.

## 4. The page alignment contract

The PDF canvas and PDF text layer depict the SAME page.

Create a first-class page-alignment invariant.

For each rendered page capture:

```js
{
  canvas: {
    clientRect,
    cssWidth,
    cssHeight,
    backingWidth,
    backingHeight
  },

  textLayer: {
    clientRect,
    cssWidth,
    cssHeight,
    transform
  },

  viewport: {
    width,
    height,
    scale,
    rotation,
    transform
  },

  alignment: {
    originDelta,
    widthDelta,
    heightDelta,
    scaleDelta
  }
}
```

Required invariants:

```text
canvas visual origin == text layer visual origin
canvas CSS size == viewport CSS size
text layer CSS size == viewport CSS size
text-layer transform must be accounted for
```

If not, emit stable issue codes:

```text
PDF_CANVAS_TEXT_LAYER_ORIGIN_MISMATCH
PDF_CANVAS_TEXT_LAYER_SIZE_MISMATCH
PDF_VIEWPORT_SURFACE_TRANSFORM_MISMATCH
```

Include numerical deltas.

## 5. Visible glyph geometry

DOM span rectangles are NOT sufficient.

For PDF source text and edited text, capture both:

```text
layout rectangle
glyph ink rectangle
```

Use DOM Range geometry where possible:

- `Range.getClientRects()`
- `Range.getBoundingClientRect()`

Also capture Canvas `TextMetrics` when useful:

- actualBoundingBoxLeft
- actualBoundingBoxRight
- actualBoundingBoxAscent
- actualBoundingBoxDescent

Example object:

```js
{
  id: "...",
  text: "...",

  expectedPdfRect: ...,
  expectedViewportRect: ...,

  domRect: ...,
  glyphInkRect: ...,
  editableRect: ...,

  deltas: {
    expectedToDom: ...,
    domToInk: ...,
    inkToEditable: ...
  }
}
```

A human sees glyph ink, not merely CSS boxes.

## 6. Pointer truth / hit-testing truth

When the user clicks or double-clicks text, capture an on-demand hit-test dossier.

Record:

```js
{
  event: "dblclick",

  pointer: {
    clientX,
    clientY
  },

  target: {
    tag,
    classes,
    objectId,
    sourceObjectId,
    editId
  },

  elementFromPoint: ...,
  elementsFromPoint: [...],

  candidatePdfObjects: [...],

  chosenObject: ...,

  pointerDeltaFromChosenInk: {
    x,
    y,
    distance
  }
}
```

The selected editable object must correspond to the visually clicked object.

Define invariant:

```text
POINTER_TARGET_DOES_NOT_MATCH_VISIBLE_GLYPH
```

when the chosen object is materially farther from the pointer than another valid visible glyph candidate.

Do not silently guess.

## 7. Interaction timeline

Geometry bugs often exist only during a transition.

Create a bounded interaction journal.

For PDF text interactions capture geometry at:

```text
pointerdown
mousedown
click
dblclick
before-focus
after-focus
before-contenteditable
after-contenteditable
selection-created
editing-active
focusout
rerender-start
rerender-complete
```

Each event records only lightweight geometry/state.

Example:

```js
{
  sequence: 481,
  event: "dblclick",
  timestamp: ...,

  objectId: "...",

  page: 1,

  pageGeometryFingerprint: "...",

  object: {
    domRect,
    glyphInkRect,
    editableRect
  },

  surface: {
    canvasRect,
    textLayerRect,
    scrollTop,
    scrollLeft
  }
}
```

Bound memory.

Do NOT continuously collect forever.

Default normal mode must remain cheap.

## 8. Geometry mutation detection

Add a geometry fingerprint for every relevant PDF render state.

A fingerprint should represent things that can alter page geometry, including:

- PDF frame rectangle
- toolbar height
- search toolbar visibility/height
- block header visibility/height
- reader rectangle
- side-panel width
- PDF surface rectangle
- PDF surface padding
- surface scroll offsets
- canvas client rectangle
- text-layer client rectangle
- text-layer CSS transform
- current zoom
- fit mode
- devicePixelRatio
- page viewport width/height
- toolbar row count
- active edit-controls visibility

When a meaningful geometry mutation occurs, compare BEFORE and AFTER.

Example:

```js
{
  cause: "pdf-edit-controls-revealed",

  before: {...},
  after: {...},

  deltas: {
    toolbarHeight: +37,
    readerTop: +37,
    canvasTop: +37,
    textLayerTop: +37,
    canvasVsTextLayerDelta: 0
  }
}
```

The important distinction:

Moving the whole page together may be valid.

Moving only one geometry system is a bug.

## 9. Layout shift classification

Create classifications such as:

```text
EXPECTED_SHARED_LAYOUT_SHIFT
UNEXPECTED_PAGE_LAYOUT_SHIFT
CANVAS_ONLY_SHIFT
TEXT_LAYER_ONLY_SHIFT
EDIT_FIELD_ONLY_SHIFT
GLYPH_HITBOX_DIVERGENCE
SCROLL_ORIGIN_CHANGED
CSS_TRANSFORM_CHANGED
PDF_VIEWPORT_CHANGED
TOOLBAR_CAUSED_GEOMETRY_CHANGE
```

Do not merely emit "geometry changed."

Explain what changed relative to what.

## 10. Make the toolbar observable

Recent toolbar work changed PDF chrome into multiple rows.

Do NOT assume toolbar code is innocent or guilty.

Instrument it.

When toolbar rows, popdowns, edit controls, Search, Organize, More, File, or other chrome change layout, record:

```js
{
  toolbar: {
    clientRect,
    rowCount,
    primaryRect,
    secondaryRect,
    children: [...]
  }
}
```

Then verify that canvas and text layer remain mutually aligned after every toolbar mutation.

The rule:

> Chrome may move the entire PDF reader. Chrome must never desynchronize coordinate systems inside the reader.

## 11. Editing geometry invariant

Double-clicking source text must NOT teleport its edit field.

When entering edit mode:

```text
visible source glyph
        ↓
chosen source object
        ↓
editable field
```

must stay geometrically associated.

Capture:

```js
sourceGlyphInkRect
sourceDomRect
editFieldRectBeforeFocus
editFieldRectAfterFocus
```

Invariant:

```text
EDIT_FIELD_TELEPORTED_FROM_SOURCE
```

if the editable rectangle changes unexpectedly simply because:

- focus occurred
- contentEditable became true
- toolbar controls became visible
- text selection was created

Opening editing controls must not change the page-local geometry of the selected PDF text.

## 12. Separate selection behavior from geometry

The existing editor programmatically selects the full contents of a text span on double-click.

Do not let selection behavior obscure geometry debugging.

Diagnostics must separately report:

```text
clicked object
selected browser Range
editing object
```

They are distinct concepts.

Eventually normal browser-like behavior is desired:

- double-click text
- edit the field that was actually clicked
- no unexpected teleport
- normal caret/word selection behavior
- Ctrl/Cmd+A selects the active field

But first make the geometry measurable enough to prove the fix.

## 13. Programmatic "what the human sees"

Create an on-demand object/page visual dossier.

Example:

```js
{
  page: 1,

  viewport: {...},

  visualObjects: [
    {
      id,
      type,
      text,

      visible: true,

      stacking: {
        zIndex,
        paintOrder
      },

      clipping: {
        clippedBy,
        overflow
      },

      pdfRect,
      expectedViewportRect,
      domRect,
      glyphInkRect,

      hitTest: {
        pointerEvents,
        elementFromPointReachable
      }
    }
  ]
}
```

The machine should be able to answer:

```text
"What text is visually at client point 423, 581?"
```

without seeing a screenshot.

Also:

```text
"Which DOM object owns those visible glyphs?"
"Which edit object would double-click activate?"
"Are those the same object?"
```

## 14. Geometry issue registry

Use stable machine-readable issue codes.

At minimum:

```text
PDF_CANVAS_TEXT_LAYER_ORIGIN_MISMATCH
PDF_CANVAS_TEXT_LAYER_SIZE_MISMATCH
PDF_VIEWPORT_TRANSFORM_MISMATCH
PDF_OBJECT_DOM_RECT_MISMATCH
PDF_OBJECT_GLYPH_RECT_MISMATCH
POINTER_TARGET_DOES_NOT_MATCH_VISIBLE_GLYPH
EDIT_FIELD_TELEPORTED_FROM_SOURCE
EDIT_FIELD_CHANGED_ON_FOCUS
EDIT_FIELD_CHANGED_ON_SELECTION
TOOLBAR_CHANGED_PAGE_COORDINATE_ORIGIN
SEARCH_BAR_CHANGED_PAGE_COORDINATE_ORIGIN
TEXT_LAYER_SCROLL_DESYNCHRONIZED
UNACCOUNTED_CSS_TRANSFORM
UNEXPECTED_GEOMETRY_MUTATION
```

Every issue includes:

- object ID
- page
- expected rect
- actual rect
- delta
- coordinate spaces
- interaction event
- probable transform stage where divergence first appeared

## 15. Smoke tests

Build deterministic tests around the actual geometry system.

Do not limit testing to pure math functions.

Where DOM/browser APIs are unavailable in Node, isolate math from DOM capture and test both layers appropriately.

Required smoke scenarios:

### A. Baseline render

Render one page.

Assert:

```text
canvas origin == text-layer origin
canvas size == viewport
text-layer size == viewport
```

### B. One-row → two-row toolbar

Simulate/invoke toolbar changing height.

Expected:

```text
reader moves downward
canvas moves downward equally
text layer moves downward equally
internal page-local object geometry DOES NOT change
```

### C. EDIT controls appear

This is extremely important.

Double-click source text causing font controls to become visible must not move the text layer relative to the canvas.

### D. Search bar open / close

Opening Search may move the reader.

Canvas and text layer must move together.

### E. Popdown open / close

File / Organize / More must not change PDF page geometry unless intended.

### F. Side panel

Pages / Outline panel changes available reader width.

Viewport recalculation, if any, must be explicit and leave text/canvas aligned.

### G. Zoom

25%, 50%, 100%, 125%, 200%.

Test PDF → viewport → client → PDF round trips.

### H. Frame resize

Resize PDF block repeatedly.

Check viewport, canvas, text layer and hit targets.

### I. Scroll

Scroll vertically and horizontally.

Hit testing must still select visible glyphs beneath the pointer.

### J. Double-click editing

Given a known text item:

1. record visible glyph rect
2. synthesize click/double-click at its center
3. determine chosen object
4. enable editing
5. expose editing controls
6. record editable field rect

Fail if the editable field teleports.

### K. Source vs replacement

After editing/reflow, clicking replacement text must activate the current replacement object, never hidden/stale source geometry.

### L. Save/reopen

Current visual object geometry should remain traceable after save/reopen.

## 16. Geometry smoke-test helper

Create a reusable helper approximately like:

```js
assertRectNear(actual, expected, {
  tolerance: 1,
  message: "text layer must remain aligned with canvas"
});
```

and:

```js
assertSharedTranslation(beforeA, afterA, beforeB, afterB, tolerance);
```

This catches the important distinction:

```text
both moved +37px = probably valid
one moved +37px, other moved 0px = broken
```

## 17. Debug modes

Diagnostics must stay lightweight.

Support:

### Normal
No continuous expensive capture.

### Diagnostic
Current PDF/page only.
Bounded interaction journal.
DOM rectangles.
Transform chain.
Hit-test information.

### Deep
Explicitly user/agent requested.
Glyph ranges.
TextMetrics.
Full object dossier for current page.

No all-document DOM scanning.

No continuous MutationObserver over the whole application.

No screenshot loop.

## 18. Copy Page Diagnostics upgrade

Extend the existing Copy Page Diagnostics command.

It should now include:

```text
page geometry
canvas geometry
text-layer geometry
surface geometry
toolbar/chrome geometry
transform chain
visible object dossier
selected object
editing object
glyph geometry
pointer/hit-test dossier
recent interaction geometry events
geometry mutation journal
invariant failures
issue codes
```

The result should be useful pasted directly into ChatGPT/Codex.

The ideal outcome:

The user can say:

> "I clicked this line and its editor appeared above it."

and provide diagnostics that allow the agent to prove:

```text
glyph at y=584
DOM hitbox at y=583
clicked source index=17
toolbar grew by 37px
canvas moved by 37px
text layer stayed in old coordinate origin
edit field therefore appeared at y=546
```

That is the level of observability desired.

## 19. Do not fix symptoms with magic numbers

Forbidden:

```js
top += 37;
top -= toolbar.offsetHeight;
```

unless it is part of a mathematically explicit coordinate transform whose correctness is tested.

No "this looked right on my machine" geometry.

No static compensating offsets.

Find the first coordinate-space divergence.

Fix the transform/origin contract.

## 20. Keep PDF architecture authoritative

Preserve:

- PDF points as canonical document geometry
- existing semantic page model
- stable edit identities
- current-version semantics
- shared live/save mask model
- lazy page behavior
- low-memory design
- current terminal source-fragment fix

Do not rewrite unrelated PDF editing architecture.

Do not reintroduce draggable page margins/guides.

That experiment previously interfered with editing and was reverted.

## 21. Files likely involved

Inspect before editing:

```text
src/workspace.js
src/workspace.css
src/pdf-popdowns.js
src/documents/pdf-document.js
src/documents/pdf-geometry.js
src/documents/pdf-layout.js
src/documents/pdf-observability.js
tests/
```

Do not assume the bug lives in the toolbar.

Measure first.

## 22. Regression philosophy

Every future visual/chrome change should be able to trigger a question:

> Did any PDF geometry change?

And the system should answer programmatically:

```text
No.
```

or:

```text
Yes:
toolbar height +38 px
reader y +38 px
canvas y +38 px
text layer y +38 px
page-local geometry unchanged
status: EXPECTED_SHARED_LAYOUT_SHIFT
```

or:

```text
Yes:
toolbar height +38 px
canvas y +38 px
text layer y +0 px
status: PDF_CANVAS_TEXT_LAYER_ORIGIN_MISMATCH
```

That is the architectural goal.

## 23. Acceptance criteria

This task is complete only when:

1. Canvas/text-layer alignment is explicitly measurable.
2. PDF-point → browser geometry has a documented transform chain.
3. Visible glyph geometry is distinguishable from DOM box geometry.
4. Pointer hit-testing is observable.
5. Double-click → edit activation has a before/after geometry trace.
6. Toolbar/search/edit-control changes generate geometry deltas.
7. Unexpected geometry shifts produce stable issue codes.
8. Current-page diagnostics explain the current user's misplaced-editor bug without requiring a screenshot.
9. Smoke tests exercise chrome changes, zoom, resize, scroll and editing.
10. Diagnostics remain dormant/lightweight during ordinary usage.
11. No magic compensating offsets are introduced.
12. Existing save/reopen and PDF editing behavior is not intentionally regressed.

## Design law

> If the human can see that two things do not line up, the machine must be able to measure that they do not line up.

And:

> Every visual position in Substrate must have a mathematical ancestry.

The purpose of this work is not merely debugging today's misplaced PDF text field.

It is to make future geometry regressions self-describing.
