Read and execute:

agents/codex/prompts/NEXT_RUN_PDF_SEMANTIC_ROLE_SOURCE_HIERARCHY_AND_PAGE_IDENTITY_V24.md

PR #81 is already merged into main as:

913534cf5c063c3883b058f052a86d990893dd7b

This is a focused integration/correctness run.

Do NOT redesign the V23 runtime-truth architecture.
Do NOT remove hydration, canonical commit, immutable source ownership, stable object identity, or current/historical quarantine.

Primary goals:

1. Fix source-margin reconciliation to use the REAL semantic hierarchy emitted by createPdfPageLayout():

   source-text-run.parentId -> text-line.id
   text-line.parentId       -> text-block.id

   Prefer coherent block movement, then line, then run only as last resort.

2. Add a real production-model regression:
   createPdfPageLayout()
   -> actual source runs/lines/blocks
   -> buildPdfSourceMarginReconciliation()

   Synthetic nodes with fake ownerId fields are not enough.

3. Put semantic page roles into the actual imported-source pipeline.

   Real source content must carry meaningful:
   - BODY_CONTENT
   - HEADER
   - FOOTER
   - PAGE_NUMBER
   - WATERMARK
   - BACKGROUND
   - PRINT_MARK
   - UNKNOWN_PAGE_FURNITURE

   Include role confidence/evidence where appropriate.

4. Keep role inference conservative and explainable.

   BODY_CONTENT obeys contentRect.
   Explicit page furniture may remain outside it.
   Original/imported provenance alone is NOT a margin exemption.

5. Fix structural page operations so the embedded CURRENT manifest follows the real page permutation.

   Required cases:
   - add page
   - delete page
   - move page
   - rotate page
   - duplicate page

6. Add one canonical pure manifest/page remapping helper.

   Do not bury page-remapping rules in UI handlers.

7. The RESULTING PDF BYTES must contain the corrected manifest.

   Do not rely on an in-memory patch after reopen.

8. Required structural regressions:

   A.
   edit page 2
   -> delete page 1
   -> reopen

   The edited object must now be current on page 1.

   B.
   edit page 1
   -> move page 1 to page 3
   -> reopen

   The same stable object ID must now be current on page 3.

   C.
   insert a page and verify later current objects shift correctly.

   D.
   delete the page containing a current object and verify it is no longer current.

   E.
   duplicate an edited page and enforce a deterministic clone-identity policy.
   Never create two live objects with the same stable ID.

9. Audit sourceObjectId/sourceLineId/page semantics after page moves.

   Current location and immutable origin provenance must not silently contradict each other.

10. Preserve all V23 laws:

   - single click edits
   - double click manipulates
   - canonical commit before Save/page change/structural operation
   - sourceOwnershipRect is immutable
   - layoutRect may move/resize/autofit
   - stable object ID first, page/index fallback
   - reopened current object is immediately editable/manipulable
   - historical/deleted objects are never current
   - OFF mode remains cheap

11. Strengthen diagnostics with:
   - semanticRole
   - roleConfidence
   - roleEvidence
   - parent line/block IDs
   - reconciliation semantic unit
   - pageBefore/pageAfter for structural changes
   - manifest remap status
   - clone provenance for duplicate-page objects

12. Run:

   node --check src/documents/pdf-layout.js
   node --check src/documents/pdf-document.js
   node --check src/documents/pdf-runtime-truth.js
   node --check src/documents/pdf-observability.js
   node --check src/documents/pdf-forensics.js
   node --check src/workspace.js

   node --test tests/pdf-runtime-truth.test.mjs
   node --test tests/pdf-*.test.mjs
   node --test tests/*.test.mjs

Do not claim browser visual verification unless a real browser was used.

The purpose of this run is to close the two post-merge seams:

REAL semantic role/hierarchy integration
+
STRUCTURAL page identity/manifest correctness.

Do not stop because synthetic helper tests are green.
Prove both against the actual canonical page model and save/reopen behavior.
