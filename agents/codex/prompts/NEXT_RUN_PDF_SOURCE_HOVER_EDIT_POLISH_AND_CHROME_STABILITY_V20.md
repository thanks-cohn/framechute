# NEXT RUN — PDF SOURCE HOVER / EDIT POLISH + CHROME STABILITY V20

Repository: `thanks-cohn/framechute`
Target branch: `main`

## Mission

Finish the PDF interaction layer so Substrate looks calm, exact, and professional under real use.

This run is not about adding broad new PDF features. It is about eliminating the remaining visible jank in source-text hovering/editing and a few chrome regressions that undermine confidence.

The user has now visually verified an important split:

- **Text created/replaced by Substrate has accurate hover geometry.**
- **Untouched/native PDF text often has hover boxes visibly offset from the actual canvas text.**
- Editing the native text still lands in roughly the correct location, which strongly suggests the source span/PDF projection is closer to truth than the DOM Range glyph measurement currently used for hover targeting.

Treat that observation as evidence, not anecdote.

## Core diagnosis to prove first

Untouched PDF source text is visually painted by the PDF canvas, while the current hover authority is derived from a hidden DOM text surrogate (`capturePdfPageDomObservations(...).inkUnion` / Range geometry). Those are not the same rendering system.

A hidden DOM run may use fallback CSS font metrics even when the canvas is using an embedded/subset PDF font. Therefore DOM Range bounds must NOT automatically be called the visual truth for untouched source text.

By contrast, replacement/free-text created by Substrate is visibly rendered in the DOM overlay, so DOM glyph geometry is appropriate there.

The architecture must make this distinction explicit.

---

# 1. Split source-text visual truth from replacement-text visual truth

Introduce an explicit presentation-truth classification for interactive PDF text objects, for example:

- `canvas-source-text`
- `dom-replacement-text`
- `dom-free-text`
- `dom-wrapped-text`

Do not blindly use one geometry source for every kind.

For untouched/native PDF source text:

- the **canvas is the visible rendering truth**;
- interaction geometry should derive from the canonical PDF.js text-item projection / source span rectangle that is already used to initiate edits;
- use the item transform, PDF.js ascent/descent information, rotation, `item.width`, scale, and the existing source span placement lineage;
- DOM Range/glyph bounds may remain useful as diagnostic evidence, but they must not override the source projection when their font metrics diverge from the canvas;
- do not invent arbitrary client-space offsets.

For Substrate replacement/free text:

- visible DOM glyph ink may remain authoritative because that is what the human actually sees.

The diagnostic scene graph should expose which authority was used and why.

Suggested metadata:

```js
presentationTruthKind
interactionAuthority
interactionAuthorityReason
sourceProjectionRect
domGlyphRect
interactiveRect
```

Acceptance law:

> Hover geometry for native source text must describe the canvas text the user sees, not the invisible DOM surrogate used for editing.

---

# 2. Make hover / hit / click agree on untouched source text

After the authority split, make hover, click, and double-click all use the same source interaction rectangle for native source text.

Acceptance criteria:

- moving across neighboring source lines does not highlight the wrong line;
- hover outline visually covers the intended source text band;
- single click resolves the same object that hover indicates;
- double click begins editing that same object;
- neighboring lines cannot steal the pointer because of oversized DOM boxes;
- behavior survives 50%, 100%, 125%, 200% zoom, scroll, fit-page, fit-width, and DPR differences;
- no client-space geometry is serialized back into the PDF model.

Keep the source rectangle modest. It may include ~1px usability bleed, but it must not become a giant invisible line-height box.

---

# 3. During active editing, there must be ONE box, not two

The current shared hover outline can remain visible while the editable field itself has an editing outline, producing two overlapping boxes.

Fix this cleanly.

When a `.pdf-edit-text` is `contenteditable=true` or its parent is `.is-editing`:

- hide/suppress `.pdf-interactive-outline` for that object;
- do not repaint the hover outline while editing that same object;
- the editable field itself is the only visible interaction boundary;
- moving the pointer inside the active field must not resurrect the hover box;
- after editing ends, normal hover behavior may resume.

Do not hide selection handles merely because hover is suppressed.

---

# 4. Enter commits editing for now

Multiline editing can be revisited later. For this version, make the model deliberately simple:

- plain `Enter` commits the current edit and blurs the field;
- prevent insertion of a newline;
- `Escape` still cancels;
- Ctrl/Cmd+A still selects field content;
- preserve undo/redo behavior;
- do not require Ctrl/Cmd+Enter anymore.

The interaction should feel like editing a bounded PDF text object, not a mini word processor.

---

# 5. Live edit field must grow enough to contain its text

While the user types, the editable field must not visibly clip the entered text.

Implement bounded live geometry expansion:

1. Preserve the field's anchor unless the user explicitly moves it.
2. Keep the current/source width as a minimum rather than shrinking unexpectedly.
3. If the text needs more horizontal room, grow width using measured content / `scrollWidth` / TextMetrics.
4. Do not grow beyond the available page region.
5. If horizontal room is exhausted and wrapping is unavoidable, allow height to grow enough to contain the wrapped text.
6. Never silently reduce the user's font size.
7. Update the transient mask/field geometry while editing so source text remains erased under the expanded replacement.
8. On commit, convert the final field geometry back through the existing viewport→PDF geometry path.

The user should be able to type a longer replacement and see the whole replacement, not a clipped fragment.

Later we may support overflow-obscure / hide / fixed-box policies, so keep the expansion policy isolated rather than hard-coded everywhere.

---

# 6. One click must select existing edited text and show move + resize handles

For an existing Substrate replacement/free-text object:

- first single click selects it;
- the move handle and resize handle appear immediately;
- do not require a second click;
- click resolution must use the same canonical visual target system introduced in V19/V20;
- single-clicking untouched source text must NOT create a persisted edit merely for selection.

After a source object has been converted into a replacement edit, subsequent single clicks should behave like any other edited object.

---

# 7. Add a tiny bounded terminal bleed to the LIVE source erase mask

There is still a very small source-text residue at the final object/fragment of a line while live editing.

Inspect `createPdfLiveEditMask(...)` and the existing shared mask / terminal-fragment logic.

Add only the smallest bounded bleed needed to hide the final source pixels, preferably:

- scale-aware;
- terminal-object aware where semantic line information is available;
- biased to the trailing edge rather than indiscriminately expanding all sides;
- capped to a few CSS pixels;
- never enough to erase neighboring text.

Do not regress the already-fixed saved-PDF mask behavior.

Acceptance:

> While actively replacing the final source fragment on a line, no visible sliver of the old source glyph survives beside/under the replacement.

---

# 8. Fix duplicate PDF toolbar rows permanently

The user can currently see duplicate formatting/tool rows, including repeated Font / Text size / Undo / Redo / File / Organize / More bands.

The three-row toolbar enhancer must be truly idempotent, even if:

- initialization runs twice;
- the block is restored/recreated;
- mutation observers re-enter;
- an already-enhanced toolbar is encountered without the dataset guard;
- controls are already nested inside prior toolbar rows.

Do not rely only on `toolbar.dataset.pdfResponsiveToolbar`.

Structural invariant after enhancement:

```text
exactly 1 primary row
exactly 1 formatting row
exactly 1 secondary/tools row
exactly 1 instance of every known PDF toolbar control
```

Prefer moving existing controls, never cloning them.

If an already-enhanced structure exists, normalize/reuse it instead of wrapping it again.

Add a deterministic test that calls/enacts enhancement repeatedly and confirms no duplicate controls/rows are produced.

---

# 9. Repair the visible Copy controls instead of leaving dead buttons

The user reports the visible `Copy` controls do not work.

First identify every user-visible control labeled `Copy` associated with PDF/object chrome and determine its intended action. Do not silently relabel a broken button.

For a PDF frame, Copy should operate on actual content, not merely the filename:

- if Chromium permits writing the actual PDF blob to the clipboard with a supported MIME path, do so;
- if arbitrary PDF clipboard MIME is not supported in this environment, provide a truthful fallback that still copies useful content (for example selected text where appropriate) and clearly reports what happened;
- never report success while only copying a filename unless the control explicitly says `Copy filename`;
- do not duplicate the frame or create another toolbar row as a side effect;
- preserve existing `Copy To…` directory semantics separately.

For image objects, copy image data where browser clipboard APIs permit it.

The implementation must produce a visible status message on success/failure so the user is never left wondering whether Copy did anything.

If there are multiple legacy `Copy` controls wired to nothing, consolidate their behavior rather than stacking another handler.

---

# 10. Diagnostics must explain source-vs-DOM divergence

Extend the current visual scene diagnostics so a copied dossier for a native source run can say something equivalent to:

```json
{
  "presentationTruthKind": "canvas-source-text",
  "sourceProjectionRect": {...},
  "domGlyphRect": {...},
  "interactiveRect": {...},
  "authority": "pdfjs-source-projection",
  "domGlyphDelta": {"x": 1.3, "y": 7.8},
  "reason": "DOM surrogate font metrics differ from canvas source font"
}
```

Do not claim actual canvas pixel glyph bounds unless they were really measured. The point is to correctly describe the ancestry and authority, not fabricate precision.

---

# 11. Preserve these invariants

Do not regress:

- PR #77 visual target resolution for replacement text;
- stable three-row PDF toolbar intent;
- PDF semantic layout;
- source/replacement identity and provenance;
- shared live/save mask planning;
- save/reopen parity;
- current font-size authority;
- low-memory design;
- diagnostics OFF by default;
- no margin/page-guide overlays;
- no magic pixel offsets.

Do not add a broad PDF rewrite in this run.

---

# 12. Required tests

Add focused deterministic tests covering at least:

- native source text chooses source/PDF.js presentation authority instead of DOM Range glyph authority;
- replacement/free text still uses DOM-visible geometry;
- hover/click/double-click all resolve the same native source object;
- active editing suppresses the shared hover outline;
- Enter commits and does not insert `\n`;
- live field grows to contain longer replacement text without font-size reduction;
- existing replacement single-click shows selected state/handles;
- terminal live mask bleed removes the final source sliver without covering the next object;
- repeated toolbar enhancement remains exactly three rows with unique controls;
- Copy produces a truthful result/status instead of a no-op;
- full existing PDF diagnostics tests still pass.

Run:

```bash
node --test tests/*.test.mjs
node --check src/workspace.js
node --check src/pdf-popdowns.js
git diff --check
```

If browser-only behavior cannot be fully proven in Node, add the narrowest testable pure helper and document the remaining visual verification step.

---

# Acceptance scenario

Using the user's current three-page PDF test document:

1. Hover untouched text such as the natural source paragraph.
   - The box tracks the actual visible canvas text instead of floating above/below it.
2. Hover replacement text written by Substrate.
   - It remains accurate.
3. Double-click native source text.
   - The exact hovered object becomes editable.
   - The hover outline disappears, leaving only the edit field.
4. Type a longer phrase.
   - The field expands enough to display it.
5. Press Enter.
   - Editing commits immediately; no newline is inserted.
6. Single-click the resulting replacement.
   - Move and resize handles appear on that click.
7. Edit the last fragment of a source line.
   - No tiny source residue survives at the trailing edge.
8. Inspect the PDF toolbar.
   - Exactly three stable rows, no repeated Font/Text size/Undo/Redo/File/Organize/More set.
9. Press the visible Copy control.
   - It performs a real, truthful copy action and reports the result.

Final design law:

> Source text interaction must follow the geometry of the PDF presentation the human sees; replacement text interaction must follow the geometry of the DOM presentation the human sees. Never confuse the surrogate with the picture.