# Minor Fixes

These are small PDF-editor issues to revisit later. Do not treat this file as a request for a broad PDF architecture rewrite. The current behavior is mostly correct; these are narrow lifecycle/UI cleanup items.

## 1. Reconnect can temporarily restore the ugly extra source row

### Symptom

The compact PDF toolbar correctly shows `Reconnect | Copy`. Clicking **Reconnect** can make the generic source-location bar appear again as an extra row. Clicking **Copy** or otherwise causing the PDF controls to normalize can make that extra row disappear again.

### What appears to be happening

There are two overlapping source UI systems:

- `src/local-source-links.js` owns the compact toolbar source controls for PDFs, galleries, and video.
- `src/source-locations.js` owns the generic `.framechute-source-location` footer used by advanced mode.

Reconnect causes source/handle state to refresh and returns focus to the FrameChute window. `source-locations.js` refreshes/decorates on focus and workspace changes, so it can recreate the generic footer after the PDF toolbar has already been normalized. The PDF polish code then removes/hides it later, which explains the visible flash/extra row and why another action such as Copy can make it disappear.

### Preferred future fix

PDFs should have exactly one source-control owner. The generic source-location decorator should permanently skip PDF blocks, rather than creating the footer and relying on a later PDF-specific cleanup pass to remove it.

The intended invariant should be:

- PDF source UI: compact `Reconnect | Copy` in the PDF toolbar only.
- No `.framechute-source-location` footer should ever be created for a PDF.
- Reconnect, focus changes, handle refreshes, archive import, and workspace refreshes must preserve that invariant.

Avoid solving this with another observer that repeatedly removes the footer after creation. The clean fix is to prevent the generic decorator from creating it for PDFs in the first place.

## 2. End-of-line source glyph residue can return immediately after pressing Enter

### Symptom

While editing PDF text, tiny fragments of the original final glyph/object at the right edge of a line can remain visible. The residue may disappear while editing, then return after pressing **Enter**. If the user leaves FrameChute and comes back, the frame appears to refresh and the residue disappears again.

The important clue is that this is state/lifecycle dependent rather than simply "the bleed is always too short." The same document can look wrong immediately after Enter and correct after a focus refresh without changing the saved PDF.

### Relevant implementation

`src/workspace.js` creates the live erase mask in `createPdfLiveEditMask(textLayer, span)`.

That core function already knows whether the source span is a terminal fragment via `span.dataset.terminalFragment`, but its built-in terminal extension is very small:

```js
const trailingBleed = span.dataset.terminalFragment === "true"
  ? Math.min(3, Math.max(.75, scale))
  : 0;
```

Separately, `src/pdf-light-editor-polish.js` detects terminal masks after the fact and adds a class such as `pdf-terminal-bleed-polish`, which supplies a larger visual right-side cover.

### Likely cause of the Enter-only recurrence

Pressing Enter changes the editable span geometry and causes `createPdfLiveEditMask(...)` to rebuild/replace the live mask. The replacement mask can exist briefly without the terminal-polish class, or the active span's terminal classification can be in transition while the new line geometry is being calculated.

That explains the observed sequence:

1. A terminal mask is classified and the residue is covered.
2. Enter causes the editor to resize/reflow the editable span and replace the live mask.
3. The new mask falls back to the core mask's tiny built-in terminal bleed, so a few original glyph pixels become visible again.
4. Leaving and returning to the window triggers the focus normalization path.
5. Terminal masks are reclassified, the larger cover is restored, and the fragments disappear.

So increasing only the CSS shadow repeatedly is not the ideal long-term fix. The artifact can reappear whenever the mask is rebuilt before the post-processing class is reapplied.

### Preferred future fix

Move the required terminal clearing allowance into the **core mask geometry** itself, where the mask is created, rather than depending on a later CSS classification pass.

In practice:

- Increase the terminal-only `trailingBleed` inside `createPdfLiveEditMask` to the amount actually required by PDF.js glyph overhang/antialiasing.
- Keep the extra reach conditional on `span.dataset.terminalFragment === "true"` so interior edited objects do not erase neighboring text.
- Keep clipping to `textLayer.clientWidth`/page bounds.
- After Enter/input reflow, recreate the mask from the updated span geometry once and let the mask itself already contain the correct terminal extent.
- The semantic/source-line masking path in `src/documents/pdf-document.js` should use the same terminal-edge policy so live editing and settled rendering agree.

This should eliminate the current "wrong immediately after Enter, correct after focus refresh" behavior because correctness would no longer depend on a later normalization event.

## 3. Why focus currently seems to "fix" the PDF

The focus event is acting like an accidental repair pass. PDF/source modules refresh or normalize state on `window.focus`, which can:

- remove duplicate source UI,
- rewrite the compact source-control labels,
- reclassify existing terminal masks,
- and visually restore the intended deleting bleed.

That is useful diagnostic evidence, but focus should not be required for correctness. The eventual cleanup should make the immediate edit/reconnect path produce the same DOM/state that the focus refresh currently produces afterward.

## Scope when revisiting

Keep these fixes narrow. Copying the document currently works and should be left alone. PDF opening should not regain a deep `MutationObserver` over the PDF.js text layer, because that previously caused severe opening/freezing behavior. Any future refresh hook should be tied to the specific edit/reconnect lifecycle rather than scanning every glyph mutation.
