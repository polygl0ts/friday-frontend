import type { ReactNode } from "react";
import type { ChallengeWithMeta } from "../types";

export type FrameRank = "bronze" | "silver" | "gold" | "juicer" | "deck";

export function frameRank(
  chall: Pick<ChallengeWithMeta, "juicer" | "tier">,
): FrameRank {
  return chall.juicer ? "juicer" : (chall.tier ?? "silver");
}

/**
 * The ASCII frame every challenge surface shares: the title and a figure set
 * into the top rule, a textured background, and the rank's border.
 */
export function AsciiFrame({
  rank,
  title,
  figure,
  solved = false,
  variant,
  interactive = false,
  className = "",
  topRight,
  onClick,
  children,
}: {
  rank: FrameRank;
  /** Omitted, the top rule runs unbroken. */
  title?: ReactNode;
  figure?: ReactNode;
  solved?: boolean;
  /** "writeup" swaps the title brackets so writeups read as a sibling set. */
  variant?: "writeup";
  interactive?: boolean;
  className?: string;
  /** Rendered in the top rule after the figure, e.g. a close button. */
  topRight?: ReactNode;
  onClick?: () => void;
  children: ReactNode;
}) {
  const classes = [
    "ascii-frame",
    `rank-${rank}`,
    variant,
    title === undefined && "untitled",
    solved && "solved",
    interactive && "interactive",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} onClick={onClick}>
      <span className="frame-bg" aria-hidden="true" />
      <span className="frame-flourish left" aria-hidden="true" />
      <span className="frame-flourish right" aria-hidden="true" />
      <div className="rule rule-top">
        {title !== undefined && <span className="card-name">{title}</span>}
        <span className="rule-fill" aria-hidden="true" />
        {figure !== undefined && (
          <span className={`card-points${solved ? " solved" : ""}`}>
            {figure}
          </span>
        )}
        {topRight}
      </div>
      <div className="frame-body">{children}</div>
      <div className="rule rule-bottom" aria-hidden="true">
        <span className="rule-fill" />
      </div>
    </div>
  );
}
