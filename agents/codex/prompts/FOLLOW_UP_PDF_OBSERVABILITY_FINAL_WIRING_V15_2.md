# FOLLOW-UP — PDF OBSERVABILITY FINAL WIRING V15.2

Continue from PR #67 and the V15.1 hardening work. This is a final wiring/integration pass, not a redesign.

The current hardening direction is good, but do NOT merge until the observability and current-version logic is actually used by the running Substrate PDF editor rather than existing only as helpers/tests.

## P0 — Update PR #67 itself

Work on the existing PR #67 branch:

`codex/enhance-pdf-layout-observability-and-diagnostics`

Do not leave the hardened implementation as an unpushed/local diff or disconnected branch. Preserve the useful original PR #67 UI and diagnostics work unless deliberately replaced by an equivalent or better implementation.

At completion, PR #67 must visibly contain the hardening changes and its checks must run against the new head.

## P0 — Preserve/wire Copy Page Diagnostics

The original PR added a user-facing **Copy Page Diagnostics** action and runtime page data needed to build snapshots.

Do not accidentally regress that while introducing `pdf-observability.js`.

Ensure:

- the button remains available in the PDF More menu,
- `renderPdfPage()` returns the layout/masks/wrap data diagnostics need,
- the DOM identity attributes used by the diagnostic reader exactly match the selectors it queries,
- source, replacement, mask, image and free-text objects use one consistent `data-pdf-*` naming contract,
- the copied JSON uses the hardened schema.

Do not mix `data-object-id` with `data-pdf-object-id` unless every consumer is deliberately updated. Pick one explicit PDF diagnostic contract and test it.

## P0 — Wire current semantic search into the actual UI

Adding `searchCurrentPdfDocument()` is not enough if `workspace.js` still calls the raw `searchPdfDocument()`.

The live Search UI must operate on the current semantic document.

Required:

- replaced source text is not found,
- current replacement text is found,
- deleted text is not found,
- historical/superseded edits are not searched,
- behavior remains correct after rerender/zoom/page navigation.

Update imports/call sites and tests.

## P0 — Reopen reconciliation must be real, not test-only

`reconcileReopenedPdfObjects()` must not exist only inside a synthetic/integration test.

The actual fresh-open/reopen path must establish a current semantic view where superseded source runs cannot leak back into:

- rendering,
- hit testing,
- search,
- extraction,
- wrapping,
- collision queries,
- diagnostics.

The A→B→C Save/reopen test must exercise the same production path used by the editor.

Do not pass a magical expected-current fingerprint to a test-only helper if the real reopened editor would not possess that information.

If reconstructing current state after a completely fresh disk reopen requires operator-order/mask analysis, persisted non-invasive provenance, or another bounded mechanism, implement and document the mechanism explicitly. Do not fake the invariant in tests.

The saved PDF must remain an ordinary usable PDF and must not require a proprietary graph merely to display in other readers.

## P0 — Fix resurrected-history detection logic

Review the live↔reopened comparator carefully.

Do not pre-filter historical objects out of a collection and then later attempt to detect those same historical objects from that filtered collection.

Tests must prove:

- an explicitly historical reopened object is reported,
- a superseded reopened object is reported,
- a legitimate unmatched current object is classified separately,
- ambiguity remains ambiguity rather than arbitrary matching.

## P0 — Stable ID contract everywhere

Ensure stable permanent IDs are assigned at creation/ingestion for:

- replacements,
- empty replacements/deletions,
- free text,
- images,
- duplicated objects,
- persistent wrap/reflow objects where applicable.

Legacy records may be normalized once, but normal rendering must not continuously invent changing IDs.

A source object ID and replacement edit ID must never alias.

## P0 — Mask ownership contract everywhere

Every source/field/line/wrap mask must carry explicit:

- mask ID,
- owner edit ID,
- source object IDs,
- mask role.

Do not derive ownership later from comma-separated indexes.

The same ownership plan must be used for live rendering and Save.

## P0 — Production-path Save/reopen torture test

The test must drive the same code path as production as closely as practical:

1. open PDF A,
2. edit A→B,
3. edit B→C,
4. Save,
5. fresh reopen from produced bytes,
6. build production semantic page state,
7. Search for A/B/C,
8. semantic extraction,
9. rerender at another zoom,
10. build diagnostics,
11. confirm only C participates as current.

A and B may physically remain in old PDF operators if the preservation strategy requires that, but Substrate's active document must treat them as inert historical material and must never expose them through normal interaction.

## P0 — Keep strict geometry hardening

Preserve the V15.1 strict geometry work:

- NaN/Infinity/undefined are evidence, never silently coerced to 0 in diagnostics,
- named coordinate spaces,
- explicit round-trip tolerances,
- 0/90/180/270 rotation,
- CropBox offsets,
- fractional coordinates,
- multiple zooms and DPRs,
- typed collision records,
- actual DOM/ink observations remain instrumentation only.

## Tests / checks

Run:

```
node --test tests/pdf-diagnostics.test.mjs
node --test tests/pdf-geometry.test.mjs
node --test tests/pdf-layout.test.mjs
node --test tests/pdf-text-model.test.mjs
node --test tests/pdf-source-mask.test.mjs
node --test tests/*.test.mjs
```

Also run:

- node --check on every changed JS/MJS file,
- git diff --check,
- extension validation,
- Chrome Web Store packaging validation.

If an unrelated pre-existing failure remains, document it precisely.

## Completion standard

Do not declare this done because the helpers exist or because the unit tests can manually assemble the desired result.

It is done when the running editor, Save path, fresh reopen path, Search, extraction and Copy Page Diagnostics all use the same current-version and geometry truth.

This is the last-mile integration pass before merge. Prefer explicit, boring, mathematically inspectable code over clever shortcuts.
