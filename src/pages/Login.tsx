import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { loginWithTeamToken, recoverAccount, register } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";

export function Login() {
  const [mode, setMode] = useState<"register" | "token" | "recover">("register");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [teamToken, setTeamToken] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const registerMutation = useMutation({
    mutationFn: () => register(email, name),
    onSuccess: ({ authToken }) => {
      if (authToken) {
        login(authToken);
        navigate("/profile");
      }
    },
  });

  // Sends a login link to an existing team's address. Only useful with a mail
  // provider configured (rctf_enable_mail in the rctf-docker role); without one
  // rCTF answers 400 and the message below says so.
  const recoverMutation = useMutation({ mutationFn: () => recoverAccount(email) });

  const tokenLoginMutation = useMutation({
    mutationFn: () => loginWithTeamToken(teamToken),
    onSuccess: (authToken) => {
      login(authToken);
      navigate("/");
    },
  });

  return (
    <div className="page" style={{ display: "flex", justifyContent: "center", paddingTop: 90 }}>
      <div style={{ width: 420, maxWidth: "100%", border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-card-alt)", padding: 38, boxShadow: "0 30px 80px rgba(0,0,0,.6)" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 30 }}>
          <button className={`pill${mode === "register" ? " active" : ""}`} style={{ flex: 1, textAlign: "center" }} onClick={() => setMode("register")}>
            REGISTER
          </button>
          <button className={`pill${mode === "token" ? " active" : ""}`} style={{ flex: 1, textAlign: "center" }} onClick={() => setMode("token")}>
            TEAM TOKEN
          </button>
          <button className={`pill${mode === "recover" ? " active" : ""}`} style={{ flex: 1, textAlign: "center" }} onClick={() => setMode("recover")}>
            EMAIL LINK
          </button>
        </div>

        {mode === "recover" ? (
          <>
            <div className="heading" style={{ fontSize: 24, color: "var(--text-bright)", fontWeight: 600 }}>
              Email me a login link
            </div>
            <div className="mono-dim" style={{ marginTop: 8, lineHeight: 1.6 }}>
              For a team that already exists. The link logs you straight in - no team
              token needed.
            </div>

            {recoverMutation.isSuccess ? (
              <div className="chip" style={{ marginTop: 24 }}>
                <span className="dot" style={{ background: "var(--green)" }} />
                Check your email for a login link
              </div>
            ) : (

              <form
                style={{ marginTop: 24 }}
                onSubmit={(e) => { e.preventDefault(); recoverMutation.mutate()}}
              >
                <div className="field">
                  <div className="field-label">EMAIL</div>
                  <input name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="player@epfl.ch" />
                </div>
                {recoverMutation.isError && (
                  <div className="error-text" style={{ padding: 0, marginBottom: 12, textAlign: "left" }}>
                    {(recoverMutation.error as Error).message}
                  </div>
                )}
                <button
                  className="btn btn-primary"
                  type="submit"
                  style={{ width: "100%" }}
                  disabled={!email || recoverMutation.isPending}
                >
                  {recoverMutation.isPending ? "SENDING..." : "SEND LOGIN LINK →"}
                </button>
              </form>
            )}
          </>
        ) : mode === "register" ? (
          <>
            <div className="heading" style={{ fontSize: 24, color: "var(--text-bright)", fontWeight: 600 }}>
              Join Polygl0ts CTF
            </div>
            <div className="mono-dim" style={{ marginTop: 8, lineHeight: 1.6 }}>
              rCTF is team-based and passwordless: register with an email and we'll send you a
              login link. Save the team token from your profile afterwards to log back in on
              another device without re-verifying.
            </div>

            {/* Only the emailed-link case shows this. When rCTF creates the
                team immediately it also returns a token, and onSuccess has
                already navigated away. */}
            {registerMutation.data?.authToken === null ? (
              <div className="chip" style={{ marginTop: 24 }}>
                <span className="dot" style={{ background: "var(--green)" }} />
                Check your email for a login link
              </div>
            ) : (
              <form 
                style={{ marginTop: 24 }}
                onSubmit={(e) => { e.preventDefault(); registerMutation.mutate()}}
              >
                <div className="field">
                  <div className="field-label">TEAM NAME</div>
                  <input name="team" autoComplete="organization" value={name} onChange={(e) => setName(e.target.value)} placeholder="razm0" />
                </div>
                <div className="field">
                  <div className="field-label">EMAIL</div>
                  <input name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="player@epfl.ch" />
                </div>
                {registerMutation.isError && (
                  <div className="error-text" style={{ padding: 0, marginBottom: 12, textAlign: "left" }}>
                    {(registerMutation.error as Error).message}
                  </div>
                )}
                <button
                  className="btn btn-primary"
                  type="submit"
                  style={{ width: "100%" }}
                  disabled={!email || !name || registerMutation.isPending}
                >
                  {registerMutation.isPending ? "SENDING..." : "SEND LOGIN LINK →"}
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <div className="heading" style={{ fontSize: 24, color: "var(--text-bright)", fontWeight: 600 }}>
              Log back in
            </div>
            <div className="mono-dim" style={{ marginTop: 8, lineHeight: 1.6 }}>
              Paste the team token from your profile page.
            </div>

              <form
                style={{ marginTop: 24 }}
                onSubmit={(e) => { e.preventDefault(); tokenLoginMutation.mutate()}}
              >
              <div className="field">
                <div className="field-label">TEAM TOKEN</div>
                <input 
                  type="password" 
                  name="token"
                  autoComplete="current-password"
                  value={teamToken} 
                  onChange={(e) => setTeamToken(e.target.value)} 
                  placeholder="teamtok_..." />
              </div>
              {tokenLoginMutation.isError && (
                <div className="error-text" style={{ padding: 0, marginBottom: 12, textAlign: "left" }}>
                  {(tokenLoginMutation.error as Error).message}
                </div>
              )}
              <button
                className="btn btn-primary"
                type="submit"
                style={{ width: "100%" }}
                disabled={!teamToken || tokenLoginMutation.isPending}
              >
                {tokenLoginMutation.isPending ? "LOGGING IN..." : "LOG IN →"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
