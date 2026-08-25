import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWriteup, getWriteupCards, submitWriteup, updateWriteup } from "../api/extras";
import { Markdown } from "./Markdown";
import { MarkdownEditor } from "./MarkdownEditor";
import { VoteButton } from "./VoteButton";
import { DeleteButton } from "./DeleteButton";
import { useAuth } from "../auth/AuthContext";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { formatTimestamp, isSafeUrl, joinWriteup } from "../utils";
import type { Writeup, WriteupCard, WriteupSort } from "../types";

/**
 * All the writeups for one challenge: read them, and post your own.
 */
export function WriteupDetailModal({
  challengeId,
  challengeName,
  category,
  canSubmit,
  onClose,
}: {
  challengeId: string;
  challengeName: string;
  category: string;
  /** Whether this team solved the challenge.*/
  canSubmit: boolean;
  onClose: () => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [sort, setSort] = useState<WriteupSort>("new");
  const { profile } = useAuth();
  useEscapeKey(onClose);

  const cardsQuery = useQuery({
    queryKey: ["writeupCards", challengeId, sort],
    queryFn: () => getWriteupCards(challengeId, sort),
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="heading" style={{ fontSize: 17, color: "var(--text-bright)", fontWeight: 600 }}>
              {challengeName}
            </span>
            <div style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--red)", marginTop: 6 }}>
              {category.toUpperCase()} &middot; WRITEUPS
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            &#10005;
          </button>
        </div>

        <div className="modal-body">
          {composing ? (
            <WriteupComposer
              challengeId={challengeId}
              onDone={() => setComposing(false)}
            />
          ) : openId !== null ? (
            <WriteupReader id={openId} onBack={() => setOpenId(null)} />
          ) : (
            <>
              {cardsQuery.isLoading && <div className="loading">Loading...</div>}
              {cardsQuery.error && (
                <div className="error-text">{(cardsQuery.error as Error).message}</div>
              )}
              {cardsQuery.data?.length === 0 && (
                <div className="empty-text" style={{ padding: "16px 0" }}>
                  No writeups published yet. Be the first.
                </div>
              )}

              {(cardsQuery.data?.length ?? 0) > 1 && (
                <div className="sort-bar">
                  {(["new", "top"] as const).map((s) => (
                    <button
                      key={s}
                      className={`sort-tab${sort === s ? " active" : ""}`}
                      onClick={() => setSort(s)}
                    >
                      {s === "new" ? "NEWEST" : "TOP"}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {cardsQuery.data?.map((w: WriteupCard) => (
                  <div key={w.id} className="writeup-row-wrap">
                    <VoteButton
                      writeupId={w.id}
                      votes={w.votes}
                      voted={w.voted}
                      own={w.team_name === profile?.name}
                    />
                    <button className="writeup-row" onClick={() => setOpenId(w.id)}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontSize: 14, color: "var(--text)" }}>{w.team_name}</span>
                        <span style={{ fontSize: 11, color: "var(--text-dimmer)" }}>
                          {formatTimestamp(Date.parse(w.created_at)) ?? "-"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.65, marginTop: 8 }}>
                        {w.summary}
                      </div>
                    </button>
                    <DeleteButton
                      writeupId={w.id}
                    />
                  </div>
                ))}
              </div>

              {canSubmit ? (
                <button
                  className="btn btn-outline"
                  style={{ width: "100%", marginTop: 20 }}
                  onClick={() => setComposing(true)}
                >
                  POST A WRITEUP
                </button>
              ) : (
                <div className="mono-dim center" style={{ marginTop: 20 }}>
                  Solve this challenge to post your own writeup.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function WriteupReader({ id, onBack }: { id: number; onBack: () => void }) {
  const query = useQuery({ queryKey: ["writeup", id], queryFn: () => getWriteup(id) });
  const { profile } = useAuth();
  const writeup = query.data;

  return (
    <>
      <button className="btn btn-small btn-outline" style={{ marginBottom: 18 }} onClick={onBack}>
        &#8592; ALL WRITEUPS
      </button>

      {query.isLoading && <div className="loading">Loading...</div>}
      {query.error && <div className="error-text">{(query.error as Error).message}</div>}

      {writeup && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <span className="mono-dim">
              by {writeup.team_name} &middot; {formatTimestamp(Date.parse(writeup.created_at)) ?? "-"}
            </span>
            <VoteButton
              writeupId={writeup.id}
              votes={writeup.votes}
              voted={writeup.voted}
              own={writeup.team_name === profile?.name}
            />
          </div>

          <Markdown>{writeup.intro_md}</Markdown>

          {writeup.solution_md !== null ? (
            <>
              <div className="md-boundary">
                <span>FULL SOLUTION</span>
              </div>
              <Markdown>{writeup.solution_md}</Markdown>
              {isSafeUrl(writeup.url) && (
                <a href={writeup.url} target="_blank" rel="noopener noreferrer nofollow" style={{ fontSize: 12 }}>
                  &#8599; Original writeup
                </a>
              )}
            </>
          ) : (
            <div className="locked-panel">
              <div style={{ fontSize: 22, marginBottom: 10 }}>&#128274;</div>
              <div className="heading" style={{ fontSize: 15, color: "var(--text-bright)" }}>
                The rest is for solvers
              </div>
              <div className="mono-dim" style={{ marginTop: 8, lineHeight: 1.7 }}>
                Solve this challenge to unlock the full walkthrough and the exploit.
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

/** Compose a new writeup, or edit one that came back rejected. */
export function WriteupComposer({
  challengeId,
  existing,
  onDone,
}: {
  challengeId: string;
  existing?: Writeup;
  onDone: () => void;
}) {
  const [body, setBody] = useState(
    existing ? joinWriteup(existing.intro_md, existing.solution_md ?? "") : "",
  );
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      existing
        ? updateWriteup(existing.id, body, summary)
        : submitWriteup(challengeId, body, summary),
    onSuccess: () => {
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["myWriteups"] });
      queryClient.invalidateQueries({ queryKey: ["writeupCards"] });
    },
  });

  if (done) {
    return (
      <div className="center" style={{ padding: "18px 0" }}>
        <div className="check-badge">&#10003;</div>
        <div className="heading" style={{ fontSize: 18, color: "var(--text-bright)" }}>
          Submitted for review
        </div>
        <div className="mono-dim" style={{ marginTop: 8, lineHeight: 1.7 }}>
          Reviewers were pinged on Discord. It stays hidden until an admin approves it.
        </div>
        <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={onDone}>
          DONE
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="field">
        <div className="field-label">SUMMARY &middot; SHOWN ON THE CARD, ALWAYS PUBLIC</div>
        <input
          value={summary}
          maxLength={500}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Recovered the key from a reused nonce"
        />
      </div>

      <div className="field">
        <div className="field-label">WRITEUP</div>
        <MarkdownEditor value={body} onChange={setBody} disabled={mutation.isPending} />
      </div>

      {mutation.isError && (
        <div className="error-text" style={{ padding: 0, margin: "12px 0", textAlign: "left" }}>
          {(mutation.error as Error).message}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="btn btn-outline" onClick={onDone} disabled={mutation.isPending}>
          CANCEL
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          disabled={!body || !summary || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "SUBMITTING..." : "SUBMIT FOR REVIEW"}
        </button>
      </div>
    </>
  );
}
