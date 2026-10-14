import ICAL from "ical.js";
import type { CalendarEvent } from "./types";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * iCalendar text into club events.
 */
export function parseIcs(ics: string, now = Date.now()): CalendarEvent[] {
  const vcalendar = new ICAL.Component(ICAL.parse(ics));
  const masters: ICAL.Event[] = [];
  const exceptions: ICAL.Event[] = [];
  for (const vevent of vcalendar.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(vevent);
    (event.isRecurrenceException() ? exceptions : masters).push(event);
  }
  for (const exception of exceptions) {
    masters.find((m) => m.uid === exception.uid)?.relateException(exception);
  }

  const events: CalendarEvent[] = [];
  const add = (
    item: ICAL.Event,
    start: ICAL.Time,
    end: ICAL.Time,
    id: string,
  ) => {
    const event = toEvent(item, start, end, id);
    if (event) events.push(event);
  };
  for (const master of masters) {
    if (!master.isRecurring()) {
      add(master, master.startDate, master.endDate, master.uid);
      continue;
    }
    const it = master.iterator();
    for (
      let next = it.next();
      next && ms(next) < now + YEAR_MS;
      next = it.next()
    ) {
      const o = master.getOccurrenceDetails(next);
      if (ms(o.endDate) < now - YEAR_MS) continue;
      add(
        o.item,
        o.startDate,
        o.endDate,
        `${master.uid}/${o.recurrenceId.toString()}`,
      );
    }
  }
  return events;
}

const ms = (time: ICAL.Time) => time.toJSDate().getTime();

function toEvent(
  item: ICAL.Event,
  start: ICAL.Time,
  end: ICAL.Time,
  id: string,
): CalendarEvent | null {
  const vevent = item.component;
  const status = String(vevent.getFirstPropertyValue("status") ?? "");
  if (status.toUpperCase() === "CANCELLED") return null;
  const hasEnd = vevent.hasProperty("dtend") || vevent.hasProperty("duration");
  return {
    id,
    title: item.summary ?? "",
    starts_at: ms(start),
    ends_at: hasEnd ? ms(end) : null,
    all_day: start.isDate,
    location: item.location ?? "",
    description: item.description ?? "",
    categories: vevent
      .getAllProperties("categories")
      .flatMap((prop) => prop.getValues().map(String)),
  };
}

/**
 * One event as an iCalendar file a visitor can open to put it on their own
 * calendar. `METHOD:PUBLISH` is a copy, not an invitation that expects a reply.
 */
export function toEventIcs(event: CalendarEvent, now = Date.now()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//polygl0ts//friday//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.id)}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART${icsInstant(event.starts_at, event.all_day)}`,
    "STATUS:CONFIRMED",
  ];
  const end = icsEnd(event);
  if (end != null) lines.push(`DTEND${icsInstant(end, event.all_day)}`);
  lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description)
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.categories.length) {
    lines.push(`CATEGORIES:${event.categories.map(escapeIcsText).join(",")}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** A missing all-day end is a single local day. Timed events may have no end. */
function icsEnd(event: CalendarEvent): number | null {
  if (event.ends_at != null) return event.ends_at;
  if (!event.all_day) return null;
  const start = new Date(event.starts_at);
  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 1,
  ).getTime();
}

function icsInstant(ms: number, allDay: boolean): string {
  if (allDay) {
    const date = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `;VALUE=DATE:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  }
  return `:${utcStamp(ms)}`;
}

function utcStamp(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** RFC 5545 folds a content line at 75 octets. Continuation starts with a space. */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  let width = 75;
  const decoder = new TextDecoder();
  while (start < bytes.length) {
    let end = Math.min(start + width, bytes.length);
    while (end > start && (bytes[end] & 0xc0) === 0x80) end -= 1;
    parts.push(decoder.decode(bytes.slice(start, end)));
    start = end;
    width = 74;
  }
  return parts.join("\r\n ");
}
