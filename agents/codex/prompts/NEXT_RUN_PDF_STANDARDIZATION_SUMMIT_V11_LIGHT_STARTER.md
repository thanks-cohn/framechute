Read and execute `agents/codex/prompts/NEXT_RUN_PDF_STANDARDIZATION_SUMMIT_V11.md` on the latest `main`. Treat it as the single authoritative prompt for this run.

The goal is to push FrameChute's PDF editor as far as safely possible toward normal, successful PDF standardization. The non-negotiable invariant is:

**Open a PDF → change one thing → save it → everything unrelated remains intact.**

Prioritize semantic state correctness, exact text/whitespace persistence, safe existing-text replacement, font/substitution correctness, image insertion/move/resize, page geometry/rotation/reordering, links/annotations, undo/redo, save/reopen fidelity, and conservative handling of unsupported PDF features. Do not fake Acrobat-style support by destructively rewriting, flattening, rasterizing, or silently stripping content FrameChute does not understand.

Preserve all merged V10 behavior and the post-V10 fixes, especially the free-text state-loss fix, direct PDF image manipulation, drag ownership/overlay rules, and PDF link-deletion setting. Add regression tests around real round-trip invariants, run the full test/check/package gates, exercise the PDF UI interactively wherever the runtime permits, and state clearly what remains unsupported or externally unverified.

Do not begin CSV, 3D, broad workspace redesign, or the DOCX image-wrap milestone in this run.