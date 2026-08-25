import { useState } from "react";

/**
 * The team token, on the profile page.
 *
 * The register screen tells players to save this "from your profile
 * afterwards" - so it has to actually be here, or a player whose browser
 * storage gets cleared has no way back into the account short of another
 * verification email. rCTF returns it on `/users/me` and nowhere else.
 *
 * Masked by default and never auto-copied. It is a credential in the full
 * sense: rCTF accepts it for login *and* for account recovery, it does not
 * expire, and there is no way to revoke one short of rotating `tokenKey` and
 * logging out every team on the platform. Shoulder-surfing a profile page open
 * on a projector at a workshop is a realistic way to lose one.
 */
export function TeamToken({ token }: { token: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  };

  return (
    <div className="token-panel">
      <div className="token-head">
        <span className="field-label" style={{ margin: 0 }}>
          TEAM TOKEN
        </span>
        <div className="token-actions">
          <button
            className="btn btn-outline btn-small"
            onClick={() => setRevealed((r) => !r)}
            aria-pressed={revealed}
          >
            {revealed ? "HIDE" : "REVEAL"}
          </button>
          <button className="btn btn-outline btn-small" onClick={copy}>
            {copied === "ok" ? "COPIED ✓" : "COPY"}
          </button>
        </div>
      </div>

      <div className="token-value" aria-label={revealed ? undefined : "Team token, hidden"}>
        {revealed ? (
          <code>{token}</code>
        ) : (
          // A fixed-length mask rather than one dot per character - the length
          // of a credential is not something to put on screen.
          <span className="token-mask" aria-hidden="true">
            {"•".repeat(32)}
          </span>
        )}
      </div>

      {copied === "failed" && (
        <div className="token-note token-note-warn">
          Couldn&apos;t reach the clipboard. Reveal the token and copy it by hand.
        </div>
      )}

      <div className="token-note">
        This is how you log back in on another device &mdash; paste it into{" "}
        <strong>TEAM TOKEN</strong> on the login page. Save it somewhere safe now: it doesn&apos;t
        expire, it can&apos;t be revoked, and anyone who has it is you.
      </div>
    </div>
  );
}
