// Portal open PDF menus outside both the horizontal toolbar scroller and the
// block's clipping context. Return each menu to its owner when it closes.
function position(panel, summary) {
  const rect = summary.getBoundingClientRect();
  panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - panel.offsetWidth - 8))}px`;
  const above = rect.top - panel.offsetHeight - 5;
  panel.style.top = `${above >= 8 ? above : Math.min(window.innerHeight - panel.offsetHeight - 8, rect.bottom + 5)}px`;
}

function bind(details) {
  if (details.dataset.popdownPortalBound) return;
  details.dataset.popdownPortalBound = "true";
  const panel = details.querySelector(":scope > .pdf-popdown");
  const summary = details.querySelector(":scope > summary");
  if (!panel || !summary) return;
  details.addEventListener("toggle", () => {
    if (details.open) {
      document.querySelectorAll(".pdf-toolbar details[open]").forEach(other => { if (other !== details) other.open = false; });
      panel.classList.add("pdf-popdown-portal");
      document.body.append(panel);
      position(panel, summary);
    } else {
      panel.classList.remove("pdf-popdown-portal");
      panel.removeAttribute("style");
      details.append(panel);
    }
  });
}

function bindAll(root = document) { root.querySelectorAll?.(".pdf-toolbar details").forEach(bind); }
bindAll();
new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => node.nodeType === 1 && bindAll(node)))).observe(document.body, { childList: true, subtree: true });
