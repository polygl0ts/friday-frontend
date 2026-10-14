import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { inviteWhoami, submitInvite } from "../api/extras";
import { AsciiFrame } from "../components/AsciiFrame";

/**
 * Lake Quals invitations: a team holding a valid invite token proposes
 * another team, needs approval.
 */
export function LakeQuals() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");

  const trimmed = token.trim();
  const whoamiQuery = useQuery({
    queryKey: ["inviteWhoami", trimmed],
    queryFn: () => inviteWhoami(trimmed),
    enabled: !!trimmed,
    retry: false,
  });
  const inviter = whoamiQuery.data?.team_name;

  const submitMutation = useMutation({
    mutationFn: () => submitInvite(trimmed, teamName, email),
    onSuccess: () => {
      setTeamName("");
      setEmail("");
    },
  });

  return (
    <div className="page auth-page">
      <AsciiFrame rank="silver" title={"lake quals"} className="auth-frame">
        <div style={{ width: 420, maxWidth: "100%" }}>
          <div
            className="heading"
            style={{
              fontSize: 24,
              color: "var(--text-bright)",
              fontWeight: 600,
            }}
          >
            Invite a team to Lake Quals
          </div>
          <div className="mono-dim" style={{ marginTop: 8, lineHeight: 1.6 }}>
            Paste the invite token you received by email, then specify the name
            and the email of the team you wanna invite. Once done, application
            will be subject to approval by organizers.
          </div>

          <form
            style={{ marginTop: 24 }}
            onSubmit={(e) => {
              e.preventDefault();
              submitMutation.mutate();
            }}
          >
            <div className="field">
              <div className="field-label">INVITE TOKEN</div>
              <input
                type="password"
                name="invite-token"
                autoComplete="off"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  submitMutation.reset();
                }}
              />
            </div>

            {trimmed && !whoamiQuery.isLoading && (
              <div
                className="mono-dim"
                style={{ marginBottom: 14, lineHeight: 1.6 }}
              >
                {inviter ? (
                  <>
                    Inviting as{" "}
                    <span style={{ color: "var(--text-bright)" }}>
                      {inviter}
                    </span>
                  </>
                ) : (
                  <span style={{ color: "var(--red)" }}>
                    Invalid or revoked token.
                  </span>
                )}
              </div>
            )}

            <div className="field">
              <div className="field-label">TEAM NAME</div>
              <input
                name="team"
                maxLength={100}
                value={teamName}
                disabled={!inviter}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
            <div className="field">
              <div className="field-label">TEAM EMAIL</div>
              <input
                name="email"
                type="email"
                maxLength={254}
                value={email}
                disabled={!inviter}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="captain@example.com"
              />
            </div>

            {submitMutation.isError && (
              <div
                className="error-text"
                style={{ padding: 0, marginBottom: 12, textAlign: "left" }}
              >
                {(submitMutation.error as Error).message}
              </div>
            )}
            {submitMutation.isSuccess && (
              <div className="chip" style={{ marginBottom: 12 }}>
                <span className="dot" style={{ background: "var(--green)" }} />
                Sent, waiting for organizer approval
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              style={{ width: "100%" }}
              disabled={
                !inviter ||
                !teamName.trim() ||
                !email.trim() ||
                submitMutation.isPending
              }
            >
              {submitMutation.isPending ? "SENDING..." : "INVITE →"}
            </button>
          </form>
        </div>
      </AsciiFrame>
    </div>
  );
}
