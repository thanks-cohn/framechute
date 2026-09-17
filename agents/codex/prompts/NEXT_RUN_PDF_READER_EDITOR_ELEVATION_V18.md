# NEXT RUN — PDF READER + EDITOR ELEVATION V18

Repository: `thanks-cohn/framechute`
Target branch: `main`

## Mission

Turn Substrate's current PDF implementation into a genuinely excellent lightweight reader/editor by combining three things that most PDF products treat separately:

1. **Fast, calm reading**
2. **Reliable direct editing**
3. **Agent-visible geometry and state**

Do not chase feature count for its own sake. The goal is a reader/editor that feels unusually precise, fast, understandable, and difficult to break.

The product target is:

> Open a PDF quickly. Read it comfortably. Search it. Navigate it. Click exactly what you see. Edit exactly what you clicked. Save. Reopen. Nothing jumps, ghosts, teleports, disappears, or lies.

Substrate already has a strong foundation:

- PDF.js rendering
- pdf-lib serialization
- semantic page model
- current-version identity/provenance
- shared live/save mask planning
- direct text editing
- free text and image edits
- page operations
- search
- thumbnails and outline
- stable three-row PDF toolbar
- geometry diagnostics
- bounded visual scene graph diagnostics
- OFF / DEBUG / DEEP diagnostic modes

Build on that. Do not replace it with a new PDF stack.

---

# Priority 0 — Preserve the current stability boundary

Before adding polish, preserve these invariants:

- The three PDF toolbar rows are always present and stable.
- Font / text size / undo / redo never appear or disappear in a way that moves the page.
- No page/margin guide overlay is reintroduced.
- No pointer-active overlay may sit above the PDF text/edit surface unless it is an actual editor control.
- Showing search, side panel, popdowns, edit state, selection, or diagnostics must not unexpectedly move canvas and text layer relative to one another.
- Existing terminal source-fragment masking behavior must remain intact.
- Save/reopen current-version behavior must remain intact.
- Do not introduce arbitrary pixel compensation offsets.

If a visual mismatch exists, use the visual scene graph and geometry diagnostics to identify the first divergence.

---

# Priority 1 — Fix click / hover / edit truth first

The current reader cannot be considered premium until interaction geometry is boringly correct.

For every rendered text object, maintain and compare at minimum:

- semantic PDF rect
- expected viewport rect
- DOM hitbox rect
- visible glyph ink rect
- hover outline rect
- selected field rect
- editable field rect
- source mask rect
- replacement glyph rect

Use the new visual scene graph to enforce:

1. `SOURCE_DOM_SHOULD_COVER_SOURCE_GLYPH`
2. `HOVER_BOX_SHOULD_COVER_HIT_GLYPH`
3. `SELECTED_FIELD_SHOULD_REMAIN_ANCHORED_TO_SOURCE`
4. `EDITABLE_FIELD_SHOULD_REMAIN_ANCHORED_TO_SELECTED_FIELD`
5. `SOURCE_MASK_SHOULD_COVER_SUPERSEDED_SOURCE_GLYPH`
6. `REPLACEMENT_GLYPH_SHOULD_FIT_REPLACEMENT_FIELD`

### Required interaction behavior

A user should be able to:

- hover a visible word/line and see the corresponding hit area over that visible text
- single-click without the page shifting
- double-click visible text and enter editing on that exact object
- focus the field without the field moving to a different line
- select text without changing the object's screen-space anchor
- exit editing without a geometry jump

If the hover or editable field is larger than the visible glyphs, that may be acceptable for usability, but diagnostics must classify it explicitly as an intentional containing hitbox rather than unexplained drift.

Add regression tests that fail if the first geometry divergence occurs during hover, click, focus, contenteditable activation, or selection creation.

---

# Priority 2 — Reader quality: make reading feel premium

## 2.1 Rendering quality

- Keep the canvas crisp at device pixel ratio without changing CSS geometry.
- Ensure zoom rerenders are cancelled when stale.
- Prevent blurry intermediate canvases from becoming authoritative.
- Preserve page center while zooming when possible.
- Avoid flicker between canvas and text layer.
- Avoid unnecessary rerenders when only UI chrome changes.

## 2.2 Zoom behavior

Support polished zoom behavior:

- Zoom in / out
- exact percentage input
- Fit Page
- Fit Width
- Actual Size
- Ctrl/Cmd + mouse wheel zoom when the pointer is over the PDF surface
- preserve the user's focal point during wheel zoom when practical
- clamp zoom safely

Do not let zoom alter semantic PDF geometry.

## 2.3 Navigation

Make navigation predictable:

- previous / next page
- page-number jump
- PageUp / PageDown
- Home / End
- keyboard focus must not steal navigation while typing in fields
- remember current page and zoom in workspace state
- jumping to page 450 in a 500-page file must not trigger rendering of hundreds of pages

## 2.4 Search

Upgrade search toward a premium reader experience:

- current-version semantic text only
- no superseded/historical text in results
- deterministic result ordering
- next / previous
- visible highlight
- result count
- preserve query across page changes
- avoid eagerly rasterizing pages merely to search them
- progressive/lazy indexing for large documents

The user should be able to search a 500-page PDF without turning it into 500 active canvases.

## 2.5 Thumbnails / outline

Keep thumbnails lazy and bounded.

- only render thumbnails near the thumbnail viewport
- dispose/reuse thumbnail resources when useful
- outline navigation should remain cheap
- side panel opening must not break page geometry

---

# Priority 3 — Large-document architecture

Substrate should never equate "understanding a document" with "rendering every page."

For large PDFs:

- current page: full canvas + text layer + editing DOM
- nearby pages: optional warm metadata/cache only
- distant pages: dormant
- semantic/text extraction: lazy and cacheable
- canvases: aggressively bounded
- diagnostics: current page only unless explicitly requested
- no unbounded MutationObserver or pointer history

Target behavior:

> A 500-page PDF should feel like page 14 exists now, pages 13/15 are cheap to reach, and the other 497 pages are knowledge, not active DOM.

Add tests or instrumentation for:

- page 1 → page 450 jump
- repeated page navigation
- zoom changes
- thumbnail panel open/close
- search across many pages
- memory/canvas count does not grow linearly with page count

If exact browser memory cannot be asserted in unit tests, assert bounded resource counts and cache sizes.

---

# Priority 4 — Text selection and copy

Untouched source PDF text should behave like text, not like a decorative overlay.

- users should be able to select/copy source text naturally in reader mode
- edit mode must still allow reliable object hit-testing
- selection should not expose superseded source text
- replacement text should copy as current text
- search highlights must not interfere with selection

Do not solve this by making the entire page pointer-active in a way that blocks editing.

---

# Priority 5 — Editing quality

## 5.1 Direct text editing

The editing loop must be:

> hover → click/double-click → field appears in place → type → commit → same geometry → save → reopen → same visible result

Rules:

- user-selected font size remains authoritative
- never silently shrink text to fit
- field may grow downward when needed, but the top/source anchor must remain explainable and measurable
- edits must not teleport upward to unrelated lines
- neighboring columns/blocks must not move unless the semantic reflow rule explicitly owns them
- no stale source text should become hoverable after replacement

## 5.2 Images

Inserted images should support:

- drag/drop
- move
- resize
- predictable wrap behavior
- no accidental clipping
- live/save parity

Image geometry must be represented in PDF points and projected through the same observable transform chain.

## 5.3 Undo / redo

Keep history as edit deltas/state, not whole-document raster snapshots.

Undo/redo must preserve:

- object identity
- selected/current state where reasonable
- geometry
- source ownership

---

# Priority 6 — Reader conveniences worth having

Only after geometry and performance are stable, add or polish high-value reader features where the existing architecture supports them cleanly:

- document properties
- page rotation
- page duplicate/delete/move/add
- extract page
- insert/merge PDF
- conservative crop
- conservative compression
- export pages as images
- clickable links if available from PDF annotations
- basic annotation display if PDF.js exposes it cheaply
- print support if it can be done without destabilizing the reader

Do not add deep Acrobat-style forms/XFA/signatures/redaction in this run.

---

# Priority 7 — Accessibility and keyboard behavior

A premium reader must not be mouse-only.

- toolbar controls have useful labels
- focus order is logical
- keyboard navigation is deterministic
- text remains accessible where possible
- no hidden current-version objects remain focusable/hit-testable
- edit mode and reader mode are distinguishable

Do not claim full tagged-PDF accessibility support unless implemented and tested.

---

# Priority 8 — Diagnostics become a permanent engineering advantage

The visual scene graph is not a temporary debugging hack. Keep it as a first-class engineering system.

Normal mode:

- diagnostic mode OFF
- virtually no continuous geometry work
- no glyph scanning
- no pointer journals

DEBUG:

- bounded current-page interaction and geometry traces
- hover/click/hit-test truth
- page/canvas/text-layer alignment

DEEP:

- glyph ink measurements
- visual ancestry
- transform divergence
- detailed projection relationships

`Copy Page Diagnostics` should be sufficient for an agent to answer:

- What visible object did the user point at?
- Which DOM object received the event?
- What glyphs are actually underneath the pointer?
- Is the hitbox aligned, oversized, undersized, near, partially overlapping, or disjoint?
- Is the selected/edit field still anchored to the source object?
- Did toolbar/search/scroll/focus change page geometry?
- What was the first transform stage where expected and actual positions diverged?

Do not require screenshots for these answers when the geometry evidence is sufficient.

---

# Priority 9 — Add a reader quality smoke suite

Create deterministic smoke tests around the actual user experience.

At minimum cover:

1. open PDF
2. Fit Page
3. Fit Width
4. zoom in/out
5. page next/prev
6. page jump
7. search open/close
8. search next/prev
9. thumbnails open/close
10. outline open/close
11. single-click source text
12. double-click source text
13. enter contenteditable
14. selection creation
15. commit edit
16. undo/redo
17. insert/move/resize image
18. Save bytes
19. reopen bytes
20. compare current semantic + visible geometry

Add geometry assertions such as:

- canvas/text-layer origin delta <= tolerance
- click target glyph distance <= tolerance
- selected/edit field remains anchored
- UI chrome changes do not unexpectedly translate the page
- save/reopen does not resurrect superseded text

---

# Design constraints

- Keep the extension lightweight.
- Do not import a giant PDF suite.
- Prefer existing PDF.js/pdf-lib infrastructure.
- Do not add an always-running expensive observer.
- Do not rasterize all pages.
- Do not store whole-page bitmaps in undo history.
- Do not add magic correction offsets.
- No screenshot/OCR dependency for ordinary text-based PDF geometry debugging.
- OCR remains a later fallback for scanned/image-only PDFs.
- Preserve current file compatibility.

---

# Definition of success

The run is successful when Substrate is materially closer to this experience:

> A PDF opens quickly and looks crisp. Navigation and search feel immediate. Hover and selection correspond to visible content. Editing starts exactly where the user clicked. The page never jumps because a control appeared. Direct edits remain stable while typing. Save/reopen looks the same. Large PDFs remain bounded in memory. When something is wrong, Copy Page Diagnostics can explain the mismatch mathematically.

The product should feel less like "a browser extension that can open PDFs" and more like a deliberately engineered lightweight document reader/editor.

The long-term competitive advantage is not maximum feature count. It is:

> **fast + precise + editable + explainable + agent-readable**

That is the direction to optimize for.
