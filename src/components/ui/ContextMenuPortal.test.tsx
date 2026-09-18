import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContextMenuPortal } from "./ContextMenuPortal";
import { useContextMenuStore } from "@/stores/contextMenuStore";
import { useTaskStore } from "@/stores/taskStore";
import { insertTask } from "@/services/db/tasks";
import { extractTask } from "@/services/ai/taskExtraction";
import { navigateToLabel } from "@/router/navigate";

vi.mock("@/router/navigate", () => ({ navigateToLabel: vi.fn(), getActiveLabel: () => "inbox" }));
vi.mock("@/services/db/tasks", () => ({
  insertTask: vi.fn().mockResolvedValue("created-task"),
  getIncompleteTaskCount: vi.fn().mockResolvedValue(1),
  getTasksForThread: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/services/db/messages", () => ({ getMessagesForThread: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/ai/taskExtraction", () => ({ extractTask: vi.fn() }));

describe("selected email task actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTaskStore.setState({ selectedTaskId: null });
    useContextMenuStore.getState().openMenu("textSelection", { x: 40, y: 80 }, {
      accountId: "mailbox", threadId: "source-thread", text: "Send the signed contract today",
    });
  });

  it("creates a linked task from the strip and opens its selected row in Tasks", async () => {
    render(<ContextMenuPortal />);
    fireEvent.click(screen.getByRole("button", { name: "Make task" }));
    await waitFor(() => expect(navigateToLabel).toHaveBeenCalledWith("tasks"));
    expect(insertTask).toHaveBeenCalledWith({
      accountId: "mailbox", threadAccountId: "mailbox", threadId: "source-thread",
      title: "Send the signed contract today",
    });
    expect(useTaskStore.getState().selectedTaskId).toBe("created-task");
  });

  it("creates an AI task from the right-click menu while retaining its source text", async () => {
    useContextMenuStore.setState({ data: { ...useContextMenuStore.getState().data, contextMenu: true } });
    vi.mocked(extractTask).mockResolvedValue({ title: "Send contract", description: "Get the signature", priority: "high", dueDate: null });
    render(<ContextMenuPortal />);
    fireEvent.click(screen.getByRole("menuitem", { name: "Make AI task" }));
    await waitFor(() => expect(navigateToLabel).toHaveBeenCalledWith("tasks"));
    expect(extractTask).toHaveBeenCalledWith("source-thread", "mailbox", [], "Send the signed contract today");
    expect(insertTask).toHaveBeenCalledWith(expect.objectContaining({
      title: "Send contract", description: "Get the signature\n\nSelected text: Send the signed contract today",
      threadId: "source-thread", threadAccountId: "mailbox",
    }));
    expect(useTaskStore.getState().selectedTaskId).toBe("created-task");
  });
});
