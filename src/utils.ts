import type { RctfFlagEntry, Tier } from "./types";

// Matches INTRO2_TAG in the backend's app/routers/intro2.py - challenges
// tagged this way live on the dedicated INTRO2 page
export const INTRO2_TAG = "intro2";

/**
 * rCTF's `challsRead` bit, as it appears in `/v2/users/me`'s `perms` bitmask.
 */
const PERM_CHALLS_READ = 1 << 0;
const PERM_CHALLS_WRITE = 1 << 1;
const PERM_USERS_WRITE = 1 << 4;

export function isAdminPerms(perms: number | null | undefined): boolean {
  return ((perms ?? 0) & PERM_CHALLS_READ) !== 0;
}

export function canWriteChalls(perms: number | null | undefined): boolean {
  return ((perms ?? 0) & PERM_CHALLS_WRITE) !== 0;
}

/**
 * rCTF's `usersWrite` bit - what the team panel's writes go through, not
 * `challsWrite`: `PUT /v2/admin/users/:id` and `/v2/admin/users` are both
 * behind it. The two are independent bits, so an account can hold one and not
 * the other.
 */
export function canWriteUsers(perms: number | null | undefined): boolean {
  return ((perms ?? 0) & PERM_USERS_WRITE) !== 0;
}

/**
 * Every bit in rCTF's `perms` bitmask, low to high - mirrors the `Permissions`
 * enum in its types package. All six set is 63, which is what a full admin
 * holds.
 */
const PERM_BITS: readonly { bit: number; name: string }[] = [
  { bit: PERM_CHALLS_READ, name: "challsRead" },
  { bit: PERM_CHALLS_WRITE, name: "challsWrite" },
  { bit: 1 << 2, name: "leaderboardRead" },
  { bit: 1 << 3, name: "challsSolveWrite" },
  { bit: PERM_USERS_WRITE, name: "usersWrite" },
  { bit: 1 << 5, name: "settingsWrite" },
];

/**
 * The permissions a bitmask grants, named.
 *
 * A bare number is unreadable in a table cell - `17` and `16` differ by
 * whether the account can open the admin panel at all - so the admin team list
 * spells the bits out. Empty for a plain team, which is most of them.
 */
export function permissionNames(perms: number | null | undefined): string[] {
  const mask = perms ?? 0;
  return PERM_BITS.filter((p) => (mask & p.bit) !== 0).map((p) => p.name);
}

const TIER_TAG_PREFIX = "tier/";
const TIERS: readonly Tier[] = ["bronze", "silver", "gold"];

/**
 * A challenge's tier, read from its rCTF tags and nothing else.
 */
export function tierFromTags(tags: string[] | null | undefined): Tier | null {
  for (const tag of tags ?? []) {
    if (!tag.startsWith(TIER_TAG_PREFIX)) continue;
    const candidate = tag.slice(TIER_TAG_PREFIX.length);
    if (TIERS.includes(candidate as Tier)) return candidate as Tier;
  }
  return null;
}

/**
 * rCTF's static flag provider - the only one that stores a literal answer.
 * Everything else (`flags/dynamic`, and the instancer-backed providers)
 * computes per team at submit time, so there is no string to show.
 */
export const STATIC_FLAG_PROVIDER = "flags/static";

/**
 * The literal flag behind one entry, or null when the provider doesn't have
 * one to give.
 *
 * `config` is typed as an opaque bag on purpose - see `RctfFlagEntry` - so the
 * shape is checked here, once, instead of at every call site.
 */
export function staticFlag(entry: RctfFlagEntry): string | null {
  if (entry.provider !== STATIC_FLAG_PROVIDER) return null;
  const flag = entry.config?.flag;
  return typeof flag === "string" && flag !== "" ? flag : null;
}

/**
 * Unix milliseconds as `DD-MM-YYYY`, or `DD-MM-YYYY HH:MM:SS` with `precise`,
 * in the viewer's own timezone. Null for a missing or unusable value.
 *
 * `precise` carries seconds, not just hours and minutes, because that is what
 * the readers who need a time need it for: consecutive flag attempts from one
 * team land seconds apart, and the order of two guesses is the whole question
 * the submission log is being asked.
 */
export function formatTimestamp(
  ms: number | null | undefined,
  precise = false,
): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
  if (!precise) return day;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * A timestamp string from rCTF as Unix milliseconds, or null if it cannot be
 * read.
 *
 * Needed because `/v2/admin/submissions` does not send what its own schema
 * documents. The response type says `createdAt` is "an ISO 8601 string" with
 * `2024-03-09T00:00:00.000Z` as its example; a real instance answers
 * `2026-08-17 20:54:09.493+00` - Postgres' `timestamptz` text output, with a
 * space instead of the `T` and a two-digit zone offset. Checked against rCTF
 * v2.1.2, not inferred.
 */
export function parseRctfTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const ms = new Date(normalized).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Unix milliseconds as the `YYYY-MM-DDTHH:MM` an `<input type="datetime-local">`
 * takes as its value, or `""` for a missing one - the empty input.
 *
 * Local time, with no zone suffix, because that is the only thing the control
 * accepts; `toISOString` would hand it UTC and silently shift the admin's
 * chosen hour.
 */
export function toDatetimeLocal(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * The inverse: what an admin typed into a `datetime-local`, as Unix
 * milliseconds, or null if the field is empty or half-filled.
 *
 * A value with no zone is parsed as local time, which is what the admin meant -
 * they read the time off the same clock the rest of this column is printed in.
 */
export function fromDatetimeLocal(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Whether a URL is safe to put in an `href`/`src`.
 */
const SAFE_URL = /^(https?:|mailto:)/i;

export function isSafeUrl(url: string | undefined | null): url is string {
  return typeof url === "string" && SAFE_URL.test(url.trim());
}

/**
 * Absolute URL for a challenge attachment, or "" if the scheme isn't safe to
 * put in an href. Callers render nothing for "".
 */
export function resolveFileUrl(url: string, origin: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return isSafeUrl(url) ? url : "";
  return `${origin.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Human-readable attachment size. null means rCTF never recorded one. */
export function formatFileSize(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * Why an avatar cannot be uploaded, or null if it can.
 *
 * Both checks are rCTF's own, restated here only to fail before spending one
 * of the two attempts its rate limit allows per two minutes. The server still
 * decides - it opens the file, which is the only real test of whether it is an
 * image, and a type of "image/svg+xml" or a renamed binary reaches it either
 * way.
 */
export function avatarRejectionReason(file: File, maxBytes: number): string | null {
  if (!file.type.startsWith("image/")) return "That file isn't an image.";
  if (file.size > maxBytes) {
    return `That image is ${formatFileSize(file.size)}. The limit is ${formatFileSize(maxBytes)}.`;
  }
  return null;
}

// Matches MARKER in the backend's app/writeup_md.py: the line that separates
// a writeup's spoiler-free half from its solution.
export const SOLUTION_MARKER = ":::solution";

/**
 * Editor-preview split, mirroring the server's rule (marker at column 0,
 * outside a code fence).
 */
export function splitWriteup(bodyMd: string): { intro: string; solution: string | null } {
  const lines = bodyMd.split("\n");
  let fence: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (fence) {
      if (trimmed.startsWith(fence)) fence = null;
      continue;
    }
    const opener = trimmed.slice(0, 3);
    if (opener === "```" || opener === "~~~") {
      fence = opener;
      continue;
    }
    if (lines[i].replace(/\s+$/, "") === SOLUTION_MARKER) {
      return {
        intro: lines.slice(0, i).join("\n").trim(),
        solution: lines.slice(i + 1).join("\n").trim(),
      };
    }
  }
  return { intro: bodyMd.trim(), solution: null };
}

/** Rebuild the single document an author edits from the two stored halves. */
export function joinWriteup(intro: string, solution: string): string {
  return `${intro}\n\n${SOLUTION_MARKER}\n\n${solution}`;
}

// Mirrors flag_prefixes in the backend's app/config.py. Used only to warn the
// author before they submit; the server scrubs the public half regardless.
const FLAG_RE = /\b(friday|EPFL)\{[^}]{0,200}\}/i;

export function looksLikeFlag(text: string): boolean {
  return FLAG_RE.test(text);
}
