# 2026-09-19 01:55 CDT — PDF image insertion and broken document flow

**Status:** Observed bug and proposed next implementation stage; not fixed by this document.  
**Repository:** thanks-cohn/framechute  
**Baseline:** main at 21a201e16a968ef2b27906369ec25807d448f571 (merged PR #96).  
**Area:** PDF image placement, paragraph reconstruction, text wrap/reflow, page layout, edit preview and save.

## What the supplied screenshot shows

In FrameChute's PDF editor, a large inserted underwater image occupies the middle of a dense text page. Text appears squeezed into narrow, overlapping fragments on both sides and below it; several source/replacement passages are visually superimposed, and the page is difficult to read. The editor is showing a collection of positioned objects, not a coherent document that has made room for the image. A horizontal scrollbar is visible. This is a screenshot of the **visible failure**; it does not by itself establish which internal event or saved PDF object first caused the collision.

User expectation: add or move an image into ordinary document text and have the document restructure its *affected text flow* around the image, or move the text below the image when no readable side lane exists. The sentence order and the rest of the page should remain intelligible. A deliberate overlay is a separate, explicit mode.

## Reproduction to confirm

1. Load the sample PDF shown in the screenshot (sample-local-pdf.pdf) or another licensed local multi-paragraph PDF.
2. In EDIT mode, insert an image into the center of a densely filled page. Record whether image wrapping is enabled or disabled; test both rather than assuming the screenshot captures one specific setting.
3. Move and resize the image across multiple text lines, including into a narrow space between page margins. Observe live preview and after releasing the handle.
4. Repeat with an existing text replacement, a newly inserted text field, and an untouched source paragraph. Toggle any available wrap setting.
5. Save, reopen in FrameChute and an external PDF viewer, and compare both against the pre-edit original.

**Actual as reported/visible:** the image and text occupy conflicting areas, line fragments crowd and overlap, and the document does not settle into readable flow.  
**Expected in Flow mode:** words maintain reading order, wrap into legal lanes or clear below the obstacle, carry forward through subsequent lines/pages as needed, and never create unintentional text-on-text or text-on-image collisions.  
**Expected in Overlay mode:** intentional overlap is explicit and stable; it must not be misrepresented as semantic reflow.

## Code inspection: a likely architectural gap, not a proven single-line root cause

The current PDF renderer has an imageWrapEditsForPage function in src/documents/pdf-document.js. It detects source-item rectangles intersecting an image with wrapText enabled and creates a separate wrap edit for each affected PDF.js text item using semanticWrapTarget. It maintains a claimed set of source indices but does not, in that function, implement whole-paragraph reading-order carry across successive lines and pages. The image is rendered as a positioned edit object; imported source text remains on an immutable canvas under DOM replacements and erasure masks.

That item-by-item local approach is a plausible contributor to this screenshot: fixing the geometry of one fragment cannot guarantee the following fragment finds a legal position, and a legal narrow lane may be unreadable. The screenshot alone cannot prove whether a duplicate source presentation, a failed wrap target, an unsupported imported structure, a margin constraint, a paint-order issue, or a particular drag path also contributed. Instrument a minimal reproducer and trace those paths before assigning the final root cause.

Do **not** respond by broadly enlarging the white source masks or shrinking every source text box. A mask hides glyph ink; it does not arrange prose or preserve the document's semantic order. Previous masking fixes already demonstrated how a visually larger white-out region can erase text on the neighboring line.

## Next stage: deterministic, image-aware document flow

Build on Proposals/deterministic-layout-core-and-extractable-js-ts-packages.md and Proposals/foundational-editor-small-controls-image-aware-documents.md. The key is to make the existing layout mathematics govern a *coherent affected region*, not isolated glyph fragments.

### Stage A — make document truth explicit

- Distinguish source glyph ink, immutable source ownership, editable reconstructed text, user-authored text, and image layout objects.
- Determine paragraph/block membership and reading order with confidence. A PDF text-content run is not necessarily a sentence, word, paragraph, or column.
- Keep semantic order separate from visual/paint order. Preserve source IDs and text provenance; edits must never create two visible owners of the same source.
- Define the content rectangle from page margins. Margin settings and source-erasure masks must remain separate.

### Stage B — one small set of flow rules

- Choose Flow versus explicitly intentional Overlay for image placement. Flow is the normal document behavior when the affected text is known to be reconstructable.
- Treat the image plus optional small gutter as an obstacle in the available content rectangle.
- For each intersected line, compute legal horizontal intervals. Use a side lane only when it meets a readable minimum width; otherwise clear below the image.
- Place complete words in order, carry overflow to the next legal line, and continue forward until the affected region stabilizes.
- If the affected content no longer fits on its page, continue into the next page without truncation, duplication, or unintended overlap. If safe pagination cannot be reconstructed, report the limit and leave the original unchanged.
- Recompute as the image moves/resizes; when it is removed, reclaim the released space.
- Use pure layout functions with stable IDs; event handlers request geometry changes and present the resulting layout instead of performing independent ad hoc wrap calculations.

### Stage C — transactional preview and faithful export

- Preview the complete affected layout during manipulation. It must not flicker between unreadable intermediate states or hide the text beneath a white mask.
- Commit a consistent, undoable transaction (image position + affected text assignments + page overflow), not independently persisted line fragments.
- Preserve original PDF content outside the affected region. Mask only source ink that has a legitimate reconstructed replacement. Do not over-erase adjacent lines or columns.
- Save and reopen the resulting PDF in both FrameChute and at least one external viewer. Visible preview, exported geometry, reading order where supported, and document contents must agree.
- On untrusted grouping (scans, complex multi-column reading order, tables, footnotes, forms, exotic embedded fonts), choose a safe explicit fallback or previewed region conversion, not automatic destructive reflow.

## Acceptance matrix

1. **One image in one paragraph:** add a medium image to the middle of a long paragraph; all original words remain once and in order, with no accidental overlap.
2. **No readable lane:** enlarge the image until both side lanes become too narrow; text clears below, not into a column of stacked glyph fragments.
3. **Live drag/resize:** the text rearranges coherently while moving, without turning white or showing the old text beneath the new text.
4. **Across paragraph and page boundaries:** overflow propagates forward when needed; later unrelated content is not arbitrarily moved or deleted.
5. **Near margins and in narrow pages:** all reflowed text honors the page's legal content rectangle. Pixel and percentage margin values are deterministic across zoom.
6. **Column, table, form, and scanned PDFs:** preserve original layout when confident reflow is unavailable; offer explicit safe alternatives and do not mangle cells or reading order.
7. **Overlay opt-in:** when deliberate overlap is selected, it stays intentional, does not masquerade as a reconstructed paragraph, and exports as previewed.
8. **Undo/redo and round-trip:** one undo restores the pre-insertion/drag state; save/reopen reproduces the chosen image and text layout without fragment ghosts.
9. **Performance/accessibility:** reflow only the impacted region where possible, keep keyboard selection possible, and do not silently destroy an available text layer or accessible text order.

## Priority and completion bar

**High; this is the next PDF milestone after text-field interaction stabilization.** The immediate issue is not another missing toolbar button: it is that an ordinary image insertion can make an otherwise readable document unusable.

Do not call this resolved solely because a unit test or extension packaging check passes. Exercise the supplied visual scenario and the matrix above in a real browser, then verify the exported PDF externally. Only after this behaves predictably should the README describe automatic image-aware flow as shipped.

**Out of scope for this stage:** adding large numbers of new toolbar controls, extending Padding beyond page margins, replacing all source PDF objects unconditionally, or implementing a complete Word/Acrobat layout engine.
