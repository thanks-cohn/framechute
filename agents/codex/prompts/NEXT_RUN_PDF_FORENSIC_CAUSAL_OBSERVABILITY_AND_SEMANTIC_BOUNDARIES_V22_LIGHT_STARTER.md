Read and execute:

agents/codex/prompts/NEXT_RUN_PDF_FORENSIC_CAUSAL_OBSERVABILITY_AND_SEMANTIC_BOUNDARIES_V22.md

This is a substantial architecture run.

Do NOT reduce it to a cosmetic fix or a handful of logs.

Main goals:

1. Build agent-first forensic observability for the active PDF page:
   identity, geometry, coordinate spaces, transform ancestry, causal ancestry,
   masks, margins, collisions, groups, hit-tests, transient state, save intent,
   and bounded interaction/mutation traces.

2. Fix the currently visible truth failures:
   - typed characters must be visible BEFORE Enter/commit,
   - autofit must shrink as well as grow,
   - moving a field must NOT reveal stale/terminal source glyphs,
   - no later unrelated interaction should be required to clean the page,
   - sourceOwnershipRect must remain separate from layoutRect,
   - one edit must not erase unrelated neighboring source text,
   - original BODY_CONTENT must obey top/bottom/left/right content margins,
   - no partial glyph may survive outside legal bounds,
   - Save/reopen must not resurrect superseded source glyphs,
   - reopening a SAVED PDF must never visibly show the old original text underneath the replacement text,
   - replacement text must appear exactly once visually after round-trip save/reopen.

3. Use the first PDF fixture found under /pdf/ for real canonical integration
   coverage. Do not hard-code its filename and do not mutate it.

4. Preserve OFF / DEBUG / DEEP:
   OFF must stay near-zero-overhead; DEEP may inspect the active page heavily.

Minimum expectation:
- 300 meaningful new/changed implementation lines
- 500–700 is completely acceptable
- tests in addition to implementation

Do not game line count.

Run focused tests, syntax checks, and the full Node suite before opening the PR.
Do not claim browser visual verification if the environment cannot actually run it.
