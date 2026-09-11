import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "./CalendarPage";
import { syncCalendarAccount } from "@/services/calendar/syncCalendar";
import { getCalendarEventsInRangeMulti } from "@/services/db/calendarEvents";

vi.mock("@/stores/accountStore", () => ({
  useAccountStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      activeAccountId: "account-1",
      calendarAccountId: "account-1",
      accounts: [{
        id: "account-1",
        email: "one@example.com",
        displayName: "One",
        isActive: true,
        provider: "gmail_api",
      }],
      setCalendarAccountId: vi.fn(),
    }),
}));

vi.mock("@/services/calendar/providerFactory", () => ({
  hasCalendarSupport: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/calendar/syncCalendar", () => ({
  syncCalendarAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/db/calendarEvents", () => ({
  getCalendarEventsInRangeMulti: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/services/db/calendars", () => ({
  getVisibleCalendars: vi.fn().mockResolvedValue([]),
  getCalendarsForAccount: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/services/calendar/createEvent", () => ({
  createCalendarEvent: vi.fn(),
}));

vi.mock("./CalendarToolbar", () => ({
  CalendarToolbar: ({
    onNext,
    onViewChange,
  }: {
    onNext: () => void;
    onViewChange: (view: "month" | "week" | "day") => void;
  }) => (
    <div>
      <button onClick={onNext}>Next range</button>
      <button onClick={() => onViewChange("week")}>Week view</button>
    </div>
  ),
}));

vi.mock("./MonthView", () => ({ MonthView: () => <div>Month</div> }));
vi.mock("./WeekView", () => ({ WeekView: () => <div>Week</div> }));
vi.mock("./DayView", () => ({ DayView: () => <div>Day</div> }));
vi.mock("./CalendarAccountPicker", () => ({ CalendarAccountPicker: () => null }));
vi.mock("./CalendarList", () => ({ CalendarList: () => null }));
vi.mock("./CalendarReauthBanner", () => ({ CalendarReauthBanner: () => null }));
vi.mock("./EventCreateModal", () => ({ EventCreateModal: () => null }));
vi.mock("./EventDetailModal", () => ({ EventDetailModal: () => null }));

describe("CalendarPage synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(syncCalendarAccount).mockResolvedValue(undefined);
    vi.mocked(getCalendarEventsInRangeMulti).mockResolvedValue([]);
  });

  it("syncs remotely once on entry and uses local data for range/view changes", async () => {
    render(<CalendarPage />);

    await waitFor(() => expect(syncCalendarAccount).toHaveBeenCalledTimes(1));
    expect(syncCalendarAccount).toHaveBeenCalledWith("account-1");

    fireEvent.click(screen.getByText("Next range"));
    fireEvent.click(screen.getByText("Week view"));

    await waitFor(() => expect(getCalendarEventsInRangeMulti).toHaveBeenCalled());
    expect(syncCalendarAccount).toHaveBeenCalledTimes(1);
  });
});
