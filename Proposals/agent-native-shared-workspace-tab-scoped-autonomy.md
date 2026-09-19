# SUBSTRATE Proposal: Agent-Native Shared Workspace and Tab-Scoped Autonomy

**Status:** Product direction / architecture proposal; implementation remains phased and subject to tests.
**Project:** SUBSTRATE (FrameChute browser extension; optional native desktop companion later)
**Date:** 2026-09-19
**Motto:** Greatness Grows Here.

## 1. Executive proposal

SUBSTRATE should become a lightweight, persistent environment in which a human and one or more authorized AI agents can operate on the **same workspace objects**. The ambition is not another assistant bolted onto an editor, nor a visual-only agent that must guess its way through screenshots. We are designing the environment itself so humans and agents can work in it naturally from the beginning.

Today the user often works inside a PDF editor, DOCX editor, browser, image tool, and AI chat as separate islands. Files are uploaded, copied, described, downloaded, converted, and re-opened to pass work between these islands. SUBSTRATE already pursues a unified workbench for different media. Its next direction is to make that same workbench legible and actionable to AI, without forcing the user to leave it.

The central proposition: **SUBSTRATE is the shared medium. The human sees and directly manipulates material; the agent can discover and act on the underlying material through the same trusted workspace engine.** The difference between file formats should become less disruptive to *interaction* even though format-specific constraints and export fidelity remain real.

A major interaction feature will be **agent-authorized tabs**: the user can designate a particular SUBSTRATE workspace tab as an agent's work area, with broad, meaningful control *within that expressly granted scope*. Other tabs, files, sites, accounts, and desktop resources remain outside that grant unless separately authorized. The user can watch, intervene, pause, revoke, and recover.

In a later phase a native desktop companion can expose selected desktop applications, windows, folders, and OS functions through the **same capability and permission model**, giving the agent a continuous workspace across extension, browser, and desktop. This is an intended future capability, not a claim of what the browser extension can currently do.

## 2. Design thesis: reduce the division, not the user's authority

- **One workspace, two interaction modes.** Human gestures and agent tools operate on one authoritative object model and command engine, not two out-of-sync copies.
- **Different media, same interaction grammar.** Select, inspect, move, copy, group, insert, convert, edit, save, and undo should be broadly consistent. Medium adapters handle their necessary exceptions.
- **Context without repeated explanation.** The agent can inspect permitted active objects, selections, relationships, source references, and revision state. It need not infer all of these facts from pixels or demand repeated uploads.
- **Semantic action first; visual automation when necessary.** Call precise native operations for SUBSTRATE-owned objects. Use screenshot/click/typing fallback for unsupported third-party interfaces, never as a substitute for an available reliable native command.
- **Real autonomy within an understandable boundary.** An agent may perform ordinary authorized operations without repeatedly prompting the user, but tab ownership does not silently expand into browser-wide, account-wide, file-system-wide, or OS-wide authority.
- **No forced AI dependence.** SUBSTRATE's local-first editors, viewers, and saved workspaces must remain useful offline and without an active model subscription.

A simple product demonstration: the user opens a research PDF, DOCX draft, and image together in one authorized tab and asks the agent to locate a passage, place a source-linked excerpt into the draft, and insert a figure. The agent acts directly on the existing editable objects; the user can refine the same objects immediately. No export/chat/download/reimport cycle is required.

## 3. Competitive context, dated September 19, 2026

The general concept of agent-capable shared software is **not exclusive to SUBSTRATE**. The distinction we aim to develop is a compact, model-agnostic, cross-format workbench whose core primitives and permissions are explicitly agent-native.

| Company / product | Documented overlap | SUBSTRATE's proposed focus |
| --- | --- | --- |
| Figma | Figma opened its structured canvas to agents and supports creation and modification of native design objects, including through MCP. | Apply agent-addressable, editable object semantics across everyday documents, media, browser material, and later 3D, rather than primarily a design canvas. |
| Notion | Notion Custom Agents work in authorized workspace resources, with configurable access and activity visibility. | A spatial/local-first workbench with direct manipulation across imported file formats, not solely knowledge-work pages and databases. |
| Anthropic / Claude | Claude's integrated productivity, browser, and computer-use features allow agents to work across files and websites, including a built-in browser. | Make the editable environment itself a provider-neutral product, with native object operations and explicitly user-designated agent tabs. |
| OpenAI / ChatGPT Work | ChatGPT Work works across apps/files; its desktop browser lets humans and an agent use the same page. | A lightweight independent workspace where an agent can use the same cross-media object model as the user, rather than requiring one specific assistant product. |

Primary references (review positioning again before public launch):
- Figma, "Agents, meet the Figma canvas" (2026-03-24): https://www.figma.com/blog/the-figma-canvas-is-now-open-to-agents/
- Figma, "The Figma design agent is here" (2026-05-20): https://www.figma.com/blog/the-figma-agent-is-here/
- Notion, "Notion 3.3: Custom Agents" (2026-02-24): https://www.notion.com/releases/2026-02-24
- Anthropic, "Claude Cowork and chat are now one Claude" (2026-09-16): https://claude.com/blog/cowork-is-now-claude
- Anthropic, "Claude gets its own browser in Cowork" (2026-08-26): https://claude.com/blog/cowork-built-in-browser
- OpenAI, "ChatGPT is now a partner for your most ambitious work" (2026-07-09): https://openai.com/index/chatgpt-for-your-most-ambitious-work/
- OpenAI, "Using the built-in browser in the ChatGPT desktop app": https://help.openai.com/en/articles/20001277-using-the-built-in-browser-in-the-chatgpt-desktop-app

Do not market SUBSTRATE as the first agent workspace or claim competitors are incapable of similar integration. Test the actual proposed distinction: breadth of native object access, fewer transfer steps, task correctness, low resource use, user comprehension of permissions, and recovery after failures.

## 4. An agent-native object and command layer

**User-facing invariant:** A thing that is meaningfully editable or movable by the human should expose a corresponding, appropriately permissioned agent capability where technically feasible.

Build on the existing "Universal Object Interchange — Different Media, Same Physics" proposal. SUBSTRATE objects should have stable IDs, types, owner workspace/tab, semantic content or media references, geometry/time where applicable, relationships, provenance, supported capabilities, current version, and adapters for native file representations. They need not all share identical fields.

Conceptual commands:

    workspace.listAuthorizedObjects()
    object.inspect(objectId)
    object.getCapabilities(objectId)
    object.read(objectId, selector)
    object.applyEdit(objectId, patch, expectedVersion)
    object.copyTo(objectId, targetId, conversionOptions)
    workspace.arrange(objectIds, layout)
    workspace.undo(actionId)

These names illustrate *desired contracts*, not existing extension functions. Do not expose arbitrary script execution merely to make everything editable. Use typed commands, explicit schemas, constrained selectors, capability checks, and version preconditions.

Both UI and agent requests must converge through the same command and validation pipeline; emit a structured result or error, record provenance, update the authoritative state, and refresh the visible representation. Preserve native round-trip output whenever possible. A generic PDF may require extraction/reconstruction and cannot promise the same fidelity as a SUBSTRATE-created semantic document. A conversion must report unsupported semantics rather than silently dropping them.

Use stable references and queryable structured state so an agent can ask "which paragraph is selected?" or "what objects depend on this figure?" without taking a screenshot of the workspace. Screenshots remain useful for appearance-sensitive tasks and interfaces we do not own.

## 5. Tab-scoped autonomy: "Give this tab to my agent"

### User experience

The user opens a dedicated SUBSTRATE tab or internal workspace tab and selects **Allow agent in this tab**. A clear scope panel describes the exact contents and actions included. The human can place a PDF, DOCX, browser reference, image, or other imported object in that tab and grant the agent broad read/write/create/arrange authority over the authorized work area.

The agent may then perform multiple routine operations within that scope without interrupting the user for each action. The user observes the work in the same space, can directly edit alongside the agent, and can pause, reclaim, or revoke the grant at any moment. A visible border/badge and activity feed distinguish an agent-controlled tab from an ordinary tab.

Proposed modes:
- **Observe:** The agent may inspect approved objects and respond, but may not modify them.
- **Collaborate:** It may create drafts, propose changes, and execute scoped edits under the selected review policy.
- **Full tab control:** It may read, create, change, rearrange, and remove reversible workspace objects within the explicitly granted tab, subject to resource-specific restrictions and high-impact confirmation rules.
- **Paused / revoked:** Stop new actions immediately, cancel pending operations when feasible, and invalidate the associated capability tokens. Revocation does not erase already committed edits; the user can inspect the history and undo supported operations.

"Full tab control" is **not** a synonym for full browser or desktop control. The grant is bound to a workspace ID, a tab/session ID, a user-approved resource set, permitted actions, and a lifetime. An object moved or linked into the tab should not automatically confer access to its original location, credentials, other open tabs, or every file in the source folder. The user must authorize any additional dependency or resource.

### Browser tab vs. SUBSTRATE workspace tab

Keep these concepts explicit. An internal SUBSTRATE tab is our own workspace container; a real Chromium browser tab is a browser security boundary with independent origins, permissions, and possible cross-origin content. Authorizing one internal workspace does **not** override Chromium extension permissions or grant access to arbitrary websites or other browser tabs.

A third-party browser tab requires a separate, explicit site/tab grant supported by browser APIs. Navigation to a new origin, replacement of a tab, changes to its identity, or an expired grant should trigger re-evaluation. Sensitive, authenticated, or high-impact sites can be excluded or require further confirmation. The user should always know which browser tab/site the agent is about to operate.

### Permissions are enforced, not merely written into the AI prompt

Implement a capability broker between every model/tool request and the underlying workspace or browser operation. Before each action, verify its tab/workspace binding, object permissions, operation class, current user policy, and resource version. Default deny everything not in scope. Never rely on a model's verbal promise not to leave the tab.

An agent-controlled tab may contain untrusted website text or document content. Treat it as **data**, not authority to change the user's instructions or expand permissions. A malicious PDF or webpage must not be able to instruct the agent to read another tab, exfiltrate a file, or grant itself desktop access.

Grant changes, destructive operations, external posting, financial transactions, sending messages, downloading/uploading sensitive data, changes to security settings, and access to a new resource are separate authorization events as applicable. Provide an accessible explanation of what the agent can do now, what it cannot do, what it has done, and what happens if the user revokes it.

### Concurrent human/agent edits

Use object versions, transaction IDs, and conflict handling. If the user changes the selected paragraph while the agent is editing it, do not silently overwrite the newer human change. Retry after re-inspection, present a merge proposal, or stop with an actionable conflict. Support bounded undo or checkpoint restoration for agent changes, including actions grouped into one user-visible task where possible.

## 6. One agent, many file types, little handoff friction

A user should be able to move an image from PDF to DOCX, a paragraph from DOCX to a WEBX-like project, a chart from structured data into a report, and a video frame onto the workspace without switching interaction paradigms. The authorized agent should have equivalent direct operations over those objects.

Architecture sketch:

    Imported file / website / media
                  |
            medium adapter
                  |
       stable SUBSTRATE objects
                  |
         shared state and commands
            /             \
      human interface    capability broker
                             |
                        authorized agent
                  |
            medium adapter on export
                  |
          native file / web / other target

This is not a demand to rewrite every file into one lossy universal representation. Preserve medium-native details at the edges and surface capability/fidelity limits. WEBX may later become a rich native serialization for this common object model, but it should be informed by actual PDF, DOCX, image, video, and spatial editing experience.

A request such as "find the schematic in this PDF, place it beside this paragraph, explain its parts, and prepare an editable illustration" should stay in one project, with source provenance and user edits preserved. The user and AI should point to **the same object IDs**, not exchange disconnected copies.

## 7. The resident agent and model adapters

Introduce an optional, unobtrusive agent panel with text first, then voice and optional visual presence. The agent receives only permitted, relevant context: active project, selected objects, recent edits, available tools, and specific source content retrieved as needed. Do not stream every private file or screenshot indiscriminately.

The model adapter should support at least one external API initially and leave room for other providers and capable local models. A user's ChatGPT account/session is not automatically interchangeable with a separate OpenAI API agent; these are different integration paths. Keep provider credentials out of page scripts and logs, and avoid embedding long-lived secret API keys in a distributed extension. A secure intermediary or carefully designed user-controlled credential flow is required for remote models.

Potential protocol integrations such as MCP can expose SUBSTRATE's constrained capabilities to compatible clients. The internal command contract should remain independent of any one provider or protocol.

## 8. Desktop bridge: extend the *same* boundary, not a blanket override

The eventual native companion could expose selected desktop windows, files, directories, clipboard operations, accessibility/UI automation, local applications, or OS services to the agent. This requires a separately installed and user-authorized component. A browser extension alone cannot legitimately promise unrestricted operating-system access.

The desktop companion should register its resources with the same capability broker used by the workspace. An example grant might be: "This agent may edit these two documents in SUBSTRATE, read this specific desktop project folder, and interact with this named editor window for the next hour." A request to open an unrelated folder or operate a different application requires a new grant.

A user may choose a more expansive supervised desktop session later. Even then, preserve visible status, emergency stop, session expiration, action history, and confirmation for especially consequential operations. Avoid handing raw unrestricted shell/filesystem/network access to a general-purpose model by default. Read/modify access is not equivalent to authority to transmit data externally.

In a successful future experience the agent can move between an authorized SUBSTRATE object, a supported browser tab, and an approved desktop application without forcing the user to repeat the task or manually transport every intermediate artifact. This is the promised **continuity of workspace and permission**, not a claim that software security boundaries disappear.

## 9. Engineering order and acceptance milestones

**Phase 0 — Protect the existing product.** Finish critical PDF/DOCX fidelity, persistence/reconnect, frame-state, save/reopen, and undo work. The agent must not amplify unreliable editing primitives. Keep current local-first utility functional without AI.

**Phase 1 — Agent-readiness contract.** Stable workspace/object IDs, consistent selection state, structured inspection, operation schemas, shared command engine, object versioning, event stream, and test fixtures across PDF, DOCX, image, and frame workflows.

**Phase 2 — First real agent tab.** Build a visible user grant for one internal SUBSTRATE tab; implement observe/collaborate/full-tab-control modes, one model adapter, scoped read/write/arrange commands, activity feed, pause/revoke, and recoverable edits. Test that commands cannot reach an ungranted second tab.

**Phase 3 — Cross-media collaborative demo.** In one authorized tab, agent reads an imported PDF, extracts an image or source-linked passage, inserts it into a DOCX draft, arranges frames, saves native files, and reports any fidelity loss. The human can edit during the process without silent overwrite.

**Phase 4 — Browser integration.** Add separate per-browser-tab/site grants, navigation rechecks, permission-aware browser operations, and visual fallback where a native integration is unavailable. Measure actual extension API limitations and support relevant Chromium-family variants rather than assuming all browser tabs are universally available.

**Phase 5 — Optional desktop companion.** Implement authenticated extension-to-native communication, desktop resource registration, scoped per-window/folder capabilities, UI automation fallback, and a common activity/undo or recovery ledger where feasible. Expand scope only after security and user-control tests.

**Phase 6 — Platform.** Documented developer SDK, provider-neutral agent adapters, optionally multiple collaborating agents, richer WEBX/spatial objects, and a consistent capability system across all supported surfaces.

Initial acceptance tests:
1. A user can grant one tab and verify that a second tab remains inaccessible.
2. Revoking a grant blocks a subsequent agent operation at the enforcement layer.
3. A cross-format edit changes the same object seen by the user, with source provenance and correct native save/reopen.
4. Agent and human concurrent edits cannot silently clobber each other.
5. A malicious instruction inside an imported document cannot expand the agent's capabilities.
6. Users can identify the current authority, active agent, affected objects, and recovery path.
7. A no-AI session remains useful and performant on modest hardware.
8. Benchmark native semantic operations against visual-only automation on equivalent tasks: correctness, time, resource use, transfer steps, and recovery cost.

## 10. Positioning and durable product promise

SUBSTRATE is not an AI skin and not an attempt to conceal all file formats behind a misleading universal abstraction. It is a **common workbench of portable, meaningful objects**, designed for both human hands and authorized machine actions.

Its proposed advantage is that the environment, object model, editors, and authorization boundaries are being built to accommodate agents from the start, rather than treating them solely as external mouse-and-keyboard operators. Other companies pursue meaningful parts of this vision; SUBSTRATE must distinguish itself through the quality, breadth, efficiency, openness, and trustworthiness of the actual implementation.

**Product promise:** Give an agent a workspace, not your entire computer. When the user chooses, give it a larger one. Let humans and agents work on the same material with less copying, fewer artificial file-type boundaries, and clearer control over what each participant may do.

**Long-term aspiration:** An almost frictionless medium for human–AI collaboration, where the workspace is the substrate through which people and agents can create together.

---

### Relationship to existing proposals

- [Universal Object Interchange — Different Media, Same Physics](universal-object-interchange-different-media-same-physics.md): portable objects, format adapters, semantic transfer, graceful degradation.
- [Deterministic Layout Core and Extractable JS/TS Packages](deterministic-layout-core-and-extractable-js-ts-packages.md): reliable layout primitives and reusable engines.
- [Semantic World Engine / Agent-Native Spatial IR](semantic-world-engine-agent-native-spatial-ir.md): later structured spatial and 3D work.
- [Neo Hollywood / Agent-Native Creative Production Graph](neo-hollywood-agent-native-production-graph.md): later agent-native multi-stage creative workflows and provenance.

This proposal **adds the shared human–AI environment, tab-scoped autonomy, permission model, and desktop-bridge direction** without superseding the existing editor, interchange, archive, or creative proposals.
