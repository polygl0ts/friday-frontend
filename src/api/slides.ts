import { request } from "./client";
import { slidesOrigin as ORIGIN } from "../config";
import type { Deck } from "../types";

/** `auth: false` matters: the rCTF token must never be sent to GitHub. */
export const getDecks = () =>
  request<Deck[]>(ORIGIN, "/decks.json", { auth: false });

/** Absolute URL of a deck's PDF. */
export const deckUrl = (deck: Deck) => `${ORIGIN}/${deck.file}`;

/** Absolute URL of a deck's recording, if it has one. */
export const recordingUrl = (deck: Deck) =>
  deck.recording ? `${ORIGIN}/${deck.recording}` : undefined;
