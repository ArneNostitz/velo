import { fireEvent, render, screen } from "@testing-library/react";
import { SpamBanner } from "./SpamBanner";

describe("SpamBanner", () => {
  it("clearly identifies spam and offers recovery", () => {
    const onNotSpam = vi.fn();
    render(<SpamBanner onNotSpam={onNotSpam} />);

    expect(screen.getByText("This is spam")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not spam" }));
    expect(onNotSpam).toHaveBeenCalledOnce();
  });

  it("disables the action while moving the conversation", () => {
    render(<SpamBanner onNotSpam={vi.fn()} restoring />);

    expect(screen.getByRole("button", { name: "Moving…" })).toBeDisabled();
  });
});
