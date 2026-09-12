/**
 * Average grade on a writeup. Renders nothing until someone has
 * graded it.
 */
export function WriteupScore({
  score,
  graders,
}: {
  score: number | null;
  graders: number;
}) {
  if (score === null || graders === 0) return null;
  return (
    <span
      className="writeup-score"
      title={`Average grade from ${graders} admin${graders === 1 ? "" : "s"}`}
    >
      &#9733; {score.toFixed(1)}
    </span>
  );
}
