# NEXT RUN — PDF RUNTIME TRUTH, REOPEN HYDRATION, MARGIN ENFORCEMENT + FORENSIC COMPLETION V23

## Mission

V22 / PR #80 is now merged into main. It added the forensic foundation: pdf-forensics.js, causal journals, generation clocks, bidirectional autofit logic, mask ownership auditing, semantic margin reconciliation, save-intent ledgers, relationship/collision graphs, and agent query helpers.

This run must finish the job in the actual runtime.

The target is simple:

> The live editor, current semantic model, manipulation state, margin system, Save output, and reopened PDF must all describe the same current document.

Nothing should be correct only after Enter.
Nothing should be correct only after a later rerender.
Nothing should resurrect after Save.
Nothing historical should be interactive.
Nothing original should bypass layout law merely because it came from the imported PDF.

## Size / quality bar

Do not solve this with a tiny patch.

Minimum expectation:
- at least 300 meaningful new or changed implementation lines
- plus focused tests

500–700 implementation lines is completely acceptable.
800–1200+ is also acceptable if genuinely required.

Do not game line count with comments, blank lines, duplicate logic, or boilerplate.
Do not avoid a correct architecture because it is larger.

## Start from latest main

Read the merged V22 code first. Inspect at minimum:

- src/documents/pdf-document.js
- src/documents/pdf-forensics.js
- src/documents/pdf-observability.js
- src/documents/pdf-layout.js
- src/documents/pdf-layout-bounds.js
- src/documents/pdf-content-groups.js
- src/documents/pdf-geometry.js
- src/workspace.js
- src/workspace.css
- relevant PDF tests

Preserve V22. Do not replace it with ad-hoc logging.

## Runtime failures that must be closed

1. Saved/reopened current replacements are not always hydrated into runtime.edits.
2. Reopened saved replacements can behave like anonymous source text until mutated.
3. Double-click manipulation can bypass the normal commit path.
4. Original BODY_CONTENT can still bypass margin enforcement.
5. Live autofit can use the whole text layer instead of the actual contentRect.
6. Moving a replacement can reveal stale source glyphs.
7. A later unrelated action can make stale glyphs disappear, proving the earlier visual state was stale.
8. Saved/reopened PDFs can still expose old source text behind or underneath current replacements.
9. Historical/superseded source is still too close to the current interactive layer.
10. V22 causal journals and generation clocks are not sufficiently wired into the real editor lifecycle.
11. Some V22 behavior exists as pure helper architecture/tests rather than actual product behavior.

## Central runtime law

There is exactly one current document truth.

Historical data may be retained for future version history, but historical objects must never be:
- rendered as current
- hit-testable
- hoverable
- editable
- selectable
- draggable
- resizable
- searchable as current
- collision-active
- layout-active
- silently resurrected by Save/reopen

## 1. Reopen hydration is mandatory

When openPdfDocument() finds a saved current-version manifest, hydrate those current objects into canonical runtime edit objects.

Create a clear adapter such as:

hydrateReopenedPdfCurrentObjects(model)

or an equivalent design.

Preserve, as available:
- id
- kind
- page
- sourceObjectId
- sourceLineId
- text / replacement
- layout rect
- source ownership geometry
- font size
- font family when known
- rotation
- versionState=current
- semantic membership
- manipulation capability

Hydrated objects must keep stable IDs from saved metadata.

Do not mint new identities merely because a PDF was reopened.

## 2. Wire hydration into both load paths

Update:
- loadPdfHandle()
- loadPdfBytes()

The runtime edit set must become:

workspace-restored current edits
+
manifest-hydrated current objects not already represented

Deduplicate deterministically by stable object/source identity.

Do not create duplicate current objects when a workspace snapshot already contains them.

Acceptance:
- edit a source field
- save PDF
- close
- reopen saved PDF from disk
- type nothing
- inspect runtime
- the current replacement is already in runtime.edits

## 3. Current/historical quarantine

Keep current objects and historical/version data separate.

History must be explicit data, never hidden live fields underneath current content.

Strengthen diagnostics/invariants for:
- PDF_CURRENT_VIEW_HAS_SINGLE_VERSION_TRUTH
- PDF_HISTORICAL_OBJECT_RENDERED_IN_CURRENT_VIEW
- PDF_HISTORICAL_OBJECT_HIT_TESTABLE
- PDF_HISTORICAL_OBJECT_EDITABLE
- PDF_REOPENED_REPLACEMENT_HAS_HIDDEN_LEGACY_FIELD
- PDF_MULTIPLE_CURRENT_OBJECTS_FOR_ONE_SOURCE

Diagnostics should answer, for every source identity:
- current object ID
- superseded IDs
- render-authoritative object
- edit-authoritative object
- whether any historical object has a live DOM node
- whether any historical object receives pointer events

## 4. Interaction grammar

Mandatory contract:

Single click = edit text.
Double click = manipulate geometry.

For current text objects, including reopened saved replacements:

Single click:
- enter editing
- show caret
- current text visible immediately
- no typing required to activate current state

Double click:
- safely commit active editing first if needed
- enter manipulation state
- show move handle
- show resize handle
- no text mutation required

## 5. Explicit interaction state machine

Use a clear state model such as:

idle
editing
manipulating

Transitions should be deterministic.

Suggested behavior:

idle + single click -> editing
idle + double click -> manipulating
editing + double click -> commit -> manipulating
editing + Enter -> commit -> idle
editing + Escape -> cancel -> idle
manipulating + single click -> editing
Escape -> idle

Do not let "selected" ambiguously stand for every state.

Record these transitions in the forensic journal.

## 6. Fix the double-click commit hazard

Current code can remove contenteditable before the normal focusout commit path has safely consumed live text.

Fix this structurally.

Create one canonical commit helper, for example:

commitPdfTextEdit(...)

Use it for:
- Enter
- focusout
- editing -> manipulating transition
- Save while editing
- page change while editing
- toolbar actions that require committed state

Do not duplicate commit logic.

Acceptance:
single click -> type ABC -> immediately double click

Result:
- ABC remains
- runtime edit contains ABC
- manipulation handles appear
- geometry remains coherent
- old source does not reappear

## 7. Live input is authoritative before commit

During editing:
- typed characters appear immediately
- Backspace/Delete update immediately
- current string is visible before Enter
- active field is presentation authority
- source canvas glyphs must not win visually over the active field

Track in diagnostics:
- liveText
- committedText
- editingObjectId
- sourceOwnershipRect
- live layoutRect
- active mask IDs
- current render/mask/replacement generations

## 8. Use the real margin contentRect for live autofit

Keep calculatePdfTextAutofit().

But do not constrain it against the entire text layer.

Take the active canonical page contentRect from margin/layout state and project it into the viewport/CSS coordinate space used by the live edit field.

The same legal bounds must govern:
- live typing
- commit
- move
- resize
- Save geometry

No live-vs-committed mismatch caused by different bounds.

## 9. Bidirectional autofit

Required behavior:

add characters -> grow if required
remove characters -> shrink when possible
wrap -> height grows
delete enough text -> unwrap -> height shrinks

Never silently shrink font size.

Keep a small interaction floor.

Distinguish:
- automatic size
- explicit user-resized size
- minimum interaction size

Do not use original source width as a permanent minimum unless explicitly locked by the user.

## 10. Source ownership remains immutable

Preserve V22 law:

Layout occupancy is not erasure authority.

Keep separately:
- sourceOwnershipRect
- layoutRect

Move:
- layoutRect moves
- sourceOwnershipRect does not

Grow/shrink:
- layoutRect changes
- sourceOwnershipRect does not

Resize:
- layoutRect changes
- sourceOwnershipRect does not expand

Add runtime mutation tests, not only pure helper tests.

## 11. Moving a field must never reveal old glyphs

Reproduce and eliminate the observed bug:

moving a replacement reveals stale original/terminal glyphs, which may remain until another action causes them to disappear.

During pointer movement:
- source mask remains fixed to immutable source ownership
- replacement moves independently
- source visibility must not change
- mask state must not temporarily vanish or use stale geometry
- page should already be correct before pointerup
- pointerup must not be the first correct frame

Critical invariant:

A later unrelated interaction must never be required to make the page visually correct.

## 12. Wire generation synchronization into runtime

Use V22 generation clock for real runtime state.

Track at minimum:
- semantic generation
- render generation
- mask generation
- replacement generation

Advance/record them during:
- input
- commit
- move
- resize
- mask regeneration
- rerender
- Save
- reopen/hydration

Detect:
- PDF_MOVE_MASK_DESYNCHRONIZED
- PDF_LIVE_STATE_WAITING_FOR_FUTURE_RERENDER
- PDF_RERENDER_CHANGED_VISIBILITY_WITHOUT_SEMANTIC_CHANGE

If a rerender changes visibility without semantic state changing, flag it.

## 13. Wire causal journal into actual runtime

Use createPdfCausalJournal() in DEBUG/DEEP for actual events.

Trace at minimum:
- hover target
- click selection
- edit begin
- input
- Backspace/Delete
- autofit
- commit
- cancel
- manipulation begin
- move update
- move end
- resize update
- resize end
- margin clamp
- mask generation
- rerender
- Save
- reopen/hydration

Each mutation record should include:
- objectId
- cause
- before
- requested
- actual
- constraints
- downstream effects
- generation snapshot

OFF mode must remain cheap.

## 14. Source BODY_CONTENT must actually obey margins

V22 added reconcileSemanticPageToContentBounds().

Do not leave it test-only.

Wire it into the active semantic page pipeline.

Classify source content as:
- BODY_CONTENT
- HEADER
- FOOTER
- PAGE_NUMBER
- WATERMARK
- BACKGROUND
- PRINT_MARK
- UNKNOWN_PAGE_FURNITURE

BODY_CONTENT obeys contentRect regardless of whether it came from the original PDF or Substrate.

Page furniture may have explicit allowOutsideContentBounds=true.

Original provenance is not an exemption.

## 15. Reconcile coherent units, not random glyphs

When source BODY_CONTENT violates bounds, prefer:

Text Block
then line
then run only as last resort

If a coherent block fits after translation:
- move it inward
- preserve member-local geometry

If movement creates downstream pressure:
- record reflow/displacement requirement

If it cannot fit:
- report structured overflow

Never:
- clip partial glyphs
- shove individual letters around
- silently delete content

## 16. Actually render reconciled semantic geometry

Do not only report source-margin violations while still rendering the old out-of-bounds source.

The visible current model must reflect the reconciled geometry.

If a source block must be moved but the original canvas cannot move it directly:
- suppress/mask its superseded source presentation
- render the coherent current reconstructed block at legal geometry

Do not leave invalid source text visible outside margins.

## 17. All four margins

Cover:
- top
- bottom
- left
- right
- partial glyph crossing
- multi-run line
- multi-line block
- header/footer/page furniture exemption

No edge gets special treatment.

## 18. Saved PDF must expose current truth

The saved/reopened current document must not behave like:

old original text underneath
+
new replacement painted on top
+
hidden old editable field waiting to be clicked

A reopened Substrate-saved PDF must expose only the current replacement as current editable truth.

Old source may remain only as explicit historical/version evidence if needed for future restore.

It must not be:
- live
- hit-testable
- editable
- current-searchable
- collision-active
- layout-active

## 19. Use a stronger save strategy if required

Do not preserve "original bytes + white rectangle + redraw" merely because it is simple if that strategy cannot satisfy current-document truth.

If masking alone cannot guarantee the required semantics on reopen, implement the stronger strategy needed for edited regions.

Possible directions include:
- canonical reconstruction of affected text regions
- replacement/rewriting of affected page content streams
- selective page regeneration
- stronger current-version filtering combined with canonical redraw
- another deterministic approach

Do not rasterize the whole page as an easy escape unless absolutely necessary and explicitly justified.

Preserve untouched content where possible.

Acceptance criteria matter more than protecting a flawed implementation technique.

## 20. Current manifest vs version history

Saved artifact may contain:
- normal PDF presentation
- current semantic manifest
- optional historical/version manifest

But these roles must be explicit.

Current manifest:
- exactly one current object/version per source identity
- authoritative for Substrate reopen
- immediately editable/manipulable

Historical manifest:
- optional
- never current
- not rendered by default
- not hit-testable
- restored only through future explicit version-history action

## 21. Mandatory actual serialize/reopen regression

Add a real round-trip test using serializeEditedPdf().

Sequence:
1. open fixture PDF
2. choose a real source text run
3. create a replacement
4. serialize
5. reopen returned bytes
6. parse current-version metadata
7. reconcile current/historical source
8. hydrate current runtime object

Verify:
- replacement exists exactly once as current
- old source is superseded/historical
- old source is not current
- no duplicate current object exists
- stable object ID survives
- sourceOwnershipRect survives
- layout geometry survives within tolerance
- current search returns replacement, not superseded text
- hydration produces a real editable/manipulable current object

A pure save-intent-ledger test is not enough.

## 22. Real PDF fixture

Use the first PDF found under /pdf/.

Do not hard-code its filename.
Never mutate it.

Use it for at least one real edit -> save -> reopen integration path.

If real browser rendering is unavailable, still prove semantic current/historical state and canonical geometry.

## 23. Reopened replacements must be real manipulable objects

After reopen:
- current replacement renders as a real current edit object
- move handle exists
- resize handle exists
- object is tied to hydrated runtime edit
- no typing required

Do not render a manifest-known replacement merely as anonymous source text.

## 24. Save while editing

If Save is clicked while a field is actively editing:
- commit current live text first
- update geometry
- update masks/state
- serialize the current visible truth

Never save stale committed text while newer visible text exists only in DOM.

Add test coverage.

## 25. Page change while editing

If user changes page while editing:
- commit current text before leaving page
- never silently drop live text
- no detached stale editable state remains
- forensic journal records the transition

## 26. Undo/redo coherence

Undo/redo must restore a coherent set:
- text
- layoutRect
- sourceOwnershipRect
- mask plan
- version state
- interaction state

Undo must never make superseded source and current replacement simultaneously current.

## 27. Mask ownership remains the same live and saved

Live and Save must share canonical source ownership.

For a replacement:
- source mask covers owned source
- layout rect is current occupancy
- move does not move source mask
- resize does not enlarge source erase authority
- terminal bleed is bounded and ownership-aware

No field mask may regain accidental erasure authority.

## 28. Terminal glyph regression

Keep enforcing:
- PDF_TERMINAL_GLYPH_REMNANT
- PDF_SOURCE_MASK_UNDERCOVERAGE
- PDF_SOURCE_MASK_OVERCOVERAGE

Add an actual move regression:

replace terminal source run
-> move replacement
-> sample during move
-> pointerup
-> rerender

At no phase may superseded terminal glyphs become visible.

## 29. Live / Save / Reopen parity

Compare:
- live layout rect
- committed canonical rect
- serialized rect
- reopened hydrated rect

Classify:
- exact
- within tolerance
- drift
- missing
- duplicate
- historical resurrection

No silent drift.

## 30. Agent diagnostics must include runtime truth

Page diagnostics should expose:
- hoveredObjectId
- selectedObjectId
- editingObjectId
- manipulatingObjectId
- semantic generation
- render generation
- mask generation
- replacement generation
- contentRect
- sourceOwnershipRect
- layoutRect
- current/historical identity
- recent causal events
- save intent
- reopen/hydration status

An agent should be able to answer:
"Why did moving this field reveal old glyphs?"
without guessing from a screenshot.

## 31. Performance

OFF:
- no full forensic snapshots
- no event journal growth
- no continuous glyph scans
- no all-pages traversal

DEBUG/DEEP:
- active page only
- bounded journals
- sampled pointer movement
- lazy expensive observations

Do not regress large-PDF behavior.

## 32. Required test matrix

Hydration:
- manifest -> runtime edits
- stable IDs
- dedup with workspace state

Interaction:
- single click edit
- double click manipulate
- editing -> manipulating commits safely
- reopened object requires no mutation

Autofit:
- grow
- shrink
- wrap
- unwrap
- actual margin contentRect
- user size lock

Ownership:
- move does not move sourceOwnershipRect
- growth does not enlarge ownership
- neighboring source survives

Move:
- no stale glyph reveal
- no later action required to clean state
- generation sync

Margins:
- source BODY_CONTENT top/bottom/left/right
- coherent block translation
- page furniture exemption
- overflow

Save/reopen:
- serializeEditedPdf round trip
- current replacement exactly once
- old source non-current
- hydrated manipulation capability
- stable geometry
- current search truth

Performance:
- OFF cheap/no journal growth
- DEBUG/DEEP bounded

## 33. Acceptance scenario A — reopen

open original PDF
-> edit source field
-> save
-> close
-> reopen saved PDF

Without typing:
- replacement visible
- old source not visible as current
- old source not interactive
- single click edits
- double click manipulates
- stable current identity preserved

## 34. Acceptance scenario B — edit to manipulate

single click field
-> type ABC
-> double click immediately

Expected:
- ABC committed
- handles visible
- manipulation active
- source stays hidden
- no duplicate history/current state

## 35. Acceptance scenario C — move

double click current field
-> drag move handle

During drag and after release:
- old source never flashes
- source mask stays fixed at owned source
- layoutRect moves
- no later action is needed to clean page
- generations remain coherent

## 36. Acceptance scenario D — margins

Take ordinary original BODY_CONTENT outside each margin.

With constraints enabled:
- violation is classified
- current semantic layout reconciles it
- live rendering reflects corrected geometry
- no partial glyph remains outside
- save/reopen preserves corrected current truth

## 37. Acceptance scenario E — save while editing

single click
-> type new text
-> do not press Enter
-> click Save
-> reopen

Saved PDF must contain the current visible text.

## Architectural laws

1. Exactly one current semantic truth.
2. Historical data is never live by default.
3. Reopened current objects hydrate immediately.
4. Single click edits; double click manipulates.
5. Editing -> manipulation commits safely.
6. Live input and committed layout use the same content bounds.
7. Source ownership and layout occupancy remain separate.
8. Moving replacement never moves source ownership.
9. A later unrelated action is never required to correct visuals.
10. Generation desynchronization is observable and is a bug.
11. Original BODY_CONTENT obeys margins like authored BODY_CONTENT.
12. Page furniture exemptions are explicit.
13. Partial glyphs outside legal content bounds are failures.
14. Save serializes current truth, not accidental source leftovers.
15. Reopen preserves current identity and manipulation capability.
16. No hidden historical field waits underneath current replacement.
17. OFF mode remains cheap.
18. Real fixture participates in edit/save/reopen regression.

## Final deliverable

At the end of this run:

OPEN -> current objects hydrate
SINGLE CLICK -> edit
TYPE -> visible immediately
BACKSPACE -> shrink when appropriate
DOUBLE CLICK -> commit safely -> move/resize available
MOVE -> old source never flashes
MARGINS -> source and authored BODY_CONTENT obey same contentRect
SAVE -> current visible truth serialized
REOPEN -> replacement appears exactly once and is immediately editable/manipulable

The forensic system must explain the chain:
who, what, when, where, why, how large, coordinate space, ownership, constraint, generation, and saved disposition.

Do not stop because a helper exists.

Wire it into the real product path and prove the round trip.
