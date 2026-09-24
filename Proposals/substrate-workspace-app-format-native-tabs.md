# SUBSTRATE Workspace App Format: tools that live together

**Status:** Proposal, not shipped. **Applies to:** SUBSTRATE, FrameChute and the ÆXIS/Tiled-223D workflow. **First target:** Windows desktop on a 4 GB RAM machine with about 5 GB free disk space. A Linux implementation follows platform-specific validation.

## The experience

The creator opens one project and stays in one visible workspace. The tabs may contain a native editor, a Chromium-based world preview, an inspector or a compatible third-party tool. A tool can edit the current project's material and publish a versioned output that another tab consumes immediately. Switching tabs preserves focus, selection and project context; the creator does not have to hunt for a separate application window or approve every ordinary save.

**First demonstration:** Open a generated map in Tiled **inside the workspace**, edit it, save/export through the ÆXIS Tiled integration, and switch to the adjacent 3D tab to see the changed world. The world is rendered by the existing web/Three.js code inside Qt WebEngine. ÆXIS scene JSON remains the canonical semantic record; the Tiled map is a supported editable projection. The [Within Reason proposal](aexis-within-reason-single-image-world.md) describes the image-recognition and logical default-generation path. A separate native hosting prototype must prove the actual Tiled tab before the desktop choice is final.

## What came before and what we propose to add

| Precedent | Demonstrated idea | Proposed SUBSTRATE extension |
| --- | --- | --- |
| [Qt foreign-window embedding](https://doc.qt.io/qt-6/qtdoc-demos-windowembedding-example.html) and [Windows `SetParent`](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent) | One window can contain a foreign native window, subject to platform constraints. | A tested app-tab lifecycle, project identity and semantic output contract, starting with Tiled. |
| [XEmbed](https://specifications.freedesktop.org/xembed/latest/) | Cross-process window embedding and focus coordination existed on X11. | Platform adapters, with Linux display-server behavior verified separately; no universal Linux promise. |
| [VS Code custom editors](https://code.visualstudio.com/api/extension-guides/custom-editors) and [contribution points](https://code.visualstudio.com/api/references/contribution-points) | Extensions declare editors and views inside a workbench. | A manifest for *installed desktop applications* and web tools to join one project, including native tab hosting where supported. |
| [Qt WebEngine](https://doc.qt.io/qt-6/qtwebengine-overview.html) and [WebChannel](https://doc.qt.io/qt-6/qtwebchannel-index.html) | Chromium-derived content can live in a Qt window and exchange messages with native code. | The web renderer and native tools share validated project records without giving arbitrary pages unrestricted disk access. |

**The intended new contribution is the combination:** a portable, versioned *workspace app format* in which heterogeneous tools can declare their view, inputs, outputs, permissions and handoff, and where compatible native apps can occupy a real tab in the same project. Window reparenting, extension manifests and embedded browsers individually have precedents. Novelty of the combined experience is a design hypothesis to demonstrate and compare, not a claim that no other product has attempted it.

## Workspace app package (`.substrate-app` working name)

An installable package contains a manifest, integration adapter and optional UI/assets. The name and file extension are provisional. It may refer to a separately installed third-party application; it does not silently redistribute that application's binary or assert its endorsement. A manifest declares:

- `id`, publisher, version, supported operating systems/architectures, compatible host protocol range, signature or verified provenance, and update source;
- presentation mode: `native-tab`, `web-tab`, `integrated-qt`, or `handoff-only`, with tested platform/version and explicit fallback;
- launch/discovery rules for an allowed executable, child-window identity and ownership, single-instance behavior, and safe shutdown;
- project file types, accepted inputs, produced outputs and schema versions; watch paths and stable object-ID mapping;
- scoped capabilities such as read/write current project, start declared app, use network, camera, microphone or model runtime; and
- credits, source/asset licenses, independent donation destinations and any installation requirements.

**Illustrative shape, not a frozen schema:**

```json
{
  "formatVersion": 1,
  "id": "org.substrate.tiled-bridge",
  "version": "0.1.0",
  "displayName": "Tiled map editor bridge",
  "platforms": ["windows-x64"],
  "view": { "preferred": "native-tab", "fallback": "handoff-only" },
  "inputs": [{ "type": "tiled-map", "extensions": ["tmx", "json"] }],
  "outputs": [{ "type": "aexis-map-export", "schema": "1" }],
  "capabilities": ["project:read", "project:write", "app:launch-declared"],
  "creditsUrl": "https://www.mapeditor.org/",
  "supportUrl": "https://www.mapeditor.org/donate.html"
}
```

The host validates the manifest, prompts once when installing/enabling a capability for a project, and allows review or revocation later. The native bridge offers *operations* (open project map, export, report change), never a blanket arbitrary filesystem or shell interface to a web page. Ordinary save/rebuild actions within the authorized project do not trigger repetitive prompts. Network, device access, external folders and untrusted remote content have separate scopes. OS security and web-origin rules still apply.

## Hosting and handoff

**Qt Widgets/C++ shell candidate:** a project window owns the tab strip, native adapter lifecycle and a `QWebEngineView` for the existing Three.js renderer. A cooperative Qt component may offer the strongest integration; an independently running Tiled window may require native child-window hosting. Qt's foreign-window example proves the mechanism exists, not that an arbitrary Tiled build will pass focus, modal dialog, shortcut, DPI and crash tests. On Windows, mismatched DPI awareness can affect cross-process parenting; test it before committing to this mode. Do not advertise unsupported apps as embeddable.

The adapter recognizes an app-owned window rather than capturing a random process by title; docks and sizes it, monitors exit, restores focus, handles dialogs and tab hide/show, and cleans up without killing user work unexpectedly. Persist project and tab state separately from process handles. Each output is written atomically to an agreed project location or sent over a bounded local IPC channel; validate schema, size, path and provenance before import. Debounce save events; keep the last good rendition if export fails. Preserve edits and stable identities across Tiled ↔ ÆXIS round trips, and show conflicts rather than overwriting authored roofs or façades.

**Browser boundary:** Qt WebEngine is Chromium based. Use a narrow WebChannel bridge for project data, with native ownership of files and app launch. Treat remote pages as untrusted and avoid exposing native methods to them. Canvas CORS or taint behavior is resolved by loading authorized local assets through the project origin or an appropriate trusted data path; it is not disabled globally.

## First milestone and acceptance criteria

1. **Host proof:** On Windows, place a real Tiled editing surface and a live ÆXIS Three.js view in tabs of the same window. Verify mouse/keyboard focus, shortcuts, menus, child dialogs, resize, minimize/restore, tab switching, process restart and 100%/150%/200% display scaling. If native parenting fails, investigate a cooperative Qt integration before declaring native tabs generally supported.
2. **Project proof:** Open a project once; edit and export a Tiled map; the neighboring 3D tab detects a valid output and refreshes without another picker or permission prompt. A malformed/partial export never damages the last good scene. Reopen the workspace and recover the project/tabs.
3. **Format proof:** Publish a versioned manifest and a small adapter SDK with example Tiled and simple web-view integrations. Validate declared capability scopes, output schemas and compatibility. Install and disable a sample integration without copying a third-party binary or losing project data.
4. **Low-end proof:** On the actual 4 GB Windows machine with roughly 5 GB free, record installed and peak disk use, cold start, idle and peak RAM (host, Tiled, WebEngine and model process separately), tab-switch latency, 3D frame time and export-to-preview latency. Choose pass budgets from baseline measurements and publish results. The no-model desktop path must stay usable; download a recognition model only with explicit choice and a known size. Show a smaller preview or specific failure if resource limits are reached.
5. **Release proof:** Verify Tiled and bundled assets' exact redistribution licenses, display independent project credits and separate donation links, and review Qt/WebEngine obligations. The package manifest must not imply partnership or endorsement.

## Boundaries and sequence

Stage A: native tab and WebEngine proof with existing Tiled-223D sample JSON, no ML required. Stage B: stable project/adapter protocol and Tiled exporter round trip. Stage C: public manifest and second integration to demonstrate that the format is reusable. Stage D: image recognition, Within Reason generation, and additional platforms after low-end measurements. None of these stages is shipped merely because this proposal exists. The current Tiled-223D viewer and narrow low-ground assembly remain the known baseline; SUBSTRATE and FrameChute have not acquired a Qt desktop app through this document.
