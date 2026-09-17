Read and execute:

`agents/codex/prompts/NEXT_RUN_PDF_SOURCE_HOVER_EDIT_POLISH_AND_CHROME_STABILITY_V20.md`

Prioritize the native/source PDF hover mismatch first.

The visible source text is painted by the PDF canvas, but the current hover box is being derived from a hidden DOM text surrogate whose font metrics can differ. Replacement text created by Substrate is already accurate because its visible text and measured DOM geometry are the same thing.

Fix the authority split so:

`native PDF source text → PDF.js/source projection authority`

`Substrate replacement/free text → visible DOM glyph authority`

Then finish the interaction polish in the full prompt:

- while actively editing, show only the edit field, never a second hover box;
- plain Enter commits/blurs and does not insert a newline;
- the live edit field grows enough to contain longer text without shrinking font size;
- one click on an existing replacement/free-text object selects it and shows move/resize handles;
- add only a tiny bounded trailing bleed to the live erase mask for terminal line fragments so no source sliver survives;
- make the PDF toolbar enhancer truly idempotent so there are exactly three rows and no duplicated Font/Text size/Undo/Redo/File/Organize/More controls;
- repair the visible Copy controls so they perform a real, truthful content-copy action and report success/failure.

Use the existing V19/V20 diagnostics to prove which geometry authority is used. Do not patch with arbitrary client offsets. Do not serialize browser geometry into PDF records.

Preserve save/reopen parity, masks, semantic identity/provenance, stable toolbar intent, low-memory behavior, and diagnostics OFF by default.

Run the focused tests plus the full Node suite before opening the PR.