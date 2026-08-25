import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAdminUsers } from "../api/rctf";
import { useAuth } from "../auth/AuthContext";
import { BanTeamButton } from "../components/BanTeamButton"
import { DivisionTeamButton } from "../components/DivisionButton"
import { TeamSubmissionsModal } from "../components/TeamSubmissionsModal";
import { permissionNames } from "../utils";
import type { RctfAdminUser } from "../types";

/**
 * Every registered team - the admin team panel, shaped like the challenge one
 * next to it.
 */

/** Score first, then name - the order that puts the teams worth looking at on
 *  screen, and keeps the zero-score tail sorted rather than arbitrary. */
function byScoreThenName(a: RctfAdminUser, b: RctfAdminUser): number {
  return b.score - a.score || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** Picture and name in one cell, the way a scoreboard row reads them. The
 *  gradient behind `.row-avatar` is the fallback for the many teams with no
 *  picture, so it stays put and the image covers it when there is one. */
function TeamCell({ team }: { team: RctfAdminUser }) {
  return (
    <span className="admin-team">
      <span className="row-avatar">
        {team.avatarUrl && <img className="avatar-img" src={team.avatarUrl} alt="" />}
      </span>
      <span className="admin-team-name">
        <span style={{ color: "var(--text-bright)" }}>{team.name}</span>
        {/* The id is what every other tool - the API, a solve row, a support
            request - calls this team, and it is never the name. */}
        <span className="admin-team-id">{team.id}</span>
      </span>
    </span>
  );
}

/**
 * The permission bitmask, spelled out.
 */
function PermsCell({ perms }: { perms: number }) {
  const names = permissionNames(perms);
  if (names.length === 0) return <span className="admin-cell-empty">&mdash;</span>;

  return (
    <span className="admin-tags" title={`perms = ${perms}`}>
      {names.map((name) => (
        <span className="chip chip-tag" key={name}>
          {name}
        </span>
      ))}
    </span>
  );
}

export function AdminTeams() {
  const usersQuery = useQuery({ queryKey: ["adminUsers"], queryFn: () => listAdminUsers() });
  const { isAdmin, canWriteUsers } = useAuth();
  const [detailed, setDetailed] = useState<RctfAdminUser | null>(null);

  const canReadSubmissions = isAdmin && canWriteUsers;
  const deniedReason = canWriteUsers
    ? "Reading submissions also needs the challsRead permission."
    : "Reading submissions needs the usersWrite permission.";

  const teams = [...(usersQuery.data?.users ?? [])].sort(byScoreThenName);
  const bannedCount = teams.filter((t) => t.banned).length;
  const total = usersQuery.data?.total ?? teams.length;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          margin: "30px 0 16px",
        }}
      >
        <div className="page-subtitle" style={{ margin: 0 }}>
          ALL TEAMS
        </div>
        <span style={{ fontSize: 11, letterSpacing: "0.15em", color: "var(--text-dimmer)" }}>
          {total} TOTAL &middot; {bannedCount} BANNED
        </span>
      </div>

      {usersQuery.isLoading && <div className="loading">Loading...</div>}
      {usersQuery.error && <div className="error-text">{(usersQuery.error as Error).message}</div>}
      {usersQuery.data?.users.length === 0 && (
        <div className="empty-text">rCTF has no registered teams.</div>
      )}

      {teams.length > 0 && (
        <div className="table">
          <div className="table-row table-teams table-head">
            <span>TEAM</span>
            <span>EMAIL</span>
            <span>DIVISION</span>
            <span>PERMS</span>
            <span>BANNED</span>
            <span>SCORE</span>
            <span>SOLVES</span>
            <span></span>
          </div>

          {teams.map((team) => (
            <div className="table-row table-teams" key={team.id}>
              <TeamCell team={team} />
              {team.email ? (
                <span className="admin-team-email">{team.email}</span>
              ) : (
                <span className="admin-cell-empty">no email</span>
              )}
              <DivisionTeamButton teamId={team.id} teamName={team.name} division={team.division} />
              <PermsCell perms={team.perms} />
              <BanTeamButton teamId={team.id} banned={team.banned} />
              <span style={{ color: team.score > 0 ? "var(--text-bright)" : "var(--text-dimmer)" }}>
                {team.score}
              </span>
              <span style={{ color: team.solveCount > 0 ? "var(--text)" : "var(--text-dimmer)" }}>
                {team.solveCount}
              </span>
              <button
                type="button"
                className="view-submissions"
                disabled={!canReadSubmissions}
                title={canReadSubmissions ? `Every submission ${team.name} has made` : deniedReason}
                onClick={() => setDetailed(team)}
              >
                DETAILED
              </button>
            </div>
          ))}
        </div>
      )}

      {detailed && <TeamSubmissionsModal team={detailed} onClose={() => setDetailed(null)} />}
    </>
  );
}
