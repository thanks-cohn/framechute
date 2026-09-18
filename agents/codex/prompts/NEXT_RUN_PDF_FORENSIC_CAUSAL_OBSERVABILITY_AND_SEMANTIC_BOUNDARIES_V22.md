# NEXT RUN — PDF FORENSIC CAUSAL OBSERVABILITY + LIVE TRUTH + SEMANTIC BOUNDARIES V22

## Mission

Build the **full forensic architecture and framework** that lets Substrate, Codex, ChatGPT, future agents, tests, and developers understand what is happening on an active PDF page at a fundamental level.

This is not "add more console logging."

The target is:

> **Nothing meaningful should happen on a PDF page without the system being able to explain who/what caused it, when it happened, where it happened, why it happened, how large it was, which coordinate space was involved, what it touched, what it owned, what was transient, what became persistent, and what Save will actually produce.**

The architecture must be optimized for agents and machine inspection first while remaining cheap for ordinary users.

This run must also use that observability to fix the currently exposed correctness problems:

- typing into an active PDF edit field grows the box but **typed characters are not visibly rendered until Enter/commit**,
- text fields grow but do not intelligently shrink when characters are removed,
- old terminal/source glyph remnants can remain visible after editing until some later interaction causes them to disappear,
- **moving a field itself reveals stale source/terminal glyph remnants and does not clear them**,
- moving/dragging can therefore expose stale source material even though later unrelated rerender/activity may hide it again,
- layout growth and source-erasure authority are partially conflated,
- editing one field can erase neighboring source content,
- original/source PDF body text can remain outside active margins while new Substrate text is constrained,
- top/bottom margin violations by original text can remain visible,
- Save can resurrect stale/cut-off source glyph fragments from the original byte stream,
- **a saved PDF reopened in Substrate can visibly contain the OLD ORIGINAL TEXT underneath the new replacement text, producing double text / overlay-on-original behavior**,
- live and saved visibility can diverge,
- transient states can disagree with committed state.

The intended result is a PDF editor that is not merely visually correct when lucky, but **scientifically diagnosable** when wrong.

---

# 0. IMPLEMENTATION SIZE / QUALITY BAR

This is deliberately a substantial architecture run.

Do not solve this with a tiny patch.

Minimum expectation:

- **at least 300 meaningful new or changed lines of implementation code**
- plus focused tests

Expected range:

- **500–700 meaningful implementation lines is completely acceptable**
- more is acceptable if genuinely required for a coherent design

Do NOT game the line count with:

- comments,
- blank lines,
- duplicated logic,
- generated boilerplate,
- giant snapshots with no reusable architecture.

The goal is success, coherence, and reusable foundations.

---

# 1. START FROM LATEST MAIN

Start from latest `main` after the V21 margin/content-group merge.

Read current code before changing anything.

Inspect at minimum:

- `src/documents/pdf-observability.js`
- `src/documents/pdf-layout.js`
- `src/documents/pdf-layout-bounds.js`
- `src/documents/pdf-content-groups.js`
- `src/documents/pdf-document.js`
- `src/documents/pdf-geometry.js`
- `src/workspace.js`
- `src/workspace.css`
- `src/pdf-popdowns.js`
- relevant `tests/*.test.mjs`

Preserve recent successes:

- native/source hover authority,
- replacement/free-text visible DOM authority,
- plain Enter commits editing,
- stable three-row PDF toolbar,
- truthful Copy behavior,
- margin guides,
- margin constraints,
- content-group geometry,
- pointer-transparent margin overlay,
- save/reopen identity work,
- diagnostics OFF by default.

Do not regress them.

---

# 2. REAL PDF FIXTURE

A test PDF now exists under:

`/pdf/`

Automatically discover the first `.pdf` file in that directory.

Do not hard-code its filename.

Never mutate the fixture.

Use it for real integration coverage where the environment supports it.

If browser-only visual measurements are unavailable in CI:

- still parse the real PDF,
- build canonical PDF-point geometry,
- build semantic layout,
- derive object/group identities,
- evaluate margin violations,
- build a forensic snapshot,
- run save/reopen checks that do not require a graphical browser.

Synthetic fixtures may still be used for focused edge cases.

---

# 3. CENTRAL LAW

The system must enforce:

> **No meaningful PDF state transition should be unexplained.**

For a visible or interactive change, the diagnostic system should be able to answer:

- WHO initiated this?
- WHAT object was involved?
- WHEN did it occur?
- WHERE was it before?
- WHERE is it now?
- IN WHICH coordinate space?
- HOW LARGE was it before/after?
- WHY did the system choose this result?
- WHAT rule constrained it?
- WHAT did it collide with?
- WHAT does it own?
- WHAT is it allowed to erase?
- WHAT is transient?
- WHAT persists?
- WHAT will Save draw/mask/keep?
- WHAT will reopen reconstruct?

---

# 4. MODES: OFF / DEBUG / DEEP

Keep the existing diagnostic modes.

## OFF

Ordinary user mode.

Requirements:

- near-zero overhead,
- no full-page scene capture,
- no glyph-ink scans,
- no unbounded event journals,
- no expensive background loops,
- no continuous page-wide DOM observation.

## DEBUG

Machine-readable active-page diagnostics.

Requirements:

- stable identities,
- canonical PDF geometry,
- object relationships,
- current margins/content bounds,
- bounded interaction journal,
- bounded mutation journal,
- collision/ownership records,
- cheap page-state snapshot.

## DEEP

Forensic mode.

May additionally capture:

- glyph ink,
- visual ancestry,
- full hit-test candidate sets,
- transient/ephemeral UI geometry,
- richer before/after state,
- exact causal mutation chains,
- mask coverage evidence,
- save-intent ledgers,
- sampled pointer movement during drags.

DEEP must remain scoped to the active/rendered page.

---

# 5. FORENSIC PAGE MODEL

Extend the existing visual scene into a machine-readable forensic page model.

Every meaningful object should be able to expose a dossier conceptually like:

```js
{
  objectId,
  sourceObjectId,
  editId,

  pageId,
  lineId,
  blockId,
  groupId,

  kind,
  semanticRole,
  provenance,
  versionState,

  semanticParentId,
  layoutGroupId,
  ownerEditId,

  readingOrder,
  spatialOrder,
  paintOrder,

  geometry: {
    sourceOwnershipRect,
    sourceOriginalRect,
    canonicalPdfRect,
    layoutRect,
    contentBounds,
    groupUnionRect,
    memberLocalRect,

    expectedViewportRect,
    observedDomRect,
    glyphInkRect,
    interactiveRect,
    editableRect,
    hoverRect,
    liveMaskRect,
    sourceMaskRects
  },

  masks: [],
  constraints: [],
  collisions: [],
  neighbors: [],
  relationships: [],

  lifecycle: {},
  transientState: {}
}
```

Use current canonical IDs.

Do not invent a second identity system.

---

# 6. COORDINATE SPACE REGISTRY

Every geometry record must explicitly name its coordinate space.

At minimum distinguish:

- raw PDF source space,
- canonical PDF points,
- page-local PDF points,
- group-local coordinates,
- PDF viewport CSS coordinates,
- client CSS coordinates,
- glyph ink client/viewport coordinates,
- editable-field coordinates,
- hover/hit-test coordinates,
- mask PDF coordinates.

No naked rectangle should appear in diagnostics without a named space.

Add conversion ancestry where relevant.

A diagnostic record should make it impossible for an agent to confuse:

`x = 36 PDF points`

with:

`x = 36 CSS pixels`.

---

# 7. GEOMETRY ANCESTRY

Preserve and extend the existing transform-chain architecture.

Every meaningful projection should be explainable through a chain such as:

```text
canonical PDF rect
→ PDF.js viewport transform
→ viewport CSS rect
→ text-layer local rect
→ client rect
→ interactive rect
```

For each chain expose:

- named stages,
- matrices,
- inputs,
- outputs,
- round-trip error,
- first divergence,
- tolerance.

Law:

> **Every visual position has a mathematical ancestry.**

---

# 8. CAUSAL ANCESTRY

Add a parallel concept for state mutations.

Every meaningful mutation must have:

- stable event/mutation sequence,
- named cause,
- initiating actor,
- optional parent event ID,
- before state,
- requested state,
- actual state,
- constraints applied,
- downstream effects.

Possible initiators:

- user,
- agent,
- system,
- save,
- restore/reopen,
- layout-engine.

Possible causes:

- pdf-hover,
- pdf-select,
- pdf-edit-begin,
- pdf-text-input,
- pdf-text-backspace,
- pdf-text-delete,
- pdf-text-autofit,
- pdf-edit-commit,
- pdf-edit-cancel,
- pdf-object-move,
- pdf-object-resize,
- pdf-margin-clamp,
- pdf-margin-reconcile,
- pdf-image-drop,
- pdf-image-wrap,
- pdf-content-reflow,
- pdf-content-group-move,
- pdf-mask-generation,
- pdf-live-rerender,
- pdf-save-normalization,
- pdf-reopen-reconciliation.

Law:

> **Every meaningful change has a causal ancestry.**

---

# 9. BOUNDED INTERACTION JOURNAL

Trace meaningful interaction events.

At minimum:

- pointerover,
- pointerout,
- pointerdown,
- pointerup,
- click,
- dblclick,

- selection changed,
- editing began,
- input,
- Backspace,
- Delete,
- commit,
- cancel,

- move begin,
- move update,
- move end,

- resize begin,
- resize update,
- resize end,

- drag begin,
- drag over,
- drop,
- drag end,

- image insertion,
- image move,

- margin drag begin,
- margin drag update,
- margin drag end,

- keyboard nudge,

- undo,
- redo,

- save,
- save-as,
- reopen/reconcile.

Use bounded journals.

Do not log infinite raw pointermove events.

DEEP may sample pointer movement sufficiently to reconstruct a drag path.

---

# 10. EVENT RECORD

Use a structured record conceptually like:

```js
{
  sequence,
  eventId,
  parentEventId,
  initiator,
  event,
  cause,
  timestamp,

  pointer,
  keyboard,

  candidateObjectIds,
  chosenObjectId,
  choiceReason,

  before,
  requested,
  actual,

  constraints,
  collisions,
  downstreamEffects
}
```

Stable sorting and deterministic serialization matter.

Agents should not need to parse prose logs.

---

# 11. TRANSIENT / EPHEMERAL STATE MUST BE MEASURED

Temporary state is still real while it exists.

Explicitly model temporary states such as:

- hover outline,
- selected outline,
- contenteditable live field,
- live edit mask,
- field mask during movement,
- source masks,
- drag ghost,
- pointer capture,
- resize handles,
- move handles,
- margin handles,
- active margin guide drag,
- temporary wrap preview,
- pending font-size change,
- temporary field width/height during typing,
- temporary geometry during pointermove before pointerup.

Every transient object/state should expose:

- owner object,
- coordinate space,
- bounds,
- creation cause,
- lifecycle state,
- whether it is visual only,
- whether it contributes to Save,
- when it was created,
- when it was updated,
- when it was removed.

Agents must be able to inspect a bug that exists only briefly.

---

# 12. LIVE TRUTH MUST UPDATE DURING INPUT

Current bug:

> The edit field grows while typing, but the typed characters are not visibly rendered until Enter/commit.

Fix this.

While contenteditable is active:

- each input must update the visible live text immediately,
- the user must see the exact current string before commit,
- Backspace/Delete must visibly remove text immediately,
- commit must not be the first time the current text becomes visible,
- the source canvas must not bleed through the live replacement field,
- the live field must remain the current presentation authority for the text being edited.

Add a diagnostic invariant:

`PDF_LIVE_EDIT_TEXT_NOT_RENDERING_CURRENT_INPUT`

Add a test that simulates:

```text
double-click
type "ABC"
inspect before Enter
```

The live presentation must already show "ABC".

No commit required.

---

# 13. BIDIRECTIONAL AUTOFIT

Current bug:

> fields expand, but do not intelligently contract after Backspace/Delete.

Replace grow-only behavior with deterministic **bidirectional autofit**.

The field's automatic geometry should be derived from CURRENT CONTENT, not from the largest geometry it ever had.

Conceptually:

```text
current text
→ measure
→ determine legal width
→ wrap if required
→ determine exact required height
→ constrain to margins
→ update layout rect
```

On added text:

- grow horizontally when legal,
- wrap when horizontal space runs out,
- grow vertically when wrapping requires it.

On removed text:

- shrink horizontally when possible,
- unwrap when possible,
- shrink vertically when line count falls.

Do not silently shrink font size.

Preserve a reasonable minimum interactive width/height, but do not use the original field width as a permanent lower bound unless explicitly user-resized/locked.

Distinguish:

- auto-sized dimension,
- user-resized dimension,
- minimum interaction size.

Add diagnostics:

- previous text length,
- new text length,
- previous width/height,
- desired width/height,
- actual width/height,
- previous line count,
- new line count,
- wrap/unwrapped,
- grew/shrank,
- constraint reason.

---

# 14. SOURCE OWNERSHIP VS LAYOUT OCCUPANCY

This distinction is mandatory.

For a replacement edit, model separately:

## sourceOwnershipRect

What ORIGINAL source content the edit is authorized to erase.

## layoutRect

Where the CURRENT replacement text occupies space.

These are not the same thing.

Rule:

> **Layout expansion grants space, not erasure authority.**

Growing or moving a replacement field must NOT automatically enlarge its source erase permission.

Add explicit invariants:

- `EDIT_MAY_ONLY_ERASE_OWNED_SOURCE`
- `LAYOUT_EXPANSION_DOES_NOT_EXPAND_SOURCE_OWNERSHIP`
- `MOVING_EDIT_DOES_NOT_CHANGE_SOURCE_OWNERSHIP`
- `UNRELATED_SOURCE_OBJECT_MUST_NOT_BE_ERASED`

This directly addresses the observed case where editing one field can erase earlier neighboring fields on the same line.

---

# 15. MASK OWNERSHIP

Every mask must expose:

- maskId,
- ownerEditId,
- sourceObjectIds,
- maskRole,
- pdfRect,
- createdBy,
- transient/persistent role.

For every source object covered by a mask, diagnostics must answer:

- why is it covered?
- which edit owns the mask?
- is this source object owned by that edit?
- is the coverage complete?
- is the coverage excessive?
- does it cover unrelated source content?

No mask may be anonymous.

---

# 16. TERMINAL GLYPH REMNANTS

Current bug:

> old source glyph fragments at the end of a line can still appear after editing.

This must be treated as a first-class invariant failure.

Do not solve it by increasing an arbitrary giant mask.

The system must determine:

- source run bounds,
- semantic line bounds,
- visible glyph ink if available,
- terminal ownership,
- exact source mask coverage,
- terminal overhang/antialiasing allowance,
- whether neighboring source objects would be covered.

Add diagnostics:

- `PDF_TERMINAL_GLYPH_REMNANT`
- `PDF_SOURCE_MASK_UNDERCOVERAGE`
- `PDF_SOURCE_MASK_OVERCOVERAGE`

Use bounded terminal bleed only where semantic ownership proves the edit owns the line edge.

Interior edits must stay bounded.

---

# 17. STALE GLYPH PERSISTENCE AND MOVE-REVEAL BUG

Observed runtime behavior must be reproduced and explained:

1. After some edits, stale terminal/original glyph remnants may remain visible.
2. A later unrelated interaction/rerender may make them disappear.
3. **Moving a field is different: the act of moving it reveals stale source/terminal glyphs.**
4. The move itself does not reliably clear those glyphs; they can remain until some later action causes another state refresh.

Treat this as a synchronization failure between:

- source canvas visibility,
- source masks,
- field masks,
- live edit masks,
- replacement geometry,
- pointermove geometry,
- post-pointerup rerender state.

Add a render/mask generation ID or equivalent traceable epoch so an agent can tell:

- which render generation produced the canvas,
- which generation produced each mask,
- which geometry generation produced the field,
- whether those generations disagree.

Add explicit issues:

- `PDF_STALE_SOURCE_VISIBLE_AFTER_EDIT`
- `PDF_MOVE_REVEALS_STALE_SOURCE`
- `PDF_MOVE_MASK_DESYNCHRONIZED`
- `PDF_LIVE_STATE_WAITING_FOR_FUTURE_RERENDER`
- `PDF_RERENDER_CHANGED_VISIBILITY_WITHOUT_SEMANTIC_CHANGE`

Critical invariant:

> **A later unrelated interaction must never be required to make the page visually correct.**

Another critical invariant:

> **Moving an edit must not temporarily or persistently resurrect source text that the edit already superseded.**

During sampled pointermove and after pointerup, record:

- edit layoutRect,
- sourceOwnershipRect,
- source object visibility,
- source mask geometry,
- field mask geometry,
- live mask geometry,
- canvas/render generation,
- mask generation,
- replacement generation,
- stale source intersections,
- whether a rerender later changed visibility without any semantic document change.

Fix the architecture so the live move state and the eventual rerender state agree continuously.

---

# 18. SOURCE BODY CONTENT MUST PARTICIPATE IN MARGIN POLICY

Current behavior constrains new/editable Substrate objects, but ordinary original PDF body text may remain outside margins.

That is insufficient.

Margins govern **current flow content**, not merely "new edits."

Classify semantic source content as:

- BODY_CONTENT,
- HEADER,
- FOOTER,
- PAGE_NUMBER,
- WATERMARK,
- BACKGROUND,
- PRINT_MARK,
- UNKNOWN_PAGE_FURNITURE.

Default reconstructed ordinary paragraph/text blocks to BODY_CONTENT unless positive evidence suggests page furniture.

BODY_CONTENT must obey `contentRect` regardless of provenance.

Provenance answers:

"where did this come from?"

It must not answer:

"which layout laws apply?"

Law:

> **Original versus authored is provenance, not permission to violate layout.**

---

# 19. TOP / BOTTOM / LEFT / RIGHT FULL CONTAINMENT

Containment means the COMPLETE object rectangle is inside the content bounds.

For a body object:

```text
object.left   >= content.left
object.right  <= content.right
object.bottom >= content.bottom
object.top    <= content.top
```

within a justified tolerance.

It is not sufficient for:

- origin point to be inside,
- baseline to be inside,
- most of glyph to be inside.

A partial glyph outside the boundary is a violation.

Add:

- `PDF_BODY_CONTENT_LEFT_OF_MARGIN`
- `PDF_BODY_CONTENT_RIGHT_OF_MARGIN`
- `PDF_BODY_CONTENT_ABOVE_TOP_MARGIN`
- `PDF_BODY_CONTENT_BELOW_BOTTOM_MARGIN`
- `PDF_PARTIAL_GLYPH_OUTSIDE_CONTENT_BOUNDS`
- `PDF_SOURCE_OBJECT_BYPASSED_MARGIN_POLICY`

---

# 20. SEMANTIC MARGIN RECONCILIATION

Create an analysis/reconciliation API conceptually like:

```js
reconcileSemanticPageToContentBounds({
  layout,
  contentRect,
  policy
})
```

It must inspect:

- source runs,
- source lines,
- source blocks,
- replacement objects,
- free text,
- images,
- content groups.

For original BODY_CONTENT outside margins:

Do NOT:

- merely clip it,
- show partial glyphs,
- independently nudge arbitrary glyphs,
- silently delete content.

Prefer the highest coherent semantic unit:

```text
Text Block
→ line
→ run only as last resort
```

If a whole block fits after translation:

- move the block inward,
- preserve member-relative geometry.

If translation creates downstream pressure:

- record explicit reflow/displacement requirement.

If content cannot fit:

- return structured overflow.

Page furniture may explicitly carry:

`allowOutsideContentBounds: true`

Do not grant this solely because content came from the source PDF.

---

# 21. CURRENT SEMANTIC DOCUMENT IS SAVE AUTHORITY

Current Save starts from original PDF bytes.

That is acceptable as an implementation technique only if current semantic/version state remains authoritative.

Law:

> **Save must serialize the current semantic document, not accidentally reveal whatever happened to remain in the original byte stream.**

Distinguish:

1. untouched current source,
2. current Substrate-authored content,
3. superseded/historical source,
4. hidden source,
5. replacement content.

For every object, diagnostics must know:

- version state,
- current visibility,
- source ownership,
- current rect,
- content bounds,
- whether it should appear in saved output,
- which mask removes it,
- whether its source bytes still contain it,
- expected reopen disposition.

---

# 22. SAVE-INTENT LEDGER

Before serialization, build a page save-intent ledger.

Conceptually:

```js
{
  objectId,
  kind,
  semanticRole,
  provenance,
  versionState,

  sourceRect,
  sourceOwnershipRect,
  currentRect,
  contentRect,

  liveVisible,
  outsideMarginEdges,

  shouldExistInSavedOutput,
  maskIds,

  disposition
}
```

Possible dispositions:

- KEEP,
- MASK,
- REDRAW,
- MOVE,
- REFLOW,
- ALLOW_PAGE_FURNITURE,
- OVERFLOW_ERROR,
- INTENTIONAL_OVERRIDE.

After save/reopen, compare expected vs actual.

Add invariants:

- `SUPERSEDED_SOURCE_MUST_NEVER_REAPPEAR`
- `HIDDEN_SOURCE_MUST_NOT_SURVIVE_SAVE`
- `MASKED_SOURCE_SAVE_VISIBILITY_MUST_MATCH_LIVE_VISIBILITY`
- `NO_PARTIAL_GLYPH_RESURRECTION`
- `NO_UNEXPLAINED_CONTENT_OUTSIDE_MARGINS`

---

# 22A. SAVED PDF MUST NOT CONTAIN VISIBLE OLD TEXT UNDER REPLACEMENTS

Current severe bug:

> After saving an edited PDF and reopening that saved file, the old original text can still be visibly present underneath the replacement text.

This has been discussed before and is NOT acceptable as a mere PDF extraction artifact.

Distinguish two different facts:

1. the original PDF byte/content stream may still contain historical text operators,
2. the current VISUAL document must not render that superseded text.

A saved PDF may preserve historical source internally only if it is guaranteed to remain non-visible and non-interactive according to the current-version model.

The saved/reopened visual result must be:

```text
CURRENT REPLACEMENT ONLY
```

never:

```text
OLD ORIGINAL TEXT
+ CURRENT REPLACEMENT ON TOP
```

Create explicit diagnostics for each replacement:

- original source object ID,
- original source rect,
- sourceOwnershipRect,
- source mask rect(s),
- mask paint order,
- replacement paint order,
- expected saved visibility of original,
- actual reopened visibility of original,
- whether original text is still extractable,
- whether extractable-but-hidden vs visibly rendered,
- whether a current-version manifest identifies it as superseded.

Add issue codes such as:

- `PDF_SAVED_OLD_TEXT_VISIBLE_UNDER_REPLACEMENT`
- `PDF_REOPEN_DOUBLE_TEXT`
- `PDF_SAVE_SOURCE_MASK_MISSING`
- `PDF_SAVE_SOURCE_MASK_INCOMPLETE`
- `PDF_SAVE_PAINT_ORDER_WRONG`
- `PDF_REOPEN_SUPERSEDED_SOURCE_RENDERED`

Important:

Do NOT declare success merely because the new text exists.

Do NOT declare success merely because the old source is marked historical in metadata.

Do NOT declare success merely because the old source can be found in text extraction.

The acceptance criterion is visual/current-document truth:

> **Superseded source text must not be visibly rendered beneath or beside its replacement after Save and reopen.**

If keeping original PDF operators in the stream makes this unreliable, implement the stronger serialization strategy required for edited regions.

Possible strategies may include:

- exact owned source masking before replacement draw,
- rebuilding the affected region from the current semantic model,
- flattening a current-version presentation layer for changed regions,
- or another standards-compatible deterministic method.

Choose based on correctness, not minimum code churn.

The serializer must make paint order explicit:

```text
original source
→ owned erase/mask
→ current replacement
```

and reopen must preserve that visual ordering.

Add an in-memory round-trip test:

1. load fixture PDF,
2. replace a source text object,
3. save,
4. reopen saved bytes,
5. render/inspect the affected region using available tooling,
6. verify old visible source is absent,
7. verify replacement is present exactly once,
8. verify current-version identity/reconciliation remains coherent.

If a full browser render is unavailable in CI, add the strongest deterministic structural test possible and clearly separate it from browser visual verification.

---

# 23. POINTER / HIT-TEST EXPLANATION

Extend current pointer hit-test diagnostics into an explicit explanation API.

Given a client point, diagnostics should answer:

- elementFromPoint,
- elementsFromPoint stack,
- all candidate PDF objects,
- each candidate's authoritative interaction rectangle,
- glyph distance,
- paint/z order,
- ownership,
- why the winner was chosen,
- why neighboring candidates lost.

Provide something conceptually like:

`explainPdfPoint(block, x, y)`

returning:

```js
{
  point,
  candidates,
  chosen,
  reason,
  issues
}
```

This must be useful to an agent without screenshots.

---

# 24. AGENT QUERY APIs

Expose pure/query-style helpers such as:

- `getPdfObjectDossier(scene, objectId)`
- `explainPdfPoint(scene, point)`
- `explainPdfMutation(journal, sequence)`
- `getPdfObjectRelationships(scene, objectId)`
- `getPdfObjectCollisions(scene, objectId)`
- `getPdfObjectMasks(scene, objectId)`
- `getPdfObjectConstraints(scene, objectId)`
- `tracePdfObject(journal, objectId)`
- `comparePdfObjectBeforeAfter(before, after)`

Names may differ.

The important requirement is that agents can ask precise questions instead of manually inspecting one giant JSON blob.

---

# 25. RELATIONSHIP GRAPH

The forensic scene should explicitly model named relationships.

Examples:

- parent-of,
- child-of,
- line-member-of,
- block-member-of,
- group-member-of,
- reads-before,
- reads-after,
- left-of,
- right-of,
- above,
- below,
- aligned-with,
- overlaps,
- collides-with,
- masked-by,
- masks,
- owned-by,
- source-for,
- replacement-for,
- constrained-by-margin,
- wrapped-around,
- obstacle-for,
- moved-because-of,
- derived-from.

Do not infer impossible certainty.

Use confidence/provenance when relationships are reconstructed.

---

# 26. COLLISION MODEL

No accidental overlap should be opaque.

For every collision expose:

- leftObjectId,
- rightObjectId,
- intersectionRect,
- overlapArea,
- classification,
- semantic relationship,
- ownership relationship.

Possible classifications:

- owned-overlap,
- intentional-overlay,
- image-wrap-interaction,
- destructive-unrelated-overlap,
- uncertain-overlap,
- layout-warning.

An agent must be able to understand whether overlap was intentional or a bug.

---

# 27. MARGIN / CONSTRAINT TRACE

For every movable/editable object record:

- contentRect,
- objectRect,
- violatedEdges,
- requestedDelta,
- actualDelta,
- constraintResult.

If movement is clamped, diagnostics must explain which edge caused it.

Example:

```text
requested dx = +42
actual dx = +17
reason = right-margin
remaining legal distance = 17pt
```

For group movement report both:

- group envelope,
- preserved member-local rectangles.

---

# 28. TEXT AUTOFIT TRACE

On every content change, DEEP mode should record:

- previous text,
- current text,
- previous text length,
- current text length,
- previous measured width,
- current measured width,
- previous line count,
- current line count,
- previous layoutRect,
- desired layoutRect,
- actual constrained layoutRect,
- font size,
- line height,
- available measure,
- margin/content limit,
- whether it grew horizontally,
- shrank horizontally,
- wrapped,
- unwrapped,
- grew vertically,
- shrank vertically,
- was margin-constrained.

No more "the box got larger somehow."

---

# 29. MASK / ERASURE TRACE

For every edit begin/input/commit/move/render record:

- sourceOwnershipRect,
- generated source masks,
- field masks,
- live edit mask,
- terminal bleed,
- contributing edit IDs,
- source object IDs,
- render generation,
- mask generation.

Add a diagnostic test proving:

> editing or moving object A does not cause a mask to erase unrelated object B.

unless a named, explicit rule says so.

---

# 30. DROP TRACE

When an image or future object is dropped into a PDF, record:

- incoming object identity,
- source medium/type,
- drop client point,
- converted viewport point,
- converted PDF point,
- requested rect,
- legal/constrained rect,
- margin interaction,
- collisions,
- affected text blocks,
- wrap/reflow decision,
- final rect,
- serialized rect.

Eventually the same event contract should be reusable by DOCX/WEBX/other Substrate media.

Do not make the core event schema unnecessarily PDF-specific.

---

# 31. SAVE / REOPEN TRACE

For edited objects compare:

- live canonical PDF rect,
- serialized PDF rect,
- reopened PDF rect.

Classify:

- exact,
- within-tolerance,
- geometry-drift,
- identity-drift,
- missing-object,
- historical-object-resurrected.

For every current editable object an agent should be able to ask:

> "Will what I see now be what gets saved?"

and receive machine-readable evidence.

---

# 32. PAGE FORENSIC SNAPSHOT

Create a single page forensic snapshot containing:

- schemaVersion,
- diagnosticMode,
- page,
- pageBoxes,
- viewport,
- coordinate-space registry,
- transform chains,
- render/mask/replacement generation IDs,
- margins,
- contentRect,
- objects,
- contentGroups,
- relationships,
- masks,
- collisions,
- hoveredObjectId,
- selectedObjectId,
- editingObjectId,
- pointer dossier,
- interaction trace,
- mutation trace,
- save-intent ledger,
- layout issues,
- ownership issues,
- geometry issues,
- invariants.

This should be deterministic enough for tests and agent comparison.

---

# 33. HUMAN-READABLE SUMMARY

In addition to raw JSON, provide a compact formatter/summary helper.

Example:

```text
PAGE 1

Objects:
42 source runs
7 lines
3 text blocks
2 replacements
1 image

Selected:
edit:123

Editing:
edit:123

Margins:
36 / 36 / 36 / 36 pt

Issues:
1 destructive overlap
1 source mask ownership violation
1 stale source revealed during move

Recent cause chain:
pointerdown
→ move
→ source-mask desync
→ stale glyph visible
```

Do not build a giant mandatory debug panel.

Structured data is primary.

---

# 34. PERFORMANCE LAW

OFF:

- near-zero overhead,
- no continuous scene capture,
- no glyph measurement scans,
- no event journal growth.

DEBUG:

- bounded event/mutation logging,
- cheap geometry and identity records,
- active page only.

DEEP:

- active page forensic capture,
- glyph ink,
- visual ancestry,
- full candidate hit tests,
- relationship/collision evidence.

Never let diagnostics become the reason a 500-page PDF is slow.

Document knowledge may be large.

Active rendering and active diagnostics must stay bounded.

---

# 35. TESTS — IDENTITY / GEOMETRY

Add tests for:

- stable object identity,
- coordinate-space naming,
- finite geometry validation,
- transform round-trip,
- first projection divergence,
- sourceOwnershipRect vs layoutRect distinction,
- group union bounds,
- member-local geometry,
- margins/contentRect in PDF points.

---

# 36. TESTS — LIVE INPUT

Add tests for:

- type character -> visible immediately before commit,
- Backspace -> visible immediately,
- Delete -> visible immediately,
- field grows when needed,
- field shrinks after content removal,
- wrapped field unwraps when content becomes short enough,
- font size remains unchanged,
- margin clamp is explicit.

---

# 37. TESTS — MASK OWNERSHIP

Add tests for:

- replacement source mask owns only its source object,
- growing layoutRect does not enlarge sourceOwnershipRect,
- moving layoutRect does not enlarge sourceOwnershipRect,
- unrelated neighboring source run is never covered,
- terminal bleed applies only at owned terminal edge,
- interior edit cannot erase previous/next source run.

---

# 38. TESTS — STALE GLYPH LIFECYCLE

Reproduce the reported behavior.

Test sequence conceptually:

```text
edit terminal field
commit
inspect source visibility

perform unrelated interaction
inspect again
```

The visibility must NOT change merely because an unrelated interaction occurred.

Then:

```text
move field
sample pointermove state
pointerup
inspect immediately
perform unrelated action
inspect again
```

Moving must NOT reveal stale source glyphs.

Post-move immediate state and later state must agree.

Add explicit assertion that no "future action" is required to clean visual state.

---

# 39. TESTS — MARGINS ON SOURCE CONTENT

Using semantic source blocks:

- source body content above top margin -> violation,
- below bottom -> violation,
- left -> violation,
- right -> violation,
- partial glyph crossing edge -> violation,
- page furniture with explicit override -> allowed,
- authored current object -> constrained,
- ordinary source BODY_CONTENT -> subject to same contentRect law.

---

# 40. TESTS — SAVE / REOPEN

Test:

- hidden/superseded source does not resurrect,
- no terminal glyph remnants after save,
- no partial glyph outside margin after reopen,
- live current authored geometry matches saved geometry,
- save-intent ledger predicts reopened state.

---

# 41. REAL PDF FIXTURE TEST

If `/pdf/*.pdf` exists:

Use the first fixture to:

1. parse page 1,
2. construct source runs,
3. reconstruct lines/blocks,
4. assign stable IDs,
5. record dimensions/coordinates in PDF points,
6. derive reading/spatial/paint order,
7. derive content groups,
8. derive margin/content-bound violations,
9. classify collisions,
10. produce a deterministic forensic snapshot,
11. create a compact agent summary.

If possible in the available environment, also exercise a replacement/move/save/reopen sequence against a copy in memory.

Never mutate the repository fixture.

---

# 42. ACCEPTANCE — HOVER

For one visible source word:

hover it.

Diagnostics must show:

- objectId,
- source object,
- source PDF rect,
- expected viewport projection,
- actual visible/glyph evidence,
- interactive rect,
- pointer coordinates,
- candidate list,
- selected winner,
- winner reason.

There should be no unexplained offset.

---

# 43. ACCEPTANCE — LIVE EDIT

Double-click one source field.

Type characters.

Before Enter:

- new characters are visible,
- forensic state says editing=true,
- live text equals DOM text,
- live geometry reflects current content,
- source ownership is unchanged.

Backspace several characters.

Before Enter:

- characters disappear visibly,
- field shrinks/unwraps when appropriate,
- no neighboring source text disappears.

Commit.

Live and committed state must agree.

---

# 44. ACCEPTANCE — MOVE

Select a replacement field.

Move it.

During movement:

- no superseded source glyphs appear,
- source masks remain synchronized,
- layoutRect moves,
- sourceOwnershipRect does not move,
- generation IDs remain coherent,
- margin constraints explain any clamp.

Immediately after pointerup:

- state is visually correct.

Perform another unrelated action.

The page must not suddenly "fix itself" because it was already correct.

---

# 45. ACCEPTANCE — MARGINS

Use original source BODY_CONTENT that lies above the top margin.

Diagnostics must report the violation.

Current semantic reconciliation must either:

- place the coherent block inside contentRect,
- or explicitly report overflow/reflow requirement.

It must not simply allow original text to bypass margin rules.

Repeat for:

- top,
- bottom,
- left,
- right.

No partial glyphs.

---

# 46. ACCEPTANCE — SAVE

Create/edit/move a field whose source text previously produced terminal remnants.

Save.

Reopen.

There must be:

- no stale source resurrection,
- **no old original text visibly underneath replacement text**, 
- replacement text appears exactly once visually,
- no terminal glyph remnants,
- no partial glyphs outside margins,
- no difference between live intended visibility and reopened visibility.

The forensic ledger should explain every kept/masked/redrawn object.

---

# 47. ARCHITECTURAL LAWS

## Law 1
Every meaningful object has a stable identity.

## Law 2
Every meaningful visual object has measurable geometry.

## Law 3
Every geometry value names its coordinate space.

## Law 4
Every projection has a mathematical ancestry.

## Law 5
Every meaningful mutation has a causal ancestry.

## Law 6
Every mask has an owner.

## Law 7
Layout occupancy and source-erasure ownership are separate concepts.

## Law 8
Every collision can be classified.

## Law 9
Every selection/hit-test decision can be explained.

## Law 10
Every group exposes union bounds and member-local geometry.

## Law 11
Transient state is observable state.

## Law 12
A later unrelated action must never be required to make current visuals correct.

## Law 13
Moving an edit must not resurrect superseded source text.

## Law 14
Original vs authored is provenance, not a difference in layout law.

## Law 15
BODY_CONTENT obeys contentRect regardless of provenance.

## Law 16
No partial glyph outside a legal content boundary counts as success.

## Law 17
Save serializes current semantic truth, not accidental leftovers from source bytes.

## Law 18
Debug information is optimized for machine consumption first.

## Law 19
OFF mode remains cheap enough for ordinary users.

## Law 20
Diagnostics never mutate the document merely by observing it.

## Law 21
The active page may be deeply understood without eagerly rendering the whole document.

## Law 22
No meaningful PDF state transition should be unexplained.

---

# 48. FINAL DELIVERABLE

At the end of this run, Codex / ChatGPT / future agents should be able to inspect one forensic page snapshot and answer questions such as:

- Why did this field grow?
- Why did it fail to shrink?
- Why was typed text invisible before Enter?
- Which mask erased that word?
- Which source object does this replacement own?
- Why did moving this field reveal old glyphs?
- Why did those glyphs disappear only after another interaction?
- What render/mask generation was stale?
- What exact PDF rectangle is being edited?
- What exact glyph rectangle is visible?
- Why did clicking here choose object A instead of B?
- Why did this drag stop at x=542?
- What objects collide with this image?
- What block does this line belong to?
- Which original source blocks violate the top margin?
- Why is old source text allowed or not allowed outside content bounds?
- What moved after this drop?
- Does the saved geometry match live geometry?
- Can a superseded source glyph reappear on reopen?
- Why is old original text visible underneath this saved replacement?
- Did Save mask/rebuild the owned source region before drawing the replacement?

without guessing from screenshots.

Do not optimize for a small patch.

Build the observability foundation that makes future PDF layout work **mechanically explainable and scientifically diagnosable by humans and agents**.
