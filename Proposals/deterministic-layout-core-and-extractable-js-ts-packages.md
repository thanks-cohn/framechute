# Proposal: Deterministic Layout Core and Extractable JavaScript / TypeScript Packages

## Summary

SUBSTRATE should be built so that, if the project succeeds, its deepest reusable primitives can later be extracted into a family of **JavaScript and TypeScript packages**.

The immediate catalyst is simple:

> **Accidental overlap should not exist in ordinary document layout.**

If an image takes space from a line, text that no longer fits should move forward to the next legal line. If that line then overflows, its tail should move forward again. Continue until the layout stabilizes.

That behavior is not the entire future of SUBSTRATE, but it is a perfect example of the architectural style we want:

- simple rules
- stable identities
- explicit order
- measurable geometry
- deterministic consequences
- reusable primitives
- agent-readable explanations

The goal is not to rewrite SUBSTRATE in TypeScript for its own sake.

The goal is to make the core laws of the system:

- pure
- deterministic
- typed where useful
- testable
- portable
- renderer-independent
- file-format-independent
- agent-readable

The preferred long-term shape is dual:

```text
JavaScript runtime package
+
TypeScript type declarations / TypeScript source package
```

So a browser-first consumer can use plain JavaScript while a typed application can get complete TypeScript guarantees.

---

# 1. How New SUBSTRATE Is

SUBSTRATE is extremely young.

At the time of this proposal, the repository is still in a rapid foundation-building phase measured in **weeks**, not years. Public repository history already shows active Chrome Web Store and document-editor work by late August 2026, and the architecture is still being consolidated aggressively in September 2026.

That matters.

Mature applications often discover too late that they need:

- stable object identity
- explicit geometry authority
- semantic parentage
- reading order
- layout constraints
- provenance
- intermediate representations
- diagnostics
- renderer-independent models

SUBSTRATE has the opportunity to make those things foundational now.

The most important decisions being made today are not button labels.

They are laws such as:

> Every meaningful object has identity.

> Every movable object has measurable bounds.

> Every object belongs to an explicit order or group.

> Accidental overlap is illegal.

> When space disappears, ordered content moves forward.

> Geometry must have a traceable mathematical ancestry.

If those laws are correct, the same core can support PDF, DOCX, WEBX, images, future spatial scenes, and agent-native workflows.

---

# 2. JavaScript and TypeScript Strategy

SUBSTRATE currently works well as browser-side JavaScript/CSS/HTML with small modules and no required build step for normal extension use.

That is not a weakness.

For the near term:

- keep browser runtime code simple
- continue extracting pure JavaScript / MJS modules
- write strong tests around mathematical invariants
- avoid premature framework migration

For the longer term, stable cores can become JavaScript/TypeScript packages.

A good pattern is:

```text
src/
  pure JavaScript / MJS implementation

packages/
  @substrate/geometry
  @substrate/layout
  @substrate/model
  ...

Each package ships:
  ESM JavaScript
  TypeScript declarations
  optional TypeScript source
```

This keeps SUBSTRATE usable from ordinary browser JavaScript while making the same engine pleasant to consume from TypeScript.

The architectural rule is:

> **The package boundary matters more than whether the implementation file ends in .js or .ts.**

---

# Part I — The First Simple Layout Primitive

# 3. The Simplest Useful Overflow Rule

The first deterministic document-layout law should be:

> **If the next ordered item does not fit in the legal horizontal space, move that item and all following overflow forward to the next line.**

Example:

```text
Original:

The machine understood the document and placed everything correctly.

Image dropped into the right side:

The machine understood the document   [ IMAGE ]
and placed everything correctly.      [ IMAGE ]
```

If the image extends farther downward:

```text
The machine understood the document   [ IMAGE ]
and placed everything                 [ IMAGE ]
correctly.
```

The semantic sentence remains unchanged.

Only the visual line assignment changes.

---

# 4. Core Overflow Gates

A minimal deterministic implementation can be expressed as a few gates.

## Gate A — Does the obstacle affect this line?

```text
IF obstacle does not vertically intersect line band
    use full content width
ELSE
    subtract obstacle + gutter from usable line space
```

## Gate B — Is there a readable legal lane?

```text
IF available lane >= minimum readable width
    use that lane
ELSE
    clear below obstacle
```

## Gate C — Does the next ordered item fit?

```text
IF next item fits in remaining lane width
    place it
ELSE
    end line
    move item to next line
```

## Gate D — Did the next line now overflow?

```text
IF yes
    propagate overflow forward
ELSE
    stop
```

## Gate E — Is there any accidental collision?

```text
IF collision exists AND overlap is not explicitly allowed
    reflow / push forward
```

This is deliberately boring.

That is a feature.

---

# 5. Carry Propagation for Words

The easiest mental model is arithmetic carry propagation.

```text
line 1 overflows
    ↓
carry tail into line 2

line 2 overflows
    ↓
carry tail into line 3

line 3 fits
    ↓
STOP
```

The engine should only recompute the affected flow until the layout stabilizes.

It should not relayout an entire 500-page document because one image was inserted into one paragraph.

---

# 6. Collision Policy

Every layout object should eventually support a policy conceptually like:

```ts
type CollisionPolicy =
  | "reflow"
  | "push"
  | "explicit-overlap";
```

Default for ordinary document content:

```ts
collisionPolicy = "reflow";
```

Explicit overlap should be opt-in for things like:

- watermarks
- decorative backgrounds
- artistic overlays
- deliberate freeform composition

Ordinary prose and images should never accidentally superimpose.

---

# 7. Identity + Order + Geometry

The reflow algorithm only becomes dependable if every meaningful item has identity and placement.

A text item should be able to expose:

```text
objectId
lineId
blockId
readingOrder
bounds
baseline
previousId
nextId
```

An image should expose:

```text
objectId
bounds
gutter
wrapMode
readingOrderAnchor
semanticParentId
```

A block should expose:

```text
blockId
memberIds
unionBounds
readingOrder
spatialOrder
semanticRole
```

That means layout can reason about real structures rather than anonymous pixels.

---

# 8. Multiple Orders Must Remain Explicit

SUBSTRATE should distinguish:

- semantic order
- reading order
- spatial order
- paint order

These are not always identical.

A visually nearby object is not necessarily the next semantic object.

A later-painted PDF glyph is not necessarily later in reading order.

This distinction matters for:

- imported PDFs
- columns
- captions
- floating images
- headers / footers
- sidebars
- future mixed content blocks

---

# Part II — Why This Is Package-Shaped Work

# 9. Pure Core, Adapters at the Edges

The deepest layout code should know nothing about:

- PDF.js
- pdf-lib
- the DOM
- Chrome
- contenteditable
- extension APIs
- WEBX serialization
- DOCX XML

The core should operate on canonical values such as:

```ts
type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutObject = {
  id: string;
  kind: string;
  bounds: Rect;
  order: number;
};
```

Then adapters translate:

```text
PDF -> canonical layout objects
DOCX -> canonical layout objects
WEBX -> canonical layout objects
HTML -> canonical layout objects
```

and back out again.

This is what makes extraction practical.

---

# 10. Geometry Math Must Not Live in Event Handlers

Bad:

```text
pointermove
  -> calculate margins
  -> calculate wrapping
  -> calculate group movement
  -> mutate DOM directly
```

Good:

```text
pointermove
  ↓
desired geometry
  ↓
pure layout core
  ↓
legal geometry
  ↓
renderer / adapter
```

That separation should be enforced aggressively.

---

# 11. The First Extractable Package

The most obvious first package is:

```text
@substrate/layout
```

It could eventually ship as:

```text
@substrate/layout
  dist/index.js
  dist/index.d.ts
  src/*.ts or src/*.js
```

Possible core functions:

```ts
deriveContentRect(...)
constrainRect(...)
constrainTranslation(...)
constrainResize(...)

unionBounds(...)
relativeMemberRects(...)
translateGroup(...)

subtractObstacle(...)
availableHorizontalIntervals(...)
chooseReadableLane(...)

flowOrderedItems(...)
propagateOverflow(...)
layoutParagraph(...)
layoutAroundObstacle(...)
```

---

# Part III — Package Family We May Be Able to Extract

# 12. @substrate/geometry

Responsibilities:

- rectangles
- points
- affine transforms
- coordinate spaces
- normalization
- intersection
- containment
- union bounds
- distances
- projection
- round-trip validation

This package should be tiny, boring, and extremely dependable.

---

# 13. @substrate/layout

Responsibilities:

- margins
- page content bounds
- collision avoidance
- obstacle-aware flow
- line formation
- overflow propagation
- group constraints
- pagination
- minimum readable lanes
- gutter rules
- keep-with-next
- clear-below
- future widow/orphan rules

This is the package most directly seeded by current PDF layout work.

---

# 14. @substrate/model

Responsibilities:

- stable IDs
- semantic objects
- provenance
- parentage
- reading order
- spatial order
- paint order
- ownership
- grouping
- version state
- confidence

This is the canonical identity layer.

---

# 15. @substrate/groups

This may remain part of `@substrate/layout` initially.

Responsibilities:

- Text Block
- Image Block
- mixed Content Block
- union bounds
- stable group identity
- member-relative geometry
- constrained whole-group movement

The user-facing future language should be:

- Grab Text Block
- Grab Image Block
- Grab Content Block

not "glyph block".

---

# 16. @substrate/observability

Responsibilities:

- geometry dossiers
- transform ancestry
- invariant evaluation
- collision explanations
- layout issue codes
- first divergence
- before / after fingerprints
- machine-readable visual scene descriptions

A distinctive goal is that the engine should not merely say:

```text
run_94 moved
```

It should be able to say:

```text
run_94 moved from line_12 to line_13
because image_7 reduced available width
below the width required for run_94.
```

That is especially valuable for agents.

---

# 17. @substrate/webx

Responsibilities:

- WEBX schema
- parsing
- serialization
- validation
- semantic relationships
- styles
- assets
- layout constraints
- snapshots
- provenance
- extension points

WEBX should eventually become the canonical source model rather than merely another export format.

---

# 18. @substrate/pdf

Responsibilities:

- PDF -> canonical model adapter
- canonical model -> PDF compiler
- tagged PDF output
- font embedding / subsetting
- semantic payload embedding
- source map / provenance
- layout snapshot preservation

The PDF package should not contain the general layout brain.

It should consume it.

---

# 19. @substrate/docx

Responsibilities:

- OOXML -> canonical model
- canonical model -> OOXML
- style mapping
- lists
- tables
- images
- relationships
- headers / footers
- preservation of unsupported package content where safe

---

# 20. @substrate/actions

Responsibilities:

- action registry
- applicability
- capability checks
- command execution contracts
- undoable action metadata
- context-menu action resolution

This could be useful beyond SUBSTRATE documents.

---

# 21. @substrate/selection

Responsibilities:

- selected object identity
- region selection
- object selection
- multi-selection
- group selection
- selection transforms

This may stay together with actions initially.

---

# 22. @substrate/drag

Responsibilities:

- drag ownership
- internal move vs copy
- world-space delta
- source container
- target container
- drop intent
- deterministic translation

The core should remain independent of any specific document type.

---

# 23. @substrate/interchange

Responsibilities:

- canonical clipboard payloads
- internal drag payloads
- file-to-object conversion
- object-to-file conversion
- transfer metadata
- provenance

This could eventually unify Copy, Paste, Drop, and conversion.

---

# 24. @substrate/image

Responsibilities:

- pure image transforms
- crop geometry
- resize geometry
- alpha bounds
- transform composition
- export state

Browser rendering remains an adapter.

---

# 25. @substrate/workspace

Responsibilities:

- spatial object records
- workspace persistence
- stable object identity
- world coordinates
- project manifests
- portable FCX-like structures

This could become the generic spatial substrate for future non-document material.

---

# Part IV — Existing Alternatives and Competitors

# 26. Important Qualification

There is no single obvious existing project that is exactly:

> browser-native spatial workbench + editable PDF + DOCX + semantic canonical model + deterministic layout engine + future WEBX + agent-readable geometry.

So "competitor" should be treated as **adjacent competition** rather than claiming one exact counterpart.

SUBSTRATE overlaps several mature categories.

---

# 27. Rich-Text / Structured Editor Competitors

## ProseMirror

ProseMirror is a modular toolkit for structured rich-text editors.

Its most relevant lesson for SUBSTRATE is that the document is not merely arbitrary HTML; it uses an explicit structured document model and funnels changes through controlled transactions.

SUBSTRATE differs because it aims beyond rich text into:

- PDF geometry
- image layout
- file conversion
- spatial workspaces
- canonical cross-format representation

Still, ProseMirror is one of the strongest conceptual precedents for structured editor state.

## Tiptap

Tiptap is a headless editor framework built on ProseMirror.

It demonstrates how a strong underlying document model can become a developer-friendly package ecosystem with modular extensions.

This is relevant to SUBSTRATE's eventual package strategy.

## Lexical

Lexical is a modular, lightweight text-editor framework built around explicit editor state and plugins.

It is another example of how a small core can support many editor experiences.

## Slate

Slate is a highly customizable rich-text editor framework.

It is relevant primarily as an example of a flexible editor model rather than a PDF or publishing engine.

---

# 28. Paged Layout / Publishing Competitors

## Paged.js

Paged.js uses web technology to display paginated content and generate print-oriented output.

It is directly relevant to:

- page fragmentation
- CSS paged media
- browser-native print layout
- generated print books

SUBSTRATE differs in wanting a geometry-first interactive editing engine, not merely paginating authored DOM content.

## Vivliostyle

Vivliostyle is an open-source CSS typesetting ecosystem for web and print publication.

It can typeset HTML/CSS into paginated output and export PDF.

It is one of the strongest adjacent projects to study for:

- paged media
- book layout
- browser-based publishing
- print CSS

SUBSTRATE's intended difference is that its canonical document model and object geometry should be directly editable and agent-readable rather than primarily CSS-authored.

---

# 29. PDF Infrastructure Competitors / Dependencies

## PDF.js

PDF.js is a general-purpose web-standards-based PDF parser and renderer.

It is foundational infrastructure rather than a direct SUBSTRATE competitor.

SUBSTRATE already benefits from this category of tool because parsing/rendering existing PDFs is a different problem from semantic editing and layout.

## pdf-lib

pdf-lib creates and modifies PDFs in JavaScript and is itself written in TypeScript and distributed as JavaScript.

This is a particularly relevant packaging precedent for the JavaScript + TypeScript strategy proposed here.

pdf-lib provides PDF primitives.

SUBSTRATE aims to place a semantic/layout engine above those primitives.

---

# 30. Commercial Document SDK Competitors

## Nutrient Web SDK

Nutrient Web SDK is a commercial browser document SDK focused on viewing, annotating, editing, and manipulating documents client-side.

It is an important competitor in the embedded PDF/document SDK category.

## Apryse WebViewer

Apryse WebViewer is a commercial JavaScript document SDK supporting browser-side document viewing and editing across PDF, Office, CAD, images, and other formats.

It includes PDF content editing and DOCX editing.

This makes it one of the closest commercial comparisons to SUBSTRATE's multi-format document ambition.

The difference in direction is important:

SUBSTRATE is not trying only to be an embeddable document SDK.

It is trying to build:

- reusable universal primitives
- a spatial workbench
- an open canonical semantic model
- agent-readable geometry
- eventual WEBX
- a reusable JavaScript/TypeScript core package family

---

# 31. Where SUBSTRATE Could Differentiate

A successful SUBSTRATE core could occupy a different layer from most existing tools.

Instead of only:

```text
render this document
```

or:

```text
edit this rich-text tree
```

or:

```text
write this PDF
```

the core would answer:

```text
What is this object?
Where is it?
What owns it?
What comes before and after it?
What space is legal?
What obstacle caused it to move?
What group does it belong to?
What changed?
Why did it change?
How should that same meaning compile to PDF, DOCX, HTML, or WEBX?
```

That is the intended architectural niche.

---

# Part V — What Makes the Package Family Foundational

# 32. The Core Is Not the UI

The package family should not know about:

- toolbar rows
- buttons
- popdowns
- Chrome extension messaging
- specific CSS selectors
- dialog placement

The SUBSTRATE application consumes the packages.

The packages do not consume SUBSTRATE UI.

---

# 33. The Core Is Not PDF

PDF is one adapter.

The same functions that prevent a PDF image from colliding with text should eventually be usable by:

- WEBX
- DOCX layout
- HTML layout previews
- page composition
- future slides
- publication templates

That is how the work becomes genuinely reusable.

---

# 34. The Core Should Explain Itself

A future layout result should be able to include:

```ts
{
  objectId: "run_94",
  previousLineId: "line_12",
  lineId: "line_13",
  reason: "insufficient-width-after-obstacle",
  obstacleId: "image_7",
  availableWidth: 146.2,
  requiredWidth: 153.8
}
```

This is valuable for:

- debugging
- testing
- agents
- accessibility tooling
- automated document repair
- user-facing "why did this move?" explanations

---

# 35. Extraction Sequence

Do not extract everything immediately.

Recommended progression:

```text
1. Build correct primitive inside SUBSTRATE.
2. Add focused tests.
3. Use it from multiple internal call sites.
4. Stabilize API and data model.
5. Move pure implementation behind package boundary.
6. Add TypeScript declarations / source types.
7. Make SUBSTRATE itself import the package.
8. Publish only when API is trustworthy.
```

This prevents package churn from freezing bad design too early.

---

# 36. JavaScript and TypeScript Distribution

A future package should ideally work for both communities.

Example:

```js
import {
  flowAroundObstacle,
  constrainRect,
  unionBounds
} from "@substrate/layout";
```

The exact same package should provide TypeScript inference:

```ts
import type {
  Rect,
  LayoutObject,
  FlowResult,
  ContentGroup
} from "@substrate/layout";
```

Possible outputs:

```text
dist/
  index.js
  index.d.ts
  index.cjs       optional
  package.json
```

Avoid requiring a framework.

Avoid requiring React.

Avoid requiring the DOM.

---

# 37. Potential End-State Package Map

```text
@substrate/geometry
@substrate/model
@substrate/layout
@substrate/groups
@substrate/observability

@substrate/pdf
@substrate/docx
@substrate/webx

@substrate/actions
@substrate/selection
@substrate/drag
@substrate/interchange

@substrate/image
@substrate/workspace
```

Not every item must become a public package.

Some may remain internal.

The architectural value comes from making them independently understandable and testable.

---

# 38. Success Criteria

This proposal succeeds if, over time:

- SUBSTRATE's pure geometry is separable from DOM code
- layout rules are reusable across formats
- collisions are deterministic rather than accidental
- overflow is propagated logically
- stable identities survive reflow
- block/group operations preserve internal geometry
- agents can inspect layout causes
- PDF and WEBX share the same layout laws
- JavaScript users can consume the packages directly
- TypeScript users get first-class types
- SUBSTRATE itself uses the same packages it publishes

---

# Final Principle

SUBSTRATE should not merely accumulate features.

It should gradually reveal a set of reusable laws underneath those features.

If the project succeeds, the package family should feel almost inevitable:

> **We did not invent a library and then search for a problem.  
> We built a working system, discovered the primitives that kept surviving, and extracted those primitives into JavaScript and TypeScript packages.**

That is the right time to publish them.
