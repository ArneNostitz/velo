/**
 * Scrollbars that appear while scrolling and fade out again, the way macOS
 * overlay scrollbars do.
 *
 * CSS alone cannot do this. `:hover` on the scroll container is the closest
 * it gets, and that showed a bar down every pane the pointer merely rested
 * over — which is most of the time, so the bars read as permanent furniture.
 * A capture-phase `scroll` listener (the event does not bubble) marks the
 * element that actually moved and clears the mark once it has been still.
 */

const HIDE_AFTER_MS = 900;
const SCROLLING_CLASS = "is-scrolling";

const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

function mark(target: EventTarget | null): void {
  const el =
    target instanceof Element
      ? target
      : target instanceof Document
        ? target.documentElement
        : null;
  if (!el) return;

  el.classList.add(SCROLLING_CLASS);

  const existing = timers.get(el);
  if (existing) clearTimeout(existing);
  timers.set(
    el,
    setTimeout(() => {
      el.classList.remove(SCROLLING_CLASS);
      timers.delete(el);
    }, HIDE_AFTER_MS),
  );
}

/** Start marking scrolling elements. Returns the teardown. */
export function initScrollbarVisibility(): () => void {
  const onScroll = (e: Event) => mark(e.target);
  // Capture: `scroll` does not bubble, so a listener on the document only
  // hears about nested panes on the way down
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  return () => document.removeEventListener("scroll", onScroll, { capture: true });
}
