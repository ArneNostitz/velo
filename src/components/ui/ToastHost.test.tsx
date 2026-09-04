import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastHost } from "./ToastHost";
import { useToastStore, reportError, notify } from "@/stores/toastStore";

describe("ToastHost", () => {
  beforeEach(() => useToastStore.getState().clear());

  it("renders nothing when there is nothing to say", () => {
    const { container } = render(<ToastHost />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces an error as an alert with its detail", () => {
    render(<ToastHost />);
    act(() => { reportError("Sync failed", new Error("history expired")); });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Sync failed");
    expect(alert).toHaveTextContent("history expired");
  });

  it("never wears a react-transition-group class as a plain one", () => {
    // `toast-enter` sets `opacity: 0` and is only undone by the `-active`
    // half a CSSTransition adds. ToastHost has no transition, so wearing it
    // statically left every toast invisible — and still clickable, 320px wide
    // down the right of the window, swallowing clicks meant for the mail.
    render(<ToastHost />);
    act(() => { reportError("Still there"); });
    const alert = screen.getByRole("alert");
    expect(alert.className).not.toMatch(/toast-(enter|exit)/);
    // and it paints on something rather than only blurring what is behind it
    expect(alert.className).toContain("bg-bg-primary");
  });

  it("dismisses on the close button", () => {
    render(<ToastHost />);
    act(() => { reportError("Gone soon"); });
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("runs the action and closes", async () => {
    const run = vi.fn();
    render(<ToastHost />);
    act(() => { reportError("Stopped", undefined, { label: "Reconnect", run }); });
    fireEvent.click(screen.getByText("Reconnect"));
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a notice as status, not alert", () => {
    render(<ToastHost />);
    act(() => { notify("success", "Sent"); });
    expect(screen.getByRole("status")).toHaveTextContent("Sent");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
