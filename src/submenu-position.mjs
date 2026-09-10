/** Calculate fixed-position submenu geometry using viewport coordinates only. */
export function submenuPosition(triggerRect, menuRect, viewport, gap = 4, margin = 8) {
  const fitsRight = triggerRect.right + gap + menuRect.width <= viewport.width - margin;
  const left = fitsRight ? triggerRect.right + gap : Math.max(margin, triggerRect.left - gap - menuRect.width);
  const top = Math.max(margin, Math.min(triggerRect.top, viewport.height - menuRect.height - margin));
  return { left, top, opensLeft: !fitsRight };
}

/**
 * Position a submenu immediately beside its trigger.
 *
 * Some FrameChute menus use backdrop/filter effects. Chromium can make a
 * filtered ancestor the containing block for a `position: fixed` descendant,
 * which means assigning viewport coordinates directly can visibly offset the
 * submenu by the parent menu's own position. The second measurement below
 * corrects that browser containing-block offset without mixing coordinate
 * systems or guessing at ancestor geometry.
 */
export function positionSubmenu(trigger, submenu, viewport = window) {
  const result = submenuPosition(trigger.getBoundingClientRect(), submenu.getBoundingClientRect(), {
    width: viewport.innerWidth, height: viewport.innerHeight
  });

  submenu.style.position = "fixed";
  submenu.style.left = `${result.left}px`;
  submenu.style.top = `${result.top}px`;
  submenu.classList.toggle("opens-left", result.opensLeft);

  // Calibrate the CSS coordinates against the actual viewport result. In the
  // normal case this delta is zero. If an ancestor establishes a containing
  // block for fixed descendants, this cancels that offset so the submenu still
  // lands 0-4px beside the trigger rather than halfway across the screen.
  const actual = submenu.getBoundingClientRect();
  const dx = result.left - actual.left;
  const dy = result.top - actual.top;
  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
    const currentLeft = Number.parseFloat(submenu.style.left) || 0;
    const currentTop = Number.parseFloat(submenu.style.top) || 0;
    submenu.style.left = `${currentLeft + dx}px`;
    submenu.style.top = `${currentTop + dy}px`;
  }

  return result;
}
