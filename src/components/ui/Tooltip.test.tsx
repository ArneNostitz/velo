import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("appears the instant the pointer arrives — no delay", () => {
    render(<Tooltip content="Explains itself"><button>Thing</button></Tooltip>);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByText("Thing"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Explains itself");
  });

  it("goes away when the pointer leaves", () => {
    render(<Tooltip content="x"><button>Thing</button></Tooltip>);
    fireEvent.mouseEnter(screen.getByText("Thing"));
    fireEvent.mouseLeave(screen.getByText("Thing"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on keyboard focus too, and names itself for assistive tech", () => {
    render(<Tooltip content="Focus words"><button>Thing</button></Tooltip>);
    const button = screen.getByText("Thing");
    fireEvent.focus(button);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Focus words");
    expect(button).toHaveAttribute("aria-describedby", tip.id);
  });

  it("closes on Escape", () => {
    render(<Tooltip content="x"><button>Thing</button></Tooltip>);
    fireEvent.mouseEnter(screen.getByText("Thing"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("leaves the element alone when there is nothing to say", () => {
    render(<Tooltip content="x" enabled={false}><button>Thing</button></Tooltip>);
    fireEvent.mouseEnter(screen.getByText("Thing"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("still calls the element's own hover handler", () => {
    const onEnter = vi.fn();
    render(<Tooltip content="x"><button onMouseEnter={onEnter}>Thing</button></Tooltip>);
    fireEvent.mouseEnter(screen.getByText("Thing"));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("renders rich content, not just strings", () => {
    render(
      <Tooltip content={<div><strong>Bold</strong> and more</div>}>
        <button>Thing</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText("Thing"));
    expect(screen.getByRole("tooltip").querySelector("strong")).toHaveTextContent("Bold");
  });

  it("honours an explicit delay when one is asked for", () => {
    vi.useFakeTimers();
    render(<Tooltip content="x" delay={300}><button>Thing</button></Tooltip>);
    fireEvent.mouseEnter(screen.getByText("Thing"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
