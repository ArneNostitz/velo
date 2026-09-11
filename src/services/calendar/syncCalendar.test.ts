import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncCalendarAccount } from "./syncCalendar";
import { getCalendarProvider, hasCalendarSupport } from "./providerFactory";
import {
  getVisibleCalendars,
  upsertCalendar,
  updateCalendarSyncToken,
} from "@/services/db/calendars";
import {
  deleteEventByRemoteId,
  upsertCalendarEvent,
} from "@/services/db/calendarEvents";
import type { CalendarProvider } from "./types";

vi.mock("./providerFactory", () => ({
  getCalendarProvider: vi.fn(),
  hasCalendarSupport: vi.fn(),
}));

vi.mock("@/services/db/calendars", () => ({
  getVisibleCalendars: vi.fn(),
  upsertCalendar: vi.fn(),
  updateCalendarSyncToken: vi.fn(),
}));

vi.mock("@/services/db/calendarEvents", () => ({
  deleteEventByRemoteId: vi.fn(),
  upsertCalendarEvent: vi.fn(),
}));

const event = {
  remoteEventId: "event-1",
  uid: "uid-1",
  etag: "etag-1",
  summary: "Planning",
  description: null,
  location: null,
  startTime: 100,
  endTime: 200,
  isAllDay: false,
  status: "confirmed",
  organizerEmail: "one@example.com",
  attendeesJson: null,
  htmlLink: null,
  icalData: null,
};

describe("syncCalendarAccount", () => {
  const provider = {
    type: "google_api",
    listCalendars: vi.fn(),
    syncEvents: vi.fn(),
  } as unknown as CalendarProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasCalendarSupport).mockResolvedValue(true);
    vi.mocked(getCalendarProvider).mockResolvedValue(provider);
    vi.mocked(provider.listCalendars).mockResolvedValue([{ remoteId: "remote-1", displayName: "Main", color: null, isPrimary: true }]);
    vi.mocked(getVisibleCalendars).mockResolvedValue([{
      id: "calendar-1",
      account_id: "account-1",
      provider: "google_api",
      remote_id: "remote-1",
      display_name: "Main",
      color: null,
      is_primary: 1,
      is_visible: 1,
      sync_token: "old-token",
      ctag: null,
      created_at: 1,
      updated_at: 1,
    }]);
    vi.mocked(provider.syncEvents).mockResolvedValue({
      created: [event],
      updated: [],
      deletedRemoteIds: ["deleted-1"],
      newSyncToken: "new-token",
      newCtag: null,
    });
  });

  it("discovers calendars and applies one incremental synchronization", async () => {
    await syncCalendarAccount("account-1");

    expect(provider.listCalendars).toHaveBeenCalledTimes(1);
    expect(upsertCalendar).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "account-1",
      remoteId: "remote-1",
    }));
    expect(provider.syncEvents).toHaveBeenCalledWith("remote-1", "old-token");
    expect(upsertCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "account-1",
      remoteEventId: "event-1",
    }));
    expect(deleteEventByRemoteId).toHaveBeenCalledWith("calendar-1", "deleted-1");
    expect(updateCalendarSyncToken).toHaveBeenCalledWith("calendar-1", "new-token", null);
  });

  it("does no provider work for accounts without calendar support", async () => {
    vi.mocked(hasCalendarSupport).mockResolvedValue(false);

    await syncCalendarAccount("account-1");

    expect(getCalendarProvider).not.toHaveBeenCalled();
  });
});
