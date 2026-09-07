import { act, render, screen } from "@testing-library/react";
import { ReadingPane } from "./ReadingPane";
import { useThreadStore, type Thread } from "@/stores/threadStore";

const route = vi.hoisted(() => ({ id: "broken" }));
vi.mock("@/hooks/useRouteNavigation", () => ({
  useSelectedThreadId: () => route.id,
}));
vi.mock("../email/ThreadView", () => ({
  ThreadView: ({ thread }: { thread: Thread }) => {
    if (thread.id === "broken") throw new Error("Message rendering failed");
    return <p>{thread.subject}</p>;
  },
}));

const good = {
  id: "good",
  accountId: "a",
  subject: "Readable email",
} as Thread;

afterEach(() => vi.restoreAllMocks());

it("recovers from a rendering error when another email is selected", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  route.id = "broken";
  useThreadStore.setState({
    threadMap: new Map([
      ["broken", { ...good, id: "broken" }],
      ["good", good],
    ]),
    cachedThreads: new Map(),
  });
  const view = render(<ReadingPane />);
  expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  route.id = "good";
  view.rerender(<ReadingPane />);
  expect(screen.getByText("Readable email")).toBeInTheDocument();
});

it("keeps the selected email open when the list reloads", () => {
  route.id = "good";
  useThreadStore.setState({
    threadMap: new Map([["good", good]]),
    cachedThreads: new Map([["good", good]]),
  });
  render(<ReadingPane />);
  act(() => useThreadStore.getState().setThreads([]));
  expect(screen.getByText("Readable email")).toBeInTheDocument();
});
