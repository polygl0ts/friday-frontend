import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getVerifyInfo, verify } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import type { VerifyKind } from "../api/rctf";

/**
 * The landing page for an emailed verification link.
 *
 * It previews the token and waits for a click rather than spending it on
 * mount. Verification tokens are single-use, so anything that merely *loads*
 * the URL consumes it - React StrictMode double-invoking an effect in
 * development, a link prefetcher, or a corporate mail scanner that follows
 * every link before the recipient opens the message. The old version guarded
 * the first of those with a `useRef` and could do nothing about the rest.
 *
 * rCTF's `GET /auth/verify-info` exists for exactly this: it reads the token
 * without marking it used, so this page can say what is about to happen.
 */

const COPY: Record<VerifyKind, { title: string; action: string; describe: (i: Info) => string }> = {
  register: {
    title: "Finish creating your team",
    action: "CREATE TEAM →",
    describe: (i) =>
      `This creates the team ${i.name ?? "you registered"}${i.email ? ` for ${i.email}` : ""}.`,
  },
  team: {
    title: "Log in",
    action: "LOG IN →",
    describe: (i) => `This signs you in as ${i.name ?? "your team"}.`,
  },
  update: {
    title: "Confirm your new email",
    action: "CONFIRM EMAIL →",
    describe: (i) =>
      i.email ? `This sets your account email to ${i.email}.` : "This updates your account email.",
  },
};

interface Info {
  kind: VerifyKind;
  email: string | null;
  name?: string;
}

export function Verify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const token = params.get("token") ?? params.get("verifyToken");

  // Safe to run on mount, and safe to run twice: this does not spend the token.
  const infoQuery = useQuery({
    queryKey: ["verifyInfo", token],
    queryFn: () => getVerifyInfo(token as string),
    enabled: !!token,
    retry: false,
  });

  const confirmMutation = useMutation({
    mutationFn: () => verify(token as string),
    onSuccess: ({ authToken, teamToken }) => {
      login(authToken);
      // New login is sent to profile page and log back are sent to home page.
      navigate(teamToken ? "/profile" : "/");
    },
  });

  if (!token) {
    return <div className="page error-text">Missing verification token.</div>;
  }

  const info = infoQuery.data;
  const copy = info ? COPY[info.kind] : null;

  return (
    <div className="page" style={{ display: "flex", justifyContent: "center", paddingTop: 90 }}>
      <div
        style={{
          width: 460,
          maxWidth: "100%",
          border: "1px solid var(--border)",
          borderRadius: 14,
          background: "var(--bg-card-alt)",
          padding: 38,
          boxShadow: "0 30px 80px rgba(0,0,0,.6)",
        }}
      >
        {infoQuery.isLoading && <div className="loading">Checking your link...</div>}

        {!infoQuery.isLoading && (
          <>
            <div
              className="heading"
              style={{ fontSize: 24, color: "var(--text-bright)", fontWeight: 600 }}
            >
              {copy?.title ?? "Confirm"}
            </div>

            <div className="mono-dim" style={{ marginTop: 8, lineHeight: 1.6 }}>
              {info && copy
                ? copy.describe(info)
                : "We couldn't read this link ahead of time. You can still submit it, or request a new one from the login page."}
            </div>

            {confirmMutation.isError && (
              <div
                className="error-text"
                style={{ padding: 0, marginTop: 18, textAlign: "left" }}
              >
                {(confirmMutation.error as Error).message}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 26 }}
              disabled={confirmMutation.isPending || confirmMutation.isSuccess}
              onClick={() => confirmMutation.mutate()}
            >
              {confirmMutation.isPending ? "VERIFYING..." : (copy?.action ?? "CONTINUE →")}
            </button>

            <div className="token-note" style={{ marginTop: 14 }}>
              This link works once.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
