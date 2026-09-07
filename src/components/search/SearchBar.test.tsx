import { act, fireEvent, render, screen } from "@testing-library/react";
import { SearchBar } from "./SearchBar";
import { useThreadStore } from "@/stores/threadStore";
import { searchMessages } from "@/services/db/search";

vi.mock("@/services/db/search", () => ({ searchMessages: vi.fn() }));
vi.mock("@/hooks/useRouteNavigation", () => ({
  useActiveLabel: () => "inbox",
}));
vi.mock("@/components/ui/InputDialog", () => ({ InputDialog: () => null }));
vi.mock("@/stores/accountStore", () => ({
  useAccountStore: (select: (s: unknown) => unknown) =>
    select({ activeAccountId: "a", unifiedInbox: false }),
  listedAccountIds: () => ["a"],
}));

describe("SearchBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useThreadStore.getState().clearSearch();
  });
  afterEach(() => vi.useRealTimers());
  it("scopes to Inbox and expands to all folders without changing the query", async () => {
    vi.mocked(searchMessages).mockResolvedValue([]);
    render(<SearchBar />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "invoice" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(searchMessages).toHaveBeenLastCalledWith(
      "invoice",
      "a",
      500,
      expect.objectContaining({ labelIds: ["INBOX"], excludeSpamTrash: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "All folders" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(searchMessages).toHaveBeenLastCalledWith(
      "invoice",
      "a",
      500,
      expect.objectContaining({ labelIds: [], excludeSpamTrash: false }),
    );
  });
  it("does not resurrect a cleared query when its request finishes", async () => {
    let finish!: (hits: never[]) => void;
    vi.mocked(searchMessages).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<SearchBar />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "invoice" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await act(async () => {
      finish([]);
    });
    expect(useThreadStore.getState().searchQuery).toBe("");
    expect(useThreadStore.getState().searchThreadIds).toBeNull();
  });
  it("shows failures instead of reverting to an unfiltered mailbox", async () => {
    vi.mocked(searchMessages).mockRejectedValue(
      new Error("Database unavailable"),
    );
    render(<SearchBar />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "invoice" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Database unavailable");
    expect(useThreadStore.getState().searchThreadIds?.size).toBe(0);
  });
});
