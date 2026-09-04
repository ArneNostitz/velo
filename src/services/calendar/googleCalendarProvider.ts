import type {
  CalendarProvider,
  CalendarProviderType,
  CalendarInfo,
  CalendarEventData,
  CalendarSyncResult,
  CreateEventInput,
  UpdateEventInput,
} from "./types";
import { getGmailClient } from "@/services/gmail/tokenManager";
import type { GmailClient } from "@/services/gmail/client";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Google's way of saying "that sync token is no good, start over": HTTP 410,
 * with `fullSyncRequired` as the reason. `GmailClient.request` puts the status
 * and the body into the message, so both are matched — the status alone would
 * also catch a calendar that has been deleted, which this must not retry
 * forever, and the reason alone would miss a body that changes shape.
 */
function isFullSyncRequired(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("410") && message.includes("fullSyncRequired");
}

interface GoogleCalendarListItem {
  id: string;
  summary: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarListItem[];
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  organizer?: { email: string; displayName?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  htmlLink?: string;
  iCalUID?: string;
  etag?: string;
}

interface GoogleEventListResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly type: CalendarProviderType = "google_api";

  constructor(readonly accountId: string) {}

  private async getClient(): Promise<GmailClient> {
    return getGmailClient(this.accountId);
  }

  async listCalendars(): Promise<CalendarInfo[]> {
    const client = await this.getClient();
    const response = await client.request<GoogleCalendarListResponse>(
      `${CALENDAR_API_BASE}/users/me/calendarList`,
    );
    return (response.items ?? []).map((cal) => ({
      remoteId: cal.id,
      displayName: cal.summary,
      color: cal.backgroundColor ?? null,
      isPrimary: !!cal.primary,
    }));
  }

  async fetchEvents(calendarRemoteId: string, timeMin: string, timeMax: string): Promise<CalendarEventData[]> {
    const client = await this.getClient();
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });

    const encodedId = encodeURIComponent(calendarRemoteId);
    const url = `${CALENDAR_API_BASE}/calendars/${encodedId}/events?${params}`;
    const response = await client.request<GoogleEventListResponse>(url);
    return (response.items ?? []).map(mapGoogleEvent);
  }

  async createEvent(calendarRemoteId: string, event: CreateEventInput): Promise<CalendarEventData> {
    const client = await this.getClient();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const encodedId = encodeURIComponent(calendarRemoteId);
    const url = `${CALENDAR_API_BASE}/calendars/${encodedId}/events`;

    const body: Record<string, unknown> = {
      summary: event.summary,
      description: event.description,
      location: event.location,
    };

    if (event.isAllDay) {
      body.start = { date: event.startTime.split("T")[0] };
      body.end = { date: event.endTime.split("T")[0] };
    } else {
      body.start = { dateTime: new Date(event.startTime).toISOString(), timeZone: tz };
      body.end = { dateTime: new Date(event.endTime).toISOString(), timeZone: tz };
    }

    if (event.attendees) {
      body.attendees = event.attendees;
    }

    const created = await client.request<GoogleCalendarEvent>(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return mapGoogleEvent(created);
  }

  async updateEvent(calendarRemoteId: string, remoteEventId: string, event: UpdateEventInput): Promise<CalendarEventData> {
    const client = await this.getClient();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const encodedCalId = encodeURIComponent(calendarRemoteId);
    const encodedEventId = encodeURIComponent(remoteEventId);
    const url = `${CALENDAR_API_BASE}/calendars/${encodedCalId}/events/${encodedEventId}`;

    const body: Record<string, unknown> = {};
    if (event.summary !== undefined) body.summary = event.summary;
    if (event.description !== undefined) body.description = event.description;
    if (event.location !== undefined) body.location = event.location;

    if (event.startTime && event.endTime) {
      if (event.isAllDay) {
        body.start = { date: event.startTime.split("T")[0] };
        body.end = { date: event.endTime.split("T")[0] };
      } else {
        body.start = { dateTime: new Date(event.startTime).toISOString(), timeZone: tz };
        body.end = { dateTime: new Date(event.endTime).toISOString(), timeZone: tz };
      }
    }

    const updated = await client.request<GoogleCalendarEvent>(url, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return mapGoogleEvent(updated);
  }

  async deleteEvent(calendarRemoteId: string, remoteEventId: string): Promise<void> {
    const client = await this.getClient();
    const encodedCalId = encodeURIComponent(calendarRemoteId);
    const encodedEventId = encodeURIComponent(remoteEventId);
    const url = `${CALENDAR_API_BASE}/calendars/${encodedCalId}/events/${encodedEventId}`;
    await client.request(url, { method: "DELETE" });
  }

  /**
   * Incremental sync, falling back to a full one when the token is refused.
   *
   * Google answers a dead `syncToken` with `410 fullSyncRequired`. This used
   * to swallow that and return an empty result with `newSyncToken: null` —
   * and since the caller only writes a token when it gets one, the dead token
   * stayed in the database and was sent again on the next pass. Every sync
   * from then on was a 410, once a minute, and the calendar never updated
   * again. Now the refusal starts the sync over without a token, which both
   * fetches the events and hands back one that works.
   */
  async syncEvents(calendarRemoteId: string, syncToken?: string): Promise<CalendarSyncResult> {
    if (!syncToken) return this.collectEvents(calendarRemoteId, undefined);
    try {
      return await this.collectEvents(calendarRemoteId, syncToken);
    } catch (err) {
      if (!isFullSyncRequired(err)) throw err;
      const result = await this.collectEvents(calendarRemoteId, undefined);
      return { ...result, resyncRequired: true };
    }
  }

  private async collectEvents(
    calendarRemoteId: string,
    syncToken: string | undefined,
  ): Promise<CalendarSyncResult> {
    const client = await this.getClient();
    const encodedId = encodeURIComponent(calendarRemoteId);
    const created: CalendarEventData[] = [];
    const updated: CalendarEventData[] = [];
    const deletedRemoteIds: string[] = [];

    let pageToken: string | undefined;
    let nextSyncToken: string | null = null;

    do {
      const params = new URLSearchParams({ maxResults: "250" });
      if (syncToken) {
        params.set("syncToken", syncToken);
      } else {
        // Initial sync: fetch last 90 days to 365 days forward
        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - 90);
        params.set("timeMin", timeMin.toISOString());
        const timeMax = new Date();
        timeMax.setFullYear(timeMax.getFullYear() + 1);
        params.set("timeMax", timeMax.toISOString());
        params.set("singleEvents", "true");
      }
      if (pageToken) params.set("pageToken", pageToken);

      const url = `${CALENDAR_API_BASE}/calendars/${encodedId}/events?${params}`;

      const response = await client.request<GoogleEventListResponse>(url);

      for (const item of response.items ?? []) {
        if (item.status === "cancelled") {
          deletedRemoteIds.push(item.id);
        } else {
          const eventData = mapGoogleEvent(item);
          // For sync, we put everything in "created" (upsert logic handles deduplication)
          created.push(eventData);
        }
      }

      pageToken = response.nextPageToken;
      if (response.nextSyncToken) {
        nextSyncToken = response.nextSyncToken;
      }
    } while (pageToken);

    return { created, updated, deletedRemoteIds, newSyncToken: nextSyncToken, newCtag: null };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.listCalendars();
      return { success: true, message: "Connected to Google Calendar" };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : "Connection failed" };
    }
  }
}

function mapGoogleEvent(event: GoogleCalendarEvent): CalendarEventData {
  const isAllDay = !!event.start.date;
  const startTime = event.start.dateTime
    ? Math.floor(new Date(event.start.dateTime).getTime() / 1000)
    : Math.floor(new Date(event.start.date + "T00:00:00").getTime() / 1000);
  const endTime = event.end.dateTime
    ? Math.floor(new Date(event.end.dateTime).getTime() / 1000)
    : Math.floor(new Date(event.end.date + "T23:59:59").getTime() / 1000);

  return {
    remoteEventId: event.id,
    uid: event.iCalUID ?? null,
    etag: event.etag ?? null,
    summary: event.summary ?? null,
    description: event.description ?? null,
    location: event.location ?? null,
    startTime,
    endTime,
    isAllDay,
    status: event.status ?? "confirmed",
    organizerEmail: event.organizer?.email ?? null,
    attendeesJson: event.attendees ? JSON.stringify(event.attendees) : null,
    htmlLink: event.htmlLink ?? null,
    icalData: null,
  };
}
