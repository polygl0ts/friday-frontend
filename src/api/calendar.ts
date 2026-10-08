import { CALENDAR_FEED_PATH } from "../calendarFeed";
import { parseIcs } from "../ics";
import type { CalendarEvent } from "../types";

/** The public calendar. Same-origin on purpose: see `calendarFeed.ts`. */
export async function getEvents(): Promise<CalendarEvent[]> {
  const res = await fetch(CALENDAR_FEED_PATH);
  if (!res.ok) {
    throw new Error(`Calendar feed failed (${res.status})`);
  }
  return parseIcs(await res.text());
}
