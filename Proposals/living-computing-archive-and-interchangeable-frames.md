# SUBSTRATE Proposal: Living Computing Archive and Interchangeable Frames

Status: Proposal (future-facing; do not block core editor/extension launch)
Project: SUBSTRATE / FrameChute

## Vision

Make SUBSTRATE both a practical modern workspace and a living, usable archive of computing experiences. People can revisit the interfaces and small creative tools they remember fondly, discover unfamiliar eras, and use those styles with their own present-day files. Preserve the *experience* of computing rather than offering screenshots alone. Charm, accessibility, and optional nostalgia should make work feel approachable, not add unnecessary complexity.

## Three independent layers

1. **Environment preset:** An optional whole-workspace look: wallpaper, desktop/menu/taskbar or dock styling, icons, typography, palette, optional sounds and motion. A one-click "1980s Macintosh" preset could make the whole environment monochrome and pixel-conscious. Other era-specific and original presets can follow.
2. **Frame skin:** An interchangeable, mostly CSS-based presentation for each FrameChute window: title bar, pixel-stepped or rounded corners, borders, shadows, buttons, hover/focus appearance, and motion. Users can set a workspace default or override an individual frame without changing the program inside it.
3. **Application / content:** The functioning word processor, PDF/image viewer, media player, drawing canvas, etc. Its file data and commands remain independent of frame skin and workspace preset. A historic-inspired editor can coexist with a modern media player in the same workspace. A legacy application integrated through a desktop compatibility layer is a separate application path, not a prerequisite for CSS skins.

Mix-and-match is a first-class feature, not a historical accuracy error. Also offer complete era presets for users who want a cohesive one-click experience.

## Initial styles and experiences to explore

- **1980s Macintosh-inspired complete aesthetic:** monochrome palette, low-resolution/pixel-stepped corners, bitmap-like icons, compact menus, and a focused writing environment.
- **Classic 1990s Mac / Platinum-inspired writer frame:** tactile grey frame, crisp corners, readable document surface, optional colored traffic-light controls (a deliberately cross-era SUBSTRATE interpretation, not an assertion of exact historical fidelity).
- **Classic Windows-inspired bitmap drawing workspace:** compact paint controls, brushes, palette, flood fill, and direct manipulation.
- **Retro media-player and image-viewer frame options:** small, playful, skinnable windows alongside ordinary modern modes.

Frame controls must preserve a consistent underlying window API. For the proposed SUBSTRATE colored-control variant: red closes, yellow minimizes to the SUBSTRATE taskbar, green enlarges/maximizes; the enlarged-state control may turn blue to indicate restore to the prior size. Ensure visual state, tooltips, keyboard access, and actions agree. Skins may rearrange controls but must not break close/minimize/restore, focus, movement, resizing, or persistence.

## The Archive and community

Create an optional website section, **The Archives**, with dated references, original designers/creators where known, annotated screenshots, original manuals/reviews where licensed or linkable, and interactive demos or recreations when feasible. Distinguish clearly between:
- original historical software running under an emulator/compatibility layer;
- faithful functional recreations;
- modern SUBSTRATE tools wearing a historically *inspired* skin.

Let visitors nominate and vote for the historical media player, image player, word processor, desktop, drawing tool, or interface *experience* they would most like to see revived. Label votes as community preferences, not objective rankings of software quality; show the voting period and avoid fake counts. Use community interest to prioritize research and prototypes without promising exact reproductions.

## Implementation boundary

- Begin with shared window-state primitives and theme tokens/CSS assets. Keep application logic, document model, save/export, and history outside theme packages. Use scoped selectors/CSS variables so one frame skin cannot alter neighboring frames or document content.
- A theme manifest can specify identifiers, assets, optional environment components, supported controls, accessibility fallback, and version. Persist selected environment, global default frame, and per-frame override without affecting file format or application state. Themes should be swappable live with no document changes.
- Build a small real web demo hosted on GitHub Pages (static HTML/CSS/JS) and reuse the browser-capable parts in the extension. Web/extension cannot run Wine directly.
- **Wine is for a possible Linux/desktop integration of classic Windows bitmap-drawing software, not for rendering the frame.** The browser version needs a native browser drawing implementation or other supported browser-compatible approach. Assess redistribution/licensing of any original legacy executable independently.
- Historical assets, software, trademarks, and sound effects require rights review. When needed, make original evocative art instead of copying protected assets. Respect reduced-motion preferences, high contrast, keyboard and screen-reader support, and a plain modern theme for people who do not want nostalgia. Keep animations decorative and out of the editing path.

## Phased, non-blocking plan

1. **Small primitive first:** one working Macintosh/pixel-inspired CSS frame on one existing editor; basic theme selection; red/yellow/green-to-blue window-state behavior; per-frame override and persistence; no changes to document logic.
2. **Small archival experience:** one historical preset, one interactive browser demo using the real editor, and an accurate provenance note distinguishing inspiration from recreation.
3. **Extend and validate:** support different frame skins on word processor, media/image player, and drawing canvas; ensure file compatibility, keyboard interaction, and performance are unchanged.
4. **Future exploration:** community nomination/voting, additional historical environments, licensed faithful recreations or emulation, and optional desktop Wine integration for bitmap drawing.

## Success criterion

A visitor comes for a beloved computing era or application aesthetic, can actually work on their own files, and discovers that changing the look is fun and reversible while the underlying workspace remains lightweight, reliable, and capable.
