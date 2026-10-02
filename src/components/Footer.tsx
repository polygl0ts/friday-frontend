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
    src: "discord2.gif",
    href: "https://discord.gg/7Zx4FZyTSP",
    title: "join our discord!",
  },
  {
    src: "slides.png",
    href: "https://github.com/polygl0ts/slides",
    title: "slides on github",
  },
  {
    src: "rctf.png",
    href: "https://github.com/otter-sec/rctf",
    title: "runs on rCTF",
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
    src: "torrents.gif",
    title: "torrent the decompilers",
  },
  {
    src: "datakrash_buttongenerator.gif",
    href: "https://88x31.datakra.sh/",
    title: "neat button generator, used for one button here",
  },
  {
    src: "gnu-linux.gif",
    href: "https://www.gnu.org/",
    title: "made on GNU/Linux",
  },
  {
    src: "noai.png",
    href: "https://samvieten.itch.io/no-ai",
    title: "made for humans!!",
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
