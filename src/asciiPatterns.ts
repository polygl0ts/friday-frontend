/*
 * The long, repetitive strings the ASCII frames draw with: tall enough to
 * fill any frame, and far cheaper to build here than to ship in the CSS.
 */

const ROWS = 300;

/** A CSS string literal whose lines are joined with the `\A` escape. */
function cssLines(lines: string[]): string {
  return `"${lines.join("\\A")}"`;
}

function column(unit: string[]): string {
  return cssLines(Array.from({ length: ROWS }, (_, i) => unit[i % unit.length]));
}

export function installAsciiPatterns(root: HTMLElement = document.documentElement): void {
  const vars: Record<string, string> = {
    "--gen-pipes": column(["|"]),
    "--gen-juicer-side-0": column(["║", "║", "╫"]),
    "--gen-juicer-side-1": column(["║", "╫", "║"]),
    "--gen-juicer-side-2": column(["╫", "║", "║"]),
  };
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}
