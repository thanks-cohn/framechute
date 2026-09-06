# Codex Request: PDF WYSIWYG source masking + premium live preview

## Context

PR #44 made PDF replacement text directly manipulable. It is better, but one important visual correctness problem remains:

When a user replaces/deletes text and then moves the replacement field, the original text is still visibly baked into the rendered PDF canvas underneath. The saved PDF may be correct because serialization covers the source glyph area, but the live editor looks like a replacement was simply pasted over a static image.

That is confusing and undermines trust. An ordinary user may reasonably conclude that no real change occurred.

## Product rule

> What the user sees in the editor should match what Save / Save As will produce.

> Once a source text item has been replaced or deleted, the old visible glyphs should no longer remain visible in the live page preview.

This is a focused follow-up to PR #44. Work from latest `main`.

Preserve all current PDF editing behavior:

- immediate replacement text display
- move/drag replacement field
- resize replacement field
- point-size control
- keyboard nudging
- PDF-space geometry
- Undo / Redo
- FCX capture/restore
- native Save / Save As
- current page operations

Do not redesign the entire PDF editor.

---

# 1. Add a fixed source-mask layer for every committed replacement

The current saved-file strategy already distinguishes:

- source rectangle: `sourceX/sourceY/sourceWidth/sourceHeight`
- replacement rectangle: `x/y/width/height`

Use that same distinction visually.

For every committed PDF edit, render a visual source mask at the original source rectangle.

Conceptually:

```text
original PDF canvas
      ↓
source mask at ORIGINAL glyph position
      ↓
replacement field at USER-CHOSEN position
```

The source mask must remain fixed to the original glyph area even when the replacement field is moved or resized.

Moving the replacement must NEVER reveal the original text again.

## Required behavior

- source mask is positioned from `sourceX/sourceY/sourceWidth/sourceHeight`
- replacement is positioned independently from `x/y/width/height`
- source mask does not move when replacement moves
- source mask does not resize when replacement resizes
- page switching away/back recreates it correctly
- FCX restore recreates it correctly
- Undo/Redo updates/removes/restores it with edit history
- deleting replacement text leaves the source masked, representing intentional deletion
- reverting replacement back to the original text and removing the edit should remove the source mask

---

# 2. Live preview must match current save semantics

Current v1 serialization covers the source glyph area with a white rectangle before drawing replacement text.

For this pass, the live editor should use the SAME effective visual semantics so the page preview is honest.

If Save would produce a white source cover, live preview should show that source cover.

Do not create a nicer-looking live preview that differs materially from the generated PDF.

If the source lies on a non-white background, accept the current v1 fidelity boundary for now, but keep the code structured so a future richer masking/background-reconstruction strategy can replace the white cover.

Do not silently sample or invent complex backgrounds in this small pass.

---

# 3. Keep masking visually quiet

The user should not see a loud editing rectangle unless selected.

Recommended approach:

- source mask itself has no border
- `pointer-events: none`
- normal state looks like part of the page
- replacement field may retain its subtle selected/hover treatment
- handles appear only when selected as they do now

The result should feel like the old text has actually disappeared, not like a white sticky note was added.

---

# 4. Immediate visual refresh

After committing an edit:

```text
old text
↓ edit
new text
```

The old text must disappear immediately on the same page.

Do not require:

- changing pages
- closing/reopening the PDF
- Save As
- refreshing FrameChute

Similarly, when Undo removes the edit, the original text should visibly return immediately.

When Redo reapplies it, the original text should disappear immediately again.

---

# 5. Preserve direct manipulation

Example acceptance case:

1. Original PDF contains `HELLO`.
2. User changes it to `GOODBYE`.
3. `HELLO` disappears immediately.
4. User drags `GOODBYE` 100 px to the right.
5. Original `HELLO` area remains blank/masked.
6. User resizes the replacement field.
7. Original source area remains unchanged.
8. User changes font size.
9. Source remains masked.
10. Save As.
11. Reopen saved PDF.
12. Reopened PDF visually matches the live editor within the current cover-and-redraw fidelity boundary.

This is the core benchmark.

---

# 6. Architecture guidance

Prefer a small explicit visual-mask representation rather than repeatedly regenerating the entire PDF file after every pointer movement.

A DOM/source-mask overlay in the PDF text/edit layer is acceptable if it:

- uses PDF-space source geometry converted through the existing viewport helpers
- stays correctly aligned at different viewport scales
- handles rotated pages with the same coordinate conversion path
- does not intercept pointer events
- survives rerender/page navigation through the canonical edit model

Do not duplicate source geometry in CSS-only state. The edit record remains authoritative.

If there is a better small implementation after studying the current code, use it, but preserve the product behavior above.

---

# 7. Undo / Redo expectations

The existing bounded edit history should remain authoritative.

Undo/Redo must visibly update all three aspects together:

- replacement text/content
- replacement geometry/font size
- source mask presence/source geometry

No stale source masks after Undo.
No stale original glyphs after Redo.

---

# 8. Tests

Add focused tests for the pure geometry/state parts where practical.

At minimum verify:

- source geometry remains unchanged while replacement geometry changes
- edit revert/removal removes the mask state
- deletion retains source mask semantics
- page rerender derives source-mask geometry from edit records
- Undo/Redo edit-state restoration produces the expected source/replacement records

Run:

- focused tests
- `node --test tests/*.test.mjs`
- `node --check` on changed JS modules
- `git diff --check`
- Chrome Web Store packaging/release gate

Manual browser acceptance is important here because this is a visual/WYSIWYG bug. Record what was manually verified and what could not be verified.

---

# 9. Scope discipline

Do not expand this pass into:

- OCR
- arbitrary PDF object editing
- background inpainting
- complex source-content-stream rewriting
- font-subset reconstruction
- huge-PDF architecture
- DOCX formatting
- tabs/history
- unrelated image tools

This pass is successful when the live PDF editor stops looking like text is being pasted on top of a frozen screenshot.

---

# 10. Time box / handoff

Use up to 30 minutes of active implementation.

Prefer one coherent WYSIWYG correction over unrelated refactors.

At the 30-minute mark, conclude active implementation and provide a handoff containing:

- completed work
- remaining work
- files changed
- tests run and exact results
- manual browser checks performed
- known limitations / fidelity boundaries
- exact next steps
- branch / commit / PR state

Leave the repository coherent and buildable. Open one clean PR against latest `main` if reviewable.
