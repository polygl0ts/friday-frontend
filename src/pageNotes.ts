/** The one-sentence description on each page's sticky note. */
export const PAGE_NOTES = {
  chall: "Challenges hand-crafted and curated to guide your learning. Start here!",
  juicers: "The hardest challenges taken from past CTFs. Rotated every third monday.",
  writeups: "Writeups by polygl0ts members!",
  archived: "All challenges we ever authored.",
  slides: "Material from our lectures, see https://github.com/polylg0lts/slides .",
} as const;

export type PageNoteKey = keyof typeof PAGE_NOTES;
