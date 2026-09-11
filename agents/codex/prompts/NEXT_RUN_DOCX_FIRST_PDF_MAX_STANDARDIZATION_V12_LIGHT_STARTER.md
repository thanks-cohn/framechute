Read and execute `agents/codex/prompts/NEXT_RUN_DOCX_FIRST_PDF_MAX_STANDARDIZATION_V12.md` on branch `codex/implement-docx-editing-and-context-menu`. Treat V12 as the single authoritative prompt.

DOCX comes first: fix standards-aware numbering including generated `[0001]` and `[Claim 1]` patterns, OMML equation preservation/rendering, real merged-table structure, nested lists/style inheritance, images/drawings, and non-destructive OOXML round-trip. Preserve unsupported package parts instead of silently dropping them. Only after DOCX is materially improved, continue PDF canonical text/image/page-object and save/reopen fidelity.

Also enforce the ordinary FrameChute object right-click menu order exactly: 1) Bring to Center, 2) Save As…, 3) Clone, then a divider and the remaining actions. Use the label Clone, not Duplicate.

Prioritize serialized interoperability over DOM-only appearance. Run full tests, syntax checks, `git diff --check`, and the Web Store packaging gate, then provide a precise handoff.