Read and execute `agents/codex/prompts/NEXT_RUN_PDF_PREMIUM_SEMANTIC_EDITOR_AND_READER_V14.md` on the latest `main`. Treat it as the single authoritative prompt for this run.

PR #61 already installed the semantic PDF page model. This run must turn that foundation into the visible product.

The core user experience is:

**Open PDF → click text → type → it stays aligned → nearby text does not get covered → Save.**

Use the semantic line/block/reading-order/collision model, not DOM heuristics. Implement bounded local reflow for ordinary body text: wrap edited text inside its semantic block/column, grow/shrink as needed, and minimally move subsequent lines in the SAME semantic block so they never overlap. Do not move unrelated columns, headings, footers, images, annotations, or unknown content. If a safe layout cannot be proven, preserve the user's text and show a small non-modal fit/space warning instead of overlapping content.



**Standardize every layout-participating text path into one canonical semantic flow form before rendering.** Untouched source text, replacements, free text, displaced/redrawn source lines, and newly-created lines should all become the same internal page → flow-region/column → paragraph/block → line → run representation, with provenance retained but one layout engine deciding geometry. The renderer may still leave untouched source glyphs alone or use masks/redraw for changed text; the original PDF bytes remain authoritative.

For ordinary English prose, apply publishing rules rather than nearest-free-rectangle packing: monotonic reading order, stable paragraphs/columns, consistent leading and paragraph spacing, intact words/punctuation, minimum readable line width, sensible gutters around images, no absurd tiny line fragments, and no text teleporting upward. A dropped image should recompose the affected body flow region cleanly: right-side image → readable text lane on the left; left-side image → readable lane on the right; centered/wide image → text above/below rather than squeezed into ugly slivers. When the image spans several body blocks, reflow that flow region in semantic order while keeping other columns, headers, footers, and unrelated regions fixed.

**Use one obstacle/wrap engine for original and edited text.** If an inserted image is set to wrap/avoid, source text, replacement text, reflowed source lines, and newly-created lines in that semantic paragraph must all use the same image geometry and the same available horizontal lanes. Replacement text must never draw across an image while the original text wraps, and it must not "solve" the collision by jumping awkwardly upward or into an unrelated free rectangle. Reflow the affected semantic block in reading order: flow beside the image where a valid lane exists, then continue normally below it. If no safe lane exists, stop before overlap and show the quiet space/overflow state.

**Never silently change the user's font size to make text fit.** Font size remains exactly what the user selected until they change it.

Keep the existing conservative source-mask/cover-and-redraw PDF strategy and WYSIWYG save semantics. Reflowed source lines must be masked/redrawn safely rather than rewriting arbitrary PDF content streams.

Also make the PDF reader/editor look finished and premium: page-first design, compact primary navigation, contextual text/image controls, secondary commands in overflow/popdowns, and no broken multi-row button pile when the PDF block is narrow. Editing should require almost no ceremony; the page should look like a clean reader whenever nothing is selected.

Preserve existing image editing, page operations, search, links/annotations, history, Save/Save As, and PDF-space geometry. Keep the semantic model lazy and low-memory.

Add regression tests for long edits, same-block displacement, two-column isolation, headings/footers, unknown-content blocking, sticky font size, undo/redo, save/reopen, and narrow-toolbar behavior. Run the full PDF/repo test/check/package gates, manually exercise the visible editing loop where possible, and open one clean PR against latest `main`.
