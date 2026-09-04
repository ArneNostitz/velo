import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initScrollbarVisibility } from "./scrollbars";

describe("initScrollbarVisibility", () => {
  let teardown: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    teardown = initScrollbarVisibility();
  });

  afterEach(() => {
    teardown();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  function pane(): HTMLElement {
    const el = document.createElement("div");
    document.body.appendChild(el);
    return el;
  }

  it("marks the pane that scrolled and clears it once it is still", () => {
    const el = pane();
    el.dispatchEvent(new Event("scroll", { bubbles: false }));

    expect(el.classList.contains("is-scrolling")).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(el.classList.contains("is-scrolling")).toBe(false);
  });

  it("keeps the mark while scrolling continues", () => {
    const el = pane();
    el.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(700);
    el.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(700);

    // The second scroll restarted the clock — a long drag must not flicker
    expect(el.classList.contains("is-scrolling")).toBe(true);
  });

  it("leaves other panes alone", () => {
    const scrolled = pane();
    const other = pane();
    scrolled.dispatchEvent(new Event("scroll"));

    expect(other.classList.contains("is-scrolling")).toBe(false);
  });

  it("stops marking after teardown", () => {
    teardown();
    const el = pane();
    el.dispatchEvent(new Event("scroll"));

    expect(el.classList.contains("is-scrolling")).toBe(false);
  });
});
