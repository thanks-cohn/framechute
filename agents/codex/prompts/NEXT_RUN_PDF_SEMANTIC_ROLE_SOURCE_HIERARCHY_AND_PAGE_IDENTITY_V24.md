# NEXT RUN — PDF SEMANTIC ROLE, SOURCE HIERARCHY + STRUCTURAL PAGE IDENTITY COMPLETION V24

## Mission

PR #81 is now merged into main as commit `913534cf5c063c3883b058f052a86d990893dd7b`.

V23 materially improved PDF runtime truth:
- reopened current replacements hydrate into runtime edits
- current/historical state is more explicit
- text commit has one canonical path
- first-edit source ownership is captured before autofit
- live source masks follow immutable source ownership
- layoutRect and sourceOwnershipRect are distinct
- double-click can commit and promote a replacement into manipulation
- runtime truth survives ordinary load paths
- source-margin reconstruction exists
- round-trip tests now distinguish layout geometry from source ownership

This run is a focused correctness pass on two remaining integration seams discovered after review:

1. the source-margin reconciler is not using the real semantic hierarchy emitted by `createPdfPageLayout()`
2. structural page operations can preserve stale current-manifest page numbers after pages are inserted/deleted/moved/duplicated

The goal is:

> Real imported PDF source must carry real semantic roles and real block/line ancestry, and current object identity must follow the page it actually belongs to through structural operations.

Do not redesign V23.
Do not remove runtime truth.
Do not revert to page/index-only identity.
Build directly on the merged architecture.

---

## 1. Start from latest main

Inspect at minimum:

- `src/documents/pdf-layout.js`
- `src/documents/pdf-document.js`
- `src/documents/pdf-runtime-truth.js`
- `src/documents/pdf-observability.js`
- `src/documents/pdf-forensics.js`
- `src/workspace.js`
- `tests/pdf-runtime-truth.test.mjs`
- relevant PDF layout/page-operation tests

Understand the actual hierarchy produced by `createPdfPageLayout()` before changing the reconciler.

The current real hierarchy is conceptually:

```
source-text-run.parentId -> text-line.id
text-line.parentId       -> text-block.id
text-block.parentId      -> page-region.id
```

Do not write tests against an invented hierarchy that production does not emit.

---

## 2. Fix source-margin grouping to use the real hierarchy

The current source-margin code derives line membership from fields that synthetic tests supplied, but the real page layout uses parent links.

Fix `buildPdfSourceMarginReconciliation()` so it resolves semantic membership from the canonical page model.

Required preference:

```
block
  -> line
      -> run
```

For each source run:

- resolve its real line through `parentId`
- resolve that line's real block through `parentId`
- use block identity as the coherent movement group when available
- fall back to line only if block information is genuinely unavailable
- fall back to run only as a last resort

Do not infer grouping from test-only fields.

Acceptance:

A real `createPdfPageLayout()` result with a multi-run, multi-line text block crosses a margin.

The reconciliation must:
- identify the complete block
- apply one coherent translation to the block's member runs
- preserve member-local geometry
- never independently shove random glyph runs unless no larger semantic unit exists

---

## 3. Add a production-model integration test

The existing synthetic margin test is not sufficient.

Add at least one test that:

1. constructs a real page layout through `createPdfPageLayout()`
2. uses real `sourceRuns`
3. inspects the emitted run -> line -> block hierarchy
4. passes that real layout to `buildPdfSourceMarginReconciliation()`
5. verifies block/line grouping and translated edits

The test must fail if the implementation incorrectly expects:
- `run.ownerId` when production uses `run.parentId`
- manually injected semantic roles that production never emits
- synthetic node shapes unavailable in the real engine

This is a required regression.

---

## 4. Semantic page roles must exist in the real source pipeline

The current margin policy distinguishes roles such as:

- BODY_CONTENT
- HEADER
- FOOTER
- PAGE_NUMBER
- WATERMARK
- BACKGROUND
- PRINT_MARK
- UNKNOWN_PAGE_FURNITURE

But the real imported source model must actually populate those roles.

Do not merely maintain a constant list while every real source run defaults to BODY_CONTENT.

Introduce a deterministic role classification stage for source content.

A reasonable architecture is one of:

```
PDF extraction
  -> source role classifier
  -> semanticSourceRun
  -> createPdfPageLayout
```

or:

```
createPdfPageLayout
  -> semantic page-role classification
  -> margin reconciliation
```

The exact location is up to you, but the resulting canonical source node must expose:

```
semanticRole
roleConfidence
roleEvidence
allowOutsideContentBounds
```

where appropriate.

---

## 5. Role classification must be conservative and explainable

Do not blindly declare all content near the page edge a header/footer.

Use deterministic evidence.

Potential evidence includes:

- geometric band near top/bottom page edge
- repeated text/signature across neighboring or sampled pages
- isolated numeric/Roman page-number pattern
- repeated running title
- font-size/style relationship to nearby body content
- position consistency
- low overlap with the primary body flow
- explicit imported metadata if available

Classification should be conservative.

If evidence is weak, prefer an explainable uncertain state rather than silently fabricating certainty.

A useful result shape may be:

```js
{
  semanticRole: "FOOTER",
  roleConfidence: 0.91,
  roleEvidence: [
    "bottom-page-band",
    "repeated-position",
    "repeated-text"
  ],
  allowOutsideContentBounds: true
}
```

Do not require an expensive all-page scan on every render.

Cache/lazily derive repeated-page evidence where appropriate.

Large-PDF behavior must remain bounded.

---

## 6. BODY_CONTENT vs page furniture law

The law remains:

> Original provenance is not an exemption from layout law.

BODY_CONTENT must obey the active contentRect.

Explicitly classified page furniture may remain outside it.

Therefore:

```
BODY_CONTENT
-> margin constrained

HEADER
FOOTER
PAGE_NUMBER
WATERMARK
BACKGROUND
PRINT_MARK
UNKNOWN_PAGE_FURNITURE with explicit exemption
-> may remain outside contentRect
```

Do not use:
- source/imported provenance
- paint order alone
- top/bottom position alone

as sufficient exemption.

---

## 7. Preserve role metadata through semantic objects

Role information must survive enough of the pipeline to be useful to:

- source-margin reconciliation
- diagnostics
- agents
- save intent
- future WEBX conversion

Where appropriate, preserve role metadata on:

- source run
- line
- block
- reconstructed current replacement
- margin-generated replacement

A source-margin reconstruction should retain the semantic role that justified the operation.

Do not reduce every generated edit to a role-less replacement.

---

## 8. Add role diagnostics

Copy PDF Diagnostics should expose enough to answer:

> Why was this text moved inside the margins?

and:

> Why was this footer allowed outside the contentRect?

Include, where available:

- semanticRole
- roleConfidence
- roleEvidence
- parent line ID
- parent block ID
- allowOutsideContentBounds
- reconciliation group ID
- semantic unit used: block / line / run
- before rect
- actual delta
- disposition

This should be machine-readable.

---

## 9. Structural page operations must remap current manifest identity

V23 correctly commits active text before structural operations, serializes current truth, transforms the PDF, reopens it, and recreates runtime truth.

But the current-version manifest embedded in the PDF must follow the page transformation too.

Do not allow:

```
edit object on page 2
delete page 1
-> physical content now page 1
-> manifest still says page 2
```

or:

```
edit object on page 1
move page 1 to page 3
-> physical content page 3
-> manifest still says page 1
```

The current semantic manifest must be transformed with the page operation.

---

## 10. Create one canonical page-remapping function

Add a pure, well-tested helper such as:

```
remapPdfCurrentManifestForPageOperation(...)
```

or an equivalent design.

It should accept:
- current manifest
- page count before operation
- structural operation

and return the remapped current manifest.

Keep this logic separate from DOM/UI event handling.

The page-operation engine and tests should share it.

---

## 11. Required page-operation semantics

Define and test current-object mapping for at least:

### Add page after N

Old pages:
- <= N remain unchanged
- > N shift +1

The newly inserted page has no inherited current objects unless explicitly created.

### Delete page N

- current objects on deleted page are removed from current manifest
- pages > N shift -1
- pages < N remain unchanged

Deleted-page objects may be represented in future version history, but must not remain current.

### Move page N -> T

Apply the same page permutation to every current object.

Object identity remains stable.

Only page membership changes.

### Rotate page N

Page number remains unchanged.

Audit geometry behavior and prove the current object stays aligned after reopen.

Do not remap page identity unnecessarily.

### Duplicate page N

The duplicated page must not create two live objects with the same stable identity.

Choose and document a deterministic policy.

Preferred:
- original page keeps original object IDs
- duplicate receives cloned current objects with new stable IDs
- cloned source identity/provenance is explicit
- no collision between the original and duplicate
- duplicate remains immediately editable after reopen

If full semantic duplication is not implemented in this run, do not silently claim duplicate-page current truth is complete. Implement a correct explicit policy and tests.

---

## 12. Structural transforms outside transformPdfPages()

Audit other byte-replacement paths, including where applicable:

- extract pages
- merge PDFs
- crop
- compression
- any `replacePdfRuntime()` caller
- future structural helpers already in workspace.js

For each operation determine whether it:
- changes page numbering
- changes page membership
- changes coordinate interpretation
- preserves manifest as-is

Do not apply page remapping where none is needed.

But do not let a numbering-changing operation retain stale page metadata.

---

## 13. Update manifest inside the resulting PDF bytes

Do not only remap runtime edits after reopening.

The saved transformed PDF itself should contain a correct current manifest.

Required chain:

```
current runtime truth
-> commit active edit
-> serialize current PDF
-> structural transform
-> transform/remap current manifest
-> resulting bytes
-> reopen
-> hydrate current truth
```

If the file is closed and reopened later, it must still know the correct page for every current object.

This must not depend on an unsaved in-memory correction.

---

## 14. Preserve stable IDs across page moves

For a move operation:

```
object.id before == object.id after
```

unless the object is explicitly cloned.

Changing page number does not mean changing object identity.

Preserve:
- object ID
- source ownership geometry
- layout geometry
- text
- font
- current version state

Update:
- page membership
- page-derived source references if required by the canonical identity model

Do not manufacture unrelated objects simply because a page moved.

---

## 15. Source identities must not lie after structural changes

Audit fields such as:

- sourceObjectId
- sourceLineId
- page
- index
- derived source references

If a source identity textually encodes a page number, moving/duplicating/extracting pages may make that identifier misleading.

Do not silently leave impossible provenance such as:

```
page: 1
sourceObjectId: source:p2:text:17
```

unless the system intentionally treats sourceObjectId as immutable origin provenance and clearly distinguishes it from current page membership.

Choose one explicit model:

### Option A — immutable origin provenance

`sourceObjectId` continues to identify where the object originated.

Then current page membership must be separate and diagnostics must make this clear.

### Option B — remapped current source identity

Remap source IDs with the page.

Then preserve an additional immutable origin/provenance ID.

Either approach is acceptable if internally consistent and tested.

Do not conflate origin identity with current location.

---

## 16. Required real structural regressions

Use a real PDF fixture where practical.

At minimum add:

### Regression A

```
edit source text on page 2
-> save current truth
-> delete page 1
-> reopen resulting bytes
```

Verify:
- edited object is current on page 1
- replacement appears exactly once
- old page=2 metadata is not current
- stable object identity survives
- immediate manipulation capability survives

If the first fixture has fewer than two pages, create a deterministic test PDF in memory or duplicate a page for the test. Do not mutate repository fixtures.

### Regression B

```
edit source text on page 1
-> move page 1 to page 3
-> reopen
```

Verify:
- object page == 3
- stable object ID survives
- current search finds replacement on page 3
- no current duplicate remains on page 1

### Regression C

Add page before/within a document and verify pages after insertion shift correctly.

### Regression D

Delete the page containing a current edit and verify the edit is no longer current.

### Regression E

Duplicate an edited page and verify the chosen duplicate-identity policy.

---

## 17. Real role-classification regression

Use actual production node creation rather than hand-authored semantic nodes.

At minimum test:

- ordinary body line crossing left margin -> BODY_CONTENT -> moved
- ordinary body line crossing right margin -> BODY_CONTENT -> moved
- coherent multi-run line -> translated together
- coherent multi-line block -> translated together
- page number near bottom edge -> PAGE_NUMBER -> exempt
- repeated running footer/header evidence -> appropriate role -> exempt
- ambiguous edge content -> deterministic conservative classification

Do not make the test pass by manually setting the exact field the implementation reads unless the test is specifically testing explicit metadata import.

---

## 18. Keep first-edit ownership law

Do not regress the V23 ownership fix.

Always preserve:

```
sourceOwnershipRect != layoutRect
```

when they genuinely differ.

Autofit:
- changes layoutRect
- does not change source ownership

Move:
- changes layoutRect
- does not move source ownership

Resize:
- changes layoutRect
- does not expand source erase authority

Structural page remapping:
- changes page membership as needed
- does not accidentally rewrite source ownership geometry

---

## 19. Keep current/historical quarantine

Do not fix page operations by making multiple versions current.

For each current source identity:
- at most one current object unless an explicit duplicate-page clone was intentionally created
- superseded source remains historical/non-live
- deleted-page objects are not current
- moved objects are current only on the new page

Search, hit testing, layout, and collision must use current truth.

---

## 20. Keep canonical commit behavior

Before any structural mutation:

- commit active live text
- clear editing state
- serialize current visible truth

Do not lose DOM-only text because the user clicked:
- delete page
- move page
- duplicate page
- rotate
- extract
- merge
- crop
- compress

If an operation replaces the runtime/model, initialize it through the same runtime-truth factory.

Do not reintroduce an ad-hoc runtime with `edits: []`.

---

## 21. Keep selection by stable object ID

Preserve the V23 direction:

```
objectId first
page/index fallback
```

Page remapping makes this even more important.

Do not make page/index the canonical identity again.

---

## 22. Performance

Do not regress large-PDF behavior.

Requirements:

- no full-document semantic rebuild on every pointer event
- no full-document role scan on every page render
- no all-page history traversal in OFF mode
- cache bounded role evidence
- page-operation manifest remapping should be O(number of current manifest objects), not O(all rendered glyphs)

Role inference may use bounded neighboring/sampled pages.

If a deeper all-pages analysis is useful, make it explicit/lazy rather than hot-path behavior.

---

## 23. Diagnostics for structural remap

Record enough information to explain page identity changes.

For a structural operation, diagnostics/journal should be able to expose:

```
operation: delete-page
objectId: edit:abc
pageBefore: 2
pageAfter: 1
identityPreserved: true
manifestUpdated: true
```

For a deleted current object:

```
operation: delete-page
objectId: edit:abc
pageBefore: 2
pageAfter: null
currentDisposition: removed
```

For duplicate-page clones:
- source object ID
- cloned object ID
- origin page
- duplicate page
- clone provenance

This is valuable for the future agent API.

---

## 24. Suggested new issue codes

Use existing conventions where appropriate.

Potential additions:

- PDF_SOURCE_HIERARCHY_MISSING_LINE
- PDF_SOURCE_HIERARCHY_MISSING_BLOCK
- PDF_SOURCE_ROLE_UNCLASSIFIED
- PDF_PAGE_FURNITURE_ROLE_LOW_CONFIDENCE
- PDF_CURRENT_MANIFEST_PAGE_STALE
- PDF_CURRENT_OBJECT_PAGE_MISMATCH
- PDF_DUPLICATE_PAGE_IDENTITY_COLLISION
- PDF_STRUCTURAL_REOPEN_DUPLICATE_CURRENT
- PDF_STRUCTURAL_REOPEN_MISSING_CURRENT

Names may differ if the existing issue taxonomy suggests better ones.

Do not add codes without wiring them to useful diagnostics/tests.

---

## 25. Required testing

Run syntax checks for every modified JS module.

At minimum:

```
node --check src/documents/pdf-layout.js
node --check src/documents/pdf-document.js
node --check src/documents/pdf-runtime-truth.js
node --check src/documents/pdf-observability.js
node --check src/documents/pdf-forensics.js
node --check src/workspace.js
```

Run focused tests:

```
node --test tests/pdf-runtime-truth.test.mjs
```

Run any new role/page-operation test files directly.

Run broader PDF tests:

```
node --test tests/pdf-*.test.mjs
```

Run full Node suite:

```
node --test tests/*.test.mjs
```

If a browser is not actually used, do not claim browser visual verification.

---

## 26. Acceptance scenario A — real hierarchy

```
real createPdfPageLayout()
-> source run
-> parent line
-> parent block
-> block crosses contentRect
```

Expected:
- reconciliation identifies the real block
- every member gets one coherent delta
- no run-by-run accidental shoving
- diagnostics state semanticUnit=block

---

## 27. Acceptance scenario B — real page furniture

```
import ordinary multipage PDF
-> running footer/page number near bottom
-> margin constraints enabled
```

Expected:
- footer/page number carries a real semantic role
- role evidence/confidence is inspectable
- body remains constrained
- footer/page number is not incorrectly dragged into body contentRect

---

## 28. Acceptance scenario C — delete before edited page

```
edit page 2
-> delete page 1
-> save/reopen
```

Expected:
- physical page is now page 1
- manifest current object says page 1
- stable object ID survives
- replacement appears exactly once
- immediate edit/manipulation works

---

## 29. Acceptance scenario D — move edited page

```
edit page 1
-> move page 1 to page 3
-> save/reopen
```

Expected:
- object follows page to page 3
- original object ID survives
- no current duplicate on page 1
- source provenance/current location are internally consistent

---

## 30. Acceptance scenario E — duplicate edited page

```
edit page N
-> duplicate page N
-> reopen
```

Expected:
- original page retains original current identity
- duplicate page follows the documented clone policy
- no two live objects share one stable ID
- both pages remain semantically explainable

---

## Architectural laws

1. Production tests must use production object shapes.
2. Real hierarchy is run.parentId -> line.parentId -> block.
3. Coherent block movement is preferred over line movement; line over run.
4. Page furniture roles must exist in the real semantic model, not only in tests.
5. Role inference is conservative and explainable.
6. BODY_CONTENT obeys contentRect regardless of origin.
7. Page furniture exemption is explicit.
8. Stable object ID is not the same thing as page number.
9. Structural page operations transform current manifest page membership.
10. Moving a page preserves object identity.
11. Deleting a page removes its objects from current truth.
12. Duplicating a page never duplicates stable IDs accidentally.
13. Origin provenance and current location must not be conflated.
14. Structural operations commit active live text first.
15. Structural reopen always recreates canonical runtime truth.
16. Source ownership remains immutable through layout and page remapping.
17. Historical/deleted objects never remain current by accident.
18. OFF mode remains cheap.
19. Diagnostics explain role and page-remap decisions.
20. Save/reopen must prove the resulting file is correct without relying on in-memory repair.

---

## Final deliverable

After this run:

```
IMPORT PDF
-> source runs have real ancestry and role evidence

MARGINS
-> BODY_CONTENT moves coherently by block/line
-> explicit page furniture stays where it belongs

EDIT
-> current object retains stable identity and immutable source ownership

STRUCTURAL PAGE OPERATION
-> current manifest follows the actual page permutation

SAVE / REOPEN
-> object appears exactly once on the correct page
-> no stale page metadata
-> no duplicate current identity
-> immediate edit/manipulation still works
```

Do not stop because synthetic tests pass.

Use the actual canonical page model and prove structural identity through a real save/reopen path.
