Read and execute:

`agents/codex/prompts/NEXT_RUN_PDF_READER_EDITOR_ELEVATION_V18.md`

Prioritize correctness before breadth.

Start by using the new PDF visual scene diagnostics to prove that visible glyph ink, hover/hit boxes, selected fields, and editable fields remain aligned through hover, click, focus, contenteditable activation, and selection. Fix the first real divergence you can measure. Do not patch with arbitrary offsets.

Then elevate the reader without destabilizing it: crisp DPR rendering, stable zoom/fitting, predictable navigation, progressive search, lazy thumbnails/outline, bounded large-document resource usage, natural text selection/copy, and reliable save/reopen parity.

Preserve the stable three-row PDF toolbar, current semantic layout, current-version identity/provenance, masks, terminal-fragment fix, and low-memory design. Do not reintroduce margin/page-guide overlays.

The product target is simple:

`open → read → search → click exactly what you see → edit in place → save → reopen → looks the same`

Keep normal diagnostics OFF and cheap; use DEBUG/DEEP only when requested. Make `Copy Page Diagnostics` sufficient for ChatGPT/Codex to explain visual mismatches mathematically without needing screenshots when geometry evidence is enough.
