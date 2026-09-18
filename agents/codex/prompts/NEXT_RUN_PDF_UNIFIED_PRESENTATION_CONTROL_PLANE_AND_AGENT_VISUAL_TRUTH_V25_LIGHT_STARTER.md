Read and execute:

agents/codex/prompts/NEXT_RUN_PDF_UNIFIED_PRESENTATION_CONTROL_PLANE_AND_AGENT_VISUAL_TRUTH_V25.md

This is a consolidation run.

Do NOT add another disconnected PDF layer.

Primary goal:

Make one canonical PdfPresentationPlan control source glyphs, live edit text,
committed replacements, masks, controls, collisions, and diagnostics.

Hard law:

ONE semantic source identity
=
AT MOST ONE visible textual presentation.

Build an Agent Page Mirror from that same plan so an authorized agent can inspect
the exact active-page truth without relying on screenshots.

Required:

- source/live/replacement visibility states
- mask-before-text gates
- unchanged clicks create no replacement
- historical objects never render
- generation coherence becomes enforceable
- collision classification
- inspectObject()
- explainPoint()
- validatePresentation()
- Copy PDF Diagnostics includes plan + mirror + invariants
- use pdf/sample-local-pdf.pdf in real regression coverage

Do not merely log impossible states.
Prevent them from being painted.

Run focused PDF tests, all pdf-* tests, and the full Node suite.

Do not claim browser visual verification unless a real browser was actually used.
