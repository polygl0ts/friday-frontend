import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

/**
 * Writeups are player-authored and published to other players, so these are
 * the tests that matter most in the frontend. Each case is a payload someone
 * would actually try.
 */
describe("Markdown XSS boundary", () => {
  it("does not turn raw <script> into an element", () => {
    const { container } = render(
      <Markdown>{`Intro.\n\n<script>window.__pwned = true</script>`}</Markdown>,
    );
    expect(container.querySelector("script")).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it("does not turn raw HTML event handlers into elements", () => {
    const { container } = render(
      <Markdown>{`<img src=x onerror="window.__pwned = true">`}</Markdown>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it("does not turn an iframe into an element", () => {
    const { container } = render(<Markdown>{`<iframe src="https://evil.example"></iframe>`}</Markdown>);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("strips javascript: from markdown links", () => {
    const { container } = render(<Markdown>{`[click me](javascript:window.__pwned=true)`}</Markdown>);
    const anchor = container.querySelector("a");
    // Rendered as inert text, keeping the label but not the link.
    expect(anchor).toBeNull();
    expect(screen.getByText("click me")).toBeTruthy();
  });

  it.each([
    ["data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
    ["vbscript:msgbox(1)"],
    ["JaVaScRiPt:alert(1)"],
    ["  javascript:alert(1)"],
    ["//evil.example/phish"],
    ["irc://evil.example"],
  ])("refuses to link %s", (url) => {
    const { container } = render(<Markdown>{`[x](${url})`}</Markdown>);
    expect(container.querySelector("a")).toBeNull();
  });

  it("drops images with an unsafe src", () => {
    const { container } = render(<Markdown>{`![alt](javascript:alert(1))`}</Markdown>);
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps ordinary https links, but sandboxed", () => {
    const { container } = render(<Markdown>{`[hackmd](https://hackmd.io/x)`}</Markdown>);
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("https://hackmd.io/x");
    expect(anchor?.getAttribute("target")).toBe("_blank");
    // noopener stops the opened tab reaching back via window.opener.
    expect(anchor?.getAttribute("rel")).toContain("noopener");
    expect(anchor?.getAttribute("rel")).toContain("noreferrer");
  });

  it("keeps https images, without leaking the referrer", () => {
    const { container } = render(<Markdown>{`![diagram](https://example.com/a.png)`}</Markdown>);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/a.png");
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer");
  });
});

describe("Markdown rendering", () => {
  it("renders the markdown a writeup actually uses", () => {
    const { container } = render(
      <Markdown>{`# Approach\n\nThe nonce is **reused**.\n\n\`\`\`python\nprint(1)\n\`\`\`\n\n- one\n- two`}</Markdown>,
    );
    expect(container.querySelector("h1")?.textContent).toBe("Approach");
    expect(container.querySelector("strong")?.textContent).toBe("reused");
    expect(container.querySelector("pre code")?.textContent).toContain("print(1)");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders GFM tables", () => {
    const { container } = render(<Markdown>{`| a | b |\n| - | - |\n| 1 | 2 |`}</Markdown>);
    expect(container.querySelector("table")).not.toBeNull();
  });
});
