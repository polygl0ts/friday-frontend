import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Slides } from "./Slides";
import type { Deck } from "../types";

const getDecks = vi.fn<() => Promise<Deck[]>>();

// No AuthContext mock on purpose: the page must render outside AuthProvider,
// which is what "public" means here. Re-adding a login gate fails this file.
vi.mock("../api/slides", () => ({
  getDecks: () => getDecks(),
  deckUrl: (deck: Deck) => `https://slides.example/${deck.file}`,
}));

function deck(over: Partial<Deck> = {}): Deck {
  return {
    id: "2026-09-11-web-101",
    title: "Web 101",
    date: "2026-09-11",
    file: "decks/2026-09-11-web-101.pdf",
    pages: 24,
    size_bytes: 1_830_400,
    ...over,
  };
}

function renderSlides() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Slides />
    </QueryClientProvider>,
  );
}

describe("Slides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders one card per deck, linking to the PDF in a new tab", async () => {
    getDecks.mockResolvedValue([
      deck(),
      deck({ id: "2026-09-04-pwn-intro", title: "Pwn Intro", file: "decks/2026-09-04-pwn-intro.pdf" }),
    ]);
    renderSlides();

    const link = (await screen.findByText("Web 101")).closest("a");
    expect(link?.getAttribute("href")).toBe("https://slides.example/decks/2026-09-11-web-101.pdf");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noreferrer");
    expect(screen.getByText("Pwn Intro")).toBeTruthy();
  });

  it("shows date, page count and size on the meta line", async () => {
    getDecks.mockResolvedValue([deck()]);
    renderSlides();

    expect(await screen.findByText("2026-09-11 · 24 slides · 1.7 MiB")).toBeTruthy();
  });

  it("keeps the manifest's order rather than re-sorting", async () => {
    getDecks.mockResolvedValue([deck({ id: "b", title: "Second" }), deck({ id: "a", title: "First" })]);
    renderSlides();

    await screen.findByText("Second");
    const titles = screen.getAllByText(/^(Second|First)$/).map((el) => el.textContent);
    expect(titles).toEqual(["Second", "First"]);
  });

  it("says so when there are no decks", async () => {
    getDecks.mockResolvedValue([]);
    renderSlides();

    expect(await screen.findByText("No decks published yet.")).toBeTruthy();
  });

  it("surfaces the fetch error", async () => {
    getDecks.mockRejectedValue(new Error("Not Found"));
    renderSlides();

    expect(await screen.findByText("Not Found")).toBeTruthy();
  });
});
