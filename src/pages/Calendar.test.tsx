import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "../types";
import { Calendar } from "./Calendar";

const getEvents = vi.fn<() => Promise<CalendarEvent[]>>();

vi.mock("../api/calendar", () => ({
  getEvents: () => getEvents(),
}));

function event(over: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt",
    title: "Meetup",
    starts_at: Date.now() + 86_400_000,
    ends_at: null,
    all_day: true,
    location: "",
    description: "",
    categories: [],
    ...over,
  };
}

function renderCalendar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Calendar />
    </QueryClientProvider>,
  );
}

describe("Calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists upcoming events by start and hides past ones behind a disclosure", async () => {
    const day = 86_400_000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    getEvents.mockResolvedValue([
      event({
        id: "later",
        title: "Later",
        starts_at: today.getTime() + 10 * day,
      }),
      event({
        id: "soon",
        title: "Soon",
        starts_at: today.getTime() + 2 * day,
        location: "EPFL",
      }),
      event({
        id: "done",
        title: "Done",
        starts_at: today.getTime() - 5 * day,
        ends_at: today.getTime() - 4 * day,
      }),
    ]);
    renderCalendar();

    expect(await screen.findByText(/Soon/)).toBeTruthy();
    const titles = screen.getAllByText(/\{ (Soon|Later|Done) \}/).map((el) => el.textContent);
    expect(titles.slice(0, 2)).toEqual(["{ Soon }", "{ Later }"]);
    expect(screen.getByText(/EPFL/)).toBeTruthy();
    expect(screen.getByText("past events (1)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "ADD EVENT" })).toBeNull();
  });

  it("offers the ics feed as a download", async () => {
    getEvents.mockResolvedValue([]);
    renderCalendar();

    const link = await screen.findByRole("link", { name: "get ics" });
    expect(link.getAttribute("href")).toBe("/calendar.ics");
    expect(link.getAttribute("download")).toBe("polygl0ts.ics");
  });

  it("downloads one event for the visitor's calendar", async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:event");
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    getEvents.mockResolvedValue([
      event({ title: "Black Alps", location: "Yverdon-les-Bains" }),
    ]);
    renderCalendar();

    fireEvent.click(await screen.findByRole("button", { name: "add to calendar" }));
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toContain("text/calendar");
    expect(await blob.text()).toContain("SUMMARY:Black Alps");
    expect(await blob.text()).toContain("LOCATION:Yverdon-les-Bains");
    vi.unstubAllGlobals();
  });

  it("prints an all-day range without a clock time", async () => {
    getEvents.mockResolvedValue([
      event({
        title: "Black Alps",
        starts_at: new Date(2026, 10, 5).getTime(),
        ends_at: new Date(2026, 10, 7).getTime(),
        location: "Yverdon-les-Bains",
      }),
    ]);
    renderCalendar();

    expect(await screen.findByText("05-11-2026 - 06-11-2026 · Yverdon-les-Bains")).toBeTruthy();
  });

  it("keeps a multi-day event that is underway in the upcoming list", async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
    getEvents.mockResolvedValue([
      event({ title: "Underway", starts_at: start.getTime(), ends_at: end.getTime() }),
    ]);
    renderCalendar();

    expect(await screen.findByText(/Underway/)).toBeTruthy();
    expect(screen.queryByText(/past events/)).toBeNull();
  });

  it("shows the feed error and the empty state", async () => {
    getEvents.mockRejectedValue(new Error("Calendar feed failed (502)"));
    const { unmount } = renderCalendar();
    expect(await screen.findByText("Calendar feed failed (502)")).toBeTruthy();
    unmount();

    getEvents.mockResolvedValue([]);
    renderCalendar();
    expect(await screen.findByText("Nothing planned yet.")).toBeTruthy();
  });
});
