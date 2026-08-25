import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isSafeUrl } from "../utils";

/**
 * The only place writeup markdown is turned into DOM.
 *
 * Writeups are player-authored, so this is the app's untrusted-content
 * boundary.
 *
 * `isSafeUrl` moved to `utils.ts` when the Slides page turned out to need the
 * same check on admin-entered deck URLs. Same rule, imported rather than
 * duplicated - two copies of a scheme allowlist is how one of them ends up
 * missing a scheme.
 */

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (isSafeUrl(url) ? url : "")}
        components={{
          // Unsafe hrefs degrade to plain text rather than to a dead link
          a: ({ href, children }) =>
            isSafeUrl(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          // `no-referrer` so viewing a writeup never leaks our URL to whatever
          // host the author pointed at
          img: ({ src, alt }) =>
            isSafeUrl(typeof src === "string" ? src : undefined) ? (
              <img src={src} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" />
            ) : null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
