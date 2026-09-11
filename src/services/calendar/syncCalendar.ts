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

/**
 * Synchronize one account's calendars on demand.
 *
 * This intentionally has no timer and is not called by mail sync. The
 * Calendar page owns when remote calendar work is appropriate.
 */
export async function syncCalendarAccount(accountId: string): Promise<void> {
  if (!(await hasCalendarSupport(accountId))) return;

  const provider = await getCalendarProvider(accountId);
  const calendarInfos = await provider.listCalendars();
  for (const calendar of calendarInfos) {
    await upsertCalendar({
      accountId,
      provider: provider.type,
      remoteId: calendar.remoteId,
      displayName: calendar.displayName,
      color: calendar.color,
      isPrimary: calendar.isPrimary,
    });
  }

  const visibleCalendars = await getVisibleCalendars(accountId);
  let firstError: unknown;
  for (const calendar of visibleCalendars) {
    try {
      const result = await provider.syncEvents(
        calendar.remote_id,
        calendar.sync_token ?? undefined,
      );

      for (const event of [...result.created, ...result.updated]) {
        await upsertCalendarEvent({
          accountId,
          googleEventId: event.remoteEventId,
          summary: event.summary,
          description: event.description,
          location: event.location,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          status: event.status,
          organizerEmail: event.organizerEmail,
          attendeesJson: event.attendeesJson,
          htmlLink: event.htmlLink,
          calendarId: calendar.id,
          remoteEventId: event.remoteEventId,
          etag: event.etag,
          icalData: event.icalData,
          uid: event.uid,
        });
      }

      for (const remoteId of result.deletedRemoteIds) {
        await deleteEventByRemoteId(calendar.id, remoteId);
      }

      // A refused token must be replaced even when the provider returns null.
      if (result.newSyncToken || result.newCtag || result.resyncRequired) {
        await updateCalendarSyncToken(
          calendar.id,
          result.newSyncToken,
          result.newCtag,
        );
      }
    } catch (error) {
      firstError ??= error;
      console.warn(
        `[calendarSync] Failed to sync ${calendar.display_name ?? calendar.remote_id}:`,
        error,
      );
    }
  }

  if (firstError) throw firstError;
}
