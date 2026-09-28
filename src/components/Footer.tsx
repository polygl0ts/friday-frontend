const BADGES: { left: string; right: string; href: string; tone?: string }[] = [
  { left: "p0", right: "polygl0ts", href: "https://polygl0ts.ch/" },
  { left: "#", right: "discord", href: "https://discord.gg/7Zx4FZyTSP", tone: "green" },
  { left: "rc", right: "rctf inside", href: "https://github.com/redpwn/rctf" },
  { left: "!ai", right: "human made", href: "/", tone: "amber" },
  { left: "gh", right: "slides", href: "https://github.com/polygl0ts/slides" },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="badges">
        {BADGES.map((badge) => (
          <a
            key={badge.right}
            className={`badge88${badge.tone ? ` ${badge.tone}` : ""}`}
            href={badge.href}
            target={badge.href.startsWith("/") ? undefined : "_blank"}
            rel="noreferrer"
          >
            <b>{badge.left}</b>
            <span>{badge.right}</span>
          </a>
        ))}
      </div>
      <div>
        best viewed with any browser at any resolution &middot; fridays 17h @
        EPFL
      </div>
      <div>&copy; polygl0ts &middot; hack the planet</div>
    </footer>
  );
}
