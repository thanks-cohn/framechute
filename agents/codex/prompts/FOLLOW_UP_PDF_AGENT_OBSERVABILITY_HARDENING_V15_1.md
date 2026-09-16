# FOLLOW-UP — PDF AGENT OBSERVABILITY HARDENING V15.1

## Context

PR #67 (`codex/enhance-pdf-layout-observability-and-diagnostics`) is directionally correct and should be preserved, but it is not yet robust enough to merge as the permanent agent-observability foundation.

This follow-up is NOT a rewrite from scratch.

Continue from the current PR #67 branch, preserve the useful work, and harden it until the diagnostics are mathematically and geometrically trustworthy enough that another agent can diagnose PDF rendering/save bugs from structured data alone.

Do not optimize for the smallest possible diff.

**If this takes 500–700 lines of careful code, tests, invariants, geometry helpers, correspondence logic, and diagnostics plumbing, that is acceptable.** Correctness, explicitness, and determinism matter more than clever compression. The goal is to make this infrastructure boringly reliable.

Do not be afraid to introduce a few small pure modules/helpers if that produces a more rigorous system.

---

# The standard

The diagnostic system must not merely describe what the code *thinks* is happening.

It must be able to mathematically distinguish:

1. original PDF geometry,
2. semantic geometry,
3. expected viewport geometry,
4. actual browser layout geometry,
5. actual visible glyph/ink geometry,
6. mask/erase geometry,
7. current replacement geometry,
8. serialized Save geometry,
9. reopened-PDF geometry,
10. historical/superseded objects that must never participate in the current document.

An agent should be able to answer, without screenshots:

> What object is wrong?
> Which coordinate space is wrong?
> Which transform introduced the error?
> Which object owns the mask?
> Which source run was replaced?
> Is the source still active?
> Is the replacement actually current?
> Is the browser rendering something outside its canonical box?
> Does hover/selection alter geometry or visibility?
> Does Save write the same effective geometry?
> Did reopening resurrect something that should be dead?

---

# P0 — Permanent stable identity for every edit

This must be fixed before merge.

Every user-authored PDF edit must receive a stable ID at creation time.

This includes:

- existing-text replacements,
- deletions represented as empty replacements,
- free text,
- inserted images,
- duplicated objects,
- wrapped/reflow-generated objects where persistent identity is appropriate.

Do NOT allow an edit to masquerade as its source object merely because `edit.id` is absent.

Do NOT fall back to `sourceId` for the visible replacement object's identity.

A source object and the replacement for that source are different objects with an explicit relationship.

Required conceptual relationship:

```
source run: source:p1:text:7
replacement: edit:<uuid>
replacement.sourceObjectId = source:p1:text:7
replacement.sourceLineId = ...
replacement.versionState = current
```

Every render, mask, selection, diagnostic record, and Save operation must be able to trace this identity.

---

# P0 — Explicit mask ownership, never guessed ownership

Do not infer mask ownership by string-matching indexes or parsing comma-separated `maskIndex` values.

Every mask must be created with explicit ownership metadata.

At minimum:

```
{
  id,
  ownerEditId,
  sourceObjectIds,
  maskRole,
  pdfRect
}
```

A mask must be attributable to:

- the edit that caused it,
- the source object(s) it intends to erase,
- its role (source-line, source-run, destination-field, wrap, etc.).

No mutation during rendering should be required merely to invent this ownership later.

Mask ownership should be established when the mask plan is built.

Diagnostics must fail loudly when ownership is missing or ambiguous.

---

# P0 — Do not sanitize invalid geometry before diagnostics can see it

The current diagnostics normalize values using patterns such as `Number(value) || 0`.

That can turn broken geometry such as `NaN` into a harmless-looking zero.

That defeats the entire purpose of agent diagnostics.

Introduce strict numeric helpers.

Conceptually:

```
finiteNumber(value) -> number | invalid
normalizeFiniteRect(rect) -> { ok, rect, raw, errors }
```

Preserve raw values long enough to report:

- NaN,
- Infinity,
- -Infinity,
- undefined,
- negative dimensions before normalization,
- zero-area boxes where zero area is not legal.

A diagnostic validator must never convert evidence of corruption into valid-looking geometry.

Geometry normalization may occur for rendering after validation, but diagnostics must retain the original/raw values.

---

# P0 — Cross-save correspondence cannot depend on identical IDs

The current live-vs-reopened comparison cannot assume the same stable IDs survive PDF serialization and fresh PDF.js extraction.

After Save + reopen:

- the live replacement may be serialized into ordinary PDF text,
- PDF.js may extract it as a new source run,
- therefore the reopened object may have a new source ID even when it is visually and semantically correct.

Build a deterministic correspondence layer for comparing current live state to reopened state.

Use a semantic/geometric fingerprint rather than exact ID equality.

A useful fingerprint may include:

- page,
- normalized text,
- semantic role,
- approximate baseline,
- approximate rect,
- font size,
- reading-order neighborhood,
- block/line membership,
- source lineage when still available.

Use tolerances explicitly.

The comparator should classify:

- exact identity match,
- semantic correspondence match,
- geometry drift,
- text mismatch,
- missing current object,
- resurrected historical object,
- ambiguous correspondence.

Do not silently guess when two candidates are equally plausible.

Emit a structured ambiguity issue.

---

# P0 — Current-version boundary must be real, not rhetorical

The active document must contain only the current version.

Undo/history may retain previous states, but those states remain inert until explicitly invoked.

After:

`A → B → C → Save → reopen`

the active document must behave as though **C is the only current text**.

A and B must not:

- render,
- become hit-testable,
- reappear on hover,
- become searchable,
- appear in semantic extraction,
- participate in wrapping,
- affect collision detection,
- receive masks,
- be selected,
- return after zoom/rerender/page navigation/edit-mode toggle.

If the underlying PDF bytes still physically contain superseded text operators because of the overlay strategy, the diagnostic model must explicitly classify those operators as historical/superseded and guarantee that they cannot participate in the active semantic/render layer.

If that cannot be guaranteed with the current serializer, identify the exact architectural point that must change and implement the safest bounded correction necessary for this invariant.

Do not hide this problem with a diagnostic label only.

---

# P0 — Save/reopen integration test, not synthetic object maps only

Add a real integration-style test flow using actual PDF bytes where practical.

Required torture sequence:

1. load a PDF with source text A,
2. edit A → B,
3. edit B → C,
4. Save,
5. reopen the produced PDF bytes as a fresh PDF model,
6. rebuild semantic layout,
7. run search,
8. run semantic extraction,
9. generate diagnostics,
10. compare live-current vs reopened-current state,
11. simulate rerender at another zoom/viewport where test harness allows,
12. verify historical A/B do not re-enter current state.

The test must not merely hand-construct fake diagnostic objects.

Synthetic unit tests remain useful, but the hard invariant needs at least one real serializer/reopen path.

---

# P0 — State harness: idle / hover / selected / editing / committed / rerendered

The prompt requires state-dependent truth.

Implement an explicit diagnostic state capture mechanism so the same object can be measured across:

- idle,
- hover,
- selected,
- editing,
- committed,
- rerendered.

Do not rely only on a string label supplied by the caller.

Capture the actual relevant computed state:

- classes,
- display,
- visibility,
- opacity,
- transforms,
- overflow,
- clip-path,
- z-index,
- pointer-events,
- layout rect,
- ink rects,
- masks present,
- owner relationships.

Where browser automation is available, add a focused test that actually toggles the relevant classes/events and verifies geometry does not unexpectedly change.

Hover must not resurrect old text.

Selection must not change the canonical ownership of text.

Editing/commit must not leave stale overlays alive.

---

# P0 — Separate source, replacement, and observed object identity

The diagnostic snapshot must not collapse these into one record.

For an edited source run, agents should see distinct records such as:

```
source object
replacement object
source erase mask
destination field mask (if any)
observed DOM element
serialized draw instruction
```

Each record should contain explicit relationships:

```
sourceObjectId
replacementObjectId
ownerEditId
maskIds
derivedFrom
supersedes
supersededBy
```

This makes it possible to answer:

> “The source run still exists in PDF bytes, but edit X supersedes it and mask Y removes it from the current visual state.”

That is much more useful than pretending the replacement *is* the source.

---

# P0 — Mathematically explicit coordinate contracts

For every conversion helper, document input space and output space.

Examples:

- `pdfRectToViewportRect(pdfRect, viewport)`
- `viewportRectToPdf(viewportRect, viewport)`
- `viewportLocalRectToClient(...)`
- `clientRectToViewportLocal(...)`
- `cssRectToDevicePixels(...)`
- baseline conversion helpers.

Add inverse/round-trip tests wherever an inverse exists.

Use explicit tolerances.

Add tests for:

- 0°,
- 90°,
- 180°,
- 270° rotation,
- CropBox offsets,
- zoom 25% / 100% / 250% / 500%,
- DPR 1 / 1.25 / 1.5 / 2,
- negative/offset page origins where supported,
- narrow/tiny rectangles,
- fractional coordinates.

Do not hand-wave coordinate equivalence.

---

# P0 — Geometry truth hierarchy

Document and enforce this hierarchy:

1. raw PDF/source geometry,
2. normalized canonical PDF geometry,
3. semantic geometry,
4. expected viewport geometry,
5. observed DOM geometry,
6. observed ink geometry.

Observed DOM/ink geometry is evidence, not canonical truth.

But canonical truth must be challenged when observed geometry repeatedly disagrees.

Diagnostics should emit enough data to determine whether the error is:

- extraction,
- semantic reconstruction,
- coordinate transform,
- CSS layout,
- font metrics,
- clipping,
- mask ownership,
- layer order,
- serializer geometry.

---

# P0 — Collision diagnostics must identify collision type

Do not report only `collisions: [id, id]`.

For each collision report:

- left object,
- right object,
- coordinate space used,
- intersection rect,
- overlap area,
- semantic relationship,
- ownership relationship,
- collision classification.

Examples:

- owned overlap,
- intentional overlay,
- image-wrap interaction,
- destructive unrelated overlap,
- uncertain unknown-content overlap.

Agents should be able to immediately distinguish a harmless overlay from a destructive collision.

---

# P0 — Layering / stacking truth

Record both logical layer and actual browser stacking information.

For relevant DOM elements capture:

- computed z-index,
- stacking-context creation,
- DOM paint order where useful,
- pointer-events,
- visibility,
- opacity.

At minimum detect:

- mask behind the canvas,
- replacement behind a mask,
- stale replacement still above current content,
- hover/selection handles altering stacking,
- historical object still hit-testable.

Add structured issues such as:

- `MASK_BEHIND_SOURCE`
- `REPLACEMENT_BEHIND_MASK`
- `STALE_OBJECT_HIT_TESTABLE`
- `STATE_CHANGED_STACKING_ORDER`

---

# P0 — Search/extraction must respect current semantic state

Search and extraction should operate on the current semantic document, not raw PDF.js text items when those items are superseded.

Test:

- replaced text is not found by old text,
- current replacement is found,
- deleted text is absent,
- after Save + reopen, old superseded text is still absent from current search/extraction.

If the reopened PDF physically exposes old operators to PDF.js, the semantic adapter must filter/supersede them deterministically.

---

# P0 — Diagnostic JSON quality

The copied JSON should be useful to an agent without source code open.

Include:

- schemaVersion,
- page,
- page boxes,
- viewport information,
- document/current-version identifier,
- object count by kind,
- issue counts by severity/code,
- object records,
- correspondence records where comparing live/reopened snapshots,
- invariant results.

Cap giant strings.

Never include image base64, full PDF bytes, or font binaries.

Keep the schema deterministic so two snapshots can be diffed.

---

# P1 — Geometry overlay

If practical in this follow-up, add an optional debug-only geometry overlay.

It should be able to show:

- source-run boxes,
- semantic-line boxes,
- replacement boxes,
- masks,
- observed ink bounds,
- IDs/short labels.

Keep it disabled by default.

Do not let the overlay alter layout or hit-testing.

---

# Tests

Run and fix:

```
node --test tests/pdf-diagnostics.test.mjs
node --test tests/pdf-geometry.test.mjs
node --test tests/pdf-layout.test.mjs
node --test tests/pdf-text-model.test.mjs
node --test tests/pdf-source-mask.test.mjs
node --test tests/*.test.mjs
```

Also run:

- `node --check` on all changed JS/MJS,
- `git diff --check`,
- extension validation,
- Chrome Web Store packaging validation.

If an unrelated pre-existing test fails, document it precisely. Do not use that as a reason to skip the PDF tests.

---

# Acceptance criteria

Do not mark this follow-up complete until all of these are true:

1. every current edit has a stable permanent identity;
2. every mask has explicit ownership;
3. invalid geometry is reported rather than normalized away;
4. live-vs-reopened comparison works even when serialized objects receive new PDF source IDs;
5. historical/superseded objects cannot participate in the current document;
6. search/extraction cannot resurrect replaced text;
7. state diagnostics can distinguish idle/hover/selected/editing/committed/rerendered;
8. coordinate transforms have round-trip tests with explicit tolerances;
9. collision diagnostics are typed and spatially explicit;
10. Copy Page Diagnostics produces enough structured evidence for another agent to diagnose a page without screenshots;
11. the A→B→C→Save→reopen torture case is covered by a real integration path;
12. no solution depends on DOM geometry as canonical document state.

---

# Engineering posture

Be rigorous.

Do not compress the implementation merely to keep the diff small.

A 500–700 line follow-up is acceptable if that is what is required to make the geometry, identity, correspondence, history boundary, and diagnostics mathematically explicit and dependable.

Prefer:

- pure helpers,
- explicit coordinate-space names,
- immutable diagnostic records,
- deterministic IDs,
- deterministic correspondence,
- typed issue codes,
- strict validation,
- integration tests,

over clever one-liners and implicit behavior.

This subsystem is intended to become the geometric/semantic foundation not only for PDF editing, but eventually for document interchange across PDF, DOCX, WEBX, and future formats.

Treat it like infrastructure that future format adapters and agents will trust.

Update PR #67 rather than opening a disconnected replacement PR unless there is a strong technical reason not to.
