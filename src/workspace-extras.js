await import("./advanced-mode.js");
await import("./responsive-toolbar.js");
await import("./docx-editor-correctness.js");
await import("./docx-serialization-guard.js");
await import("./editor-context-menu.js");
await import("./legacy-workspace-save.js");

const advancedMode = window.frameChuteAdvancedMode === true;

function ensureStylesheet(path) {
  const href = new URL(path, import.meta.url).href;
  if ([...document.styleSheets].some((sheet) => sheet.href === href)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
}

ensureStylesheet("./web-drop.css");
ensureStylesheet("./media-ux-polish.css");
ensureStylesheet("./theme-customization.css");
ensureStylesheet("./media-dock-layout.css");
ensureStylesheet("./donation-card.css");
ensureStylesheet("./framechute-final-polish.css");
ensureStylesheet("./handoff-fixes.css");
ensureStylesheet("./classic-context-menu.css");

// Advanced mode changes the visible control surface. Classic deliberately
// keeps the simpler toolbar, while the right-click menu remains the bridge to
// object-level power features in both modes.
if (advancedMode) {
  await import("./toolbar-paradigm.js");
  await import("./source-locations.js");
  await import("./reconnect-location-picker.js");
}

await import("./picker-guard.js");

if (advancedMode) {
  await import("./extension-gallery.js");
  await import("./synthetic-file-handle.js");
  await import("./filechute-bridge.js");
  await import("./filechute-export.js");
}

await import("./web-drop.js");

// Right-click capabilities are intentionally available in Classic too.
await import("./frameless-media.js");
await import("./frameless-resize-anchor.js");
await import("./timed-events.js");
await import("./layer-rules.js");

if (advancedMode) {
  await import("./frame-sequence.js");
  await import("./master-loop-runtime.js");
}

await import("./drop-local-sources.js");
await import("./workspace-ingestion.js");

if (advancedMode) await import("./fit-to-size.js");

await import("./remote-video.js");

// Reachability is a safety feature, not an Advanced feature.
await import("./offscreen-rescue.js");

await import("./layer-menu.js");
await import("./media-context-loop.js");

await import("./appearance.js");
await import("./media-ux-polish.js");
await import("./theme-customization.js");
await import("./media-dock-layout.js");
await import("./media-header-theme.js");
await import("./donation-card.js");
await import("./framechute-final-polish.js");
await import("./media-dock-drop-router.js");
await import("./grab-art-runtime.js");
await import("./framechute-visible-branding.js");
await import("./mascot.js");
await import("./media-dock-grab-pin.js");

if (advancedMode) await import("./gallery-ui-polish.js");