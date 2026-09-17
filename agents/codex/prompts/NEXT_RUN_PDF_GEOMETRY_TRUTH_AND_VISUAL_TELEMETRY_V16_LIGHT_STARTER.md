# V16 LIGHT STARTER — PDF GEOMETRY TRUTH

Work from the latest `main` in `thanks-cohn/framechute`.

Read and execute:

`agents/codex/prompts/NEXT_RUN_PDF_GEOMETRY_TRUTH_AND_VISUAL_TELEMETRY_V16.md`

Focus first on the current regression: PDF hover/hit targets and editable text fields are visibly displaced from the glyphs the user actually clicks, and entering edit mode may move the page/chrome. Do not patch this with magic pixel offsets.

Build the geometry truth/telemetry system first: explicit coordinate spaces and transforms, canvas↔text-layer alignment checks, glyph-ink vs DOM rectangles, pointer hit-test dossiers, before/after geometry fingerprints for toolbar/search/edit-control changes, stable issue codes, and smoke tests that prove shared movement vs desynchronization.

Upgrade `Copy Page Diagnostics` so ChatGPT/Codex can determine programmatically what the user saw and exactly where the first geometry divergence occurred.

Preserve existing PDF editing/save behavior, current semantic layout architecture, lazy rendering, terminal source-fragment fix, and current toolbar functionality. Do not reintroduce draggable page-margin guides.
