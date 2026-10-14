import { describe, expect, it } from "vitest";
import { parseIcs, toEventIcs } from "./ics";
import type { CalendarEvent } from "./types";

const cal = (body: string) => `BEGIN:VCALENDAR\n${body}\nEND:VCALENDAR`;

const CLUB_FEED = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:black-alps
DTSTART;VALUE=DATE:20261105
DTEND;VALUE=DATE:20261107
SUMMARY:Black Alps
LOCATION:Yverdon-les-Bains
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:cancelled
DTSTART;VALUE=DATE:20261101
SUMMARY:Dropped
STATUS:CANCELLED
END:VEVENT
BEGIN:VEVENT
UID:maybe
DTSTART;VALUE=DATE:20261102
SUMMARY:Maybe
STATUS:TENTATIVE
END:VEVENT
BEGIN:VEVENT
UID:unstated
DTSTART;VALUE=DATE:20261103
SUMMARY:Unstated
END:VEVENT
END:VCALENDAR
`;

describe("parseIcs", () => {
  it("reads all-day events and treats DTEND as exclusive", () => {
    const [event] = parseIcs(CLUB_FEED);
    expect(event).toMatchObject({
      id: "black-alps",
      title: "Black Alps",
      location: "Yverdon-les-Bains",
      all_day: true,
      starts_at: new Date(2026, 10, 5).getTime(),
      ends_at: new Date(2026, 10, 7).getTime(),
    });
  });

  it("drops only cancelled events", () => {
    expect(parseIcs(CLUB_FEED).map((event) => event.title)).toEqual([
      "Black Alps",
      "Maybe",
      "Unstated",
    ]);
  });

  it("unfolds lines and unescapes text", () => {
    const ics = [
      "BEGIN:VEVENT",
      "UID:folded",
      "DTSTART;VALUE=DATE:20261201",
      "STATUS:CONFIRMED",
      "SUMMARY:Meet\\, greet",
      "DESCRIPTION:line one\\nline",
      "  two",
      "END:VEVENT",
    ].join("\r\n");

    const [event] = parseIcs(cal(ics));
    expect(event.title).toBe("Meet, greet");
    expect(event.description).toBe("line one\nline two");
  });

  it("reads a UTC timed event and a duration", () => {
    const ics = cal(`BEGIN:VEVENT
UID:timed
DTSTART:20261105T180000Z
DURATION:PT2H
STATUS:CONFIRMED
SUMMARY:Meetup
END:VEVENT`);
    const [event] = parseIcs(ics);
    expect(event.all_day).toBe(false);
    expect(event.starts_at).toBe(Date.UTC(2026, 10, 5, 18, 0, 0));
    expect(event.ends_at).toBe(Date.UTC(2026, 10, 5, 20, 0, 0));
  });

  it("reads a TZID wall time", () => {
    const ics = cal(`BEGIN:VTIMEZONE
TZID:Europe/Zurich
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:zurich
DTSTART;TZID=Europe/Zurich:20261105T180000
STATUS:CONFIRMED
SUMMARY:Evening
END:VEVENT`);
    const [event] = parseIcs(ics);
    // November is CET, UTC+1.
    expect(event.starts_at).toBe(Date.UTC(2026, 10, 5, 17, 0, 0));
    expect(event.ends_at).toBeNull();
  });

  it("reads categories, including a comma-separated list", () => {
    const [trip, lecture] = parseIcs(cal(`BEGIN:VEVENT
UID:trip
DTSTART;VALUE=DATE:20261105
STATUS:CONFIRMED
SUMMARY:Black Alps
CATEGORIES:Travel,CTF
END:VEVENT
BEGIN:VEVENT
UID:talk
DTSTART;VALUE=DATE:20261009
STATUS:Confirmed
SUMMARY:intro2crypto
CATEGORIES:Meeting
END:VEVENT`));
    expect(trip.categories).toEqual(["Travel", "CTF"]);
    expect(lecture.categories).toEqual(["Meeting"]);
  });

  it("writes one event the visitor can import, and reads back the same facts", () => {
    const event: CalendarEvent = {
      id: "black-alps",
      title: "Black Alps",
      starts_at: new Date(2026, 10, 5).getTime(),
      ends_at: new Date(2026, 10, 7).getTime(),
      all_day: true,
      location: "Yverdon-les-Bains",
      description: "line one\nline, two",
      categories: ["Travel"],
    };
    const ics = toEventIcs(event, Date.UTC(2026, 9, 8, 12, 0, 0));
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261105");
    expect(ics).toContain("DTEND;VALUE=DATE:20261107");
    const [parsed] = parseIcs(ics);
    expect(parsed).toMatchObject({
      id: "black-alps",
      title: "Black Alps",
      location: "Yverdon-les-Bains",
      description: "line one\nline, two",
      categories: ["Travel"],
      all_day: true,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
    });
  });

  it("expands recurring events, applying overrides and cancellations", () => {
    const events = parseIcs(
      cal(`BEGIN:VEVENT
UID:friday
DTSTART:20261002T160000Z
DTEND:20261002T180000Z
RRULE:FREQ=WEEKLY;COUNT=4
SUMMARY:Friday meeting
END:VEVENT
BEGIN:VEVENT
UID:friday
RECURRENCE-ID:20261009T160000Z
DTSTART:20261009T170000Z
DTEND:20261009T190000Z
SUMMARY:Friday meeting (late)
END:VEVENT
BEGIN:VEVENT
UID:friday
RECURRENCE-ID:20261016T160000Z
DTSTART:20261016T160000Z
STATUS:CANCELLED
SUMMARY:Friday meeting
END:VEVENT`),
      Date.UTC(2026, 9, 14),
    );
    expect(events.map((e) => [e.title, e.starts_at])).toEqual([
      ["Friday meeting", Date.UTC(2026, 9, 2, 16)],
      ["Friday meeting (late)", Date.UTC(2026, 9, 9, 17)],
      ["Friday meeting", Date.UTC(2026, 9, 23, 16)],
    ]);
    expect(new Set(events.map((e) => e.id)).size).toBe(3);
  });

  it("gives an all-day event with no end a null end", () => {
    const [event] = parseIcs(cal(`BEGIN:VEVENT
UID:oneday
DTSTART;VALUE=DATE:20260102
STATUS:CONFIRMED
SUMMARY:Once
END:VEVENT`));
    expect(event.ends_at).toBeNull();
    expect(event.all_day).toBe(true);
  });
});
