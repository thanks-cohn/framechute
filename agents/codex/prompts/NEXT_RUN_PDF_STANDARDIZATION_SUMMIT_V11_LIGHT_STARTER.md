Read and execute `agents/codex/prompts/NEXT_RUN_PDF_STANDARDIZATION_SUMMIT_V11.md` on the latest `main`. Treat it as the single authoritative prompt for this run.

The goal is to push FrameChute's PDF editor as far as safely possible toward a normal, standardized document-editing experience, and to bring its **basic everyday editing UX as close to DOCX as the PDF format safely allows**.

The non-negotiable invariant is:

**Open a PDF → change one thing → save it → everything unrelated remains intact.**

Core behaviors for this run include reliable text editing and formatting, exact whitespace persistence, direct image insertion and manipulation, page operations, undo/redo, links/annotations, and save/reopen fidelity. In particular, a user must be able to **drag an image from the OS/desktop or FrameChute workspace directly onto a PDF page, have it insert exactly once at the drop location, select it, move it, resize it inside the PDF, delete it, undo/redo it, and save/reopen with the same geometry**. Same-PDF image dragging is MOVE of the same semantic object; cross-container/external insertion is COPY. Preserve aspect ratio by default.

Aim for practical DOCX parity where the formats overlap: select/edit text, add text, font family/size and supported style/color, move/resize FrameChute-owned text fields, insert/select/move/resize images, ordinary deletion, discoverable context menus/toolbars, and predictable Save/Save As. Do **not** fake Word-like flow, wrapping, arbitrary embedded-font editing, or other semantics PDF cannot safely support.

Prioritize semantic state correctness, conservative existing-text replacement, font/substitution safety, page geometry/rotation/reordering, correct drop coordinates, one-gesture/one-undo-step behavior, and non-destruction of unrelated PDF content. Do not achieve feature parity by flattening/rasterizing the whole PDF or silently stripping links, annotations, forms, metadata, vector content, page boxes, or unsupported features.

Preserve all merged V10 and post-V10 fixes, especially the free-text state-loss fix, image drag ownership, no `Drop into FrameChute` overlay on PDF destinations, and the PDF link-deletion setting. Add regression tests around real round-trip invariants, run the full test/check/package gates, exercise the PDF UI interactively wherever the runtime permits, and clearly report anything unsupported or not manually verified.

Do not begin CSV, 3D, broad workspace redesign, or the DOCX image-wrap milestone in this run.