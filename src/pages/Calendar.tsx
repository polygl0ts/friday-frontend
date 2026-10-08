import { useQuery } from "@tanstack/react-query";
import { getEvents } from "../api/calendar";
import { CALENDAR_FEED_PATH } from "../calendarFeed";
import { toEventIcs } from "../ics";
import { AsciiFrame } from "../components/AsciiFrame";
import { PageNote } from "../components/PageNote";
import type { CalendarEvent } from "../types";
import { formatTimestamp, toDatetimeLocal } from "../utils";

/**
 * When the event happens, in the viewer's timezone.
 *
 * All-day ranges use the last inclusive day. The feed's end is exclusive, so
 * a Thursday-to-Saturday block is stored as ending Sunday midnight.
 */
function formatEventWhen(event: CalendarEvent): string {
  const startDate = formatTimestamp(event.starts_at);
  if (!startDate) return "";

  if (event.all_day) {
    const endDate = formatTimestamp(inclusiveAllDayEnd(event.ends_at));
    if (endDate && endDate !== startDate) return `${startDate} - ${endDate}`;
    return startDate;
  }

  const start = `${startDate} ${toDatetimeLocal(event.starts_at).slice(11)}`;
  if (event.ends_at == null) return start;
  const endDate = formatTimestamp(event.ends_at);
  const endTime = toDatetimeLocal(event.ends_at).slice(11);
  if (!endDate || endDate === startDate) return `${start} - ${endTime}`;
  return `${start} - ${endDate} ${endTime}`;
}

/** Local midnight of the last day an all-day event covers, or null. */
function inclusiveAllDayEnd(endsAt: number | null): number | null {
  if (endsAt == null) return null;
  const end = new Date(endsAt);
  return new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1).getTime();
}

/** When the event is over. A missing all-day end means a single day. */
function eventFinish(event: CalendarEvent): number {
  if (event.ends_at != null) return event.ends_at;
  if (event.all_day) {
    const start = new Date(event.starts_at);
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).getTime();
  }
  return event.starts_at;
}

/**
 * One event row. Laid out like a deck card, so it reuses the deck styles.
 * Same treatment as a challenge card: bright title, dim date line, body text.
 */
/** Save this one event as a file the visitor's calendar app can import. */
function downloadEvent(event: CalendarEvent) {
  const blob = new Blob([toEventIcs(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const name = event.title.replace(/[\\/:*?"<>|]+/g, "").trim() || "event";
  link.download = `${name}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EventCard({ event }: { event: CalendarEvent }) {
  const meta = [formatEventWhen(event), event.location].filter(Boolean).join(" · ");

  return (
    <AsciiFrame rank="deck" className="deck-card calendar-event">
      <div className="deck-title">
        {"{ "}
        {event.title}
        {" }"}
      </div>
      <div className="deck-row">
        <span className="calendar-when">{meta}</span>
        <span className="deck-actions">
          <button type="button" className="btn btn-small" onClick={() => downloadEvent(event)}>
            add to calendar
          </button>
        </span>
      </div>
      {event.description && <div className="calendar-desc">{event.description}</div>}
    </AsciiFrame>
  );
}

const LIST_STYLE = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
  marginTop: 30,
  maxWidth: 760,
} as const;

/** Public on purpose, like the slides: it's what we show people before they join. */
export function Calendar() {
  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: getEvents,
    staleTime: 5 * 60 * 1000,
  });

  const now = Date.now();
  const events = eventsQuery.data ?? [];
  const upcoming = events
    .filter((event) => eventFinish(event) > now)
    .sort((a, b) => a.starts_at - b.starts_at);
  const past = events
    .filter((event) => eventFinish(event) <= now)
    .sort((a, b) => b.starts_at - a.starts_at);

  return (
    <div className="page">
      <PageNote page="calendar" />

      <a className="btn btn-small calendar-ics" href={CALENDAR_FEED_PATH} download="polygl0ts.ics">
        get ics
      </a>

      {eventsQuery.isLoading && <div className="loading">Loading...</div>}
      {eventsQuery.error && (
        <div className="error-text">{(eventsQuery.error as Error).message}</div>
      )}
      {eventsQuery.data && upcoming.length === 0 && (
        <div className="empty-text">Nothing planned yet.</div>
      )}

      <div style={LIST_STYLE}>
        {upcoming.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {past.length > 0 && (
        <details style={{ marginTop: 30 }}>
          <summary className="deck-meta" style={{ cursor: "pointer" }}>
            past events ({past.length})
          </summary>
          <div style={LIST_STYLE}>
            {past.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
