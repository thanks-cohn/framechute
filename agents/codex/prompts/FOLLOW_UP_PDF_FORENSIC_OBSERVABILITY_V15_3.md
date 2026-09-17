# V15.3 — PDF FORENSIC OBSERVABILITY / AGENT BLACK-BOX SYSTEM

## Mission

Use **PR #68 as the immutable implementation foundation**, but do **not** modify PR #68 itself.

- PR: `Harden PDF edit identity, geometry, and save/reopen observability (PR #67 follow-up)`
- PR #68 branch: `codex/update-pr-#67-for-pdf-agent-observability`

First inspect PR #68 in full: its exact head commit, changed files, tests, comments, architecture, and production wiring.

Then create a **new follow-up working branch from the exact current PR #68 head** and implement V15.3 there.

Hard handoff rule:

- do not push V15.3 commits onto the PR #68 branch,
- do not rewrite or force-push PR #68,
- do not silently restart from `main`,
- inherit PR #68's implementation exactly as the starting code,
- keep the V15.3 work isolated in a new branch,
- at the end, open a **new stacked follow-up PR** whose base is the PR #68 branch so the new PR shows only the V15.3 delta,
- clearly state in that new PR that it depends on PR #68,
- after PR #68 merges, the follow-up PR may be retargeted/rebased onto `main` if needed.

Suggested follow-up branch name:

`codex/pdf-forensic-observability-v15-3`

The exact name may differ if necessary, but the branch must be newly created from PR #68's current head.

This is not a redesign of Substrate's PDF editor.

This is the pass that turns the PDF subsystem into a **forensically observable mathematical system**.

The goal is that when any visible PDF problem occurs — ghost text, clipping, hover resurrection, bad mask, wrong save geometry, collision, wrong z-order, wrong transform, stale history, font drift, reflow mismatch, off-by-one source identity, CropBox/rotation bug, wrong hit target, bad search state, or anything similar — the system leaves enough structured residue behind that an agent can diagnose the cause without asking the user to describe what happened and without relying on a screenshot.

The ideal end-state is:

> Every meaningful PDF object has identity.
> Every identity has geometry.
> Every geometry has a coordinate space.
> Every transition has a state.
> Every state change can leave a bounded trace.
> Every invariant violation has a code.
> Every Save/reopen boundary can be compared.
> Every artifact can be attributed.
> Every important mismatch becomes machine-readable evidence.

This system should be advanced enough that future agents can ask:

> “What exactly happened to object X between idle, hover, editing, commit, Save, and reopen?”

and get a deterministic answer.

---

# Engineering posture

Do **not** optimize this run for the smallest diff.

The previous PDF work suffered because important state lived implicitly in geometry, CSS, DOM, and edit arrays.

This pass should favor explicit instrumentation, pure helpers, tests, invariants, event records, stable schemas, and deterministic debugging over terse implementation.

**Target at least ~500 lines of meaningful implementation/tests/documentation if the architecture genuinely benefits from it.**

Do not add filler just to hit a number.

But do not collapse the work into 80 clever lines because you are trying to minimize the patch. If 500–900 lines of careful code are appropriate to make this system genuinely forensic, write them.

The desired outcome is a system that is mathematically inspectable and difficult to lie to.

---

# Hard performance requirement — 4 GB machine safe

This observability system must remain cheap enough for Substrate to run well on a modest 4 GB computer.

Therefore:

- diagnostics are **off or nearly free by default**,
- no continuous screenshot capture,
- no base64 assets in traces,
- no full PDF byte copies in traces,
- no unbounded logs,
- no full-document DOM scans on every pointer event,
- no eager all-page instrumentation,
- no permanent MutationObserver storm,
- no debug code that changes normal layout,
- no object snapshots retained forever.

When diagnostics are disabled:

> the hot path should have essentially zero meaningful diagnostic overhead beyond already-useful stable IDs/metadata.

When diagnostics are enabled:

> use page-scoped, bounded, compact structured data with explicit limits.

Prefer:

- fixed-size ring buffers,
- page-local traces,
- event sampling/coalescing,
- small numeric records,
- explicit opt-in deep capture,
- lazy DOM/ink measurement,
- deterministic compaction.

A 500-page PDF must not produce 500 pages of diagnostic state merely because it was opened.

---

# P0 — Fix the known PR #68 gaps first

Before adding new forensic capabilities, inspect PR #68 and fix the remaining concrete weaknesses.

## 1. Historical-object comparator bug

Review `comparePdfSnapshots()`.

Do not filter historical objects out and then later expect to detect them from the filtered set.

Explicitly test:

- reopened historical object -> `RESURRECTED_HISTORICAL_OBJECT`,
- reopened superseded object -> `RESURRECTED_HISTORICAL_OBJECT` or a more specific code,
- unmatched legitimate current object -> separate classification,
- ambiguous candidates -> `AMBIGUOUS_CORRESPONDENCE`,
- missing current object -> `MISSING_CURRENT_OBJECT`.

No dead branches.

## 2. Wire real browser observation into Copy Page Diagnostics

PR #68 already has canonical geometry and production diagnostics.

Now Copy Page Diagnostics must also collect **actual browser reality**.

For each relevant visible PDF object, capture where practical:

- actual DOM layout rectangle,
- actual visible text Range rectangles,
- union of visible glyph/text ink rectangles,
- canvas `TextMetrics.actualBoundingBoxAscent`,
- `actualBoundingBoxDescent`,
- measured text width,
- computed font,
- computed font size,
- line height,
- display,
- visibility,
- opacity,
- transform,
- overflow,
- clip-path,
- z-index,
- pointer-events,
- stacking-context creation,
- relevant classes,
- DOM order / paint order approximation,
- selection/editing/hover state,
- owning edit ID,
- source object ID,
- line ID,
- block ID,
- mask IDs.

Do not use DOM geometry as canonical truth.

It is **observational evidence** to compare against canonical expectations.

---

# P0 — One stable PDF diagnostic identity contract

PR #68 currently uses a mix of diagnostic data attributes.

Choose and document one contract for PDF diagnostic identity.

Prefer explicit names such as:

```
data-pdf-object-id
data-pdf-source-object-id
data-pdf-edit-id
data-pdf-line-id
data-pdf-block-id
data-pdf-mask-owner-id
data-pdf-version-state
```

Every relevant rendered PDF element should expose enough identity for diagnostics to map it back to the canonical model.

Do not let:

- source IDs,
- replacement IDs,
- DOM IDs,
- mask IDs,
- source indexes

silently substitute for one another.

Legacy compatibility may be handled once at ingestion.

---

# P0 — Build a bounded forensic event journal

Add a compact **PDF forensic event journal**.

This is a black-box recorder, not a verbose console log.

It should record important state transitions and mutations with stable object references.

Suggested event record:

```js
{
  seq,
  timestamp,
  page,
  eventCode,
  objectId,
  relatedObjectIds,
  transactionId,
  stateBefore,
  stateAfter,
  geometryBefore,
  geometryAfter,
  coordinateSpace,
  cause,
  metadata
}
```

Do not store huge objects.

Use compact summaries.

Important events may include:

- `PDF_PAGE_RENDER_BEGIN`
- `PDF_PAGE_RENDER_COMPLETE`
- `PDF_LAYOUT_BUILT`
- `PDF_EDIT_CREATED`
- `PDF_EDIT_UPDATED`
- `PDF_EDIT_COMMITTED`
- `PDF_EDIT_SUPERSEDED`
- `PDF_EDIT_DELETED`
- `PDF_MASK_CREATED`
- `PDF_MASK_APPLIED`
- `PDF_WRAP_GENERATED`
- `PDF_SELECTION_CHANGED`
- `PDF_STATE_ENTER_HOVER`
- `PDF_STATE_ENTER_SELECTED`
- `PDF_STATE_ENTER_EDITING`
- `PDF_STATE_COMMITTED`
- `PDF_RERENDER_BEGIN`
- `PDF_RERENDER_COMPLETE`
- `PDF_SEARCH_QUERY`
- `PDF_SAVE_BEGIN`
- `PDF_SAVE_MASK_PLAN`
- `PDF_SAVE_DRAW_OBJECT`
- `PDF_SAVE_COMPLETE`
- `PDF_REOPEN_BEGIN`
- `PDF_REOPEN_MANIFEST_FOUND`
- `PDF_REOPEN_RECONCILED`
- `PDF_REOPEN_HISTORICAL_QUARANTINED`
- `PDF_DIAGNOSTIC_SNAPSHOT_CREATED`

Use an explicit enum/string constant registry so event names are not scattered ad hoc throughout the codebase.

---

# P0 — Ring buffer / bounded residue

The forensic journal must be bounded.

Implement something like:

```
createPdfForensicJournal({
  maxEvents: 256,
  maxPages: 3,
  maxEventsPerObject: 32
})
```

Exact numbers may differ, but the rules are:

- oldest events are evicted deterministically,
- no memory growth from long sessions,
- no giant strings,
- cap text samples,
- no image data,
- no PDF bytes,
- page traces can be discarded when far outside the active LRU window,
- diagnostics may request a deeper temporary capture for a page.

Expose journal statistics:

- events retained,
- events dropped,
- pages represented,
- bytes-estimate if practical,
- oldest/newest sequence.

Add a diagnostic issue if events were dropped so an agent knows the trace is incomplete:

`FORENSIC_TRACE_TRUNCATED`.

---

# P0 — Transaction IDs / causal grouping

A single user action often causes many derived effects.

Give important operations a transaction/correlation ID.

Example:

```
User types replacement
  transaction edit-tx-123
    EDIT_UPDATED
    LAYOUT_INVALIDATED
    MASK_PLAN_REBUILT
    PAGE_RERENDERED
    COLLISION_CHECKED
```

Save:

```
save-tx-456
  SAVE_BEGIN
  SAVE_MASK_PLAN
  SAVE_DRAW_OBJECT x N
  SAVE_COMPLETE
```

Reopen:

```
reopen-tx-789
  REOPEN_BEGIN
  MANIFEST_FOUND
  SOURCE_EXTRACTED
  RECONCILIATION_MATCH
  HISTORICAL_QUARANTINED
  REOPEN_COMPLETE
```

Agents should be able to follow cause -> consequence.

---

# P0 — Explicit object lifecycle

Every meaningful PDF object should have a lifecycle state.

At minimum distinguish:

- `source-current`
- `replacement-current`
- `free-text-current`
- `image-current`
- `wrap-current`
- `superseded`
- `historical`
- `deleted`
- `derived-mask`
- `derived-layout`

Do not invent many categories unless useful.

The key requirement is:

> an object may never become active merely because it still exists somewhere in PDF bytes, undo history, DOM, cache, or a prior semantic model.

The diagnostics must be able to say:

```
object edit:123
  current: false
  lifecycle: superseded
  supersededBy: edit:456
  renderEligible: false
  hitTestEligible: false
  searchEligible: false
  extractionEligible: false
  saveEligible: false
```

---

# P0 — Eligibility matrix

Make current-version participation explicit.

A diagnostic record should be able to tell whether an object is eligible for:

- render,
- hit test,
- search,
- extraction,
- wrapping,
- collision/layout,
- Save,
- selection.

This can be represented as a compact eligibility object.

Add invariant codes when historical/stale objects violate it:

- `HISTORICAL_OBJECT_RENDER_ELIGIBLE`
- `HISTORICAL_OBJECT_HIT_TEST_ELIGIBLE`
- `HISTORICAL_OBJECT_SEARCH_ELIGIBLE`
- `HISTORICAL_OBJECT_EXTRACTION_ELIGIBLE`
- `HISTORICAL_OBJECT_SAVE_ELIGIBLE`
- `STALE_OVERLAY_ACTIVE`

---

# P0 — Coordinate-space registry

Do not let coordinate-space names exist only in comments.

Create a small canonical registry/enum for coordinate spaces used by PDF diagnostics.

At minimum:

- `pdf-points`
- `semantic-pdf-points`
- `viewport-css-pixels`
- `client-css-pixels`
- `device-pixels`
- `glyph-ink-viewport`
- `serialized-pdf-points`

Each geometry-bearing diagnostic record must declare its space.

Do not compare rectangles from different spaces without an explicit conversion.

Add a diagnostic failure code:

`COORDINATE_SPACE_MISMATCH`.

---

# P0 — Transform chain evidence

For every observed object, make it possible to reconstruct how canonical geometry became browser geometry.

Capture a transform chain where relevant:

```
PDF points
  -> page viewport transform
  -> viewport-local CSS
  -> page/surface DOM offset
  -> client CSS
  -> device pixels
```

Store compact numeric transform evidence:

- viewport scale,
- rotation,
- viewport transform matrix,
- DPR,
- surface client origin,
- relevant CSS transform.

Add helpers to calculate expected output through the chain.

Add issue codes:

- `PDF_TO_VIEWPORT_TRANSFORM_MISMATCH`
- `VIEWPORT_TO_CLIENT_TRANSFORM_MISMATCH`
- `CSS_TRANSFORM_UNEXPECTED`
- `DEVICE_PIXEL_SCALE_MISMATCH`.

---

# P0 — Expected vs observed geometry deltas

For every object that has both canonical and observed geometry, compute explicit deltas.

Example:

```
{
  expectedRect,
  observedLayoutRect,
  observedInkRect,
  layoutDelta: { dx, dy, dw, dh },
  inkDelta: { ... },
  maxAbsDelta,
  tolerance,
  withinTolerance
}
```

Do not merely report that rectangles differ.

Quantify how.

Issue codes may include:

- `OBSERVED_LAYOUT_DRIFT`
- `OBSERVED_INK_DRIFT`
- `GLYPH_INK_OUTSIDE_OWNER`
- `GLYPH_INK_CLIPPED`
- `EDIT_BOX_TOO_SMALL_FOR_INK`
- `EDIT_BOX_UNEXPECTEDLY_EXPANDED`.

---

# P0 — Real visible text/glyph measurement

For text objects:

Use `Range.getClientRects()` / text-node ranges where practical.

Capture:

- every returned fragment rectangle,
- union rect,
- fragment count.

Also capture canvas text metrics where possible:

- actualBoundingBoxAscent,
- actualBoundingBoxDescent,
- actualBoundingBoxLeft,
- actualBoundingBoxRight,
- width.

Do not pretend DOM layout rectangles equal visible glyph ink.

This distinction is central.

If text contains multiple fragments/lines, preserve that fact instead of flattening everything into one unexplained rectangle.

---

# P0 — Mask forensics

For every erase mask report:

- mask ID,
- role,
- owner edit ID,
- source object IDs,
- contributing edit IDs,
- PDF-space rect,
- viewport expected rect,
- DOM observed rect,
- layer/z-index,
- whether it actually overlaps the intended source ink,
- whether it overlaps unrelated current ink,
- whether its owner is current.

Add issue codes such as:

- `MASK_OWNER_MISSING`
- `MASK_SOURCE_MISSING`
- `MASK_MISSES_SOURCE_INK`
- `MASK_ERASES_UNRELATED_CURRENT_OBJECT`
- `MASK_GEOMETRY_DRIFT`
- `MASK_BEHIND_SOURCE`
- `REPLACEMENT_BEHIND_MASK`
- `MASK_FROM_SUPERSEDED_EDIT_ACTIVE`.

---

# P0 — Layer / stacking forensic model

Build a compact logical + observed layer record.

Logical layers may include:

1. original PDF canvas,
2. source erase masks,
3. replacement/reflow text,
4. inserted images,
5. annotations/search,
6. selection/edit UI,
7. transient debug overlay.

For every observed element capture enough to detect:

- incorrect z-order,
- new stacking context,
- pointer-event interception,
- hidden-but-hit-testable object,
- visible-but-not-hit-testable object,
- stale overlay above current content.

Issue codes:

- `UNEXPECTED_STACKING_CONTEXT`
- `STATE_CHANGED_STACKING_ORDER`
- `STALE_OBJECT_HIT_TESTABLE`
- `CURRENT_OBJECT_NOT_HIT_TESTABLE`
- `UI_LAYER_BLOCKING_DOCUMENT_OBJECT`.

---

# P0 — State-transition snapshots

Support explicit captures for:

- idle,
- hover,
- selected,
- editing,
- committed,
- rerendered,
- saved,
- reopened.

Do not require all states to be captured continuously.

Provide an opt-in diagnostic session that can capture them on demand.

A diagnostic session should be able to produce:

```
object X
  idle       -> geometry/state
  hover      -> geometry/state
  selected   -> geometry/state
  editing    -> geometry/state
  committed  -> geometry/state
  rerendered -> geometry/state
```

Then compare transitions.

Issue codes:

- `STATE_CHANGED_CANONICAL_GEOMETRY`
- `STATE_CHANGED_LAYOUT_GEOMETRY`
- `STATE_CHANGED_VISIBILITY`
- `STATE_CHANGED_POINTER_ELIGIBILITY`
- `HOVER_RESURRECTED_HISTORICAL_OBJECT`
- `COMMIT_LEFT_STALE_OVERLAY`.

---

# P0 — Before-hover vs during-hover text geometry is mandatory

This is a hard requirement because some of the hardest Substrate PDF failures have appeared only when the pointer enters a text region.

For every text object that can react to hover, selection, focus, or editing affordances, the forensic system must be able to capture and compare the **same stable object's exact state immediately before hover and while hover is active**.

Do not reduce this to `hovered: true`.

For the same stable object ID, capture at minimum:

```
beforeHover:
  canonicalPdfRect
  expectedViewportRect
  observedDomRect
  observedInkRects
  observedInkUnion
  baseline
  fontMetrics
  cssTransform
  zIndex / stacking
  visibility / opacity
  pointerEvents
  maskIds
  lifecycle / eligibility

duringHover:
  canonicalPdfRect
  expectedViewportRect
  observedDomRect
  observedInkRects
  observedInkUnion
  baseline
  fontMetrics
  cssTransform
  zIndex / stacking
  visibility / opacity
  pointerEvents
  maskIds
  lifecycle / eligibility

hoverDelta:
  canonical: { dx, dy, dw, dh }
  layout:    { dx, dy, dw, dh }
  ink:       { dx, dy, dw, dh }
  baselineDelta
  transformChanged
  stackingChanged
  visibilityChanged
  pointerEligibilityChanged
  maskSetChanged
```

The resulting diagnostics must let an agent determine, without screenshots:

- whether the text itself moved on hover,
- whether only the DOM owner box moved,
- whether glyph ink moved while canonical PDF geometry stayed fixed,
- whether the source stayed still but a replacement/overlay appeared elsewhere,
- whether hover changed font metrics, line-height, transform, z-order, mask ownership, clipping, or pointer targeting,
- whether a historical/superseded object became visible or hit-testable only during hover,
- the exact numeric before/after delta in the declared coordinate space.

Required issue codes should include, where applicable:

- `HOVER_CHANGED_CANONICAL_GEOMETRY`
- `HOVER_CHANGED_LAYOUT_GEOMETRY`
- `HOVER_CHANGED_INK_GEOMETRY`
- `HOVER_CHANGED_BASELINE`
- `HOVER_CHANGED_TRANSFORM`
- `HOVER_CHANGED_STACKING_ORDER`
- `HOVER_CHANGED_VISIBILITY`
- `HOVER_CHANGED_POINTER_ELIGIBILITY`
- `HOVER_MASK_SET_CHANGED`
- `HOVER_RESURRECTED_HISTORICAL_OBJECT`
- `HOVER_REPLACEMENT_SOURCE_DIVERGED`

If hover legitimately adds handles, outlines, controls, or other UI chrome, those must be recorded as **separate UI-layer objects**. Their dimensions must never be mistaken for movement of the underlying document text.

Preserve stable identity across before/after captures so the comparison is object-to-itself, never anonymous-rectangle-to-anonymous-rectangle.

Add regression tests for:

1. a no-op hover where canonical/layout/ink positions remain within tolerance,
2. a synthetic hover shift where exact dx/dy/dw/dh are reported,
3. canonical geometry staying fixed while DOM geometry moves,
4. canonical and DOM geometry staying fixed while glyph ink changes,
5. z-index/transform changes on hover,
6. mask-set changes on hover,
7. a historical object appearing only during hover and being reported immediately.

The end state should make a report such as:

> “The text moves 3.2 CSS px right only during hover.”

directly provable from the diagnostic JSON, including which layer moved and whether its canonical PDF coordinates changed.

---

# P0 — Invariant registry

Create a central invariant-code registry instead of scattered ad hoc messages.

Each invariant should have:

- code,
- severity,
- short description,
- object IDs,
- transaction ID if relevant,
- expected,
- actual,
- coordinate space,
- optional suggested subsystem.

Suggested categories:

## Identity

- `DUPLICATE_STABLE_ID`
- `SOURCE_REPLACEMENT_ID_ALIAS`
- `MISSING_EDIT_ID`
- `MISSING_SOURCE_LINEAGE`

## Geometry

- `NON_FINITE_GEOMETRY`
- `NEGATIVE_DIMENSION`
- `ZERO_AREA_UNEXPECTED`
- `COORDINATE_SPACE_MISMATCH`
- `ROUND_TRIP_GEOMETRY_MISMATCH`
- `OBSERVED_LAYOUT_DRIFT`
- `OBSERVED_INK_DRIFT`

## Version/history

- `CURRENT_STATE_CONTAINS_SUPERSEDED_OBJECT`
- `HISTORICAL_OBJECT_RENDERED`
- `HISTORICAL_OBJECT_HIT_TESTABLE`
- `SAVE_REOPEN_RESURRECTED_TEXT`
- `STALE_OVERLAY_ACTIVE`

## Masks

- `MASK_OWNER_MISSING`
- `MASK_SOURCE_MISSING`
- `MASK_GEOMETRY_DRIFT`
- `MASK_MISSES_SOURCE_INK`
- `MASK_ERASES_UNRELATED_CURRENT_OBJECT`

## Layers/state

- `STATE_CHANGED_GEOMETRY`
- `STATE_CHANGED_STACKING_ORDER`
- `UNEXPECTED_STACKING_CONTEXT`
- `CURRENT_OBJECT_NOT_HIT_TESTABLE`

## Save/reopen

- `MISSING_CURRENT_OBJECT`
- `AMBIGUOUS_CORRESPONDENCE`
- `LIVE_SAVE_GEOMETRY_MISMATCH`
- `LIVE_SAVE_TEXT_MISMATCH`
- `RESURRECTED_HISTORICAL_OBJECT`
- `REOPEN_MANIFEST_INVALID`
- `REOPEN_MANIFEST_MISSING_EXPECTED_OBJECT`

Do not create duplicate codes for the same concept.

---

# P0 — Error code registry must be agent-friendly

Expose a function such as:

```
describePdfDiagnosticCode(code)
```

that returns compact machine-friendly metadata:

```
{
  code,
  category,
  severityDefault,
  explanation,
  likelySubsystem,
  evidenceNeeded
}
```

This lets an agent receive `MASK_MISSES_SOURCE_INK` and immediately know where to inspect.

Keep strings concise.

Do not embed huge troubleshooting essays in runtime memory.

---

# P0 — Diagnostic snapshot should contain a concise executive summary

Copy Page Diagnostics should have a top-level summary:

```
{
  schemaVersion,
  documentVersionId,
  page,
  captureId,
  capturedAt,
  mode,
  objectCounts,
  issueCounts,
  eventJournalSummary,
  worstIssues,
  coordinateSpacesPresent,
  currentObjects,
  historicalObjects,
  masks,
  observations,
  collisions,
  eventTail,
  invariants
}
```

Sort deterministically.

Cap `worstIssues`.

Cap `eventTail`.

Agents should not need to search through 50,000 lines to find the problem.

But enough detail must be available in object records for forensic follow-up.

---

# P0 — Per-object forensic lookup

Add an API that can retrieve a compact dossier for one object ID.

Example:

```
buildPdfObjectDossier({
  objectId,
  snapshot,
  journal
})
```

Return:

- canonical object,
- lineage,
- current/historical state,
- eligibility,
- masks,
- collisions,
- expected geometry,
- observed geometry,
- ink geometry,
- latest state captures,
- latest journal events,
- Save/reopen correspondence,
- invariant issues involving this object.

This is critical for future multi-agent work.

An agent should be able to ask:

> “Give me everything known about edit:abc.”

without parsing the whole page trace.

---

# P0 — Page forensic lookup

Likewise add a compact page-level summary API:

```
buildPdfPageForensicSummary(...)
```

It should identify:

- objects with errors,
- objects with largest geometry deltas,
- masks with suspicious overlap,
- historical objects present,
- current objects missing observations,
- collisions,
- event tail.

---

# P0 — Diagnostics modes

Use at least two modes:

## NORMAL / dormant

- stable IDs only,
- current-version bookkeeping,
- essentially no forensic cost.

## DIAGNOSTIC

- journal enabled,
- on-demand DOM/ink measurement,
- bounded event capture,
- page/object dossiers available.

Optionally add:

## DEEP CAPTURE

Temporary, explicit, page-scoped.

May capture more DOM state across transitions for a short time.

Deep capture must auto-expire or require explicit stop.

Do not leave deep mode running forever.

---

# P0 — Copy Page Diagnostics must be one-click useful

The existing button should remain.

When clicked:

1. capture current page canonical state,
2. capture current DOM state,
3. capture visible text ink,
4. capture current mask/layer state,
5. attach bounded journal tail,
6. run invariants,
7. produce JSON,
8. copy JSON.

No screenshots required.

Do not block the UI for long.

If deep measurements are expensive, yield between stages or keep scope to the current page.

---

# P0 — Optional object-specific copy action

If inexpensive and clean, add a debug-only context action:

**Copy Object Diagnostics**

for the currently selected PDF object.

This should copy the object dossier.

Do not clutter normal UI.

Place it behind the existing advanced/debug surface if appropriate.

---

# P0 — Deterministic serialization

Diagnostic JSON must be deterministic enough to diff.

Use:

- stable key conventions,
- sorted object arrays by stable ID,
- sorted issues by severity/code/object,
- fixed numeric rounding,
- capped text,
- no random ordering from Sets/Maps.

Timestamps/sequence numbers may differ, but semantic content should remain comparable.

---

# P0 — Privacy / payload discipline

Diagnostics must never accidentally copy:

- image base64,
- entire PDF bytes,
- embedded font binaries,
- full huge documents,
- browser secrets,
- unrelated workspace content.

Only include the current PDF page/object evidence required for debugging.

Cap text samples reasonably.

---

# P0 — Tests for residue

Add tests that prove the forensic system leaves useful residue.

At minimum:

## Ghost text case

A -> B -> C -> Save -> reopen.

Assert:

- A/B historical,
- C current,
- journal contains reconciliation events,
- historical objects not render/search/extract eligible,
- object dossier for C includes source lineage,
- page summary reports no resurrection.

## Bad mask case

Construct a mask that misses expected source ink.

Assert:

- `MASK_MISSES_SOURCE_INK`,
- mask owner identified,
- expected source object identified,
- intersection data present.

## Geometry drift case

Expected rect != observed DOM rect.

Assert:

- explicit dx/dy/dw/dh,
- `OBSERVED_LAYOUT_DRIFT`,
- coordinate space recorded.

## Ink overflow case

Glyph ink extends outside owner box.

Assert:

- `GLYPH_INK_OUTSIDE_OWNER`,
- union ink rect preserved,
- owner rect preserved.

## State regression case

Hover changes geometry or resurrects stale content.

Assert appropriate state issue code.

## Trace truncation

Fill the journal beyond capacity.

Assert:

- bounded length,
- deterministic eviction,
- `FORENSIC_TRACE_TRUNCATED` or equivalent summary flag.

---

# P0 — Real browser-state measurement tests where practical

Pure Node tests cannot fully verify real browser text Range geometry.

Where existing test infrastructure allows, add focused DOM/browser-like tests around:

- stable data attributes,
- state capture,
- computed-style extraction,
- transform/layer metadata.

Keep browser-dependent measurement code behind small adapters so Node tests can inject mock observed rectangles/metrics deterministically.

Do not make core diagnostics untestable because DOM APIs are involved.

---

# P0 — Preserve PR #68 production behavior

Do not regress:

- current semantic Search,
- A→B→C Save/reopen behavior,
- stable edit IDs,
- current-version manifest,
- mask ownership,
- strict geometry validation,
- semantic reconciliation,
- low-memory page layout cache,
- live/save mask parity,
- PDF rendering,
- direct text editing.

This pass is additive/hardening.

---

# P0 — 4 GB performance acceptance

Add at least lightweight tests or instrumentation proving bounded behavior.

Required properties:

- journal max length is fixed,
- no diagnostic record contains image base64 or PDF bytes,
- only current page DOM is measured by Copy Page Diagnostics,
- no all-page text extraction happens merely to copy one page's diagnostics,
- no observer remains active after deep capture ends,
- journal page retention is bounded,
- object dossier lookup does not rebuild the whole document.

Document expected memory behavior.

---

# P1 — Debug overlay

If practical after all P0 work:

Add an optional geometry overlay for the current page.

It may display:

- source run box,
- replacement box,
- observed DOM box,
- ink union box,
- masks,
- IDs.

Rules:

- disabled by default,
- pointer-events none,
- never changes layout,
- never participates in export/save,
- removable instantly,
- current page only.

This is secondary to structured diagnostics.

---

# P1 — Export diagnostic file

If useful and trivial after Copy JSON works:

Allow **Download Page Diagnostics JSON**.

Do not spend time on this before the core system is complete.

---

# Architectural principle for future WEBX/DOCX

Do not hard-code the forensic architecture so tightly to PDF.js that it cannot inspire the future canonical document system.

PDF-specific adapters are fine.

But the general concepts should remain reusable:

- object identity,
- coordinate spaces,
- lifecycle,
- eligibility,
- event journal,
- invariant codes,
- observations,
- dossiers,
- deterministic snapshots.

PDF is the proving ground.

WEBX may later make many of these semantics native.

---

# Suggested file organization

Use judgment, but a clean split could be:

```
src/documents/pdf-observability.js
src/documents/pdf-diagnostics.js
src/documents/pdf-forensics.js
src/documents/pdf-geometry.js
```

Do not split files gratuitously.

A reasonable target is:

- geometry primitives stay in `pdf-geometry.js`,
- object/version/mask semantics stay in `pdf-observability.js`,
- bounded journal/dossiers/invariant registry may live in `pdf-forensics.js`,
- DOM/ink diagnostic capture may live in `pdf-diagnostics.js`.

Prefer modules with clear contracts over one giant file.

---

# Acceptance criteria

Do not declare this run complete until:

1. PR #68 is fully reviewed before edits.
2. Historical-object detection bug is fixed.
3. Copy Page Diagnostics captures real DOM geometry.
4. Copy Page Diagnostics captures visible text Range/glyph geometry where practical.
5. Canvas text metrics are captured where practical.
6. Every observed DOM object maps to stable PDF identity.
7. Coordinate spaces are explicit.
8. Expected vs observed deltas are computed.
9. Masks have forensic overlap/ownership records.
10. Layer/z-order/pointer state is recorded.
11. State transitions can be compared.
12. A bounded forensic event journal exists.
13. Causal transaction IDs group related events.
14. Diagnostic issue/error codes are centralized.
15. Per-object dossiers can be built.
16. Page forensic summaries can be built.
17. A→B→C Save/reopen leaves useful forensic residue.
18. Historical objects are ineligible for active operations.
19. Journal memory is bounded.
20. Diagnostics remain cheap/off by default.
21. No screenshots are required to understand ordinary geometry/state failures.
22. Tests cover residue, truncation, masks, geometry drift, state drift, and save/reopen.
23. Full PDF-focused tests pass.
24. Full repository tests are run.
25. Extension validation passes.
26. Chrome Web Store packaging passes.
27. PR #68 remains unchanged and a new stacked V15.3 follow-up PR is created from PR #68's head.

---

# Required commands

Run at minimum:

```
node --test tests/pdf-diagnostics.test.mjs
node --test tests/pdf-geometry.test.mjs
node --test tests/pdf-layout.test.mjs
node --test tests/pdf-text-model.test.mjs
node --test tests/pdf-source-mask.test.mjs
node --test tests/*.test.mjs
```

Also run:

```
git diff --check
```

and `node --check` on every changed JS/MJS file.

Run extension validation and Chrome Web Store packaging validation.

If one unrelated pre-existing test fails, document the exact failure and prove the PDF suites pass.

---

# Completion report and PR handoff

When finished, **do not update PR #68**.

Instead:

1. ensure all V15.3 commits live only on the new follow-up branch created from PR #68's exact head,
2. push that branch,
3. open a **new stacked follow-up PR**,
4. set its base to `codex/update-pr-#67-for-pdf-agent-observability` while PR #68 is still open,
5. state explicitly that the new PR depends on PR #68 and is intentionally stacked on top of it,
6. make the PR diff contain only the V15.3 forensic-observability work, not a duplicate reimplementation of PR #68,
7. leave PR #68 itself untouched.

Suggested PR title:

`Add lightweight forensic PDF observability and state tracing (PR #68 follow-up)`

In the new PR description summarize:

- exact PR #68 head used as the foundation,
- forensic architecture added,
- bounded-memory strategy,
- stable diagnostic identity contract,
- event journal capacity,
- issue-code registry,
- before-hover vs during-hover geometry/ink comparison,
- DOM/ink observation,
- Save/reopen residue,
- tests run,
- any remaining unrelated failure,
- explicit note that the PR is stacked on and depends on PR #68.

The final output to the user should provide the new branch name and the new PR number/link so it is a clean handoff.

---

# Final design standard

This system should behave like a lightweight flight recorder for PDF editing.

Most of the time it should cost almost nothing.

But when something goes wrong, the evidence should already be there — or one click away.

The long-term target is:

> A user reports “the text jumped when I hovered it.”

An agent receives the diagnostic JSON and can immediately determine:

- object ID,
- source lineage,
- current/historical status,
- PDF rect,
- expected viewport rect,
- actual DOM rect,
- actual ink rect,
- transform chain,
- state transition,
- mask owners,
- collisions,
- z-order,
- relevant event transaction,
- exact invariant/error code,
- whether Save/reopen agrees.

That is the standard.

Build the most advanced version of this that remains bounded, deterministic, and safe on a 4 GB machine.
