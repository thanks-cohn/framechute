# V15.3 LIGHT STARTER — PDF FORENSIC OBSERVABILITY

Read and execute:

`agents/codex/prompts/FOLLOW_UP_PDF_FORENSIC_OBSERVABILITY_V15_3.md`

from the latest `main`.

Treat that file as the **single authoritative prompt** for this run.

Then inspect **PR #68** in full and use its **exact current head as the immutable foundation**. Do **not** modify or push to PR #68. Create a new follow-up branch from PR #68's head and implement V15.3 there. Build on the existing PR #68 stable-ID, geometry, current-version, mask-ownership, semantic-search, Save/reopen, reconciliation, and diagnostics work rather than starting over or restarting from `main`.

Do not optimize for a tiny patch. If the best implementation genuinely requires roughly **500–900 lines of meaningful code, tests, helpers, forensic event plumbing, invariant/error codes, DOM/glyph measurements, hover-state comparison, and documentation**, write them. Do not add filler, but do not compress away important observability merely to keep the diff small.

The goal is the strongest mathematically explicit, agent-readable PDF flight recorder we can reasonably build while remaining safe on a **4 GB computer**: dormant/nearly free by default, current-page scoped when active, bounded ring buffers, no screenshots, no PDF byte copies, no unbounded logs, and no eager whole-document instrumentation.

**Before-hover vs during-hover text position is a hard requirement.** For the same stable text object, capture canonical PDF geometry, expected viewport geometry, actual DOM geometry, actual glyph/ink geometry, baseline, transforms, stacking, visibility, pointer eligibility, masks, and exact numeric deltas before and during hover. An agent must be able to prove whether text moved, which representation moved, by how much, and why.

Make every meaningful state/artifact mathematically attributable: identities, coordinate spaces, transforms, masks, layers, lifecycle/current-version status, search/extraction/save eligibility, collisions, Save/reopen correspondence, state transitions, causal transactions, and structured error/invariant codes.

Run every test/check required by the authoritative prompt. At the end, push the new branch and open a **new stacked follow-up PR** based on the PR #68 branch (`codex/update-pr-#67-for-pdf-agent-observability`) so the diff contains only V15.3 work. Leave PR #68 untouched. The final handoff must include the new branch and new PR number/link.
