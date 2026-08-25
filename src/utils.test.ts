import { describe, expect, it } from "vitest";
import {
  canWriteChalls,
  formatFileSize,
  isAdminPerms,
  formatTimestamp,
  isSafeUrl,
  parseRctfTimestamp,
  resolveFileUrl,
  staticFlag,
  tierFromTags,
} from "./utils";

describe("tierFromTags", () => {
  it("reads the tier from its tag", () => {
    expect(tierFromTags(["tier/bronze"])).toBe("bronze");
    expect(tierFromTags(["tier/silver"])).toBe("silver");
    expect(tierFromTags(["tier/gold"])).toBe("gold");
  });

  it("ignores unrelated tags around it", () => {
    expect(tierFromTags(["intro2", "beginner", "tier/gold", "web"])).toBe("gold");
  });

  it("ignores points entirely", () => {
    // The whole reason this reads a tag: rCTF's `points` is a decayed score, so
    // a cheap challenge can still be gold and an expensive one bronze.
    expect(tierFromTags(["tier/gold"])).toBe("gold");
    expect(tierFromTags(["tier/bronze"])).toBe("bronze");
  });

  it("returns null with no tier tag", () => {
    expect(tierFromTags(["intro2"])).toBeNull();
    expect(tierFromTags([])).toBeNull();
  });

  it("returns null for absent or null tags", () => {
    // v2 sends `tags: null` rather than omitting the key.
    expect(tierFromTags(null)).toBeNull();
    expect(tierFromTags(undefined)).toBeNull();
  });

  it("returns null for an unknown tier", () => {
    expect(tierFromTags(["tier/platinum"])).toBeNull();
    expect(tierFromTags(["tier/"])).toBeNull();
  });

  it("is case- and prefix-sensitive", () => {
    // rCTF matches tags exactly and the challenge repo's schema enforces
    // lowercase, so anything else is a typo that should not silently work.
    expect(tierFromTags(["Tier/Bronze"])).toBeNull();
    expect(tierFromTags(["tier/BRONZE"])).toBeNull();
    expect(tierFromTags(["bronze"])).toBeNull();
    expect(tierFromTags(["difficulty/tier/gold"])).toBeNull();
  });

  it("takes the first valid tier when several are present", () => {
    // The challenge repo's schema rejects this, but a challenge edited in
    // rCTF's admin UI can still get here - pick deterministically.
    expect(tierFromTags(["tier/gold", "tier/bronze"])).toBe("gold");
  });
});

describe("resolveFileUrl", () => {
  const origin = "https://rctf.example";

  it("joins the origin-relative path the local upload provider returns", () => {
    expect(resolveFileUrl("/uploads/abc123/chal.zip", origin)).toBe(
      "https://rctf.example/uploads/abc123/chal.zip",
    );
  });

  it("leaves an absolute URL alone", () => {
    // The S3/GCS providers return fully-qualified bucket URLs.
    expect(resolveFileUrl("https://bucket.example/uploads/abc/chal.zip", origin)).toBe(
      "https://bucket.example/uploads/abc/chal.zip",
    );
    expect(resolveFileUrl("http://bucket.example/x", origin)).toBe("http://bucket.example/x");
  });

  it("does not double up slashes", () => {
    expect(resolveFileUrl("/uploads/x", "https://rctf.example/")).toBe(
      "https://rctf.example/uploads/x",
    );
  });

  it("adds the missing slash on a relative path", () => {
    expect(resolveFileUrl("uploads/x", origin)).toBe("https://rctf.example/uploads/x");
  });
});

describe("formatFileSize", () => {
  it("formats bytes and binary multiples", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KiB");
    expect(formatFileSize(1024 * 1024 * 3)).toBe("3.0 MiB");
  });

  it("drops the decimal once it stops being useful", () => {
    expect(formatFileSize(1024 * 64)).toBe("64 KiB");
  });

  it("returns null when rCTF recorded no size", () => {
    // Files uploaded through v1 have size null - render nothing, not "null".
    expect(formatFileSize(null)).toBeNull();
  });
});

describe("URL safety", () => {
  it("refuses a dangerous scheme in an attachment URL", () => {
    // rCTF reports file URLs; nothing downstream re-checks the scheme.
    expect(resolveFileUrl("javascript:alert(1)", "https://rctf.example")).toBe("");
    expect(resolveFileUrl("data:text/html,<script>", "https://rctf.example")).toBe("");
  });

  it("accepts the schemes a link can safely use", () => {
    expect(isSafeUrl("https://x/y.pdf")).toBe(true);
    expect(isSafeUrl("http://x/y.pdf")).toBe(true);
    expect(isSafeUrl("mailto:a@b.c")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("  javascript:alert(1)")).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });
});

describe("staticFlag", () => {
  it("reads the literal flag out of a static provider's config", () => {
    expect(
      staticFlag({ provider: "flags/static", config: { flag: "friday{baby_rev}" } }),
    ).toBe("friday{baby_rev}");
  });

  it("has nothing to give for a provider that computes per team", () => {
    // There is genuinely no flag string to show here - a dynamic provider
    // derives it at submit time - so this must be null rather than whatever
    // happens to sit in `config`.
    expect(staticFlag({ provider: "flags/dynamic", config: { scope: "team" } })).toBeNull();
  });

  it("treats a missing, empty or non-string flag as no flag", () => {
    expect(staticFlag({ provider: "flags/static" })).toBeNull();
    expect(staticFlag({ provider: "flags/static", config: null })).toBeNull();
    expect(staticFlag({ provider: "flags/static", config: {} })).toBeNull();
    expect(staticFlag({ provider: "flags/static", config: { flag: "" } })).toBeNull();
    expect(staticFlag({ provider: "flags/static", config: { flag: 42 } })).toBeNull();
  });
});

describe("formatTimestamp", () => {
  it("formats Unix milliseconds as a local day-month-year date", () => {
    // Built from local parts so the assertion doesn't depend on the machine's
    // timezone - the function's contract is local time, not UTC.
    const ms = new Date(2026, 0, 2, 3, 4, 56).getTime();

    expect(formatTimestamp(ms)).toBe("02-01-2026");
  });

  it("adds the time, to the second, when asked to be precise", () => {
    const ms = new Date(2026, 0, 2, 3, 4, 56).getTime();

    expect(formatTimestamp(ms, true)).toBe("02-01-2026 03:04:56");
  });

  it("pads every field, so dates line up in a column", () => {
    // The reason this is not `toLocaleString`: a table of these is read down
    // the page, and a one-digit day would shift everything after it.
    expect(formatTimestamp(new Date(2026, 8, 9, 8, 7, 6).getTime(), true)).toBe(
      "09-09-2026 08:07:06",
    );
  });

  it("has no answer for an absent or unusable value", () => {
    // null is rCTF's "already released"; the rest are shapes a hand-edited
    // challenge can produce. All of them mean "print a dash", not "1970".
    expect(formatTimestamp(null)).toBeNull();
    expect(formatTimestamp(undefined)).toBeNull();
    expect(formatTimestamp(Number.NaN)).toBeNull();
    expect(formatTimestamp(Number.POSITIVE_INFINITY)).toBeNull();
    // `Date.parse` of an unreadable string, which is what the writeup dates
    // hand it - null rather than "Invalid Date".
    expect(formatTimestamp(Date.parse("not a date"), true)).toBeNull();
  });

  it("formats zero rather than mistaking it for absent", () => {
    expect(formatTimestamp(0)).not.toBeNull();
  });
});

describe("parseRctfTimestamp", () => {
  it("reads the format rCTF actually sends, not the one it documents", () => {
    // `/v2/admin/submissions` documents `createdAt` as an ISO 8601 string and
    // sends Postgres' timestamptz text instead - space, trimmed fraction,
    // two-digit zone. Checked against rCTF v2.1.2. V8 happens to parse it and
    // is not required to, so it is repaired before `Date` sees it.
    expect(parseRctfTimestamp("2026-08-17 20:54:09.493+00")).toBe(
      Date.parse("2026-08-17T20:54:09.493Z"),
    );
    expect(parseRctfTimestamp("2026-08-17 20:54:10.52+00")).toBe(
      Date.parse("2026-08-17T20:54:10.520Z"),
    );
    // Whole-second times come back with no fraction at all.
    expect(parseRctfTimestamp("2026-08-17 20:54:11+00")).toBe(
      Date.parse("2026-08-17T20:54:11Z"),
    );
  });

  it("still reads the documented ISO form, in case a release starts sending it", () => {
    expect(parseRctfTimestamp("2024-03-09T00:00:00.000Z")).toBe(
      Date.parse("2024-03-09T00:00:00.000Z"),
    );
  });

  it("keeps a non-zero offset rather than reading it as UTC", () => {
    expect(parseRctfTimestamp("2026-08-17 20:54:09.493+02")).toBe(
      Date.parse("2026-08-17T18:54:09.493Z"),
    );
  });

  it("answers null for anything it cannot read, rather than inventing a date", () => {
    // The caller prints the raw string instead. A fallback to 0 would put every
    // unparseable submission in 1970 and sort the log around it.
    expect(parseRctfTimestamp("not a date")).toBeNull();
    expect(parseRctfTimestamp("")).toBeNull();
    expect(parseRctfTimestamp(null)).toBeNull();
    expect(parseRctfTimestamp(undefined)).toBeNull();
  });
});

/**
 * rCTF's permission bitmask, from `Permissions` in its types package:
 * challsRead=1, challsWrite=2, leaderboardRead=4, challsSolveWrite=8,
 * usersWrite=16, settingsWrite=32. A team promoted with `rctf user promote
 * --perms` gets the OR of what it was granted; full admin is 63, and a plain
 * team is 0 (or null, on a response that predates the field).
 */
const CHALLS_READ = 1;
const CHALLS_WRITE = 2;
const FULL_ADMIN = 63;

describe("isAdminPerms", () => {
  it("opens the panel for anyone holding challsRead", () => {
    expect(isAdminPerms(CHALLS_READ)).toBe(true);
    expect(isAdminPerms(CHALLS_READ | CHALLS_WRITE)).toBe(true);
    expect(isAdminPerms(FULL_ADMIN)).toBe(true);
  });

  it("keeps a plain team out", () => {
    // `perms` is 0 on a real instance and null/absent on a mock or an older
    // response; neither is an admin.
    expect(isAdminPerms(0)).toBe(false);
    expect(isAdminPerms(null)).toBe(false);
    expect(isAdminPerms(undefined)).toBe(false);
  });

  it("ignores the bits it does not gate on", () => {
    // usersWrite alone reaches the team routes, not the challenge ones.
    expect(isAdminPerms(16)).toBe(false);
    expect(isAdminPerms(CHALLS_WRITE)).toBe(false);
  });
});

describe("canWriteChalls", () => {
  it("is true only with challsWrite", () => {
    expect(canWriteChalls(CHALLS_WRITE)).toBe(true);
    expect(canWriteChalls(CHALLS_READ | CHALLS_WRITE)).toBe(true);
    expect(canWriteChalls(FULL_ADMIN)).toBe(true);
    expect(canWriteChalls(0)).toBe(false);
    expect(canWriteChalls(null)).toBe(false);
    expect(canWriteChalls(undefined)).toBe(false);
  });

  it("is independent of the bit that opens the panel", () => {
    // The whole reason these are two functions. rCTF gates the admin challenge
    // *reads* on challsRead and `PUT /v2/admin/challs/:id` on challsWrite, so a
    // challsRead-only admin must see the panel and be offered no toggle.
    expect(isAdminPerms(CHALLS_READ)).toBe(true);
    expect(canWriteChalls(CHALLS_READ)).toBe(false);
  });

  it("does not collapse to always-false when both bits are considered", () => {
    // Regression: masking with `perms & READ & WRITE` narrows to the bits the
    // two flags share - which for distinct flags is none - so every account,
    // full admin included, read as not-an-admin and the panel became
    // unreachable. Any implementation that ANDs the two masks fails here.
    expect(isAdminPerms(FULL_ADMIN) && canWriteChalls(FULL_ADMIN)).toBe(true);
  });
});
