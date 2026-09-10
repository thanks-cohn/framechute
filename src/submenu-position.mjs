/** Calculate fixed-position submenu geometry using viewport coordinates only. */
export function submenuPosition(triggerRect, menuRect, viewport, gap = 4, margin = 8) {
  const fitsRight = triggerRect.right + gap + menuRect.width <= viewport.width - margin;
  const left = fitsRight ? triggerRect.right + gap : Math.max(margin, triggerRect.left - gap - menuRect.width);
  const top = Math.max(margin, Math.min(triggerRect.top, viewport.height - menuRect.height - margin));
  return { left, top, opensLeft: !fitsRight };
}

export function positionSubmenu(trigger, submenu, viewport = window) {
  const result = submenuPosition(trigger.getBoundingClientRect(), submenu.getBoundingClientRect(), {
    width: viewport.innerWidth, height: viewport.innerHeight
  });
  submenu.style.position = "fixed";
  submenu.style.left = `${result.left}px`;
  submenu.style.top = `${result.top}px`;
  submenu.classList.toggle("opens-left", result.opensLeft);
  return result;
}
