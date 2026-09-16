# NEXT RUN — PDF PREMIUM SEMANTIC EDITOR + READER V14

## Status

PR #61 is merged on `main`.

The semantic PDF page-model foundation now exists in:

- `src/documents/pdf-layout.js`
- `src/documents/pdf-document.js`
- `docs/PDF-ARCHITECTURE.md`

This run is the visible payoff. Do not replace that architecture with DOM heuristics. Use it.

This prompt is the single authoritative prompt for this run.

---

# Product goal

Make the PDF surface feel calm, obvious, and premium to a first-time user.

The ordinary experience should be:

> **Open PDF → click text → type → the text stays aligned → nearby text never gets covered → Save.**

The user should not need to understand PDF internals, text boxes, source runs, collision classes, masks, or page coordinates.

The page should remain visually dominant. Editing controls should appear only when useful. The reader should look intentional at narrow and wide sizes, not like a collection of developer controls.

The result does not need to pretend PDF is Word. It DOES need to make the common case of changing text feel as easy as possible.

---

# Read before editing

Read current `main` first:

- `docs/PDF-ARCHITECTURE.md`
- `src/documents/pdf-layout.js`
- `src/documents/pdf-document.js`
- `src/documents/pdf-geometry.js`
- `src/workspace.js`
- `src/workspace.html`
- `src/workspace.css`
- `src/pdf-popdowns.js`
- `tests/pdf-layout.test.mjs`
- `tests/pdf-text-model.test.mjs`
- `tests/pdf-source-mask.test.mjs`
- `agents/codex/prompts/NEXT_RUN_PDF_STANDARDIZATION_SUMMIT_V11.md`
- `agents/codex/prompts/pdf-wysiwyg-source-mask-live-preview.md`
- `agents/codex/prompts/pdf-live-edit-field-manipulation-addendum.md`

Preserve all merged PDF fixes, especially source masking, direct image manipulation, page operations, edit history, PDF-space geometry, link behavior, and native Save / Save As.

---

# Non-negotiable product laws

## 1. No accidental overlap

A normal text edit must never silently draw replacement text over unrelated text.

Before committing or laying out replacement geometry, consult the semantic page model.

Use:

- reading order
- source lineage
- block membership
- intersections
- neighbors
- collision classification
- page/column geometry

Do not use raw DOM overlap as the source of truth.

## 2. User font size is authoritative

The font size is chosen by the user.

Do **not** automatically shrink or enlarge text merely to make it fit.

If the user chooses 10 pt, keep 10 pt until the user changes it.
If the user chooses 18 pt, keep 18 pt until the user changes it.

Wrapping, field growth, and semantic reflow should adapt around the chosen size.

An explicit future `Fit text` command may alter size, but this run must not silently do so.

## 3. Preserve reading structure

Changing a sentence in the left column must not shove the right column around.

A heading must not become part of a body paragraph.
A footer must not get pulled into the main text.
A replacement keeps the source semantic position even if its paint order changes.

Use the model introduced by PR #61 rather than rebuilding layout assumptions in `workspace.js`.

## 4. WYSIWYG

What the user sees before Save should closely match the saved PDF.

Source masks, replacement text, moved/reflowed lines, font size, and geometry must all come from canonical semantic/edit state.

No visual-only fixes that disappear on rerender or Save.

## 5. Conservative when uncertain

The semantic model intentionally marks free-space knowledge uncertain until all non-text operators are classified.

Do not treat uncertain white-looking areas as guaranteed empty.

When a safe automatic layout cannot be proven, do not overlap content. Preserve the edit and show a small, quiet, actionable overflow/space warning rather than corrupting the page.

---

# P0 — Direct text editing should feel ordinary

## Click text and edit it

With PDF edit mode ON:

- clicking editable source text selects the semantic text target,
- editing should be direct and visually immediate,
- typing updates the live page,
- normal spaces, punctuation, Backspace/Delete, selection, paste, and line breaks behave like ordinary text editing,
- the user should not have to manually create a replacement box for the common case,
- Escape/click-away commits or cancels according to the current editor contract without losing text.

Prefer editing a semantic line/block context rather than exposing raw PDF.js paint fragments as separate awkward objects when those fragments form one visible line.

Do not break browser text-selection/search behavior when edit mode is OFF.

## Preserve the original visual slot

Start an edit from the source semantic location:

- preserve the source baseline/alignment as closely as practical,
- initialize font size from the source when available,
- use the source block/column width as the default wrapping boundary,
- preserve explicit user line breaks,
- keep the replacement anchored to the logical source position unless the user deliberately moves it.

The first impression should be that the user edited the document, not pasted a floating label on top of it.

---

# P0 — Local semantic reflow: the core feature

Build a small deterministic layout/reflow layer on top of the PR #61 semantic model.

The goal is not global Word-style reflow. It is **local, bounded, collision-safe PDF editing**.

## Required layout behavior

When edited text changes size:

1. compute the replacement using the user's chosen font size,
2. wrap within the owning semantic block/column width,
3. grow/shrink the replacement region as required,
4. query the semantic model for collisions,
5. resolve owned/same-block collisions by minimally moving subsequent semantic content in reading order,
6. keep unrelated blocks/columns stationary,
7. never cover unknown or unrelated content.

### Same-block content

If a longer replacement needs more vertical space and the next line belongs to the same semantic block:

- move the following line(s) by the minimum required vertical delta,
- preserve their text, style, reading order, and stable identity,
- continue until the block is collision-free,
- derive the live preview and saved representation from the same state.

If shortening/deleting text removes lines, compact the same semantic block upward when safe so obvious holes do not remain.

This must be deterministic: the same source + edits produce the same result.

### Separate blocks / columns

Do not casually reflow:

- another column,
- a heading,
- footer/header,
- unrelated caption,
- annotation,
- image,
- form field,
- vector/unknown content.

A left-column edit should stay within the left-column semantic region.

### Fixed-source PDF reality

Original source glyphs are baked into the PDF content.

If an existing source line must visually move because of local reflow, use the existing conservative cover-and-redraw/source-mask strategy or another equally safe overlay representation.

Do **not** rewrite arbitrary PDF content streams to simulate Word.

The original bytes remain authoritative and unrelated content must remain intact.

### Impossible layouts

If the desired text cannot fit safely in its local semantic region:

- do not overlap other content,
- do not silently change font size,
- do not move unrelated regions,
- preserve the user's text,
- show one subtle non-modal state such as `Needs more space` / `Text does not fit here`,
- provide a simple direct resolution such as resize/move the field or choose a smaller font.

Do not present a complex layout dialog.

---

# P0 — Editing UX should have almost no ceremony

The normal path must not expose a toolbox before the user needs it.

When nothing is selected, the PDF should mostly look like a premium reader.

When text is selected, show only a compact contextual editor with essentials such as:

- font family when safely supported,
- point size,
- bold/italic where supported,
- text color if already safe,
- undo/redo only if it belongs naturally there.

Avoid a giant floating inspector.

Move/resize handles should be subtle and appear only for a selected FrameChute-owned edit.

Clicking away should return the page to a clean reader appearance.

---

# P0 — Premium reader chrome

Refine the PDF reader UI so it feels intentionally designed rather than mechanically exposed.

## Primary bar

At normal widths, keep the first-row reader controls compact and visually calm.

Prioritize:

- Save / Save As
- previous / next page + page number
- zoom / fit
- Search
- Edit toggle
- one compact overflow / More entry for secondary commands

Pages, Outline, Organize, document properties, extraction, and less-frequent commands can live in compact popdowns/overflow rather than permanently consuming multiple rows.

Do not remove functionality. Reorganize it.

## Contextual editing bar

Text/image editing controls should be contextual rather than permanently crowding the reader.

When text is selected, show text controls.
When an inserted image is selected, show image controls.
When nothing is selected, hide those controls.

## Narrow blocks

A PDF block must not collapse into a pile of wrapped buttons.

At narrower widths:

- keep the page visible,
- keep essential navigation reachable,
- move lower-priority actions into overflow,
- do not allow toolbars to overlap the document,
- avoid horizontal UI chaos,
- preserve keyboard and pointer usability.

Use the existing popdown infrastructure where possible.

## Visual quality

Aim for:

- restrained borders,
- consistent control heights,
- consistent spacing,
- clear selected/hover/focus states,
- compact icons/text,
- no loud debug-looking labels,
- no giant unused chrome,
- no controls floating over content unless intentionally contextual.

Do not redesign the entire FrameChute workspace. Keep this scoped to the PDF reader/editor surface.

---

# P0 — History and save semantics

A direct text edit plus its automatic same-block reflow should be one coherent semantic transaction where practical.

Undo should restore:

- replacement text,
- replacement geometry,
- source masks,
- automatically displaced same-block lines,
- font/style state changed in that action.

Redo should reapply them together.

One drag remains one undo step.
One resize remains one undo step.
A font-size change remains one undo step.

Save / Save As must reproduce the live state.

Changing page and returning must reproduce the live state.

Zooming/resizing the PDF block must not alter stored PDF-space geometry.

---

# P0 — Keep performance light

FrameChute must remain comfortable on low-memory machines.

Do not:

- eagerly model every page,
- build bitmap occupancy maps,
- retain DOM/canvas references in semantic models,
- rasterize pages to solve layout,
- create an unbounded history or page cache.

Preserve the lazy per-page semantic model and bounded LRU philosophy.

Only recompute the affected page/block when an edit changes it.

---

# P1 — Editing polish

If P0 is solid, add the following without destabilizing it:

- keyboard arrow nudging for a selected FrameChute-owned field,
- clear but subtle overflow state,
- double-click/Enter behavior that feels natural,
- caret placement that does not jump after rerender,
- retain selection/caret during small semantic-layout refreshes where practical,
- search highlight should not fight edit selection,
- page navigation should preserve scroll/fit state,
- reader panels should not cover core controls or render outside the block.

Do not chase advanced formatting before the basic editing loop is excellent.

---

# Tests

Expand tests around real user invariants.

At minimum cover:

1. short replacement remains aligned to the source slot,
2. longer replacement wraps at the semantic block/column boundary,
3. longer replacement pushes the next same-block line by the minimum required amount,
4. cascading same-block displacement remains deterministic,
5. shortening/deleting text compacts the same block when safe,
6. a left-column edit does not move right-column content,
7. heading/body/footer segmentation is preserved,
8. an unrelated block is not automatically moved,
9. unknown/vector/image/annotation collision prevents unsafe auto-placement,
10. user-selected font size never changes automatically during reflow,
11. replacement retains source semantic reading position,
12. automatic layout state survives page away/back,
13. automatic layout state survives zoom/fit changes,
14. one text edit + local reflow can be undone/redone coherently,
15. source masks remain correct for every source line visually displaced,
16. semantic extraction returns edited text once, in the correct reading order,
17. save/reopen preserves the visible result within the current PDF cover-and-redraw fidelity boundary,
18. toolbar remains usable at a narrow PDF-block width without wrapping into a broken multi-row pile,
19. reader-only state hides irrelevant edit controls,
20. selected-text state exposes only the expected contextual controls.

Prefer pure layout tests in `tests/pdf-layout.test.mjs` plus targeted PDF model tests. Use synthetic PDFs where practical.

---

# Manual acceptance

Exercise the PDF UI in a browser if the environment permits.

At minimum test these visible cases:

### Case A — simple word change

Change a word to another word of similar length.

Expected:

- immediate update,
- same alignment,
- no old glyphs visible,
- no manual box positioning required.

### Case B — longer sentence

Replace a short phrase with a substantially longer phrase in a body paragraph.

Expected:

- wrap inside the same text region,
- following lines move enough to make room,
- no lines cover each other,
- neighboring column remains stationary,
- font size does not silently change.

### Case C — deletion

Delete several words or a whole line.

Expected:

- old source glyphs disappear,
- same-block text compacts when safe,
- no ghost gap caused by stale overlays.

### Case D — user font size

Set an edited passage to a larger size.

Expected:

- size remains exactly what the user chose,
- layout adapts around it,
- no overlapping text,
- undo restores both size and layout.

### Case E — narrow reader

Resize the PDF block narrower.

Expected:

- reader chrome stays clean,
- page remains dominant,
- essential actions stay reachable,
- secondary actions move to overflow,
- no button pileup.

Record what was manually verified and anything that could not be tested.

---

# Preservation boundaries

Do not regress:

- inserted image drag/move/resize,
- source masking,
- links/annotations behavior,
- page operations,
- PDF extraction,
- search,
- Save / Save As,
- FCX/workspace restore,
- untouched PDF preservation.

Do not silently flatten/rasterize whole PDFs.

Do not claim support for:

- arbitrary embedded-font reuse,
- OCR,
- full content-stream rewriting,
- perfect paragraph reflow across arbitrary PDF structures,
- forms editing,
- background inpainting,
- cryptographic signature preservation.

These are outside this run.

---

# Scope discipline

Do not begin:

- DOCX redesign,
- 3D,
- CSV,
- broad workspace refactors,
- unrelated quick-action work,
- new file formats.

This run succeeds when an ordinary user can edit PDF text without thinking about boxes or collisions, and the reader looks like a finished product.

---

# Quality gates

Before opening the PR:

- run focused PDF layout/model tests,
- run `node --test tests/*.test.mjs`,
- run `node --check` for changed JS/MJS files,
- run `git diff --check`,
- run the repository's Chrome Web Store / extension validation/package gates,
- report any pre-existing unrelated failures separately rather than hiding them.

Keep changes coherent and reviewable.

Open one clean PR against latest `main`.

In the PR summary, explicitly state:

- how semantic reflow works,
- how collisions are prevented,
- what moves automatically and what never moves automatically,
- how user font size is preserved,
- how the reader chrome changed,
- save/round-trip guarantees,
- tests/manual checks,
- known limitations.
