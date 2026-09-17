Read and execute:

`agents/codex/prompts/NEXT_RUN_PDF_HOVER_HITBOX_ALIGNMENT_AND_VISUAL_TRUTH_V19.md`

This run is narrowly about finally eliminating the PDF visual mismatch between visible glyphs and their hover / hit / selected / editable fields.

Use the V17/V18 visual-scene diagnostics first. Reproduce the mismatch in DEBUG or DEEP mode and identify the first measurable geometry divergence. Do not patch with arbitrary offsets.

Then make one canonical interactive text rectangle authority so:

`visible text == hover target == click target == selected field == editable field`

within justified browser tolerances.

Prioritize these requirements:

- hover outline must actually sit over the text it represents
- pointer hit resolution must choose the visually correct text object
- selected/editable fields must not jump on focus/contenteditable/selection
- initial source hitboxes must be visually sane
- zoom, fit, scroll, resize, DPR, and rotation must not introduce drift
- no giant invisible hit regions
- persisted edit geometry stays in PDF points
- canvas remains the visual source of truth for untouched source text
- stable three-row toolbar must remain unchanged
- preserve source masks, terminal-fragment fix, save/reopen parity, current-version identity/provenance, and low-memory design

Strengthen Copy Page Diagnostics so ChatGPT/Codex can answer from JSON alone:

“Where are the glyphs? Where is the hover/hit/edit box? Do they overlap? If not, how far off are they and where did divergence begin?”

Run the full existing Node test suite and add regression tests for shifted/oversized hitboxes, neighboring text targets, focus/edit activation stability, zoom/scroll alignment, and save/reopen parity.

Do not broaden into unrelated PDF features until this geometry/hit-testing discrepancy is measurably fixed.