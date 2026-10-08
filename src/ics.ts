import type { CalendarEvent } from "./types";

/**
 * iCalendar text into club events.
 *
 * Enough of RFC 5545 for a Nextcloud public calendar: unfolded lines, text
 * escapes, all-day dates (whose `DTEND` is exclusive), and timed values in
 * UTC, floating local time, or a `TZID`. Recurrence rules are left as the
 * single base instance.
 */
export function parseIcs(ics: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let inEvent = false;
  let nested = 0;
  let props: Prop[] = [];

  for (const line of unfold(ics)) {
    const split = splitProperty(line);
    if (!split) continue;
    const { name, params, value } = split;

    if (name === "BEGIN") {
      if (value === "VEVENT" && !inEvent) {
        inEvent = true;
        nested = 0;
        props = [];
      } else if (inEvent) {
        nested += 1;
      }
      continue;
    }
    if (name === "END") {
      if (inEvent && nested > 0) nested -= 1;
      else if (value === "VEVENT" && inEvent) {
        const event = eventFromProps(props, events.length);
        if (event) events.push(event);
        inEvent = false;
      }
      continue;
    }
    if (inEvent && nested === 0) props.push({ name, params, value });
  }

  return events;
}

interface Prop {
  name: string;
  params: Map<string, string>;
  value: string;
}

function eventFromProps(props: Prop[], index: number): CalendarEvent | null {
  // Tentative and cancelled events stay off the page, as does one with no
  // status: only an explicit confirmation is shown.
  const status = propValue(props, "STATUS");
  if (status?.toUpperCase() !== "CONFIRMED") return null;

  const startProp = props.find((p) => p.name === "DTSTART");
  if (!startProp) return null;
  const start = parseInstant(startProp.value, startProp.params);
  if (!start) return null;

  let endsAt: number | null = null;
  const endProp = props.find((p) => p.name === "DTEND");
  if (endProp) {
    endsAt = parseInstant(endProp.value, endProp.params)?.ms ?? null;
  } else {
    const duration = propValue(props, "DURATION");
    const span = duration ? parseDuration(duration) : null;
    if (span != null) endsAt = start.ms + span;
  }

  const uid = propValue(props, "UID");
  return {
    id: uid && uid.length > 0 ? uid : `event-${index}`,
    title: unescapeText(propValue(props, "SUMMARY") ?? ""),
    starts_at: start.ms,
    ends_at: endsAt,
    all_day: start.allDay,
    location: unescapeText(propValue(props, "LOCATION") ?? ""),
    description: unescapeText(propValue(props, "DESCRIPTION") ?? ""),
    categories: props
      .filter((prop) => prop.name === "CATEGORIES")
      .flatMap((prop) => splitList(prop.value)),
  };
}

/** Comma-separated iCalendar text, keeping escaped commas inside a value. */
function splitList(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "\\" && i + 1 < value.length) {
      current += value[i + 1] === "n" || value[i + 1] === "N" ? "\n" : value[i + 1];
      i += 1;
    } else if (value[i] === ",") {
      const item = current.trim();
      if (item) parts.push(item);
      current = "";
    } else {
      current += value[i];
    }
  }
  const last = current.trim();
  if (last) parts.push(last);
  return parts;
}

function propValue(props: Prop[], name: string): string | undefined {
  return props.find((p) => p.name === name)?.value;
}

/** Join lines folded with a leading space or tab, per RFC 5545. */
function unfold(ics: string): string[] {
  const raw = ics.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else if (line !== "") {
      lines.push(line);
    }
  }
  return lines;
}

function splitProperty(line: string): Prop | null {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ":" && !quoted) {
      const head = parseHead(line.slice(0, i));
      return { ...head, value: line.slice(i + 1) };
    }
  }
  return null;
}

function parseHead(head: string): { name: string; params: Map<string, string> } {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  for (const c of head) {
    if (c === '"') {
      quoted = !quoted;
      current += c;
    } else if (c === ";" && !quoted) {
      parts.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  if (current) parts.push(current);

  const params = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    let val = part.slice(eq + 1);
    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
      val = val.slice(1, -1);
    }
    params.set(part.slice(0, eq).toUpperCase(), val);
  }
  return { name: (parts[0] ?? "").toUpperCase(), params };
}

function unescapeText(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "\\" && i + 1 < value.length) {
      const next = value[++i];
      out += next === "n" || next === "N" ? "\n" : next;
    } else {
      out += value[i];
    }
  }
  return out;
}

interface Instant {
  ms: number;
  allDay: boolean;
}

function parseInstant(value: string, params: Map<string, string>): Instant | null {
  const kind = (params.get("VALUE") ?? "").toUpperCase();
  const allDay = kind === "DATE" || (/^\d{8}$/.test(value) && kind !== "DATE-TIME");
  if (allDay) {
    const ms = dateOnly(value);
    return ms == null ? null : { ms, allDay: true };
  }

  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!match) return null;
  const [, ys, ms, ds, hs, mins, ss, zulu] = match;
  const y = Number(ys);
  const month = Number(ms);
  const day = Number(ds);
  const hour = Number(hs);
  const minute = Number(mins);
  const second = Number(ss);
  if (zulu) return { ms: Date.UTC(y, month - 1, day, hour, minute, second), allDay: false };

  const tzid = params.get("TZID");
  if (tzid) {
    const zoned = zonedToUtc(y, month, day, hour, minute, second, tzid);
    if (zoned != null) return { ms: zoned, allDay: false };
  }
  return { ms: new Date(y, month - 1, day, hour, minute, second).getTime(), allDay: false };
}

/** `YYYYMMDD` as local midnight. All-day events have no zone of their own. */
function dateOnly(value: string): number | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day).getTime();
}

/**
 * Wall-clock time in `timeZone` as UTC milliseconds.
 *
 * `Intl` can format an instant into a zone but not the reverse, so this
 * guesses UTC and corrects by the zone's offset at that instant, twice, which
 * settles the fold around a daylight-saving change.
 */
function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number | null {
  try {
    const wall = Date.UTC(year, month - 1, day, hour, minute, second);
    let utc = wall - tzOffsetMs(wall, timeZone);
    utc = wall - tzOffsetMs(utc, timeZone);
    return utc;
  } catch {
    return null;
  }
}

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcMs;
}

/** An iCalendar duration (`P1DT2H`) as milliseconds, or null if it isn't one. */
function parseDuration(value: string): number | null {
  const match =
    /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
      value,
    );
  if (!match) return null;
  const weeks = Number(match[2] ?? 0);
  const days = Number(match[3] ?? 0);
  const hours = Number(match[4] ?? 0);
  const minutes = Number(match[5] ?? 0);
  const seconds = Number(match[6] ?? 0);
  if (!match[2] && !match[3] && !match[4] && !match[5] && !match[6]) return null;
  const sign = match[1] === "-" ? -1 : 1;
  return (
    sign *
    ((((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60 + seconds) *
    1000
  );
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
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
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
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).getTime();
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
