import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listTeamSubmissions, submittedFlag } from "../api/rctf";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { formatTimestamp } from "../utils";
import type {
  RctfAdminUser,
  RctfSubmission,
  RctfSubmissionKind,
  RctfSubmissionResult,
  RctfSubmissionSortBy,
} from "../types";

/**
 * One team's submission log - what the team panel's DETAILED button opens.
 *
 * The view rCTF's own frontend has no equivalent of, and the reason it is worth
 * building: a solve list says what a team got right, and this says what they
 * *typed*. Every evaluated attempt, in order, with the literal flag string and
 * the source IP - which is what a flag-sharing or brute-force question is
 * actually answered from. `cheated` rows are the sharp end: a valid flag issued
 * to another team.
 *
 * Two things it is not. It is not a request log - rate-limited attempts, and
 * attempts by a banned team or against an unknown challenge, are refused before
 * rCTF writes a row. And it is not retroactive: the log only holds what has
 * been submitted since the rCTF version that introduced it.
 */

/** Below rCTF's cap of 100, deliberately: a page an admin can read top to
 *  bottom without losing their place, on a route where paging is cheap. */
const PAGE_SIZE = 50;

const RESULTS: Record<string, { label: string; tone: string }> = {
  correct: { label: "CORRECT", tone: "good" },
  cheated: { label: "CHEATED", tone: "alarm" },
  incorrect: { label: "INCORRECT", tone: "soft" },
  already_solved: { label: "ALREADY SOLVED", tone: "warn" },
  queued: { label: "QUEUED", tone: "dim" },
  active_job: { label: "ACTIVE JOB", tone: "dim" },
  invalid_input: { label: "INVALID INPUT", tone: "warn" },
  bad_instancer_state: { label: "BAD INSTANCER STATE", tone: "warn" },
};

function resultOf(result: string): { label: string; tone: string } {
  return RESULTS[result] ?? { label: result.replace(/_/g, " ").toUpperCase(), tone: "dim" };
}

/**
 * The filter pills. Two different filters behind one control on purpose: the
 * four flag results and the admin-bot *kind* are what an admin actually asks
 * for, and no admin-bot row carries a flag result - the two sets never overlap,
 * so a single row of choices cannot express a contradiction.
 */
interface Filter {
  key: string;
  label: string;
  results?: RctfSubmissionResult[];
  kinds?: RctfSubmissionKind[];
}

const FILTERS: Filter[] = [
  { key: "all", label: "ALL" },
  { key: "correct", label: "CORRECT", results: ["correct"] },
  { key: "cheated", label: "CHEATED", results: ["cheated"] },
  { key: "incorrect", label: "INCORRECT", results: ["incorrect"] },
  { key: "already_solved", label: "ALREADY SOLVED", results: ["already_solved"] },
];

/** Column headings, and the `sortBy` each one asks rCTF for. FLAG has none:
 *  the route sorts on six columns and the submitted flag is not one of them,
 *  and a client-side sort of one page would be a sort of the wrong rows. */
const COLUMNS: { label: string; sortBy?: RctfSubmissionSortBy }[] = [
  { label: "TIME", sortBy: "createdAt" },
  { label: "CHALLENGE", sortBy: "challenge" },
  { label: "KIND", sortBy: "kind" },
  { label: "RESULT", sortBy: "result" },
  { label: "FLAG SUBMITTED" },
  { label: "IP", sortBy: "ip" },
];

/**
 * What the row shows in its FLAG column.
 *
 * A flag submission carries the string that was typed, even when it was wrong -
 * that is the column's whole reason to exist. An admin-bot job carries no flag
 * but does carry its inputs, which is the equivalent thing to see. Everything
 * else - an admin-granted solve, most of all - genuinely has no payload, and
 * says so rather than printing an empty cell that reads like a bug.
 */
function payloadOf(submission: RctfSubmission): { text: string; kind: "flag" | "inputs" | "none" } {
  const flag = submittedFlag(submission);
  if (flag !== null) return { text: flag === "" ? "(empty)" : flag, kind: "flag" };

  const inputs = submission.details?.inputs;
  if (inputs && typeof inputs === "object" && !Array.isArray(inputs)) {
    const pairs = Object.entries(inputs as Record<string, unknown>);
    if (pairs.length > 0) {
      return { text: pairs.map(([k, v]) => `${k}=${String(v)}`).join("  "), kind: "inputs" };
    }
  }
  return { text: "no flag recorded", kind: "none" };
}

/** A row's timestamp, to the second, falling back to whatever rCTF sent when
 *  it is not a date this can read. See `parseRctfTimestamp`. */
function timeOf(submission: RctfSubmission): string {
  return formatTimestamp(submission.createdAt, true) ?? submission.createdAtRaw ?? "-";
}

/** Everything the row does not have room for, opened one row at a time. The
 *  raw `details` object is printed as it arrived: it is provider-specific, and
 *  guessing at its shape is how a matched-flag config or an admin-bot error
 *  goes missing. */
function SubmissionDetail({ submission }: { submission: RctfSubmission }) {
  const entries: [string, string | null][] = [
    ["SUBMISSION ID", submission.id],
    ["CHALLENGE ID", submission.challengeId],
    ["CATEGORY", submission.challengeCategory || null],
    ["RELATED ID", submission.relatedId],
    ["CHEATED FROM", submission.cheatedFromId],
    // Present only when the row is a `cheated` one and that team still exists.
    ["CHEATED FROM (NAME)", submission.cheatedFromName],
    ["EXACT TIME", submission.createdAtRaw || null],
  ];

  return (
    <div className="sub-detail">
      <dl className="sub-detail-grid">
        {entries.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? <span className="admin-cell-empty">&mdash;</span>}</dd>
          </div>
        ))}
      </dl>
      <div className="sub-detail-label">DETAILS</div>
      <pre className="sub-detail-json">{JSON.stringify(submission.details ?? {}, null, 2)}</pre>
    </div>
  );
}

export function TeamSubmissionsModal({ team, onClose }: { team: RctfAdminUser; onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>(FILTERS[0]);
  const [sortBy, setSortBy] = useState<RctfSubmissionSortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [snapshot, setSnapshot] = useState(() => new Date().toISOString());

  useEscapeKey(onClose);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useQuery({
    queryKey: [
      "teamSubmissions",
      team.id,
      { offset, sortBy, sortOrder, search, filter: filter.key, snapshot },
    ],
    queryFn: () =>
      listTeamSubmissions(team.id, {
        limit: PAGE_SIZE,
        offset,
        sortBy,
        sortOrder,
        challengeSearch: search,
        results: filter.results,
        kinds: filter.kinds,
        createdBefore: snapshot,
      }),
    placeholderData: keepPreviousData,
  });

  /**
   * How many submissions this team has made, all of them - a fact about the
   * team, stated beside its solve count and its score.
   *
   * Its own request rather than the page's `total`, which counts what the
   * filters matched: a number sitting between SOLVES and PTS must not move when
   * a pill is clicked, or it reads as one of those two changing. The filtered
   * count is in the footer, next to the pager it belongs to. `limit: 1` because
   * only the count is wanted; rCTF computes `total` independently of the page.
   */
  const countQuery = useQuery({
    queryKey: ["teamSubmissionsTotal", team.id, snapshot],
    queryFn: () => listTeamSubmissions(team.id, { limit: 1, createdBefore: snapshot }),
    select: (page) => page.total,
  });

  const rows = query.data?.submissions ?? [];
  const total = query.data?.total ?? 0;
  // Off the rows on screen, not off `offset`: a page can come back empty while
  // the filter still matches rows elsewhere in the log, and counting from the
  // offset alone prints the backwards "1-0 OF 9".
  const range =
    rows.length > 0
      ? `${offset + 1}-${offset + rows.length} OF ${total}`
      : total > 0
        ? `0 OF ${total}`
        : "0 SUBMISSIONS";

  // Team facts come off the rows when there are any: these are rCTF's own
  // values for this team, and two of them - country and status - reach the
  // frontend through no other call the app makes. The team row from the panel
  // is the fallback, and says the same thing about name, division and ban.
  const sample = rows[0];
  const division = sample?.userDivision || team.division;
  const banned = sample?.userBanned ?? team.banned;
  const avatarUrl = sample?.userAvatarUrl ?? team.avatarUrl;

  function sortOn(column: RctfSubmissionSortBy) {
    if (column === sortBy) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setOffset(0);
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-subs" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="sub-team">
            <span className="row-avatar">
              {avatarUrl && <img className="avatar-img" src={avatarUrl} alt="" />}
            </span>
            <span className="sub-team-name">
              <span className="heading" style={{ fontSize: 15, color: "var(--text-bright)", fontWeight: 600 }}>
                {sample?.userName || team.name}
              </span>
              <span className="admin-team-id">{team.id}</span>
            </span>
          </span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            &#10005;
          </button>
        </div>

        <div className="sub-facts">
          <span className="chip chip-tag">{division || "no division"}</span>
          {banned && <span className="chip chip-tag sub-chip-alarm">BANNED</span>}
          {sample?.userCountryCode && <span className="chip chip-tag">{sample.userCountryCode}</span>}
          {sample?.userStatusText && <span className="chip chip-tag">{sample.userStatusText}</span>}
          <span className="sub-facts-spacer" />
          <span className="sub-facts-count">
            {team.solveCount} SOLVES &middot;{" "}
            {/* A dash until the count is in, not 0: "no submissions yet" and
                "not read yet" are different answers, and they read the same. */}
            {countQuery.data ?? "-"} SUBMISSIONS &middot; {team.score} PTS
          </span>
        </div>

        <div className="sub-controls">
          <div className="sub-pills">
            {FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`pill pill-small${option.key === filter.key ? " active" : ""}`}
                aria-pressed={option.key === filter.key}
                onClick={() => {
                  setFilter(option);
                  setOffset(0);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            className="sub-search"
            value={searchInput}
            placeholder="challenge name or category..."
            aria-label="Filter by challenge"
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="modal-body sub-body">
          {query.isLoading && <div className="loading">Loading submissions...</div>}
          {query.error && <div className="error-text">{(query.error as Error).message}</div>}
          {query.isSuccess && rows.length === 0 && (
            <div className="empty-text">
              {total === 0 && !search && filter.key === "all"
                ? "No submissions found for this team."
                : "No submissions match this filter."}
            </div>
          )}

          {rows.length > 0 && (
            <div className="table">
              <div className="table-row table-subs table-head">
                {COLUMNS.map((column) =>
                  column.sortBy ? (
                    <button
                      key={column.label}
                      type="button"
                      className={`sub-sort${column.sortBy === sortBy ? " active" : ""}`}
                      onClick={() => sortOn(column.sortBy!)}
                    >
                      {column.label}
                      {column.sortBy === sortBy && <span>{sortOrder === "desc" ? " ▾" : " ▴"}</span>}
                    </button>
                  ) : (
                    <span key={column.label}>{column.label}</span>
                  ),
                )}
              </div>

              {rows.map((submission) => {
                const result = resultOf(submission.result);
                const payload = payloadOf(submission);
                const isOpen = expanded === submission.id;
                return (
                  <div key={submission.id}>
                    <div
                      className={`table-row table-subs${isOpen ? " open" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isOpen}
                      title="Show everything rCTF recorded for this submission"
                      onClick={() => setExpanded(isOpen ? null : submission.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpanded(isOpen ? null : submission.id);
                        }
                      }}
                    >
                      {/* Titled with its own text: the cell clips rather than
                          overlapping the column beside it, so a value too long
                          for the column is still readable on hover. */}
                      <span className="sub-time" title={timeOf(submission)}>
                        {timeOf(submission)}
                      </span>
                      <span className="sub-chall">
                        <span style={{ color: "var(--text-bright)" }}>{submission.challengeName}</span>
                        <span className="admin-chall-id">{submission.challengeCategory || "—"}</span>
                      </span>
                      <span className="sub-kind">{submission.kind === "admin_bot" ? "ADMIN BOT" : "FLAG"}</span>
                      <span className={`sub-result sub-result-${result.tone}`}>
                        {result.label}
                        {submission.cheatedFromId && (
                          <span className="sub-cheated">
                            from {submission.cheatedFromName ?? submission.cheatedFromId}
                          </span>
                        )}
                      </span>
                      <span className={`sub-flag sub-flag-${payload.kind} sub-flag-${result.tone}`}>
                        {payload.text}
                      </span>
                      <span className="sub-ip">{submission.ip}</span>
                    </div>
                    {isOpen && <SubmissionDetail submission={submission} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sub-footer">
          <span className="sub-range">
            {range}
            {query.isFetching && <span className="sub-fetching"> &middot; LOADING</span>}
          </span>
          <div className="sub-pager">
            <button
              type="button"
              className="btn btn-small btn-outline"
              title="Re-read the log, including anything submitted since this opened"
              onClick={() => {
                setSnapshot(new Date().toISOString());
                setOffset(0);
              }}
            >
              REFRESH
            </button>
            <button
              type="button"
              className="btn btn-small btn-outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
            >
              PREV
            </button>
            <button
              type="button"
              className="btn btn-small btn-outline"
              disabled={offset + rows.length >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              NEXT
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
