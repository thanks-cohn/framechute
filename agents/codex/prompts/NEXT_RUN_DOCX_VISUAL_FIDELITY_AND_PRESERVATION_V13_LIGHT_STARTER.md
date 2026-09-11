Work only in GitHub repository `thanks-cohn/framechute`, starting from the latest `main`.

Read and execute:

`agents/codex/prompts/NEXT_RUN_DOCX_VISUAL_FIDELITY_AND_PRESERVATION_V13.md`

Treat V13 as the single authoritative prompt.

This is an implementation run, not a planning run. Modify the actual DOCX parser/model/renderer/preservation/serializer and tests. Do not merely add prompts or audits.

Primary goal: **FrameChute must be able to SEE almost every common DOCX artifact even when it cannot edit it.** Use the capability ladder `editable -> readOnlyRenderable -> preservedFallback -> unsupportedPreserved`. There must be no silent omission state.

Prioritize generic OOXML support for generated numbering, fields/cached results, OMML equations, merged/nested tables, headers/footers, footnotes/endnotes, comments, tracked changes, content controls, DrawingML shapes/text boxes, charts/SmartArt/OLE fallbacks, AlternateContent, images/drawings, sections, bookmarks/cross-references, and unknown-part preservation.

If something cannot be edited, render it read-only. If it cannot be rendered natively, use a safe source fallback/preview. If no fallback exists, show a compact preserved placeholder and keep the original OOXML/relationships/package parts intact.

Also ensure unrelated edits + Save As do not strip unsupported content. Add deterministic DOCX fixtures, visible-render assertions, and round-trip preservation tests.

Do not work on PDF or unrelated features in this run. Run the full test suite, syntax checks, `git diff --check`, and the Chrome Web Store packaging gate, then open a PR and provide the artifact coverage/preservation handoff required by V13.