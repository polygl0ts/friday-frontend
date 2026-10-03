import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createEvent, deleteEvent, getEvents } from "../api/extras";
import { useAuth } from "../auth/AuthContext";
import { AsciiFrame } from "../components/AsciiFrame";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageNote } from "../components/PageNote";
import type { CalendarEvent } from "../types";
import { formatTimestamp, fromDatetimeLocal, toDatetimeLocal } from "../utils";

function formatEventTime(ms: number) {
  return `${formatTimestamp(ms)} ${toDatetimeLocal(ms).slice(11)}`;
}

/**
 * One event row. Laid out like a deck card, so it reuses the deck styles.
 */
function EventCard({ event }: { event: CalendarEvent }) {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => deleteEvent(event.id),
    onSuccess: () => setConfirming(false),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const meta = [formatEventTime(Date.parse(event.starts_at)), event.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <AsciiFrame rank="deck" className="deck-card">
      <div className="deck-title">
        {"{ "}
        {event.title}
        {" }"}
      </div>
      <div className="deck-row">
        <span className="deck-meta">{meta}</span>
        {isAdmin && (
          <span className="deck-actions">
            <button
              type="button"
              className="btn btn-small"
              disabled={mutation.isPending}
              onClick={() => setConfirming(true)}
            >
              delete
            </button>
          </span>
        )}
      </div>
      {event.description && (
        <div
          className="deck-meta"
          style={{ marginTop: 8, whiteSpace: "pre-wrap" }}
        >
          {event.description}
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title="Delete this event?"
          confirmLabel={mutation.isPending ? "DELETING..." : "DELETE"}
          cancelLabel="KEEP IT"
          pending={mutation.isPending}
          error={mutation.error ? (mutation.error as Error).message : null}
          onConfirm={() => mutation.mutate()}
          onCancel={() => {
            mutation.reset();
            setConfirming(false);
          }}
        >
          <span style={{ color: "var(--text-bright)" }}>{event.title}</span>{" "}
          comes off the calendar for everyone. There is no undo - add it again
          to bring it back.
        </ConfirmDialog>
      )}
    </AsciiFrame>
  );
}

function AddEventForm() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const startsAt = fromDatetimeLocal(when);

  const mutation = useMutation({
    mutationFn: () =>
      createEvent({
        title: title.trim(),
        starts_at: new Date(startsAt!).toISOString(),
        location: location.trim(),
        description: description.trim(),
      }),
    onSuccess: () => {
      setTitle("");
      setWhen("");
      setLocation("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return (
    <form
      style={{ marginTop: 30, maxWidth: 760 }}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="field">
        <label className="field-label" htmlFor="event-title">
          title
        </label>
        <input
          id="event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="event-when">
          date &amp; time (your timezone)
        </label>
        <input
          id="event-when"
          type="datetime-local"
          className="schedule-input"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="event-location">
          location
        </label>
        <input
          id="event-location"
          value={location}
          placeholder="optional"
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="event-description">
          description
        </label>
        <textarea
          id="event-description"
          value={description}
          placeholder="optional"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {mutation.error && (
        <div className="error-text">{(mutation.error as Error).message}</div>
      )}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={!title.trim() || startsAt === null || mutation.isPending}
      >
        {mutation.isPending ? "ADDING..." : "ADD EVENT"}
      </button>
    </form>
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
  const { isAdmin } = useAuth();
  const eventsQuery = useQuery({ queryKey: ["events"], queryFn: getEvents });

  const today = new Date().setHours(0, 0, 0, 0);
  const events = eventsQuery.data ?? [];
  const upcoming = events.filter((e) => Date.parse(e.starts_at) >= today);
  const past = events.filter((e) => Date.parse(e.starts_at) < today).reverse();

  return (
    <div className="page">
      <PageNote page="calendar" />

      {isAdmin && <AddEventForm />}

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
