/** The one-sentence description on each page's sticky note. */
export const PAGE_NOTES = {
  chall: "This week's challenges, sorted by tier - new to CTFs? Start at bronze.",
  juicers: "The juicer challenges, for when you want something extra to chew on.",
  writeups: "Read how other players solved a challenge, or publish your own once you have.",
  archived: "Challenges from past seasons and LakeCTF editions, still open to play.",
  slides: "Slides and recordings from the talks we give at the Friday meetings.",
  intro2: "Guided challenges you solve step by step, with no score pressure.",
} as const;

export type PageNoteKey = keyof typeof PAGE_NOTES;
