import logoUrl from "../assets/logo.svg";

type Button = {
  href: string;
  title: string;
  /** Left-hand icon cell: a short glyph, or the logo. */
  icon: string | "logo";
  lines: [string, string];
  tone: "red" | "dark" | "green" | "grey";
};

const BUTTONS: Button[] = [
  {
    href: "https://discord.gg/7Zx4FZyTSP",
    title: "join our discord",
    icon: "#",
    lines: ["JOIN US", "DISCORD"],
    tone: "dark",
  },
  {
    href: "https://github.com/redpwn/rctf",
    title: "runs on rCTF",
    icon: "rc",
    lines: ["POWERED", "BY rCTF"],
    tone: "grey",
  },
  {
    href: "/",
    title: "FOR HUMANS",
    icon: "!ai",
    lines: ["FOR", "HUMANS"],
    tone: "green",
  },
  {
    href: "https://github.com/polygl0ts/slides",
    title: "slides on github",
    icon: "gh",
    lines: ["SLIDES", "GITHUB"],
    tone: "dark",
  },
];

/** Classic buttons from the cyber.dabamos.de/88x31 archive, served from public/88x31. */
const IMAGES: { src: string; title: string; href?: string }[] = [
  {
    src: "polygl0ts.gif",
    href: "https://polygl0ts.ch/",
    title: "polygl0ts",
  },
  {
    src: "hackerpowered.gif",
    href: "https://polygl0ts.ch/",
    title: "hacker powered",
  },
  {
    src: "neocities-now.gif",
    href: "https://neocities.org/",
    title: "neocities now!",
  },
  {
    src: "madewithvi.gif",
    href: "https://www.vim.org/",
    title: "made with vi",
  },
  {
    src: "gnu-linux.gif",
    href: "https://www.gnu.org/",
    title: "made on GNU/Linux",
  },
  { src: "lain.gif", title: "lain" },
  { src: "emulate.gif", title: "emulate now!" },
  { src: "piracy.gif", title: "piracy now!" },
  { src: "saynotoweb3.gif", title: "keep the web free" },
  { src: "crushit.gif", title: "lets crush capitalism" },
  { src: "nocookie.gif", title: "100% cookie free" },
  { src: "antinft.gif", title: "anti-NFT site" },
  {
    src: "aurea.png",
    href: "https://thenet.sk/",
    title: "organizers/aurea"
  },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="badges">
        {BUTTONS.map((b) => (
          <a
            key={b.title}
            className={`b88 b88-${b.tone}`}
            href={b.href}
            title={b.title}
            target={b.href.startsWith("/") ? undefined : "_blank"}
            rel="noreferrer"
          >
            <span className="b88-icon">
              {b.icon === "logo" ? <img src={logoUrl} alt="" /> : b.icon}
            </span>
            <span className="b88-text">
              <span>{b.lines[0]}</span>
              <span>{b.lines[1]}</span>
            </span>
          </a>
        ))}
        {IMAGES.map((b) => {
          const img = (
            <img src={`/88x31/${b.src}`} alt={b.title} width={88} height={31} />
          );
          return b.href ? (
            <a
              key={b.src}
              className="b88-img"
              href={b.href}
              title={b.title}
              target="_blank"
              rel="noreferrer"
            >
              {img}
            </a>
          ) : (
            <span key={b.src} className="b88-img" title={b.title}>
              {img}
            </span>
          );
        })}
      </div>
      <div>polygl0ts &middot; fridays 17h at EPFL</div>
    </footer>
  );
}
