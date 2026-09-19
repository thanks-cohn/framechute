# FrameChute Persistence Audit & Codex Implementation Brief

## Objective

Refactor FrameChute persistence so **IndexedDB is no longer the only authoritative store for anything required to restore a workspace**.

The new model must support two persistence backends through one common contract:

1. **Browser cache:** IndexedDB
2. **Durable archive:** a user-selected external FrameChute folder

When an external folder has been selected, FrameChute must ingest, save, autosave, restore, and recover through **both systems**, with the external folder acting as the durable source of truth.

The defining recovery requirement is:

> Delete or completely lose FrameChute's IndexedDB, reconnect the same external FrameChute folder, and FrameChute should rebuild itself and behave as though the IndexedDB loss never happened.

---

# 1. Current-State Audit

## IndexedDB currently owns too much

`src/persistence.js` defines a database named `flashframe` containing:

- `snapshots`
- `handles`
- `content`

Named and live snapshots depend primarily on this database.

This means browser/profile damage can make saved FrameChutes disappear.

## External archive exists, but is currently only partial

`src/archive.js` already allows the user to select a writable external folder and currently creates:

```text
<FrameChute folder>/
├── live/
└── sessions/
```

It stores named and live `.flashframe.json` files there.

It also externalizes workspace background-image blobs into an `assets` directory.

This proves the browser can already write durable project data outside extension storage.

The architecture should be expanded rather than replaced.

## Archive mirroring is currently secondary and asynchronous

`archive-bridge.js` currently treats IndexedDB as the primary save and schedules external mirroring afterward using a short timeout.

The archive therefore behaves as a best-effort mirror rather than the authoritative durable storage layer.

This needs to change.

## Dropped image bytes still live only in IndexedDB

`file-access.js` handles browser-created/synthetic image drops by writing the actual Blob to the IndexedDB `content` store and a synthetic marker into the `handles` store.

This allows restart recovery while IndexedDB survives, but the image itself disappears if IndexedDB disappears.

This is one of the clearest examples of data that must move into the external contract.

## Live-state code bypasses a persistence abstraction

`live-state.js` directly opens:

```js
indexedDB.open("flashframe", 1)
```

to inspect saved handles by name.

This directly couples workspace recovery to IndexedDB and must be removed from application-level code.

No feature-level code should know which persistence backend contains an asset.

## Existing design documentation assumes handles remain browser-local

The current state model explicitly describes:

```text
snapshot.handleKey
      ↓
IndexedDB
      ↓
FileSystemHandle
```

and considers portable relinking acceptable.

That assumption must be revised for the new durable mode.

---

# 2. New Architectural Rule

Introduce one canonical persistence layer.

Application code should stop thinking in terms of:

```text
IndexedDB
external archive
FileSystemHandle
Blob storage
```

and instead think in terms of:

```text
FrameChute Storage Contract
```

For example:

```js
await storeAsset(asset)
await resolveAsset(assetId)

await saveFrame(snapshot)
await getFrame(snapshotId)
await listFrames()
```

The storage layer decides where data comes from.

---

# 3. Backend Model

## Browser-only mode

Before an external folder has been selected:

```text
ingest
  ↓
IndexedDB
```

This remains useful for immediate zero-setup use.

The UI should identify it as temporary/browser storage.

Suggested language:

> Browser storage can be cleared by Chrome. Choose a FrameChute folder for durable saves.

Do not prevent the user from using FrameChute without selecting a folder.

## Durable mode

Once an external FrameChute folder is selected:

```text
                       ┌── IndexedDB cache
ingest / save ─────────┤
                       └── external FrameChute archive
```

The external archive becomes authoritative.

IndexedDB becomes:

- fast cache
- runtime convenience
- performance optimization
- rebuildable state

It must **not** be the only copy of durable user-created data.

---

# 4. Required External Folder Contract

Use a stable, versioned structure.

Recommended initial layout:

```text
FrameChute/
├── framechute.json
│
├── sessions/
│   ├── <snapshot-id>.flashframe.json
│   └── ...
│
├── live/
│   └── current.flashframe.json
│
├── assets/
│   ├── images/
│   ├── files/
│   ├── media/
│   ├── galleries/
│   ├── backgrounds/
│   └── content/
│
└── manifests/
    └── assets.json
```

Do not organize durable identity around filenames alone.

Every persisted asset needs a stable generated ID.

Example:

```json
{
  "id": "asset:a9446...",
  "kind": "image",
  "name": "cat.png",
  "mimeType": "image/png",
  "size": 482193,
  "lastModified": 1787812345000,
  "storage": {
    "kind": "embedded",
    "path": "assets/images/a9446.png"
  }
}
```

---

# 5. Stable Identity

Stable IDs are critical.

An object must retain the same ID across:

```text
ingest
→ IndexedDB
→ external archive
→ snapshot
→ restore
→ cache rebuild
```

Never generate a replacement asset ID merely because the external backend supplied it.

Timing records, block sources, future actions, relationships, animation points, and snapshots may all depend upon stable identity.

---

# 6. Unified Ingest Contract

This is the most important architectural change.

All local/browser/drop ingest should converge on one normalized operation such as:

```js
const record = await ingestAsset(input, options);
```

The result might resemble:

```js
{
  id,
  kind,
  name,
  mimeType,
  size,
  lastModified,
  source,
  durable,
  storage
}
```

The pipeline becomes:

```text
raw drop / picker / Chute / generated Blob
                 ↓
           normalize input
                 ↓
          assign stable ID
                 ↓
          persistAsset()
          ↙           ↘
    IndexedDB       archive
                 ↓
          canonical record
```

Do not allow individual ingest features to directly decide how IndexedDB is written.

---

# 7. Every IndexedDB Concept Needs an External Equivalent

The goal is **behavioral equivalence**, not literally dumping IndexedDB internals to JSON.

## `snapshots`

IndexedDB:

```text
snapshots
```

External equivalent:

```text
sessions/*.flashframe.json
live/current.flashframe.json
```

Already partially implemented.

## `content`

IndexedDB content such as synthetic image blobs must be written into:

```text
assets/...
```

The metadata contains the stable ID and archive-relative path.

Restoration must be able to reconstruct a `File` or `Blob` from this external copy and feed it through the existing runtime exactly as IndexedDB would.

## `handles`

A browser `FileSystemHandle` itself cannot meaningfully be serialized into JSON and resurrected after browser storage has been destroyed.

Therefore an external **equivalent** is required.

For durable assets, preserve enough actual content that a browser handle is not necessary for restoration.

### File source

When durable mode is enabled:

```text
picked file
   ↓
original FileSystemHandle → IndexedDB cache
actual bytes             → external assets/
```

After IndexedDB destruction:

```text
external asset
   ↓
File/Blob reconstruction
   ↓
synthetic runtime handle
   ↓
normal FrameChute loader
```

The block should behave the same from the user's perspective.

---

# 8. Directories / Galleries

Directories are the hardest case.

A `FileSystemDirectoryHandle` cannot simply be placed in a JSON archive.

For a durable gallery that must survive complete browser-storage loss, FrameChute must create an archive representation of the supported gallery contents.

Example:

```text
assets/galleries/<asset-id>/
├── manifest.json
├── 001.jpg
├── 002.png
├── 003.webp
└── ...
```

The manifest should preserve:

- original directory display name
- contained filenames
- supported file types
- ordering metadata if needed
- current selected entry
- stable asset IDs

After recovery, FrameChute should expose this archived directory through an adapter that behaves like the current gallery source.

Do **not** force gallery UI code to know whether it is browsing:

- a native `FileSystemDirectoryHandle`
- an archived FrameChute gallery

That distinction belongs in the source-resolution layer.

---

# 9. Asset Resolver

Create one resolver.

Conceptually:

```js
async function resolveAsset(id) {
    // memory
    // IndexedDB
    // external archive
    // repopulate browser cache if appropriate
    // return canonical runtime source
}
```

Suggested read order during a normal session:

```text
memory
  ↓
IndexedDB
  ↓
external archive
```

If IndexedDB misses but the archive succeeds:

```text
external archive
      ↓
reconstruct runtime File/Blob/source
      ↓
optionally repopulate IndexedDB
      ↓
return source
```

The caller should not care which backend succeeded.

---

# 10. External Folder Recovery

The selected folder handle itself currently lives in IndexedDB.

That handle can disappear during browser-storage loss even though the actual external folder remains intact.

This is acceptable provided recovery is excellent.

FrameChute needs an obvious action:

> Reconnect existing FrameChute folder

After the user selects their old FrameChute directory:

```text
scan framechute.json
scan sessions/
scan live/
scan manifests/
scan assets/
        ↓
validate archive
        ↓
rebuild IndexedDB
        ↓
repopulate Saved dropdown
        ↓
restore live workspace if present
```

This is the critical disaster-recovery path.

---

# 11. Save Semantics Must Change

Current behavior effectively resembles:

```text
Save
 ↓
IndexedDB
 ↓
later try to mirror externally
```

Do not preserve that model.

In durable mode:

```text
Save
 ↓
capture snapshot
 ↓
ensure referenced durable assets exist
 ↓
write external snapshot
 ↓
update IndexedDB cache
 ↓
report success
```

External persistence must not be an afterthought.

### Error semantics

If external storage is configured and the external save fails:

Do **not** show a generic successful Save message.

Show something such as:

> Could not save to your FrameChute folder.

If external save succeeds but IndexedDB caching fails:

The save is still durable.

A message such as this is acceptable:

> Saved to FrameChute folder. Browser cache could not be updated.

IndexedDB failure must never destroy a successful durable save.

---

# 12. Autosave / Live Workspace

`live-state.js` should use the same storage contract.

Do not maintain a separate IndexedDB-specific path.

Live autosave should become conceptually:

```js
await storage.saveLive(snapshot);
```

In durable mode that means:

```text
live snapshot
    ├── external live/current.flashframe.json
    └── IndexedDB cache
```

Throttle/debounce remains appropriate.

Do not rewrite giant asset files during every autosave.

Assets should be stored once during ingest and referenced by stable ID thereafter.

---

# 13. Asset Writes Should Happen During Ingest

Do not wait until the user presses Save to externalize newly introduced content.

Otherwise this sequence still loses data:

```text
drop image
work for 40 minutes
computer crashes before named Save
```

In durable mode:

```text
drop image
    ↓
asset immediately persisted externally
    ↓
live workspace references asset ID
    ↓
later autosave/snapshot references same asset
```

The durable asset lifecycle begins at ingest.

---

# 14. Do Not Duplicate Assets Per Snapshot

Snapshots should reference stable asset IDs.

Bad:

```text
Save frame A → copies movie.mp4
Save frame B → copies movie.mp4 again
Save frame C → copies movie.mp4 again
```

Correct:

```text
ingest movie.mp4
       ↓
asset:1234
       ↓
frame A references asset:1234
frame B references asset:1234
frame C references asset:1234
```

Do not implement automatic garbage collection in this milestone.

Orphaned files are preferable to accidental data loss.

Garbage collection can be designed later.

---

# 15. Large Files

Correctness comes before optimization.

For the first durable implementation, never silently downgrade an asset from durable to reference-only because it is large.

If a future optimization offers:

- **Copy into FrameChute**
- **Reference original**

that choice must be explicit.

A reference-only asset can never promise complete recovery after IndexedDB/browser permissions disappear.

For the durable contract being implemented here, a durable asset means the external archive contains what is required to reconstruct it.

---

# 16. Archive Integrity

Avoid snapshots referencing partially written assets.

Use this write order:

```text
1. create/write asset
2. close asset stream successfully
3. write/update asset metadata
4. write snapshot referencing asset
5. update browser cache
```

A crash between steps should leave an orphaned asset, not a snapshot pointing at nonexistent data.

Again:

> leaking an unused file is preferable to losing user work.

---

# 17. Schema Upgrade

Current snapshots are schema v2.

Introduce a new schema version for durable asset references, preferably:

```json
{
  "schemaVersion": 3
}
```

Example source:

```json
{
  "source": {
    "assetId": "asset:abc123",
    "displayName": "lecture.mp4",
    "sourceKind": "file"
  }
}
```

Old fields such as `handleKey` can remain during migration for compatibility.

Do not break existing v1/v2 snapshots.

Implement explicit migration:

```text
v1 → v2 → v3
```

---

# 18. Existing User Migration

When a user first selects a durable FrameChute folder:

1. enumerate existing named snapshots
2. enumerate current live state
3. enumerate known IndexedDB content
4. enumerate recoverable handles
5. externalize everything that can currently be resolved
6. assign stable external asset records
7. update/migrate snapshot references
8. write durable sessions
9. verify successful external writes
10. retain IndexedDB cache

If an old handle cannot currently be read:

do not discard the block.

Preserve the snapshot and mark the source as requiring relink.

---

# 19. Remove Direct Backend Knowledge

Audit the entire `src/` tree for:

```js
indexedDB
getContent
putContent
getHandle
putHandle
saveSnapshot
listSnapshots
```

Application/UI modules should not call raw IndexedDB directly except inside the IndexedDB backend implementation.

In particular, remove the direct IndexedDB access currently in `live-state.js`.

Target dependency direction:

```text
workspace / ingest / restore / live-state
                    ↓
              storage contract
              ↙            ↘
        IndexedDB backend   archive backend
```

Never:

```text
UI → IndexedDB
UI → archive
UI → IndexedDB sometimes, archive sometimes
```

---

# 20. Suggested Module Shape

Do not treat these filenames as mandatory, but keep the responsibilities separated.

Possible structure:

```text
src/storage/
├── storage.js
├── indexeddb-backend.js
├── archive-backend.js
├── asset-store.js
├── asset-resolver.js
├── archive-schema.js
└── migration.js
```

### `storage.js`

Public application contract.

### `indexeddb-backend.js`

Existing IndexedDB implementation moved/refactored here.

### `archive-backend.js`

External folder reads/writes.

### `asset-store.js`

Normalization and durable ingest.

### `asset-resolver.js`

Turns stable asset records back into runtime `File`, `Blob`, gallery adapter, etc.

### `migration.js`

Old snapshot and old IndexedDB migration.

---

# 21. Preserve Existing User Experience

This is a persistence refactor.

Do not unnecessarily redesign:

- canvas interactions
- timing
- warp/morph
- media playback
- frame layout
- Chute integration
- gallery behavior
- note editing
- toolbar appearance

The existing restoration engine should continue receiving objects in forms it understands.

Build adapters at the storage boundary rather than rewriting the entire editor.

---

# 22. Acceptance Tests

The following are release-blocking.

## Test A — Named snapshot survives total IndexedDB loss

1. Select external FrameChute folder.
2. Add text.
3. Add image.
4. Add PDF.
5. Add video.
6. Add gallery.
7. Move/resize everything.
8. Change PDF page.
9. Change video timestamp.
10. Select a later gallery image.
11. Save named FrameChute.
12. Completely delete FrameChute IndexedDB.
13. Reload extension.
14. Reconnect the same FrameChute folder.
15. Saved FrameChute must reappear.
16. Restore it.

Expected:

- block positions restored
- block sizes restored
- text restored
- image restored
- PDF available
- correct PDF page restored
- video available
- timestamp restored
- gallery available
- correct gallery entry restored
- names and timing metadata restored

No dependency on old IndexedDB should remain.

## Test B — Live workspace survives IndexedDB loss

Repeat the above without pressing named Save.

Allow autosave to complete.

Delete IndexedDB.

Reconnect archive.

The current workspace must restore from:

```text
live/current.flashframe.json
```

plus archived assets.

## Test C — Synthetic Chute image

Drag an image from Chute into FrameChute.

Confirm it currently behaves normally.

Delete IndexedDB.

Reconnect external archive.

The Chute-origin image must still restore.

This specifically verifies replacement of the current IndexedDB-only synthetic image Blob behavior.

## Test D — Browser crash during work

With durable mode active:

1. ingest several items
2. make workspace changes
3. allow autosave
4. forcibly terminate browser/computer process
5. reopen
6. reconnect folder if browser permission was lost

Expected:

the last completed durable checkpoint returns.

## Test E — IndexedDB cache rebuilding

Start with completely empty IndexedDB and a populated external archive.

Reconnect folder.

FrameChute must:

```text
archive
  ↓
scan
  ↓
reconstruct database/cache
  ↓
operate normally
```

After this recovery, ordinary restore should be as fast as normal IndexedDB restore.

## Test F — External write failure

Disconnect/remove write access to archive.

Attempt named Save.

FrameChute must **not** claim that a durable Save succeeded.

Existing files must remain untouched.

## Test G — Existing old snapshots

Load existing schema v1/v2 FrameChutes.

They must continue restoring.

Connecting an external folder should migrate/export them without deleting their existing browser copies.

---

# 23. Required UX Change

In Settings, clearly distinguish:

### Browser storage

> Fast temporary storage inside Chrome. Chrome or browser-profile cleanup may remove it.

### FrameChute folder — Recommended

> Keep your FrameChutes and their assets outside the browser so they can be recovered after browser data is lost.

Actions:

- **Choose FrameChute folder**
- **Reconnect existing FrameChute folder**
- optionally **Change folder**

Do not imply that browser-only saves have the same durability.

---

# 24. Important Guardrails

Codex must follow these rules during implementation:

1. **Do not delete existing IndexedDB data as part of migration.**
2. **Do not delete external assets automatically.**
3. **Do not silently replace stable IDs.**
4. **Do not make external mirroring a delayed afterthought.**
5. **Do not let application-level code directly depend on IndexedDB.**
6. **Do not serialize `FileSystemHandle` objects into JSON and pretend they are portable.**
7. **Do create durable equivalents for anything required to restore the workspace.**
8. **Do let external data repopulate IndexedDB.**
9. **Do preserve old snapshot schemas through explicit migration.**
10. **Do make ingest itself backend-aware rather than fixing persistence only at Save time.**

---

# 25. Definition of Done

This project is complete when this statement is true:

> A user may select a normal external FrameChute folder, work normally, ingest files normally, save FrameChutes normally, and then lose every byte of FrameChute's browser-managed IndexedDB. After reinstalling/reloading FrameChute and reconnecting the external folder, their saved and autosaved work can be reconstructed and used as though the original IndexedDB still existed.

That is the new persistence contract.

**IndexedDB is cache.**

**The user's FrameChute folder is memory.**

---

## PDF/DOCX browser working copies

PDF and DOCX blocks also keep a keyed working-copy Blob in the existing
IndexedDB `content` store. The original `FileSystemFileHandle` remains a
separate, optional link used for explicit Save. Restore reads the working copy
first and therefore neither queries nor requests original-file permission just
to display a document. A legacy snapshot that has only a readable handle is
migrated by writing its first working copy after it opens.

The live autosave and named-workspace save paths checkpoint document working
copies before committing snapshot metadata. DOCX stores its serialized package
plus canonical block state (including formatting and image relationship
references). PDF deliberately stores its current base bytes plus editable
instructions, rather than bytes with those same instructions already painted;
this prevents edits and masks from being applied twice after reopen. PDF state
retains page, geometry, edits, margins, and dirty state. This also avoids
embedding another full document Blob in every snapshot.

Checkpoint writes are serialized per document and revisioned. If editing
continues during an IndexedDB transaction, the completed older write cannot
acknowledge the newer revision; the coordinator immediately captures and writes
the newer state. Active PDF text is copied from the live field for checkpoint
purposes without blurring, committing, rerendering, or changing selection.

Browser storage is still subject to quota and deliberate profile-data deletion.
A failed checkpoint is reported in the workspace status instead of claiming
recovery is available. The configured external durable-folder and FCX paths
remain additional portability mechanisms; a browser working copy does not
grant permission to overwrite its original.

### Verification

1. Open one PDF and one DOCX, edit both, move/resize their frames, and switch
   the PDF page. Close and reopen the extension; both should restore directly.
2. Repeat with generic **Open File** and drag-and-drop. Restart again without
   granting source permission; neither document should show **Reconnect**.
3. Use **Save** after restore. Chrome may request write permission for the
   original; denying it must leave the original unchanged and retain Save As.
4. Delete site/extension storage only as a destructive check: without an FCX or
   configured durable folder, the browser working copy is expected to be lost.
