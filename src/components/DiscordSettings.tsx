import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearWebhook,
  getDiscordConfig,
  setDiscordConfig,
  testDiscordWebhook,
} from "../api/extras";
import type { DiscordConfig, DiscordTestResult } from "../types";

/**
 * The writeup-lifecycle webhook, and only that one.
 *
 * First bloods used to have a second field here. They are now announced by
 * rCTF's own blood bot, whose webhook lives in rCTF's config file (see
 * `bloodBot` in the rctf-docker role) rather than being runtime-editable -
 * so there is deliberately nothing to configure for them on this screen.
 */
export function DiscordSettings() {
  const configQuery = useQuery({ queryKey: ["discordConfig"], queryFn: getDiscordConfig });
  const config = configQuery.data;

  return (
    <div className="panel" style={{ height: "fit-content" }}>
      <div className="panel-head">DISCORD WEBHOOK</div>

      {configQuery.isLoading && <div className="loading">Loading...</div>}

      {config && (
        <div style={{ padding: 22 }}>
          <WebhookField configured={config.webhook_configured} />
        </div>
      )}
    </div>
  );
}

function WebhookField({ configured }: { configured: boolean }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<DiscordTestResult | null>(null);

  const onConfigChange = (next: DiscordConfig) =>
    queryClient.setQueryData(["discordConfig"], next);

  const saveMutation = useMutation({
    mutationFn: () => setDiscordConfig({ webhook_url: input.trim() }),
    onSuccess: (next) => {
      setInput("");
      setResult(null);
      onConfigChange(next);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearWebhook(),
    onSuccess: (next) => {
      setResult(null);
      onConfigChange(next);
    },
  });

  const testMutation = useMutation({
    mutationFn: () => testDiscordWebhook(),
    onSuccess: setResult,
  });

  const busy = saveMutation.isPending || clearMutation.isPending || testMutation.isPending;
  const error = (saveMutation.error ?? clearMutation.error ?? testMutation.error) as
    | Error
    | undefined;

  return (
    <div>
      <div className="field-label">WRITEUPS</div>
      <div className="mono-dim" style={{ lineHeight: 1.6, marginBottom: 10 }}>
        <span style={{ color: configured ? "var(--green)" : "var(--amber)" }}>&#9679;</span>{" "}
        {configured ? "Configured" : "Not configured"}
      </div>

      <div className="field" style={{ marginBottom: 8 }}>
        <input
          type="password"
          name="polygl0ts-writeup-webhook"
          autoComplete="new-password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={configured ? "leave blank to keep current" : "https://discord.com/api/webhooks/..."}
        />
      </div>

      <div className="mono-dim" style={{ lineHeight: 1.5, marginBottom: 10 }}>
        Submitted, approved and rejected writeups. First bloods are announced by
        rCTF itself and are configured there.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          className="btn btn-small btn-primary"
          disabled={!input.trim() || busy}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "SAVING..." : "SAVE"}
        </button>
        <button
          className="btn btn-small btn-outline"
          disabled={!configured || busy}
          onClick={() => testMutation.mutate()}
        >
          {testMutation.isPending ? "SENDING..." : "SEND TEST"}
        </button>
        <button
          className="btn btn-small btn-reject"
          disabled={!configured || busy}
          onClick={() => clearMutation.mutate()}
        >
          {clearMutation.isPending ? "CLEARING..." : "CLEAR"}
        </button>
      </div>

      {saveMutation.isSuccess && !input && (
        <div className="mono-dim" style={{ marginTop: 8, color: "var(--green)" }}>
          &#10003; Saved.
        </div>
      )}
      {result && (
        <div
          className="mono-dim"
          style={{ marginTop: 8, lineHeight: 1.5, color: result.ok ? "var(--green)" : "var(--red)" }}
        >
          {result.ok ? "✓" : "✕"} {result.detail}
        </div>
      )}
      {error && (
        <div className="mono-dim" style={{ marginTop: 8, color: "var(--red)" }}>
          &#10005; {error.message}
        </div>
      )}
    </div>
  );
}
