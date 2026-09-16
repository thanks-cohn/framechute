# Codex Request: World-Class PDF Semantic Layout Foundation

## Mission

Continue FrameChute's PDF elevation by building a **canonical semantic page model** for every PDF page.

This is the architectural foundation for a world-class PDF reader/editor and for future AI/agent access.

The goal is not merely to collect rectangles. The goal is to give FrameChute a compact, deterministic, inspectable representation of:

- what exists on a page;
- where it exists;
- what it means;
- what it came from;
- what owns it;
- what may safely overlap it;
- what would be damaged by an edit;
- what order a human would read it in;
- what space is occupied, reserved, free, or uncertain;
- how edits relate back to source PDF content.

This foundation must be strong enough that:

- the human UI can use it;
- deterministic editor code can use it;
- future agents can inspect and modify it without guessing from pixels or transient DOM state.

Do **not** turn this into a giant visible feature pass. Build the correct substrate first.

Read this together with:

- `docs/CODEX-PDF-ELEVATION.md`
- `docs/PDF-ARCHITECTURE.md`

Inspect the current repository before changing anything. Preserve everything that already works.

---

# Core principle

The PDF page must be modeled as a semantic spatial scene.

Every meaningful visible, interactive, structural, or uncertain element should be representable as a node or bounded region in standard PDF page space.

Examples include:

- source text runs;
- reconstructed text lines;
- reconstructed paragraphs/blocks;
- FrameChute replacement text;
- free text;
- inserted images;
- source images;
- vector/drawing regions where detectable;
- annotations;
- links;
- form fields;
- table/cell regions when inferable;
- headers/footers when inferable;
- page boxes;
- crop bounds;
- margins;
- gutters;
- exclusion zones;
- unknown/opaque content;
- meaningful free-space regions derived from the above.

The system does not need perfect semantics before it becomes useful.

It does need a logically sound answer to questions such as:

> What occupies this rectangle?

> What semantic object owns it?

> What source PDF objects produced it?

> What would I collide with if I enlarge this field?

> Is this overlap expected or destructive?

> What is immediately above/below/left/right?

> Where is the nearest genuinely safe free area?

> What content does this edit replace?

> Where does this text belong in reading order?

> How confident are we in that interpretation?

---

# Canonical coordinate system

Do not make editor logic depend on CSS or DOM coordinates.

Use standard PDF page coordinates as canonical geometry.

Canonical geometry must be independent of:

- zoom;
- browser viewport;
- devicePixelRatio;
- FrameChute object size;
- page display scale.

Respect:

- PDF points (1/72 inch);
- MediaBox;
- CropBox;
- BleedBox/TrimBox/ArtBox where relevant;
- page rotation;
- ordinary PDF affine transforms.

Rendered CSS rectangles are projections of the page model, never the source of truth.

All destructive operations must clamp to the effective page bounds.

---

# Three orders must remain distinct

A PDF can have at least three different notions of order:

1. **Paint/content-stream order**  
   The order PDF drawing/text operators execute.

2. **Spatial order**  
   Where things physically appear on the page.

3. **Semantic reading order**  
   The order a human, accessibility tool, extractor, or agent should understand the content.

Do not collapse these concepts.

FrameChute currently may append replacement text to a later PDF content stream while visually placing that replacement over source text in the middle of a page.

A naive extractor can therefore produce:

- all original page text first;
- then FrameChute replacement text at the end of the page.

That is a paint-order artifact, not the semantic truth of the document.

The new architecture must explicitly preserve and expose these orders separately.

A replacement should normally inherit the semantic reading position of the source region it replaces, even if its PDF drawing operators occur later.

---

# Canonical semantic page graph

The page model should behave like a lightweight semantic scene graph.

Do not require a heavyweight graph library.

Use compact plain data structures and stable IDs.

A conceptual node may look like:

```js
{
  id,
  page,
  kind,

  bounds: { x, y, width, height },

  sourceRefs,
  ownerId,
  parentId,
  childIds,

  paintOrder,
  readingOrder,

  provenance,
  confidence,

  editable,
  protected,

  text,
  style,
  metadata
}
```

Do not copy this exact schema blindly if the existing architecture suggests a better representation.

The important thing is that the same logical concepts exist.

---

# Provenance is mandatory

Future agents must be able to distinguish facts from inference.

Every semantic node should make clear whether it is:

- **source** — directly represented by PDF content;
- **derived** — reconstructed from source geometry;
- **user-authored** — created by FrameChute;
- **replacement** — semantically replaces source content;
- **inferred** — semantic interpretation with confidence;
- **unknown** — occupied/visible content whose meaning is unresolved.

The system should be able to trace:

```
replacement text
    -> source line
        -> source text runs
            -> PDF page/content references
```

Likewise:

```
derived paragraph
    -> lines
        -> source runs
```

Do not make agents reverse-engineer provenance from IDs or array order.

---

# Stable identity

Where feasible, IDs must remain stable across:

- zoom changes;
- rerenders;
- FrameChute object resizing;
- viewer mode changes.

Do not use transient DOM elements as semantic identity.

Source nodes should derive identity from stable page/source information when possible.

User-authored nodes should use stable generated IDs.

Derived nodes may be deterministically generated from their member source IDs.

---

# Required node kinds

At minimum support clear distinctions among concepts such as:

- `source-text-run`
- `text-line`
- `text-block`
- `replacement-text`
- `free-text`
- `source-image`
- `inserted-image`
- `annotation`
- `link`
- `form-field`
- `vector-content`
- `unknown-content`
- `page-region`

Additional kinds may be introduced as needed.

Do not force uncertain content into a false semantic category.

---

# Every part of the page must be accountable

"Nothing detected here" must **not** automatically mean "safe blank space."

The page model should conceptually distinguish four spatial states:

1. **occupied**  
   Known visible/interactive content occupies the area.

2. **reserved / exclusion**  
   A layout rule, edit, crop, margin, annotation behavior, or semantic relationship says content should not be placed there.

3. **free**  
   Space derived as safely available from known page geometry.

4. **unknown / uncertain**  
   The engine cannot confidently determine whether visible/structural content exists there.

This distinction is essential for high-quality editing and future agents.

## Negative space / whitespace

Whitespace is meaningful.

Examples include:

- page margins;
- column gutters;
- gaps between paragraphs;
- gaps between lines;
- space beside images;
- space between table cells;
- clear regions where new content could fit.

However, do **not** materialize every pixel or point as an object.

Represent whitespace analytically.

Preferred strategy:

- store bounded occupied/reserved/unknown regions;
- derive useful free rectangles/gaps on demand;
- cache only useful free-space results;
- invalidate only affected page regions.

Possible conceptual APIs:

```js
layout.freeSpace(page, constraints)
layout.gapsBetween(page, regionA, regionB)
layout.nearestFreeRect(page, rect, options)
```

A full-page bitmap occupancy grid is out of scope for the baseline.

---

# Spatial query layer

Provide a deterministic page query API.

At minimum support:

- regions intersecting a rectangle;
- regions contained by a rectangle;
- regions containing a point;
- nearest region above;
- nearest region below;
- nearest region left;
- nearest region right;
- horizontal overlap;
- vertical overlap;
- distance;
- owned overlap;
- collision classification;
- free-space lookup;
- semantic parent/children;
- provenance/source lookup;
- reading-order predecessor/successor.

Conceptual API:

```js
layout.get(id)
layout.intersections(page, rect)
layout.containing(page, point)
layout.neighbors(page, rect)
layout.classifyOverlap(a, b)
layout.sourceLineage(id)
layout.readingOrder(page)
layout.nextInReadingOrder(id)
layout.freeSpace(page, constraints)
```

Exact API names may differ.

Start with compact arrays/scans if performance is sufficient.

Design the interface so a future R-tree/interval index can replace the implementation without rewriting callers.

Do not add a heavy spatial dependency prematurely.

---

# Text reconstruction

PDF text commonly arrives as positioned runs rather than paragraphs.

Build conservative hierarchy:

```
source run -> line -> block
```

## Line reconstruction

Group source runs into a line based on compatible:

- baseline;
- orientation;
- font size;
- vertical overlap;
- horizontal distance;
- transform.

Account for rotated text.

Whitespace between runs must be considered.

If geometry strongly indicates a space between two runs, the semantic line should preserve that separation even if no literal space character exists in the PDF text operator.

Do not produce:

```
This PDF isthreepages long.
```

when geometry clearly represents:

```
This PDF is three pages long.
```

## Block reconstruction

Group lines only when geometry strongly suggests a common block.

Signals may include:

- similar left edge;
- similar right edge;
- consistent line spacing;
- compatible typography;
- indentation;
- small vertical gaps.

Do not merge across:

- columns;
- table boundaries;
- large gaps;
- headings/body boundaries;
- sidebars;
- unrelated regions.

False separation is preferable to destructive false merging.

## Preserve exact source mapping

Every inferred line/block must retain its underlying source-run references.

Future editing must always be able to answer:

> Which original PDF runs are represented by this semantic line or block?

---

# Reading-order reconstruction

Reading order is a first-class output of the page model.

Do not derive it from:

- creation time;
- edit-array order;
- DOM order;
- raw PDF content-stream order alone.

Use semantic/spatial reconstruction.

At minimum account for:

- line membership;
- block membership;
- columns;
- headings;
- page position;
- baseline;
- margins;
- rotation;
- source ownership.

Do not use a naive global `y then x` ordering when it would interleave columns incorrectly.

Keep confidence for uncertain reading-order relationships.

## Replacement semantics

When source text is replaced:

- replacement text inherits the source semantic position;
- replaced source text is suppressed from edit-aware logical extraction;
- replacement text appears where the source text belonged;
- later creation/paint order must not append the replacement to the end of semantic extraction;
- visual movement of the replacement field should not silently change its semantic reading position unless there is an explicit operation to detach/reclassify it as independent text.

## Free text

New free text without source ownership should receive a reading position from spatial/block context when confidence permits.

If uncertain:

- mark the reading order as inferred/low-confidence;
- do not silently use "created last" as the semantic rule.

---

# Extract Text must become semantic

FrameChute's Extract Text should consume the semantic page model.

It should not simply concatenate:

- raw PDF.js text items;
- edit arrays;
- content-stream order.

Provide an edit-aware extraction path such as:

```js
layout.extractText(page, { applyEdits: true })
```

or equivalent.

Expected behavior:

- reconstructed spaces;
- conservative line breaks;
- conservative paragraph breaks;
- correct column ordering;
- source text omitted when replaced;
- replacement inserted at source semantic position;
- free text inserted according to inferred spatial reading order.

## Required regression for current observed failure

Create a fixture equivalent to the current FrameChute case:

1. original page text exists in an early PDF content stream;
2. FrameChute creates a white replacement mask and replacement text in a later stream;
3. visually the replacement occurs in the middle of the page;
4. raw paint-order extraction would append replacement text at the end.

FrameChute semantic extraction must instead return the replacement at the original source line's logical position.

Paint order must remain available for rendering/debugging and must not be overwritten by semantic ordering.

---

# Native PDF extraction versus FrameChute extraction

Do not confuse FrameChute's semantic model with the physical structure of the PDF content streams.

For this milestone:

- make FrameChute reading order correct;
- make FrameChute Extract Text correct;
- preserve normal interoperable PDF save behavior;
- retain provenance between source and replacement content.

Later, a separate serializer improvement may safely rewrite/tag PDF structure so third-party extractors also observe improved reading order.

Do **not** perform risky whole-page content-stream rewriting merely to satisfy this foundation milestone.

---

# Collision model

Collision is a first-class concept.

Not all overlap is bad.

Examples:

- replacement text over its own erase mask -> owned/expected;
- annotation highlight over source text -> expected;
- image with Wrap Text OFF over source text -> intentional overlay;
- image with Wrap Text ON over source text -> layout response needed;
- replacement field over neighboring unrelated text -> potentially destructive;
- two independent editable fields overlapping -> likely conflict.

Provide classifications equivalent to:

- `owned`
- `intentional-overlay`
- `safe`
- `warning`
- `destructive`
- `unknown`

Editing code should query this model instead of inventing its own rectangle rules.

---

# Replacement-text architecture

Preserve the current core behavior:

- detect source text;
- infer initial font size once;
- let the user control font size explicitly;
- never silently resize font because the box changed;
- erase source content cleanly;
- render replacement text;
- save a normal PDF.

The semantic layout model should make replacement safer.

## Source ownership

Editing a source line must expose:

- source run IDs;
- line ID;
- block ID if known;
- original bounds;
- neighboring semantic regions;
- reading-order position.

## Erasure safety

The editor currently uses explicit source/field masks.

Keep that behavior while introducing collision awareness.

The model must be able to identify:

- erase area owned by this edit;
- neighboring source lines;
- unrelated objects under an expanded field;
- uncertain content under the mask.

For this milestone:

- detect potentially destructive overlaps;
- expose them to editing logic;
- do not silently erase unrelated semantic regions simply because the field grew.

Do not implement aggressive automatic reflow until the model is trustworthy.

A conservative warning/constraint is preferable to corruption.

## Future-ready reflow

The architecture must support later:

- restoration of neighboring source regions;
- protected neighboring lines;
- paragraph reflow;
- pushing lines;
- column-aware reflow;
- table-aware editing;
- semantic resize constraints.

Do not implement all of those now.

---

# Image architecture

Images participate in the same page graph.

Each image needs:

- stable ID;
- page;
- PDF-space bounds;
- provenance;
- wrap state;
- ownership;
- collision relations.

## Wrap Text ON

Use layout queries to determine which text lines intersect the image.

Do not rely on transient DOM overlap checks.

## Wrap Text OFF

Text/image overlap is intentional.

The collision system must classify it accordingly.

---

# Unknown content is still content

A premium editor must know when it does not know.

PDF pages may contain:

- vector lettering;
- flattened text;
- scans;
- clipping paths;
- masks;
- patterns;
- complex groups;
- transformed graphics;
- unusual drawing operators.

Where exact semantics are not available, create conservative occupied/unknown regions when feasible.

Never assume an area is free merely because no PDF.js text item exists there.

If bounds cannot be inferred cheaply and reliably:

- mark that limitation;
- preserve the content;
- do not invent false confidence.

---

# Agent-addressable contract

The semantic page model must be suitable for future agent tools.

Agents should not receive raw DOM as their primary representation.

A future agent-facing layer should be able to expose structured queries such as:

```
get page 1 semantic tree
get text block block:17
get source lineage for replacement:42
find free region near paragraph:8 at least 120x80 pt
find collisions if image:3 moves to {x,y,w,h}
get next semantic node in reading order
get all low-confidence nodes on page 2
```

The architecture implemented now does not need to expose a network API.

It does need stable internal semantics so such an API can be added later without rebuilding PDF understanding from scratch.

## Determinism

Given the same PDF bytes, page, and edit state, semantic reconstruction should be deterministic.

Avoid model behavior that depends on:

- pointer history;
- DOM creation timing;
- random ordering;
- asynchronous render completion order.

Stable deterministic semantics are essential for agents, undo/redo, testing, and debugging.

---

# Lightweight implementation requirement

This architecture must remain usable on small computers.

A 4 GB machine is an important target.

Correctness does **not** justify a huge always-resident page graph.

## Required strategies

- build semantic layout lazily per page;
- retain only lightweight metadata for inactive pages;
- cache only recently used page layouts;
- allow inactive derived layouts to be discarded and rebuilt;
- invalidate only pages/regions affected by edits;
- do not rebuild an entire document on pointermove;
- do not create one object per pixel/glyph unless genuinely necessary;
- prefer source-run references over duplicating full source data;
- avoid copying large PDF byte arrays during layout operations;
- avoid full-page raster analysis in the baseline;
- preserve PDF.js render-task cancellation;
- use compact IDs/references rather than duplicating nested objects everywhere.

## Free-space efficiency

Do not store a giant occupancy grid.

Derive free rectangles from:

- page bounds;
- occupied intervals;
- margins/gutters;
- exclusion regions.

Cache only useful results.

## Scalability

The design should allow later optimization such as:

- interval indexes;
- R-trees;
- packed arrays;
- compact numeric IDs;
- per-page LRU caches;

without changing the semantic API.

Do not prematurely implement those optimizations unless profiling proves they are needed.

---

# Reader/editor separation

The semantic layout belongs to the PDF model layer.

Reader features may consume it for:

- semantic Extract Text;
- text selection;
- reconstructed spacing;
- search highlighting;
- reading-order navigation;
- link hit testing;
- accessibility.

Editor features may consume it for:

- collision checking;
- source ownership;
- erasure safety;
- Wrap Text;
- selection;
- snapping;
- alignment;
- future reflow.

Do not create separate competing reader/editor interpretations of the page.

---

# Persistence

The saved PDF must remain a normal interoperable PDF.

Do not write FrameChute's semantic graph into the PDF as a proprietary dependency.

Derived semantic state may be:

- recomputed from the PDF;
- cached transiently;
- optionally persisted/versioned in FrameChute workspace state if beneficial.

Source PDF + edit state remain authoritative.

The semantic graph is a deterministic interpretation layer.

---

# Suggested module boundary

Prefer a dedicated subsystem, for example:

```
src/documents/pdf-layout.js
```

or a small group of PDF layout modules if cleaner.

Responsibilities may include:

- region/node creation;
- provenance;
- text-line reconstruction;
- text-block reconstruction;
- reading-order reconstruction;
- edit-aware extraction;
- spatial queries;
- collision classification;
- free-space derivation;
- semantic parent/child relationships;
- cache/invalidation.

Keep:

- viewport conversion in the PDF geometry layer;
- byte serialization in the PDF document/write layer;
- UI interactions outside the semantic model.

---

# Developer inspection/debugging

Add a developer-only inspection path.

Useful capabilities:

- draw semantic bounds;
- distinguish node kinds;
- show IDs;
- show reading-order sequence;
- show collision classifications;
- show occupied/free/unknown regions;
- inspect provenance.

This may be a debug flag, helper, or temporary overlay.

Do not expose debug labels in normal PDFs.

---

# Required tests

Add deterministic tests before using the model for destructive automatic behavior.

## Geometry

Test:

- intersection;
- containment;
- point lookup;
- nearest above/below/left/right;
- page-bound clamping;
- rotated-page geometry;
- free-space derivation.

## Text reconstruction

Fixtures for:

- ordinary paragraph;
- separately positioned runs requiring inferred spaces;
- heading + body;
- two columns;
- varied font sizes;
- large gaps;
- rotated text;
- table-like layout.

Verify lines/blocks do not merge across obvious semantic boundaries.

## Reading order

Test:

- normal top-to-bottom text;
- two columns without incorrect line-by-line interleaving;
- heading then body;
- rotated regions;
- out-of-order PDF source runs;
- free text spatial insertion;
- low-confidence ordering.

## Replacement reading-order regression

Explicitly test:

- original text appears in an earlier content stream;
- replacement is painted later;
- replacement visually belongs in the middle of a page;
- source text is suppressed from semantic extraction;
- replacement appears at source reading position;
- it is not appended to page end.

## Spacing extraction

Test that geometric gaps produce sensible spaces when confidence is high.

Examples:

```
"This PDF is" + positioned gap + "three" + positioned gap + "pages"
```

must extract as:

```
This PDF is three pages
```

not:

```
This PDF isthreepages
```

## Provenance

Test:

- line -> source runs;
- block -> lines;
- replacement -> source line;
- replacement -> source runs through lineage;
- derived free-space result -> page/obstacle revision.

## Collision classification

Test:

- replacement vs own source;
- replacement vs neighboring line;
- image Wrap Text ON vs text;
- image Wrap Text OFF vs text;
- annotation vs source text;
- edit field vs edit field;
- known region vs unknown region.

## Determinism

Build the same page semantic model twice from the same source/edit state.

IDs, hierarchy, reading order, and collision classifications must be stable.

## Performance sanity

Include at least lightweight checks/fixtures demonstrating that:

- only requested pages are constructed;
- pointermove does not rebuild all page semantics;
- inactive page layouts can be discarded/rebuilt;
- layout code does not rasterize the whole document.

## Regression

Existing PDF behavior must remain intact:

- rendering;
- navigation;
- search;
- zoom/fits;
- text replacement;
- user-controlled font size;
- replacement masks;
- image insertion;
- Wrap Text;
- undo/redo;
- save/reopen;
- page operations;
- native PDF interoperability.

---

# Milestone definition

This milestone is successful when FrameChute can build a deterministic semantic page model capable of answering:

- What is at this point?
- What semantic object owns this rectangle?
- What PDF source runs produced it?
- What was replaced here?
- What is the reading-order position?
- What comes next/previous semantically?
- What is directly above/below/left/right?
- What collides with this proposed edit?
- Is that collision owned, intentional, destructive, or uncertain?
- Which page regions are safely free?
- Which regions are unknown rather than blank?
- What text should Extract Text return after applying edits?

The milestone does **not** require perfect paragraph reflow.

It requires the architectural truth from which premium reflow and agentic editing can later be built.

---

# Premium direction enabled by this foundation

Later capabilities should become incremental rather than requiring another rewrite:

- paragraph-aware reflow;
- collision-free replacement editing;
- automatic restoration of neighboring text;
- intelligent field expansion;
- column-aware reflow;
- table-aware editing;
- semantic image wrapping;
- snapping/guides/alignment;
- better accessibility;
- OCR integration;
- vector-content awareness;
- professional extraction;
- semantic copy/paste;
- agent-directed editing;
- agent scene understanding;
- agent-safe document transformation.

Do not implement all of these merely because they are listed.

Build the foundation so they become possible.

---

# Instructions to Codex

1. Read this file, `docs/CODEX-PDF-ELEVATION.md`, and `docs/PDF-ARCHITECTURE.md`.
2. Inspect the actual current PDF code first; it has evolved since the original elevation brief.
3. Produce a short architecture plan grounded in the current implementation.
4. Treat the result as a canonical semantic page model, not just collision rectangles.
5. Separate paint order, spatial order, and semantic reading order.
6. Model provenance/source ownership explicitly.
7. Account for occupied, reserved, free, and unknown space without a heavyweight pixel grid.
8. Implement deterministic page-level semantics suitable for future agent access.
9. Keep it lazy, compact, and viable on a 4 GB machine.
10. Add tests before enabling destructive automatic behavior.
11. Integrate current replacement text and inserted-image behavior only where safe.
12. Do not regress:
    - PDF text editing;
    - explicit user-controlled font sizes;
    - replacement masks;
    - image Wrap Text;
    - Quick Actions;
    - reader controls;
    - DOCX;
    - FrameChute object movement/viewport behavior;
    - native PDF save behavior.
13. Keep saved PDFs standards-based and interoperable.
14. Do not perform risky whole-page content-stream rewriting in this milestone.
15. Run focused PDF tests explicitly in addition to normal repository validation.
16. Use small coherent commits.

The goal is not "more PDF buttons."

The goal is to give FrameChute a **compact, logically sound semantic understanding of the entire PDF page** so humans, editor code, and future agents can all operate on the same trustworthy foundation.
