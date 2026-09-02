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
