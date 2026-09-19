# CODEX LIGHT STARTER — PDF/DOCX open-once persistence and automatic recovery

Read and follow the full, authoritative run specification at:

`agents/codex/prompts/NEXT_RUN_PDF_DOCX_OPEN_ONCE_PERSISTENCE_RESTORE.md`

Repository: `thanks-cohn/framechute` (SUBSTRATE).

Implement that specification end to end on a dedicated branch. Inspect the current code and existing tests before editing; preserve all current PDF, DOCX, image, workspace, FCX, and save functionality. The objective is to reopen PDFs and DOCX automatically after leaving/restarting the extension without routinely reconnecting unchanged source files. Fix the underlying working-copy, persistence, and restore paths, not the button or file location.

Add focused automated regression tests, run the relevant and full test suites where possible, report actual results and any unverified browser/manual scenarios, and open a PR with the implementation and test evidence. **Do not merge automatically.** Do not implement the ZIP/CBZ reader, IMX, new UI features, or unrelated refactors.

The full specification is the source of truth; this is only the entrypoint.
