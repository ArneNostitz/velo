import { createCalendarEvent, saveProviderCalendarEvent } from "./createEvent";
import type { CalendarEventData } from "./types";
import type { DbCalendar } from "@/services/db/calendars";

const mockCreateEvent = vi.fn();
const mockUpsertCalendarEvent = vi.fn();

vi.mock("./providerFactory", () => ({
  getCalendarProvider: vi.fn().mockResolvedValue({ createEvent: (...args: unknown[]) => mockCreateEvent(...args) }),
}));

vi.mock("@/services/db/calendarEvents", () => ({
  upsertCalendarEvent: (...args: unknown[]) => mockUpsertCalendarEvent(...args),
}));

function calendar(overrides: Partial<DbCalendar> = {}): DbCalendar {
  return {
    id: "calendar-db-1",
    account_id: "account-1",
    provider: "google_api",
    remote_id: "calendar@example.com",
    display_name: "Work",
    color: null,
    is_primary: 1,
    is_visible: 1,
    sync_token: null,
    ctag: null,
    created_at: 0,
    updated_at: 0,
    ...overrides,
  };
}

const createdEvent: CalendarEventData = {
  remoteEventId: "remote-event-1",
  uid: "uid-1",
  etag: "etag-1",
  summary: "Appointment",
  description: null,
  location: null,
  startTime: 1_789_200_600,
  endTime: 1_789_204_200,
  isAllDay: false,
  status: "confirmed",
  organizerEmail: null,
  attendeesJson: null,
  htmlLink: "https://calendar.example/event",
  icalData: null,
};

describe("createCalendarEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEvent.mockResolvedValue(createdEvent);
  });

  it("creates on the selected remote calendar and caches the provider response", async () => {
    const calendars = [
      calendar(),
      calendar({ id: "calendar-db-2", remote_id: "personal@example.com", is_primary: 0 }),
    ];

    await createCalendarEvent("account-1", calendars, {
      summary: "Appointment",
      description: "From an email",
      location: "Hauptstraße 12",
      startTime: "2026-09-12T14:30",
      endTime: "2026-09-12T15:30",
      calendarId: "calendar-db-2",
    });

    expect(mockCreateEvent).toHaveBeenCalledWith("personal@example.com", {
      summary: "Appointment",
      description: "From an email",
      location: "Hauptstraße 12",
      startTime: "2026-09-12T14:30",
      endTime: "2026-09-12T15:30",
    });
    expect(mockUpsertCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "account-1",
      calendarId: "calendar-db-2",
      googleEventId: "remote-event-1",
      summary: "Appointment",
    }));
  });

  it("uses the primary calendar when no calendar is selected", async () => {
    await createCalendarEvent("account-1", [calendar()], {
      summary: "Appointment",
      description: "",
      location: "",
      startTime: "2026-09-12T14:30",
      endTime: "2026-09-12T15:30",
    });

    expect(mockCreateEvent).toHaveBeenCalledWith("calendar@example.com", expect.objectContaining({ summary: "Appointment" }));
  });
});

describe("saveProviderCalendarEvent", () => {
  it("maps provider metadata to the local event record", async () => {
    await saveProviderCalendarEvent("account-1", "calendar-db-1", createdEvent);
    expect(mockUpsertCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
      remoteEventId: "remote-event-1",
      uid: "uid-1",
      etag: "etag-1",
    }));
  });
});
