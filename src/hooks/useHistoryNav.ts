import { useCallback, useEffect, useState } from "react";
import { router } from "@/router";

/** How far a horizontal gesture must travel before it counts as a swipe. */
const SWIPE_THRESHOLD = 120;
/** Quiet time that ends a gesture, so one swipe cannot navigate twice. */
const GESTURE_END_MS = 200;

/**
 * Whether the pointer is over something that scrolls sideways on its own — a
 * wide table in a message, a horizontal list. Those must keep their scroll
 * rather than having it stolen for navigation.
 */
function overHorizontalScroller(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node) {
    if (node.scrollWidth > node.clientWidth + 4) {
      const overflow = getComputedStyle(node).overflowX;
      if (overflow === "auto" || overflow === "scroll") return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Back and forward through the views the user has actually visited.
 *
 * Reading mail is a lot of stepping sideways — into a past conversation, into
 * someone's history — and every one of those is a dead end without a way back
 * to the message you were on. The router's own history already records them,
 * so this is a control surface over that rather than a second stack that
 * could disagree with the URL.
 *
 * Also binds a two-finger horizontal swipe. A trackpad swipe reaches the page
 * as a `wheel` event with `deltaX`; the message body is a sandboxed iframe and
 * swallows its own, so the gesture works over the list and the chrome around
 * the message rather than the message itself.
 */
export function useHistoryNav(): {
  back: () => void;
  forward: () => void;
  canGoBack: boolean;
} {
  const [canGoBack, setCanGoBack] = useState(false);

  const back = useCallback(() => {
    if (router.history.canGoBack()) router.history.back();
  }, []);
  const forward = useCallback(() => router.history.forward(), []);

  // The button must not offer a step that does not exist
  useEffect(() => {
    const update = () => setCanGoBack(router.history.canGoBack());
    update();
    return router.history.subscribe(update);
  }, []);

  useEffect(() => {
    let travelled = 0;
    let fired = false;
    let endTimer: ReturnType<typeof setTimeout> | null = null;

    const handleWheel = (e: WheelEvent) => {
      // A gesture is horizontal or it is a scroll — never both
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 2) return;
      if (overHorizontalScroller(e.target)) return;

      if (endTimer) clearTimeout(endTimer);
      endTimer = setTimeout(() => {
        travelled = 0;
        fired = false;
      }, GESTURE_END_MS);

      travelled += e.deltaX;
      if (fired) return;

      if (travelled <= -SWIPE_THRESHOLD) {
        fired = true;
        back();
      } else if (travelled >= SWIPE_THRESHOLD) {
        fired = true;
        forward();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (endTimer) clearTimeout(endTimer);
    };
  }, [back, forward]);

  return { back, forward, canGoBack };
}
