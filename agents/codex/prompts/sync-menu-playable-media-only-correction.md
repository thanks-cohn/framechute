# Correction: `Sync with…` and `Make independent` are playable-media-only context actions

This file corrects and overrides any broader wording in:

```text
agents/codex/prompts/select-mode-bulk-actions-arrange-pdf-and-context-menu-cleanup-addendum.md
```

Do **not** remove `Sync with…` and `Make independent` globally.

The user wants these right-click commands to exist **only for playable sound/video media**, i.e. MP3/MP4-type media objects and equivalent playable audio/video sources.

## Exact rule

Show these commands only when the invoked FrameChute object is an actual playable media object:

```text
- video / movie object, e.g. MP4/WebM/etc.
- audio / sound object, e.g. MP3/WAV/OGG/etc.
```

Use actual media capability/object type as the predicate (`<video>`, `<audio>`, or canonical playable audio/video block type), not filename text alone.

They must NOT appear for:

```text
- images / GIFs / screenshots
- PDF
- DOCX
- text / notes
- canvas/drawing objects
- archives
- CSV
- generic/static files
- galleries unless the invoked object itself is a playable audio/video item
- any other non-playable object
```

Preserve the existing mode policy unless another current prompt explicitly changes it:

```text
Simple mode
→ hide Sync with…
→ hide Make independent

Advanced mode + playable audio/video
→ keep Sync with…
→ keep Make independent where meaningful

Advanced mode + anything static/non-playable
→ hide both
```

Do not infer sync eligibility merely because an object has generic timing metadata. Static objects can have timing/motion metadata but are still not audio/video media.

A preferred implementation is one strict helper such as:

```text
isPlayableMediaObject(block)
```

and context-menu composition should use that helper.

## Acceptance

```text
Right-click MP4/video in Advanced
→ Sync with… present
→ Make independent present when applicable

Right-click MP3/audio in Advanced
→ Sync with… present
→ Make independent present when applicable

Right-click image/PDF/DOCX/text/static file in Advanced
→ neither appears

Right-click any object in Simple mode
→ neither appears
```

Keep the underlying synchronization engine unchanged for supported playable media.