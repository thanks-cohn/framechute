Read and execute:

agents/codex/prompts/NEXT_RUN_PDF_RUNTIME_TRUTH_REOPEN_AND_MARGIN_COMPLETION_V23.md

V22 / PR #80 is already merged into main.

This is a completion/integration run, not a redesign.

Do NOT shrink the task to a cosmetic patch.

Minimum:
- 300 meaningful new/changed implementation lines
- tests in addition to implementation

500–700 lines is completely acceptable.
800–1200+ is also acceptable if required for a coherent solution.
Do not shy away from the amount of code needed to make the runtime correct.

Primary goals:

1. Hydrate saved/reopened current PDF replacements into runtime.edits immediately.
   Reopened saved fields must already be real editable/manipulable objects.

2. Enforce the interaction grammar:
   - single click edits text
   - double click safely commits current text and enters manipulation
   - move/resize handles appear without requiring a new character

3. Create one canonical text-commit path used by focusout, Enter, double-click
   transition, Save, and page change so live text is never lost.

4. Use the actual margin contentRect for live autofit. Live typing, commit,
   move, resize, and Save must use the same legal bounds.

5. Wire V22 semantic source-margin reconciliation into the real runtime.
   Original BODY_CONTENT must obey top/bottom/left/right margins just like
   authored content. Page furniture exemptions must be explicit.

6. Eliminate stale source-glyph resurrection during move.
   A later unrelated action must never be required to make the page correct.

7. Wire the V22 causal journal and generation clock into actual DEBUG/DEEP
   runtime events so edit/move/mask/rerender/save/reopen state is explainable.

8. Make Save/reopen preserve one current truth:
   - replacement exactly once
   - old source historical/non-live
   - no hidden editable field underneath
   - stable identity/geometry
   - manipulation works immediately after reopen

9. Add a real serializeEditedPdf -> reopen round-trip regression using the
   first PDF under /pdf/. Do not hard-code its filename or mutate it.

10. Preserve OFF-mode performance and do not claim browser visual verification
    if no real browser was used.

Run syntax checks, focused PDF tests, the real fixture round-trip test, and the
full Node test suite before opening the PR.
